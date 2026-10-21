/* ملء رقم التعريف الوطني من الأرقام المؤكّدة فقط.
   ----------------------------------------------------------------------------
   القاعدة: لا يُحوَّل رقم قديم من تسعة أرقام، ولا يُخمَّن رقم. ما يُكتب هو:
     * رقم وليٍّ من طلب **معتمد**، طوله 18 رقمًا بعد التطبيع.
     * رقم سباح بالغ يحمل بطاقة بيومترية 18 رقمًا: هو وليٌّ على نفسه.
   ويُحدَّث به:
     sadara.applications.family_national_id
     sadara.swimmers.guardian_national_id (والسباح البالغ: رقمه هو)
   ولا تُمنح الأرقام لحساب موظّف لمجرّد أنه قدّم الطلب.

   التشغيل:
     node tools\neon\backfill-nin.js            (عرض فقط)
     node tools\neon\backfill-nin.js --write    (نسخة احتياطية ثم كتابة)
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const url = require('../neon-env').dbUrl();

const WRITE = process.argv.includes('--write');
const NOW = new Date();

function digits(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^0-9]/g, '');
}
const isNIN = value => /^[0-9]{18}$/.test(digits(value));
const rawOf = row => (row && row.raw && typeof row.raw === 'object') ? row.raw : {};
const idOf = p => String(p || '').split('/').pop();

function seasonStartYear(date) {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return new Date().getFullYear();
  return (d.getMonth() + 1) >= 9 ? d.getFullYear() : d.getFullYear() - 1;
}
function ageOn(birth, when) {
  const b = new Date(String(birth || '').slice(0, 10));
  if (isNaN(b.getTime())) return null;
  const w = when ? new Date(when) : new Date();
  let age = w.getFullYear() - b.getFullYear();
  const m = w.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && w.getDate() < b.getDate())) age--;
  return age;
}

(async () => {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const appRows = (await c.query(
    "select firestore_path, raw, status, category, created_at from sadara.applications " +
    "where application_type='swimmer' and status='approved'")).rows;
  const swimmerRows = (await c.query(
    'select firestore_path, raw, birth_date, created_at from sadara.swimmers')).rows;
  const swimmerByApp = {};
  for (const row of swimmerRows) {
    const app = String(rawOf(row).from_application || '').trim();
    if (app && !swimmerByApp[app]) swimmerByApp[app] = row;
  }

  const appUpdates = [];
  const swimmerUpdates = [];
  const seenFamily = new Set();
  for (const row of appRows) {
    const raw = rawOf(row);
    const guardianNin = digits(raw.guardian_national_id || raw.family_national_id);
    if (!isNIN(guardianNin)) continue;
    const appId = idOf(row.firestore_path);
    appUpdates.push({ path: row.firestore_path, id: appId, nin: guardianNin });
    seenFamily.add(guardianNin);
    const swimmer = swimmerByApp[appId];
    if (swimmer) {
      const sr = rawOf(swimmer);
      if (!isNIN(sr.guardian_national_id)) {
        swimmerUpdates.push({
          path: swimmer.firestore_path, id: idOf(swimmer.firestore_path),
          nin: guardianNin, reason: 'guardian of approved application'
        });
      }
    }
  }

  /* البالغ: بطاقته هي رقم عائلته. لا نأخذ رقمًا من طلب قاصر. */
  const season = seasonStartYear(NOW);
  for (const row of swimmerRows) {
    const raw = rawOf(row);
    const own = digits(raw.national_id);
    if (!isNIN(own)) continue;
    const age = ageOn(raw.birth_date || row.birth_date, String(season) + '-09-01');
    if (age === null || age < 18) continue;
    if (isNIN(raw.guardian_national_id)) continue;
    swimmerUpdates.push({
      path: row.firestore_path, id: idOf(row.firestore_path),
      nin: own, reason: 'adult is their own guardian'
    });
    seenFamily.add(own);
  }

  /* لا تكرار في التحديث: آخر سبب يفوز، والرقم نفسه. */
  const bySwimmer = {};
  for (const u of swimmerUpdates) bySwimmer[u.path] = u;
  const uniqueSwimmers = Object.values(bySwimmer);

  console.log('season: ' + season + (WRITE ? '  |  WRITE' : '  |  dry run'));
  console.log('approved applications with an 18-digit guardian NIN: ' + appUpdates.length);
  console.log('swimmers to link: ' + uniqueSwimmers.length);
  console.log('distinct family numbers: ' + seenFamily.size);
  for (const u of uniqueSwimmers.slice(0, 12)) {
    console.log('  ' + u.id + '  <- ' + u.nin + '  (' + u.reason + ')');
  }

  const backupFile = path.join(__dirname, '.backups',
    'nin-' + NOW.toISOString().replace(/[:.]/g, '-') + '.json');
  fs.mkdirSync(path.dirname(backupFile), { recursive: true });
  fs.writeFileSync(backupFile, JSON.stringify({ at: NOW.toISOString(), appUpdates, swimmerUpdates: uniqueSwimmers }, null, 2), 'utf8');
  console.log('\nbackup: ' + backupFile);

  if (!WRITE) {
    await c.end();
    console.log('\n-- dry run: nothing was written. Add --write to apply.');
    return;
  }

  await c.query('begin');
  try {
    for (const a of appUpdates) {
      await c.query(
        `update sadara.applications
           set family_national_id=$1,
               raw = raw || $2::jsonb
         where firestore_path=$3`,
        [a.nin, JSON.stringify({ family_national_id: a.nin }), a.path]);
    }
    for (const s of uniqueSwimmers) {
      await c.query(
        `update sadara.swimmers
           set guardian_national_id=$1,
               raw = raw || $2::jsonb
         where firestore_path=$3`,
        [s.nin, JSON.stringify({ guardian_national_id: s.nin }), s.path]);
    }
    await c.query('commit');
    console.log('\nwritten: ' + appUpdates.length + ' applications, '
      + uniqueSwimmers.length + ' swimmers. Nine-digit numbers were left untouched.');
  } catch (e) {
    await c.query('rollback');
    console.log('\nSTOPPED, nothing was written:', e.message);
    await c.end();
    process.exit(1);
  }
  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
