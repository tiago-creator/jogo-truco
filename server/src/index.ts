import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  type Card,
  type ClientToServerEvents,
  type ActionAck,
  compareCardsWithVira,
  createDeck,
  type PublicPlayer,
  type RoomState,
  type TrickResult,
  type ServerToClientEvents,
  type TableCard,
  type TrucoRequest,
  ranks,
  shuffle
} from "@truco/shared";
import {
  createMatch,
  deleteActiveRoom,
  findActiveRoomById,
  findActiveRoomByPlayerToken,
  finishMatch,
  getPlayerProfile,
  getPlayerProfileByEmail,
  getRanking,
  isDatabaseEnabled,
  recordHandResult,
  recordRankingGameResult,
  saveActiveRoom,
  savePlayerProfile,
  upsertPlayer
} from "./db.js";

type PlayerState = {
  id: string;
  name: string;
  avatarUrl?: string;
  isCpu?: boolean;
  cpuToken?: string;
  teamId?: number;
  hand: Card[];
  roundWins: number;
  handsWonInGame: number;
  points: number;
  games: number;
  token: string;
};

type HandOutcome =
  | { type: "continue" }
  | { type: "draw" }
  | { type: "winner"; winnerPlayerId: string };

type Room = {
  id: string;
  mode?: "classic" | "duo-cpu";
  players: PlayerState[];
  table: TableCard[];
  vira?: Card;
  handValue: RoomState["handValue"];
  turnPlayerId: string | null;
  footPlayerId?: string;
  status: RoomState["status"];
  handSequence: number;
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
  lastGameWinnerSequence?: number;
  lastTrucoResponse?: RoomState["lastTrucoResponse"];
  dbMatchId?: string;
  processedActionIds?: string[];
  cpuActionTimer?: ReturnType<typeof setTimeout>;
  cpuActionAllowedAt?: number;
};

type TrucoServerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_request, response) => response.json({ ok: true }));
app.get("/rank", async (_request, response) => {
  if (!isDatabaseEnabled()) {
    response.json({ ranking: [] });
    return;
  }

  response.json({ ranking: await getRanking() });
});

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
const closedRoomIds = new Set<string>();
const trickRevealDelayMs = 1200;
const nextHandDelayMs = 1600;
const cpuInitialDealDelayMs = 4600;
let nextAutoRoomNumber = 1;

function toPublicPlayer(player: PlayerState): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    avatarUrl: player.avatarUrl,
    isCpu: player.isCpu,
    teamId: player.teamId,
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
    mode: "classic",
    players: [],
    table: [],
    vira: undefined,
    handValue: 1,
    turnPlayerId: null,
    footPlayerId: undefined,
    status: "waiting",
    handSequence: 0,
    trickResults: [],
    processedActionIds: []
  };

  rooms.set(roomId, room);
  return room;
}

function sanitizeRoomForStorage(room: Room): Omit<Room, "cpuActionTimer"> {
  const { cpuActionTimer: _cpuActionTimer, ...snapshot } = room;

  return snapshot;
}

function restoreRoomSnapshot(snapshot: unknown): Room | null {
  const room = snapshot as Room | null;

  if (!room?.id || !Array.isArray(room.players)) {
    return null;
  }

  room.players = room.players.map((player) => ({
    ...player,
    isCpu: player.isCpu ?? false,
    handsWonInGame: player.handsWonInGame ?? 0
  }));
  room.cpuActionTimer = undefined;
  room.handSequence ??= 0;
  room.trickResults ??= [];
  room.processedActionIds ??= [];
  rooms.set(room.id, room);
  resumeRestoredRoom(room);
  return room;
}

function resumeRestoredRoom(room: Room): void {
  if (room.status !== "playing" || room.table.length < room.players.length || room.turnPlayerId) {
    return;
  }

  const handSequence = room.handSequence;

  setTimeout(() => {
    finishTrickIfReady(room, handSequence);
    broadcastState(room);
  }, trickRevealDelayMs);
}

function persistRoom(room: Room): void {
  if (closedRoomIds.has(room.id)) {
    runDatabaseTask(async () => {
      await deleteActiveRoom(room.id);
    });
    return;
  }

  if (room.players.length === 0 || room.status === "waiting") {
    runDatabaseTask(async () => {
      await deleteActiveRoom(room.id);
    });
    return;
  }

  runDatabaseTask(async () => {
    if (closedRoomIds.has(room.id)) {
      await deleteActiveRoom(room.id);
      return;
    }

    await saveActiveRoom(room.id, sanitizeRoomForStorage(room));
  });
}

function createAutoRoom(mode: Room["mode"] = "classic"): Room {
  const prefix = mode === "duo-cpu" ? "duplas-cpu" : "mesa";
  let roomId = `${prefix}-${nextAutoRoomNumber}`;

  while (rooms.has(roomId)) {
    nextAutoRoomNumber += 1;
    roomId = `mesa-${nextAutoRoomNumber}`;
  }

  nextAutoRoomNumber += 1;
  const room = getRoom(roomId);
  room.mode = mode;
  return room;
}

function findRoomByPlayerToken(token: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.token === token || player.cpuToken === token)) {
      return room;
    }
  }

  return undefined;
}

function hasConnectedHumanOpponent(room: Room, playerToken: string): boolean {
  return room.players.some((player) => (
    player.token !== playerToken &&
    !player.isCpu &&
    io.sockets.sockets.has(player.id)
  ));
}

function shouldRejoinMemoryRoom(room: Room, token: string): boolean {
  const player = room.players.find((item) => item.token === token || item.cpuToken === token);

  if (!player) {
    return false;
  }

  if (player.isCpu && !hasConnectedHumanOpponent(room, token)) {
    return false;
  }

  return true;
}

function getRoomTargetHumanCount(room: Room): number {
  return room.mode === "duo-cpu" ? 2 : 2;
}

function getHumanCount(room: Room): number {
  return room.players.filter((player) => !player.isCpu).length;
}

function findWaitingRoom(mode: Room["mode"] = "classic"): Room | undefined {
  for (const room of rooms.values()) {
    if (room.status === "waiting" && (room.mode ?? "classic") === mode && getHumanCount(room) < getRoomTargetHumanCount(room)) {
      return room;
    }
  }

  return undefined;
}

async function getJoinRoom(roomId: string | undefined, token: string, mode: Room["mode"] = "classic"): Promise<Room> {
  const requestedRoomId = roomId?.trim();

  if (requestedRoomId) {
    if (closedRoomIds.has(requestedRoomId)) {
      return findWaitingRoom(mode) ?? createAutoRoom(mode);
    }

    const existingRoom = rooms.get(requestedRoomId);

    if (existingRoom) {
      return existingRoom;
    }

    const restoredSnapshot = await findActiveRoomById(requestedRoomId).catch((error: unknown) => {
      console.error("Could not restore requested active room", error);
      return null;
    });
    const restoredRoom = restoredSnapshot ? restoreRoomSnapshot(restoredSnapshot) : null;

    const room = restoredRoom ?? getRoom(requestedRoomId);
    room.mode ??= mode;
    return room;
  }

  const memoryRoom = findRoomByPlayerToken(token);

  if (memoryRoom && shouldRejoinMemoryRoom(memoryRoom, token)) {
    return memoryRoom;
  }

  const restoredSnapshot = await findActiveRoomByPlayerToken(token).catch((error: unknown) => {
    console.error("Could not restore active room", error);
    return null;
  });
  if (restoredSnapshot && closedRoomIds.has(restoredSnapshot.id)) {
    runDatabaseTask(async () => {
      await deleteActiveRoom(restoredSnapshot.id);
    });
    return findWaitingRoom(mode) ?? createAutoRoom(mode);
  }

  const restoredRoom = restoredSnapshot ? restoreRoomSnapshot(restoredSnapshot) : null;

  return restoredRoom ?? findWaitingRoom(mode) ?? createAutoRoom(mode);
}

function replacePlayerId(room: Room, previousId: string, nextId: string): void {
  if (previousId === nextId) {
    return;
  }

  if (room.turnPlayerId === previousId) {
    room.turnPlayerId = nextId;
  }

  if (room.footPlayerId === previousId) {
    room.footPlayerId = nextId;
  }

  for (const tableCard of room.table) {
    if (tableCard.playerId === previousId) {
      tableCard.playerId = nextId;
    }
  }

  for (const trickResult of room.trickResults) {
    if (trickResult.winnerPlayerId === previousId) {
      trickResult.winnerPlayerId = nextId;
    }
  }

  if (room.elevenHandDecision?.playerId === previousId) {
    room.elevenHandDecision.playerId = nextId;
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

  if (room.lastTrucoResponse?.playerId === previousId) {
    room.lastTrucoResponse.playerId = nextId;
  }

  if (room.lastGameWinnerId === previousId) {
    room.lastGameWinnerId = nextId;
  }
}

function buildState(room: Room, viewerId: string): RoomState {
  const self = room.players.find((player) => player.id === viewerId);

  return {
    roomId: room.id,
    mode: room.mode ?? "classic",
    players: room.players.map(toPublicPlayer),
    self: self ? toPublicPlayer(self) : undefined,
    table: room.table,
    vira: room.vira,
    handSequence: room.handSequence,
    handValue: room.handValue,
    trickResults: room.trickResults,
    turnPlayerId: room.turnPlayerId,
    footPlayerId: room.footPlayerId,
    status: room.status,
    message: buildMessage(room, viewerId),
    isIronHand: room.isIronHand,
    elevenHandDecision: room.elevenHandDecision,
    trucoRequest: room.trucoRequest,
    lastTrucoRaise: room.lastTrucoRaise,
    lastGameWinnerId: room.lastGameWinnerId,
    lastGameWinnerName: room.lastGameWinnerName,
    lastGameWinnerSequence: room.lastGameWinnerSequence,
    lastTrucoResponse: room.lastTrucoResponse
  };
}

function buildMessage(room: Room, viewerId: string): string {
  if (room.status === "waiting") {
    return room.mode === "duo-cpu"
      ? "Procurando parceiro para enfrentar dupla CPU"
      : "Esperando outro jogador";
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

  if (room.turnPlayerId === viewerId) {
    return "Sua vez de jogar";
  }

  const turnPlayer = room.players.find((player) => player.id === room.turnPlayerId);

  return turnPlayer ? `Vez de ${turnPlayer.name}` : "Aguardando jogada";
}

function broadcastState(room: Room): void {
  persistRoom(room);

  for (const player of room.players) {
    if (player.isCpu) {
      continue;
    }

    io.to(player.id).emit("room:state", buildState(room, player.id));
  }

  scheduleCpuAction(room);
}

function failAction(socket: TrucoServerSocket, ack: ((response: ActionAck) => void) | undefined, message: string): void {
  socket.emit("room:error", { message });
  ack?.({ ok: false, message });
}

function acknowledgeAction(ack?: (response: ActionAck) => void): void {
  ack?.({ ok: true });
}

function acknowledgeMemeDelivery(
  opponentId: string,
  payload: { playerId: string; playerName: string; memeId: string },
  onDelivered: () => void,
  ack?: (response: ActionAck) => void
): void {
  const timeoutEmitter = io.to(opponentId).timeout(2500) as unknown as {
    emit: (
      event: "meme:play",
      payload: { playerId: string; playerName: string; memeId: string },
      callback: (error: Error | null, responses?: ActionAck[]) => void
    ) => void;
  };

  timeoutEmitter.emit("meme:play", payload, (error, responses) => {
    const response = responses?.[0];

    if (error || !response?.ok) {
      ack?.({
        ok: false,
        message: response?.message ?? "O audio meme nao tocou para o oponente"
      });
      return;
    }

    onDelivered();
    acknowledgeAction(ack);
  });
}

function wasActionProcessed(room: Room, actionId?: string): boolean {
  return Boolean(actionId && room.processedActionIds?.includes(actionId));
}

function markActionProcessed(room: Room, actionId?: string): void {
  if (!actionId) {
    return;
  }

  room.processedActionIds ??= [];

  if (room.processedActionIds.includes(actionId)) {
    return;
  }

  room.processedActionIds.push(actionId);
  room.processedActionIds = room.processedActionIds.slice(-200);
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
        avatarUrl: player.avatarUrl,
        isCpu: player.isCpu,
        cpuToken: player.cpuToken
      }))
    ) ?? undefined;
  });
}

function getOpponentPlayerId(room: Room, playerId: string | undefined): string | undefined {
  return room.players.find((player) => player.id !== playerId)?.id;
}

function getNextPlayerId(room: Room, playerId: string | undefined): string | undefined {
  if (!playerId || room.players.length === 0) {
    return room.players[0]?.id;
  }

  const playerIndex = room.players.findIndex((player) => player.id === playerId);
  const nextIndex = playerIndex < 0 ? 0 : (playerIndex + 1) % room.players.length;

  return room.players[nextIndex]?.id;
}

function getNextTablePlayerId(room: Room, playerId: string | undefined): string | undefined {
  const playedPlayerIds = new Set(room.table.map((entry) => entry.playerId));
  let cursor = playerId;

  for (let offset = 0; offset < room.players.length; offset += 1) {
    const nextPlayerId = getNextPlayerId(room, cursor);
    const nextPlayer = room.players.find((player) => player.id === nextPlayerId);

    if (nextPlayer && !playedPlayerIds.has(nextPlayer.id)) {
      return nextPlayer.id;
    }

    cursor = nextPlayerId;
  }

  return undefined;
}

function areSameTeam(room: Room, leftPlayerId: string | null | undefined, rightPlayerId: string | null | undefined): boolean {
  if (!leftPlayerId || !rightPlayerId) {
    return false;
  }

  if (leftPlayerId === rightPlayerId) {
    return true;
  }

  const left = room.players.find((player) => player.id === leftPlayerId);
  const right = room.players.find((player) => player.id === rightPlayerId);

  return left?.teamId !== undefined && left.teamId === right?.teamId;
}

function getOpposingPlayer(room: Room, playerId: string | undefined): PlayerState | undefined {
  const player = room.players.find((item) => item.id === playerId);

  return room.players.find((item) => item.id !== playerId && item.teamId !== player?.teamId);
}

function getTeamPlayers(room: Room, playerId: string): PlayerState[] {
  const player = room.players.find((item) => item.id === playerId);

  return player?.teamId === undefined
    ? [player].filter(Boolean) as PlayerState[]
    : room.players.filter((item) => item.teamId === player.teamId);
}

function ensureFootPlayer(room: Room): string | undefined {
  if (room.footPlayerId && room.players.some((player) => player.id === room.footPlayerId)) {
    return room.footPlayerId;
  }

  room.footPlayerId = room.players[1]?.id ?? room.players[0]?.id;
  return room.footPlayerId;
}

function rotateFootPlayer(room: Room): string | undefined {
  const currentFootPlayerId = ensureFootPlayer(room);
  const nextFootPlayerId = getNextPlayerId(room, currentFootPlayerId);

  if (nextFootPlayerId) {
    room.footPlayerId = nextFootPlayerId;
  }

  return room.footPlayerId;
}

function createCpuPlayer(room: Room, index: number): PlayerState {
  return {
    id: `cpu:${room.id}:${index}`,
    name: `CPU ${index}`,
    isCpu: true,
    cpuToken: `cpu:${room.id}:${index}`,
    token: `cpu:${room.id}:${index}`,
    teamId: 1,
    hand: [],
    roundWins: 0,
    handsWonInGame: 0,
    points: 0,
    games: 0
  };
}

function completeDuoCpuRoom(room: Room): void {
  if (room.mode !== "duo-cpu") {
    return;
  }

  const humans = room.players.filter((player) => !player.isCpu);

  if (humans.length < 2) {
    return;
  }

  humans.forEach((player) => {
    player.teamId = 0;
  });

  const cpus = [createCpuPlayer(room, 1), createCpuPlayer(room, 2)];
  room.players = [humans[0], cpus[0], humans[1], cpus[1]];
}

function suitName(suit: Card["suit"]): string {
  const names: Record<Card["suit"], string> = {
    clubs: "paus",
    hearts: "copas",
    spades: "espadas",
    diamonds: "ouros"
  };

  return names[suit];
}

function formatCard(card: Card | undefined): string {
  if (!card) {
    return "sem carta";
  }

  return `${card.rank} de ${suitName(card.suit)}`;
}

function logHandDeal(room: Room): void {
  const players = room.players
    .map((player) => `${player.name}: ${player.hand.map(formatCard).join(", ")}`)
    .join(" | ");

  console.info(
    `[truco:mao] mesa=${room.id} mao=${room.handSequence} vira=${formatCard(room.vira)} valor=${room.handValue} cartas=[${players}]`
  );
}

function logCardPlay(room: Room, player: PlayerState, card: Card, faceDown = false): void {
  const playedAs = faceDown ? " fechada" : "";

  console.info(
    `[truco:jogada] mesa=${room.id} mao=${room.handSequence} jogador="${player.name}" carta=${formatCard(card)}${playedAs} vira=${formatCard(room.vira)}`
  );
}

function logHandAward(
  room: Room,
  winner: PlayerState,
  points: RoomState["handValue"],
  previousPoints: number,
  nextPoints: number,
  finishedGame: boolean
): void {
  const loser = room.players.find((player) => player.id !== winner.id);
  const loserPoints = loser?.points ?? 0;

  console.info(
    `[truco:ponto] mesa=${room.id} mao=${room.handSequence} vencedor="${winner.name}" pontosGanhos=${points} placar=${previousPoints}->${nextPoints} oponente=${loserPoints} fimDeJogo=${finishedGame}`
  );
}

function logElevenHandCpuDecision(room: Room, cpu: PlayerState, action: "play" | "run"): void {
  console.info(
    `[truco:mao11] mesa=${room.id} mao=${room.handSequence} jogador="${cpu.name}" decisao=${action === "play" ? "jogar" : "correr"} vira=${formatCard(room.vira)} cartas=[${cpu.hand.map(formatCard).join(", ")}]`
  );
}

function dealHand(room: Room, rotateFootPlayerBeforeDeal = false): void {
  const previousTrucoResponse = room.lastTrucoResponse;
  const deck = shuffle(createDeck());
  const footPlayerId = rotateFootPlayerBeforeDeal ? rotateFootPlayer(room) : ensureFootPlayer(room);
  const firstPlayerId = getNextPlayerId(room, footPlayerId) ?? room.players[0]?.id;
  const isIronHand = room.players.length === 2 && room.players.every((player) => player.points === 11);
  const elevenHandPlayer = room.players.find((player) => player.points === 11);

  for (const [index, player] of room.players.entries()) {
    player.hand = deck.slice(index * 3, index * 3 + 3);
    player.roundWins = 0;
  }

  room.vira = deck[room.players.length * 3];
  room.handSequence = (room.handSequence ?? 0) + 1;
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
  room.lastTrucoResponse = previousTrucoResponse;
  room.lastGameWinnerId = undefined;
  room.lastGameWinnerName = undefined;
  room.cpuActionAllowedAt = Date.now() + cpuInitialDealDelayMs;
  logHandDeal(room);
}

function startMatch(room: Room): void {
  for (const player of room.players) {
    player.roundWins = 0;
    player.handsWonInGame = 0;
    player.points = 0;
    player.games = 0;
  }

  room.footPlayerId = room.players[1]?.id ?? room.players[0]?.id;
  room.dbMatchId = undefined;
  dealHand(room);
  startPersistentMatch(room);
}

function finishHand(room: Room, winner: PlayerState): void {
  awardHand(room, winner, room.handValue, false);
}

export function getHandOutcome(trickResults: TrickResult[]): HandOutcome {
  const [first, second, third] = trickResults.map((result) => result.winnerPlayerId);

  if (trickResults.length < 2) {
    return { type: "continue" };
  }

  if (!first) {
    if (second) {
      return { type: "winner", winnerPlayerId: second };
    }

    if (trickResults.length < 3) {
      return { type: "continue" };
    }

    return third
      ? { type: "winner", winnerPlayerId: third }
      : { type: "draw" };
  }

  if (!second || second === first) {
    return { type: "winner", winnerPlayerId: first };
  }

  if (trickResults.length < 3) {
    return { type: "continue" };
  }

  return !third || third === first
    ? { type: "winner", winnerPlayerId: first }
    : { type: "winner", winnerPlayerId: third };
}

function getRoomHandOutcome(room: Room): HandOutcome {
  if (room.mode !== "duo-cpu") {
    return getHandOutcome(room.trickResults);
  }

  const [first, second, third] = room.trickResults.map((result) => result.winnerPlayerId);

  if (room.trickResults.length < 2) {
    return { type: "continue" };
  }

  if (!first) {
    if (second) {
      return { type: "winner", winnerPlayerId: second };
    }

    if (room.trickResults.length < 3) {
      return { type: "continue" };
    }

    return third
      ? { type: "winner", winnerPlayerId: third }
      : { type: "draw" };
  }

  if (!second || areSameTeam(room, first, second)) {
    return { type: "winner", winnerPlayerId: first };
  }

  if (room.trickResults.length < 3) {
    return { type: "continue" };
  }

  return !third || areSameTeam(room, first, third)
    ? { type: "winner", winnerPlayerId: first }
    : { type: "winner", winnerPlayerId: third };
}

function awardHand(room: Room, winner: PlayerState, points: RoomState["handValue"], dealNextHandImmediately = true): void {
  const loser = getOpposingPlayer(room, winner.id);
  const matchId = room.dbMatchId;
  const winnerSnapshot = {
    id: winner.id,
    token: winner.token,
    name: winner.name,
    avatarUrl: winner.avatarUrl,
    isCpu: winner.isCpu,
    cpuToken: winner.cpuToken
  };
  const loserSnapshot = loser
    ? {
      id: loser.id,
      token: loser.token,
      name: loser.name,
      avatarUrl: loser.avatarUrl,
      isCpu: loser.isCpu,
      cpuToken: loser.cpuToken
    }
    : undefined;

  const winnerPointsBefore = winner.points;

  const winnerTeam = getTeamPlayers(room, winner.id);

  for (const teamPlayer of winnerTeam) {
    teamPlayer.points += points;
    teamPlayer.handsWonInGame = (teamPlayer.handsWonInGame ?? 0) + 1;
  }

  const finishedGame = winner.points >= 12;
  const winnerPointsAfter = winner.points;
  const loserPointsAfter = loser?.points ?? 0;
  const winnerHandsWon = winner.handsWonInGame;
  const loserHandsWon = loser?.handsWonInGame ?? 0;

  logHandAward(room, winner, points, winnerPointsBefore, winnerPointsAfter, finishedGame);

  runDatabaseTask(async () => {
    await recordHandResult({
      matchId,
      roomId: room.id,
      winnerToken: winnerSnapshot.token,
      winnerName: winnerSnapshot.name,
      winnerIsCpu: winnerSnapshot.isCpu,
      winnerCpuToken: winnerSnapshot.cpuToken,
      handValue: points,
      winnerPointsAfter,
      loserPointsAfter,
      finishedGame
    });

    if (finishedGame) {
      await finishMatch(matchId, {
        token: winnerSnapshot.token,
        name: winnerSnapshot.name,
        isCpu: winnerSnapshot.isCpu,
        cpuToken: winnerSnapshot.cpuToken
      });
    }
  });

  if (finishedGame) {
    for (const teamPlayer of winnerTeam) {
      teamPlayer.games += 1;
      teamPlayer.points = 0;
      teamPlayer.handsWonInGame = 0;
    }

    for (const player of room.players) {
      if (!areSameTeam(room, player.id, winner.id)) {
        player.points = 0;
        player.handsWonInGame = 0;
      }
    }
  }

  const dealNextHand = () => {
    dealHand(room, true);

    if (finishedGame) {
      room.lastGameWinnerId = winnerSnapshot.id;
      room.lastGameWinnerName = winnerSnapshot.name;
      room.lastGameWinnerSequence = (room.lastGameWinnerSequence ?? 0) + 1;
      if (!winnerSnapshot.isCpu) {
        runDatabaseTask(async () => {
          await recordRankingGameResult({
            winner: {
              token: winnerSnapshot.token,
              name: winnerSnapshot.name,
              avatarUrl: winnerSnapshot.avatarUrl
            },
            loser: loserSnapshot && !loserSnapshot.isCpu
              ? {
                token: loserSnapshot.token,
                name: loserSnapshot.name,
                avatarUrl: loserSnapshot.avatarUrl
              }
              : undefined,
            winnerHandsWon,
            loserHandsWon,
            winnerFinalPoints: winnerPointsAfter,
            loserFinalPoints: loserPointsAfter
          });
        });
      }
      room.dbMatchId = undefined;
      startPersistentMatch(room);
    }
  };

  if (dealNextHandImmediately) {
    dealNextHand();
    return;
  }

  const expectedHandSequence = room.handSequence;
  room.turnPlayerId = null;

  setTimeout(() => {
    if (closedRoomIds.has(room.id) || room.handSequence !== expectedHandSequence) {
      return;
    }

    dealNextHand();
    broadcastState(room);
  }, nextHandDelayMs);
}

function finishTrickIfReady(room: Room, expectedHandSequence = room.handSequence): void {
  if (closedRoomIds.has(room.id) || expectedHandSequence !== room.handSequence) {
    return;
  }

  if (room.table.length < room.players.length) {
    return;
  }

  const first = room.table[0];
  const winner = getTrickWinner(room, room.table);
  const winnerPlayer = room.players.find((player) => player.id === winner);

  if (winnerPlayer) {
    for (const teamPlayer of getTeamPlayers(room, winnerPlayer.id)) {
      teamPlayer.roundWins += 1;
    }
  }

  room.trickResults.push({ winnerPlayerId: winner });
  room.table = [];
  room.turnPlayerId = winner ?? first.playerId;

  const outcome = getRoomHandOutcome(room);

  if (outcome.type === "continue") {
    return;
  }

  if (outcome.type === "draw") {
    dealHand(room, true);
    return;
  }

  const handWinner = room.players.find((player) => player.id === outcome.winnerPlayerId);

  if (handWinner) {
    finishHand(room, handWinner);
  }
}

function getTrickWinner(room: Room, cards: TableCard[]): string | null {
  if (!room.vira) {
    return null;
  }

  const openCards = cards.filter((card) => !card.faceDown);

  if (openCards.length === 0) {
    return null;
  }

  let winner = openCards[0];
  let tied = false;

  for (const card of openCards.slice(1)) {
    const comparison = compareCardsWithVira(card.card, winner.card, room.vira);

    if (comparison > 0) {
      winner = card;
      tied = false;
      continue;
    }

    if (comparison === 0) {
      tied = true;
    }
  }

  return tied ? null : winner.playerId;
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

function makePlayerCpu(room: Room, player: PlayerState, preserveReconnectSeat = true): void {
  const previousToken = player.token;

  player.isCpu = true;
  player.cpuToken = preserveReconnectSeat ? previousToken : undefined;
  player.token = `cpu:${room.id}:${previousToken}`;
  player.name = "CPU";
  player.avatarUrl = undefined;
}

function handlePlayerExit(socketId: string, explicitRoomId?: string, preserveReconnectSeat = true): void {
  const targetRooms = explicitRoomId ? [rooms.get(explicitRoomId)].filter(Boolean) as Room[] : Array.from(rooms.values());

  for (const room of targetRooms) {
    const player = room.players.find((item) => item.id === socketId);

    if (!player) {
      continue;
    }

    if (player.isCpu) {
      return;
    }

    const hasHumanOpponent = room.players.some((item) => item.id !== socketId && !item.isCpu);

    if (preserveReconnectSeat && room.status === "playing" && hasHumanOpponent) {
      makePlayerCpu(room, player, preserveReconnectSeat);
      broadcastState(room);
      return;
    }

    const remainingHumans = room.players.filter((item) => item.id !== socketId && !item.isCpu);

    clearTimeout(room.cpuActionTimer);
    room.cpuActionTimer = undefined;

    if (remainingHumans.length === 0) {
      closedRoomIds.add(room.id);
      rooms.delete(room.id);
      runDatabaseTask(async () => {
        await deleteActiveRoom(room.id);
      });
      return;
    }

    room.players = remainingHumans;
    room.table = [];
    room.vira = undefined;
    room.handValue = 1;
    room.status = "waiting";
    room.turnPlayerId = null;
    room.footPlayerId = undefined;
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
    room.cpuActionAllowedAt = undefined;

    broadcastState(room);
    return;
  }
}

function getCpuActionDelay(room: Room): number {
  const baseDelayMs = 1200;
  const initialDealDelayMs = Math.max(0, (room.cpuActionAllowedAt ?? 0) - Date.now());

  return Math.max(baseDelayMs, initialDealDelayMs);
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

    const activeCpuElevenHandPlayer = room.elevenHandDecision
      ? room.players.find((player) => player.isCpu && player.id === room.elevenHandDecision?.playerId)
      : undefined;

    if (room.elevenHandDecision && activeCpuElevenHandPlayer) {
      respondElevenHandAsCpu(room, activeCpuElevenHandPlayer);
      return;
    }

    playCardAsCpu(room);
  }, getCpuActionDelay(room));
}

function respondElevenHandAsCpu(room: Room, cpu: PlayerState): void {
  const opponent = getOpposingPlayer(room, cpu.id);

  room.elevenHandDecision = undefined;

  if (!opponent) {
    broadcastState(room);
    return;
  }

  if (shouldCpuPlayElevenHand(room, cpu)) {
    logElevenHandCpuDecision(room, cpu, "play");
    room.handValue = 3;
    broadcastState(room);
    return;
  }

  logElevenHandCpuDecision(room, cpu, "run");
  awardHand(room, opponent, 1);
  broadcastState(room);
}

function shouldCpuPlayElevenHand(room: Room, cpu: PlayerState): boolean {
  if (!room.vira || cpu.hand.length === 0) {
    return false;
  }

  const handStrength = cpu.hand.reduce((total, card) => total + getCardStrength(room, card), 0);
  const manilhaRankIndex = (ranks.indexOf(room.vira.rank) + 1) % ranks.length;
  const manilhaCount = cpu.hand.filter((card) => ranks.indexOf(card.rank) === manilhaRankIndex).length;
  const highCardCount = cpu.hand.filter((card) => ["3", "2", "A"].includes(card.rank)).length;

  return manilhaCount > 0 || highCardCount >= 2 || handStrength >= 21;
}

function respondTrucoAsCpu(room: Room): void {
  const request = room.trucoRequest;
  const cpu = request ? room.players.find((player) => player.isCpu && player.id === request.responderPlayerId) : undefined;
  const requester = request ? room.players.find((player) => player.id === request.requestedByPlayerId) : undefined;

  if (!request || !cpu || !requester) {
    return;
  }

  const raisedValue = nextHandValue(request.requestedValue);

  if (
    raisedValue &&
    canRoomAskForTruco(room) &&
    canAskForTruco(cpu) &&
    request.requestedByPlayerId !== cpu.id &&
    shouldCpuRaiseTruco(room, cpu, request.requestedValue)
  ) {
    room.handValue = request.requestedValue;
    room.lastTrucoResponse = {
      playerId: cpu.id,
      playerName: cpu.name,
      action: "raise",
      requestedValue: raisedValue as TrucoRequest["requestedValue"]
    };
    room.trucoRequest = {
      requestedByPlayerId: cpu.id,
      requestedByPlayerName: cpu.name,
      responderPlayerId: requester.id,
      currentValue: request.requestedValue,
      requestedValue: raisedValue as TrucoRequest["requestedValue"]
    };
    room.lastTrucoRaise = {
      playerId: cpu.id,
      playerName: cpu.name,
      value: raisedValue
    };
    room.lastTrucoRequesterId = cpu.id;
    broadcastState(room);
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

function shouldCpuRaiseTruco(room: Room, cpu: PlayerState, requestedValue: TrucoRequest["requestedValue"]): boolean {
  if (!room.vira || requestedValue >= 12 || cpu.hand.length === 0) {
    return false;
  }

  const handStrength = cpu.hand.reduce((total, card) => total + getCardStrength(room, card), 0);
  const manilhaRankIndex = (ranks.indexOf(room.vira.rank) + 1) % ranks.length;
  const hasManilha = cpu.hand.some((card) => ranks.indexOf(card.rank) === manilhaRankIndex);
  const hasHighCard = cpu.hand.some((card) => ["3", "2", "A"].includes(card.rank));

  if (requestedValue === 3) {
    return hasManilha || handStrength >= 22;
  }

  if (requestedValue === 6) {
    return hasManilha && hasHighCard;
  }

  return hasManilha && cpu.hand.length >= 2;
}

function getCardStrength(room: Room, card: Card): number {
  if (!room.vira) {
    return ranks.indexOf(card.rank);
  }

  const manilhaRank = ranks[(ranks.indexOf(room.vira.rank) + 1) % ranks.length];

  if (card.rank === manilhaRank) {
    return 20;
  }

  return ranks.indexOf(card.rank);
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
  logCardPlay(room, cpu, card);

  if (room.table.length < room.players.length) {
    room.turnPlayerId = getNextTablePlayerId(room, cpu.id) ?? null;
    broadcastState(room);
    return;
  }

  room.turnPlayerId = null;
  const handSequence = room.handSequence;
  broadcastState(room);

  setTimeout(() => {
    finishTrickIfReady(room, handSequence);
    broadcastState(room);
  }, trickRevealDelayMs);
}

io.on("connection", (socket) => {
  socket.on("room:join", async ({ roomId, name, token, mode }) => {
    const joinMode: Room["mode"] = mode === "duo-cpu" ? "duo-cpu" : "classic";
    const profile = await getProfileForJoin(token);
    const playerName = (profile?.name ?? name.trim()) || "Jogador";
    const avatarUrl = profile?.avatarUrl ?? undefined;
    const room = await getJoinRoom(roomId, token, joinMode);
    room.mode ??= joinMode;
    const existing = room.players.find((player) => player.token === token);

    const targetHumanCount = getRoomTargetHumanCount(room);
    const humanCount = getHumanCount(room);
    const cpuSeat = !existing
      ? room.players.find((player) => player.isCpu && player.cpuToken === token)
      : undefined;

    if (!existing && room.status === "playing" && !cpuSeat) {
      socket.emit("room:error", { message: "Partida em andamento" });
      return;
    }

    if (!existing && humanCount >= targetHumanCount && !cpuSeat) {
      socket.emit("room:error", { message: "Mesa cheia" });
      return;
    }

    if (existing || cpuSeat) {
      const joinedPlayer = existing ?? cpuSeat!;
      const previousId = joinedPlayer.id;

      joinedPlayer.id = socket.id;
      joinedPlayer.name = playerName || joinedPlayer.name;
      joinedPlayer.avatarUrl = avatarUrl;
      joinedPlayer.token = token;
      joinedPlayer.isCpu = false;
      joinedPlayer.cpuToken = undefined;
      replacePlayerId(room, previousId, socket.id);
      socket.join(room.id);
      runDatabaseTask(async () => {
        await upsertPlayer({
          token: joinedPlayer.token,
          name: joinedPlayer.name,
          avatarUrl: joinedPlayer.avatarUrl
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
        teamId: room.mode === "duo-cpu" ? 0 : undefined,
        token,
        hand: [],
        roundWins: 0,
        handsWonInGame: 0,
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

    if (room.mode === "duo-cpu" && getHumanCount(room) === 2 && room.status === "waiting") {
      completeDuoCpuRoom(room);
      startMatch(room);
    } else if (room.mode !== "duo-cpu" && room.players.length === 2 && room.status === "waiting") {
      startMatch(room);
    }

    broadcastState(room);
  });

socket.on("room:leave", ({ roomId }, ack?: () => void) => {
  handlePlayerExit(socket.id, roomId, false);
  ack?.();
});
  socket.on("card:play", ({ roomId, cardId, faceDown, actionId }, ack) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      failAction(socket, ack, "Partida indisponivel");
      return;
    }

    if (wasActionProcessed(room, actionId)) {
      acknowledgeAction(ack);
      return;
    }

    if (room.trucoRequest) {
      failAction(socket, ack, "Responda o pedido de truco antes de jogar");
      return;
    }

    if (room.elevenHandDecision && room.elevenHandDecision.playerId === socket.id && !room.elevenHandDecision.isIronHand) {
      failAction(socket, ack, "Decida se vai jogar a mao de 11");
      return;
    }

    if (room.turnPlayerId !== socket.id) {
      failAction(socket, ack, "Ainda nao e sua vez");
      return;
    }

    const cardIndex = player.hand.findIndex((card) => card.id === cardId);

    if (cardIndex < 0) {
      failAction(socket, ack, "Carta invalida");
      return;
    }

    const canPlayFaceDown = player.hand.length < 3;
    const shouldPlayFaceDown = Boolean(faceDown && canPlayFaceDown);

    const [card] = player.hand.splice(cardIndex, 1);
    room.table.push({ playerId: player.id, card, faceDown: shouldPlayFaceDown });
    logCardPlay(room, player, card, shouldPlayFaceDown);
    markActionProcessed(room, actionId);

    if (room.table.length < room.players.length) {
      room.turnPlayerId = getNextTablePlayerId(room, player.id) ?? null;
    }

    if (room.table.length === room.players.length) {
      room.turnPlayerId = null;
      const handSequence = room.handSequence;
      broadcastState(room);
      acknowledgeAction(ack);

      setTimeout(() => {
        finishTrickIfReady(room, handSequence);
        broadcastState(room);
      }, trickRevealDelayMs);
      return;
    }

    broadcastState(room);
    acknowledgeAction(ack);
  });

  socket.on("truco:raise", ({ roomId, actionId }, ack) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      failAction(socket, ack, "Partida indisponivel");
      return;
    }

    if (wasActionProcessed(room, actionId)) {
      acknowledgeAction(ack);
      return;
    }

    if (room.trucoRequest) {
      failAction(socket, ack, "Ja existe um pedido de truco pendente");
      return;
    }

    if (room.turnPlayerId !== socket.id) {
      failAction(socket, ack, "So pode pedir truco na sua vez");
      return;
    }

    if (!canRoomAskForTruco(room)) {
      failAction(socket, ack, "Nao pode pedir truco na mao de 11");
      return;
    }

    if (!canAskForTruco(player)) {
      failAction(socket, ack, "Quem esta com 11 pontos nao pode pedir truco");
      return;
    }

    if (areSameTeam(room, room.lastTrucoRequesterId, socket.id)) {
      failAction(socket, ack, "Sua dupla deve esperar o oponente aumentar a aposta");
      return;
    }

    const raisedValue = nextHandValue(room.handValue);

    if (!raisedValue) {
      failAction(socket, ack, "A mao ja esta valendo 12");
      return;
    }

    const opponent = getOpposingPlayer(room, socket.id);

    if (!opponent) {
      failAction(socket, ack, "Sem oponente na mesa");
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
    markActionProcessed(room, actionId);
    broadcastState(room);
    acknowledgeAction(ack);
  });

  socket.on("truco:respond", ({ roomId, action, actionId }, ack) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);
    const request = room?.trucoRequest;

    if (!room || !player || room.status !== "playing") {
      failAction(socket, ack, "Partida indisponivel");
      return;
    }

    if (wasActionProcessed(room, actionId)) {
      acknowledgeAction(ack);
      return;
    }

    if (!request) {
      failAction(socket, ack, "Nao existe pedido de truco pendente");
      return;
    }

    if (request.responderPlayerId !== socket.id) {
      failAction(socket, ack, "A resposta e do oponente");
      return;
    }

    const requester = room.players.find((item) => item.id === request.requestedByPlayerId);

    if (!requester) {
      room.trucoRequest = undefined;
      broadcastState(room);
      acknowledgeAction(ack);
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
      markActionProcessed(room, actionId);
      broadcastState(room);
      acknowledgeAction(ack);
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
      markActionProcessed(room, actionId);
      awardHand(room, requester, points);
      broadcastState(room);
      acknowledgeAction(ack);
      return;
    }

    if (!canAskForTruco(player)) {
      failAction(socket, ack, "Quem esta com 11 pontos nao pode aumentar");
      return;
    }

    if (request.requestedByPlayerId === socket.id) {
      failAction(socket, ack, "Voce nao pode aumentar o proprio pedido");
      return;
    }

    if (areSameTeam(room, room.lastTrucoRequesterId, socket.id)) {
      failAction(socket, ack, "Sua dupla deve esperar o oponente aumentar a aposta");
      return;
    }

    const raisedValue = nextHandValue(request.requestedValue);

    if (!raisedValue) {
      failAction(socket, ack, "A mao ja esta valendo 12");
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
    markActionProcessed(room, actionId);
    broadcastState(room);
    acknowledgeAction(ack);
  });

  socket.on("eleven-hand:respond", ({ roomId, action, actionId }, ack) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);
    const decision = room?.elevenHandDecision;

    if (!room || !player || room.status !== "playing") {
      failAction(socket, ack, "Partida indisponivel");
      return;
    }

    if (wasActionProcessed(room, actionId)) {
      acknowledgeAction(ack);
      return;
    }

    if (!decision) {
      failAction(socket, ack, "Nao existe decisao de mao de 11 pendente");
      return;
    }

    if (decision.playerId !== socket.id) {
      failAction(socket, ack, "A decisao da mao de 11 e do jogador com 11 pontos");
      return;
    }

    const opponent = getOpposingPlayer(room, socket.id);

    if (!opponent) {
      room.elevenHandDecision = undefined;
      broadcastState(room);
      acknowledgeAction(ack);
      return;
    }

    if (action === "run") {
      room.elevenHandDecision = undefined;
      markActionProcessed(room, actionId);
      awardHand(room, opponent, 1);
      broadcastState(room);
      acknowledgeAction(ack);
      return;
    }

    room.handValue = 3;
    room.elevenHandDecision = undefined;
    markActionProcessed(room, actionId);
    broadcastState(room);
    acknowledgeAction(ack);
  });

  socket.on("audio:send", ({ roomId, audio, mimeType, actionId }, ack) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);

    if (!room || !player || room.status !== "playing") {
      failAction(socket, ack, "Partida indisponivel");
      return;
    }

    if (wasActionProcessed(room, actionId)) {
      acknowledgeAction(ack);
      return;
    }

    if (audio.byteLength > 800_000) {
      failAction(socket, ack, "Audio muito longo");
      return;
    }

    markActionProcessed(room, actionId);
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
    persistRoom(room);
    acknowledgeAction(ack);
  });

  socket.on("meme:play", ({ roomId, memeId, actionId }, ack) => {
    const room = rooms.get(roomId);
    const player = room?.players.find((item) => item.id === socket.id);
    const cleanMemeId = typeof memeId === "string" ? memeId.trim() : "";

    if (!room || !player || room.status !== "playing") {
      failAction(socket, ack, "Partida indisponivel");
      return;
    }

    if (wasActionProcessed(room, actionId)) {
      acknowledgeAction(ack);
      return;
    }

    if (!cleanMemeId || cleanMemeId.length > 120 || cleanMemeId.includes("/") || cleanMemeId.includes("\\")) {
      failAction(socket, ack, "Meme invalido");
      return;
    }

    const opponent = room.players.find((item) => item.id !== socket.id && !item.isCpu);

    if (!opponent || !io.sockets.sockets.has(opponent.id)) {
      failAction(socket, ack, "Oponente desconectado. Tente novamente.");
      return;
    }

    acknowledgeMemeDelivery(opponent.id, {
      playerId: player.id,
      playerName: player.name,
      memeId: cleanMemeId
    }, () => {
      markActionProcessed(room, actionId);
      persistRoom(room);
    }, ack);
  });

  socket.on("disconnect", () => {
    setTimeout(() => {
      handlePlayerExit(socket.id);
    }, 60000);
  });
});

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Truco server running on http://localhost:${port}`);
});
