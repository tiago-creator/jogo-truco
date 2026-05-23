import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  type Card,
  type ClientToServerEvents,
  compareCardsWithVira,
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
  getPlayerProfile,
  getPlayerProfileByEmail,
  isDatabaseEnabled,
  recordHandResult,
  savePlayerProfile,
  upsertPlayer
} from "./db.js";

type PlayerState = {
  id: string;
  name: string;
  avatarUrl?: string;
  isCpu?: boolean;
  hand: Card[];
  roundWins: number;
  points: number;
  games: number;
  token: string;
};

type TrickResult = {
  winnerPlayerId: string | null;
};

type Room = {
  id: string;
  players: PlayerState[];
  table: TableCard[];
  vira?: Card;
  handValue: RoomState["handValue"];
  turnPlayerId: string | null;
  status: RoomState["status"];
  isIronHand?: boolean;
  trickResults: TrickResult[];
  elevenHandDecision?: RoomState["elevenHandDecision"];
  trucoRequest?: TrucoRequest;
  lastTrucoRequesterId?: string;
  lastTrucoRaise?: {
    playerId: string;
    playerName: string;
    value: RoomState["handValue"];
  };
  lastGameWinnerId?: string;
  lastGameWinnerName?: string;
  lastTrucoResponse?: RoomState["lastTrucoResponse"];
  dbMatchId?: string;
  cpuActionTimer?: ReturnType<typeof setTimeout>;
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_request, response) => response.json({ ok: true }));

function cleanProfilePayload(body: unknown): { token: string; name: string; email: string; avatarUrl?: string } | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Partial<Record<"token" | "name" | "email" | "avatarUrl", unknown>>;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : "";

  if (!token || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  if (!avatarUrl || !avatarUrl.startsWith("data:image/") || avatarUrl.length > 1_500_000) {
    return null;
  }

  return {
    token,
    name: name.slice(0, 24),
    email,
    avatarUrl: avatarUrl || undefined
  };
}

app.get("/profile/:token", async (request, response) => {
  if (!isDatabaseEnabled()) {
    response.status(503).json({ message: "Banco de dados nao configurado" });
    return;
  }

  const profile = await getPlayerProfile(request.params.token);

  response.json({ profile });
});

app.post("/profile", async (request, response) => {
  if (!isDatabaseEnabled()) {
    response.status(503).json({ message: "Banco de dados nao configurado" });
    return;
  }

  const profile = cleanProfilePayload(request.body);

  if (!profile) {
    response.status(400).json({ message: "Preencha nome, email valido e uma foto em formato de imagem" });
    return;
  }

  try {
    const savedProfile = await savePlayerProfile(profile);

    response.json({ profile: savedProfile });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      response.status(409).json({ message: "Este email ja esta cadastrado em outro perfil" });
      return;
    }

    throw error;
  }
});

app.post("/login", async (request, response) => {
  if (!isDatabaseEnabled()) {
    response.status(503).json({ message: "Banco de dados nao configurado" });
    return;
  }

  const payload = request.body as { email?: unknown };
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ message: "Digite um email valido" });
    return;
  }

  const profile = await getPlayerProfileByEmail(email);

  if (!profile) {
    response.status(404).json({ message: "Perfil nao encontrado" });
    return;
  }

  response.json({ profile });
});

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
    avatarUrl: player.avatarUrl,
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
    status: "waiting",
    trickResults: []
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
    isIronHand: room.isIronHand,
    elevenHandDecision: room.elevenHandDecision,
    trucoRequest: room.trucoRequest,
    lastTrucoRaise: room.lastTrucoRaise,
    lastGameWinnerId: room.lastGameWinnerId,
    lastGameWinnerName: room.lastGameWinnerName,
    lastTrucoResponse: room.lastTrucoResponse
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

  if (room.elevenHandDecision) {
    return room.elevenHandDecision.playerId === viewerId
      ? room.elevenHandDecision.isIronHand
        ? "Mao de ferro: jogue sem ver as cartas"
        : "Mao de 11: jogar ou correr?"
      : "Aguardando decisao da mao de 11";
  }

  return room.turnPlayerId === viewerId ? "Sua vez de jogar" : "Vez do oponente";
}

function broadcastState(room: Room): void {
  for (const player of room.players) {
    if (player.isCpu) {
      continue;
    }

    io.to(player.id).emit("room:state", buildState(room, player.id));
  }

  scheduleCpuAction(room);
}

function runDatabaseTask(task: () => Promise<void>): void {
  if (!isDatabaseEnabled()) {
    return;
  }

  void task().catch((error: unknown) => {
    console.error("Database task failed", error);
  });
}

async function getProfileForJoin(token: string): Promise<Awaited<ReturnType<typeof getPlayerProfile>>> {
  try {
    return await getPlayerProfile(token);
  } catch (error) {
    console.error("Could not load player profile", error);
    return null;
  }
}

function startPersistentMatch(room: Room): void {
  runDatabaseTask(async () => {
    room.dbMatchId = await createMatch(
      room.id,
      room.players.map((player) => ({
        token: player.token,
        name: player.name,
        avatarUrl: player.avatarUrl
      }))
    ) ?? undefined;
  });
}

function dealHand(room: Room, firstPlayerId = room.players[0]?.id): void {
  const deck = shuffle(createDeck());
  const isIronHand = room.players.length === 2 && room.players.every((player) => player.points === 11);
  const elevenHandPlayer = room.players.find((player) => player.points === 11);

  room.players[0].hand = deck.slice(0, 3);
  room.players[1].hand = deck.slice(3, 6);
  room.vira = deck[6];
  room.players[0].roundWins = 0;
  room.players[1].roundWins = 0;
  room.table = [];
  room.trickResults = [];
  room.handValue = isIronHand || elevenHandPlayer ? 3 : 1;
  room.turnPlayerId = firstPlayerId;
  room.status = "playing";
  room.isIronHand = isIronHand;
  room.elevenHandDecision = elevenHandPlayer && !isIronHand
    ? {
      playerId: elevenHandPlayer.id,
      playerName: elevenHandPlayer.name,
      isIronHand: false
    }
    : undefined;
  room.trucoRequest = undefined;
  room.lastTrucoRequesterId = undefined;
  room.lastTrucoRaise = undefined;
  room.lastTrucoResponse = undefined;
  room.lastGameWinnerId = undefined;
  room.lastGameWinnerName = undefined;
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
    room.lastGameWinnerId = winner.id;
    room.lastGameWinnerName = winner.name;
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
  const winner = getTrickWinner(room, first, second);
  const winnerPlayer = room.players.find((player) => player.id === winner);
  const firstTrickWinnerId = room.trickResults[0]?.winnerPlayerId ?? null;

  if (winnerPlayer) {
    winnerPlayer.roundWins += 1;
  }

  room.trickResults.push({ winnerPlayerId: winner });
  room.table = [];
  room.turnPlayerId = winner ?? first.playerId;
  const allCardsPlayed = room.players.every((player) => player.hand.length === 0);
  const trickCount = room.trickResults.length;

  if (trickCount === 1) {
    return;
  }

  if (trickCount === 2) {
    if (!firstTrickWinnerId && winnerPlayer) {
      finishHand(room, winnerPlayer);
      return;
    }

    if (firstTrickWinnerId && !winner) {
      const handWinner = room.players.find((player) => player.id === firstTrickWinnerId);

      if (handWinner) {
        finishHand(room, handWinner);
      }

      return;
    }

    if (winnerPlayer && winnerPlayer.id === firstTrickWinnerId) {
      finishHand(room, winnerPlayer);
      return;
    }

    return;
  }

  if (trickCount >= 3) {
    const handWinner = firstTrickWinnerId
      ? room.players.find((player) => player.id === firstTrickWinnerId)
      : winnerPlayer;

    if (handWinner) {
      finishHand(room, handWinner);
      return;
    }

    dealHand(room, first.playerId);
    return;
  }

  if (winnerPlayer && allCardsPlayed) {
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

function getTrickWinner(room: Room, first: TableCard, second: TableCard): string | null {
  if (first.faceDown && second.faceDown) {
    return null;
  }

  if (first.faceDown) {
    return second.playerId;
  }

  if (second.faceDown) {
    return first.playerId;
  }

  if (!room.vira) {
    return null;
  }

  const comparison = compareCardsWithVira(first.card, second.card, room.vira);

  if (comparison === 0) {
    return null;
  }

  return comparison > 0 ? first.playerId : second.playerId;
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

function canRoomAskForTruco(room: Room): boolean {
  return !room.elevenHandDecision && !room.players.some((player) => player.points === 11);
}

function makePlayerCpu(room: Room, player: PlayerState): void {
  player.isCpu = true;
  player.name = `${player.name} CPU`;
  player.avatarUrl = undefined;
}

function handlePlayerExit(socketId: string, explicitRoomId?: string): void {
  const targetRooms = explicitRoomId ? [rooms.get(explicitRoomId)].filter(Boolean) as Room[] : Array.from(rooms.values());

  for (const room of targetRooms) {
    const player = room.players.find((item) => item.id === socketId);

    if (!player) {
      continue;
    }

    const hasHumanOpponent = room.players.some((item) => item.id !== socketId && !item.isCpu);

    if (room.status === "playing" && room.players.length === 2 && hasHumanOpponent) {
      makePlayerCpu(room, player);
      broadcastState(room);
      return;
    }

    room.players = room.players.filter((item) => item.id !== socketId);
    room.table = [];
    room.vira = undefined;
    room.handValue = 1;
    room.status = "waiting";
    room.turnPlayerId = null;
    room.trucoRequest = undefined;
    room.lastTrucoRequesterId = undefined;
    room.lastTrucoRaise = undefined;
    room.lastTrucoResponse = undefined;
    room.lastGameWinnerId = undefined;
    room.lastGameWinnerName = undefined;
    room.elevenHandDecision = undefined;
    room.isIronHand = false;
    room.trickResults = [];
    room.dbMatchId = undefined;
    clearTimeout(room.cpuActionTimer);
    room.cpuActionTimer = undefined;

    broadcastState(room);
    return;
  }
}

function scheduleCpuAction(room: Room): void {
  if (room.cpuActionTimer || room.status !== "playing") {
    return;
  }

  const cpuResponder = room.trucoRequest
    ? room.players.find((player) => player.isCpu && player.id === room.trucoRequest?.responderPlayerId)
    : undefined;
  const cpuElevenHandPlayer = room.elevenHandDecision
    ? room.players.find((player) => player.isCpu && player.id === room.elevenHandDecision?.playerId)
    : undefined;
  const cpuTurnPlayer = !room.trucoRequest && !room.elevenHandDecision
    ? room.players.find((player) => player.isCpu && player.id === room.turnPlayerId)
    : undefined;

  if (!cpuResponder && !cpuElevenHandPlayer && !cpuTurnPlayer) {
    return;
  }

  room.cpuActionTimer = setTimeout(() => {
    room.cpuActionTimer = undefined;

    if (room.status !== "playing") {
      return;
    }

    if (room.trucoRequest) {
      respondTrucoAsCpu(room);
      return;
    }

    if (room.elevenHandDecision && cpuElevenHandPlayer) {
      room.elevenHandDecision = undefined;
      room.handValue = 3;
      broadcastState(room);
      return;
    }

    playCardAsCpu(room);
  }, 1200);
}

function respondTrucoAsCpu(room: Room): void {
  const request = room.trucoRequest;
  const cpu = request ? room.players.find((player) => player.isCpu && player.id === request.responderPlayerId) : undefined;
  const requester = request ? room.players.find((player) => player.id === request.requestedByPlayerId) : undefined;

  if (!request || !cpu || !requester) {
    return;
  }

  room.lastTrucoResponse = {
    playerId: cpu.id,
    playerName: cpu.name,
    action: "accept",
    requestedValue: request.requestedValue
  };
  room.handValue = request.requestedValue;
  room.trucoRequest = undefined;
  broadcastState(room);
}

function playCardAsCpu(room: Room): void {
  const cpu = room.players.find((player) => player.isCpu && player.id === room.turnPlayerId);

  if (!cpu || cpu.hand.length === 0 || room.trucoRequest) {
    return;
  }

  const sortedCards = cpu.hand
    .map((card, index) => ({ card, index }))
    .sort((left, right) => room.vira ? compareCardsWithVira(left.card, right.card, room.vira) : 0);
  const selected = sortedCards[0];

  if (!selected) {
    return;
  }

  const [card] = cpu.hand.splice(selected.index, 1);

  room.table.push({ playerId: cpu.id, card });

  if (room.table.length === 1) {
    room.turnPlayerId = room.players.find((player) => player.id !== cpu.id)?.id ?? null;
    broadcastState(room);
    return;
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
}

io.on("connection", (socket) => {
  socket.on("room:join", async ({ roomId, name, token }) => {
    const profile = await getProfileForJoin(token);
    const playerName = (profile?.name ?? name.trim()) || "Jogador";
    const avatarUrl = profile?.avatarUrl ?? undefined;
    const room = getJoinRoom(roomId, token);
    const existing = room.players.find((player) => player.token === token);

    if (!existing && room.players.length >= 2) {
      socket.emit("room:error", { message: "Mesa cheia" });
      return;
    }

    if (existing) {
      const previousId = existing.id;

      existing.id = socket.id;
      existing.name = playerName || existing.name;
      existing.avatarUrl = avatarUrl;
      existing.isCpu = false;
      replacePlayerId(room, previousId, socket.id);
      socket.join(room.id);
      runDatabaseTask(async () => {
        await upsertPlayer({
          token: existing.token,
          name: existing.name,
          avatarUrl: existing.avatarUrl
        });
      });

      broadcastState(room);
      return;
    }

    if (!existing) {
      room.players.push({
        id: socket.id,
        name: playerName,
        avatarUrl,
        isCpu: false,
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
          name: playerName,
          avatarUrl
        });
      });
    }

    if (room.players.length === 2 && room.status === "waiting") {
      startMatch(room);
    }

    broadcastState(room);
  });

socket.on("room:leave", ({ roomId }) => {
  handlePlayerExit(socket.id, roomId);
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

    if (room.elevenHandDecision && room.elevenHandDecision.playerId === socket.id && !room.elevenHandDecision.isIronHand) {
      socket.emit("room:error", { message: "Decida se vai jogar a mao de 11" });
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

    if (!canRoomAskForTruco(room)) {
      socket.emit("room:error", { message: "Nao pode pedir truco na mao de 11" });
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
      room.lastTrucoResponse = {
        playerId: player.id,
        playerName: player.name,
        action,
        requestedValue: request.requestedValue
      };
      room.handValue = request.requestedValue;
      room.trucoRequest = undefined;
      broadcastState(room);
      return;
    }

    if (action === "reject") {
      const points = request.currentValue;

      room.lastTrucoResponse = {
        playerId: player.id,
        playerName: player.name,
        action,
        requestedValue: request.requestedValue
      };
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

    room.handValue = request.requestedValue;
    room.lastTrucoResponse = {
      playerId: player.id,
      playerName: player.name,
      action,
      requestedValue: raisedValue as TrucoRequest["requestedValue"]
    };
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

  socket.on("eleven-hand:respond", ({ roomId, action }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);
    const decision = room?.elevenHandDecision;

    if (!room || !player || room.status !== "playing" || !decision) {
      socket.emit("room:error", { message: "Nao existe decisao de mao de 11 pendente" });
      return;
    }

    if (decision.playerId !== socket.id) {
      socket.emit("room:error", { message: "A decisao da mao de 11 e do jogador com 11 pontos" });
      return;
    }

    const opponent = room.players.find((item) => item.id !== socket.id);

    if (!opponent) {
      room.elevenHandDecision = undefined;
      broadcastState(room);
      return;
    }

    if (action === "run") {
      room.elevenHandDecision = undefined;
      awardHand(room, opponent, 1);
      broadcastState(room);
      return;
    }

    room.handValue = 3;
    room.elevenHandDecision = undefined;
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
      handlePlayerExit(socket.id);
    }, 15000);
  });
});

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Truco server running on http://localhost:${port}`);
});
