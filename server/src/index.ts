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
  score: number;
};

type Room = {
  id: string;
  players: PlayerState[];
  table: { playerId: string; card: Card }[];
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

function toPublicPlayer(player: PlayerState): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    cardCount: player.hand.length,
    score: player.score
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
    self: self ? { ...toPublicPlayer(self), hand: self.hand } : undefined,
    table: room.table,
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

function startMatch(room: Room): void {
  const deck = shuffle(createDeck());

  room.players[0].hand = deck.slice(0, 3);
  room.players[1].hand = deck.slice(3, 6);
  room.players[0].score = 0;
  room.players[1].score = 0;
  room.table = [];
  room.turnPlayerId = room.players[0].id;
  room.status = "playing";
}

function finishTrickIfReady(room: Room): void {
  if (room.table.length < 2) {
    return;
  }

  const [first, second] = room.table;
  const winner = compareCards(first.card, second.card) >= 0 ? first.playerId : second.playerId;
  const winnerPlayer = room.players.find((player) => player.id === winner);

  if (winnerPlayer) {
    winnerPlayer.score += 1;
  }

  room.table = [];
  room.turnPlayerId = winner;

  if (room.players.some((player) => player.score >= 2) || room.players.every((player) => player.hand.length === 0)) {
    room.status = "finished";
    room.turnPlayerId = null;
  }
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
        score: 0
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

    finishTrickIfReady(room);
    broadcastState(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const index = room.players.findIndex((player) => player.id === socket.id);

      if (index >= 0) {
        room.players.splice(index, 1);
        room.table = [];
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
