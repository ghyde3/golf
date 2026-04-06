-- One-time cleanup: Pinebrook (slug pinebrook) should have exactly one row per
-- canonical course name. Keeps the lexicographically smallest course id per name,
-- repoints tee_slots, deletes dupes. (Uses DISTINCT ON — not MIN(uuid).)
-- Safe to run when there are no duplicates (updates/deletes 0 rows).
--
-- With Docker Postgres (`pnpm docker:up`), run from repo root:
--   pnpm db:cleanup-pinebrook
-- (uses DATABASE_URL in .env, typically localhost:5432 → teetimes-postgres)

BEGIN;

WITH pinebrook AS (
  SELECT id FROM clubs WHERE slug = 'pinebrook' LIMIT 1
),
keepers AS (
  SELECT DISTINCT ON (c.club_id, c.name)
    c.id AS keeper_id,
    c.club_id,
    c.name
  FROM courses c
  INNER JOIN pinebrook p ON c.club_id = p.id
  WHERE c.name IN (
    'The Championship',
    'The Meadows',
    'The Pines',
    'The Lakes'
  )
  ORDER BY c.club_id, c.name, c.id
),
to_merge AS (
  SELECT c.id AS course_id, k.keeper_id
  FROM courses c
  INNER JOIN keepers k ON c.club_id = k.club_id AND c.name = k.name
  WHERE c.id <> k.keeper_id
)
UPDATE tee_slots AS ts
SET course_id = tm.keeper_id
FROM to_merge tm
WHERE ts.course_id = tm.course_id;

WITH pinebrook AS (
  SELECT id FROM clubs WHERE slug = 'pinebrook' LIMIT 1
),
keepers AS (
  SELECT DISTINCT ON (c.club_id, c.name)
    c.id AS keeper_id,
    c.club_id,
    c.name
  FROM courses c
  INNER JOIN pinebrook p ON c.club_id = p.id
  WHERE c.name IN (
    'The Championship',
    'The Meadows',
    'The Pines',
    'The Lakes'
  )
  ORDER BY c.club_id, c.name, c.id
),
to_delete AS (
  SELECT c.id
  FROM courses c
  INNER JOIN keepers k ON c.club_id = k.club_id AND c.name = k.name
  WHERE c.id <> k.keeper_id
)
DELETE FROM courses
WHERE id IN (SELECT id FROM to_delete);

COMMIT;
