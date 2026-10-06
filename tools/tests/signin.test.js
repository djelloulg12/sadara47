/* A member standing at the club desk has to be told something they can act on.
   This checks that every way sign-in can fail ends in Arabic words, and never
   in a raw library string such as "Firebase: Error (auth/...)". */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const errors = [];

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
w.eval(APP + '\n;window.__t={loginFailure:loginFailure,LOGIN_MESSAGES:LOGIN_MESSAGES,action:action};');

const f = w.__t.loginFailure;

// every code that can realistically come back from the identity service
const codes = [
  'auth/configuration-not-found', 'auth/operation-not-allowed', 'auth/invalid-credential',
  'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email',
  'auth/user-disabled', 'auth/too-many-requests', 'auth/network-request-failed',
  'auth/unknown-code-we-never-saw'
];
for (const code of codes) {
  const out = f({ code, error: 'Firebase: Error (' + code + ').' });
  if (!out || !out.trim()) errors.push('[' + code + '] no message at all');
  if (/^Firebase:/i.test(out) || /\bauth\//.test(out)) errors.push('[' + code + '] shows a raw error: ' + out);
  if (!/[؀-ۿ]/.test(out)) errors.push('[' + code + '] is not in Arabic: ' + out);
}

// a raw library string with no code must still be replaced
for (const raw of ['Firebase: Error (auth/internal-error).', 'API key not valid', '', undefined]) {
  const out = f({ error: raw });
  if (/^Firebase:/i.test(out) || /API key/.test(out)) errors.push('leaked a raw string: ' + out);
  if (!/[؀-ۿ]/.test(out)) errors.push('not Arabic for raw input ' + JSON.stringify(raw) + ': ' + out);
}

// a message the server chose deliberately is passed through untouched
const own = f({ code: '', error: 'هذا الحساب موقوف حتى شهر سبتمبر.' });
if (own !== 'هذا الحساب موقوف حتى شهر سبتمبر.') errors.push('a deliberate Arabic message was replaced');

// the platform's own "not ready" state has its own wording, distinct from a typo
const notReady = f({ code: 'auth/configuration-not-found' });
const wrongPass = f({ code: 'auth/wrong-password' });
if (notReady === wrongPass) errors.push('a missing platform and a wrong password read the same');

/* the handler must not leave the dialog silent if the request itself fails */
const handler = APP.slice(APP.indexOf("if(a==='do-login')"));
const window_ = handler.slice(0, handler.indexOf("if(a==='forgot-password')"));
if (!/try\{/.test(window_)) errors.push('the sign-in request is not guarded');
if (!/res\.json\(\)\.catch/.test(window_)) errors.push('a non-JSON reply would throw');
if (!/catch\(_\)\{/.test(window_)) errors.push('a network failure would leave no message');

if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
console.log('Sign-in always answers in Arabic. ' + (codes.length + 6) + ' failure paths checked.');
