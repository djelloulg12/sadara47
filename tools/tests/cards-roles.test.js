/* ============================================================================
   هوية البطاقة بحسب الصفة
   ============================================================================

   ما يقيسه هذا الملف، وكلّه يُكسر بصمت:

   ١. البطاقة تحمل صفة صاحبها: السباح أزرق و«سباح»، والمدرب أحمر و«مدرب»،
      وكل صفة إدارية (المدير العام، المدير، المسير) سوداء و«مسؤول».
   ٢. مربع الصفة كُبّر: خط أعرض وأكبر، وحشوة أوسع، ونص أبيض على لون الصفة.
   ٣. تخطيط البطاقة ورمز المسح لم يُمسّا: صندوق QR كما هو، والمقاس CR80
      (85.6 × 54 مم) في الطباعة، والخلفيات تُطبع بألوانها.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const DOC = new JSDOM('<!doctype html><html><body></body></html>').window.document;
const errors = [];

function boot(seed) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://sadara-platform.web.app/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('sadara-state', JSON.stringify(seed));
  w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.fetch = async url => {
    const u = String(url);
    if (u.indexOf('/api/session') !== -1) {
      return { ok: true, json: async () => ({ user: seed.user }) };
    }
    if (u.indexOf('/api/accounts') !== -1) {
      return { ok: true, json: async () => (seed.accounts || []) };
    }
    if (u.indexOf('/api/groups') !== -1) {
      return { ok: true, json: async () => ({ groups: [], readable: true }) };
    }
    if (u.indexOf('/api/profile') !== -1) {
      return { ok: true, json: async () => ({ profile: null }) };
    }
    /* Lists are lists, never an object: syncApi maps them. */
    return { ok: true, json: async () => [] };
  };
  w.eval(APP + '\n;window.__t={get state(){return state},set state(v){state=v},'
    + 'luxuryCard:luxuryCard,roleCards:roleCards,pageCards:pageCards};');
  w.__t.state.user = seed.user;
  return w;
}

function parse(html) {
  const box = DOC.createElement('div');
  box.innerHTML = html;
  return box;
}

/* ---------------------------------------------------------------------------
   ١. الصفة على البطاقة نفسها، لكل صفة معروفة.
   ------------------------------------------------------------------------- */
const w = boot({ user: null, groups: [], swimmers: [], applications: [] });

const expected = [
  ['swimmer', 'is-swimmer', 'سباح'],
  ['coach', 'is-coach', 'مدرب'],
  ['admin', 'is-admin', 'مسؤول'],
  ['manager', 'is-admin', 'مسؤول'],
  ['owner', 'is-admin', 'مسؤول'],
  ['president', 'is-admin', 'مسؤول'],
  ['member', 'is-swimmer', 'سباح'],
  ['swimmer_minor', 'is-swimmer', 'سباح']
];
for (const [kind, cls, label] of expected) {
  const html = w.__t.luxuryCard({ name: 'أمين بلعيد', membership_no: 'SDR-1042', group_name: 'المبتدئون' }, kind);
  const card = parse(html).querySelector('.lux-card');
  if (!card) { errors.push('card: ' + kind + ' produced no card'); continue; }
  if (!card.classList.contains(cls)) errors.push('card: ' + kind + ' should wear ' + cls + ', not ' + card.className);
  const badge = card.querySelector('.lux-role');
  if (!badge) { errors.push('card: ' + kind + ' has no role badge'); continue; }
  if (badge.textContent.trim() !== label) errors.push('card: ' + kind + ' badge says «' + badge.textContent.trim() + '» not «' + label + '»');
  if (!card.querySelector('.lux-top .lux-role')) errors.push('card: ' + kind + ' badge left the card header');
  /* The code is the card's reason to exist; theming must not touch it. */
  if (!card.querySelector('[data-qr]') || !card.querySelector('.lux-qr-box')) {
    errors.push('card: ' + kind + ' lost the QR box');
  }
  if (!/امسح لتسجيل الحضور/.test(html)) errors.push('card: ' + kind + ' lost the scan line');
}

/* No card may wear two ranks at once. */
for (const kind of ['coach', 'admin']) {
  const card = parse(w.__t.luxuryCard({ name: 'س', membership_no: 'X-1' }, kind)).querySelector('.lux-card');
  const ranks = ['is-swimmer', 'is-coach', 'is-admin'].filter(c => card.classList.contains(c));
  if (ranks.length !== 1) errors.push('card: ' + kind + ' wears ' + ranks.join(' + '));
}

/* ---------------------------------------------------------------------------
   ٢. صفحة البطاقة في لوحة الصفة: المدير والمسير يريان بطاقة «مسؤول»،
      والمدرب يرى بطاقة «مدرب»، ولا يُطلب منهما رقم عضوية سباح.
   ------------------------------------------------------------------------- */
const manager = { id: 'm1', name: 'المسير الأول', email: 'm.djelloulg12@gmail.com', role: 'manager', owner: false };
const wm = boot({ user: manager, groups: [], swimmers: [], applications: [], accounts: [] });
wm.__t.state.user = manager;
const managerCards = parse(wm.__t.roleCards());
if (!managerCards.querySelector('.lux-card.is-admin')) errors.push('role page: the manager has no black card');
if (managerCards.querySelector('.lux-card.is-swimmer')) errors.push('role page: the manager still wears the swimmer card');
if (managerCards.querySelector('.lux-role') && managerCards.querySelector('.lux-role').textContent.trim() !== 'مسؤول') {
  errors.push('role page: the manager badge is not «مسؤول»');
}
if (/حسابك غير مربوط/.test(managerCards.innerHTML)) errors.push('role page: the manager is asked for a swimmer membership');

const coach = { id: 'c1', name: 'سليم مدرب', email: 'coach@x.dz', role: 'coach' };
const wc = boot({
  user: coach, groups: [], swimmers: [],
  applications: [{ id: 'a1', application_type: 'coach', coach_name: 'سليم مدرب', coach_email: 'coach@x.dz', coach_specialty: 'سباحة' }]
});
wc.__t.state.user = coach;
const coachCards = parse(wc.__t.roleCards());
if (!coachCards.querySelector('.lux-card.is-coach')) errors.push('role page: the coach has no red card');
if (!coachCards.querySelector('.lux-role') || coachCards.querySelector('.lux-role').textContent.trim() !== 'مدرب') {
  errors.push('role page: the coach badge is not «مدرب»');
}

/* ---------------------------------------------------------------------------
   ٣. صفحة بطاقات الإدارة: صاحب النادي والمسيران، ثلاث بطاقات سوداء،
      ولا بطاقة سوداء لمدرب أو عضو.
   ------------------------------------------------------------------------- */
const owner = { id: 'o1', name: 'صاحب النادي', email: 'kabrag12@gmail.com', role: 'admin', owner: true };
const ACCOUNTS = [
  { id: 'o1', name: 'صاحب النادي', email: 'kabrag12@gmail.com', role: 'admin', owner: true },
  { id: 'm1', name: 'المسير الأول', email: 'm.djelloulg12@gmail.com', role: 'manager' },
  { id: 'm2', name: 'المسير الثاني', email: 'med.elfahem85@gmail.com', role: 'manager' },
  { id: 'c1', name: 'مدرب', email: 'coach@x.dz', role: 'coach' },
  { id: 's1', name: 'سباح', email: 'swim@x.dz', role: 'member' }
];
const wa = boot({ user: owner, groups: [], swimmers: [], applications: [], accounts: ACCOUNTS });
wa.__t.state.user = owner;
wa.__t.state.accounts = ACCOUNTS;
const page = parse(wa.__t.pageCards());
const adminCards = page.querySelectorAll('.lux-card.is-admin');
if (adminCards.length !== 3) errors.push('cards page: expected 3 administrative cards, found ' + adminCards.length);
if (page.querySelectorAll('.lux-card.is-admin .lux-role').length !== 3) errors.push('cards page: an administrative card has no badge');
for (const badge of page.querySelectorAll('.lux-card.is-admin .lux-role')) {
  if (badge.textContent.trim() !== 'مسؤول') errors.push('cards page: administrative badge says «' + badge.textContent.trim() + '»');
}
if (page.querySelector('.lux-card.is-admin .lux-role') && !/المدير العام/.test(page.innerHTML)) {
  errors.push('cards page: the owner card does not name the المدير العام');
}

/* ---------------------------------------------------------------------------
   ٤. الهوية البصرية في الورقة: أحمر للمدرب، أسود للمسؤول، وشارة أكبر.
   ------------------------------------------------------------------------- */
function rule(re, name) {
  const all = [...CSS.matchAll(new RegExp(re.source, re.flags + 'g'))];
  if (!all.length) { errors.push('css: ' + name + ' is missing'); return ''; }
  /* The last rule wins the cascade; asserting an earlier one would let a later
     override take the colour away without this test noticing. */
  return all[all.length - 1][0];
}

const badgeRules = [...CSS.matchAll(/\.lux-card \.lux-role\{[^}]*\}/g)]
  .map(m => m[0]).filter(r => /font-size:/.test(r));
const badge = badgeRules.length ? badgeRules[badgeRules.length - 1] : '';
if (badge) {
  const size = parseFloat((badge.match(/font-size:([\d.]+)pt/) || [])[1] || '0');
  const pad = parseFloat((badge.match(/padding:[\d.]+mm ([\d.]+)mm/) || [])[1] || '0');
  if (!(size >= 8)) errors.push('css: the role badge is ' + size + 'pt, not 8pt or more');
  if (!(pad >= 3)) errors.push('css: the role badge padding is ' + pad + 'mm, not 3mm or more');
  if (!/font-weight:900/.test(badge)) errors.push('css: the role badge is not bold');
  if (!/color:#fff/.test(badge)) errors.push('css: the role badge text is not white');
  if (!/border-radius/.test(badge)) errors.push('css: the role badge has no rounded corners');
}

const coachSkin = rule(/\.lux-card\.is-coach\{[^}]*\}/, 'the coach card theme');
if (coachSkin && !/#c62828|#b71c1c|#e53935/.test(coachSkin)) errors.push('css: the coach card is not red');
const coachBadge = rule(/\.lux-card\.is-coach \.lux-role\{[^}]*\}/, 'the coach badge');
if (coachBadge && !/#e53935|#b71c1c/.test(coachBadge)) errors.push('css: the coach badge is not red');
const coachSide = rule(/\.lux-card\.is-coach \.lux-side\{[^}]*\}/, 'the coach header');
if (coachSide && !/#e53935|#8e1b1b/.test(coachSide)) errors.push('css: the coach header is not red');

const adminSkin = rule(/\.lux-card\.is-admin\{[^}]*\}/, 'the administrative card theme');
if (adminSkin && !/#1f2937|#111827|#0b1220/.test(adminSkin)) errors.push('css: the administrative card is not black');
const adminBadge = rule(/\.lux-card\.is-admin \.lux-role\{[^}]*\}/, 'the administrative badge');
if (adminBadge && !/#374151|#0b1220/.test(adminBadge)) errors.push('css: the administrative badge is not black');
const adminSide = rule(/\.lux-card\.is-admin \.lux-side\{[^}]*\}/, 'the administrative header');
if (adminSide && !/#1f2937|#05080d/.test(adminSide)) errors.push('css: the administrative header is not black');

/* The CR80 size and the printed colours must survive the new skins. */
if (!/\.lux-card\{\s*width:85\.6mm!important;height:54mm!important/.test(CSS)) {
  errors.push('css: the card is no longer CR80 (85.6 × 54 mm)');
}
if (!/\.lux-card \.lux-role\{-webkit-print-color-adjust:exact;print-color-adjust:exact\}/.test(CSS)) {
  errors.push('css: the role colours are not marked for printing');
}
if (!/\.lux-card\.is-coach\{border-color:#b71c1c!important/.test(CSS)) {
  errors.push('css: the printed coach border lost its red');
}
if (!/\.lux-card\.is-admin\{border-color:#111827!important/.test(CSS)) {
  errors.push('css: the printed administrative border lost its black');
}

if (errors.length) {
  console.log('CARD ROLE PROBLEMS (' + errors.length + '):');
  for (const e of [...new Set(errors)]) console.log('  - ' + e);
  process.exit(1);
}
console.log('Every card wears its holder’s rank, the badge is large, and the scan code is untouched.');
process.exit(0);
