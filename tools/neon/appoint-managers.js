/* تعيين مسيرَي النادي وكلمة مرور مؤقتة لكل واحد.
   ----------------------------------------------------------------------------
   المطلوب من صاحب النادي: مسيران إداريان، لكل واحد كلمة مرور مؤقتة **مختلفة**
   تُسلَّم له شخصيًّا، ويُجبَر على تغييرها في أول دخول. ولا يمسّ هذا السكربت
   حساب صاحب النادي (`kabrag12@gmail.com`) لا بكلمة ولا بصفة: هو وحده من
   يعيّن المسيرين، ولا كلمة مروره هنا.

   ما يفعله:
     ١. `m.djelloulg12@gmail.com` → الصفة `manager`، وكلمة مؤقتة جديدة.
     ٢. `med.elfahem85@gmail.com` → يُنشأ إن لم يكن، بكلمة مؤقتة جديدة.
     ٣. `must_change=true` للاثنين، فلا تدخل كلمة يعرفها أحد غير صاحبها.
     ٤. كلمتان مختلفتان، تُطبعان مرة واحدة ولا تُكتبان في أي ملف.

   الكلمة تُخزَّن تجزئة scrypt فقط، بنفس معاملات الخادم (auth.js).
   والنسخة الاحتياطية تُكتب قبل أي تغيير.

   الاستعمال:
     node tools\neon\appoint-managers.js            معاينة (لا يكتب)
     node tools\neon\appoint-managers.js --write    ينفّذ ويطبع الكلمتين
*/
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dbUrl } = require('../neon-env');

const WRITE = process.argv.includes('--write');
const OWNER = 'kabrag12@gmail.com';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const TARGETS = [
  { email: 'm.djelloulg12@gmail.com', name: 'المسير الأول' },
  { email: 'med.elfahem85@gmail.com', name: 'المسير الثاني' }
];

function hashPassword(password, saltB64) {
  return crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), SCRYPT.keylen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 })
    .toString('base64');
}

/* 16 حرفًا من أبجدية بلا حروف متشابهة (O/0، l/1) -- تُقرأ في الهاتف بلا خطأ. */
function newPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += abc[crypto.randomInt(abc.length)];
  return out;
}

(async () => {
  const pg = require('pg');
  const pool = new pg.Pool({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });

  /* الحرّاس: صاحب النادي خارج القائمة، والهدفان معروفان بالحرف. */
  if (TARGETS.some(t => t.email.toLowerCase() === OWNER)) {
    console.log('refused: the owner is never a target'); process.exit(1);
  }
  const owner = await pool.query('select id, role from public.app_users where lower(email)=$1', [OWNER]);
  if (!owner.rowCount) { console.log('refused: the owner account is missing'); await pool.end(); process.exit(1); }

  const before = await pool.query(
    'select id, email, role, must_change from public.app_users where lower(email) = any($1) order by email',
    [TARGETS.map(t => t.email)]);

  console.log('=== قبل ===');
  console.log('owner: ' + OWNER + '  (' + owner.rows[0].role + ') — لن تُمسّ كلمته ولا صفته');
  for (const t of TARGETS) {
    const row = before.rows.find(r => String(r.email).toLowerCase() === t.email);
    console.log('  ' + t.email.padEnd(30) + (row ? 'موجود · ' + row.role + ' · must_change=' + row.must_change : 'غير موجود — سيُنشأ'));
  }

  if (!WRITE) {
    console.log('\n--- معاينة فقط. للتنفيذ أضف --write، وعندها تُطبع الكلمتان مرة واحدة ---');
    await pool.end();
    return;
  }

  /* ---- التنفيذ ---- */

  /* كلمتان مختلفتان: كلمة واحدة لاثنين ليست كلمة مؤقتة، بل كلمة مشتركة. */
  const passwords = {};
  const used = new Set();
  for (const t of TARGETS) {
    let p = newPassword();
    while (used.has(p)) p = newPassword();
    used.add(p);
    passwords[t.email] = p;
  }

  /* تجهيز كل صف قبل المعاملة: لا نكتب تجزئة لا نتحقّق منها. */
  const prepared = TARGETS.map(t => {
    const salt = crypto.randomBytes(16).toString('base64');
    const hash = hashPassword(passwords[t.email], salt);
    if (hashPassword(passwords[t.email], salt) !== hash) {
      throw new Error('the hash does not verify against itself for ' + t.email);
    }
    const existing = before.rows.find(r => String(r.email).toLowerCase() === t.email);
    return {
      email: t.email,
      name: t.name,
      salt, hash,
      id: existing ? existing.id : crypto.randomUUID().replace(/-/g, ''),
      created: !existing
    };
  });

  /* نسخة احتياطية للصفوف قبل أي كتابة. */
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(__dirname, '..', 'tests', 'out');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, 'managers-backup-' + stamp + '.json');
  fs.writeFileSync(backup, JSON.stringify(before.rows, null, 1));

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const p of prepared) {
      if (p.created) {
        await client.query(`
          insert into public.app_users
            (id, email, display_name, role, status, local_hash, local_salt, hash_params,
             must_change, password_set_at, updated_at)
          values ($1, $2, $3, 'manager', 'active', $4, $5, $6::jsonb, true, now(), now())`,
          [p.id, p.email, p.name, p.hash, p.salt, JSON.stringify(SCRYPT)]);
      } else {
        await client.query(`
          update public.app_users
             set role='manager', status='active', local_hash=$1, local_salt=$2,
                 hash_params=$3::jsonb, must_change=true, password_set_at=now(),
                 updated_at=now()
           where lower(email)=$4`,
          [p.hash, p.salt, JSON.stringify(SCRYPT), p.email]);
      }
      /* بيان الصفة في sadara.users إن كان للحساب ملف: الصفة تُقرأ من هناك في
         بعض الشاشات، وتركها قديمة يعني مسيرًا يُعرض سباحًا. */
      const profile = await client.query('select uid, raw from sadara.users where lower(raw->>\'email\')=$1', [p.email]);
      if (profile.rowCount) {
        await client.query(`
          update sadara.users
             set raw = jsonb_set(jsonb_set(raw, '{role}', to_jsonb('manager'::text), true),
                                 '{roles}', to_jsonb(array['manager']::text[]), true)
           where uid=$1`, [profile.rows[0].uid]);
      }
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  const after = await pool.query(
    'select email, role, must_change from public.app_users where lower(email) = any($1) order by email',
    [TARGETS.map(t => t.email)]);
  console.log('\n=== بعد ===');
  for (const r of after.rows) console.log('  ' + r.email.padEnd(30) + r.role + ' · must_change=' + r.must_change);
  console.log('  owner untouched: ' + OWNER);

  console.log('\n  ==================================================');
  console.log('   كلمات المرور المؤقتة — تُقرأ الآن ولا تُعرض ثانية');
  for (const t of TARGETS) {
    console.log('   ' + t.email);
    console.log('   ' + passwords[t.email]);
    console.log('   ---------------------------------------------');
  }
  console.log('   must_change=true: تُغيَّر في أول دخول.');
  console.log('  ==================================================');
  console.log('\n  نسخة احتياطية: ' + backup);
  console.log('  Only the scrypt hashes were stored. Nothing was written to a file.');
  await pool.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
