const seed = {
  user: null,
  page: 'home',
  notices: [
    { title: 'فتح التسجيل للموسم الجديد', text: 'التسجيل مفتوح لفوج السباحة. المقاعد محدودة.', date: '02 أكتوبر 2026', type: 'مهم' },
    { title: 'تذكير بالحصة التدريبية', text: 'يرجى الحضور قبل الموعد بـ 15 دقيقة.', date: '01 أكتوبر 2026', type: 'تذكير' }
  ],
  swimmers: [],
  attendance: {},
  applications: [],
  subscriptions: [],
  coachRequirements: [
    { id: 'identity', label: 'نسخة بطاقة التعريف الوطنية', required: true },
    { id: 'cv', label: 'السيرة الذاتية والشهادات التدريبية', required: true },
    { id: 'medical', label: 'شهادة طبية تثبت القدرة على التدريب', required: true },
    { id: 'criminal-record', label: 'صحيفة السوابق العدلية', required: false }
  ],
  dark: false
};
let state = JSON.parse(localStorage.getItem('sadara-state') || 'null') || seed;
state.groups ||= [{id:'g1',name:'المبتدئون',coach:'المدرب سليم',schedule:'السبت والثلاثاء · 16:00'},{id:'g2',name:'المتوسطون',coach:'المدرب سليم',schedule:'الأحد · 17:00'},{id:'g3',name:'المتقدمون',coach:'المدربة نادية',schedule:'الإثنين والخميس · 16:00'}];
const save = () => localStorage.setItem('sadara-state', JSON.stringify(state));
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const icons = { home:'⌂', users:'♙', schedule:'▦', attendance:'✓', notices:'◈', card:'▣', settings:'⚙' };

function render() {
  document.body.classList.toggle('dark', state.dark);
  $('#app').innerHTML = state.user ? dashboard() : home();
  if (!state.user) injectFacebookSection();
  if (!state.user) injectCoachEntry();
  if (!state.user) injectContactInfo();
  if (state.user) injectGroupsNav();
  bind();
}
function injectCoachEntry() {
  const actions = document.querySelector('.hero-actions');
  if (actions && !actions.querySelector('[data-action="coach-register"]')) actions.insertAdjacentHTML('beforeend', '<button class="btn btn-outline" data-action="coach-register">تسجيل مدرب</button>');
}
function injectContactInfo() {
  const landing = document.querySelector('.landing');
  if (!landing || landing.querySelector('.club-contact-section')) return;
  landing.insertAdjacentHTML('beforeend', `<section class="club-contact-section" id="club-contact"><div><span class="eyebrow">مقر النادي وطرق التواصل</span><h2>نادي الصدارة الرياضي<br>في حي الثنية — غرداية</h2><p>نستقبلكم في مقر النادي، ونسعد بالتواصل معكم حول التسجيل والتدريب والأنشطة.</p></div><div class="contact-cards"><a class="contact-card" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('حي الثنية - غرداية')}" target="_blank" rel="noopener"><b>⌖</b><span>العنوان</span><strong>حي الثنية - غرداية</strong><small>فتح الموقع على الخريطة</small></a><a class="contact-card" href="tel:+213660606467"><b>☎</b><span>الهاتف</span><strong dir="ltr">0660 60 64 67</strong><small>اتصال مباشر بالنادي</small></a><a class="contact-card" href="mailto:nadisadara@gmail.com"><b>✉</b><span>البريد الإلكتروني</span><strong>nadisadara@gmail.com</strong><small>إرسال رسالة</small></a><a class="contact-card" href="https://www.facebook.com/nadiSadara47/?locale=ar_AR" target="_blank" rel="noopener"><b>f</b><span>الصفحة الرسمية</span><strong dir="ltr">facebook.com/nadiSadara47</strong><small>أخبار النادي وصوره على Facebook</small></a></div></section>`);
}
function injectGroupsNav(){const nav=document.querySelector('.side-nav');if(!nav||nav.querySelector('[data-page="groups"]'))return;nav.insertAdjacentHTML('beforeend','<a class="'+(state.page==='groups'?'active':'')+'" data-page="groups"><i>♟</i>الأفواج والمدربون</a>')}
function injectFacebookSection() {
  const landing = document.querySelector('.landing');
  if (!landing || landing.querySelector('.facebook-section')) return;
  landing.insertAdjacentHTML('beforeend', `<section class="facebook-section" id="facebook"><div class="social-heading"><div><span class="eyebrow">من الصفحة الرسمية</span><h2>صور وتظاهرات النادي</h2><p>تابع آخر التدريبات، المشاركات والإنجازات المنشورة من نادي الصدارة.</p></div><a class="btn btn-primary" href="https://www.facebook.com/nadiSadara47/?locale=ar_AR" target="_blank" rel="noopener noreferrer">زيارة صفحة Facebook</a></div><div class="facebook-content"><div class="facebook-copy"><div class="facebook-badge">f</div><h3>النادي الرياضي الصدارة</h3><p>المصدر الرسمي للأخبار والصور والتغطيات الخاصة بالنادي.</p><a href="https://www.facebook.com/nadiSadara47/?locale=ar_AR" target="_blank" rel="noopener noreferrer" class="facebook-link">عرض جميع المنشورات والتظاهرات ←</a></div><div class="facebook-feed"><iframe title="منشورات صفحة النادي الرسمية على Facebook" src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FnadiSadara47%2F&tabs=timeline&width=560&height=420&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true" width="560" height="420" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe></div></div></section>`);
}
function home() {
  return `<header class="topbar public-nav" id="top"><a class="brand" href="#top"><span class="logo brand-logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a><nav><a href="#activities">نشاطاتنا</a><a href="#about">عن النادي</a><a href="#contact">تواصل معنا</a></nav><button class="btn btn-outline" data-action="login">تسجيل الدخول</button></header>
  <main class="landing"><section class="hero"><div class="hero-copy"><span class="eyebrow">النادي الرياضي الصدارة</span><h1>نصنع أبطالًا<br><em>بشغف وانضباط.</em></h1><p>منصة رقمية متكاملة لإدارة فوج السباحة، متابعة التقدم، وتنظيم كل ما يخص أبطالنا.</p><div class="hero-actions"><button class="btn btn-primary" data-action="login">الدخول إلى المنصة <span>←</span></button><button class="btn btn-ghost" data-action="register">طلب التسجيل</button></div><div class="mini-stats"><span><b>+120</b><small>سباحًا</small></span><span><b>08</b><small>مدربين</small></span><span><b>12</b><small>حصة أسبوعية</small></span></div></div><div class="hero-art"><div class="ring ring-one"></div><div class="ring ring-two"></div><div class="water-card"><span>الموسم الرياضي</span><strong>2026 — 2027</strong><div class="wave">〰〰〰</div><small>اسبح أبعد من حدودك</small></div><div class="bubble b1">✦</div><div class="bubble b2">✧</div></div></section>
  <section class="feature-grid" id="activities"><article><span class="feature-icon blue">◷</span><h3>برنامج واضح</h3><p>اطّلع على حصصك ومواعيد التدريب في أي وقت.</p></article><article><span class="feature-icon gold">✓</span><h3>متابعة مستمرة</h3><p>سجّل الحضور وتابع تطور السباحين بدقة.</p></article><article><span class="feature-icon mint">♧</span><h3>مجتمع واحد</h3><p>تواصل سهل بين الإدارة والمدربين والأولياء.</p></article></section>
  <section class="public-section" id="about"><div><span class="eyebrow">لماذا الصدارة؟</span><h2>كل ما يحتاجه النادي<br>في مكان واحد.</h2></div><p>نمنح الطاقم الإداري والمدربين والأولياء تجربة بسيطة وآمنة تساعدهم على التركيز في الأهم: بناء جيل رياضي متميز.</p></section>
  <footer id="contact"><b>الصدارة</b><span>النادي الرياضي الصدارة — فوج السباحة</span><span>© 2026 جميع الحقوق محفوظة</span></footer></main>`;
}
function loginModal() { return `<div class="modal-backdrop"><div class="modal auth-modal"><button class="close" data-action="close">×</button><div class="modal-heading"><span class="logo auth-logo">🏊</span><h2>مرحبًا بعودتك</h2><p>سجّل الدخول إلى مساحة نادي الصدارة</p></div><div class="form-message" id="auth-message" role="status"></div><label>البريد الإلكتروني<input id="email" type="email" autocomplete="email" placeholder="name@example.com"></label><label>كلمة المرور<input id="password" type="password" autocomplete="current-password" placeholder="••••••••"></label><button class="btn btn-primary full" data-action="do-login">دخول المنصة</button><div class="auth-links"><button type="button" data-action="forgot-password">نسيت كلمة المرور؟</button><span>ليس لديك حساب؟</span><button type="button" data-action="register">طلب التسجيل</button></div><button class="btn btn-sms full" data-action="phone-login">الدخول أو الاستعادة برمز SMS</button><p class="hint">سيتم إرسال رمز تحقق إلى رقم الهاتف المسجل في Firebase.</p></div></div>`; }
function dashboard() {
  const page = state.page;
  return `<div class="app-shell"><aside class="sidebar"><a class="brand side-brand"><span class="logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a><div class="side-user"><span class="avatar">م</span><div><b>${state.user?.name||'رئيس الجمعية'}</b><small>${state.user?.role==='president'?'رئيس الجمعية':'مسير النادي'}</small></div></div><nav class="side-nav">${[['home','نظرة عامة'],['applications','طلبات التسجيل'],['subscriptions','الاشتراكات'],['users','السباحون'],['schedule','البرنامج الأسبوعي'],['attendance','الحضور'],['notices','الإعلانات'],['card','بطاقات الانخراط']].map(([key,label])=>`<a class="${page===key?'active':''}" data-page="${key}"><i>${icons[key]||'◈'}</i>${label}</a>`).join('')}</nav><div class="side-bottom"><a data-page="settings"><i>⚙</i>الإعدادات</a><a data-action="logout"><i>↪</i>تسجيل الخروج</a></div></aside><main class="main-content"><header class="dash-header"><div><span class="mobile-menu">☰</span><span class="breadcrumb">الصدارة <b>/</b> ${pageTitle(page)}</span><h1>${pageTitle(page)}</h1></div><div class="header-actions"><button class="icon-btn" data-action="theme">${state.dark?'☀':'◐'}</button><button class="icon-btn notification">♢<span></span></button><div class="header-avatar">م</div></div></header>${pageView(page)}</main></div>`;
}
function pageTitle(p){return ({home:'نظرة عامة',applications:'طلبات التسجيل',subscriptions:'إدارة الاشتراكات',users:'إدارة السباحين',schedule:'البرنامج الأسبوعي',attendance:'سجل الحضور',notices:'الإعلانات والتنبيهات',card:'بطاقات الانخراط',settings:'الإعدادات'}[p]||'نظرة عامة');}
function pageView(p){ if(p==='applications')return applicationsPage(); if(p==='subscriptions')return subscriptionsPage(); if(p==='users')return usersPage(); if(p==='schedule')return schedulePage(); if(p==='attendance')return attendancePage(); if(p==='notices')return noticesPage(); if(p==='card')return cardPage(); if(p==='settings')return settingsPage(); return overview(); }
function subscriptionsPage(){return `<div class="toolbar"><span class="page-description">الأسعار والخدمات التي يمكن لرئيس الجمعية تعديلها.</span><button class="btn btn-primary" data-action="refresh-data">↻ تحديث</button></div><div class="stats-grid subscription-grid">${state.subscriptions.map(s=>`<div class="stat-card"><span class="stat-icon blue">▣</span><small>${s.duration}</small><strong>${s.amount} دج</strong><b>${s.name}</b></div>`).join('')}</div><section class="panel"><div class="panel-head"><div><h3>الخدمات الإضافية المحسوبة آليًا</h3><p>النقل 900 دج · البدلة الرياضية 2500 دج</p></div></div><p class="page-description">يمكن تعديل الاشتراك والخدمات داخل كل طلب، ويعاد احتساب المبلغ وتسجيل القرار في سجل المراجعة.</p></section>`;}
function overview(){ return `<section class="welcome"><div><span>الخميس، 02 أكتوبر 2026</span><h2>صباح الخير، محمد 👋</h2><p>إليك ملخص أداء النادي لهذا اليوم.</p></div><button class="btn btn-primary" data-page="users">+ إضافة سباح</button></section><div class="stats-grid"><div class="stat-card"><span class="stat-icon blue">♙</span><small>إجمالي السباحين</small><strong>${state.swimmers.length+117}</strong><em class="up">↑ 12% <i>من الشهر الماضي</i></em></div><div class="stat-card"><span class="stat-icon mint">✓</span><small>حضور اليوم</small><strong>92%</strong><em class="up">↑ 4.5% <i>من الأسبوع الماضي</i></em></div><div class="stat-card"><span class="stat-icon gold">▣</span><small>بطاقات نشطة</small><strong>108</strong><em class="neutral">مستقر <i>هذا الشهر</i></em></div><div class="stat-card"><span class="stat-icon red">!</span><small>طلبات معلقة</small><strong>06</strong><em class="down">↓ 2 <i>من الأسبوع الماضي</i></em></div></div><div class="content-grid"><section class="panel chart-panel"><div class="panel-head"><div><h3>نسبة الحضور</h3><p>آخر 7 أيام</p></div><select><option>هذا الأسبوع</option><option>هذا الشهر</option></select></div><div class="chart"><div class="chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="bars">${[72,88,67,93,81,96,92].map((n,i)=>`<div class="bar-wrap"><div class="bar" style="height:${n}%"><b>${n}%</b></div><small>${['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','اليوم'][i]}</small></div>`).join('')}</div></div></section><section class="panel"><div class="panel-head"><div><h3>آخر الإعلانات</h3><p>تحديثات النادي الأخيرة</p></div><a class="link" data-page="notices">عرض الكل</a></div>${state.notices.map(n=>`<div class="notice-row"><span class="notice-dot"></span><div><b>${esc(n.title)}</b><p>${esc(n.text)}</p><small>${n.date}</small></div></div>`).join('')}</section></div><section class="panel quick-panel"><div class="panel-head"><div><h3>الوصول السريع</h3><p>أكثر العمليات استخدامًا</p></div></div><div class="quick-actions"><button data-page="attendance">✓ <span>تسجيل الحضور</span></button><button data-page="users">♙ <span>إدارة السباحين</span></button><button data-page="schedule">▦ <span>عرض البرنامج</span></button><button data-page="card">▣ <span>طباعة بطاقة</span></button></div></section>`; }
function usersPage(){return `<div class="toolbar"><div class="search">⌕<input placeholder="ابحث عن سباح..." id="search"></div><button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button></div><section class="panel table-panel"><div class="panel-head"><div><h3>قائمة السباحين</h3><p>${state.swimmers.length} سجلات تجريبية — الموسم 2026/2027</p></div><button class="filter">تصفية ▾</button></div><div class="table-scroll"><table><thead><tr><th>السباح</th><th>رقم الانخراط</th><th>المجموعة</th><th>الهاتف</th><th>الحالة</th><th></th></tr></thead><tbody>${state.swimmers.map(s=>`<tr><td><span class="table-avatar">${s.name[0]}</span><b>${esc(s.name)}</b></td><td>${s.id}</td><td>${s.group}</td><td dir="ltr">${s.phone}</td><td><span class="status ${s.status==='نشط'?'success':'pending'}">${s.status}</span></td><td><button class="row-more">•••</button></td></tr>`).join('')}</tbody></table></div></section>`;}
function schedulePage(){const rows=[['السبت','16:00 - 17:30','المبتدئون','المدرب سليم'],['الأحد','17:00 - 18:30','المتوسطون','المدرب سليم'],['الإثنين','16:00 - 18:00','المتقدمون','المدربة نادية'],['الثلاثاء','17:00 - 18:30','المبتدئون','المدرب سليم'],['الخميس','16:00 - 18:00','المتقدمون','المدربة نادية']];return `<div class="toolbar"><div class="week-switch"><button>‹</button><b>05 — 11 أكتوبر 2026</b><button>›</button></div><button class="btn btn-primary">+ إضافة حصة</button></div><section class="schedule-grid">${['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map(day=>{const r=rows.find(x=>x[0]===day);return `<div class="day-column"><h3>${day}<small>${r?'حصة واحدة':'راحة'}</small></h3>${r?`<article class="session"><span class="session-time">${r[1]}</span><strong>${r[2]}</strong><small>مسبح الصدارة</small><em>${r[3]}</em></article>`:'<div class="empty-day">لا توجد حصص</div>'}</div>`}).join('')}</section>`;}
function attendancePage(){return `<div class="attendance-summary"><div><b>نسبة الحضور اليوم</b><strong>92%</strong></div><div><b>حاضر</b><strong class="green">110</strong></div><div><b>غائب</b><strong class="red-text">7</strong></div><div><b>متأخر</b><strong class="orange">3</strong></div></div><section class="panel table-panel"><div class="panel-head"><div><h3>حضور حصة اليوم</h3><p>الخميس، 02 أكتوبر 2026 · مجموعة المتقدمين</p></div><button class="btn btn-primary" data-action="mark-all">تأكيد الحضور</button></div><div class="table-scroll"><table><thead><tr><th>السباح</th><th>المجموعة</th><th>وقت الدخول</th><th>الحالة</th><th>تعديل</th></tr></thead><tbody>${state.swimmers.map((s,i)=>`<tr><td><span class="table-avatar">${s.name[0]}</span><b>${s.name}</b></td><td>${s.group}</td><td>${i===2?'—':'16:'+(i+2)+'5'}</td><td><span class="status ${i===2?'pending':'success'}">${i===2?'لم يسجل':'حاضر'}</span></td><td><button class="check-btn">${i===2?'تسجيل':'✓'}</button></td></tr>`).join('')}</tbody></table></div></section>`;}
function noticesPage(){return `<div class="toolbar"><span class="page-description">أرسل تحديثات مهمة إلى السباحين والأولياء.</span><button class="btn btn-primary" data-action="add-notice">+ إعلان جديد</button></div><div class="notice-list">${state.notices.map((n,i)=>`<article class="notice-card"><span class="notice-type ${i?'blue-type':'gold-type'}">${n.type}</span><div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><small>${n.date}</small></div><button class="row-more">•••</button></article>`).join('')}</div>`;}
function cardPage(){return `<section class="card-intro"><div><span class="eyebrow">بطاقات رقمية ومطبوعة</span><h2>بطاقة الانخراط<br>هوية كل سباح.</h2><p>أنشئ بطاقات الانخراط، تحقق منها واطبعها بسهولة.</p><button class="btn btn-primary" data-action="print-card">طباعة بطاقة الانخراط</button></div><div class="membership-card"><span>النادي الرياضي الصدارة</span><b>🏊</b><strong>بطاقة العضو</strong><small>بطاقة انخراط موسمية</small><div><i>رقم العضوية</i><i>الموسم الرياضي</i></div></div></section><section class="panel"><div class="panel-head"><div><h3>بطاقات الانخراط</h3><p>البطاقات الصادرة في الموسم الحالي</p></div></div><div class="table-scroll"><table><thead><tr><th>السباح</th><th>رقم البطاقة</th><th>تاريخ الإصدار</th><th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>${state.swimmers.slice(0,2).map(s=>`<tr><td><b>${s.name}</b></td><td>${s.id}</td><td>01/09/2026</td><td>31/08/2027</td><td><span class="status success">سارية</span></td></tr>`).join('')}</tbody></table></div></section>`;}
function settingsPage(){const reqs=state.coachRequirements||[];return `<section class="panel settings"><div class="panel-head"><div><h3>إعدادات المنصة</h3><p>تحكم في بيانات النادي وتفضيلات العرض.</p></div></div><label>اسم النادي<input value="النادي الرياضي الصدارة" /></label><label>البريد الإداري<input placeholder="يُقرأ من إعدادات الخادم" /></label><label>الموسم الرياضي<select><option>الموسم الحالي</option><option>الموسم السابق</option></select></label><button class="btn btn-primary">حفظ التغييرات</button></section><section class="panel settings"><div class="panel-head"><div><h3>وثائق تسجيل المدربين</h3><p>حدد الوثائق التي يجب أن يرفعها كل متقدم قبل إرسال طلبه.</p></div><button class="btn btn-primary" data-action="save-coach-requirements">حفظ قائمة الوثائق</button></div><div id="coach-requirements">${reqs.map((r,i)=>`<div class="requirement-row"><input value="${esc(r.label)}" data-req-label="${i}"><label class="check-line"><input type="checkbox" data-req-required="${i}" ${r.required!==false?'checked':''}> إلزامية</label></div>`).join('')}</div><button class="btn btn-outline" data-action="add-coach-requirement">+ إضافة وثيقة</button></section>`;}
function bind(){document.querySelectorAll('[data-page]').forEach(e=>e.onclick=()=>{state.page=e.dataset.page;save();render()});document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>action(e.dataset.action,e));document.querySelectorAll('.close').forEach(e=>e.onclick=()=>e.closest('.modal-backdrop').remove());}
async function action(a,el){if(a==='login'){document.body.insertAdjacentHTML('beforeend',loginModal());bind();return}if(a==='close'){document.querySelector('.modal-backdrop')?.remove();return}if(a==='do-login'){const email=$('#email').value,password=$('#password').value;const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email,password})});const data=await res.json();if(!res.ok){alert(data.error||'تعذر تسجيل الدخول');return}state.user=data.user;state.page='home';save();document.querySelector('.modal-backdrop')?.remove();await syncApi();render();return}if(a==='logout'){await fetch('/api/logout',{method:'POST',credentials:'same-origin'});state.user=null;state.page='home';save();render();return}if(a==='theme'){state.dark=!state.dark;save();render();return}if(a==='refresh-data'){await syncApi();render();return}if(a==='approve-app'){await fetch('/api/applications/'+el.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({status:'approved'})});await syncApi();render();return}if(a==='edit-app'){const code=prompt('نوع الاشتراك: season أو quarter أو agreement','quarter');if(code){const transport=confirm('إضافة النقل 900 دج؟');const uniform=confirm('إضافة البدلة الرياضية 2500 دج؟');await fetch('/api/applications/'+el.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({subscription_code:code,transport,uniform})});await syncApi();render()}return}if(a==='register'){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop"><div class="modal"><button class="close" data-action="close">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>طلب التسجيل</h2><p>سجّل طلبك وسيقوم رئيس الجمعية بمراجعته.</p></div><label>الاسم واللقب<input id="reg-name" placeholder="اكتب الاسم الكامل"></label><label>رقم الهاتف<input id="reg-phone" placeholder="05xx xx xx xx"></label><label>الفئة<select id="reg-category"><option value="minor">أصاغر</option><option value="adult">أكابر</option></select></label><label>تاريخ الميلاد<input id="reg-birth" type="date"></label><label>الاشتراك<select id="reg-plan"><option value="quarter">فصلي — 1000 دج</option><option value="season">موسمي — 3000 دج</option><option value="agreement">اتفاقية — 3000 دج</option></select></label><label>الخدمات الإضافية <span class="page-description">النقل والبدلة تضافان للمبلغ</span></label><label><input id="reg-transport" type="checkbox"> النقل</label><label><input id="reg-uniform" type="checkbox"> البدلة الرياضية</label><button class="btn btn-primary full" data-action="send-request">إرسال الطلب</button></div></div>`);bind();return}if(a==='send-request'){const name=$('#reg-name').value.trim().split(' ');const payload={first_name_ar:name.shift()||'',last_name_ar:name.join(' ')||'',phone:$('#reg-phone').value,birth_date:$('#reg-birth').value,category:$('#reg-category').value,subscription_code:$('#reg-plan').value,transport:$('#reg-transport').checked,uniform:$('#reg-uniform').checked};const res=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok){alert(data.error||'تعذر إرسال الطلب');return}alert('تم إرسال الطلب رقم '+data.application_no+' والمبلغ المتوقع '+data.expected_amount+' دج');document.querySelector('.modal-backdrop')?.remove();return}if(a==='add-swimmer'){alert('يمكن إضافة السباحين من خلال طلبات التسجيل بعد اعتمادها.');return}if(a==='add-notice'){alert('الإعلانات متصلة بقاعدة البيانات في الخادم.');return}if(a==='print-card'){window.print();return}if(a==='mark-all'){alert('تم تأكيد حضور الحصة بنجاح.');}}
async function recordPendingAttendance(){const id=new URLSearchParams(location.search).get('attendance');if(!id||!state.user)return;const res=await fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({member_id:id,status:'present'})});if(res.ok)showToast('تم تسجيل حضور السباح بنجاح.');else showToast('تعذر تسجيل الحضور، تحقق من صلاحية الحساب.','error');history.replaceState({},'',location.pathname+location.hash)}
async function syncApi(){try{const [sw,nt,apps,plans,reqs]=await Promise.all([fetch('/api/swimmers',{credentials:'same-origin'}),fetch('/api/notices',{credentials:'same-origin'}),fetch('/api/applications',{credentials:'same-origin'}),fetch('/api/subscriptions',{credentials:'same-origin'}),fetch('/api/coach-requirements')]);if(sw.ok)state.swimmers=(await sw.json()).map(x=>({id:x.membership_no,name:x.name,group:x.group_name,phone:x.phone,status:x.status==='active'?'نشط':'بانتظار'}));if(nt.ok)state.notices=(await nt.json()).map(x=>({title:x.title,text:x.text,date:x.date,type:x.kind}));if(apps.ok)state.applications=await apps.json();if(plans.ok)state.subscriptions=await plans.json();if(reqs.ok)state.coachRequirements=await reqs.json();save()}catch(e){console.warn('API sync unavailable',e)}}
async function boot(){
  if(state.user){
    try{const res=await fetch('/api/session',{credentials:'same-origin'});if(!res.ok)state.user=null;else{const data=await res.json();state.user=data.user;await syncApi()}}catch(e){state.user=null}
  }
  save();render();
}
boot();

function fullRegisterModal(){return `<div class="modal-backdrop"><div class="modal registration-modal"><button class="close" data-action="close">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>استمارة التسجيل</h2><p>بطاقة المعلومات الرسمية لنادي الصدارة</p></div><div class="form-section-title">1. الاختيار الرياضي والاشتراك</div><label>الرياضة<select id="reg-sport"><option>السباحة</option><option>العدو الريفي</option><option>العدو السريع</option></select></label><label>الفئة<select id="reg-category"><option value="minor">أصاغر — بيانات الولي مطلوبة</option><option value="adult">أكابر — تسجيل مباشر</option></select></label><label>الاشتراك<select id="reg-plan"><option value="quarter">فصلي — 1000 دج</option><option value="season">موسمي — 3000 دج</option><option value="agreement">اتفاقية — 3000 دج</option></select></label><label>المسبح أو المنشأة<select id="reg-facility"><option>المسبح الأولمبي</option><option>المسبح النصف أولمبي</option><option>الملعب البلدي</option><option>غابة غرداية</option></select></label><label class="check-line"><input id="reg-transport" type="checkbox"> النقل — 900 دج</label><label class="check-line"><input id="reg-uniform" type="checkbox"> البدلة الرياضية — 2500 دج</label><label>طريقة الدفع<select id="reg-payment"><option value="cash">نقدًا</option><option value="postal_check">صك بريدي</option><option value="postal_transfer">حوالة بريدية</option></select></label><div class="form-section-title">2. معلومات الرياضي</div><div class="form-two"><label>الاسم بالعربية *<input id="reg-first-ar"></label><label>اللقب بالعربية *<input id="reg-last-ar"></label><label>الاسم بالفرنسية<input id="reg-first-fr"></label><label>اللقب بالفرنسية<input id="reg-last-fr"></label><label>رقم التعريف الوطني<input id="reg-nin"></label><label>رقم شهادة الميلاد<input id="reg-birth-cert"></label><label>بلدية الميلاد<input id="reg-birth-place"></label><label>الولاية<input id="reg-wilaya" placeholder="غرداية"></label></div><label>تاريخ الميلاد *<input id="reg-birth" type="date"></label><div class="form-two"><label>الجنس<select id="reg-gender"><option>ذكر</option><option>أنثى</option></select></label><label>فصيلة الدم<select id="reg-blood"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label><label>المستوى الرياضي<select id="reg-level"><option>مبتدئ</option><option>متوسط</option><option>متقدم</option><option>نخبة</option></select></label><label>الهاتف *<input id="reg-phone" placeholder="05xx xx xx xx"></label></div><label>رقم واتساب<input id="reg-whatsapp"></label><label>العنوان *<input id="reg-address"></label><label>الصورة الشخصية<input id="reg-photo" type="file" accept="image/*"></label><div class="form-section-title">3. معلومات الولي والتصريح</div><div class="form-two"><label>اسم الولي<input id="reg-guardian-first"></label><label>لقب الولي<input id="reg-guardian-last"></label><label>صلة القرابة<input id="reg-guardian-relation" value="الأب"></label><label>هاتف الولي<input id="reg-guardian-phone"></label></div><label>رقم تعريف الولي<input id="reg-guardian-nin"></label><label class="check-line"><input id="reg-guardian-consent" type="checkbox"> أقر بصحة المعلومات وأوافق على ممارسة النشاط الرياضي</label><div class="official-docs"><a href="assets/registration-card.jpg" target="_blank">معاينة بطاقة التسجيل الرسمية</a><a href="assets/internal-regulations.jpg" target="_blank">معاينة النظام الداخلي</a></div><button class="btn btn-primary full" data-action="send-full-request">إرسال طلب التسجيل</button></div></div>`}
function coachRegisterModal() {
  const reqs = state.coachRequirements || [];
  return `<div class="modal-backdrop"><div class="modal registration-modal"><button class="close" data-action="close">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>تسجيل مدرب</h2><p>يرسل الطلب إلى رئيس النادي للمراجعة والموافقة أو الرفض.</p></div><div class="form-section-title">معلومات المدرب والحساب الآمن</div><div class="form-two"><label>الاسم واللقب *<input id="coach-name" required></label><label>البريد الإلكتروني *<input id="coach-email" type="email" required></label><label>رقم الهاتف *<input id="coach-phone" type="tel" required></label><label>كلمة مرور الحساب *<input id="coach-password" type="password" minlength="6" required></label><label>سنوات الخبرة<input id="coach-experience" type="number" min="0"></label></div><label>التخصص والشهادة<input id="coach-specialty" placeholder="مدرب سباحة، منقذ، ..."></label><label>ملاحظات إضافية<textarea id="coach-notes" rows="3"></textarea></label><div class="form-section-title">الوثائق المطلوبة</div><p class="page-description">يرجى جمع الوثائق التالية في ملف PDF واحد، ثم رفعه. الحد الأقصى 10 ميغابايت.</p><ul class="coach-requirements">${reqs.map(r=>`<li>${r.required!==false?'* ':''}${esc(r.label)}</li>`).join('')}</ul><label>ملف الوثائق PDF *<input id="coach-pdf" type="file" accept="application/pdf" required></label><button class="btn btn-primary full" data-action="send-coach-request">إنشاء الحساب وإرسال الطلب</button></div></div>`;
}
async function uploadCoachPdf(file, applicationNo) {
  if (!file || file.type !== 'application/pdf') throw new Error('يجب رفع ملف PDF فقط');
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم ملف PDF يتجاوز 10 ميغابايت');
  if (!window.firebase || !firebase.storage) throw new Error('تخزين الملفات غير مفعّل بعد');
  const ref = firebase.storage().ref(`coach-applications/${firebase.auth().currentUser.uid}/${applicationNo}.pdf`);
  const snapshot = await ref.put(file, { contentType: 'application/pdf' });
  return { path: ref.fullPath, name: file.name, size: file.size };
}
const legacyAction = action;
function setupRegistrationMode() {
  /* Everything below is scoped to the modal. The landing page carries its own
     control with the same data-action, and a document-wide query would find that
     one instead -- which is how the modal's own print button went missing. */
  const modal = document.querySelector('.registration-modal');
  const category = modal && modal.querySelector('#reg-category');
  const sectionTitle = modal && [...modal.querySelectorAll('.form-section-title')].find(x => x.textContent.includes('معلومات الولي'));
  if (!category || !sectionTitle) return;
  const SUBMIT = '[data-action="send-full-request"]';
  /* Everything from the guardian heading up to, but not including, the submit
     button belongs to a minor. querySelector alone is not enough: it never
     matches the element itself, so the walk went straight past the submit button
     and hid it together with the guardian fields -- which left an adult with no
     way to send a registration at all. */
  const guardianNodes = [];
  let node = sectionTitle;
  while (node) {
    if (node.matches?.(SUBMIT) || node.querySelector?.(SUBMIT)) break;
    guardianNodes.push(node);
    node = node.nextElementSibling;
  }
  const submit = modal.querySelector(SUBMIT);
  const DOCS = '.attached-registration-forms';
  if (submit && !modal.querySelector(DOCS)) submit.insertAdjacentHTML('beforebegin','<div class="official-docs attached-registration-forms"><a href="form-registration-01.jpg" target="_blank" rel="noopener">استمارة النادي</a><a href="internal-regulations.jpg" target="_blank" rel="noopener">النظام الداخلي</a><a href="form-registration-02.jpg" target="_blank" rel="noopener">استمارة النظام</a><a href="registration-card.jpg" target="_blank" rel="noopener">نموذج بطاقة الانخراط</a></div>');
  if (submit && !modal.querySelector('[data-action="print-registration-form"]')) submit.insertAdjacentHTML('beforebegin','<button class="btn btn-outline full" data-action="print-registration-form">طباعة نموذج التسجيل A4</button>');
  /* Only the previews of the guardian's paperwork go away for an adult. An adult
     fills in the same official form and prints the same official form, so the
     print button stays, and so does the submit button. */
  const adultNodes = [...modal.querySelectorAll(DOCS)];
  const toggle = () => {
    const visible = category.value === 'minor';
    guardianNodes.forEach(x => { x.hidden = !visible; });
    adultNodes.forEach(x => { x.hidden = !visible; });
    if (!visible) guardianNodes.forEach(x => x.querySelectorAll?.('input').forEach(i => { if (i.type !== 'checkbox') i.value = ''; i.checked = false; }));
  };
  category.addEventListener('change', toggle); toggle();
  bind();
}
function printRegistrationForm() {
  const w = printWindow();
  if (!w) { showToast('اسمح بالنوافذ المنبثقة لطباعة النموذج.','error'); return; }
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نموذج تسجيل نادي الصدارة</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#10233b}h1{text-align:center;color:#0b315e;margin:0 0 5px}h2{font-size:15px;background:#eef5ff;border-right:4px solid #1769e0;padding:8px;margin:18px 0 10px}.sub{text-align:center;color:#64748b;font-size:12px}.line{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:10px 0}.field{border-bottom:1px solid #8fa1b5;min-height:25px;font-size:12px}.field b{display:block;font-size:10px;color:#64748b;margin-bottom:4px}.box{height:70px;border:1px solid #8fa1b5;margin-top:10px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}.footer{margin-top:35px;text-align:center;font-size:10px;color:#64748b}</style></head><body><h1>النادي الرياضي الصدارة — فوج السباحة</h1><div class="sub">نموذج تسجيل رسمي | الموسم الرياضي 2026 / 2027</div><h2>1. معلومات الرياضي</h2><div class="line"><div class="field"><b>الاسم واللقب بالعربية</b></div><div class="field"><b>الاسم واللقب بالفرنسية</b></div><div class="field"><b>تاريخ ومكان الميلاد</b></div><div class="field"><b>رقم الهاتف</b></div><div class="field"><b>رقم التعريف الوطني</b></div><div class="field"><b>المستوى الرياضي</b></div></div><h2>2. الاشتراك والنشاط</h2><div class="line"><div class="field"><b>الرياضة / التخصص</b></div><div class="field"><b>نوع الاشتراك</b></div><div class="field"><b>المنشأة أو المسبح</b></div><div class="field"><b>طريقة الدفع</b></div></div><h2>3. معلومات الولي والتصريح — تُملأ للأصاغر فقط</h2><div class="line"><div class="field"><b>اسم ولقب الولي</b></div><div class="field"><b>صلة القرابة</b></div><div class="field"><b>هاتف الولي</b></div><div class="field"><b>رقم تعريف الولي</b></div></div><div class="box"><b>التصريح والملاحظات</b></div><div class="sign"><div>توقيع الولي: __________________</div><div>توقيع الإدارة: __________________</div></div><div class="footer">العنوان: حي الثنية - غرداية | الهاتف: 0660 60 64 67 | البريد: nadisadara@gmail.com</div><script>window.onload=()=>window.print();</script></body></html>`); w.document.close();
}
action = async function(a,el){
  if(a==='coach-register'){
    try { const res=await fetch('/api/coach-requirements'); if(res.ok) state.coachRequirements=await res.json(); } catch (_) {}
    document.body.insertAdjacentHTML('beforeend',coachRegisterModal()); bind(); return;
  }
  if(a==='send-coach-request'){
    const file=$('#coach-pdf')?.files?.[0]; const name=$('#coach-name').value.trim(); const email=$('#coach-email').value.trim(); const phone=$('#coach-phone').value.trim(); const password=$('#coach-password').value;
    if(!name||!email||!phone||!password||password.length<6||!file){showToast('أكمل المعلومات، استخدم كلمة مرور من 6 رموز على الأقل، وارفع ملف PDF.','error');return}
    try {
      try { await firebase.auth().createUserWithEmailAndPassword(email,password); } catch (authError) { if (authError.code === 'auth/email-already-in-use') await firebase.auth().signInWithEmailAndPassword(email,password); else throw authError; }
      const applicationNo='COACH-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(16).slice(2,6).toUpperCase();
      const documents=await uploadCoachPdf(file,applicationNo);
      const payload={application_no:applicationNo,application_type:'coach',applicant_uid:firebase.auth().currentUser.uid,coach_name:name,coach_email:email,coach_phone:phone,coach_experience:$('#coach-experience').value,coach_specialty:$('#coach-specialty').value,coach_notes:$('#coach-notes').value,documents,status:'pending'};
      const res=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await res.json();
      if(!res.ok) throw new Error(data.error||'تعذر إرسال الطلب');
      document.querySelector('.modal-backdrop')?.remove(); showToast('تم إرسال طلب المدرب. سيظهر لرئيس النادي للموافقة أو الرفض.');
    } catch(error){showToast(error.message||'تعذر إرسال الطلب','error')}
    return;
  }
  if(a==='add-coach-requirement'){const box=$('#coach-requirements');if(box)box.insertAdjacentHTML('beforeend','<div class="requirement-row"><input placeholder="اسم الوثيقة" data-req-label><label class="check-line"><input type="checkbox" data-req-required checked> إلزامية</label></div>');return}
  if(a==='save-coach-requirements'){
    const requirements=[...document.querySelectorAll('[data-req-label]')].map((input,i)=>({label:input.value.trim(),required:document.querySelectorAll('[data-req-required]')[i]?.checked!==false})).filter(x=>x.label);
    const res=await fetch('/api/coach-requirements',{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({requirements})}); if(!res.ok){const d=await res.json();showToast(d.error||'تعذر حفظ القائمة','error');return} state.coachRequirements=requirements;showToast('تم حفظ قائمة الوثائق المطلوبة.');render();return;
  }
  if(a==='reject-app'){const reason=prompt('سبب رفض الطلب:','الوثائق ناقصة');if(reason===null)return;await fetch('/api/applications/'+el.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({status:'rejected',decision_reason:reason})});await syncApi();render();return}
  if(a==='register'){document.querySelector('.modal-backdrop')?.remove();document.body.insertAdjacentHTML('beforeend',fullRegisterModal());bind();setupRegistrationMode();return}
  if(a==='send-full-request'){
    const payload={sport:$('#reg-sport').value,category:$('#reg-category').value,swimming_strokes:($('#reg-strokes')||{value:''}).value,subscription_code:$('#reg-plan').value,facility:$('#reg-facility').value,transport:$('#reg-transport').checked,uniform:$('#reg-uniform').checked,payment_method:$('#reg-payment').value,first_name_ar:$('#reg-first-ar').value,last_name_ar:$('#reg-last-ar').value,first_name_fr:$('#reg-first-fr').value,last_name_fr:$('#reg-last-fr').value,national_id:$('#reg-nin').value,birth_certificate_no:$('#reg-birth-cert').value,birth_place:$('#reg-birth-place').value,wilaya:$('#reg-wilaya').value,birth_date:$('#reg-birth').value,gender:$('#reg-gender').value,blood_group:$('#reg-blood').value,level:$('#reg-level').value,phone:$('#reg-phone').value,whatsapp:$('#reg-whatsapp').value,address:$('#reg-address').value,guardian_first_name:$('#reg-guardian-first').value,guardian_last_name:$('#reg-guardian-last').value,guardian_relation:$('#reg-guardian-relation').value,guardian_phone:$('#reg-guardian-phone').value,guardian_national_id:$('#reg-guardian-nin').value,guardian_consent:$('#reg-guardian-consent').checked};
    if(!payload.first_name_ar||!payload.last_name_ar||!payload.birth_date||!payload.phone||!payload.address){alert('يرجى إكمال الحقول الإلزامية');return}
    const res=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok){alert(data.error||'تعذر إرسال الطلب');return}alert('تم إرسال الطلب رقم '+data.application_no+' والمبلغ المتوقع '+data.expected_amount+' دج');document.querySelector('.modal-backdrop')?.remove();return
  }
  return legacyAction(a,el);
};const adminDashboard=dashboard;
dashboard=function(){return ['coach','swimmer_adult','swimmer_minor','parent','member'].includes(state.user?.role)?roleDashboard():adminDashboard()};
const currentAction=action;
function authMessage(text, kind='info') {
  const box = document.querySelector('#auth-message');
  if (box) { box.textContent = text; box.className = 'form-message ' + kind; }
}
/* Turns a sign-in failure into something a member can act on. A Firebase error
   code on its own means nothing to the person standing at the club desk. */
const LOGIN_MESSAGES = {
  'auth/configuration-not-found': 'تسجيل الدخول غير مُهيّأ على هذه المنصة بعد. أبلغ مسيّر النادي ليجهّز الحسابات.',
  'auth/operation-not-allowed': 'الدخول بالبريد وكلمة المرور غير مفعّل. أبلغ مسيّر النادي.',
  'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
  'auth/user-disabled': 'هذا الحساب موقوف. أبلغ مسيّر النادي.',
  'auth/too-many-requests': 'محاولات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.',
  'auth/network-request-failed': 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.'
};
function loginFailure(data){
  const code = data && data.code ? String(data.code) : '';
  if (LOGIN_MESSAGES[code]) return LOGIN_MESSAGES[code];
  const raw = data && data.error ? String(data.error) : '';
  /* A string straight from the identity service or the SDK is not an
     explanation, so it never reaches a member. Anything the platform wrote
     itself is Arabic and is passed through. */
  const fromLibrary = /^Firebase:|^Error:|^API\b|api[- ]key|auth\/|identitytoolkit|permission[-_]denied|Missing or invalid/i.test(raw);
  if (!raw.trim() || fromLibrary || !/[؀-ۿ]/.test(raw)) return 'تعذّر تسجيل الدخول. حاول مرة أخرى، وإن استمر الأمر أبلغ مسيّر النادي.';
  return raw;
}

function showToast(text, kind='success') {
  document.querySelector('.toast-message')?.remove();
  const node = document.createElement('div'); node.className = 'toast-message ' + kind; node.textContent = text;
  document.body.appendChild(node); setTimeout(() => node.remove(), 5000);
}
function phoneRecoveryModal() {
  document.querySelector('.modal-backdrop')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop"><div class="modal auth-modal"><button class="close" data-action="close">×</button><div class="modal-heading"><span class="logo auth-logo">🏊</span><h2>الدخول عبر الهاتف</h2><p>تحقق من رقمك برسالة SMS للوصول الآمن.</p></div><div class="form-message" id="phone-message" role="status"></div><label>رقم الهاتف<input id="phone-number" type="tel" autocomplete="tel" placeholder="+213 5xx xx xx xx"></label><div id="recaptcha-container"></div><button class="btn btn-primary full" data-action="send-phone-code">إرسال رمز التحقق</button><label id="phone-code-wrap" hidden>رمز التحقق<input id="phone-code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></label><button class="btn btn-sms full" data-action="verify-phone-code" hidden>تأكيد الرمز والدخول</button><p class="hint">هذه الطريقة تتحقق من الهاتف وتتيح الدخول للحساب المرتبط به. إعادة تعيين كلمة مرور البريد تتم عبر رابط البريد الإلكتروني.</p></div></div>`); bind();
}
action=async function(a,el){
  if(a==='add-group'){const name=prompt('اسم الفوج');if(!name)return;const coach=prompt('اسم المدرب المشرف','المدرب سليم')||'غير محدد';const schedule=prompt('البرنامج الأسبوعي','السبت · 16:00')||'يحدد لاحقًا';state.groups.push({id:'g'+Date.now(),name,coach,schedule});save();render();showToast('تمت إضافة الفوج والمدرب.');return}
  if(a==='edit-group'){const g=state.groups.find(x=>x.id===el.dataset.group);if(!g)return;g.coach=prompt('المدرب المشرف',g.coach)||g.coach;g.schedule=prompt('البرنامج الأسبوعي',g.schedule)||g.schedule;save();render();return}
  if(a==='print-a4'||a==='print-group'){window.print();return}
  if(a==='print-cards'){window.print();return}
  if(a==='do-login'){
    const email=$('#email')?.value.trim(), password=$('#password')?.value;
    if(!email||!password){authMessage('أدخل البريد الإلكتروني وكلمة المرور.','error');return}
    let data=null;
    try{
      const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email,password})});
      data=await res.json().catch(()=>({}));
      if(!res.ok){authMessage(loginFailure(data),'error');return}
    }catch(_){
      authMessage('تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.','error');return;
    }
state.user=data.user;state.page='home';save();document.querySelector('.modal-backdrop')?.remove();await syncApi();await recordPendingAttendance();render();showToast('تم تسجيل الدخول بنجاح.');return;
  }
  if(a==='forgot-password'){
    const email=$('#email')?.value.trim();
    if(!email){authMessage('اكتب بريدك الإلكتروني أولًا لاستلام رابط الاستعادة.','error');return}
    try { await firebase.auth().sendPasswordResetEmail(email); authMessage('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. افحص البريد غير المرغوب فيه أيضًا.','success'); }
    catch(e){ authMessage(e.code==='auth/user-not-found'?'لا يوجد حساب بهذا البريد.':(e.message||'تعذر إرسال رابط الاستعادة.'),'error'); }
    return;
  }
  if(a==='phone-login'){phoneRecoveryModal();return}
  if(a==='send-phone-code'){
    const phone=$('#phone-number')?.value.trim(); const box=$('#phone-message');
    if(!phone){if(box){box.textContent='أدخل رقم الهاتف بصيغة دولية مثل +213...';box.className='form-message error'}return}
    try{
      window.sadaraRecaptcha ||= new firebase.auth.RecaptchaVerifier('recaptcha-container',{size:'invisible'});
      window.sadaraPhoneConfirmation=await firebase.auth().signInWithPhoneNumber(phone,window.sadaraRecaptcha);
      $('#phone-code-wrap').hidden=false; document.querySelector('[data-action="verify-phone-code"]').hidden=false; document.querySelector('[data-action="send-phone-code"]').disabled=true;
      if(box){box.textContent='أُرسل الرمز. أدخله خلال دقائق لإكمال الدخول.';box.className='form-message success'}
    }catch(e){if(box){box.textContent='تعذر إرسال الرمز. تأكد من الرقم وتفعيل Phone Authentication في Firebase.';box.className='form-message error'}console.error(e)}
    return;
  }
  if(a==='verify-phone-code'){
    const code=$('#phone-code')?.value.trim(); const box=$('#phone-message');
    /* The role must come from the account, never be assumed. Signing in by SMS
       used to hardcode 'member', so the club owner arriving on a phone number was
       quietly made a member. Ask the same session endpoint the email path uses. */
    try{const credential=await window.sadaraPhoneConfirmation.confirm(code);
      let user={id:credential.user.uid,name:credential.user.phoneNumber||'عضو النادي',role:'member',email:''};
      try{const res=await fetch('/api/session',{credentials:'same-origin'});
        if(res.ok){const data=await res.json();if(data&&data.user)user=data.user;}}catch(_){}
      state.user=user;state.page='home';save();document.querySelector('.modal-backdrop')?.remove();await syncApi();render();showToast('تم التحقق من رقم الهاتف وتسجيل الدخول.');}
    catch(e){if(box){box.textContent='الرمز غير صحيح أو منتهي الصلاحية.';box.className='form-message error'}}
    return;
  }
  if(a==='add-swimmer'){
    const name=prompt('اسم السباح الكامل'); if(!name)return;
    const phone=prompt('رقم الهاتف',''); const group=prompt('المجموعة','المبتدئون');
    const res=await fetch('/api/swimmers',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name,phone,group_name:group})});
    const data=await res.json(); if(!res.ok){alert(data.error||'تعذر إضافة السباح');return} await syncApi();render();return;
  }
  if(a==='add-notice'){
    const title=prompt('عنوان الإعلان'); if(!title)return; const body=prompt('نص الإعلان','');
    const res=await fetch('/api/notices',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({title,body,kind:'إعلان'})});
    const data=await res.json(); if(!res.ok){alert(data.error||'تعذر إضافة الإعلان');return} await syncApi();render();return;
  }
  if(a==='print-registration-form'){printRegistrationForm();return}
  if(a==='notification'){state.page='notices';save();render();return}
  return currentAction(a,el);
};
document.addEventListener('click',e=>{if(e.target.closest('.notification'))action('notification')});
document.addEventListener('click',e=>{const link=e.target.closest('.official-docs a');if(!link)return;const file=link.getAttribute('href').split('/').pop();const files={'form-registration-01.jpg':'assets/form-registration-01.jpg','form-registration-02.jpg':'assets/form-registration-02.jpg','registration-card.jpg':'assets/registration-card.jpg','internal-regulations.jpg':'assets/internal-regulations.jpg'};const target=files[file];if(!target){e.preventDefault();return}const url=new URL(target,document.baseURI).href;if(new URL(url,location.href).origin===location.origin){e.preventDefault();window.open(url,'_blank','noopener')}});

const oldPageView=pageView;
pageView=function(p){if(p==='groups')return groupsPage();if(p==='card')return enhancedCardPage();return oldPageView(p);};
const oldRender=render;
render=function(){oldRender();buildQRCodes();};
buildQRCodes=function(){document.querySelectorAll('.qr-code').forEach(el=>{if(!window.QRCode||el.childElementCount)return;new QRCode(el,{text:location.origin+'/?attendance='+encodeURIComponent(el.dataset.qr),width:64,height:64,colorDark:'#071a35',colorLight:'#ffffff'});});};
setTimeout(()=>{if(state.user)recordPendingAttendance();},0);

/* ==========================================================
   Sadara Core — طباعة، بيانات حقيقية، وواجهة المدربين والرياضيين
   ========================================================== */
const CLUB={name:'النادي الرياضي الصدارة',unit:'فوج السباحة',address:'حي الثنية — غرداية',city:'غرداية',phone:'0660 60 64 67',email:'nadisadara@gmail.com',facebook:'https://www.facebook.com/nadiSadara47/',season:'2026 / 2027'};
const AR_MONTHS=['جانفي','فيفري','مارس','أفريل','ماي','جوان','جويلية','أوت','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const AR_DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const WEEK_DAYS=['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const ATTENDANCE_LABELS={present:'حاضر',absent:'غائب',late:'متأخر',excused:'بعذر'};
const pad2=n=>String(n).padStart(2,'0');
const isoDay=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const todayISO=()=>isoDay(new Date());
const longDate=(d=new Date())=>`${AR_DAYS[d.getDay()]}، ${pad2(d.getDate())} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const money=v=>`${Number(v||0).toLocaleString('en-US')} دج`;
const sum=(list,f)=>list.reduce((t,x)=>t+(Number(typeof f==='function'?f(x):x[f])||0),0);
const stateLabel=s=>s==='approved'?'مقبول':s==='rejected'?'مرفوض':s==='paid'?'مدفوع':s==='cancelled'?'ملغى':'قيد المراجعة';
const planName=code=>(state.subscriptions||[]).find(p=>p.code===code)?.name||code||'—';
const catLabel=c=>c==='minor'?'أصاغر':c==='adult'?'أكابر':c==='coach'?'مدرب':c||'—';
const appName=a=>a.application_type==='coach'?(a.coach_name||'مدرب'):`${a.first_name_ar||''} ${a.last_name_ar||''}`.trim()||a.application_no||'—';
const appContact=a=>a.application_type==='coach'?(a.coach_phone||a.coach_email||''):(a.phone||'');
const emptyRow=(cols,text)=>`<tr><td colspan="${cols}" class="empty-cell">${esc(text)}</td></tr>`;
function firstName(){const n=(state.user?.name||'').trim();return n?n.split(/\s+/)[0]:'عضو النادي';}
function groups(){return state.groups||[];}
function swimmersOf(name){return (state.swimmers||[]).filter(s=>String(s.group||'').trim()===String(name||'').trim());}

/* ---------------------- محرك الطباعة ---------------------- */
let printReset=null;
function stopPrint(){if(typeof printReset==='function'){const f=printReset;printReset=null;f();}}
function printArea(source,options={}){
  const node=typeof source==='string'?document.querySelector(source):source;
  if(!node||!node.children.length){showToast('لا توجد بيانات متاحة للطباعة.','error');return null}
  const host=document.createElement('div');
  host.className='print-host';
  const head=document.createElement('header');
  head.className='print-head';
  head.innerHTML='<div class="print-head-main"><b>'+esc(CLUB.name)+' — '+esc(CLUB.unit)+'</b><span class="print-head-title">'+esc(options.title||'تقرير')+'</span>'+(options.sub?'<span class="print-head-sub">'+esc(options.sub)+'</span>':'')+'</div>'
    +'<div class="print-head-side"><span>الموسم '+esc(CLUB.season)+'</span><span>'+esc(options.date||longDate())+'</span></div>';
  const body=document.createElement('div');
  body.className='print-body'+(options.variant?' print-'+options.variant:'');
  while(node.firstChild) body.appendChild(node.firstChild);
  host.appendChild(head);
  host.appendChild(body);
  if(options.notes) host.insertAdjacentHTML('beforeend','<div class="print-notes">'+options.notes+'</div>');
  host.insertAdjacentHTML('beforeend','<footer class="print-foot"><span>'+esc(CLUB.address)+' — هاتف: <span dir="ltr">'+esc(CLUB.phone)+'</span></span><span>'+esc(CLUB.email)+'</span></footer>');
  $('#app').appendChild(host);
  document.body.classList.add('printing');
  let done=false;
  const finish=()=>{
    if(done)return;
    done=true;
    printReset=null;
    document.body.classList.remove('printing');
    host.remove();
    window.removeEventListener('afterprint',finish);
    render();
  };
  printReset=finish;
  window.addEventListener('afterprint',finish);
  setTimeout(()=>{window.print();setTimeout(finish,1200);},80);
  return host;
}
function printPage(title,sub,notes){return printArea('#page-root',{title,sub,notes});}
function printBtn(action,label){return '<button class="btn btn-outline" data-action="'+action+'">🖨 '+esc(label||'طباعة')+'</button>';}
function buildMembersTable(list,extraHead,extraCell){
  if(!list.length) return '<p class="empty-cell">لا يوجد سباحون مسجلون في هذه القائمة.</p>';
  return '<table class="print-table"><thead><tr><th>#</th><th>الاسم واللقب</th><th>رقم الانخراط</th><th>الفوج</th><th>الهاتف</th><th>الحالة</th>'+(extraHead||'')+'<th>التوقيع</th></tr></thead><tbody>'
    +list.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.name||'')+'</b></td><td dir="ltr">'+esc(s.id||'')+'</td><td>'+esc(s.group||'—')+'</td><td dir="ltr">'+esc(s.phone||'—')+'</td><td><span class="status '+(s.status==='نشط'?'success':'pending')+'">'+esc(s.status||'—')+'</span></td>'+(extraCell?'<td>'+extraCell(s)+'</td>':'')+'<td class="sign-cell"></td></tr>').join('')
    +'</tbody></table>';
}
function printGroupRoster(groupId){
  const g=groups().find(x=>x.id===groupId);
  if(!g){showToast('تعذر العثور على بيانات الفوج.','error');return}
  const list=swimmersOf(g.name);
  const box=document.createElement('section');
  box.className='roster';
  box.innerHTML='<div class="roster-head"><div><h3>قائمة فوج '+esc(g.name)+'</h3><p>المدرب المشرف: '+esc(g.coach||'—')+' · البرنامج: '+esc(g.schedule||'—')+'</p></div><div class="roster-count"><b>'+list.length+'</b><small>سباح</small></div></div>'
    +buildMembersTable(list,'<th>الحالة اليوم</th>',s=>{const a=attendanceOf(s.id);return '<span class="status '+(a?(a.status==='present'?'success':'pending'):'pending')+'">'+(a?ATTENDANCE_LABELS[a.status]||a.status:'لم يُسجّل')+'</span>';});
  printArea(box,{title:'قائمة الفوج',sub:g.name,variant:'roster'});
}
function printGroupsSheet(){
  const box=document.createElement('section');
  box.className='roster';
  box.innerHTML='<table class="print-table"><thead><tr><th>الفوج</th><th>المدرب المشرف</th><th>البرنامج الأسبوعي</th><th>عدد السباحين</th></tr></thead><tbody>'
    +(groups().length?groups().map(g=>'<tr><td><b>'+esc(g.name)+'</b></td><td>'+esc(g.coach||'—')+'</td><td>'+esc(g.schedule||'—')+'</td><td>'+swimmersOf(g.name).length+'</td></tr>').join(''):emptyRow(4,'لا توجد أفواج مسجلة.'))
    +'</tbody></table>'
    +'<div class="roster-head" style="margin-top:10mm"><div><h3>تفصيل الأفواج</h3></div></div>'
    +(groups().length?groups().map(g=>'<h4 class="roster-group">'+esc(g.name)+' — '+swimmersOf(g.name).length+' سباح</h4>'+buildMembersTable(swimmersOf(g.name))).join(''):'');
  printArea(box,{title:'قائمة الأفواج والمدربين',variant:'roster'});
}
function printAttendanceSheet(){
  const list=state.swimmers||[];
  const box=document.createElement('section');
  box.className='roster';
  box.innerHTML='<div class="roster-head"><div><h3>كشف حضور حصة '+esc(todayISO())+'</h3><p>مسبح الصدارة · '+esc(todayISO())+'</p></div><div class="roster-count"><b>'+list.length+'</b><small>سباح</small></div></div>'
    +(list.length?buildMembersTable(list,'<th>الحالة</th><th>وقت الدخول</th>',s=>{const a=attendanceOf(s.id);return '<span class="status '+(a?(a.status==='present'?'success':'pending'):'pending')+'">'+(a?ATTENDANCE_LABELS[a.status]||a.status:'لم يُسجّل')+'</span><br><small>'+esc(a&&a.at?String(a.at).slice(11,16):'—')+'</small>';}):'<p class="empty-cell">لا يوجد سباحة مسجلون.</p>');
  printArea(box,{title:'كشف الحضور',sub:longDate(),variant:'roster'});
}
function printCardsSheet(){
  const list=state.swimmers||[];
  if(!list.length){showToast('لا توجد بطاقات لطباعتها.','error');return}
  const box=document.createElement('div');
  box.className='card-print-grid';
  box.id='card-print-grid';
  document.querySelectorAll('.print-card').forEach(c=>box.appendChild(c.cloneNode(true)));
  printArea(box,{title:'بطاقات الانخراط',sub:'مقاس 8.5 × 5.5 سم — الموسم '+CLUB.season,variant:'cards'});
}
function printSingleCard(memberId){
  const card=document.querySelector('.print-card[data-member="'+CSS.escape(String(memberId))+'"]');
  if(!card){showToast('تعذر العثور على بطاقة هذا السباح.','error');return}
  const box=document.createElement('div');
  box.className='card-print-grid print-cards-single';
  box.appendChild(card.cloneNode(true));
  printArea(box,{title:'بطاقة انخراط',sub:card.dataset.member||'',variant:'cards'});
}
function printRegistrationFormA4(){
  const list=(state.swimmers||[]).filter(s=>s.status==='نشط');
  const box=document.createElement('section');
  box.className='roster';
  box.innerHTML='<table class="print-table"><thead><tr><th>#</th><th>الاسم واللقب</th><th>رقم الانخراط</th><th>الفوج</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>'
    +(list.length?list.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.name||'')+'</b></td><td dir="ltr">'+esc(s.id||'')+'</td><td>'+esc(s.group||'—')+'</td><td dir="ltr">'+esc(s.phone||'—')+'</td><td><span class="status success">سارية</span></td></tr>').join(''):emptyRow(6,'لا توجد بطاقات سارية.'))
    +'</tbody></table>';
  printArea(box,{title:'استمارة انخراط — قائمة السباحين السارية',variant:'roster'});
}
/* ---------------------- الوصول للبيانات ---------------------- */
state.swimmers=state.swimmers||[];
state.applications=state.applications||[];
state.subscriptions=state.subscriptions||[];
state.notices=state.notices||[];
state.schedules=state.schedules||[];
state.cards=state.cards||[];
state.attendance=state.attendance||{};
state.attendanceByDay=state.attendanceByDay||{};
state.extras=state.extras||{transport:900,uniform:2500};
state.groups=state.groups||[];

function attendanceOf(id){
  const rec=(state.attendance||{})[String(id)];
  if(!rec)return null;
  const last=Array.isArray(rec)?rec[rec.length-1]:rec;
  if(!last)return null;
  return {status:last.status||'present',at:last.check_in||last.marked_at||last.time||'',date:last.session_date||last.date||''};
}
function attendanceRate(list){
  const src=list||state.swimmers||[];
  if(!src.length)return null;
  const present=src.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='present';}).length;
  return Math.round(present/src.length*100);
}
function weeklyAttendance(){
  const out=[];
  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const key=isoDay(d);
    const day=(state.attendanceByDay||{})[key]||{};
    const ids=Object.keys(day);
    out.push({key,label:AR_DAYS[d.getDay()],value:ids.length?Math.round(ids.filter(k=>day[k]==='present').length/ids.length*100):null,isToday:i===0});
  }
  return out;
}
function pendingApplications(){return (state.applications||[]).filter(a=>!a.status||a.status==='pending');}
function activeCards(){const list=(state.cards||[]).filter(c=>c.status!=='expired'&&c.status!=='cancelled');return list.length?list:(state.swimmers||[]).filter(s=>s.status==='نشط');}
function collectedAmount(){return sum((state.applications||[]).filter(a=>a.status==='approved'),'expected_amount');}
function recalcAmount(app){
  const plan=(state.subscriptions||[]).find(p=>p.code===(app.subscription_code||'quarter'));
  return (Number(plan?.amount)||0)+(app.transport?Number(state.extras.transport)||0:0)+(app.uniform?Number(state.extras.uniform)||0:0);
}

/* ---------------------- الصفحات ---------------------- */
function pageOverview(){
  const sw=state.swimmers||[];
  const pending=pendingApplications().length;
  const rate=attendanceRate();
  const cards=activeCards().length;
  const week=weeklyAttendance();
  const maxRate=week.reduce((m,d)=>Math.max(m,d.value||0),100);
  return '<section class="welcome"><div><span>'+esc(longDate())+'</span><h2>مرحبًا، '+esc(firstName())+' 👋</h2><p>إليك ملخص أداء النادي لهذا اليوم.</p></div>'
    +'<button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button></section>'
    +'<div class="stats-grid">'
    +'<div class="stat-card"><span class="stat-icon blue">♙</span><small>إجمالي السباحين</small><strong>'+sw.length+'</strong><em class="neutral">'+(sw.filter(s=>s.status==='نشط').length)+' <i>نشط</i></em></div>'
    +'<div class="stat-card"><span class="stat-icon mint">✓</span><small>حضور اليوم</small><strong>'+(rate===null?'—':rate+'%')+'</strong><em class="neutral">'+Object.keys(state.attendance).length+' <i>تسجيل اليوم</i></em></div>'
    +'<div class="stat-card"><span class="stat-icon gold">▣</span><small>بطاقات نشطة</small><strong>'+cards+'</strong><em class="neutral">'+esc(CLUB.season)+' <i>الموسم</i></em></div>'
    +'<div class="stat-card"><span class="stat-icon red">!</span><small>طلبات معلقة</small><strong>'+pad2(pending)+'</strong><em class="neutral">'+money(collectedAmount())+' <i>محصّل</i></em></div>'
    +'</div>'
    +'<div class="content-grid">'
    +'<section class="panel chart-panel"><div class="panel-head"><div><h3>نسبة الحضور</h3><p>آخر 7 أيام — من سجل الحضور</p></div><a class="link" data-page="attendance">إدارة السجل ←</a></div>'
    +'<div class="chart"><div class="chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="bars">'
    +week.map(d=>'<div class="bar-wrap'+(d.isToday?' is-today':'')+'"><div class="bar'+(d.value===null?' empty':'')+'" style="height:'+Math.max(d.value||0,2)+'%"><b>'+(d.value===null?'—':d.value+'%')+'</b></div><small>'+esc(d.label)+'</small></div>').join('')
    +'</div></div></section>'
    +'<section class="panel"><div class="panel-head"><div><h3>آخر الإعلانات</h3><p>تحديثات النادي الأخيرة</p></div><a class="link" data-page="notices">عرض الكل</a></div>'
    +((state.notices||[]).length?state.notices.slice(0,4).map(n=>'<div class="notice-row"><span class="notice-dot"></span><div><b>'+esc(n.title)+'</b><p>'+esc(n.text)+'</p><small>'+esc(n.date||'')+'</small></div></div>').join(''):'<p class="empty-cell">لا توجد إعلانات.</p>')
    +'</section></div>'
    +'<section class="panel quick-panel"><div class="panel-head"><div><h3>الوصول السريع</h3><p>أكثر العمليات استخدامًا</p></div></div><div class="quick-actions">'
    +'<button data-page="attendance">✓ <span>تسجيل الحضور</span></button>'
    +'<button data-page="users">♙ <span>إدارة السباحين</span></button>'
    +'<button data-page="applications">▤ <span>طلبات التسجيل</span></button>'
    +'<button data-action="print-cards-quick">▣ <span>طباعة البطاقات</span></button>'
    +'</div></section>';
}

function applicationFormBody(a,plans,extras){
  const options=plans.map(p=>'<option value="'+esc(p.code)+'"'+(p.code===a.subscription_code?' selected':'')+'>'+esc(p.name)+' — '+money(p.amount)+'</option>').join('');
  return '<div class="form-two">'
    +'<label>نوع الاشتراك<select id="edit-plan">'+options+'</select></label>'
    +'<label>طريقة الدفع<select id="edit-payment">'+['cash','postal_check','postal_transfer'].map(v=>'<option value="'+v+'"'+(v===(a.payment_method||'cash')?' selected':'')+'>'+({cash:'نقدًا',postal_check:'صك بريدي',postal_transfer:'حوالة بريدية'}[v]||v)+'</option>').join('')+'</select></label>'
    +'<label>المنشأة<select id="edit-facility">'+['المسبح الأولمبي','المسبح النصف أولمبي','الملعب البلدي','غابة غرداية'].map(v=>'<option'+(v===a.facility?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'
    +'<label>قراررئيس النادي<select id="edit-status">'+[['pending','قيد المراجعة'],['approved','مقبول'],['rejected','مرفوض']].map(([v,l])=>'<option value="'+v+'"'+(v===(a.status||'pending')?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'
    +'</div>'
    +'<div class="check-grid">'
    +'<label class="check-line"><input id="edit-transport" type="checkbox"'+(a.transport?' checked':'')+'> النقل — '+money(extras.transport)+'</label>'
    +'<label class="check-line"><input id="edit-uniform" type="checkbox"'+(a.uniform?' checked':'')+'> البدلة الرياضية — '+money(extras.uniform)+'</label>'
    +'</div>'
    +'<label>ملاحظة القرار<textarea id="edit-note" rows="2">'+esc(a.decision_reason||a.decision_note||'')+'</textarea></label>';
}

function pageApplications(){
  const list=state.applications||[];
  const q=(state.appQuery||'').trim();
  const f=state.appFilter||'all';
  const rows=list.filter(a=>{
    if(f!=='all'&&(a.status||'pending')!==f)return false;
    if(!q)return true;
    return (appName(a)+' '+(a.application_no||'')+' '+(appContact(a)||'')).includes(q);
  });
  const head='<div class="toolbar"><div class="search">⌕<input placeholder="ابحث بالاسم أو رقم الطلب..." id="app-search" value="'+esc(q)+'"></div>'
    +'<div class="toolbar-group">'
    +'<select class="filter" id="app-filter">'+[['all','كل الحالات'],['pending','قيد المراجعة'],['approved','مقبول'],['rejected','مرفوض']].map(([v,l])=>'<option value="'+v+'"'+(v===f?' selected':'')+'>'+l+'</option>').join('')+'</select>'
    +printBtn('print-applications','طباعة القائمة')
    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'
    +'</div></div>';
  const body='<section class="panel table-panel"><div class="panel-head"><div><h3>طلبات التسجيل والمدربين</h3><p>'+rows.length+' من '+list.length+' طلب — ملف المدربين لا يفتحه إلا رئيس النادي</p></div></div>'
    +'<div class="table-scroll"><table><thead><tr><th>رقم الطلب</th><th>المتقدم</th><th>النوع</th><th>الاشتراك</th><th>المبلغ</th><th>الوثائق</th><th>الحالة</th><th>القرار</th><th></th></tr></thead><tbody>'
    +(rows.length?rows.map(a=>'<tr><td dir="ltr">'+esc(a.application_no||a.id)+'</td>'
      +'<td><b>'+esc(appName(a))+'</b><br><small dir="ltr">'+esc(appContact(a)||'—')+'</small></td>'
      +'<td>'+esc(catLabel(a.application_type==='coach'?'coach':a.category))+'</td>'
      +'<td>'+esc(a.application_type==='coach'?'—':planName(a.subscription_code))+'<br><small>'+(a.transport?'النقل ':'')+(a.uniform?'البدلة':'')+'</small></td>'
      +'<td>'+esc(a.application_type==='coach'?'—':money(a.expected_amount))+'</td>'
      +'<td>'+(a.documents&&a.documents.path?'<button class="check-btn" data-action="open-coach-doc" data-path="'+esc(a.documents.path)+'">فتح PDF</button>':(a.documents&&a.documents.url?'<a class="link" href="'+esc(a.documents.url)+'" target="_blank" rel="noopener">PDF</a>':'—'))+'</td>'
      +'<td><span class="status '+((a.status||'pending')==='approved'?'success':(a.status||'pending')==='rejected'?'rejected':'pending')+'">'+esc(stateLabel(a.status))+'</span>'+(a.decision_reason?'<br><small>'+esc(a.decision_reason)+'</small>':'')+'</td>'
      +'<td>'+((a.status||'pending')==='pending'?'<button class="check-btn ok" data-action="approve-app" data-id="'+esc(a.id)+'">موافقة</button> <button class="check-btn no" data-action="reject-app" data-id="'+esc(a.id)+'">رفض</button>':'<small>تم القرار</small>')+'</td>'
      +'<td><button class="row-more" data-action="edit-app" data-id="'+esc(a.id)+'">•••</button></td>'
      +'</tr>').join(''):emptyRow(9,'لا توجد طلبات مطابقة. ستظهر هنا طلبات التسجيل القادمة.'))
    +'</tbody></table></div></section>';
  return head+body;
}

function pageSubscriptions(){
  const plans=state.subscriptions||[];
  const extras=state.extras||{};
  const rows='<section class="panel"><div class="panel-head"><div><h3>تعديل الأسعار والخدمات</h3><p>المبالغ بالدينار الجزائري — تُحفظ في قاعدة البيانات</p></div>'
    +'<div class="toolbar-group">'+printBtn('print-subscriptions','طباعة')+'<button class="btn btn-primary" data-action="save-plans">حفظ التغييرات</button></div></div>'
    +'<div class="plans-editor">'
    +(plans.length?plans.map(p=>'<div class="plan-row"><label class="check-line"><input type="checkbox" data-plan-active="'+esc(p.code)+'"'+(p.active===false?'':' checked')+'> نشط</label>'
      +'<input class="plan-name" data-plan-name="'+esc(p.code)+'" value="'+esc(p.name||'')+'">'
      +'<input class="plan-amount" type="number" min="0" step="50" data-plan-amount="'+esc(p.code)+'" value="'+esc(p.amount||0)+'">'
      +'<span class="plan-unit">دج / '+esc(p.duration||'موسم')+'</span></div>').join(''):'<p class="empty-cell">لا توجد اشتراكات محمّلة.</p>')
    +'</div>'
    +'<div class="plans-editor">'
    +'<div class="plan-row"><span class="plan-unit">النقل</span><input class="plan-amount" type="number" min="0" step="50" id="extra-transport" value="'+esc(extras.transport||0)+'"><span class="plan-unit">دج</span></div>'
    +'<div class="plan-row"><span class="plan-unit">البدلة الرياضية</span><input class="plan-amount" type="number" min="0" step="50" id="extra-uniform" value="'+esc(extras.uniform||0)+'"><span class="plan-unit">دج</span></div>'
    +'</div>'
    +'<p class="page-description">يتم احتساب المبلغ تلقائيًا في كل طلب تسجيل: قيمة الاشتراك + النقل + البدلة.</p></section>';
  const sample='<section class="panel"><div class="panel-head"><div><h3>معاينة المبالغ</h3><p>حساب تجريبي حسب الاشتراك المختار</p></div></div>'
    +'<div class="plans-editor">'+plans.filter(p=>p.active!==false).map(p=>'<div class="plan-row"><span class="plan-name">'+esc(p.name)+'</span><span class="plan-unit">+</span>'
      +'<span class="plan-name">'+money(extras.transport)+' نقل</span><span class="plan-unit">+</span><span class="plan-name">'+money(extras.uniform)+' بدلة</span>'
      +'<span class="plan-unit">=</span><b class="plan-total">'+money((Number(p.amount)||0)+(Number(extras.transport)||0)+(Number(extras.uniform)||0))+'</b></div>').join('')
    +'</div></section>';
  return '<div class="toolbar"><span class="page-description">الأسعار والخدمات التي يمكن لرئيس النادي تعديلها.</span>'
    +'<div class="toolbar-group">'+printBtn('print-subscriptions','طباعة')+'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button></div></div>'+rows+sample;
}
function pageUsers(){
  const q=(state.userQuery||'').trim();
  const f=state.groupFilter||'all';
  const list=(state.swimmers||[]).filter(s=>{
    if(f!=='all'&&String(s.group||'')!==f)return false;
    if(!q)return true;
    return ((s.name||'')+' '+(s.id||'')+' '+(s.phone||'')).includes(q);
  });
  const groupNames=[...new Set([...(state.swimmers||[]).map(s=>s.group).filter(Boolean),...groups().map(g=>g.name)])];
  return '<div class="toolbar"><div class="search">⌕<input placeholder="ابحث عن سباح..." id="user-search" value="'+esc(q)+'"></div>'
    +'<div class="toolbar-group">'
    +'<select class="filter" id="group-filter"><option value="all">كل الأفواج</option>'+groupNames.map(n=>'<option'+(n===f?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select>'
    +printBtn('print-swimmers','طباعة القائمة')
    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'
    +'<button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button>'
    +'</div></div>'
    +'<section class="panel table-panel"><div class="panel-head"><div><h3>قائمة السباحين</h3><p>'+list.length+' من '+(state.swimmers||[]).length+' سجل — الموسم '+esc(CLUB.season)+'</p></div></div>'
    +'<div class="table-scroll"><table><thead><tr><th>السباح</th><th>رقم الانخراط</th><th>الفوج</th><th>الهاتف</th><th>الحالة</th><th>الحضور اليوم</th><th></th></tr></thead><tbody>'
    +(list.length?list.map(s=>{const a=attendanceOf(s.id);return '<tr><td><span class="table-avatar">'+esc((s.name||'?')[0])+'</span><b>'+esc(s.name||'')+'</b></td>'
      +'<td dir="ltr">'+esc(s.id||'')+'</td><td>'+esc(s.group||'—')+'</td><td dir="ltr">'+esc(s.phone||'—')+'</td>'
      +'<td><span class="status '+(s.status==='نشط'?'success':'pending')+'">'+esc(s.status||'—')+'</span></td>'
      +'<td>'+(a?'<span class="status '+(a.status==='present'?'success':a.status==='late'?'late':'absent')+'">'+esc(ATTENDANCE_LABELS[a.status]||a.status)+'</span>':'<small>لم يُسجّل</small>')+'</td>'
      +'<td class="row-actions"><button class="check-btn" data-action="edit-swimmer" data-id="'+esc(s.id)+'">تعديل</button> <button class="check-btn no" data-action="delete-swimmer" data-id="'+esc(s.id)+'">حذف</button></td></tr>';}).join(''):emptyRow(7,'لا يوجد سباحون مطابقون.'))
    +'</tbody></table></div></section>';
}

function weekRange(offset){
  const base=new Date();
  const shift=(offset||0)*7;
  const day=base.getDay();
  const backToSaturday=(day+1)%7;
  const saturday=new Date(base);
  saturday.setDate(base.getDate()-backToSaturday+shift);
  const friday=new Date(saturday);
  friday.setDate(saturday.getDate()+5);
  return {start:saturday,end:friday,label:pad2(saturday.getDate())+' — '+pad2(friday.getDate())+' '+AR_MONTHS[friday.getMonth()]+' '+friday.getFullYear()};
}
function pageSchedule(){
  const offset=state.weekOffset||0;
  const range=weekRange(offset);
  const sessions=state.schedules||[];
  const byDay=Object.fromEntries(sessions.map(s=>[String(s.day_name||'').trim(),[]]));
  sessions.forEach(s=>{(byDay[String(s.day_name||'').trim()]||(byDay[String(s.day_name||'').trim()]=[])).push(s);});
  const week=range.start;
  const cols=WEEK_DAYS.map((day,i)=>{
    const d=new Date(week);
    d.setDate(week.getDate()+i);
    const list=byDay[day]||byDay[day.replace('الإثنين','الاثنين')]||[];
    return '<div class="day-column"><h3>'+esc(day)+'<small>'+pad2(d.getDate())+' '+AR_MONTHS[d.getMonth()]+' · '+(list.length?list.length+' حصة':'راحة')+'</small></h3>'
      +(list.length?list.map(s=>'<article class="session"><span class="session-time">'+esc(s.time_range||'')+'</span><strong>'+esc(s.group_name||'')+'</strong><small>'+esc(s.pool||'مسبح الصدارة')+'</small><em>'+esc(s.coach||'')+'</em>'
        +'<div class="session-actions"><button class="row-more" data-action="edit-session" data-id="'+esc(s.id)+'">تعديل</button><button class="row-more danger" data-action="delete-session" data-id="'+esc(s.id)+'">حذف</button></div></article>').join('')
        :'<div class="empty-day">لا توجد حصص</div>')
      +'</div>';
  }).join('');
  return '<div class="toolbar"><div class="week-switch"><button data-action="week-prev" title="الأسبوع السابق">‹</button><b>'+esc(range.label)+'</b><button data-action="week-next" title="الأسبوع التالي">›</button>'
    +'<button class="btn btn-outline" data-action="week-today"'+(offset===0?' disabled style="opacity:.45"':'')+'>هذا الأسبوع</button></div>'
    +'<div class="toolbar-group">'+printBtn('print-schedule','طباعة البرنامج')+'<button class="btn btn-primary" data-action="add-session">+ إضافة حصة</button></div></div>'
    +'<section class="schedule-grid">'+cols+'</section>'
    +'<section class="panel print-a4"><div class="panel-head"><div><h3>جدول الحصص الأسبوعي</h3><p>نسخة منظمة للطباعة على ورق A4</p></div></div>'
    +'<div class="table-scroll"><table><thead><tr><th>اليوم</th><th>التوقيت</th><th>الفوج</th><th>المدرب</th><th>المسبح</th></tr></thead><tbody>'
    +(sessions.length?sessions.map(s=>'<tr><td><b>'+esc(s.day_name||'')+'</b></td><td dir="ltr">'+esc(s.time_range||'')+'</td><td>'+esc(s.group_name||'')+'</td><td>'+esc(s.coach||'')+'</td><td>'+esc(s.pool||'مسبح الصدارة')+'</td></tr>').join(''):emptyRow(5,'لا توجد حصص مبرمجة. استخدم زر "إضافة حصة".'))
    +'</tbody></table></div></section>';
}

function pageAttendance(){
  const list=state.swimmers||[];
  const rate=attendanceRate();
  const count=s=>list.filter(x=>{const a=attendanceOf(x.id);return a&&a.status===s;}).length;
  const group=state.attendanceGroup||'all';
  const shown=group==='all'?list:swimmersOf(group);
  const opts=['present','late','absent'];
  return '<div class="attendance-summary"><div><b>نسبة الحضور اليوم</b><strong>'+(rate===null?'—':rate+'%')+'</strong></div>'
    +'<div><b>حاضر</b><strong class="green">'+count('present')+'</strong></div>'
    +'<div><b>غائب</b><strong class="red-text">'+count('absent')+'</strong></div>'
    +'<div><b>متأخر</b><strong class="orange">'+count('late')+'</strong></div></div>'
    +'<div class="toolbar"><div class="toolbar-group">'
    +'<select class="filter" id="attendance-group"><option value="all">كل الأفواج</option>'+groups().map(g=>'<option'+(g.name===group?' selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select>'
    +printBtn('print-attendance','طباعة كشف الحضور')
    +'<button class="btn btn-outline" data-action="mark-all-present">✓ تأكيد الجميع</button>'
    +'<button class="btn btn-outline" data-action="reset-attendance">↺ تصفير</button>'
    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'
    +'</div><span class="page-description">'+esc(longDate())+' · '+esc(todayISO())+'</span></div>'
    +'<section class="panel table-panel"><div class="panel-head"><div><h3>حضور حصة اليوم</h3><p>'+shown.length+' سباح · اضغط على الحالة لتغييرها</p></div></div>'
    +'<div class="table-scroll"><table><thead><tr><th>السباح</th><th>الفوج</th><th>وقت الدخول</th><th>الحالة</th><th>تغيير الحالة</th></tr></thead><tbody>'
    +(shown.length?shown.map(s=>{const a=attendanceOf(s.id);const cur=a?a.status:'';return '<tr><td><span class="table-avatar">'+esc((s.name||'?')[0])+'</span><b>'+esc(s.name||'')+'</b></td>'
      +'<td>'+esc(s.group||'—')+'</td><td dir="ltr">'+(a&&a.at?esc(String(a.at).slice(11,16)||'—'):'—')+'</td>'
      +'<td><span class="status '+((a&&a.status==='present')?'success':(a&&a.status==='late')?'late':(a&&a.status==='absent')?'absent':'pending')+'">'+esc(a?ATTENDANCE_LABELS[a.status]||a.status:'لم يُسجّل')+'</span></td>'
      +'<td>'+opts.map(o=>'<button class="check-btn'+(cur===o?' active':'')+'" data-action="mark-attendance" data-id="'+esc(s.id)+'" data-status="'+o+'">'+esc(ATTENDANCE_LABELS[o])+'</button> ').join('')+'</td></tr>';}).join(''):emptyRow(5,'لا يوجد سباحون في هذه المجموعة.'))
    +'</tbody></table></div></section>';
}

function pageNotices(){
  const list=state.notices||[];
  return '<div class="toolbar"><span class="page-description">أرسل تحديثات مهمة إلى السباحين والأولياء.</span>'
    +'<div class="toolbar-group">'+printBtn('print-notices','طباعة')+'<button class="btn btn-primary" data-action="add-notice">+ إعلان جديد</button></div></div>'
    +'<div class="notice-list">'
    +(list.length?list.map((n,i)=>'<article class="notice-card"><span class="notice-type '+((i%2)?'blue-type':'gold-type')+'">'+esc(n.type||'إعلان')+'</span>'
      +'<div><h3>'+esc(n.title)+'</h3><p>'+esc(n.text)+'</p><small>'+esc(n.date||'')+'</small></div>'
      +'<div class="notice-actions"><button class="check-btn" data-action="edit-notice" data-id="'+esc(n.id||'')+'">تعديل</button> <button class="check-btn no" data-action="delete-notice" data-id="'+esc(n.id||'')+'">حذف</button></div></article>').join('')
      :'<p class="empty-cell">لا توجد إعلانات.</p>')
    +'</div>';
}function pageGroups(){
  const list=groups();
  const row=g=>{
    const members=swimmersOf(g.name);
    return '<article class="group-card" data-group="'+esc(g.id)+'"><div class="group-card-head"><span class="stat-icon blue">♟</span><span class="status success">نشط</span></div>'
      +'<h3>'+esc(g.name)+'</h3><p><b>عدد السباحين:</b> '+members.length+'</p>'
      +'<p><b>المدرب المشرف:</b> '+esc(g.coach||'—')+'</p><p><b>البرنامج:</b> '+esc(g.schedule||'—')+'</p>'
      +'<div class="group-card-actions"><button class="check-btn" data-action="print-group" data-group="'+esc(g.id)+'">🖨 طباعة القائمة</button>'
      +'<button class="check-btn" data-action="edit-group" data-group="'+esc(g.id)+'">تعديل</button>'
      +'<button class="check-btn no" data-action="delete-group" data-group="'+esc(g.id)+'">حذف</button></div></article>';
  };
  return '<div class="toolbar"><span class="page-description">وزّع السباحين على الأفواج وحدد المدرب والمواعيد المشرفة على كل فوج.</span>'
    +'<div class="toolbar-group">'+printBtn('print-groups','طباعة قائمة الأفواج A4')+'<button class="btn btn-primary" data-action="add-group">+ إضافة فوج</button></div></div>'
    +'<section class="group-grid">'+(list.length?list.map(row).join(''):'<p class="empty-cell">لا توجد أفواج. أضف فوجًا للبدء.</p>')+'</section>'
    +'<section class="panel print-a4"><div class="panel-head"><div><h3>قائمة الأفواج والمدربين</h3><p>نسخة منظمة للطباعة على ورق A4</p></div>'
    +printBtn('print-groups','طباعة A4')+'</div>'
    +'<div class="table-scroll"><table><thead><tr><th>الفوج</th><th>المدرب المشرف</th><th>البرنامج</th><th>عدد السباحين</th></tr></thead><tbody>'
    +(list.length?list.map(g=>'<tr><td><b>'+esc(g.name)+'</b></td><td>'+esc(g.coach||'—')+'</td><td>'+esc(g.schedule||'—')+'</td><td>'+swimmersOf(g.name).length+'</td></tr>').join(''):emptyRow(4,'لا توجد أفواج.'))
    +'</tbody></table></div></section>';
}

function pageSettings(){
  const reqs=state.coachRequirements||[];
  return '<div class="toolbar"><span class="page-description">بيانات النادي ووثائق تسجيل المدربين.</span>'
    +'<div class="toolbar-group">'+printBtn('print-settings','طباعة')+'<button class="btn btn-primary" data-action="save-club">حفظ بيانات النادي</button></div></div>'
    +'<section class="panel settings"><div class="panel-head"><div><h3>بيانات النادي</h3><p>تظهر في ترويسة الطباعة والتواصل.</p></div></div>'
    +'<div class="form-two">'
    +'<label>اسم النادي<input id="club-name" value="'+esc(CLUB.name)+'"></label>'
    +'<label>الفوج<input id="club-unit" value="'+esc(CLUB.unit)+'"></label>'
    +'<label>العنوان<input id="club-address" value="'+esc(CLUB.address)+'"></label>'
    +'<label>الهاتف<input id="club-phone" dir="ltr" value="'+esc(CLUB.phone)+'"></label>'
    +'<label>البريد الإلكتروني<input id="club-email" dir="ltr" value="'+esc(CLUB.email)+'"></label>'
    +'<label>الموسم الرياضي<input id="club-season" value="'+esc(CLUB.season)+'"></label>'
    +'</div>'
    +'<p class="page-description">رابط الصفحة الرسمية: <a class="link" href="'+esc(CLUB.facebook)+'" target="_blank" rel="noopener noreferrer" dir="ltr">'+esc(CLUB.facebook)+'</a></p></section>'
    +'<section class="panel settings"><div class="panel-head"><div><h3>وثائق تسجيل المدربين</h3><p>حدد الوثائق التي يجب أن يرفعها كل متقدم قبل إرسال طلبه.</p></div>'
    +'<button class="btn btn-primary" data-action="save-coach-requirements">حفظ قائمة الوثائق</button></div>'
    +'<div id="coach-requirements">'
    +(reqs.length?reqs.map((r,i)=>'<div class="requirement-row"><input value="'+esc(r.label)+'" data-req-label="'+i+'"><label class="check-line"><input type="checkbox" data-req-required="'+i+'"'+(r.required!==false?' checked':'')+'> إلزامية</label></div>').join(''):'<p class="empty-cell">لا توجد وثائق. أضف أول وثيقة.</p>')
    +'</div><button class="btn btn-outline" data-action="add-coach-requirement">+ إضافة وثيقة</button></section>'
    +'<section class="panel settings"><div class="panel-head"><div><h3>النماذج الرسمية</h3><p>تُفتح مباشرة من المتصفح.</p></div></div>'
    +'<div class="official-docs docs-grid">'
    +'<a href="form-registration-01.jpg" target="_blank" rel="noopener">استمارة النادي</a>'
    +'<a href="internal-regulations.jpg" target="_blank" rel="noopener">النظام الداخلي</a>'
    +'<a href="form-registration-02.jpg" target="_blank" rel="noopener">استمارة النظام</a>'
    +'<a href="registration-card.jpg" target="_blank" rel="noopener">نموذج بطاقة الانخراط</a>'
    +'</div></section>';
}

pageTitle=function(p){return ({home:'نظرة عامة',applications:'طلبات التسجيل',subscriptions:'إدارة الاشتراكات',users:'إدارة السباحين',schedule:'البرنامج الأسبوعي',attendance:'سجل الحضور',notices:'الإعلانات والتنبيهات',card:'بطاقات الانخراط',groups:'الأفواج والمدربون',settings:'الإعدادات'}[p]||'نظرة عامة');};
icons.groups='♟';
const basePageView=pageView;
pageView=function(p){
  const map={home:pageOverview,applications:pageApplications,subscriptions:pageSubscriptions,users:pageUsers,schedule:pageSchedule,attendance:pageAttendance,notices:pageNotices,card:pageCards,groups:pageGroups,settings:pageSettings};
  return '<div class="page-root" id="page-root">'+(map[p]||pageOverview)()+'</div>';
};
/* ---------------------- واجهة المدربين والرياضيين ---------------------- */
const ROLE_LABELS={coach:'لوحة المدرب',swimmer_adult:'مساحة السباح',swimmer_minor:'مساحة السباح القاصر',parent:'لوحة الولي',member:'مساحة عضو النادي'};
const ROLE_MENU={
  coach:[['home','نظرة عامة','⌂'],['schedule','البرنامج','▦'],['attendance','تسجيل الحضور','✓'],['cards','البطاقات','▣'],['notices','الإعلانات','◈']],
  swimmer_adult:[['home','نظرة عامة','⌂'],['schedule','البرنامج','▦'],['attendance','حضوري','✓'],['cards','بطاقتي','▣'],['notices','الإعلانات','◈']],
  swimmer_minor:[['home','نظرة عامة','⌂'],['schedule','البرنامج','▦'],['cards','بطاقتي','▣'],['notices','الإعلانات','◈']],
  parent:[['home','نظرة عامة','⌂'],['attendance','حضور الأبناء','✓'],['cards','البطاقات','▣'],['applications','الطلبات','▤'],['notices','الإعلانات','◈']],
  member:[['home','نظرة عامة','⌂'],['schedule','البرنامج','▦'],['notices','الإعلانات','◈']]
};
function mySwimmer(){
  const u=state.user||{};
  const list=state.swimmers||[];
  const no=(u.member_no||'').trim();
  if(no)return list.find(s=>String(s.id)===no)||null;
  const phone=String(u.phone||'').replace(/\s/g,'');
  if(phone)return list.find(s=>String(s.phone||'').replace(/\s/g,'').endsWith(phone))||null;
  const name=(u.name||'').trim();
  if(name)return list.find(s=>String(s.name||'').trim()===name)||null;
  return null;
}
function mySessions(){
  const me=mySwimmer();
  const coachGroup=(state.user?.group_name||'').trim();
  const list=state.schedules||[];
  if(coachGroup)return list.filter(s=>String(s.group_name||'').trim()===coachGroup);
  if(me)return list.filter(s=>String(s.group_name||'').trim()===String(me.group||'').trim());
  return list;
}
function myAttendance(){
  const me=mySwimmer();
  const out=[];
  const days=state.attendanceByDay||{};
  if(me)Object.keys(days).sort().forEach(k=>{const st=days[k][me.id];if(st)out.push({date:k,status:st});});
  return out.reverse();
}
function roleHome(role){
  const me=mySwimmer();
  const sessions=mySessions();
  const rate=attendanceRate();
  const cards=activeCards().length;
  const upcoming=sessions[0];
  const notes=(state.notices||[]).slice(0,3);
  return '<section class="role-hero"><div><span class="eyebrow">'+esc(ROLE_LABELS[role]||'فضاء العضو')+'</span>'
    +'<h1>مرحبًا، '+esc(firstName())+' 👋</h1>'
    +'<p>'+(role==='coach'?'سجّل حضور السباحين ووتابع أفواجك لحظة بلحظة.':role==='parent'?'تابع حضور أبنائك وبطاقاتهم واشتراكاتهم.':me?'هذه بطاقتك وحضورك في فوج السباحة.':'آخر أخبار النادي وبرامجه بين يديك.')+'</p></div>'
    +'<div class="role-mark">'+({coach:'🏊‍♂️',parent:'👨‍👩‍👧',swimmer_adult:'🏊',swimmer_minor:'🏊',member:'⭐'}[role]||'⭐')+'</div></section>'
    +'<div class="role-cards">'
    +'<article><span class="stat-icon blue">▦</span><small>الحصة القادمة</small><strong>'+esc(upcoming?(upcoming.day_name||'—'):'—')+'</strong><p>'+esc(upcoming?(upcoming.time_range||''):'لا توجد حصة مبرمجة')+'</p></article>'
    +'<article><span class="stat-icon mint">✓</span><small>'+(role==='coach'?'نسبة الحضور':me?'حضوري':'بطاقات نشطة')+'</small><strong>'+(role==='coach'?(rate===null?'—':rate+'%'):(role==='member'?cards:(me?myAttendance().filter(a=>a.status==='present').length:'—')))+'</strong><p>'+(role==='coach'?'تسجيلات اليوم':'هذا الموسم')+'</p></article>'
    +'<article><span class="stat-icon gold">▣</span><small>رقم الانخراط</small><strong class="role-no">'+esc(me?me.id:'—')+'</strong><p>'+esc(me?me.group:'غير مربوط بحساب')+'</p></article>'
    +'</div>'
    +'<div class="role-grid"><section class="panel"><div class="panel-head"><div><h3>'+(role==='coach'?'حصصي التدريبية':me?'آخر حصوري':'آخر إعلانات النادي')+'</h3><p>معلومات محدثة من إدارة النادي</p></div></div>'
    +(sessions.length&&role!=='member'
      ?'<div class="role-list">'+sessions.slice(0,5).map(s=>'<div><b>'+esc(s.day_name||'')+' · '+esc(s.time_range||'')+'</b><span>'+esc(s.group_name||'')+' · '+esc(s.pool||'مسبح الصدارة')+' · '+esc(s.coach||'')+'</span></div>').join('')+'</div>'
      :notes.length?'<div class="role-list">'+notes.map(n=>'<div><b>'+esc(n.title)+'</b><span>'+esc(n.text)+'</span></div>').join('')+'</div>'
      :'<p class="empty-cell">لا توجد بيانات لعرضها بعد.</p>')
    +'</section>'
    +'<section class="panel role-side"><h3>روابط النادي</h3>'
    +'<a class="role-link" href="'+esc(CLUB.facebook)+'" target="_blank" rel="noopener noreferrer">f — الصفحة الرسمية للنادي</a>'
    +'<a class="role-link" href="tel:'+esc(CLUB.phone.replace(/\s/g,''))+'">☎ — اتصال بالنادي</a>'
    +'<a class="role-link" href="mailto:'+esc(CLUB.email)+'">✉ — إرسال رسالة</a>'
    +'<p class="page-description">العنوان: '+esc(CLUB.address)+'</p>'
    +'</section></div>';
}
function roleSchedule(){
  const sessions=mySessions();
  return '<section class="panel"><div class="panel-head"><div><h3>البرنامج الأسبوعي</h3><p>'+sessions.length+' حصة — الموسم '+esc(CLUB.season)+'</p></div>'
    +printBtn('print-role-schedule','طباعة البرنامج')+'</div>'
    +(sessions.length?'<div class="table-scroll"><table><thead><tr><th>اليوم</th><th>التوقيت</th><th>الفوج</th><th>المدرب</th><th>المسبح</th></tr></thead><tbody>'
      +sessions.map(s=>'<tr><td><b>'+esc(s.day_name||'')+'</b></td><td dir="ltr">'+esc(s.time_range||'')+'</td><td>'+esc(s.group_name||'')+'</td><td>'+esc(s.coach||'')+'</td><td>'+esc(s.pool||'مسبح الصدارة')+'</td></tr>').join('')
      +'</tbody></table></div>':'<p class="empty-cell">لا توجد حصص مبرمجة لفوجك بعد.</p>')
    +'</section>';
}
function roleAttendance(){
  const role=state.user?.role;
  if(role==='coach'||role==='parent'){
    const list=role==='coach'?(state.swimmers||[]):[mySwimmer()].filter(Boolean);
    const rate=attendanceRate(list);
    return '<div class="attendance-summary"><div><b>نسبة الحضور اليوم</b><strong>'+(rate===null?'—':rate+'%')+'</strong></div>'
      +'<div><b>حاضر</b><strong class="green">'+list.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='present';}).length+'</strong></div>'
      +'<div><b>غائب</b><strong class="red-text">'+list.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='absent';}).length+'</strong></div>'
      +'<div><b>متأخر</b><strong class="orange">'+list.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='late';}).length+'</strong></div></div>'
      +'<div class="toolbar"><span class="page-description">'+esc(longDate())+'</span><div class="toolbar-group">'
      +printBtn('print-role-attendance','طباعة الكشف')+(role==='coach'?'<button class="btn btn-primary" data-action="mark-all-present">✓ تأكيد الجميع</button>':'')+'</div></div>'
      +'<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>السباح</th><th>الفوج</th><th>الحالة</th>'+(role==='coach'?'<th>تغيير الحالة</th>':'')+'</tr></thead><tbody>'
      +(list.length?list.map(s=>{const a=attendanceOf(s.id);const cur=a?a.status:'';return '<tr><td><b>'+esc(s.name||'')+'</b></td><td>'+esc(s.group||'—')+'</td>'
        +'<td><span class="status '+(cur==='present'?'success':cur==='late'?'late':cur==='absent'?'absent':'pending')+'">'+esc(a?ATTENDANCE_LABELS[a.status]||a.status:'لم يُسجّل')+'</span></td>'
        +(role==='coach'?'<td>'+['present','late','absent'].map(o=>'<button class="check-btn'+(cur===o?' active':'')+'" data-action="mark-attendance" data-id="'+esc(s.id)+'" data-status="'+o+'">'+esc(ATTENDANCE_LABELS[o])+'</button> ').join('')+'</td>':'')
        +'</tr>';}).join(''):emptyRow(4,'لا توجد بيانات.'))
      +'</tbody></table></div></section>';
  }
  const rows=myAttendance();
  const rate=attendanceRate(mySwimmer()?[mySwimmer()]:[]);
  return '<div class="attendance-summary"><div><b>نسبة حضوري</b><strong>'+(rate===null?'—':rate+'%')+'</strong></div>'
    +'<div><b>حصص حضرتها</b><strong class="green">'+rows.filter(a=>a.status==='present').length+'</strong></div>'
    +'<div><b>غياب</b><strong class="red-text">'+rows.filter(a=>a.status==='absent').length+'</strong></div>'
    +'<div><b>تأخر</b><strong class="orange">'+rows.filter(a=>a.status==='late').length+'</strong></div></div>'
    +'<div class="toolbar"><span class="page-description">سجل حضورك في الموسم '+esc(CLUB.season)+'</span>'+printBtn('print-role-attendance','طباعة السجل')+'</div>'
    +'<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الحالة</th></tr></thead><tbody>'
    +(rows.length?rows.map(a=>{const d=new Date(a.date);return '<tr><td dir="ltr">'+esc(a.date)+'</td><td>'+esc(isNaN(d)?a.date:AR_DAYS[d.getDay()])+'</td>'
      +'<td><span class="status '+(a.status==='present'?'success':a.status==='late'?'late':'absent')+'">'+esc(ATTENDANCE_LABELS[a.status]||a.status)+'</span></td></tr>';}).join(''):emptyRow(3,'لا يوجد سجل حضور بعد.'))
    +'</tbody></table></div></section>';
}
function roleCards(){
  const me=mySwimmer();
  if(!me)return '<section class="panel"><p class="empty-cell">حسابك غير مربوط ببطاقة انخراط. تواصل مع إدارة النادي لربط رقم العضوية.</p></section>';
  return '<section class="card-intro"><div><span class="eyebrow">بطاقتك الرقمية</span><h2>بطاقة انخراط<br>في جيبك.</h2>'
    +'<p>اعرض هذه البطاقة عند المدرب أو المشرف لتسجيل حضورك بسريعة.</p>'
    +'<div class="hero-actions"><button class="btn btn-primary" data-action="print-role-card">🖨 طباعة بطاقة</button>'
    +'<button class="btn btn-outline" data-action="print-all-cards">🖨 كل البطاقات</button></div></div>'
    +'<div class="membership-card"><span>'+esc(CLUB.name)+'</span><b>🏊</b><strong>بطاقة العضو</strong>'
    +'<small>'+esc(me.group||CLUB.unit)+' · '+esc(CLUB.season)+'</small><div><i>'+esc(me.name||'')+'</i><i dir="ltr">'+esc(me.id||'')+'</i></div></div></section>'
    +'<section class="card-print-grid single">'+cardMarkup(me,0)+'</section>';
}
function roleNotices(){
  const list=state.notices||[];
  return '<div class="toolbar"><span class="page-description">آخر تحديثات إدارة النادي.</span>'+printBtn('print-role-notices','طباعة')+'</div>'
    +'<div class="notice-list">'+(list.length?list.map((n,i)=>'<article class="notice-card"><span class="notice-type '+((i%2)?'blue-type':'gold-type')+'">'+esc(n.type||'إعلان')+'</span>'
      +'<div><h3>'+esc(n.title)+'</h3><p>'+esc(n.text)+'</p><small>'+esc(n.date||'')+'</small></div></article>').join(''):'<p class="empty-cell">لا توجد إعلانات.</p>')+'</div>';
}
function roleApplications(){
  const phone=String(state.user?.phone||'').replace(/\s/g,'');
  const mine=(state.applications||[]).filter(a=>String(a.phone||'').replace(/\s/g,'')===phone);
  return '<div class="toolbar"><span class="page-description">طلبات التسجيل والاشتراكات الخاصة بك.</span>'
    +'<div class="toolbar-group">'+printBtn('print-role-applications','طباعة')+'<button class="btn btn-primary" data-action="register">+ طلب تسجيل جديد</button></div></div>'
    +'<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>رقم الطلب</th><th>الرياضي</th><th>الاشتراك</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>'
    +(mine.length?mine.map(a=>'<tr><td dir="ltr">'+esc(a.application_no||a.id)+'</td><td><b>'+esc(appName(a))+'</b></td><td>'+esc(planName(a.subscription_code))+'</td>'
      +'<td>'+esc(money(a.expected_amount))+'</td><td><span class="status '+(a.status==='approved'?'success':'pending')+'">'+esc(stateLabel(a.status))+'</span></td></tr>').join('')
      :emptyRow(5,'لا توجد طلبات. استخدم زر "طلب تسجيل جديد".'))
    +'</tbody></table></div></section>';
}
function roleDashboard(){
  const role=state.user?.role||'member';
  const menu=ROLE_MENU[role]||ROLE_MENU.member;
  const key=menu.some(m=>m[0]===state.rolePage)?state.rolePage:'home';
  const title=(menu.find(m=>m[0]===key)||menu[0])[1];
  const views={home:()=>roleHome(role),schedule:roleSchedule,attendance:roleAttendance,cards:roleCards,notices:roleNotices,applications:roleApplications};
  return '<div class="role-shell"><header class="role-top"><a class="brand"><span class="logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a>'
    +'<div class="role-actions"><span>'+esc(ROLE_LABELS[role]||'عضو النادي')+'</span><button class="icon-btn" data-action="theme">'+(state.dark?'☀':'◐')+'</button>'
    +'<button class="btn btn-outline" data-action="logout">تسجيل الخروج</button></div></header>'
    +'<nav class="role-nav">'+menu.map(m=>'<button class="'+(m[0]===key?'active':'')+'" data-role-page="'+m[0]+'"><i>'+m[2]+'</i>'+esc(m[1])+'</button>').join('')+'</nav>'
    +'<main class="role-main"><h2 class="role-page-title">'+esc(title)+'</h2>'+(views[key]||views.home)()+'</main></div>';
}
/* ---------------------- النوافذ والأفعال ---------------------- */
function openModal(html){document.querySelector('.modal-backdrop')?.remove();document.body.insertAdjacentHTML('beforeend',html);bind();}
function formModal(title,body,action,extra){return '<div class="modal-backdrop"><div class="modal registration-modal"><button class="close" data-action="close">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>'+esc(title)+'</h2></div>'+body+'<button class="btn btn-primary full" data-action="'+action+'"'+(extra||'')+'>حفظ</button></div></div>';}
function groupOptions(value){return groups().map(g=>'<option'+(g.name===value?' selected':'')+'>'+esc(g.name)+'</option>').join('');}
function printTable(title,headers,rows,sub,notes){
  const box=document.createElement('section');
  box.className='roster';
  box.innerHTML='<table class="print-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):emptyRow(headers.length,'لا توجد بيانات لعرضها.'))+'</tbody></table>';
  return printArea(box,{title,sub,notes,variant:'roster'});
}
async function api(path,method,body){
  const res=await fetch(path,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body||{})});
  let data={};
  try{data=await res.json()}catch(_){}
  if(!res.ok)throw new Error(data.error||'تعذر تنفيذ العملية');
  return data;
}
function swimmerModal(s){
  const isEdit=!!s;
  return formModal(isEdit?'تعديل بيانات السباح':'إضافة سباح جديد',
    '<div class="form-two">'
    +'<label>الاسم واللقب *<input id="sw-name" value="'+esc(s?.name||'')+'"></label>'
    +'<label>رقم الانخراط<input id="sw-no" dir="ltr" value="'+esc(s?.id||'')+'"'+(isEdit?' disabled':'')+' placeholder="يُولَّد تلقائيًا"></label>'
    +'<label>الفوج<select id="sw-group">'+groupOptions(s?.group)+'</select></label>'
    +'<label>الهاتف<input id="sw-phone" dir="ltr" value="'+esc(s?.phone||'')+'"></label>'
    +'<label>الحالة<select id="sw-status"><option value="نشط"'+(s?.status==='نشط'?' selected':'')+'>نشط</option><option value="موقوف"'+(s?.status==='موقوف'?' selected':'')+'>موقوف</option><option value="بانتظار"'+(s?.status==='بانتظار'?' selected':'')+'>بانتظار</option></select></label>'
    +'</div>',
    'save-swimmer',s?' data-id="'+esc(s.id)+'"':'');
}
function sessionModal(s){
  const isEdit=!!s;
  const opts=(list,val)=>list.map(v=>'<option'+(v===val?' selected':'')+'>'+esc(v)+'</option>').join('');
  return formModal(isEdit?'تعديل الحصة':'إضافة حصة',
    '<div class="form-two">'
    +'<label>اليوم<select id="se-day">'+opts(WEEK_DAYS,s?.day_name)+'</select></label>'
    +'<label>التوقيت<input id="se-time" dir="ltr" value="'+esc(s?.time_range||'16:00 - 17:30')+'" placeholder="16:00 - 17:30"></label>'
    +'<label>الفوج<select id="se-group">'+groupOptions(s?.group_name)+'</select></label>'
    +'<label>المدرب<input id="se-coach" value="'+esc(s?.coach||'')+'"></label>'
    +'<label>المسبح<input id="se-pool" value="'+esc(s?.pool||'مسبح الصدارة')+'"></label>'
    +'</div>',
    'save-session',s?' data-id="'+esc(s.id)+'"':'');
}
function noticeModal(n){
  const isEdit=!!n;
  return formModal(isEdit?'تعديل الإعلان':'إعلان جديد',
    '<label>العنوان *<input id="no-title" value="'+esc(n?.title||'')+'"></label>'
    +'<label>النص<textarea id="no-body" rows="4">'+esc(n?.text||'')+'</textarea></label>'
    +'<label>النوع<select id="no-kind"><option>إعلان</option><option>مهم</option><option>تذكير</option><option>نتيجة</option></select></label>',
    'save-notice',n?' data-id="'+esc(n.id||'')+'"':'');
}

const coreAction=action;
action=async function(a,el){
  /* ---------- الطباعة ---------- */
  if(a==='print-applications'){printPage('طلبات التسجيل والمدربين','عدد الطلبات: '+(state.applications||[]).length);return}
  if(a==='print-subscriptions'){printPage('الأسعار والخدمات','الموسم '+CLUB.season);return}
  if(a==='print-swimmers'){printPage('قائمة السباحين','الموسم '+CLUB.season);return}
  if(a==='print-schedule'){printPage('البرنامج الأسبوعي',weekRange(state.weekOffset||0).label);return}
  if(a==='print-notices'){printPage('الإعلانات والتنبيهات');return}
  if(a==='print-settings'){printPage('إعدادات المنصة');return}
  if(a==='print-attendance'){printAttendanceSheet();return}
  if(a==='print-cards'||a==='print-all-cards'){printCardsSheet();return}
  if(a==='print-cards-quick'){state.page='card';save();render();printCardsSheet();return}
  if(a==='print-registration'){printRegistrationFormA4();return}
  if(a==='print-groups'){printGroupsSheet();return}
  if(a==='print-group'){printGroupRoster(el.dataset.group);return}
  if(a==='print-role-card'){const me=mySwimmer();if(me)printSingleCard(me.id);else showToast('حسابك غير مربوط ببطاقة انخراط.','error');return}
  if(a==='print-role-schedule'){printTable('البرنامج الأسبوعي',['اليوم','التوقيت','الفوج','المدرب','المسبح'],mySessions().map(s=>'<tr><td><b>'+esc(s.day_name||'')+'</b></td><td dir="ltr">'+esc(s.time_range||'')+'</td><td>'+esc(s.group_name||'')+'</td><td>'+esc(s.coach||'')+'</td><td>'+esc(s.pool||'مسبح الصدارة')+'</td></tr>'),'الموسم '+CLUB.season);return}
  if(a==='print-role-attendance'){
    if(state.user?.role==='coach'){printAttendanceSheet();return}
    printTable('سجل الحضور',['التاريخ','اليوم','الحالة'],myAttendance().map(x=>{const d=new Date(x.date);return '<tr><td dir="ltr">'+esc(x.date)+'</td><td>'+esc(isNaN(d)?x.date:AR_DAYS[d.getDay()])+'</td><td><span class="status success">'+esc(ATTENDANCE_LABELS[x.status]||x.status)+'</span></td></tr>';}),'الموسم '+CLUB.season);return}
  if(a==='print-role-notices'){printTable('إعلانات النادي',['العنوان','النص','النوع','التاريخ'],(state.notices||[]).map(n=>'<tr><td><b>'+esc(n.title)+'</b></td><td>'+esc(n.text)+'</td><td>'+esc(n.type||'')+'</td><td>'+esc(n.date||'')+'</td></tr>')) ;return}
  if(a==='print-role-applications'){const phone=String(state.user?.phone||'').replace(/\s/g,'');printTable('طلبات التسجيل',['رقم الطلب','الرياضي','الاشتراك','المبلغ','الحالة'],(state.applications||[]).filter(x=>String(x.phone||'').replace(/\s/g,'')===phone).map(x=>'<tr><td dir="ltr">'+esc(x.application_no||x.id)+'</td><td><b>'+esc(appName(x))+'</b></td><td>'+esc(planName(x.subscription_code))+'</td><td>'+esc(money(x.expected_amount))+'</td><td><span class="status success">'+esc(stateLabel(x.status))+'</span></td></tr>'));return}

  /* ---------- الوثائق ---------- */
  if(a==='open-coach-doc'){
    const path=el.dataset.path;
    try{
      if(!window.firebase||!firebase.storage)throw new Error('تخزين الملفات غير مفعّل');
      const url=await firebase.storage().ref(path).getDownloadURL();
      window.open(url,'_blank','noopener');
    }catch(e){showToast(e.message||'تعذر فتح الوثيقة. تأكد من صلاحية الحساب.','error')}
    return;
  }

  /* ---------- الطلبات ---------- */
  if(a==='edit-app'){
    const app=(state.applications||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!app){showToast('تعذر العثور على الطلب.','error');return}
    openModal(formModal('تعديل الطلب '+esc(app.application_no||app.id),
      '<div class="applicant-box"><b>'+esc(appName(app))+'</b><span>'+esc(catLabel(app.application_type==='coach'?'coach':app.category))+' · '+esc(appContact(app)||'')+'</span></div>'
      +applicationFormBody(app,state.subscriptions||[],state.extras||{}),
      'save-app',' data-id="'+esc(app.id)+'"'));
    return;
  }
  if(a==='save-app'){
    const app=(state.applications||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!app){showToast('تعذر العثور على الطلب.','error');return}
    const payload={subscription_code:$('#edit-plan').value,transport:$('#edit-transport').checked,uniform:$('#edit-uniform').checked,payment_method:$('#edit-payment').value,facility:$('#edit-facility').value,status:$('#edit-status').value,decision_reason:$('#edit-note').value.trim()};
    payload.expected_amount=recalcAmount({...app,...payload});
    try{await api('/api/applications/'+encodeURIComponent(app.id),'PATCH',payload);showToast('تم تحديث الطلب واحتساب المبلغ.');document.querySelector('.modal-backdrop')?.remove();await syncApi();render()}catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='approve-app'){
    try{await api('/api/applications/'+encodeURIComponent(el.dataset.id),'PATCH',{status:'approved'});showToast('تم اعتماد الطلب.');await syncApi();render()}catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='reject-app'){
    const reason=prompt('سبب رفض الطلب:','الوثائق ناقصة');
    if(reason===null)return;
    try{await api('/api/applications/'+encodeURIComponent(el.dataset.id),'PATCH',{status:'rejected',decision_reason:reason});showToast('تم رفض الطلب وتسجيل السبب.');await syncApi();render()}catch(e){showToast(e.message,'error')}
    return;
  }

  /* ---------- السباحون ---------- */
  if(a==='add-swimmer'){openModal(swimmerModal(null));return}
  if(a==='edit-swimmer'){
    const s=(state.swimmers||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!s){showToast('تعذر العثور على السباح.','error');return}
    openModal(swimmerModal(s));
    return;
  }
  if(a==='save-swimmer'){
    const name=$('#sw-name')?.value.trim();
    if(!name){showToast('أدخل اسم السباح.','error');return}
    const payload={name,group_name:$('#sw-group').value,phone:$('#sw-phone').value.trim(),status:$('#sw-status').value};
    try{
      if(el.dataset.id){payload.id=el.dataset.id;await api('/api/swimmers','PUT',payload);showToast('تم تحديث بيانات السباح.')}
      else{payload.membership_no=$('#sw-no')?.value.trim();await api('/api/swimmers','POST',payload);showToast('تمت إضافة السباح.')}
      document.querySelector('.modal-backdrop')?.remove();await syncApi();render();
    }catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='delete-swimmer'){
    const s=(state.swimmers||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!s||!confirm('حذف السباح "'+(s.name||'')+'" نهائيًا؟'))return;
    try{await api('/api/swimmers','DELETE',{id:s.id});showToast('تم حذف السباح.');await syncApi();render()}catch(e){showToast(e.message,'error')}
    return;
  }

  /* ---------- الإعلانات ---------- */
  if(a==='add-notice'){openModal(noticeModal(null));return}
  if(a==='edit-notice'){
    const n=(state.notices||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!n){showToast('تعذر العثور على الإعلان.','error');return}
    openModal(noticeModal(n));
    return;
  }
  if(a==='save-notice'){
    const title=$('#no-title')?.value.trim();
    if(!title){showToast('أدخل عنوان الإعلان.','error');return}
    const payload={title,body:$('#no-body').value.trim(),kind:$('#no-kind').value};
    try{
      if(el.dataset.id){payload.id=el.dataset.id;await api('/api/notices','PUT',payload);showToast('تم تعديل الإعلان.')}
      else{await api('/api/notices','POST',payload);showToast('تم نشر الإعلان.')}
      document.querySelector('.modal-backdrop')?.remove();await syncApi();render();
    }catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='delete-notice'){
    const n=(state.notices||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!n||!confirm('حذف الإعلان "'+(n.title||'')+'"؟'))return;
    try{await api('/api/notices','DELETE',{id:n.id});showToast('تم حذف الإعلان.');await syncApi();render()}catch(e){showToast(e.message,'error')}
    return;
  }

  /* ---------- البرنامج ---------- */
  if(a==='add-session'){openModal(sessionModal(null));return}
  if(a==='edit-session'){
    const s=(state.schedules||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!s){showToast('تعذر العثور على الحصة.','error');return}
    openModal(sessionModal(s));
    return;
  }
  if(a==='save-session'){
    const payload={day_name:$('#se-day').value,time_range:$('#se-time').value.trim(),group_name:$('#se-group').value,coach:$('#se-coach').value.trim(),pool:$('#se-pool').value.trim()};
    try{
      if(el.dataset.id){payload.id=el.dataset.id;await api('/api/schedule','PUT',payload);showToast('تم تعديل الحصة.')}
      else{await api('/api/schedule','POST',payload);showToast('تمت إضافة الحصة.')}
      document.querySelector('.modal-backdrop')?.remove();await syncApi();render();
    }catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='delete-session'){
    if(!confirm('حذف هذه الحصة من البرنامج؟'))return;
    try{await api('/api/schedule','DELETE',{id:el.dataset.id});showToast('تم حذف الحصة.');await syncApi();render()}catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='week-prev'){state.weekOffset=(state.weekOffset||0)-1;save();render();return}
  if(a==='week-next'){state.weekOffset=(state.weekOffset||0)+1;save();render();return}
  if(a==='week-today'){state.weekOffset=0;save();render();return}

  /* ---------- الحضور ---------- */
  if(a==='mark-attendance'){
    const id=el.dataset.id,status=el.dataset.status;
    try{
      await api('/api/attendance','POST',{member_id:id,swimmer_id:id,status});
      const bucket=state.attendance[id]=state.attendance[id]||[];
      bucket.push({status,at:new Date().toISOString(),date:todayISO()});
      (state.attendanceByDay[todayISO()]||(state.attendanceByDay[todayISO()]={}))[id]=status;
      save();render();
    }catch(e){showToast(e.message||'تعذر تسجيل الحضور.','error')}
    return;
  }
  if(a==='mark-all-present'){
    const list=state.swimmers||[];
    if(!list.length){showToast('لا يوجد سباحون لتسجيل حضورهم.','error');return}
    if(!confirm('تسجيل حضور '+list.length+' سباح اليوم؟'))return;
    let done=0;
    for(const s of list){
      try{await api('/api/attendance','POST',{member_id:s.id,swimmer_id:s.id,status:'present'});done++}catch(_){}
    }
    list.forEach(s=>{const b=state.attendance[s.id]=state.attendance[s.id]||[];b.push({status:'present',at:new Date().toISOString(),date:todayISO()});(state.attendanceByDay[todayISO()]||(state.attendanceByDay[todayISO()]={}))[s.id]='present';});
    save();render();showToast('تم تسجيل حضور '+done+' سباح.');
    return;
  }
  if(a==='reset-attendance'){
    if(!confirm('تصفير سجل حضور اليوم محليًا؟ (سجل الخادم لا يُحذف)'))return;
    state.attendance={};state.attendanceByDay={};save();render();showToast('تم تصفير سجل اليوم.');
    return;
  }

  /* ---------- الأفواج ---------- */
  if(a==='add-group'||a==='edit-group'){
    const g=a==='edit-group'?groups().find(x=>x.id===el.dataset.group):null;
    openModal(formModal(a==='edit-group'?'تعديل الفوج':'إضافة فوج',
      '<label>اسم الفوج *<input id="gr-name" value="'+esc(g?.name||'')+'"></label>'
      +'<label>المدرب المشرف<input id="gr-coach" value="'+esc(g?.coach||'')+'"></label>'
      +'<label>البرنامج الأسبوعي<input id="gr-schedule" value="'+esc(g?.schedule||'')+'" placeholder="السبت · 16:00"></label>',
      'save-group',g?' data-group="'+esc(g.id)+'"':''));
    return;
  }
  if(a==='save-group'){
    const name=$('#gr-name')?.value.trim();
    if(!name){showToast('أدخل اسم الفوج.','error');return}
    const coach=$('#gr-coach').value.trim()||'غير محدد';
    const schedule=$('#gr-schedule').value.trim()||'يحدد لاحقًا';
    if(el.dataset.group){const g=groups().find(x=>x.id===el.dataset.group);if(g){g.name=name;g.coach=coach;g.schedule=schedule}}
    else groups().push({id:'g'+Date.now().toString(36),name,coach,schedule});
    save();document.querySelector('.modal-backdrop')?.remove();render();showToast('تم حفظ الفوج.');
    return;
  }
  if(a==='delete-group'){
    const g=groups().find(x=>x.id===el.dataset.group);
    if(!g||!confirm('حذف الفوج "'+(g.name||'')+'"؟ لن تتأثر بيانات سباحيه.'))return;
    state.groups=groups().filter(x=>x.id!==g.id);save();render();showToast('تم حذف الفوج.');
    return;
  }

  /* ---------- الاشتراكات والإعدادات ---------- */
  if(a==='save-plans'){
    const plans=[...document.querySelectorAll('[data-plan-name]')].map(inp=>{
      const code=inp.dataset.planName;
      const amountEl=document.querySelector('[data-plan-amount="'+CSS.escape(code)+'"]');
      const activeEl=document.querySelector('[data-plan-active="'+CSS.escape(code)+'"]');
      const old=(state.subscriptions||[]).find(p=>p.code===code)||{};
      return {id:old.id||code,code,name:inp.value.trim(),amount:Number(amountEl?.value)||0,duration:old.duration||'موسم',active:activeEl?activeEl.checked:true};
    });
    const extras={transport:Number($('#extra-transport')?.value)||0,uniform:Number($('#extra-uniform')?.value)||0};
    try{await api('/api/subscription-plans','PUT',{plans,extras});state.subscriptions=plans;state.extras=extras;save();await syncApi();render();showToast('تم حفظ الأسعار والخدمات.')}catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='save-club'){
    state.club={name:$('#club-name').value.trim()||CLUB.name,unit:$('#club-unit').value.trim()||CLUB.unit,address:$('#club-address').value.trim(),phone:$('#club-phone').value.trim(),email:$('#club-email').value.trim(),season:$('#club-season').value.trim()||CLUB.season};
    Object.assign(CLUB,state.club);save();render();showToast('تم حفظ بيانات النادي.');
    return;
  }
  if(a==='add-coach-requirement'){
    const box=$('#coach-requirements');
    if(box)box.insertAdjacentHTML('beforeend','<div class="requirement-row"><input placeholder="اسم الوثيقة" data-req-label><label class="check-line"><input type="checkbox" data-req-required checked> إلزامية</label></div>');
    return;
  }

  /* ---------- إغلاق ---------- */
  if(a==='close'){document.querySelector('.modal-backdrop')?.remove();return}
  return coreAction(a,el);
};

/* ---------------------- الربط والتزامن ---------------------- */
function baseBind(){document.querySelectorAll('[data-page]').forEach(e=>e.onclick=()=>{state.page=e.dataset.page;save();render()});document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>action(e.dataset.action,e));document.querySelectorAll('.close').forEach(e=>e.onclick=()=>e.closest('.modal-backdrop').remove());}
bind=function(){
  baseBind();
  document.querySelectorAll('[data-role-page]').forEach(e=>e.onclick=()=>{state.rolePage=e.dataset.rolePage;save();render()});
  const live=(sel,fn)=>{const el=document.querySelector(sel);if(el){el.oninput=fn;el.onchange=fn;el.onkeyup=fn}};
  live('#app-search',e=>{state.appQuery=e.target.value;renderPageOnly()});
  live('#app-filter',e=>{state.appFilter=e.target.value;renderPageOnly()});
  live('#user-search',e=>{state.userQuery=e.target.value;renderPageOnly()});
  live('#group-filter',e=>{state.groupFilter=e.target.value;renderPageOnly()});
  live('#attendance-group',e=>{state.attendanceGroup=e.target.value;renderPageOnly()});
};
function renderPageOnly(){
  const p=state.page;
  const host=document.querySelector('#page-root');
  if(!host)return;
  const map={home:pageOverview,applications:pageApplications,subscriptions:pageSubscriptions,users:pageUsers,schedule:pageSchedule,attendance:pageAttendance,notices:pageNotices,card:pageCards,groups:pageGroups,settings:pageSettings};
  const scrollY=window.scrollY;
  host.innerHTML=(map[p]||pageOverview)();
  document.title=pageTitle(p)+' | '+CLUB.name;
  bind();
  buildQRCodes();
  window.scrollTo(0,scrollY);
}
/* ---------------------- مزامنة البيانات ---------------------- */
function tsToIso(v){
  if(!v)return '';
  if(typeof v.toDate==='function')return v.toDate().toISOString();
  return String(v);
}
async function syncApi(){
  const get=async p=>{try{const r=await fetch(p,{credentials:'same-origin'});return r.ok?await r.json():null}catch(_){return null}};
  const [sw,nt,apps,plans,reqs,sch,att,cd,fees]=await Promise.all([
    get('/api/swimmers'),get('/api/notices'),get('/api/applications'),get('/api/subscriptions'),
    get('/api/coach-requirements'),get('/api/schedule'),get('/api/attendance'),get('/api/cards'),get('/api/subscription-plans')]);
  if(Array.isArray(sw)&&sw.length)
    state.swimmers=sw.map(x=>({id:x.membership_no||x.id,name:x.name||'',group:x.group_name||x.group||'',phone:x.phone||'',status:x.status==='active'?'نشط':(x.status||'نشط')}));
  if(Array.isArray(nt))
    state.notices=nt.map(x=>({id:x.id,title:x.title||'',text:x.text||x.body||'',date:x.date||x.published_at||'',type:x.kind||'إعلان'}));
  if(Array.isArray(apps))state.applications=apps;
  if(Array.isArray(plans)&&plans.length)state.subscriptions=plans;
  if(Array.isArray(reqs)&&reqs.length)state.coachRequirements=reqs;
  if(Array.isArray(sch))state.schedules=sch;
  if(Array.isArray(cd))state.cards=cd;
  if(fees&&fees.extras)state.extras=fees.extras;
  if(Array.isArray(att)){
    const bucket={},byDay={};
    att.forEach(r=>{
      const key=r.member_id||r.swimmer_id;
      if(!key)return;
      const status=r.status||'present';
      const at=tsToIso(r.check_in||r.marked_at||r.time);
      let date=r.session_date||r.date||todayISO();
      const m=String(at).match(/(\d{4}-\d{2}-\d{2})/);
      if(m)date=m[1];
      (bucket[key]=bucket[key]||[]).push({status,at,date});
      (byDay[date]=byDay[date]||{})[key]=status;
    });
    state.attendance=bucket;
    state.attendanceByDay=byDay;
  }
  if(state.club)Object.assign(CLUB,state.club);
  save();
}
if(state.club)Object.assign(CLUB,state.club);
state.club=state.club||null;
const coreRender=render;
render=function(){
  coreRender();
  document.title=(state.user?pageTitle(state.page)+' — '+CLUB.name:'منصة السباحة — '+CLUB.name);
};
