import { randomUUID } from "node:crypto";
import { Pool } from "pg";

export type PlayerSnapshot = {
  token: string;
  name: string;
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
      insert into players (token, name)
      values ($1, $2)
      on conflict (token)
      do update set name = excluded.name, last_seen_at = now()
      returning id
    `,
    [player.token, player.name]
  );

  return result.rows[0]?.id ?? null;
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
          insert into players (token, name)
          values ($1, $2)
          on conflict (token)
          do update set name = excluded.name, last_seen_at = now()
          returning id
        `,
        [player.token, player.name]
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
