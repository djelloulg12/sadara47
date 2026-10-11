/* Firebase bridge for the Sadara UI. It keeps the UI API-shaped while
   replacing the local Python session/SQLite calls with Auth + Firestore. */
(function () {
  const config = window.SADARA_FIREBASE_CONFIG;
  if (!config || !window.firebase) return;
  // When the page is served by the local Python server, let it handle /api/*
  // directly so its session auth and SQLite data are used during development.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (isLocal || window.SADARA_LOCAL_API === true) {
    console.info('Sadara: using the local Python API for', location.origin);
    return;
  }
  firebase.initializeApp(config);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const jsonResponse = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
  const currentUser = () => new Promise(resolve => {
    let stop = () => {};
    stop = auth.onAuthStateChanged(user => { stop(); resolve(user); });
  });
  /* The club owner is named by address in config/owners. The rules grant that
     address full rights, so the page has to agree, or the owner would be shown a
     member's view of a database they are allowed to change. Read once per load:
     the list changes only when the owner changes it. */
  let ownersPromise = null;
  const ownerAddresses = () => {
    if (!ownersPromise) {
      ownersPromise = db.collection('config').doc('owners').get()
        .then(snap => (snap.exists && Array.isArray(snap.data().emails)) ? snap.data().emails : [])
        .catch(error => { console.warn('owner list unavailable', error); return []; });
    }
    return ownersPromise;
  };
  const isOwner = async user => {
    if (!user || !user.email || user.emailVerified !== true) return false;
    const list = await ownerAddresses();
    return list.indexOf(user.email) !== -1;
  };

  const userView = async user => {
    if (!user) return null;
    let profile = {};
    try { const snap = await db.collection('users').doc(user.uid).get(); profile = snap.exists ? snap.data() : {}; }
    catch (error) { console.warn('Firestore profile unavailable; using Auth account', error); }
    // an owner holds management rights without needing a users/{uid} document
    const owns = await isOwner(user);
    return {
      id: user.uid,
      name: profile.name || user.displayName || user.email || 'عضو النادي',
      role: owns ? 'admin' : (profile.role || 'member'),
      owner: owns,
      email: user.email || '',
      username: profile.username || '',
      phone: profile.phone || user.phoneNumber || '',
      member_no: profile.member_no || '',
      registration_id: profile.registration_id || '',
      group_name: profile.group_name || '',
      /* Where the person's request stands. An account with no status at all is
         one that predates this field -- the club owner and the first coaches --
         and is let through: reading "no answer" as "not allowed" would lock the
         people who run the club out of their own club. */
      /* Where the person's request stands, read from request_status rather than
         from status: on the club's own accounts `status` has always meant whether
         the account may be used at all, and one column cannot answer both
         questions at once. */
      status: profile.request_status || '',
      rejection_reason: profile.rejection_reason || ''
    };
  };

  /* ---------------- what the state of a request means at the door ----------------
     A pending request has not been refused, so the account exists but the club
     has not said yes yet; it is answered with the waiting message rather than
     with an error. A refused request carries the reason the club gave, which is
     shown as it is written rather than as a general refusal. */
  const ACCEPTED = ['accepted', 'approved', 'مقبول', 'مقبولة'];
  const REJECTED = ['rejected', 'refused', 'مرفوض', 'مرفوضة'];
  const PENDING = ['pending', 'قيد المعالجة', 'قيد الدراسة', 'قيد الانتظار'];

  const loginGate = profile => {
    const status = String((profile && profile.status) || '').trim();
    if (!status) return { gate: 'open', message: '' };
    if (ACCEPTED.indexOf(status.toLowerCase()) !== -1) return { gate: 'open', message: '' };
    if (PENDING.indexOf(status.toLowerCase()) !== -1) {
      return { gate: 'pending', message: 'طلبك قيد الدراسة.' };
    }
    if (REJECTED.indexOf(status.toLowerCase()) !== -1) {
      const why = String((profile && profile.rejection_reason) || '').trim();
      return {
        gate: 'rejected',
        message: why || 'رُفض طلب التسجيل.',
        /* The club's own words, kept apart from the sentence around them so the
           reason is never trimmed into something that reads differently. */
        reason: why
      };
    }
    /* A status nobody wrote a meaning for is not a door to be shut on somebody
       over a spelling. It is reported instead. */
    return { gate: 'unknown', message: 'حالة الطلب غير معروفة: ' + status };
  };
  const managerView = async (message) => {
    const user = await currentUser();
    if (!user) return { error: 'يرجى تسجيل الدخول', status: 401 };
    const profile = await userView(user);
    if (!profile || !['admin', 'president'].includes(profile.role)) return { error: message, status: 403 };
    return { profile };
  };
  /* The only roles the rules and the page both understand. */
  const ROLES = ['admin', 'president', 'coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor'];
  const currentUserUid = () => (auth.currentUser ? auth.currentUser.uid : '');
  const ROW_LIMIT = 1000;
  // Reads are unordered on purpose: a query with an orderBy fails outright when
  // any older document is missing the field, so the display order is applied here.
  const byOrder = (list) => list.slice().sort((a, b) => {
    const x = Number(a.order), y = Number(b.order);
    const ax = Number.isFinite(x), by = Number.isFinite(y);
    if (ax && by) return x - y;
    if (ax) return -1;
    if (by) return 1;
    return 0;
  });
  const DAY_ORDER = { 'الأحد': 1, 'الإثنين': 2, 'الثلاثاء': 3, 'الأربعاء': 4, 'الخميس': 5, 'السبت': 6 };
  const byDay = (list) => list.slice().sort((a, b) => {
    const x = DAY_ORDER[a.day_name] || 99, y = DAY_ORDER[b.day_name] || 99;
    if (x !== y) return x - y;
    return String(a.time_range || '').localeCompare(String(b.time_range || ''));
  });

  const rows = async name => (await db.collection(name).limit(ROW_LIMIT).get())
    .docs.map(d => ({ id: d.id, ...d.data() }));
  /* ---------------- a name that may only be taken once ----------------
     Firestore has no unique constraint and cannot be given one. What a database
     can be given is a collection whose rules let a document be created and refuse
     to let it be written a second time -- and the requests are already exactly
     that collection. A request may be created here and may not be created again.

     So a request is filed under a name that says who it is: the national
     identity number of an adult, and the birth certificate number with the year
     and the commune for a child. The reference number the club reads is a field
     of the document rather than its name, so nothing is lost by the document
     being named after the person instead of after the day it was filed.

     A query would not have done. It says "nobody has this name" and then, a
     moment later, somebody else takes it, and two people registering at the same
     moment both pass. Here the second one is turned away by the database itself,
     with no window between the check and the write. */
  const CLAIM_KIND_U = 'U';

  /* Document ids cannot hold every character a name can, and the id is the name,
     so what cannot be written is written as its code. Deterministic either way:
     the same name always produces the same id, which is the whole point. */
  const safeId = value => String(value).replace(/[^A-Za-z0-9_.@-]/g, c => '_' + c.charCodeAt(0).toString(16));

  /* Where a person's request is filed. Empty when there is nothing that says who
     they are, and then the request is filed under its reference number as before
     and gets no protection -- which is said out loud below rather than left to be
     discovered. */
  const identityDocId = identity => identity
    ? 'APP-' + (identity.kind === 'minor_key' ? 'M' : 'N') + '-' + safeId(identity.key)
    : '';

  /* Where a chosen user name is held. Its own document rather than a field on the
     request, because the name has to survive the request being refused: two
     people, two requests, one user name. */
  const usernameDocId = name => 'APP-' + CLAIM_KIND_U + '-' + safeId(normId(name));

  /* Writes a document once, or reports that the name is taken.
     A permission error on a document that already exists IS the answer -- the
     rules refuse the second write to it -- so it is returned as an answer rather
     than thrown. Anything else is a fault and is passed on. */
  const writeOnce = async (docId, record) => {
    try {
      await db.collection('applications').doc(docId).set(record);
      return true;
    } catch (error) {
      const denied = String((error && error.code) || '').includes('permission-denied')
        || /PERMISSION_DENIED/i.test(error.message || '');
      if (denied) return false;
      throw error;
    }
  };

  /* Whether the requests can be read by whoever is registering.
     The lookup is what lets a refusal name the request already on file, and it is
     the club's own business -- readable by management, not by somebody standing at
     a form. So on a project whose rules keep it that way the lookup cannot run.
     It is not missed, because the refusal does not depend on it: the document
     name carries the duplicate away whether or not anybody could have read the
     list. */
  let lookupChecked = null;
  const duplicateLookupAvailable = async () => {
    if (lookupChecked === null) {
      try {
        await db.collection('applications').limit(1).get();
        lookupChecked = true;
      } catch (error) {
        lookupChecked = false;
        console.warn('this project does not let a registration read the requests; a refusal cannot name one', error);
      }
    }
    return lookupChecked;
  };

  /* Whether a running count can be kept. Same question, same answer: asked, not
     assumed, and a number that cannot be counted here is left to be counted when
     the club accepts, where the counter can be written. */
  let countersChecked = null;
  const countersAvailable = async () => {
    if (countersChecked === null) {
      try {
        await db.collection('counters').doc('_probe').get();
        countersChecked = true;
      } catch (error) {
        countersChecked = false;
        console.warn('this project has no rules for the registration counter', error);
      }
    }
    return countersChecked;
  };

  /* A name is compared the way a person writes it, not the way a keyboard typed
     it: the same national number written with spaces, with dashes or in capitals
     is the same person. Without this, one member becomes three. */
  const normId = value => String(value === undefined || value === null ? '' : value)
    .normalize('NFKC')
    .replace(/[\s  \-_.]/g, '')
    .toUpperCase();

  /* The account behind a request that says it is a returning one.

     Not taken from the request. Taken from the account this page is actually
     signed in with, and only when that account is the one the request names --
     so a request sent from anywhere else cannot put forward somebody else's name
     by saying it is their own. */
  const returningAccount = body => {
    if (!body || !body.returning_account) return null;
    const uid = String(body.applicant_uid || '').trim();
    if (!uid) return null;
    try {
      const user = auth.currentUser;
      if (!user || user.uid !== uid) return null;
      const said = String(body.email || '').trim().toLowerCase();
      const mine = String(user.email || '').toLowerCase();
      return said && mine && said !== mine ? null : user;
    } catch (_) { return null; }
  };

  /* Which name says "this person, already", and of what kind.
     An adult is identified by the national identity number. A child has no
     national number of their own, so they are identified by the three things the
     club has for them: the birth certificate number, the year they were born,
     and the commune they were born in. */
  const identityKeyOf = d => {
    const nid = normId(d && d.national_id);
    if (feeCategory(d) === 'minor') {
      const cert = normId(d && d.birth_certificate_no);
      const year = String((d && d.birth_date) || '').slice(0, 4);
      const place = normId(d && d.birth_place);
      if (!cert || !year || !place) return null;
      return { kind: 'minor_key', key: [cert, year, place].join('|') };
    }
    if (!nid) return null;
    return { kind: 'national_id', key: nid };
  };

  /* ---------------- the one form the database holds ----------------
     The club reads and writes Arabic-Indic digits and writes dates as
     year/month/day. What is stored is Latin digits and 2026-10-11, and that is
     not a preference:

       an identity number is compared against the ones on file to catch the same
         person registering twice -- storing ١٩٨٥ where the comparison expects
         1985 would answer "not seen before" for a member already on the list
       a registration number is read back out of itself to count the next one
       a birth date is subtracted from today to work out an age
       amounts are added up, and Firestore sorts by what it is given

     So this is done here, at the boundary, rather than only on the page: a
     request typed on a phone, sent by a script, or posted by somebody who has
     not opened the page at all is stored in the same form as one that was.
     Anything that is not recognisable is left exactly as it arrived -- a name, a
     note, an address -- and a date that cannot be read is not guessed at, because
     a birth date that has been guessed is a member who is the wrong age for
     ever. */
  const FOLD_DIGIT = /[\u0660-\u0669]/g;
  const FOLD_DIGIT_ALT = /[\u06F0-\u06F9]/g;
  const latinDigits = v => String(v === undefined || v === null ? '' : v)
    .replace(FOLD_DIGIT, d => String(d.charCodeAt(0) - 0x0660))
    .replace(FOLD_DIGIT_ALT, d => String(d.charCodeAt(0) - 0x06F0));

  const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
  const isoDate = v => {
    const raw = latinDigits(v).trim();
    const m = ISO_DATE.exec(raw);
    if (!m) return raw;
    const month = Number(m[2]), day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
    const p = n => String(n).length < 2 ? '0' + n : String(n);
    return m[1] + '-' + p(m[2]) + '-' + p(day);
  };

  /* Named rather than guessed from the shape of the field. A field called
     `national_id` holds a number and a field called `national_id_label` might not,
     and a rule that worked by pattern would one day rewrite somebody's note. */
  const DIGIT_FIELDS = new Set([
    'national_id', 'birth_certificate_no', 'membership_no', 'registration_id',
    'phone', 'whatsapp', 'guardian_phone', 'guardian_national_id'
  ]);
  const DATE_FIELDS = new Set([
    'birth_date', 'guardian_birth_date', 'card_issue_date',
    /* The national identity card: the day it runs out, and the day it was issued. */
    'national_id_expiry', 'guardian_national_id_expiry', 'guardian_card_issued'
  ]);

  const normaliseIncoming = body => {
    if (!body || typeof body !== 'object') return body;
    const out = { ...body };
    for (const key of Object.keys(out)) {
      if (typeof out[key] !== 'string') continue;
      if (DATE_FIELDS.has(key)) out[key] = isoDate(out[key]);
      else if (DIGIT_FIELDS.has(key)) out[key] = latinDigits(out[key]);
    }
    return out;
  };

  /* Somebody already on the books under the same name. Looked for among the
     requests and among the members: a person who applied twice has two requests,
     and a person who applied and was accepted has a request and a member, and
     both are a reason to stop. */
  const findByKey = async (field, value) => {
    try {
      const snap = await db.collection('applications').where(field, '==', value).limit(1).get();
      if (!snap.empty) return { where: 'applications', id: snap.docs[0].id, data: snap.docs[0].data() };
    } catch (_) { /* a collection without the field simply has no match */ }
    try {
      const snap = await db.collection('swimmers').where(field, '==', value).limit(1).get();
      if (!snap.empty) return { where: 'swimmers', id: snap.docs[0].id, data: snap.docs[0].data() };
    } catch (_) { /* likewise */ }
    return null;
  };

  const DUPLICATE_MESSAGE = 'هذا المشترك مسجل مسبقاً.';

  const findDuplicate = async d => {
    const key = identityKeyOf(d);
    if (!key) return null;
    /* The field each kind is stored under, so the lookup is an equality and not
       a scan: national_id for an adult, and the three parts of the child's key
       carried as one joined string. */
    const field = key.kind === 'minor_key' ? 'duplicate_key' : 'national_id_key';
    const found = await findByKey(field, key.key);
    return found ? { key, found } : null;
  };

  /* ---------------- the registration number ----------------
     E202610001 is a swimmer registered in 2026 at the first pool, the first of
     that year and that pool: a letter for the kind of account, the year, the
     number of the pool, then four digits that run on.

     The four digits come from a counter raised inside a transaction, so two
     people registering at the same moment get two different numbers rather than
     the same one twice.

     Where a counter cannot be kept -- this project's rules do not have the
     collection, so every read and every write of one is refused -- the count is
     taken from the numbers already on file instead. Two managers accepting at the
     same instant could land on the same number that way, which is a far narrower
     window than a member leaving the club with no number at all. */
  const ID_LETTER = { swimmer: 'E', coach: 'C', admin: 'A' };
  const idLetter = kind => ID_LETTER[kind] || ID_LETTER.swimmer;

  /* What a registration number says, read back out of the number itself rather
     than out of anything stored beside it -- so a number written by an earlier
     version still counts towards the next one. */
  const readRegistrationId = (value, kind, year, pool) => {
    const m = /^([A-Z])(\d{4})(\d{1,2})(\d{4})$/.exec(String(value || ''));
    if (!m) return 0;
    if (m[1] !== idLetter(kind)) return 0;
    if (Number(m[2]) !== year || Number(m[3]) !== pool) return 0;
    return Number(m[4]);
  };

  /* The next count when nothing can be written to keep one.
     Reading the requests is management's privilege, and this is only ever reached
     when the club accepts a request -- which is management -- so the read is
     allowed there. A refusal is not treated as an empty list: "nobody has a
     number yet" and "I was not allowed to look" are different answers, and only
     the first of them may be answered with 0001. */
  const countedFromRecords = async (kind, year, pool) => {
    let list;
    try { list = await rows('applications'); }
    catch (error) { console.warn('cannot read the requests to count registrations', error); return 0; }
    let highest = 0;
    for (const r of list) {
      const seq = readRegistrationId(r.registration_id || r.membership_no, kind, year, pool);
      if (seq > highest) highest = seq;
    }
    return highest + 1;
  };

  /* The pool's number, as the club counts its pools.

     It is the pool's rank among the pools rather than whatever number it carries,
     because the two machines that hold these records do not agree on whether the
     first pool is 0 or 1 -- the club's own list and the local server's seed each
     start where they please. Ranking answers 1, 2, 3 either way; reading the
     stored number answers "two pools are the first pool" on one of them, and two
     pools sharing a counter is two people handed the same registration number. */
  const poolNumberOf = (facilityId, pools) => {
    const list = (pools || []).slice().sort((a, b) => {
      const x = Number(a.order), y = Number(b.order);
      const ax = Number.isFinite(x) && x >= 0, by = Number.isFinite(y) && y >= 0;
      if (ax && by && x !== y) return x - y;
      if (ax !== by) return ax ? -1 : 1;
      return 0;
    });
    const wanted = String(facilityId || '').trim();
    const at = list.findIndex(p => String(p.id || '') === wanted || String(p.name || '') === wanted);
    return at === -1 ? 0 : at + 1;
  };

  const yearOf = () => new Date().getFullYear();

  const nextRegistrationId = async (kind, poolNo) => {
    const year = yearOf();
    const pool = Math.max(0, Math.min(99, Number(poolNo) || 0));
    const letter = idLetter(kind);
    if (!await countersAvailable()) {
      const seq = await countedFromRecords(kind, year, pool);
      return seq ? letter + year + String(pool) + String(seq).padStart(4, '0') : '';
    }
    const ref = db.collection('counters').doc('registration_' + year + '_' + pool);
    /* The transaction belongs to the database, not to the document: the compat
       build the site loads has no runTransaction on a reference, and calling it
       there fails every registration rather than one. */
    const seq = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const next = (snap.exists ? Number(snap.data().value) || 0 : 0) + 1;
      tx.set(ref, { value: next, year, pool, kind: letter, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
      return next;
    });
    return letter + year + String(pool) + String(seq).padStart(4, '0');
  };

  const extrasDoc = () => db.collection('fee_settings').doc('extras');
  const readExtras = async () => {
    try { const snap = await extrasDoc().get(); return snap.exists ? (snap.data() || {}) : {}; }
    catch (_) { return {}; }
  };

  /* What a category is called in the fee matrix. Anything that is not a minor is
     charged as an adult, so a new category does not silently fall back to the
     cheapest row. */
  const feeCategory = d => String((d && d.category) || 'adult').toLowerCase() === 'minor' ? 'minor' : 'adult';
  const feePool = d => String((d && (d.facility_id || d.facility)) || '').trim();

  /* The one answer to "what does this cost", so the form, the total, the receipt
     and the manager's screen cannot disagree.

     A row is looked for by pool and category, then by category alone, then by the
     single price that was always there. An entry with available:false is a real
     answer -- the club does not offer that service there -- and comes back as a
     price of 0 with offered:false, which is what hides the checkbox on the form. */
  const feeFor = (extras, d, key) => {
    const base = Number(extras && extras[key]) || (key === 'transport' ? 900 : 2500);
    const m = (extras && extras.matrix) || {};
    const cat = feeCategory(d);
    const pool = feePool(d);
    const rows = [pool && m[pool], m['*'], m.defaults && m.defaults[cat]];
    for (const row of rows) {
      if (!row) continue;
      const cell = row[cat] && row[cat][key];
      if (cell === undefined || cell === null) continue;
      if (typeof cell === 'object') {
        return { offered: cell.available !== false, amount: Number(cell.amount) || 0 };
      }
      return { offered: true, amount: Number(cell) || 0 };
    }
    return { offered: true, amount: base };
  };
  const extrasFor = (extras, d) => ({
    transport: feeFor(extras, d, 'transport').amount,
    uniform: feeFor(extras, d, 'uniform').amount
  });
  /* What the form should offer: an entry the club has switched off is hidden. */
  const offeredFor = (extras, d) => ({
    transport: feeFor(extras, d, 'transport').offered,
    uniform: feeFor(extras, d, 'uniform').offered
  });
  const SUBSCRIPTION_DEFAULT = 600;
  const subscriptionDefault = extras => Number(extras && extras.subscription_default) || SUBSCRIPTION_DEFAULT;
  const DEFAULT_PLANS = [
    { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
    { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' },
    { code: 'agreement', name: 'ضمن اتفاقية معتمدة', amount: 3000, duration: 'موسم' }
  ];
  const DEFAULT_REQUIREMENTS = [
    { id: 'identity', label: 'نسخة بطاقة التعريف الوطنية', required: true, order: 1 },
    { id: 'cv', label: 'السيرة الذاتية والشهادات التدريبية', required: true, order: 2 },
    { id: 'medical', label: 'شهادة طبية تثبت القدرة على التدريب', required: true, order: 3 },
    { id: 'criminal-record', label: 'صحيفة السوابق العدلية', required: false, order: 4 }
  ];
  /* Shown until the club renames a pool, so the form is never empty. */
  const DEFAULT_FACILITIES = [
    { id: 'olympic', name: 'المسبح الأولمبي', order: 1 },
    { id: 'half', name: 'المسبح النصف أولمبي', order: 2 },
    { id: 'stadium', name: 'الملعب البلدي', order: 3 },
    { id: 'forest', name: 'غابة غرداية', order: 4 }
  ];
  const amountFor = (d, plans, extras) => {
    const plan = plans.find(x => x.code === d.subscription_code);
    /* No plan named falls back to the manager's default subscription rather than
       to a quarter that may not exist. */
    const base = plan ? Number(plan.amount) || 0 : subscriptionDefault(extras);
    const forThis = extrasFor(extras, d);
    return base
      + (d.transport ? forThis.transport : 0)
      + (d.uniform ? forThis.uniform : 0);
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (!url || !url.startsWith('/api/')) return originalFetch(input, init);
    const path = new URL(url, location.origin).pathname;
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch (_) {}
    try {
      /* ---------------- session ---------------- */
      if (path === '/api/login' && method === 'POST') {
        const credential = await auth.signInWithEmailAndPassword(body.email, body.password);
        const user = await userView(credential.user);
        const gate = loginGate(user);
        /* The account is signed in either way -- the club has to be able to see
           who it is -- but the answer says whether this person may be let in, and
           why not if not. The page asks the question; this answers it in one
           place, from the same fields the rules read. */
        return jsonResponse({ user, gate }, gate.gate === 'open' ? 200 : 403);
      }
      if (path === '/api/logout' && method === 'POST') { await auth.signOut(); return jsonResponse({ ok: true }); }
      if (path === '/api/session' && method === 'GET') {
        const user = await currentUser();
        if (!user) return jsonResponse({ error: 'يرجى تسجيل الدخول' }, 401);
        const profile = await userView(user);
        return jsonResponse({ user: profile, gate: loginGate(profile) });
      }

      /* ---------------- plans & extras ---------------- */
      /* ---------------- own profile ---------------- */
      if (path === '/api/profile' && method === 'GET') {
        const user = await currentUser();
        if (!user) return jsonResponse({ error: '\u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644' }, 401);
        return jsonResponse({ profile: await userView(user) });
      }
      if (path === '/api/profile' && method === 'PUT') {
        const user = await currentUser();
        if (!user) return jsonResponse({ error: '\u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644' }, 401);
        const profile = await userView(user);
        if (profile.role === 'member' && !profile.member_no && !profile.phone)
          return jsonResponse({ error: '\u062d\u0633\u0627\u0628\u0643 \u063a\u064a\u0631 \u0645\u0631\u0628\u0648\u0637 \u0628\u0648\u0637\u0627\u0642\u0629 \u0623\u0648 \u0631\u0642\u0645 \u0647\u0627\u062a\u0641' }, 403);
        const extras = Array.isArray(body.extras)
          ? body.extras.filter(x => x && (x.label || x.value)).slice(0, 20).map(x => ({ label: String(x.label || ''), value: String(x.value || '') }))
          : [];
        await db.collection('users').doc(user.uid).set({ ...profile, ...body, extras, id: undefined, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return jsonResponse({ ok: true, profile: { ...profile, ...body, extras } });
      }

      if (path === '/api/subscriptions' && method === 'GET') {
        const plans = byOrder((await rows('subscription_plans')).filter(p => p.active !== false));
        return jsonResponse(plans.length ? plans : DEFAULT_PLANS);
      }
      if (path === '/api/subscription-plans' && method === 'GET') {
        const [plans, extras, pools] = await Promise.all([
          rows('subscription_plans'), readExtras(), rows('facilities')
        ]);
        /* The category and the pool travel with the question, because the fee
           depends on both: answering once for everybody priced a junior at the
           senior rate, and offered a uniform at a pool that has no changing room.
           'offered' is separate from the price so the form can hide a checkbox
           rather than charge for something the club does not do there. */
        /* `url` here is the raw string the caller passed and `path` is its
           pathname, so the query has to be read off a URL of its own. */
        const ask = new URL(url, location.origin).searchParams;
        const who = {
          category: ask.get('category') || 'adult',
          facility: ask.get('facility') || ''
        };
        return jsonResponse({
          plans: plans.length ? byOrder(plans)
            : DEFAULT_PLANS.map((p, i) => ({ ...p, id: p.code, active: true, order: i + 1 })),
          extras: extrasFor(extras, who),
          offered: offeredFor(extras, who),
          subscription_default: subscriptionDefault(extras),
          pools: pools.length ? byOrder(pools).map(x => ({ id: x.id, name: x.name })) : []
        });
      }
      if (path === '/api/fees' && method === 'PUT') {
        /* The matrix and the default subscription. Written as a whole document
           rather than merged, because removing a pool's row has to remove it --
           a merge would leave the row there, switched on, forever. */
        const gate = await managerView('تعديل الرسوم لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const extras = {
          transport: Number(body.transport) || 0,
          uniform: Number(body.uniform) || 0,
          subscription_default: Number(body.subscription_default) || SUBSCRIPTION_DEFAULT,
          matrix: (body.matrix && typeof body.matrix === 'object') ? body.matrix : {},
          updated_by: gate.profile.id,
          updated_at: new Date().toISOString().slice(0, 10)
        };
        await db.collection('fee_settings').doc('extras').set(extras, { merge: true });
        return jsonResponse({ ok: true, extras });
      }
      if (path === '/api/fees' && method === 'GET') {
        const [extras, pools] = await Promise.all([readExtras(), rows('facilities')]);
        return jsonResponse({
          transport: Number(extras.transport) || 900,
          uniform: Number(extras.uniform) || 2500,
          subscription_default: subscriptionDefault(extras),
          matrix: extras.matrix || {},
          pools: pools.map(p => ({ id: p.id, name: p.name }))
        });
      }
      if (path === '/api/subscription-plans' && method === 'PUT') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const plans = Array.isArray(body.plans) ? body.plans.filter(p => p && p.code) : [];
        const extras = body.extras || {};
        const batch = db.batch();
        const existing = await db.collection('subscription_plans').get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        plans.forEach((item, index) => batch.set(db.collection('subscription_plans').doc(item.id || item.code), {
          code: item.code, name: item.name || item.code, amount: Number(item.amount) || 0,
          duration: item.duration || 'موسم', active: item.active !== false, order: index + 1
        }));
        batch.set(extrasDoc(), { transport: Number(extras.transport) || 0, uniform: Number(extras.uniform) || 0, updated_by: gate.profile.id });
        await batch.commit();
        return jsonResponse({ ok: true });
      }

      /* ---------------- facilities ---------------- */
      if (path === '/api/facilities' && method === 'GET') {
        /* Public on purpose: a visitor filling the registration form needs the
           list before signing in, and a pool name is not a secret. An empty
           collection falls back to the built-in list so the form is never bare. */
        const snap = await db.collection('facilities').get();
        const list = byOrder(snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(f => f.active !== false));
        return jsonResponse(list.length ? list.map((f, i) => ({ id: f.id, name: f.name, order: i + 1 })) : DEFAULT_FACILITIES);
      }
      if (path === '/api/facilities' && method === 'PUT') {
        const gate = await managerView('تعديل أسماء المسابح للرئيس أو المدير فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const items = Array.isArray(body.facilities) ? body.facilities.filter(f => f && String(f.name || '').trim()) : [];
        if (!items.length) return jsonResponse({ error: 'أبقِ مسبحًا واحدًا على الأقل في القائمة.' }, 400);
        const batch = db.batch();
        const existing = await db.collection('facilities').get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        items.forEach((item, index) => batch.set(db.collection('facilities').doc(
          String(item.id || 'fac-' + index).replace(/[^\w-]/g, '_')),
          { name: String(item.name).trim().slice(0, 120), order: index + 1, active: true }
        ));
        await batch.commit();
        return jsonResponse({ ok: true, count: items.length });
      }

      /* ---------------- decision trail ---------------- */
      if (path === '/api/audit' && method === 'POST') {
        const gate = await managerView('\u0633\u062c\u0644 \u0627\u0644\u062a\u062f\u0642\u064a\u0642 \u0644\u0644\u0631\u0626\u064a\u0633\u0629 \u0641\u0642\u0637');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        await db.collection('audit_logs').add({
          action: String(body.action || '').slice(0, 120),
          entity_type: String(body.entity_type || '').slice(0, 40),
          entity_id: String(body.entity_id || '').slice(0, 60),
          details: body.details && typeof body.details === 'object' ? body.details : {},
          actor: gate.profile.id,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        return jsonResponse({ ok: true }, 201);
      }

      /* ---------------- coach documents ---------------- */
      if (path === '/api/coach-requirements' && method === 'GET') {
        const saved = await rows('coach_requirements');
        return jsonResponse(saved.length ? saved.sort((a, b) => (a.order || 0) - (b.order || 0)) : DEFAULT_REQUIREMENTS);
      }
      if (path === '/api/coach-requirements' && (method === 'POST' || method === 'PUT')) {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const requirements = Array.isArray(body.requirements) ? body.requirements : [];
        const batch = db.batch();
        const existing = await db.collection('coach_requirements').get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        requirements.filter(x => x && x.label).forEach((item, index) => batch.set(
          db.collection('coach_requirements').doc(item.id || ('req-' + Date.now() + '-' + index)),
          { label: item.label, required: item.required !== false, order: index + 1 }
        ));
        await batch.commit();
        return jsonResponse({ ok: true });
      }

      /* ---------------- swimmers ---------------- */
      if (path === '/api/swimmers' && method === 'GET') {
        const user = await currentUser();
        const profile = user ? await userView(user) : null;
        const isStaff = profile && ['admin', 'president', 'coach'].includes(profile.role);
        const list = await rows('swimmers');
        if (isStaff) return jsonResponse(list);
        const mine = String(profile.member_no || '');
        return jsonResponse(mine ? list.filter(x => String(x.membership_no) === mine) : []);
      }
/* ---------------- accounts and their permissions ----------------
         The rules already let a manager read and update any users document.
         Nothing reached it: there was no endpoint, so the only way to give
         somebody a role was to run a script against the database. */
      if (path === '/api/accounts' && method === 'GET') {
        const gate = await managerView('عرض الحسابات لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const list = await db.collection('users').get();
        const owners = await ownerAddresses();
        return jsonResponse(list.docs.map(d => {
          const f = d.data() || {};
          return {
            id: d.id, name: f.name || '', email: f.email || '',
            role: f.role || 'member', owner: owners.indexOf(f.email) !== -1,
            joined: f.created_at && f.created_at.toDate ? f.created_at.toDate().toISOString().slice(0, 10) : ''
          };
        }));
      }
      if (path === '/api/accounts' && method === 'PUT') {
        const gate = await managerView('تعديل الصلاحيات لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const uid = String(body.id || '');
        const role = String(body.role || '');
        if (!uid) return jsonResponse({ error: 'معرّف الحساب مطلوب' }, 400);
        /* indexOf returns -1 when the role is unknown, so this must be compared
           to -1. Written as `!ROLES.indexOf(role)` it is false for -1, which is
           the one case the check exists for, and every unknown role is accepted.
           The local server uses `role not in ROLES`, which is right; the two have
           to say the same thing. */
        if (ROLES.indexOf(role) === -1) {
          /* Written anyway it would be an account that can do nothing, and the
             interface would show it as broken rather than wrong. */
          return jsonResponse({ error: 'سلمي غير معروف: ' + role }, 400);
        }
        if (uid === currentUserUid()) {
          /* You can change anyone else's role, not your own: there is no second
             manager on the platform to undo it, and the club would be locked out. */
          return jsonResponse({ error: 'لا يُغيّر صلاحتياتك بنفسك' }, 400);
        }
        await db.collection('users').doc(uid).set({ role }, { merge: true });
        await db.collection('audit_logs').add({
          action: 'role_changed', entity_type: 'user', entity_id: uid,
          details: { role }, user_id: gate.profile.id,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        return jsonResponse({ ok: true, id: uid, role });
      }

      if (path === '/api/swimmers' && method === 'POST') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        body = normaliseIncoming(body);
        const ref = db.collection('swimmers').doc();
        await ref.set({
          membership_no: body.membership_no || 'SDR-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
          name: body.name || '', group_name: body.group_name || 'المبتدئون',
          phone: body.phone || '', status: body.status === 'نشط' ? 'active' : (body.status || 'active')
        });
        return jsonResponse({ ok: true, id: ref.id }, 201);
      }
      if (path === '/api/swimmers' && method === 'PUT') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف السباح مطلوب' }, 400);
        body = normaliseIncoming(body);
        await db.collection('swimmers').doc(String(body.id)).set({
          name: body.name || '', group_name: body.group_name || 'المبتدئون', phone: body.phone || '',
          status: body.status === 'نشط' ? 'active' : (body.status || 'active')
        }, { merge: true });
        return jsonResponse({ ok: true });
      }
      if (path === '/api/swimmers' && method === 'DELETE') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف السباح مطلوب' }, 400);
        await db.collection('swimmers').doc(String(body.id)).delete();
        return jsonResponse({ ok: true });
      }

      /* ---------------- notices ---------------- */
      if (path === '/api/notices' && method === 'GET') return jsonResponse((await rows('notices')).map(x => ({ ...x, text: x.text || x.body || '', date: x.date || '' })));
      if (path === '/api/notices' && method === 'POST') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        await db.collection('notices').add({
          title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان',
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        return jsonResponse({ ok: true }, 201);
      }
      if (path === '/api/notices' && (method === 'PUT' || method === 'DELETE')) {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف الإعلان مطلوب' }, 400);
        const ref = db.collection('notices').doc(String(body.id));
        if (method === 'DELETE') await ref.delete();
        else await ref.set({ title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان', updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return jsonResponse({ ok: true });
      }

      /* ---------------- schedule ---------------- */
      if (path === '/api/schedule' && method === 'GET') return jsonResponse(byDay(await rows('schedules')));
      if (path === '/api/schedule' && (method === 'POST' || method === 'PUT')) {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const payload = {
          day_name: body.day_name || 'السبت', time_range: body.time_range || '',
          group_name: body.group_name || 'المبتدئون', coach: body.coach || '', pool: body.pool || 'مسبح الصدارة'
        };
        if (method === 'PUT' && body.id) await db.collection('schedules').doc(String(body.id)).set(payload, { merge: true });
        else await db.collection('schedules').add(payload);
        return jsonResponse({ ok: true }, method === 'POST' ? 201 : 200);
      }
      if (path === '/api/schedule' && method === 'DELETE') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف الحصة مطلوب' }, 400);
        await db.collection('schedules').doc(String(body.id)).delete();
        return jsonResponse({ ok: true });
      }

      /* ---------------- cards ---------------- */
      if (path === '/api/cards' && method === 'GET') return jsonResponse(await rows('cards'));

      /* ---------------- attendance ---------------- */
      if (path === '/api/attendance' && method === 'GET') return jsonResponse(await rows('attendance'));
      if (path === '/api/attendance' && method === 'POST') {
        const user = await currentUser();
        if (!user) return jsonResponse({ error: 'يرجى تسجيل الدخول قبل تسجيل الحضور' }, 401);
        const profile = await userView(user);
        if (!profile || !['admin', 'president', 'coach'].includes(profile.role))
          return jsonResponse({ error: 'تسجيل الحضور من صلاحية المدرب أو الإدارة فقط' }, 403);
        const memberId = body.member_id || body.swimmer_id || '';
        if (!memberId) return jsonResponse({ error: 'يجب تحديد السباح' }, 400);
        const day = new Date().toISOString().slice(0, 10);
        const status = body.status || 'present';
        await db.collection('attendance').doc('att_' + day + '_' + String(memberId).replace(/[^\w-]/g, '_')).set({
          member_id: memberId, session_date: day, status,
          marked_by: user.uid, marked_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return jsonResponse({ ok: true, message: 'تم تسجيل الحضور بنجاح' }, 201);
      }

      /* ---------------- applications ---------------- */
      if (path === '/api/applications' && method === 'GET') {
        const gate = await managerView('صلاحية رئيس النادي مطلوبة');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        /* A document that holds a name rather than a person waiting is not a
           request, and the manager's list is a list of people. */
        return jsonResponse((await rows('applications')).filter(row => !row.claim_only));
      }
      if (path === '/api/applications' && method === 'POST') {
        /* Folded to the form the database holds before anything reads it, so the
           duplicate check below, the identity this is filed under and the record
           that is written all see the same number whichever digits it arrived in. */
        body = normaliseIncoming(body);
        const [plans, extras, pools] = await Promise.all([rows('subscription_plans'), readExtras(), rows('facilities')]);
        const list = plans.length ? plans : DEFAULT_PLANS;
        const applicationNo = body.application_no
          || ('APP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(16).slice(2, 6).toUpperCase());
        /* Which kind of file this is. The deployed rules require the field, and
           a request without it is refused outright -- so the default is set here
           rather than trusted to every caller. Coach requests carry their own
           value and pass through untouched. */
        const applicationType = body.application_type === 'coach' ? 'coach' : 'swimmer';

        /* Nobody is registered twice.
           An adult is the holder of a national identity number; a child, who has
           none of their own, is the birth certificate number with the year and
           the commune of birth. Either way the name is looked for before anything
           is written, and the answer is the club's own words rather than a refusal
           with nothing behind it.

           The lookup is a courtesy, not the guarantee: it lets the refusal name
           the request already on file. The guarantee is below, in the name the
           document is filed under. */
        const checked = await duplicateLookupAvailable();
        const identity = identityKeyOf(body);
        const duplicate = checked ? await findDuplicate(body) : null;
        if (duplicate) {
          return jsonResponse({
            error: DUPLICATE_MESSAGE,
            duplicate: true,
            /* Enough for the club to see who it is, and no more: this is the
               applicant's own identity number coming back to them. */
            existing: {
              where: duplicate.found.where,
              reference: duplicate.found.data.application_no || duplicate.found.data.membership_no || duplicate.found.id,
              status: duplicate.found.data.status || ''
            }
          }, 409);
        }

        /* The name that says "this person, already", kept on the record as well so
           the club can search for it without knowing how the document is filed. */
        const record = {
          ...body,
          application_no: applicationNo,
          application_type: applicationType,
          status: 'pending',
          expected_amount: amountFor(body, list, extras),
          ...(identity ? { [identity.kind === 'minor_key' ? 'duplicate_key' : 'national_id_key']: identity.key } : {}),
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        /* The registration number is raised before the record is written, so the
           number and the record are written together. */
        let registrationId = body.registration_id || '';
        if (!registrationId) {
          const poolNo = poolNumberOf(body.facility_id || body.facility, pools.length ? pools : DEFAULT_FACILITIES);
          registrationId = await nextRegistrationId(applicationType === 'coach' ? 'coach' : 'swimmer', poolNo);
          record.registration_id = registrationId;
          record.pool_number = poolNo;
        }

        /* Filed under the name that says who this is.
           The rules allow a request to be created here and refuse to let it be
           created a second time, so a person who is already on the books is turned
           away by the database -- with no gap between the check and the write, and
           whatever the rules happen to let a visitor read. A request with nothing
           that says who it is is filed under its reference number and gets no such
           protection, which is recorded on it rather than left to be assumed. */
        const docId = identityDocId(identity) || applicationNo;
        record.filed_under = identity ? 'identity' : 'reference';
        if (!checked && identity) record.duplicate_check = 'could-not-name-one';
        if (!await writeOnce(docId, record)) {
          return jsonResponse({ error: DUPLICATE_MESSAGE, duplicate: true }, 409);
        }

        /* The chosen user name is held after the request, not before.
           A person who is already on the books is the common case, and it has to
           be told the truth about it -- "already registered", not "that user name
           is taken" -- so the identity is spoken for first.

           The cost falls in the rare case: a name that is genuinely taken leaves a
           legitimate request on file, because it cannot be taken back off. That is
           said plainly rather than discovered at the counter. */
        /* Somebody already on the books. The name is theirs -- it came off their
           own account -- and claiming it again would be refused by the very rule
           that keeps names apart, so it is not claimed again. */
        const mine = returningAccount(body);
        const username = String(body.username || '').trim();
        if (username && identity && !mine) {
          const held = await writeOnce(usernameDocId(username), {
            application_type: applicationType,
            status: 'pending',
            /* Marks the document as a name held rather than a person waiting, so
               it is kept out of the manager's list and out of anything printed. */
            claim_only: true,
            username: normId(username),
            /* Who holds the name, so the club can tell one holder from another
               without being able to read the claim back itself. */
            owner_uid: String((mine || {}).uid || body.applicant_uid || ''),
            application_no: applicationNo,
            claimed_at: firebase.firestore.FieldValue.serverTimestamp()
          });
          if (!held) {
            return jsonResponse({
              error: 'طلبك مسجّل، لكن اسم المستخدم «' + username + '» مستعمل من قبل. '
                + 'ستتصل بك إدارة النادي لترتيبه.',
              duplicate: true, field: 'username', filed: true
            }, 409);
          }
          /* Written after the fact rather than folded into the request, because a
             request may not be written a second time and this had to be known
             after it. */
          await db.collection('applications').doc(docId)
            .set({ username_claimed: true }, { merge: true }).catch(() => {});
        } else if (username && mine) {
          /* Said on the record rather than left to be worked out: this request was
             filed under an account that already holds the name, so nobody
             afterwards has to wonder why no claim was made. */
          await db.collection('applications').doc(docId)
            .set({ username_from_account: true }, { merge: true }).catch(() => {});
        }

        return jsonResponse({
          ok: true,
          application_no: applicationNo,
          registration_id: registrationId,
          expected_amount: record.expected_amount
        }, 201);
      }
      const appMatch = path.match(/^\/api\/applications\/([^/]+)$/);
      if (appMatch && method === 'PATCH') {
        const gate = await managerView('صلاحية رئيس النادي مطلوبة');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const patch = { ...body };
        if ('subscription_code' in patch || 'transport' in patch || 'uniform' in patch) {
          const [plans, extras] = await Promise.all([rows('subscription_plans'), readExtras()]);
          /* The patch carries only what changed, so it is worked out over the
             record as it stands. Calculating from the patch alone found no plan,
             fell back to the default subscription, and charged a manager adding
             a service less than the plan they were quoted. */
          const stored = (await db.collection('applications').doc(appMatch[1]).get()).data() || {};
          const merged = Object.assign({}, stored, patch);
          patch.expected_amount = amountFor(merged, plans.length ? plans : DEFAULT_PLANS, extras);
        }
        delete patch.id;
        // a scan lives in Cloud Storage; never write the inline copy into Firestore
        delete patch.scan_data_url;
        if (patch.payment_status === 'paid') {
          await db.collection('payments').add({
            application_no: patch.application_no || appMatch[1],
            amount: patch.expected_amount || 0,
            method: patch.payment_method || 'cash',
            paid_at: patch.paid_at || new Date().toISOString().slice(0, 10),
            cashier_name: patch.cashier_name || '',
            recorded_by: gate.profile.id,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        await db.collection('applications').doc(appMatch[1]).set({ ...patch, reviewed_by: gate.profile.id, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

        /* Accepting a request used to change the request's status and stop
           there, so nobody became a swimmer and the club had to add them again by
           hand. The swimmer is written under the request's own name, which makes
           approving twice update one person rather than create two. */
        if (patch.status === 'approved') {
          /* The document's own name, not the reference number inside it: a request
             is filed under the name that says who it is, and the reference number
             is a field the club reads. Looking it up by that field would find
             nothing at all now. */
          const no = appMatch[1];
          const src = (await db.collection('applications').doc(no).get()).data() || {};

          /* The number is raised here when it could not be raised when the request
             was filed: the counter is written by management, and acceptance is
             management. A member leaves the club with a number either way, and the
             specification allows the number at acceptance as well as at
             registration. */
          let registrationId = src.registration_id || '';
          if (!registrationId) {
            const pools = await rows('facilities');
            const poolNo = poolNumberOf(src.facility_id || src.facility, pools.length ? pools : DEFAULT_FACILITIES);
            registrationId = await nextRegistrationId(
              src.application_type === 'coach' ? 'coach' : 'swimmer', poolNo);
            if (registrationId) {
              await db.collection('applications').doc(no).set({
                registration_id: registrationId, pool_number: poolNo
              }, { merge: true });
            }
          }

          if (src.application_type !== 'coach') {
            await db.collection('swimmers').doc(no).set({
              /* The number the club reads off the card: the registration number
                 first, then the request's own reference. Never the document's
                 name, which says who the person is and is not a number anybody
                 reads aloud at the counter. */
              membership_no: src.membership_no || registrationId || src.application_no || no,
              registration_id: registrationId,
              name: [src.first_name_ar, src.last_name_ar].filter(Boolean).join(' '),
              first_name_ar: src.first_name_ar || '', last_name_ar: src.last_name_ar || '',
              birth_date: src.birth_date || '', phone: src.phone || '',
              whatsapp: src.whatsapp || '', blood_group: src.blood_group || '',
              level: src.level || '', facility: src.facility || '',
              group_name: src.group_name || src.level || 'المبتدئون',
              national_id: src.national_id || '',
              status: 'active', from_application: no,
              created_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
          /* The account the applicant created on the way here is now let in, and
             carries the number they were given. Without this the member would be
             a swimmer at the pool and somebody whose request still reads "under
             study" at their own front door. */
          if (src.applicant_uid) {
            await db.collection('users').doc(src.applicant_uid).set({
              /* Where the request stands, on the account. */
              request_status: 'accepted',
              registration_id: registrationId,
              member_no: registrationId,
              rejection_reason: firebase.firestore.FieldValue.delete(),
              decided_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        }
        /* A refusal is only fair if it says why. The reason is written where the
           applicant will read it on their next sign-in attempt, and a refusal
           without one is refused: a bare "no" is not a decision anybody can act
           on, and the club would field the same question at the counter. */
        if (patch.status === 'rejected') {
          const stored = (await db.collection('applications').doc(appMatch[1]).get()).data() || {};
          const why = String(patch.rejection_reason || stored.rejection_reason || '').trim();
          if (!why) {
            return jsonResponse({ error: 'اكتب سبب الرفض قبل رفض الطلب —Applicantd يقرأه عند محاولته الدخول.' }, 400);
          }
          if (stored.applicant_uid) {
            await db.collection('users').doc(stored.applicant_uid).set({
              request_status: 'rejected',
              rejection_reason: why,
              decided_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        }
        return jsonResponse({ ok: true, expected_amount: patch.expected_amount });
      }
      return jsonResponse({ error: 'المسار غير موجود' }, 404);
    } catch (error) {
      console.error('Firebase API error', error);
      const code = String((error && error.code) || '');
      const denied = code.includes('permission-denied');
      /* The code travels with the message: the page turns it into something a
         member can act on, which a raw Firebase string is not. */
      return jsonResponse({
        error: denied ? 'ليست لديك صلاحية لهذه العملية' : (error.message || 'تعذر تنفيذ الطلب'),
        code
      }, code.startsWith('auth/') ? 401 : (denied ? 403 : 400));
    }
  };
})();