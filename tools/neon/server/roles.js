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

const MANAGER_ROLES = ['admin', 'president', 'owner'];
const SCANNER_ROLES = ['admin', 'president', 'manager', 'coach'];
const ROLES = ['owner', 'admin', 'president', 'manager', 'coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor'];

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

module.exports = {
  MANAGER_ROLES, SCANNER_ROLES, ROLES,
  ownerMatcher, roleOf, isOwner, isManager, isCoach, isStaff, isScanner, swimmerIsMine, profileOf
};
