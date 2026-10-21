/* ============================================================================
   رقم التعريف الوطني للولي، ولوحة العائلة — part-nin.js

   الرقم البيومتري (18 رقمًا) هو مرجع العائلة الواحد:
     * الدخول بالبريد أو بالرقم.
     * الولي يكمّل رقمه عند أول دخول، والملف يبقى «غير مكتمل» حتى يكمله.
     * أبناء الولي يُجمعون في لوحة واحدة، والطلب الجديد يُربط بالعائلة نفسها.
     * من بلغ 18 سنة لا تُعرض له بيانات وليّ: هو وليّ على نفسه.

   والطبقة لا تعيد بناء الصفحات: تُغلّف الدوال القائمة، فتضيف ولا تمحو.
   ========================================================================= */
(function () {
  'use strict';

  const NIN_ROLES = ['member', 'parent', 'swimmer_adult', 'swimmer_minor'];
  const digits = v => String(v === undefined || v === null ? '' : v)
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^0-9]/g, '');
  const validNIN = v => /^[0-9]{18}$/.test(digits(v));
  const q = sel => { const n = document.querySelector(sel); return n ? String(n.value || '').trim() : ''; };

  /* السنّ اليوم، لا عند بداية الموسم: من بلغ 18 في أكتوبر ليس قاصرًا حتى
     سبتمبر. والفئة في رقم الانخراط تبقى على بداية الموسم، أما الخصوصية فلا.
     والتاريخ قد يصل نصًّا أو كائن `Date` أو ISO كاملًا، فلا يُقتطع منه عشرة
     أحرف ويُفسَّر خطأً سنة 2001. */
  function dateOnly_(value) {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return null;
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
    const parsed = new Date(text);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  function ageAt_(birth, when) {
    const b = dateOnly_(birth);
    if (!b) return null;
    const w = when ? dateOnly_(when) : new Date();
    if (!w || isNaN(w.getTime())) return null;
    let age = w.getFullYear() - b.getFullYear();
    const m = w.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && w.getDate() < b.getDate())) age--;
    return age;
  }
  function isAdultPerson_(s) {
    const age = ageAt_(s && s.birth_date);
    return age !== null && age >= 18;
  }

  /* ------------------------------------------------------------------ الدخول */
  const coreLoginModalNin = loginModal;
  loginModal = function () {
    let html = coreLoginModalNin.apply(this, arguments);
    html = html.replace(
      /<label>البريد الإلكتروني<input id="email"[^>]*><\/label>/,
      '<label>البريد الإلكتروني أو رقم التعريف الوطني'
        + '<input id="email" type="text" inputmode="text" autocomplete="username" '
        + 'placeholder="name@example.com أو 18 رقمًا" dir="auto"></label>'
        + '<p class="hint nin-login-hint">يمكنك الدخول برقم التعريف الوطني (18 رقمًا) بدل البريد.</p>'
    );
    return html;
  };

  /* ------------------------------------------------------- استمارة التسجيل */
  const coreFullRegisterModalNin = fullRegisterModal;
  fullRegisterModal = function () {
    let html = coreFullRegisterModalNin.apply(this, arguments);
    html = html.replace(
      '<label>رقم التعريف الوطني<input id="reg-nin"></label>',
      '<label>رقم التعريف الوطني (18 رقمًا)<input id="reg-nin" inputmode="numeric" '
        + 'maxlength="18" pattern="[0-9]{18}" placeholder="18 رقمًا"></label>'
    );
    html = html.replace(
      '<label>رقم تعريف الولي<input id="reg-guardian-nin"></label>',
      '<label>رقم تعريف الولي (18 رقمًا) *<input id="reg-guardian-nin" '
        + 'inputmode="numeric" maxlength="18" pattern="[0-9]{18}" placeholder="18 رقمًا"></label>'
    );
    return html;
  };

  /* ---------------------------------------------------------- حائط الإكمال */
  function ninMissing_() {
    const u = state.user || {};
    return !validNIN(u.national_id);
  }

  function maybeNinWall(force) {
    const u = state.user || {};
    if (!u.id || NIN_ROLES.indexOf(u.role) === -1) return;
    if (u.must_change) return;
    if (!ninMissing_()) {
      document.getElementById('nin-wall')?.remove();
      return;
    }
    if (!force && state.ninPromptDismissedFor === u.id) return;
    if (document.getElementById('nin-wall')) return;
    if (!force && document.querySelector('.modal-backdrop')) return;

    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal-backdrop" id="nin-wall" role="dialog" aria-modal="true" aria-label="إكمال رقم التعريف الوطني">'
      + '<div class="modal auth-modal nin-wall">'
      + '<div class="modal-heading"><span class="logo">🪪</span>'
      + '<h2>أكمل ملف العائلة</h2>'
      + '<p>رقم التعريف الوطني للولي هو مرجع عائلتك في النادي: به تُجمع بطاقات الأبناء، '
      + 'وبه تستعيد الدخول إن نسيت البريد.</p></div>'
      + '<div class="form-message" id="nin-wall-message" role="status"></div>'
      + '<label>رقم التعريف الوطني (18 رقمًا)'
      + '<input id="nin-wall-input" inputmode="numeric" maxlength="18" pattern="[0-9]{18}" '
      + 'dir="ltr" placeholder="18 رقمًا" autocomplete="off"></label>'
      + '<button class="btn btn-primary full" data-action="save-nin">حفظ الرقم</button>'
      + '<button class="btn btn-outline full" data-action="dismiss-nin">لاحقًا</button>'
      + '<p class="hint">الرقم يظهر على البطاقة البيومترية. الملف يبقى «غير مكتمل» حتى يُحفظ، '
      + 'ولا يُمنع أحد من الدخول بسببه.</p>'
      + '</div></div>');
    bind();
  }

  function ninWallMessage(text, tone) {
    const box = document.getElementById('nin-wall-message');
    if (!box) return;
    box.textContent = text || '';
    box.className = 'form-message' + (tone ? ' ' + tone : '');
  }

  /* --------------------------------------------------------- لوحة العائلة */
  function familyPanel_(mine, role) {
    const u = state.user || {};
    const fam = state.family || {};
    const list = Array.isArray(mine) ? mine : [];
    const pending = Array.isArray(fam.pending) ? fam.pending : [];
    const hasMinor = list.some(s => !isAdultPerson_(s))
      || pending.some(a => String(a.category || '').toLowerCase() !== 'adult');
    const isParent = role === 'parent';
    if (!list.length && !pending.length) return '';
    /* البالغ لا تُعرض له بيانات وليّ. ولو كان الحساب وليًّا (parent) أو كان
       بين أبنائه قاصر، فالبطاقة تبقى لأنها بطاقة الولي نفسه. */
    if (!isParent && !hasMinor) return '';

    const nin = digits(u.national_id);
    const guardian = '<article class="family-card is-guardian">'
      + '<span class="family-avatar">👤</span><div>'
      + '<small>ولي الأمر</small><b>' + esc(u.name || 'حساب الولي') + '</b>'
      + (validNIN(nin)
        ? '<span class="family-nin" dir="ltr">' + esc(nin) + '</span>'
        : '<span class="family-missing">ملف غير مكتمل — رقم التعريف الوطني</span>')
      + '</div></article>';

    const cards = list.map(s => {
      const adult = isAdultPerson_(s);
      return '<button type="button" class="family-card' + (adult ? ' is-adult' : '')
        + '" data-action="pick-family-swimmer" data-id="' + esc(s.id) + '">'
        + '<span class="family-avatar">' + (adult ? '🏊' : '🧒') + '</span><div>'
        + '<small>' + (adult ? 'سباح — أكابر' : 'ابن/ابنة — أصاغر') + '</small>'
        + '<b>' + esc(s.name || 'سباح') + '</b>'
        + '<span>' + esc([s.group || s.group_name, s.level].filter(Boolean).join(' · ') || 'فوج غير محدد') + '</span>'
        + '<span class="family-no" dir="ltr">' + esc(clubDigits(s.id || '')) + '</span>'
        + '</div></button>';
    }).join('');

    const waiting = pending.map(a => '<article class="family-card is-pending">'
      + '<span class="family-avatar">⏳</span><div>'
      + '<small>طلب قيد الدراسة</small>'
      + '<b>' + esc([a.first_name_ar, a.last_name_ar].filter(Boolean).join(' ') || 'سباح جديد') + '</b>'
      + '<span>' + esc(a.application_no || '') + '</span>'
      + '</div></article>').join('');

    const alert = validNIN(nin) ? '' :
      '<div class="family-alert">ملف غير مكتمل: أضف رقم التعريف الوطني للولي '
      + 'لتظهر كل بطاقات العائلة تحت مرجع واحد. '
      + '<button class="check-btn" data-action="open-nin">إدخال الرقم</button></div>';

    return '<section class="family-panel" id="family-panel">'
      + '<div class="family-head"><div><h3>لوحة العائلة</h3>'
      + '<p>' + clubDigits(list.length) + ' سباح مرتبط بهذا الحساب'
      + (pending.length ? ' · ' + clubDigits(pending.length) + ' طلب قيد الدراسة' : '') + '</p></div>'
      + '<button class="btn btn-outline" data-action="open-nin">رقم العائلة</button></div>'
      + alert
      + '<div class="family-grid">' + guardian + cards + waiting + '</div>'
      + '</section>';
  }

  const coreMemberSpaceNin = memberSpace;
  memberSpace = function (me, mine, sessions, role) {
    let html = coreMemberSpaceNin.apply(this, arguments);
    const panel = familyPanel_(mine, role);
    if (panel) html = html.replace('<div class="mine-stats">', panel + '<div class="mine-stats">');
    return html;
  };

  /* ---------------------------------------------------- تحديث العائلة */
  const coreSyncNin = syncApi;
  syncApi = async function () {
    await coreSyncNin.apply(this, arguments);
    if (!state.user || ['admin', 'president', 'manager', 'coach', 'owner'].indexOf(state.user.role) !== -1) return;
    try {
      const r = await fetch('/api/family', { credentials: 'same-origin' });
      if (r.ok) state.family = await r.json();
    } catch (_) { /* لوحة العائلة ليست شرطًا لبقية الصفحة */ }
  };

  /* --------------------------------------------------------- الإجراءات */
  const coreActionNin = action;
  action = async function (a, el) {
    if (a === 'save-nin') {
      const nin = digits(q('#nin-wall-input'));
      if (!validNIN(nin)) {
        ninWallMessage('رقم التعريف الوطني يجب أن يكون 18 رقمًا بالضبط.', 'error');
        return;
      }
      const btn = el || document.querySelector('[data-action="save-nin"]');
      if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ…'; }
      try {
        const res = await fetch('/api/accounts/national-id', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify({ national_id: nin })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          ninWallMessage(data.error || 'تعذّر حفظ الرقم. أعد المحاولة.', 'error');
          return;
        }
        state.user.national_id = data.national_id || nin;
        state.user.national_id_missing = false;
        save();
        document.getElementById('nin-wall')?.remove();
        await syncApi();
        render();
        showToast('حُفظ رقم العائلة. صارت بطاقات أبنائك في لوحة واحدة.');
      } catch (_) {
        ninWallMessage('تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'حفظ الرقم'; }
      }
      return;
    }
    if (a === 'dismiss-nin') {
      state.ninPromptDismissedFor = state.user && state.user.id;
      document.getElementById('nin-wall')?.remove();
      return;
    }
    if (a === 'open-nin') {
      document.querySelectorAll('.modal-backdrop:not(#nin-wall)').forEach(n => n.remove());
      maybeNinWall(true);
      return;
    }
    if (a === 'pick-family-swimmer') {
      const id = el && el.dataset ? el.dataset.id : '';
      if (id) { state.chosenSwimmer = id; save(); render(); }
      return;
    }
    if (a === 'send-full-request') {
      const category = q('#reg-category') || 'minor';
      const own = digits(q('#reg-nin'));
      if (category === 'adult' && !validNIN(own)) {
        showToast('رقم التعريف الوطني إلزامي للبالغ، ويجب أن يكون 18 رقمًا.', 'error');
        return;
      }
      if (category === 'minor') {
        const guardian = digits(q('#reg-guardian-nin'));
        if (!validNIN(guardian)) {
          showToast('رقم التعريف الوطني للولي إلزامي، ويجب أن يكون 18 رقمًا.', 'error');
          return;
        }
        if (!q('#reg-guardian-first') || !q('#reg-guardian-last') || !q('#reg-guardian-phone')) {
          showToast('يرجى إكمال اسم الولي ولقبه وهاتفه.', 'error');
          return;
        }
      } else {
        /* البالغ وليٌّ على نفسه: الرقم نفسه هو مرجع عائلته، والحقل مخفي. */
        const g = document.querySelector('#reg-guardian-nin');
        if (g) g.value = own;
      }
    }
    const out = await coreActionNin.apply(this, arguments);
    if (a === 'change-password' || a === 'must-change-password') {
      setTimeout(() => maybeNinWall(false), 0);
    }
    return out;
  };

  /* ------------------------------------------------------- عرض وطباعة */
  const corePageOverviewNin = pageOverview;
  pageOverview = function () {
    let html = corePageOverviewNin.apply(this, arguments);
    /* «الوصول السريع» كان صندوقًا يعلو الصفحة ويُزاحم الأرقام. أُزيل تمامًا:
       كل إجراء فيه له باب في القائمة أو في الشريط الجانبي. ويبقى زرّ طباعة
       البطاقات في الترويسة، لأن الطباعة إجراء الصفحة الأول لا اختصارًا مكررًا. */
    html = html.replace(/<section class="panel quick-panel">[\s\S]*?<\/section>/, '');
    return html.replace(
      '<button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button>',
      '<div class="welcome-actions">'
        + '<button class="btn btn-outline" data-action="print-cards-quick">🖨 طباعة البطاقات</button>'
        + '<button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button>'
        + '</div>'
    );
  };

  const corePageSettingsNin = pageSettings;
  pageSettings = function () {
    return '<div class="settings-shell">' + corePageSettingsNin.apply(this, arguments) + '</div>';
  };

  /* كل مطبوعة تحمل شعار النادي: الترويسة تُبنى في `printArea`، فنضيف الشعار
     إليها بعد بنائها وقبل `window.print`. */
  const corePrintAreaNin = printArea;
  printArea = function (source, options) {
    const host = corePrintAreaNin.apply(this, arguments);
    if (host && host.querySelector && !host.querySelector('.print-club-logo')) {
      const head = host.querySelector('.print-head');
      if (head) {
        head.insertAdjacentHTML('afterbegin',
          '<div class="print-club-logo"><img src="assets/logo.png" alt="شعار النادي"></div>');
      }
    }
    return host;
  };

  const coreRenderNin = render;
  render = function () {
    const out = coreRenderNin.apply(this, arguments);
    maybeNinWall(false);
    return out;
  };

  const coreBootNin = boot;
  boot = async function () {
    const out = await coreBootNin.apply(this, arguments);
    maybeNinWall(false);
    return out;
  };
})();
