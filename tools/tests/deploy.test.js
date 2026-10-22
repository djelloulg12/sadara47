/* النشر: المنصة تُرفع كخدمة واحدة تخدم الموقع والـ API، فلا تنكسر عند الرفع.

   أربعة أخطاء صامتة يمنعها هذا الفحص، وكلّها تنكشف بعد الرفع لا قبله:

   ١. `pg` تبعية وقت تشغيل. إن غابت عن `dependencies`، بنى Render الصورة ثم
      سقط الخادم عند أول استعلام: `Cannot find module 'pg'`. وأن تكون مثبّتة
      محليًا لا يعني أنها ستُثبَّت هناك — `npm ci` يقرأ `package.json` وحده.

   ٢. مفتاح الجلسة ليس في الصورة. `.session-secret` مستثنى من git، فلو لم
      يُمرَّر `SADARA_SESSION_SECRET` من البيئة لتولّد مفتاحًا جديدًا مع كل
      نشر، ولخرج كل حساب من جلسته عند كل إعادة تشغيل.

   ٣. `render.yaml` لا يمرّر `DATABASE_URL`. قاعدة Neon لا تُقرأ من `.env`
      هناك (الملف مستثنى أصلًا)، فتسقط كل قراءة.

   ٤. اسم الملف التنفيذي. Dockerfile كان يشغّل `server.py` (خادم Firebase)،
      وهو ليس خادم Neon: يُرفع الموقع بلا واجهة برمجية، أو لا يُرفع شيء.

   والأهم: نقطة الدخول يجب أن تبقى عملية Node واحدة تقدّم الملفات و`/api/*`
   معًا. الفصل إلى واجهة وخلفية يكسر الجلسة (كوكي على نفس الأصل)، فما ينشره
   Vercel + Railway لا يصلح لهذه المنصة.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

const pkg = JSON.parse(read('package.json'));
const renderYaml = read('render.yaml');
const dockerfile = read('Dockerfile');
const lock = JSON.parse(read('package-lock.json'));

/* ---- ١. pg تبعية تشغيل معلنة، وقفل الحزم يوافقها ---- */

{
  const deps = pkg.dependencies || {};
  if (!deps.pg) {
    errors.push('pg is not in dependencies, so the host installs nothing to talk to '
      + 'Neon and the server dies on its first query');
  }
  /* القفل هو ما يقرأه `npm ci` فعلًا. لو تأخّر عن `package.json` لفشل البناء
     عند أول خطوة: "npm ci can only install packages when your package.json and '
     + 'package-lock.json are in sync". */
  const rootDeps = (lock.packages && lock.packages['']) ? lock.packages[''].dependencies || {} : {};
  if (deps.pg && !rootDeps.pg) {
    errors.push('the lockfile does not record pg as a dependency, so npm ci fails '
      + 'the build before it starts');
  }
  if (!lock.packages || !lock.packages['node_modules/pg']) {
    errors.push('the lockfile has no resolved copy of pg, so a clean install cannot '
      + 'place it');
  }
  /* السكربت الذي يشغّله المضيف يجب أن يكون خادم Neon، لا خادم Firebase. */
  if (!/node\s+tools\/neon\/server\/server\.js/.test(pkg.scripts && pkg.scripts.start || '')) {
    errors.push('npm start does not launch the Neon server, so the host would run '
      + 'the wrong process');
  }
}

/* ---- ٢. المفتاح السري يُقرأ من البيئة قبل الملف ---- */

{
  const auth = read('tools/neon/server/auth.js');
  const envFirst = auth.indexOf('process.env.SADARA_SESSION_SECRET');
  const fileRead = auth.indexOf(".session-secret");
  if (envFirst === -1) {
    errors.push('the session secret is never read from the environment, so every '
      + 'redeploy signs everyone out');
  } else if (fileRead !== -1 && envFirst > fileRead) {
    errors.push('the session secret is read from the local file before the '
      + 'environment, but the file is git-ignored and absent on the host');
  }
  /* ويجب أن يُمرَّر من إعداد النشر، وإلا بقي الغياب ممكنًا. نتحقق من المفتاح
     كاملًا في سطر `- key:`، لا من مجرّد ورود الاسم: اسم أطول يحتوي الاسم
     الأصلي ليس تمريرًا للمفتاح. */
  if (!/^\s*-\s*key:\s*SADARA_SESSION_SECRET\s*$/m.test(renderYaml)) {
    errors.push('the deploy config does not pass SADARA_SESSION_SECRET, so sessions '
      + 'would be invalidated on every restart');
  }
}

/* ---- ٣. رابط قاعدة البيانات يُمرَّر من البيئة ---- */

{
  if (!/^\s*-\s*key:\s*DATABASE_URL\s*$/m.test(renderYaml)) {
    errors.push('the deploy config does not pass DATABASE_URL, so every read on the '
      + 'host fails: the .env it falls back to is never published');
  }
  if (!/DATABASE_URL/.test(dockerfile) && !/ENV|ARG/.test(dockerfile)) {
    errors.push('the image declares no database variable at all');
  }
}

/* ---- ٤. الصورة تشغّل خادم Neon، لا خادم Firebase ---- */

{
  if (!/node/.test(dockerfile.split('CMD')[1] || '')) {
    errors.push('the image does not run node, so it launches the wrong server');
  }
  if (/python\s+server\.py/.test(dockerfile)) {
    errors.push('the image still runs server.py (the Firebase server), which serves '
      + 'no /api from Neon');
  }
  if (!/tools\/neon\/server\/server\.js/.test(dockerfile)) {
    errors.push('the image does not name the Neon server entry point');
  }
  if (!/COPY\s+package\.json\s+package-lock\.json/.test(dockerfile)) {
    errors.push('the image does not copy both manifest and lockfile before installing, '
      + 'so the dependency layer cannot be cached and may install the wrong tree');
  }
  if (!/COPY\s+\.\s+\./.test(dockerfile)) {
    errors.push('the image never copies the site files, so firebase-public/ would be '
      + 'missing and the platform would serve nothing');
  }
}

/* ---- ٥. بلا فصل: الخادم يقدّم الملفات و/api معًا ---- */

{
  const server = read('tools/neon/server/server.js');
  if (!/firebase-public/.test(server)) {
    errors.push('the server no longer serves the site files, so it is not the single '
      + 'process this platform deploys as');
  }
  /* والمجلد يُقدَّم بصفحته الافتراضية: `/istimara/` رابط الاستمارة الرسمي. */
  if (!/rel\.endsWith\('\/'\)[\s\S]{0,160}index\.html/.test(server)) {
    errors.push('the static server does not map a directory to its index page, so '
      + 'the registration link /istimara/ returns 404 on Render');
  }
  if (!/process\.env\.PORT/.test(server)) {
    errors.push('the server ignores PORT, so a host that assigns one cannot reach it');
  }
  const files = fs.readdirSync(path.join(ROOT, 'tools', 'neon', 'server'));
  ['server.js', 'auth.js', 'db.js', 'roles.js'].forEach(f => {
    if (!files.includes(f)) errors.push('the Neon server is missing ' + f);
  });
}

console.log('');
if (errors.length) {
  console.log('DEPLOY PROBLEMS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('The platform deploys as one service: pg is declared and locked, the session '
  + 'secret and database come from the environment, and the image runs the Neon server '
  + 'that serves the site and the API together.');
process.exit(0);
