export type Suit = "clubs" | "hearts" | "spades" | "diamonds";

export type Rank = "4" | "5" | "6" | "7" | "Q" | "J" | "K" | "A" | "2" | "3";

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type PublicPlayer = {
  id: string;
  name: string;
  cardCount: number;
  roundWins: number;
  points: number;
  games: number;
  hand: Card[];
};

export type ClientPlayer = PublicPlayer;

export type TableCard = {
  playerId: string;
  card: Card;
};

export type RoomState = {
  roomId: string;
  players: PublicPlayer[];
  self?: ClientPlayer;
  table: TableCard[];
  vira?: Card;
  handValue: 1 | 3 | 6 | 9 | 12;
  turnPlayerId: string | null;
  status: "waiting" | "playing" | "finished";
  message: string;
};

export type ClientToServerEvents = {
  "room:join": (payload: { roomId: string; name: string }) => void;
  "card:play": (payload: { roomId: string; cardId: string }) => void;
  "truco:raise": (payload: { roomId: string }) => void;
};

export type ServerToClientEvents = {
  "room:state": (state: RoomState) => void;
  "room:error": (payload: { message: string }) => void;
};

export const ranks: Rank[] = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
export const suits: Suit[] = ["clubs", "hearts", "spades", "diamonds"];

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ id: `${rank}-${suit}`, suit, rank })));
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }

  return copy;
}

export function compareCards(left: Card, right: Card): number {
  return ranks.indexOf(left.rank) - ranks.indexOf(right.rank);
}
