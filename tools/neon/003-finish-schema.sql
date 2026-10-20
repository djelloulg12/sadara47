-- إكمال مخطط `sadara` بما ينقص المنصة. إضافي فقط.
-- ----------------------------------------------------------------------------
-- القاعدة الحاكمة: هذا الملف **لا يحذف** ولا يعدّل صفًّا ولا عمودًا. كل عبارة
-- `if not exists`. يُشغَّل مرتين ولا يضرّ. و`raw` يبقى كاملًا كما هو دائمًا.
--
-- ولماذا يلزم هذا الملف أصلًا:
--   * الجدول `attendance` بُني قبل ماسح الحضور، فلا يعرف من سجّل الحضور ولا
--     متى. والمنصة تكتب الآن سبعة حقول في كل مسحة، وحقل يسقط هنا يمرّ صامتًا:
--     الصفحة تحفظ، والقاعدة تقبل، وسؤال «من سجّل هذا؟» يبقى بلا جواب.
--   * الـ`groups` (الأفواج) لم تكن مجموعة وقت النقل، فليس لها جدول. وهي الآن
--     يُعتمد عليها في قائمة السباحين وفي كشف الفوج المطبوع.
--
-- التشغيل:  node tools\neon\finish-schema.js

BEGIN;
SET search_path TO sadara, public;

-- ----------------------------------------------------------- الحضور: من سجّل
-- الأعمدة المطبوعة تُضاف بجانب `raw`، و`raw` يبقى مرجعًا. الاسم والصفة
-- يُحفظان وقت الكتابة (denormalised) لا يُشتقّان من قارئ لاحق: تغيير دور
-- مسير بعد سنة يجب ألّا يُعيد كتابة التاريخ.
ALTER TABLE sadara.attendance
  ADD COLUMN IF NOT EXISTS member_id        text,
  ADD COLUMN IF NOT EXISTS status           text,
  ADD COLUMN IF NOT EXISTS marked_by        text,
  ADD COLUMN IF NOT EXISTS marked_by_name   text,
  ADD COLUMN IF NOT EXISTS marked_by_role   text,
  ADD COLUMN IF NOT EXISTS recorded_by_uid  text,
  ADD COLUMN IF NOT EXISTS recorded_by_name text,
  ADD COLUMN IF NOT EXISTS recorded_by_role text,
  ADD COLUMN IF NOT EXISTS marked_at        timestamptz;

CREATE INDEX IF NOT EXISTS attendance_member_idx ON sadara.attendance (member_id);

-- --------------------------------------------------------------- الأفواج
-- في Firestore كان الفوج قائمةً داخل `config/groups` واسمًا على كل سباح.
-- هنا جدول بذاته، والربط بالاسم يبقى كما هو (عمود `group_name` على السباح)
-- والمعرّف يُضاف بجانبه. لا مفتاح يُفرض على الاسم: الفوج الذي يعرّفه المدير
-- ويحمله السباح قد يحملان المعنى نفسه بصيغتين، والقاعدة لا تُخطّئ صاحب النادي.
CREATE TABLE IF NOT EXISTS sadara.groups (
  firestore_path text PRIMARY KEY,
  name           text,
  coach          text,
  schedule       text,
  description    text,
  position       integer,
  active         boolean,
  created_at     timestamptz,
  updated_at     timestamptz,
  raw            jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS groups_name_idx ON sadara.groups (name);

-- --------------------------------------------- حقول يكتبها المحوّل ولا عمود لها
-- فحصٌ آليّ (tools/tests/schema-neon.test.js) قارن ما يكتبه المحوّل فعلًا بما
-- في الجداول، فوجد هذه الحقول تكتب ولا تصل. وهي ليست زينة:
--   * `swimmers.group_id`  يُكتب مع اسم الفوج، فبلا عمود يفقد الربط بالمعرّف.
--   * `swimmers.address`/`email` تعدّلهما استمارة المسير (EDITABLE).
--   * `applications.account_removed_*` تُكتب عند حذف حساب مقدّم الطلب،
--     وهي الأثر الوحيد على الطلب بعد الحذف: بلا عمود يمرّ الحذف بلا أثر.
ALTER TABLE sadara.swimmers
  ADD COLUMN IF NOT EXISTS group_id text,
  ADD COLUMN IF NOT EXISTS address  text,
  ADD COLUMN IF NOT EXISTS email    text;
CREATE INDEX IF NOT EXISTS swimmers_group_idx ON sadara.swimmers (group_id);

ALTER TABLE sadara.applications
  ADD COLUMN IF NOT EXISTS account_removed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS account_removed_by     text,
  ADD COLUMN IF NOT EXISTS account_removed_reason text;

COMMIT;
