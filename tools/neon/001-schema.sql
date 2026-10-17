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
CREATE INDEX IF NOT EXISTS users_legacy_username_idx
  ON users (legacy_username) WHERE legacy_username IS NOT NULL;

-- Uniqueness declared before the data was read, and found to be wrong by it.
-- Every one of these refused the import on the club's own records, which is the
-- clearest statement available that a constraint written ahead of the data is a
-- guess. A constraint earns its place by refusing something false; one that
-- refuses something true is an obstacle wearing one.
ALTER TABLE sadara.applications
  DROP CONSTRAINT IF EXISTS applications_application_no_key;
ALTER TABLE sadara.users
  DROP CONSTRAINT IF EXISTS users_login_id_key;

-- The indexes built while they were unique stay unique: `CREATE INDEX IF NOT
-- EXISTS` leaves an existing index exactly as it is, quietly. So the old ones are
-- dropped by name, and the plain ones are created again under a new name.
--
-- Worth writing down, because the failure it causes is invisible from the file:
-- the schema no longer says unique, the database still enforces it, and the only
-- sign is an import that stops on the club's own records.
DROP INDEX IF EXISTS sadara.swimmers_membership_idx;
CREATE INDEX IF NOT EXISTS swimmers_membership_lookup
  ON sadara.swimmers (membership_no) WHERE membership_no IS NOT NULL;

-- ---------------------------------------------------------------- requests
-- A registration, exactly as it was filed. `status` is what the club's queue is
-- built from, and `reviewed_by`/`decided_at` are what it shows as decided.
CREATE TABLE IF NOT EXISTS applications (
  firestore_path    text PRIMARY KEY,
  -- NOT unique, and the reason was measured rather than assumed. Of the 574 request
  -- documents there are only 353 distinct reference numbers, because one request is
  -- filed under several keys on purpose: under the identity that filed it and under
  -- the name it chose, so that it can be found again by either. A reference number
  -- carried by two documents is that design working, not a duplicate -- and a
  -- migration that refuses it is refusing the club's records as they actually are.
  application_no    text,
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

CREATE INDEX IF NOT EXISTS swimmers_membership_idx
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


-- ---------------------------------------------------------------- added later
-- The columns the club reports on, asked for by a dry run that could read the
-- snapshot and could not read these out of it. ADD COLUMN IF NOT EXISTS, so
-- this file is safe to run against a table holding a season of records and
-- against a table holding nothing -- and safe to run twice.
-- `raw` is untouched and still authoritative.

ALTER TABLE sadara.applications
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS swimming_strokes text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS cashier_name text,
  ADD COLUMN IF NOT EXISTS transport_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS uniform_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS photo text,
  ADD COLUMN IF NOT EXISTS filed_under text,
  ADD COLUMN IF NOT EXISTS claim_only boolean,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_from text,
  ADD COLUMN IF NOT EXISTS returning_account boolean,
  ADD COLUMN IF NOT EXISTS guardian_child boolean,
  ADD COLUMN IF NOT EXISTS guardian_card_issued date,
  ADD COLUMN IF NOT EXISTS guardian_national_id_expiry date,
  ADD COLUMN IF NOT EXISTS national_id_key text,
  ADD COLUMN IF NOT EXISTS duplicate_key text,
  ADD COLUMN IF NOT EXISTS duplicate_check boolean,
  ADD COLUMN IF NOT EXISTS owner_uid text,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz;

ALTER TABLE sadara.swimmers
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS photo text,
  ADD COLUMN IF NOT EXISTS applicant_uid text;

ALTER TABLE sadara.users
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS registration_id text,
  ADD COLUMN IF NOT EXISTS merged_into text,
  ADD COLUMN IF NOT EXISTS merged_name text,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE sadara.payments
  ADD COLUMN IF NOT EXISTS application_no text,
  ADD COLUMN IF NOT EXISTS cashier_name text;


COMMIT;