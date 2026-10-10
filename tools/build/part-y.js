/* ============================================================================
   صلاحيات الحسابات — part-y.js

   Giving somebody a role meant running a script against the database. The rules
   already allowed a manager to read and change any account; nothing reached them
   from the page, so the club's president and coach could only be created from a
   terminal.

   This is that panel. It lists the accounts, shows what each one is, and lets a
   manager change it in place.

   Two refusals are the adapter's, not decoration, and they are repeated here so
   the page does not offer what the server will not accept:
     * your own row cannot be changed -- there is no second manager to undo it
     * a role the platform does not know is refused, because an account holding
       one can do nothing at all and would look broken rather than wrong
   ========================================================================= */
(function () {
  'use strict';

  const ROLES = [
    ['admin', 'مدير'], ['president', 'رئيس النادي'], ['coach', 'مدرب'],
    ['member', 'عضو'], ['parent', 'ولي'], ['swimmer_adult', 'سباح بالغ'],
    ['swimmer_minor', 'سباح صغير']
  ];
  const label = role => (ROLES.filter(r => r[0] === role)[0] || [role, role])[1];

  const panel = (list, me) => {
    if (!Array.isArray(list)) return '';
    const rows = list.map(a => {
      const mine = String(a.id) === String(me);
      const who = a.owner
        ? '<small class="owner-mark" title="صاحب كل الصلاحيات">★ المالك</small>' : '';
      const options = mine
        ? '<span class="role-fixed">' + esc(label(a.role)) + '</span>'
        : '<select data-role-for="' + esc(a.id) + '" aria-label="صلاحية ' + esc(a.name || a.email) + '">'
          + ROLES.map(r => '<option value="' + r[0] + '"'
            + (r[0] === a.role ? ' selected' : '') + '>' + r[1] + '</option>').join('')
          + '</select>';
      return '<div class="requirement-row account-row">'
        + '<div class="account-who"><b>' + esc(a.name || a.email || 'حساب') + '</b>'
        + '<span>' + esc(a.email || '') + who + '</span></div>'
        + options
        + '<button class="check-btn ok" data-action="save-account-role" data-id="'
        + esc(a.id) + '">حفظ</button>'
        + '</div>';
    }).join('');
    return '<section class="panel settings" id="accounts-panel">'
      + '<div class="panel-head"><div>'
      + '<h3>صلاحيات الحسابات</h3>'
      + '<p>من يستطيع الدخول، وما يستطيع أن يفعل. صفك لا يُغيَّر — '
      + 'استعمل حساباً آخر للتجريب.</p>'
      + '</div><button class="btn btn-outline" data-action="reload-accounts">تحديث</button></div>'
      + '<div id="accounts-list">' + (rows || '<p class="hint">لا توجد حسابات.</p>') + '</div>'
      + '</section>';
  };

  const coreAccountsSettings = pageSettings;
  pageSettings = function () {
    return coreAccountsSettings() + panel(state.accounts, state.user && state.user.id);
  };

  /* Read through fetch directly, not api(): that helper always sends a body, and
     fetch refuses a body on a GET, so every call threw before a request left and
     the catch below quietly left the list empty. The panel rendered with no rows
     and nothing said why -- while the endpoint itself was answering three
     accounts to a direct fetch. api() is kept for the write, where a body is
     what is wanted. */
  async function loadAccounts() {
    try {
      const res = await fetch('/api/accounts', { credentials: 'same-origin' });
      const data = await res.json().catch(() => []);
      state.accounts = Array.isArray(data) ? data : [];
    } catch (_) { state.accounts = []; }
  }

  const coreSyncAccounts = syncApi;
  syncApi = async function () {
    await coreSyncAccounts();
    if (state.user && ['admin', 'president'].indexOf(state.user.role) !== -1) {
      await loadAccounts();
    }
  };

  const coreActionAccounts = action;
  action = async function (a, el) {
    if(a==='reload-accounts'){
      await loadAccounts();
      if (state.page !== 'settings') { state.page = 'settings'; save(); }
      render();
      showToast('حُدِّثت قائمة الحسابات.');
      return;
    }
    if(a==='save-account-role'){
      const box = document.querySelector('[data-role-for="' + el.dataset.id + '"]');
      if (!box) return;
      const id = el.dataset.id;
      const role = box.value;
      const res = await api('/api/accounts', 'PUT', { id, role });
      if (!res || res.error) { showToast((res && res.error) || 'تعذّر تغيير الصلاحية.', 'error'); return; }
      const row = (state.accounts || []).find(x => String(x.id) === String(id));
      if (row) row.role = role;
      save();
      render();
      showToast('حُفظت الصلاحية.');
      return;
    }
    return coreActionAccounts(a, el);
  };

  const coreBootAccounts = boot;
  boot = async function () {
    await coreBootAccounts();
    if (state.user && ['admin', 'president'].indexOf(state.user.role) !== -1) await loadAccounts();
  };
})();