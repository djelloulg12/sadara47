const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

const errors = [];
const warnings = [];

function seededState(extra) {
  return Object.assign({
    user: { id: 1, name: 'محمد الصدارة', role: 'admin', email: 'a@b.dz', member_no: '' },
    page: 'home', dark: false,
    notices: [{ id: 1, title: 'فتح التسجيل', text: 'نص الإعلان', date: '02 أكتوبر 2026', type: 'مهم' }],
    swimmers: [
      { id: 'SDR-A1', name: 'أمين ب', group: 'المبتدئون', phone: '0661000001', status: 'نشط' },
      { id: 'SDR-A2', name: 'ياسين م', group: 'المتقدمون', phone: '0661000002', status: 'نشط' }
    ],
    applications: [
      { id: 1, application_no: 'APP-1', first_name_ar: 'كريم', last_name_ar: 'ز', category: 'minor', subscription_code: 'quarter', expected_amount: 1000, status: 'pending' },
      { id: 2, application_type: 'coach', coach_name: 'مدرب ج', coach_phone: '0665000000', status: 'approved', documents: { path: 'coach-applications/abc/APP-2.pdf' } }
    ],
    subscriptions: [
      { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
      { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' }
    ],
    schedules: [
      { id: 1, day_name: 'السبت', time_range: '16:00 - 17:30', group_name: 'المبتدئون', coach: 'سليم', pool: 'مسبح الصدارة' },
      { id: 2, day_name: 'الخميس', time_range: '16:00 - 18:00', group_name: 'المتقدمون', coach: 'نادية', pool: 'مسبح الصدارة' }
    ],
    attendance: { 'SDR-A1': [{ status: 'present', at: '2026-10-03T09:10:00Z', date: '2026-10-03' }] },
    attendanceByDay: { '2026-10-03': { 'SDR-A1': 'present' } },
    coachRequirements: [{ id: 'identity', label: 'بطاقة التعريف', required: true }],
    groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم', schedule: 'السبت · 16:00' }],
    extras: { transport: 900, uniform: 2500 }
  }, extra || {});
}

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://sadara-platform.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (seed) w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => { w.__prints = (w.__prints || 0) + 1; };
  w.URL.createObjectURL = () => 'blob:preview';
  w.URL.revokeObjectURL = () => {};
  w.Blob = class { constructor(p, o) { this.parts = p; this.type = o && o.type; } };
  w.open = () => { const doc = { html: '', open(){ return this; }, write(h){ this.html += h; }, close(){} }; w.__popups = w.__popups || []; w.__popups.push(doc); return { document: doc, focus(){}, print(){}, close(){} }; };
  w.confirm = () => true;
  w.prompt = () => 'سبب الاختبار';
  w.alert = () => {};
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  try {
    w.eval(APP + "\n;window.__t={get state(){return state},set state(v){state=v},render:render,action:action,boot:boot,buildQRCodes:buildQRCodes,mySwimmer:mySwimmer,pageView:pageView,bind:bind,syncApi:syncApi};");
  } catch (e) { errors.push('load app.js: ' + e.message); }
  w.addEventListener('unhandledrejection', e => errors.push('unhandled rejection: ' + ((e.reason && e.reason.message) || e.reason)));
  return w;
}

const setUser = (w, user) => { w.__t.state.user = user; };
const setPage = (w, p) => { w.__t.state.page = p; };
const setRolePage = (w, p) => { w.__t.state.rolePage = p; };
const cleanupPrint = (w) => {
  w.document.body.classList.remove('printing');
  const h = w.document.querySelector('.print-host');
  if (h) h.remove();
};

const ADMIN_PAGES = ['home', 'applications', 'subscriptions', 'users', 'schedule', 'attendance', 'notices', 'card', 'groups', 'settings'];
const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

scenario('admin: each page renders and every print button builds a print sheet', () => {
  const w = boot(seededState());
  setUser(w, seededState().user);
  for (const p of ADMIN_PAGES) {
    setPage(w, p);
    try { w.render(); } catch (e) { errors.push(`render ${p}: ${e.message}`); continue; }
    if (!w.document.querySelector('#page-root')) errors.push(`${p}: #page-root missing`);
    const prints = [...w.document.querySelectorAll('[data-action^="print"]')];
    if (!prints.length) errors.push(`${p}: no print button`);
    for (const btn of prints) {
      const a = btn.dataset.action;
      try {
        const popBefore = (w.__popups || []).length;
        btn.click();
        // the official A4 form is composed into its own window so @page can be exact
        if (/official|^print-registration/.test(a)) {
          const pops = w.__popups || [];
          if (pops.length <= popBefore) { errors.push(`${p}/${a}: no document window opened`); }
          else {
            const html = pops[pops.length - 1].html;
            if (!/^<!doctype html>/i.test(html.trim())) errors.push(`${p}/${a}: popup has no html document`);
            if (!html.includes('النادي الرياضي الصدارة')) errors.push(`${p}/${a}: popup missing club name`);
            if (!/@page/.test(html)) errors.push(`${p}/${a}: popup missing @page rule`);
            if (!/form-registration-01\.jpg/.test(html)) errors.push(`${p}/${a}: popup missing the official form image`);
            if (html.includes('undefined') || html.includes('NaN')) errors.push(`${p}/${a}: popup contains undefined/NaN`);
          }
          cleanupPrint(w); setPage(w, p); w.render(); continue;
        }
        const host = w.document.querySelector('.print-host');
        if (!host) { errors.push(`${p}/${a}: no .print-host created`); }
        else {
          const bare = /print-(cards|lux-one|lux-coaches|coach-luxtour|all-cards)/.test(a);
          if (!bare && !host.querySelector('.print-head')) errors.push(`${p}/${a}: print sheet has no header`);
          if (!bare && !host.querySelector('.print-foot')) errors.push(`${p}/${a}: print sheet has no footer`);
          if (bare && (host.querySelector('.print-head') || host.querySelector('.print-foot'))) errors.push(`${p}/${a}: bare sheet must not carry header or footer`);
          const body = host.querySelector('.print-body');
          if (!body || !body.children.length) errors.push(`${p}/${a}: print sheet body is empty`);
          if (/undefined|NaN|\[object Object\]/.test(host.textContent)) errors.push(`${p}/${a}: print sheet contains undefined/NaN`);
          if (w.__prints !== (btn.dataset.count || 0) + 1) { /* counted below */ }
        }
      } catch (e) { errors.push(`${p}/${a}: ${e.message}`); }
      cleanupPrint(w);
      setPage(w, p);
      w.render();
    }
  }
});

scenario('admin: interactive actions run without throwing', () => {
  const w = boot(seededState());
  setUser(w, seededState().user);
  const skip = /^(print|save|delete|send|do-login|open-coach-doc|logout|close|approve|reject)/;
  for (const p of ADMIN_PAGES) {
    setPage(w, p);
    w.render();
    for (const el of [...w.document.querySelectorAll('[data-action]')]) {
      const a = el.dataset.action;
      if (skip.test(a)) continue;
      try { el.click(); } catch (e) { errors.push(`${p}/${a}: ${e.message}`); }
      setPage(w, p);
      w.render();
    }
  }
});

scenario('admin: search and filter controls are wired', () => {
  const w = boot(seededState());
  setUser(w, seededState().user);
  setPage(w, 'users');
  w.render();
  const search = w.document.querySelector('#user-search');
  if (!search) errors.push('users: #user-search missing');
  else {
    search.value = 'ياسين';
    search.dispatchEvent(new w.Event('input'));
    const rows = w.document.querySelectorAll('#page-root tbody tr');
    if (rows.length !== 1) errors.push(`users: search did not filter (rows=${rows.length})`);
  }
  setPage(w, 'applications');
  w.render();
  const filter = w.document.querySelector('#app-filter');
  if (!filter) errors.push('applications: #app-filter missing');
  else {
    filter.value = 'approved';
    filter.dispatchEvent(new w.Event('change'));
    const rows = w.document.querySelectorAll('#page-root tbody tr');
    if (rows.length !== 1) errors.push(`applications: filter did not filter (rows=${rows.length})`);
  }
});

scenario('role dashboards: navigation works for coach, swimmers, parent, member', () => {
  for (const role of ['coach', 'swimmer_adult', 'swimmer_minor', 'parent', 'member']) {
    const user = { id: 9, name: 'أمين ب', role, email: 'x@y.dz', member_no: role.startsWith('swimmer') ? 'SDR-A1' : '', phone: '0661000001', group_name: role === 'coach' ? 'المبتدئون' : '' };
    const w = boot(seededState({ user }));
    setUser(w, user);
    w.render();
    const navs = [...w.document.querySelectorAll('[data-role-page]')].map(b => b.dataset.rolePage);
    if (!navs.length) { errors.push(`${role}: no role navigation`); continue; }
    for (const target of navs) {
      setRolePage(w, target);
      try { w.render(); } catch (e) { errors.push(`${role}/${target}: ${e.message}`); continue; }
      if (!w.document.querySelector('.role-main')) errors.push(`${role}/${target}: .role-main missing`);
      if (!w.document.querySelector('.role-nav button.active')) errors.push(`${role}/${target}: no active nav item`);
      for (const el of [...w.document.querySelectorAll('[data-action^="print-role"]')]) {
        try {
          el.click();
          const host = w.document.querySelector('.print-host');
          if (!host) errors.push(`${role}/${target}/${el.dataset.action}: no print sheet`);
          else if (!host.querySelector('.print-body').children.length) errors.push(`${role}/${target}/${el.dataset.action}: empty print body`);
        } catch (e) { errors.push(`${role}/${target}/${el.dataset.action}: ${e.message}`); }
        cleanupPrint(w);
        setRolePage(w, target);
        w.render();
      }
    }
  }
});

scenario('public landing: navigation links resolve', () => {
  const w = boot({ page: 'home', user: null, swimmers: [], notices: [], applications: [], subscriptions: [], attendance: {} });
  setUser(w, null);
  w.render();
  const anchors = [...w.document.querySelectorAll('a[href]')];
  if (!anchors.length) errors.push('landing: no links at all');
  for (const a of anchors) {
    const h = a.getAttribute('href');
    if (!h) { errors.push('landing: anchor without href'); continue; }
    if (/undefined|NaN/.test(h)) { errors.push('landing: broken href ' + h); continue; }
    if (h.startsWith('#')) {
      if (h.length > 1 && !w.document.querySelector(h)) errors.push('landing: fragment target missing ' + h);
      continue;
    }
    if (h.startsWith('http') && h.startsWith('http://')) errors.push('landing: insecure link ' + h);
    if (!/^(https?:|tel:|mailto:)/.test(h)) {
      const t = h.replace(/^\.\//, '');
      if (!fs.existsSync(path.join(PUBLIC, t)) && !fs.existsSync(path.join(PUBLIC, 'assets', t)))
        errors.push('landing: file target missing in firebase-public -> ' + h);
    }
  }
});

scenario('registration modals open with official documents', () => {
  const w = boot({ page: 'home', user: null, swimmers: [], notices: [], applications: [], subscriptions: [], attendance: {}, coachRequirements: [{ id: 'a', label: 'وثيقة', required: true }] });
  setUser(w, null);
  w.render();
  for (const a of ['register', 'coach-register', 'login']) {
    try { w.action(a, null); } catch (e) { errors.push(`open ${a}: ${e.message}`); }
    const modal = w.document.querySelector('.modal-backdrop');
    if (!modal) { errors.push(`${a}: modal did not open`); continue; }
    for (const link of modal.querySelectorAll('.official-docs a')) {
      const file = link.getAttribute('href').split('/').pop();
      if (!fs.existsSync(path.join(PUBLIC, 'assets', file))) errors.push(`${a}: document missing -> ${file}`);
    }
    modal.remove();
  }
});

scenario('every data-action used anywhere has a handler', () => {
  const w = boot(seededState());
  setUser(w, seededState().user);
  const handlers = new Set([...APP.matchAll(/a===?['"]([a-z0-9-]+)['"]/g)].map(m => m[1]));
  const used = new Set();
  const collect = () => w.document.querySelectorAll('[data-action]').forEach(e => used.add(e.dataset.action));
  for (const p of ADMIN_PAGES) { setPage(w, p); w.render(); collect(); }
  setPage(w, 'home'); w.render();
  for (const a of ['login', 'register', 'coach-register', 'phone-login']) {
    try { w.action(a, null); } catch (e) { errors.push(`open ${a}: ${e.message}`); }
    collect();
    w.document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
  }
  for (const role of ['coach', 'swimmer_adult', 'parent']) {
    const user = { id: 9, name: 'x', role, member_no: 'SDR-A1', phone: '0661000001', group_name: 'المبتدئون' };
    const w2 = boot(seededState({ user }));
    setUser(w2, user);
    w2.render();
    const navs = [...w2.document.querySelectorAll('[data-role-page]')].map(b => b.dataset.rolePage);
    for (const t of navs) { setRolePage(w2, t); w2.render(); collectFrom(w2.document, used); }
  }
  const missing = [...used].filter(a => !handlers.has(a));
  if (missing.length) errors.push('actions without handler: ' + missing.join(', '));
});

function collectFrom(doc, set) { doc.querySelectorAll('[data-action]').forEach(e => set.add(e.dataset.action)); }

let failed = 0;
for (const s of scenarios) {
  const before = errors.length;
  try { s.fn(); } catch (e) { errors.push(`scenario "${s.name}" crashed: ${e.message}`); }
  const added = errors.length - before;
  console.log(`${added ? 'FAIL' : 'PASS'}  ${s.name}${added ? '  (+' + added + ')' : ''}`);
  if (added) failed++;
}
if (warnings.length) { console.log('\nWARNINGS:'); [...new Set(warnings)].forEach(x => console.log('  - ' + x)); }
if (errors.length) {
  console.log('\nERRORS (' + errors.length + '):');
  [...new Set(errors)].forEach(x => console.log('  - ' + x));
  process.exit(1);
}
console.log('\nAll DOM scenarios passed.');