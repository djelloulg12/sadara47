/* The server: the first thing in this project that can reach an authentication
 * record, and the first thing that has to say who may.
 *
 * What is here, and nothing else
 * ------------------------------
 * Two operations, both of which the page proved impossible, and neither of which
 * is a convenience:
 *
 *   set a member's password     `updatePassword` acts on the *current* user only.
 *                               Firebase asks for that person's own password first,
 *                               precisely so that a borrowed session cannot quietly
 *                               take an account over. Changing somebody else's needs
 *                               administrator credentials, which is what this is.
 *
 *   remove an account           the authentication record itself, not the profile
 *                               the page can already delete. Once this exists, a
 *                               mistake can reach past the club's data and into the
 *                               thing that owns it -- so it is refused rather than
 *                               retried, and every refusal says which rule stopped it.
 *
 * What is deliberately not here
 * -----------------------------
 * Anything that touches `applications` or `swimmers`. A child on the register is
 * not an account, and no account action may reach one. The page stamps those
 * requests before it asks for anything here, so the club's record survives the
 * removal of the person's way in.
 *
 * How permission is decided
 * -------------------------
 * From the caller's verified token and the club's own records -- never from
 * anything in the request body. A page can be told what to believe by whoever is
 * holding it. A verified token cannot.
 *
 * That is the whole reason this is a server and not another button.
 *
 * What it needs before it will run
 * ---------------------------------
 * The Blaze plan. Cloud Functions are not available on Spark, and this is not
 * something to work around: a deployment that fails halfway through leaving a
 * route pointing at nothing is worse than no deployment at all.
 */

'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const G = require('./guards');

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

if (!admin.apps.length) admin.initializeApp();

const db = () => admin.firestore();

function json(res, status, body) {
  res.status(status).set({ 'content-type': 'application/json; charset=utf-8' });
  res.send(JSON.stringify(body));
}

/* The one place a credential is read, and the one place it is checked.
 *
 * Everything after this line trusts the answer: the uid, the address, and whether
 * the address has been verified. A token that will not verify ends the request
 * here rather than three refusals later. */
async function whoIsAsking(req, res) {
  const header = String(req.get('authorization') || req.get('Authorization') || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    json(res, 401, { error: 'يلزم تسجيل الدخول.' });
    return null;
  }
  let claims;
  try {
    claims = await admin.auth().verifyIdToken(token);
  } catch (error) {
    json(res, 401, { error: 'الجلسة غير صالحة. سجّل الدخول من جديد.' });
    return null;
  }

  let owners = [];
  try {
    const snap = await db().collection('config').doc('owners').get();
    if (snap.exists && Array.isArray(snap.data().emails)) owners = snap.data().emails;
  } catch (_) { /* an unreadable list must not become a permission */ }

  let profile = {};
  try {
    const snap = await db().collection('users').doc(claims.uid).get();
    profile = snap.exists ? snap.data() : {};
  } catch (_) { /* the owner has no profile, and that is expected */ }

  return G.callerOf(claims, profile, owners);
}

function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (_) { return {}; } }
  return b;
}

async function audit(entry) {
  try {
    await db().collection('audit_logs').add(Object.assign({ at: admin.firestore.FieldValue.serverTimestamp() }, entry));
  } catch (error) {
    // The action already happened; failing here would report a refusal that did not
    // happen, which is the one thing worse than a missing log line.
    console.error('the action happened and could not be written to the audit log', error);
  }
}

/* ---------------------------------------------------------------- password */

exports.setMemberPassword = onRequest(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'طريقة غير مسموحة.' });

  const caller = await whoIsAsking(req, res);
  if (!caller) return;

  const body = readBody(req);
  const verdict = G.judgePassword(caller, { email: body.email, reason: body.reason });
  if (!verdict.allow) return json(res, verdict.status, { error: verdict.error });

  const password = String(body.password || '');
  if (password.length < 10) {
    return json(res, 400, { error: 'كلمة المرور يجب أن تكون عشرة محارف على الأقل.' });
  }

  let user;
  try {
    user = await admin.auth().getUserByEmail(verdict.email);
  } catch (_) {
    return json(res, 404, { error: 'لا يوجد حساب بهذا البريد.' });
  }

  if (caller.uid && user.uid === caller.uid) {
    return json(res, 403, { error: 'لا يمكنك تغيير كلمة مرور حسابك من هنا.' });
  }

  await admin.auth().updateUser(user.uid, { password });

  /* Set only when the caller asked: the club's plan is that these are the standing
     passwords, so a flag saying "must change this" would quietly cancel it. */
  if (body.must_change === true) {
    await admin.auth().setCustomUserClaims(user.uid, Object.assign(
      {}, user.customClaims || {}, {
        must_change_password: true,
        password_set_by: 'club',
        password_set_at: new Date().toISOString()
      }));
  }

  await audit({ action: 'password_set', by: caller.uid, target: user.uid,
                target_email: verdict.email, reason: verdict.reason });

  json(res, 200, { ok: true, email: verdict.email,
                   note: 'تغيّرت كلمة المرور. لا تُكتب في أي ملف.' });
});

/* ------------------------------------------------------------- remove account */

exports.removeAccount = onRequest(async (req, res) => {
  if (req.method !== 'DELETE') return json(res, 405, { error: 'طريقة غير مسموحة.' });

  const caller = await whoIsAsking(req, res);
  if (!caller) return;

  const body = readBody(req);

  let owners = [];
  try {
    const snap = await db().collection('config').doc('owners').get();
    if (snap.exists && Array.isArray(snap.data().emails)) owners = snap.data().emails;
  } catch (_) { /* an unreadable list must not become a permission */ }

  /* The club's own record of the person, so the owner can be recognised even though
     they hold no profile document at all. */
  let target = { uid: body.uid || '', email: '', reason: body.reason };
  if (target.uid) {
    try {
      const snap = await db().collection('users').doc(target.uid).get();
      if (snap.exists && snap.data()) target = Object.assign(target, snap.data());
    } catch (_) { /* judged below, on the absence of an identity */ }
  }

  const verdict = G.judgeRemoval(caller, target, owners);
  if (!verdict.allow) return json(res, verdict.status, { error: verdict.error });

  let authUser;
  try {
    authUser = await admin.auth().getUser(verdict.uid);
  } catch (_) {
    return json(res, 404, { error: 'لا يوجد حساب مصادقة بهذا المعرّف.' });
  }

  await admin.auth().deleteUser(authUser.uid);
  await db().collection('users').doc(verdict.uid).delete().catch(() => { /* already gone */ });

  await audit({ action: 'account_removed', by: caller.uid, target: verdict.uid,
                target_email: verdict.email, reason: verdict.reason });

  json(res, 200, {
    ok: true,
    removed: { uid: verdict.uid, email: verdict.email },
    note: 'حُذف الحساب وسجلّه. الطلبات لم تُحذف، والأطفال المسجّلون لم يُمَسّوا.'
  });
});

/* --------------------------------------------------------------------- health */

exports.health = onRequest(async (req, res) => {
  const caller = await whoIsAsking(req, res);
  if (!caller) return;
  let owners = 0;
  try {
    const snap = await db().collection('config').doc('owners').get();
    if (snap.exists && Array.isArray(snap.data().emails)) owners = snap.data().emails.length;
  } catch (_) { /* reported as zero rather than as a failure */ }
  json(res, 200, { ok: true, role: caller.role, owner: caller.owner, owners });
});