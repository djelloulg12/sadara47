/* ============================================================================
   تغيير كلمة المرور وإلزامها — part-x.js

   There was no way to change a password. Whoever was given an account kept that
   password for good: not the owner after a first login, not a coach who joined
   on a shared tablet, not anyone whose address leaked. The only route was the
   reset e-mail, which needs SMTP configured on the project and fails quietly
   when it is not.

   So the account holder sets it themselves, from the page they already use.

   Two places can hold the account, and the panel must work in both:

     * Firebase Auth (the live platform). The password is an Auth matter, and
       the adapter answers /api/* from Firestore, so the change is an Auth
       action -- reauthenticate, then updatePassword.

     * The Neon server (the page served by tools/neon/server). There the
       adapter steps aside and /api/password answers directly, writing a scrypt
       hash in the database. The session already proves who is asking, and the
       route still demands the current password.

   And one more thing the manager asked for: when the manager sets a password
   for someone, that person must not be able to keep it. The account carries
   `must_change`, the login hands it to the page, and this layer will not let
   the page be used until the holder has chosen their own. The gate is a wall,
   not a reminder.
   ========================================================================= */
(function () {
  'use strict';

  /* هل الخادم الذي قدّم الصفحة يردّ على /api/* بنفسه؟ المحوّل يقف جانبًا حينها
     (SADARA_LOCAL_API=true)، وكلمة المرور تُغيَّر عبر المسار لا عبر Auth. */
  const apiIsMine = () => typeof window.SADARA_LOCAL_API === 'boolean'
    && window.SADARA_LOCAL_API === true;

  /* وهل Firebase Auth هو الذي يحمل الحساب؟ الحالتان لا تجتمعان. */
  const authIsLive = () => !!(!apiIsMine() && window.firebase && firebase.auth
    && firebase.auth().currentUser)
    && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  const canChangeHere = () => apiIsMine() || authIsLive();

  const panel = () => (!canChangeHere() ? '' :
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

  /* الحائط: نافذة لا تُغلق حتى يختار صاحب الحساب كلمته. لا زرّ إغلاق، ولا
     النقر على الخلفية يُغلقها -- الباب الذي يبقى مواربًا ليس بابًا.
     وهذا الحدّ لا يُفرض في Firebase: المنصة الحيّة تُدير كلمة المرور من
     Cloud Function وتضع علَمًا مختلفًا، فلا نُقحم هنا ما لا نملكه. */
  function mustChangeWall() {
    const shown = document.getElementById('must-change-wall');
    if (shown) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal-backdrop" id="must-change-wall" role="dialog" aria-modal="true"'
      + ' aria-label="تعيين كلمة المرور">'
      + '<div class="modal auth-modal">'
      + '<div class="modal-heading"><span class="logo">🔒</span>'
      + '<h2>عيّن كلمة مرورك</h2>'
      + '<p>وضع لك المسير كلمة مرور مؤقتة. اختر كلمة تعرفها أنت وحدك لتتابع.</p>'
      + '</div>'
      + '<label>كلمة المرور الجديدة<input id="wall-new" type="password"'
      + ' autocomplete="new-password" placeholder="••••••••"></label>'
      + '<label>أعد كتابتها<input id="wall-new-2" type="password"'
      + ' autocomplete="new-password" placeholder="••••••••"></label>'
      + '<button class="btn btn-primary" data-action="must-change-password">حفظ ومتابعة</button>'
      + '<p class="hint">١٠ محارف على الأقل.</p>'
      + '</div></div>');
    bind();
  }

  /* إرسال التغيير إلى الجهة التي تحمل الحساب. يُرجع رسالة الخطأ أو null. */
  async function submitPassword(current, next) {
    if (apiIsMine()) {
      const res = await fetch('/api/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ current, password: next })
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? null : (data.error || 'تعذّر تغيير كلمة المرور.');
    }
    const user = firebase.auth().currentUser;
    await user.reauthenticateWithCredential(
      firebase.auth.EmailAuthProvider.credential(user.email, current));
    await user.updatePassword(next);
    return null;
  }

  /* Compared without spaces around === on purpose: the dead-control check reads
     handlers out of the source with /a===?['"]/, so a spaced comparison would
     make this look like a button with nothing behind it. */
  const coreActionPassword = action;
  action = async function (a, el) {
    /* ---- تغيير كلمة المرور من صفحة الملف الشخصي ---- */
    if(a==='change-password'){
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
         account over. The Neon route asks for it too. prompt() is used rather
         than a third field because the dialog is a confirmation, not a form. */
      const current = window.prompt('اكتب كلمة المرور الحالية للتأكيد', '');
      if (current === null) return;

      try {
        const err = await submitPassword(current, next);
        if (err) { showToast(err, 'error'); return; }
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
      return;
    }

    /* ---- الحائط: كلمة المرور المؤقتة من المسير ---- */
    if(a==='must-change-password'){
      const box = document.getElementById('wall-new');
      const again = document.getElementById('wall-new-2');
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
      /* الحائط لا يسأل عن الكلمة المؤقتة: من وضعها للمسير يعرفها، والحساب
         نفسه هو صاحب الجلسة، والخادم يقبل التغيير ما دام `must_change`
         قائمًا (انظر تعليق `POST /api/password`). وما إن تُحفظ حتى يسقط
         العلَم. */
      try {
        const err = await submitPassword('', next);
        if (err) { showToast(err, 'error'); return; }
        if (state.user) state.user.must_change = false;
        save();
        const wall = document.getElementById('must-change-wall');
        if (wall) wall.remove();
        showToast('حُفظت كلمتك. مرحبًا بك.');
        render();
      } catch (e) {
        showToast((e && e.message) || 'تعذّر حفظ كلمة المرور.', 'error');
      }
      return;
    }

    return coreActionPassword(a, el);
  };

  /* بعد أن تُفتح الصفحة: إن كان الحساب يحمل كلمة مرور مؤقتة، نرفع الحائط.
     ولا نتركه في Firebase -- العلَم هناك اسمه `must_change_password` وتُديره
     الدالّة السحابية، فلا نُقحم الحائط على المنصة الحيّة. */
  const coreBootPassword = boot;
  boot = async function () {
    await coreBootPassword();
    if (apiIsMine() && state.user && state.user.must_change === true) mustChangeWall();
  };
})();
