-- The club's data, in Postgres, without losing anything.
--
-- Why this shape
-- --------------
-- A migration is judged by one question: *if we had to go back, could we?* So
-- nothing is thrown away and nothing is interpreted.
--
--   firestore_path   the document's full path, verbatim. This is the way back:
--                    every row can be traced to exactly the document it came from,
--                    and written to exactly the document it should return to.
--   raw              the document as Firestore returned it, whole. Authoritative,
--                    and never overwritten by a typed column being wrong.
--   typed columns    promoted from `raw` only for the fields that are actually
--                    searched, joined on or reported on.
--
-- That last line is the important one. A typed column that disagrees with `raw`
-- costs a report; a missing field in `raw` costs the record. So `raw` is kept
-- complete and the typed columns are a reading convenience laid over it.
--
-- Nothing here drops anything. A field nobody thought to promote still exists,
-- in `raw`, and a query can always reach it.
--
-- The order of operations this file assumes
-- ------------------------------------------
--   1. take a snapshot          tools/backup-firestore.js
--   2. import that snapshot     tools/neon/import-snapshot.js
--   3. verify it               tools/neon/verify-snapshot.js
--   4. build the API, cut over
--
-- The import reads the snapshot and never Firestore. That is deliberate: a
-- migration reading a live database is two moving things at once, and a retry
-- then re-imports whatever changed in between. A snapshot can be imported twice
-- and means the same thing both times.

BEGIN;

CREATE SCHEMA IF NOT EXISTS sadara;
SET search_path TO sadara, public;

-- ---------------------------------------------------------------- accounts
-- One row per person who can sign in: the owner, the managers, the parents.
-- `login_id` is what they type. `legacy_username` keeps what they typed before,
-- so nobody who memorised it is locked out by the change.
CREATE TABLE IF NOT EXISTS users (
  firestore_path   text PRIMARY KEY,
  uid              text UNIQUE,
  email            text,
  display_name     text,
  role             text,              -- owner | admin | coach | member
  phone            text,
  -- The number as it is dialled. Usernames are identifiers, not secrets: being
  -- able to guess one buys nothing, and making the club's desk job easy is worth
  -- a great deal. The security lives in the password and in the rate limit.
  --
  -- Deliberately NOT unique. One telephone carries more than one swimmer -- two
  -- brothers under one parent's account is ordinary, not exceptional -- and a
  -- unique index here would stop the import on real data and take the migration
  -- down with it. Which accounts share a number is something the club decides,
  -- not something the database should refuse.
  login_id         text,
  legacy_username  text,
  member_no        text,
  request_status   text,
  request_reason   text,
  verified         boolean,
  created_at       timestamptz,
  updated_at       timestamptz,
  raw              jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS users_login_id_idx  ON users (login_id);
CREATE INDEX IF NOT EXISTS users_phone_idx     ON users (phone);
CREATE INDEX IF NOT EXISTS users_role_idx      ON users (role);

-- Two accounts on one number is normal; two accounts sharing a *name* is not,
-- because a name is how a person finds their own account.
CREATE UNIQUE INDEX IF NOT EXISTS users_legacy_username_uniq
  ON users (legacy_username) WHERE legacy_username IS NOT NULL;

-- ---------------------------------------------------------------- requests
-- A registration, exactly as it was filed. `status` is what the club's queue is
-- built from, and `reviewed_by`/`decided_at` are what it shows as decided.
CREATE TABLE IF NOT EXISTS applications (
  firestore_path    text PRIMARY KEY,
  application_no    text UNIQUE,
  application_type  text,             -- swimmer | coach
  status            text,             -- pending | approved | rejected
  category          text,
  applicant_uid     text,
  account_uid       text,
  transferred_to    text,
  first_name_ar     text,
  last_name_ar      text,
  first_name_fr     text,
  last_name_fr      text,
  birth_date        date,
  birth_place       text,
  gender            text,
  wilaya            text,
  national_id       text,
  national_id_expiry date,
  birth_certificate_no text,
  blood_group       text,
  level             text,
  phone             text,
  whatsapp          text,
  address           text,
  guardian_first_name text,
  guardian_last_name  text,
  guardian_birth_date  date,
  guardian_relation    text,
  guardian_phone       text,
  guardian_national_id text,
  guardian_consent     boolean,
  -- The gate's choice, carried from the form. Added last season and named for it.
  selected_pool     text,
  facility          text,
  pool_number       integer,
  subscription_code text,
  transport         boolean,
  uniform           boolean,
  payment_method    text,
  expected_amount   numeric(12,2),
  registration_id   text,
  membership_no     text,
  -- Named this way on purpose: `decision_reason` is what older records carry and
  -- is still read for display; `rejection_reason` is what the server reads. Both
  -- are kept, because the requests already on file have one or the other.
  decision_reason   text,
  rejection_reason  text,
  reviewed_by       text,
  decided_at        timestamptz,
  scan_name         text,
  scan_path         text,
  notes             text,
  submitted_at      timestamptz,
  created_at        timestamptz,
  updated_at        timestamptz,
  raw               jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS applications_status_idx   ON applications (status);
CREATE INDEX IF NOT EXISTS applications_pool_idx     ON applications (selected_pool);
CREATE INDEX IF NOT EXISTS applications_applicant_idx ON applications (applicant_uid);
CREATE INDEX IF NOT EXISTS applications_national_idx  ON applications (national_id);
CREATE INDEX IF NOT EXISTS applications_created_idx  ON applications (created_at);

-- ---------------------------------------------------------------- swimmers
-- A member on the books. A request becomes one of these when it is accepted, and
-- `from_application` is the line back to the request it came from.
CREATE TABLE IF NOT EXISTS swimmers (
  firestore_path     text PRIMARY KEY,
  membership_no      text,
  registration_id    text,
  first_name_ar      text,
  last_name_ar       text,
  first_name_fr      text,
  last_name_fr       text,
  birth_date         date,
  gender             text,
  blood_group        text,
  level              text,
  phone              text,
  photo_path         text,
  facility           text,
  selected_pool      text,
  subscription_code  text,
  transport          boolean,
  uniform            boolean,
  payment_method     text,
  guardian_first_name text,
  guardian_last_name  text,
  guardian_phone      text,
  medical_notes      text,
  from_application   text,
  active             boolean,
  created_at         timestamptz,
  updated_at         timestamptz,
  raw                jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS swimmers_membership_idx
  ON swimmers (membership_no) WHERE membership_no IS NOT NULL;

-- ---------------------------------------------------------------- presence
CREATE TABLE IF NOT EXISTS attendance (
  firestore_path  text PRIMARY KEY,
  swimmer_path    text,
  membership_no   text,
  session_date    date,
  present         boolean,
  reason          text,
  recorded_by     text,
  created_at      timestamptz,
  raw             jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (session_date);

-- ---------------------------------------------------------------- payments
CREATE TABLE IF NOT EXISTS payments (
  firestore_path  text PRIMARY KEY,
  swimmer_path    text,
  membership_no   text,
  amount          numeric(12,2),
  method          text,
  paid_at         date,
  payment_status  text,
  recorded_by     text,
  notes           text,
  created_at      timestamptz,
  raw             jsonb NOT NULL
);

-- ------------------------------------------------------- everything else
-- Schedules, notices, facilities, plans, fees, requirements, audit, config,
-- counters and claims. None of them is promoted to typed columns, because none
-- of them is reported on yet -- but none of them is dropped either, and adding a
-- column later is an ALTER TABLE over `raw`, not a re-import.
CREATE TABLE IF NOT EXISTS schedules      (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS notices        (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS facilities     (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS subscription_plans (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS fee_settings   (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS coach_requirements (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs     (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS config         (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS counters       (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS claims         (firestore_path text PRIMARY KEY, raw jsonb NOT NULL);

-- ---------------------------------------------------------------- nothing left
-- A document in a collection nobody listed above would otherwise be imported
-- nowhere and noticed never. So the import writes it here instead: visibly
-- unmapped, counted, and printable. An unknown collection is a question to
-- answer, not a gap to discover a season later.
CREATE TABLE IF NOT EXISTS unmapped (
  firestore_path text PRIMARY KEY,
  collection     text,
  raw            jsonb NOT NULL
);

COMMIT;