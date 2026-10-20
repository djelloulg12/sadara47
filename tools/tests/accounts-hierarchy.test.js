/* ============================================================================
   هيكلة الحسابات وكلمات المرور، وبطاقة الهاتف
   ============================================================================

   ما يقيسه هذا الملف، وكلّه أشياء تُكسر بصمت:

   ١. من يملك حساب من: المسير لا يمسّ مسيرًا آخر ولا مديرًا ولا صاحب النادي،
      ولا يرفع أحدًا إلى «مسير»؛ وصاحب النادي يملك ذلك كلّه إلا كلمة مروره هو.
   ٢. الكلمة المؤقتة تُولَّد في الخادم لا في الصفحة: الطلب يحمل معرّف الحساب
      وحده، والكلمة تعود في الردّ مرة واحدة، ويُرفع `must_change`.
   ٣. كلمة المرور الجماعية أُلغيت: ردّ 410 صريح، لا كلمة واحدة يعرفها الجميع.
   ٤. الهاتف يعرض بطاقة لا جدولًا: لا `min-width` على الجدول، ولا تمرير أفقي،
      وشريط ميدان ثابت بأزرار ٤٤ بكسل على الأقل.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const server = read('tools/neon/server/server.js');
const app = read('app.js');
const css = read('styles.css');

/* ---------------------------------------------------------------------------
   ١. قواعد الصلاحيات، كما تُنفَّذ فعلًا لا كما تُوصف.
   ------------------------------------------------------------------------- */
const R = require('../neon/server/roles');

const OWNERS = new Set(['kabrag12@gmail.com']);
const owner = { id: 'o1', email: 'kabrag12@gmail.com', role: 'admin', owner: true };
const manager = { id: 'm1', email: 'm.djelloulg12@gmail.com', role: 'manager' };
const coach = { id: 'c1', email: 'coach@x.dz', role: 'coach' };
const swimmer = { id: 's1', email: 'swim@x.dz', role: 'swimmer_minor' };
const otherManager = { id: 'm2', email: 'med.elfahem85@gmail.com', role: 'manager' };

const cases = [
  ['المسير يدير حساب سباح', R.canManageAccount(manager, swimmer, OWNERS), true],
  ['المسير يدير حساب مدرب', R.canManageAccount(manager, coach, OWNERS), true],
  ['المسير لا يدير مسيرًا آخر', R.canManageAccount(manager, otherManager, OWNERS), false],
  ['المسير لا يدير مديرًا', R.canManageAccount(manager, { role: 'admin', email: 'a@x.dz' }, OWNERS), false],
  ['المسير لا يدير رئيس النادي', R.canManageAccount(manager, { role: 'president', email: 'p@x.dz' }, OWNERS), false],
  ['المسير لا يدير صاحب النادي', R.canManageAccount(manager, owner, OWNERS), false],
  ['صاحب النادي يدير المسير', R.canManageAccount(owner, manager, OWNERS), true],
  ['صاحب النادي لا تُمسّ كلمة مروره من هنا', R.canManageAccount(owner, owner, OWNERS), false],
  ['المدرب لا يدير حسابًا', R.canManageAccount(coach, swimmer, OWNERS), false]
];
for (const [name, got, want] of cases) {
  if (got !== want) errors.push('roles: ' + name + ' -> ' + got + ' instead of ' + want);
}
if (R.MANAGER_ROLES.indexOf('manager') === -1) {
  errors.push('roles: «manager» ليس إداريًا، فالمسير يفتح صفحة يردّها الخادم');
}

/* ---------------------------------------------------------------------------
   ٢. مسارات الخادم: الحرّاس موجودة، والكلمة تُولَّد هناك.
   ------------------------------------------------------------------------- */
function routeBlock(name) {
  const start = server.indexOf("ROUTES['" + name + "']");
  if (start < 0) { errors.push('server: the route ' + name + ' is gone'); return ''; }
  const next = server.indexOf("\nROUTES['", start + 10);
  return server.slice(start, next < 0 ? start + 4000 : next);
}

const reset = routeBlock('POST /api/accounts/reset-password');
if (!reset) {
  errors.push('server: there is no per-person reset route');
} else {
  if (!/tempPassword\(\)/.test(reset)) errors.push('reset: the password is not generated on the server');
  if (!/mustChange:\s*true/.test(reset)) errors.push('reset: the temporary password does not force a change');
  if (/body\.password/.test(reset)) errors.push('reset: the page is allowed to choose the password');
  if (!/R\.isOwner\(target/.test(reset)) errors.push('reset: the owner account is not protected');
  if (!/R\.canManageAccount\(actor, target/.test(reset)) errors.push('reset: there is no check on who the target is');
  if (!/password,\s*must_change: true/.test(reset)) errors.push('reset: the password is never returned to the person who issued it');
}

const setRoute = routeBlock('POST /api/accounts/password');
if (!/R\.canManageAccount\(actor, target/.test(setRoute)) {
  errors.push('password: a manager could set another manager’s password');
}
if (!/R\.isOwner\(target/.test(setRoute)) {
  errors.push('password: the owner’s password could be set from the accounts page');
}

const putRoute = routeBlock('PUT /api/accounts');
if (!/role === 'manager' && !R\.isOwner/.test(putRoute)) {
  errors.push('accounts: appointing a manager is not reserved to the owner');
}
if (!/R\.canManageAccount\(actor, target/.test(putRoute)) {
  errors.push('accounts: a manager could change another manager’s role');
}

const defRoute = routeBlock('POST /api/accounts/default-password');
if (!/410/.test(defRoute)) errors.push('default-password: the shared password is still handed out');
if (/setPassword\(/.test(defRoute)) errors.push('default-password: it still writes one password to everyone');

const listRoute = routeBlock('GET /api/accounts');
if (!/must_change/.test(listRoute)) errors.push('accounts list: the page cannot tell a pending password from a set one');

const delRoute = routeBlock('DELETE /api/users/:uid');
if (!/R\.canManageAccount\(gate\.user/.test(delRoute)) {
  errors.push('delete user: a manager could delete a manager or the owner');
}

/* ---------------------------------------------------------------------------
   ٣. الصفحة: الصفوف المحميّة، والزرّ الذي يظهر لمن يحقّ له.
   ------------------------------------------------------------------------- */
const ACCOUNTS = [
  { id: 'o1', name: 'صاحب النادي', email: 'kabrag12@gmail.com', role: 'admin', owner: true, must_change: false },
  { id: 'm1', name: 'المسير الأول', email: 'm.djelloulg12@gmail.com', role: 'manager', owner: false, must_change: true },
  { id: 'm2', name: 'المسير الثاني', email: 'med.elfahem85@gmail.com', role: 'manager', owner: false, must_change: true },
  { id: 'c1', name: 'مدرب', email: 'coach@x.dz', role: 'coach', owner: false, must_change: true },
  { id: 's1', name: 'سباح', email: 'swim@x.dz', role: 'swimmer_minor', owner: false, must_change: false }
];

function seededState(user) {
  return {
    user, page: 'accounts', dark: false,
    notices: [], swimmers: [], applications: [], subscriptions: [], schedules: [],
    attendance: {}, attendanceByDay: {}, coachRequirements: [], groups: [],
    accounts: ACCOUNTS.slice(), extras: { transport: 900, uniform: 2500 }
  };
}

function boot(seed) {
  const html = read('firebase-public/index.html').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, {
    url: 'https://sadara-platform.web.app/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => {};
  w.URL.createObjectURL = () => 'blob:preview';
  w.URL.revokeObjectURL = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.alert = () => {};
  w.scrollTo = () => {};
  w.SADARA_LOCAL_API = true;
  w.__requests = [];
  w.fetch = async (url, opts) => {
    w.__requests.push({ url: String(url), body: (opts && opts.body) || '' });
    if (String(url).indexOf('/api/session') !== -1) {
      return { ok: true, json: async () => ({ user: seed.user }) };
    }
    if (String(url).indexOf('reset-password') !== -1) {
      return { ok: true, json: async () => ({ ok: true, email: 'coach@x.dz', password: 'K7QF9MTX4BHP2RDN', must_change: true }) };
    }
    return { ok: true, json: async () => ACCOUNTS };
  };
  w.eval(read('firebase-public/app.js')
    + '\n;window.__t={get state(){return state},set state(v){state=v},render:render,action:action,pageView:pageView};');
  /* boot() may replace the user from the session; the fixture is put back after
     it, as the other suites do, so the render measures the role under test. */
  w.__t.state.user = seed.user;
  w.__t.state.page = seed.page;
  w.__t.state.accounts = ACCOUNTS.slice();
  return w;
}

function rowFor(w, email) {
  return [...w.document.querySelectorAll('.account-row')]
    .find(r => r.textContent.indexOf(email) !== -1) || null;
}

/* --- المسير ينظر: يرى المدرب والسباح، ولا يرى صفّ مسير آخر ولا المالك --- */
{
  const w = boot(seededState(manager));
  w.render();

  if (!w.document.getElementById('accounts-panel')) {
    errors.push('page: the manager has no accounts page at all');
  } else {
    const self = rowFor(w, 'm.djelloulg12@gmail.com');
    const boss = rowFor(w, 'kabrag12@gmail.com');
    const fellow = rowFor(w, 'med.elfahem85@gmail.com');
    const coached = rowFor(w, 'coach@x.dz');

    if (!coached) errors.push('page: the coach row is missing');
    if (self && self.querySelector('select')) errors.push('page: the manager can change their own role');
    if (boss && (boss.querySelector('select') || boss.querySelector('[data-action="reset-account-password"]'))) {
      errors.push('page: the owner row offers a control to a manager');
    }
    if (fellow && (fellow.querySelector('select') || fellow.querySelector('[data-action="reset-account-password"]'))) {
      errors.push('page: one manager can act on the other manager’s account');
    }
    if (coached) {
      if (!coached.querySelector('[data-action="reset-account-password"]')) {
        errors.push('page: there is no reset button for a coach');
      }
      const opts = [...coached.querySelectorAll('select option')].map(o => o.value);
      for (const bad of ['manager', 'admin', 'president']) {
        if (opts.includes(bad)) errors.push('page: a manager is offered the role «' + bad + '»');
      }
    }
    if (!w.document.querySelector('.pass-pending')) {
      errors.push('page: a pending temporary password is not marked on its row');
    }
  }
}

/* --- صاحب النادي ينظر: يرى «مسير» في القائمة، ويستطيع تعيينه --- */
{
  const w = boot(seededState(owner));
  w.render();
  const fellow = rowFor(w, 'med.elfahem85@gmail.com');
  if (!fellow) {
    errors.push('page/owner: the manager row is missing');
  } else {
    const opts = [...fellow.querySelectorAll('select option')].map(o => o.value);
    if (!opts.includes('manager')) errors.push('page/owner: the owner cannot appoint a manager from the page');
    if (!fellow.querySelector('[data-action="reset-account-password"]')) {
      errors.push('page/owner: the owner cannot reset a manager’s temporary password');
    }
  }
  const boss = rowFor(w, 'kabrag12@gmail.com');
  if (boss && (boss.querySelector('select') || boss.querySelector('[data-action="reset-account-password"]'))) {
    errors.push('page/owner: the owner’s own password is offered on the accounts page');
  }
}

/* --- إعادة التعيين: الطلب يحمل المعرّف وحده، والكلمة تظهر مرة واحدة --- */
(async () => {
  const w = boot(seededState(owner));
  w.render();
  const coached = rowFor(w, 'coach@x.dz');
  if (coached) {
    const btn = coached.querySelector('[data-action="reset-account-password"]');
    await w.__t.action('reset-account-password', btn);
    const sent = w.__requests.filter(r => r.url.indexOf('reset-password') !== -1);
    if (!sent.length) {
      errors.push('reset: no request reached the server');
    } else {
      let body = {};
      try { body = JSON.parse(sent[0].body || '{}'); } catch (_) {}
      if (String(body.id) !== 'c1') errors.push('reset: the request does not name the account');
      if ('password' in body) errors.push('reset: the page chose the password instead of the server');
    }
    const modal = w.document.getElementById('temp-password-modal');
    if (!modal) {
      errors.push('reset: the temporary password is never shown');
    } else {
      const shown = modal.querySelector('#temp-password-value');
      if (!shown || shown.textContent.indexOf('K7QF9MTX4BHP2RDN') === -1) {
        errors.push('reset: the modal does not show the password that was set');
      }
      await w.__t.action('close-temp-password', modal.querySelector('[data-action="close-temp-password"]'));
      if (w.document.getElementById('temp-password-modal')) errors.push('reset: the modal cannot be closed');
    }
    const row = (w.__t.state.accounts || []).find(a => a.id === 'c1');
    if (row && row.must_change !== true) errors.push('reset: the row is not marked as waiting for a change');
  }

  /* -------------------------------------------------------------------------
     ٤. الهاتف: البطاقة، لا الجدول.
     ---------------------------------------------------------------------- */
  const marker = '/* ================= الهاتف: من الجدول إلى البطاقة';
  const phone = css.slice(css.lastIndexOf(marker));
  if (!/\.table-scroll table\{min-width:0!important/.test(phone)) {
    errors.push('phone: the table keeps its 650px floor, so the page still scrolls sideways');
  }
  if (!/\.table-scroll\{overflow:visible!important/.test(phone)) {
    errors.push('phone: the table box still scrolls sideways');
  }
  if (!/\.table-scroll tr\{[^}]*border-radius/.test(phone)) {
    errors.push('phone: a row is not drawn as a card');
  }
  if (!/\.field-bar\{[^}]*position:fixed/.test(phone)) {
    errors.push('phone: there is no fixed field bar for scan, attendance and password');
  }
  if (!/\.field-bar a\{[^}]*min-height:(4[4-9]|[5-9]\d)px/.test(phone)) {
    errors.push('phone: the field buttons are smaller than a finger');
  }
  if (!/\.main-content\{padding-bottom:\d+px\}/.test(phone)) {
    errors.push('phone: the field bar covers the last row of the page');
  }
  if (!/\.field-bar\{display:none\}/.test(css)) {
    errors.push('phone: the field bar is not hidden on a desk');
  }

  await checkMobileInChrome();

  if (!errors.length) {
    console.log('Account hierarchy, the per-person temporary password and the phone card are all in place.');
  } else {
    for (const e of errors) console.log('  - ' + e);
    process.exitCode = 1;
  }
})().catch(e => {
  console.log('  - check crashed: ' + e.message);
  process.exitCode = 1;
});

/* ---------------------------------------------------------------------------
   القياس في متصفّح حقيقي. بلا متصفّح لا يُدّعى النجاح: يُقال إن القياس لم يقع.
   ------------------------------------------------------------------------- */
async function checkMobileInChrome() {
  const http = require('http');
  const { spawn } = require('child_process');
  const os = require('os');

  const CHROME = [
    process.env.SADARA_CHROME,
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });

  if (!CHROME) {
    console.log('      (no Chrome here, so the phone layout was not measured)');
    return;
  }

  const dir = path.join(os.tmpdir(), 'sadara-mobile-check');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(dir, 'styles.css'));

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="styles.css"></head><body>
<div class="app-shell"><main class="main-content"><div class="page-root">
<section class="panel table-panel"><div class="table-scroll"><table>
<thead><tr><th>الاسم</th><th>الهاتف</th><th>الفوج</th><th>أدوات</th></tr></thead>
<tbody><tr><td data-label="الاسم">عبد الرحمن بن فلان</td><td data-label="الهاتف">0555123456</td>
<td data-label="الفوج">الفوج الأول</td><td data-label="أدوات"><button class="check-btn">تعديل</button></td></tr>
<tr><td data-label="الاسم">مريم بنت فلان</td><td data-label="الهاتف">0666778899</td>
<td data-label="الفوج">الفوج الثاني</td><td data-label="أدوات"><button class="check-btn">تعديل</button></td></tr>
</tbody></table></div></section></div></main></div>
<nav class="field-bar" id="field-bar"><a><i>▣</i>المسح</a><a><i>✓</i>الحضور</a><a><i>🔑</i>كلمة المرور</a></nav>
<script>
window.addEventListener('load', function () {
  var table = document.querySelector('table');
  var bar = document.querySelector('.field-bar');
  var tap = bar ? bar.querySelector('a') : null;
  var out = {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tableMinWidth: getComputedStyle(table).minWidth,
    tableWidth: Math.round(table.getBoundingClientRect().width),
    rowDisplay: getComputedStyle(document.querySelector('tbody tr')).display,
    rowRadius: getComputedStyle(document.querySelector('tbody tr')).borderRadius,
    theadDisplay: getComputedStyle(document.querySelector('thead')).display,
    cellDisplay: getComputedStyle(document.querySelector('tbody td')).display,
    barDisplay: bar ? getComputedStyle(bar).display : 'none',
    tapHeight: tap ? Math.round(tap.getBoundingClientRect().height) : 0
  };
  var pre = document.createElement('pre');
  pre.id = 'mobile-report';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
});
</script></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');

  const web = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(dir, name);
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': /\.css$/.test(file) ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8',
      'Content-Length': body.length, 'Cache-Control': 'no-store'
    });
    res.end(body);
  });

  const port = 8391;
  await new Promise(resolve => web.listen(port, '127.0.0.1', resolve));

  const run = (width, height) => new Promise(resolve => {
    const child = spawn(CHROME, [
      '--headless', '--disable-gpu', '--no-sandbox', '--disable-extensions',
      '--no-first-run', '--no-default-browser-check',
      '--window-size=' + width + ',' + height, '--virtual-time-budget=6000',
      '--user-data-dir=' + path.join(os.tmpdir(), 'sadara-mobile-chrome-' + width),
      '--dump-dom', 'http://127.0.0.1:' + port + '/index.html'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', d => { out += d.toString(); });
    const timer = setTimeout(() => { try { child.kill(); } catch (_) {} }, 60000);
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', () => {
      clearTimeout(timer);
      const m = out.match(/<pre id="mobile-report">([\s\S]*?)<\/pre>/);
      if (!m) { resolve(null); return; }
      try {
        resolve(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
      } catch (_) { resolve(null); }
    });
  });

  try {
    const phone = await run(390, 844);
    if (!phone) {
      errors.push('phone: Chrome produced no measurement, so the phone layout is unproven');
    } else {
      if (phone.scrollWidth > phone.innerWidth + 1) {
        errors.push('phone: the page still scrolls sideways (' + phone.scrollWidth + ' in ' + phone.innerWidth + ')');
      }
      if (parseFloat(phone.tableMinWidth) > 0) {
        errors.push('phone: the table still has a floor of ' + phone.tableMinWidth);
      }
      if (phone.tableWidth > phone.innerWidth) {
        errors.push('phone: the table is wider than the screen (' + phone.tableWidth + ' in ' + phone.innerWidth + ')');
      }
      if (phone.rowDisplay !== 'block') errors.push('phone: a row is still a table row, not a card');
      if (parseFloat(phone.rowRadius) < 8) errors.push('phone: a row has no card shape');
      if (phone.theadDisplay !== 'none') errors.push('phone: the desktop header is still drawn');
      if (phone.cellDisplay !== 'flex') errors.push('phone: the cell is not a labelled line');
      if (phone.barDisplay === 'none') errors.push('phone: the field bar is not on the phone');
      if (phone.tapHeight < 44) errors.push('phone: the field buttons are ' + phone.tapHeight + 'px tall');
    }

    const desk = await run(1366, 768);
    if (desk) {
      if (desk.barDisplay !== 'none') errors.push('desk: the field bar is drawn over the page');
      if (parseFloat(desk.tableMinWidth) < 650) errors.push('desk: the table lost its minimum width');
    }
  } finally {
    web.close();
  }
}
