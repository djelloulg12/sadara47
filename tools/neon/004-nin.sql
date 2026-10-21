-- رقم التعريف الوطني للولي (NIN): مرجع العائلة الواحد.
-- ----------------------------------------------------------------------------
-- القاعدة الحاكمة: هذا الملف **لا يحذف** ولا يعدّل صفًّا. كل عبارة
-- `IF NOT EXISTS`. يُشغَّل مرتين ولا يضرّ. و`raw` يبقى كاملًا كما هو دائمًا.
--
-- ولماذا:
--   * حساب الولي يحمل الرقم في `app_users.national_id`، ويُفرض تفرّده على
--     الأرقام ذات الثمانية عشر رقمًا وحدها. الأرقام القديمة ذات التسعة أرقام
--     تبقى في `raw` كما هي، ويُطلب تحديثها عند أول دخول -- فلا يُمنع أحد من
--     الدخول بسبب رقم قديم، ولا يُخلط رقم قديم برقم بيومتري.
--   * السباح يحمل رقم وليّه في `swimmers.guardian_national_id`، وهو مفتاح
--     لوحة العائلة. ورقم السباح البالغ هو رقمه هو، لأنه ولي على نفسه.
--   * الطلب يحمل الرقم نفسه، ويحمل معه علامة الربط التلقائي بعائلة موجودة
--     (`guardian_linked`) والمرجع العائلي (`family_national_id`).
--
-- التشغيل:  node tools\neon\finish-schema.js

BEGIN;
SET search_path TO sadara, public;

-- ------------------------------------------------------------ حساب الولي
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS status      text,
  ADD COLUMN IF NOT EXISTS member_no   text,
  ADD COLUMN IF NOT EXISTS merged_into text;

-- تفرّد الرقم البيومتري وحده. الفهرس جزئي، فلا يرفض الصفوف التي لا رقم لها
-- (وكل الحسابات القديمة بلا رقم) ولا يرفض رقمًا قديمًا من تسعة أرقام.
CREATE UNIQUE INDEX IF NOT EXISTS app_users_national_id_uniq
  ON public.app_users (national_id)
  WHERE national_id ~ '^[0-9]{18}$';

CREATE INDEX IF NOT EXISTS app_users_national_id_idx
  ON public.app_users (national_id);

-- ------------------------------------------------------------ السباح
ALTER TABLE sadara.swimmers
  ADD COLUMN IF NOT EXISTS guardian_national_id text,
  ADD COLUMN IF NOT EXISTS guardian_account_uid text;

CREATE INDEX IF NOT EXISTS swimmers_guardian_national_idx
  ON sadara.swimmers (guardian_national_id);

-- ------------------------------------------------------------ الطلب
ALTER TABLE sadara.applications
  ADD COLUMN IF NOT EXISTS guardian_national_id text,
  ADD COLUMN IF NOT EXISTS family_national_id   text,
  ADD COLUMN IF NOT EXISTS guardian_linked      boolean,
  ADD COLUMN IF NOT EXISTS guardian_account_uid text;

CREATE INDEX IF NOT EXISTS applications_guardian_national_idx
  ON sadara.applications (guardian_national_id);

CREATE INDEX IF NOT EXISTS applications_family_national_idx
  ON sadara.applications (family_national_id);

-- ------------------------------------------------------------ مستند المستخدم
-- نسخة مطبوعة للقراءة السريعة، و`raw` يبقى المرجع.
ALTER TABLE sadara.users
  ADD COLUMN IF NOT EXISTS national_id text;

CREATE INDEX IF NOT EXISTS users_national_id_idx
  ON sadara.users (national_id);

COMMIT;
