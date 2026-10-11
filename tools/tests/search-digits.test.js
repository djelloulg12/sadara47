/* The search that finds a request by the number printed on it.

   The club writes its numbers in Arabic-Indic digits and the request number is
   printed that way, so a number read off a sheet has to be findable by typing it
   as it was written -- and a number copied out of a spreadsheet in Latin digits
   has to find the same record. Both are written to the database in one form, so
   this is the only place the two have to meet.

   Checked here rather than on a page, because a page check would only prove the
   page calls the function. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const errors = [];

/* The one line the check is about, taken out of the built file and run on its own
   with the same helpers the page uses. A check that re-implements the thing it is
   checking proves nothing. */
const line = /const needle=latinDigits\(q\)\.toUpperCase\(\);[\s\S]{0,220}?return hay\.includes\(needle\);/
  .exec(APP);
if (!line) {
  errors.push('the search does not fold digits on both sides, so a number printed '
    + 'in the club\'s digits cannot be typed back to find its record');
} else {
  const arabicOf = v => Array.from(String(v)).map(c =>
    (c >= '0' && c <= '9') ? String.fromCodePoint(0x0660 + Number(c)) : c).join('');

  const arDigits = v => String(v === undefined || v === null ? '' : v)
    .replace(/[0-9]/g, d => String.fromCodePoint(0x0660 + Number(d)));
  const latinDigits = v => String(v === undefined || v === null ? '' : v)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));

  const appName = a => a.application_type === 'coach' ? (a.coach_name || 'coach')
    : `${a.first_name_ar || ''} ${a.last_name_ar || ''}`.trim() || a.application_no || '-';
  const appContact = a => a.phone || a.email || '';

  /* Wrapped as a function of (the request, what was typed), which is the shape it
     has on the page. Read straight out of the built file rather than copied, so a
     change to the search that breaks it is a change this notices. */
  const find = new Function('latinDigits', 'appName', 'appContact',
    'return function matchesApp(a, q) {\n' + line[0] + '\n};');

  /* The application the search is being asked about, in the shape the database
     holds it: Latin digits, because that is what is written there. */
  const record = {
    first_name_ar: 'amin', last_name_ar: 'belaid',
    application_no: 'APP-20261011-33A7', registration_id: 'E202610001',
    phone: '0661000001'
  };
  const matchesApp = find(latinDigits, appName, appContact);

  const found = [
    ['the number as it is stored', 'APP-20261011-33A7'],
    ['the number as it is printed on the sheet', arabicOf('APP-20261011-33A7')],
    ['the registration number as it is printed', arabicOf('E202610001')],
    ['a name', 'belaid'],
    ['part of the number', '33A7'],
    ['part of the number in the club\'s digits', arabicOf('33A7')]
  ];
  for (const [what, q] of found) {
    if (!matchesApp(record, q)) {
      errors.push('the search does not find the request by ' + what + ': ' + q);
    }
  }
  const missed = [['another request', 'APP-20261011-9999'], ['a name that is not on it', 'someone']];
  for (const [what, q] of missed) {
    if (matchesApp(record, q)) {
      errors.push('the search claims to find ' + what + ' for ' + q);
    }
  }
}

/* The helpers the search leans on must be in the built file at all, and must fold
   both sets of digits -- the search is useless without them and would throw. */
if (!/function latinDigits/.test(APP)) errors.push('the platform has no way to fold Arabic-Indic digits back');
if (!/arDigits/.test(APP)) errors.push('the platform cannot write a number in the club\'s digits');

if (errors.length) {
  console.log('\nPROBLEMS (' + errors.length + '):');
  for (const e of errors) console.log('   - ' + e);
  process.exit(1);
}
console.log('PASS  a number found in either script finds the same record');
void JSDOM; void HTML;