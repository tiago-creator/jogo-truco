import { randomUUID } from "node:crypto";
import { Pool } from "pg";

export type PlayerSnapshot = {
  token: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export type PlayerProfile = {
  token: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export type HandResultSnapshot = {
  matchId?: string;
  roomId: string;
  winnerToken: string;
  winnerName: string;
  handValue: number;
  winnerPointsAfter: number;
  loserPointsAfter: number;
  finishedGame: boolean;
};

export type RankingGameResult = {
  winner: PlayerSnapshot;
  loser?: PlayerSnapshot;
  winnerHandsWon: number;
  loserHandsWon: number;
  winnerFinalPoints: number;
  loserFinalPoints: number;
};

export type RankingPlayer = {
  position: number;
  name: string;
  avatarUrl?: string | null;
  rankPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  handsWon: number;
};

export type ActiveRoomSnapshot = {
  id: string;
  players?: Array<{ token?: string }>;
};

const connectionString = process.env.DATABASE_URL;
const shouldUseSsl = process.env.DATABASE_SSL === "true";

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined
    })
  : null;

export function isDatabaseEnabled(): boolean {
  return Boolean(pool);
}

export async function upsertPlayer(player: PlayerSnapshot): Promise<string | null> {
  if (!pool) {
    return null;
  }

  const result = await pool.query<{ id: string }>(
    `
      insert into players (token, name, email, avatar_url)
      values ($1, $2, $3, $4)
      on conflict (token)
      do update set
        name = excluded.name,
        email = coalesce(excluded.email, players.email),
        avatar_url = coalesce(excluded.avatar_url, players.avatar_url),
        last_seen_at = now()
      returning id
    `,
    [player.token, player.name, player.email ?? null, player.avatarUrl ?? null]
  );

  return result.rows[0]?.id ?? null;
}

export async function getPlayerProfile(token: string): Promise<PlayerProfile | null> {
  if (!pool) {
    return null;
  }

  const result = await pool.query<{
    token: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
  }>(
    `
      select token, name, email, avatar_url
      from players
      where token = $1
      limit 1
    `,
    [token]
  );
  const row = result.rows[0];

  if (!row || !row.email) {
    return null;
  }

  return {
    token: row.token,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url
  };
}

export async function getPlayerProfileByEmail(email: string): Promise<PlayerProfile | null> {
  if (!pool) {
    return null;
  }

  const result = await pool.query<{
    token: string;
    name: string;
    email: string;
    avatar_url: string | null;
  }>(
    `
      select token, name, email, avatar_url
      from players
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    token: row.token,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url
  };
}

export async function savePlayerProfile(profile: PlayerProfile): Promise<PlayerProfile> {
  if (!pool) {
    return profile;
  }

  const result = await pool.query<{
    token: string;
    name: string;
    email: string;
    avatar_url: string | null;
  }>(
    `
      insert into players (token, name, email, avatar_url)
      values ($1, $2, $3, $4)
      on conflict (token)
      do update set
        name = excluded.name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        last_seen_at = now()
      returning token, name, email, avatar_url
    `,
    [profile.token, profile.name, profile.email, profile.avatarUrl ?? null]
  );
  const row = result.rows[0];

  return {
    token: row.token,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url
  };
}

export async function createMatch(roomId: string, players: PlayerSnapshot[]): Promise<string | null> {
  if (!pool) {
    return null;
  }

  const client = await pool.connect();
  const matchId = randomUUID();

  try {
    await client.query("begin");
    await client.query(
      "insert into matches (id, room_id, status) values ($1, $2, 'playing')",
      [matchId, roomId]
    );

    for (const [index, player] of players.entries()) {
      const playerResult = await client.query<{ id: string }>(
        `
          insert into players (token, name, email, avatar_url)
          values ($1, $2, $3, $4)
          on conflict (token)
          do update set
            name = excluded.name,
            email = coalesce(excluded.email, players.email),
            avatar_url = coalesce(excluded.avatar_url, players.avatar_url),
            last_seen_at = now()
          returning id
        `,
        [player.token, player.name, player.email ?? null, player.avatarUrl ?? null]
      );
      const playerId = playerResult.rows[0]?.id;

      if (!playerId) {
        continue;
      }

      await client.query(
        `
          insert into match_players (match_id, player_id, seat, name_at_match)
          values ($1, $2, $3, $4)
          on conflict (match_id, player_id) do nothing
        `,
        [matchId, playerId, index + 1, player.name]
      );
    }

    await client.query("commit");
    return matchId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordHandResult(result: HandResultSnapshot): Promise<void> {
  if (!pool) {
    return;
  }

  const winnerPlayerId = await upsertPlayer({
    token: result.winnerToken,
    name: result.winnerName
  });

  await pool.query(
    `
      insert into hands (
        match_id,
        room_id,
        winner_player_id,
        hand_value,
        winner_points_after,
        loser_points_after,
        finished_game
      )
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      result.matchId ?? null,
      result.roomId,
      winnerPlayerId,
      result.handValue,
      result.winnerPointsAfter,
      result.loserPointsAfter,
      result.finishedGame
    ]
  );
}

function getRankingPoints(payload: {
  wonGame: boolean;
  handsWon: number;
  finalPoints: number;
  opponentFinalPoints: number;
}): number {
  const participationPoints = 30;
  const winPoints = payload.wonGame ? 120 : 0;
  const handPoints = payload.handsWon * 8;
  const marginBonus = payload.wonGame ? Math.max(0, payload.finalPoints - payload.opponentFinalPoints) * 2 : 0;

  return participationPoints + winPoints + handPoints + marginBonus;
}

export async function recordRankingGameResult(result: RankingGameResult): Promise<void> {
  if (!pool) {
    return;
  }

  const winnerPlayerId = await upsertPlayer(result.winner);
  const loserPlayerId = result.loser ? await upsertPlayer(result.loser) : null;
  const winnerRankingPoints = getRankingPoints({
    wonGame: true,
    handsWon: result.winnerHandsWon,
    finalPoints: result.winnerFinalPoints,
    opponentFinalPoints: result.loserFinalPoints
  });
  const loserRankingPoints = getRankingPoints({
    wonGame: false,
    handsWon: result.loserHandsWon,
    finalPoints: result.loserFinalPoints,
    opponentFinalPoints: result.winnerFinalPoints
  });

  if (winnerPlayerId) {
    await pool.query(
      `
        update players
        set rank_points = rank_points + $2,
          games_played = games_played + 1,
          games_won = games_won + 1,
          hands_won = hands_won + $3,
          last_seen_at = now()
        where id = $1
      `,
      [winnerPlayerId, winnerRankingPoints, result.winnerHandsWon]
    );
  }

  if (loserPlayerId) {
    await pool.query(
      `
        update players
        set rank_points = rank_points + $2,
          games_played = games_played + 1,
          hands_won = hands_won + $3,
          last_seen_at = now()
        where id = $1
      `,
      [loserPlayerId, loserRankingPoints, result.loserHandsWon]
    );
  }
}

export async function getRanking(limit = 50): Promise<RankingPlayer[]> {
  if (!pool) {
    return [];
  }

  const result = await pool.query<{
    name: string;
    avatar_url: string | null;
    rank_points: number;
    games_played: number;
    games_won: number;
    hands_won: number;
  }>(
    `
      select name, avatar_url, rank_points, games_played, games_won, hands_won
      from players
      where games_played > 0 or rank_points > 0
      order by rank_points desc, games_won desc, hands_won desc, last_seen_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows.map((row, index) => ({
    position: index + 1,
    name: row.name,
    avatarUrl: row.avatar_url,
    rankPoints: row.rank_points,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    handsWon: row.hands_won
  }));
}

export async function saveActiveRoom(roomId: string, snapshot: unknown): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.query(
    `
      insert into active_rooms (room_id, snapshot, updated_at)
      values ($1, $2, now())
      on conflict (room_id)
      do update set snapshot = excluded.snapshot, updated_at = now()
    `,
    [roomId, JSON.stringify(snapshot)]
  );
}

export async function deleteActiveRoom(roomId: string): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.query("delete from active_rooms where room_id = $1", [roomId]);
}

export async function findActiveRoomByPlayerToken(token: string): Promise<ActiveRoomSnapshot | null> {
  if (!pool) {
    return null;
  }

  const result = await pool.query<{ snapshot: ActiveRoomSnapshot }>(
    `
      select snapshot
      from active_rooms
      order by updated_at desc
      limit 100
    `
  );

  return result.rows.find((row) => row.snapshot.players?.some((player) => player.token === token))?.snapshot ?? null;
}

export async function finishMatch(
  matchId: string | undefined,
  winner: PlayerSnapshot
): Promise<void> {
  if (!pool || !matchId) {
    return;
  }

  const winnerPlayerId = await upsertPlayer(winner);

  await pool.query(
    `
      update matches
      set status = 'finished',
        finished_at = now(),
        winner_player_id = $2
      where id = $1
    `,
    [matchId, winnerPlayerId]
  );
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
}
