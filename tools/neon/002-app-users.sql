-- app_users: the migrated Firebase Authentication accounts.
--
-- Applied by tools/neon/import-auth-users.js before any row is written, and
-- safe to run any number of times (IF NOT EXISTS throughout). The columns are
-- exactly what Firebase's auth export carries:
--
--   id              localId            (Firebase UID)
--   email           email
--   display_name    displayName
--   role            from customAttributes, else sadara.users by email,
--                   else 'coach'
--   password_hash   passwordHash       (firebase-scrypt, base64)
--   password_salt   salt               (base64)
--   hash_algorithm  fixed 'firebase-scrypt' -- login must reproduce Firebase's
--                   own scrypt settings (signer_key, salt_separator, rounds,
--                   mem_cost) from the project's hash_config.
--
-- The password material is copied verbatim and never re-hashed here; verifying
-- a login against it must use the same parameters Firebase used, or every
-- migrated user's password stops working.

CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(128) PRIMARY KEY,          -- localId من Firebase
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'coach',     -- manager / coach / admin
  password_hash TEXT,                   -- passwordHash المشفر الأصلي
  password_salt TEXT,                   -- salt المشفر بـ Base64
  hash_algorithm VARCHAR(50) DEFAULT 'firebase-scrypt',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- تسريع عملية تسجيل الدخول عبر البريد الإلكتروني
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
