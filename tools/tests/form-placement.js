const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const OUT = path.join(ROOT, 'tools', 'tests', 'out', 'form-placement.html');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:4173/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const w = dom.window;
w.localStorage.setItem('sadara-state', JSON.stringify({
  user: null, page: 'home', swimmers: [], applications: [], schedules: [],
  notices: [], attendance: {}, attendanceByDay: {}, groups: [], subscriptions: []
}));
w.open = () => ({ document: { open() { return this; }, write() {}, close() {} }, focus() {}, print() {}, close() {} });
w.alert = () => {};
w.eval(APP + '\n;window.__t={overlaySheet:overlaySheet,officialFormCSS:officialFormCSS,'
  + 'FORM_SPOTS:FORM_SPOTS,formValues:formValues,spotStyle:spotStyle};');

const adult = {
  application_no: 'APP-20261006-ZZ99',
  first_name_ar: 'أمين', last_name_ar: 'بلعيد',
  birth_date: '1994-05-04', birth_place: 'غرداية', wilaya: 'غرداية',
  gender: 'ذكر', blood_group: 'O+', phone: '0661000001', national_id: '19940504887',
  address: 'حي 1200 مسكن، غرداية', category: 'adult', doctor: 'د. بن علي',
  membership_no: 'M-0042', card_issue_place: 'غرداية'
};
const minor = Object.assign({}, adult, {
  category: 'minor',
  guardian_first_name: 'كريم', guardian_last_name: 'بلعيد',
  guardian_relation: 'الأب', guardian_phone: '0662000002',
  guardian_national_id: '1234567890', guardian_birth_date: '1990-01-02',
  guardian_child: 'أمين', card_issue_date: '2026-10-01', card_issue_place: 'غرداية'
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const BG = '/assets/form-registration-01.jpg';

// The first page carries red guide boxes over every spot, so a screenshot shows
// which printed row each box lands on; the second and third are the real
// overlays, one for an adult and one for a minor.
const guides = w.__t.FORM_SPOTS.map(s =>
  '<i class="gd" data-id="' + s.id + '" style="' + w.__t.spotStyle(s) + '"></i>').join('');

const body =
  '<section class="f-page">' +
  '<img class="f-bg" src="' + BG + '" alt="">' + guides +
  '</section>' +
  w.__t.overlaySheet(adult) +
  w.__t.overlaySheet(minor);

const doc = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
  '<title>مواضع الاستمارة</title>' +
  '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=block" rel="stylesheet">' +
  '<style>' + w.__t.officialFormCSS() +
  '.gd{position:absolute;display:block;height:5mm;border:0.3mm dashed rgba(220,0,0,.85);' +
  'background:rgba(255,0,0,.07)}' +
  '</style></head><body>' + body + '</body></html>';

fs.writeFileSync(OUT, doc, 'utf8');
console.log('wrote ' + OUT);
console.log('spots: ' + w.__t.FORM_SPOTS.length);
console.log('bytes: ' + Buffer.byteLength(doc));
