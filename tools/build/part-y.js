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
     account to keep is marked rather than the ones to merge away, so the manager
     is choosing which one was the mistake -- which is their answer and not the
     machine's.

     What each account holds is on its row too, because the question before a
     merge is "what moves": three requests and two cards under this one is a very
     different decision from none. */
  /* Why two accounts are one person, in the club's words. The adapter sends a key
     rather than a sentence, because a key is something code can compare; the
     words belong here, where they are shown -- the same place the roles are
     translated. An unrecognised key is printed as it came rather than dropped: a
     reason nobody recognised is still a reason, and it says more than nothing. */
  const DUP_REASON = {
    'user name': 'اسم المستخدم',
    'identity number': 'رقم التعريف الوطني',
    'name and day of birth': 'الاسم وتاريخ الميلاد',
    'guardian card': 'بطاقة الولي'
  };
  const dupReason = key => DUP_REASON[key] || key;

  /* What an account carries with it, in one line: how many requests filed under it
     and how many cards. It is searched along with the name because a manager
     looking for "the one with three requests on it" is looking by this. */
  const held = a => {
    const bits = [];
    if (a.requests) bits.push(clubDigits(a.requests) + ' طلب');
    if (a.swimmers) bits.push(clubDigits(a.swimmers) + ' بطاقة سباح');
    return bits.length ? bits.join(' · ') : 'لا شيء';
  };

  const findings = (data) => {
    const groups = (data && data.groups) || [];
    const gone = (data && data.merged) || [];
    const kept = g => (g.accounts || []).find(x => String(x.id) === String(g.keep)) || {};
    const rows = groups.map((g, n) => {
      const items = (g.accounts || []).map(a => {
        const keep = String(a.id) === String(g.keep);
        return '<div class="requirement-row account-row' + (keep ? ' is-keep' : '') + '">'
          + '<div class="account-who"><b>' + esc(a.name || a.email || 'حساب')
          + (keep ? ' <small class="owner-mark">يُحفظ</small>' : '') + '</b>'
          + '<span>' + esc(a.email || '') + ' · ' + esc(label(a.role)) + ' · ' + esc(held(a)) + '</span></div>'
          + (keep ? '<span></span>'
            : '<button class="check-btn no" data-action="merge-account" data-id="' + esc(a.id)
              + '" data-keep="' + esc(g.keep) + '" data-keep-name="' + esc(kept(g).name || '')
              + '" data-name="' + esc(a.name || a.email || '') + '" data-held="' + esc(held(a)) + '">دمج</button>')
          + '</div>';
      }).join('');
      return '<div class="dup-group"><h4>' + clubDigits(n + 1) + '. ' + esc(dupReason(g.reason))
        + ' — <code>' + esc(g.by || '') + '</code></h4>' + items + '</div>';
    }).join('');
    const done = gone.length
      ? '<p class="hint">حسابات دُمجت سابقًا: ' + gone.map(a => esc(a.name || a.email || '')).join('، ')
        + '. لا تزال في ملفّات النادي، ومن يتكلّم بكلمة مرور إحداها يجد حسابه الآخر بالاسم.</p>'
      : '';
    if (!groups.length) {
      return done + '<div class="dup-clear">لا توجد حسابات مكررة. فُحص '
        + clubDigits((data && data.checked) || 0) + ' حساب.</div>';
    }
    return done + '<p class="hint">وُجدت ' + clubDigits(groups.length) + ' مجموعة، من '
      + clubDigits(data.checked) + ' حساب. اضغط «دمج» لتُلدمج المجموعة في الحساب المُعلَّم عليه «يُحفظ»؛ '
      + 'ينتقل ما كان للحساب الآخر معه، ولا يُحذف شيء.</p>' + rows;
  };

  /* What a person looks an account up by.

     Everything the panel shows about an account, in one string: the name, the
     address it signs in with, the username the paper forms quote, the telephone
     a family would give at the desk, the role as it is written, and the
     membership or registration number. Those are the six things somebody
     actually has in their hand when they come looking for a row -- a name from a
     paper, an address from an email, a number off a card.

     The role is searched in its own Arabic wording and not only in the English
     key it is stored under, because nobody holding a page full of Arabic labels is
     going to type `president` into a box that says `رئيس النادي`. Both are
     searched, so either works. */
  const accountHaystack = a => [a.name, a.email, a.username, a.phone,
    a.member_no, a.registration_id, a.role, label(a.role), held(a)]
    .filter(Boolean).join(' ');

  const panel = (list, me) => {
    if (!Array.isArray(list)) return '';
    const q = String(state.accountsQuery || '').trim();
    const shown = q ? list.filter(a => matchesText(accountHaystack(a), q)) : list;
    const rows = shown.map(a => {
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
    /* The count is said out loud, and says what was asked for as well as what was
       found. A list that shows two rows out of two hundred and twenty-six, with
       no count beside it, reads as two accounts. */
    const tally = q
      ? '<span class="hint" role="status">يُعرض ' + clubDigits(shown.length)
        + ' من ' + clubDigits(list.length) + ' حسابًا — «' + esc(q) + '»</span>'
      : '';
    const empty = q
      ? '<p class="hint">لا حساب بهذا الاسم أو البريد أو الرقم. ابحث بجزء من الاسم، أو بالاسم كما هو في الاستمارة.</p>'
      : '<p class="hint">لا توجد حسابات.</p>';
    return '<section class="panel settings" id="accounts-panel">'
      + '<div class="panel-head"><div>'
      + '<h3>صلاحيات الحسابات</h3>'
      + '<p>من يستطيع الدخول، وما يستطيع أن يفعل. صفك لا يُغيَّر — '
      + 'استعمل حساباً آخر للتجريب.</p>'
      + '</div><div class="toolbar-group">'
      + '<button class="btn btn-outline" data-action="check-duplicate-accounts">فحص الحسابات المكررة</button>'
      + '<button class="btn btn-outline" data-action="reload-accounts">تحديث</button></div></div>'
      + '<div class="search">🔎<input id="accounts-search" '
      + 'placeholder="ابحث بالاسم أو البريد أو رقم الهاتف أو رقم الانخراط…" '
      + 'aria-label="بحث في الحسابات" value="' + esc(q) + '" autocomplete="off"></div>'
      + tally
      + '<div id="accounts-list">' + (rows || empty) + '</div>'
      + '<div id="duplicate-accounts" hidden></div>'
      + '</section>';
  };

  const coreAccountsSettings = pageSettings;
  pageSettings = function () {
    /* What the check found is kept, so it is still there after a redraw -- a
       finding that disappears when the page is redrawn is a finding somebody has
       to ask for again.

       Built into the string being returned, not reached for in the document: this
       page is assembled as text and put into the page afterwards, so a box looked
       up here does not exist yet, and looking found nothing -- the check ran, the
       answers arrived, and the panel came back empty until somebody pressed the
       button a second time. */
    let base = coreAccountsSettings() + panel(state.accounts, state.user && state.user.id);
    if (state.duplicateAccounts) {
      base = base.replace(
        '<div id="duplicate-accounts" hidden></div>',
        '<div id="duplicate-accounts">' + findings(state.duplicateAccounts) + '</div>');
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
    if(a==='merge-account'){
      /* Asked first, and saying exactly what moves. "Merge two accounts" does not
         say whether the requests filed under the other one come with it -- and
         they do, so the confirmation says so by name, before anything happens
         rather than after. */
      const who = el.dataset.name || 'هذا الحساب';
      const keep = el.dataset.keepName || 'الحساب المحتفظ به';
      const what = el.dataset.held || '';
      const moved = what && what !== 'لا شيء' ? '\n\nينتقل معه: ' + what + '.' : '';
      const stays = '\n\nلا يُحذف الحساب القديم: من يتكلّم بكلمة مروره يجد حسابه الآخر بالاسم.'
        + '\nلا يمكن التراجع.';
      if (!confirm('دمج حساب «' + who + '» في «' + keep + '»؟' + moved + stays)) return;
      const res = await api('/api/accounts/merge', 'POST', { keep: el.dataset.keep, remove: [el.dataset.id] });
      if (!res || res.error) { showToast((res && res.error) || 'تعذّر الدمج.', 'error'); return; }
      state.accounts = (state.accounts || []).filter(x => String(x.id) !== String(el.dataset.id));
      save();
      await loadDuplicates();
      render();
      const m = res.moved || {};
      showToast('دُمج «' + who + '» في «' + keep + '».'
        + (m.requests ? ' نُقلت ' + m.requests + ' طلبًا.' : '')
        + (m.swimmers ? ' ونُقلت ' + m.swimmers + ' بطاقة سباح.' : ''), 'ok');
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