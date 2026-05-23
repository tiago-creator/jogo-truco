create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  status text not null check (status in ('playing', 'finished')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  winner_player_id uuid references players(id)
);

create table if not exists match_players (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id),
  seat smallint not null,
  name_at_match text not null,
  primary key (match_id, player_id),
  unique (match_id, seat)
);

create table if not exists hands (
  id bigserial primary key,
  match_id uuid references matches(id) on delete set null,
  room_id text not null,
  winner_player_id uuid references players(id),
  hand_value smallint not null,
  winner_points_after smallint not null,
  loser_points_after smallint not null,
  finished_game boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_room_started_at on matches(room_id, started_at desc);
create index if not exists idx_hands_match_created_at on hands(match_id, created_at);
create index if not exists idx_players_last_seen_at on players(last_seen_at desc);
