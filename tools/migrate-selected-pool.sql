-- Adding the chosen pool to the registration requests.
--
-- Run this against the club's database once. It adds one column and touches
-- nothing else: no row is read for writing, no row is rewritten, no row is
-- deleted, and no existing value changes. Every request already on file keeps
-- every field it has today, and simply has no value in the new column -- which
-- is true and harmless, because a request filed before the club asked to be told
-- the pool was not asked about one.
--
-- Why it is safe to say so plainly: ADD COLUMN on SQLite appends the column to
-- the table's definition. A row that was written before the column existed
-- simply has no value in it, which SQLite reads as NULL. No UPDATE runs. There
-- is no code path in this statement that can alter a row.
--
-- SQLite's ADD COLUMN has two restrictions, and this statement is written to
-- satisfy both:
--
--   * the column cannot be NOT NULL, unless it has a DEFAULT
--   * the column cannot have a UNIQUE constraint, or a DEFAULT of CURRENT_TIME
--
-- So: nullable, no unique index, no trigger, no default. The default is written
-- as an empty string rather than NULL only in the companion view below; the
-- column itself stays NULL for every row already on file, because NULL is the
-- honest answer -- nothing was asked, so nothing is recorded.
--
-- On PostgreSQL / MySQL the same statement is also valid and equally
-- non-destructive; the IF NOT EXISTS form is spelled differently on MySQL and
-- is given at the foot of this file.
--
-- Idempotent: running it twice changes nothing the second time.

ALTER TABLE applications ADD COLUMN selected_pool TEXT;

-- ---------------------------------------------------------------------------
-- The new column, on its own, is a name the committee will have to read with
-- their fingers. These two views make it answerable without writing anything.
--
-- A view is not a copy: it is the question asked of the table every time it is
-- read. Nothing is stored twice, so nothing can fall out of step, and there is
-- still no UPDATE anywhere in this file.
-- ---------------------------------------------------------------------------

-- Who asked for which pool, including the requests that predate the question.
CREATE VIEW IF NOT EXISTS applications_by_pool AS
  SELECT
    application_no,
    first_name_ar,
    last_name_ar,
    birth_date,
    COALESCE(selected_pool, facility) AS asked_for,
    facility                         AS assigned,
    status,
    created_at,
    /* The one question this column was added to answer: asked for one pool,
       assigned another -- and so a request the committee has to look at. */
    CASE
      WHEN selected_pool IS NULL OR TRIM(selected_pool) = '' THEN 'not recorded'
      WHEN facility IS NULL OR TRIM(facility) = '' THEN 'no pool assigned'
      WHEN TRIM(selected_pool) <> TRIM(facility)      THEN 'asked for another pool'
      ELSE 'same pool'
    END                              AS pool_answer
  FROM applications;

-- How many requests each pool was aimed at. A `position` was not invented for
-- this: ordering by a name is honest, and inventing a number would be a
-- database carrying a fact the club never gave it.
CREATE VIEW IF NOT EXISTS pool_demand AS
  SELECT
    COALESCE(NULLIF(TRIM(selected_pool), ''), NULLIF(TRIM(facility), ''),
             'not recorded')        AS pool,
    COUNT(*)                         AS requests,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
    SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending
  FROM applications
  GROUP BY pool
  ORDER BY requests DESC, pool;

-- ---------------------------------------------------------------------------
-- If the column is already there, this is how to find out before touching
-- anything -- and it is worth running first, every time.
--
--   PRAGMA table_info(applications);
--
-- Safe to run at any time. It only describes.
-- ---------------------------------------------------------------------------

-- MySQL: no IF NOT EXISTS on ADD COLUMN, so guard it the portable way.
--
--   SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
--               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
--                 AND COLUMN_NAME = 'selected_pool');
--   SET @s := IF(@c = 0,
--                'ALTER TABLE applications ADD COLUMN selected_pool TEXT NULL',
--                'DO 0');
--   PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
--
-- The `IF(@c = 0, ...)` is the whole safety: when the column is already present
-- the statement that would run is `DO 0`, which does nothing.
