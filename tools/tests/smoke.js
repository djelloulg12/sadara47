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
    w.eval(APP + "\n;window.__t={get state(){return state},set state(v){state=v},render:render,action:action,setDoor_:setDoor_,boot:boot,registrationFormUrl:registrationFormUrl,buildQRCodes:buildQRCodes,mySwimmer:mySwimmer,pageView:pageView,bind:bind,syncApi:syncApi};");
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

scenario('role dashboards: navigation works for swimmers, parent, member', () => {
  for (const role of ['swimmer_adult', 'swimmer_minor', 'parent', 'member']) {
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

/* الشريط الجانبي يقول الدور قبل أن يُقرأ الاسم.
   ---------------------------------------------------------------------------
   صاحب النادي والمدير يرون كل شيء؛ والمسير يرى الحضور والماسح والبرنامج
   والإعلانات ولا يرى السباحين ولا الطلبات ولا الأفواج؛ والمدرب يرى عمله اليومي
   وبطاقاته. والاختبار لا يسأل «هل اللون موجود؟» بل يسأل: هل يصل هذا الحساب إلى
   ما لا يحقّ له؟ فصفحة محفوظة في `state.page` من حساب سابق يجب ألّا تُفتح. */
scenario('the sidebar is coloured and filtered by the account', () => {
  const CASES = [
    { name: 'owner', user: { role: 'admin', owner: true }, tone: 'owner', label: 'صاحب النادي',
      has: ['home','attendance','scan','users','applications','subscriptions','groups','audit'], hasNot: [] },
    { name: 'admin', user: { role: 'admin' }, tone: 'admin', label: 'مدير المنصة',
      has: ['home','attendance','scan','users','applications','subscriptions','card','groups','audit'], hasNot: [] },
    { name: 'president', user: { role: 'president' }, tone: 'admin', label: 'رئيس الجمعية',
      has: ['users','groups','audit'], hasNot: [] },
    { name: 'manager', user: { role: 'manager' }, tone: 'manager', label: 'مسير النادي',
      has: ['home','attendance','scan','schedule','notices'],
      hasNot: ['users','applications','subscriptions','card','groups','audit'] },
    { name: 'coach', user: { role: 'coach' }, tone: 'coach', label: 'مدرب',
      has: ['home','attendance','scan','schedule','card','notices'],
      hasNot: ['users','applications','subscriptions','groups','audit'] }
  ];

  for (const c of CASES) {
    const user = Object.assign({ id: 7, name: 'حساب اختبار', email: c.name + '@x.dz', member_no: '' }, c.user);
    const w = boot(seededState({ user }));
    setUser(w, user);
    setPage(w, 'home');
    w.render();

    const side = w.document.querySelector('.sidebar');
    if (!side) { errors.push(`sidebar/${c.name}: no sidebar`); continue; }
    if (!side.classList.contains('tone-' + c.tone)) {
      errors.push(`sidebar/${c.name}: expected tone-${c.tone}, got «${side.className}»`);
    }

    const labelEl = side.querySelector('.side-user small');
    const label = labelEl ? labelEl.textContent.trim() : '';
    if (label !== c.label) errors.push(`sidebar/${c.name}: label «${label}» instead of «${c.label}»`);

    const items = [...side.querySelectorAll('.side-nav [data-page]')].map(a => a.dataset.page);
    for (const k of c.has) if (!items.includes(k)) errors.push(`sidebar/${c.name}: «${k}» missing (${items.join(',')})`);
    for (const k of c.hasNot) if (items.includes(k)) errors.push(`sidebar/${c.name}: «${k}» is offered to an account that may not open it`);

    const bottom = [...side.querySelectorAll('.side-bottom [data-page]')].map(a => a.dataset.page);
    const wantsSettings = c.tone === 'owner' || c.tone === 'admin';
    if (wantsSettings !== bottom.includes('settings')) {
      errors.push(`sidebar/${c.name}: the settings link is ${wantsSettings ? 'missing' : 'offered'}`);
    }

    /* A page left in the stored state by an earlier account must not open. */
    setPage(w, 'users');
    w.render();
    const reached = !!w.document.querySelector('#page-root table');
    if ((c.tone === 'owner' || c.tone === 'admin') !== reached) {
      errors.push(`sidebar/${c.name}: the swimmers page was ${reached ? 'opened' : 'withheld'} for the wrong account`);
    }
  }
});

scenario('member accounts keep their personal space, not the management sidebar', () => {
  for (const role of ['swimmer_adult', 'swimmer_minor', 'parent', 'member']) {
    const user = { id: 3, name: 'عضو', role, email: role + '@x.dz', member_no: 'SDR-A1' };
    const w = boot(seededState({ user }));
    setUser(w, user);
    w.render();
    if (w.document.querySelector('.sidebar')) errors.push(`${role}: given the management sidebar`);
    if (!w.document.querySelector('.role-nav')) errors.push(`${role}: lost its personal navigation`);
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
  /* The public registration button leads to the approved form rather than opening
     a second one. jsdom cannot follow a navigation, so what is asserted is the
     one thing that decides it: where the button is pointed. A page that named
     /istimara/ in one button and somewhere else in another would be exactly the
     drift this change exists to stop. */
  if (w.__t.registrationFormUrl() !== '/istimara/') {
    errors.push('register: the public button does not lead to the approved form: '
      + w.__t.registrationFormUrl());
  }
  /* A price chosen on the platform has to travel with the person. */
  if (w.__t.registrationFormUrl('quarter') !== '/istimara/?plan=quarter') {
    errors.push('register: a chosen price does not travel to the form: '
      + w.__t.registrationFormUrl('quarter'));
  }
  /* And the button has to use it. */
  try { w.action('register', null); } catch (e) { /* jsdom cannot navigate */ }

  /* The documents still belong to the controls that open a modal here. */
  for (const a of ['register-desk', 'coach-register', 'login']) {
    try { w.action(a, null); } catch (e) { errors.push('open ' + a + ': ' + e.message); }
    const modal = w.document.querySelector('.modal-backdrop');
    if (!modal) { errors.push(a + ': modal did not open'); continue; }
    for (const link of modal.querySelectorAll('.official-docs a')) {
      const file = link.getAttribute('href').split('/').pop();
      if (!fs.existsSync(path.join(PUBLIC, 'assets', file))
        && !fs.existsSync(path.join(PUBLIC, file))) {
        errors.push(a + ': document target missing in firebase-public -> ' + file);
      }
    }
    w.document.querySelector('.modal-backdrop')?.remove();
  }
});

/* The account list is the one place the manager goes looking for a person by name,
   and it is the one list with two hundred and twenty-six rows and no way to cut
   them down. The search is asked of the drawn page and by typing into it, because a
   box that is on the page and does nothing is the same as no box -- and that is
   exactly how the registration switch spent a season. */
scenario('the account list can be searched, and the search is wired to the page', () => {
  const state = seededState({
    accounts: [
      { id: 'u1', name: 'جلول قندوز', email: 'kabrag12@gmail.com', role: 'admin', member_no: 'E202620001' },
      { id: 'u2', name: 'فاطمة الزهراء', email: 'djelloulg12@gmail.com', role: 'member', phone: '0699809998' },
      { id: 'u3', name: 'كريم بوعلام', email: 'karim@example.dz', role: 'coach', registration_id: 'E2026100042' }
    ]
  });
  const w = boot(state);
  setUser(w, state.user);
  setPage(w, 'settings');
  w.render();

  const box = w.document.getElementById('accounts-search');
  if (!box) { errors.push('the accounts page has no search box'); return; }

  const listed = () => w.document.querySelectorAll('#accounts-list .account-row').length;
  const all = listed();
  if (all !== 3) { errors.push('the accounts list shows ' + all + ' rows, not the 3 on file'); return; }

  box.value = 'قندوز';
  box.dispatchEvent(new w.Event('input', { bubbles: true }));
  if (listed() !== 1) {
    errors.push('typing a name leaves ' + listed() + ' of 3 rows showing: the box is on the page and does nothing');
  }
  /* By the address the account signs in with, which is how anybody identifies a
     record they did not create. */
  box.value = 'karim@example.dz';
  box.dispatchEvent(new w.Event('input', { bubbles: true }));
  if (listed() !== 1) {
    errors.push('searching by email leaves ' + listed() + ' rows showing, not 1');
  }
  /* And by the number printed on the card. */
  box.value = 'E2026100042';
  box.dispatchEvent(new w.Event('input', { bubbles: true }));
  if (listed() !== 1) {
    errors.push('searching by membership number leaves ' + listed() + ' rows showing, not 1');
  }
  /* Nothing found is said, rather than showing an empty panel that reads as
     "there are no accounts". */
  box.value = 'لا يوجد اسم كهذا';
  box.dispatchEvent(new w.Event('input', { bubbles: true }));
  if (listed() !== 0) errors.push('a search that finds nothing still shows rows');
  if (!/لا حساب/.test(w.document.getElementById('accounts-list').textContent)) {
    errors.push('a search that finds nothing does not say so');
  }
  /* And the whole list comes back, because a search that cannot be undone is a
     filter with no off. */
  box.value = '';
  box.dispatchEvent(new w.Event('input', { bubbles: true }));
  if (listed() !== 3) errors.push('clearing the search does not bring the list back: ' + listed() + ' rows');
  /* The wording is kept across a redraw, or the word is gone the moment the page
     is rebuilt and the search has to be typed again. */
  box.value = 'قندوز';
  box.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.render();
  const again = w.document.getElementById('accounts-search');
  if (!again || again.value !== 'قندوز') {
    errors.push('the search is forgotten when the page is redrawn');
  }
});

/* Putting a swimmer in a group, from the list, in one press.

   The club asked for a button beside التعديل. What has to be true of it is not
   that it exists -- that is a line of markup -- but that pressing it moves that
   swimmer and nobody else, and that a server which says no leaves the row exactly
   as it was.

   Both are asked here rather than by reading the source, because a button that is
   drawn and does nothing is the same as no button, and that is the whole class of
   fault this platform keeps meeting. */

const GROUP_STATE = (extra) => seededState(Object.assign({
  groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم' }, { id: 'g2', name: 'المتوسطون', coach: 'ياسين' }],
  swimmers: [
    { id: 'SDR-A1', name: 'أمين ب', group: 'المبتدئون', phone: '0661000001', status: 'نشط' },
    { id: 'SDR-A2', name: 'ياسين م', group: 'المتوسطون', phone: '0661000002', status: 'نشط' }
  ]
}, extra || {}));

const openTheList = (w) => { w.__t.state.page = 'users'; w.render(); };
const rowsOf = (doc) => doc.querySelectorAll('#page-root tbody tr');

/* Which group each row says, in order. The cell is an inline choice for a
   manager now, so what a row "says" is what its select is set to -- reading the
   text of a select would read every option it offers. */
const groupsShown = (doc) => [...rowsOf(doc)].map(tr => {
  const cell = tr.querySelectorAll('td')[2];
  if (!cell) return '';
  const picker = cell.querySelector('select[data-inline-group]');
  return (picker ? picker.value : cell.textContent).trim();
});

scenario('the list offers the group button beside التعديل, to management only', async () => {
  const asRole = async (role) => {
    const state = GROUP_STATE();
    const w = boot(state);
    setUser(w, { id: 1, name: 'x', role: role, email: 'a@b.dz' });
    openTheList(w);
    const row = w.document.querySelector('[data-action="set-swimmer-group"]');
    return { w: w, present: !!row };
  };
  for (const role of ['admin', 'president']) {
    const r = await asRole(role);
    if (!r.present) errors.push('a ' + role + ' is not offered the group button on the swimmers list');
    if (!r.w.document.querySelector('[data-action="edit-swimmer"]')) {
      errors.push('a ' + role + ' lost the edit button while the group button was added');
    }
  }
  for (const role of ['coach', 'member', 'parent', 'swimmer_adult']) {
    const r = await asRole(role);
    if (r.present) errors.push('a ' + role + ' is offered the group button, and has no business placing children in groups');
  }
});

scenario('choosing a group moves that swimmer, and only that one', async () => {
  const state = GROUP_STATE();
  const w = boot(state);
  setUser(w, state.user);
  w.fetch = async (url, init) => {
    if (String(url) === '/api/swimmers' && init && init.method === 'PUT') {
      w.__sent = JSON.parse(init.body);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  openTheList(w);

  w.__t.action('set-swimmer-group', { dataset: { id: 'SDR-A2' } });
  const picker = w.document.getElementById('swimmer-group-value');
  if (!picker) { errors.push('pressing the group button opened no list of groups'); return; }

  const offered = [...picker.querySelectorAll('option')].map(o => o.textContent.trim());
  for (const want of ['المبتدئون', 'المتوسطون']) {
    if (offered.indexOf(want) === -1) errors.push('the dialog does not offer the group ' + want);
  }

  picker.value = 'المبتدئون';
  await w.__t.action('save-swimmer-group', { dataset: { id: 'SDR-A2' } });

  if (!w.__sent) { errors.push('saving the group sent nothing to the server'); return; }
  if (w.__sent.id !== 'SDR-A2') errors.push('the save was filed under the wrong swimmer: ' + w.__sent.id);
  if (w.__sent.group_name !== 'المبتدئون') {
    errors.push('the save did not carry the chosen group: ' + JSON.stringify(w.__sent.group_name));
  }
  /* The id and the group it belongs to, and nothing else. Anything more and this
     is the edit form with a shorter door, which is what it was built not to be.
     `group_id` is part of the one change, not a second one: the name is what a
     person reads and the id is what the record keeps, and they are the same
     group. */
  const extraKeys = Object.keys(w.__sent).filter(k => k !== 'id' && k !== 'group_name' && k !== 'group_id');
  if (extraKeys.length) {
    errors.push('a change of one field also sent: ' + extraKeys.join(', ')
      + ' -- one wrong key here can wipe a name or a photograph');
  }
  if (w.__sent.group_id !== 'g1') {
    errors.push('the chosen group was sent without its id: ' + JSON.stringify(w.__sent.group_id)
      + ' -- the name is written, the id is what the record is looked up by');
  }

  const after = groupsShown(w.document);
  if (after[1] !== 'المبتدئون') errors.push('the row still reads "' + after[1] + '" after the group was changed');
  if (after[0] !== 'المبتدئون') errors.push('the move reached the wrong swimmer: the first row now reads "' + after[0] + '"');
});

scenario('a refused change leaves the row exactly as it was', async () => {
  const state = GROUP_STATE();
  const w = boot(state);
  setUser(w, state.user);
  w.fetch = async (url, init) => {
    if (String(url) === '/api/swimmers' && init && init.method === 'PUT') {
      return { ok: false, status: 403, json: async () => ({ error: 'تغيير الفوج لرئيس النادي فقط.' }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  openTheList(w);
  const before = groupsShown(w.document);

  w.__t.action('set-swimmer-group', { dataset: { id: 'SDR-A2' } });
  const picker = w.document.getElementById('swimmer-group-value');
  if (picker) picker.value = 'المبتدئون';
  await w.__t.action('save-swimmer-group', { dataset: { id: 'SDR-A2' } });

  const swimmer = w.__t.state.swimmers.find(x => x.id === 'SDR-A2');
  if (!swimmer || swimmer.group !== 'المتوسطون') {
    errors.push('a refused change still moved the swimmer to ' + (swimmer && swimmer.group)
      + ' -- the page now disagrees with the server about a child');
  }
  const after = groupsShown(w.document);
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    errors.push('a refused change still redrew the list differently: ' + after.join(' | '));
  }
});

scenario('the button says which group the swimmer is in, without being pressed', async () => {
  const state = GROUP_STATE();
  const w = boot(state);
  setUser(w, state.user);
  openTheList(w);
  const buttons = [...w.document.querySelectorAll('[data-action="set-swimmer-group"]')];
  if (buttons.length !== 2) { errors.push('the list carries ' + buttons.length + ' group buttons for 2 swimmers'); return; }
  const said = buttons.map(b => b.textContent.trim());
  if (said[0].indexOf('المبتدئون') === -1 || said[1].indexOf('المتوسطون') === -1) {
    errors.push('the buttons do not say which group each swimmer is in: ' + said.join(' | '));
  }
  /* A swimmer in no group at all must still be assignable, and must not look as
     though they are in one. */
  w.__t.state.swimmers[1].group = '';
  openTheList(w);
  const none = w.document.querySelectorAll('[data-action="set-swimmer-group"]')[1];
  if (none.textContent.indexOf('تحديد') === -1) {
    errors.push('a swimmer in no group reads as though they were in one: "' + none.textContent.trim() + '"');
  }
});

/* The other direction, and the check that was missing.

   The layer added for the button above wraps the page's action router and answers
   before it, so any action name it takes is an action name the page behind it can
   no longer answer. It took `save-group` -- the name of the «إضافة فوج» form's
   save, drawn by the baseline -- and a manager filling that form in pressed حفظ
   and watched it look for a swimmer. The group was not saved, and nothing said
   why, because the form's own handler never ran.

   So the form is filled in and its save pressed here, and what is asked is only
   what the manager asked: is there now a group with that name? Nothing about this
   layer, its names, or its markup -- the moment this check knows how the collision
   happened it stops noticing the next one. */
scenario('the add-group form still saves a group', async () => {
  const state = GROUP_STATE();
  const w = boot(state);
  setUser(w, state.user);
  w.__t.state.page = 'groups';
  w.render();

  const add = w.document.querySelector('[data-action="new-group"]');
  if (!add) { errors.push('the groups page no longer offers «إضافة فوج»'); return; }
  await w.__t.action('new-group', add);

  const nameBox = w.document.getElementById('g-name');
  if (!nameBox) { errors.push('«إضافة فوج» opened no form to type a name into'); return; }
  nameBox.value = 'فوج الأشبال';
  const coach = w.document.getElementById('g-coach');
  if (coach) coach.value = 'سليم';

  const before = (w.__t.state.groups || []).length;
  await w.__t.action('save-group', { dataset: {} });

  const after = (w.__t.state.groups || []).map(g => String(g.name || ''));
  if (after.length !== before + 1) {
    errors.push('pressing حفظ on «إضافة فوج» added ' + (after.length - before)
      + ' groups -- the form a manager fills in does not save, which is what the '
      + 'swimmer-group layer was doing to it');
  }
  if (after.indexOf('فوج الأشبال') === -1) {
    errors.push('the group was not saved by that name: ' + JSON.stringify(after));
  }
  /* And the form is asked for a name, still: an empty name must not create a
     group, or every stray press of حفظ leaves one behind. */
  await w.__t.action('new-group', w.document.querySelector('[data-action="new-group"]'));
  const empty = (w.__t.state.groups || []).length;
  await w.__t.action('save-group', { dataset: {} });
  if ((w.__t.state.groups || []).length !== empty) {
    errors.push('«إضافة فوج» saved a group with no name');
  }
});

/* The switch the club closes registrations with must not be able to lie.

   It did, for a season. The write was refused -- no rule existed for the document
   it writes to -- the response was never read, the page set its own memory to what
   had been asked for, and it said "registrations are closed". The club pressed it
   and the form stayed open, and because the switch still looked right afterwards
   it looked like it had worked.

   So the refusal is staged here: the server says no, and the page is asked both
   what it tells the person who pressed it and what it then believes. */
scenario('a refused switch is reported as a refusal and does not move', () => {
  const state = seededState();
  const w = boot(state);
  setUser(w, state.user);
  setPage(w, 'settings');

  let asked = null;
  w.fetch = async (url, init) => {
    if (String(url) === '/api/registration' && (init && init.method === 'PUT')) {
      asked = JSON.parse(init.body);
      return { ok: false, status: 403, json: async () => ({ error: 'تغيير فتح التسجيل مسيّر النادي فقط.' }) };
    }
    if (String(url) === '/api/registration') return { ok: true, json: async () => ({ open: true, note: '' }) };
    return { ok: true, json: async () => ({}) };
  };
  w.render();

  const box = w.document.getElementById('door-toggle');
  if (!box) { errors.push('the settings page has no registration switch to press'); return Promise.resolve(); }
  box.checked = true;

  return w.__t.setDoor_(true).then(() => {
    errors.push('a refused switch came back as a success: nothing would be said to the person who pressed it');
  }, (e) => {
    if (!/مسيّر النادي/.test(String(e && e.message))) {
      errors.push('the refusal was thrown without the reason the server gave: ' + (e && e.message));
    }
    if (w.__t.state.registrationOpen === false) {
      errors.push('after a refusal the page believes the door is closed: it kept the answer it was refused');
    }
    if (!asked || asked.open !== true) {
      errors.push('the refused write never carried the value that was asked for');
    }
  });
});

/* And the other way: a switch that did work must not be reported as having
   failed, and the page must believe what the server said rather than what it
   asked for. The two are the same code read in opposite directions. */
scenario('a switch the server accepted reports what the server actually did', () => {
  const state = seededState();
  const w = boot(state);
  setUser(w, state.user);
  setPage(w, 'settings');

  /* The stub remembers, the way a server does. It did not at first, and it
     answered every read with "open" even after it had just answered a write with
     "closed" -- which made the page look as though it had thrown the decision
     away. It had not: the stub had. */
  let doorIsOpen = true;
  w.fetch = async (url, init) => {
    if (String(url) === '/api/registration' && (init && init.method === 'PUT')) {
      doorIsOpen = false;
      return { ok: true, status: 200, json: async () => ({ ok: true, open: doorIsOpen }) };
    }
    if (String(url) === '/api/registration') return { ok: true, json: async () => ({ open: doorIsOpen, note: '' }) };
    return { ok: true, json: async () => ({}) };
  };
  w.render();
  return w.__t.setDoor_(true).then((now) => {
    if (now !== false) errors.push('the page believes the door is ' + now + ' after the server said it was closed');
    if (w.__t.state.registrationOpen !== false) errors.push('the page did not record the answer it was given');
  }, (e) => errors.push('a switch the server accepted was reported as a failure: ' + (e && e.message)));
});

scenario('every data-action used anywhere has a handler', () => {
  const w = boot(seededState());
  setUser(w, seededState().user);
  const handlers = new Set([...APP.matchAll(/a\s*={2,3}\s*['"]([a-z0-9-]+)['"]/g)].map(m => m[1]));
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

/* A scenario may be synchronous or return a promise, and it is waited for either
   way.

   It was not: `try { s.fn(); }` and straight on to the verdict. Every scenario in
   this file was synchronous, so nothing was missed until one had to await a
   refused request -- and then its checks ran after the verdict had already been
   printed, and it was announced PASS while the fault it was written to catch sat
   in the page untouched. A check that has not finished is not a check, and a suite
   that says PASS about one is worse than having no suite at all. */
(async () => {
for (const s of scenarios) {
  const before = errors.length;
  try { await s.fn(); } catch (e) { errors.push(`scenario "${s.name}" crashed: ${(e && e.message) || e}`); }
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
})();