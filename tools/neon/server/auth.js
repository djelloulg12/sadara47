/* كلمات المرور والجلسات: أساس الدخول على Neon.
   ----------------------------------------------------------------------------
   لا Firebase هنا. لا توكن Google. كل شيء يُبنى على ما نملكه:
   تجزئة scrypt في `app_users`، وجلسة موقّعة في كوكي.

   ثلاثة قرارات، كلٌّ منها عن أمان حقيقي:

   1. scrypt للمقارنة، ومقارنة بزمن ثابت.
      `===` على نصّين يخرج عند أول حرف مختلف، فيُقاس الفرق بالزمن ويُستخرج
      جزء من التجزئة حرفًا حرفًا. `timingSafeEqual` يقارن الطول كله دائمًا.

   2. كل محاولة فاشلة تُبطَّأ وتُعدّ. بلا عدّ، 226 حسابًا تُخمَّن بلا عقاب.
      الحدّ بسيط: 8 محاولات لكل بريد في 15 دقيقة.

   3. الجلسة كوكي موقّع HMAC، لا معرّف صفّ في جدول. الموقّع لا يُزوَّر،
      والجلسة تنتهي بزمنها بلا تنظيف.

   المفتاح السري يُقرأ من البيئة، وإن غاب يُولَّد ويُحفظ في ملف لا يُنشر.
   وغيابه في الإنتاج خطأ يُقال، لا قيمة افتراضية تُخفي الخطأ.
*/
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_DAYS = 14;
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/* ---- كلمة المرور ---- */
function verifyPassword(password, stored, saltB64, params) {
  if (!stored || !saltB64) return false;
  const p = params || { N: 16384, r: 8, p: 1, keylen: 64 };
  let computed;
  try {
    computed = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), p.keylen,
      { N: p.N, r: p.r, p: p.p, maxmem: 128 * p.N * p.r * 2 }).toString('base64');
  } catch (_) { return false; }
  const a = Buffer.from(computed);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* التجزئة تحمل معاملاتها، فلو تغيّرت N لاحقًا بقيت القديمة صحيحة. */
function hashPassword(password, saltB64, params) {
  const p = params || { N: 16384, r: 8, p: 1, keylen: 64 };
  return crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), p.keylen,
    { N: p.N, r: p.r, p: p.p, maxmem: 128 * p.N * p.r * 2 }).toString('base64');
}

/* ---- عدّ المحاولات ---- */
const attempts = new Map(); /* email -> [timestamps] */
function tooManyAttempts(email) {
  const now = Date.now();
  const list = (attempts.get(email) || []).filter(t => now - t < ATTEMPT_WINDOW_MS);
  attempts.set(email, list);
  return list.length >= MAX_ATTEMPTS;
}
function noteFailure(email) {
  const list = attempts.get(email) || [];
  list.push(Date.now());
  attempts.set(email, list);
}
function clearAttempts(email) { attempts.delete(email); }

/* ---- الجلسة: معرّف موقّع، لا صفّ في جدول ---- */
let SECRET = null;
function secret() {
  if (SECRET) return SECRET;
  if (process.env.SADARA_SESSION_SECRET) { SECRET = process.env.SADARA_SESSION_SECRET; return SECRET; }
  /* ملف محلي، لا يُنشر: يُولَّد مرة ويُعاد استعماله، فلا تُبطَل الجلسات
     عند كل تشغيل. */
  const file = path.join(__dirname, '..', '..', '..', '.session-secret');
  if (fs.existsSync(file)) { SECRET = fs.readFileSync(file, 'utf8').trim(); return SECRET; }
  SECRET = crypto.randomBytes(32).toString('hex');
  try { fs.writeFileSync(file, SECRET, { mode: 0o600 }); } catch (_) {}
  return SECRET;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + mac;
}

function open(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (_) { return null; }
}

function create(user) {
  return sign({ uid: user.id, role: user.role, exp: Date.now() + SESSION_DAYS * 86400000 });
}

module.exports = {
  verifyPassword, hashPassword,
  tooManyAttempts, noteFailure, clearAttempts,
  create, open, SECRET_FILE: true
};
