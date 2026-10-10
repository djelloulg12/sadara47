const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const ROOT = path.resolve(PUBLIC, '..');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const errors = [];
const watchdog = setTimeout(() => { errors.push('the registration flow never completed'); finish(); }, 4000);
const notes = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.print = () => { w.__prints = (w.__prints || 0) + 1; };
  w.open = () => {
    const doc = { html: '', open() { return this; }, write(h) { this.html += h; }, close() {} };
    w.__popups = w.__popups || []; w.__popups.push(doc);
    return { document: doc, focus() {}, print() {}, close() {} };
  };
  w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {};
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  w.FileReader = class {
    readAsDataURL() { this.result = 'data:image/png;base64,iVBORw0KGgo='; if (this.onload) this.onload(); }
  };
  try {
    w.eval(APP + '\n;window.__t={get state(){return state},set state(v){state=v},render:render,action:action,' +
      'moneyWords:moneyWords,packetLines:packetLines,receiptTotal:receiptTotal,receiptSheet:receiptSheet,' +
      'regulationsSheet:regulationsSheet,packetDocument:packetDocument,printPacket:printPacket,' +
      'registrationDoneModal:registrationDoneModal,uploadSignedForm:uploadSignedForm,' +
      'packetCSS:packetCSS,overlaySheet:overlaySheet,pageView:pageView,recalcAmount:recalcAmount};');
  } catch (e) { errors.push('load: ' + e.message); return null; }
  w.__t.state.user = seed.user;
  return w;
}

const PLANS = [
  { code: 'season', name: 'اشتراك حر', amount: 3000, duration: 'موسم', active: true },
  { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر', active: true }
];
const APP_REC = {
  id: 41, application_no: 'APP-20261005-AB12', first_name_ar: 'أمين', last_name_ar: 'بلعيد',
  category: 'minor', phone: '0661000001', address: 'غرداية', wilaya: 'غرداية',
  birth_date: '2013-05-04', blood_group: 'O+', gender: 'ذكر',
  guardian_first_name: 'كريم', guardian_national_id: '1234567890',
  subscription_code: 'quarter', transport: 1, uniform: 1, payment_method: 'cash',
  expected_amount: 4400, facility: 'المسبح الأولمبي', status: 'pending'
};
const seed = (user, extra) => Object.assign({
  user, page: 'applications', swimmers: [{ id: 'SDR-1', name: 'x', group: 'g', phone: '1', status: 'نشط' }],
  applications: [APP_REC], schedules: [], subscriptions: PLANS, notices: [],
  attendance: {}, attendanceByDay: {}, groups: [], extras: { transport: 900, uniform: 2500 }
}, extra || {});

/* ---- 1. the total in words must read correctly ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }));
  const cases = [
    [0, 'صفر'], [1, 'واحد'], [20, 'عشرون'], [21, 'واحد وعشرون'], [100, 'مئة'],
    [1000, 'ألف'], [4400, 'أربعة آلاف وأربعمئة'], [12345, 'اثنا عشر ألف وثلاثمئة وخمسة وأربعون']
  ];
  for (const [n, want] of cases) {
    const got = w.__t.moneyWords(n);
    if (got !== want) errors.push(`moneyWords(${n}) = "${got}", expected "${want}"`);
  }
  if (/\d/.test(w.__t.moneyWords(5000))) errors.push('moneyWords(5000) still contains digits');
}

/* ---- 2. the packet holds the three required pages ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }));
  const doc = w.__t.packetDocument(APP_REC);
  const pages = (doc.match(/class="f-page"/g) || []).length + (doc.match(/class="pk-page/g) || []).length;
  if (pages !== 3) errors.push('the packet must have 3 pages, found ' + pages);
  if (!/form-registration-01\.jpg/.test(doc)) errors.push('the official form image is missing from the packet');
  if (!/internal-regulations\.jpg/.test(doc)) errors.push('the internal regulations are missing from the packet');
  if (!/receiptNo|وصل/.test(doc)) errors.push('the payment receipt is missing from the packet');
  if (!/@page\{size:A4 portrait;margin:0\}/.test(doc)) errors.push('the packet must print with zero page margin');
  if (doc.includes('undefined') || doc.includes('NaN')) errors.push('the packet contains undefined/NaN');
  if (!/APP-20261005-AB12/.test(doc)) errors.push('the application number is missing from the packet');

  // each page can also be printed on its own
  const count = html => ({
    form: (html.match(/class="f-page"/g) || []).length,
    pk: (html.match(/class="pk-page/g) || []).length,
    receipt: /class="pk-page pk-receipt"/.test(html),
    regs: /class="pk-page pk-regs"/.test(html)
  });
  const onlyReceipt = count(w.__t.packetDocument(APP_REC, 'receipt'));
  if (onlyReceipt.form !== 0) errors.push('receipt-only still prints the form');
  if (!onlyReceipt.receipt) errors.push('receipt-only does not print the receipt');
  if (onlyReceipt.pk !== 1) errors.push('receipt-only must print exactly one page, got ' + onlyReceipt.pk);
  if (onlyReceipt.regs) errors.push('receipt-only must not print the regulations');
  const onlyRegs = count(w.__t.packetDocument(APP_REC, 'regs'));
  if (onlyRegs.form !== 0 || onlyRegs.receipt) errors.push('regs-only must print only the regulations');
  if (!onlyRegs.regs) errors.push('regs-only does not print the internal regulations');
  if (onlyRegs.pk !== 1) errors.push('regs-only must print exactly one page, got ' + onlyRegs.pk);
  const onlyForm = count(w.__t.packetDocument(APP_REC, 'form'));
  if (onlyForm.form !== 1 || onlyForm.pk !== 0) errors.push('form-only is wrong');
}

/* ---- 3. the receipt carries the amounts, the words and the signature blocks ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }));
  const total = w.__t.receiptTotal(APP_REC);
  if (total !== 4400) errors.push('receipt total should be 1000+900+2500 = 4400, got ' + total);
  const r = w.__t.receiptSheet(APP_REC);
  for (const label of ['اشتراك', 'النقل', 'البدلة الرياضية']) {
    if (!r.includes(label)) errors.push('the receipt is missing a line: ' + label);
  }
  if (!/أربعة آلاف وأربعمئة/.test(r)) errors.push('the receipt does not state the total in words');
  if (!/المحاسب/.test(r) || !/المسيّر/.test(r)) errors.push('the receipt has no cashier/manager signature blocks');
  if (!/ختم النادي/.test(r)) errors.push('the receipt has no club stamp area');
  if (!/نقدًا/.test(r)) errors.push('the receipt does not record the cash payment');
  if (!/أمين بلعيد/.test(r)) errors.push('the receipt does not name the payer');
}

/* ---- 4. printing from the page opens one document with all three pages ---- */
{
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }));
  w.__t.printPacket(APP_REC);
  const pops = w.__popups || [];
  if (!pops.length) { errors.push('printPacket did not open a print window'); }
  else {
    const html = pops[pops.length - 1].html;
    if ((html.match(/class="pk-page/g) || []).length !== 2) errors.push('the printed packet is missing a page');
    if (!/f-page/.test(html)) errors.push('the printed packet is missing the official form');
  }
}

/* ---- 5. the registrar's flow: submit then print immediately ---- */
{
  const w = boot(seed(null, { page: 'home' }));
  w.fetch = (url, opts) => {
    if (String(url) === '/api/applications') {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, application_no: 'APP-NEW-01', expected_amount: 4400 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  };
  w.__t.action('register-desk', null);
  const set = (id, v) => { const n = w.document.querySelector(id); if (n) n.value = v; return n; };
  set('#reg-first-ar', 'أمين'); set('#reg-last-ar', 'بلعيد'); set('#reg-birth', '2013-05-04');
  set('#reg-phone', '0661000001'); set('#reg-address', 'غرداية'); set('#reg-plan', 'quarter');
  const t = w.document.querySelector('#reg-transport'); if (t) t.checked = true;
  const u = w.document.querySelector('#reg-uniform'); if (u) u.checked = true;

  w.__t.action('send-full-request', w.document.querySelector('[data-action="send-full-request"]'));

  setTimeout(() => {
    const done = w.document.querySelector('.done-modal');
    if (!done) { errors.push('no confirmation screen after submitting the registration'); return finish(); }
    if (!/APP-NEW-01/.test(done.textContent)) errors.push('the confirmation does not show the application number');
    const pops = w.__popups || [];
    if (!pops.length) errors.push('the form did not open for printing right after submission');
    else {
      const html = pops[pops.length - 1].html;
      if (!/form-registration-01\.jpg/.test(html)) errors.push('the auto-printed packet has no official form');
      if (!/pk-receipt/.test(html)) errors.push('the auto-printed packet has no receipt');
      if (!/pk-regs/.test(html)) errors.push('the auto-printed packet has no internal regulations');
      if (!/أمين/.test(html) || !/بلعيد/.test(html)) errors.push('the auto-printed form is not filled with the typed data');
    }
    // the confirmation must tell the visitor to come back with the signed copy
    if (!/رفع|مصادقة|تسجيل الدخول/.test(done.textContent)) {
      errors.push('the confirmation does not explain how to upload the signed copy');
    }
    const buttons = [...done.querySelectorAll('[data-action]')].map(b => b.dataset.action);
    for (const need of ['print-packet', 'print-receipt-only', 'print-regs-only', 'close']) {
      if (!buttons.includes(need)) errors.push('the confirmation is missing the ' + need + ' action');
    }
    finish();
  }, 400);
}

function finish() {
  clearTimeout(watchdog);
  /* ---- 6. after signing in, the signed copy can be attached ---- */
  const w = boot(seed({ id: 1, name: 'x', role: 'admin' }));
  w.__t.render();
  const row = w.document.querySelector('[data-action="attach-scan"]');
  if (!row) { errors.push('no way to attach the signed copy to a request'); }
  else {
    row.click();
    const modal = w.document.querySelector('.attach-modal');
    if (!modal) errors.push('the attach dialog did not open');
    else {
      if (!modal.querySelector('#scan-file')) errors.push('the attach dialog has no file picker');
      if (!/receipt|وصل/.test(w.document.querySelector('[data-action="open-receipt"]') ? 'receipt' : '')) {
        errors.push('no receipt button on the request row');
      }
    }
  }
  const receiptBtn = w.document.querySelector('[data-action="open-receipt"]');
  if (receiptBtn) {
    receiptBtn.click();
    const m = w.document.querySelector('.receipt-modal');
    if (!m) errors.push('the receipt dialog did not open');
    else {
      if (!m.querySelector('#paid-check')) errors.push('the receipt dialog cannot record the cash settlement');
      if (!m.querySelector('#paid-by')) errors.push('the receipt dialog has no cashier name field');
      if (!/أربعة آلاف/.test(m.textContent)) errors.push('the receipt dialog does not show the total in words');
    }
  }
  const ids = [...w.document.querySelectorAll('[data-action="attach-scan"]')].map(b => b.dataset.id);
  const openIds = [...w.document.querySelectorAll('[data-action="open-receipt"]')].map(b => b.dataset.id);
  if (ids.length !== openIds.length || ids.some((v, i) => v !== openIds[i])) {
    errors.push('the packet buttons do not carry the request id');
  }

  /* ---- 7. the signed copy is validated before upload ---- */
  const tooBig = { type: 'application/pdf', size: 11 * 1024 * 1024 };
  const badType = { type: 'text/plain', size: 10 };
  const cases = [
    [null, 'a missing file must be rejected'],
    [badType, 'a non document must be rejected'],
    [tooBig, 'a file over 10 MB must be rejected']
  ];
  return Promise.all(cases.map(([file, label]) =>
    w.__t.uploadSignedForm(file, 'APP-1').then(
      () => { errors.push(label + ' (it was accepted)'); },
      () => { notes.push(label + ': rejected as expected'); }
    )
  )).then(() => {

  if (errors.length) {
    console.log('PACKET PROBLEMS (' + errors.length + '):\n  - ' + [...new Set(errors)].join('\n  - '));
    process.exit(1);
  }
  console.log('Packet checks passed: instant print after filling, receipt with words and signatures, internal regulations, signed-copy upload, cash settlement.');
  });
}