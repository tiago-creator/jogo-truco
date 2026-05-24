update players
set name = trim(regexp_replace(name, '(\s+CPU)+$', '', 'gi'))
where name ~* '(\s+CPU)+$'
  and trim(regexp_replace(name, '(\s+CPU)+$', '', 'gi')) <> '';
