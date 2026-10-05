const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const OUT = String.raw`path.resolve(__dirname, '..', '..')\packet-preview.html`;
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem('sadara-state', JSON.stringify({
  user: null, page: 'home', swimmers: [], applications: [], schedules: [], notices: [],
  attendance: {}, attendanceByDay: {}, groups: [],
  subscriptions: [
    { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر', active: true },
    { code: 'season', name: 'اشتراك حر', amount: 3000, duration: 'موسم', active: true }
  ],
  extras: { transport: 900, uniform: 2500 }
}));
w.open = () => ({ document: { open() { return this; }, write() {}, close() {} }, focus() {}, print() {}, close() {} });
w.alert = () => {};
w.eval(APP + '\n;window.__t={packetDocument:packetDocument};');

const rec = {
  application_no: 'APP-20261005-AB12',
  first_name_ar: 'أمين', last_name_ar: 'بلعيد',
  birth_date: '2013-05-04', birth_place: 'غرداية', wilaya: 'غرداية',
  gender: 'ذكر', blood_group: 'O+', phone: '0661000001',
  address: 'حي 1200 مسكن، غرداية', category: 'minor',
  guardian_first_name: 'كريم', guardian_national_id: '1234567890',
  guardian_child: 'أمين',
  subscription_code: 'quarter', transport: 1, uniform: 1, payment_method: 'cash',
  expected_amount: 4400, facility: 'المسبح الأولمبي',
  card_issue_place: 'غرداية', doctor: 'د. بن علي'
};
const doc = w.__t.packetDocument(rec);
fs.writeFileSync(OUT, doc, 'utf8');
const pages = (doc.match(/class="(?:f|pk)-page/g) || []).length;
console.log('wrote ' + OUT);
console.log('pages: ' + pages + ' | bytes: ' + Buffer.byteLength(doc));