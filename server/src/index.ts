import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  type Card,
  type ClientToServerEvents,
  compareCards,
  createDeck,
  type PublicPlayer,
  type RoomState,
  type ServerToClientEvents,
  type TableCard,
  type TrucoRequest,
  shuffle
} from "@truco/shared";
import {
  createMatch,
  finishMatch,
  isDatabaseEnabled,
  recordHandResult,
  upsertPlayer
} from "./db.js";

type PlayerState = {
  id: string;
  name: string;
  hand: Card[];
  roundWins: number;
  points: number;
  games: number;
  token: string;
};

type Room = {
  id: string;
  players: PlayerState[];
  table: TableCard[];
  vira?: Card;
  handValue: RoomState["handValue"];
  turnPlayerId: string | null;
  status: RoomState["status"];
  trucoRequest?: TrucoRequest;
  lastTrucoRequesterId?: string;
  lastTrucoRaise?: {
    playerId: string;
    playerName: string;
    value: RoomState["handValue"];
  };
  dbMatchId?: string;
};

const app = express();
app.use(cors());
app.get("/health", (_request, response) => response.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*"
  }
});

const rooms = new Map<string, Room>();
const trickRevealDelayMs = 1200;
let nextAutoRoomNumber = 1;

function toPublicPlayer(player: PlayerState): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    cardCount: player.hand.length,
    roundWins: player.roundWins,
    points: player.points,
    games: player.games,
    hand: player.hand
  };
}

function getRoom(roomId: string): Room {
  const existing = rooms.get(roomId);

  if (existing) {
    return existing;
  }

  const room: Room = {
    id: roomId,
    players: [],
    table: [],
    vira: undefined,
    handValue: 1,
    turnPlayerId: null,
    status: "waiting"
  };

  rooms.set(roomId, room);
  return room;
}

function createAutoRoom(): Room {
  let roomId = `mesa-${nextAutoRoomNumber}`;

  while (rooms.has(roomId)) {
    nextAutoRoomNumber += 1;
    roomId = `mesa-${nextAutoRoomNumber}`;
  }

  nextAutoRoomNumber += 1;
  return getRoom(roomId);
}

function findRoomByPlayerToken(token: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.token === token)) {
      return room;
    }
  }

  return undefined;
}

function findWaitingRoom(): Room | undefined {
  for (const room of rooms.values()) {
    if (room.status === "waiting" && room.players.length < 2) {
      return room;
    }
  }

  return undefined;
}

function getJoinRoom(roomId: string | undefined, token: string): Room {
  const requestedRoomId = roomId?.trim();

  if (requestedRoomId) {
    return getRoom(requestedRoomId);
  }

  return findRoomByPlayerToken(token) ?? findWaitingRoom() ?? createAutoRoom();
}

function replacePlayerId(room: Room, previousId: string, nextId: string): void {
  if (previousId === nextId) {
    return;
  }

  if (room.turnPlayerId === previousId) {
    room.turnPlayerId = nextId;
  }

  for (const tableCard of room.table) {
    if (tableCard.playerId === previousId) {
      tableCard.playerId = nextId;
    }
  }

  if (room.trucoRequest?.requestedByPlayerId === previousId) {
    room.trucoRequest.requestedByPlayerId = nextId;
  }

  if (room.trucoRequest?.responderPlayerId === previousId) {
    room.trucoRequest.responderPlayerId = nextId;
  }

  if (room.lastTrucoRequesterId === previousId) {
    room.lastTrucoRequesterId = nextId;
  }

  if (room.lastTrucoRaise?.playerId === previousId) {
    room.lastTrucoRaise.playerId = nextId;
  }
}

function buildState(room: Room, viewerId: string): RoomState {
  const self = room.players.find((player) => player.id === viewerId);

  return {
    roomId: room.id,
    players: room.players.map(toPublicPlayer),
    self: self ? toPublicPlayer(self) : undefined,
    table: room.table,
    vira: room.vira,
    handValue: room.handValue,
    turnPlayerId: room.turnPlayerId,
    status: room.status,
    message: buildMessage(room, viewerId),
    trucoRequest: room.trucoRequest,
    lastTrucoRaise: room.lastTrucoRaise
  };
}

function buildMessage(room: Room, viewerId: string): string {
  if (room.status === "waiting") {
    return "Esperando outro jogador";
  }

  if (room.trucoRequest) {
    return room.trucoRequest.responderPlayerId === viewerId
      ? `${room.trucoRequest.requestedByPlayerName} pediu ${trucoValueName(room.trucoRequest.requestedValue)}`
      : "Aguardando resposta do oponente";
  }

  return room.turnPlayerId === viewerId ? "Sua vez de jogar" : "Vez do oponente";
}

function broadcastState(room: Room): void {
  for (const player of room.players) {
    io.to(player.id).emit("room:state", buildState(room, player.id));
  }
}

function runDatabaseTask(task: () => Promise<void>): void {
  if (!isDatabaseEnabled()) {
    return;
  }

  void task().catch((error: unknown) => {
    console.error("Database task failed", error);
  });
}

function startPersistentMatch(room: Room): void {
  runDatabaseTask(async () => {
    room.dbMatchId = await createMatch(
      room.id,
      room.players.map((player) => ({
        token: player.token,
        name: player.name
      }))
    ) ?? undefined;
  });
}

function dealHand(room: Room, firstPlayerId = room.players[0]?.id): void {
  const deck = shuffle(createDeck());

  room.players[0].hand = deck.slice(0, 3);
  room.players[1].hand = deck.slice(3, 6);
  room.vira = deck[6];
  room.players[0].roundWins = 0;
  room.players[1].roundWins = 0;
  room.table = [];
  room.handValue = 1;
  room.turnPlayerId = firstPlayerId;
  room.status = "playing";
  room.trucoRequest = undefined;
  room.lastTrucoRequesterId = undefined;
  room.lastTrucoRaise = undefined;
  room.dbMatchId = undefined;
}

function startMatch(room: Room): void {
  for (const player of room.players) {
    player.roundWins = 0;
    player.points = 0;
    player.games = 0;
  }

  dealHand(room);
  startPersistentMatch(room);
}

function finishHand(room: Room, winner: PlayerState): void {
  awardHand(room, winner, room.handValue);
}

function awardHand(room: Room, winner: PlayerState, points: RoomState["handValue"]): void {
  const loser = room.players.find((player) => player.id !== winner.id);
  const matchId = room.dbMatchId;

  winner.points += points;
  const finishedGame = winner.points >= 12;
  const winnerPointsAfter = winner.points;
  const loserPointsAfter = loser?.points ?? 0;

  runDatabaseTask(async () => {
    await recordHandResult({
      matchId,
      roomId: room.id,
      winnerToken: winner.token,
      winnerName: winner.name,
      handValue: points,
      winnerPointsAfter,
      loserPointsAfter,
      finishedGame
    });

    if (finishedGame) {
      await finishMatch(matchId, {
        token: winner.token,
        name: winner.name
      });
    }
  });

  if (finishedGame) {
    winner.games += 1;
    winner.points = 0;
    for (const player of room.players) {
      if (player.id !== winner.id) {
        player.points = 0;
      }
    }
  }

  dealHand(room, winner.id);

  if (finishedGame) {
    startPersistentMatch(room);
  }
}

function finishTrickIfReady(room: Room): void {
  if (room.table.length < 2) {
    return;
  }

  const [first, second] = room.table;
  const winner = getTrickWinner(first, second);
  const winnerPlayer = room.players.find((player) => player.id === winner);

  if (winnerPlayer) {
    winnerPlayer.roundWins += 1;
  }

  room.table = [];
  room.turnPlayerId = winner ?? first.playerId;
  const allCardsPlayed = room.players.every((player) => player.hand.length === 0);

  if (winnerPlayer && (winnerPlayer.roundWins >= 2 || allCardsPlayed)) {
    finishHand(room, winnerPlayer);
    return;
  }

  if (allCardsPlayed) {
    const [leftPlayer, rightPlayer] = room.players;
    const handWinner = leftPlayer.roundWins === rightPlayer.roundWins
      ? null
      : leftPlayer.roundWins > rightPlayer.roundWins
        ? leftPlayer
        : rightPlayer;

    if (handWinner) {
      finishHand(room, handWinner);
      return;
    }

    dealHand(room, first.playerId);
  }
}

function getTrickWinner(first: TableCard, second: TableCard): string | null {
  if (first.faceDown && second.faceDown) {
    return null;
  }

  if (first.faceDown) {
    return second.playerId;
  }

  if (second.faceDown) {
    return first.playerId;
  }

  return compareCards(first.card, second.card) >= 0 ? first.playerId : second.playerId;
}

function nextHandValue(value: RoomState["handValue"]): RoomState["handValue"] | null {
  const values: Record<RoomState["handValue"], RoomState["handValue"] | null> = {
    1: 3,
    3: 6,
    6: 9,
    9: 12,
    12: null
  };

  return values[value];
}

function trucoValueName(value: RoomState["handValue"]): string {
  const names: Record<RoomState["handValue"], string> = {
    1: "truco",
    3: "truco",
    6: "seis",
    9: "nove",
    12: "doze"
  };

  return names[value];
}

function canAskForTruco(player: PlayerState): boolean {
  return player.points !== 11;
}

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, name, token }) => {
    const room = getJoinRoom(roomId, token);
    const existing = room.players.find((player) => player.token === token);

    if (!existing && room.players.length >= 2) {
      socket.emit("room:error", { message: "Mesa cheia" });
      return;
    }

    if (existing) {
      const previousId = existing.id;

      existing.id = socket.id;
      existing.name = name.trim() || existing.name;
      replacePlayerId(room, previousId, socket.id);
      socket.join(room.id);
      runDatabaseTask(async () => {
        await upsertPlayer({
          token: existing.token,
          name: existing.name
        });
      });

      broadcastState(room);
      return;
    }

    if (!existing) {
      room.players.push({
        id: socket.id,
        name: name.trim() || "Jogador",
        token,
        hand: [],
        roundWins: 0,
        points: 0,
        games: 0
      });

      socket.join(room.id);
      runDatabaseTask(async () => {
        await upsertPlayer({
          token,
          name: name.trim() || "Jogador"
        });
      });
    }

    if (room.players.length === 2 && room.status === "waiting") {
      startMatch(room);
    }

    broadcastState(room);
  });

socket.on("room:leave", ({ roomId }) => {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  const index = room.players.findIndex((player) => player.id === socket.id);

  if (index >= 0) {
    room.players.splice(index, 1);
  }

  room.table = [];
  room.vira = undefined;
  room.handValue = 1;
  room.status = "waiting";
  room.turnPlayerId = null;
  room.trucoRequest = undefined;
  room.lastTrucoRequesterId = undefined;
  room.lastTrucoRaise = undefined;

  broadcastState(room);
});
  socket.on("card:play", ({ roomId, cardId, faceDown }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      socket.emit("room:error", { message: "Partida indisponivel" });
      return;
    }

    if (room.trucoRequest) {
      socket.emit("room:error", { message: "Responda o pedido de truco antes de jogar" });
      return;
    }

    if (room.turnPlayerId !== socket.id) {
      socket.emit("room:error", { message: "Ainda nao e sua vez" });
      return;
    }

    const cardIndex = player.hand.findIndex((card) => card.id === cardId);

    if (cardIndex < 0) {
      socket.emit("room:error", { message: "Carta invalida" });
      return;
    }

    const canPlayFaceDown = player.hand.length < 3;
    const shouldPlayFaceDown = Boolean(faceDown && canPlayFaceDown);

    const [card] = player.hand.splice(cardIndex, 1);
    room.table.push({ playerId: player.id, card, faceDown: shouldPlayFaceDown });

    if (room.table.length === 1) {
      room.turnPlayerId = room.players.find((item) => item.id !== player.id)?.id ?? null;
    }

    if (room.table.length === 2) {
      room.turnPlayerId = null;
      broadcastState(room);

      setTimeout(() => {
        finishTrickIfReady(room);
        broadcastState(room);
      }, trickRevealDelayMs);
      return;
    }

    finishTrickIfReady(room);
    broadcastState(room);
  });

  socket.on("truco:raise", ({ roomId }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      socket.emit("room:error", { message: "Partida indisponivel" });
      return;
    }

    if (room.trucoRequest) {
      socket.emit("room:error", { message: "Ja existe um pedido de truco pendente" });
      return;
    }

    if (!canAskForTruco(player)) {
      socket.emit("room:error", { message: "Quem esta com 11 pontos nao pode pedir truco" });
      return;
    }

    if (room.lastTrucoRequesterId === socket.id) {
      socket.emit("room:error", { message: "Voce deve esperar o oponente aumentar a aposta" });
      return;
    }

    const raisedValue = nextHandValue(room.handValue);

    if (!raisedValue) {
      socket.emit("room:error", { message: "A mao ja esta valendo 12" });
      return;
    }

    const opponent = room.players.find((item) => item.id !== socket.id);

    if (!opponent) {
      socket.emit("room:error", { message: "Sem oponente na mesa" });
      return;
    }

    room.trucoRequest = {
      requestedByPlayerId: player.id,
      requestedByPlayerName: player.name,
      responderPlayerId: opponent.id,
      currentValue: room.handValue as TrucoRequest["currentValue"],
      requestedValue: raisedValue as TrucoRequest["requestedValue"]
    };
    room.lastTrucoRaise = {
      playerId: player.id,
      playerName: player.name,
      value: raisedValue
    };
    room.lastTrucoRequesterId = player.id;
    broadcastState(room);
  });

  socket.on("truco:respond", ({ roomId, action }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);
    const request = room?.trucoRequest;

    if (!room || !player || room.status !== "playing" || !request) {
      socket.emit("room:error", { message: "Nao existe pedido de truco pendente" });
      return;
    }

    if (request.responderPlayerId !== socket.id) {
      socket.emit("room:error", { message: "A resposta e do oponente" });
      return;
    }

    const requester = room.players.find((item) => item.id === request.requestedByPlayerId);

    if (!requester) {
      room.trucoRequest = undefined;
      broadcastState(room);
      return;
    }

    if (action === "accept") {
      room.handValue = request.requestedValue;
      room.trucoRequest = undefined;
      broadcastState(room);
      return;
    }

    if (action === "reject") {
      const points = request.currentValue;

      room.trucoRequest = undefined;
      awardHand(room, requester, points);
      broadcastState(room);
      return;
    }

    if (!canAskForTruco(player)) {
      socket.emit("room:error", { message: "Quem esta com 11 pontos nao pode aumentar" });
      return;
    }

    if (request.requestedByPlayerId === socket.id) {
      socket.emit("room:error", { message: "Voce nao pode aumentar o proprio pedido" });
      return;
    }

    const raisedValue = nextHandValue(request.requestedValue);

    if (!raisedValue) {
      socket.emit("room:error", { message: "A mao ja esta valendo 12" });
      return;
    }

    room.trucoRequest = {
      requestedByPlayerId: player.id,
      requestedByPlayerName: player.name,
      responderPlayerId: requester.id,
      currentValue: request.requestedValue,
      requestedValue: raisedValue as TrucoRequest["requestedValue"]
    };
    room.lastTrucoRaise = {
      playerId: player.id,
      playerName: player.name,
      value: raisedValue
    };
    room.lastTrucoRequesterId = player.id;
    broadcastState(room);
  });

  socket.on("audio:send", ({ roomId, audio, mimeType }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      socket.emit("room:error", { message: "Partida indisponivel" });
      return;
    }

    if (audio.byteLength > 800_000) {
      socket.emit("room:error", { message: "Audio muito longo" });
      return;
    }

    for (const opponent of room.players) {
      if (opponent.id !== socket.id) {
        io.to(opponent.id).emit("audio:message", {
          playerId: player.id,
          playerName: player.name,
          audio,
          mimeType
        });
      }
    }
  });

  socket.on("disconnect", () => {
    setTimeout(() => {
      for (const room of rooms.values()) {
        const index = room.players.findIndex((player) => player.id === socket.id);

        if (index >= 0) {
          room.players.splice(index, 1);
          room.table = [];
          room.vira = undefined;
          room.handValue = 1;
          room.status = "waiting";
          room.turnPlayerId = null;
          room.trucoRequest = undefined;
          room.lastTrucoRequesterId = undefined;
          room.lastTrucoRaise = undefined;
          room.dbMatchId = undefined;

          broadcastState(room);
        }
      }
    }, 15000);
  });
});

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Truco server running on http://localhost:${port}`);
});
