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
  attendance: {}, cards: {}, applications: {}, coach_requirements: {},
  /* Present and empty: every signed-in read of the owner list needs the document
     to exist, and a mock that named everybody an owner would pass every check
     for the wrong reason. payments is written to when a request is settled. */
  config: { owners: { emails: [] } }, payments: {}, audit_logs: {}
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


test('a manager can give an account a role', async () => {
  const w = boot(asUser('u1'));
  /* The rules already allowed this; nothing reached them. */
  const list = await call(w, '/api/accounts');
  if (!list.ok || !list.data.length) {
    errors.push('a manager cannot read the accounts: ' + JSON.stringify(list.data).slice(0, 120));
    return;
  }
  if (!list.data.every(a => 'id' in a && 'role' in a)) {
    errors.push('an account is listed without an id or a role: ' + JSON.stringify(list.data[0]));
  }

  const other = list.data.find(a => a.id !== 'u1');
  if (!other) { errors.push('the fixture has no second account to change'); return; }

  const changed = await call(w, '/api/accounts', 'PUT', { id: other.id, role: 'coach' });
  if (!changed.ok) errors.push('a manager could not change a role: ' + JSON.stringify(changed.data).slice(0, 120));
  const again = await call(w, '/api/accounts');
  const now = again.data.find(a => a.id === other.id);
  if (!now || now.role !== 'coach') errors.push('the new role did not stick: ' + JSON.stringify(now));

  /* An account holding a role the platform does not know can do nothing at all,
     and would look broken rather than wrong. */
  const bogus = await call(w, '/api/accounts', 'PUT', { id: other.id, role: 'wizard' });
  if (bogus.ok) errors.push('an unknown role was accepted');

  /* You may change anyone else's role, not your own: there is no second manager
     here to undo it, and the club would be locked out. */
  const own = await call(w, '/api/accounts', 'PUT', { id: 'u1', role: 'member' });
  if (own.ok) errors.push('a manager was able to demote themselves');
});

test('a member cannot read or change the accounts', async () => {
  const w = boot(asUser('u3'));
  const list = await call(w, '/api/accounts');
  if (list.ok) errors.push('an ordinary member can read every account');
  const changed = await call(w, '/api/accounts', 'PUT', { id: 'u1', role: 'member' });
  if (changed.ok) errors.push('an ordinary member can change a role');
});

test('accepting a request produces a swimmer', async () => {
  const w = boot(asUser('u1'));
  const sent = await call(w, '/api/applications', 'POST', {
    application_no: 'APP-SWIM-1', category: 'minor', first_name_ar: '\u0645\u0631\u064a\u0645',
    last_name_ar: '\u0627\u0644\u0628\u0644\u0639\u064a\u062f', birth_date: '2013-09-14',
    phone: '0661000001', address: '\u062d\u064a \u0627\u0644\u062b\u0646\u064a\u0629',
    subscription_code: 'quarter', level: '\u0645\u0628\u062a\u062f\u0626',
    guardian_first_name: '\u0643\u0631\u064a\u0645', guardian_last_name: '\u0627\u0644\u0628\u0644\u0639\u064a\u062f',
    guardian_consent: true
  });
  if (sent.status !== 201) { errors.push('the fixture request was refused: ' + JSON.stringify(sent.data).slice(0, 120)); return; }

  const before = (await call(w, '/api/swimmers')).data.length;
  const approved = await call(w, '/api/applications/APP-SWIM-1', 'PATCH', { status: 'approved' });
  if (!approved.ok) { errors.push('a request could not be accepted: ' + JSON.stringify(approved.data).slice(0, 120)); return; }

  /* Accepting used to change the status and stop, so nobody became a swimmer and
     the club added them again by hand. */
  const after = (await call(w, '/api/swimmers')).data;
  if (after.length !== before + 1) {
    errors.push('accepting did not produce a swimmer: ' + before + ' -> ' + after.length);
    return;
  }
  const made = after.find(x => x.membership_no === 'APP-SWIM-1');
  if (!made) {
    errors.push('the swimmer was created under a name of its own, so accepting twice makes two people');
  } else if (!/\u0645\u0631\u064a\u0645/.test(made.name || '')) {
    errors.push('the swimmer has no name: ' + JSON.stringify(made));
  }

  /* Keyed by the application number, so approving again is one person. */
  await call(w, '/api/applications/APP-SWIM-1', 'PATCH', { status: 'approved' });
  const again = (await call(w, '/api/swimmers')).data.length;
  if (again !== after.length) errors.push('accepting twice produced a second swimmer: ' + after.length + ' -> ' + again);
});

test('accepting a coach request does not create a swimmer', async () => {
  const w = boot(asUser('u1'));
  await call(w, '/api/applications', 'POST', {
    application_no: 'COACH-1', application_type: 'coach', coach_name: 'SLIM',
    coach_phone: '06', coach_specialty: 'S', coach_experience: '6', applicant_uid: 'u2'
  });
  const before = (await call(w, '/api/swimmers')).data.length;
  await call(w, '/api/applications/COACH-1', 'PATCH', { status: 'approved' });
  const after = (await call(w, '/api/swimmers')).data.length;
  if (after !== before) errors.push('a coach request produced a swimmer: ' + before + ' -> ' + after);
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