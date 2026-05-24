create table if not exists cpu_players (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text not null default 'CPU',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table matches add column if not exists winner_cpu_player_id uuid references cpu_players(id);
alter table hands add column if not exists winner_cpu_player_id uuid references cpu_players(id);
