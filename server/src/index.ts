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
  shuffle
} from "@truco/shared";

type PlayerState = {
  id: string;
  name: string;
  hand: Card[];
  roundWins: number;
  points: number;
  games: number;
};

type Room = {
  id: string;
  players: PlayerState[];
  table: { playerId: string; card: Card }[];
  vira?: Card;
  handValue: RoomState["handValue"];
  turnPlayerId: string | null;
  status: RoomState["status"];
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
    message: room.status === "waiting" ? "Esperando outro jogador" : "Sua vez de jogar"
  };
}

function broadcastState(room: Room): void {
  for (const player of room.players) {
    io.to(player.id).emit("room:state", buildState(room, player.id));
  }
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
}

function startMatch(room: Room): void {
  for (const player of room.players) {
    player.roundWins = 0;
    player.points = 0;
    player.games = 0;
  }

  dealHand(room);
}

function finishHand(room: Room, winner: PlayerState): void {
  winner.points += room.handValue;

  if (winner.points >= 12) {
    winner.games += 1;
    winner.points = 0;
    for (const player of room.players) {
      if (player.id !== winner.id) {
        player.points = 0;
      }
    }
  }

  dealHand(room, winner.id);
}

function finishTrickIfReady(room: Room): void {
  if (room.table.length < 2) {
    return;
  }

  const [first, second] = room.table;
  const winner = compareCards(first.card, second.card) >= 0 ? first.playerId : second.playerId;
  const winnerPlayer = room.players.find((player) => player.id === winner);

  if (winnerPlayer) {
    winnerPlayer.roundWins += 1;
  }

  room.table = [];
  room.turnPlayerId = winner;

  if (winnerPlayer && (winnerPlayer.roundWins >= 2 || room.players.every((player) => player.hand.length === 0))) {
    finishHand(room, winnerPlayer);
  }
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

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, name }) => {
    const room = getRoom(roomId.trim() || "mesa-1");
    const existing = room.players.find((player) => player.id === socket.id);

    if (!existing && room.players.length >= 2) {
      socket.emit("room:error", { message: "Mesa cheia" });
      return;
    }

    if (!existing) {
      room.players.push({
        id: socket.id,
        name: name.trim() || "Jogador",
        hand: [],
        roundWins: 0,
        points: 0,
        games: 0
      });

      socket.join(room.id);
    }

    if (room.players.length === 2 && room.status === "waiting") {
      startMatch(room);
    }

    broadcastState(room);
  });

  socket.on("card:play", ({ roomId, cardId }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      socket.emit("room:error", { message: "Partida indisponivel" });
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

    const [card] = player.hand.splice(cardIndex, 1);
    room.table.push({ playerId: player.id, card });

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

    const raisedValue = nextHandValue(room.handValue);

    if (!raisedValue) {
      socket.emit("room:error", { message: "A mao ja esta valendo 12" });
      return;
    }

    room.handValue = raisedValue;
    broadcastState(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const index = room.players.findIndex((player) => player.id === socket.id);

      if (index >= 0) {
        room.players.splice(index, 1);
        room.table = [];
        room.vira = undefined;
        room.handValue = 1;
        room.status = "waiting";
        room.turnPlayerId = null;
        broadcastState(room);
      }
    }
  });
});

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Truco server running on http://localhost:${port}`);
});
