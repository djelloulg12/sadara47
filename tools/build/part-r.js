/* ==========================================================
   الطبقة النهائية: سجل التدقيق · إتاحة الوصول · حماية التخزين
   ========================================================== */
function auditPage(){
  const rows = state.audit || [];
  return '<div class="toolbar"><span class="page-description">كل قرار إداري مع من اتخذه ومتى.</span>'
    + '<div class="toolbar-group">' + printBtn('print-audit', 'طباعة')
    + '<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button></div></div>'
    + '<section class="panel table-panel"><div class="panel-head"><div><h3>سجل القرارات</h3><p>'
    + rows.length + ' عملية مسجّلة</p></div></div>'
    + '<div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>العملية</th><th>السجل</th><th>التفاصيل</th></tr></thead><tbody>'
    + (rows.length ? rows.map(r => '<tr><td dir="ltr">' + esc(String(r.at || '').slice(0, 19).replace('T', ' ')) + '</td>'
      + '<td><b>' + esc(r.action || '') + '</b></td>'
      + '<td>' + esc(r.entity_type || '') + ' <small dir="ltr">' + esc(r.entity_id || '') + '</small></td>'
      + '<td><small>' + esc(JSON.stringify(r.details || {})) + '</small></td></tr>').join('')
      : emptyRow(4, 'لا توجد عمليات مسجّلة بعد.'))
    + '</tbody></table></div></section>';
}
const corePageViewFinal = pageView;
pageView = function (p) {
  if (p === 'audit') return '<div class="page-root" id="page-root">' + auditPage() + '</div>';
  if (p === 'applications') {
    const html = corePageViewFinal(p);
    return /export-applications/.test(html) ? html : html;
  }
  return corePageViewFinal(p);
};
const coreTitleFinal = pageTitle;
pageTitle = function (p) {
  const base = coreTitleFinal(p);
  if (p === 'audit') return 'سجل التدقيق';
  if (p === 'schedule') return 'البرنامج الأسبوعي';
  if (p === 'home') return 'نظرة عامة';
  return base;
};
icons.audit = '⚑';

/* إتاحة الوصول: تأكيد نافذة بسمات دلالية + إغلاق بـ Esc */
function bindDialogA11y(root) {
  root.querySelectorAll('.modal-backdrop').forEach(box => {
    if (box.getAttribute('role')) return;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const head = box.querySelector('.modal-heading h2');
    if (head) box.setAttribute('aria-label', head.textContent.trim());
  });
}
const coreBindFinal = bind;
bind = function () {
  coreBindFinal();
  bindDialogA11y(document);
};
const saveRaw = save;
save = function () { return writeStorage(JSON.stringify(state)) || saveRaw && false; };

/* حماية سعة التخزين المحلي */
const STATE_KEY = 'sadara-state';
let storageWarned = false;
function pickEphemeralState() {
  return {
    user: state.user, page: state.page, dark: state.dark, groups: state.groups,
    rolePage: state.rolePage, weekOffset: state.weekOffset, club: state.club,
    appQuery: state.appQuery, appFilter: state.appFilter, userQuery: state.userQuery,
    groupFilter: state.groupFilter, attendanceGroup: state.attendanceGroup
  };
}
function writeStorage(raw) {
  try {
    localStorage.setItem(STATE_KEY, raw);
    return true;
  } catch (e) {
    if (!storageWarned) {
      storageWarned = true;
      console.warn('Sadara: localStorage is full; retrying without the cached photo.', e);
    }
    if (state.profile && /^data:/.test(state.profile.photo || '')) {
      delete state.profile.photo;
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
        if (typeof showToast === 'function') showToast('تعذّر حفظ الصورة محليًا (المساحة ممتلئة).', 'error');
        return true;
      } catch (_) { /* fall through */ }
    }
    try { localStorage.setItem(STATE_KEY, JSON.stringify(pickEphemeralState())); }
    catch (_) { /* storage unavailable: keep running from memory */ }
    return false;
  }
}

/* the member profile travels with the rest of the data */
const coreSyncFinal = syncApi;
syncApi = async function () {
  await coreSyncFinal();
  try {
    const res = await fetch('/api/profile', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile) state.profile = Object.assign({}, state.profile, data.profile);
    }
  } catch (_) { /* profile is optional */ }
};

/* a visitor must see real prices, the timetable and the announcements */
const coreBootPublic = boot;
boot = async function () {
  await coreBootPublic();
  if (!state.user) { try { await loadPublicData(); } catch (_) { /* keep the page usable */ } }
};

/* start only now: every layer above is installed */
boot();
