const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// the generated sample is written next to the suite so it can be opened
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// the generated sample is written next to the suite so it can be opened

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

const app = {
  id: 1, application_no: 'APP-20261004-AB12', first_name_ar: 'أمين', last_name_ar: 'بلعيد',
  first_name_fr: 'Amine', last_name_fr: 'Belaid', national_id: '2980512345678', birth_date: '2012-04-17',
  birth_place: 'غرداية', wilaya: 'غرداية', address: 'حي الثنية - غرداية', gender: 'm', blood_group: 'O+',
  phone: '0661000001', whatsapp: '0661000001', category: 'minor', subscription_code: 'quarter',
  transport: true, uniform: false, expected_amount: 1900, status: 'pending',
  guardian_first_name: 'كريم', guardian_last_name: 'بلعيد', guardian_national_id: '1970011122334', guardian_phone: '0661000001'
};

const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'https://x.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem('sadara-state', JSON.stringify({
  user: { id: 1, name: 'رئيس', role: 'admin' }, page: 'card', swimmers: [
    { id: 'SDR-0001', name: 'أمين بلعيد', group: 'المبتدئون', phone: '0661000001', status: 'نشط' }
  ], applications: [Object.assign({ application_type: 'coach', coach_name: 'سليم بلعيد', coach_phone: '0662000000', specialty: 'مدرب سباحة', experience: 6 }, {})],
  subscriptions: [], schedules: [], notices: [], attendance: {}, groups: []
}));
w.print = () => { w.__p = (w.__p || 0) + 1; };
w.open = () => ({ write() {}, document: { write() {}, close() {} }, focus() {}, close() {} });
w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {}; w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action,buildQRCodes:buildQRCodes,overlaySheet:overlaySheet,officialFormCSS:officialFormCSS,luxuryCard:luxuryCard};');
w.__t.state.user = { id: 1, name: 'رئيس', role: 'admin' };

const errors = [];

// 1 + 2. the official form is an overlay on the club's own image
{
  const applicant = {
    first_name_ar: '\u0623\u0645\u064a\u0646', last_name_ar: '\u0628\u0644\u0639\u064a\u062f', birth_date: '2012-04-17',
    address: '\u062d\u064a \u0627\u0644\u062b\u0646\u064a\u0629', blood_group: 'O+', phone: '0661000001',
    guardian_first_name: '\u0643\u0631\u064a\u0645', guardian_national_id: '1970011122334',
    application_no: 'APP-20261004-AB12'
  };
  let sheet = '';
  try { sheet = w.__t.overlaySheet(applicant); } catch (e) { errors.push('overlaySheet threw: ' + e.message); }
  const pairs = [['background image','assets/form-registration-01.jpg'],['first name','\u0623\u0645\u064a\u0646'],
    ['surname','\u0628\u0644\u0639\u064a\u062f'],['birth date','17/04/2012'],['blood','O+'],
    ['phone','0661000001'],['guardian','\u0643\u0631\u064a\u0645'],['guardian id','1970011122334']];
  for (const [label, needle] of pairs) if (!sheet.includes(needle)) errors.push('official overlay missing [' + label + ']');
  if (/undefined|NaN/.test(sheet)) errors.push('official overlay contains undefined/NaN');
  // The serial goes on the printed "مسجّل:" line at y = 61.95mm.
  const serial = sheet.match(/bottom:234\.65mm[^>]*>([^<]*)</);
  if (!serial || !serial[1].trim()) errors.push('the registration serial line stays empty');
  else if (serial[1].length > 12) errors.push('the registration serial is too long for the printed line: ' + serial[1]);
  let blank = '';
  try { blank = w.__t.overlaySheet(null); } catch (e) { errors.push('blank overlay threw: ' + e.message); }
  /* Counted from the spot list rather than written as a literal: a hardcoded
     number has to be edited every time a field is added or removed, and the day
     nobody does is the day it stops meaning anything. */
  const spots = t => (t.match(/class="f-spot"/g) || []).length;
  const expected = (APP.match(/const FORM_SPOTS = \[([\s\S]*?)\n\];/) || [, ''])[1]
    .match(/id: '\w+'/g) || [];
  if (!expected.length) errors.push('the spot list could not be read');
  if (spots(sheet) !== expected.length || spots(blank) !== expected.length) {
    errors.push('overlay slot count changed: ' + spots(sheet) + '/' + spots(blank)
      + ' against ' + expected.length + ' spots');
  }
  if (!/class="f-photo"/.test(blank)) errors.push('blank overlay must keep the photo frame');
  const order = [61.95, 75.25, 85.05, 94.85, 104.65, 114.45, 124.25];
  const bottoms = [...sheet.matchAll(/bottom:([\d.]+)mm/g)].map(m => 297 - Number(m[1]) - 0.4);
  for (const y of order) if (!bottoms.some(v => Math.abs(v - y) < 0.02)) errors.push('no overlay on the rule at ' + y + 'mm');
}

// 3. luxury cards
try {
  w.__t.state.swimmers = [{ id: 'SDR-0001', name: 'أمين بلعيد', group: 'المبتدئون', phone: '0661', status: 'نشط', blood_group: 'O+' }];
  w.__t.state.applications = [{ id: 9, application_type: 'coach', coach_name: 'سليم بلعيد', coach_phone: '0662', specialty: 'مدرب سباحة', experience: 6 }];
  w.__t.state.applications.push(Object.assign({}, app));
  w.__t.state.page = 'card';
  w.__t.render();
  w.__t.action('print-lux-swimmers', null);
  let host = w.document.querySelector('.print-host');
  if (!host) errors.push('lux swimmer sheet not produced');
  else {
    const c = host.querySelector('.lux-card');
    if (!c) errors.push('lux card markup missing');
    else {
      for (const n of ['lux-side', 'lux-logo', 'lux-qr', 'lux-rows', 'lux-role', 'assets/logo.png']) {
        if (!host.innerHTML.includes(n)) errors.push('lux card missing ' + n);
      }
    }
  }
  w.document.body.classList.remove('printing');
  const h = w.document.querySelector('.print-host'); if (h) h.remove();

  w.__t.action('print-lux-coaches', null);
  host = w.document.querySelector('.print-host');
  if (!host) errors.push('lux coach sheet not produced');
  else if (!host.querySelector('.lux-card.is-coach')) errors.push('coach lux card class missing');
  if (!host.innerHTML.includes('سليم')) errors.push('coach name not on lux card');
  w.document.body.classList.remove('printing');
  const h2 = w.document.querySelector('.print-host'); if (h2) h2.remove();
} catch (e) { errors.push('luxury card flow threw: ' + e.message); }

// 4. the membership card is the luxury card (rail + number under the photo)
try {
  w.__t.render();
  const card = w.document.querySelector('.lux-card');
  if (!card) errors.push('membership card not rendered');
  else {
    for (const n of ['lux-side', 'lux-photo', 'lux-no', 'lux-qr']) {
      if (!card.outerHTML.includes(n)) errors.push('membership card missing ' + n);
    }
  }
} catch (e) { errors.push('membership card flow threw: ' + e.message); }

// 5. applications page exposes official form printing
try {
  w.__t.state.page = 'applications';
  w.__t.render();
  if (!w.document.querySelector('[data-action="print-official-forms-all"]')) errors.push('missing print-official-forms-all button');
  if (!w.document.querySelector('[data-action="print-official-blank"]')) errors.push('missing blank form button');
  if (!w.document.querySelector('[data-action="print-official-form"]')) errors.push('missing per-application form button');
} catch (e) { errors.push('applications page threw: ' + e.message); }

// 6. CSS coverage for the new classes
const css = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
for (const cls of ['lux-card', 'lux-side', 'lux-main', 'lux-qr', 'lux-rows', 'lux-role', 'lux-stars',
  'lux-logo', 'lux-vert', 'lux-season', 'lux-foot', 'lux-fr', 'lux-info', 'lux-photo', 'lux-body',
  'lux-top', 'lux-club', 'lux-grid', 'lux-preview', 'official-forms-list', 'card-band',
  'print-card-rail', 'print-card-inner', 'print-card-content', 'lux-row']) {
  if (!new RegExp('\\.' + cls + '(?![\\w-])').test(css)) errors.push('CSS missing .' + cls);
}

console.log(errors.length ? 'PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ') : 'All document-generation checks passed.');
if (errors.length) process.exit(1);

// dump for visual review
const sample = w.__t.overlaySheet({ first_name_ar: '\u0623\u0645\u064a\u0646', last_name_ar: '\u0628\u0644\u0639\u064a\u062f', birth_date: '2012-04-17', blood_group: 'O+', phone: '0661000001', address: '\u063a\u0631\u062f\u0627\u064a\u0629', guardian_first_name: '\u0643\u0631\u064a\u0645' });
const card = w.__t.luxuryCard({ membership_no: 'SDR-1', name: '\u0623\u0645\u064a\u0646', group_name: '\u0627\u0644\u0645\u0628\u062a\u062f\u0626\u0648\u0646', phone: '0661000001' }, 'swimmer');
fs.writeFileSync(path.join(OUT, 'form-sample.html'),
  '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
  '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">' +
  '<style>' + w.__t.officialFormCSS() + '</style></head><body>' + sample +
  '<div style="padding:20px">' + card + '</div></body></html>', 'utf8');
console.log('sample written to official-form-sample.html');
