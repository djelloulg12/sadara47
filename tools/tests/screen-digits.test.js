/* The platform's own screens, in the club's digits.

   The printed sheets and the public form are checked elsewhere. This is the
   dashboard: the lists a manager reads all day, where a number is read off a
   screen and typed into another one. Every number in the club's digits and every
   date written year/month/day, on every page that shows either.

   Rendered through the real page rather than through the helper, because a check
   of the helper proves the helper works and not that the page calls it. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const errors = [];

const USER = { id: 'u1', name: 'رئيس النادي', role: 'admin', email: 'a@b.dz', phone: '0661000009' };

/* Records in the shape the database holds them: Latin digits and ISO dates,
   because that is what is written there. A page that showed them unchanged would
   be showing the database's form rather than the club's. */
const SWIMMERS = [
  { id: 'SDR-0042', name: 'أمين بلعيد', group: 'المبتدئون', phone: '0661000001', status: 'نشط' },
  { id: 'SDR-0043', name: 'ياسين شريف', group: 'المتقدمون', phone: '0661000002', status: 'نشط' }
];
const APPLICATIONS = [
  { id: 'APP-20261011-33A7', application_no: 'APP-20261011-33A7', registration_id: 'E202610001',
    application_type: 'swimmer', category: 'minor', first_name_ar: 'مبل', last_name_ar: 'قندوز',
    subscription_code: 'quarter', expected_amount: 3600, status: 'pending', phone: '0661000003',
    birth_date: '2013-09-14', transport: true, uniform: true },
  { id: 'COACH-1', application_no: 'APP-20261004-C1', application_type: 'coach',
    coach_name: 'سليم بلعيد', coach_phone: '0662000000', status: 'approved' }
];
const NOTICES = [
  { id: 'n1', title: 'فتح التسجيل', text: 'التسجيل مفتوح.', date: '2026-10-02', type: 'مهم' },
  { id: 'n2', title: 'تذكير', text: 'الحضور قبل الموعد.', date: '2026-10-01', type: 'تذكير' }
];
const SCHEDULES = [
  { id: 1, day_name: 'السبت', time_range: '16:00 - 17:30', group_name: 'المبتدئون', coach: 'سليم', pool: 'المسبح', date: '2026-10-10' }
];
const ATTENDANCE = {
  'SDR-0042': [{ status: 'present', at: '2026-10-10T09:00:00Z', date: '2026-10-10' }]
};

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => {};
  w.open = () => ({ document: { html: '', open() { return this; }, write(h) { this.html += h; }, close() { } }, focus() { }, print() { }, close() { } });
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () { };
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action};'); }
  catch (e) { errors.push('load: ' + e.message); }
  return w;
}

function seedOf(page) {
  return {
    user: USER, page, swimmers: SWIMMERS, applications: APPLICATIONS,
    notices: NOTICES, schedules: SCHEDULES, attendance: ATTENDANCE,
    attendanceByDay: { '2026-10-10': { 'SDR-0042': 'present' } },
    subscriptions: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر', active: true }],
    extras: {}, plans: [], facilities: [], pendingAttendance: {}
  };
}

/* What a person reads, with the markup taken out. */
const visible = html => String(html)
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Latin digits that are not part of the layout or the markup: the numbers inside
   an inline style or a class name are measurements and names, not readings, and
   a check that counted them would be a check that could never pass.

   Two more are left on purpose. The attendance chart's axis -- 100%, 75%, 50%,
   25%, 0% -- is a fixed scale the club reads against rather than a measurement of
   anything; the percentage inside each bar, which *is* a measurement, is in the
   club's digits and the check below covers it. And A4 is the size of the paper. */
const reading = text => text
  /* The chart's axis, matched as the one run it is drawn as. Value by value would
     also strip a bare 0%, which is what an empty bar reads -- and then the check
     could no longer tell an axis label from a reading. */
  .replace(/100%\s*75%\s*50%\s*25%\s*0%/g, ' ')
  .replace(/\bA4\b/g, ' ')
  .replace(/\b\d+(\.\d+)?(mm|px|rem|%|vh|vw|em|fr)\b/g, ' ')
  .replace(/\b(?:grid|flex|row|col|span|line|page|step|card|btn|nav|sec|pt|px)-\d+\b/gi, ' ');

const PAGES = [
  ['home', 'لوحة التحكم'],
  ['members', 'السباحون'],
  ['attendance', 'الحضور'],
  ['schedule', 'البرنامج'],
  ['notices', 'الإعلانات'],
  ['applications', 'الطلبات']
];

for (const [page, what] of PAGES) {
  const w = boot(seedOf(page));
  /* The signed-in state is put on after the page has loaded, as it is in life:
     somebody arrives, signs in, and the shell is built around them. Left to the
     stored state this renders the landing page, which shows no numbers at all --
     a check that then passes by looking at the wrong thing. */
  w.__t.state.user = USER;
  w.__t.state.page = page;
  try { w.__t.render(); } catch (e) { errors.push('[' + page + '] the page did not render: ' + e.message); continue; }
  const text = reading(visible(w.document.body.innerHTML));

  const latin = text.match(/[0-9]+/g) || [];
  if (latin.length) {
    errors.push('[' + page + '] the ' + what + ' screen shows Latin digits: '
      + Array.from(new Set(latin)).slice(0, 12).join(' '));
  }
  /* A date left as the database holds it -- 2026-10-02 -- is a date the club does
     not write. Written year/month/day and in Arabic-Indic digits it reads
     2026/10/02. */
  if (/\d{4}-\d{2}-\d{2}/.test(text)) {
    const found = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
    errors.push('[' + page + '] a date is shown as the database holds it: '
      + Array.from(new Set(found)).slice(0, 4).join(' '));
  }
  const arabicDates = text.match(/[0-9]{4}\/[0-9]{2}\/[0-9]{2}/g) || [];
  void arabicDates;
}

/* The one screen that must carry a date in the club's form, so the rule above is
   not satisfied by a page that simply shows no date at all. */
{
  const w = boot(seedOf('notices'));
  w.__t.state.user = USER;
  w.__t.state.page = 'notices';
  w.__t.render();
  const text = reading(visible(w.document.body.innerHTML));
  if (!/[0-9]{4}\/[0-9]{2}\/[0-9]{2}/.test(text)) {
    errors.push('[notices] no date is written year/month/day in Arabic-Indic digits, '
      + 'so the check above cannot tell a converted date from a missing one: ' + text.slice(0, 200));
  }
}

/* And a number on the same screen, so that check is not satisfied by nothing. */
{
  const w = boot(seedOf('members'));
  w.__t.state.user = USER;
  w.__t.state.page = 'members';
  w.__t.render();
  const text = reading(visible(w.document.body.innerHTML));
  if (!/[0-9]{4}/.test(text)) {
    errors.push('[members] no membership number is written in Arabic-Indic digits: ' + text.slice(0, 200));
  }
  if (/SDR-0042/.test(text)) {
    errors.push('[members] the membership number is shown in the digits the database holds');
  }
}

if (errors.length) {
  console.log('\nPROBLEMS (' + errors.length + '):');
  for (const e of errors) console.log('   - ' + e);
  process.exit(1);
}
console.log('PASS  every screen reads its numbers and dates the way the club writes them');