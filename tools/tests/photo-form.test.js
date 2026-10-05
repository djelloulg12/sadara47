const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const RULES = fs.readFileSync(String.raw`G:\التطبيقات والبرام\الصدارة\02\storage.rules`, 'utf8');
const errors = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => { w.__p = (w.__p || 0) + 1; };
  w.open = () => { const d = { html: '', open(){return this;}, write(h){this.html+=h;}, close(){} }; (w.__popups = w.__popups || []).push(d); return { document: d, focus(){}, print(){}, close(){} }; };
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {};
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.__calls = [];
  w.fetch = function (u, i) { w.__calls.push({ url: String(u), method: (i && i.method || 'GET').toUpperCase() }); return Promise.resolve({ ok: true, json: async () => ({ ok: true, profile: {} }) }); };
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,PHOTO_BOX:PHOTO_BOX,officialFormCSS:officialFormCSS,overlaySheet:overlaySheet,FORM_SPOTS:FORM_SPOTS,FORM_BG:FORM_BG};'); }
  catch (e) { errors.push('load: ' + e.message); }
  if (seed && seed.user) w.__t.state.user = seed.user;
  return w;
}
const cleanup = w => { w.document.body.classList.remove('printing'); const h = w.document.querySelector('.print-host'); if (h) h.remove(); };
const SWIMMERS = Array.from({ length: 12 }, (_, i) => ({ id: 'SDR-' + (3000 + i), name: 'سباح ' + (i + 1), group: 'المبتدئون', phone: '06', status: 'نشط' }));
const seedFor = user => ({ user, page: 'card', swimmers: SWIMMERS, applications: [{ id: 9, application_type: 'coach', application_no: 'APP-C1', coach_name: 'سليم', coach_phone: '066', coach_specialty: 'سباحة', coach_experience: '6', status: 'approved' }], schedules: [], notices: [], attendance: {}, attendanceByDay: {}, groups: [], extras: {} });

/* ---- 1) member photo upload ---- */
{
  const w = boot(seedFor({ id: 12, name: 'أمين', role: 'swimmer_adult', member_no: 'SDR-3000', phone: '066' }));
  w.__t.state.rolePage = 'profile';
  w.__t.render();
  const main = w.document.querySelector('.role-main');
  if (!main) errors.push('[photo] profile page did not render');
  const picker = w.document.querySelector('#my-photo');
  if (!picker) errors.push('[photo] no file picker on the profile page');
  else {
    const accept = picker.getAttribute('accept') || '';
    if (!/jpeg/.test(accept) || !/png/.test(accept)) errors.push('[photo] accept attribute incomplete: ' + accept);
    if (picker.hidden !== true) errors.push('[photo] the native input must stay hidden');
  }
  if (!w.document.querySelector('[data-action="upload-my-photo"]') && !picker) errors.push('[photo] no upload wiring');
  if (!w.document.querySelector('.pf-photo-preview')) errors.push('[photo] no photo preview area');
  if (!/type="file"/.test(APP)) errors.push('[photo] code has no file input');
  // limit constant present
  if (!/PHOTO_MAX_BYTES\s*=\s*3\s*\*\s*1024\s*\*\s*1024/.test(APP)) errors.push('[photo] 3 MB limit not declared');
  if (!/member-photos/.test(APP)) errors.push('[photo] storage path missing');
  if (!/member-photos\/\{uid\}/.test(RULES)) errors.push('[photo] storage rule for member-photos missing');
  if (!/3 \* 1024 \* 1024/.test(RULES)) errors.push('[photo] storage rule has no 3 MB limit');
  cleanup(w);
}

/* ---- 2) printing all cards is management only ---- */
{
  const cases = [
    ['admin', true], ['president', true], ['manager', true], ['coach', true],
    ['swimmer_adult', false], ['parent', false], ['member', false], ['swimmer_minor', false]
  ];
  for (const [role, allowed] of cases) {
    const w = boot(seedFor({ id: 1, name: 'u', role }));
    w.__t.state.page = 'card';
    w.__t.render();
    w.__t.action('print-cards', null);
    const printed = !!w.document.querySelector('.print-host');
    if (allowed && !printed) errors.push(`[gate] ${role} must be able to print all cards`);
    if (!allowed && printed) errors.push(`[gate] ${role} must NOT be able to print all cards`);
    cleanup(w);
  }
  // the coach card sheet is a single card, so it must stay available to everyone
  const w = boot(seedFor({ id: 12, name: 'u', role: 'swimmer_adult', member_no: 'SDR-3000' }));
  w.__t.action('print-role-card', null);
  if (!w.document.querySelector('.print-host')) errors.push('[gate] a member must still print their own card');
  cleanup(w);
}

/* ---- 3) the official form overlays the real image ---- */
{
  const w = boot(seedFor({ id: 1, name: 'u', role: 'admin' }));
  const applicant = {
    first_name_ar: 'جلول', last_name_ar: 'قندوز', birth_date: '2012-04-17',
    address: 'غرداية', blood_group: 'O+', phone: '0661000001',
    guardian_first_name: 'لخضر', guardian_last_name: 'قندوز',
    guardian_national_id: '1970011122334', application_no: 'APP-20261004-KK'
  };
  const sheet = w.__t.overlaySheet(applicant);
  if (!sheet.includes('assets/form-registration-01.jpg')) errors.push('[form] background image missing');
  if (!/class="f-bg"/.test(sheet)) errors.push('[form] no full-page background image');
  const spots = [...sheet.matchAll(/class="f-spot" style="top:([\d.]+)mm;right:([\d.]+)mm;width:([\d.]+)mm"/g)];
  if (spots.length !== 18) errors.push('[form] expected 18 overlay spots, got ' + spots.length);
  for (const m of spots) {
    const y = Number(m[1]), r = Number(m[2]), wd = Number(m[3]);
    if (y < 60 || y > 260) errors.push('[form] spot vertical position off the page: ' + m[1]);
    if (r > 210) errors.push('[form] spot past the right edge: ' + m[2]);
    if (r - wd < 0) errors.push('[form] spot past the left edge');
  }
  // the identity block must sit over the detected rules
  const ys = spots.map(m => Number(m[1]));
  for (const target of [75.9, 85.8, 95.6, 105.7, 115.8, 125.5, 137.6]) {
    if (!ys.some(y => Math.abs(y - target) < 0.2)) errors.push('[form] missing a spot on the rule at ' + target + 'mm');
  }
  if (!sheet.includes('جلول')) errors.push('[form] applicant name not filled in');
  if (!sheet.includes('17/04/2012')) errors.push('[form] birth date not formatted for the form');
  if (!/f-photo/.test(sheet)) errors.push('[form] photo frame missing');
  const px = w.__t.PHOTO_BOX;
  if (Math.abs(px.w - 36.4) > 0.3 || Math.abs(px.h - 42.5) > 0.3) errors.push('[form] photo box size drifted from the image');
  // print CSS: A4 with zero margin so the image fills the page
  const css = w.__t.officialFormCSS();
  if (!/@page\{size:A4 portrait;margin:0\}/.test(css)) errors.push('[form] @page must be A4 with no margin');
  if (!/\.f-page\{[^}]*width:210mm;height:297mm/.test(css)) errors.push('[form] page box must be exactly A4');
  if (!/object-fit:fill/.test(css)) errors.push('[form] background must stretch to the page');
  if (!/Cairo/.test(css)) errors.push('[form] Arabic webfont not declared');
  if (!/font-size:1[0-9](\.\d+)?pt/.test(css)) errors.push('[form] overlay font size outside the 10-19pt range');
  if (!/background:transparent/.test(css)) errors.push('[form] overlay text boxes must have a transparent background');
  const spotBlock = (css.split('.f-spot')[1] || '').split('}')[0];
  if (/border\s*:\s*(?!0|none)/.test(spotBlock)) errors.push('[form] overlay boxes must have no visible border');
  cleanup(w);
}

if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
console.log('All photo / permission / form-overlay checks passed.');