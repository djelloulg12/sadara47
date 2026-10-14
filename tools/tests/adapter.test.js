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
      /* One reference maker, used by a single document and by a query's rows, so
         the mock cannot say a document is writable in one direction and not the
         other -- which is what happened: the merge writes through a snapshot when
         it marks an account and through a query when it re-points a request, and
         only the second had been given one. */
      const refOf = (id) => ({
        id,
        _name: name,
        set: async (value, opts) => {
          /* A request may be created once and not created a second time: that
             refusal IS how a name is made unique, and a mock that overwrote
             silently would make uniqueness untestable and untrue. */
          if (name === 'applications' && DATA[name][id] && !(opts && opts.merge)) throw denied();
          calls.push(['set', name, id, value]);
          DATA[name][id] = opts && opts.merge ? Object.assign({}, DATA[name][id], value) : value;
        },
        /* Write once. `create()` is what the adapter uses to claim a name, and it
           refuses a document that is already there with `already-exists`.

           This is why it is on the mock at all. The mock used to refuse a second
           write with `permission-denied`, which is a *different* failure -- the
           rules refusing, not the document existing -- and the adapter, being
           written to treat the two alike, said "already on the books" for both.
           Every check that met a refusal therefore passed for the wrong reason,
           and the confusion was invisible: nothing was measuring what it appeared
           to measure.

           The adapter prefers `create()` and falls back to `set()` only when a
           reference has none, so this is the path the checks now walk. */
        create: async (value) => {
          /* A check can make this fail for a chosen reason -- already held,
             refused, cancelled. A hook rather than a flag on the data because the
             three are not states of the data: a document that exists is a state,
             and a rules refusal is not something a row can be in. Modelling them
             as one flag is what let the original confusion happen at all. */
          if (typeof makeFirestore.__createHook === 'function') {
            makeFirestore.__createHook(name, id, value);
          }
          if (DATA[name][id]) {
            const e = new Error('The entity already exists.');
            e.code = 'already-exists';
            throw e;
          }
          calls.push(['create', name, id, value]);
          DATA[name][id] = value;
        },
        get: async () => ({ exists: !!DATA[name][id], data: () => DATA[name][id], id, ref: refOf(id) }),
        delete: async () => { calls.push(['delete', name, id]); delete DATA[name][id]; }
      });
      const api = {
        where(field, op, value) {
          if (op !== '==') throw new Error('the mock only answers equality: ' + op);
          calls.push(['where', name, field, value]);
          api.__where = [field, value];
          return api;
        },
        /* Which collection this reference belongs to, so a transaction can be
           handed a reference and still find the document it names. */
        doc(id) { return refOf(id); },
        add: async (value) => {
          const id = name + '_' + Object.keys(DATA[name]).length;
          calls.push(['add', name, id, value]);
          DATA[name][id] = value;
          return { id };
        },
        get: async () => {
          /* A document carries the reference it can be written through, as
             Firestore's does. The merge re-points a request's applicant with
             exactly that -- it holds the query and not the id -- so a mock without
             it throws and the check cannot be written at all. */
          const all = Object.keys(DATA[name]).map(id => ({
            id, data: () => DATA[name][id], ref: refOf(id)
          }));
          const w = api.__where;
          return { docs: w ? all.filter(d => d.data()[w[0]] === w[1]) : all, size: all.length };
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
      /* Which collection a transaction wrote to. Needed because the refusal below
         is about one collection and must not touch the others -- a mock that
         refused every write would make this check pass for the wrong reason, and
         would make every registration fail for a reason that is not this one. */
      let wrote = null;
      const tx = {
        get: async (ref) => ({ exists: !!DATA[ref._name][ref.id], data: () => DATA[ref._name][ref.id] }),
        set: (ref, value) => { wrote = ref._name; DATA[ref._name][ref.id] = value; }
      };
      /* The write is only refused once the body has said it wants one, so the
         refusal lands where the rules would land it rather than before. */
      const denied = {};
      tx.set = (ref, value) => {
        if (DATA.readOnlyCounters && ref._name === 'counters') denied.hit = true;
        else { wrote = ref._name; DATA[ref._name][ref.id] = value; }
      };
      const result = await fn(tx);
      if (denied.hit) {
        const e = new Error('Missing or insufficient permissions.');
        e.code = 'permission-denied';
        throw e;
      }
      return result;
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

/* Set by a check to make the next `create()` fail in a chosen way, and left unset
   by every other check. Read inside the mock, so a test does not have to reach
   into it. */
makeFirestore.__createHook = null;
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

  /* A child is identified by whose swimmer they are and which child of that
     swimmer: the guardian's card, the birth certificate number, the year, and
     the commune of birth. */
  const child = {
    application_no: 'APP-KID-1', category: 'minor', first_name_ar: 'x', last_name_ar: 'y',
    birth_date: '2015-04-02', phone: '06', address: 'a',
    birth_certificate_no: 'BC-99', birth_place: 'قصر', subscription_code: 'quarter',
    guardian_national_id: '197809031'
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
    ['a different certificate', { birth_certificate_no: 'BC-98' }],
    ['a different guardian', { guardian_national_id: '198001019' }]
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

  /* Another child of the same guardian. This is the whole reason the guardian's
     card is not the whole key: the club asked for one guardian to have several
     swimmers, and a key that said otherwise would refuse the second one. */
  const sibling = await call(w, '/api/applications', 'POST', Object.assign({}, child, {
    application_no: 'APP-KID-2', birth_certificate_no: 'BC-98', birth_date: '2017-06-09'
  }));
  if (sibling.status === 409) {
    errors.push('another child of the same guardian was refused: '
      + JSON.stringify(sibling.data).slice(0, 140));
  } else if (sibling.ok) {
    /* And the same child again, under the same card, is still the same child. */
    const repeat = await call(w, '/api/applications', 'POST', Object.assign({}, child, {
      application_no: 'APP-KID-3', birth_certificate_no: 'BC-98', birth_date: '2017-06-09'
    }));
    if (repeat.status !== 409) {
      errors.push('the second child was registered a second time under the same card');
    }
  }

  /* A card written the way it is read off a card -- spaces, dashes, capitals --
     is the same card. The guardian's number is compared the way the adult's is. */
  const spaced = await call(w, '/api/applications', 'POST', Object.assign({}, child, {
    application_no: 'APP-KID-SPACED', guardian_national_id: '197 809-031'
  }));
  if (spaced.status !== 409) {
    errors.push('the same child under the same card written with a space and a dash was not refused');
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

/* Four accounts that are one family.

   The club's own case: a father who is himself a swimmer, and three children each
   registered from a phone of their own before the form understood that one
   guardian has several swimmers. Four accounts. One person and his household.

   And the merge, checked by what it leaves behind rather than by what it returns:
   the requests re-pointed, the cards re-pointed, both roles written down, the old
   address answered at the door by name, and the account gone from the club's list
   of people while still on file.

   A merge that deleted instead would pass every count here and lose the three
   requests, which is why they are counted. */

/* The week, and the session a mark belongs to.

   The club fills attendance in after the session -- a coach who was at the pool on
   Saturday writes it on Sunday -- so the mark has to name the session, and it has
   to refuse to go further back than a week. A week is how long a forgotten sheet
   stays a forgotten sheet; further back is either a different mistake or a
   different season.

   What matters most here is that a refusal is a refusal. Filing a date nobody
   asked for under a day of its own leaves a complete sheet that is wrong, and
   nobody finds out until the season's totals are: the worst state there is for a
   record whose whole purpose is being right. */

const isoDaysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

/* The attendance rows this check cares about, and the ones it does not.

   Every attendance check in this file writes to the same collection, so counting
   rows without taking them with you measures the file and not the check -- the
   earlier test's row and this one's look exactly alike, and "the backdated mark
   wrote two rows" was really "the earlier test wrote one too". */
async function withCleanAttendance(fn) {
  const saved = DATA.attendance;
  DATA.attendance = {};
  try { return await fn(); } finally { DATA.attendance = saved; }
}

test('a mark belongs to the session it names, and not to today', () => withCleanAttendance(async () => {
  const w = boot(asUser('u1'));
  const saturday = isoDaysAgo(2);
  const r = await call(w, '/api/attendance', 'POST',
    { member_id: 'SDR-A1', status: 'present', session_date: saturday });
  if (!r.ok) { errors.push('a session two days back was refused: ' + JSON.stringify(r.data)); return; }
  const rows = Object.values(DATA.attendance);
  if (rows.length !== 1) errors.push('the backdated mark wrote ' + rows.length + ' rows rather than one');
  if (rows[0].session_date !== saturday) {
    errors.push('the mark was filed under ' + rows[0].session_date + ' rather than the session named, ' + saturday);
  }
  /* And it is a different document from today's, so filling Saturday does not
     overwrite Monday -- the whole point of naming a session. */
  if (('att_' + saturday + '_SDR-A1') !== Object.keys(DATA.attendance)[0]) {
    errors.push('the mark is not filed under the session it names: ' + Object.keys(DATA.attendance)[0]);
  }
}));

test('no session further back than a week, and none that has not happened', () => withCleanAttendance(async () => {
  const w = boot(asUser('u1'));
  const before = Object.keys(DATA.attendance).length;

  const tooOld = await call(w, '/api/attendance', 'POST',
    { member_id: 'SDR-A1', status: 'present', session_date: isoDaysAgo(8) });
  if (tooOld.ok) errors.push('a session eight days back was accepted');
  if (!/أقدم من أسبوع/.test(tooOld.data.error || '')) {
    errors.push('a session eight days back was not refused by name: ' + JSON.stringify(tooOld.data));
  }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const notYet = await call(w, '/api/attendance', 'POST',
    { member_id: 'SDR-A1', status: 'present', session_date: tomorrow });
  if (notYet.ok) errors.push('a session that has not happened yet was accepted');

  const nonsense = await call(w, '/api/attendance', 'POST',
    { member_id: 'SDR-A1', status: 'present', session_date: 'السبت' });
  if (nonsense.ok) errors.push('a session named in words was accepted');

  if (Object.keys(DATA.attendance).length !== before) {
    errors.push('a refused mark was written anyway');
  }

  /* And the edge of the week is inside it, or the limit means nothing. */
  const edge = await call(w, '/api/attendance', 'POST',
    { member_id: 'SDR-A1', status: 'present', session_date: isoDaysAgo(7) });
  if (!edge.ok) errors.push('the seventh day back was refused, though a week is allowed');
}));

test('the photograph travels with the member it became', async () => {
  const w = boot(asUser('u1'));
  /* The way the neighbouring check calls it: PATCH on the request's own path.
     A check that invents its own way of calling a thing is not checking the
     thing -- this one guessed, got "path not found", and reported it as though
     the photograph had broken acceptance. */
  const NO = 'APP-PHOTO-1';
  const created = await call(w, '/api/applications', 'POST', {
    application_no: NO, category: 'minor', first_name_ar: 'زينب',
    last_name_ar: 'سالم', birth_date: '2015-01-01',
    phone: '0661000009', address: 'حي الثانية', subscription_code: 'quarter',
    guardian_first_name: 'كريم', guardian_last_name: 'سالم', guardian_consent: true,
    photo: PIXEL
  });
  if (created.status !== 201) { errors.push('the request with a photograph was not taken: ' + created.status); return; }
  const accepted = await call(w, '/api/applications/' + NO, 'PATCH', { status: 'approved' });
  if (!accepted.ok) { errors.push('the request could not be accepted: ' + JSON.stringify(accepted.data)); return; }

  const member = DATA.swimmers[NO];
  if (!member) { errors.push('accepting a request wrote no member'); return; }
  /* The photograph has been collected and printed on the registration form since
     the form was built. It stopped at the request, so the membership card printed
     a name and a number and the club's logo standing in for a face. */
  if (member.photo !== PIXEL) {
    errors.push('the member was written without the photograph: ' + JSON.stringify(member.photo));
  }
});

/* A counter that can be read but not written.

   This is the permission error on the registration form, and it took the shape of
   something that cannot happen to test it honestly:

     the rules let any signed-in account READ a counter
     the rules let only management WRITE one
     and the registration form creates an account before it posts

   So the probe -- which asks whether a counter can be read -- always succeeded, the
   write always happened, and every registration made with an account was answered
   with a permission error. The registrations that worked were the ones signed out,
   which is the path nobody takes.

   The mock therefore refuses writes and allows reads, which is the only shape in
   which the bug is visible. The existing counter check throws on *read* and so walks
   the fallback without ever meeting this.

   And what is asserted is that the registration still gets a number, that the
   number is the next one in the run, and that the refusal is not shown to the
   person -- because a working fallback that answers "you do not have permission"
   would be no fix at all. */

/* A counter that can be read but not written.

   This is the permission error on the registration form, and it took a mock
   nobody had built to reproduce honestly:

     the rules let any signed-in account READ a counter
     the rules let only management WRITE one
     and the registration form creates an account before it posts

   So the probe -- which asks whether a counter can be *read* -- always succeeded,
   the write always happened, and every registration made with an account was
   answered with a permission error. The registrations that worked were the ones
   signed out, which is the path nobody takes.

   The existing counter check throws on *read* and so walks the fallback without
   ever meeting this. Here reads answer and the write is refused.

   What is asserted: the registration succeeds, it is given a number, and the number
   is the next one in the run rather than a fresh start. A fallback that answered
   "you do not have permission" would be no fix at all, and a fallback that lost the
   count would hand two swimmers the same number -- so both are checked. */

test('a counter that can be read but not written still hands out the next number', async () => {
  const savedCounters = DATA.counters;
  const savedReadOnly = DATA.readOnlyCounters;

  /* A run that has got to 41, so "the next number" is 42 and not 1. */
  DATA.counters = { registration_2026_0: { value: 41, year: 2026, pool: 0 } };
  DATA.readOnlyCounters = true;
  DATA.applications = {
    /* Two already on the books, which is what the fallback counts out of. Quoted,
       because `APP-A` in an object literal is `APP` minus `A` -- and a file that
       does not parse reports the line after the mistake, not the line of it. */
    'APP-1': { application_no: 'APP-1', registration_id: 'E2026000001' },
    'APP-2': { application_no: 'APP-2', registration_id: 'E2026000002' }
  };

  try {
    /* A registrant, signed in -- which is what the form has done by the time it
       posts, and the whole difference between this failing and not. */
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/applications', 'POST', {
      first_name_ar: 'ح', last_name_ar: 'ج', birth_date: '1990-01-01',
      phone: '06', address: 'غرداية', subscription_code: 'quarter',
      national_id: '1990010100001'
    });

    if (r.status !== 201) {
      errors.push('a registration on a project that will not let a member write the counter '
        + 'answers ' + r.status + ' instead of 201: ' + JSON.stringify(r.data));
    }

    const written = Object.values(DATA.applications).find(a => a.national_id === '1990010100001');
    if (written) {
      const id = written.registration_id || '';
      /* The count must continue, not restart: the fallback reads the running
         numbers out of the records, so it produces the next one and not the first.
         Two swimmers with the same number is the failure that matters. */
      const last = Number(String(id).slice(-4));
      if (!id) {
        errors.push('a registration with no writable counter was given no number at all');
      } else if (last <= 2) {
        errors.push('the fallback restarted the count instead of continuing it: ' + id
          + ' where the run had already reached 2');
      }
      if (id && String(id).length !== 10) {
        errors.push('the number handed out is not a registration number: ' + id);
      }
    } else {
      errors.push('no request was written at all');
    }
  } finally {
    DATA.counters = savedCounters;
    DATA.readOnlyCounters = savedReadOnly;
  }
});

/* And the second one does not walk into the same wall: the refusal is remembered,
   so it costs one attempt rather than one per registration. Two registrations in a
   row, both answered. */
test('the refusal is remembered, so the second registration is not slowed by it', async () => {
  const savedCounters = DATA.counters;
  const savedReadOnly = DATA.readOnlyCounters;
  DATA.counters = {};
  DATA.readOnlyCounters = true;
  DATA.applications = {};

  try {
    const w = boot(asUser('u1'));
    const before = calls.filter(c => c[0] === 'transaction').length;
    for (let i = 1; i <= 2; i++) {
      const r = await call(w, '/api/applications', 'POST', {
        first_name_ar: 'س', last_name_ar: 'ت', birth_date: '1990-01-01',
        phone: '06', address: 'غرداية', subscription_code: 'quarter',
        national_id: '199001010000' + i
      });
      if (r.status !== 201) {
        errors.push('registration ' + i + ' of 2 answers ' + r.status + ': ' + JSON.stringify(r.data));
      }
    }
    const after = calls.filter(c => c[0] === 'transaction').length;
    if (after - before !== 1) {
      errors.push('the counter was tried ' + (after - before) + ' times for two registrations; '
        + 'a refusal that is not remembered costs one attempt per person');
    }
  } finally {
    DATA.counters = savedCounters;
    DATA.readOnlyCounters = savedReadOnly;
  }
});

/* ---- a name taken is not a name we could not hold ---- */

test('a name that is taken is answered by choosing another', async () => {
  const savedApps = DATA.applications;
  try {
    DATA.applications = {};
    const first = boot(asUser('u1'));
    await call(first, '/api/applications', 'POST', {
      application_no: 'APP-NAME-1', category: 'adult', first_name_ar: 'a', last_name_ar: 'b',
      birth_date: '1991-01-01', phone: '07', address: 'x', national_id: 'ID-N1',
      username: 'BELKACEM', subscription_code: 'quarter'
    });

    const second = boot(asUser('u1'));
    const b = await call(second, '/api/applications', 'POST', {
      application_no: 'APP-NAME-2', category: 'adult', first_name_ar: 'c', last_name_ar: 'd',
      birth_date: '1992-01-01', phone: '07', address: 'y', national_id: 'ID-N2',
      username: 'belkacem', subscription_code: 'quarter'
    });
    if (b.status !== 409) {
      errors.push('a name already held was answered ' + b.status + ' instead of 409: '
        + JSON.stringify(b.data).slice(0, 160));
    }
    if (b.data && b.data.taken !== true && !/مستعمل من قبل/.test(b.data.error || '')) {
      errors.push('a name that is genuinely taken is not being described as such: '
        + JSON.stringify(b.data).slice(0, 160));
    }
  } finally {
    DATA.applications = savedApps;
  }
});

test('a name we could not hold is not told to the family as a taken one', async () => {
  const savedApps = DATA.applications;
  const realCreate = makeFirestore.__createHook;
  try {
    DATA.applications = {};
    /* The database refuses this one for a reason that has nothing to do with
       anybody holding the name -- a rule, a limit, a failure on our side. */
    makeFirestore.__createHook = (name, id) => {
      if (String(id).startsWith('APP-U-')) {
        const e = new Error('Missing or insufficient permissions.');
        e.code = 'permission-denied';
        throw e;
      }
    };
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/applications', 'POST', {
      application_no: 'APP-NAME-3', category: 'adult', first_name_ar: 'e', last_name_ar: 'f',
      birth_date: '1993-01-01', phone: '07', address: 'z', national_id: 'ID-N3',
      username: 'benchalal', subscription_code: 'quarter'
    });

    if (r.status === 409 || /مستعمل من قبل/.test(r.data.error || '')) {
      errors.push('a write we could not make was told to the family as "that name is '
        + 'already taken" -- they would go and choose another, and the club would be '
        + 'asked to arrange something that is not wrong: ' + r.status + ' '
        + JSON.stringify(r.data).slice(0, 160));
    }
    if (r.status !== 503) {
      errors.push('a write we could not make answered ' + r.status + ' rather than 503: '
        + JSON.stringify(r.data).slice(0, 160));
    }
    /* And it still says the request is on file -- otherwise the family believes
       they have to start again. */
    if (!(r.data && r.data.filed)) {
      errors.push('a failed name claim did not say the request itself is filed: '
        + JSON.stringify(r.data).slice(0, 160));
    }
  } finally {
    makeFirestore.__createHook = realCreate;
    DATA.applications = savedApps;
  }
});

test('a cancelled transaction is not reported as a name being taken', async () => {
  const savedApps = DATA.applications;
  const realCreate = makeFirestore.__createHook;
  try {
    DATA.applications = {};
    makeFirestore.__createHook = (name, id) => {
      if (String(id).startsWith('APP-U-')) {
        /* What Firestore raises when a transaction is cancelled. It says nothing
           about whether a name is free -- under contention, most of all. */
        const e = new Error('The transaction was aborted.');
        e.code = 'aborted';
        throw e;
      }
    };
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/applications', 'POST', {
      application_no: 'APP-NAME-4', category: 'adult', first_name_ar: 'g', last_name_ar: 'h',
      birth_date: '1994-01-01', phone: '07', address: 'w', national_id: 'ID-N4',
      username: 'benchalal', subscription_code: 'quarter'
    });
    if (/مستعمل من قبل/.test(r.data.error || '')) {
      errors.push('a cancelled transaction is being reported as "that name is already '
        + 'taken" -- it is a different failure and it sends the club to arrange '
        + 'something that does not need arranging');
    }
  } finally {
    makeFirestore.__createHook = realCreate;
    DATA.applications = savedApps;
  }
});

test('the request itself is never refused as a duplicate when the failure is ours', async () => {
  const savedApps = DATA.applications;
  const realCreate = makeFirestore.__createHook;
  try {
    DATA.applications = {};
    makeFirestore.__createHook = (name, id) => {
      if (String(id).startsWith('APP-N-')) {
        const e = new Error('Missing or insufficient permissions.');
        e.code = 'permission-denied';
        throw e;
      }
    };
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/applications', 'POST', {
      application_no: 'APP-OURS', category: 'adult', first_name_ar: 'i', last_name_ar: 'j',
      birth_date: '1995-01-01', phone: '07', address: 'v', national_id: 'ID-O1',
      subscription_code: 'quarter'
    });
    if (r.status === 409 || r.data.duplicate) {
      errors.push('a write we could not make was answered as "already registered", which '
        + 'sends a new family away thinking they are on the books: ' + r.status + ' '
        + JSON.stringify(r.data).slice(0, 160));
    }
    if (r.status !== 503) {
      errors.push('our own failure answered ' + r.status + ' rather than 503');
    }
  } finally {
    makeFirestore.__createHook = realCreate;
    DATA.applications = savedApps;
  }
});

/* ---- a review is a decision, and not an edit ---- */

test('editing a request does not write the reviewer onto it', async () => {
  const savedApps = DATA.applications;
  try {
    DATA.applications = {
      APP_X: {
        application_no: 'APP-X', applicant_uid: 'u9', status: 'pending',
        first_name_ar: 'س', last_name_ar: 'ص', phone: '07'
      }
    };
    const w = boot(asUser('u1'));
    /* Three of the things the club does to a request every day, none of which is a
       decision: uploading the signed form, changing the subscription, recording the
       payment. */
    for (const patch of [
      { scan_name: 'signed.pdf', scan_path: 'scans/x.pdf' },
      { subscription_code: 'season', expected_amount: 3000 },
      { payment_status: 'paid', paid_at: '2026-10-14' }
    ]) {
      await call(w, '/api/applications/APP_X', 'PATCH', patch);
      const after = DATA.applications.APP_X;
      if (after.reviewed_by) {
        errors.push('an ordinary edit stamped "' + after.reviewed_by + '" as the reviewer '
          + 'of a request nobody had decided on (' + JSON.stringify(patch) + ')');
      }
      if (after.decided_at) {
        errors.push('an ordinary edit wrote a decision date on a pending request');
      }
    }
    /* And the edit is still saved -- it is the stamp that was wrong, not the work. */
    if (DATA.applications.APP_X.subscription_code !== 'season') {
      errors.push('the edit itself was lost: the fix must stop the stamp, not the saving');
    }
  } finally {
    DATA.applications = savedApps;
  }
});

test('a decision writes who decided and when, on the request', async () => {
  const savedApps = DATA.applications;
  try {
    DATA.applications = {
      APP_Y: {
        application_no: 'APP-Y', applicant_uid: 'u9', status: 'pending',
        first_name_ar: 'س', last_name_ar: 'ص', phone: '07'
      }
    };
    const w = boot(asUser('u1'));
    await call(w, '/api/applications/APP_Y', 'PATCH', {
      status: 'rejected', rejection_reason: 'الوثائق ناقصة'
    });
    const after = DATA.applications.APP_Y;
    if (after.reviewed_by !== 'u1') {
      errors.push('a refusal did not record who decided: reviewed_by is '
        + JSON.stringify(after.reviewed_by));
    }
    if (!after.decided_at) {
      errors.push('a decided request carries no date on itself, so nobody can tell when '
        + 'it was decided without asking');
    }
  } finally {
    DATA.applications = savedApps;
  }
});

/* ---- refusing a duplicate must not close the account ---- */

const REFUSAL = 'مسجّل مسبقًا';

/* The account, one accepted request and one duplicate, in the three shapes that
   decide whether the account is closed. */
function accountWith(uid, otherRequests) {
  DATA.users[uid] = { name: 'وليّ أمر', role: 'member', request_status: 'accepted' };
  DATA.applications = Object.assign({
    APP_DUP: {
      application_no: 'APP-DUP', applicant_uid: uid, status: 'pending',
      first_name_ar: 'أمين', national_id_key: '1990010100001'
    }
  }, otherRequests);
}

test('refusing a duplicate leaves an account its first request opened', async () => {
  const savedApps = DATA.applications;
  const savedUser = DATA.users['u9'];
  try {
    accountWith('u9', {
      /* The ordinary shape: an earlier request, accepted. */
      APP_ONE: { application_no: 'APP-ONE', applicant_uid: 'u9', status: 'accepted' }
    });
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/applications/APP_DUP', 'PATCH', {
      status: 'rejected', rejection_reason: REFUSAL
    });

    /* The decision itself is not blocked: refusing a duplicate is exactly what a
       manager means to do. */
    if (!r.ok) errors.push('refusing a duplicate was refused: ' + JSON.stringify(r.data));
    if (DATA.applications.APP_DUP.status !== 'rejected') {
      errors.push('the duplicate was not recorded as rejected, so the club\'s decision '
        + 'was taken and then lost');
    }
    /* And the account was not closed. */
    if (DATA.users.u9.request_status !== 'accepted') {
      errors.push('refusing a duplicate closed an account an earlier request had '
        + 'opened: the person can no longer sign in to a club they are on the books of '
        + '(request_status is now ' + JSON.stringify(DATA.users.u9.request_status) + ')');
    }
    /* And the manager is told, rather than left to work it out. */
    if (!r.data || r.data.account_left_open !== true) {
      errors.push('the answer does not say the account stayed open, so somebody cannot '
        + 'see that the decision was taken and what it did: ' + JSON.stringify(r.data));
    }
  } finally {
    DATA.applications = savedApps;
    if (savedUser) DATA.users.u9 = savedUser; else delete DATA.users.u9;
  }
});

test('a request that became a member counts as accepted, whatever its status says', async () => {
  const savedApps = DATA.applications;
  const savedUser = DATA.users['u9'];
  try {
    accountWith('u9', {
      /* `transferred_to` is written at the moment of acceptance and never
         invented, so it is the truer record of what happened than a status column
         somebody may have edited since. */
      APP_ONE: {
        application_no: 'APP-ONE', applicant_uid: 'u9', status: 'pending',
        transferred_to: 'SDR-7'
      }
    });
    const w = boot(asUser('u1'));
    await call(w, '/api/applications/APP_DUP', 'PATCH', {
      status: 'rejected', rejection_reason: REFUSAL
    });
    if (DATA.users.u9.request_status !== 'accepted') {
      errors.push('a request that had already become a member did not count as accepted, '
        + 'so refusing a second request closed an account the club had already opened');
    }
  } finally {
    DATA.applications = savedApps;
    if (savedUser) DATA.users.u9 = savedUser; else delete DATA.users.u9;
  }
});

test('a refusal still closes an account that nothing else opened', async () => {
  const savedApps = DATA.applications;
  const savedUser = DATA.users.u9;
  try {
    /* No other request at all. Here refusing *does* mean closing the door, and a
       fix that stopped that from happening would have swapped one wrong answer for
       another: a refused person quietly able to walk in. */
    DATA.users.u9 = { name: 'مقدّم', role: 'member' };
    DATA.applications = {
      APP_ONE: {
        application_no: 'APP-ONE', applicant_uid: 'u9', status: 'pending',
        first_name_ar: 'أمين', national_id_key: '1990010100001'
      }
    };
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/applications/APP_ONE', 'PATCH', {
      status: 'rejected', rejection_reason: REFUSAL
    });
    if (!r.ok) errors.push('refusing a lone request was refused: ' + JSON.stringify(r.data));
    if (DATA.users.u9.request_status !== 'rejected') {
      errors.push('refusing the only request for an account did not close it, so a person '
        + 'the club turned away can still sign in');
    }
    if (r.data && r.data.account_left_open) {
      errors.push('the answer claims the account stayed open when nothing else had opened it');
    }
  } finally {
    DATA.applications = savedApps;
    if (savedUser) DATA.users.u9 = savedUser; else delete DATA.users.u9;
  }
});

/* ---- and the refusal says what is refused, and what to do about it ---- */

test('a refusal names the account, and says that restoring the password will not help', async () => {
  const saved = DATA.users.u3;
  try {
    /* A member whose request was refused, signing in with a correct password.
       What they must be told: what is refused is the account, and the one thing on
       that screen that looks helpful will not fix it -- because the reset link
       brings them straight back to this same door with a correct new password and
       the same answer. That loop is the whole of what was reported. */
    DATA.users.u3 = {
      name: 'عضو', role: 'member',
      request_status: 'rejected', rejection_reason: 'مسجل'
    };
    const w = boot(asUser('u3'));
    const r = await call(w, '/api/login', 'POST', { email: 'u3@x.dz', password: 'x' });

    const g = r.data && r.data.gate;
    if (!g || g.gate !== 'rejected') {
      errors.push('a refused account was not refused at sign-in: ' + JSON.stringify(r.data));
      return;
    }
    const said = String(g.message || '');
    if (said.indexOf('طلب التسجيل') !== -1) {
      errors.push('the refusal describes a piece of paper rather than the account: "'
        + said + '"');
    }
    if (g.reason !== 'مسجل') {
      errors.push("the club's own reason was not carried through: " + JSON.stringify(g.reason));
    }
    if (!/كلمة المرور|كلمة مروره/.test(said + ' ' + (g.what_now || ''))) {
      errors.push('the refusal does not say that restoring the password will not help, so '
        + 'the only control on the screen that looks helpful still sends them round again');
    }
    if (!/إدارة النادي|تفعيل/.test(g.what_now || '')) {
      errors.push('the refusal does not say what to do instead: ' + JSON.stringify(g.what_now));
    }
  } finally {
    if (saved) DATA.users.u3 = saved;
  }
});

const FAMILY_NID = '0999123456789';
const daysAgo = n => ({ toDate: () => new Date(Date.UTC(2026, 2, n)) });

async function withFamily(fn) {
  const saved = { users: DATA.users, applications: DATA.applications, swimmers: DATA.swimmers,
                  config: DATA.config, facilities: DATA.facilities };
  DATA.users = {
    u1: { name: 'رئيس النادي', role: 'president', email: 'u1@x.dz' },
    u2: { name: 'مدرب', role: 'coach', email: 'u2@x.dz' },
    dad: { name: 'بلعيد الأخيرة', role: 'swimmer_adult', email: 'dad@x.dz',
           national_id: FAMILY_NID, created_at: daysAgo(1) },
    k1: { name: 'مريم', role: 'parent', email: 'k1@x.dz', created_at: daysAgo(9) },
    k2: { name: 'يوسف', role: 'parent', email: 'k2@x.dz', created_at: daysAgo(7) },
    k3: { name: 'آدم', role: 'parent', email: 'k3@x.dz', created_at: daysAgo(5) },
    owner1: { name: 'صاحب النادي', role: 'admin', email: 'owner@x.dz', created_at: daysAgo(3) }
  };
  DATA.applications = {
    r1: { applicant_uid: 'k1', guardian_national_id: FAMILY_NID, application_no: 'APP-1' },
    r2: { applicant_uid: 'k2', guardian_national_id: FAMILY_NID, application_no: 'APP-2' },
    r3: { applicant_uid: 'k3', guardian_national_id: FAMILY_NID, application_no: 'APP-3' }
  };
  DATA.swimmers = {
    m1: { applicant_uid: 'k1', name: 'مريم' },
    m2: { applicant_uid: 'k2', name: 'يوسف' }
  };
  DATA.config = { owners: { emails: ['owner@x.dz'] } };
  /* Awaited, or the finally runs the moment fn returns its promise -- and every
     await inside the test happens afterwards, against data already put back. */
  try { return await fn(); } finally { Object.assign(DATA, saved); }
}

test('a family is found by the guardian card on the requests', async () => {
  await withFamily(async () => {
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/accounts/duplicates');
    if (!r.ok) { errors.push('the duplicate check failed: ' + JSON.stringify(r.data)); return; }

    const group = (r.data.groups || []).find(g => g.reason === 'guardian card');
    if (!group) {
      errors.push('the father and his three children were not found as one family; the groups were: '
        + JSON.stringify((r.data.groups || []).map(g => g.reason)));
      return;
    }
    /* All four, not three: the check has to reach the account that filed nothing,
       which is the whole case. */
    const ids = group.accounts.map(a => a.id).sort();
    if (ids.join(',') !== 'dad,k1,k2,k3') {
      errors.push('the family group holds ' + ids.join(',') + ' rather than dad,k1,k2,k3');
    }
    /* And the one to keep is the oldest, because it is the one that has been in
       use longest -- with the reason said on the row, not guessed. */
    if (group.keep !== 'dad') {
      errors.push('the account offered to keep is ' + group.keep + ' rather than the oldest');
    }
    /* What each one holds, so the question before a merge is answerable. */
    const held = id => (group.accounts.find(a => a.id === id) || {});
    if (held('k1').requests !== 1) errors.push('a child account does not report the one request it filed');
    if (held('k1').swimmers !== 1) errors.push('a child account does not report the one card it became');
    if (held('dad').requests !== 0) errors.push('the father is reported as filing a request');
  });
});

test('two accounts of one person become one, and nothing is lost', async () => {
  await withFamily(async () => {
    const w = boot(asUser('u1'));
    const r = await call(w, '/api/accounts/merge', 'POST', { keep: 'dad', remove: ['k1'] });
    if (!r.ok) { errors.push('the merge failed: ' + JSON.stringify(r.data)); return; }

    /* The requests move. A request left behind would be one the family can no
       longer follow, which is the whole reason for merging rather than removing. */
    if (DATA.applications.r1.applicant_uid !== 'dad') {
      errors.push('the request filed under the merged account was left behind');
    }
    if (DATA.applications.r2.applicant_uid !== 'k2') {
      errors.push('a request belonging to somebody else was moved as well');
    }
    /* And the card. */
    if (DATA.swimmers.m1.applicant_uid !== 'dad') {
      errors.push('the card the merged account held was left behind');
    }
    /* Both roles written down. A father who is a swimmer and the parent of three
       minors is both; whichever account came first must not decide which. */
    const roles = DATA.users.dad.roles || [];
    if (roles.indexOf('swimmer_adult') === -1 || roles.indexOf('parent') === -1) {
      errors.push('the roles were not kept both: ' + JSON.stringify(roles));
    }
    if (DATA.users.dad.role !== 'swimmer_adult') {
      errors.push('merging changed what the rules read on the survivor: ' + DATA.users.dad.role);
    }
    /* And it is a merge, not a removal: the old account is marked, not destroyed. */
    if (!DATA.users.k1) errors.push('the merged account was deleted rather than marked');
    if (DATA.users.k1.merged_into !== 'dad') {
      errors.push('the merged account does not say which account it became');
    }
    if (!DATA.users.k1.merged_name) {
      errors.push('the merged account does not carry the name the old password will be told about');
    }
  });
});

test('the old password answers with the account to use', async () => {
  await withFamily(async () => {
    const w = boot(asUser('k1'));
    DATA.users.k1.merged_into = 'dad';
    DATA.users.k1.merged_name = 'بلعيد الأخيرة';
    const r = await call(w, '/api/session');
    if (r.data.gate.gate !== 'merged') {
      errors.push('a merged account answers the door with "' + r.data.gate.gate + '" rather than "merged"');
    }
    /* By name, and not as a refusal: "some other account" is not something anybody
       can act on, and the password they typed was right. */
    if (r.data.gate.reason.indexOf('بلعيد الأخيرة') === -1) {
      errors.push('the merged account is not told which account to use, by name');
    }
  });
});

test('a merged account leaves the club list of people', async () => {
  await withFamily(async () => {
    const w = boot(asUser('u1'));
    DATA.users.k1.merged_into = 'dad';
    const r = await call(w, '/api/accounts');
    const ids = (r.data || []).map(a => a.id);
    if (ids.indexOf('k1') !== -1) {
      errors.push('a merged account is still offered to the club as a person');
    }
    if (ids.indexOf('dad') === -1) {
      errors.push('the account that was merged into has gone from the club list as well');
    }
  });
});

test('a merge refuses what it must', async () => {
  await withFamily(async () => {
    const w = boot(asUser('u1'));

    /* The club's own account: merging it away would leave the club with no door. */
    let r = await call(w, '/api/accounts/merge', 'POST', { keep: 'k1', remove: ['owner1'] });
    if (r.ok || !/صاحب النادي/.test(r.data.error || '')) {
      errors.push("the club owner's account was merged away: " + JSON.stringify(r.data));
    }

    /* And the account doing the merging. */
    r = await call(w, '/api/accounts/merge', 'POST', { keep: 'k2', remove: ['u1'] });
    if (r.ok) errors.push('the manager merged their own account away');

    /* An account into itself. */
    r = await call(w, '/api/accounts/merge', 'POST', { keep: 'k1', remove: ['k1'] });
    if (r.ok) errors.push('an account was merged into itself');

    /* One already merged: a second attempt must say so rather than appear to
       succeed and quietly lose the requests. */
    DATA.users.k2.merged_into = 'dad';
    r = await call(w, '/api/accounts/merge', 'POST', { keep: 'dad', remove: ['k2'] });
    if (r.ok || !/مُدمج من قبل/.test(r.data.error || '')) {
      errors.push('merging an account that was already merged did not say so: ' + JSON.stringify(r.data));
    }

    /* And a coach may not merge anything at all. */
    const c = boot(asUser('u2'));
    r = await call(c, '/api/accounts/merge', 'POST', { keep: 'dad', remove: ['k1'] });
    if (r.ok) errors.push('a coach merged two accounts together');
  });
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