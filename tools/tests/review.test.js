const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(PUBLIC, 'firebase-adapter.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const STORAGE = fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8');
const errors = [];
const pending = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (seed) w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => {};
  w.open = () => ({ document: { write() {}, close() {} }, focus() {}, close() {} });
  w.confirm = () => true; w.prompt = () => 'سبب'; w.alert = () => {};
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.__fetch = [];
  w.fetch = (u, i) => { w.__fetch.push({ url: String(u), method: (i && i.method || 'GET').toUpperCase() }); return Promise.resolve({ ok: true, json: async () => ({ ok: true, profile: {}, application_no: 'X' }) }); };
  let blobs = 0;
  w.URL.createObjectURL = () => 'blob:' + (++blobs);
  w.URL.revokeObjectURL = () => {};
  w.Blob = class { constructor(parts, o) { this.parts = parts; this.type = o && o.type; } };
  w.__blobs = () => blobs;
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,exportSwimmers:exportSwimmers,logDecision:logDecision,writeStorage:writeStorage,auditPage:auditPage,loadPublicData:loadPublicData,slashDate:slashDate,isoDate:isoDate,memberPhoto:memberPhoto,memberField:memberField};'); }
  catch (e) { errors.push('load: ' + e.message); }
  if (!w.__t) { console.error('LOAD ERROR:', errors.join(' | ')); throw new Error('app failed to load'); }
  if (seed && seed.user) w.__t.state.user = seed.user;
  return w;
}
const SW = [{ id: 'SDR-1', name: 'أمين, <script>alert(1)</script>', group: 'المبتدئون', phone: '0661', status: 'نشط', blood_group: 'O+' }];
const seed = (user, page) => ({ user, page, swimmers: SW, applications: [], schedules: [], subscriptions: [],
  notices: [], attendance: {}, attendanceByDay: {}, groups: [], extras: {}, audit: [] });

/* ---- storage quota must not break the app ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'home'));
  const real = w.localStorage.setItem.bind(w.localStorage);
  let fail = false;
  w.localStorage.setItem = (k, v) => {
    if (fail) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    return real(k, v);
  };
  w.__t.state.profile = { photo: 'data:image/jpeg;base64,' + 'A'.repeat(4000), name: 'x' };
  fail = true;
  let threw = false;
  try { w.__t.writeStorage(JSON.stringify(w.__t.state)); } catch (e) { threw = true; }
  if (threw) errors.push('a full localStorage crashes the save path');
  fail = false;
  // recovery: dropping the photo must let the write succeed
  w.__t.state.profile = { photo: 'data:image/jpeg;base64,' + 'A'.repeat(4000) };
  const ok = w.__t.writeStorage(JSON.stringify(w.__t.state));
  if (!ok) errors.push('save cannot recover after dropping the cached photo');
  if (JSON.parse(real.length ? w.localStorage.getItem('sadara-state') : '{}') === null) { /* noop */ }
}

/* ---- CSV export escaping and download ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'users'));
  let downloaded = null;
  w.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
  w.__t.exportSwimmers();
  if (!downloaded) errors.push('CSV export produced no download');
  else if (!/^السباحون-\d{4}-\d{2}-\d{2}\.csv$/.test(downloaded)) errors.push('CSV filename is not deterministic: ' + downloaded);
  else if (!/^swimmers|السباحون/.test(downloaded)) errors.push('unexpected CSV filename: ' + downloaded);
}

/* ---- decision trail ---- */
let auditSeen = false;
let auditPosted = false;
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'applications'));
  w.__t.state.applications = [{ id: 7, application_no: 'APP-7', first_name_ar: '\u0643\u0631\u064a\u0645', last_name_ar: '\u0632', status: 'pending', expected_amount: 1900 }];
  w.__t.render();
  const btn = w.document.querySelector('[data-action="approve-app"]');
  if (!btn) errors.push('approve button missing');
  else btn.click();
  const probe = w;
  setTimeout(() => {
    auditSeen = !!(probe.__t.state.audit || []).length;
    auditPosted = probe.__fetch.some(c => c.url === '/api/audit' && c.method === 'POST');
  }, 200);
}


/* ---- confirm dialog replaces window.confirm for destructive actions ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'users'));
  w.__t.state.swimmers = [{ id: 'SDR-9', name: 'حذفني', group: 'g', phone: '1', status: 'نشط' }];
  w.__t.render();
  let nativeConfirmFired = false;
  w.confirm = () => { nativeConfirmFired = true; return true; };
  const btn = w.document.querySelector('[data-action="delete-swimmer"]');
  if (!btn) errors.push('delete-swimmer button missing');
  else {
    btn.click();
    const modal = w.document.querySelector('.confirm-modal');
    if (!modal) errors.push('deleting a swimmer must show an in-app confirmation, not window.confirm');
    else {
      if (!modal.querySelector('[data-action="confirm-yes"]') || !modal.querySelector('[data-action="confirm-no"]')) errors.push('confirm dialog is missing its buttons');
      const dlg = modal.closest('.modal-backdrop');
      if (!dlg || dlg.getAttribute('role') !== 'dialog') errors.push('confirm dialog is missing role="dialog"');
      if (!dlg || dlg.getAttribute('aria-modal') !== 'true') errors.push('confirm dialog is missing aria-modal');
      if (!dlg || !dlg.getAttribute('aria-label')) errors.push('confirm dialog has no accessible name');
    }
    if (nativeConfirmFired) errors.push('destructive action still calls the native confirm()');
  }
}

/* ---- privacy: the roster must be closed to plain members ---- */
{
  const blockOf = name => {
    const at = RULES.indexOf('match /' + name + '/{id} {');
    if (at < 0) return '';
    return RULES.slice(at, RULES.indexOf('}', RULES.indexOf('allow', at)) + 1);
  };
  const sw = blockOf('swimmers');
  if (!sw) errors.push('swimmers rule block not found');
  else {
    if (/allow read: if signedIn\(\);/.test(sw)) errors.push('the roster is still readable by any signed-in account');
    if (!/staff\(\)/.test(sw)) errors.push('the roster does not use the staff() helper');
    if (!/allow write: if manager\(\)/.test(sw)) errors.push('the roster is not manager-writable');
  }
  const at = blockOf('attendance');
  if (/allow read: if signedIn\(\);/.test(at)) errors.push('attendance is still readable by any signed-in account');
  if (!/match \/audit_logs/.test(RULES)) errors.push('no audit_logs rule');
  if (!/request\.resource\.data\.status == 'pending'/.test(RULES)) errors.push('public sign-ups are not forced to pending');
  if (!/request\.auth\.uid == id/.test(RULES)) errors.push('members cannot read their own user document');
  if (!/member-photos/.test(STORAGE)) errors.push('storage has no member-photos rule');
  if (!/image\/\.\*/.test(STORAGE)) errors.push('member photo uploads are not restricted to images');
  if (!/member-photos/.test(STORAGE)) errors.push('storage has no member-photos rule');
  if (!/image\/\.\*/.test(STORAGE)) errors.push('member photo uploads are not restricted to images');
}

/* ---- adapter: hard read caps, roster filtering, audit endpoint ---- */
{
  if (!/limit\(ROW_LIMIT\)/.test(ADAPTER)) errors.push('adapter does not cap its reads');
  if (/orderBy\(/.test(ADAPTER)) errors.push('adapter still orders in the database (fragile against older documents)');
  if (!/staff|admin', 'president', 'coach'/.test(ADAPTER)) errors.push('adapter has no staff check on the roster read');
  if (!/path === '\/api\/audit'/.test(ADAPTER)) errors.push('adapter has no /api/audit endpoint');
  if (!/isStaff/.test(ADAPTER)) errors.push('roster read does not filter by role');
}

/* ---- accessibility basics ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'home'));
  w.__t.render();
  if (!w.document.querySelector('[aria-label]')) errors.push('no aria-labels anywhere on the shell');
  const theme = w.document.querySelector('[data-action="theme"]');
  if (theme && !theme.getAttribute('aria-label')) errors.push('the theme toggle has no accessible name');
  w.__t.action('login', null);
  const modal = w.document.querySelector('.modal-backdrop');
  if (!modal || !modal.getAttribute('role')) errors.push('the login dialog is missing role="dialog"');
  if (!modal || modal.getAttribute('aria-modal') !== 'true') errors.push('the login dialog is missing aria-modal');
  if (!w.document.activeElement || !w.document.activeElement.id) { /* focus may land late */ }
}

/* ---- the first paint must already be the final landing page ---- */
{
  // boot() runs while app.js is still evaluating, so a premature kick-off would
  // paint the legacy markup and every visitor would see stale invented numbers.
  const src = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  const kicks = [...src.matchAll(/^boot\(\);\s*$/gm)].map(m => src.slice(0, m.index).split('\n').length);
  if (kicks.length !== 1) errors.push('app.js must start the app exactly once, found ' + kicks.length);
  else {
    const at = src.indexOf('home=landingPage');
    const landingLine = at < 0 ? -1 : src.slice(0, at).split('\n').length;
    if (landingLine < 0) errors.push('the landing page layer is missing');
    else if (kicks[0] < landingLine) {
      errors.push('boot() at line ' + kicks[0] + ' runs before the landing layer at line '
        + landingLine + ', so the first paint is the legacy page');
    }
  }
  if (/\+\s*120\s*\u0633\u0628اح/.test(src)) {
    errors.push('an invented member count (+120) is still written into the source');
  }
  const w = boot({ user: null, page: 'home', swimmers: [], applications: [], schedules: [],
                   notices: [], subscriptions: [], attendance: {}, attendanceByDay: {},
                   groups: [], extras: {} });
  w.fetch = () => Promise.resolve({ ok: false, json: async () => ({}) });
  const first = w.document.querySelector('#app');
  if (!first || !first.innerHTML) errors.push('nothing rendered on the first paint');
  else {
    if (/\+\s*120/.test(first.innerHTML)) errors.push('the first paint still shows invented numbers');
    if (!/quick-strip/.test(first.innerHTML)) errors.push('the first paint is not the final landing page');
  }
}

/* The accounts panel, and the two things it must and must not offer.

   A check for this because the panel was built for removing accounts and then
   changed to merging them, and the old control was easy to leave in place: it
   sits on the same row, does almost the same thing, and looks perfectly
   reasonable. Two controls that differ only in what they destroy is how the wrong
   one gets pressed at the counter rather than in a test.

   So the finding is asserted three ways: the button says what it does, the reason
   is in the club's language rather than the code's, and there is no control left
   that removes anybody. */

/* Three things the club asked for, checked where they can be seen.

   The sheet's five columns and its row height, because a row height left to a
   browser is whatever the content wants -- and for a sheet whose cells are mostly
   empty that is a short sheet padded to full height, thirty swimmers across one
   and a half pages, which is the waste the club named.

   The week, because a limit that is only drawn on the page is a courtesy. It is
   checked here as an offer: seven days back and today, no more, and nothing in
   the future -- and the mark itself is checked to land under the day that was
   chosen, which is the part that can be quietly wrong and look right.

   And the photograph on the card, from both places it can be: the member's own
   copy, and the request they came from, which is where it is for everybody who
   joined before the member carried one. */

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const dayKey = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/* What a sheet carries for a roster of eight, with the third day's marks on it. */
const attendance_fixture = () => {
  const names = [
    ['مريم', 'بلعيد', '2014/03/12'], ['يوسف', 'قندوز', '2016/07/01'],
    ['آدم', 'بلعيد', '2012/11/30'], ['ليلى', 'قندوز', '1998/02/19'],
    ['سفيان', 'بلعيد', '2015/09/05'], ['نور', 'قندوز', '2013/01/22']
  ];
  const day = dayKey(2);
  const byDay = { [day]: {
    sw0: { status: 'present', at: day + 'T16:05:00.000Z' },
    sw1: { status: 'absent', at: '' },
    sw2: { status: 'late', at: '' }
  } };
  return {
    user: { role: 'president', id: 'u1' },
    groups: [{ name: 'المبتدئون' }, { name: 'المتقدمون' }],
    attendanceDate: day,
    attendanceByDay: byDay,
    swimmers: names.map((n, i) => ({
      id: 'sw' + i, name: n[0] + ' ' + n[1], first_name_ar: n[0], last_name_ar: n[1],
      birth_date: n[2], group: i % 2 ? 'المتقدمون' : 'المبتدئون'
    }))
  };
};

pending.push(Promise.resolve().then(() => {
  const w = boot(attendance_fixture());
  w.__t.state.page = 'attendance';
  w.__t.render();
  w.__t.action('print-attendance');
  const host = w.document.querySelector('.print-host');
  if (!host) { errors.push('[sheet] the attendance sheet printed nothing'); return; }

  /* The club's five columns, and not the screen's eight. */
  const heads = [...host.querySelectorAll('thead th')].map(t => t.textContent.trim());
  for (const want of ['الاسم', 'اللقب', 'تاريخ الميلاد', 'ملاحظة']) {
    if (heads.indexOf(want) === -1) errors.push('[sheet] the attendance sheet has no column for ' + want);
  }
  if (heads.indexOf('حاضر / غائب') === -1) {
    errors.push('[sheet] the attendance sheet has no column for presence: ' + heads.join(' | '));
  }
  if (heads.length !== 5) {
    errors.push('[sheet] the attendance sheet has ' + heads.length + ' columns; the club asked for five');
  }

  /* One swimmer, one row, with the two names apart and the day of birth read. */
  const first = host.querySelector('tbody tr');
  if (!first) { errors.push('[sheet] the sheet has no rows'); return; }
  const cells = [...first.querySelectorAll('td')].map(td => td.textContent.trim());
  if (cells[0] !== 'مريم' || cells[1] !== 'بلعيد') {
    errors.push('[sheet] the name is not in two columns: ' + cells[0] + ' / ' + cells[1]);
  }
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cells[2])) {
    errors.push('[sheet] the day of birth is not in the club\'s date, day first: ' + cells[2]);
  }
  /* And the marks are that day's, not today's -- the whole point of choosing. */
  if (cells[3] !== 'حاضر') {
    errors.push('[sheet] the status printed is "' + cells[3] + '" for a swimmer marked present two days back');
  }
  const ddmm = dayKey(2).split('-').reverse().join('/');
  if ((host.querySelector('.att-line') || {}).textContent.indexOf(ddmm) === -1) {
    errors.push('[sheet] the sheet does not name the session it is for');
  }

  /* The row height. A number in a stylesheet, checked here because the club gave
     the figure and it is the one number in this sheet that decides how much paper
     it uses. */
  const css = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  if (!/\.att-table tr\s*\{[^}]*height:\s*1\.2cm/.test(css)) {
    errors.push('[sheet] the rows are not 1.2 cm tall, which is the figure the club gave');
  }
  if (!/\.att-table tbody td\s*\{[^}]*border-bottom/.test(css)) {
    errors.push('[sheet] the rows have no rule between them, so a full sheet reads as a grey block');
  }
}));

pending.push(Promise.resolve().then(() => {
  const w = boot(attendance_fixture());
  w.__t.state.page = 'attendance';
  w.__t.render();

  const picker = w.document.getElementById('attendance-date');
  if (!picker) {
    errors.push('[session] the attendance page asks nothing about which session is being recorded');
    return;
  }
  /* A week back and today: eight days, and not one more. The limit the club asked
     for, drawn on the page rather than hidden in an attribute. */
  const keys = [...picker.options].map(o => o.value);
  if (keys.length !== 8) {
    errors.push('[session] the page offers ' + keys.length + ' sessions; a week back and today is eight');
  }
  if (keys[keys.length - 1] !== dayKey(0)) {
    errors.push('[session] the page offers a session in the future');
  }
  if (keys[0] !== dayKey(7)) {
    errors.push('[session] the page offers further back than a week: ' + keys[0]);
  }
  /* Written the club's way, with the day named -- a native date box would show its
     format in whatever language the browser is set to. */
  for (const o of picker.options) {
    if (!/\d{2}\/\d{2}\/\d{4}/.test(o.textContent)) {
      errors.push('[session] a session is offered without the club\'s date: "' + o.textContent.trim() + '"');
      break;
    }
  }
  if (picker.value !== dayKey(2)) {
    errors.push('[session] the page opened on ' + picker.value + ' rather than the session chosen');
  }

  /* And nothing on the page calls a backdated session "today". */
  const heading = (w.document.querySelector('.attendance-summary b') || {}).textContent || '';
  if (heading.indexOf('اليوم') !== -1) {
    errors.push('[session] the page still calls a backdated session "today": ' + heading);
  }
}));

pending.push(Promise.resolve().then(() => {
  const w = boot({
    user: { role: 'admin', id: 'u1' },
    swimmers: [
      /* Joined today: the member carries the photograph. */
      { id: 'sw1', name: 'مريم بلعيد', group: 'المبتدئون', photo: PIXEL },
      /* Joined before that: it is on the request they came from. */
      { id: 'APP-1', name: 'يوسف قندوز', group: 'المتقدمون', from_application: 'APP-1' },
      /* Nobody has a photograph at all. */
      { id: 'sw3', name: 'آدم بلعيد', group: 'المبتدئون' }
    ],
    applications: [{ id: 'APP-1', application_no: 'APP-1', photo: PIXEL }]
  });
  w.__t.state.page = 'card';
  w.__t.render();
  w.__t.action('print-cards');
  const host = w.document.querySelector('.print-host');
  if (!host) { errors.push('[card] printing the cards produced nothing'); return; }

  const cards = [...host.querySelectorAll('.lux-card')];
  if (cards.length !== 3) { errors.push('[card] ' + cards.length + ' cards were printed rather than three'); return; }

  /* Two of the three have a face: one from the member, one from the request. The
     photograph has been collected since the form was built and printed on the
     registration form; it stopped at the request, so the card printed the club's
     logo where a face should be. */
  const withFace = cards.filter(c => c.querySelector('.lux-photo-img')).length;
  if (withFace !== 2) {
    errors.push('[card] ' + withFace + ' of 3 cards carry a photograph; two of these three people have one');
  }
  /* And the one that has none is not given a face by mistake. */
  const last = cards[2];
  if (last.querySelector('.lux-photo-img')) {
    errors.push('[card] a member with no photograph was printed with one');
  }
}));

/* The club's four standing rules about this round, checked.

   The date order, because it is the change that could quietly destroy records:
   what a person reads is day first, what is stored is not. Both halves are
   asserted, and the second is the one that matters -- a platform that reads a date
   two ways is untidy, and a platform that stores it two ways is a queue whose order
   silently depends on which field was edited last.

   The photograph's size, because it was 8 mm on an 85 mm card for as long as the
   card existed, and it is checked here as a number rather than as a picture: two
   CSS rules were writing to the same photograph and the wrong one won on
   specificity, which is invisible on a screen and obvious on paper.

   The rows at 0.7 cm, and the attendance sheet at 1.2, both asserted separately
   -- because the point of writing the first is not to lose the second.

   And the note being optional: the field, the validator, and the message that told
   people to type "nothing" all three, because any one of them alone leaves a form
   that cannot be sent. */

pending.push(Promise.resolve().then(() => {
  const w = boot({ user: { role: 'admin', id: 'u1' } });
  w.__t.state.page = 'home';
  w.__t.render();

  const read = w.__t.slashDate, store = w.__t.isoDate;
  if (!read || !store) { errors.push('[dates] the platform has no date reader or writer to check'); return; }

  /* Day first out, for both orders in. */
  for (const [given, want] of [
    ['2026-10-11', '11/10/2026'],
    ['11/10/2026', '11/10/2026'],
    ['2026/1/5', '05/01/2026'],
    ['5-1-2026', '05/01/2026'],
    ['2026.01.05', '05/01/2026']
  ]) {
    const got = read(given);
    if (got !== want) errors.push('[dates] ' + JSON.stringify(given) + ' is read as ' + JSON.stringify(got) + ', not ' + want);
  }

  /* And stored in one shape whatever it was written in -- which is the whole
     reason the reader reads two orders. */
  for (const [given, want] of [
    ['2026-10-11', '2026-10-11'],
    ['11/10/2026', '2026-10-11'],
    ['2026/1/5', '2026-01-05'],
    ['5-1-2026', '2026-01-05'],
    ['13-9-2013', '2013-09-13'],
    ['13/09/2013', '2013-09-13']
  ]) {
    const got = store(given);
    if (got !== want) errors.push('[dates] ' + JSON.stringify(given) + ' is stored as ' + JSON.stringify(got) + ', not ' + want);
  }

  /* A first number that cannot be a day is read the only way it can be, rather
     than refused: refusing a date somebody meant is worse than reading it. */
  if (store('13/09/2013') !== '2013-09-13') errors.push('[dates] the 13th of September was not read');

  /* And text that is not a date is the empty string rather than a guess: a birth
     date that has been guessed is a member who is the wrong age for ever. */
  if (store('not a date') !== '') errors.push('[dates] a note was turned into a date');
}));

pending.push(Promise.resolve().then(() => {
  const css = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');

  /* The photograph: the fill rule has to beat the size rule on specificity, or the
     card prints a thumbnail. Checked as the pair, because either alone passes. */
  if (!/\.lux-photo > img\.lux-photo-img[^{]*\{[^}]*width:\s*100%\s*!important/.test(css)) {
    errors.push('[card] the photograph on the card is not sized by its frame, so a size rule wins on specificity');
  }
  if (!/\.lux-photo \{[^}]*width:\s*16mm[^}]*height:\s*21mm/.test(css)) {
    errors.push('[card] the photograph frame is not the size of an identity photograph');
  }
  /* The code, in one place and not three. */
  const qr = css.match(/\.lux-card \.qr-code,\s*\.lux-qr \.qr-code\s*\{[^}]*width:\s*9mm[^}]*height:\s*9mm/);
  if (!qr) errors.push('[card] the code on the card is not sized in one place at 9 mm');
  /* What governs, not what exists. An older rule from a print block is still in
     the file and is harmless only because the new one carries !important -- so
     asking that it be absent would be asking for something untrue. What can change
     is the rule that applies, and that is the last one to speak about the code. */
  const sizes = [...css.matchAll(/\.qr-code[^{]*\{[^{}]*width:\s*([\d.]+)mm/g)].map(m => m[1]);
  if (!sizes.length) {
    errors.push('[card] nothing in the stylesheet gives the code a size');
  } else if (sizes[sizes.length - 1] !== '9') {
    errors.push('[card] the code prints at ' + sizes[sizes.length - 1]
      + ' mm, which is the size that made it a quarter of the card');
  }
}));

pending.push(Promise.resolve().then(() => {
  const css = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');

  if (!/@media print\s*\{[^@]*\.print-table tr\s*\{\s*height:\s*0\.7cm/.test(css)) {
    errors.push('[rows] a printed table row is not 0.7 cm');
  }
  /* The attendance sheet is written on, and keeps the height a pen needs. Writing
     the first figure must not lose the second -- which is the whole risk in a
     blanket "every table". */
  if (!/\.att-table tr\s*\{\s*height:\s*1\.2cm\s*!important/.test(css)) {
    errors.push('[rows] the attendance sheet lost the 1.2 cm a pen needs');
  }
}));

pending.push(Promise.resolve().then(() => {
  const w = boot();
  const html = fs.readFileSync(path.join(PUBLIC, 'istimara', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(PUBLIC, 'istimara', 'istimara.js'), 'utf8');

  /* Optional in three places, because any one alone leaves a form that cannot be
     sent: the browser's own check, the validator's list, and the message that told
     people to type "nothing". */
  const note = (html.match(/<textarea id="notes"[^>]*>/) || [''])[0];
  if (/\brequired\b/.test(note)) {
    errors.push('[notes] the note is still required by the browser');
  }
  const list = js.match(/var required = \[[\s\S]*?\];/) || [''];
  if (/'notes'/.test(list[0])) {
    errors.push('[notes] the validator still asks for the note');
  }
  if (/اكتب ملاحظة/.test(js)) {
    errors.push('[notes] the form still tells people to write "nothing" in the note');
  }
  if (!/اختياري/.test(note)) {
    errors.push('[notes] the note does not say it is optional, so people will still write something');
  }
}));

pending.push(Promise.resolve().then(() => {
  const w = boot();
  const html = fs.readFileSync(path.join(PUBLIC, 'istimara', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(PUBLIC, 'istimara', 'istimara.css'), 'utf8');

  /* The button that changes what happens next, in the middle and in red -- the
     one control on the confirmation screen that is not a document. */
  const btn = (html.match(/<button[^>]*id="another"[^>]*>/) || [''])[0];
  if (!/btn-more/.test(btn)) {
    errors.push('[another] the button is still an outline, which is what it was when it went unnoticed');
  }
  if (!/\.btn-more\s*\{[^}]*margin:\s*0 auto/.test(css)) {
    errors.push('[another] the button is not centred on its own line');
  }
  if (!/\.btn-more\s*\{[^}]*background:\s*(var\(--danger|#[0-9a-f]{3,6})/i.test(css)) {
    errors.push('[another] the button is not red');
  }

  /* An eye on every password field, and on the registration form's two. */
  const app = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  if (!/function passwordEyes/.test(app)) {
    errors.push('[eye] the platform has no eye for a password field');
  }
  if (!/addEyes/.test(js())) {
    errors.push('[eye] the registration form has no eye for its password fields');
  }
  for (const id of ['password', 'password_confirm']) {
    if (!new RegExp('id="' + id + '"[^>]*type="password"').test(html)) {
      errors.push('[eye] the registration form no longer has a ' + id + ' field');
    }
  }
  function js() { return fs.readFileSync(path.join(PUBLIC, 'istimara', 'istimara.js'), 'utf8'); }

  /* And the two ways it usually goes wrong. */
  const eyes = (app.match(/function passwordEyes[\s\S]{0,2600}/) || [''])[0];
  if (eyes && !/eye\.type\s*=\s*'button'/.test(eyes)) {
    errors.push('[eye] the eye is not type="button", so it submits the form it sits in');
  }
  if (eyes && !/aria-pressed/.test(eyes)) {
    errors.push('[eye] the eye does not say whether the password is showing');
  }
}));

/* The eye, on a window that is built when it is opened.

   Checked by opening the sign-in window and counting, because the first version of
   this passed while doing nothing: the call was put in the `bind` written near the
   top of the platform, and a later layer reassigns `bind` -- so the call was in a
   function nothing reaches. Calling the helper directly put the eye there
   perfectly, which is what made it look right.

   So the check presses the thing that opens the window and then counts. The number
   of calls cannot be asserted, only the number of eyes -- and the number of eyes is
   what a person sees.

   And it is pressed twice, because a decoration that can be applied twice is a
   decoration that grows: two eyes in a field is a field nobody can read. */

pending.push(Promise.resolve().then(() => {
  const w = boot({ user: { role: 'admin', id: 'u1' } });
  w.__t.state.page = 'home';
  w.__t.render();

  w.__t.action('login');
  const field = w.document.getElementById('password');
  if (!field) { errors.push('[eye] the sign-in window did not open'); return; }

  const eyes = () => field.parentNode.querySelectorAll('.eye-toggle');
  if (eyes().length !== 1) {
    errors.push('[eye] the sign-in window has ' + eyes().length + ' eyes on its password field; it should have one');
    return;
  }

  /* Redrawing is what happens on every navigation, so that is when a second eye
     would appear -- and it is done through render(), which is how the page
     actually reaches the code, rather than by calling the binder by hand. */
  w.__t.render();
  w.__t.render();
  if (eyes().length !== 1) {
    errors.push('[eye] the password field grew to ' + eyes().length + ' eyes after being bound again');
  }

  const eye = eyes()[0];
  field.value = 'correct horse';
  const before = field.type;
  eye.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  if (field.type === before) errors.push('[eye] pressing it did not show the password');
  if (eye.getAttribute('aria-pressed') !== 'true') {
    errors.push('[eye] the eye does not say that the password is showing');
  }
  eye.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  if (field.type !== before) errors.push('[eye] pressing it again did not hide the password');
  if (eye.getAttribute('aria-pressed') !== 'false') {
    errors.push('[eye] the eye still says the password is showing');
  }
  if (field.value !== 'correct horse') {
    errors.push('[eye] looking at the password changed it');
  }
}));

const accounts_panel = () => {
  const w = boot({
    user: { role: 'admin', id: 'u1' },
    accounts: [
      { id: 'u1', name: 'صاحب النادي', email: 'a@b.dz', role: 'admin', owner: true },
      { id: 'dad', name: 'بلعيد', email: 'dad@x.dz', role: 'swimmer_adult' },
      { id: 'k1', name: 'مريم', email: 'k1@x.dz', role: 'parent' }
    ],
    duplicateAccounts: {
      checked: 3,
      merged: [{ id: 'k2', name: 'آدم', email: 'k2@x.dz', into: 'dad' }],
      groups: [{
        reason: 'guardian card', by: '0999123456789', keep: 'dad',
        accounts: [
          { id: 'dad', name: 'بلعيد', email: 'dad@x.dz', role: 'swimmer_adult', requests: 0, swimmers: 0 },
          { id: 'k1', name: 'مريم', email: 'k1@x.dz', role: 'parent', requests: 1, swimmers: 1 }
        ]
      }]
    }
  });
  w.__t.state.page = 'settings';
  w.__t.render();

  const panel = w.document.getElementById('accounts-panel');
  if (!panel) { errors.push('[accounts] the accounts panel is not on the settings page'); return; }
  const box = w.document.getElementById('duplicate-accounts');

  if (!panel.querySelector('[data-action="check-duplicate-accounts"]')) {
    errors.push('[accounts] there is no button to check for duplicated accounts');
  }

  /* The findings have to be on the page without the button being pressed a second
     time: this page is built as a string and put into the page afterwards, and
     reaching into the document for a box that does not exist yet finds nothing --
     which showed as a check that ran, answered, and left the panel empty. */
  if (!box) { errors.push('[accounts] the findings have nowhere to be shown'); return; }
  if (box.querySelectorAll('.dup-group').length !== 1) {
    errors.push('[accounts] the family the check found is not shown on the panel: '
      + box.querySelectorAll('.dup-group').length + ' groups');
  }

  /* What it does, said on the row. */
  const merges = box.querySelectorAll('[data-action="merge-account"]');
  if (merges.length !== 1) {
    errors.push('[accounts] the finding offers ' + merges.length + ' merges; one account is the one kept and one is not');
  }
  const btn = merges[0];
  if (btn.dataset.keep !== 'dad' || btn.dataset.id !== 'k1') {
    errors.push('[accounts] the merge button does not say which two accounts it merges');
  }
  /* What moves is on the button, because "merge two accounts" does not say whether
     the request filed under the other one comes with it. */
  if (!btn.dataset.held || btn.dataset.held.indexOf('طلب') === -1) {
    errors.push('[accounts] the merge button does not say what moves with the account');
  }

  /* The reason, in the club's words. The adapter sends a key on purpose, so a key
     printed raw is how this looks when nobody translated it. */
  const head = box.querySelector('.dup-group h4');
  if (!head) { errors.push('[accounts] a group of duplicates carries no reason'); }
  else if (/[A-Za-z]{4,}/.test(head.textContent)) {
    errors.push('[accounts] the reason a group is a group is still in code: ' + head.textContent.trim());
  }

  /* And nothing here removes anybody. */
  if (box.querySelector('[data-action="remove-duplicate-account"]')) {
    errors.push('[accounts] the panel still offers to remove an account');
  }
  if (box.querySelectorAll('[data-action="merge-account"]').length !== box.querySelectorAll('button').length) {
    errors.push('[accounts] the findings carry a control other than merging');
  }

  /* What was merged before stays on file and is said so, because "what happened to
     it" is the question somebody asks in six months. */
  if (box.textContent.indexOf('آدم') === -1) {
    errors.push('[accounts] an account that was merged before is not named anywhere on the panel');
  }
};

pending.push(Promise.resolve().then(accounts_panel));

/* ---- the printed sheet for the requests ---- */
/* The printed sheet for the requests.

   It is checked by counting rows rather than by looking at it, because the fault
   it had cannot be seen on the page: the rows were cells with no row around them,
   the parser made one row out of the first and lost the boundaries of the rest,
   and the sheet showed three rows where there were six. The summary band above it
   said six. Numbers right, headings right, table short, and nothing on the page
   said a row had gone.

   So the count is the check -- the count against the count in the summary band,
   which is the two numbers that disagreed. */
const sheet_fixture = () => {
  const day = n => ({ toDate: () => new Date('2026-03-' + String(n).padStart(2, '0')) });
  return {
    user: { role: 'president', id: 'me' },
    subscriptions: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000 }],
    extras: { transport: 900, uniform: 2500 },
    applications: [
      { id: 'a1', application_no: 'APP-20260312-DDDD', registration_id: 'E202610003', first_name_ar: 'يوسف', last_name_ar: 'بلعيد', category: 'minor', status: 'pending', phone: '0661000009', subscription_code: 'quarter', expected_amount: 1900, created_at: day(12) },
      { id: 'a2', application_no: 'APP-20260310-BBBB', first_name_ar: 'مريم', last_name_ar: 'قندوز', category: 'minor', status: 'pending', phone: '0661000001', subscription_code: 'quarter', expected_amount: 1000, created_at: day(10) },
      { id: 'a3', application_no: 'APP-20260308-CCCC', first_name_ar: 'آدم', last_name_ar: 'بلعيد', category: 'adult', status: 'pending', phone: '0661000003', subscription_code: 'quarter', expected_amount: 1000, created_at: day(8) },
      { id: 'a4', application_no: 'APP-20260220-EEEE', first_name_ar: 'ليلى', last_name_ar: 'قندوز', category: 'adult', status: 'approved', transferred_to: 'APP-20260220-EEEE', phone: '0661000004', expected_amount: 1000, created_at: day(20) },
      { id: 'a5', application_no: 'APP-20260105-CCCC', first_name_ar: 'نور', last_name_ar: 'بلعيد', category: 'minor', status: 'rejected', phone: '0661000005', created_at: day(5) },
      { id: 'a6', application_no: 'APP-20260101-AAAA', first_name_ar: 'سفيان', last_name_ar: 'قندوز', category: 'adult', status: 'rejected', phone: '0661000006', created_at: day(1) }
    ]
  };
};

pending.push(Promise.resolve().then(() => {
  const w = boot(sheet_fixture());
  w.__t.state.page = 'applications';
  w.__t.render();
  w.__t.action('print-applications');
  const host = w.document.querySelector('.print-host');
  if (!host) {
    errors.push('[sheet] printing the requests produced nothing');
    return;
  }

  const blocks = [...host.querySelectorAll('.roster-block')];
  if (blocks.length !== 3) {
    errors.push('[sheet] the sheet has ' + blocks.length + ' blocks, not three');
  }

  /* The two numbers that disagreed: the rows and the figures above them. */
  const rows = host.querySelectorAll('tbody tr').length;
  const said = [...host.querySelectorAll('.sheet-sum b')].map(n => Number(String(n.textContent).replace(/[^\d]/g, '')));
  const counted = said.slice(0, 3).reduce((m, n) => m + n, 0);
  if (rows !== counted) {
    errors.push('[sheet] the sheet prints ' + rows + ' rows and its own summary says ' + counted);
  }
  if (counted !== 6) {
    errors.push('[sheet] the summary counts ' + counted + ' requests where there are six');
  }

  /* And the order on paper is the order on the screen: work first, refusals last,
     and the whole of each newest first. */
  /* The request numbers of each block, row by row -- which is what "the order on
     paper" means. It used to be one number per block compared against a list
     drawn from the head of the first block. */
  const perBlock = [...host.querySelectorAll('.roster-block')].map(b =>
    [...b.querySelectorAll('tbody tr')].map(tr => {
      const cells = [...tr.querySelectorAll('td')];
      return (cells[1] ? cells[1].textContent.trim() : '');
    }));
  const underReview = perBlock[0] || [];
  if (underReview.join(',') !== 'APP-20260312-DDDD,APP-20260310-BBBB,APP-20260308-CCCC') {
    errors.push('[sheet] the requests under review are in this order: ' + underReview.join(', '));
  }
  const refused = perBlock[2] || [];
  if (refused.join(',') !== 'APP-20260105-CCCC,APP-20260101-AAAA') {
    errors.push('[sheet] the refusals are in this order: ' + refused.join(','));
  }
  if (refused[refused.length - 1] !== 'APP-20260101-AAAA') {
    errors.push('[sheet] the oldest refusal is not at the bottom of the sheet');
  }
  if (perBlock.length === 3 && perBlock[2][0] && underReview[0] === refused[0]) {
    errors.push('[sheet] a refusal is mixed in with the requests under review');
  }

  /* The columns the club reads, and the one it writes in. */
  const heads = [...host.querySelectorAll('thead th')].map(t => t.textContent.trim());
  for (const need of ['رقم الطلب', 'رقم التسجيل', 'الاسم واللقب', 'المبلغ', 'الهاتف', 'التوقيع']) {
    if (heads.indexOf(need) === -1) {
      errors.push('[sheet] the sheet has no column for ' + need);
    }
  }
  /* And it is signed for: a sheet that goes into a drawer unmarked is a sheet
     nobody can say was dealt with. */
  const signs = [...host.querySelectorAll('.sheet-sign span')].map(n => n.textContent.trim());
  if (signs.length < 3) {
    errors.push('[sheet] the sheet is not signed for: ' + signs.length + ' lines');
  }
}));
/* ---- the search boxes ---- */
function typeInto(w, id, text) {
  /* Focus first, then one character at a time: a check that sets the whole value
     in one go never sees the caret being thrown away. */
  const box = w.document.getElementById(id);
  if (!box) return null;
  box.focus();
  for (const ch of text) {
    const live = w.document.getElementById(id);
    live.value += ch;
    live.setSelectionRange(live.value.length, live.value.length);
    live.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
  const after = w.document.getElementById(id);
  return {
    held: after.value,
    focused: w.document.activeElement === after,
    caret: after.selectionStart
  };
}

/* How many rows a table is showing, not counting the "nothing found" row -- which
   is one row, and reads as a match to anything counting rows. */
function matchedRows(w) {
  return [...w.document.querySelectorAll('tbody tr')]
    .filter(tr => !tr.querySelector('.empty-cell') && !/لا توجد|لا يوجد/.test(tr.textContent))
    .length;
}

const search_boxes = () => {
  const seed = {
    user: { role: 'president' },
    applications: [
      { id: 'a1', application_no: 'APP-20260101-AAAA', first_name_ar: 'مريم', last_name_ar: 'بلعيد', status: 'pending', phone: '0661000001' },
      { id: 'a2', application_no: 'APP-20260102-BBBB', first_name_ar: 'أمين', last_name_ar: 'قندوز', status: 'pending', phone: '0661000002' }
    ],
    swimmers: [
      { id: 's1', name: 'مريم بلعيد', membership_no: 'E202610001', registration_id: 'E202610001', phone: '0661000001', group: 'المبتدئون' },
      { id: 's2', name: 'أمين قندوز', membership_no: 'E202610002', registration_id: 'E202610002', phone: '0661000002', group: 'المتقدمون' }
    ]
  };

  const go = (w, page, id, text) => {
    w.__t.state.page = page;
    w.__t.render();
    const box = w.document.getElementById(id);
    if (box) { box.value = ''; box.dispatchEvent(new w.Event('input', { bubbles: true })); }
    const got = typeInto(w, id, text);
    if (!got) { errors.push('[search] the ' + page + ' page has no box called ' + id); return null; }
    return { got, rows: matchedRows(w) };
  };

  /* The requests box. */
  const r1 = go(boot(seed), 'applications', 'app-search', 'مريم');
  if (r1) {
    if (!r1.got.focused) errors.push('[search] the requests box loses the focus after one letter');
    if (r1.got.caret !== r1.got.held.length) {
      errors.push('[search] the caret in the requests box jumped to ' + r1.got.caret
        + ' instead of staying at the end of what was typed');
    }
    if (r1.got.held !== 'مريم') {
      errors.push('[search] the requests box did not keep what was typed: ' + JSON.stringify(r1.got.held));
    }
    if (r1.rows !== 1) errors.push('[search] a name typed a letter at a time found ' + r1.rows + ' requests');
  }

  /* The swimmers' box, by the number on the card -- the one number a coach reads
     aloud at the gate. */
  const r2 = go(boot(seed), 'users', 'user-search', 'E202610002');
  if (r2) {
    if (!r2.got.focused) errors.push('[search] the swimmers box loses the focus after one letter');
    if (r2.got.caret !== r2.got.held.length) {
      errors.push('[search] the caret in the swimmers box jumped to ' + r2.got.caret);
    }
    if (r2.rows !== 1) errors.push('[search] the number on a member\'s card found ' + r2.rows + ' members');
  }

  /* The same number in the club's digits, as it is printed. One search folded
     these and the other did not, and which one did depended on the page. */
  /* The same ten digits the club writes, built rather than typed: a literal here
     came to nine digits and the check failed for a reason that had nothing to do
     with the code. */
  const arabic = '0661000002'.split('').map(d => String.fromCharCode(0x0660 + Number(d))).join('');
  const r3 = go(boot(seed), 'users', 'user-search', arabic);
  if (r3 && r3.rows !== 1) {
    errors.push('[search] a telephone number typed in the club\'s digits found ' + r3.rows + ' members');
  }
  const r4 = go(boot(seed), 'applications', 'app-search', arabic);
  if (r4 && r4.rows !== 1) {
    errors.push('[search] the same number on the requests page found ' + r4.rows + ' requests');
  }

  /* And the group, which is a word and not a number, still works. */
  const r5 = go(boot(seed), 'users', 'user-search', 'متقدم');
  if (r5 && r5.rows !== 1) errors.push('[search] searching by the group found ' + r5.rows + ' members');

  /* Something that matches nobody says so, rather than showing one row that
     looks like a match. */
  const r6 = go(boot(seed), 'users', 'user-search', 'z');
  if (r6 && r6.rows !== 0) errors.push('[search] a search matching nobody shows ' + r6.rows + ' rows');
};

pending.push(Promise.resolve().then(search_boxes));
/* ---- the order of the requests ---- */
/* The order of the requests, and what accepting one does to it.

   The order is three rules, easy to state and easy to get wrong: under review at
   the top newest first, refused at the bottom whatever its date, everything in
   between in the middle.

   The trap worth a check is the second one. A refusal from last March and a
   request from yesterday both have dates, and a sort that only looks at dates
   floats the refusal to the top -- which tells the manager the wrong thing about
   what needs deciding today.

   The transfer is the other half: accepting writes the member and marks the
   request, and the record stays. Marked, not deleted, because the registration
   numbers are counted out of these very documents -- a deleted request hands its
   number to the next swimmer, which is the one way this arrangement could give
   two people the same card.

   Driven through the real page rather than through the helper, so what is checked
   is the order a person sees. */
const queue_order = () => {
  const w = boot({ user: { role: 'president' } });
  const st = w.__t.state;
  const day = n => '2026-' + String(n).padStart(2, '0') + '-' + String(n).padStart(2, '0');

  st.applications = [
    { id: 'a1', application_no: 'APP-20260101-AAAA', status: 'rejected', created_at: { toDate: () => new Date(day(1)) } },
    { id: 'a2', application_no: 'APP-20260310-BBBB', status: 'pending', created_at: { toDate: () => new Date(day(10)) } },
    { id: 'a3', application_no: 'APP-20260105-CCCC', status: 'rejected', created_at: { toDate: () => new Date(day(5)) } },
    { id: 'a4', application_no: 'APP-20260312-DDDD', status: 'pending', created_at: { toDate: () => new Date(day(12)) } },
    { id: 'a5', application_no: 'APP-20260220-EEEE', status: 'approved', created_at: { toDate: () => new Date(day(20)) } },
    /* No readable date at all: it must not float to the top of the page. */
    { id: 'a6', application_no: 'APP-XXXXXXXX-FFFF', status: 'pending' }
  ];

  const w2 = boot();
  w2.__t.state.applications = st.applications;
  w2.__t.state.user = { role: 'president' };
  w2.__t.state.page = 'applications';
  w2.__t.render();

  const shown = [...w2.document.querySelectorAll('tbody tr')]
    .map(tr => (tr.textContent.match(/APP-\d{8}-[A-Z]{4}/) || [''])[0])
    .filter(Boolean);

  /* What the queue shows: the work at the top, the refusals at the bottom. The
     accepted request is not in it -- that is the thing being asked for. */
  const want = [
    'APP-20260312-DDDD',   /* under review, the newest */
    'APP-20260310-BBBB',   /* under review, the older */
    'APP-20260105-CCCC',   /* refused */
    'APP-20260101-AAAA'    /* refused, the older, at the very bottom */
  ];
  const got = shown.filter(no => want.indexOf(no) !== -1);

  if (got.join(',') !== want.join(',')) {
    errors.push('[queue] the requests are in this order:\n      ' + got.join('\n      ')
      + '\n    and the club asked for:\n      ' + want.join('\n      '));
  }

  /* The one with no readable date is not at the top. An unknown date is not a
     recent one. */
  if (shown[0] === 'APP-XXXXXXXX-FFFF') {
    errors.push('[queue] a request with no readable date was put at the top');
  }

  /* And a decided request is out of the queue, while a refusal stays in it -- the
     club still has to see a refusal, it just must not see it first. */
  if (shown.indexOf('APP-20260220-EEEE') !== -1) {
    errors.push('[queue] a request that has become a member is still in the queue');
  }
  for (const refused of ['APP-20260101-AAAA', 'APP-20260105-CCCC']) {
    if (shown.indexOf(refused) === -1) {
      errors.push('[queue] a refusal has left the list: ' + refused);
    }
  }
  /* The oldest refusal is last of all, not merely below the other refusal. */
  if (shown[shown.length - 1] !== 'APP-20260101-AAAA') {
    errors.push('[queue] the oldest refusal is not at the bottom');
  }

  /* Asked for, they are all there, in the same order. */
  const box = w2.document.getElementById('app-show-decided');
  if (!box) errors.push('[queue] there is no way to ask for the history back');
  else {
    box.checked = true;
    box.dispatchEvent(new w2.Event('change', { bubbles: true }));
    const withHistory = [...w2.document.querySelectorAll('tbody tr')]
      .map(tr => (tr.textContent.match(/APP-\d{8}-[A-Z]{4}/) || [''])[0])
      .filter(Boolean);
    if (!w2.__t.state.appShowDecided) {
      errors.push('[queue] the control for the history does nothing when it is used');
    } else if (withHistory.indexOf('APP-20260220-EEEE') === -1) {
      errors.push('[queue] the control was used and the page still hides the history');
    }
    /* And the accepted request belongs in the middle, not at either end -- that is
       the only place the "decided in the middle" half of the rule can be seen. */
    if (withHistory.indexOf('APP-20260220-EEEE') !== -1) {
      const at = withHistory.indexOf('APP-20260220-EEEE');
      if (at !== 2 || withHistory.length !== 5) {
        errors.push('[queue] with the history shown the order is '
          + withHistory.join(', ') + ' -- the decided one belongs in the middle');
      }
    }
    /* And asking for it does not change where a refusal sits. */
    const at = withHistory.indexOf('APP-20260101-AAAA');
    if (at !== withHistory.length - 1) {
      errors.push('[queue] asking for the history moved a refusal off the bottom');
    }
  }
};

pending.push(Promise.resolve().then(queue_order));
/* ---- the public page must show real data to a visitor ---- */
{
  const w = boot({ user: null, page: 'home', swimmers: [], applications: [], schedules: [],
                   notices: [], subscriptions: [], attendance: {}, attendanceByDay: {},
                   groups: [], extras: {} });
  const feeds = {
    '/api/subscription-plans': { plans: [
      { code: 'season', name: 'a', amount: 3000, duration: 'm', active: 1 },
      { code: 'off', name: 'b', amount: 0, duration: 'm', active: 0 } ] },
    '/api/schedule': [{ day_name: 'X', time_range: '10', group_name: 'g', coach: 'c' }],
    '/api/notices': [{ title: 'n', text: 't', kind: 'tadhkir', date: '2026-01-01' }]
  };
  const asked = [];
  w.fetch = (u) => { asked.push(String(u)); const k = String(u);
    return Promise.resolve({ ok: true, json: async () => feeds[k] || [] }); };
  pending.push(w.__t.loadPublicData().then(() => {
    for (const p of ['/api/subscription-plans', '/api/schedule', '/api/notices']) {
      if (!asked.includes(p)) errors.push('a visitor never fetched ' + p);
    }
    if (!w.__t.state.subscriptions.length) errors.push('a visitor sees no prices');
    if (w.__t.state.subscriptions.some(x => !x.active)) errors.push('an inactive plan leaked onto the public page');
    if (!w.__t.state.schedules.length) errors.push('a visitor sees no timetable');
    if (!w.__t.state.notices.length) errors.push('a visitor sees no announcements');
    const stats = w.eval('publicStats()');
    if (stats.some(x => /سباح/.test(x.label))) {
      errors.push('the member count is exposed to a signed-out visitor');
    }
    const doc = w.document.documentElement.outerHTML;
    if (!/quick-strip/.test(doc)) errors.push('the landing quick strip did not render');
    const dead = [...w.document.querySelectorAll('.landing [data-page]')];
    if (dead.length) errors.push('a landing control points at a dashboard a visitor cannot open: ' + dead.map(e => e.dataset.page).join(','));
    const kinds = [...w.document.querySelectorAll('.notice-card .notice-type')].map(e => e.textContent.trim());
    if (kinds.some(k => k === 'إعلان')) errors.push('the announcement kind is not read from the `kind` field');
  }));
}

Promise.all(pending).then(() => new Promise(r => setTimeout(r, 450))).then(() => {
  if (!auditSeen) errors.push('approving an application did not write an audit entry');
  if (!auditPosted) errors.push('audit entry was not posted to the API');
  if (errors.length) { console.log('REVIEW PROBLEMS (' + errors.length + '):\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
  console.log('Review checks passed: first paint, public page, quota safety, CSV, audit trail, confirm dialog, roster privacy, read caps, accessibility.');
}, 450);
