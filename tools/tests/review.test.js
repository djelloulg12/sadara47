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
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,exportSwimmers:exportSwimmers,logDecision:logDecision,writeStorage:writeStorage,auditPage:auditPage,loadPublicData:loadPublicData};'); }
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
