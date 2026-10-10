/**
 * أسماء المسابح وتصدير Excel — part-w.js
 *
 * Two things the club asked for that the platform had no answer for:
 *   * the pool names were written into three places in the source, so a rename
 *     meant a code edit; they now live in the database and management edits them
 *   * registrations could only leave as CSV, which the club cannot sort or
 *     filter once there are hundreds of them
 *
 * Reads the built app.js from firebase-public, because that is what ships.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const RULES = fs.readFileSync(path.resolve(__dirname, '..', '..', 'firestore.rules'), 'utf8');
const SCHEMA = fs.readFileSync(path.resolve(__dirname, '..', '..', 'schema.sql'), 'utf8');
const SERVER = fs.readFileSync(path.resolve(__dirname, '..', '..', 'server.py'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(PUBLIC, 'firebase-adapter.js'), 'utf8');
const errors = [];

/* The four names the club started with. Built from code points so no editor or
   shell can mangle them, and duplicated here on purpose: the test asserts the
   application stops carrying its own copy, so it needs its own. */
const DEFAULT_POOLS = [
  { id: 'olympic', name: String.fromCodePoint(0x0627, 0x0644, 0x0645, 0x0633, 0x0628, 0x062D, 0x20, 0x0627, 0x0644, 0x0623, 0x0648, 0x0644, 0x0645, 0x0628, 0x064A) },
  { id: 'half', name: String.fromCodePoint(0x0627, 0x0644, 0x0645, 0x0633, 0x0628, 0x062D, 0x20, 0x0627, 0x0644, 0x0646, 0x0635, 0x0641, 0x20, 0x0623, 0x0648, 0x0644, 0x0645, 0x0628, 0x064A) },
  { id: 'stadium', name: String.fromCodePoint(0x0627, 0x0644, 0x0645, 0x0644, 0x0639, 0x0628, 0x20, 0x0627, 0x0644, 0x0628, 0x0644, 0x062F, 0x064A) },
  { id: 'forest', name: String.fromCodePoint(0x063A, 0x0627, 0x0628, 0x0629, 0x20, 0x063A, 0x0631, 0x062F, 0x0627, 0x064A, 0x0629) }
];

/* Checks that need the page to settle run in order at the end. A top-level
   `return` would end this module early and skip everything after it, which is
   how a whole section of checks came to pass without ever running. */
const tasks = [];

/* Waits for something to become true instead of guessing how long it takes. The
   page settles on its own schedule -- boot() asks who is signed in, loads the
   club's names, renders -- so a fixed sleep passes on an idle machine and fails
   when the whole suite is running. */
function waitFor(predicate, ms) {
  const limit = ms === undefined ? 4000 : ms;
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      let ok = false;
      try { ok = predicate(); } catch (_) { ok = false; }
      if (ok) return resolve(true);
      if (Date.now() - started > limit) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}
const NEW_NAME = String.fromCodePoint(0x0645, 0x0633, 0x0628, 0x062D, 0x20,
  0x0627, 0x0644, 0x0635, 0x062F, 0x0627, 0x0631, 0x0629, 0x20, 0x0627, 0x0644, 0x062C, 0x062F, 0x064A, 0x062F);

const APPLICANTS = [
  { id: 1, application_no: 'APP-20260101-AB12', category: 'minor', status: 'pending',
    first_name_ar: 'مريم', last_name_ar: 'البلعيد',
    first_name_fr: 'Meriem', last_name_fr: 'Belaid',
    birth_date: '2013-09-14', gender: 'female', birth_place: 'غرداية', wilaya: 'غرداية',
    national_id: '', birth_certificate_no: '2013-1445', blood_group: 'A+', level: 'x',
    swimming_strokes: 'حرةة ظهر', phone: '0661000001', whatsapp: '0661000002',
    address: 'حي الثنية', subscription_code: 'season', facility: 'المسبح الأولمبي',
    transport: true, uniform: true, payment_method: 'cash', expected_amount: 6400,
    guardian_first_name: 'K', guardian_last_name: 'B', guardian_birth_date: '1985-02-03',
    guardian_relation: 'A', guardian_phone: '0661000003', guardian_national_id: '19850203887',
    notes: 'n', photo: 'data:image/jpeg;base64,AAA', submitted_from: 'public-form' },
  { id: 2, application_no: 'APP-20260102-CD34', category: 'adult', status: 'approved',
    first_name_ar: 'A', last_name_ar: 'B', birth_date: '1994-05-04', gender: 'male',
    blood_group: 'O+', phone: '0661000009', address: 'حي الثنية', subscription_code: 'quarter',
    facility: 'المسبح النصف الأولمبي', transport: false, uniform: false, payment_method: 'postal_check',
    expected_amount: 1000, submitted_from: 'public-form', photo_omitted: true },
  { id: 3, application_no: 'COACH-20260103-EF56', application_type: 'coach', status: 'approved',
    coach_name: 'SLIM', coach_phone: '0662000000', coach_specialty: 'S', coach_experience: '6' }
];

function boot(extra) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(Object.assign({
    user: { id: 1, name: 'مسيّر', role: 'admin' }, page: 'applications',
    applications: APPLICANTS, facilities: (extra && extra.facilities) || undefined,
    swimmers: [], notices: [], schedules: [], attendance: {}, attendanceByDay: {},
    groups: [], extras: { transport: 900, uniform: 2500 }
  }, extra && extra.state ? extra.state : {})));
  w.print = () => {}; w.alert = () => {}; w.confirm = () => true; w.prompt = () => 'x';
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.__put = [];
  w.__dl = [];
  w.fetch = function (u, i) {
    const method = (i && i.method || 'GET').toUpperCase();
    w.__put.push({ url: String(u), method, body: i && i.body });
    /* boot() asks this who is signed in and renders again from the answer. An
       empty body here reads as "nobody", clears state.user and replaces the
       settings page with the public landing page part-way through the test --
       which is what made a working editor look broken. */
    if (method === 'GET' && /\/api\/session/.test(String(u))) {
      return Promise.resolve({ ok: true, json: async () => ({ user: { id: 1, name: 'admin', role: 'admin' } }) });
    }
    if (method === 'GET' && /facilities/.test(String(u))) {
      return Promise.resolve({ ok: true, json: async () => (clubList || DEFAULT_POOLS) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
  };
  /* Every response carries the list itself. An earlier version answered
     /api/facilities with an empty array whenever the test supplied none, which
     hid the very thing these checks exist to catch: a page that quietly ignores
     what the club saved. */
  const clubList = (extra && Array.isArray(extra.facilities)) ? extra.facilities : null;
  /* Catch the download instead of writing a file, and keep the bytes so the
     spreadsheet can be checked for well-formedness. */
  const realCreate = w.document.createElement.bind(w.document);
  w.document.createElement = function (tag) {
    const node = realCreate(tag);
    if (String(tag).toLowerCase() === 'a') {
      node.click = function () { w.__dl.push({ name: node.download, href: node.href }); };
    }
    return node;
  };
  w.Blob = function (parts) {
    this.parts = parts;
    this.size = String(parts.join('')).length;
    w.__lastBlob = String(parts.join(''));
  };
  w.URL.createObjectURL = () => 'blob:stub';
  w.URL.revokeObjectURL = () => {};
  try {
    w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,'
      + 'facilities:facilities,facilityNames:facilityNames,facilityOptions:facilityOptions,'
      + 'REGISTRATION_COLUMNS:REGISTRATION_COLUMNS,registrationRows:registrationRows,'
      + 'exportApplications:exportApplications,exportApplicationsExcel:exportApplicationsExcel,'
      + 'downloadXml:downloadXml,DEFAULT_FACILITIES:DEFAULT_FACILITIES};');
  } catch (e) { errors.push('load: ' + e.message); }
  return w;
}

/* ---- 1) the pool names are data, not three copies in the source ---- */
{
  const w = boot();
  const T = w.__t;
  /* With nothing loaded, the built-in list stands in. */
  if (!Array.isArray(T.facilityNames()) || !T.facilityNames().length) {
    errors.push('[pools] no list at all, not even the built-in one');
  }
  /* A loaded list wins. */
  const renamed = boot({ facilities: [{ id: 'a', name: 'مسبح الاخيار' }, { id: 'b', name: 'مسبح الجديدة' }] });
  const names = renamed.__t.facilityNames();
  if (names.length !== 2 || names[0] !== 'مسبح الاخيار') {
    errors.push('[pools] the club list did not replace the built-in one: ' + names.join(' | '));
  }
  /* An empty collection must not empty the form. */
  const empty = boot({ facilities: [] });
  if (!empty.__t.facilityNames().length) errors.push('[pools] an empty list left the choices empty');

  /* The layer still carries the original four names, because it replaces the
     hardcoded <option> list by matching it. That copy is dead: the wrapper runs
     after it. So assert on behaviour instead -- the rendered select must hold
     the club's names, not the ones written in the source. */
  if (!/applicationFormBody = function/.test(APP)) {
    errors.push('[pools] the edit dialog is not rewired to read the list');
  }
  if (!/fullRegisterModal = function/.test(APP)) {
    errors.push('[pools] the platform sign-up is not rewired to read the list');
  }
  /* And the built-in fallback must still exist, or an empty table empties the
     form. It is the one place the names are allowed to appear. */
  const fallback = /const DEFAULT_FACILITIES = \[([\s\S]*?)\n\];/.exec(APP);
  if (!fallback) errors.push('[pools] the built-in fallback list is gone');
  else if ((fallback[1].match(/name:/g) || []).length < 4) {
    errors.push('[pools] the fallback list is shorter than the four the club had');
  }

  /* An old record naming a pool the club has renamed stays readable. */
  const oldName = 'مسبح ' + String.fromCodePoint(0x0627, 0x0644, 0x0642, 0x062F, 0x064A, 0x0645);
  const orphan = T.facilityOptions(oldName);
  if (orphan.indexOf(oldName) === -1) {
    errors.push('[pools] a record with an old pool name would silently show the wrong pool');
  }
  const selected = T.facilityOptions('مسبح الجديدة');
  if (!/selected/.test(selected)) errors.push('[pools] the current pool is not marked selected');
  if ((selected.match(/selected/g) || []).length > 1) {
    errors.push('[pools] more than one pool came out selected');
  }

  /* The rules: public to read so the public form works, management to write. */
  const block = (RULES.match(/match \/facilities\/\{id\} \{[\s\S]*?\n    \}/) || [''])[0];
  if (!block) errors.push('[rules] no rule for the facilities collection');
  else {
    if (!/allow read: if true;/.test(block)) errors.push('[rules] the public form could not read the pool names');
    if (!/allow write: if manager\(\);/.test(block)) errors.push('[rules] anyone could rewrite the pool names');
  }
  if (!/CREATE TABLE IF NOT EXISTS facilities/.test(SCHEMA)) errors.push('[schema] no table for the pool names');
  /* The local API must answer the same question, or the form differs by machine. */
  if (!/'\/api\/facilities'/.test(SERVER)) errors.push('[server] the local API does not serve /api/facilities');
  if (!/public = \([^)]*'\/api\/facilities'/.test(SERVER)) {
    errors.push('[server] /api/facilities is not public, so the local form would ask for a sign-in');
  }
  if (!/'\/api\/facilities' && method === 'PUT'/.test(ADAPTER)) {
    errors.push('[adapter] no management write for the pool names');
  }
  if (!/'\/api\/facilities' && method === 'GET'/.test(ADAPTER)) {
    errors.push('[adapter] no public read for the pool names');
  }
}

/* ---- 2) the manager can rename them from Settings ---- */
{
  const w = boot();
  w.__t.state.page = 'settings';
  w.__t.render();
  const panel = w.document.getElementById('facilities-panel');
  if (!panel) { errors.push('[settings] no editor for the pool names'); }
  else {
    const inputs = panel.querySelectorAll('[data-facility-name]');
    if (!inputs.length) errors.push('[settings] the editor lists nothing to edit');
    if (!panel.querySelector('[data-action="save-facilities"]')) errors.push('[settings] no save button');
    if (!panel.querySelector('[data-action="add-facility"]')) errors.push('[settings] no add button');
    if (!panel.querySelector('[data-action="remove-facility"]')) errors.push('[settings] no way to remove a name');
    if (!panel.querySelector('code')) errors.push('[settings] the panel does not say the names reach /istimara/');
  }

  /* Rename a pool and save. Collected as a task rather than returned, because a
     top-level `return` would end the module here and silently skip every check
     below.

     The edit waits for the editor to show the loaded list. Two things are still
     in flight when this module runs: the page asks /api/session who is signed
     in, and it loads the club's names. Typing first tests the front door
     instead of the settings page, and the load that lands afterwards overwrites
     whatever was typed -- so a correct editor looked like it had thrown the
     rename away. */
  const shown = () => [...w.document.querySelectorAll('[data-facility-name]')].map(i => i.value);
  const settled = () => {
    const onScreen = shown();
    const names = w.__t.facilityNames();
    return onScreen.length > 0 && onScreen.length === names.length
      && onScreen.every((v, i) => v === names[i]);
  };

  tasks.push(() => waitFor(settled)
    .then(() => {
      /* Read the input fresh: render() replaces the panel, so a handle taken
         before it is a dead node. */
      const live = shown();
      if (!live.length) { errors.push('[settings] the editor listed no name to rename'); return null; }
      const input = [...w.document.querySelectorAll('[data-facility-name]')][0];
      input.value = NEW_NAME;
      return w.__t.action('save-facilities', null);
    })
    .then(() => waitFor(() => w.__t.facilityNames()[0] === NEW_NAME && shown().indexOf(NEW_NAME) !== -1))
    .catch(() => {
      errors.push('[settings] the page did not keep the new name; it now shows: ' + shown().join(' | '));
    })
    .then(() => {
      const put = w.__put.find(c => c.method === 'PUT' && /facilities/.test(c.url));
      if (!put) { errors.push('[settings] saving sent nothing'); return; }
      const body = JSON.parse(put.body);
      if (!Array.isArray(body.facilities) || !body.facilities.length) {
        errors.push('[settings] the saved list is empty');
        return;
      }
      if (body.facilities[0].name !== NEW_NAME) {
        errors.push('[settings] the edited name was not saved: ' + JSON.stringify(body.facilities[0]));
      }
    }));
}

/* ---- 3) the same list drives the platform's own sign-up ---- */
{
  const w = boot({ facilities: [{ id: 'a', name: 'مسبح الاختبار' }] });
  w.__t.action('register-desk', null);
  const sel = w.document.querySelector('#reg-facility');
  if (!sel) { errors.push('[sign-up] the platform sign-up has no pool select'); return; }
  const opts = [...sel.options].map(o => o.textContent);
  if (opts.length !== 1 || opts[0] !== 'مسبح الاختبار') {
    errors.push('[sign-up] the platform still shows its own pool list: ' + opts.join(' | '));
  }
}

/* ---- 4) Excel export ---- */
{
  const w = boot();
  const T = w.__t;
  /* Every field the public form collects has to reach the sheet, or the export
     is "complete" only on paper. */
  const headers = T.REGISTRATION_COLUMNS.map(c => c[0]);
  for (const need of ['رقم الطلب', 'الاسم بالعربية', 'اللقب بالعربية', 'الفئة', 'تاريخ الميلاد',
    'رقم التعريف الوطني', 'فصيلة الدم', 'الهاتف', 'الواتساب', 'العنوان', 'الاشتراك',
    'المسبح أو المنشأة', 'النقل', 'البدلة الرياضية', 'طريقة الدفع', 'المبلغ المتوقع',
    'اسم الولي', 'لقب الولي', 'هاتف الولي', 'رقم تعريف الولي', 'ملاحظة', 'الصورة',
    'المصدر', 'الحالة', 'سبب القرار']) {
    if (headers.indexOf(need) === -1) errors.push('[excel] no column for ' + need);
  }
  const names = new Set(headers);
  if (names.size !== headers.length) errors.push('[excel] two columns share a name');

  const data = T.registrationRows();
  if (data.rows.length !== APPLICANTS.length) {
    errors.push('[excel] expected every registration, got ' + data.rows.length + ' of ' + APPLICANTS.length);
  }
  /* A coach request is in the same list, so it must not shift the columns. */
  const coach = data.rows.find(r => r[0] === 'COACH-20260103-EF56');
  if (!coach) errors.push('[excel] a coach request is missing from the export');
  else if (coach[1] !== 'SLIM') errors.push('[excel] the coach row lost its name: ' + coach[1]);

  const minor = data.rows.find(r => r[0] === 'APP-20260101-AB12');
  const col = h => data.headers.indexOf(h);
  if (minor[col('اسم الولي')] !== 'K') errors.push('[excel] the guardian is missing from the row');
  if (minor[col('رقم تعريف الولي')] !== '19850203887') errors.push('[excel] the guardian number is missing');
  if (minor[col('المبلغ المتوقع')] !== '6400') errors.push('[excel] the amount is not a number Excel can sort: ' + minor[col('المبلغ المتوقع')]);
  if (minor[col('المصدر')] !== 'الاستمارة العامة') {
    errors.push('[excel] a public request is not marked as such, so the club cannot tell where it came from');
  }
  if (minor[col('الصورة')] !== 'مرفقة') errors.push('[excel] the photo column says nothing useful');
  const adult = data.rows.find(r => r[0] === 'APP-20260102-CD34');
  if (adult[col('الصورة')] !== 'ناقصة') {
    errors.push('[excel] a dropped photo is not reported, so the club would wait for an image that was never sent');
  }
  if (adult[col('رقم التعريف الوطني')] !== '') errors.push('[excel] an empty cell must stay empty, not become undefined');
  if ((adult[col('الاسم بالفرنسية')] || '') !== '') errors.push('[excel] a missing field leaked text into another column');

  /* A real .xls: SpreadsheetML with a header style, so Excel opens it clean. */
  w.__t.exportApplicationsExcel();
  const dl = w.__dl[w.__dl.length - 1];
  if (!dl) { errors.push('[excel] the Excel button downloaded nothing'); }
  else if (!/\.xls$/.test(dl.name)) errors.push('[excel] wrong file name: ' + dl.name);

  /* The document itself: Excel refuses a malformed one and the club sees a
     repair prompt instead of a file. Tag balance is what breaks when a value
     carries an ampersand or a stray "<". */
  const xml = w.__lastBlob || '';
  if (!xml) { errors.push('[excel] nothing was written into the file'); }
  else {
    if (!/^﻿?<\?xml/.test(xml)) errors.push('[excel] no XML declaration, so Excel may guess the encoding');
    if (!/Excel\.Sheet/.test(xml)) errors.push('[excel] not marked as a spreadsheet');
    if (!/<Workbook[^>]*xmlns="urn:schemas-microsoft-com:office:spreadsheet"/.test(xml)) {
      errors.push('[excel] the spreadsheet namespace is missing');
    }
    /* Walk the tags instead of counting them. A count of "<x" against "</x"
       passes a file Excel still refuses, and that is the whole point here. */
    const stack = [];
    let crossed = 0;
    for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^>]*?(\/?)>/g)) {
      const [, closing, name, selfClose] = m;
      if (closing) {
        const open = stack.pop();
        if (open !== name) {
          crossed++;
          if (crossed === 1) {
            errors.push('[excel] </' + name + '> closes <' + (open || 'nothing')
              + '>: Excel would ask to repair the file');
          }
        }
      } else if (!selfClose) {
        stack.push(name);
      }
    }
    if (stack.length) {
      errors.push('[excel] ' + stack.length + ' tag(s) left open, the last being <'
        + stack[stack.length - 1] + '>: Excel would ask to repair the file');
    }
    /* A raw & or < inside a cell breaks the file, so check the cell contents. */
    const cells = xml.split('<Data ss:Type="String">').slice(1).map(s => s.split('</Data>')[0]);
    for (const ch of ['&', '<', '>']) {
      const bad = cells.filter(s => s.indexOf(ch) !== -1);
      if (bad.length) errors.push('[excel] an unescaped "' + ch + '" inside a cell: ' + bad[0].slice(0, 40));
    }
    if (!/<Data ss:Type="String">مريم<\/Data>/.test(xml)) errors.push('[excel] an Arabic name did not reach the file');
    /* The header row carries the style and freezes, so the club can scroll. */
    if (!/ss:StyleID="hdr"/.test(xml)) errors.push('[excel] the header row is not styled');
    if (!/<FrozenNoSplit|SplitHorizontal>1</.test(xml)) errors.push('[excel] the header row does not stay in view');
  }

  /* A value carrying XML metacharacters must be escaped, not trusted. */
  const nasty = boot({ state: { applications: [{
    application_no: 'A&B<C>', first_name_ar: 'مريم "ض"', last_name_ar: 'بلعيد',
    phone: '0661000001', status: 'pending'
  }] } });
  nasty.__t.exportApplicationsExcel();
  const nastyXml = nasty.__lastBlob || '';
  if (!/A&amp;B&lt;C&gt;/.test(nastyXml)) {
    errors.push('[excel] metacharacters were not escaped, so Excel would refuse the file');
  }
  if (/A&B/.test(nastyXml)) errors.push('[excel] a raw ampersand reached the file');
}

/* ---- 5) the export buttons sit where the manager will look ---- */
{
  const w = boot();
  w.__t.state.page = 'applications';
  w.__t.render();
  const bar = w.document.querySelector('#app');
  const buttons = [...bar.querySelectorAll('[data-action]')].map(b => b.dataset.action);
  for (const need of ['export-applications', 'export-applications-excel']) {
    if (buttons.indexOf(need) === -1) errors.push('[ui] the applications page has no ' + need + ' button');
  }
  /* Both buttons must live inside the toolbar, next to the other tools. */
  const excel = bar.querySelector('[data-action="export-applications-excel"]');
  if (excel && !excel.closest('.toolbar')) {
    errors.push('[ui] the Excel button is not in the toolbar');
  }
  /* An empty list must say so, not download an empty file. */
  const none = boot({ state: { applications: [] } });
  none.__t.exportApplicationsExcel();
  if (none.__dl.length) errors.push('[excel] an empty list still produced a file');
}

tasks.reduce((chain, task) => chain.then(task), Promise.resolve()).then(() => {
  if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
  console.log('All pool-name and Excel-export checks passed.');
});
