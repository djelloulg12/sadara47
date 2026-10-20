/* من يحقّ له ماذا: ترجمة firestore.rules إلى شيفرة خادم.
   ----------------------------------------------------------------------------
   القاعدة كانت تحكم في Google؛ والآن يجب أن تُحكم هنا. والخطر: أن يقبل
   الخادمُ ما كانت القاعدة تردّه، أو العكس. فالسطور التالية منقولة من
   `firestore.rules` سطرًا بسطر، لا مُخترعة:

     manager() = ownerEmail() || role in ['admin','president']
     coach()   = role == 'coach'
     staff()   = manager() || coach()
     scanner() = staff() || role == 'manager'

   والمالك يُعرَف بعنوانه في `config/owners`، لا بمعرّف حساب -- كما كانت.
*/
'use strict';

/* `manager` صار دورًا إداريًا كاملًا: يدير الأفواج والسباحين والمدربين.
   وكان في القاعدة الأولى «ماسحًا» فقط، فكانت الصفحة تفتح له أبوابًا يردّها
   الخادم عند أول كتابة. وهذا ما طلبه النادي: مسيرٌ يملك ما يملكه المدير في
   العمل اليومي، ولا يملك ما يخصّ الحسابات العليا. */
const MANAGER_ROLES = ['admin', 'president', 'owner', 'manager'];
const SCANNER_ROLES = ['admin', 'president', 'manager', 'coach'];
const ROLES = ['owner', 'admin', 'president', 'manager', 'coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor'];

/* الأدوار العليا: من يحملها لا يُدار حسابه من مسير آخر.
   والمالك فوقها جميعًا، ويُعرَف بعنوانه لا بدوره. */
const PRIVILEGED_ROLES = ['owner', 'admin', 'president', 'manager'];
function isPrivilegedRole(role) { return PRIVILEGED_ROLES.indexOf(role) !== -1; }

/* قائمة المالكين تُقرأ مرة وتُحفظ، كما كانت في المحوّل. */
function ownerMatcher(emails) {
  const list = (emails || []).map(x => String(x).toLowerCase());
  return email => !!email && list.indexOf(String(email).toLowerCase()) !== -1;
}

function profileOf(user) {
  return user || {};
}

function isOwner(user, owners) {
  return !!(user && user.email && owners && owners.has(String(user.email).toLowerCase()));
}

/* الترتيب مهمّ: المالك يعلو على كل أدوار الحساب، كما في القاعدة. */
function roleOf(user, owners) {
  if (isOwner(user, owners)) return 'owner';
  return (user && user.role) || 'member';
}

function isManager(user, owners) {
  return MANAGER_ROLES.indexOf(roleOf(user, owners)) !== -1;
}

function isCoach(user) { return !!user && user.role === 'coach'; }

function isStaff(user, owners) { return isManager(user, owners) || isCoach(user); }

/* الحضور وحده: المدرب والمسير، والمسير الذي يحمل دور `manager`. */
function isScanner(user, owners) { return isStaff(user, owners) || (!!user && user.role === 'manager'); }

/* السباح لي إن كُنت الوالد الذي قدّم الطلب، أو الطلب يخصّني، أو رقمي
   هو رقمه. ثلاث روابط كما في القاعدة، ولا رابط رابع. */
function swimmerIsMine(swimmer, user, ownerIsMine) {
  if (!swimmer || !user) return false;
  if (ownerIsMine === true) return true;
  if (swimmer.applicant_uid && swimmer.applicant_uid === user.id) return true;
  if (swimmer.membership_no && swimmer.membership_no === user.member_no) return true;
  return false;
}

/* من يحقّ له التصرّف في حساب غيره.

   القاعدة التي طلبها النادي:
     * صاحب النادي (المدير العام) يتصرّف في كل حساب، إلا كلمة مروره هو.
     * المسير يتصرّف في حسابات المدربين والسباحين وأوليائهم وحدهم.
     * ولا يُمسّ حساب مسير آخر، ولا مدير، ولا رئيس، ولا صاحب النادي.

   والدالّة تقرأ الدور من الحساب نفسه، لا مما يرسله المتصفّح: من يرسل طلبًا
   بمعرّف مسير آخر لا يجد في الصفّ ما يسمح له. */
function canManageAccount(actor, target, owners) {
  if (!actor || !target) return false;
  if (!isManager(actor, owners)) return false;
  if (isOwner(target, owners)) return false;
  if (isOwner(actor, owners)) return true;
  return !isPrivilegedRole(target.role || '');
}

module.exports = {
  MANAGER_ROLES, SCANNER_ROLES, ROLES, PRIVILEGED_ROLES,
  ownerMatcher, roleOf, isOwner, isManager, isCoach, isStaff, isScanner,
  isPrivilegedRole, canManageAccount, swimmerIsMine, profileOf
};
