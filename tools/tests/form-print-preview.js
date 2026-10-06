/**
 * Writes the two printed sheets to a real file so the club (and you) can look
 * at them without going through the browser's print dialog.
 *
 *   node tools/tests/form-print-preview.js
 *   open tools/tests/out/istimara-print-preview.html
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'tools', 'tests', 'out');
const PRINT = fs.readFileSync(path.join(ROOT, 'firebase-public', 'istimara', 'print.js'), 'utf8');

const SAMPLE = {
  category: 'minor',
  application_no: 'APP-20260101-AB12',
  first_name_ar: 'مريم', last_name_ar: 'بلعيد',
  first_name_fr: 'Meriem', last_name_fr: 'Belaid',
  birth_date: '2013-09-14', gender: 'female', blood_group: 'A+',
  phone: '0661000001', whatsapp: '0661000002',
  address: 'حي الثنية، شارع العربي بن مهيدي',
  wilaya: 'غرداية', birth_place: 'غرداية',
  national_id: '20130914456', birth_certificate_no: '2013-1445',
  level: 'مبتدئ', swimming_strokes: 'حرة، ظهر',
  guardian_first_name: 'كريم', guardian_last_name: 'بلعيد',
  guardian_birth_date: '1985-02-03', guardian_relation: 'الأب',
  guardian_phone: '0661000003', guardian_national_id: '19850203887',
  guardian_consent: true,
  doctor_name: 'د. بن عمار', doctor_specialty: 'طبابة رياضية',
  medical_date: '2025-09-01', medical_place: 'المصحة الجامعية — غرداية',
  facility: 'المسبح الأولمبي', subscription_code: 'season',
  plan_name: 'اشتراك موسمي',
  transport: true, uniform: true, transport_amount: 900, uniform_amount: 2500,
  payment_method: 'cash', expected_amount: 6400,
  notes: 'يفضّل التدريب صباحاً.'
};

const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
dom.window.eval(PRINT);
const F = dom.window.SADARA_FORM;

fs.mkdirSync(OUT, { recursive: true });

const write = (name, rec) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, F.documentHTML(rec, {}), 'utf8');
  console.log('wrote', path.relative(ROOT, file));
};

write('istimara-print-minor.html', SAMPLE);
write('istimara-print-adult.html', Object.assign({}, SAMPLE, { category: 'adult' }));
console.log('\nBoth sheets are 210x297mm. Open the file and print at 100% scale,');
console.log('with margins set to "none" -- the club card is measured in millimetres.');
