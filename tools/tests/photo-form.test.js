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
  try { w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,PHOTO_BOX:PHOTO_BOX,officialFormCSS:officialFormCSS,overlaySheet:overlaySheet,formValues:formValues,FORM_SPOTS:FORM_SPOTS,FORM_BG:FORM_BG};'); }
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
  /* Every value has to start immediately after the printed colon and stay on the
     line that colon introduces. That is the rule the club reads the form by, so
     it is checked against the geometry rather than against fixed numbers. */
  const spots = [...sheet.matchAll(/class="f-spot" style="bottom:([\d.]+)mm;right:([\d.]+)mm;width:([\d.]+)mm"/g)];
  const geometry = w.__t.FORM_SPOTS.map(s => ({
    id: s.id, y: s.y, x0: s.x0, colon: s.colon
  }));
  if (spots.length !== geometry.length) errors.push('[form] expected ' + geometry.length + ' overlay spots, got ' + spots.length);
  if (/undefined|NaN/.test(sheet)) errors.push('[form] an overlay box has no position');
  for (let i = 0; i < geometry.length; i++) {
    const g = geometry[i];
    const m = spots[i];
    if (!m) { errors.push('[form] no box for ' + g.id); continue; }
    const bottom = Number(m[1]), right = Number(m[2]), width = Number(m[3]);
    const edge = 210 - right;                 // the box's right edge, from the page's left
    const left = edge - width;
    if (bottom <= 0 || bottom >= 297) errors.push('[form] ' + g.id + ' sits outside the page vertically');
    if (Math.abs((297 - bottom) - (g.y + 0.4)) > 0.02) errors.push('[form] ' + g.id + ' is not sitting on its printed rule');
    if (edge > g.colon) errors.push('[form] ' + g.id + ' runs over the printed colon');
    if (edge < g.colon - 1.7 || edge > g.colon - 1.5) errors.push('[form] ' + g.id + ' is not tight against the colon');
    if (left < g.x0 - 0.02) errors.push('[form] ' + g.id + ' starts before its printed line');
    if (left < 0 || edge > 210) errors.push('[form] ' + g.id + ' runs off the side of the page');
  }
  // the identity block must sit on the rules printed on the form
  const ys = geometry.map(g => g.y);
  for (const target of [61.95, 75.25, 85.05, 94.85, 104.65, 114.45, 124.25]) {
    if (!ys.some(y => Math.abs(y - target) < 0.05)) errors.push('[form] no spot on the rule at ' + target + 'mm');
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

/* ---- 4) the adults form carries no guardian, and names one identifier ---- */
{
  const w = boot(seedFor({ id: 1, name: 'u', role: 'admin' }));

  // the interface: pick the adults category and read what is left on screen
  w.__t.action('register', null);
  const cat = w.document.querySelector('#reg-category');
  const modal = w.document.querySelector('.registration-modal');
  if (!cat || !modal) {
    errors.push('[adults] the registration modal did not open');
  } else {
    const setCat = v => { cat.value = v; cat.dispatchEvent(new w.Event('change')); };
    const shown = () => Array.from(modal.querySelectorAll('label, .form-section-title, a, button'))
      .filter(n => !n.hidden && !n.closest('[hidden]'))
      .map(n => (n.textContent || '').replace(/\s+/g, ' ').trim());

    setCat('minor');
    const minorShown = shown();
    setCat('adult');
    const adultShown = shown();

    for (const label of ['اسم الولي', 'لقب الولي', 'صلة القرابة', 'هاتف الولي', 'رقم تعريف الولي']) {
      if (adultShown.some(t => t.indexOf(label) === 0)) errors.push('[adults] still showing the guardian field: ' + label);
      if (!minorShown.some(t => t.indexOf(label) === 0)) errors.push('[adults] a minor lost the guardian field: ' + label);
    }
    for (const link of ['معاينة بطاقة التسجيل الرسمية', 'معاينة النظام الداخلي',
      'استمارة النادي', 'النظام الداخلي', 'استمارة النظام', 'نموذج بطاقة الانخراط']) {
      if (adultShown.indexOf(link) !== -1) errors.push('[adults] still showing the link: ' + link);
    }
    // the swimmer's own national number is the one identifier that stays
    const nin = w.document.querySelector('#reg-nin');
    if (!nin || nin.closest('[hidden]')) errors.push('[adults] the swimmer national number was hidden');
    if (!adultShown.some(t => t.indexOf('رقم التعريف الوطني') === 0)) errors.push('[adults] the national number label is gone');
    // the modal needs its own print button; the landing page carries a control
    // with the same action, which used to satisfy the guard and leave the modal
    // without one at all
    const printBtn = () => modal.querySelector('[data-action="print-registration-form"]');
    if (!printBtn()) errors.push('[adults] the modal has no A4 print button');
    else if (!printBtn().hidden) errors.push('[adults] the print button is showing for an adult');
    // the landing page's own quick action must survive the modal's toggle
    const landing = w.document.querySelector('.qs-item[data-action="print-registration-form"]');
    if (landing && landing.hidden) errors.push('[adults] the modal toggle hid the landing page link');
    // switching back must not leave anything hidden
    setCat('minor');
    for (const link of ['استمارة النادي', 'النظام الداخلي']) {
      if (!shown().includes(link)) errors.push('[adults] a minor lost the link: ' + link);
    }
    if (!shown().some(t => t.indexOf('طباعة نموذج التسجيل') === 0)) errors.push('[adults] a minor lost the print button');
    if (printBtn() && printBtn().hidden) errors.push('[adults] the print button stayed hidden for a minor');
    // and an adult's entered data must never reach a guardian box
    const guardian = w.document.querySelector('#reg-guardian-first');
    if (guardian) guardian.value = 'يجب ألا يطبع';
    setCat('adult');
  }

  // the print file: an adult's form has no guardian block at all
  const adult = {
    category: 'adult', first_name_ar: 'أمين', last_name_ar: 'بلعيد',
    birth_date: '1994-05-04', address: 'غرداية', blood_group: 'O+', phone: '0661000001',
    national_id: '19940504887', membership_no: 'M-0042',
    guardian_first_name: 'كريم', guardian_last_name: 'بلعيد',
    guardian_national_id: '1234567890', guardian_child: 'أمين'
  };
  const sheet = w.__t.overlaySheet(adult);
  for (const leaked of ['كريم', '1234567890', 'يجب ألا يطبع']) {
    if (sheet.includes(leaked)) errors.push('[adults] a guardian value reached the printed form: ' + leaked);
  }
  const guardians = w.__t.FORM_SPOTS.filter(s => /^(parent_|card_|authorised_for$)/.test(s.id));
  const boxes = (sheet.match(/class="f-spot"/g) || []).length;
  if (boxes !== w.__t.FORM_SPOTS.length - guardians.length) {
    errors.push('[adults] printed ' + boxes + ' boxes, expected ' + (w.__t.FORM_SPOTS.length - guardians.length));
  }
  if (!sheet.includes('أمين')) errors.push('[adults] the swimmer name is missing from the printed form');
  // a minor still gets the whole block
  const minorSheet = w.__t.overlaySheet(Object.assign({}, adult, { category: 'minor' }));
  if (!minorSheet.includes('كريم')) errors.push('[adults] a minor lost the guardian name');
  if ((minorSheet.match(/class="f-spot"/g) || []).length !== w.__t.FORM_SPOTS.length) {
    errors.push('[adults] a minor form is missing boxes');
  }

  /* "بن ___" is the surname, not the nationality: the declaration reads
     "... السيد(ة) ___ المولود(ة) بتاريخ ___ بن ___", so the given name and the
     surname are two separate blanks. Nationality has no blank on the form. */
  const vals = w.__t.formValues(Object.assign({}, adult, {
    category: 'minor', guardian_first_name: 'كريم', guardian_last_name: 'بلعيد'
  }));
  if (vals.parent_name !== 'كريم') errors.push('[form] the declaration name is not the given name: ' + vals.parent_name);
  if (vals.parent_last_name !== 'بلعيد') errors.push('[form] the بن line is not the surname: ' + vals.parent_last_name);
  if ('parent_nationality' in vals) errors.push('[form] the declaration still carries a nationality field');
  const bnSpot = w.__t.FORM_SPOTS.find(s => s.id === 'parent_last_name');
  if (!bnSpot) errors.push('[form] the بن line lost its spot');
  cleanup(w);
}

if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
console.log('All photo / permission / form-overlay checks passed.');