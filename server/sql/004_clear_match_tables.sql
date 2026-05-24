begin;

truncate table
  active_rooms,
  hands,
  match_players,
  matches,
  cpu_players
restart identity cascade;

commit;
