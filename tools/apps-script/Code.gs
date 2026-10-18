/* One-time access codes -- the club's own server, on Google's account, for nothing.

   Why this file exists
   --------------------
   Giving a family their own password back needs somebody who is allowed to change
   a password on an account they are not signed in to. That somebody is a server.
   The browser cannot do it, no matter how it is written, and pretending otherwise
   is how a password ends up in a chat group.

   Cloud Functions would be the obvious place and it costs money. This costs
   nothing: Apps Script runs inside the owner's own Google account, and the account
   already exists. Two scopes are granted, once, by one click on Google's own
   consent screen. There is no card anywhere in this, and none is needed.

   The flow, end to end
   --------------------
     1. the manager runs  tools\mint-access-code.js  and reads the code out
     2. the member types the code and chooses a password on the page
     3. the page posts {code, password} here
     4. this checks the code, spends it, and sets that password
     5. the member is signed in as themselves, and can change it again any time

   What makes it safe
   ------------------
     * a code is spent by writing to it with a condition attached, so two telephone
       calls at the same moment cannot both win -- the second one is refused
     * an expired code is refused rather than cleaned up and left for next time
     * the password never travels anywhere but the member's own form to this file,
       and is never returned, never logged, never written down
     * a refused attempt is recorded with why, so a run of wrong codes is visible
     * staff are never refused: the owner uses the password they already have

   The setup, once, by hand
   ------------------------
     1. script.google.com -> New project
     2. paste this file and appsscript.json into it
     3. put the web API key in Project Settings -> Script Properties:
            FIREBASE_API_KEY
        (Firebase console -> Project settings -> Your apps -> Web API Key)
     4. Deploy -> New deployment -> Web app
            Execute as: Me
            Who has access: Anyone
     5. open the URL once and press "Authorize" -- Google's own screen, once
     6. paste the /exec URL into index.html as the code endpoint

   Nothing in steps 1 to 5 asks for a card, and none of it can be done from here:
   it is the owner's Google account and only the owner can open it. That is the
   one part of this project that cannot be finished by anybody else.
*/

const PROJECT_ID = 'sadara-platform-774c8';
const MIN_PASSWORD = 10;

/* A code said over the telephone is spoken aloud in a corridor. Anything below
   this is a child's name, a club's name, or a year -- all of them are guessable
   by somebody standing nearby, and all of them are the first things tried. */
const COMMON = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'sadara', 'club',
  'nadi', 'nadialsada', 's Swim', 'swim', 'swimmer', 'medabia'
];

function doGet() {
  return json_({
    service: 'sadara access codes',
    accepts: 'POST { code, password }',
    ready: !!PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY')
  });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (_) { return json_({ ok: false, error: 'طلب غير مفهوم' }, 400); }

  const code = fold(String(body.code || ''));
  const password = String(body.password || '');

  if (!code) return json_({ ok: false, error: 'أدخل الرمز' }, 400);
  const weak = whyWeak(password);
  if (weak) return json_({ ok: false, error: weak }, 400);

  const apiKey = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  if (!apiKey) {
    return json_({ ok: false, error: 'الخدمة غير مهيأة بعد. راجع الإدارة.' }, 503);
  }

  /* 1. the code, found by value rather than by document id -- which is what makes
        it short enough to say out loud. */
  const found = runQuery_(FILTER_EQ_('code', code), 'access_codes');
  if (!found.length) return refuse_('رمز غير معروف', code, null);

  const doc = found[0].fields;
  if (doc.used_at && doc.used_at.timestampValue) {
    return refuse_('انتهى هذا الرمز. اتصل بsecretariatsecretariat', code, doc);
  }
  const expires = doc.expires_at && doc.expires_at.timestampValue
    ? new Date(doc.expires_at.timestampValue).getTime() : 0;
  if (!expires || expires < Date.now()) {
    return refuse_('انتهت صلاحية الرمز. اطلب رمزًا جديدًا.', code, doc);
  }

  /* 2. spend it, atomically.

        This is the whole point. Between reading the code and writing it spent,
        another call can do the same thing. The transaction carries the moment the
        document was read, so if anything touched it in between -- including the
        other caller -- the database rejects this one. Without it the second caller
        gets a free password change on an account the first has already walked away
        from. */
  const docName = found[0].name;
  const readTime = found[0].readTime || found[0].createTime;
  if (!spendOnce_(docName, readTime)) {
    return refuse_('هذا الرمز استُعمل قبل قليل. اطلب رمزًا جديدًا.', code, doc);
  }

  /* 3. the password the member chose, on their own account. */
  const uid = doc.uid && doc.uid.stringValue;
  if (!uid) return refuse_('الرمز لا يحمل حسابًا. راجع الإدارة.', code, doc);

  const res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:update?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ localId: uid, password: password }),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() >= 300) {
    /* The code has already been spent, and the password was not set. This is the
       one failure worth undoing: leaving it spent means a family has read a code
       aloud, been refused, and cannot use it again. It is given back. */
    /* Given back, because the password was not set. */
    unpatch_(docName, 'used_at');
    return refuse_('تعذّر تغيير كلمة المرور. اتصل بالإدارة.', code, doc, res.getContentText());
  }

  /* 4. an entry saying a password was set, never saying what it was. */
  try {
    append_('access_log', {
      kind: 'access_code_used',
      at: stamp_(),
      uid: uid,
      email: (doc.email && doc.email.stringValue) || '',
      by_ip: (e && e.parameter && e.parameter.ip) || ''
    });
  } catch (_) { /* a missing entry in a log is not a reason to fail the family */ }

  return json_({ ok: true, email: (doc.email && doc.email.stringValue) || '' });
}

/* ---- refusals ------------------------------------------------------------ */

function refuse_(message, code, doc, detail) {
  /* Every refusal is on the record. Six wrong codes from three numbers is not
     somebody who forgot; it is somebody going through a list. */
  try {
    append_('access_log', {
      kind: 'access_code_refused',
      at: stamp_(),
      code_mask: mask_(code),
      why: message,
      uid: (doc && doc.uid && doc.uid.stringValue) || '',
      detail: String(detail || '').slice(0, 200)
    });
  } catch (_) { /* never let the record being kept stop the answer being given */ }
  return json_({ ok: false, error: message }, 403);
}

/* Enough to match a log against, not enough to use one. */
function mask_(code) {
  return String(code || '').slice(0, 2) + '***';
}

/* ---- what counts as a password ------------------------------------------ */

function whyWeak(p) {
  if (!p || p.length < MIN_PASSWORD) return 'كلمة المرور قصيرة جدًا (' + MIN_PASSWORD + ' أحرف على الأقل)';
  const low = p.toLowerCase();
  for (const w of COMMON) {
    if (low.indexOf(String(w).replace(/\s+/g, '')) !== -1 || low.indexOf(w) !== -1) {
      return 'كلمة المرور شائعة جدًا. اختر شيئًا لا يعرفه أحد غيرك.';
    }
  }
  if (/^(.)\1+$/.test(p)) return 'كلمة المرور كلها حرف واحد';
  var classes = 0;
  if (/[a-z]/.test(p)) classes++;
  if (/[A-Z]/.test(p)) classes++;
  if (/[0-9]/.test(p)) classes++;
  if (/[^A-Za-z0-9]/.test(p)) classes++;
  if (classes < 2) return 'امزج بين حروف وأرقام';
  return '';
}

/* ---- names are compared the way a person writes them ---------------------- */

function fold(v) {
  return String(v === undefined || v === null ? '' : v)
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

/* ---- Firestore over REST -------------------------------------------------
       The two calls the flow needs: find a document by a field, and write it only
       if it has not changed. Both are what make a one-time code actually one-time. */

function FILTER_EQ_(field, value) {
  return { fieldFilter: {
    field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value }
  }};
}

function firestore_(path, method, payload) {
  return UrlFetchApp.fetch(
    'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + path,
    {
      method: method,
      contentType: 'application/json',
      payload: payload ? JSON.stringify(payload) : undefined,
      muteHttpExceptions: true
    }
  );
}

function runQuery_(filter, collection, limit) {
  const q = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: filter
    }
  };
  if (limit) q.structuredQuery.limit = limit;

  const res = firestore_(':runQuery', 'post', q);
  if (res.getResponseCode() >= 300) throw new Error('firestore: ' + res.getContentText());

  const out = [];
  const lines = String(res.getContentText()).split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch (_) { continue; }
    if (row && row.document) out.push(row.document);
    if (limit && out.length >= limit) break;
  }
  return out;
}

/* The write that decides.

   `readTime` is the moment the document was read a moment ago, carried into the
   write. Firestore refuses the whole transaction if the document has been touched
   since that instant, so two telephone calls arriving together cannot both spend
   the same code -- the second is rejected by the database rather than by this
   file's good manners, which are worth nothing at that exact moment.

   Returns true only if the code was still unspent. */
function spendOnce_(name, readTime) {
  const body = {
    transaction: [
      { read: { name: name, readTime: readTime } },
      { update: {
          name: name,
          updateMask: { fieldPaths: ['used_at', 'used_from'] },
          fields: { used_at: stamp_() }
      } }
    ]
  };

  const res = firestore_(':runTransaction', 'post', body);
  return res.getResponseCode() < 300;
}

/* Gives a spent code back, when the password could not be set. The family has
   already read the code out loud; taking it away from them leaves them with
   nothing and a telephone call that got them nowhere. */
function unpatch_(name, field) {
  try {
    const body = {
      transaction: [
        { read: { name: name } },
        { update: { name: name, updateMask: { fieldPaths: [field] }, fields: { [field]: null } } }
      ]
    };
    firestore_(':runTransaction', 'post', body);
  } catch (_) { /* nothing further can be done for it from here */ }
}

function append_(collection, fields) {
  return firestore_(collection, 'post', { fields: fields });
}

function stamp_() { return { timestampValue: new Date().toISOString() }; }

function json_(obj, code) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}