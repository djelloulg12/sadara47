PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active',
  phone TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS swimmers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, membership_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, group_name TEXT NOT NULL, phone TEXT, status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'إعلان', published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_name TEXT NOT NULL, time_range TEXT NOT NULL,
  group_name TEXT NOT NULL, coach TEXT NOT NULL, pool TEXT NOT NULL DEFAULT 'مسبح الصدارة'
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT, swimmer_id INTEGER NOT NULL, session_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present', check_in TEXT, UNIQUE(swimmer_id, session_date),
  FOREIGN KEY(swimmer_id) REFERENCES swimmers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, swimmer_id INTEGER NOT NULL, card_no TEXT UNIQUE NOT NULL,
  season TEXT NOT NULL, issue_date TEXT NOT NULL, expiry_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY(swimmer_id) REFERENCES swimmers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  amount INTEGER NOT NULL, duration TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, application_no TEXT UNIQUE NOT NULL,
  sport TEXT NOT NULL DEFAULT 'السباحة', category TEXT NOT NULL,
  application_type TEXT NOT NULL DEFAULT 'swimmer', applicant_uid TEXT,
  coach_name TEXT, coach_email TEXT, coach_phone TEXT, coach_experience TEXT,
  coach_specialty TEXT, coach_notes TEXT, documents TEXT,
  swimming_strokes TEXT,
  first_name_ar TEXT NOT NULL, last_name_ar TEXT NOT NULL, first_name_fr TEXT, last_name_fr TEXT,
  national_id TEXT, birth_certificate_no TEXT, birth_place TEXT, wilaya TEXT, birth_date TEXT NOT NULL,
  gender TEXT, blood_group TEXT, level TEXT, phone TEXT NOT NULL, whatsapp TEXT, address TEXT,
  facility TEXT, subscription_code TEXT NOT NULL, transport INTEGER NOT NULL DEFAULT 0,
  uniform INTEGER NOT NULL DEFAULT 0, payment_method TEXT, expected_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', decision_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER UNIQUE NOT NULL,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, relation TEXT NOT NULL,
  national_id TEXT, phone TEXT NOT NULL, whatsapp TEXT, address TEXT, consent INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, amount INTEGER NOT NULL,
  method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', receipt_no TEXT UNIQUE,
  paid_at TEXT, cashier_name TEXT, note TEXT, FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL,
  entity_type TEXT, entity_id INTEGER, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS fee_settings (
  key TEXT PRIMARY KEY, value INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coach_requirements (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, required INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
-- Pool and venue names. Management edits the list; the public registration form
-- reads it, so a renamed pool shows up in the choices without a code change.
CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS member_profiles (
  user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Traffic counter: a row per visit, no identifier for the visitor.
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT, visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  page TEXT NOT NULL DEFAULT '/', source TEXT NOT NULL DEFAULT 'direct');
CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
