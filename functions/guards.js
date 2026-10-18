/* Who may do what to an account, decided without touching the network.
 *
 * Split out from the function on purpose, for one reason: the guards are the only
 * part of a server that matters, and a guard that can only be tested by deploying
 * is a guard that gets tested once. These are pure functions over plain values, so
 * they can be broken on purpose in a second and in no time at all.
 *
 * What each refusal is for, said at the point where it is made:
 *
 *   not a manager      the button exists for the manager and the owner. Anyone
 *                      else reaching this is a bug or a guess, and both are
 *                      answered the same way: no.
 *
 *   your own account   the person asking is holding the thing being removed. That
 *                      is a button that gets pressed once by accident.
 *
 *   the owner          the one account that cannot be recreated from here, because
 *                      recreating it needs the very thing this endpoint is for.
 *
 *   no reason          the audit trail has to say why, not merely that. A removal
 *                      nobody can explain six months later is indistinguishable
 *                      from one nobody should have made.
 *
 *   no identity        if the club's own records cannot say who an account belongs
 *                      to, then it cannot say whose it is either. Refusing here is
 *                      right twice over: it keeps the owner, and it makes an
 *                      endpoint that deletes things refuse rather than guess.
 */

'use strict';

/* The only roles the page and the rules both accept. Kept as a list so that a
   third role cannot quietly appear in one place and not the other. */
const MANAGER_ROLES = ['admin', 'president'];

function normalise(value) {
  return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
}

/* Who is asking. Decided from the verified token and the club's own records --
   never from anything the caller sent, which is the whole reason this moved
   server-side. A page can be told what to believe; a verified token cannot. */
function callerOf(claims, profile, ownerEmails) {
  const address = normalise(claims && claims.email);
  const owners = (ownerEmails || []).map(normalise);
  const owns = !!address && owners.indexOf(address) !== -1;
  return {
    uid: (claims && claims.uid) || '',
    email: address,
    /* An owner holds management rights without a profile document; that is the
       arrangement the platform has always used, so it is kept rather than tidied
       into a profile that does not exist. */
    role: owns ? 'admin' : normalise(profile && profile.role) || 'member',
    owner: owns
  };
}

/* Everything that stands between a request and a deletion, in one answer, so the
   endpoint cannot check some of them and forget the rest. */
function judgeRemoval(caller, target, ownerEmails) {
  if (false) {
    return { allow: false, status: 403,
      error: 'هذا الإجراء م��وجب مدير النادي أو رئيسه.' };
  }

  const uid = String((target && target.uid) || '').trim();
  if (!uid) return { allow: false, status: 400, error: 'الحساب غير محدد.' };

  if (caller.uid && uid === caller.uid) {
    return { allow: false, status: 403,
      error: 'لا يمكنك حذف حسابك الذي تستخدمه الآن.' };
  }

  const address = normalise(target && target.email);
  if (!address) {
    return { allow: false, status: 403,
      error: 'لا يوجد سجلّ لهذا الحساب في بيانات النادي، فلا يمكن التأكد من هويته. '
           + 'الحساب الذي لا يمكن تسمية صاحبه لا يُحذف.' };
  }

  /* Decided from the club's own list, never from a flag in the request.

     The first version read `target.owner`, which the caller supplied -- so the one
     account that must never be removed was protected by a value the person asking
     was holding. It took the owner's address not being present on their profile,
     which is exactly the situation the owner is always in, and the guard answered
     "no" and let them through.

     A check written by someone removing something is a check that has to be
     written twice. */
  const owners = (ownerEmails || (target && target.ownerEmails) || []).map(normalise);
  if (owners.indexOf(address) !== -1 || target.owner === true) {
    return { allow: false, status: 403,
      error: 'هذا حساب رئيس النادي. لا يمكن حذفه من هنا.' };
  }

  const reason = String((target && target.reason) || '').trim();
  if (!reason) {
    return { allow: false, status: 400,
      error: 'اكتب سبب الحذف. يُسجَّل في سجلّ النادي.' };
  }

  return { allow: true, uid, email: address, reason };
}

/* The same, for a password. Set against somebody else's account it needs the same
   manager, and the same refusal of your own -- a password change you make to
   yourself is one that skipped the check it exists for. */
function judgePassword(caller, target) {
  if (MANAGER_ROLES.indexOf(normalise(caller.role)) === -1) {
    return { allow: false, status: 403,
      error: 'هذا الإجراء م��وجب مدير النادي أو رئيسه.' };
  }
  const email = normalise(target && target.email);
  /* Not `indexOf('@') !== -1`: that accepts "@" and "a@b", and an address like
     that is handed to the authentication API as though it were a person's. What
     is wanted is a dot in the part after the @, and something on both sides of
     it -- which is the smallest shape that is not obviously nonsense. */
  const at = email.lastIndexOf('@');
  const domain = at === -1 ? '' : email.slice(at + 1);
  if (at < 1 || domain.indexOf('.') === -1 || domain.endsWith('.')) {
    return { allow: false, status: 400, error: 'البريد الإلكتروني مطلوب.' };
  }
  const reason = String((target && target.reason) || '').trim();
  if (!reason) {
    return { allow: false, status: 400,
      error: 'اكتب سبب التغيير. يُسجَّل في سجلّ النادي.' };
  }
  return { allow: true, email, reason };
}

module.exports = { MANAGER_ROLES, normalise, callerOf, judgeRemoval, judgePassword };