const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const ADAPTER = fs.readFileSync(path.join(PUBLIC, 'firebase-adapter.js'), 'utf8');

const errors = [];
const calls = [];
const DATA = {
  users: { u1: { name: 'رئيس النادي', role: 'president' }, u2: { name: 'مدرب', role: 'coach' }, u3: { name: 'عضو', role: 'member' } },
  subscription_plans: { quarter: { code: 'quarter', name: 'فصلي', amount: 1000, duration: '3 أشهر', active: true } },
  fee_settings: { extras: { transport: 1000, uniform: 3000 } },
  swimmers: { 'SDR-A1': { membership_no: 'SDR-A1', name: 'أمين', group_name: 'المبتدئون', phone: '0661', status: 'active' } },
  notices: { n1: { title: 'إعلان', body: 'نص', kind: 'تذكير' } },
  schedules: { s1: { day_name: 'السبت', time_range: '16:00', group_name: 'المبتدئون', coach: 'سليم' } },
  attendance: {}, cards: {}, applications: {}, coach_requirements: {}
};

function makeFirestore() {
  const db = {
    collection(name) {
      const api = {
        doc(id) {
          return {
            id,
            set: async (value, opts) => { calls.push(['set', name, id, value]); DATA[name][id] = Object.assign({}, DATA[name][id], value); },
            get: async () => ({ exists: !!DATA[name][id], data: () => DATA[name][id], id }),
            delete: async () => { calls.push(['delete', name, id]); delete DATA[name][id]; }
          };
        },
        add: async (value) => {
          const id = name + '_' + Object.keys(DATA[name]).length;
          calls.push(['add', name, id, value]);
          DATA[name][id] = value;
          return { id };
        },
        get: async () => ({ docs: Object.keys(DATA[name]).slice(0, 1000).map(id => ({ id, data: () => DATA[name][id] })) })
      };
      api.limit = () => api;
      api.orderBy = () => api;
      return api;
    },
    batch() {
      const ops = [];
      return {
        delete: ref => ops.push(['delete', ref.id]),
        set: (ref, v) => ops.push(['set', ref.id, v]),
        commit: async () => { ops.forEach(o => calls.push(o)); }
      };
    }
  };
  return db;
}

function boot(authUser) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://sadara-platform.web.app/', runScripts: 'outside-only' });
  const w = dom.window;
  let authState = authUser;
  w.SADARA_FIREBASE_CONFIG = { projectId: 'p' };
  w.firebase = {
    initializeApp() {},
    auth: () => ({
      onAuthStateChanged: (cb) => { cb(authState); return () => {}; },
      currentUser: authUser,
      signInWithEmailAndPassword: async () => ({ user: authUser }),
      signOut: async () => { authState = null; }
    }),
    firestore: Object.assign(() => makeFirestore(), { FieldValue: { serverTimestamp: () => 'TS' } }),
    storage: () => ({ ref: (p) => ({ put: async () => ({}), getDownloadURL: async () => 'https://x/' + p, fullPath: p }) })
  };
  w.fetch = () => Promise.reject(new Error('network blocked in test'));
  w.eval(ADAPTER);
  return w;
}

async function call(w, url, method = 'GET', body) {
  const res = await w.fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, ok: res.ok, data: await res.json() };
}

const asUser = (uid) => ({ uid, email: uid + '@x.dz' });
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('public endpoints work signed out', async () => {
  const w = boot(null);
  const subs = await call(w, '/api/subscriptions');
  if (!subs.ok || !subs.data.length) errors.push('subscriptions signed out failed');
  const fees = await call(w, '/api/subscription-plans');
  if (fees.data.extras.transport !== 1000) errors.push('extras not read from fee_settings');
  const reqs = await call(w, '/api/coach-requirements');
  if (!reqs.ok || !reqs.data.length) errors.push('coach-requirements defaults missing');
});

test('login and session map the Firestore profile', async () => {
  const w = boot(asUser('u1'));
  const r = await call(w, '/api/login', 'POST', { email: 'president@x.dz', password: 'x' });
  if (r.data.user.role !== 'president') errors.push('login role not mapped');
  if (r.data.user.name !== 'رئيس النادي') errors.push('login name not mapped');
  const s = await call(w, '/api/session');
  if (s.data.user.id !== 'u1') errors.push('session id wrong');
});

test('member cannot read applications, president can', async () => {
  const m = await call(boot(asUser('u3')), '/api/applications');
  if (m.status !== 403) errors.push('member should get 403 on /api/applications, got ' + m.status);
  const p = await call(boot(asUser('u1')), '/api/applications');
  if (!p.ok) errors.push('president should read /api/applications');
});

test('member cannot write swimmers', async () => {
  const r = await call(boot(asUser('u3')), '/api/swimmers', 'POST', { name: 'x' });
  if (r.status !== 403) errors.push('member should not add swimmers, got ' + r.status);
});

test('president can add, edit and delete a swimmer', async () => {
  const w = boot(asUser('u1'));
  const add = await call(w, '/api/swimmers', 'POST', { name: 'جديد', group_name: 'المتقدمون', phone: '07', status: 'نشط' });
  if (add.status !== 201) errors.push('add swimmer status ' + add.status);
  const put = await call(w, '/api/swimmers', 'PUT', { id: 'SDR-A1', name: 'معدّل', group_name: 'متقدم', phone: '08', status: 'نشط' });
  if (!put.ok) errors.push('edit swimmer failed');
  const del = await call(w, '/api/swimmers', 'DELETE', { id: 'SDR-A1' });
  if (!del.ok) errors.push('delete swimmer failed');
  if (DATA.swimmers['SDR-A1']) errors.push('swimmer not deleted in store');
});

test('coach can mark attendance but not edit plans', async () => {
  const w = boot(asUser('u2'));
  const att = await call(w, '/api/attendance', 'POST', { member_id: 'SDR-A1', status: 'late' });
  if (att.status !== 201) errors.push('coach attendance status ' + att.status);
  const key = Object.keys(DATA.attendance)[0];
  if (!key || !key.startsWith('att_')) errors.push('attendance doc id not deterministic: ' + key);
  const plan = await call(w, '/api/subscription-plans', 'PUT', { plans: [], extras: {} });
  if (plan.status !== 403) errors.push('coach must not edit plans, got ' + plan.status);
});

test('attendance uses a deterministic per-day document', async () => {
  const w = boot(asUser('u1'));
  await call(w, '/api/attendance', 'POST', { member_id: 'SDR-A1', status: 'present' });
  await call(w, '/api/attendance', 'POST', { member_id: 'SDR-A1', status: 'absent' });
  const rows = Object.values(DATA.attendance);
  if (rows.length !== 1) errors.push('attendance should upsert one row, got ' + rows.length);
  if (rows[0].status !== 'absent') errors.push('attendance status not updated');
  const day = new Date().toISOString().slice(0, 10);
  if (rows[0].session_date !== day) errors.push('attendance session_date wrong');
});

test('public sign-up starts pending and amount uses live fees', async () => {
  const w = boot(null);
  const r = await call(w, '/api/applications', 'POST', {
    first_name_ar: 'س', last_name_ar: 'ص', birth_date: '2015-01-01', phone: '06', address: 'غرداية',
    subscription_code: 'quarter', transport: true, uniform: true
  });
  if (r.status !== 201) errors.push('public application status ' + r.status);
  // quarter 1000 + transport 1000 + uniform 3000
  if (r.data.expected_amount !== 5000) errors.push('expected_amount should be 5000, got ' + r.data.expected_amount);
  const stored = DATA.applications[r.data.application_no];
  if (stored.status !== 'pending') errors.push('stored status must be pending');
});

test('president patch recalculates the amount', async () => {
  const w = boot(asUser('u1'));
  const created = await call(w, '/api/applications', 'POST', { first_name_ar: 'أ', last_name_ar: 'ب', birth_date: '2010-01-01', phone: '06', address: 'x', subscription_code: 'quarter' });
  const id = created.data.application_no;
  const patched = await call(w, '/api/applications/' + id, 'PATCH', { status: 'approved', transport: true });
  if (patched.data.expected_amount !== 2000) errors.push('patched amount should be 2000, got ' + patched.data.expected_amount);
  if (DATA.applications[id].reviewed_by !== 'u1') errors.push('reviewed_by not recorded');
  if (DATA.applications[id].status !== 'approved') errors.push('status not patched');
});

test('unknown route returns 404 and non-API requests pass through', async () => {
  const w = boot(asUser('u1'));
  const nf = await call(w, '/api/nope');
  if (nf.status !== 404) errors.push('unknown api route should be 404, got ' + nf.status);
  let passthrough = false;
  w.fetch = ((orig) => function (i, init) { if (String(i).startsWith('/api/')) return orig(i, init); passthrough = true; return Promise.resolve({ ok: true }); })(w.fetch);
  await w.fetch('https://example.com/x');
  if (!passthrough) errors.push('non-API fetch was intercepted');
});

test('coach file path is stored on the application', async () => {
  const w = boot(asUser('u2'));
  const r = await call(w, '/api/applications', 'POST', {
    application_type: 'coach', coach_name: 'مدرب', coach_email: 'c@x.dz', coach_phone: '06',
    birth_date: '1990-01-01', applicant_uid: 'u2', documents: { path: 'coach-applications/u2/COACH-1.pdf' }
  });
  if (r.status !== 201) errors.push('coach application status ' + r.status);
  const stored = DATA.applications[r.data.application_no];
  if (!stored || stored.application_type !== 'coach' || !stored.documents) errors.push('coach application fields missing');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    const before = errors.length;
    try { await t.fn(); } catch (e) { errors.push(`test "${t.name}" threw: ${e.message}`); }
    const added = errors.length - before;
    console.log(`${added ? 'FAIL' : 'PASS'}  ${t.name}${added ? '  (+' + added + ')' : ''}`);
    if (added) failed++;
  }
  if (errors.length) {
    console.log('\nERRORS:');
    [...new Set(errors)].forEach(e => console.log('  - ' + e));
    process.exit(1);
  }
  console.log('\nAll adapter tests passed.');
})();