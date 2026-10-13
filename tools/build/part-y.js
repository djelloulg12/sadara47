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

  /* What the check found, and a way to act on it.

     The reason each group is a group is on the row, because "duplicate" on its
     own says nothing about which two of five accounts are the same person. The
     account to keep is marked rather than the ones to remove, so the manager is
     choosing which one was the mistake -- which is their answer and not the
     machine's. */
  const findings = (data) => {
    const groups = (data && data.groups) || [];
    if (!groups.length) {
      return '<div class="dup-clear">لا توجد حسابات مكررة. فُحص '
        + clubDigits((data && data.checked) || 0) + ' حساب.</div>';
    }
    const rows = groups.map((g, n) => {
      const items = (g.accounts || []).map(a => {
        const keep = String(a.id) === String(g.keep);
        return '<div class="requirement-row account-row' + (keep ? ' is-keep' : '') + '">'
          + '<div class="account-who"><b>' + esc(a.name || a.email || 'حساب')
          + (keep ? ' <small class="owner-mark">الأقدم — يُحفظ</small>' : '') + '</b>'
          + '<span>' + esc(a.email || '') + ' · ' + esc(label(a.role)) + '</span></div>'
          + (keep ? '<span></span>'
            : '<button class="check-btn no" data-action="remove-duplicate-account" data-id="'
              + esc(a.id) + '" data-name="' + esc(a.name || a.email || '') + '">حذف</button>')
          + '</div>';
      }).join('');
      return '<div class="dup-group"><h4>' + clubDigits(n + 1) + '. ' + esc(g.reason)
        + ' — <code>' + esc(g.by || '') + '</code></h4>' + items + '</div>';
    }).join('');
    return '<p class="hint">وُجدت ' + clubDigits(groups.length) + ' مجموعة، من '
      + clubDigits(data.checked) + ' حساب. احذف ما هو مكرر واحتفظ بالأقدم.</p>'
      + rows;
  };

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
      + '</div><div class="toolbar-group">'
      + '<button class="btn btn-outline" data-action="check-duplicate-accounts">فحص الحسابات المكررة</button>'
      + '<button class="btn btn-outline" data-action="reload-accounts">تحديث</button></div></div>'
      + '<div id="accounts-list">' + (rows || '<p class="hint">لا توجد حسابات.</p>') + '</div>'
      + '<div id="duplicate-accounts" hidden></div>'
      + '</section>';
  };

  const coreAccountsSettings = pageSettings;
  pageSettings = function () {
    /* What the check found is kept, so it is still there after a redraw -- a
       finding that disappears when the page is redrawn is a finding somebody has
       to ask for again. */
    let base = coreAccountsSettings() + panel(state.accounts, state.user && state.user.id);
    if (state.duplicateAccounts) {
      const box = document.getElementById('duplicate-accounts');
      if (box) {
        box.hidden = false;
        box.innerHTML = findings(state.duplicateAccounts);
      }
    }
    return base;
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

  /* Read through fetch directly, like the list: api() always sends a body, and a
     GET with a body is refused before it leaves. */
  async function loadDuplicates() {
    try {
      const res = await fetch('/api/accounts/duplicates', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      state.duplicateAccounts = data && Array.isArray(data.groups) ? data : { groups: [], checked: 0 };
    } catch (_) { state.duplicateAccounts = { groups: [], checked: 0 }; }
    const box = document.getElementById('duplicate-accounts');
    if (box) { box.hidden = false; box.innerHTML = findings(state.duplicateAccounts); }
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
    if(a==='check-duplicate-accounts'){
      await loadDuplicates();
      const box = document.getElementById('duplicate-accounts');
      if (box) { box.hidden = false; box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      const groups = (state.duplicateAccounts && state.duplicateAccounts.groups) || [];
      showToast(groups.length
        ? 'وُجدت ' + groups.length + ' مجموعة حسابات مكررة.'
        : 'لا توجد حسابات مكررة.', groups.length ? 'error' : 'ok');
      return;
    }
    if(a==='remove-duplicate-account'){
      /* Asked first, and by name. A button that removes an account on one click,
         next to a list of five rows, is a button somebody will press on the wrong
         row. */
      const who = el.dataset.name || 'هذا الحساب';
      if (!confirm('حذف حساب «' + who + '»؟\n\nيحذف ملف الحساب فقط: يبقى بإمكان صاحب كلمة المرور الدخول بالعثور على لا شيء.\nلا يمكن التراجع.')) return;
      const res = await api('/api/accounts', 'DELETE', { id: el.dataset.id });
      if (!res || res.error) { showToast((res && res.error) || 'تعذّر حذف الحساب.', 'error'); return; }
      state.accounts = (state.accounts || []).filter(x => String(x.id) !== String(el.dataset.id));
      save();
      await loadDuplicates();
      render();
      /* Said as what it was: the profile is gone, so nothing the rules open is
         reachable. Calling it a deletion of the account would be a claim this
         did not make. */
      showToast(res.note || 'حُذف ملف الحساب.', 'ok');
      return;
    }
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