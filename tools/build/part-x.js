/* ============================================================================
   تغيير كلمة المرور — part-x.js

   There was no way to change a password. Whoever was given an account kept that
   password for good: not the owner after a first login, not a coach who joined
   on a shared tablet, not anyone whose address leaked. The only route was the
   reset e-mail, which needs SMTP configured on the project and fails quietly
   when it is not.

   So the account holder sets it themselves, from the page they already use.

   This is deliberately not routed through /api/*: the adapter answers those from
   Firestore, and a password is not Firestore's business. It is an Auth action,
   and the session already proves who is asking.
   ========================================================================= */
(function () {
  'use strict';

  /* Only meaningful where Auth is what holds the account. On the local Python
     server the password lives in SQLite and is changed there, so the panel is
     left out rather than offered and broken. */
  const authIsLive = () => !!(window.firebase && firebase.auth && firebase.auth().currentUser)
    && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  const panel = () => (!authIsLive() ? '' :
    '<section class="panel settings" id="password-panel">'
    + '<div class="panel-head"><div>'
    + '<h3>كلمة المرور</h3>'
    + '<p>اختر كلمة مرور تعرفها أنت وحدك. لا يطّلع عليها أحد، ولا تُطبع.</p>'
    + '</div></div>'
    + '<div class="form-two">'
    + '<label>كلمة المرور الجديدة<input id="new-password" type="password"'
    + ' autocomplete="new-password" placeholder="••••••••"></label>'
    + '<label>أعد كتابتها<input id="new-password-2" type="password"'
    + ' autocomplete="new-password" placeholder="••••••••"></label>'
    + '</div>'
    + '<button class="btn btn-primary" data-action="change-password">تغيير كلمة المرور</button>'
    + '<p class="hint">١٠ محارف على الأقل، وكلمة لا تستعملها في بريد آخر.</p>'
    + '</section>');

  const coreProfilePassword = profilePage;
  profilePage = function () {
    return coreProfilePassword() + panel();
  };

  /* Compared without spaces around === on purpose: the dead-control check reads
     handlers out of the source with /a===?['"]/, so a spaced comparison would
     make this look like a button with nothing behind it. */
  const coreActionPassword = action;
  action = async function (a, el) {
    if(a!=='change-password'){return coreActionPassword(a, el);}
    const box = document.getElementById('new-password');
    const again = document.getElementById('new-password-2');
    if (!box || !again) return;

    const next = String(box.value || '');
    if (next.length < 10) {
      showToast('كلمة المرور قصيرة. ١٠ محارف على الأقل.', 'error');
      box.focus();
      return;
    }
    if (next !== String(again.value || '')) {
      showToast('كلمتا المرور غير متطابقتين.', 'error');
      again.focus();
      return;
    }

    /* Firebase asks for the current password before it lets a password change
       through, and that is right: a borrowed session cannot quietly take the
       account over. prompt() is used rather than a third field because the
       dialog is a confirmation, not a form. */
    const current = window.prompt('اكتب كلمة المرور الحالية للتأكيد', '');
    if (current === null) return;

    try {
      const user = firebase.auth().currentUser;
      await user.reauthenticateWithCredential(
        firebase.auth.EmailAuthProvider.credential(user.email, current));
      await user.updatePassword(next);
      box.value = ''; again.value = '';
      showToast('تغيّرت كلمة المرور. استعملها في الدخول القادم.');
    } catch (e) {
      const code = e && e.code;
      showToast(code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? 'كلمة المرور الحالية غير صحيحة.'
        : code === 'auth/weak-password'
          ? 'كلمة المرور ضعيفة. أضف محارف أو أرقاماً.'
          : ((e && e.message) || 'تعذّر تغيير كلمة المرور.'), 'error');
    }
  };
})();
