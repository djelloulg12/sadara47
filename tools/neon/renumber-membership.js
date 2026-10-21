/* إعادة ترقيم الانخراط زمنيًّا — بلا حذف وبلا تغيير صفّ.
   ----------------------------------------------------------------------------
   الصيغة: [S|C|R][سنة بداية الموسم][1|2|0][تسلسل من أربع خانات]

     * السباح: من الطلبات المعتمدة والسباحين، بترتيب تاريخ الإيداع/الإنشاء.
       التسلسل منفصل لكل موسم وفئة (1 أكابر، 2 أصاغر)، ويبدأ 0001.
     * المدرب: C + الموسم + 1 + تسلسل، ويُصفَّر كل موسم.
     * المسؤول: R + الموسم + 0 + تسلسل تراكمي لا يُصفَّر.

   التشغيل:
     node tools\neon\renumber-membership.js            (عرض فقط)
     node tools\neon\renumber-membership.js --write    (نسخة احتياطية ثم كتابة)

   لا يمسّ كلمة مرور ولا بريدًا ولا حالة. ويُحدّث:
     sadara.swimmers.membership_no + raw
     sadara.applications.membership_no + raw (الطلبات المعتمدة)
     public.app_users.member_no + sadara.users.raw (المدربون والمسؤولون)
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const url = require('../neon-env').dbUrl();

const WRITE = process.argv.includes('--write');
const NOW = new Date();
const SEASON = seasonStartYear(NOW);
const MEMBER_RE = /^[SCR][0-9]{4}[012][0-9]{4}$/;

function seasonStartYear(date) {
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return new Date().getFullYear();
  return (d.getMonth() + 1) >= 9 ? d.getFullYear() : d.getFullYear() - 1;
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value.__timestamp) {
    const d = new Date(value.__timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  const text = String(value);
  if (text.charAt(0) === '{') {
    try {
      const obj = JSON.parse(text);
      if (obj && obj.__timestamp) return asDate(obj.__timestamp);
    } catch (_) { /* ليست JSON */ }
  }
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function ageOnDate(birth, when) {
  const b = asDate(String(birth || '').slice(0, 10));
  if (!b) return null;
  const w = when ? new Date(when) : new Date();
  let age = w.getFullYear() - b.getFullYear();
  const m = w.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && w.getDate() < b.getDate())) age--;
  return age;
}

function categoryFor(birth, category, season) {
  const c = String(category || '').toLowerCase();
  if (c === 'adult') return '1';
  if (c === 'minor') return '2';
  const age = ageOnDate(birth, String(season) + '-09-01');
  return age !== null && age >= 18 ? '1' : '2';
}

function memberNo(prefix, season, category, serial) {
  return String(prefix) + String(season) + String(category)
    + String(serial).padStart(4, '0').slice(-4);
}

function rawOf(row) {
  return (row && row.raw && typeof row.raw === 'object') ? row.raw : {};
}

function idOf(pathText) {
  return String(pathText || '').split('/').pop();
}

function dateKey(item) {
  const d = item.at || NOW;
  return d.getTime();
}

(async () => {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const swimmerRows = (await c.query(
    'select firestore_path, raw, membership_no, birth_date, created_at from sadara.swimmers')).rows;
  const appRows = (await c.query(
    "select firestore_path, raw, status, application_type, category, birth_date, membership_no, created_at " +
    "from sadara.applications where application_type='swimmer' and status='approved'")).rows;
  const accountRows = (await c.query(
    'select id, email, role, member_no, created_at, updated_at, password_set_at ' +
    'from public.app_users order by created_at nulls last, email')).rows;

  const swimmers = swimmerRows.map(r => ({
    path: r.firestore_path,
    id: idOf(r.firestore_path),
    raw: rawOf(r),
    oldNo: String(r.membership_no || rawOf(r).membership_no || '').trim(),
    birth: rawOf(r).birth_date || r.birth_date || '',
    at: asDate(r.created_at) || asDate(rawOf(r).created_at)
  }));
  const swimmerByApp = {};
  for (const s of swimmers) {
    const appId = String(s.raw.from_application || '').trim();
    if (appId && !swimmerByApp[appId]) swimmerByApp[appId] = s;
  }

  const apps = appRows.map(r => ({
    path: r.firestore_path,
    id: idOf(r.firestore_path),
    raw: rawOf(r),
    oldNo: String(r.membership_no || rawOf(r).membership_no || '').trim(),
    birth: rawOf(r).birth_date || r.birth_date || '',
    category: rawOf(r).category || r.category || '',
    at: asDate(r.created_at) || asDate(rawOf(r).created_at)
  })).filter(a => a.raw.claim_only !== true);

  /* طابور السباحين: كل طلب معتمد، ثم كل سباح لم يُولد من طلب معتمد. */
  const queue = [];
  const linkedSwimmers = new Set();
  for (const a of apps) {
    const swimmer = swimmerByApp[a.id] || null;
    if (swimmer) linkedSwimmers.add(swimmer.id);
    queue.push({ kind: 'app', app: a, swimmer, at: a.at || (swimmer && swimmer.at) });
  }
  for (const s of swimmers) {
    if (!linkedSwimmers.has(s.id)) queue.push({ kind: 'swimmer', swimmer: s, at: s.at });
  }
  queue.sort((x, y) => {
    const d = dateKey(x) - dateKey(y);
    if (d) return d;
    const xn = String((x.app && x.app.id) || (x.swimmer && x.swimmer.id) || '');
    const yn = String((y.app && y.app.id) || (y.swimmer && y.swimmer.id) || '');
    return xn.localeCompare(yn);
  });

  const counters = {};
  const swimmerAssignments = [];
  for (const item of queue) {
    const birth = (item.swimmer && item.swimmer.birth) || (item.app && item.app.birth) || '';
    const season = seasonStartYear(item.at || NOW);
    const cat = categoryFor(birth, item.app && item.app.category, season);
    const key = season + '|' + cat;
    counters[key] = (counters[key] || 0) + 1;
    const no = memberNo('S', season, cat, counters[key]);
    if (item.app) item.app.newNo = no;
    if (item.swimmer) item.swimmer.newNo = no;
    swimmerAssignments.push({
      no, season, category: cat, at: item.at ? item.at.toISOString() : '',
      application: item.app ? item.app.id : '',
      swimmer: item.swimmer ? item.swimmer.id : '',
      old: (item.swimmer && item.swimmer.oldNo) || (item.app && item.app.oldNo) || ''
    });
  }

  /* المدربون: حساب بدور coach، ثم طلبات مدرب معتمدة بلا حساب مطابق. */
  const coachAccounts = accountRows.filter(a => String(a.role) === 'coach');
  const coachNumbers = [];
  let coachSerial = 0;
  for (const a of coachAccounts) {
    coachSerial += 1;
    const no = memberNo('C', SEASON, '1', coachSerial);
    a.newNo = no;
    coachNumbers.push({ no, email: a.email, old: a.member_no || '' });
  }

  /* المسؤولون: R تراكمي. الرقم الصالح يُحفظ تسلسله، والجديد يأخذ التالي. */
  const officials = accountRows.filter(a => ['admin', 'president', 'manager', 'owner'].indexOf(String(a.role)) !== -1);
  const usedOfficial = new Set();
  let nextOfficial = 1;
  for (const a of officials) {
    const m = /^R[0-9]{4}0([0-9]{4})$/.exec(String(a.member_no || ''));
    let serial = m ? Number(m[1]) : 0;
    if (!serial || usedOfficial.has(serial)) {
      while (usedOfficial.has(nextOfficial)) nextOfficial += 1;
      serial = nextOfficial;
    }
    usedOfficial.add(serial);
    nextOfficial = Math.max(nextOfficial, serial + 1);
    a.newNo = memberNo('R', SEASON, '0', serial);
  }

  console.log('season: ' + SEASON + (WRITE ? '  |  WRITE' : '  |  dry run'));
  console.log('swimmers in queue: ' + queue.length
    + '  |  approved applications: ' + apps.length
    + '  |  orphan swimmers: ' + (queue.length - apps.length));
  console.log('coach accounts: ' + coachAccounts.length
    + '  |  official accounts: ' + officials.length);
  console.log('');
  console.log('first swimmer numbers:');
  for (const a of swimmerAssignments.slice(0, 8)) {
    console.log('  ' + a.no + '  ' + (a.at || '—') + '  app=' + (a.application || '—')
      + '  swimmer=' + (a.swimmer || '—') + (a.old ? '  (old ' + a.old + ')' : ''));
  }
  console.log('last swimmer number: ' + (swimmerAssignments[swimmerAssignments.length - 1] || {}).no);
  if (coachNumbers.length) {
    console.log('coach numbers: ' + coachNumbers.map(x => x.no + ' ' + x.email).join(', '));
  }
  if (officials.length) {
    console.log('official numbers: ' + officials.map(x => x.newNo + ' ' + x.email).join(', '));
  }

  const backup = {
    at: NOW.toISOString(),
    season: SEASON,
    swimmers: swimmerAssignments,
    coaches: coachNumbers,
    officials: officials.map(a => ({ no: a.newNo, email: a.email, old: a.member_no || '' }))
  };
  const backupDir = path.join(__dirname, '.backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir,
    'membership-' + NOW.toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
  console.log('\nbackup: ' + backupFile);

  if (!WRITE) {
    await c.end();
    console.log('\n-- dry run: nothing was written. Add --write to apply.');
    return;
  }

  await c.query('begin');
  try {
    for (const item of queue) {
      if (item.app) {
        await c.query(
          `update sadara.applications
             set membership_no=$1, membership_season=$2,
                 legacy_membership_no=coalesce(legacy_membership_no, nullif($3,'')),
                 raw = raw || $4::jsonb
           where firestore_path=$5`,
          [item.app.newNo, String(seasonStartYear(item.at || NOW)), item.app.oldNo,
            JSON.stringify({ membership_no: item.app.newNo, membership_season: String(seasonStartYear(item.at || NOW)) }),
            item.app.path]);
      }
      if (item.swimmer) {
        await c.query(
          `update sadara.swimmers
             set membership_no=$1, membership_season=$2,
                 legacy_membership_no=coalesce(legacy_membership_no, nullif($3,'')),
                 raw = raw || $4::jsonb
           where firestore_path=$5`,
          [item.swimmer.newNo, String(seasonStartYear(item.at || NOW)), item.swimmer.oldNo,
            JSON.stringify({ membership_no: item.swimmer.newNo, membership_season: String(seasonStartYear(item.at || NOW)) }),
            item.swimmer.path]);
      }
    }
    for (const a of coachAccounts.concat(officials)) {
      await c.query(
        `update public.app_users
           set member_no=$1, membership_season=$2,
               legacy_member_no=coalesce(legacy_member_no, nullif($3,'')),
               updated_at=now()
         where id=$4`,
        [a.newNo, String(SEASON), a.member_no || '', a.id]);
      await c.query(
        `update sadara.users
           set member_no=$1, raw = raw || $2::jsonb
         where uid=$3`,
        [a.newNo, JSON.stringify({ member_no: a.newNo, membership_season: String(SEASON) }), a.id]);
    }
    await c.query('commit');
    console.log('\nwritten. ' + queue.length + ' swimmer/app rows, '
      + (coachAccounts.length + officials.length) + ' accounts.');
  } catch (e) {
    await c.query('rollback');
    console.log('\nSTOPPED, nothing was written:', e.message);
    await c.end();
    process.exit(1);
  }
  await c.end();
})().catch(e => { console.log('failed:', e.message); process.exit(1); });
