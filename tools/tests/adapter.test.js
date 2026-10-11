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
  config: { owners: { emails: [] } }, payments: {}, audit_logs: {},
  /* Where a registration number's four running digits are counted. A user name is
     held in the requests too, under a name of its own, because that is a
     collection whose rules refuse a second write. */
  counters: {},
  /* The public read asks for the pools alongside the plans, because the fee
     depends on which pool the swimmer is going to. Two of them, so a pool's
     number in a registration number is a position and not always 1. */
  facilities: {
    olympic: { name: 'x', order: 1, active: true },
    second: { name: 'y', order: 2, active: true }
  }
};

/* A Firestore mock that behaves like Firestore on the three points the new code
   leans on, rather than on every point at once.

   It is worth being exact about these, because each one carries logic that a
   convenient mock would hide and every check would then pass for the wrong
   reason:

     where()      filters. A mock that answers every query with the whole
                  collection makes every duplicate check report a duplicate, and
                  the check that says "nobody is registered twice" becomes a check
                  that says nothing.
     transactions read and write. A mock that hands back a fixed number never
                  runs two, so a number that is supposed to be consecutive cannot
                  be seen to be.
     the second   writing a document that is already there is refused, which is
                  write            the whole mechanism by which a request is filed
                               once per person. A mock that overwrites silently
                  would make uniqueness untestable and untrue. */
function makeFirestore() {
  const denied = code => { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; return e; };
  const db = {
    collection(name) {
      const api = {
        where(field, op, value) {
          if (op !== '==') throw new Error('the mock only answers equality: ' + op);
          calls.push(['where', name, field, value]);
          api.__where = [field, value];
          return api;
        },
        doc(id) {
          return {
            id,
            /* Which collection this reference belongs to, so a transaction can be
               handed a reference and still find the document it names. */
            _name: name,
            set: async (value, opts) => {
              /* A request may be created once and not created a second time: that
                 refusal IS how a name is made unique, and a mock that overwrote
                 silently would make uniqueness untestable and untrue. */
              if (name === 'applications' && DATA[name][id] && !(opts && opts.merge)) throw denied();
              calls.push(['set', name, id, value]);
              DATA[name][id] = opts && opts.merge ? Object.assign({}, DATA[name][id], value) : value;
            },
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
        get: async () => {
          const all = Object.keys(DATA[name]).map(id => ({ id, data: () => DATA[name][id] }));
          const w = api.__where;
          return { docs: w ? all.filter(d => d.data()[w[0]] === w[1]) : all };
        }
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
    },
    /* The counter is read and raised together, so two registrations at the same
       moment cannot both be handed the same number. The transaction belongs to
       the database, not to the document: the build the site loads has it here and
       a mock that put it on the reference would let a wrong call through. */
    runTransaction: async (fn) => {
      calls.push(['transaction']);
      return fn({
        get: async (ref) => ({ exists: !!DATA[ref._name][ref.id], data: () => DATA[ref._name][ref.id] }),
        set: (ref, value) => { DATA[ref._name][ref.id] = value; }
      });
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
    firestore: Object.assign(() => makeFirestore(), {
      FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DELETE' }
    }),
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
  /* The document is keyed by the request number, so accepting the same request
     twice updates one person. The number the club reads off the card is the
     registration number the applicant was given, and falls back to the request
     number only for a record that predates registration numbers. */
  const made = after.find(x => x.from_application === 'APP-SWIM-1' || x.membership_no === 'APP-SWIM-1');
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


test('the door answers according to where the request stands', async () => {
  /* Three answers and the reason behind the third. A person whose request is
     still being read has not been refused and must not be met with an error; a
     person whose request was refused must be told why, in the club's words. */
  const cases = [
    { status: 'accepted', gate: 'open', why: '' },
    { status: 'approved', gate: 'open', why: '' },
    { status: 'pending', gate: 'pending', why: '' },
    { status: 'rejected', gate: 'rejected', why: 'لا توجد شهادة سباحة سارية.' }
  ];
  for (const c of cases) {
    /* Written to request_status, not status: on the club's own accounts `status`
       has always meant whether the account may be used at all, and putting the
       request's state there would have silently disabled an account. */
    DATA.users.u9 = { name: 'مقدّم', role: 'member', request_status: c.status, rejection_reason: c.why };
    const w = boot({ uid: 'u9', email: 'u9@x.dz' });
    const res = await call(w, '/api/login', 'POST', { email: 'u9@x.dz', password: 'x' });
    const gate = res.data.gate || {};
    if (gate.gate !== c.gate) {
      errors.push(`a request marked "${c.status}" answered "${gate.gate}" at the door, not "${c.gate}"`);
    }
    if (c.gate === 'pending' && !/قيد الدراسة/.test(gate.message || '')) {
      errors.push('a pending request is not told it is being read: ' + JSON.stringify(gate.message));
    }
    if (c.gate === 'rejected' && c.why && gate.reason !== c.why) {
      errors.push('a refused request is not given the club\'s reason: ' + JSON.stringify(gate.reason));
    }
    /* Refused or waiting: the answer is never 200, or the page walks straight in. */
    if (c.gate !== 'open' && res.status === 200) {
      errors.push(`a request marked "${c.status}" was let in with a 200`);
    }
  }
  /* An account with no status at all is one that predates the field: the club
     owner and the first coaches. Reading "no answer" as "not allowed" would lock
     the people who run the club out of their own club. */
  DATA.users.u8 = { name: 'قديمة', role: 'member' };
  const old = boot({ uid: 'u8', email: 'u8@x.dz' });
  const legacy = await call(old, '/api/login', 'POST', { email: 'u8@x.dz', password: 'x' });
  if ((legacy.data.gate || {}).gate !== 'open') {
    errors.push('an account with no status was refused at the door');
  }
});

test('nobody is registered twice', async () => {
  const w = boot(asUser('u1'));
  const adult = {
    application_no: 'APP-DUP-1', category: 'adult', first_name_ar: 'x', last_name_ar: 'y',
    birth_date: '1990-01-01', phone: '06', address: 'a', national_id: '1985 01 01 111 22',
    subscription_code: 'quarter'
  };
  const first = await call(w, '/api/applications', 'POST', adult);
  if (!first.ok) { errors.push('the first registration was refused: ' + JSON.stringify(first.data).slice(0, 140)); return; }

  /* The same person, written differently: spaces, dashes, capitals. A national
     number is read off a card and typed again by hand, and one member who is
     written down twice is three members on the list. */
  const again = await call(w, '/api/applications', 'POST', Object.assign({}, adult, {
    application_no: 'APP-DUP-2', national_id: '1985010111122'
  }));
  if (again.status !== 409 || !/مسجل مسبقاً/.test(again.data.error || '')) {
    errors.push('an adult with the same national number was registered again: '
      + again.status + ' ' + JSON.stringify(again.data).slice(0, 140));
  }

  /* A child is identified by the three things the club has for them: the birth
     certificate number, the year, and the commune of birth. All three. */
  const child = {
    application_no: 'APP-KID-1', category: 'minor', first_name_ar: 'x', last_name_ar: 'y',
    birth_date: '2015-04-02', phone: '06', address: 'a',
    birth_certificate_no: 'BC-99', birth_place: 'قصر', subscription_code: 'quarter'
  };
  const kid1 = await call(w, '/api/applications', 'POST', child);
  if (!kid1.ok) { errors.push('the first child registration was refused: ' + JSON.stringify(kid1.data).slice(0, 140)); return; }

  /* All three together say who the child is. The same three is the same child
     and is refused. */
  const same = await call(w, '/api/applications', 'POST',
    Object.assign({}, child, { application_no: 'APP-KID-SAME' }));
  if (same.status !== 409) {
    errors.push('a child with the same certificate, year and commune was registered again: ' + same.status);
  }
  /* Any one of them different is a different child: the certificate number is
     reissued, a commune is spelled differently, and two children born the same
     year in the same place are two children. Refusing those would refuse the
     club's real members. */
  for (const [what, different] of [
    ['a different year', { birth_date: '2016-04-02' }],
    ['a different commune', { birth_place: 'مسعد' }],
    ['a different certificate', { birth_certificate_no: 'BC-98' }]
  ]) {
    const res = await call(w, '/api/applications', 'POST',
      Object.assign({}, child, different, { application_no: 'APP-KID-' + Math.random().toString(16).slice(2, 8) }));
    if (res.status === 409) {
      errors.push('a child was refused for ' + what + ' -- only all three together say who it is');
    }
  }
  /* A minor registered with a national number they happen to have is still a
     minor: the key follows the category, not whichever field happened to be
     filled in. */
  const kidSame = await call(w, '/api/applications', 'POST',
    Object.assign({}, child, { application_no: 'APP-KID-DUP', national_id: '1985010111122' }));
  if (kidSame.status !== 409) {
    errors.push('the same child was registered again under a national number that belongs to an adult');
  }
});

test('a registration number is a letter, a year, a pool and a running count', async () => {
  const w = boot(asUser('u1'));
  const base = {
    category: 'adult', first_name_ar: 'x', last_name_ar: 'y', birth_date: '1990-01-01',
    phone: '06', address: 'a', subscription_code: 'quarter', facility: 'olympic'
  };
  const year = new Date().getFullYear();
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const res = await call(w, '/api/applications', 'POST',
      Object.assign({}, base, { application_no: 'APP-ID-' + i, national_id: 'ID-' + i }));
    if (!res.ok) { errors.push('registration ' + i + ' was refused: ' + JSON.stringify(res.data).slice(0, 140)); return; }
    seen.push(res.data.registration_id);
  }
  /* E202610001 is a swimmer, registered in 2026, at the first pool, the first of
     that year and that pool. The pool is the facility's place in the club's own
     order, which is what the manager sets when they name the pools. */
  const shape = /^([ECA])(\d{4})(\d{1,2})(\d{4})$/;
  for (const id of seen) {
    const m = shape.exec(id || '');
    if (!m) { errors.push('the registration number is not in the agreed shape: ' + id); return; }
    if (m[1] !== 'E') errors.push('a swimmer was not given the swimmer letter: ' + id);
    if (Number(m[2]) !== year) errors.push('the year in ' + id + ' is not this year (' + year + ')');
    if (Number(m[3]) !== 1) errors.push('the first pool was numbered ' + m[3] + ' in ' + id);
  }
  /* The four running digits run on, and do not run on twice. They are compared
     with each other rather than with 1, because the counter is per year and per
     pool and other checks in this run may already have used it. */
  const seqs = seen.map(id => Number(id.slice(-4)));
  const runs = seqs.every((n, i) => i === 0 || n === seqs[i - 1] + 1);
  if (!runs) {
    errors.push('the running count did not run on: ' + seqs.join(', ') + ' from ' + seen.join(', '));
  }
  /* A second pool is a second counter, so its numbers start where its own count
     starts rather than carrying on from the first pool's. */
  const other = await call(w, '/api/applications', 'POST',
    Object.assign({}, base, { application_no: 'APP-ID-4', national_id: 'ID-4', facility: 'second' }));
  const m = shape.exec(other.data.registration_id || '');
  if (!m || Number(m[3]) !== 2) {
    errors.push('the second pool was not numbered 2: ' + other.data.registration_id);
  } else if (Number(m[4]) !== 1) {
    errors.push('the second pool did not start its own count: ' + other.data.registration_id);
  }

  /* The pool's number is its rank, not whatever number it carries. The club's own
     list starts at 1 and the local server's seed starts at 0; reading the stored
     number would call two different pools the first pool on one of them, and two
     pools sharing a counter is two people handed the same registration number.
     Checked on its own pools, so the pools already in the fixture do not take
     ranks that are not under test. */
  const kept = DATA.facilities;
  try {
    const variants = [['numbered from 1', [1, 2]], ['numbered from 0', [0, 1]]];
    for (let v = 0; v < variants.length; v++) {
      const [what, orders] = variants[v];
      DATA.facilities = {
        first: { name: 'first', order: orders[0], active: true },
        second: { name: 'second', order: orders[1], active: true }
      };
      const ids = [];
      let n = 0;
      for (const pool of ['first', 'second']) {
        n++;
        const res = await call(w, '/api/applications', 'POST', Object.assign({}, base, {
          application_no: 'APP-RANK-' + v + '-' + pool,
          national_id: 'RANK-' + v + '-' + n,
          facility: pool
        }));
        if (!res.ok) errors.push('a pool numbering check could not register: ' + JSON.stringify(res.data).slice(0, 120));
        const g = shape.exec(res.data.registration_id || '');
        ids.push(g ? Number(g[3]) : -1);
      }
      if (ids.join(',') !== '1,2') {
        errors.push('two pools ' + what + ' were numbered ' + ids.join(',') + ' instead of 1,2');
      }
    }
  } finally {
    DATA.facilities = kept;
  }
});

test('a chosen user name cannot be taken twice', async () => {
  /* A user name is a name in its own right: two people, two requests, one name.
     Nothing about the person is shared here -- the second has another identity
     number entirely -- so only the name itself can turn this away. */
  const first = boot(asUser('u1'));
  const a = await call(first, '/api/applications', 'POST', {
    application_no: 'APP-CLAIM-1', category: 'adult', first_name_ar: 'x', last_name_ar: 'y',
    birth_date: '1990-01-01', phone: '06', address: 'a', national_id: 'ID-CLAIM',
    username: 'belkacem', email: 'belkacem@x.dz', subscription_code: 'quarter'
  });
  if (!a.ok) { errors.push('the first registration was refused: ' + JSON.stringify(a.data).slice(0, 140)); return; }

  /* The name is held in a document of its own, so it survives the request being
     refused -- which is the whole point of holding it separately. */
  const held = Object.keys(DATA.applications).filter(id => /^APP-U-/.test(id));
  if (held.length !== 1) {
    errors.push('the user name was not held in a document of its own: ' + held.join(', '));
    return;
  }
  /* And the manager's list is a list of people, so the document that holds a name
     must not be in it. */
  const listed = (await call(first, '/api/applications')).data.map(r => r.id);
  if (listed.some(id => /^APP-U-/.test(id))) {
    errors.push('the document holding a name appears in the manager list of people');
  }

  const second = boot(asUser('u1'));
  const b = await call(second, '/api/applications', 'POST', {
    application_no: 'APP-CLAIM-2', category: 'adult', first_name_ar: 'z', last_name_ar: 'w',
    birth_date: '1991-01-01', phone: '07', address: 'b', national_id: 'ID-OTHER',
    username: 'BELKACEM', subscription_code: 'quarter'
  });
  if (b.status !== 409 || !/اسم المستخدم/.test(b.data.error || '')) {
    errors.push('a user name already in use was accepted: ' + b.status + ' ' + JSON.stringify(b.data).slice(0, 140));
  }
  /* The second person is a different person, so their request is legitimate and
     is on file. What is refused is the name. Saying so plainly matters more than
     leaving them to find it at the counter. */
  if (!b.data.filed || !/طلبك مسجّل/.test(b.data.error || '')) {
    errors.push('a taken user name did not say the request itself is filed: ' + JSON.stringify(b.data).slice(0, 140));
  }
});

test('a person is turned away even when nobody can read the list', async () => {
  /* The lookup among the requests is a courtesy: it lets a refusal name the
     request already on file. The guarantee is the name the document is filed
     under, and it must hold when the rules keep the requests unreadable to a
     visitor -- which is how this project is set.

     Checked on a project where the read is refused, because a check that only
     works where the list can be read is a check that does not work here. */
  const w = boot(asUser('u1'));
  const original = w.firebase.firestore;
  const stubbed = Object.assign(() => {
    const real = original();
    const realCollection = real.collection.bind(real);
    real.collection = (name) => {
      const api = realCollection(name);
      if (name === 'applications') {
        api.get = () => {
          const e = new Error('Missing or insufficient permissions.');
          e.code = 'permission-denied';
          return Promise.reject(e);
        };
        api.where = () => api;
      }
      return api;
    };
    return real;
  }, original);
  w.firebase.firestore = stubbed;
  w.eval(ADAPTER);

  const base = {
    category: 'adult', first_name_ar: 'x', last_name_ar: 'y', birth_date: '1990-01-01',
    phone: '06', address: 'a', subscription_code: 'quarter', username: 'nobody.two'
  };
  const first = await call(w, '/api/applications', 'POST', Object.assign({}, base, {
    application_no: 'APP-DARK-1', national_id: 'DARK-1'
  }));
  if (!first.ok) { errors.push('the first registration was refused: ' + JSON.stringify(first.data).slice(0, 140)); return; }
  const record = Object.values(DATA.applications)
    .find(r => r.application_no === 'APP-DARK-1' && !r.claim_only);
  if (!record || record.filed_under !== 'identity') {
    errors.push('the request was not filed under a name that says who it is');
  }
  if (record && !record.duplicate_check) {
    errors.push('the record does not say that a refusal could not name a request');
  }

  /* The same person again, on a project where the list cannot be read. The
     document name is the same, and the rules refuse the second write to it. */
  const again = await call(w, '/api/applications', 'POST', Object.assign({}, base, {
    application_no: 'APP-DARK-2', national_id: 'DARK-1'
  }));
  if (again.status !== 409 || !/مسجل مسبقاً/.test(again.data.error || '')) {
    errors.push('a person already on the books was registered again where the list cannot be read: '
      + again.status + ' ' + JSON.stringify(again.data).slice(0, 140));
  }
});

test('a request with nothing that says who it is says so on its own face', async () => {
  /* A coach file, or a desk registration with no national number: there is no
     name that says who the person is, so the request is filed under its reference
     number and gets no protection against being filed twice. That is recorded on
     the request rather than left for the club to assume. */
  const w = boot(asUser('u1'));
  const res = await call(w, '/api/applications', 'POST', {
    application_no: 'APP-NOIDENT', application_type: 'coach', coach_name: 'SLIM',
    coach_phone: '06', coach_specialty: 'S', coach_experience: '6'
  });
  if (!res.ok) { errors.push('a coach file was refused: ' + JSON.stringify(res.data).slice(0, 140)); return; }
  const record = DATA.applications['APP-NOIDENT'];
  if (!record) { errors.push('the coach file was not written under its reference number'); return; }
  if (record.filed_under !== 'reference') {
    errors.push('a request with no identity claims to be protected: ' + record.filed_under);
  }
  if (record.claim_only) errors.push('a coach file is a person waiting and must not be marked as a name held');
});

test('a member still gets a number where no counter can be kept', async () => {
  /* This project's rules have no collection to keep a running count in, so every
     read and every write of one is refused. Left at that, no member would ever be
     given a number at all -- which is the whole of what was asked for.

     The count is taken from the numbers already on file instead. Checked on a
     project where the counter cannot be read or written, because a number that is
     only produced where a counter happens to exist is not a number. */
  const year = new Date().getFullYear();
  const w = boot(asUser('u1'));
  const original = w.firebase.firestore;
  const stubbed = Object.assign(() => {
    const real = original();
    const realCollection = real.collection.bind(real);
    real.collection = (name) => {
      const api = realCollection(name);
      if (name === 'counters') {
        api.doc = (id) => {
          const e = new Error('Missing or insufficient permissions.');
          e.code = 'permission-denied';
          const refuse = () => Promise.reject(e);
          return { id, get: refuse, set: refuse };
        };
      }
      return api;
    };
    return real;
  }, original);
  w.firebase.firestore = stubbed;
  w.eval(ADAPTER);

  const seen = [];
  for (let i = 0; i < 3; i++) {
    const res = await call(w, '/api/applications/APP-NOCNT-' + i, 'PATCH', { status: 'approved' });
    if (!res.ok) { errors.push('accepting was refused where no counter can be kept: ' + JSON.stringify(res.data).slice(0, 140)); return; }
    const stored = DATA.applications['APP-NOCNT-' + i];
    seen.push(stored && stored.registration_id);
  }
  /* Each number runs on from the last, and none of them is blank. */
  for (const id of seen) {
    if (!id) { errors.push('a member was accepted with no registration number'); return; }
    const m = /^E(\d{4})(\d{1,2})(\d{4})$/.exec(id);
    if (!m || Number(m[1]) !== year) { errors.push('the number counted from records is not in the agreed shape: ' + id); return; }
  }
  const seqs = seen.map(id => Number(id.slice(-4)));
  if (!seqs.every((n, i) => i === 0 || n === seqs[i - 1] + 1)) {
    errors.push('the count taken from records did not run on: ' + seqs.join(', '));
  }
  /* And it lands on the card, not only on the request. */
  const made = Object.values(DATA.swimmers).find(s => s.from_application === 'APP-NOCNT-2');
  if (!made || made.membership_no !== seen[2]) {
    errors.push('the number the member was given did not reach the card: '
      + JSON.stringify(made && made.membership_no));
  }
});

test('the database holds one form of a number and a date', async () => {
  /* The club reads and writes Arabic-Indic digits and writes dates as
     year/month/day. What is stored is Latin digits and 2026-10-11 -- not a
     preference: an identity number is compared against the ones on file to catch
     the same person registering twice, a registration number is read back out of
     itself to count the next one, and a birth date is subtracted from today to
     work out an age. Storing 1985 where those expect 1985 would make the club's
     own duplicate check answer "not seen before" for a member already on the list.

     Checked on a request that arrives in Arabic digits from a client that never
     opened the page -- which is the whole reason it is done at the boundary. */
  const ar = s => Array.from(s).map(c =>
    (c >= '0' && c <= '9') ? String.fromCodePoint(0x0660 + Number(c)) : c).join('');
  /* Its own national number: an earlier check in this run has already claimed
     1985010111122, and being refused by it would be the duplicate check working
     rather than a fault -- which is worth proving separately and deliberately. */
  const NID = '2010998877666';
  const w = boot(asUser('u1'));
  const res = await call(w, '/api/applications', 'POST', {
    application_no: 'APP-ARABIC', category: 'adult',
    first_name_ar: 'x', last_name_ar: 'y',
    /* Arabic digits, and a date written with slashes the way the club writes it */
    national_id: ar(NID),
    birth_date: ar('1998/3/7'),
    phone: ar('0661234567'),
    guardian_birth_date: ar('1975/06/02'),
    address: ar('حي 12'),
    notes: ar('الحساب 1234'),
    subscription_code: 'quarter'
  });
  if (!res.ok) { errors.push('a request typed in Arabic digits was refused: ' + JSON.stringify(res.data).slice(0, 140)); return; }
  const record = Object.values(DATA.applications).find(r => r.application_no === 'APP-ARABIC');
  if (!record) { errors.push('the request was not written'); return; }

  /* Only the fields that say who the person is are folded. An address and a note
     are the person's own words and are stored exactly as they were written -- and
     a rule that worked by pattern rather than by name would have rewritten both,
     which is the difference between a number and a sentence. */
  const wants = {
    national_id: NID,
    birth_date: '1998-03-07',
    phone: '0661234567',
    guardian_birth_date: '1975-06-02',
    address: 'حي ' + ar('12'),
    notes: 'الحساب ' + ar('1234')
  };
  for (const [field, want] of Object.entries(wants)) {
    if (record[field] !== want) {
      errors.push(`${field} was stored as ${JSON.stringify(record[field])} rather than ${JSON.stringify(want)}`);
    }
  }
  /* And the duplicate check still catches the same person, which is the whole
     reason the stored form has to be the one thing: a number stored in Arabic
     would be a different string from the one in Latin and would pass. */
  const again = await call(w, '/api/applications', 'POST', {
    application_no: 'APP-ARABIC-2', category: 'adult',
    first_name_ar: 'z', last_name_ar: 'w', birth_date: '1998-03-07',
    phone: '06', address: 'a', national_id: NID, subscription_code: 'quarter'
  });
  if (again.status !== 409) {
    errors.push('the same person was registered again when one was typed in Arabic digits and one in Latin: '
      + again.status);
  }

  /* A date that is not one is left alone rather than guessed at. */
  const bad = await call(w, '/api/applications', 'POST', {
    application_no: 'APP-ARABIC-3', category: 'adult',
    first_name_ar: 'q', last_name_ar: 'r', birth_date: ar('1998/13/40'),
    phone: '06', address: 'a', national_id: 'ARABIC-3', subscription_code: 'quarter'
  });
  const stored = Object.values(DATA.applications).find(r => r.application_no === 'APP-ARABIC-3');
  if (!bad.ok || !stored || stored.birth_date !== '1998/13/40') {
    errors.push('an impossible date was corrected into a real one: '
      + JSON.stringify(stored && stored.birth_date));
  }
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