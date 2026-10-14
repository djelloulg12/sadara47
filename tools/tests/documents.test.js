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


/* What the club reads: Latin digits, with anything that arrives in
   Arabic-Indic folded, because that is what the page does before it prints.
   Built from the value rather than typed out -- three sets of digits that all look
   the same is how an expectation ends up the wrong length and the check blames
   the sheet. */
function clubShows(v) {
  return Array.from(String(v)).map(c => {
    const p = c.codePointAt(0);
    return (p >= 0x0660 && p <= 0x0669) ? String(p - 0x0660) : c;
  }).join('');
}

const errors = [];
/* What the club reads: Latin digits, with anything that arrives in
   Arabic-Indic folded, because that is what the page does before it prints.
   Built from the value rather than typed out -- three sets of digits that all look
   the same is how an expectation ends up the wrong length and the check blames
   the sheet. */
function clubShows(v) {
  return Array.from(String(v)).map(c => {
    const p = c.codePointAt(0);
    return (p >= 0x0660 && p <= 0x0669) ? String(p - 0x0660) : c;
  }).join('');
}


// 1 + 2. the official form is an overlay on the club's own image
{
  const applicant = {
    first_name_ar: '\u0623\u0645\u064a\u0646', last_name_ar: '\u0628\u0644\u0639\u064a\u062f', birth_date: '2012-04-17',
    address: '\u062d\u064a \u0627\u0644\u062b\u0646\u064a\u0629', blood_group: 'O+', phone: '0661000001',
    guardian_first_name: '\u0643\u0631\u064a\u0645', guardian_national_id: '1970011122334',
    facility: '\u0627\u0644\u0645\u0633\u0628\u062d \u0627\u0644\u062c\u0648\u0627\u0631\u064a \u0628\u0648\u0647\u0631\u0627\u0648\u0629',
    application_no: 'APP-20261004-AB12'
  };
  let sheet = '';
  try { sheet = w.__t.overlaySheet(applicant); } catch (e) { errors.push('overlaySheet threw: ' + e.message); }
  const pairs = [['background image','assets/form-registration-01.jpg'],['first name','\u0623\u0645\u064a\u0646'],
    ['surname','\u0628\u0644\u0639\u064a\u062f'],['birth date','17/04/2012'],['blood','O+'],
    ['phone','0661000001'],['guardian','\u0643\u0631\u064a\u0645'],['guardian id','1970011122334'],
    ['pool','\u0627\u0644\u0645\u0633\u0628\u062d \u0627\u0644\u062c\u0648\u0627\u0631\u064a \u0628\u0648\u0647\u0631\u0627\u0648\u0629']];
  for (const [label, needle] of pairs) if (!sheet.includes(needle)) errors.push('official overlay missing [' + label + ']');
  if (/undefined|NaN/.test(sheet)) errors.push('official overlay contains undefined/NaN');
  /* The top line of the scan carries two labels -- "مسبح :" at the right and
     "رقم التسجيل:" at the left -- and the code had one box for both, measured
     onto the pool's line. The registration number therefore printed beside the
     word مسبح and its own place stayed empty. Each is checked where it belongs,
     and checked against the other, because the defect was an overlap and not a
     missing value. */
  const spotDecls = (APP.match(/const FORM_SPOTS = \[([\s\S]*?)\n\];/) || [, ''])[1]
    .matchAll(/id: '(\w+)',\s*y: ([\d.]+),\s*x0: ([\d.]+),\s*colon: ([\d.]+)/g);
  const emitted = [...sheet.matchAll(/class="f-spot" style="bottom:[\d.]+mm;right:([\d.]+)mm;width:([\d.]+)mm">([^<]*)</g)]
    .map(m => ({ right: Number(m[1]), width: Number(m[2]), text: m[3] }));
  const byId = {};
  [...spotDecls].forEach((d, i) => { if (emitted[i]) byId[d[1]] = emitted[i]; });

  const serial = byId.registration;
  const pool = byId.facility;
  if (!serial) errors.push('no spot for the registration number');
  else if (serial.text !== clubShows(applicant.application_no)) {
    errors.push('the registration number is not printed whole in the club\'s digits: '
      + JSON.stringify(serial.text));
  } else {
    /* Far left of the top line: the box stops just short of the printed label
       and starts at the page's edge. */
    const left = 210 - serial.right - serial.width;
    const right = 210 - serial.right;
    if (right > 37 || left < 1) {
      errors.push('the registration number is not at the far left of the top line: '
        + left.toFixed(1) + '-' + right.toFixed(1) + 'mm');
    }
  }
  if (!pool) errors.push('no spot for the pool');
  else if (pool.text !== applicant.facility) {
    errors.push('the pool does not print the chosen one: ' + JSON.stringify(pool.text));
  }
  if (serial && pool && serial.text === pool.text) {
    errors.push('the registration number and the pool are printing the same value');
  }
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

  /* The club writes its documents in Arabic-Indic digits, dates day first, and
     reference numbers in the digits they are quoted and looked up in. Checked on
     both sides of that line, because getting either one wrong is the failure that
     matters: a date the club reads as 2050, or a membership number that cannot be
     typed back in. */
  const printed = sheet.replace(/<[^>]+>/g, ' ');
  for (const [what, want] of [
    ['the birth date', '17/04/2012'],
    ['the telephone number', '0661000001'],
    ["the guardian's identity number", '1970011122334']
  ]) {
    if (!sheet.includes(want)) errors.push('the printed form has no ' + what
      + ' in Arabic digits: ' + want);
  }
  /* Day first is the club's order, so this is now the direction that is wrong --
     and it is checked because a document that is right on screen and wrong on paper
     is the one nobody catches until the club does. */
  if (/2012\/04\/17/.test(printed)) {
    errors.push('a date is still printed year-first, and the club reads the day first');
  }
  /* The serial on the sheet must be the applicant's request number and nothing
     else -- whole, in the club's digits, with its letters and punctuation left
     alone. A number cut short is a number the club cannot look up. */
  if (!serial || serial.text !== clubShows(applicant.application_no)) {
    errors.push('the registration number on the sheet is not the request number in the club\'s digits: '
      + JSON.stringify(serial && serial.text));
  }
  /* Nothing on the sheet may be left in Arabic-Indic digits: the club writes
     0-9, and a number in the other set is a number somebody has to convert before
     they can type it back in. */
  if (/[\u0660-\u0669]/.test(printed)) {
    errors.push('a sheet carries Arabic-Indic digits, which the club does not write');
  }

  /* The card keeps a photograph, the season it was issued for, and the number,
     in that order down the side. */
  const card = w.__t.luxuryCard({ membership_no: 'SDR-0042', name: 'x', group_name: 'y',
                                  blood_group: 'O+', joined: '2026-09-01', phone: '0661234567' }, 'swimmer');
  const under = card.match(/<div class="lux-photo-wrap">([\s\S]*?)<div class="lux-info">/);
  if (!under.length) errors.push('the card has no photograph column to put the season under');
  else {
    const order = [...under[1].matchAll(/class="(lux-photo|lux-season|lux-no)"/g)].map(m => m[1]);
    if (order.join('>') !== 'lux-photo>lux-season>lux-no') {
      errors.push('under the photograph the card reads ' + order.join(' > ') + '; it should be photo > season > number');
    }
  }
  const SEASON_AR = '2027 / 2026';
  if (!card.includes(SEASON_AR)) {
    errors.push('the card does not carry the season in Arabic digits, later year first');
  }
  if (!card.includes('SDR-0042')) {
    errors.push('the card number is not printed in the club\'s digits');
  }
  if (!APP.includes('2027 / 2026')) {
    errors.push('the club season is not 2027/2026 -- Arabic reads a season from the later year');
  }

  /* The bar above the form tells the user what to do with it. It is an
     instruction for the screen, not part of the document: left in the print it
     lands at the top of page one, over the club's own heading. Read from where
     the print block starts -- matching to the first closing brace would read a
     selector and call it the block. */
  const css = w.__t.officialFormCSS();
  const at = css.indexOf('@media print{');
  if (at === -1) errors.push('the print rules are missing altogether');
  else if (!/\.f-hint\{display:none\}/.test(css.slice(at))) {
    errors.push('the instruction bar is still printed at the top of page one');
  }
  /* The stylesheet is assembled by joining strings, and a stray "+" in front of
     a comment makes it `'...' + + '...'` -- not a syntax error, a number, which
     silently swallows every rule after it. Caught here, not on a printed page. */
  if (/NaN|undefined/.test(css)) {
    const bad = /[^}]*?(NaN|undefined)[^;]*/.exec(css);
    errors.push('the printed stylesheet was assembled wrong: ' + (bad ? bad[0].trim() : '?'));
  }

  /* A value is drawn tight against its colon, so one too long for its box is cut
     at the edge rather than allowed to run over the printed wording. jsdom has
     no layout and cannot measure a glyph, so what is checked is that both print
     paths measure before they print -- the browser does the measuring. */
  if (!/function fitSpots\(/.test(APP)) errors.push('nothing measures a long value down to its box');
  for (const [name, re] of [
    ['the registration form', /function printOfficialForms[\s\S]*?fitSpots\(w\.document\);[\s\S]*?w\.print\(\)/],
    ['the packet', /function printPacket[\s\S]*?fitSpots\(win\.document\);[\s\S]*?win\.print\(\)/]
  ]) {
    if (!re.test(APP)) errors.push(name + ' reaches the printer without being measured first');
  }
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
