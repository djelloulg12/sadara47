/* ==========================================================
   الصفحة الرئيسية العامة — إعادة تنظيم
   ========================================================== */
function landingPage(){
  const stats = publicStats();
  const plans = state.subscriptions || [];
  const notices = (state.notices || []).slice(0, 3);
  const sessions = (state.schedules || []).slice(0, 4);
  return '' +
  '<header class="topbar public-nav" id="top">' +
    '<a class="brand" href="#top"><span class="logo brand-logo"></span><span><b>الصدارة</b><small>فوج السباحة</small></span></a>' +
    '<nav>' +
      '<a href="#activities">الأنشطة</a>' +
      '<a href="#plans">الاشتراكات</a>' +
      '<a href="#schedule">البرنامج</a>' +
      '<a href="#about">عن النادي</a>' +
      '<a href="#contact">تواصل معنا</a>' +
    '</nav>' +
    '<div class="topbar-actions">' +
      '<button class="btn btn-ghost" data-action="coach-register">تسجيل مدرب</button>' +
      '<button class="btn btn-outline" data-action="login">تسجيل الدخول</button>' +
    '</div>' +
  '</header>' +

  '<main class="landing">' +
    '<section class="hero">' +
      '<div class="hero-copy">' +
        '<span class="eyebrow">' + esc(CLUB.name) + ' — ' + esc(CLUB.city) + '</span>' +
        '<h1>نصنع أبطالًا<br><em>بشغف وانضباط.</em></h1>' +
        '<p>منصة فوج السباحة: تسجيل، حضور، بطاقات انخراط، وبرنامج أسبوعي — في مكان واحد.</p>' +
        '<div class="hero-actions">' +
          '<button class="btn btn-primary" data-action="register">طلب التسجيل <span>←</span></button>' +
          '<button class="btn btn-outline" data-action="login">الدخول إلى المنصة</button>' +
        '</div>' +
        '<div class="mini-stats">' + stats.map(s =>
          '<span><b>' + esc(s.value) + '</b><small>' + esc(s.label) + '</small></span>').join('') + '</div>' +
      '</div>' +
      '<div class="hero-art">' +
        '<div class="ring ring-one"></div><div class="ring ring-two"></div>' +
        '<div class="water-card"><span>الموسم الرياضي</span><strong>' + esc(CLUB.season) + '</strong>' +
          '<div class="wave">〰〰〰</div><small>' + esc(CLUB.mottoShort || 'أخلاق • احترام • انضباط') + '</small></div>' +
        '<div class="bubble b1">✦</div><div class="bubble b2">✧</div>' +
      '</div>' +
    '</section>' +

    '<section class="quick-strip">' +
      '<a class="qs-item" data-action="register"><b>طلب تسجيل</b><span>سباح جديد — adults وأصاغر</span></a>' +
      '<a class="qs-item" data-action="coach-register"><b>تسجيل مدرب</b><span>تحميل الوثائق والإرسال</span></a>' +
      '<a class="qs-item" href="#schedule"><b>البرنامج الأسبوعي</b><span>الحصص والتوقيت</span></a>' +
      '<a class="qs-item" data-action="print-registration-form"><b>استمارة مطبوعة</b><span>نموذج A4 رسمي</span></a>' +
    '</section>' +

    '<section class="feature-grid" id="activities">' +
      '<article><span class="feature-icon blue">◷</span><h3>برنامج واضح</h3><p>الحصص والتوقيت والمدرب لكل فوج، متاحة للإدارة والمدربين والسباحين.</p></article>' +
      '<article><span class="feature-icon gold">✓</span><h3>متابعة دقيقة</h3><p>تسجيل الحضور بثلاث حالات — حاضر، متأخر، غائب — مع كشف قابل للطباعة.</p></article>' +
      '<article><span class="feature-icon mint">▣</span><h3>بطاقة انخراط</h3><p>بطاقة أنيقة برمز QR: يمسحها المدرب فيُسجَّل الحضور فورًا.</p></article>' +
      '<article><span class="feature-icon red">✎</span><h3>ملف لكل عضو</h3><p>كل منخرط يحدّث بياناته وصورته بنفسه: الطول، الوزن، فصيلة الدم، الطوارئ.</p></article>' +
    '</section>' +

    '<section class="public-band" id="plans">' +
      '<div class="band-head"><span class="eyebrow">الاشتراكات</span><h2>أسعار واضحة<br>بدون رسوم خفية.</h2>' +
        '<p>تُحتسب الإضافات تلقائيًا داخل كل طلب، ويمكن لرئيس النادي تعديلها.</p></div>' +
      '<div class="plan-cards">' + (plans.length ? plans.map(p =>
        '<article class="plan-card"><small>' + esc(p.duration || '') + '</small>' +
        '<strong>' + esc(p.amount || 0) + ' <i>دج</i></strong><b>' + esc(p.name || '') + '</b>' +
        '<button class="check-btn" data-action="register" data-plan="' + esc(p.code) + '">اطلب الآن</button></article>').join('')
        : '<p class="empty-cell">الأسعار تُنشر قريبًا.</p>') + '</div>' +
    '</section>' +

    '<section class="public-band alt" id="schedule">' +
      '<div class="band-head"><span class="eyebrow">البرنامج</span><h2>الحصص الأسبوعية</h2>' +
        '<p>توزيع الحصص على الأيام والفترات مع المدرب المشرف.</p></div>' +
      '<div class="schedule-list">' + (sessions.length ? sessions.map(s =>
        '<div class="sl-item"><b>' + esc(s.day_name || '') + '</b><span dir="ltr">' + esc(s.time_range || '') + '</span>' +
        '<em>' + esc(s.group_name || '') + '</em><small>' + esc(s.coach || '') + '</small></div>').join('')
        : '<p class="empty-cell">البرنامج قيد الإعداد.</p>') + '</div>' +
    '</section>' +

    '<section class="public-band" id="notices">' +
      '<div class="band-head"><span class="eyebrow">آخر الإعلانات</span><h2>من إدارة النادي</h2></div>' +
      '<div class="notice-list">' + (notices.length ? notices.map((n, i) =>
        '<article class="notice-card"><span class="notice-type ' + (i % 2 ? 'blue-type' : 'gold-type') + '">' + esc(n.kind || n.type || 'إعلان') + '</span>' +
        '<div><h3>' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p><small>' + esc(n.date || '') + '</small></div></article>').join('')
        : '<p class="empty-cell">لا توجد إعلانات.</p>') + '</div>' +
    '</section>' +

    '<section class="public-section" id="about">' +
      '<div><span class="eyebrow">لماذا الصدارة؟</span><h2>كل ما يحتاجه النادي<br>في مكان واحد.</h2></div>' +
      '<p>منصة واحدة تجمع الإدارة والمدربين والسباحين وأولياء الأمور: تسجيل إلكتروني، حضور بالرمز، بطاقات قابلة للطباعة، استمارات رسمية، وتقارير جاهزة.</p>' +
    '</section>' +

    '<footer id="contact"><b>الصدارة</b><span>' + esc(CLUB.name) + ' — ' + esc(CLUB.unit) + '</span><span>© ' + new Date().getFullYear() + ' جميع الحقوق محفوظة</span></footer>' +
  '</main>';
}
home=landingPage;