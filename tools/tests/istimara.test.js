/**
 * The public registration page in /istimara/.
 *
 * It is a second way into the same data, so three things have to hold:
 *   * it posts what the platform's management screen already reads
 *   * it needs no account, which firestore.rules already allows
 *   * the card it prints is measured from the same geometry as the
 *     platform's, so the club reads both the same way
 *
 * Runs against firebase-public/istimara/, because that is the tree
 * Firebase serves.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUB = path.join(ROOT, 'firebase-public');
const FOLDER = path.join(PUB, 'istimara');
const errors = [];
/* Checks that need the page to settle run in order at the end, so none of them
   is skipped by an earlier one returning. */
const tasks = [];

const HTML = fs.readFileSync(path.join(FOLDER, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(FOLDER, 'istimara.css'), 'utf8');
const PAGE = fs.readFileSync(path.join(FOLDER, 'istimara.js'), 'utf8');
const PRINT = fs.readFileSync(path.join(FOLDER, 'print.js'), 'utf8');
const APP = fs.readFileSync(path.join(PUB, 'app.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

/* Amounts are printed with toLocaleString, which puts a comma or a narrow
   space between the thousands depending on the runtime, so compare on digits
   alone. */
const digits = s => String(s).replace(/[\s\u00a0\u202f\u2009,]/g, '');
const isAmount = (text, want) => digits(text).indexOf(String(want)) !== -1;

/* ---- 1) the folder is self-contained ---- */
{
  for (const f of ['index.html', 'istimara.css', 'istimara.js', 'print.js']) {
    if (!fs.existsSync(path.join(FOLDER, f))) errors.push('[tree] missing ' + f + ' in firebase-public/istimara');
  }
  if (!/href="istimara\.css"/.test(HTML)) errors.push('[tree] the page does not load its own stylesheet');
  if (!/src="istimara\.js"/.test(HTML)) errors.push('[tree] the page does not load its own script');
  if (!/src="print\.js"/.test(HTML)) errors.push('[tree] the print engine is not loaded');
  /* It shares the project's Firebase config and adapter -- one API contract --
     but it must not pull in the platform shell, which needs a session. */
  if (!/src="\/firebase-adapter\.js"/.test(HTML)) errors.push('[tree] the page bypasses the shared adapter');
  if (/src="app\.js"/.test(HTML)) errors.push('[tree] the page loads the platform shell');
  if (/\bsignIn|createUserWith|onAuthStateChanged/.test(PAGE)) {
    errors.push('[tree] the page asks for an account, so it is not public');
  }
  /* Relative links break the moment the page is opened from another path, and a
     root-absolute one has to exist in the deployable tree too. */
  for (const m of HTML.matchAll(/(?:href|src)="(?!https?:|\/\/|#|data:|mailto:)([^"]+)"/g)) {
    const ref = m[1].split('?')[0];
    const abs = ref.startsWith('/') ? path.join(PUB, ref) : path.resolve(FOLDER, ref);
    if (!fs.existsSync(abs)) errors.push('[tree] the page points at a file that is not there: ' + ref);
  }
  if (!/<html[^>]*lang="ar"[^>]*dir="rtl"/.test(HTML)) errors.push('[tree] the page is not Arabic right-to-left');
  if (!/name="viewport"/.test(HTML)) errors.push('[tree] no viewport: it would zoom on a phone');
  if (!/rel="canonical"/.test(HTML)) errors.push('[tree] no canonical url for the page');
  /* The card is drawn from an absolute path, because this page lives one
     folder down from the platform's assets. */
  if (!/FORM_BG\s*=\s*'\/assets\/form-registration-01\.jpg'/.test(PRINT)) {
    errors.push('[tree] the card image is not addressed from the site root');
  }
}

/* ---- 2) the printed geometry is the platform's, not a second copy that drifts ---- */
{
  const spots = src => {
    const block = (src.match(/(?:const|var) FORM_SPOTS = \[([\s\S]*?)\n\s*\];/) || [])[1] || '';
    return [...block.matchAll(/\{\s*id:\s*'([^']+)',\s*y:\s*([\d.]+),\s*x0:\s*([\d.]+),\s*colon:\s*([\d.]+)\s*\}/g)]
      .map(m => ({ id: m[1], y: Number(m[2]), x0: Number(m[3]), colon: Number(m[4]) }));
  };
  const mine = spots(PRINT);
  const theirs = spots(APP);
  if (!theirs.length) errors.push('[drift] could not read FORM_SPOTS out of app.js');
  if (mine.length !== theirs.length) {
    errors.push(`[drift] the form has ${mine.length} spots, the platform has ${theirs.length}`);
  }
  for (let i = 0; i < Math.min(mine.length, theirs.length); i++) {
    const a = mine[i], b = theirs[i];
    if (a.id !== b.id) { errors.push(`[drift] spot ${i} is "${a.id}" here and "${b.id}" on the platform`); continue; }
    for (const k of ['y', 'x0', 'colon']) {
      if (Math.abs(a[k] - b[k]) > 0.001) {
        errors.push(`[drift] ${a.id}.${k} is ${a[k]} here and ${b[k]} on the platform`);
      }
    }
  }
  const box = src => {
    const m = src.match(/PHOTO_BOX\s*=\s*\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*w:\s*([\d.]+),\s*h:\s*([\d.]+)\s*\}/);
    return m ? m.slice(1, 5).map(Number) : null;
  };
  const a = box(PRINT), b = box(APP);
  if (!a || !b) errors.push('[drift] the photo frame could not be read from one of the two');
  else if (a.some((v, i) => Math.abs(v - b[i]) > 0.001)) {
    errors.push('[drift] the photo frame drifted: ' + a.join(',') + ' vs ' + b.join(','));
  }
  for (const key of ['SPOT_GAP', 'SPOT_CLEAR']) {
    const one = (PRINT.match(new RegExp(key + '\\s*=\\s*([\\d.]+)')) || [])[1];
    const two = (APP.match(new RegExp(key + '\\s*=\\s*([\\d.]+)')) || [])[1];
    if (!one || !two) errors.push('[drift] ' + key + ' is missing from one of the two');
    else if (Number(one) !== Number(two)) errors.push(`[drift] ${key} is ${one} here and ${two} on the platform`);
  }
}

/* ---- boot the page ---- */
function boot(seedDraft) {
  const bare = HTML.replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(bare, {
    url: 'http://127.0.0.1:4173/istimara/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.__calls = [];
  w.__frames = [];
  w.__p = 0;
  w.fetch = function (url, init) {
    w.__calls.push({ url: String(url), method: (init && init.method || 'GET').toUpperCase(), body: init && init.body });
    if (/subscription-plans/.test(String(url))) {
      return Promise.resolve({ ok: true, json: async () => ({
        plans: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
                { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' }],
        extras: { transport: 900, uniform: 2500 }
      }) });
    }
    return Promise.resolve({
      ok: true, json: async () => ({ ok: true, application_no: 'APP-20260101-AB12', expected_amount: 4400 })
    });
  };
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.alert = () => {};
  w.print = () => { w.__p += 1; };
  /* jsdom has no layout, so it does not implement scrollIntoView. Browsers all
     do; stubbing it keeps the test measuring the page rather than the runner. */
  w.Element.prototype.scrollIntoView = function () {};
  w.Element.prototype.focus = w.Element.prototype.focus || function () {};

  /* printRegistration writes into a same-origin iframe. jsdom gives a real one
     but no layout, so hand it a document stub instead of waiting on images. */
  const realAppend = w.document.body.appendChild.bind(w.document.body);
  w.document.body.appendChild = function (node) {
    if (node && node.tagName === 'IFRAME') {
      Object.defineProperty(node, 'contentWindow', {
        configurable: true,
        value: {
          print: () => { w.__p += 1; },
          focus() {},
          document: { images: [], open() {}, write() {}, close() {} }
        }
      });
      w.__frames.push(node);
    }
    return realAppend(node);
  };

  w.localStorage.clear();
  if (seedDraft) w.localStorage.setItem('sadara-istimara-draft', seedDraft);
  w.eval(PRINT);
  w.eval(PAGE);
  return w;
}

/* Waits for something to become true instead of guessing how long it takes. A
   fixed sleep passes on an idle machine and fails when the whole suite is
   running, which is how a working page came to be reported as broken. */
function waitFor(w, predicate, ms) {
  const limit = ms === undefined ? 4000 : ms;
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      let ok = false;
      try { ok = predicate(); } catch (e) { ok = false; }
      if (ok) return resolve(true);
      if (Date.now() - started > limit) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

const posted = w => w.__calls.some(c => c.method === 'POST');

function fill(w, category) {
  const set = (id, v) => { const n = w.document.getElementById(id); n.value = v; };
  set('first_name_ar', 'أمين');
  set('last_name_ar', 'بلعيد');
  set('birth_date', '1994-05-04');
  set('phone', '0661000001');
  set('address', 'حي الثنية');
  const radio = w.document.querySelector('input[name="category"][value="' + category + '"]');
  radio.checked = true;
  w.document.getElementById('terms').checked = true;
  return radio;
}

/* ---- 3) a value lands after its colon, on blank paper ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const rec = {
    category: 'minor', application_no: 'APP-20260101-AB12',
    first_name_ar: 'جلول', last_name_ar: 'قندوز', birth_date: '2012-04-17',
    address: 'حي الثنية', blood_group: 'O+', phone: '0661000001',
    guardian_first_name: 'لخضر', guardian_last_name: 'قندوز',
    guardian_birth_date: '1985-02-03', guardian_national_id: '1970011122334',
    doctor_name: 'د. بن عمر', expected_amount: 4400
  };
  const sheet = F.overlaySheet(rec);
  const spots = [...sheet.matchAll(/class="f-spot" style="bottom:([\d.]+)mm;right:([\d.]+)mm;width:([\d.]+)mm"/g)];
  if (spots.length !== F.FORM_SPOTS.length) {
    errors.push('[card] a minor must print every box, got ' + spots.length + ' of ' + F.FORM_SPOTS.length);
  }
  if (/undefined|NaN/.test(sheet)) errors.push('[card] an overlay box has no position');
  F.FORM_SPOTS.forEach((g, i) => {
    const m = spots[i];
    if (!m) { errors.push('[card] no box for ' + g.id); return; }
    const bottom = Number(m[1]), right = Number(m[2]), width = Number(m[3]);
    const edge = 210 - right;                 // the box's right edge, from the page's left
    const left = edge - width;
    if (bottom <= 0 || bottom >= 297) errors.push('[card] ' + g.id + ' sits outside the page');
    if (Math.abs((297 - bottom) - (g.y + F.SPOT_CLEAR)) > 0.02) errors.push('[card] ' + g.id + ' is not sitting on its rule');
    if (edge > g.colon) errors.push('[card] ' + g.id + ' runs over the printed colon');
    if (edge < g.colon - 1.7 || edge > g.colon - 1.5) errors.push('[card] ' + g.id + ' is not tight against the colon');
    if (left < g.x0 - 0.02) errors.push('[card] ' + g.id + ' starts before its printed line');
  });
  if (!sheet.includes('جلول')) errors.push('[card] the given name is missing');
  if (!sheet.includes('17/04/2012')) errors.push('[card] the birth date is not day-first');
  if (!sheet.includes('assets/form-registration-01.jpg')) errors.push('[card] the club scan is missing');
  if (!/class="f-photo"/.test(sheet)) errors.push('[card] the photo frame is missing');

  /* an adult has no guardian, and none of it may reach the paper */
  const adult = F.overlaySheet(Object.assign({}, rec, {
    category: 'adult', guardian_first_name: 'كريم', guardian_national_id: '1234567890'
  }));
  for (const leaked of ['كريم', '1234567890']) {
    if (adult.includes(leaked)) errors.push('[card] a guardian value reached an adult form: ' + leaked);
  }
  const guardians = F.FORM_SPOTS.filter(s => F.GUARDIAN_SPOT.test(s.id)).length;
  if ((adult.match(/class="f-spot"/g) || []).length !== F.FORM_SPOTS.length - guardians) {
    errors.push('[card] an adult printed the wrong number of boxes');
  }
}

/* ---- 4) the summary carries what the card cannot ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const rec = {
    category: 'minor', application_no: 'APP-20260101-AB12',
    first_name_ar: 'جلول', last_name_ar: 'قندوز', birth_date: '2012-04-17',
    gender: 'male', blood_group: 'O+', phone: '0661000001', whatsapp: '0661000002',
    address: 'حي الثنية', wilaya: 'غرداية', birth_place: 'غرداية', level: 'مبتدئ',
    swimming_strokes: 'حرة، ظهر', national_id: '20120417887',
    guardian_first_name: 'لخضر', guardian_last_name: 'قندوز', guardian_relation: 'أب',
    guardian_phone: '0661000003', guardian_national_id: '1970011122334', guardian_consent: true,
    doctor_name: 'د. بن عمر', doctor_specialty: 'طباعة رياضية', medical_date: '2025-09-01',
    facility: 'المسبح الأولمبي', subscription_code: 'season', plan_name: 'اشتراك موسمي',
    transport: true, uniform: true, transport_amount: 900, uniform_amount: 2500,
    payment_method: 'cash',
    notes: 'يفضّل التدريب صباحاً', expected_amount: 6400
  };
  const summary = F.summarySheet(rec);
  /* everything the applicant typed has to be readable on paper */
  for (const [key, what] of [
    ['APP-20260101-AB12', 'رقم الطلب'], ['جلول', 'الاسم'], ['قندوز', 'اللقب'],
    ['17/04/2012', 'تاريخ الميلاد'], ['حي الثنية', 'العنوان'], ['O+', 'فصيلة الدم'],
    ['0661000001', 'الهاتف'], ['0661000002', 'الواتساب'], ['ذكر', 'الجنس'],
    ['حرة، ظهر', 'نمط السباحة'], ['20120417887', 'رقم التعريف'],
    ['د. بن عمر', 'الطبيب'], ['طباعة رياضية', 'تخصص الطبيب'],
    ['لخضر', 'الولي'], ['أب', 'القرابة'], ['0661000003', 'هاتف الولي'],
    ['1970011122334', 'تعريف الولي'], ['المسبح الأولمبي', 'المنشأة'],
    ['اشتراك موسمي', 'الاشتراك'], ['نقدًا', 'طريقة الدفع'],
    ['يفضّل التدريب صباحاً', 'الملاحظة']
  ]) {
    if (!summary.includes(key)) errors.push('[summary] ' + what + ' is not on the summary (' + key + ')');
  }
  if (!isAmount(summary, '6400')) errors.push('[summary] the expected amount is not printed');
  /* An added option with no known price must not claim to be free. */
  if (!isAmount(summary, '900') || !isAmount(summary, '2500')) {
    errors.push('[summary] the extras are not priced on the summary');
  }
  /* Sections are numbered once each, in order, so the club can cite one. */
  const heads = [...summary.matchAll(/<h2>([^&]*)\s*&mdash;\s*([^<]+)<\/h2>/g)].map(m => m[1].trim());
  if (heads.join(',') !== '١,٢,٣,٤') {
    errors.push('[summary] the sections are numbered "' + heads.join(',') + '", expected ١,٢,٣,٤');
  }
  if (/undefined|NaN/.test(summary)) errors.push('[summary] a section number came out undefined');
  /* the club has to be able to write on it, and the applicant has to sign */
  for (const need of ['توقيع الرياضي', 'إدارة النادي', 'رقم التسجيل', 'الختم']) {
    if (!summary.includes(need)) errors.push('[summary] no room for "' + need + '"');
  }
  if (!/dir="ltr"/.test(summary)) errors.push('[summary] a mixed-direction field has no ltr mark');
  if (/<script/.test(summary)) errors.push('[summary] the printed sheet carries a script');

  /* An adult has no guardian block, so the sections must close up rather than
     leave a number missing in the middle. */
  const grown = F.summarySheet(Object.assign({}, rec, { category: 'adult' }));
  const grownHeads = [...grown.matchAll(/<h2>([^&]*)\s*&mdash;\s*([^<]+)<\/h2>/g)].map(m => m[1].trim());
  if (grownHeads.join(',') !== '١,٢,٣') {
    errors.push('[summary] an adult\'s sections are numbered "' + grownHeads.join(',') + '", expected ١,٢,٣');
  }
  if (/ولي الأمر/.test(grown)) errors.push('[summary] an adult was shown a guardian block');
}

/* ---- 5) the printed document: A4, and both sheets ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const doc = F.documentHTML({ application_no: 'APP-1', first_name_ar: 'أمين', last_name_ar: 'بلعيد' }, { hint: false });
  if ((doc.match(/class="f-page"/g) || []).length !== 1) errors.push('[print] the club card is not one page');
  if ((doc.match(/class="s-page"/g) || []).length !== 1) errors.push('[print] the summary is not one page');
  if (!doc.includes('<html lang="ar" dir="rtl">')) errors.push('[print] the printed document is not RTL');
  const css = F.printCSS();
  if (!/@page\{size:A4 portrait;margin:0\}/.test(css)) errors.push('[print] @page must be A4 with no margin');
  if (!/\.f-page\{[^}]*width:210mm;height:297mm/.test(css)) errors.push('[print] the card must be exactly A4');
  if (!/\.s-page\{[^}]*width:210mm/.test(css)) errors.push('[print] the summary must be A4 wide');
  if (!/object-fit:fill/.test(css)) errors.push('[print] the card scan must stretch to the page');
  if (!/Cairo/.test(css)) errors.push('[print] the Arabic webfont is not declared');
  if (!/background:transparent/.test(css)) errors.push('[print] an overlay box has a background');
  const spot = (css.split('.f-spot')[1] || '').split('}')[0];
  if (/border\s*:\s*(?!0|none)/.test(spot)) errors.push('[print] an overlay box draws a border over the club wording');
  if (!/page-break-after:always|break-after:page/.test(css)) errors.push('[print] the sheets can run together');
  /* The print must not depend on a popup: a phone can block window.open.
     Match the call, not the comment that explains why it is not used. */
  if (/\bwindow\.open\s*\(/.test(PRINT)) errors.push('[print] printing goes through a popup, which a phone can block');
  if (!/print-color-adjust:exact/.test(css)) errors.push('[print] the club colours will not survive the printer');
}

/* ---- 6) nothing in the page points at a control that is not there ---- */
{
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([
    ...[...PAGE.matchAll(/\b(?:el|val)\('([^']+)'\)/g)].map(m => m[1]),
    ...[...(PAGE.match(/GUARDIAN_FIELDS = \[([^\]]*)\]/) || [, ''])[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  ]);
  for (const id of used) {
    if (!ids.has(id)) errors.push('[wiring] the script looks for #' + id + ', which the page does not have');
  }
  /* Every control a visitor can fill must carry a name, or it will not come
     back in a draft and will not be sent. */
  for (const m of HTML.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
    const tag = m[0];
    if (/type="file"|type="submit"/.test(tag)) continue;
    if (!/\sname="[^"]+"/.test(tag)) {
      errors.push('[wiring] a control has no name, so it would be lost: ' + tag.slice(0, 60));
    }
  }
}

/* ---- 7) it needs no account, and lands where management looks ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'adult');
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  /* The POST is recorded the moment it is sent, but the confirmation is painted
     a few promises later, so wait for the confirmation and not for the request. */
  return waitFor(w, () => !w.document.getElementById('done').hidden
    || !!w.document.getElementById('form-msg').textContent)
    .catch(() => errors.push('[send] nothing came back after sending'))
    .then(() => {
    const post = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
    if (post.length !== 1) { errors.push('[send] expected one post to /api/applications, got ' + post.length); return; }
    const body = JSON.parse(post[0].body);
    /* These are the names the platform's own sign-up sends, because the
       management screen reads those and nothing else. */
    for (const key of ['first_name_ar', 'last_name_ar', 'birth_date', 'phone', 'address',
      'category', 'blood_group', 'national_id', 'whatsapp', 'birth_place', 'wilaya',
      'gender', 'level', 'swimming_strokes', 'subscription_code', 'facility',
      'transport', 'uniform', 'payment_method', 'guardian_first_name', 'guardian_last_name',
      'guardian_consent', 'status']) {
      if (!(key in body)) errors.push('[send] the payload is missing ' + key + ', which management reads');
    }
    if (body.status !== 'pending') errors.push('[send] a public sign-up must arrive pending');
    if ('reviewed_by' in body) errors.push('[send] the payload claims a review nobody did');
    if ('applicant_uid' in body) errors.push('[send] the payload ties itself to an account, so it is not public');
    if (body.sport !== 'السباحة') errors.push('[send] the sport is not the swimming branch');
    /* firestore.rules is what actually lets this through, anonymously. */
    if (!/match \/applications\/\{id\}/.test(RULES)) errors.push('[rules] no applications collection');
    if (!/request\.resource\.data\.status == 'pending'/.test(RULES)) {
      errors.push('[rules] an anonymous create is not restricted to pending, so this page could be abused');
    }
    if (!/!\(\s*'reviewed_by' in request\.resource\.data\s*\)/.test(RULES)) {
      errors.push('[rules] a visitor could post reviewed_by');
    }

    /* after sending: the number is shown, and the print opens */
    if (w.document.getElementById('done').hidden) errors.push('[done] the confirmation did not appear');
    if (w.document.getElementById('done-no').textContent !== 'APP-20260101-AB12') {
      errors.push('[done] the request number is not shown to the person');
    }
    w.document.getElementById('print-form').dispatchEvent(new w.Event('click', { bubbles: true }));
    if (!w.__frames.length) errors.push('[done] the print button opened nothing');
    /* the draft must not outlive a sent request, or the next person on the same
       phone would find the first one's data already filled in */
    if (w.localStorage.getItem('sadara-istimara-draft')) errors.push('[draft] the draft survived the send');
  });
});

/* ---- 8) an adult is never stopped by a field they cannot see ---- */
tasks.push(() => {
  const w = boot();
  const minor = w.document.querySelector('input[name="category"][value="minor"]');
  const adult = w.document.querySelector('input[name="category"][value="adult"]');

  minor.checked = true;
  minor.dispatchEvent(new w.Event('change', { bubbles: true }));
  if (w.document.getElementById('guardian-card').hidden) errors.push('[minor] a minor lost the guardian section');
  if (!w.document.getElementById('guardian_first_name').required) errors.push('[minor] the guardian name is not required');

  adult.checked = true;
  adult.dispatchEvent(new w.Event('change', { bubbles: true }));
  if (!w.document.getElementById('guardian-card').hidden) errors.push('[adults] the guardian section is still showing');
  if (w.document.getElementById('guardian_first_name').required) errors.push('[adults] an adult must fill a hidden field');
  /* hidden means hidden, not merely marked */
  if (!/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(CSS)) {
    errors.push('[adults] no [hidden] rule, so a hidden section could stay on screen');
  }

  /* an adult sends without touching a guardian field. Wait for the outcome, not
     for the request: the POST is recorded before the confirmation is painted. */
  fill(w, 'adult');
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => !w.document.getElementById('done').hidden
    || !!w.document.getElementById('form-msg').textContent)
    .catch(() => errors.push('[adults] nothing happened after sending'))
    .then(() => {
      if (!posted(w)) errors.push('[adults] an adult cannot send without guardian details');
      if (w.document.getElementById('done').hidden) {
        errors.push('[adults] no confirmation after sending: '
          + (w.document.getElementById('form-msg').textContent || '(no message)'));
      }
    });
});

/* ---- 9) a minor cannot slip through without the declaration ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'minor');
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => w.document.getElementById('form-msg').textContent)
    .catch(() => errors.push('[minor] no message explaining what is missing'))
    .then(() => {
      if (posted(w)) errors.push('[minor] sent without the guardian');
      if (!w.document.getElementById('guardian_first_name').classList.contains('bad')) {
        errors.push('[minor] the empty guardian field is not marked');
      }
      if (w.document.getElementById('form-msg').hidden) errors.push('[minor] no message explaining what is missing');
    });
});

/* ---- 10) the live total matches what the club will confirm ---- */
tasks.push(() => {
  const w = boot();
  const total = () => w.document.getElementById('total-amount').textContent;
  const fire = id => {
    const n = w.document.getElementById(id);
    n.checked = !n.checked;
    n.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  return waitFor(w, () => /\d/.test(total()))
    .catch(() => errors.push('[total] the prices never arrived: ' + total()))
    .then(() => {
    if (!isAmount(total(), '1000')) errors.push('[total] the quarterly subscription did not load: ' + total());
    const select = w.document.getElementById('subscription_code');
    select.value = 'season';
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    if (!isAmount(total(), '3000')) errors.push('[total] the seasonal subscription is wrong: ' + total());
    fire('transport'); fire('uniform');
    if (!isAmount(total(), '6400')) errors.push('[total] the extras were not added: ' + total());
    fire('transport'); fire('uniform');
    if (!isAmount(total(), '3000')) errors.push('[total] the extras did not come back off: ' + total());
  });
});

/* ---- 11) a half-finished form survives a closed tab ---- */
tasks.push(() => {
  const w = boot();
  w.document.getElementById('first_name_ar').value = 'منال';
  w.document.getElementById('first_name_ar').dispatchEvent(new w.Event('input', { bubbles: true }));
  const draft = w.localStorage.getItem('sadara-istimara-draft');
  if (!draft) { errors.push('[draft] typing did not save a draft'); return Promise.resolve(); }
  if (!JSON.parse(draft).first_name_ar) errors.push('[draft] the draft lost what was typed');

  const again = boot(draft);
  if (again.document.getElementById('first_name_ar').value !== 'منال') {
    errors.push('[draft] the draft did not come back');
  }
  return Promise.resolve();
});

/* ---- run the settling checks in order ---- */
tasks.reduce((chain, task) => chain.then(task), Promise.resolve()).then(() => {
  if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
  console.log('All public registration-page checks passed.');
});
