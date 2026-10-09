-- 0004_parse_attempts_per_tier.sql — one parse attempt per row, not one per email
--
-- 0001_baseline.sql declared `inbound_email_id uuid not null unique`, which
-- permits exactly one parse_attempts row per inbound email. That cannot
-- represent what actually happens: the deterministic parser runs and fails,
-- then the LLM fallback runs and succeeds — two attempts, one email. Per-tier
-- success rate is the reason the table exists, so the constraint has to go.
--
-- The unique constraint created an index on (inbound_email_id) that the foreign
-- key's delete checks would have used. parse_attempts_inbound_email_id_created_at_idx
-- already leads with the same column, so no lookup path is lost.
--
-- The constraint name is deterministic — Postgres names an inline column
-- `unique` as <table>_<column>_key, and 0001_baseline.sql names its sibling
-- orders_inbound_email_id_key the same way. If this errors, the name differed:
-- check it with `\d parse_attempts` and correct it here rather than guessing.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

alter table parse_attempts
  drop constraint parse_attempts_inbound_email_id_key;
