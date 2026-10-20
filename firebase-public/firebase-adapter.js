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

  /* Whether a registration may be filed, and whether we were able to find out.

     `read: false` is the half that matters, and it is not a detail.

     A closed door that could not be read was being treated as an open one, on the
     reasoning that a door which shuts itself when the network is down stops a
     season. That reasoning is sound for the *form* -- a family must not be shown
     a form because a request failed. It is exactly backwards for the *write*: a
     registration accepted by mistake is a child in the club's database with a
     photograph and an identity number on it, and undoing that is a deletion, an
     audit entry, and a family told their child was not registered.

     The two failures are not the same size, and only one of them is cheap. So the
     write refuses when the door is shut and refuses when the door cannot be told,
     and says which of the two it was, so the family knows whether to wait or to
     telephone the club. */
  const readDoor_ = async () => {
    try {
      const snap = await db.collection('config').doc('registration').get();
      const data = snap.exists ? snap.data() : null;
      if (!data) return { read: true, open: true, note: '' };
      return { read: true, open: data.open !== false, note: data.note || '' };
    } catch (error) {
      console.warn('the registration door could not be read; a registration is refused '
        + 'rather than assumed to be wanted', error);
      return { read: false, open: false, note: '' };
    }
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
      rejection_reason: profile.rejection_reason || '',
      /* Both roles, when a merge found that one person is more than one thing: a
         father who is a swimmer and the parent of three minors. The role the rules
         read stays as it was -- merging must not make anybody a manager -- and
         the rest are written down beside it rather than lost. */
      roles: Array.isArray(profile.roles) ? profile.roles : (profile.role ? [profile.role] : []),
      national_id: profile.national_id || '',
      merged_into: profile.merged_into || '',
      merged_name: profile.merged_name || ''
    };
  };

  /* من يسجّل الحضور، ومن لا يسجّله.

     الشاشة تقبل التبديل بين الإدارة والمدرب، وهذا هو ما يقبله الخادم
     أيضًا. أما غيرهما -- سباح أو ولي -- فلا: له صفحة حضور يقرؤها، وليس
     له أن يكتب على سجلّ غيره. والخادم هو من يقرّر، لا الشاشة. */
  const SCANNER_ROLES = ['admin', 'president', 'manager', 'coach'];

  const attendanceRecorder = profile => ({
    uid: profile.id || '',
    name: profile.name || 'عضو النادي',
    role: profile.role || '',
    /* الصفة كما تُقرأ: مهنة الذي مسح، لا اسم الدور في قاعدة البيانات. */
    title: profile.role === 'coach' ? 'مدرب' : 'مسير'
  });

  /* ---------------- which session a mark belongs to ----------------

     A week back and no further. A week is how long a forgotten sheet stays a
     forgotten sheet -- filling one in late is an ordinary thing to do -- and
     further back is either a different mistake or a different season.

     A day that is refused is refused by name. Filing it under a day nobody asked
     for would leave a complete sheet that is wrong, which is the worst state
     there is: nobody finds out until the season's totals are. */
  const ATTENDANCE_BACK_DAYS = 7;
  const attendanceSession = value => {
    const raw = latinDigits(String(value === undefined || value === null ? '' : value)).trim().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (!raw) return { day: today, error: '' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { day: today, error: 'تاريخ الحصة غير مفهوم.' };
    if (raw > today) return { day: today, error: 'لا تُسجَّل حضور حصة لم تبدأ بعد.' };
    const earliest = new Date(Date.now() - ATTENDANCE_BACK_DAYS * 86400000).toISOString().slice(0, 10);
    if (raw < earliest) return { day: today, error: 'لا تُسجَّل حضور حصة أقدم من أسبوع.' };
    return { day: raw, error: '' };
  };

  /* ---------------- what the state of a request means at the door ----------------
     A pending request has not been refused, so the account exists but the club
     has not said yes yet; it is answered with the waiting message rather than
     with an error. A refused request carries the reason the club gave, which is
     shown as it is written rather than as a general refusal. */
  const ACCEPTED = ['accepted', 'approved', 'مقبول', 'مقبولة'];
  const REJECTED = ['rejected', 'refused', 'مرفوض', 'مرفوضة'];
  const PENDING = ['pending', 'قيد المعالجة', 'قيد الدراسة', 'قيد الانتظار'];

  /* Whether this account has already been let in by some other request.

     Asked before a refusal is written onto the account, because a refusal is a
     statement about one request and not about the person: refusing the second
     request of somebody whose first was accepted must not close an account the
     club has already opened.

     `transferred_to` counts as accepted whatever the status column says. It is
     written at the moment of acceptance, never invented, and it is the truer
     record -- a request that became a member was taken, whatever happened to its
     status afterwards.

     Read only, and read by management: the rules will not let a member read
     their own requests, which is why this cannot also be done at sign-in time and
     why the fix is at the moment of writing rather than at the moment of reading.

     A failure to read is answered "no", not "yes": the conservative answer is the
     one that leaves an account open, and the consequence of getting it wrong in
     that direction is one refusal that has to be done again. */
  const accountAcceptedElsewhere = async (uid, except) => {
    if (!uid) return false;
    try {
      const snap = await db.collection('applications')
        .where('applicant_uid', '==', uid).get();
      return snap.docs.some(doc => {
        if (except && doc.id === except) return false;
        const v = doc.data() || {};
        return !!v.transferred_to
          || ACCEPTED.indexOf(String(v.status || '').trim().toLowerCase()) !== -1;
      });
    } catch (_) {
      return false;
    }
  };

  const loginGate = profile => {
    /* An account that has become another account. Not refused as though it were
       wrong -- answered, with the account it became, so the person knows which
       door to use rather than being told nothing. Silence here would cost the
       club a telephone call and the family an afternoon. */
    if (profile && profile.merged_into) {
      const into = String(profile.merged_name || '').trim();
      return {
        gate: 'merged',
        message: 'هذا الحساب دُمج في حساب آخر.',
        into: profile.merged_into,
        into_name: into,
        reason: into ? ('استعمل الآن حساب «' + into + '».') : 'استعمل الحساب الذي بقي.'
      };
    }
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
        /* Said about the account, because that is what was refused. The old words
           described a piece of paper to somebody who had just signed in with a
           correct password, and left them with a decision somebody else had made,
           no date, and nobody to ask. A password reset does not help here: it
           brings them straight back to this door, which is why the sentence says
           so rather than sending them round in circles.

           And it says what does help, because there is something to do: accepting
           a request for the account writes `request_status: 'accepted'` and
           removes the reason, in one click in the management screen. A refusal
           that says what to do with it is answered at the counter; one that does
           not is a telephone call and an afternoon.

           The reason is a refusal that does not explain itself, and it is a
           decision the club took and can lift -- so it is named first, in the
           club's own words, and kept apart from the sentence around it so it is
           never trimmed into something that reads differently. */
        message: why
          ? 'حسابك غير مفعّل على المنصة. السبب الذي كتبته الإدارة: ' + why
          : 'حسابك غير مفعّل على المنصة.',
        reason: why,
        what_now: 'تواصل مع إدارة النادي، أو اطلب إعادة تفعيل حسابك.'
          + ' استعادة كلمة المرور لا تفيد هنا: الحساب نفسه هو المرفوض، لا كلمة مروره.'
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
  /* من يسجّل الحضور: الإدارة والمدرب.

     يقرأ الحضورَ كثيرون، ويكتبه اثنان. وهذه القائمة هي التي يقرؤها كل
     مسار كتابة للحضور -- الطلب الواحد وحفظُ الدفعة -- فلا يمرّ أحدهما
     ويُرَدّ الآخر باختلاف قائمة. */
  const scannerView = async (message) => {
    const user = await currentUser();
    if (!user) return { error: 'يرجى تسجيل الدخول', status: 401 };
    const profile = await userView(user);
    if (!profile || SCANNER_ROLES.indexOf(profile.role) === -1)
      return { error: message || 'تسجيل الحضور بالمسح خاص بالمسيرين والمدربين فقط.', status: 403 };
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
  /* Write it once, and say why not if it cannot be.

     `create()` rather than `set()`: `set()` on a document that already exists
     overwrites it, so a "claim" written that way was never a claim -- two people
     choosing the same name at the same moment both succeeded and the second
     document replaced the first. `create()` succeeds once and refuses afterwards,
     in one round trip with nothing in between.

     The answer is three-valued on purpose, because the two callers need opposite
     answers and lumping them together is what caused the fault:

       { ok: true }                     it is written
       { ok: false, taken: true }       it was already there -- and only that
       { ok: false, taken: false }      we could not write it, and it is logged

     `aborted` is deliberately not counted as taken. It is a transaction that was
     cancelled, which happens under contention and says nothing about whether a
     name is free -- so reporting it as "taken" sends the club to arrange something
     that does not need arranging, which is the same wrong answer one failure mode
     further on. */
  const writeOnce = async (docId, record) => {
    try {
      const ref = db.collection('applications').doc(docId);
      if (typeof ref.create === 'function') await ref.create(record);
      else await ref.set(record);
      return { ok: true };
    } catch (error) {
      const code = String((error && error.code) || '');
      const said = String((error && error.message) || '');
      if (code === 'already-exists' || code === 'ALREADY_EXISTS' || /already exists/i.test(said)) {
        return { ok: false, taken: true, code: code || 'already-exists' };
      }
      /* Ours, not theirs. Kept in the console with the code, because a person
         cannot act on it and somebody has to be able to. */
      console.error('A document could not be written once', code || '(no code)', error);
      return { ok: false, taken: false, code: code || 'unknown' };
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
  /* A readable counter is not a writable one, and this only asks about reading --
     so it is a question about permission, answered properly where the permission
     is needed, inside `nextRegistrationId`. What it is still good for is finding
     out that there are no rules for the collection at all. */
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

  /* A counter that was refused. Remembered, so the answer costs one attempt per
     session rather than one per registration. */
  const markCountersUnavailable = () => { countersChecked = false; };

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
      /* The guardian's card says whose swimmer this is -- the club works by the
         card, one guardian and the children under them -- and the child's own
         certificate and year say which child of that guardian this is.

         Not the guardian's card alone: that would say a guardian has one swimmer,
         which is the opposite of what the club asked for and of what the form now
         lets a family do on one account. */
      const guard = normId(d && d.guardian_national_id);
      const cert = normId(d && d.birth_certificate_no);
      const year = String((d && d.birth_date) || '').slice(0, 4);
      const place = normId(d && d.birth_place);
      if (!guard || !cert || !year || !place) return null;
      return { kind: 'minor_key', key: [guard, cert, year, place].join('|') };
    }
    if (!nid) return null;
    return { kind: 'national_id', key: nid };
  };

  /* The name a minor was filed under before the guardian's card was part of it.
     Still looked for: there are requests on file under it, and a new key with no
     look at the old one is a duplicate check with a hole in it from the day it is
     written. */
  const legacyMinorKeyOf = d => {
    const cert = normId(d && d.birth_certificate_no);
    const year = String((d && d.birth_date) || '').slice(0, 4);
    const place = normId(d && d.birth_place);
    if (!cert || !year || !place) return '';
    return [cert, year, place].join('|');
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

  /* Three numbers, and which of them is the year -- see the reading of a date in
     app.js. What is stored does not move: this still writes yyyy-mm-dd, so a date
     that comes back out of a field after somebody edited it lands in the database
     in the one shape the queue order and every equality query depend on.

     Four digits first is a year and the old order. Otherwise the day is first,
     always: the club writes 11/10/2026 and reads 11/10/2026, and anything else
     turns a date that comes out of a field into a different date going back in. */
  const DAY_FIRST_DATE = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/;
  const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
  const readDate = raw => {
    const year = ISO_DATE.exec(raw);
    if (year) return { y: year[1], m: year[2], d: year[3] };
    const day = DAY_FIRST_DATE.exec(raw);
    if (!day) return null;
    /* The one rescue that costs nothing: a first number that cannot be a day at
       all is read the only way it can be. It fires on nothing the club writes. */
    if (Number(day[1]) > 31) return { y: day[3], m: day[2], d: day[1] };
    return { y: day[3], m: day[2], d: day[1] };
  };
  const isoDate = v => {
    const raw = latinDigits(v).trim();
    const m = readDate(raw);
    if (!m) return raw;
    const month = Number(m.m), day = Number(m.d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
    const p = n => String(n).length < 2 ? '0' + n : String(n);
    return m.y + '-' + p(m.m) + '-' + p(day);
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

  /* The pool a request was aimed at, in the club's own spelling of it.
     Trimmed and otherwise untouched: a name is not something to reformat, and a
     number would be meaningless the moment a pool is inserted or reordered.

     Trimmed is not a formality. Two spellings of one pool are two pools when the
     committee counts who asked for where -- the same reason a card number is
     folded before it is compared, and the same failure if it is skipped. */
  const poolName = value => String((value && value.name) || value || '')
    .trim();

  const normaliseIncoming = body => {
    if (!body || typeof body !== 'object') return body;
    const out = { ...body };
    for (const key of Object.keys(out)) {
      if (typeof out[key] !== 'string') continue;
      if (DATE_FIELDS.has(key)) out[key] = isoDate(out[key]);
      else if (DIGIT_FIELDS.has(key)) out[key] = latinDigits(out[key]);
    }
    if ('selected_pool' in out) out.selected_pool = poolName(out.selected_pool);
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
    if (found) return { key, found };
    /* And under the name the child was first filed by, which is where the requests
       already on the books are. */
    const legacy = legacyMinorKeyOf(d);
    if (legacy && legacy !== key.key) {
      const older = await findByKey(field, legacy);
      if (older) return { key, found: older };
    }
    return null;
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
    /* Two ways of not knowing, and for a long time both of them looked exactly
       like an answer.

       A read that fails, and a read that comes back short. Either way the list
       looks smaller than the truth, the highest number in it looks like the
       highest number there is, and the next swimmer is handed a number somebody
       already has. Returning 1 for "I could not look" did not fail one
       registration -- it stamped the same identity number on every registration
       that arrived while the quota was out. The project spent that quota more than
       once, and this is what it produced: 139 requests carrying E202620001, and
       30 carrying E202630001, all of them children.

       So a count that was not a full count is not a count. Zero here is not
       "this pool has no swimmers"; it is "nobody can say", and the caller already
       knows that zero means the club assigns the number by hand, which is a
       visible gap somebody can fill rather than a number two children share. */
    let sawEverything = true;
    let list;
    let members = [];
    try { list = await rows('applications'); }
    catch (error) { console.warn('cannot read the requests to count registrations', error); list = []; sawEverything = false; }
    /* And from the members, because a request that has been accepted is a member
       now and its number is on the member's card. Counting from the requests
       alone means the number walks backwards the moment a record is lost, and the
       club hands the same number to two people. */
    try { members = await rows('swimmers'); }
    catch (error) { console.warn('cannot read the members to count registrations', error); sawEverything = false; }

    /* A read that stopped at the row limit is a read that did not finish. It comes
       back as a short list and says nothing about being short, so it is checked
       here rather than trusted: past a thousand requests the counter would
       otherwise walk backwards in plain sight and hand out live numbers. */
    if (list.length >= ROW_LIMIT || members.length >= ROW_LIMIT) {
      console.warn('the roster is at the read limit; the number is left to the club'
        + ' rather than counted from a list that stopped short');
      return 0;
    }

    if (!sawEverything) return 0;

    let highest = 0;
    for (const r of list.concat(members)) {
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
    /* Counting the running numbers out of the records is not a lesser path: it
       reads them out of the very documents the numbering is defined over, so it
       produces the same next number and needs no permission at all. Used whenever
       a counter cannot be kept. */
    /* Counting the records is the real answer, but it is still a read, and a read
       can fail for reasons that have nothing to do with the person in front of the
       form. So it is guarded too, one level down.

       An empty number means the club assigns it from the request itself: a request
       that can be numbered later is a visible state somebody can fix, and a family
       told to come back is not one anybody can. */
    const fromRecords = async () => {
      try {
        const seq = await countedFromRecords(kind, year, pool);
        if (seq) return letter + year + String(pool) + String(seq).padStart(4, '0');
        /* Said out loud, because a blank number is a thing somebody has to notice
           and fill in, and a blank that arrives without a word is a blank that
           reaches a card. */
        console.warn('the number was left blank rather than guessed: the records could'
          + ' not be read whole, and a number two children share is worse than a gap');
        return '';
      } catch (error) {
        console.warn('the registration number could not be counted from the records;'
          + ' it will be assigned by the club', String((error && error.code) || error));
        return '';
      }
    };
    if (!await countersAvailable()) return fromRecords();
    const ref = db.collection('counters').doc('registration_' + year + '_' + pool);
    /* The transaction belongs to the database, not to the document: the compat
       build the site loads has no runTransaction on a reference, and calling it
       there fails every registration rather than one. */
    /* Writing, not reading -- and that is the whole bug. The probe above asks
       whether a counter can be *read*, which any signed-in account may do, while
       handing out a number means *writing* one, which only management may do. The
       registration form creates an account before it posts, so the probe always
       succeeded, the transaction was always taken, and every registration with an
       account was answered with a permission error. The one path that worked was
       the one nobody takes: registering while signed out.

       So the refusal is caught here, where it is one branch, and it marks the
       counter unavailable -- so the second person to register does not walk into
       the same wall, and every later one goes straight to counting the records. */
    try {
      const seq = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const next = (snap.exists ? Number(snap.data().value) || 0 : 0) + 1;
        tx.set(ref, { value: next, year, pool, kind: letter, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
        return next;
      });
      return letter + year + String(pool) + String(seq).padStart(4, '0');
    } catch (error) {
      /* Every failure of the counter falls back, and none of them fails the
         registration.

         This used to catch one failure -- permission denied -- and re-throw
         everything else, because permission denied was the failure that was there
         when it was written. So a project quota running out produced

             429  {"error":"Quota exceeded.","code":"resource-exhausted"}

         after nine seconds of retrying, for every registration, because the
         message does not contain the word "permission". Traced live, on the
         running site: that is exactly what a family was being shown.

         The test was the wrong question. The counter is not where the number comes
         from -- `fromRecords()` counts the records and produces the same one with
         no permission at all -- so a counter that cannot be reached is not a
         missing answer, it is a slower route to one that is already there.

         Permission, quota, an aborted transaction, a dropped connection, a rules
         change: all of them fall back. The code is logged because a person cannot
         act on it and somebody has to be able to. */
      markCountersUnavailable();
      console.warn('the registration counter was unavailable; the number was counted'
        + ' from the records instead', String((error && error.code) || error));
      return fromRecords();
    }
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
      /* ---------------- is the form open? ----------------
         One document, readable by anybody, because a visitor has to be able to be
         told the truth without signing in first. Nothing about the club is in it
         except whether the door is open and, when it is shut, why.

         This answer fails OPEN, and it is the only place that does. A visitor
         standing at a shut door must not be shown a form because a request
         failed: an empty form with a message is a form they can telephone about,
         and a form that is not there is a website they think is broken. They
         cannot fix either, but only one of them stops them writing their child
         out in longhand first.

         Where a registration is actually *filed* this is reversed, below. The two
         are different questions and they do not have the same safe answer. */
      if (path === '/api/registration' && method === 'GET') {
        const door = await readDoor_();
        /* Open on a reading that failed, and told to be so.
           This is the one answer that fails open, and it is the right way round:
           a family shown the form and then refused, with the reason and their
           typing kept, telephones the club and gets filed. A family shown a closed
           door we could not actually verify is told the season is full on the
           strength of a network error, and goes home.

           `readable` travels with it so nobody downstream has to guess: "open"
           here means open, or could not be told, and the page passes that on
           rather than turning it into a certainty it does not have. */
        return jsonResponse({
          open: door.read ? door.open : true,
          note: door.note,
          readable: door.read
        });
      }

      /* ---------------- the switch itself ---------------- */
      if (path === '/api/registration' && method === 'PUT') {
        const gate = await managerView('تغيير فتح التسجيل م\\u0648\\u062c\\u0648\\u0628 الناد\\u064a.');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (typeof body.open !== 'boolean') {
          return jsonResponse({ error: 'حدد قيمة صحيحة.' }, 400);
        }
        await db.collection('config').doc('registration').set({
          open: body.open,
          note: String(body.note || '').slice(0, 300),
          by: gate.profile.id,
          at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await db.collection('audit_logs').add({
          at: firebase.firestore.FieldValue.serverTimestamp(),
          action: body.open ? 'registration_opened' : 'registration_closed',
          by: gate.profile.id
        });
        return jsonResponse({ ok: true, open: body.open });
      }

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

      /* ---------------- the club's groups ----------------

         One document, so that the groups page and the swimmer form draw the same
         list. They used to draw two: the page's own `state.groups`, seeded in the
         browser and kept in localStorage, and the names actually written on the
         swimmers' records in the database. The two were compared by name, so a
         child whose record said `مبتدئ` had no card on the groups page -- the card
         is looked up by the group's name -- and the count beside every group was
         the count of a list that only existed on that machine.

         `readable` travels with the read for the same reason the registration door
         carries it: a read that failed is not an empty list. An empty list would be
         drawn as "the club has no groups", and the swimmer form would offer a
         dropdown with nothing in it -- a control that looks like it works and
         cannot. The page keeps the list it already had instead, and says nothing
         false about it. */
      if (path === '/api/groups' && method === 'GET') {
        const user = await currentUser();
        if (!user) return jsonResponse({ error: 'يرجى تسجيل الدخول' }, 401);
        try {
          const doc = await db.collection('config').doc('groups').get();
          const data = doc.exists ? (doc.data() || {}) : {};
          const stored = Array.isArray(data.groups) ? data.groups : null;
          return jsonResponse({
            groups: stored ? stored.map(g => ({
              id: String(g.id || ''), name: String(g.name || ''),
              coach: String(g.coach || ''), schedule: String(g.schedule || '')
            })) : null,
            readable: true
          });
        } catch (e) {
          return jsonResponse({
            groups: null, readable: false,
            error: (e && e.message) || 'تعذّر قراءة قائمة الأفواج.'
          });
        }
      }
      if (path === '/api/groups' && method === 'PUT') {
        const gate = await managerView('تعديل الأفواج للمدير أو رئيس النادي فقط.');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const raw = Array.isArray(body.groups) ? body.groups : [];
        const seen = {};
        const list = [];
        for (const item of raw) {
          if (!item) continue;
          const name = String(item.name || '').trim().slice(0, 80);
          if (!name) continue;
          /* One group per name. Two cards with one name would be two counts of one
             group, and a swimmer could not say which of them they are in. Refused
             rather than quietly merged, so the page has to report something. */
          if (seen[name]) {
            return jsonResponse({ error: 'اسم الفوج "' + name + '" مكرّر. لكل فوج اسم واحد.' }, 400);
          }
          seen[name] = true;
          list.push({
            id: String(item.id || '').replace(/[^\w-]/g, '_') || ('grp-' + (list.length + 1)),
            name: name,
            coach: String(item.coach || '').slice(0, 120),
            schedule: String(item.schedule || '').slice(0, 120)
          });
        }
        await db.collection('config').doc('groups').set({
          groups: list,
          updated_by: gate.profile.id,
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await db.collection('audit_logs').add({
          action: 'groups_saved', entity_type: 'config', entity_id: 'groups',
          details: { count: list.length }, user_id: gate.profile.id,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        return jsonResponse({ ok: true, groups: list });
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
        if (!user) return jsonResponse({ error: 'يرجى تسجيل الدخول' }, 401);
        /* The rules have already answered this. A member's read returns the card
           they were given and each of their children's, because that is what the
           rules let through and nothing else; a member of staff reads the roster.

           It used to be filtered here as well, down to the one record whose number
           matched the account's own -- which was a belt to braces while the rules
           were shut, and cut off exactly what they have just let through: none of
           a parent's three children carries the parent's number, so a parent with
           three children received none of them.

           Nothing is decided in a browser, and nothing is written. */
        return jsonResponse(await rows('swimmers'));
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
        return jsonResponse(list.docs.filter(d => !(d.data() || {}).merged_into).map(d => {
          const f = d.data() || {};
          return {
            /* The roles beside the one the rules read, so a person who is both a
               swimmer and a parent is not shown as one of them. */
            roles: Array.isArray(f.roles) ? f.roles : (f.role ? [f.role] : []),
            id: d.id, name: f.name || '', email: f.email || '',
            role: f.role || 'member', owner: owners.indexOf(f.email) !== -1,
            joined: f.created_at && f.created_at.toDate ? f.created_at.toDate().toISOString().slice(0, 10) : ''
          };
        }));
      }
      /* ---------------- the accounts that are one person ----------------

         Four links, and the fourth is the one the club actually needed.

         The same chosen user name; the same national identity number; the same
         name with the same day of birth -- two accounts made out of one form. And
         then the one the accounts do not carry between themselves at all: the
         guardian's card number. A father's own account holds it as his identity
         number, and each of his children's requests holds it as the guardian's. So
         the accounts of one family are found through the card that says whose
         children they are, and a father who is himself a swimmer comes out in the
         same group as the guardian account his children were filed under -- which
         is the case no amount of comparing accounts with each other would find.

         Each group is reported with the reason on the row, because "duplicate" on
         its own says nothing about which two of five accounts are the same person.
         The oldest is offered as the one to keep: it is the one that has been in
         use longest, and which one was the mistake is the manager's answer. */
      if (path === '/api/accounts/duplicates' && method === 'GET') {
        const gate = await managerView('فحص الحسابات المكررة متاح للمدير أو رئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const list = await db.collection('users').get();
        const owners = await ownerAddresses();
        const seen = new Map();
        const accounts = new Map();
        for (const d of list.docs) {
          const f = d.data() || {};
          const when = f.created_at && f.created_at.toDate ? f.created_at.toDate().getTime() : 0;
          /* A merged account is not a separate person any more. It is still on
             file -- that is the point -- but it is not offered to be merged again,
             and it does not appear in the club's list of people. */
          if (f.merged_into) continue;
          accounts.set(d.id, f);
          seen.set('uid:' + d.id, [{
            id: d.id, name: f.name || '', email: f.email || '',
            username: f.username || '', role: f.role || 'member',
            owner: owners.indexOf(f.email) !== -1, when,
            requests: 0, swimmers: 0
          }]);
        }
        const put = (kind, value, uid) => {
          const key = kind + ':' + normId(value);
          if (key.endsWith(':') || !accounts.has(uid)) return;
          const group = seen.get(key) || [];
          if (group.some(a => a.id === uid)) return;
          group.push(Object.assign({}, seen.get('uid:' + uid)[0]));
          seen.set(key, group);
        };
        /* What the person holds, so a group can be read before it is acted on. */
        const apps = await db.collection('applications').get();
        const sw = await db.collection('swimmers').get();
        const appOf = apps.docs.map(d => ({ id: d.id, f: d.data() || {} }));
        const swOf = sw.docs.map(d => ({ id: d.id, f: d.data() || {} }));
        for (const uid of accounts.keys()) {
          const mine = seen.get('uid:' + uid)[0];
          mine.requests = appOf.filter(a => String(a.f.applicant_uid || '') === uid).length;
          mine.swimmers = swOf.filter(x => String(x.f.applicant_uid || '') === uid).length;
        }
        /* What each account says about itself. The same number is put in two
           groups -- as an identity number and as the guardian's card -- because a
           person is found by the number whoever writes it on, and the father holds
           it as his own while his children's requests hold it as the guardian's.
           One number, two places it is written, one group. */
        for (const uid of accounts.keys()) {
          const f = accounts.get(uid);
          put('user name', f.username, uid);
          put('identity number', f.national_id, uid);
          put('guardian card', f.national_id, uid);
          if (f.name && f.birth_date) put('name and day of birth', f.name + '|' + f.birth_date, uid);
        }
        /* And now the other end of it: a request filed by somebody names the card
           of the person the child belongs to, and that card is the father's. So a
           family whose father files nothing at all is still found -- which is the
           usual case, since the father is the swimmer and the children are the
           applicants. */
        for (const a of appOf) {
          const uid = String(a.f.applicant_uid || '');
          if (!uid || !accounts.has(uid)) continue;
          put('guardian card', a.f.guardian_national_id, uid);
        }

        const groups = [];
        const done = new Set();
        for (const [key, members] of seen) {
          if (key.startsWith('uid:') || members.length < 2) continue;
          const ids = members.map(a => a.id).sort().join(',');
          if (done.has(ids)) continue;
          done.add(ids);
          members.sort((a, b) => a.when - b.when);
          groups.push({
            reason: key.split(':')[0],
            by: key.slice(key.indexOf(':') + 1),
            keep: members[0].id,
            accounts: members
          });
        }
        const merged = list.docs.filter(d => (d.data() || {}).merged_into)
          .map(d => {
            const f = d.data() || {};
            return { id: d.id, name: f.name || '', email: f.email || '', into: f.merged_into };
          });
        return jsonResponse({ groups: groups, merged: merged, checked: accounts.size });
      }

      /* The merge itself. One account survives; the others are marked as having
         become it, and everything that belonged to them is re-pointed so nothing
         is lost with them.

         The survivor's own role is not touched. Merging must not make anybody a
         manager, and the other role is written down beside it rather than instead
         of it -- a father who is a swimmer and the parent of three minors is both,
         and whichever of the two accounts happened to come first should not decide
         which of those he is. */
      if (path === '/api/accounts/merge' && method === 'POST') {
        const gate = await managerView('دمج الحسابات متاح للمدير أو رئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const keep = String(body.keep || '');
        const remove = (Array.isArray(body.remove) ? body.remove : []).map(String).filter(Boolean);
        if (!keep) return jsonResponse({ error: 'الحساب الذي يُبقى عليه مطلوب' }, 400);
        if (!remove.length) return jsonResponse({ error: 'لم يُحدَّد حساب لدمجه' }, 400);
        if (remove.indexOf(keep) !== -1) return jsonResponse({ error: 'لا يُدمج الحساب في نفسه' }, 400);

        const owners = await ownerAddresses();
        const keepSnap = await db.collection('users').doc(keep).get();
        if (!keepSnap.exists) return jsonResponse({ error: 'الحساب الذي يُبقى عليه غير موجود' }, 404);
        const keepData = keepSnap.data() || {};

        const moved = { requests: 0, swimmers: 0, accounts: [], roles: [] };
        const roles = [keepData.role || 'member'].concat(Array.isArray(keepData.roles) ? keepData.roles : []);

        for (const uid of remove) {
          if (String(gate.profile.id) === uid) {
            return jsonResponse({ error: 'لا يمكنك دمج حسابك أنت — لا يبقى أحد يدخل.' }, 400);
          }
          const snap = await db.collection('users').doc(uid).get();
          if (!snap.exists) continue;
          const f = snap.data() || {};
          if (owners.indexOf(f.email) !== -1) {
            return jsonResponse({ error: 'حساب صاحب النادي لا يُدمج من هنا.' }, 400);
          }
          if (f.merged_into) {
            return jsonResponse({ error: 'هذا الحساب مُدمج من قبل في ' + String(f.merged_into) + '.' }, 400);
          }
          if (Array.isArray(f.roles)) roles.push(...f.roles);
          else if (f.role) roles.push(f.role);

          /* What the person did moves with them: their requests and, if they are a
             swimmer, the card they were given. A request that stayed behind would
             be a request the family can no longer follow, which is the thing the
             merge is for. */
          const apps = await db.collection('applications').where('applicant_uid', '==', uid).get();
          for (const d of apps.docs) {
            await d.ref.set({ applicant_uid: keep }, { merge: true });
            moved.requests++;
          }
          const cards = await db.collection('swimmers').where('applicant_uid', '==', uid).get();
          for (const d of cards.docs) {
            await d.ref.set({ applicant_uid: keep }, { merge: true });
            moved.swimmers++;
          }
          /* The profile is not thrown away: it is marked. A person who signs in
             with that address is told what happened and which account to use,
             rather than landing on a page that says nothing. */
          await snap.ref.set({
            merged_into: keep,
            merged_at: firebase.firestore.FieldValue.serverTimestamp(),
            merged_name: keepData.name || keepData.email || ''
          }, { merge: true });
          moved.accounts.push({ id: uid, name: f.name || f.email || uid });
        }

        const uniqueRoles = roles.filter((r, i, all) => all.indexOf(r) === i);
        await keepSnap.ref.set({ roles: uniqueRoles }, { merge: true });
        moved.roles = uniqueRoles;
        return jsonResponse({ ok: true, keep: keep, moved: moved });
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
          group_id: body.group_id || '',
          phone: body.phone || '', status: body.status === 'نشط' ? 'active' : (body.status || 'active')
        });
        return jsonResponse({ ok: true, id: ref.id }, 201);
      }
      if (path === '/api/swimmers' && method === 'PUT') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف السباح مطلوب' }, 400);
        body = normaliseIncoming(body);

        /* What a manager may change about a member, and nothing else.

           Four fields used to be accepted and the rest dropped without a word, so
           an edit form could be filled in completely and three quarters of it
           would vanish on saving -- which reads as the platform losing the data
           rather than as the platform refusing it.

           Only the keys actually sent are written. A form that leaves the blood
           group alone must leave it alone on the record: `merge` keeps fields it
           is not given, and the old code wrote `name: body.name || ''`, so simply
           not sending a name -- because the person was changing a telephone
           number -- erased the name. */
        const EDITABLE = {
          name: 'name', first_name_ar: 'first_name_ar', last_name_ar: 'last_name_ar',
          birth_date: 'birth_date', gender: 'gender', blood_group: 'blood_group',
          level: 'level', facility: 'facility', group_name: 'group_name', group_id: 'group_id',
          phone: 'phone', whatsapp: 'whatsapp', national_id: 'national_id',
          address: 'address', email: 'email', photo: 'photo'
        };
        const write = {};
        for (const [key, field] of Object.entries(EDITABLE)) {
          if (!(key in body)) continue;
          if (key === 'status') continue;
          write[field] = String(body[key] === null || body[key] === undefined ? '' : body[key]).trim();
        }
        if ('status' in body) {
          write.status = body.status === 'موقوف' || body.status === 'suspended'
            ? 'suspended'
            : (body.status === 'active' || body.status === 'نشط' ? 'active' : String(body.status || 'active'));
        }
        /* A photograph is a quarter of a megabyte of text. One that is larger is
           refused by name rather than silently dropped, because a photograph that
           quietly does not save is the photograph a parent was told was saved. */
        if ('photo' in write) {
          if (write.photo && write.photo !== '' && !/^(data:image\/(jpeg|png|webp);base64,|https?:)/.test(write.photo)) {
            return jsonResponse({ error: 'الصورة يجب أن تكون صورة فعلًا (JPG أو PNG أو WebP).' }, 400);
          }
          if (write.photo && write.photo.length > 5 * 1024 * 1024) {
            return jsonResponse({ error: 'الصورة كبيرة جدًا. الحد الأقصى 3 ميغابايت.' }, 400);
          }
        }
        if (!Object.keys(write).length) return jsonResponse({ error: 'لا يوجد ما يُحفظ.' }, 400);

        const existing = (await db.collection('swimmers').doc(String(body.id)).get()).data() || {};
        await db.collection('swimmers').doc(String(body.id)).set(write, { merge: true });

        /* The guardian is not on the member. They came in on the request, and they
           live there, with the relationship and the telephone they were reached
           on. So an edit to the guardian is written back to the request it came
           from -- the same place it was read from, and not a second copy of a
           person that would then disagree with the first. */
        const GUARDIAN = {
          guardian_first_name: 'guardian_first_name',
          guardian_last_name: 'guardian_last_name',
          guardian_relation: 'guardian_relation',
          guardian_phone: 'guardian_phone',
          guardian_national_id: 'guardian_national_id',
          guardian_birth_date: 'guardian_birth_date',
          guardian_card_issued: 'guardian_card_issued'
        };
        const from = existing.from_application || '';
        let guardianWritten = 0;
        if (from) {
          const gWrite = {};
          for (const [key, field] of Object.entries(GUARDIAN)) {
            if (key in body) {
              gWrite[field] = String(body[key] === null || body[key] === undefined ? '' : body[key]).trim();
            }
          }
          if (Object.keys(gWrite).length) {
            gWrite.edited_at = firebase.firestore.FieldValue.serverTimestamp();
            gWrite.edited_by = 'the club';
            await db.collection('applications').doc(String(from)).set(gWrite, { merge: true });
            guardianWritten = Object.keys(gWrite).length - 2;
          }
        } else {
          for (const key of Object.keys(GUARDIAN)) {
            if (key in body) {
              return jsonResponse({
                error: 'هذا السباح لم يُسجَّل من طلب، فلا مكان لبيانات الولي فيه. '
                  + 'عدّله من الطلب نفسه.'
              }, 400);
            }
          }
        }

        return jsonResponse({ ok: true, fields: Object.keys(write).length, guardian_fields: guardianWritten });
      }
      if (path === '/api/swimmers' && method === 'DELETE') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف السباح مطلوب' }, 400);
        await db.collection('swimmers').doc(String(body.id)).delete();
        return jsonResponse({ ok: true });
      }


      /* ---------------- removing an account ---------------- */
      /* An account is a way in. It is not a child.

         Deleting one removes the club's record of that person and stamps the
         requests that belong to them, so nothing about them becomes anonymous and
         nothing about them becomes unreachable. It never touches `applications`
         or `swimmers`: a membership number that is printed on a card and read
         out at the pool does not cease to exist because a parent closed an
         account.

         And the refusals are the point of the endpoint. A button that can remove
         whoever is holding it gets pressed once by accident; an endpoint that can
         remove the owner ends the club's own management; one that deletes without
         a reason leaves a hole with nobody able to say what filled it. */
      if (path && method === 'DELETE' && /^\/api\/users\/[^/]+$/.test(path)) {
        const gate = await managerView('حذف حساب م��وجب مدير النادي أو رئيسه.');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);

        const uid = decodeURIComponent(path.replace('/api/users/', ''));
        if (!uid) return jsonResponse({ error: 'الحساب غير محدد.' }, 400);

        const me = auth.currentUser;
        if (me && uid === me.uid) {
          return jsonResponse({
            error: 'لا يمكنك حذف حسابك الذي تستخدمه الآن. احذفه من جهاز آخر أو من'
              + ' حساب الرئيسي للنادي.',
          }, 403);
        }

        let profile = {};
        try {
          const snap = await db.collection('users').doc(uid).get();
          profile = snap.exists ? snap.data() : {};
        } catch (error) {
          return jsonResponse({ error: 'تعذّرت قراءة الحساب: ' + ((error && error.message) || error) }, 500);
        }

        /* The owner cannot be removed, and the check has to be made on the address
           rather than on the account.

           `isOwner` needs an `email` and a verified session, and this endpoint is
           handed only a uid: the page cannot read the authentication record, which
           is the same rule that stops a password being changed from here. So the
           first version of this called `isOwner({ uid })`, and because that object
           has no address it answered "no" every time -- a guard that was never
           actually standing. A check caught it, which is the whole reason the check
           was written before the button was.

           The list itself is the same one `isOwner` reads, and the profile carries
           the address the account was made with. */
        const address = String(profile.email || '').trim().toLowerCase();
        if (!address) {
          /* Nothing in the club's own records says who this account is.

             That is exactly the owner's situation -- management rights held without
             a profile -- and it is also what an account made by mistake can look
             like from the outside. The page cannot read the authentication record,
             so it cannot tell those two apart.

             So it refuses. "Not deletable" for an account nobody can identify is
             the right answer twice over: it keeps the owner, and it makes a button
             that deletes things refuse rather than guess. */
          return jsonResponse({
            error: 'لا يوجد سجلّ لهذا الحساب في بيانات النادي، فلا يمكن التأكد من هويته.'
              + ' الحساب الذي لا يمكن تسمية صاحبه لا يُحذف من هنا.',
          }, 403);
        }

        let ownsThis = false;
        try {
          const owners = await ownerAddresses();
          ownsThis = (owners || []).map(x => String(x).trim().toLowerCase()).indexOf(address) !== -1;
        } catch (_) { /* an unreadable owner list must not become a permission */ }
        if (ownsThis) {
          return jsonResponse({ error: 'هذا حساب رئيس النادي. لا يمكن حذفه من هنا.' }, 403);
        }

        const reason = String((body && body.reason) || '').trim();
        if (!reason) {
          return jsonResponse({
            error: 'اكتب سبب الحذف. يُسجَّل في سجلّ النادي، ويساعد على معرفة'
              + ' ما كان يحدث قبله إن سُئل عنه لاحقًا.',
          }, 400);
        }

        /* The requests are stamped, not deleted. They are the club's record of a
           person who applied; removing the account does not unmake that. */
        let stamped = 0;
        let childrenKept = 0;
        try {
          const mine = await db.collection('applications')
            .where('applicant_uid', '==', uid).get();
          for (const doc of mine.docs) {
            await doc.ref.set({
              account_removed_at: firebase.firestore.FieldValue.serverTimestamp(),
              account_removed_by: gate.profile.id,
              account_removed_reason: reason
            }, { merge: true });
            stamped++;
          }
        } catch (error) {
          console.warn('the requests could not be stamped before the account was removed', error);
        }

        /* Whether a child of this account is on the books. Reported, not touched. */
        try {
          const reg = String(profile.registration_id || '').trim();
          if (reg) {
            const onBooks = await db.collection('swimmers')
              .where('registration_id', '==', reg).get();
            childrenKept = onBooks.size;
          }
        } catch (_) { /* the answer is worth having, not worth failing over */ }

        await db.collection('users').doc(uid).delete();

        try {
          await db.collection('audit_logs').add({
            at: firebase.firestore.FieldValue.serverTimestamp(),
            action: 'account_removed',
            by: gate.profile.id,
            target: uid,
            target_name: profile.name || '',
            target_email: profile.email || '',
            reason,
            requests_stamped: stamped,
            children_on_the_books: childrenKept
          });
        } catch (error) {
          console.warn('the removal happened but could not be written to the audit log', error);
        }

        return jsonResponse({
          ok: true,
          removed: { uid, name: profile.name || '', email: profile.email || '' },
          requests_stamped: stamped,
          children_kept: childrenKept,
          note: 'حُذف الحساب. الطلبات لم تُحذف، والأطفال المسجّلون لم يُمَسّوا.'
        });
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
      /* Same reasoning as the roster: the rules decide which marks this account may
         read -- its own swimmers' -- and filtering again here would only remove
         what was let through. A read, and only a read. */
      if (path === '/api/attendance' && method === 'GET') return jsonResponse(await rows('attendance'));
      if (path === '/api/attendance' && method === 'POST') {
        /* الحضور يكتبه المسير أو المدرب، بالاسم الذي قاله جدول الأدوار لا
           بما تقوله الشاشة. كان الشرط يذكر ثلاثة أدوار والمنصة تعرف أربعة:
           `manager` كان يمرّ من الشاشة ويرتدّ هنا، فيملأ المسير النموذج
           ويُخبر «من صلاحية المدرب أو الإدارة فقط» وهو إدارة. */
        const gate = await scannerView();
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const profile = gate.profile;
        const memberId = body.member_id || body.swimmer_id || '';
        if (!memberId) return jsonResponse({ error: 'يجب تحديد السباح' }, 400);
        /* The session, asked for, and the moment of writing, which are not the
           same thing: a coach writes Sunday's sheet on Monday morning. */
        const session = attendanceSession(body.session_date);
        if (session.error) return jsonResponse({ error: session.error }, 400);
        const day = session.day;
        const status = body.status || 'present';
        /* من سجّل، بجانب ما سُجّل.

           الاسم والصفة يُكتبان في الوثيقة وقت الكتابة، لأن سؤال «من سجّل
           هذا الحضور؟» سؤال عن لحظة مضت. وحسابٌ يُقرأ لاحقًا يغيّر صلاحيته
           أو يُحذف، فيصبح السجل كله منسوبًا إلى من لم يمسح شيئًا. */
        const recorder = attendanceRecorder(profile);
        await db.collection('attendance').doc('att_' + day + '_' + String(memberId).replace(/[^\w-]/g, '_')).set({
          member_id: memberId, session_date: day, status,
          marked_by: profile.id,
          marked_by_name: recorder.name,
          marked_by_role: recorder.role,
          recorded_by_uid: recorder.uid,
          recorded_by_name: recorder.name,
          recorded_by_role: recorder.role,
          marked_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return jsonResponse({
          ok: true,
          message: 'تم تسجيل الحضور بنجاح',
          recorded_by: recorder
        }, 201);
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
        /* ---------------- the door, before anything else ----------------

           First, and not because it is the most important thing -- because
           everything after it writes. A registration that is refused after the
           number has been taken still burns the number, and a check that only
           looked at whether the record was written would call that a clean run.

           It fails closed, which the answer a visitor is given does not. See
           readDoor_ above: a form nobody can see is a website they think is
           broken and telephone the club about; a registration wrongly accepted is
           a child's record that then has to be taken back out again. */
        const door = await readDoor_();
        if (!door.read) {
          return jsonResponse({
            error: 'تعذّر تأكيد حالة التسجيلات الآن. لم يُرسل طلبك ولم يُكتب شيء،'
              + ' نرجو الاتصال بالنادي لتسجيله، أو المحاولة بعد قليل.',
            unreadable: true
          }, 503);
        }
        if (!door.open) {
          return jsonResponse({
            error: 'التسجيل مغلق حاليًا.' + (door.note ? ' ' + door.note : ''),
            closed: true
          }, 403);
        }
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

        /* ---------------- the door, and a request with nobody in it ----------------
           Both of these stand above the numbering, which is the thing they protect.
           A blank request refused *after* the number was taken still leaves the gap,
           and the check would have been green while it happened.

           The door itself was tested here, above everything, and the comment
           beneath used to claim that was so. It was not: the door stood between
           the record and the write, and the number had already been raised above
           it. It is tested before the first await now, where the comment says.

           The names are read from where the form puts them, per kind -- because a
           coach's request has no first name and no surname at all, and a rule
           written for swimmers refused three of the suite's own coach requests
           before it was read against the form it sits beside. */

        const named = (x) => String(x === undefined || x === null ? '' : x).trim() !== '';
        const askingAboutACoach = applicationType === 'coach';
        const incomplete = askingAboutACoach
          ? !(named(body.coach_name) && named(body.coach_phone))
          : !(named(body.first_name_ar) && named(body.last_name_ar)
               && named(body.phone) && named(body.birth_date));
        if (incomplete) {
          return jsonResponse({
            error: askingAboutACoach
              ? 'طلب المدرب ناقص: لا يمكن معرفة من هو. مطلوب الاسم ورقم الهاتف.'
              : 'الطلب ناقص: لا يمكن معرفة من هو. مطلوب الاسم واللقب ورقم الهاتف وتاريخ الميلاد.',
            blank: true
          }, 400);
        }

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
        /* Here the refusal really does mean "already on the books": the rules are
           what refuses it, and they refuse it for exactly that reason. */
        const filed = await writeOnce(docId, record);
        if (!filed.ok) {
          if (filed.taken) {
            return jsonResponse({ error: DUPLICATE_MESSAGE, duplicate: true }, 409);
          }
          /* A failure that is ours must not be dressed as a person already on the
             books -- the person would be told to go and register again, which is
             not the thing that happened. */
          return jsonResponse({
            error: 'تعذّر حفظ طلبك الآن بسبب خطأ في النظام. لم يُكتب شيء. '
              + 'أعد المحاولة بعد قليل، وإن استمر الأمر اتصل بإدارة النادي.',
            duplicate: false, filed: false, code: filed.code
          }, 503);
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
          /* Two different failures, two different answers.

             A name that is genuinely taken is answered by picking another, and the
             person is told so. A name we could not hold is answered by calling the
             club -- and saying "that name is taken" there would send somebody to
             choose again when the request behind it was already filed and the
             problem is on our side of the line.

             Both say plainly that the request is on file. The one that does not is
             the one that leaves a family believing they have to start again. */
          if (!held.ok) {
            const taken = held.taken;
            return jsonResponse({
              error: taken
                ? 'طلبك مسجّل، لكن اسم المستخدم «' + username + '» مستعمل من قبل. '
                  + 'اختر اسمًا آخر وأعد الإرسال، أو سيتصل بك إدارة النادي لترتيبه.'
                : 'طلبك مسجّل، وتعذّر حجز اسم المستخدم الآن بسبب خطأ في النظام. '
                  + 'اسمك المحفوظ كما هو، وسيتصل بك إدارة النادي لترتيبه.',
              duplicate: taken, field: 'username', filed: true, code: held.code
            }, taken ? 409 : 503);
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

        /* Who reviewed, and when it was decided -- written only when the request
           becomes a decision.

           They used to go on every write, because the merge below carried them:
           uploading the signed form marked a request as reviewed, and so did
           changing a subscription and so did recording a payment. A request nobody
           had decided on carried a reviewer's name, on a queue built out of that
           column.

           It is one line in the middle of a merge, which is why it survived: nobody
           reads it and nothing fails. The person who notices is the one looking at
           last week's requests and asking who reviewed them.

           `decided_at` moves with it rather than being left behind. It was written
           to the *account* on accept and on reject and never to the request, so a
           decided request carried no date on itself; the account keeps its own
           copy, which is the one the applicant reads at sign-in.

           Nothing on file is touched. This changes what future writes put in the
           column; it reads nothing and repairs nothing. */
        const isDecision = patch.status === 'approved' || patch.status === 'rejected';
        delete patch.reviewed_by;
        delete patch.decided_at;
        const review = isDecision
          ? {
            reviewed_by: gate.profile.id,
            decided_at: firebase.firestore.FieldValue.serverTimestamp()
          }
          : {};
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
        await db.collection('applications').doc(appMatch[1]).set(
          { ...patch, ...review, updated_at: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true });

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
              /* The photograph travels with the member. It was collected, it is
                 printed on the registration form, and it stopped here -- so the
                 membership card printed a name and a number, and the one thing
                 that cannot be handed over by somebody else was the one thing the
                 card did not carry. */
              photo: src.photo || src.photo_url || src.photoDataUrl || '',
              status: 'active', from_application: no,
              /* Whose account this came from. Beside `from_application`, which
                 says the request; this says the door it was filed through, and it
                 is what lets a family's members be found from the one account at
                 the centre of them -- and moved when that account is merged. */
              applicant_uid: src.applicant_uid || '',
              created_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
          /* The account the applicant created on the way here is now let in, and
             carries the number they were given. Without this the member would be
             a swimmer at the pool and somebody whose request still reads "under
             study" at their own front door. */
          /* The request names the member it became, and the requests page reads
             that name to keep a decided request out of the queue. It is written
             here, where the member is written, so the two cannot come apart: a
             member with no request pointing at it, or a request pointing at no
             member, is the state this arrangement exists to prevent.

             The document stays. It is the record of what was decided, when, and by
             whom -- and the registration numbers are counted out of these very
             documents, so removing one would hand its number to the next swimmer. */
          await db.collection('applications').doc(no).set({
            transferred_to: no,
            transferred_at: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

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
          /* A request that had been accepted and is now refused was this person,
             not a new applicant: the mark is taken off and the swimmer is removed,
             because leaving a member in the list who has been refused is how a
             club ends up with a card for somebody it never took. */
          if (stored.transferred_to) {
            await db.collection('swimmers').doc(stored.transferred_to).delete().catch(() => {});
            await db.collection('applications').doc(appMatch[1]).set({
              transferred_to: firebase.firestore.FieldValue.delete(),
              transferred_at: firebase.firestore.FieldValue.delete()
            }, { merge: true });
          }
          const why = String(patch.rejection_reason || stored.rejection_reason || '').trim();
          if (!why) {
            return jsonResponse({ error: 'اكتب سبب الرفض قبل رفض الطلب —Applicantd يقرأه عند محاولته الدخول.' }, 400);
          }
          /* The refusal belongs to this request. It goes onto the account only
             when no other request for that account was accepted -- which is the
             only case in which closing the account is what refusing means.

             Refusing a duplicate is exactly what a manager means to do, and the
             word they type for it is the one this whole arrangement turns on. So
             the refusal is not blocked; what must not happen is the person
             losing the door their earlier request opened. */
          const accountStaysOpen = await accountAcceptedElsewhere(stored.applicant_uid, appMatch[1]);
          if (stored.applicant_uid && !accountStaysOpen) {
            await db.collection('users').doc(stored.applicant_uid).set({
              request_status: 'rejected',
              rejection_reason: why,
              decided_at: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
          return jsonResponse({
            ok: true,
            expected_amount: patch.expected_amount,
            /* Said, not done quietly: somebody must be able to see that the
               decision was taken and what it did. */
            account_left_open: accountStaysOpen
          });
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