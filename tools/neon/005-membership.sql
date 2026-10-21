-- رقم الانخراط الموحّد (10 خانات): فهارس وذاكرة الترقيم.
-- ----------------------------------------------------------------------------
-- القاعدة الحاكمة: هذا الملف **لا يحذف** ولا يعدّل صفًّا. كل عبارة
-- `IF NOT EXISTS`. ويُشغَّل مرتين ولا يضرّ.
--
-- الصيغة: [S|C|R][سنة بداية الموسم][1|2|0][تسلسل من أربع خانات]
--   S سباح، C مدرب، R مسؤول.
--   السنة: سبتمبر–ديسمبر = السنة نفسها، جانفي–أوت = السنة السابقة.
--   الفئة: 1 أكابر، 2 أصاغر، 0 مسؤولون.
--
-- ولا فهرس فريد على الرقم: السجلات القديمة قد تحمل أرقامًا مكرّرة أو بصيغة
-- `E...`، والترقيم الجديد يُصلحها بلا حذف. الفهرس العادي يكفي للبحث والتحقق.
--
-- التشغيل:  node tools\neon\finish-schema.js
--           node tools\neon\renumber-membership.js --write

BEGIN;
SET search_path TO sadara, public;

-- ------------------------------------------------------------ السباح
ALTER TABLE sadara.swimmers
  ADD COLUMN IF NOT EXISTS membership_season   text,
  ADD COLUMN IF NOT EXISTS legacy_membership_no text;

CREATE INDEX IF NOT EXISTS swimmers_membership_no_idx
  ON sadara.swimmers (membership_no);

CREATE INDEX IF NOT EXISTS swimmers_membership_season_idx
  ON sadara.swimmers (membership_season);

-- ------------------------------------------------------------ الطلب
ALTER TABLE sadara.applications
  ADD COLUMN IF NOT EXISTS membership_season    text,
  ADD COLUMN IF NOT EXISTS legacy_membership_no text;

CREATE INDEX IF NOT EXISTS applications_membership_no_idx
  ON sadara.applications (membership_no);

CREATE INDEX IF NOT EXISTS applications_membership_season_idx
  ON sadara.applications (membership_season);

-- ------------------------------------------------------------ الحساب
-- `member_no` أُضيف في 004؛ وهذان العمودان يحفظان الموسم والرقم القديم
-- حتى يمكن الرجوع إلى الترقيم السابق دون البحث في `raw`.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS membership_season text,
  ADD COLUMN IF NOT EXISTS legacy_member_no   text;

CREATE INDEX IF NOT EXISTS app_users_member_no_idx
  ON public.app_users (member_no);

CREATE INDEX IF NOT EXISTS app_users_membership_season_idx
  ON public.app_users (membership_season);

COMMIT;
