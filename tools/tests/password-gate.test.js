/* كلمة المرور: من يحقّ له تغييرها، وكيف يُلزَم من وُضعت له مؤقتة.

   ثلاثة أسئلة يقف عليها هذا الفحص، وكلّها من أخطاء وقعت فعلًا:

   ١. الحائط يجب ألّا يُغلق. طلب صاحب النادي أن يُلزَم كل من دخل بكلمة مرور
      وضعها المسير بأن يضع كلمته. وحائط فيه زرّ إغلاق، أو يُغلقه النقر على
      الخلفية، ليس حائطًا: يُغلق، ويعمل الحساب بكلمة يعرفها المسير -- وهو ما
      رُفع الحائط لمنعه.

   ٢. الحائط لا يُرفع على Firebase. المنصة الحيّة تُدير كلمة المرور من دالّة
      سحابية باسم علَم مختلف (`must_change_password`)، فلا نملك هناك `must_change`.
      ورفع الحائط على علَم لا نكتبه يعني إمّا حائطًا لا يظهر أبدًا (كذب)، أو
      حائطًا يظهر لكل أحد ويسدّ المنصة الحيّة (أسوأ).

   ٣. لا كلمة مرور تُقارن نصًّا. الشرط الذي يطلب الكلمة الحالية يجب أن يقارن
      عبر الخادم أو عبر Auth، لا بـ`===` على قيمة مخزّنة في الصفحة.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const app = read('app.js');
const layer = read('tools/build/part-x.js');
const server = read('tools/neon/server/server.js');

/* ---- ١. الحائط موجود ولا يُغلق ---- */

{
  const wallStart = app.indexOf('must-change-wall');
  if (wallStart === -1) {
    errors.push('the forced-password wall is gone: nothing now stops a holder keeping '
      + 'the password the manager set');
  } else {
    /* نافذة الحائط كما تُبنى: نأخذ القطعة من `insertAdjacentHTML` حتى آخر `</div>`.
       وعلامة الإغلاق `<button class="close"` هي ما نمنعه. */
    const block = app.slice(wallStart, wallStart + 1400);
    if (/class="close"/.test(block.slice(0, 800))) {
      errors.push('the wall carries a close button, so it can be dismissed and the '
        + 'manager-set password kept');
    }
    if (!/data-action="must-change-password"/.test(block)) {
      errors.push('the wall has no button that actually saves the new password');
    }
    if (!/id="wall-new"/.test(block) || !/id="wall-new-2"/.test(block)) {
      errors.push('the wall does not ask for the password twice, so a typo would '
        + 'lock the holder out of an account they were just handed');
    }
  }
}

/* ---- ١ب. ولا زرّ إغلاق يزيله -- الفحص على المنطق لا على الشكل فقط ---- */

{
  /* الشيفرة تبحث عن الحائط بـid وتمنع أي إغلاق له. لو أضاف أحد `wall.remove()`
     في مسار النقر على الخلفية، ظهر هنا. */
  const bindBlock = layer.slice(Math.max(0, layer.indexOf('mustChangeWall') - 40),
    layer.indexOf('mustChangeWall') + 900);
  if (/\bwall\b[\s\S]{0,40}\.remove\(\)/.test(bindBlock) && !/حفظ/.test(bindBlock)) {
    errors.push('the wall can be removed from somewhere other than after saving the '
      + 'password');
  }
}

/* ---- ٢. الحائط مقيّد بالخادم المحلّي، لا بـFirebase ---- */

{
  /* الشرط الذي يرفع الحائط يجب أن يُقيّد بـapiIsMine(). والشرط نفسه يحتوي
     قوسين (`apiIsMine()`)، فلا يُقرأ بـ`[^)]*`: يُقرأ السطر كاملًا. ونستثني
     سطر التعريف `function mustChangeWall()` لأنه ليس نداءً. */
  const raiseLine = (app.match(/[^\n]*mustChangeWall\(\)[^\n]*/g) || [])
    .find(l => !/function\s+mustChangeWall/.test(l)) || '';
  if (!raiseLine) {
    errors.push('could not read when the wall is raised, so it cannot be checked');
  } else if (!/apiIsMine\(\)/.test(raiseLine)) {
    errors.push('the wall is raised without being tied to the local server, so it '
      + 'could appear on the live Firebase platform, where its flag is never written '
      + 'and it would block everyone -- or never appear where it should');
  }
}

/* ---- ٣. لا مقارنة كلمة مرور نصًّا في الخادم ---- */

{
  if (/password\s*===\s*['"]/.test(server)) {
    errors.push('the server compares a password literally instead of reading its hash');
  }
  /* والمسار الذي يطلب الكلمة الحالية له استثناء واحد معروف: حساب بعلَم must_change. */
  if (!/row\.must_change === true/.test(server) || !/const forced/.test(server)) {
    errors.push('the server no longer recognises the forced-change exception, so a '
      + 'holder reaching the wall would be asked for a temporary password they were '
      + 'never shown a field for');
  }
  /* والاستثناء لا يجوز أن ينسحب على غير الحساب صاحب الجلسة: يُقرأ بمعرّف الجلسة. */
  if (!/where id=\$1', \[user\.id\]/.test(server)) {
    errors.push('the password route does not read the account by the session\'s own '
      + 'id, so the forced-change exception could apply to another account');
  }
}

/* ---- ٤. الخادم يبلّغ الصفحة بالعلَم، وإلا لم يظهر الحائط أصلًا ---- */

{
  if (!/must_change: user\.must_change/.test(server) && !/must_change: row\.must_change/.test(server)) {
    errors.push('the login/user view no longer carries must_change, so the page can '
      + 'never know the password is temporary and the wall never rises');
  }
}

console.log('');
if (errors.length) {
  console.log('PASSWORD PROBLEMS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('The forced-password wall cannot be dismissed, rises only where the flag is '
  + 'written, and the server asks for the current password except in the one case it cannot.');
process.exit(0);
