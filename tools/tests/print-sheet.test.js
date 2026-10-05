const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

const seed = {
  user: { id: 1, name: 'رئيس النادي', role: 'president' }, page: 'groups', dark: false,
  swimmers: [
    { id: 'SDR-A1', name: 'أمين بلعيد', group: 'المبتدئون', phone: '0661000001', status: 'نشط' },
    { id: 'SDR-A2', name: 'ياسين مرابط', group: 'المبتدئون', phone: '0661000002', status: 'نشط' }
  ],
  applications: [], subscriptions: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' }],
  schedules: [{ id: 1, day_name: 'السبت', time_range: '16:00 - 17:30', group_name: 'المبتدئون', coach: 'سليم', pool: 'مسبح الصدارة' }],
  attendance: { 'SDR-A1': [{ status: 'present', at: '2026-10-03T09:10:00Z', date: '2026-10-03' }] },
  attendanceByDay: { '2026-10-03': { 'SDR-A1': 'present' } },
  coachRequirements: [], extras: { transport: 900, uniform: 2500 },
  groups: [{ id: 'g1', name: 'المبتدئون', coach: 'المدرب سليم', schedule: 'السبت · 16:00' }],
  notices: []
};

const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'https://x.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem('sadara-state', JSON.stringify(seed));
w.print = () => { w.__prints = (w.__prints || 0) + 1; };
w.open = () => ({ write() {}, document: { write() {}, close() {} } });
w.confirm = () => true; w.prompt = () => 'x'; w.alert = () => {}; w.scrollTo = () => {};
w.eval(APP + '\n;window.__t={get state(){return state},render:render,action:action};');
w.__t.state.user = seed.user;

const out = [];
function sheet(label, fn) {
  w.__t.render();
  try { fn(); } catch (e) { out.push('## ' + label + '\nERROR: ' + e.message); return; }
  const host = w.document.querySelector('.print-host');
  if (!host) { out.push('## ' + label + '\nNO PRINT SHEET'); return; }
  out.push('## ' + label + '\nprints=' + w.__prints + '  body-children=' + host.querySelector('.print-body').children.length + '\n' + host.innerHTML.replace(/></g, '>\n<'));
  w.document.body.classList.remove('printing');
  host.remove();
}

sheet('Group roster', () => w.__t.action('print-group', { dataset: { group: 'g1' } }));
sheet('Attendance sheet', () => w.__t.action('print-attendance', { dataset: {} }));
w.__t.state.page = 'card'; sheet('Membership cards', () => w.__t.action('print-cards', { dataset: {} }));
w.__t.state.page = 'settings'; sheet('Settings page', () => w.__t.action('print-settings', { dataset: {} }));

fs.writeFileSync(String.raw`path.resolve(__dirname, '..', '..')\print-sheets.txt`, out.join('\n\n'), 'utf8');
console.log('wrote print-sheets.txt');
console.log('total window.print() calls:', w.__prints);