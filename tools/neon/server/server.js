/* خادم الصدارة على Neon: بديل المحوّل Firebase، بنفس واجهة /api/.
   ----------------------------------------------------------------------------
   لماذا هذا الملف موجود:
   المنصة كانت ملفات ثابتة تتكلّم مع Firebase مباشرة من متصفّح العائلة. والآن
   البيانات في Neon، وهي قاعدة بيانات لا تعرف من أنت. فبينهما خادم: يحمل
   كلمة مرور القاعدة (فلا تُسلَّم لمتصفّح أحد)، ويتحقّق من الدخول، ويردّ على
   نفس المسارات التي كان المحوّل يردّ عليها -- `/api/login`، `/api/swimmers`،
   `/api/attendance`... فلا تعرف الصفحة أنها تكلّم خادمًا آخر.

   ما لا يفعله هذا الملف:
   لا يقرأ Firebase ولا يكتب فيه. ولا يحذف صفًّا. والحذف الوحيد الممكن هو
   ما تطلبه الصفحة صراحةً (حذف سباح من قائمة، بإذن المدير)، وهو نفسه لم
   يكن حذفًا: كان إخفاءً بوسم الحالة -- انظر `swimmers.delete` أدناه.

   التشغيل:
     DATABASE_URL=... node tools\neon\server\server.js
   أو:
     node tools\neon\server\server.js          (يقرأ .env)
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const auth = require('./auth');
const D = require('./db');
const R = require('./roles');

const PORT = Number(process.env.PORT) || 4180;
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', '..', 'firebase-public');

/* ============================ أدوات الردّ ============================ */

function sendJSON(res, value, status = 200) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

/* نفس الصفحة، وفيها سطر واحد يُعلن لهذه النشرة أنّ خادمًا يردّ على `/api/*`.
   ----------------------------------------------------------------------------
   ولا يُحقن السطر إن كان العلم موجودًا سلفًا، ولا إن كان الملف لا يحمّل
   المحوّل أصلًا: الحقن يجب أن يبقى أثرًا واحدًا، لا أثرًا مكرّرًا. */
function serveHtml(req, res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    let html = data.toString('utf8');
    if (html.indexOf('SADARA_LOCAL_API') === -1 && html.indexOf('firebase-adapter.js') !== -1) {
      const flag = '<script>window.SADARA_LOCAL_API=true;</script>\n';
      html = html.replace(/<script src=["']firebase-adapter\.js["']><\/script>/,
        flag + '<script src="firebase-adapter.js"></script>');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

const SESSION_COOKIE = 'sadara_session';
function setSession(res, user) {
  const token = auth.create(user);
  const maxAge = 14 * 86400;
  res.setHeader('Set-Cookie',
    SESSION_COOKIE + '=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAge
    + (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}
function clearSession(res) {
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

/* ======================== الحساب والجلسة ======================== */

/* قائمة المالكين، كما كانت `config/owners`. تُقرأ مرة وتُحفظ. */
let ownersCache = null;
async function owners() {
  if (ownersCache) return ownersCache;
  const row = await D.one("select raw from sadara.config where firestore_path='config/owners'");
  const emails = (row && row.raw && Array.isArray(row.raw.emails)) ? row.raw.emails : [];
  ownersCache = new Set(emails.map(x => String(x).toLowerCase()));
  return ownersCache;
}

/* المستخدم كما تراه الصفحة: من صفّ `app_users` ومن مستند `sadara.users`. */
async function loadUser(uid) {
  const row = await D.one(
    `select id, email, display_name, role, phone, member_no, must_change, national_id,
            local_hash, local_salt, hash_params
       from public.app_users where id=$1`, [uid]);
  if (!row) return null;
  /* الملف التفصيلي من مستند المستخدم، إن وُجد. */
  const prof = await D.one('select raw from sadara.users where uid=$1', [uid]);
  const p = (prof && prof.raw) || {};
  const nin = normalizeNIN(row.national_id) || normalizeNIN(p.national_id);
  return {
    id: row.id,
    email: row.email || '',
    name: p.name || row.display_name || row.email || 'عضو النادي',
    role: row.role || p.role || 'member',
    phone: row.phone || p.phone || '',
    member_no: row.member_no || p.member_no || '',
    username: p.username || '',
    registration_id: p.registration_id || '',
    group_name: p.group_name || '',
    status: p.request_status || '',
    rejection_reason: p.rejection_reason || '',
    national_id: nin,
    national_id_missing: !nin,
    merged_into: p.merged_into || '',
    roles: Array.isArray(p.roles) ? p.roles : (row.role ? [row.role] : []),
    must_change: row.must_change !== false
  };
}

/* الحساب كما تعرضه الصفحة (`userView` في المحوّل) -- بالحقول نفسها. */
function userView(user, ownerSet) {
  if (!user) return null;
  const owns = ownerSet.has(String(user.email).toLowerCase());
  return {
    id: user.id,
    name: user.name,
    role: owns ? 'admin' : user.role,
    owner: owns,
    email: user.email,
    username: user.username,
    phone: user.phone,
    member_no: user.member_no,
    registration_id: user.registration_id,
    group_name: user.group_name,
    status: user.status,
    rejection_reason: user.rejection_reason,
    roles: user.roles,
    national_id: user.national_id || '',
    national_id_missing: user.national_id_missing !== false,
    merged_into: user.merged_into,
    merged_name: '',
    must_change: user.must_change
  };
}

async function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const data = auth.open(token);
  if (!data) return null;
  return loadUser(data.uid);
}

/* ============================ المسارات ============================ */

const ROUTES = {};

/* ---------------- الدخول ---------------- */

ROUTES['POST /api/login'] = async (req, res, body) => {
  /* المدخل واحد: البريد الإلكتروني أو رقم التعريف الوطني.
     ------------------------------------------------------------------------
     الولي الذي نسي بريده لا يُمنع من متابعة أبنائه؛ يكتب رقمه البيومتري
     الثمانية عشر ومعه كلمة المرور. والرقم يُقبل بمسافات أو شرطات كما يُقرأ
     من البطاقة. وإن لم يكن المدخل رقمًا بيومتريًا فهو بريد كما كان. */
  const typed = String(body.email || body.identifier || body.national_id || body.nin || '').trim();
  const nin = normalizeNIN(typed);
  const email = typed.toLowerCase();
  const password = String(body.password || '');
  if (!typed || !password) {
    return sendJSON(res, { error: 'يرجى إدخال البريد أو رقم التعريف الوطني وكلمة المرور' }, 400);
  }
  const attemptKey = nin || email;
  if (auth.tooManyAttempts(attemptKey)) {
    return sendJSON(res, { error: 'محاولات كثيرة. أعد المحاولة بعد ربع ساعة.' }, 429);
  }
  const row = nin
    ? await D.one('select id, local_hash, local_salt, hash_params from public.app_users where national_id=$1', [nin])
    : await D.one('select id, local_hash, local_salt, hash_params from public.app_users where lower(email)=$1', [email]);
  /* كلمة مرور خاطئة وحساب غير موجود: نفس الردّ، فلا يُعرف من له حساب. */
  const ok = row && auth.verifyPassword(password, row.local_hash, row.local_salt, row.hash_params);
  if (!ok) {
    auth.noteFailure(attemptKey);
    return sendJSON(res, { error: 'البريد أو رقم التعريف الوطني أو كلمة المرور غير صحيحة' }, 401);
  }
  auth.clearAttempts(attemptKey);
  const user = await loadUser(row.id);
  setSession(res, user);
  sendJSON(res, { user: userView(user, await owners()), gate: { gate: 'open' } });
};

ROUTES['POST /api/logout'] = async (req, res) => {
  clearSession(res);
  sendJSON(res, { ok: true });
};

ROUTES['GET /api/session'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  sendJSON(res, { user: userView(user, await owners()), gate: { gate: 'open' } });
};

ROUTES['GET /api/profile'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  sendJSON(res, { profile: userView(user, await owners()) });
};

/* لوحة العائلة: الولي وأبناؤه وطلباتهم المعلّقة، برقم واحد. */
ROUTES['GET /api/family'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  sendJSON(res, await familyView(user));
};

/* إكمال ملف الولي: صاحب الحساب يكتب رقمه مرة واحدة.
   ولا يغيّر رقمًا مسجّلًا، ولا يربط سباحًا ليس من طلباته. */
ROUTES['POST /api/accounts/national-id'] = async (req, res, body) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const out = await setAccountNIN(user.id, body.national_id, { self: true, by: user.id });
  if (out.error) return sendJSON(res, { error: out.error }, out.status);
  sendJSON(res, out);
};

/* ---------------- باب التسجيل ---------------- */
/* يُقرأ بلا دخول: زائر يقف على الباب له أن يُقال له الحقّ. */
ROUTES['GET /api/registration'] = async (req, res) => {
  const row = await D.one("select raw from sadara.config where firestore_path='config/registration'");
  const data = row && row.raw;
  if (!data) return sendJSON(res, { open: true, note: '', readable: true });
  sendJSON(res, { open: data.open !== false, note: data.note || '', readable: true });
};

/* ---------------- إبقاء الخدمة مستيقظة، عند الحاجة وحدها ----------------
   Render المجاني يُنيم الخدمة بعد 15 دقيقة بلا طلب وارد، فتستيقظ بعد ~دقيقة
   عند أول زيارة. وهذا مزعج لعائلة تفتح المنصة في الصباح.

   والنبضة التي تردّ دائمًا تُبقي الخدمة مستيقظة، لكنها تدفع الثمن كاملًا:
   17 ساعة يوميًّا من رصيد 750 ساعة شهريًّا، حتى والساعة التي لا يفتح فيها
   أحد شيئًا. والصواب أن تُقاس الحاجة بالنشاط: إن كان طلبٌ ورد قبل أقل من
   14 دقيقة فالخدمة مستيقظة من تلقاء نفسها، والنبضة لا تفعل شيئًا.

   فيصير الحساب على النشاط لا على الساعة: ساعة فيها استعمال لا تحتاج نبضة،
   وساعة فارغة لا تبقى مستيقظة. وهذا يوفّر من الرصيد بقدر ما يقلّ الاستعمال.

   وشرطان:
     - رمز سرّي في العنوان (`SADARA_WAKE_TOKEN`). بلا رمز: 404، وكأن المسار
       غير موجود -- لا نكشف أنه يوجد شيء هنا.
     - لا لمس لقاعدة Neon. النبضة تقول «الخادم حيّ» فقط. لو قرأت من القاعدة
       لأيقظت Neon كل 14 دقيقة بلا سبب. */

/* آخر طلب وارد من غير النبضة. يُقرأ في الذاكرة وحدها: لا يهمّ أن يضيع عند
   إعادة التشغيل، فإعادة التشغيل نفسها نشاط يمنع النوم بعده. */
let lastRequestAt_ = 0;
/* 14 دقيقة: أقلّ من مهلة نوم Render (15 دقيقة) بدقيقة، فتفوت النبضةُ النومَ
   دائمًا. وقابلة للتغيير عند الاختبار وحده (`SADARA_WAKE_QUIET_MS`). */
const WAKE_QUIET_MS = Number(process.env.SADARA_WAKE_QUIET_MS) || 14 * 60 * 1000;

ROUTES['GET /api/wake'] = async (req, res, body, url) => {
  const expected = process.env.SADARA_WAKE_TOKEN || '';
  const given = url.searchParams.get('token') || '';
  if (!expected || given !== expected) {
    return sendJSON(res, { error: 'مسار غير معروف' }, 404);
  }
  const now = Date.now();
  const quietFor = lastRequestAt_ ? now - lastRequestAt_ : Infinity;
  if (quietFor < WAKE_QUIET_MS) {
    /* هناك نشاط حديث: الخدمة مستيقظة أصلًا، والنبضة لا معنى لها الآن. */
    return sendJSON(res, {
      ok: true, awake: true, skipped: true, at: new Date().toISOString(),
      last_activity_seconds: Math.round(quietFor / 1000)
    });
  }
  sendJSON(res, {
    ok: true, awake: true, skipped: false, at: new Date().toISOString(),
    last_activity_seconds: lastRequestAt_ ? Math.round(quietFor / 1000) : null
  });
};

/* ---------------- السباحون ---------------- */
ROUTES['GET /api/swimmers'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const ownerSet = await owners();
  const rows = await D.all('select * from sadara.swimmers order by membership_no');
  const people = rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
  /* من بلغ 18 سنة لا تُعرض له بيانات وليّ في أي مكان -- ولا للطاقم من باب
     أولى. يبقى `guardian_national_id` لأنه رقمه هو (وليٌّ على نفسه)، ويُحذف
     اسم الولي وهاتفه وصلته. */
  const clean = people.map(withoutGuardian);
  /* المدير والمدرب يرون القائمة كاملة، والولي يرى أبناءه فقط. */
  if (R.isStaff(user, ownerSet)) return sendJSON(res, clean);
  const mine = clean.filter(s => R.swimmerIsMine(s, user, ownerSet.has(String(user.email || '').toLowerCase())));
  sendJSON(res, mine);
};

/* ---------------- الحضور ---------------- */
ROUTES['GET /api/attendance'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const rows = await D.all('select * from sadara.attendance order by session_date desc');
  sendJSON(res, rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r))));
};

/* ---------------- كلمة المرور ----------------
   ثلاثة مسارات، تفصل بينها ثلاثة أسئلة مختلفة:

     1. `POST /api/password`  — أُغيّر كلمتي أنا. يشترط كلمة المرور الحالية:
        جلسة مسروقة لا يجوز أن تستولي على الحساب صامتة.

     2. `POST /api/accounts/password` — المسير يضبط كلمة مرور لحساب غيره.
        لا يشترط كلمة الحساب المستهدَف (لا يعرفها)، لكنه يشترط حقّ الإدارة.

     3. `POST /api/accounts/default-password` — كلمة المرور الافتراضية لكل
        حساب، وعلامة `must_change` فوقها. هذه طلب صاحب النادي: باب واحد
        يُدخِل الجميع بكلمة واحدة معلومة، ثم يُلزَم كل واحد بكلمته.

   وكلمة المرور لا تُكتب في أي ملف، ولا تُعاد في أي ردّ. */

function strongEnough(pw) { return typeof pw === 'string' && pw.length >= 10; }

/* كلمة المرور المؤقتة: تُولَّد في الخادم، ولا تتكرّر.

   الأبجدية تُسقط المحارف التي تُقرأ على وجهين -- O/0 وI/1 وl -- لأن الكلمة
   تُقرأ من ورقة أو تُقال في الهاتف. وستّة عشر محرفًا من ثمانية وعشرين حرفًا
   فضاءٌ لا يتكرّر اتفاقًا. والضمانة الثانية: مجموعة ما أُصدر في عمر العملية،
   فلا تُعاد الكلمة نفسها ولو وقع التصادم. */
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const issuedTempPasswords = new Set();
function tempPassword() {
  for (let attempt = 0; attempt < 64; attempt++) {
    let out = '';
    for (let i = 0; i < 16; i++) out += TEMP_ALPHABET[crypto.randomInt(TEMP_ALPHABET.length)];
    if (issuedTempPasswords.has(out)) continue;
    issuedTempPasswords.add(out);
    return out;
  }
  throw new Error('could not generate a unique temporary password');
}

async function setPassword(uid, password, { mustChange, by }) {
  const salt = crypto.randomBytes(16).toString('base64');
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const hash = auth.hashPassword(password, salt, params);
  /* لا نكتب تجزئة لا نتحقّق منها: خطأ في المعاملات يُكشف هنا لا عند العائلة. */
  if (auth.hashPassword(password, salt, params) !== hash) throw new Error('hash does not verify');
  await D.run(`update public.app_users set local_hash=$1, local_salt=$2, hash_params=$3,
      must_change=$4, password_set_at=now() where id=$5`,
    [hash, salt, JSON.stringify(params), mustChange !== false, uid]);
  await D.run(`insert into sadara.audit_logs (firestore_path, raw)
      values ($1, $2) on conflict (firestore_path) do nothing`,
    ['audit_logs/password_' + uid + '_' + Date.now(),
      JSON.stringify({ action: 'password_set', by: by || '', target: uid, at: new Date().toISOString(), must_change: mustChange !== false })]);
}

/* ==================== رقم التعريف الوطني للولي ====================
   الرقم البيومتري هو مرجع العائلة: حساب واحد للولي، وكل أبنائه حوله.
   ----------------------------------------------------------------------------
   ولا يُكتب الرقم في مكانين يتفرّقان: يُكتب في `app_users` (الفهرس الفريد)،
   وفي `sadara.users.raw` (ما تقرؤه الصفحة)، وفي السباحين الذين قدّمهم الحساب
   (`guardian_national_id`) حتى تظهر بطاقاتهم في لوحة العائلة فورًا. */

async function findGuardianByNIN(nin) {
  const key = normalizeNIN(nin);
  if (!key) return null;
  const row = await D.one(
    'select id, email, display_name, role, phone, national_id from public.app_users where national_id=$1', [key]);
  return row || null;
}

/* كتابة رقم الولي لحساب، وربط أبنائه القدامى به.
   `self` يعني أن صاحب الحساب يكمّل ملفه: لا يغيّر رقمًا مسجّلًا، ولا يربط
   سباحين ليسوا له. والمسير/المدير يعدّل عبر `PUT /api/accounts` بلا هذا القيد. */
async function setAccountNIN(uid, rawNin, opts) {
  opts = opts || {};
  const nin = normalizeNIN(rawNin);
  if (!nin) {
    return { error: 'رقم التعريف الوطني يجب أن يكون 18 رقمًا بالضبط.', status: 400 };
  }
  const target = await D.one(
    'select id, email, member_no, national_id from public.app_users where id=$1', [uid]);
  if (!target) return { error: 'لا يوجد حساب بهذا المعرّف.', status: 404 };
  /* الرقم القديم ذو التسعة أرقام ليس رقمًا بيومتريًا: يبقى في `raw` ولا يمنع
     صاحبه من إكمال ملفه. الشرط يقع على رقم صالح مسجّل، لا على أي نصّ قديم. */
  const current = normalizeNIN(target.national_id);
  if (opts.self && current && current !== nin) {
    return {
      error: 'رقم التعريف الوطني مسجّل لهذا الحساب مسبقًا. تغييره من الإدارة.',
      status: 403
    };
  }
  const other = await D.one(
    'select id, email from public.app_users where national_id=$1 and id<>$2', [nin, uid]);
  if (other) {
    return {
      error: 'رقم التعريف الوطني مسجّل لحساب آخر. لا يمكن أن يحمله حسابان.',
      status: 409
    };
  }

  await D.run('update public.app_users set national_id=$1, updated_at=now() where id=$2', [nin, uid]);
  /* `raw` يبقى كاملًا، ويُضاف إليه الحقل المطبوع. والصفّ قد لا يكون موجودًا
     لحساب أُنشئ حديثًا، فلا يُنشأ صفّ ناقص من أجل حقل واحد. */
  await D.run("update sadara.users set national_id=$1, raw = raw || $2::jsonb where uid=$3",
    [nin, JSON.stringify({ national_id: nin }), uid]);

  /* أبناء هذا الحساب: الطلبات التي قدّمها تحمل `applicant_uid`، والسباحون
     المولودون منها يحملونه أيضًا. نملأ الفراغ فقط -- رقم موجود لا يُستبدل
     بقرار من صاحب الحساب. */
  let linked = 0;
  if (opts.linkSwimmers !== false) {
    const rows = await D.all('select firestore_path, raw from sadara.swimmers');
    for (const row of rows) {
      const s = row.raw || {};
      const mine = String(s.applicant_uid || '') === String(uid)
        || (target.member_no && String(s.membership_no || '') === String(target.member_no));
      if (!mine || normalizeNIN(s.guardian_national_id)) continue;
      await mergeRaw('swimmers', row.firestore_path, { guardian_national_id: nin });
      await writeTyped('swimmers', row.firestore_path,
        { guardian_national_id: nin, updated_at: new Date().toISOString() }, SWIMMER_COLUMNS);
      linked++;
    }
    await D.run(
      `update sadara.applications
          set family_national_id=$1, guardian_account_uid=$2
        where applicant_uid=$3 and (family_national_id is null or family_national_id='')`,
      [nin, uid, uid]);
  }

  await mergeRaw('audit_logs', 'audit_logs/' + newId(), {
    action: 'national_id_set',
    by: (opts.by || uid),
    target: uid,
    at: new Date().toISOString(),
    swimmers_linked: linked
  });
  return { ok: true, national_id: nin, swimmers_linked: linked };
}

/* ما تراه العائلة: الولي، وأبناؤه المسجّلون، وطلباتهم التي لم تُقبل بعد.
   ولا يُعاد رقم أي عائلة أخرى: التصفية على رقم الحساب نفسه. */
async function familyView(user) {
  const nin = normalizeNIN(user && user.national_id);
  const guardian = {
    id: (user && user.id) || '',
    name: (user && user.name) || '',
    email: (user && user.email) || '',
    phone: (user && user.phone) || '',
    national_id: nin,
    national_id_missing: !nin
  };
  if (!nin) return { complete: false, national_id: '', guardian, swimmers: [], pending: [] };

  const rows = await D.all('select * from sadara.swimmers');
  const swimmers = rows
    .map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(s => normalizeNIN(s.guardian_national_id) === nin)
    .map(withoutGuardian);

  const apps = await D.all("select * from sadara.applications where status='pending'");
  const pending = apps
    .map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(a => normalizeNIN(a.guardian_national_id || a.family_national_id) === nin)
    .map(withoutGuardianApplication);

  return {
    complete: true,
    national_id: nin,
    guardian,
    swimmers,
    pending
  };
}

/* تغيير المرء كلمته بنفسه.
   --------------------------
   القاعدة: كلمة المرور الحالية مطلوبة دائمًا، لأن جلسة مسروقة لا يجوز أن
   تستولي على الحساب صامتة. ولها استثناء واحد، هو الحالة التي وُجد من أجلها
   العلَم `must_change`: حساب دخل بكلمة مؤقتة وضعها له المسير. الكلمة المؤقتة
   يعرفها من وضعها أصلًا، وطلبها مرة أخرى لا يحمي من شيء -- ولذلك يُقبل
   التغيير بلا كلمة حالية **فقط** حين يكون `must_change` صحيحًا، وحين يكون
   الحساب هو نفسه صاحب الجلسة. وما إن تُغيَّر حتى يسقط العلَم، فيعود الشرط. */
ROUTES['POST /api/password'] = async (req, res, body) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const current = String(body.current || '');
  const next = String(body.password || body.next || '');
  if (!strongEnough(next)) return sendJSON(res, { error: 'كلمة المرور يجب أن تكون عشرة محارف على الأقل.' }, 400);
  const row = await D.one('select local_hash, local_salt, hash_params, must_change from public.app_users where id=$1', [user.id]);
  if (!row) return sendJSON(res, { error: 'لا يوجد حساب بهذا المعرّف.' }, 404);
  const forced = row.must_change === true;
  if (!forced && !auth.verifyPassword(current, row.local_hash, row.local_salt, row.hash_params)) {
    return sendJSON(res, { error: 'كلمة المرور الحالية غير صحيحة.' }, 403);
  }
  await setPassword(user.id, next, { mustChange: false, by: user.id });
  sendJSON(res, { ok: true, note: 'تغيّرت كلمة المرور. لا تُكتب في أي ملف.' });
};

ROUTES['POST /api/accounts/password'] = async (req, res, body) => {
  const actor = await currentUser(req);
  if (!actor) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const ownerSet = await owners();
  if (!R.isManager(actor, ownerSet)) {
    return sendJSON(res, { error: 'ضبط كلمة المرور متاح للمدير أو رئيس النادي فقط' }, 403);
  }
  const uid = String(body.id || body.uid || '');
  const password = String(body.password || '');
  if (!uid) return sendJSON(res, { error: 'معرّف الحساب مطلوب' }, 400);
  if (uid === actor.id) return sendJSON(res, { error: 'لا يمكنك تغيير كلمة مرور حسابك من هنا.' }, 403);
  if (!strongEnough(password)) return sendJSON(res, { error: 'كلمة المرور يجب أن تكون عشرة محارف على الأقل.' }, 400);
  const target = await D.one('select id, email, role from public.app_users where id=$1', [uid]);
  if (!target) return sendJSON(res, { error: 'لا يوجد حساب بهذا المعرّف.' }, 404);
  /* كلمة مرور صاحب النادي لا تُمسّ من هنا: هو يُديرها بنفسه، ولا يضعها له مسير. */
  if (R.isOwner(target, ownerSet)) {
    return sendJSON(res, { error: 'كلمة مرور صاحب النادي تُدار من حسابه وحده، لا من هنا.' }, 403);
  }
  if (!R.canManageAccount(actor, target, ownerSet)) {
    return sendJSON(res, { error: 'لا يمكنك تغيير كلمة مرور مسير أو مدير آخر.' }, 403);
  }
  await setPassword(uid, password, { mustChange: body.must_change !== false, by: actor.id });
  sendJSON(res, { ok: true, email: target.email, must_change: body.must_change !== false });
};

/* إعادة تعيين كلمة المرور: كلمة مؤقتة فريدة يُولّدها الخادم، وتُعاد مرة واحدة.

   لماذا في الخادم لا في الصفحة؟ لأن الكلمة التي تُولَّد في المتصفّح تمرّ في
   الشبكة نصًّا، وقد تُحفظ في سجلّ؛ وهي هنا تُكتب تجزئةً فقط، ولا يعود الخادم
   يذكرها. والذي يُعيدها هو من يملك الصلاحية على الحساب، لا من يطلبها.

   والكلمة تُعاد في هذا الردّ وحده، ليراها من وزّعها ويسلّمها لصاحبها. */
ROUTES['POST /api/accounts/reset-password'] = async (req, res, body) => {
  const actor = await currentUser(req);
  if (!actor) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const ownerSet = await owners();
  if (!R.isManager(actor, ownerSet)) {
    return sendJSON(res, { error: 'إعادة تعيين كلمة المرور للمدير أو المسير فقط' }, 403);
  }
  const uid = String(body.id || body.uid || '');
  if (!uid) return sendJSON(res, { error: 'معرّف الحساب مطلوب' }, 400);
  if (uid === actor.id) {
    return sendJSON(res, { error: 'كلمة مرورك تُغيَّر من صفحة ملفك بكلمتك الحالية، لا من هنا.' }, 403);
  }
  const target = await D.one('select id, email, role from public.app_users where id=$1', [uid]);
  if (!target) return sendJSON(res, { error: 'لا يوجد حساب بهذا المعرّف.' }, 404);
  if (R.isOwner(target, ownerSet)) {
    return sendJSON(res, { error: 'كلمة مرور صاحب النادي لا تُعاد من هنا.' }, 403);
  }
  if (!R.canManageAccount(actor, target, ownerSet)) {
    return sendJSON(res, { error: 'لا يمكنك إعادة تعيين كلمة مرور مسير أو مدير آخر.' }, 403);
  }
  const password = tempPassword();
  await setPassword(uid, password, { mustChange: true, by: actor.id });
  sendJSON(res, { ok: true, email: target.email, password, must_change: true,
    note: 'كلمة مؤقتة تُعرض مرة واحدة. تُسلَّم لصاحبها، ويُطلب منه تغييرها عند أول دخول.' });
};

/* كلمة مرور واحدة للجميع: أُلغيت.
   ----------------------------------------------------------------------------
   كانت تعطي كل الحسابات الكلمة نفسها ثم تُلزم كل واحد بتغييرها. وهذا يناقض
   ما طلبه النادي صراحةً: كلمة مؤقتة فريدة لكل شخص، لا يتشابه فيها حسابان.
   وكلمةٌ واحدة معلومة تعني أن أول من يقرأ الورقة يدخل إلى حساب أي أحد قبل أن
   يغيّرها صاحبها.

   فالطريق الباقي هو `POST /api/accounts/reset-password`: كلمة مؤقتة واحدة،
   لحساب واحد، تُعاد مرة واحدة. والمسار يُبقي رفضًا صريحًا بدل أن يختفي، حتى
   لا يظنّ من جرّبه أن المنصة تعطّلت. */
ROUTES['POST /api/accounts/default-password'] = async (req, res) => {
  const actor = await currentUser(req);
  if (!actor) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  if (!R.isManager(actor, await owners())) {
    return sendJSON(res, { error: 'هذا الإجراء للمدير أو رئيس النادي فقط' }, 403);
  }
  sendJSON(res, {
    error: 'لم تعد كلمة المرور الجماعية تُستعمل: لكل حساب كلمة مؤقتة فريدة. '
      + 'استعمل «إعادة تعيين كلمة المرور» على صفّ الحساب.',
    use: '/api/accounts/reset-password'
  }, 410);
};

/* ---------------- الحسابات وصلاحياتها ----------------
   كان الوصول إلى هذه الصفحة يستلزم تشغيل سكربت على قاعدة البيانات. والقاعدة
   تسمح للمدير بقراءة أي مستخدم وتعديله، وهذا هو ما يفتح ذلك من الصفحة. */
ROUTES['GET /api/accounts'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const ownerSet = await owners();
  if (!R.isManager(user, ownerSet)) {
    return sendJSON(res, { error: 'عرض الحسابات لرئيس النادي فقط' }, 403);
  }
  const rows = await D.all('select id, email, display_name, role, must_change, national_id from public.app_users where email is not null');
  const profiles = await D.all('select uid, raw from sadara.users');
  const byUid = new Map(profiles.map(p => [p.uid, p.raw || {}]));
  const list = rows.map(r => {
    const p = byUid.get(r.id) || {};
    if (p.merged_into) return null;
    const email = r.email || '';
    const nin = normalizeNIN(r.national_id) || normalizeNIN(p.national_id);
    return {
      id: r.id,
      name: p.name || r.display_name || '',
      email,
      username: p.username || '',
      phone: p.phone || '',
      member_no: p.member_no || '',
      registration_id: p.registration_id || '',
      role: r.role || 'member',
      roles: Array.isArray(p.roles) ? p.roles : (r.role ? [r.role] : []),
      national_id: nin,
      national_id_missing: !nin,
      must_change: r.must_change === true,
      owner: ownerSet.has(String(email).toLowerCase())
    };
  }).filter(Boolean);
  sendJSON(res, list);
};

ROUTES['PUT /api/accounts'] = async (req, res, body) => {
  const actor = await currentUser(req);
  if (!actor) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  const ownerSet = await owners();
  if (!R.isManager(actor, ownerSet)) {
    return sendJSON(res, { error: 'تغيير الصلاحيات لرئيس النادي فقط' }, 403);
  }
  const uid = String(body.id || '');
  const role = String(body.role || '');
  const hasNIN = Object.prototype.hasOwnProperty.call(body, 'national_id');
  if (!uid) return sendJSON(res, { error: 'معرّف الحساب مطلوب' }, 400);
  if (!role && !hasNIN) {
    return sendJSON(res, { error: 'لا يوجد ما يُحفظ: الصلاحية أو رقم التعريف الوطني مطلوب.' }, 400);
  }
  if (role && R.ROLES.indexOf(role) === -1) {
    return sendJSON(res, { error: 'سلمي غير معروف: ' + role }, 400);
  }
  if (role && uid === actor.id) {
    return sendJSON(res, { error: 'لا يُغيّر صلاحتياتك بنفسك' }, 400);
  }
  const target = await D.one('select email, role from public.app_users where id=$1', [uid]);
  if (!target) return sendJSON(res, { error: 'لا يوجد حساب بهذا المعرّف.' }, 404);
  if (R.isOwner(target, ownerSet)) {
    return sendJSON(res, { error: 'حساب صاحب النادي لا تُغيَّر صلاحيته من هنا.' }, 403);
  }
  /* صلاحية مسير أو مدير لا يُنزلها ولا يرفعها إلا صاحب النادي: هذا هو الخطّ
     الذي يفصل المدير العام عن المسيرين. */
  if (!R.canManageAccount(actor, target, ownerSet)) {
    return sendJSON(res, { error: 'لا يغيّر صلاحية مسير أو مدير إلا صاحب النادي.' }, 403);
  }
  if (role === 'manager' && !R.isOwner(actor, ownerSet)) {
    return sendJSON(res, { error: 'تعيين المسيرين وعزلهم من صلاحيات صاحب النادي وحده.' }, 403);
  }

  /* رقم الولي يُكتب قبل الصلاحية أو بعدها، وفي الحالتين يُفحص تفرّده.
     فحسابان بالرقم نفسه يعنيان عائلة واحدة تُقرأ مرتين. */
  let ninOut = null;
  if (hasNIN) {
    ninOut = await setAccountNIN(uid, body.national_id, { by: actor.id });
    if (ninOut.error) return sendJSON(res, { error: ninOut.error }, ninOut.status);
  }
  let memberNoOut = null;
  if (role) {
    await D.run('update public.app_users set role=$1, updated_at=now() where id=$2', [role, uid]);
    /* المسؤول والمدرب لهما صيغة رقم مستقلة: R تراكمي لا يُصفَّر، وC موسمي. */
    if (['admin', 'president', 'manager', 'owner'].indexOf(role) !== -1) {
      memberNoOut = await assignOfficialNumber(uid);
    } else if (role === 'coach') {
      memberNoOut = await assignCoachNumber(uid);
    }
  }
  sendJSON(res, {
    ok: true, id: uid,
    role: role || target.role || '',
    national_id: ninOut ? ninOut.national_id : undefined,
    member_no: memberNoOut || undefined
  });
};


/* ==================== أدوات مشتركة منقولة من المحوّل ====================
   ما يلي منقول حرفًا بحرف من `firebase-adapter.js`: نفس الترتيب، ونفس
   الرسائل العربية، ونفس القيم الافتراضية. والسبب أنّ الصفحة لا تعرف أنّها
   تكلّم خادمًا آخر، فلا يجوز أن يختلف الردّان في حرف: عمود يُرتَّب هنا وهناك
   بترتيبين يعني قائمة تُقرأ على وجهين. */

/* الأرقام العربية-الهندية تُطوى إلى اللاتينية قبل أي قراءة أو كتابة. */
const FOLD_DIGIT = /[\u0660-\u0669]/g;
const FOLD_DIGIT_ALT = /[\u06F0-\u06F9]/g;
const latinDigits = v => String(v === undefined || v === null ? '' : v)
  .replace(FOLD_DIGIT, d => String(d.charCodeAt(0) - 0x0660))
  .replace(FOLD_DIGIT_ALT, d => String(d.charCodeAt(0) - 0x06F0));

/* ترتيب الصفوف: `order` الرقمي أولًا، وما لا رقم له يبقى في مكانه. */
const byOrder = (list) => list.slice().sort((a, b) => {
  const x = Number(a.order), y = Number(b.order);
  const ax = Number.isFinite(x), by = Number.isFinite(y);
  if (ax && by) return x - y;
  if (ax) return -1;
  if (by) return 1;
  return 0;
});

/* ترتيب الحصص: أيام الأسبوع كما يعدّها النادي، ثم الساعة. */
const DAY_ORDER = { 'الأحد': 1, 'الإثنين': 2, 'الثلاثاء': 3, 'الأربعاء': 4, 'الخميس': 5, 'السبت': 6 };
const byDay = (list) => list.slice().sort((a, b) => {
  const x = DAY_ORDER[a.day_name] || 99, y = DAY_ORDER[b.day_name] || 99;
  if (x !== y) return x - y;
  return String(a.time_range || '').localeCompare(String(b.time_range || ''));
});

/* اسم يُقارَن كما يكتبه إنسان: الفراغ والشرطة وحالة الأحرف لا تصنع شخصًا آخر. */
const normId = value => String(value === undefined || value === null ? '' : value)
  .normalize('NFKC')
  .replace(/[\s\u00A0\u202F\-_.]/g, '')
  .toUpperCase();

/* طابع زمني كان Firestore يعيده كائنًا بحقل `__timestamp`، وهنا قد يكون نصًّا
   ISO. يُقرأ الوجهان، وإلا رُتّبت المجموعات وكأنّها كلها بلا تاريخ. */
const tsOf = value => {
  if (!value) return 0;
  if (typeof value === 'object') {
    if (value.__timestamp) { const t = Date.parse(String(value.__timestamp)); return isNaN(t) ? 0 : t; }
    if (value._seconds) return Number(value._seconds) * 1000;
    return 0;
  }
  const t = Date.parse(String(value));
  return isNaN(t) ? 0 : t;
};

/* التاريخ المخزَّن واحد: سنة-شهر-يوم. وما لا يُقرأ لا يُخمَّن. */
const DAY_FIRST_DATE = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/;
const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
const readDate = raw => {
  const year = ISO_DATE.exec(raw);
  if (year) return { y: year[1], m: year[2], d: year[3] };
  const day = DAY_FIRST_DATE.exec(raw);
  if (!day) return null;
  if (Number(day[1]) > 31) return { y: day[3], m: day[2], d: day[1] };
  return { y: day[3], m: day[2], d: day[1] };
};
const isoDate = v => {
  const raw = latinDigits(v).trim();
  const m = readDate(raw);
  if (!m) return raw;
  const month = Number(m.m), day = Number(m.d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
  const p = n => String(n).length < 2 ? '0' + n : String(n);
  return m.y + '-' + p(m.m) + '-' + p(day);
};

/* الحقول التي تُطوى، مسمّاة لا مُخمَّنة: حقل اسمه `national_id` يحمل رقمًا،
   وحقل اسمه `national_id_label` قد لا يحمل. */
const DIGIT_FIELDS = new Set([
  'national_id', 'birth_certificate_no', 'membership_no', 'registration_id',
  'phone', 'whatsapp', 'guardian_phone', 'guardian_national_id'
]);
const DATE_FIELDS = new Set([
  'birth_date', 'guardian_birth_date', 'card_issue_date',
  'national_id_expiry', 'guardian_national_id_expiry', 'guardian_card_issued'
]);

/* رقم التعريف الوطني للولي (NIN): ثمانية عشر رقمًا، لا غير.
   ----------------------------------------------------------------------------
   يُقبل مكتوبًا بالأرقام اللاتينية أو العربية، وبمسافات أو شرطات أو نقاط --
   لأن الرقم نفسه قد يُقرأ من بطاقة أو يُقال في الهاتف. وما لا يكون ثمانية عشر
   رقمًا يُرجع نصًّا فارغًا، فيُعرف أنه غير مكتمل بدل أن يُخزَّن نصف رقم.

   والأرقام القديمة ذات التسعة أرقام لا تُحوَّل ولا تُرفض من الدخول: تبقى في
   `raw` كما هي، ويُطلب من صاحبها تحديثها. الخلط بين رقم قديم ورقم بيومتري هو
   ما يجعل عائلتين عائلة واحدة. */
const normalizeNIN = value => {
  const digits = latinDigits(String(value === undefined || value === null ? '' : value))
    .replace(/[^0-9]/g, '');
  return /^[0-9]{18}$/.test(digits) ? digits : '';
};
const isNinMissing = value => !normalizeNIN(value);

/* ==================== رقم الانخراط الموحّد (10 خانات) ====================
   [الصفة][سنة بداية الموسم][الفئة][الرقم التسلسلي]
     S = سباح، C = مدرب، R = مسؤول
     السنة: من سبتمبر إلى ديسمبر = السنة نفسها، ومن جانفي إلى أوت = السابقة
     الفئة: 1 أكابر، 2 أصاغر، 0 مسؤولون
   والمسؤولون وحدهم لا يُصفَّر تسلسلهم مع الموسم. */
function seasonStartYear(date) {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return new Date().getFullYear();
  return (d.getMonth() + 1) >= 9 ? d.getFullYear() : d.getFullYear() - 1;
}

/* `birth_date` يصل من pg كائن `Date` لا نصًّا. و`String(Date).slice(0,10)` يعطي
   «Fri May 01»، و`new Date('Fri May 01')` يفسّره سنة 2001 -- فيصير الطفل بالغًا
   ويُحذف اسم وليّه. فنقرأ التاريخ من مكوّناته المحلية، أو من نصّ ISO كامل. */
function dateOnly_(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function ageOnDate(birth, when) {
  const b = dateOnly_(birth);
  if (!b) return null;
  const w = when ? dateOnly_(when) : new Date();
  if (!w || isNaN(w.getTime())) return null;
  let age = w.getFullYear() - b.getFullYear();
  const m = w.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && w.getDate() < b.getDate())) age--;
  return age;
}

/* بيانات الولي الشخصية لا تُعرض لمن بلغ 18 سنة، لا في قائمة السباحين ولا في
   لوحة العائلة ولا في الطلبات. والسنّ هنا هو سنّ اليوم، لا سنّ بداية الموسم:
   من بلغ 18 في أكتوبر ليس قاصرًا حتى سبتمبر. ورقم وليّه يبقى لأنّه رقمه هو. */
const ADULT_GUARDIAN_FIELDS = [
  'guardian_first_name', 'guardian_last_name', 'guardian_relation',
  'guardian_phone', 'guardian_birth_date', 'guardian_card_issued'
];

function isAdultPerson(s) {
  const age = ageOnDate(s && s.birth_date);
  return age !== null && age >= 18;
}

function withoutGuardian(s) {
  if (!s || !isAdultPerson(s)) return s;
  const copy = Object.assign({}, s, { is_adult: true });
  ADULT_GUARDIAN_FIELDS.forEach(k => delete copy[k]);
  return copy;
}

function withoutGuardianApplication(a) {
  if (!a) return a;
  const adult = String(a.category || '').toLowerCase() === 'adult' || isAdultPerson(a);
  if (!adult) return a;
  const copy = Object.assign({}, a, { is_adult: true });
  ADULT_GUARDIAN_FIELDS.forEach(k => delete copy[k]);
  return copy;
}

function membershipCategory(birthDate, category, season) {
  if (String(category || '').toLowerCase() === 'adult') return '1';
  if (String(category || '').toLowerCase() === 'minor') return '2';
  const age = ageOnDate(birthDate, String(season) + '-09-01');
  return age !== null && age >= 18 ? '1' : '2';
}

function memberNo(prefix, season, category, serial) {
  return String(prefix) + String(season) + String(category)
    + String(serial).padStart(4, '0').slice(-4);
}

async function usedSerials(prefix, season, category) {
  const pattern = prefix + season + category + '%';
  const rows = await D.all(
    `select membership_no as no from sadara.swimmers where membership_no like $1
     union all
     select membership_no as no from sadara.applications where membership_no like $1
     union all
     select member_no as no from public.app_users where member_no like $1`, [pattern]);
  return rows.map(r => Number(String(r.no || '').slice(-4)) || 0)
    .filter(n => n > 0);
}

async function nextSwimmerNumber(birthDate, category, at) {
  const season = seasonStartYear(at);
  const cat = membershipCategory(birthDate, category, season);
  const used = await usedSerials('S', season, cat);
  return memberNo('S', season, cat, (Math.max(0, ...used) || 0) + 1);
}

async function nextCoachNumber(at) {
  const season = seasonStartYear(at);
  const used = await usedSerials('C', season, '1');
  return memberNo('C', season, '1', (Math.max(0, ...used) || 0) + 1);
}

async function nextOfficialNumber() {
  const season = seasonStartYear();
  const rows = await D.all(
    `select member_no as no from public.app_users where member_no like 'R%'
     union all
     select membership_no as no from sadara.applications where membership_no like 'R%'`);
  const used = rows.map(r => Number(String(r.no || '').slice(-4)) || 0).filter(n => n > 0);
  return memberNo('R', season, '0', (Math.max(0, ...used) || 0) + 1);
}

async function assignOfficialNumber(uid) {
  const row = await D.one('select member_no from public.app_users where id=$1', [uid]);
  if (row && /^R[0-9]{4}0[0-9]{4}$/.test(String(row.member_no || ''))) {
    return row.member_no;
  }
  const no = await nextOfficialNumber();
  await D.run('update public.app_users set member_no=$1, updated_at=now() where id=$2', [no, uid]);
  await D.run('update sadara.users set raw = raw || $2::jsonb where uid=$1',
    [uid, JSON.stringify({ member_no: no })]);
  return no;
}

async function assignCoachNumber(uid) {
  const row = await D.one('select member_no from public.app_users where id=$1', [uid]);
  if (row && /^C[0-9]{4}1[0-9]{4}$/.test(String(row.member_no || ''))) {
    return row.member_no;
  }
  const no = await nextCoachNumber();
  await D.run('update public.app_users set member_no=$1, updated_at=now() where id=$2', [no, uid]);
  await D.run('update sadara.users set raw = raw || $2::jsonb where uid=$1',
    [uid, JSON.stringify({ member_no: no })]);
  return no;
}

const poolName = value => String((value && value.name) || value || '').trim();

const normaliseIncoming = body => {
  if (!body || typeof body !== 'object') return body;
  const out = Object.assign({}, body);
  for (const key of Object.keys(out)) {
    if (typeof out[key] !== 'string') continue;
    if (DATE_FIELDS.has(key)) out[key] = isoDate(out[key]);
    else if (DIGIT_FIELDS.has(key)) out[key] = latinDigits(out[key]);
  }
  if ('selected_pool' in out) out.selected_pool = poolName(out.selected_pool);
  return out;
};

/* القيم الافتراضية كما بُنيت في الصفحة: لا تُخترع، بل تُنقل. */
const SUBSCRIPTION_DEFAULT = 600;
const DEFAULT_PLANS = [
  { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
  { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' },
  { code: 'agreement', name: 'ضمن اتفاقية معتمدة', amount: 3000, duration: 'موسم' }
];
const DEFAULT_REQUIREMENTS = [
  { id: 'identity', label: 'نسخة بطاقة التعريف الوطنية', required: true, order: 1 },
  { id: 'cv', label: 'السيرة الذاتية والشهادات التدريبية', required: true, order: 2 },
  { id: 'medical', label: 'شهادة طبية تثبت القدرة على التدريب', required: true, order: 3 },
  { id: 'criminal-record', label: 'صحيفة السوابق العدلية', required: false, order: 4 }
];
const DEFAULT_FACILITIES = [
  { id: 'olympic', name: 'المسبح الأولمبي', order: 1 },
  { id: 'half', name: 'المسبح النصف أولمبي', order: 2 },
  { id: 'stadium', name: 'الملعب البلدي', order: 3 },
  { id: 'forest', name: 'غابة غرداية', order: 4 }
];

/* ---------------- الرسوم: قراءة واحدة للجميع ----------------
   سؤال «بكم هذا؟» يُجاب في مكان واحد، فلا تختلف الاستمارة عن الوصل. */
const feeCategory = d => String((d && d.category) || 'adult').toLowerCase() === 'minor' ? 'minor' : 'adult';
const feePool = d => String((d && (d.facility_id || d.facility)) || '').trim();
const feeFor = (extras, d, key) => {
  const base = Number(extras && extras[key]) || (key === 'transport' ? 900 : 2500);
  const m = (extras && extras.matrix) || {};
  const cat = feeCategory(d);
  const pool = feePool(d);
  const rows = [pool && m[pool], m['*'], m.defaults && m.defaults[cat]];
  for (const row of rows) {
    if (!row) continue;
    const cell = row[cat] && row[cat][key];
    if (cell === undefined || cell === null) continue;
    if (typeof cell === 'object') {
      return { offered: cell.available !== false, amount: Number(cell.amount) || 0 };
    }
    return { offered: true, amount: Number(cell) || 0 };
  }
  return { offered: true, amount: base };
};
const extrasFor = (extras, d) => ({
  transport: feeFor(extras, d, 'transport').amount,
  uniform: feeFor(extras, d, 'uniform').amount
});
const offeredFor = (extras, d) => ({
  transport: feeFor(extras, d, 'transport').offered,
  uniform: feeFor(extras, d, 'uniform').offered
});
const subscriptionDefault = extras => Number(extras && extras.subscription_default) || SUBSCRIPTION_DEFAULT;

/* ---------------- من سجّل الحضور ----------------
   الاسم والصفة يُكتبان في الصفّ وقت الكتابة، لأن سؤال «من مسح هذا؟» سؤال عن
   لحظة مضت: حساب يُقرأ لاحقًا يغيّر صلاحيته أو يُحذف، فيُنسب السجل إلى من لم
   يمسح شيئًا. */
const SCANNER_ROLES = ['admin', 'president', 'manager', 'coach'];
const attendanceRecorder = profile => ({
  uid: profile.id || '',
  name: profile.name || 'عضو النادي',
  role: profile.role || '',
  title: profile.role === 'coach' ? 'مدرب' : 'مسير'
});

/* أسبوع إلى الوراء ولا أبعد: ورقة نُسيت أسبوعًا تُملأ متأخّرةً، وما قبلها
   خطأ آخر أو موسم آخر. ومهما طُلب، اليوم المرفوض يُردّ باسمه. */
const ATTENDANCE_BACK_DAYS = 7;
const attendanceSession = value => {
  const raw = latinDigits(String(value === undefined || value === null ? '' : value)).trim().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return { day: today, error: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { day: today, error: 'تاريخ الحصة غير مفهوم.' };
  if (raw > today) return { day: today, error: 'لا تُسجَّل حضور حصة لم تبدأ بعد.' };
  const earliest = new Date(Date.now() - ATTENDANCE_BACK_DAYS * 86400000).toISOString().slice(0, 10);
  if (raw < earliest) return { day: today, error: 'لا تُسجَّل حضور حصة أقدم من أسبوع.' };
  return { day: raw, error: '' };
};

/* ---------------- بوّابتان كما في المحوّل ----------------
   `managerView` و`scannerView` هناك، وهنا: نفس الحالة، ونفس الجملة العربية
   التي يقرؤها المستخدم. والمدير يعلو دوره على دور الحساب -- المالك بعنوانه. */
async function managerGate(req, message) {
  const user = await currentUser(req);
  if (!user) return { error: 'يرجى تسجيل الدخول', status: 401 };
  if (!R.isManager(user, await owners())) return { error: message, status: 403 };
  return { user };
}
async function scannerGate(req, message) {
  const user = await currentUser(req);
  if (!user) return { error: 'يرجى تسجيل الدخول', status: 401 };
  if (!R.isScanner(user, await owners())) {
    return { error: message || 'تسجيل الحضور بالمسح خاص بالمسيرين والمدربين فقط.', status: 403 };
  }
  return { user };
}

/* ---------------- قراءة صفٍّ كتابعٍ ----------------
   `D.doc` يفكّ `raw` ثم تُطبع الأعمدة فوقه. وهذا يعمل في القراءة، ولكنه
   يعني في الكتابة شيئًا واحدًا: عمود مطبوع لا يُحدَّث يبقى يعلو على `raw`
   الجديد، فيرى القارئ القيمة القديمة. فالكتابة هنا تكتب الاثنين معًا. */
async function readRaw(table, where, params) {
  const row = await D.one('select raw from sadara.' + table + ' where ' + where, params);
  return (row && row.raw) || null;
}

/* كتابة مستندٍ واحد بدمج: نفس معنى `set(..., {merge:true})` في المحوّل. */
async function mergeRaw(table, firestorePath, raw) {
  await D.run(`insert into sadara.${table} (firestore_path, raw) values ($1, $2)
      on conflict (firestore_path) do update set raw = sadara.${table}.raw || excluded.raw`,
    [firestorePath, JSON.stringify(raw)]);
}

/* كتابة مستندٍ واحد بمحو القديم: نفس معنى `set(...)` بلا merge. */
async function replaceRaw(table, firestorePath, raw) {
  await D.run(`insert into sadara.${table} (firestore_path, raw) values ($1, $2)
      on conflict (firestore_path) do update set raw = excluded.raw`,
    [firestorePath, JSON.stringify(raw)]);
}

/* معرّف مولَّد كما كان `db.collection(...).add` يولّده. */
const newId = () => crypto.randomBytes(8).toString('hex').toUpperCase();

/* وحدة عمل واحدة: ما ينجح كله أو لا شيء منه. تُستعمل حيث تُستبدل إعدادات
   كاملة (خطط، مسابح، وثائق) فلا يُرى النادي نصف قائمة. */
async function withTx(fn) {
  const client = await D.db().connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch (_) { /* الردّ نفسه يكفي */ }
    throw e;
  } finally {
    client.release();
  }
}


/* ============================ الاشتراكات والرسوم ============================
   ثلاث قراءات عامّة (الأسعار والمسابح والرسوم) لأن الاستمارة العامة تُملأ
   قبل الدخول، وسعرٌ ليس سرًّا. والكتابة للمدير وحده. */

ROUTES['GET /api/subscriptions'] = async (req, res) => {
  const rows = await D.all('select * from sadara.subscription_plans');
  const plans = byOrder(rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(p => p.active !== false));
  /* مجموعة فارغة تُسقط إلى الخطط المبنية في الصفحة، فلا تبقى الاستمارة بلا سعر. */
  sendJSON(res, plans.length ? plans : DEFAULT_PLANS);
};

/* الأسعار كما تُعرض: الخطط، وخدمة النقل والبدلة لهذا الصنف وهذا المسبح،
   وما هو معروض أصلًا، والاشتراك الافتراضي، والمسابح. */
ROUTES['GET /api/subscription-plans'] = async (req, res, body, url) => {
  const planRows = await D.all('select * from sadara.subscription_plans');
  const extras = (await readRaw('fee_settings', "firestore_path='fee_settings/extras'", [])) || {};
  const poolRows = await D.all('select * from sadara.facilities');
  const who = {
    category: url.searchParams.get('category') || 'adult',
    facility: url.searchParams.get('facility') || ''
  };
  const plans = planRows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
  const pools = poolRows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
  sendJSON(res, {
    plans: plans.length ? byOrder(plans)
      : DEFAULT_PLANS.map((p, i) => Object.assign({}, p, { id: p.code, active: true, order: i + 1 })),
    extras: extrasFor(extras, who),
    offered: offeredFor(extras, who),
    subscription_default: subscriptionDefault(extras),
    pools: pools.length ? byOrder(pools).map(x => ({ id: x.id, name: x.name })) : []
  });
};

ROUTES['GET /api/fees'] = async (req, res) => {
  const extras = (await readRaw('fee_settings', "firestore_path='fee_settings/extras'", [])) || {};
  const poolRows = await D.all('select * from sadara.facilities');
  sendJSON(res, {
    transport: Number(extras.transport) || 900,
    uniform: Number(extras.uniform) || 2500,
    subscription_default: subscriptionDefault(extras),
    matrix: extras.matrix || {},
    pools: poolRows.map(r => ({ id: D.idOf(r.firestore_path), name: (D.doc(r) || {}).name }))
  });
};

/* الرسوم تُكتب كوثيقة كاملة (merge) لا بنصّ مدمج: حذف صفّ مسبح يجب أن يحذفه. */
ROUTES['PUT /api/fees'] = async (req, res, body) => {
  const gate = await managerGate(req, 'تعديل الرسوم لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const extras = {
    transport: Number(body.transport) || 0,
    uniform: Number(body.uniform) || 0,
    subscription_default: Number(body.subscription_default) || SUBSCRIPTION_DEFAULT,
    matrix: (body.matrix && typeof body.matrix === 'object') ? body.matrix : {},
    updated_by: gate.user.id,
    updated_at: new Date().toISOString().slice(0, 10)
  };
  await mergeRaw('fee_settings', 'fee_settings/extras', extras);
  sendJSON(res, { ok: true, extras });
};

/* استبدال كل الخطط: الحذف داخل معاملة، وهو آمن هنا وحده -- انظر تعليق
   `PUT /api/facilities` أدناه. */
ROUTES['PUT /api/subscription-plans'] = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const plans = Array.isArray(body.plans) ? body.plans.filter(p => p && p.code) : [];
  const extras = body.extras || {};
  await withTx(async client => {
    await client.query('delete from sadara.subscription_plans');
    for (let index = 0; index < plans.length; index++) {
      const item = plans[index];
      await client.query('insert into sadara.subscription_plans (firestore_path, raw) values ($1, $2)',
        ['subscription_plans/' + (item.id || item.code), JSON.stringify({
          code: item.code, name: item.name || item.code, amount: Number(item.amount) || 0,
          duration: item.duration || 'موسم', active: item.active !== false, order: index + 1
        })]);
    }
    /* كما في المحوّل: كتابة كاملة بلا merge، فتُمحى المصفوفة والافتراضي. */
    await client.query(`insert into sadara.fee_settings (firestore_path, raw) values ($1, $2)
        on conflict (firestore_path) do update set raw = excluded.raw`,
      ['fee_settings/extras', JSON.stringify({
        transport: Number(extras.transport) || 0, uniform: Number(extras.uniform) || 0,
        updated_by: gate.user.id
      })]);
  });
  sendJSON(res, { ok: true });
};

/* ============================== المسابح ============================== */

ROUTES['GET /api/facilities'] = async (req, res) => {
  const rows = await D.all('select * from sadara.facilities');
  const list = byOrder(rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(f => f.active !== false));
  sendJSON(res, list.length ? list.map((f, i) => ({ id: f.id, name: f.name, order: i + 1 })) : DEFAULT_FACILITIES);
};

/* استبدال قائمة المسابح.
   الحذف المسبق هنا **آمن، وهنا وحده**: `sadara.facilities` جدول إعدادات، لا
   سجلّ أطفال -- لا صورة ولا هوية ولا اسم سباح فيه. والمحوّل نفسه كان يحذف كل
   المستندات ثم يعيد كتابتها، فالحذف المطابق هو الذي يُبقي القائمتين متطابقتين.
   ولا يُعمَّم هذا على `swimmers` أو `applications`: الحذف هناك محظور دائمًا. */
ROUTES['PUT /api/facilities'] = async (req, res, body) => {
  const gate = await managerGate(req, 'تعديل أسماء المسابح للرئيس أو المدير فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const items = Array.isArray(body.facilities) ? body.facilities.filter(f => f && String(f.name || '').trim()) : [];
  if (!items.length) return sendJSON(res, { error: 'أبقِ مسبحًا واحدًا على الأقل في القائمة.' }, 400);
  await withTx(async client => {
    await client.query('delete from sadara.facilities');
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const id = String(item.id || 'fac-' + index).replace(/[^\w-]/g, '_');
      await client.query('insert into sadara.facilities (firestore_path, raw) values ($1, $2)',
        ['facilities/' + id, JSON.stringify({
          name: String(item.name).trim().slice(0, 120), order: index + 1, active: true
        })]);
    }
  });
  sendJSON(res, { ok: true, count: items.length });
};


/* ============================== الأفواج ==============================
   `config/groups` هو المصدر الحاكم الواحد للأفواج، وليس عرضًا للقراءة.

   ولماذا كان هذا القسم يحتاج إعادة كتابة
   ---------------------------------------
   القائمة كانت تُكتب وتُقرأ، ولا شيء يربطها بالسباحين. فتغيير اسم فوج في
   صفحة الأفواج لا يمسّ `group_name` على الطفل، ويبقى الطفل في فوج اسمه لم
   يعد موجودًا. وهذا هو الخلل نفسه الذي عاد مرّتين: الفوج الرسمي يقول
   «المبتدئون» والسباح يحمل «مبتدئ»، فيُفتح الفوج على ثلاثة أطفال و54 مفقودًا.

   وهذا القسم يجعله مستحيلًا: كل حفظ يُطبّق على السباحين في **معاملة واحدة**،
   فإما أن تتغيّر القائمة والسباحون معًا، أو لا يتغيّر شيء.

   وما يفعله الحفظ، بالترتيب:
     ١. يتحقّق من كل فوج: اسم غير مكرّر، وفئة معروفة، أيام وتوقيت صالحان،
        وسعة موجبة. ويجمع تحذيرات (تعارض مسبح، تجاوز سعة) ولا يمنع بها.
     ٢. يشتقّ لكل اسم قديم على السباحين مقابلَه الجديد **بالمعنى**، فلا يبقى
        سباح على صيغة لم تعد في القائمة.
     ٣. يكتب `group_name` و`group_id` على كل سباح تغيّر فوجه.
     ٤. من كان في فوج حُذف يُنقل إلى «غير مفرز» — ولا يُحذف سباح أبدًا.

   والفوج «غير مفرز» فوجٌ نظاميّ: له معرّف ثابت، ولا يُحذف، ويُضاف إلى أي
   قائمة يقرأها النادي حتى تظهر قائمة انتظار التوزيع.
*/
const UNASSIGNED = { id: 'grp-unassigned', name: 'غير مفرز' };

/* فئات التفويج: مفتاح إنجليزي ثابت للخادم، وتسمية عربية للعرض.
   المفتاح ثابت لأن التسمية العربية قد تُصقل لاحقًا؛ ولو كان المفتاح عربيًّا
   لتغيّرت البيانات بمجرّد تحسين كلمة. */
const GROUP_CATEGORIES = {
  minnows: 'الأصاغر والبراعم',
  juniors: 'الصغار',
  adults: 'الأكابر',
  women: 'الفئة النسوية',
  elite: 'فرق النخبة والمنافسة',
  fitness: 'اللياقة وتحسين الأداء'
};

const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/* الفوج كما يراه النادي: كل حقول الحفظ، بمصادر موثوقة. */
function normalizeGroup(item, index) {
  const name = String((item && item.name) || '').trim().slice(0, 80);
  if (!name) return null;
  const category = String((item && item.category) || '').trim();
  const days = Array.isArray(item && item.days)
    ? item.days.map(d => String(d).trim()).filter(d => WEEKDAYS.includes(d))
    : String((item && item.days) || '').split(/[،,]/).map(d => d.trim()).filter(d => WEEKDAYS.includes(d));
  const hhmm = v => (/^\d{1,2}:\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : '');
  const capacity = Number(item && item.capacity);
  return {
    id: String((item && item.id) || '').replace(/[^\w-]/g, '_') || ('grp-' + (index + 1)),
    name: name,
    category: Object.prototype.hasOwnProperty.call(GROUP_CATEGORIES, category) ? category : '',
    days: [...new Set(days)],
    start: hhmm(item && item.start),
    end: hhmm(item && item.end),
    capacity: Number.isFinite(capacity) && capacity > 0 ? Math.min(500, Math.round(capacity)) : 0,
    coach: String((item && item.coach) || '').trim().slice(0, 120),
    /* مساعد واحد على الأقل يُقبل مفردًا، والقائمة تُنظَّف من الفراغ والتكرار. */
    assistants: [...new Set(
      (Array.isArray(item && item.assistants)
        ? item.assistants
        : String((item && item.assistants) || '').split(/[،,]/))
        .map(a => String(a).trim()).filter(Boolean))
    ].slice(0, 8),
    pool: String((item && item.pool) || '').trim().slice(0, 120),
    notes: String((item && item.notes) || '').trim().slice(0, 300)
  };
}

/* جذر الاسم: بلا «ال» التعريف وبلا واو/ياء الجمع. هو أساس المقارنة بالمعنى. */
const nameRoot = s => String(s || '').replace(/^ال/, '').replace(/(ون|ين)$/, '').trim();

/* أي فوج يحمله سباح اليوم، وما فوجه في القائمة الجديدة؟
   ----------------------------------------------------------------------------
   المطابقة بالمعرّف أولًا، ثم بالاسم، ثم بالجذر. والترتيب ليس تفصيلًا:

   المعرّف هو الرابط الحقيقي بين السباح وفوجه. ولو طابقنا بالاسم وحده، لكانت
   إعادة تسمية فوج («فوج 1» → «أكابر - تدريب متقدم»: مطلب صريح في الخطة)
   تُفقد كل أعضائه دفعة واحدة، لأن الاسمين لا يتشابهان في حرف -- وقد حدث هذا
   فعلًا في الاختبار، فنُقل 57 سباحًا إلى «غير مفرز» وهم في فوجهم.

   فيُقرأ المعرّف أولًا: من كان في `grp-1` وبقي `grp-1` في القائمة، فوجه لم
   يتغيّر وإن تغيّر اسمه. والاسم والجذر يخدمان البيانات القديمة التي بلا معرّف
   -- وهي حال السباحين المستوردين قبل أن يُكتب `group_id`.

   ومن لا يجد له فوجًا بكل هذه الطرق فوجه حُذف: يُنقل إلى «غير مفرز»، ولا
   يُخترع له فوج ولا يُترك في اسم لم يعد في القائمة. */
function rehome(swimmer, byId, byName, byRoot, keepUnassigned) {
  const id = String(swimmer.group_id || '').trim();
  if (id && byId.has(id)) return byId.get(id);

  const n = String(swimmer.group_name || '').trim();
  if (!n) return keepUnassigned ? UNASSIGNED : null;
  if (byName.has(n)) return byName.get(n);

  const root = nameRoot(n);
  if (root && byRoot.has(root)) return byRoot.get(root);

  return keepUnassigned ? UNASSIGNED : null;
}

ROUTES['GET /api/groups'] = async (req, res) => {
  const user = await currentUser(req);
  if (!user) return sendJSON(res, { error: 'يرجى تسجيل الدخول' }, 401);
  try {
    const data = (await readRaw('config', "firestore_path='config/groups'", [])) || {};
    const stored = Array.isArray(data.groups) ? data.groups : null;
    /* عدد المنتمين لكل فوج يُحسب من السباحين، لا يُخزَّن في القائمة: عددٌ
       مخزَّن يتقادم بأول تعديل لم يُحفظ من هنا. */
    const counted = await D.all("select group_id, count(*)::int as n from sadara.swimmers group by group_id");
    const byId = {};
    counted.forEach(r => { byId[String(r.group_id || '')] = r.n; });
    /* و«غير مفرز» يظهر دائمًا: القائمة العامة يجب أن تُظهر من ينتظر التوزيع،
       وإلا صار الانتظار خفيًّا. */
    const list = stored ? stored.map(g => Object.assign({}, g, { members: byId[g.id] || 0 })) : null;
    let unassigned = byId[UNASSIGNED.id] || 0;
    sendJSON(res, {
      groups: list,
      categories: GROUP_CATEGORIES,
      weekdays: WEEKDAYS,
      unassigned: { id: UNASSIGNED.id, name: UNASSIGNED.name, members: unassigned },
      readable: true
    });
  } catch (e) {
    sendJSON(res, {
      groups: null, readable: false,
      error: (e && e.message) || 'تعذّر قراءة قائمة الأفواج.'
    });
  }
};

ROUTES['PUT /api/groups'] = async (req, res, body) => {
  const gate = await managerGate(req, 'تعديل الأفواج للمدير أو رئيس النادي فقط.');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const raw = Array.isArray(body.groups) ? body.groups : [];
  const seen = {};
  const list = [];
  const warnings = [];
  for (const item of raw) {
    const g = normalizeGroup(item, list.length);
    if (!g) continue;
    /* فوج واحد لكل اسم: بطاقتان باسم واحد عدّان لفوج واحد. يُردّ ولا يُدمج
       صامتًا، حتى يكون على الصفحة ما تُبلّغه. */
    if (seen[g.name]) {
      return sendJSON(res, { error: 'اسم الفوج "' + g.name + '" مكرّر. لكل فوج اسم واحد.' }, 400);
    }
    if (g.id === UNASSIGNED.id || g.name === UNASSIGNED.name) {
      return sendJSON(res, { error: '«غير مفرز» اسم نظاميّ محجوز: لا يُعرَّف فوجًا ولا يُحذف.' }, 400);
    }
    seen[g.name] = true;
    list.push(g);
  }

  /* التحذيرات بعد اكتمال القائمة: تعارض الحوض والمدرب والسعة. تحذير لا منع:
     النادي يعرف مسبحه، والمنصة ليست وصيًّا عليه. */
  const overlapping = (a, b) => a.start && a.end && b.start && b.end
    && a.days.some(d => b.days.includes(d)) && a.start < b.end && b.start < a.end;
  const counted = await D.all("select group_id, count(*)::int as n from sadara.swimmers group by group_id");
  const byId = {};
  counted.forEach(r => { byId[String(r.group_id || '')] = r.n; });
  for (const g of list) {
    const members = byId[g.id] || 0;
    if (g.capacity && members > g.capacity) {
      warnings.push('«' + g.name + '» يحمل ' + members + ' منخرطًا وسعته ' + g.capacity + '.');
    }
    for (const other of list) {
      if (other === g) continue;
      if (g.coach && other.coach && g.coach === other.coach && overlapping(g, other)) {
        warnings.push('المدرب ' + g.coach + ' في «' + g.name + '» و«' + other.name + '» في وقت متقاطع.');
      }
      if (g.pool && other.pool && g.pool === other.pool && g.name < other.name && overlapping(g, other)) {
        warnings.push('«' + g.pool + '» محجوز لـ«' + g.name + '» و«' + other.name + '» في وقت متقاطع.');
      }
    }
  }

  /* ---- التطبيق: القائمة والسباحون في معاملة واحدة ---- */
  const result = await withTx(async client => {
    await client.query(
      `insert into sadara.config (firestore_path, raw) values ('config/groups', $1::jsonb)
         on conflict (firestore_path) do update set raw = excluded.raw`,
      [JSON.stringify({
        groups: list, updated_by: gate.user.id, updated_at: new Date().toISOString()
      })]);

    /* خريطة المعرّف والاسم والجذر من القائمة الجديدة.
       والاسم المكرّر جذريًّا لا يبتلع الآخر: الأول يفوز، والباقي يُطابَق
       بالحرف أو بالمعرّف. */
    const byId = new Map(list.map(g => [g.id, g]));
    const byName = new Map(list.map(g => [g.name, g]));
    const byRoot = new Map();
    for (const g of list) {
      const r = nameRoot(g.name);
      if (r && !byRoot.has(r)) byRoot.set(r, g);
    }

    /* وكل سباح: فوجه الجديد، أو «غير مفرز» إن حُذف فوجه.
       والتحديث يقع أيضًا إن تغيّر **الاسم** وإن بقي المعرّف: هذا ما يجعل
       إعادة تسمية الفوج تصل إلى بطاقة الطفل فورًا (مطلب «تحديث بطاقات جميع
       المنخرطين فورًا بالبيانات الجديدة»). */
    const swimmers = (await client.query(
      'select firestore_path, group_name, group_id from sadara.swimmers')).rows;
    let moved = 0;
    let parked = 0;
    for (const s of swimmers) {
      const target = rehome(s, byId, byName, byRoot, true);
      if (!target) continue;
      const sameName = String(s.group_name || '').trim() === target.name;
      const sameId = String(s.group_id || '').trim() === target.id;
      if (sameName && sameId) continue;
      if (target.id === UNASSIGNED.id) parked++;
      await client.query(
        `update sadara.swimmers
            set group_name = $1, group_id = $2,
                raw = jsonb_set(jsonb_set(raw, '{group_name}', to_jsonb($1::text), true),
                                '{group_id}', to_jsonb($2::text), true),
                updated_at = now()
          where firestore_path = $3`,
        [target.name, target.id, s.firestore_path]);
      moved++;
    }

    await client.query(
      `insert into sadara.audit_logs (firestore_path, raw) values ($1, $2::jsonb)
         on conflict (firestore_path) do update set raw = excluded.raw`,
      ['audit_logs/' + newId(), JSON.stringify({
        action: 'groups_saved', entity_type: 'config', entity_id: 'groups',
        details: { count: list.length, moved: moved, parked: parked },
        actor: gate.user.id, created_at: new Date().toISOString()
      })]);

    return { moved, parked };
  });

  sendJSON(res, {
    ok: true, groups: list, warnings: warnings,
    updated_swimmers: result.moved, parked: result.parked
  });
};

/* ============================ سجلّ التدقيق ============================ */
ROUTES['POST /api/audit'] = async (req, res, body) => {
  const gate = await managerGate(req, 'سجل التدقيق للرئيسية فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  await mergeRaw('audit_logs', 'audit_logs/' + newId(), {
    action: String(body.action || '').slice(0, 120),
    entity_type: String(body.entity_type || '').slice(0, 40),
    entity_id: String(body.entity_id || '').slice(0, 60),
    details: body.details && typeof body.details === 'object' ? body.details : {},
    actor: gate.user.id,
    created_at: new Date().toISOString()
  });
  sendJSON(res, { ok: true }, 201);
};

/* ========================= وثائق المدربين المطلوبة =========================
   قراءة عامّة: الاستمارة تعرضها قبل الدخول. والكتابة استبدال كامل. */
ROUTES['GET /api/coach-requirements'] = async (req, res) => {
  const rows = await D.all('select * from sadara.coach_requirements');
  const saved = rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
  sendJSON(res, saved.length ? saved.sort((a, b) => (a.order || 0) - (b.order || 0)) : DEFAULT_REQUIREMENTS);
};

/* استبدال قائمة الوثائق. الحذف المسبق آمن هنا وحده: جدول إعدادات لا يحمل
   سجلّ أحد -- انظر تعليق `PUT /api/facilities`. */
const coachRequirementsWrite = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const requirements = Array.isArray(body.requirements) ? body.requirements : [];
  await withTx(async client => {
    await client.query('delete from sadara.coach_requirements');
    let index = 0;
    for (const item of requirements.filter(x => x && x.label)) {
      const id = String(item.id || ('req-' + Date.now() + '-' + index));
      await client.query('insert into sadara.coach_requirements (firestore_path, raw) values ($1, $2)',
        ['coach_requirements/' + id, JSON.stringify({
          label: item.label, required: item.required !== false, order: index + 1
        })]);
      index++;
    }
  });
  sendJSON(res, { ok: true });
};
ROUTES['POST /api/coach-requirements'] = coachRequirementsWrite;
ROUTES['PUT /api/coach-requirements'] = coachRequirementsWrite;


/* ============================== السباحون ==============================
   الكتابة للمدير وحده. ولا يُحذف صفّ سباح أبدًا: الحذف المطلوب من الصفحة
   يُوسم ولا يُمحى -- انظر تعليق `swimmers.delete` في آخر هذا القسم. */

/* الأعمدة المطبوعة على الجدول، فلا تُكتب بلا عمود. */
const SWIMMER_COLUMNS = new Set([
  'membership_no', 'registration_id', 'name', 'first_name_ar', 'last_name_ar',
  'birth_date', 'gender', 'blood_group', 'level', 'phone', 'whatsapp', 'national_id',
  'guardian_national_id', 'guardian_account_uid',
  'guardian_first_name', 'guardian_last_name', 'guardian_phone',
  'facility', 'group_name', 'group_id', 'address', 'email', 'photo', 'status', 'active',
  'from_application', 'applicant_uid',
  'updated_at', 'created_at'
]);
/* أعمدة الطلب التي يحملها الولي، تُحدَّث حين يُعدَّل الولي من بطاقة السباح. */
const APPLICATION_GUARDIAN_COLUMNS = new Set([
  'guardian_first_name', 'guardian_last_name', 'guardian_phone',
  'guardian_national_id', 'guardian_birth_date', 'guardian_card_issued', 'updated_at'
]);

/* تحديث الأعمدة المطبوعة إلى جانب `raw`، فلا يعلو القديم على الجديد عند
   القراءة. أسماء الأعمدة حرفية في الشيفرة، والقيم معاملات -- لا نصّ يُبنى. */
async function writeTyped(table, firestorePath, cols, allowed) {
  const names = Object.keys(cols).filter(k => allowed.has(k) && cols[k] !== undefined);
  if (!names.length) return;
  const sets = names.map((k, i) => k + ' = $' + (i + 2));
  await D.run('update sadara.' + table + ' set ' + sets.join(', ') + ' where firestore_path = $1',
    [firestorePath].concat(names.map(k => cols[k])));
}

ROUTES['POST /api/swimmers'] = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  body = normaliseIncoming(body);
  const id = newId();
  /* رقم الانخراط يُولَّد هنا لا في الصفحة: الصيغة الموحّدة (10 خانات) تُحسب
     من الموسم والفئة، والتسلسل يُقرأ من القاعدة فلا يتكرر بين جهازين. */
  const membership = /^S[0-9]{4}[12][0-9]{4}$/.test(String(body.membership_no || ''))
    ? String(body.membership_no)
    : await nextSwimmerNumber(body.birth_date, body.category);
  const adultAge = ageOnDate(body.birth_date);
  const adult = adultAge !== null && adultAge >= 18;
  const record = {
    membership_no: membership,
    name: body.name || '', group_name: body.group_name || 'غير مفرز',
    group_id: body.group_id || '',
    phone: body.phone || '', status: body.status === 'نشط' ? 'active' : (body.status || 'active'),
    national_id: normalizeNIN(body.national_id),
    guardian_national_id: adult ? normalizeNIN(body.national_id) : normalizeNIN(body.guardian_national_id),
    birth_date: body.birth_date || ''
  };
  await mergeRaw('swimmers', 'swimmers/' + id, record);
  await writeTyped('swimmers', 'swimmers/' + id, {
    membership_no: record.membership_no, name: record.name, group_name: record.group_name,
    group_id: record.group_id, phone: record.phone, status: record.status,
    national_id: record.national_id, guardian_national_id: record.guardian_national_id,
    birth_date: record.birth_date || null,
    updated_at: new Date().toISOString()
  }, SWIMMER_COLUMNS);
  sendJSON(res, { ok: true, id: id, membership_no: membership }, 201);
};

ROUTES['PUT /api/swimmers'] = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  if (!body.id) return sendJSON(res, { error: 'معرّف السباح مطلوب' }, 400);
  body = normaliseIncoming(body);

  /* رقم تعريف الولي: لا يُكتب نصف رقم. والفراغ مسموح لأنه يعني «ملف غير
     مكتمل»، لا «رقم مجهول». والرقم نفسه يُقبل بمسافات أو شرطات كما يُقرأ من
     البطاقة، ويُخزَّن ثمانية عشر رقمًا. */
  const GUARDIAN_KEYS = {
    guardian_first_name: 'guardian_first_name',
    guardian_last_name: 'guardian_last_name',
    guardian_relation: 'guardian_relation',
    guardian_phone: 'guardian_phone',
    guardian_national_id: 'guardian_national_id',
    guardian_birth_date: 'guardian_birth_date',
    guardian_card_issued: 'guardian_card_issued'
  };
  const guardianWrite = {};
  for (const [key, field] of Object.entries(GUARDIAN_KEYS)) {
    if (!(key in body)) continue;
    const raw = body[key] === null || body[key] === undefined ? '' : String(body[key]).trim();
    if (key === 'guardian_national_id') {
      if (raw && !normalizeNIN(raw)) {
        return sendJSON(res, {
          error: 'رقم التعريف الوطني للولي يجب أن يكون 18 رقمًا بالضبط.'
        }, 400);
      }
      guardianWrite[field] = normalizeNIN(raw);
    } else {
      guardianWrite[field] = raw;
    }
  }

  /* ما للمدير أن يغيّره في عضو، ولا شيء غيره. وتُكتب المفاتيح المُرسَلة فقط:
     استمارة تُغيّر رقم هاتف يجب ألّا تمحو الاسم. */
  const EDITABLE = {
    name: 'name', first_name_ar: 'first_name_ar', last_name_ar: 'last_name_ar',
    birth_date: 'birth_date', gender: 'gender', blood_group: 'blood_group',
    level: 'level', facility: 'facility', group_name: 'group_name', group_id: 'group_id',
    phone: 'phone', whatsapp: 'whatsapp', national_id: 'national_id',
    address: 'address', email: 'email', photo: 'photo'
  };
  const write = {};
  for (const [key, field] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    if (key === 'status') continue;
    write[field] = String(body[key] === null || body[key] === undefined ? '' : body[key]).trim();
  }
  if ('status' in body) {
    write.status = body.status === 'موقوف' || body.status === 'suspended'
      ? 'suspended'
      : (body.status === 'active' || body.status === 'نشط' ? 'active' : String(body.status || 'active'));
  }
  /* السباح نفسه يحمل مرجع وليّه، ولو لم يكن مولودًا من طلب: هذا ما يجعل
     لوحة العائلة تعمل للبيانات القديمة بعد أن يُدخل المسير الرقم من البطاقة. */
  Object.assign(write, guardianWrite);
  /* صورة أكبر من حدّها تُردّ باسمها لا تُسقط صامتة: صورة لا تُحفظ سرًّا هي
     الصورة التي قيل للأهل إنها حُفظت. */
  if ('photo' in write) {
    if (write.photo && write.photo !== '' && !/^(data:image\/(jpeg|png|webp);base64,|https?:)/.test(write.photo)) {
      return sendJSON(res, { error: 'الصورة يجب أن تكون صورة فعلًا (JPG أو PNG أو WebP).' }, 400);
    }
    if (write.photo && write.photo.length > 5 * 1024 * 1024) {
      return sendJSON(res, { error: 'الصورة كبيرة جدًا. الحد الأقصى 3 ميغابايت.' }, 400);
    }
  }
  if (!Object.keys(write).length) return sendJSON(res, { error: 'لا يوجد ما يُحفظ.' }, 400);

  const path = 'swimmers/' + String(body.id);
  const existingRow = await D.one('select * from sadara.swimmers where firestore_path=$1', [path]);
  const existing = existingRow ? D.doc(existingRow) : {};

  /* من بلغ 18 سنة وليٌّ على نفسه: لا تُكتب له بيانات وليّ، ورقم العائلة هو
     رقمه الوطني. والبيانات القديمة لا تُمحى من `raw`، لكن لا تُعرض ولا تُعدَّل
     من بطاقته. */
  const adultAge = ageOnDate(body.birth_date || existing.birth_date);
  if (adultAge !== null && adultAge >= 18) {
    const own = normalizeNIN(body.national_id || existing.national_id || existing.guardian_national_id);
    ['guardian_first_name', 'guardian_last_name', 'guardian_relation',
      'guardian_phone', 'guardian_birth_date', 'guardian_card_issued'].forEach(k => {
      delete guardianWrite[k];
      delete write[k];
    });
    if (own) {
      guardianWrite.guardian_national_id = own;
      write.guardian_national_id = own;
    }
  }
  if (!Object.keys(write).length) return sendJSON(res, { error: 'لا يوجد ما يُحفظ.' }, 400);

  await mergeRaw('swimmers', path, write);
  await writeTyped('swimmers', path, Object.assign({}, write, { updated_at: new Date().toISOString() }), SWIMMER_COLUMNS);

  /* وبجانب السباح، يُكتب تعديل الولي رجوعًا إلى الطلب الذي جاء منه -- إن
     جاء من طلب. والطلب يُوسم ولا يُمحى: هو سجلّ النادي عن شخص تقدّم. أما
     السباح الذي لم يُولد من طلب (بيانات قديمة) فمرجع وليّه على بطاقته وحدها،
     وقد كُتب أعلاه. */
  const from = String(existing.from_application || '').replace(/^applications\//, '');
  let guardianWritten = 0;
  if (from && Object.keys(guardianWrite).length) {
    const gWrite = Object.assign({}, guardianWrite, {
      edited_at: new Date().toISOString(),
      edited_by: 'the club'
    });
    const appPath = 'applications/' + from;
    await mergeRaw('applications', appPath, gWrite);
    await writeTyped('applications', appPath,
      Object.assign({}, gWrite, { updated_at: new Date().toISOString() }), APPLICATION_GUARDIAN_COLUMNS);
    guardianWritten = Object.keys(guardianWrite).length;
  }

  sendJSON(res, {
    ok: true,
    fields: Object.keys(write).length,
    guardian_fields: guardianWritten,
    national_id_missing: !normalizeNIN(guardianWrite.guardian_national_id !== undefined
      ? guardianWrite.guardian_national_id
      : (existing.guardian_national_id || ''))
  });
};

/* حذف سباح من القائمة: وسمٌ لا محو.

   المحوّل كان يحذف الوثيقة فعلًا، وهنا لا. والسبب أنّ هذه سجلات أطفال تحمل
   اسمًا وهوية وصورة، ورقم انخراط يُقرأ على البطاقة عند المسبح. وسمُ الحالة
   يُخفيه من القوائم التي تُصفّي المحذوف، ويُبقي الأثر إن سُئل عنه لاحقًا --
   والقاعدة الحاكمة في هذا الملف: لا يُحذف صفّ سباح ولا صفّ طلب، أبدًا. */
ROUTES['DELETE /api/swimmers'] = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  if (!body.id) return sendJSON(res, { error: 'معرّف السباح مطلوب' }, 400);
  const path = 'swimmers/' + String(body.id);
  await mergeRaw('swimmers', path, {
    status: 'removed', active: false,
    removed_at: new Date().toISOString(), removed_by: gate.user.id
  });
  await writeTyped('swimmers', path, {
    status: 'removed', active: false, updated_at: new Date().toISOString()
  }, SWIMMER_COLUMNS);
  sendJSON(res, { ok: true });
};


/* ============================== الإعلانات ============================== */
ROUTES['GET /api/notices'] = async (req, res) => {
  const rows = await D.all('select * from sadara.notices');
  sendJSON(res, rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .map(x => Object.assign({}, x, { text: x.text || x.body || '', date: x.date || '' })));
};

ROUTES['POST /api/notices'] = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  await mergeRaw('notices', 'notices/' + newId(), {
    title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان',
    created_at: new Date().toISOString()
  });
  sendJSON(res, { ok: true }, 201);
};

const noticeEditOrDelete = async (req, res, body) => {
  const isDelete = req.method === 'DELETE';
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  if (!body.id) return sendJSON(res, { error: 'معرّف الإعلان مطلوب' }, 400);
  const path = 'notices/' + String(body.id);
  /* إعلان ليس سجلّ طفل، فيجوز محوه كما كان المحوّل يمحوه. */
  if (isDelete) await D.run('delete from sadara.notices where firestore_path=$1', [path]);
  else await mergeRaw('notices', path, {
    title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان',
    updated_at: new Date().toISOString()
  });
  sendJSON(res, { ok: true });
};
ROUTES['PUT /api/notices'] = noticeEditOrDelete;
ROUTES['DELETE /api/notices'] = noticeEditOrDelete;

/* ============================== البرنامج ==============================
   البرنامج ليس جدولًا ثانيًا يُكتب بيد: هو قراءة من الأفواج. كل فوج يحمل
   أيامه وساعته ومدربه ومسبحه، فتتغيّر الحصة بتغيّر الفوج ولا تتناقض نسختان.
   والجدول القديم `schedules` يبقى احتياطًا للبيانات التي لم تُفوج بعد. */
ROUTES['GET /api/schedule'] = async (req, res) => {
  const groupRows = await D.all('select * from sadara.groups');
  const groups = groupRows
    .map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(g => g && g.name && g.deleted !== true && g.active !== false);
  const sessions = [];
  for (const g of groups) {
    const days = Array.isArray(g.days) && g.days.length
      ? g.days
      : (g.day ? [g.day] : []);
    if (!days.length) continue;
    const range = g.start && g.end ? String(g.start) + ' - ' + String(g.end) : (g.schedule || '');
    for (const day of days) {
      sessions.push({
        id: String(g.id) + '@' + String(day),
        day_name: String(day),
        time_range: range,
        start: g.start || '',
        end: g.end || '',
        group_id: g.id,
        group_name: g.name,
        category: g.category || '',
        level: g.level || '',
        coach: g.coach || '',
        assistants: Array.isArray(g.assistants) ? g.assistants : [],
        pool: g.pool || g.facility || 'مسبح الصدارة',
        source: 'group'
      });
    }
  }
  if (sessions.length) return sendJSON(res, byDay(sessions));
  const rows = await D.all('select * from sadara.schedules');
  sendJSON(res, byDay(rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))));
};

const scheduleWrite = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const payload = {
    day_name: body.day_name || 'السبت', time_range: body.time_range || '',
    group_name: body.group_name || 'غير مفرز', coach: body.coach || '', pool: body.pool || 'مسبح الصدارة'
  };
  if (req.method === 'PUT' && body.id) await mergeRaw('schedules', 'schedules/' + String(body.id), payload);
  else await mergeRaw('schedules', 'schedules/' + newId(), payload);
  sendJSON(res, { ok: true }, req.method === 'POST' ? 201 : 200);
};
ROUTES['POST /api/schedule'] = scheduleWrite;
ROUTES['PUT /api/schedule'] = scheduleWrite;

ROUTES['DELETE /api/schedule'] = async (req, res, body) => {
  const gate = await managerGate(req, 'هذه العملية لرئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  if (!body.id) return sendJSON(res, { error: 'معرّف الحصة مطلوب' }, 400);
  await D.run('delete from sadara.schedules where firestore_path=$1', ['schedules/' + String(body.id)]);
  sendJSON(res, { ok: true });
};

/* ================================ البطاقات ================================
   البطاقة صورة مشتقّة من السباح لحظة العرض، ولا مستند لها في القاعدة. فالمسار
   يبقى موجودًا ويردّ قائمة فارغة صحيحة، حتى لا تجد الصفحة 404 على مسار تعرفه. */
ROUTES['GET /api/cards'] = async (req, res) => sendJSON(res, []);

/* ================================ الحضور ================================
   القراءة كثيرة، والكتابة اثنتان: المسير والمدرب. والخادم هو من يقرّر. */
ROUTES['POST /api/attendance'] = async (req, res, body) => {
  const gate = await scannerGate(req);
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const profile = userView(gate.user, await owners());
  const memberId = body.member_id || body.swimmer_id || '';
  if (!memberId) return sendJSON(res, { error: 'يجب تحديد السباح' }, 400);
  /* الحصة المسؤول عنها، ولحظة الكتابة: ليستا الشيء نفسه -- مدرب يكتب ورقة
     الأحد صباح الإثنين. */
  const session = attendanceSession(body.session_date);
  if (session.error) return sendJSON(res, { error: session.error }, 400);
  const day = session.day;
  const status = body.status || 'present';
  const recorder = attendanceRecorder(profile);
  const path = 'attendance/att_' + day + '_' + String(memberId).replace(/[^\w-]/g, '_');
  const record = {
    member_id: memberId, session_date: day, status,
    marked_by: profile.id,
    marked_by_name: recorder.name,
    marked_by_role: recorder.role,
    recorded_by_uid: recorder.uid,
    recorded_by_name: recorder.name,
    recorded_by_role: recorder.role,
    marked_at: new Date().toISOString()
  };
  await mergeRaw('attendance', path, record);
  /* الأعمدة المطبوعة تُحدَّث مع `raw`، فلا يعلو مسحٌ قديم على مسحٍ جديد. */
  await writeTyped('attendance', path, record, new Set([
    'member_id', 'session_date', 'status', 'marked_by', 'marked_by_name', 'marked_by_role',
    'recorded_by_uid', 'recorded_by_name', 'recorded_by_role', 'marked_at'
  ]));
  sendJSON(res, { ok: true, message: 'تم تسجيل الحضور بنجاح', recorded_by: recorder }, 201);
};

/* ============================== الطلبات ==============================
   الاستمارة العامة تُرسل بلا حساب، فالباب مفتوح للقراءة العامة للأسعار فقط،
   وللكتابة هنا. والطلب لا يُنشئ حساب دخول: الحساب يبقى في Firebase Auth حتى
   يُهاجَر، لكن رقم الولي يُحفظ ويُربط بالعائلة فورًا. */

const APPLICATION_COLUMNS = new Set([
  'application_no', 'application_type', 'status', 'category', 'applicant_uid',
  'account_uid', 'owner_uid', 'first_name_ar', 'last_name_ar', 'first_name_fr',
  'last_name_fr', 'birth_date', 'birth_place', 'gender', 'wilaya', 'national_id',
  'birth_certificate_no', 'blood_group', 'level', 'phone', 'whatsapp', 'address',
  'guardian_first_name', 'guardian_last_name', 'guardian_birth_date',
  'guardian_relation', 'guardian_phone', 'guardian_national_id', 'guardian_consent',
  'family_national_id', 'guardian_linked', 'guardian_account_uid',
  'guardian_national_id_expiry', 'guardian_card_issued', 'guardian_child',
  'selected_pool', 'facility', 'subscription_code', 'plan_name', 'sport',
  'swimming_strokes', 'transport', 'uniform', 'transport_amount', 'uniform_amount',
  'payment_method', 'expected_amount', 'membership_no', 'registration_id',
  'national_id_key', 'duplicate_key', 'submitted_from', 'submitted_at',
  'created_at', 'updated_at', 'notes', 'photo', 'returning_account',
  'reviewed_by', 'decided_at', 'rejection_reason', 'decision_reason',
  'transferred_to', 'transferred_at', 'scan_name', 'scan_path'
]);

/* رقم طلب فريد بالشكل الذي تعرفه الصفحة: APP-YYYYMMDD-XXXX. */
async function nextApplicationNo() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let i = 0; i < 20; i++) {
    const no = 'APP-' + day + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const seen = await D.one('select 1 from sadara.applications where application_no=$1 limit 1', [no]);
    if (!seen) return no;
  }
  return 'APP-' + day + '-' + newId().slice(0, 6);
}

/* طلب تسجيل جديد. الرقم البيومتري هو أول ما يُفحص:
   - للقاصر: رقم الولي إلزامي.
   - للبالغ: رقمه هو، لأنه وليٌّ على نفسه.
   وإن كان الرقم معروفًا من طلب سابق، تُنسخ بيانات الولي الناقصة ويُوسم الطلب
   بأنه مرتبط بعائلة موجودة -- فلا يُطلب من الأب مستنداته مرة ثانية. */
ROUTES['POST /api/applications'] = async (req, res, body) => {
  body = normaliseIncoming(body || {});
  const category = String(body.category || body.application_type || 'adult').toLowerCase() === 'minor'
    ? 'minor' : 'adult';
  if (String(body.application_type || 'swimmer') !== 'swimmer') {
    return sendJSON(res, { error: 'طلبات المدربين لها مسارها المستقل.' }, 400);
  }

  const ownNin = normalizeNIN(body.national_id);
  const statedGuardianNin = normalizeNIN(body.guardian_national_id);
  /* البالغ وليٌّ على نفسه: رقمه هو مرجع عائلته، ولا يُقبل رقم وليّ آخر
     يجرّه إلى عائلة ليست عائلته. */
  const guardianNin = category === 'minor' ? statedGuardianNin : ownNin;
  if (!guardianNin) {
    return sendJSON(res, {
      error: category === 'minor'
        ? 'رقم التعريف الوطني للولي إلزامي، ويجب أن يكون 18 رقمًا.'
        : 'رقم التعريف الوطني إلزامي، ويجب أن يكون 18 رقمًا.'
    }, 400);
  }
  if (!String(body.first_name_ar || '').trim() || !String(body.last_name_ar || '').trim()) {
    return sendJSON(res, { error: 'اسم السباح ولقبه مطلوبان.' }, 400);
  }

  body.guardian_national_id = guardianNin;
  if (category === 'adult') {
    /* البالغ وليٌّ على نفسه: الاسم والهاتف من بطاقته، لا من بطاقة أب.
       وهكذا تظهر بطاقته في لوحة العائلة نفسها. */
    body.guardian_first_name = body.guardian_first_name || body.first_name_ar;
    body.guardian_last_name = body.guardian_last_name || body.last_name_ar;
    body.guardian_phone = body.guardian_phone || body.phone || '';
    body.guardian_relation = body.guardian_relation || 'نفسه';
    body.guardian_child = body.guardian_child || (body.first_name_ar + ' ' + body.last_name_ar).trim();
  }

  /* العائلة الموجودة: حساب بالرقم، أو طلب سابق بالرقم نفسه. */
  const account = await findGuardianByNIN(guardianNin);
  const allApps = await D.all('select * from sadara.applications');
  const prior = allApps
    .map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(a => normalizeNIN(a.guardian_national_id || a.family_national_id) === guardianNin)
    .sort((a, b) => String(b.status || '') === 'approved' ? 1 : -1)[0] || null;
  if (prior) {
    for (const key of ['guardian_first_name', 'guardian_last_name', 'guardian_phone', 'guardian_relation']) {
      if (!String(body[key] || '').trim() && prior[key]) body[key] = prior[key];
    }
  }
  const familyAccountUid = (account && account.id)
    || (prior && (prior.account_uid || prior.owner_uid || prior.applicant_uid)) || '';
  const linked = !!(account || prior);

  const application_no = String(body.application_no || '').trim() || await nextApplicationNo();
  const id = newId();
  const path = 'applications/' + id;
  const now = new Date().toISOString();

  /* المفتاح الذي تُقارَن به الطلبات: للبالغ رقمه، وللقاصر رقم وليّه مع شهادة
     الميلاد والسنة والبلدية -- أخٌ ليس أخاه. */
  const cert = String(body.birth_certificate_no || '').replace(/\D/g, '');
  const year = String(body.birth_date || '').slice(0, 4);
  const place = normId(body.birth_place);
  const duplicateKey = category === 'minor' && cert && year && place
    ? [guardianNin, cert, year, place].join('|') : '';

  /* المبلغ: من الخطة المعتمدة، ولا يُخترع إن لم تكن هناك خطة. */
  let expected = Number(body.expected_amount) || 0;
  if (!expected && body.subscription_code) {
    const planRows = await D.all('select * from sadara.subscription_plans');
    const plan = planRows.map(r => D.doc(r) || {})
      .find(p => String(p.code || p.id || '') === String(body.subscription_code));
    expected = Number(plan && plan.amount) || 0;
  }
  const extras = (await readRaw('fee_settings', "firestore_path='fee_settings/extras'", [])) || {};
  if (body.transport) expected += feeFor(extras, body, 'transport').amount;
  if (body.uniform) expected += feeFor(extras, body, 'uniform').amount;

  const record = Object.assign({}, body, {
    application_no,
    application_type: 'swimmer',
    status: 'pending',
    category,
    applicant_uid: body.applicant_uid || (account ? account.id : ''),
    account_uid: familyAccountUid,
    owner_uid: familyAccountUid,
    guardian_national_id: guardianNin,
    family_national_id: guardianNin,
    guardian_linked: linked,
    guardian_account_uid: account ? account.id : '',
    national_id: ownNin,
    national_id_key: ownNin,
    duplicate_key: duplicateKey,
    submitted_from: body.submitted_from || 'public-form',
    submitted_at: now,
    created_at: now,
    updated_at: now,
    expected_amount: expected,
    returning_account: linked || body.returning_account === true
  });

  await mergeRaw('applications', path, record);
  await writeTyped('applications', path, record, APPLICATION_COLUMNS);

  await mergeRaw('audit_logs', 'audit_logs/' + newId(), {
    action: 'application_filed',
    by: 'public-form',
    target: id,
    at: now,
    guardian_linked: linked,
    family_national_id: guardianNin
  });

  sendJSON(res, {
    ok: true,
    id,
    application_no,
    expected_amount: expected,
    guardian_linked: linked,
    family_national_id: guardianNin
  }, 201);
};

/* هل بقي للصاحب طلب مقبول آخر؟ رفض طلب مكرّر لا يُغلق الباب الذي فتحه
   طلب سابق مقبول. */
async function accountAcceptedElsewhere(uid, exceptId) {
  if (!uid) return false;
  const rows = await D.all(
    'select firestore_path, raw from sadara.applications where applicant_uid=$1', [uid]);
  return rows.some(row => {
    const id = D.idOf(row.firestore_path);
    const app = D.doc(row) || {};
    return id !== exceptId && (app.status === 'approved' || !!app.transferred_to);
  });
}

/* قرار المدير على طلب: اعتماد أو رفض، مع تسجيل من قرّر ومتى.
   والاعتماد لا يغيّر الحالة وحدها: يصنع السباح تحت معرّف الطلب نفسه، فيكون
   الاعتماد مرتين تحديثًا لشخص واحد لا سباحين. */
ROUTES['PATCH /api/applications/:id'] = async (req, res, body, url) => {
  const gate = await managerGate(req, 'صلاحية رئيس النادي مطلوبة');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);

  const id = decodeURIComponent(String(url.pathname.split('/').pop() || ''));
  if (!id) return sendJSON(res, { error: 'معرّف الطلب مطلوب.' }, 400);
  const appPath = 'applications/' + id;
  const row = await D.one('select * from sadara.applications where firestore_path=$1', [appPath]);
  if (!row) return sendJSON(res, { error: 'الطلب غير موجود.' }, 404);
  const stored = Object.assign({ id: id }, D.doc(row));

  body = normaliseIncoming(body || {});
  const patch = Object.assign({}, body);
  delete patch.id;
  /* الصورة الموقّعة تُحفظ في مسارها، ولا يُكتب نسخها المضمّن في الصف. */
  delete patch.scan_data_url;
  /* من قرّر ومتى يُكتبان عند القرار فقط، لا مع كل تعديل. */
  delete patch.reviewed_by;
  delete patch.decided_at;
  if (patch.status !== undefined
    && ['pending', 'approved', 'rejected'].indexOf(String(patch.status)) === -1) {
    return sendJSON(res, { error: 'حالة الطلب غير معروفة.' }, 400);
  }

  const now = new Date().toISOString();
  const isDecision = patch.status === 'approved' || patch.status === 'rejected';
  if (isDecision) {
    patch.reviewed_by = gate.user.id;
    patch.decided_at = now;
  }

  /* سبب الرفض شرط قبل أي كتابة: رفض بلا سبب يُردّ 400، ولا يجوز أن يكون
     الطلب قد صار مرفوضًا في القاعدة رغم ذلك. */
  if (patch.status === 'rejected') {
    const why = String(patch.rejection_reason || stored.rejection_reason || '').trim();
    if (!why) {
      return sendJSON(res, {
        error: 'اكتب سبب الرفض قبل رفض الطلب — صاحب الطلب يقرأه عند محاولته الدخول.'
      }, 400);
    }
  }

  /* المبلغ يُحسب على الطلب كما هو بعد التعديل، لا على الحقول المرسلة وحدها:
     مدير يضيف خدمة إلى طلب قائم يجب أن يرى سعر الخطة الأصلية مضافًا إليها. */
  if ('subscription_code' in patch || 'transport' in patch || 'uniform' in patch) {
    const merged = Object.assign({}, stored, patch);
    const planRows = await D.all('select * from sadara.subscription_plans');
    const plans = planRows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
    const code = String(merged.subscription_code || '');
    const plan = plans.find(p => String(p.code || p.id || '') === code)
      || DEFAULT_PLANS.find(p => String(p.code) === code);
    let expected = Number(plan && plan.amount) || 0;
    const extras = (await readRaw('fee_settings', "firestore_path='fee_settings/extras'", [])) || {};
    if (merged.transport) expected += feeFor(extras, merged, 'transport').amount;
    if (merged.uniform) expected += feeFor(extras, merged, 'uniform').amount;
    patch.expected_amount = expected;
  }

  if (patch.payment_status === 'paid') {
    await mergeRaw('payments', 'payments/' + newId(), {
      application_no: patch.application_no || stored.application_no || id,
      amount: Number(patch.expected_amount !== undefined ? patch.expected_amount : stored.expected_amount) || 0,
      method: patch.payment_method || stored.payment_method || 'cash',
      paid_at: patch.paid_at || now.slice(0, 10),
      cashier_name: patch.cashier_name || '',
      recorded_by: gate.user.id,
      created_at: now
    });
  }

  const write = Object.assign({}, patch, { updated_at: now });
  await mergeRaw('applications', appPath, write);
  await writeTyped('applications', appPath, write, APPLICATION_COLUMNS);

  if (patch.status === 'approved') {
    const src = Object.assign({}, stored, write);
    /* رقم الانخراط يُقرأ من الطلب إن كان صالحًا، وإلا يُولَّد الآن. والاعتماد
       مرتين لا يستهلك رقمين: المسار واحد والرقم المحفوظ يُعاد استعماله. */
    const membership = /^S[0-9]{4}[12][0-9]{4}$/.test(String(src.membership_no || ''))
      ? String(src.membership_no)
      : await nextSwimmerNumber(src.birth_date, src.category);
    const adult = isAdultPerson(src);
    const ownNin = normalizeNIN(src.national_id);
    const guardianNin = adult
      ? ownNin
      : normalizeNIN(src.guardian_national_id || src.family_national_id);
    const swimmerPath = 'swimmers/' + id;
    const swimmer = {
      membership_no: membership,
      registration_id: membership,
      name: [src.first_name_ar, src.last_name_ar].filter(Boolean).join(' '),
      first_name_ar: src.first_name_ar || '',
      last_name_ar: src.last_name_ar || '',
      birth_date: src.birth_date || '',
      gender: src.gender || '',
      blood_group: src.blood_group || '',
      level: src.level || '',
      phone: src.phone || '',
      whatsapp: src.whatsapp || '',
      facility: src.facility || '',
      group_name: src.group_name || 'غير مفرز',
      group_id: src.group_id || '',
      national_id: ownNin,
      guardian_national_id: guardianNin,
      guardian_account_uid: src.guardian_account_uid || src.account_uid || '',
      guardian_first_name: adult ? '' : (src.guardian_first_name || ''),
      guardian_last_name: adult ? '' : (src.guardian_last_name || ''),
      guardian_phone: adult ? '' : (src.guardian_phone || ''),
      photo: src.photo || src.photo_url || '',
      status: 'active',
      active: true,
      from_application: id,
      applicant_uid: src.applicant_uid || '',
      created_at: now,
      updated_at: now
    };
    if (adult) {
      /* البالغ وليٌّ على نفسه: لا تُنسخ بيانات وليّه الشخصية إلى بطاقته. */
      delete swimmer.guardian_first_name;
      delete swimmer.guardian_last_name;
      delete swimmer.guardian_phone;
    }
    await mergeRaw('swimmers', swimmerPath, swimmer);
    await writeTyped('swimmers', swimmerPath, swimmer, SWIMMER_COLUMNS);

    await mergeRaw('applications', appPath, {
      membership_no: membership, registration_id: membership,
      transferred_to: id, transferred_at: now, updated_at: now
    });
    await writeTyped('applications', appPath, {
      membership_no: membership, registration_id: membership,
      transferred_to: id, transferred_at: now, updated_at: now
    }, APPLICATION_COLUMNS);

    if (src.applicant_uid) {
      await D.run(`update sadara.users
          set request_status='accepted', member_no=$1, registration_id=$1,
              decided_at=$2, raw = raw || $3::jsonb
        where uid=$4`,
        [membership, now, JSON.stringify({
          request_status: 'accepted', member_no: membership,
          registration_id: membership, decided_at: now,
          rejection_reason: '', request_reason: ''
        }), src.applicant_uid]);
    }

    await mergeRaw('audit_logs', 'audit_logs/' + newId(), {
      action: 'application_approved', by: gate.user.id, target: id,
      entity_type: 'application', entity_id: id,
      details: { membership_no: membership, name: swimmer.name },
      created_at: now
    });
    return sendJSON(res, {
      ok: true, id: id, status: 'approved',
      membership_no: membership,
      expected_amount: patch.expected_amount !== undefined ? patch.expected_amount : stored.expected_amount
    });
  }

  if (patch.status === 'rejected') {
    const why = String(patch.rejection_reason || stored.rejection_reason || '').trim();
    /* طلب كان مقبولًا ثم رُفض: لا يُمحى السباح. يُوسم مرفوضًا ويُخفى من
       القوائم النشطة، لأن القاعدة هنا لا تحذف صفّ سباح أبدًا. */
    if (stored.transferred_to) {
      const swimmerPath = 'swimmers/' + stored.transferred_to;
      const off = { status: 'rejected', active: false, updated_at: now };
      await mergeRaw('swimmers', swimmerPath, off);
      await writeTyped('swimmers', swimmerPath, off, SWIMMER_COLUMNS);
      await mergeRaw('applications', appPath, {
        transferred_to: '', transferred_at: null, updated_at: now
      });
      await writeTyped('applications', appPath, {
        transferred_to: '', transferred_at: null, updated_at: now
      }, APPLICATION_COLUMNS);
    }
    const accountStaysOpen = await accountAcceptedElsewhere(stored.applicant_uid, id);
    if (stored.applicant_uid && !accountStaysOpen) {
      await D.run(`update sadara.users
          set request_status='rejected', request_reason=$1, decided_at=$2,
              raw = raw || $3::jsonb
        where uid=$4`,
        [why, now, JSON.stringify({
          request_status: 'rejected', rejection_reason: why, request_reason: why,
          decided_at: now
        }), stored.applicant_uid]);
    }
    await mergeRaw('audit_logs', 'audit_logs/' + newId(), {
      action: 'application_rejected', by: gate.user.id, target: id,
      entity_type: 'application', entity_id: id,
      details: { reason: why, account_left_open: accountStaysOpen },
      created_at: now
    });
    return sendJSON(res, {
      ok: true, id: id, status: 'rejected',
      expected_amount: patch.expected_amount !== undefined ? patch.expected_amount : stored.expected_amount,
      account_left_open: accountStaysOpen
    });
  }

  return sendJSON(res, {
    ok: true, id: id,
    expected_amount: patch.expected_amount !== undefined ? patch.expected_amount : stored.expected_amount
  });
};

/* قائمة المدير قائمة أشخاص: وثيقة تحمل اسمًا محجوزًا لا شخصًا تنتظر، فتُستثنى. */
ROUTES['GET /api/applications'] = async (req, res) => {
  const gate = await managerGate(req, 'صلاحية رئيس النادي مطلوبة');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const rows = await D.all('select * from sadara.applications');
  sendJSON(res, rows.map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)))
    .filter(row => !row.claim_only)
    .map(withoutGuardianApplication));
};

/* ==================== الحسابات التي هي شخص واحد ====================
   خمس روابط، والرابع هو ما احتاجه النادي فعلًا: بطاقة الولي. رقم واحد
   يُكتب في موضعين -- هويةً عند الأب، وبطاقةَ وليٍّ في طلبات أبنائه. */
ROUTES['GET /api/accounts/duplicates'] = async (req, res) => {
  const gate = await managerGate(req, 'فحص الحسابات المكررة متاح للمدير أو رئيس النادي فقط');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);
  const ownerSet = await owners();
  const userRows = await D.all('select * from sadara.users');
  const seen = new Map();
  const accounts = new Map();
  const list = userRows.map(r => {
    const f = Object.assign({ id: r.uid }, D.doc(r));
    const when = tsOf(f.created_at);
    if (f.merged_into) return { id: r.uid, raw: f, merged: true, when };
    accounts.set(r.uid, f);
    seen.set('uid:' + r.uid, [{
      id: r.uid, name: f.name || '', email: f.email || '',
      username: f.username || '', role: f.role || 'member',
      owner: ownerSet.has(String(f.email || '').toLowerCase()), when,
      requests: 0, swimmers: 0
    }]);
    return { id: r.uid, raw: f, merged: false, when };
  });
  const put = (kind, value, uid) => {
    const key = kind + ':' + normId(value);
    if (key.endsWith(':') || !accounts.has(uid)) return;
    const group = seen.get(key) || [];
    if (group.some(a => a.id === uid)) return;
    group.push(Object.assign({}, seen.get('uid:' + uid)[0]));
    seen.set(key, group);
  };
  const apps = (await D.all('select * from sadara.applications'))
    .map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
  const sw = (await D.all('select * from sadara.swimmers'))
    .map(r => Object.assign({ id: D.idOf(r.firestore_path) }, D.doc(r)));
  for (const uid of accounts.keys()) {
    const mine = seen.get('uid:' + uid)[0];
    mine.requests = apps.filter(a => String(a.applicant_uid || '') === uid).length;
    mine.swimmers = sw.filter(x => String(x.applicant_uid || '') === uid).length;
  }
  for (const uid of accounts.keys()) {
    const f = accounts.get(uid);
    put('user name', f.username, uid);
    put('identity number', f.national_id, uid);
    put('guardian card', f.national_id, uid);
    if (f.name && f.birth_date) put('name and day of birth', f.name + '|' + f.birth_date, uid);
  }
  for (const a of apps) {
    const uid = String(a.applicant_uid || '');
    if (!uid || !accounts.has(uid)) continue;
    put('guardian card', a.guardian_national_id, uid);
  }
  const groups = [];
  const done = new Set();
  for (const [key, members] of seen) {
    if (key.startsWith('uid:') || members.length < 2) continue;
    const ids = members.map(a => a.id).sort().join(',');
    if (done.has(ids)) continue;
    done.add(ids);
    members.sort((a, b) => a.when - b.when);
    groups.push({
      reason: key.split(':')[0],
      by: key.slice(key.indexOf(':') + 1),
      keep: members[0].id,
      accounts: members
    });
  }
  const merged = list.filter(x => x.merged)
    .map(x => ({ id: x.id, name: x.raw.name || '', email: x.raw.email || '', into: x.raw.merged_into }));
  sendJSON(res, { groups: groups, merged: merged, checked: accounts.size });
};

/* ============================ حذف حساب ============================
   الحساب باب دخول، وليس طفلًا.

   ما يفعله هذا المسار: يمحو الحساب وبطاقة صاحبه، ويسم الطلبات التي تخصّه،
   **ولا يمسّ `applications` ولا `swimmers`** -- رقم انخراط مطبوع على بطاقة
   ويُقرأ عند المسبح لا يزول لأن وليًّا أغلق حسابه. والمنع هو مقصد المسار:
   زرّ يمحو حامله يُضغط مرة بالخطأ؛ ومسار يمحو الرئيس يُنهي إدارة النادي؛
   ومحو بلا سبب يترك ثقبًا لا يعرف أحد ما كان فيه. */
ROUTES['DELETE /api/users/:uid'] = async (req, res, body, url) => {
  const gate = await managerGate(req, 'حذف حساب بموجب مدير النادي أو رئيسه.');
  if (gate.error) return sendJSON(res, { error: gate.error }, gate.status);

  const uid = decodeURIComponent(url.pathname.replace('/api/users/', ''));
  if (!uid) return sendJSON(res, { error: 'الحساب غير محدد.' }, 400);

  if (uid === gate.user.id) {
    return sendJSON(res, {
      error: 'لا يمكنك حذف حسابك الذي تستخدمه الآن. احذفه من جهاز آخر أو من'
        + ' حساب الرئيسي للنادي.'
    }, 403);
  }

  const profRow = await D.one('select * from sadara.users where uid=$1', [uid]);
  const appUser = await D.one('select id, email, display_name from public.app_users where id=$1', [uid]);
  const profile = Object.assign({}, profRow ? D.doc(profRow) : {});
  if (!profile.email && appUser) profile.email = appUser.email || '';
  if (!profile.name && appUser) profile.name = appUser.display_name || '';

  /* الرئيس يُعرَف بعنوانه لا بمعرّفه: هذا المسار يعطى معرّفًا فقط، والقاعدة
     تقرأ العنوان. والملفّ يحمل العنوان الذي أُنشئ به الحساب. */
  const address = String(profile.email || '').trim().toLowerCase();
  if (!address) {
    return sendJSON(res, {
      error: 'لا يوجد سجلّ لهذا الحساب في بيانات النادي، فلا يمكن التأكد من هويته.'
        + ' الحساب الذي لا يمكن تسمية صاحبه لا يُحذف من هنا.'
    }, 403);
  }
  if ((await owners()).has(address)) {
    return sendJSON(res, { error: 'هذا حساب رئيس النادي. لا يمكن حذفه من هنا.' }, 403);
  }

  /* حذف حساب مسير أو مدير لا يفعله إلا صاحب النادي. */
  const targetRow = await D.one('select role from public.app_users where id=$1', [uid]);
  if (targetRow && !R.canManageAccount(gate.user, { role: targetRow.role, email: address }, await owners())) {
    return sendJSON(res, { error: 'لا يحذف حساب مسير أو مدير إلا صاحب النادي.' }, 403);
  }

  const reason = String((body && body.reason) || '').trim();
  if (!reason) {
    return sendJSON(res, {
      error: 'اكتب سبب الحذف. يُسجَّل في سجلّ النادي، ويساعد على معرفة'
        + ' ما كان يحدث قبله إن سُئل عنه لاحقًا.'
    }, 400);
  }

  /* الطلبات تُوسم ولا تُمحى: هي سجلّ النادي عن شخص تقدّم. */
  const removedAt = new Date().toISOString();
  const mine = await D.all('select firestore_path from sadara.applications where applicant_uid=$1', [uid]);
  let stamped = 0;
  for (const row of mine) {
    const stamp = {
      account_removed_at: removedAt, account_removed_by: gate.user.id,
      account_removed_reason: reason
    };
    await mergeRaw('applications', row.firestore_path, stamp);
    await writeTyped('applications', row.firestore_path, stamp,
      new Set(['account_removed_at', 'account_removed_by', 'account_removed_reason']));
    stamped++;
  }

  /* وهل لصاحب الحساب ولد على القوائم؟ يُبلَّغ، ولا يُمَسّ. */
  let childrenKept = 0;
  const reg = String(profile.registration_id || '').trim();
  if (reg) {
    const onBooks = await D.one('select count(*)::int as c from sadara.swimmers where registration_id=$1', [reg]);
    childrenKept = onBooks ? onBooks.c : 0;
  }

  /* حساب الدخول وملفّه يُمحوان في معاملة واحدة: بابٌ بلا ملفّ يبقى بابًا،
     وبابٌ يُفتح لدور إداري بعد أن طُلب محوه هو بالضبط ما لا يجوز. */
  await withTx(async client => {
    await client.query('delete from public.app_users where id=$1', [uid]);
    await client.query('delete from sadara.users where uid=$1', [uid]);
  });

  await mergeRaw('audit_logs', 'audit_logs/' + newId(), {
    at: removedAt, action: 'account_removed', by: gate.user.id, target: uid,
    target_name: profile.name || '', target_email: profile.email || '',
    reason, requests_stamped: stamped, children_on_the_books: childrenKept
  });

  sendJSON(res, {
    ok: true,
    removed: { uid: uid, name: profile.name || '', email: profile.email || '' },
    requests_stamped: stamped,
    children_kept: childrenKept,
    note: 'حُذف الحساب. الطلبات لم تُحذف، والأطفال المسجّلون لم يُمَسّوا.'
  });
};


async function handleAPI(req, res, url) {
  const key = req.method + ' ' + url.pathname;
  /* النبضة ليست استعمالًا: لا تُحتسب نشاطًا، وإلا صارت النبضة تُبقي نفسها
     حيّة وتُبطل معنى «لا نبض إن كان هناك نشاط». */
  if (url.pathname !== '/api/wake') lastRequestAt_ = Date.now();
  /* المسارات الثابتة تُبحث أولًا، ثم ذوات المعامل. `DELETE /api/users/:uid`
     يحمل معرّف الحساب في العنوان نفسه، كما كان في المحوّل. */
  const handler = ROUTES[key]
    || (req.method === 'PATCH' && /^\/api\/applications\/[^/]+$/.test(url.pathname)
      ? ROUTES['PATCH /api/applications/:id'] : null)
    || (req.method === 'DELETE' && /^\/api\/users\/[^/]+$/.test(url.pathname)
      ? ROUTES['DELETE /api/users/:uid'] : null);
  if (!handler) return sendJSON(res, { error: 'مسار غير معروف' }, 404);
  const body = (req.method === 'POST' || req.method === 'PUT'
    || req.method === 'PATCH' || req.method === 'DELETE')
    ? await readBody(req) : {};
  try {
    await handler(req, res, body, url);
  } catch (e) {
    console.error('route failed:', key, e.message);
    if (!res.headersSent) sendJSON(res, { error: 'تعذّر إتمام الطلب' }, 500);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleAPI(req, res, url);

  /* طلب صفحة نشاطٌ كذلك، وليس `/api/*` وحده.
     ----------------------------------------------------------------------------
     الزائر يفتح العنوان فيطلب `index.html` و`app.js` و`style.css`: ثلاثة
     طلبات لا يمرّ فيها شيء على `/api/`. ولو حسبنا النشاط هناك وحده، لظنّت
     النبضة أن الخفّة سكونٌ فضربت بينما أحدٌ يقرأ الصفحة -- أو (وهو الأسوأ)
     حسبت السكون نشاطًا فنامت الخدمة على زائر. فالملفات الثابتة تُحتسب نشاطًا
     كذلك. */
  lastRequestAt_ = Date.now();

  /* الملفات الثابتة: نفس مجلد النشر. */
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('forbidden'); return; }

  /* صفحة HTML تُقدَّم من هنا: المحوّل Firebase يجب أن يتنحّى.
     ----------------------------------------------------------------------------
     النشر الحقيقي يقدّم `app.js` نفسه، والمحوّل `firebase-adapter.js` يعترض
     `window.fetch` ويردّ على `/api/*` من Firestore. وهذا الخادم يردّ عليها
     بنفسه من Neon. فإن عمل الاثنان معًا، اعترض المحوّل الطلب قبل أن يصل إلى
     هنا -- فتُقرأ البيانات من Firebase، ويظنّ الناظر أنه يقرأها من Neon.

     والمحوّل يعرف كيف يتنحّى أصلًا: سطر في أوله يقول «إن كان الخادم محلّيًا
     فاترك fetch وحده». فما نفعله هنا سطرٌ واحد قبل تحميله، نضع فيه العَلَم
     الذي يجعله يقف جانبًا -- ولا نلمس `app.js` ولا الصفحة الثابتة، فالنشرة
     نفسها تخدم المنصتين. */
  if (/\.html?$/i.test(file)) {
    return serveHtml(req, res, file);
  }
  sendFile(res, file);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('Sadara on Neon: http://localhost:' + PORT);
  });
}

module.exports = {
  server, userView, loadUser, owners,
  normalizeNIN, ageOnDate, isAdultPerson, withoutGuardian, withoutGuardianApplication
};
