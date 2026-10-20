/* ماسح الحضور: من يفتحه، ومن يُسجَّل، ومن سجّل.

   الماسح يكتب على سجلّ أطفال. وثلاثة أسئلة فيه لا يجوز أن يُجاب عنها
   بالتخمين:

     1. من يفتحه؟ المسير والمدرب لا السباح ولا الولي. والجواب يُقرأ من
        ملفّين: الشاشة (`app.js`) والخادم (`firebase-adapter.js`) -- فدور
        يقبله أحدهما ويرفضه الآخر يملأ نموذجًا ثم يقرأ رفضًا.

     2. هل يُقابَل الرقم قبل أن يُكتب؟ بطاقة من نادٍ آخر أو رقم بخطأ حرف
        واحد يجب أن يُرفض بالاسم الذي قُرئ، لا أن يُكتب حضورًا لسباح آخر
        ولا أن يُسكَت عنه.

     3. هل يحمل سجل الحضور اسم من سجّله؟ يُكتب وقت الكتابة، لا يُشتقّ من
        حساب من يفتح الصفحة اليوم.

   وفحص رابع: الطريق. الرابط المطبوع على البطاقة (`?attendance=`) وزرّ
   المسح يجب أن يسلكا `recordPendingAttendance` نفسها، فلا يختلف حضور عن
   حضور بحسب الطريق الذي جاء منه. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'firebase-adapter.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const LAYER = fs.readFileSync(path.join(ROOT, 'tools', 'build', 'part-scan.js'), 'utf8');
const errors = [];

/* الزرّ والمسار اللذان يظهران في كل منصة: الاسم نفسه، حتى تُقرأ الأسئلة
   من المكان الذي يُنشر لا من نيّة كاتب. */
const SCAN_ROLES = ['admin', 'president', 'manager', 'coach'];
const FORBIDDEN_ROLES = ['member', 'parent', 'swimmer_adult', 'swimmer_minor'];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://sadara-platform.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (seed) w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => {};
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {};
  w.scrollTo = () => {};
  w.requestAnimationFrame = (fn) => { /* one frame, then stop: no camera here */ return 1; };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.addEventListener('unhandledrejection', e => errors.push('unhandled rejection: '
    + ((e.reason && e.reason.message) || e.reason)));
  try {
    w.eval(APP + '\n;window.__t={get state(){return state},set state(v){state=v},render:render,action:action,'
      + 'canScan:canScan,scanToken_:scanToken_,recordScan_:recordScan_,findScanned_:findScanned_,'
      + 'recorderLabel_:recorderLabel_,scanState_:scanState_,pageScan:pageScan,syncApi:syncApi,'
      + 'scanHandle_:scanHandle_};');
  } catch (e) { errors.push('load: ' + e.message); }
  w.__t.state.user = (seed && seed.user) || null;
  return w;
}

const tick = (ms) => new Promise(r => setTimeout(r, ms || 40));

function server(w, options) {
  const opts = options || {};
  w.__calls = [];
  w.fetch = async (url, init) => {
    const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    w.__calls.push({ url: String(url), method: method, body: body });
    if (String(url) === '/api/attendance' && method === 'POST') {
      if (opts.refuseAttendance) {
        return { ok: false, status: 403, json: async () => ({ error: 'خاص بالمسيرين والمدربين فقط.' }) };
      }
      return { ok: true, status: 201, json: async () => ({ ok: true, message: 'تم تسجيل الحضور بنجاح', recorded_by: opts.recorder || null }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  return w;
}

const callsTo = (w, url, method) => (w.__calls || []).filter(c => c.url === url && (!method || c.method === method));

const SWIMMERS = [
  { id: 'E202610001', membership_no: 'E202610001', registration_id: 'E202610001', name: 'عدنان قندوز', group: 'مبتدئ', group_name: 'مبتدئ', phone: '0661000001', status: 'نشط' },
  { id: 'E202610002', membership_no: 'E202610002', registration_id: 'E202610002', name: 'ياسين شريف', group: 'متوسط', group_name: 'متوسط', phone: '0661000002', status: 'نشط' }
];

function seed(user) {
  return {
    user: user || { id: 'u-manager', name: 'ك. رابح بن عيسى', role: 'admin', email: 'a@b.dz' },
    page: 'scan',
    swimmers: SWIMMERS.map(s => Object.assign({}, s)),
    groups: [{ id: 'g1', name: 'مبتدئ' }, { id: 'g2', name: 'متوسط' }],
    attendance: {}, attendanceByDay: {}, attendanceMap: {},
    applications: [], coaches: [], schedules: [], notices: [], subscriptions: [],
    coachRequirements: [], cards: [], cardsByMember: {}, extras: {}
  };
}

(async function run() {
  /* ================= 1. من يفتح الماسح ================= */

  /* القائمة نفسها في الشاشة وفي الخادم: لا دور يُقبل هنا ويردّ هناك. */
  {
    const pageList = (LAYER.match(/const SCAN_ROLES = \[([^\]]+)\]/) || ['', ''])[1]
      .split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    const serverList = (ADAPTER.match(/const SCANNER_ROLES = \[([^\]]+)\]/) || ['', ''])[1]
      .split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    if (!pageList.length || !serverList.length) {
      errors.push('[1] the roles that may scan are not written in both places');
    } else if (pageList.slice().sort().join(',') !== serverList.slice().sort().join(',')) {
      errors.push('[1] the page and the server disagree about who may scan: page '
        + JSON.stringify(pageList) + ' server ' + JSON.stringify(serverList));
    }
    for (const role of SCAN_ROLES) {
      if (serverList.indexOf(role) === -1) errors.push('[1] a ' + role + ' may not scan according to the server');
    }
    for (const role of FORBIDDEN_ROLES) {
      if (serverList.indexOf(role) !== -1) {
        errors.push('[1] a ' + role + ' may write attendance, which is the whole thing this restricts');
      }
    }
    if (ADAPTER.indexOf("['admin', 'president', 'coach']") !== -1) {
      errors.push('[1] the old three-role check is still in the adapter: a manager would be refused '
        + 'by the server after the page offered them the button');
    }
  }

  /* وسجل حضور يكتبه الماسح: الاجتماع 401 لمن لم يدخل، و403 لغيره. */
  {
    const post = ADAPTER.slice(ADAPTER.indexOf("path === '/api/attendance' && method === 'POST'"),
      ADAPTER.indexOf("path === '/api/attendance' && method === 'POST'") + 1400);
    if (!/scannerView\(/.test(post)) {
      errors.push('[1] the attendance write does not ask the scanner gate, so anybody signed in could mark a child present');
    }
    if (!/attendanceSession\(/.test(post)) {
      errors.push('[1] the attendance write stopped checking which session it is for');
    }
  }

  /* وفي الشاشة: زرّ الماسح لا يُضاف إلا لهما. */
  {
    const offeredScanner = (w) => w.document.querySelector('[data-page="scan"]')
      || w.document.querySelector('[data-role-page="scan"]');
    for (const role of ['admin', 'president', 'coach']) {
      const w = boot(seed({ id: 'u', name: 'م', role: role }));
      w.render();
      if (!offeredScanner(w)) errors.push('[1] a ' + role + ' is not offered the scanner in the navigation');
      if (!w.document.querySelector('[data-action="open-scan"]')) {
        errors.push('[1] a ' + role + ' is not offered the scanner button');
      }
    }
    for (const role of FORBIDDEN_ROLES) {
      const w = boot(seed({ id: 'u', name: 'م', role: role }));
      w.render();
      if (offeredScanner(w) || w.document.querySelector('[data-action="open-scan"]')) {
        errors.push('[1] a ' + role + ' is offered the scanner, and the server would refuse every press');
      }
      if (w.__t.canScan()) errors.push('[1] a ' + role + ' passes the page\'s own gate');
    }
  }

  /* ومن لا يحقّ له يفتح الصفحة: تُردّ إلى الرئيسية برسالة، ولا تُبنى الشاشة. */
  {
    const w = boot(seed({ id: 'u', name: 'ولي', role: 'parent' }));
    server(w);
    await w.__t.action('open-scan', { dataset: {} });
    await tick();
    if (w.__t.state.page === 'scan') {
      errors.push('[1] a parent was taken to the scanner');
    }
    if (w.document.querySelector('#scan-video')) {
      errors.push('[1] the camera page was drawn for somebody the server would refuse');
    }
    const toast = w.document.querySelector('.toast-message');
    if (!toast || !/المسير|المدرب/.test(toast.textContent)) {
      errors.push('[1] the refusal does not say in the club\'s words that this is for managers and coaches: "'
        + (toast ? toast.textContent.trim() : 'nothing') + '"');
    }
  }

  /* ودخول المسير: الصفحة تُبنى، وفيها المصدر والحقل اليدوي والقائمة. */
  {
    const w = boot(seed());
    server(w);
    await w.__t.action('open-scan', { dataset: {} });
    await tick();
    if (w.__t.state.page !== 'scan') errors.push('[1] a manager could not open the scanner');
    const box = w.document.querySelector('#scan-input');
    if (!box) errors.push('[1] the scanner page offers no way to type a number when the camera does not read');
    const who = w.document.querySelector('.groups-note');
    if (!who || who.textContent.indexOf('ك. رابح بن عيسى') === -1) {
      errors.push('[1] the page does not name the person whose name will be written on the marks');
    }
  }

  /* ================= 2. القراءة والمقابلة ================= */

  {
    const w = boot(seed());
    const tok = (v) => w.__t.scanToken_(v);
    if (tok('https://sadara-platform.web.app/?attendance=E202610001') !== 'E202610001') {
      errors.push('[2] the link printed on the card does not read back as a swimmer number');
    }
    if (tok('https://sadara-platform.web.app/?x=1&attendance=E202610001&y=2') !== 'E202610001') {
      errors.push('[2] the number is not read out of a link that carries other parameters');
    }
    if (tok('E202610001') !== 'E202610001') {
      errors.push('[2] a number read on its own -- a barcode scanner, or a person typing -- is refused');
    }
    if (tok('https://club.example/?member=E202610001') !== '') {
      errors.push('[2] a link from somewhere else is read as this club\'s attendance link');
    }

    /* والمقابلة بالسجل قبل الكتابة. */
    const known = w.__t.findScanned_('E202610002');
    if (!known || known.name !== 'ياسين شريف') {
      errors.push('[2] a number on a card is not matched to the swimmer it belongs to');
    }
    if (w.__t.findScanned_('E999999999') !== null) {
      errors.push('[2] a number nobody in the club carries was matched to somebody');
    }
  }

  /* رقم من نادٍ آخر: لا يُكتب، ويُقال كما قُرئ. */
  {
    const w = boot(seed());
    server(w);
    const result = await w.__t.recordScan_('https://other-club.example/?attendance=E999999999');
    if (result.kind !== 'unknown') {
      errors.push('[2] a card from another club was treated as "' + result.kind + '"');
    }
    if (callsTo(w, '/api/attendance', 'POST').length) {
      errors.push('[2] a number that matches nobody was written to attendance');
    }
    if (String(result.reason).indexOf('E999999999') === -1) {
      errors.push('[2] the refusal does not show the number it read, so nobody can tell why it was refused');
    }
  }

  /* ================= 3. من سجّل ================= */

  {
    const w = boot(seed());
    server(w, { recorder: { uid: 'u-manager', name: 'ك. رابح بن عيسى', role: 'admin', title: 'مسير' } });
    const result = await w.__t.recordScan_('E202610001');
    if (result.kind !== 'ok') errors.push('[3] a manager scanning a card did not record attendance: ' + result.kind);
    const put = callsTo(w, '/api/attendance', 'POST');
    if (put.length !== 1) {
      errors.push('[3] one scan wrote ' + put.length + ' attendance documents');
    } else if (put[0].body.member_id !== 'E202610001') {
      errors.push('[3] the mark was filed under the wrong swimmer: ' + JSON.stringify(put[0].body));
    }
    /* والوسم في القائمة: الاسم والصفة. */
    const label = w.__t.recorderLabel_('ك. رابح بن عيسى', 'coach');
    if (label !== 'ك. رابح بن عيسى (مدرب)') {
      errors.push('[3] the label beside a mark does not read "name (coach)": "' + label + '"');
    }
    if (w.__t.recorderLabel_('ك. رابح بن عيسى', 'admin') !== 'ك. رابح بن عيسى (مسير)') {
      errors.push('[3] a mark made by a manager is not labelled as a manager');
    }
  }

  /* والقائمة تحت الكاميرا تقول من سجّل والساعة. */
  {
    const w = boot(seed());
    server(w, { recorder: { uid: 'u-manager', name: 'ك. رابح بن عيسى', role: 'admin', title: 'مسير' } });
    await w.__t.action('open-scan', { dataset: {} });
    await tick();
    /* `scanHandle_` هي ما يستدعيه إطار الكاميرا فعلًا، فالقائمة تُقاس من
       الطريق الحقيقي لا من دالة الكتابة وحدها. */
    await w.__t.scanHandle_('E202610001');
    await tick();
    w.render();
    const row = w.document.querySelector('.scan-result.ok');
    if (!row) {
      errors.push('[3] a recorded scan does not appear in the list under the camera');
    } else {
      const text = row.textContent.replace(/\s+/g, ' ');
      if (text.indexOf('سجّله') === -1 || text.indexOf('ك. رابح بن عيسى') === -1) {
        errors.push('[3] the row does not name who recorded it: "' + text.slice(0, 90) + '"');
      }
      if (!/\d{2}:\d{2}:\d{2}/.test(text)) {
        errors.push('[3] the row does not carry the time of the scan: "' + text.slice(0, 90) + '"');
      }
    }
  }

  /* ونفس الاسم يُكتب في قاعدة البيانات، من الوثيقة لا من الحساب الذي يقرأ. */
  {
    const post = ADAPTER.slice(ADAPTER.indexOf("path === '/api/attendance' && method === 'POST'"),
      ADAPTER.indexOf("path === '/api/attendance' && method === 'POST'") + 1900);
    for (const field of ['marked_by_name', 'marked_by_role', 'recorded_by_name', 'recorded_by_role', 'marked_at']) {
      if (post.indexOf(field) === -1) {
        errors.push('[3] the attendance document does not carry ' + field
          + ', so the mark cannot say who made it or when');
      }
    }
    if (!/attendanceRecorder\(profile\)/.test(post)) {
      errors.push('[3] the recorder is not taken from the signed-in account at the moment of writing');
    }
    /* والصفة تُترجم في مكان واحد. */
    if (!/role === 'coach' \? 'مدرب' : 'مسير'/.test(ADAPTER)) {
      errors.push('[3] the recorder\'s title is not the club\'s word for the job');
    }
  }

  /* وسجل الحضور يُقرأ بالاسم من قاعدة البيانات، لا يُشتق من قارئ الصفحة. */
  {
    const start = APP.indexOf('const bucket={},byDay={}');
    const sync = start === -1 ? '' : APP.slice(start, APP.indexOf('state.attendance=bucket'));
    if (!sync) {
      errors.push('[3] the roster read could not be found, so nothing can be said about whether it keeps who recorded a mark');
    }
    for (const field of ['recorded_by_name', 'marked_by_name']) {
      if (sync.indexOf(field) === -1) {
        errors.push('[3] the roster read ignores ' + field
          + ', so every past mark would be shown as recorded by whoever opens the page');
      }
    }
    if (!/recorderRole/.test(APP)) {
      errors.push('[3] the recorder\'s title never reaches the page');
    }
  }

  /* ================= 4. البطاقة المكرّرة، والرفض، والطريق الواحد ================= */

  {
    const w = boot(seed());
    server(w);
    const first = await w.__t.recordScan_('E202610001');
    const again = await w.__t.recordScan_('E202610001');
    if (first.kind !== 'ok') errors.push('[4] the first scan did not record');
    if (again.kind !== 'repeat') {
      errors.push('[4] the same card within seconds was treated as "' + again.kind + '"');
    }
    if (callsTo(w, '/api/attendance', 'POST').length !== 1) {
      errors.push('[4] pointing one card at the camera twice wrote '
        + callsTo(w, '/api/attendance', 'POST').length + ' marks');
    }
    if (!/قبل قليل/.test(String(again.reason))) {
      errors.push('[4] a repeated card is not announced as already recorded: "' + again.reason + '"');
    }
  }

  /* ورفض الخادم رفض: لا حضور في الحالة المحلية، ويُقال نصًّا. */
  {
    const w = boot(seed());
    server(w, { refuseAttendance: true });
    const result = await w.__t.recordScan_('E202610001');
    if (result.kind !== 'refused') {
      errors.push('[4] a refusal from the server was reported as "' + result.kind + '"');
    }
    const mark = w.__t.state.attendanceByDay[Object.keys(w.__t.state.attendanceByDay)[0]];
    if (mark && mark.E202610001) {
      errors.push('[4] a refused scan was written into the page\'s own record, so the list would show a mark that does not exist');
    }
    if (String(result.reason).indexOf('خاص بالمسيرين') === -1) {
      errors.push('[4] the refusal is not shown in the server\'s own words: "' + result.reason + '"');
    }
  }

  /* والطريق واحد: الرابط المطبوع على البطاقة يمرّ من نفس دالة المنصة. */
  {
    const fn = APP.match(/async function recordPendingAttendance\(\)\{[\s\S]*?\}/);
    if (!fn) {
      errors.push('[4] the platform no longer has a single way of recording a scanned card');
    } else if (!/api\/attendance/.test(fn[0])) {
      errors.push('[4] recordPendingAttendance no longer writes attendance');
    }
    const scanPost = LAYER.match(/'\/api\/attendance'/g) || [];
    if (scanPost.length !== 1) {
      errors.push('[4] the scanner writes attendance in ' + scanPost.length
        + ' places; one card must go down one code path');
    }
  }

  /* ================= 5. الإخراج والخامس: الشكل ================= */

  {
    for (const sel of ['.scan-stage', '.scan-video', '.scan-frame', '.scan-result', '.scan-row']) {
      if (!new RegExp(sel.replace(/\./g, '\\.') + '(?![\\w-])').test(CSS)) errors.push('CSS missing ' + sel);
    }
    if (!/@media \(max-width:640px\)\{[\s\S]{0,400}\.scan-stage/.test(CSS.replace(/\r/g, ''))) {
      errors.push('the scanner is not laid out for the phone it is held on');
    }
    for (const sel of ['.recorder-tag', '.recorder-cell', '.recorder-none']) {
      if (!new RegExp(sel.replace(/\./g, '\\.') + '(?![\\w-])').test(CSS)) errors.push('CSS missing ' + sel);
    }
    /* ومكان الكتابة في قاعدة البيانات يجب أن يبقى مقروءًا للعضو عن نفسه:
       منع غير المسير من الكتابة لا يجوز أن يمنع سباحًا من قراءة حضوره. */
    const rule = RULES.match(/match \/attendance\/\{id\} \{[\s\S]{0,400}?\n    \}/);
    if (!rule) {
      errors.push('there is no rule for attendance at all');
    } else {
      if (!/allow create, update: if scanner\(\)/.test(rule[0])) {
        errors.push('the rules do not let the scanner write attendance: ' + rule[0].replace(/\s+/g, ' '));
      }
      if (!/allow read: if scanner\(\) \|\| \(signedIn\(\) && swimmerDocIsMine/.test(rule[0])) {
        errors.push('restricting who may scan has closed a member off from reading their own attendance');
      }
    }
    /* والقاعدة تُقبل من يحتاجه الخادم: دورٌ يقبله الخادم ويردّه الحرس
       يعني نموذجًا يُملأ ثم يُقرأ رفضًا -- وهذا ما يحدث لصاحب دور
       `manager`: موجود في المنصة، و`manager()` في القواعد لا تعرفه. */
    const guard = RULES.match(/function scanner\(\) \{[\s\S]*?\n/);
    if (!guard) {
      errors.push('there is no scanner guard in the rules to match the one in the server');
    } else {
      if (!/staff\(\)/.test(guard[0])) {
        errors.push('the rules\' scanner guard does not accept the coach and the administration');
      }
      if (!/'manager'/.test(guard[0])) {
        errors.push('the rules\' scanner guard does not accept the manager role the server accepts');
      }
    }
  }

  /* ================= 6. من سجّل في قائمة الحضور وفي ورقة الفوج ================= */

  {
    /* قائمة الحضور: عمود «سجّله» يحمل الاسم والصفة والساعة بالثواني. */
    const page = APP.slice(APP.indexOf('function pageAttendance()'), APP.indexOf('function pageNotices()'));
    if (!/سجّله/.test(page)) {
      errors.push('[6] the attendance list has no column saying who recorded each mark');
    }
    if (!/recorderTag\(a\)/.test(page)) {
      errors.push('[6] the attendance list does not read the recorder out of the mark');
    }
    if (!/slice\(11,19\)/.test(page)) {
      errors.push('[6] the attendance list shows the time without seconds, so two near-identical scans read the same');
    }
    /* والوسم يُقرأ من الحقل، ولا يُشتق من الحساب الذي يقرأ. */
    const tag = APP.match(/function recorderTag\(a\)\{[\s\S]*?\n\}/);
    if (!tag) {
      errors.push('[6] there is no such thing as a recorder tag');
    } else {
      if (!/a\.recorder/.test(tag[0]) || !/a\.recorderRole/.test(tag[0])) {
        errors.push('[6] the recorder tag does not read the name and the title off the mark');
      }
      if (/state\.user/.test(tag[0])) {
        errors.push('[6] the recorder tag falls back on whoever is looking at the page');
      }
    }

    /* ورقة الفوج: عمود «سجّله» موجود، ويُملأ من العلامة لا من الطابع. */
    if (!/col-recorder/.test(APP)) {
      errors.push('[6] the printed group sheet has no column for the recorder');
    }
    if (!/recorderTag\(recorders\[/.test(APP)) {
      errors.push('[6] the printed group sheet never fills the recorder column from what was recorded');
    }
    const collect = APP.slice(APP.indexOf('function groupRosterRecorders_'), APP.indexOf('function groupRosterDoc_'));
    if (/state\.user/.test(collect)) {
      errors.push('[6] the printed sheet attributes marks to whoever prints it');
    }
  }

  if (errors.length) {
    console.log('SCANNER PROBLEMS (' + errors.length + '):');
    for (const e of [...new Set(errors)]) console.log('  - ' + e);
    process.exit(1);
  }
  console.log('Only the manager and the coach may scan, the card is matched before it is written, and every mark carries who made it.');
  process.exit(0);
})();
