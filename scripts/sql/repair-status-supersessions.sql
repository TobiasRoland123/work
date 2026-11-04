\set ON_ERROR_STOP on

-- Run with psql -X against the verified target after taking a backup.
-- This applies only 0049; it does not replay or fabricate migration history.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Keep unqualified migration objects in public; pg_catalog is searched implicitly first.
SET LOCAL search_path = public;

\ir ../../db/0049_status_supersessions.sql

COMMIT;
