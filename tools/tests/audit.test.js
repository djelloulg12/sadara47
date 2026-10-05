const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const problems = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (seed) w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => {};
  w.open = () => { const d = { html: '', open(){return this;}, write(h){this.html+=h;}, close(){} }; (w.__popups=w.__popups||[]).push(d); return { document: d, focus(){}, print(){}, close(){} }; };
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {};
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,bind:bind,baseURI:document.baseURI};'); }
  catch (e) { problems.push('LOAD FAILED: ' + e.message); }
  if (seed && seed.user) w.__t.state.user = seed.user;
  return w;
}

const SW = Array.from({ length: 4 }, (_, i) => ({ id: 'SDR-' + i, name: 'سباح ' + i, group: 'المبتدئون', phone: '0661', status: 'نشط' }));
const APPS = [
  { id: 1, application_no: 'APP-1', first_name_ar: 'كريم', last_name_ar: 'ز', category: 'minor', subscription_code: 'quarter', expected_amount: 1000, status: 'pending' },
  { id: 2, application_type: 'coach', application_no: 'APP-C', coach_name: 'سليم', coach_phone: '0662', status: 'pending', documents: { path: 'coach-applications/a/b.pdf' } }
];
const SCHED = [
  { id: 1, day_name: 'السبت', time_range: '16:00 - 17:30', group_name: 'المبتدئون', coach: 'سليم', pool: 'مسبح الصدارة' }
];
const seed = (user, page) => ({ user, page, swimmers: SW, applications: APPS, schedules: SCHED,
  subscriptions: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر', active: true }],
  notices: [{ id: 1, title: 'إعلان', text: 'نص', date: '02 أكتوبر', type: 'مهم' }], attendance: {}, attendanceByDay: {},
  coachRequirements: [{ id: 'a', label: 'وثيقة', required: true }], groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم', schedule: 'السبت' }],
  attendanceMap: {}, extras: { transport: 900, uniform: 2500 } });

/* ---------- 1. every interactive element on every page has a handler ---------- */
{
  const handlers = new Set([...APP.matchAll(/a===?['"]([a-z0-9-]+)['"]/g)].map(m => m[1]));
  const roles = [['admin', 'admin'], ['president', 'president'], ['coach', 'coach'],
    ['swimmer_adult', 'swimmer_adult'], ['parent', 'parent'], ['member', 'member']];
  const seen = new Map();
  for (const [role, r] of roles) {
    const pages = ['home', 'applications', 'subscriptions', 'users', 'schedule', 'attendance', 'notices', 'card', 'groups', 'settings'];
    const w = boot(seed({ id: 1, name: 'اختبار', role: r }, 'home'));
    const collect = (where) => w.document.querySelectorAll(where).forEach(e => {
      const a = e.dataset.action;
      if (a && !handlers.has(a)) {
        const key = a;
        if (!seen.has(key)) seen.set(key, role + ' / ' + where);
      }
    });
    if (r === 'admin' || r === 'president') for (const p of pages) { w.__t.state.page = p; w.__t.render(); collect('#app [data-action]'); }
    else {
      w.__t.render();
      const navs = [...w.document.querySelectorAll('[data-role-page]')].map(b => b.dataset.rolePage);
      for (const t of navs) { w.__t.state.rolePage = t; w.__t.render(); collect('.role-main [data-action]'); }
    }
    for (const a of ['login', 'register', 'coach-register']) {
      try { w.__t.action(a, null); collect('.modal-backdrop [data-action]'); w.document.querySelectorAll('.modal-backdrop').forEach(m => m.remove()); } catch (e) { problems.push(`${role}: opening ${a} threw ${e.message}`); }
    }
  }
  if (seen.size) problems.push('DEAD ACTIONS: ' + [...seen.keys()].join(', '));
}

/* ---------- 2. no leftover fake numbers on the public page ---------- */
{
  const w = boot(seed(null, 'home'));
  w.__t.render();
  const text = w.document.querySelector('.landing').textContent;
  for (const fake of ['+120', '1177', '108', 'عشري', 'سباحًا']) {
    if (text.includes(fake)) problems.push('landing still shows a fabricated number: ' + fake);
  }
  if (!/\b\d+\b/.test(text)) problems.push('landing shows no real counts at all');
  const ids = [...w.document.querySelectorAll('[id]')].map(e => e.id);
  const hrefs = [...w.document.querySelectorAll('.landing a[href^="#"]')].map(a => a.getAttribute('href').slice(1));
  for (const h of hrefs) if (h && !ids.includes(h)) problems.push('landing anchor has no target section: #' + h);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) problems.push('duplicate element ids: ' + [...new Set(dup)].join(','));
  for (const n of ['activities', 'plans', 'schedule', 'about', 'contact']) {
    if (!w.document.getElementById(n)) problems.push('landing section missing: #' + n);
  }
}

/* ---------- 3. the official form popup must resolve the image ---------- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'applications'));
  w.__t.render();
  w.__t.action('print-official-form', { dataset: { id: '1' } });
  const pops = w.__popups || [];
  if (!pops.length) problems.push('form popup did not open');
  else {
    const html = pops[pops.length - 1].html;
    if (!/assets\/form-registration-01\.jpg/.test(html)) problems.push('form popup has no background image reference');
    const m = html.match(/class="f-bg" src="([^"]+)"/);
    if (!m) problems.push('form popup has no f-bg element');
    else if (!/^https?:|^file:/.test(m[1])) problems.push('form background URL is relative and will 404 in the popup: ' + m[1]);
    if (!/object-fit:fill/.test(html)) problems.push('form background must stretch to the page');
    if (!/@page\{size:A4 portrait;margin:0\}/.test(html)) problems.push('form popup page size is wrong');
    if (!/class="f-spot"/.test(html)) problems.push('form popup has no text overlays');
    if (!/f-hint/.test(html)) problems.push('form popup has no printing hint');
  }
}

/* ---------- 4. the card carries photo, number under the frame, phone under the QR ---------- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }, 'card'));
  w.__t.state.profile = { photo: 'https://example.com/p.jpg', blood_group: 'O+' };
  w.__t.state.swimmers = [{ id: 'SDR-X', name: 'أمين', group: 'المبتدئون', phone: '0661000001', status: 'نشط', photo: 'https://example.com/p.jpg', blood_group: 'O+' }];
  w.__t.render();
  w.__t.action('print-lux-one', { dataset: { id: 'SDR-X' } });
  const host = w.document.querySelector('.print-host');
  if (!host) { problems.push('card sheet not produced'); }
  else {
    const card = host.querySelector('.lux-card');
    const wrap = card && card.querySelector('.lux-photo-wrap');
    const frame = card && card.querySelector('.lux-photo');
    const no = card && card.querySelector('.lux-no');
    const qrBox = card && card.querySelector('.lux-qr');
    if (!frame || !frame.querySelector('img')) problems.push('card has no member photo element');
    else if (!/lux-photo-img/.test(frame.innerHTML)) problems.push('card does not show the uploaded photo');
    if (!no) problems.push('card has no membership number');
    else {
      if (wrap && frame.contains(no)) problems.push('the number must sit BELOW the photo frame, not inside it');
      if (wrap && no.parentElement !== wrap) problems.push('the number is not a sibling under the frame');
      const f = frame.getBoundingClientRect(), n = no.getBoundingClientRect();
      if (f.height && n.height && n.top < f.bottom) problems.push('the number is not positioned under the frame');
    }
    if (!qrBox || !qrBox.querySelector('.lux-phone')) problems.push('no phone number under the QR code');
    else {
      const q = qrBox.querySelector('.qr-code').getBoundingClientRect();
      const ph = qrBox.querySelector('.lux-phone').getBoundingClientRect();
      if (q.height && ph.height && ph.top < q.bottom) problems.push('the phone number is not under the QR code');
    }
    if (/assets\/logo\.png/.test(qrBox ? qrBox.innerHTML : '')) problems.push('the phone line is still showing a logo');
  }
}

/* ---------- 5. empty states must never render "undefined" ---------- */
{
  const w = boot({ user: { id: 1, name: 'x', role: 'admin' }, page: 'home', swimmers: [], applications: [], schedules: [], subscriptions: [], notices: [], attendance: {}, groups: [] });
  for (const p of ['home', 'applications', 'subscriptions', 'users', 'schedule', 'attendance', 'notices', 'card', 'groups', 'settings']) {
    w.__t.state.page = p;
    w.__t.render();
    const html = w.document.querySelector('#app').innerHTML;
    if (/undefined|NaN|\[object Object\]/.test(html)) problems.push('empty state on "' + p + '" leaks undefined/NaN/[object Object]');
    if (/null<\//.test(html)) problems.push('empty state on "' + p + '" leaks a literal null');
  }
  for (const role of ['swimmer_adult', 'coach', 'parent', 'member']) {
    const w2 = boot({ user: { id: 1, name: 'x', role }, page: 'home', swimmers: [], applications: [], schedules: [], notices: [], attendance: {} });
    w2.__t.render();
    const navs = [...w2.document.querySelectorAll('[data-role-page]')].map(b => b.dataset.rolePage);
    for (const t of navs) {
      w2.__t.state.rolePage = t;
      w2.__t.render();
      const html = w2.document.querySelector('.role-main').innerHTML;
      if (/undefined|NaN|\[object Object\]/.test(html)) problems.push(`empty role state ${role}/${t} leaks undefined/NaN`);
    }
  }
}

/* ---------- 6. card photos and coach cards survive a card-model rebuild ---------- */
{
  const w = boot(seed({ id: 12, name: 'أمين', role: 'swimmer_adult', member_no: 'SDR-0', phone: '0661' }, 'card'));
  w.__t.state.swimmers = [{ id: 'SDR-0', name: 'أمين', group: 'المبتدئون', phone: '0661', status: 'نشط' }];
  w.__t.state.profile = { member_no: 'SDR-0', photo: 'https://example.com/me.jpg', blood_group: 'AB+' };
  w.__t.state.rolePage = 'cards';
  w.__t.render();
  const card = w.document.querySelector('.lux-card');
  if (card) {
    if (!card.innerHTML.includes('example.com/me.jpg')) problems.push('the signed-in member photo is not used on their own card');
    if (!card.innerHTML.includes('AB+')) problems.push('the member blood group is not used on their card');
  }
}

if (problems.length) { console.log('AUDIT PROBLEMS (' + problems.length + '):\n  - ' + [...new Set(problems)].join('\n  - ')); process.exit(1); }
console.log('Audit clean: no dead actions, no fake numbers, form popup resolves, card layout correct, no empty-state leaks.');