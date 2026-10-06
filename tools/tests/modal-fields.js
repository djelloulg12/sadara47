const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const OUT = path.join(ROOT, 'tools', 'tests', 'out');
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
w.eval(APP + '\n;window.__t={fullRegisterModal:fullRegisterModal};');

fs.mkdirSync(OUT, { recursive: true });
const modal = w.__t.fullRegisterModal();
fs.writeFileSync(path.join(OUT, 'register-modal.html'), modal, 'utf8');

const d = new JSDOM('<div id="host">' + modal + '</div>').window.document;
const rows = [];
d.querySelectorAll('label, .form-section-title').forEach(n => {
  const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
  const input = n.querySelector('input,select,textarea');
  rows.push({
    tag: n.tagName.toLowerCase(),
    cls: n.className || '',
    id: input ? input.id : '',
    type: input ? (input.type || input.tagName.toLowerCase()) : '',
    text: txt
  });
});

console.log('--- registration modal, document order ---');
rows.forEach((r, i) => {
  console.log(String(i).padStart(2, ' ') + '  ' + r.tag.padEnd(20) +
    (r.id || '').padEnd(22) + (r.type || '').padEnd(10) + r.text.slice(0, 60));
});
console.log('\ntotal labels/sections: ' + rows.length);
