const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const errors = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => { w.__p = (w.__p || 0) + 1; };
  w.open = () => { const d = { html: '', open(){return this;}, write(h){this.html+=h;}, close(){} }; (w.__popups = w.__popups || []).push(d); return { document: d, focus(){}, print(){}, close(){} }; };
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,buildQRCodes:buildQRCodes};'); }
  catch (e) { errors.push('load: ' + e.message); }
  if (seed && seed.user) { w.__t.state.user = seed.user; }
  return w;
}
const cleanup = w => { w.document.body.classList.remove('printing'); const h = w.document.querySelector('.print-host'); if (h) h.remove(); };
const setPage = (w, p) => { w.__t.state.page = p; };
const setRole = (w, p) => { w.__t.state.rolePage = p; };

const SWIMMERS = [
  { id: 'SDR-0001', name: 'أمين بلعيد', group: 'المبتدئون', phone: '0661000001', status: 'نشط' },
  { id: 'SDR-0002', name: 'ياسين شريف', group: 'المبتدئون', phone: '0661000002', status: 'نشط' }
];
const COACH_APP = { id: 9, application_type: 'coach', application_no: 'APP-20261004-C1', coach_name: 'سليم بلعيد', coach_phone: '0662000000', coach_email: 's@b.dz', coach_specialty: 'مدرب سباحة', coach_experience: '6', status: 'approved' };
const SCHEDULES = [
  { id: 1, day_name: 'السبت', time_range: '16:00 - 17:30', group_name: 'المبتدئون', coach: 'سليم', pool: 'مسبح الصدارة' },
  { id: 2, day_name: 'الخميس', time_range: '16:00 - 18:00', group_name: 'المتقدمون', coach: 'نادية', pool: 'مسبح الصدارة' },
  { id: 3, day_name: 'الأحد', time_range: '09:00 - 10:30', group_name: 'المتوسطون', coach: 'سليم', pool: 'المسبح الأولمبي' }
];
function seed(user) {
  return { user, page: 'card', swimmers: SWIMMERS, applications: [COACH_APP], schedules: SCHEDULES,
    subscriptions: [{ code: 'quarter', name: 'فصلي', amount: 1000, duration: '3 أشهر' }],
    notices: [], attendance: {}, attendanceByDay: {}, groups: [{ id: 'g1', name: 'المبتدئون', coach: 'سليم', schedule: 'السبت' }], extras: {} };
}

/* ---- 3) exactly 10 cards per A4, nothing else ---- */
{
  const many = Array.from({ length: 23 }, (_, i) => ({ id: 'SDR-' + String(1000 + i), name: 'سباح ' + (i + 1), group: 'المبتدئون', phone: '06', status: 'نشط' }));
  const w = boot(Object.assign(seed({ id: 1, name: 'رئيس', role: 'admin' }), { swimmers: many }));
  w.__t.action('print-cards', null);
  const host = w.document.querySelector('.print-host');
  if (!host) errors.push('[3] no print sheet for 10-up cards');
  else {
    if (host.classList.contains('print-sheet10') !== true) errors.push('[3] sheet not tagged print-sheet10');
    if (host.querySelector('.print-head')) errors.push('[3] sheet must have NO header');
    if (host.querySelector('.print-foot')) errors.push('[3] sheet must have NO footer');
    const pages = [...host.querySelectorAll('.lux-page')];
    if (pages.length !== 3) errors.push('[3] expected 3 A4 pages for 23 cards, got ' + pages.length);
    const counts = pages.map(p => p.querySelectorAll('.lux-card').length);
    if (counts[0] !== 10 || counts[1] !== 10 || counts[2] !== 3) errors.push('[3] page fill wrong: ' + counts.join(','));
    const slots = pages.map(p => p.querySelectorAll('.lux-slot').length);
    if (slots[0] !== 0 || slots[2] !== 7) errors.push('[3] empty slots wrong: ' + slots.join(','));
    const text = host.textContent.trim();
    if (text.length > 0 && !/سباح/.test(text)) errors.push('[3] unexpected extra text on sheet');
  }
  cleanup(w);
}

/* ---- 2) luxury card is the membership card, number under the photo ---- */
{
  const w = boot(Object.assign(seed({ id: 1, name: 'رئيس', role: 'admin' }), { swimmers: Array.from({ length: 12 }, (_, i) => ({ id: 'SDR-' + (2000 + i), name: 'س' + i, group: 'المتقدمون', phone: '06', status: 'نشط' })) }));
  w.__t.action('print-cards', null);
  const card = w.document.querySelector('.print-host .lux-card');
  if (!card) { errors.push('[2] no card rendered'); cleanup(w); }
  else {
    const photo = card.querySelector('.lux-photo');
    const no = card.querySelector('.lux-no');
    if (!photo) errors.push('[2] card has no photo block');
    if (!no) errors.push('[2] card has no membership number element');
    else {
      if (photo.contains(no)) errors.push('[2] the number must sit under the photo frame, not inside it');
      if (!/^SDR-\d+$/.test(no.textContent.trim())) errors.push('[2] number content wrong: ' + no.textContent.trim());
      const wrap = card.querySelector('.lux-photo-wrap');
      if (!wrap) errors.push('[2] no wrapper around the photo frame');
      else if (no.parentElement !== wrap) errors.push('[2] the number must be a direct child of the photo wrapper');
      else {
        const fr = photo.getBoundingClientRect(), nr = no.getBoundingClientRect();
        if (fr.height && nr.height && nr.top < fr.bottom) errors.push('[2] the number renders above the frame bottom instead of under it');
        if (/lux-photo[^\w-]/.test(no.className)) errors.push('[2] the number is styled as part of the frame');
      }
    }
    if (!card.innerHTML.includes('assets/logo.png')) errors.push('[2] club logo missing from card');
  }
  cleanup(w);
  // coaches get their own card model
  const w2 = boot(seed({ id: 1, name: 'رئيس', role: 'admin' }));
  w2.__t.action('print-lux-coaches', null);
  const coachCard = w2.document.querySelector('.print-host .lux-card.is-coach');
  if (!coachCard) errors.push('[2] coach card not produced');
  else {
    for (const n of ['التخصص', 'سنوات الخبرة', 'مدرب سباحة', 'سليم بلعيد']) {
      if (!coachCard.textContent.includes(n)) errors.push('[2] coach card missing ' + n);
    }
  }
  cleanup(w2);
}

/* ---- 4) designed weekly schedule ---- */
{
  const w = boot(Object.assign(seed({ id: 1, name: 'رئيس', role: 'admin' }), { page: 'schedule' }));
  w.__t.state.user = { id: 1, name: 'رئيس', role: 'admin' };
  w.__t.render();
  w.__t.action('print-schedule-doc', null);
  const doc = w.document.querySelector('.print-host .schedule-doc');
  if (!doc) errors.push('[4] schedule document not produced');
  else {
    for (const n of ['sch-head', 'sch-grid', 'sch-day', 'sch-slot', 'sch-card', 'sch-legend', 'sch-notes', 'sch-sign']) {
      if (!doc.querySelector('.' + n)) errors.push('[4] schedule missing .' + n);
    }
    const days = doc.querySelectorAll('.sch-day');
    if (days.length !== 7) errors.push('[4] expected 7 day columns, got ' + days.length);
    const slotsPerDay = days[0].querySelectorAll('.sch-slot').length;
    if (slotsPerDay !== 3) errors.push('[4] expected 3 time slots per day, got ' + slotsPerDay);
    const cards = doc.querySelectorAll('.sch-card');
    if (cards.length !== 3) errors.push('[4] expected 3 session cards, got ' + cards.length);
    if (!doc.textContent.includes('09:00')) errors.push('[4] morning session not slotted correctly');
    if (!doc.textContent.includes('البرنامج الرسمي')) errors.push('[4] missing the document heading');
    if (!/راحة/.test(doc.textContent)) errors.push('[4] empty slots must read "راحة"');
    if (!doc.querySelector('.lux-slot') === false) { /* noop */ }
  }
  // the schedule page must expose the new print button
  w.__t.state.user = { id: 1, name: 'رئيس', role: 'admin' }; setPage(w, 'schedule'); w.__t.render();
  if (!w.document.querySelector('[data-action="print-schedule-doc"]')) errors.push('[4] schedule page missing print-schedule-doc button');
  cleanup(w);
}

/* ---- 1) profile page with editable fields and custom details ---- */
{
  const user = { id: 12, name: 'أمين بلعيد', role: 'swimmer_adult', member_no: 'SDR-0001', phone: '0661000001' };
  const w = boot(seed(user));
  setRole(w, 'profile');
  w.__t.render();
  const main = w.document.querySelector('.role-main');
  if (!main) errors.push('[1] role dashboard missing');
  const inputs = w.document.querySelectorAll('[data-pf]');
  if (inputs.length < 15) errors.push('[1] expected 15+ profile fields, got ' + inputs.length);
  for (const k of ['name', 'phone', 'blood_group', 'height', 'weight', 'emergency_name', 'emergency_phone', 'medical_notes', 'national_id']) {
    if (!w.document.querySelector('[data-pf="' + k + '"]')) errors.push('[1] missing field ' + k);
  }
  if (!w.document.querySelector('.pf-readonly')) errors.push('[1] missing read-only identity block');
  const ro = w.document.querySelector('.pf-readonly') ? w.document.querySelector('.pf-readonly').textContent : '';
  if (!ro.includes('SDR-0001')) errors.push('[1] membership number not shown');
  if (!ro.includes('المبتدئون')) errors.push('[1] group not shown');
  if (!w.document.querySelector('[data-action="add-profile-extra"]')) errors.push('[1] no button to add a custom detail');
  if (!w.document.querySelector('[data-action="save-profile"]')) errors.push('[1] no save button');
  // adding a custom detail
  w.__t.action('add-profile-extra', null);
  if (!w.document.querySelector('[data-pfx-label]')) errors.push('[1] custom detail row not added');
  cleanup(w);
}

/* ---- CSS must carry the new layouts ---- */
{
  const need = ['.lux-page', '.lux-slot', '.lux-no', '.print-sheet10', '.schedule-doc', '.sch-head', '.sch-grid',
    '.sch-day', '.sch-slot', '.sch-card', '.sch-legend', '.sch-notes', '.sch-sign', '.pf-grid', '.pf-readonly',
    '.pf-extra', '.pf-label', '.lux-preview', '.tone-dawn', '.tone-noon', '.tone-dusk'];
  for (const sel of need) if (!new RegExp(sel.replace(/\./g, '\\.') + '(?![\\w-])').test(CSS)) errors.push('CSS missing ' + sel);
  if (!/\.lux-card\{[^}]*width:85mm/.test(CSS)) errors.push('card width must be 85mm for the 10-up sheet');
  if (!/\.lux-card\{[^}]*height:52mm/.test(CSS)) errors.push('card height must be 52mm for the 10-up sheet');
}

if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
console.log('All four modification checks passed.');