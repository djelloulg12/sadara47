/* ============================================================================
   الشريط الجانبي بحسب نوع الحساب وصلاحياته
   ============================================================================

   المشكلة التي يحلّها هذا الملف
   ------------------------------
   كان للشريط الجانبي شكل واحد وقائمة واحدة لكل من يدخل: صاحب النادي، والمدير،
   والمسير، والمدرب. وكانت القائمة تُبنى في ثلاثة مواضع -- قالب `dashboard`،
   و`injectGroupsNav`، و`injectScanNav` -- فيُضاف عنصر الأفواج لكل من دخل،
   ويُضاف عنصر الماسح لكل من يحمل صلاحية المسح، ولو لم تكن له. فمن يدخل بحساب
   مسير يرى أبوابًا تُردّه من الخادم عند أول ضغطة.

   والقاعدة هنا واحدة: **عنصر واحد في مكان واحد**. القائمة تُبنى كاملةً من
   `SIDE_LAYOUT_`، وكل عنصر يعلن الأدوار التي يحقّ لها رؤيته، فما لا يُحقّ لا
   يُرسم أصلًا -- لا يُرسم ثم يُخفى، ولا يُضاف بعد الرسم.

   واللون يقول الدور قبل أن يُقرأ: صاحب النادي ذهبيّ على كحليّ، والمدير أزرق،
   والمسير أخضر مزرق، والمدرب نيليّ. واللون ليس زينة: من يفتح المنصة على حساب
   غيره يعرف من أي شاشة ينظر بلمحة، قبل أن يقرأ اسمًا أو يضغط زرًّا.

   أما العضو والولي فلهما مساحتهما الخاصة (`roleDashboard`) ولم يُمسّا: هي
   مصمّمة لحساب واحد وأبنائه، لا لقائمة إدارة مختصرة.
   ========================================================================== */

const ROLE_META_ = {
  owner:         { label: 'صاحب النادي',  chip: 'مالك', tone: 'owner' },
  admin:         { label: 'مدير المنصة',  chip: 'مدير', tone: 'admin' },
  president:     { label: 'رئيس الجمعية', chip: 'رئيس', tone: 'admin' },
  manager:       { label: 'مسير النادي',  chip: 'مسير', tone: 'manager' },
  coach:         { label: 'مدرب',         chip: 'مدرب', tone: 'coach' },
  parent:        { label: 'ولي',          chip: 'ولي',  tone: 'member' },
  member:        { label: 'عضو النادي',   chip: 'عضو',  tone: 'member' },
  swimmer_adult: { label: 'سباح',         chip: 'سباح', tone: 'member' },
  swimmer_minor: { label: 'سباح قاصر',    chip: 'سباح', tone: 'member' }
};

/* الأدوار التي تدخل بشريط جانبي. والمالك يعلو على دور الحساب، كما في الخادم:
   `roles.js` يقرأ config/owners قبل عمود role، وهذا يقرأ `user.owner` قبله.

   و`manager` صار إداريًا كاملًا -- يدير الأفواج والسباحين والمدربين -- بعد أن
   كان «ماسحًا» في القاعدة الأولى. والحسابات العليا تبقى محميّة في الخادم:
   لا يغيّر المسير صلاحية مسير ولا كلمة مروره. */
const MANAGER_ROLE_KEYS_ = ['owner', 'admin', 'president', 'manager'];
const STAFF_ROLE_KEYS_   = ['owner', 'admin', 'president', 'manager', 'coach'];

function roleKey_() {
  const u = state.user || {};
  if (u.owner === true) return 'owner';
  const r = String(u.role || '').trim();
  return Object.prototype.hasOwnProperty.call(ROLE_META_, r) ? r : 'member';
}
function isManagerRole_() { return MANAGER_ROLE_KEYS_.indexOf(roleKey_()) !== -1; }
function isStaffRole_()   { return STAFF_ROLE_KEYS_.indexOf(roleKey_()) !== -1; }

/* قائمة الشريط: مجموعة، ثم عناصر، ولكل عنصر أدواره.

   والترتيب مقصود: ما يُستعمل كل يوم في الأعلى (الحضور، الماسح، البرنامج)، ثم
   الأعضاء، ثم الإعلانات، ثم ما يُفتح نادرًا (سجل التدقيق). والعنصر الذي لا
   يحقّ لدور ما لا يظهر له، والمجموعة التي تفرغ كلها لا تُرسم ولا يبقى عنوانها. */
const SIDE_LAYOUT_ = [
  {
    group: 'العمل اليومي',
    items: [
      { key: 'home',       label: 'نظرة عامة',         icon: '⌂', roles: ['owner', 'admin', 'president', 'manager', 'coach'] },
      { key: 'attendance', label: 'الحضور',            icon: '✓', roles: ['owner', 'admin', 'president', 'manager', 'coach'] },
      { key: 'scan',       label: 'ماسح الحضور',       icon: '▣', roles: ['owner', 'admin', 'president', 'manager', 'coach'] },
      { key: 'schedule',   label: 'البرنامج الأسبوعي', icon: '▦', roles: ['owner', 'admin', 'president', 'manager', 'coach'] }
    ]
  },
  {
    group: 'الأعضاء',
    items: [
      { key: 'users',         label: 'السباحون',          icon: '♙', roles: ['owner', 'admin', 'president', 'manager'] },
      { key: 'applications',  label: 'طلبات التسجيل',     icon: '◈', roles: ['owner', 'admin', 'president', 'manager'] },
      { key: 'subscriptions', label: 'الاشتراكات',        icon: '◈', roles: ['owner', 'admin', 'president', 'manager'] },
      { key: 'card',          label: 'بطاقات الانخراط',   icon: '▣', roles: ['owner', 'admin', 'president', 'manager', 'coach'] },
      { key: 'groups',        label: 'الأفواج والمدربون', icon: '♟', roles: ['owner', 'admin', 'president', 'manager'] }
    ]
  },
  {
    group: 'النادي',
    items: [
      { key: 'notices', label: 'الإعلانات', icon: '◈', roles: ['owner', 'admin', 'president', 'manager', 'coach'] }
    ]
  },
  {
    group: 'النظام',
    items: [
      { key: 'accounts', label: 'الحسابات وكلمات المرور', icon: '⚿', roles: ['owner', 'admin', 'president', 'manager'] },
      { key: 'audit', label: 'سجل التدقيق', icon: '⚑', roles: ['owner', 'admin', 'president', 'manager'] }
    ]
  }
];

/* ما يراه هذا الدور، مجموعةً مجموعة. والمجموعة الفارغة تُسقط. */
function sideGroupsFor_(role) {
  return SIDE_LAYOUT_
    .map(g => ({ group: g.group, items: g.items.filter(it => it.roles.indexOf(role) !== -1) }))
    .filter(g => g.items.length);
}

/* الصفحات المسموحة: ما في القائمة، وما في ذيلها. ويُستعمل هذا حاجزًا لا زينة:
   صفحة محفوظة في `state.page` من حساب سابق لا تُرسم لحساب لا يحقّ له. */
function allowedPagesFor_(role) {
  const out = [];
  sideGroupsFor_(role).forEach(g => g.items.forEach(it => out.push(it.key)));
  /* الملف الشخصي لكل من دخل: منه تُغيَّر كلمة المرور، ولا يجوز أن يكون
     مدفونًا خلف صفحة لا يملكها. */
  out.push('profile');
  if (MANAGER_ROLE_KEYS_.indexOf(role) !== -1) out.push('settings');
  return out;
}

function pageLabelFor_(role, page) {
  let label = 'نظرة عامة';
  SIDE_LAYOUT_.forEach(g => g.items.forEach(it => { if (it.key === page) label = it.label; }));
  if (page === 'settings') label = 'الإعدادات';
  if (page === 'profile') label = 'ملفي وكلمة المرور';
  return label;
}

function sideInitial_(user) {
  const raw = String((user && (user.name || user.email)) || '').trim();
  return raw ? raw.charAt(0) : 'ع';
}

/* الشريط نفسه. `role-` و`tone-` صنفان على العنصر، والثاني هو ما تقرؤه CSS. */
function sideAsideHtml_(role, page, user) {
  const meta = ROLE_META_[role] || ROLE_META_.member;
  const name = String((user && (user.name || user.email)) || 'عضو النادي');
  const nav = sideGroupsFor_(role).map(g =>
    '<p class="side-group">' + esc(g.group) + '</p>'
    + g.items.map(it =>
      '<a class="' + (page === it.key ? 'active' : '') + '" data-page="' + it.key + '">'
      + '<i>' + it.icon + '</i>' + esc(it.label) + '</a>'
    ).join('')
  ).join('');

  const bottom = (MANAGER_ROLE_KEYS_.indexOf(role) !== -1
    ? '<a class="' + (page === 'settings' ? 'active' : '') + '" data-page="settings"><i>⚙</i>الإعدادات</a>'
    : '')
    + '<a class="' + (page === 'profile' ? 'active' : '') + '" data-page="profile"><i>🔑</i>ملفي وكلمة المرور</a>'
    + '<a data-action="logout"><i>↪</i>تسجيل الخروج</a>';

  return '<aside class="sidebar role-' + esc(role) + ' tone-' + esc(meta.tone) + '">'
    + '<a class="brand side-brand"><span class="logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a>'
    + '<div class="side-user"><span class="avatar">' + esc(sideInitial_(user)) + '</span>'
    + '<div><b>' + esc(name) + '</b><small>' + esc(meta.label) + '</small></div></div>'
    + '<span class="role-chip">' + esc(meta.chip) + '</span>'
    + '<nav class="side-nav">' + nav + '</nav>'
    + '<div class="side-bottom">' + bottom + '</div>'
    + '</aside>';
}

function sideHeaderHtml_(role, page) {
  const meta = ROLE_META_[role] || ROLE_META_.member;
  const title = pageLabelFor_(role, page);
  return '<header class="dash-header">'
    + '<div><span class="mobile-menu">☰</span>'
    + '<span class="breadcrumb">الصدارة <b>/</b> ' + esc(title) + '</span>'
    + '<h1>' + esc(title) + '</h1></div>'
    + '<div class="header-actions">'
    + '<span class="role-badge tone-' + esc(meta.tone) + '">' + esc(meta.label) + '</span>'
    + '<button class="icon-btn" data-action="theme" aria-label="تبديل الوضع الليلي" title="تبديل الوضع">' + (state.dark ? '☀' : '◐') + '</button>'
    + '<button class="icon-btn notification" data-action="notification" aria-label="الإعلانات" title="الإعلانات">♢<span></span></button>'
    + '<div class="header-avatar">' + esc(sideInitial_(state.user)) + '</div>'
    + '</div></header>';
}

/* محتوى المدرب والمسير.

   لماذا لا يُستعمل `pageView` لهما؟ لأن صفحات الإدارة مبنية على بيانات النادي
   كله: جدول السباحين جميعًا، وطلبات التسجيل، والاشتراكات. والمدرب له حصصه
   وأفواجه، والمسير له الحضور. فيُختار المحتوى بالدور، لا بالمفتاح وحده. */
function staffPageBody_(role, page) {
  const viewRole = role === 'manager' ? 'coach' : role;
  const map = {
    home:       () => roleHome(viewRole),
    schedule:   () => roleSchedule(),
    attendance: () => roleAttendance(),
    card:       () => roleCards(),
    notices:    () => roleNotices(),
    scan:       () => pageView('scan')
  };
  const fn = map[page];
  return fn ? fn() : map.home();
}

/* صفحة تُطلب ولا يُحقّ لصاحبها فتحها.

   ولا تُحوّل الصفحة إلى «نظرة عامة» صامتًا: التحويل الصامت يجعل من ضغط رابطًا
   محفوظًا يظنّ أنه وصل، ويجعل من يختبر المنصة يقيس صفحة ويظنّ أنه قاس أخرى.
   فيُقال له صراحةً: هذه ليست لك، وهذا ما لك. */
function sideDeniedHtml_(role, page) {
  const meta = ROLE_META_[role] || ROLE_META_.member;
  return '<section class="panel access-denied" id="page-root">'
    + '<h2>هذه الصفحة ليست لحسابك</h2>'
    + '<p>حسابك «' + esc(meta.label) + '» لا يمنحه الوصول إلى «' + esc(pageLabelFor_(role, page)) + '».</p>'
    + '<button class="btn btn-primary" data-page="home">العودة إلى نظرة عامة</button>'
    + '</section>';
}

/* الشريط البديل لغير الإدارة.

   `dashboard` في الأساس يوجّه المدرب والولي والسباح إلى `roleDashboard`، وهو
   فضاء كامل بشريط علوي خاص. والمدرب والمسير هنا يدخلان الشريط الجانبي، لأن
   عملهما اليومي -- الحضور والماسح والبرنامج -- قائمة لا صفحة واحدة. أما الولي
   والسباح فيبقيان على فضائهما.

   و`injectGroupsNav` يُعطَّل: القائمة صارت تُبنى كاملةً أعلاه، ولو بقي يعمل
   لأضاف «الأفواج» إلى شريط مدرب لا يحقّ له فتح الصفحة. */
const coreDashboardByRole_ = dashboard;
injectGroupsNav = function () { /* the sidebar is built whole, above */ };

dashboard = function () {
  const role = roleKey_();
  if (!isStaffRole_()) return coreDashboardByRole_();

  const allowed = allowedPagesFor_(role);
  const denied = allowed.indexOf(state.page) === -1;
  const view = denied ? 'home' : state.page;
  const body = denied
    ? sideDeniedHtml_(role, state.page)
    : (isManagerRole_() ? pageView(view) : staffPageBody_(role, view));

  return '<div class="app-shell">'
    + sideAsideHtml_(role, denied ? '' : view, state.user)
    + '<main class="main-content">'
    + sideHeaderHtml_(role, denied ? '' : view)
    + body
    + '</main></div>';
};
