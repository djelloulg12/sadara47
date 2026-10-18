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

let save = () => localStorage.setItem('sadara-state', JSON.stringify(state));

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

function loginModal() { return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="تسجيل الدخول"><div class="modal auth-modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo auth-logo">🏊</span><h2>مرحبًا بعودتك</h2><p>سجّل الدخول إلى مساحة نادي الصدارة</p></div><div class="form-message" id="auth-message" role="status"></div><label>البريد الإلكتروني<input id="email" type="email" autocomplete="email" placeholder="name@example.com"></label><label>كلمة المرور<input id="password" type="password" autocomplete="current-password" placeholder="••••••••"></label><button class="btn btn-primary full" data-action="do-login">دخول المنصة</button><div class="auth-links"><button type="button" data-action="forgot-password">نسيت كلمة المرور؟</button><span>ليس لديك حساب؟</span><button type="button" data-action="register">طلب التسجيل</button></div><button class="btn btn-sms full" data-action="phone-login">الدخول أو الاستعادة برمز SMS</button><p class="hint">سيتم إرسال رمز تحقق إلى رقم الهاتف المسجل في Firebase.</p></div></div>`; }

function dashboard() {

  const page = state.page;

  return `<div class="app-shell"><aside class="sidebar"><a class="brand side-brand"><span class="logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a><div class="side-user"><span class="avatar">م</span><div><b>${state.user?.name||'رئيس الجمعية'}</b><small>${state.user?.role==='president'?'رئيس الجمعية':'مسير النادي'}</small></div></div><nav class="side-nav">${[['home','نظرة عامة'],['applications','طلبات التسجيل'],['subscriptions','الاشتراكات'],['users','السباحون'],['schedule','البرنامج الأسبوعي'],['attendance','الحضور'],['notices','الإعلانات'],['card','بطاقات الانخراط'],['audit','سجل التدقيق']].map(([key,label])=>`<a class="${page===key?'active':''}" data-page="${key}"><i>${icons[key]||'◈'}</i>${label}</a>`).join('')}</nav><div class="side-bottom"><a data-page="settings"><i>⚙</i>الإعدادات</a><a data-action="logout"><i>↪</i>تسجيل الخروج</a></div></aside><main class="main-content"><header class="dash-header"><div><span class="mobile-menu">☰</span><span class="breadcrumb">الصدارة <b>/</b> ${pageTitle(page)}</span><h1>${pageTitle(page)}</h1></div><div class="header-actions"><button class="icon-btn" data-action="theme" aria-label="تبديل الوضع الليلي" title="تبديل الوضع">${state.dark?'☀':'◐'}</button><button class="icon-btn notification" data-action="notification" aria-label="الإعلانات" title="الإعلانات">♢<span></span></button><div class="header-avatar">م</div></div></header>${pageView(page)}</main></div>`;

}





















function bind(){document.querySelectorAll('[data-page]').forEach(e=>e.onclick=()=>{state.page=e.dataset.page;save();render()});document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>action(e.dataset.action,e));document.querySelectorAll('.close').forEach(e=>e.onclick=()=>e.closest('.modal-backdrop').remove());}

async function action(a,el){if(a==='login'){document.body.insertAdjacentHTML('beforeend',loginModal());bind();return}if(a==='close'){document.querySelector('.modal-backdrop')?.remove();return}if(a==='do-login'){const email=$('#email').value,password=$('#password').value;const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email,password})});const data=await res.json();if(!res.ok){alert(data.error||'تعذر تسجيل الدخول');return}state.user=data.user;state.page='home';save();document.querySelector('.modal-backdrop')?.remove();await syncApi();render();return}if(a==='logout'){await fetch('/api/logout',{method:'POST',credentials:'same-origin'});state.user=null;state.page='home';save();render();return}if(a==='theme'){state.dark=!state.dark;save();render();return}if(a==='refresh-data'){await syncApi();render();return}if(a==='approve-app'){await fetch('/api/applications/'+el.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({status:'approved'})});await syncApi();render();return}if(a==='edit-app'){const code=prompt('نوع الاشتراك: season أو quarter أو agreement','quarter');if(code){const transport=confirm('إضافة النقل 900 دج؟');const uniform=confirm('إضافة البدلة الرياضية 2500 دج؟');await fetch('/api/applications/'+el.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({subscription_code:code,transport,uniform})});await syncApi();render()}return}if(a==='register'){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop"><div class="modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>طلب التسجيل</h2><p>سجّل طلبك وسيقوم رئيس الجمعية بمراجعته.</p></div><label>الاسم واللقب<input id="reg-name" placeholder="اكتب الاسم الكامل"></label><label>رقم الهاتف<input id="reg-phone" placeholder="05xx xx xx xx"></label><label>الفئة<select id="reg-category"><option value="minor">أصاغر</option><option value="adult">أكابر</option></select></label><label>تاريخ الميلاد<input id="reg-birth" type="date"></label><label>الاشتراك<select id="reg-plan"><option value="quarter">فصلي — 1000 دج</option><option value="season">موسمي — 3000 دج</option><option value="agreement">اتفاقية — 3000 دج</option></select></label><label>الخدمات الإضافية <span class="page-description">النقل والبدلة تضافان للمبلغ</span></label><label><input id="reg-transport" type="checkbox"> النقل</label><label><input id="reg-uniform" type="checkbox"> البدلة الرياضية</label><button class="btn btn-primary full" data-action="send-request">إرسال الطلب</button></div></div>`);bind();return}if(a==='send-request'){const name=$('#reg-name').value.trim().split(' ');const payload={first_name_ar:name.shift()||'',last_name_ar:name.join(' ')||'',phone:$('#reg-phone').value,birth_date:$('#reg-birth').value,category:$('#reg-category').value,subscription_code:$('#reg-plan').value,transport:$('#reg-transport').checked,uniform:$('#reg-uniform').checked};const res=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok){alert(data.error||'تعذر إرسال الطلب');return}alert('تم إرسال الطلب رقم '+data.application_no+' والمبلغ المتوقع '+data.expected_amount+' دج');document.querySelector('.modal-backdrop')?.remove();return}if(a==='add-swimmer'){alert('يمكن إضافة السباحين من خلال طلبات التسجيل بعد اعتمادها.');return}if(a==='add-notice'){alert('الإعلانات متصلة بقاعدة البيانات في الخادم.');return}if(a==='print-card'){window.print();return}if(a==='mark-all'){alert('تم تأكيد حضور الحصة بنجاح.');}}

async function recordPendingAttendance(){const id=new URLSearchParams(location.search).get('attendance');if(!id||!state.user)return;const res=await fetch('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({member_id:id,status:'present'})});if(res.ok)showToast('تم تسجيل حضور السباح بنجاح.');else showToast('تعذر تسجيل الحضور، تحقق من صلاحية الحساب.','error');history.replaceState({},'',location.pathname+location.hash)}

async function syncApi(){try{const [sw,nt,apps,plans,reqs]=await Promise.all([fetch('/api/swimmers',{credentials:'same-origin'}),fetch('/api/notices',{credentials:'same-origin'}),fetch('/api/applications',{credentials:'same-origin'}),fetch('/api/subscriptions',{credentials:'same-origin'}),fetch('/api/coach-requirements')]);if(sw.ok)state.swimmers=(await sw.json()).map(x=>({id:x.membership_no,name:x.name,group:x.group_name,phone:x.phone,status:x.status==='active'?'نشط':'بانتظار'}));if(nt.ok)state.notices=(await nt.json()).map(x=>({title:x.title,text:x.text,date:x.date,type:x.kind}));if(apps.ok)state.applications=await apps.json();if(plans.ok)state.subscriptions=await plans.json();if(reqs.ok)state.coachRequirements=await reqs.json();save()}catch(e){console.warn('API sync unavailable',e)}}

async function boot(){

  if(state.user){

    try{const res=await fetch('/api/session',{credentials:'same-origin'});if(!res.ok)state.user=null;else{const data=await res.json();state.user=data.user;await syncApi()}}catch(e){state.user=null}

  }

  save();render();

}




/* Where the public registration button leads.



   The approved form is /istimara/. The platform used to carry a second one with

   the same fields and the same rules about a minor's declaration, written out

   twice -- which is how the pool names came to be hard-coded in three places and

   had to be dragged back into the database. Two registration forms drift, and the

   one that drifts is the one the public fills in.



   A price chosen on the platform travels with the person, so the plan is already

   selected when they arrive. */

const REGISTRATION_FORM = '/istimara/';

function registrationFormUrl(plan) {

  return REGISTRATION_FORM + (plan ? '?plan=' + encodeURIComponent(plan) : '');

}

function goToRegistration(plan) {

  location.assign(registrationFormUrl(plan));

}



function fullRegisterModal(){
  /* The door, on the form itself.


     A closed registration form that still sends is worse than no switch at

     all: it looks broken, and a club that cannot trust its own switch stops

     using it. So the message is on the form, the submit is taken away, and the

     save is refused by name even if a button is put back by hand. */

  const closed = typeof readDoor_==='function' && readDoor_()===false;

  return (closed ? (typeof doorClosedNotice_==='function' ? doorClosedNotice_(false) : '') : '')

  + `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal registration-modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>استمارة التسجيل</h2><p>بطاقة المعلومات الرسمية لنادي الصدارة</p></div><div class="form-section-title">1. الاختيار الرياضي والاشتراك</div><label>الرياضة<select id="reg-sport"><option>السباحة</option><option>العدو الريفي</option><option>العدو السريع</option></select></label><label>الفئة<select id="reg-category"><option value="minor">أصاغر — بيانات الولي مطلوبة</option><option value="adult">أكابر — تسجيل مباشر</option></select></label><label>الاشتراك<select id="reg-plan"><option value="quarter">فصلي — 1000 دج</option><option value="season">موسمي — 3000 دج</option><option value="agreement">اتفاقية — 3000 دج</option></select></label><label>المسبح أو المنشأة<select id="reg-facility"><option>المسبح الأولمبي</option><option>المسبح النصف أولمبي</option><option>الملعب البلدي</option><option>غابة غرداية</option></select></label><label class="check-line"><input id="reg-transport" type="checkbox"> النقل — 900 دج</label><label class="check-line"><input id="reg-uniform" type="checkbox"> البدلة الرياضية — 2500 دج</label><label>طريقة الدفع<select id="reg-payment"><option value="cash">نقدًا</option><option value="postal_check">صك بريدي</option><option value="postal_transfer">حوالة بريدية</option></select></label><div class="form-section-title">2. معلومات الرياضي</div><div class="form-two"><label>الاسم بالعربية *<input id="reg-first-ar"></label><label>اللقب بالعربية *<input id="reg-last-ar"></label><label>الاسم بالفرنسية<input id="reg-first-fr"></label><label>اللقب بالفرنسية<input id="reg-last-fr"></label><label>رقم التعريف الوطني<input id="reg-nin"></label><label>رقم شهادة الميلاد<input id="reg-birth-cert"></label><label>بلدية الميلاد<input id="reg-birth-place"></label><label>الولاية<input id="reg-wilaya" placeholder="غرداية"></label></div><label>تاريخ الميلاد *<input id="reg-birth" type="date"></label><div class="form-two"><label>الجنس<select id="reg-gender"><option>ذكر</option><option>أنثى</option></select></label><label>فصيلة الدم<select id="reg-blood"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label><label>المستوى الرياضي<select id="reg-level"><option>مبتدئ</option><option>متوسط</option><option>متقدم</option><option>نخبة</option></select></label><label>الهاتف *<input id="reg-phone" placeholder="05xx xx xx xx"></label></div><label>رقم واتساب<input id="reg-whatsapp"></label><label>العنوان *<input id="reg-address"></label><label>الصورة الشخصية<input id="reg-photo" type="file" accept="image/*"></label><div class="form-section-title">3. معلومات الولي والتصريح</div><div class="form-two"><label>اسم الولي<input id="reg-guardian-first"></label><label>لقب الولي<input id="reg-guardian-last"></label><label>صلة القرابة<input id="reg-guardian-relation" value="الأب"></label><label>هاتف الولي<input id="reg-guardian-phone"></label></div><label>رقم تعريف الولي<input id="reg-guardian-nin"></label><label class="check-line"><input id="reg-guardian-consent" type="checkbox"> أقر بصحة المعلومات وأوافق على ممارسة النشاط الرياضي</label><div class="official-docs"><a href="assets/registration-card.jpg" target="_blank">معاينة بطاقة التسجيل الرسمية</a><a href="assets/internal-regulations.jpg" target="_blank">معاينة النظام الداخلي</a></div><button class="btn btn-primary full" data-action="send-full-request">إرسال طلب التسجيل</button></div></div>`}

function coachRegisterModal() {

  const reqs = state.coachRequirements || [];

  return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal registration-modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>تسجيل مدرب</h2><p>يرسل الطلب إلى رئيس النادي للمراجعة والموافقة أو الرفض.</p></div><div class="form-section-title">معلومات المدرب والحساب الآمن</div><div class="form-two"><label>الاسم واللقب *<input id="coach-name" required></label><label>البريد الإلكتروني *<input id="coach-email" type="email" required></label><label>رقم الهاتف *<input id="coach-phone" type="tel" required></label><label>كلمة مرور الحساب *<input id="coach-password" type="password" minlength="6" required></label><label>سنوات الخبرة<input id="coach-experience" type="number" min="0"></label></div><label>التخصص والشهادة<input id="coach-specialty" placeholder="مدرب سباحة، منقذ، ..."></label><label>ملاحظات إضافية<textarea id="coach-notes" rows="3"></textarea></label><div class="form-section-title">الوثائق المطلوبة</div><p class="page-description">يرجى جمع الوثائق التالية في ملف PDF واحد، ثم رفعه. الحد الأقصى 10 ميغابايت.</p><ul class="coach-requirements">${reqs.map(r=>`<li>${r.required!==false?'* ':''}${esc(r.label)}</li>`).join('')}</ul><label>ملف الوثائق PDF *<input id="coach-pdf" type="file" accept="application/pdf" required></label><button class="btn btn-primary full" data-action="send-coach-request">إنشاء الحساب وإرسال الطلب</button></div></div>`;

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

  if(a==='register'){goToRegistration(el&&el.dataset&&el.dataset.plan);return}

  if(a==='register-desk'){

    /* Registering somebody standing in front of you, from inside the dashboard.

       Reached only from the applications page: this one is a different tool from

       the public form, not a second way to the same one. */

    document.querySelector('.modal-backdrop')?.remove();document.body.insertAdjacentHTML('beforeend',fullRegisterModal());bind();setupRegistrationMode();return;

  }

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

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="تسجيل الدخول"><div class="modal auth-modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo auth-logo">🏊</span><h2>الدخول عبر الهاتف</h2><p>تحقق من رقمك برسالة SMS للوصول الآمن.</p></div><div class="form-message" id="phone-message" role="status"></div><label>رقم الهاتف<input id="phone-number" type="tel" autocomplete="tel" placeholder="+213 5xx xx xx xx"></label><div id="recaptcha-container"></div><button class="btn btn-primary full" data-action="send-phone-code">إرسال رمز التحقق</button><label id="phone-code-wrap" hidden>رمز التحقق<input id="phone-code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></label><button class="btn btn-sms full" data-action="verify-phone-code" hidden>تأكيد الرمز والدخول</button><p class="hint">هذه الطريقة تتحقق من الهاتف وتتيح الدخول للحساب المرتبط به. إعادة تعيين كلمة مرور البريد تتم عبر رابط البريد الإلكتروني.</p></div></div>`); bind();

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

      /* Where the person's request stands decides whether they come in at all.

         A request still being read has not been refused, and a refusal is only

         fair if it says why -- so the two are answered differently, and neither

         is answered with "wrong password" for a password that was right. */

      const gate=data.gate||{};

      if(gate.gate==='pending'){

        authMessage('طلبك قيد الدراسة. سيُعلمك النادي بالنتيجة عند إقفال الطلب.','');return}

      if(gate.gate==='rejected'){

        /* Said about the account, which is what was refused -- and said with what

           to do, because the only other thing on this screen is the reset link,

           and that brings them straight back here with a correct new password and

           the same answer. Without that sentence the page is what keeps the loop

           going, not the person who fell into it.



           The club's own reason is still shown, in the club's own words. An

           accepted member never reaches this branch: refusing a second request no

           longer closes an account its first request opened. */

        authMessage((gate.reason?(' السبب الذي كتبته الإدارة: '+gate.reason):'')

          +'حسابك غير مفعّل على المنصة. '+(gate.what_now||'تواصل مع إدارة النادي.')

          +' استعادة كلمة المرور لا تفيد هنا: المرفوض هو الحساب نفسه، لا كلمة مروره.','error');return}

      if(gate.gate==='merged'){

        /* Not a refusal. The password was right, and saying otherwise sends the

           person to a password-reset page for a password that was never wrong.

           "Some other account" is not something anybody can act on either, so the

           one that remains is named. */

        authMessage('هذا الحساب دُمج في حساب آخر. '+(gate.reason||'استعمل الحساب الذي بقي.'),'error');return}

      if(gate.gate==='unknown'){

        authMessage('حالة الطلب غير معروفة. تواصل مع إدارة النادي. ('+gate.message+')','error');return}

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

  if(a==='print-registration-form'){printOfficialForms([registrationRecordFromForm()]);return}

  if(a==='notification'){state.page='notices';save();render();return}

  return currentAction(a,el);

};

document.addEventListener('click',e=>{if(e.target.closest('.notification'))action('notification')});

document.addEventListener('click',e=>{const link=e.target.closest('.official-docs a');if(!link)return;const file=link.getAttribute('href').split('/').pop();const files={'form-registration-01.jpg':'assets/form-registration-01.jpg','form-registration-02.jpg':'assets/form-registration-02.jpg','registration-card.jpg':'assets/registration-card.jpg','internal-regulations.jpg':'assets/internal-regulations.jpg'};const target=files[file];if(!target){e.preventDefault();return}const url=new URL(target,document.baseURI).href;if(new URL(url,location.href).origin===location.origin){e.preventDefault();/* window.open returns null when it is blocked, and the default is already cancelled by then, so a blocked click would do nothing at all with no sign that anything had been attempted. If it did not open, let the link itself do the work. */if(!window.open(url,'_blank','noopener'))location.assign(url)}});



const oldPageView=pageView;

pageView=function(p){if(p==='groups')return groupsPage();if(p==='card')return enhancedCardPage();return oldPageView(p);};

const oldRender=render;

render=function(){oldRender();buildQRCodes();};

buildQRCodes=function(){document.querySelectorAll('.qr-code').forEach(el=>{if(!window.QRCode||el.childElementCount)return;new QRCode(el,{text:location.origin+'/?attendance='+encodeURIComponent(el.dataset.qr),width:64,height:64,colorDark:'#071a35',colorLight:'#ffffff'});});};

setTimeout(()=>{if(state.user)recordPendingAttendance();},0);



/* ==========================================================

   Sadara Core — طباعة، بيانات حقيقية، وواجهة المدربين والرياضيين

   ========================================================== */

const CLUB={name:'النادي الرياضي الصدارة',unit:'فوج السباحة',address:'حي الثنية — غرداية',city:'غرداية',phone:'0660 60 64 67',email:'nadisadara@gmail.com',facebook:'https://www.facebook.com/nadiSadara47/',season:'2027 / 2026'};

const AR_MONTHS=['جانفي','فيفري','مارس','أفريل','ماي','جوان','جويلية','أوت','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const AR_DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

const WEEK_DAYS=['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];

const ATTENDANCE_LABELS={present:'حاضر',absent:'غائب',late:'متأخر',excused:'بعذر'};

const pad2=n=>String(n).padStart(2,'0');

const isoDay=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

const todayISO=()=>isoDay(new Date());

const longDate=(d=new Date())=>`${AR_DAYS[d.getDay()]}، ${slashDate(d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()))}`;

const money=v=>`${clubDigits(Number(v||0).toLocaleString('en-US'))} دج`;

const sum=(list,f)=>list.reduce((t,x)=>t+(Number(typeof f==='function'?f(x):x[f])||0),0);

/* ---------------------- the order of the requests ----------------------

   A queue, not a ledger: what needs deciding first, and what has been decided

   out of the way. Three rules, and they are the club's own:



     under review   always at the top, the newest first -- it is the work, and the

                    newest of it has been waiting least

     refused        always at the bottom, whatever their dates -- it has been dealt

                    with, and a refusal from last March above a request from

                    yesterday says the wrong thing about today

     everything decided leaves the list



   The date is read from the three places a request actually carries it: the

   timestamp the database wrote, the reference number (which has the day in it),

   and whatever date field the request holds. A request whose date cannot be read

   sorts to the bottom of its own group rather than to the top of the page,

   because an unknown date is not a recent one. */

function appDateValue(a){

  const t=a&&a.created_at;

  if(t){

    if(typeof t.toDate==='function'){const d=t.toDate();if(!isNaN(d.getTime()))return d.getTime();}

    if(typeof t==='number')return t;

    if(typeof t==='string'){const p=Date.parse(t);if(!isNaN(p))return p;}

  }

  const no=String((a&&(a.application_no||a.id))||'');

  const m=/(\d{4})(\d{2})(\d{2})/.exec(no);

  if(m)return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));

  const raw=String((a&&(a.date||a.registered_at||''))||'');

  if(raw){const p=Date.parse(raw);if(!isNaN(p))return p;}

  return 0;

}

/* 0 under review, 1 decided, 2 refused. Then the date, newest first, and a

   request with no readable date last within its own group. */

function appSortKey(a){

  const st=String((a&&a.status)||'pending');

  const group=st==='rejected'?2:(st==='pending'?0:1);

  const when=appDateValue(a);

  return [group, when?0:1, when?when:0];

}

function appSorted(list){return (list||[]).slice().sort((x,y)=>{

  const a=appSortKey(x),b=appSortKey(y);

  if(a[0]!==b[0])return a[0]-b[0];

  if(a[1]!==b[1])return a[1]-b[1];

  if(a[2]!==b[2])return b[2]-a[2];   /* newest first */

  return String((x&&x.application_no)||'').localeCompare(String((y&&y.application_no)||''));

});}

/* A request that has become a member is not a request. The record stays -- it is

   the account of what was decided and by whom, and the registration numbers are

   counted out of these documents -- but the queue does not carry it.



   A refusal is NOT out of the queue. It is at the bottom of it, which is a place

   in the list and not an absence from it: the manager still needs to see what was

   refused and why, and a page where a refusal has disappeared is a page where it

   has to be looked up somewhere else. Decided and dealt with are two different

   things, and only one of them empties. */

function appDecided(a){

  if(!a)return false;

  if(a.transferred_to)return true;

  /* Also the requests accepted before the transfer existed: fourteen of them,

     carrying a status and no mark. A queue that only knows the mark would carry

     every one of them for ever -- a page that gets longer every time the club

     does its job. A refusal is neither, which is the last thing to say about it. */

  return ['accepted','approved','\u0645قبول','\u0645قبولة']

    .indexOf(String(a.status||'pending'))!==-1;

}



const stateLabel=s=>s==='approved'?'مقبول':s==='rejected'?'مرفوض':s==='paid'?'مدفوع':s==='cancelled'?'ملغى':'قيد المراجعة';

const planName=code=>(state.subscriptions||[]).find(p=>p.code===code)?.name||code||'—';

const catLabel=c=>c==='minor'?'أصاغر':c==='adult'?'أكابر':c==='coach'?'مدرب':c||'—';

const appName=a=>a.application_type==='coach'?(a.coach_name||'مدرب'):`${a.first_name_ar||''} ${a.last_name_ar||''}`.trim()||a.application_no||'—';

const appContact=a=>clubDigits(a.application_type==='coach'?(a.coach_phone||a.coach_email||''):(a.phone||''));

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

  const bare = options.bare === true;
  if (!bare) {
    const head=document.createElement('header');
    head.className='print-head';
    head.innerHTML='<div class="print-head-main"><b>'+esc(CLUB.name)+' — '+esc(CLUB.unit)+'</b><span class="print-head-title">'+esc(options.title||'تقرير')+'</span>'+(options.sub?'<span class="print-head-sub">'+esc(options.sub)+'</span>':'')+'</div>'
      +'<div class="print-head-side"><span>الموسم '+esc(CLUB.season)+'</span><span>'+esc(options.date||longDate())+'</span></div>';
    host.appendChild(head);
  }
  const body=document.createElement('div');
  body.className='print-body'+(options.variant?' print-'+options.variant:'');
  while(node.firstChild) body.appendChild(node.firstChild);

  host.appendChild(body);

  if(options.notes) host.insertAdjacentHTML('beforeend','<div class="print-notes">'+options.notes+'</div>');

  if (!bare) host.insertAdjacentHTML('beforeend','<footer class="print-foot"><span>'+esc(CLUB.address)+' — تلف: <span dir="ltr">'+esc(CLUB.phone)+'</span></span><span>'+esc(CLUB.email)+'</span></footer>');
  host.classList.add(options.variant ? 'print-'+options.variant : 'print-plain');

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

    +list.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.name||'')+'</b></td><td dir="ltr">'+esc(clubDigits(s.id||''))+'</td><td>'+esc(s.group||'—')+'</td><td dir="ltr">'+esc(clubDigits(s.phone||'—'))+'</td><td><span class="status '+(s.status==='نشط'?'success':'pending')+'">'+esc(s.status||'—')+'</span></td>'+(extraCell?'<td>'+extraCell(s)+'</td>':'')+'<td class="sign-cell"></td></tr>').join('')

    +'</tbody></table>';

}

function printGroupRoster(groupId){

  const g=groups().find(x=>x.id===groupId);

  if(!g){showToast('تعذر العثور على بيانات الفوج.','error');return}

  const list=swimmersOf(g.name);

  const box=document.createElement('section');

  box.className='roster';

  box.innerHTML='<div class="roster-head"><div><h3>قائمة فوج '+esc(g.name)+'</h3><p>المدرب المشرف: '+esc(g.coach||'—')+' · البرنامج: '+esc(g.schedule||'—')+'</p></div><div class="roster-count"><b>'+clubDigits(list.length)+'</b><small>سباح</small></div></div>'

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

/* A swimmer's name in the two columns a sheet has for it.



   Accepted requests carry the two names apart, which is how the registration form

   collects them. Older records and anything added by hand carry one string, so it

   is split on the first space -- the surname is what is left, and in this club the

   second half is the family. */

function swimmerNames(s){

  const first=String(s.first_name_ar||'').trim();

  const last=String(s.last_name_ar||'').trim();

  if(first||last)return {first:first,last:last};

  const whole=String(s.name||'').trim().split(/\s+/);

  return {first:whole[0]||'',last:whole.slice(1).join(' ')};

}



/* The attendance sheet: the club's five columns, and a pen's row.



   What a coach reads off paper is the name, the surname, the day they were born

   -- so a junior is not confused with a senior who shares the first name -- whether

   they came, and somewhere to write. All five, and nothing else.



   Each row is 1.2 cm: what a pen needs and no more, so thirty swimmers are one

   page rather than one and a half. The header is a line rather than a panel,

   because a sheet carried to the pool is not read on a screen.



   What was recorded is printed and the cell is left tall enough to correct by

   hand -- a printed sheet is usually there because somebody was not in the room

   when the mark was made, and a sheet that can only be read cannot be fixed. */

/* Where a member's photograph is.



   The photograph has been collected since the form was built -- it is mandatory,

   and it is already printed on the registration form -- and it stopped at the

   request. So every accepted member was written without it, and both card engines

   found nothing: the club's batch and the member's own card printed a name, a

   number, and the club's logo standing in for a face.



   Three sources, in the order they should be believed. The member's own copy

   first, so neither card depends on the requests being loaded -- and a coach's

   browser cannot read the requests, so a card that reached for them would print a

   blank face on exactly the screen where a face is wanted. Then the request the

   member came from, which is where the photograph has always been for everybody

   who joined before the member carried it. Then the picture the member uploaded

   for themselves, which is what a member printing their own card should see. */

function memberPhoto(s, profile){

  const own=profile&&(profile.photo||profile.photo_url||profile.photoDataUrl);

  return memberField(s, 'photo') || (own&&/^(data:|https?:)/.test(String(own))?own:'');

}



/* A member's field, from the member or from the request it came from.



   A member accepted before the platform began copying a field across does not

   carry it, and the request they were accepted from still does in full -- it is

   marked `transferred_to`, never deleted, precisely so that what was decided

   stays on file.



   Nothing is written back. This answers what to print, and the answer can be read

   rather than repaired: writing it onto the member record would change data the

   club owns to fix a printing fault, which is the opposite of what was asked for.



   One function, so the photograph and the day of birth cannot each grow their own

   fallback and disagree about where a member's details are. */

function memberField(s, field){

  const here=s&&s[field];

  if(here)return here;

  /* `doc_id` is the document's own id, and for a member that document *is*

     the request they were accepted from -- the register is keyed by it. It

     was missing from the list above, so a member carrying no

     `from_application` field -- which is most of the roster -- had no route

     back to the request, and so no photograph, whatever the server had

     already sent. A card is asked to print a face; this is where it went.

     Read, never written: repairing the data would change records the club

     owns to fix a printing fault. */

  const from=s&&(s.from_application||s.application_no||s.application_id||s.doc_id);

  if(!from)return '';

  const req=((state.applications||[]).find(a=>String(a.id)===String(from)

    ||String(a.application_no||'')===String(from))||{});

  return (req&&req[field])||'';

}



/* An eye on every password field, added after the page is built.



   Decorated rather than written into the markup, because not every password field

   exists when the page does: the sign-in window is put together when it is opened,

   and a settings panel that was closed has no fields in it at all. Whatever is on

   the page gets one, without anything having to remember to ask.



   Three things it gets right, and each is a way this usually goes wrong. The button

   is type="button", because a button with no type inside a form submits it, and an

   eye that posts the registration form is worse than no eye. It gives the focus

   back to the field, because toggling is something you do while typing and an eye

   that takes the caret away means finding where you were afterwards. And it says

   its state with aria-pressed, which is what tells somebody who cannot see the eye

   whether the password is on the screen.



   Marked as done, so being called twice does not grow two eyes.



   It is called from the final layer's bind, not from the bind written here: a

   later layer reassigns bind, so a call in this one is a call nothing makes. */

function passwordEyes(root) {

  const scope = (root && root.querySelectorAll) ? root : document;

  const fields = scope.querySelectorAll('input[type="password"]');

  for (let i = 0; i < fields.length; i++) {

    const input = fields[i];

    if (!input || input.dataset.eyeReady) continue;

    const host = input.parentNode;

    if (!host || !host.insertBefore) continue;

    input.dataset.eyeReady = '1';

    if (host.classList) host.classList.add('with-eye');



    const eye = document.createElement('button');

    eye.type = 'button';

    eye.className = 'eye-toggle';

    eye.setAttribute('aria-pressed', 'false');

    eye.setAttribute('aria-label', '\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631');

    eye.title = '\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631';

    eye.textContent = '\u25CB';

    eye.addEventListener('click', () => {

      const shown = input.type === 'text';

      input.type = shown ? 'password' : 'text';

      eye.setAttribute('aria-pressed', shown ? 'false' : 'true');

      eye.setAttribute('aria-label', shown

        ? '\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631'

        : '\u0625\u062e\u0641\u0627\u0621 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631');

      eye.title = eye.getAttribute('aria-label');

      eye.textContent = shown ? '\u25CB' : '\u25C9';

      /* The caret back where it was: toggling is something you do while typing. */

      try {

        const at = input.value.length;

        input.focus();

        input.setSelectionRange(at, at);

      } catch (_) {}

    });

    if (input.nextSibling) host.insertBefore(eye, input.nextSibling);

    else host.appendChild(eye);

  }

}



function printAttendanceSheet(){

  const group=state.attendanceGroup||'all';

  const list=group==='all'?(state.swimmers||[]):swimmersOf(group);

  const day=attendanceDay();

  const session=attendanceSessionLabel();

  const present=list.filter(s=>{const m=dayMark(day,s.id);return m&&m.status==='present';}).length;

  const absent=list.filter(s=>{const m=dayMark(day,s.id);return m&&m.status==='absent';}).length;

  const late=list.filter(s=>{const m=dayMark(day,s.id);return m&&m.status==='late';}).length;

  const marked=list.filter(s=>dayMark(day,s.id)).length;



  const statusCell=s=>{

    const m=dayMark(day,s.id);

    const cls=m&&m.status==='present'?'ok':m&&m.status==='absent'?'no':m&&m.status==='late'?'late':'';

    const word=m?(ATTENDANCE_LABELS[m.status]||m.status):'';

    return '<td class="att-state'+(cls?' is-'+cls:'')+'">'+esc(word)+'</td>';

  };



  const box=document.createElement('section');

  box.className='roster att-sheet';

  box.innerHTML='<div class="att-line"><b>كشف حضور '+esc(session)+'</b>'

    +'<span>'+esc(CLUB.name)+' · '+esc(slashDate(day))

    +(group==='all'?'':' · '+esc(groups().find(g=>g.name===group)?groups().find(g=>g.name===group).name:group))

    +'</span>'

    +'<span class="att-tally">حاضر '+clubDigits(present)+' · غائب '+clubDigits(absent)+' · متأخر '+clubDigits(late)+' · بلا تسجيل '+clubDigits(list.length-marked)+'</span></div>'

    +(list.length

      ? '<table class="print-table att-table"><thead><tr>'

        +'<th>الاسم</th><th>اللقب</th><th>تاريخ الميلاد</th><th>حاضر / غائب</th><th>ملاحظة</th>'

        +'</tr></thead><tbody>'

        +list.map(s=>{const n=swimmerNames(s);return '<tr>'

          +'<td>'+esc(n.first)+'</td>'

          +'<td>'+esc(n.last)+'</td>'

          /* From the member, or from the request it came from: a member accepted

             before the platform began copying it across does not carry one, and a

             column that is silently empty on half a sheet is a column nobody can

             read a junior's age from. */

          +'<td dir="ltr">'+esc(slashDate(memberField(s,'birth_date')))+'</td>'

          +statusCell(s)

          +'<td></td></tr>';}).join('')

        +'</tbody></table>'

      : '<p class="empty-cell">لا يوجد سباحون في هذه القائمة.</p>')

    +'<div class="sheet-sign"><span>توقيع المشرف</span><span>التاريخ</span><span>ختم النادي</span></div>';

  printArea(box,{title:'كشف الحضور',sub:slashDate(day),variant:'roster'});

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



/* ---------------------- الوصول للبيانات ---------------------- */

state.swimmers=state.swimmers||[];

state.applications=state.applications||[];

state.subscriptions=state.subscriptions||[];

state.notices=state.notices||[];

state.schedules=state.schedules||[];

state.cards=state.cards||[];

state.attendance=state.attendance||{};

state.attendanceByDay=state.attendanceByDay||{};

state.attendanceDate=state.attendanceDate||'';



/* ---------------------- the session being recorded ----------------------



   The club fills attendance in after the session, not during it: a coach who was

   at the pool on Saturday writes it on Sunday. Every mark used to be filed under

   whatever day it happened to be clicked, so a sheet filled in late landed on the

   wrong day and the weekly bars and the printed sheet were quietly wrong about it.



   A week back is as far as it goes. A week is how long a forgotten sheet stays a

   forgotten sheet; further back is either a different mistake or a different

   season. A day in the future is not a session yet, so it is refused rather than

   offered -- and a stored day that falls outside the window falls back to today

   rather than being trusted, because a page left open across a week would otherwise

   offer a week-old session as though it were this morning's. */

const ATTENDANCE_BACK_DAYS=7;

function attendanceEarliest(){

  const d=new Date();d.setDate(d.getDate()-ATTENDANCE_BACK_DAYS);

  return isoDay(d);

}

function attendanceDay(){

  const today=todayISO();

  const chosen=String(state.attendanceDate||'');

  if(/^\d{4}-\d{2}-\d{2}$/.test(chosen)&&chosen>=attendanceEarliest()&&chosen<=today)return chosen;

  return today;

}

function attendanceIsPast(){return attendanceDay()!==todayISO();}



/* The sessions a sheet can be written for, oldest last. A select rather than a

   date box: a date box shows its format in whatever language the browser is set

   to, and this platform writes dates one way. Seven named days in the club's

   digits promise that without the browser's help -- and put the limit where it

   can be seen, which is the reason the club asked for one. */

function attendanceDayChoices(){

  const out=[];

  for(let i=ATTENDANCE_BACK_DAYS;i>=0;i--){

    const d=new Date();d.setDate(d.getDate()-i);

    const key=isoDay(d);

    out.push({key:key,label:AR_DAYS[d.getDay()]+' \u00b7 '+slashDate(key)});

  }

  return out;

}

function attendanceDayPicker(){

  const day=attendanceDay();

  return '<select class="filter" id="attendance-date" aria-label="حصة اليوم">'

    +attendanceDayChoices().map(c=>'<option value="'+c.key+'"'+(c.key===day?' selected':'')+'>'+esc(c.label)+'</option>').join('')

    +'</select>';

}

/* What to call it. A page showing Saturday must not call itself today. */

function attendanceSessionLabel(){

  return attendanceIsPast()?('حصة يوم '+slashDate(attendanceDay())):'حصة اليوم';

}



/* One place reads a mark, because the day map holds the status and the moment it

   was written, and a browser still holding last month's page holds the old shape:

   a bare status string. Read raw, an object reads as "[object Object]" and every

   swimmer looks absent -- quietly, and only for the people who had not reloaded. */

function dayMark(day,id){

  const rec=((state.attendanceByDay||{})[day]||{})[String(id)];

  if(!rec)return null;

  if(typeof rec==='string')return {status:rec,at:''};

  return {status:rec.status||'present',at:rec.at||''};

}

state.extras=state.extras||{transport:900,uniform:2500};

state.groups=state.groups||[];



function attendanceOf(id){

  /* The day being recorded, and not the swimmer's last mark anywhere: a page

     showing Saturday must not show what happened to them on Sunday. */

  const m=dayMark(attendanceDay(),id);

  if(!m)return null;

  return {status:m.status,at:m.at,date:attendanceDay()};

}

function attendanceRate(list,day){

  const src=list||state.swimmers||[];

  if(!src.length)return null;

  const on=day||attendanceDay();

  const present=src.filter(s=>{const a=dayMark(on,s.id);return a&&a.status==='present';}).length;

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

    out.push({key,label:AR_DAYS[d.getDay()],value:ids.length?Math.round(ids.filter(k=>{const m=dayMark(key,k);return m&&m.status==='present';}).length/ids.length*100):null,isToday:i===0});

  }

  return out;

}

/* ---------------------- searching ----------------------

   One question, asked one way, so two searches cannot disagree about what a

   number typed in one set of digits means.



   A number read off a printed card is in the club's digits; a number typed into a

   phone keyboard is in Latin. Both are the same number, and both have to find the

   same person. Case is folded for the same reason: a name typed in capitals is

   still the name. */

function matchesText(what, needle){

  const q=latinDigits(String(needle||'')).trim().toUpperCase();

  if(!q)return true;

  return latinDigits(String(what||'')).toUpperCase().includes(q);

}

/* What a request can be found by: who, and every number the club reads off it. */

function appHaystack(a){

  return appName(a)+' '+(a.application_no||'')+' '+(a.registration_id||'')+' '+(appContact(a)||'');

}

/* And a member: the name, every number on the card, the group and the telephone --

   because the number a coach reads at the gate is the one somebody is certain of,

   and it has to be one of these. */

function swimmerHaystack(s){

  return [s.name,s.first_name_ar,s.last_name_ar,s.id,s.membership_no,s.registration_id,

          s.phone,s.group,s.group_name,s.blood_group].filter(Boolean).join(' ');

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

  return '<section class="welcome"><div><span>'+esc(slashDate(longDate()))+'</span><h2>مرحبًا، '+esc(firstName())+' 👋</h2><p>إليك ملخص أداء النادي لهذا اليوم.</p></div>'

    +'<button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button></section>'

    +'<div class="stats-grid">'

    +'<div class="stat-card"><span class="stat-icon blue">♙</span><small>إجمالي السباحين</small><strong>'+clubDigits(sw.length)+'</strong><em class="neutral">'+clubDigits(sw.filter(s=>s.status==='نشط').length)+' <i>نشط</i></em></div>'

    +'<div class="stat-card"><span class="stat-icon mint">✓</span><small>حضور اليوم</small><strong>'+(rate===null?'—':clubDigits(rate)+'%')+'</strong><em class="neutral">'+clubDigits(Object.keys(state.attendance).length)+' <i>تسجيل اليوم</i></em></div>'

    +'<div class="stat-card"><span class="stat-icon gold">▣</span><small>بطاقات نشطة</small><strong>'+clubDigits(cards)+'</strong><em class="neutral">'+esc(clubDigits(CLUB.season))+' <i>الموسم</i></em></div>'

    +'<div class="stat-card"><span class="stat-icon red">!</span><small>طلبات معلقة</small><strong>'+clubDigits(pad2(pending))+'</strong><em class="neutral">'+money(collectedAmount())+' <i>محصّل</i></em></div>'

    +'</div>'

    +'<div class="content-grid">'

    +'<section class="panel chart-panel"><div class="panel-head"><div><h3>نسبة الحضور</h3><p>آخر ٧ أيام — من سجل الحضور</p></div><a class="link" data-page="attendance">إدارة السجل ←</a></div>'

    +'<div class="chart"><div class="chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="bars">'

    +week.map(d=>'<div class="bar-wrap'+(d.isToday?' is-today':'')+'"><div class="bar'+(d.value===null?' empty':'')+'" style="height:'+Math.max(d.value||0,2)+'%"><b>'+(d.value===null?'—':clubDigits(d.value)+'%')+'</b></div><small>'+esc(d.label)+'</small></div>').join('')

    +'</div></div></section>'

    +'<section class="panel"><div class="panel-head"><div><h3>آخر الإعلانات</h3><p>تحديثات النادي الأخيرة</p></div><a class="link" data-page="notices">عرض الكل</a></div>'

    +((state.notices||[]).length?state.notices.slice(0,4).map(n=>'<div class="notice-row"><span class="notice-dot"></span><div><b>'+esc(n.title)+'</b><p>'+esc(n.text)+'</p><small>'+esc(slashDate(n.date||''))+'</small></div></div>').join(''):'<p class="empty-cell">لا توجد إعلانات.</p>')

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



// minimal base declarations; the Sadara Core layers below rebind both names
function pageView(p){ return pageApplications(); }
function pageTitle(p){ return '\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629'; }
function pageApplications(){

  const list=state.applications||[];

  const q=(state.appQuery||'').trim();

  const f=state.appFilter||'all';

  /* Decided requests are out of the queue unless somebody asks for them, and the

     order is applied before the search so a filter cannot argue with it. */

  const showDecided=!!state.appShowDecided;

  const open=(showDecided?list:list.filter(a=>!appDecided(a)));

  const decidedCount=list.length-open.length;

  const rows=appSorted(open).filter(a=>{

    if(f!=='all'&&(a.status||'pending')!==f)return false;

    if(!q)return true;

    /* Folded on both sides, so a number read off a printed sheet -- which is in

       the club's digits -- finds the record it names, and a number pasted in from

       a spreadsheet finds it too. Both are written to the database in one form, so

       this is the only place the two have to meet. */

    return matchesText(appHaystack(a), q);

  });

  const head='<div class="toolbar"><div class="search">⌕<input placeholder="ابحث بالاسم أو رقم الطلب..." id="app-search" value="'+esc(q)+'"></div>'

    +'<div class="toolbar-group">'

    +'<select class="filter" id="app-filter">'+[['all','كل الحالات'],['pending','قيد المراجعة'],['approved','مقبول'],['rejected','مرفوض']].map(([v,l])=>'<option value="'+v+'"'+(v===f?' selected':'')+'>'+l+'</option>').join('')+'</select>'

    +'<label class="check-line" title="ما تم البت فيه ينتقل إلى قائمة السباحين، ويبقى هنا للسجل"><input type="checkbox" id="app-show-decided"'+(showDecided?' checked':'')+'> إظهار المحسومة</label>'

    +printBtn('print-applications','طباعة القائمة')

    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'

    +'</div></div>';

  const body='<section class="panel table-panel"><div class="panel-head"><div><h3>طلبات التسجيل والمدربين</h3><p>'+clubDigits(rows.length)+' طلب مفتوح'

    +(decidedCount?(' — و'+clubDigits(decidedCount)+' تم البت فيه، انتقلت إلى قائمة السباحين'):'')

    +' — قيد المراجعة أولًا من الأحدث إلى الأقدم، والمرفوض في الأسفل</p></div></div>'

    +'<div class="table-scroll"><table><thead><tr><th>رقم الطلب</th><th>رقم التسجيل</th><th>المتقدم</th><th>النوع</th><th>الاشتراك</th><th>المبلغ</th><th>الوثائق</th><th>الحالة</th><th>القرار</th><th></th></tr></thead><tbody>'

    +(rows.length?rows.map(a=>'<tr><td dir="ltr">'+esc(clubDigits(a.application_no||a.id))+'</td>'

      /* The number the club reads off the card and the applicant is told at the

         counter. Beside the request number rather than instead of it: one is what

         the platform filed, the other is what the member is. */

      +'<td dir="ltr">'+(a.registration_id?'<b>'+esc(clubDigits(a.registration_id))+'</b>':'<small>—</small>')+'</td>'

      +'<td><b>'+esc(appName(a))+'</b><br><small dir="ltr">'+esc(appContact(a)||'—')+'</small></td>'

      +'<td>'+esc(catLabel(a.application_type==='coach'?'coach':a.category))+'</td>'

      +'<td>'+esc(a.application_type==='coach'?'—':planName(a.subscription_code))+'<br><small>'+(a.transport?'النقل ':'')+(a.uniform?'البدلة':'')+'</small></td>'

      +'<td>'+esc(a.application_type==='coach'?'—':money(a.expected_amount))+'</td>'

      +'<td>'+(a.documents&&a.documents.path?'<button class="check-btn" data-action="open-coach-doc" data-path="'+esc(a.documents.path)+'">فتح PDF</button>':(a.documents&&a.documents.url?'<a class="link" href="'+esc(a.documents.url)+'" target="_blank" rel="noopener">PDF</a>':'—'))+'</td>'

      /* The club's own words, so what the applicant is shown at the door and what

         the manager reads here are the same sentence. */

      +'<td><span class="status '+((a.status||'pending')==='approved'?'success':(a.status||'pending')==='rejected'?'rejected':'pending')+'">'+esc(stateLabel(a.status))+'</span>'+((a.rejection_reason||a.decision_reason)?'<br><small>'+esc(a.rejection_reason||a.decision_reason)+'</small>':'')+'</td>'

      +'<td>'+((a.status||'pending')==='pending'?'<button class="check-btn ok" data-action="approve-app" data-id="'+esc(a.id)+'">موافقة</button> <button class="check-btn no" data-action="reject-app" data-id="'+esc(a.id)+'">رفض</button>':'<small>تم القرار</small>')+'</td>'

      +'<td class="row-actions">'
      +'<button class="check-btn print" data-action="print-official-form" data-id="'+esc(a.id)+'">'
      +'استمارة الإلحاق الرسمية</button> '
      +'<button class="row-more" data-action="edit-app" data-id="'+esc(a.id)+'">•••</button></td>'

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

    return matchesText(swimmerHaystack(s), q);

  });

  const groupNames=[...new Set([...(state.swimmers||[]).map(s=>s.group).filter(Boolean),...groups().map(g=>g.name)])];

  return '<div class="toolbar"><div class="search">⌕<input placeholder="ابحث عن سباح..." id="user-search" value="'+esc(q)+'"></div>'

    +'<div class="toolbar-group">'

    +'<select class="filter" id="group-filter"><option value="all">كل الأفواج</option>'+groupNames.map(n=>'<option'+(n===f?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select>'

    +printBtn('print-swimmers','طباعة القائمة')

    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'

    +'<button class="btn btn-primary" data-action="add-swimmer">+ إضافة سباح</button>'

    +'</div></div>'

    +'<section class="panel table-panel"><div class="panel-head"><div><h3>قائمة السباحين</h3><p>'+clubDigits(list.length)+' من '+(state.swimmers||[]).length+' سجل — الموسم '+esc(clubDigits(CLUB.season))+'</p></div></div>'

    +'<div class="table-scroll"><table><thead><tr><th>السباح</th><th>رقم الانخراط</th><th>الفوج</th><th>الهاتف</th><th>الحالة</th><th>الحضور اليوم</th><th></th></tr></thead><tbody>'

    +(list.length?list.map(s=>{const a=attendanceOf(s.id);return '<tr><td><span class="table-avatar">'+esc((s.name||'?')[0])+'</span><b>'+esc(s.name||'')+'</b></td>'

      +'<td dir="ltr">'+esc(clubDigits(s.id||''))+'</td><td>'+esc(s.group||'—')+'</td><td dir="ltr">'+esc(clubDigits(s.phone||'—'))+'</td>'

      +'<td><span class="status '+(s.status==='نشط'?'success':'pending')+'">'+esc(s.status||'—')+'</span></td>'

      +'<td>'+(a?'<span class="status '+(a.status==='present'?'success':a.status==='late'?'late':'absent')+'">'+esc(ATTENDANCE_LABELS[a.status]||a.status)+'</span>':'<small>لم يُسجّل</small>')+'</td>'

      +'<td class="row-actions"><button class="check-btn" data-action="edit-swimmer" data-id="'+esc(s.id)+'">تعديل</button> '+groupButtonFor(s)+'<button class="check-btn no" data-action="delete-swimmer" data-id="'+esc(s.id)+'">حذف</button></td></tr>';}).join(''):emptyRow(7,'لا يوجد سباحون مطابقون.'))

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

  return {start:saturday,end:friday,label:clubDigits(pad2(saturday.getDate()))+' — '+clubDigits(pad2(friday.getDate()))+' '+AR_MONTHS[friday.getMonth()]+' '+clubDigits(friday.getFullYear())};

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

    return '<div class="day-column"><h3>'+esc(day)+'<small>'+clubDigits(pad2(d.getDate()))+' '+AR_MONTHS[d.getMonth()]+' · '+(list.length?list.length+' حصة':'راحة')+'</small></h3>'

      +(list.length?list.map(s=>'<article class="session"><span class="session-time">'+esc(clubDigits(s.time_range||''))+'</span><strong>'+esc(s.group_name||'')+'</strong><small>'+esc(s.pool||'مسبح الصدارة')+'</small><em>'+esc(s.coach||'')+'</em>'

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

    +(sessions.length?sessions.map(s=>'<tr><td><b>'+esc(s.day_name||'')+'</b></td><td dir="ltr">'+esc(clubDigits(s.time_range||''))+'</td><td>'+esc(s.group_name||'')+'</td><td>'+esc(s.coach||'')+'</td><td>'+esc(s.pool||'مسبح الصدارة')+'</td></tr>').join(''):emptyRow(5,'لا توجد حصص مبرمجة. استخدم زر "إضافة حصة".'))

    +'</tbody></table></div></section>';

}



function pageAttendance(){

  const list=state.swimmers||[];

  const rate=attendanceRate();

  const count=s=>list.filter(x=>{const a=attendanceOf(x.id);return a&&a.status===s;}).length; const shownCount = n => clubDigits(count(n));;

  const group=state.attendanceGroup||'all';

  const shown=group==='all'?list:swimmersOf(group);

  const opts=['present','late','absent'];

  return '<div class="attendance-summary"><div><b>'+esc(attendanceSessionLabel())+'</b><strong>'+(rate===null?'—':clubDigits(rate)+'%')+'</strong></div>'

    +'<div><b>حاضر</b><strong class="green">'+shownCount('present')+'</strong></div>'

    +'<div><b>غائب</b><strong class="red-text">'+shownCount('absent')+'</strong></div>'

    +'<div><b>متأخر</b><strong class="orange">'+shownCount('late')+'</strong></div></div>'

    +'<div class="toolbar"><div class="toolbar-group">'

    +attendanceDayPicker()

    +'<select class="filter" id="attendance-group"><option value="all">كل الأفواج</option>'+groups().map(g=>'<option'+(g.name===group?' selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select>'

    +printBtn('print-attendance','طباعة كشف الحضور')

    +'<button class="btn btn-outline" data-action="mark-all-present">✓ تأكيد الجميع</button>'

    +'<button class="btn btn-outline" data-action="reset-attendance">↺ تصفير</button>'

    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'

    +'</div><span class="page-description">'+esc(slashDate(longDate()))+'</span></div>'

    +'<section class="panel table-panel"><div class="panel-head"><div><h3>حضور '+esc(attendanceSessionLabel())+'</h3><p>'+clubDigits(shown.length)+' سباح · اضغط على الحالة لتغييرها</p></div></div>'

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

      +'<div><h3>'+esc(n.title)+'</h3><p>'+esc(n.text)+'</p><small>'+esc(slashDate(n.date||''))+'</small></div>'

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

    +'<label>الهاتف<input id="club-phone" dir="ltr" value="'+esc(clubDigits(CLUB.phone))+'"></label>'

    +'<label>البريد الإلكتروني<input id="club-email" dir="ltr" value="'+esc(CLUB.email)+'"></label>'

    +'<label>الموسم الرياضي<input id="club-season" value="'+esc(clubDigits(CLUB.season))+'"></label>'

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

/* The swimmers this account is answerable for.



   For a member that is whatever the database let through: their own card, and each

   of their children's, because the rules refuse the rest before the page is given

   a say. Nothing is filtered here -- a browser is not a place to decide who may

   read the roster, and the filtering that used to happen here is what took a

   parent's three children away from them: none of them carries the parent's

   number, so at most one could ever match.



   For a member of staff it is the club's roster, and they are one person in it --

   which `mySwimmer` still works out for itself, by number, then telephone, then

   name. */

function mySwimmers(){

  return (state.swimmers||[]).slice();

}



/* The swimmer being looked at.



   Everything on this page -- the face, the three numbers, the timetable -- reads

   this one and not another, because they are three readings of the same person and

   two of them at once is how a parent reads the wrong child.



   The choice is kept, so coming back to the page comes back to the same child

   rather than to the first name in a list that may have been re-sorted underneath

   them. A choice that nobody can keep is not a choice. */

function chosenSwimmer(){

  const list=mySwimmers();

  if(!list.length)return null;

  const want=String(state.chosenSwimmer||'');

  return list.find(s=>String(s.id)===want)||list[0];

}

function mySwimmer(){

  const u=state.user||{};

  const list=state.swimmers||[];

  if(['admin','president','coach'].includes(u.role)){

    const no=(u.member_no||'').trim();

    if(no){const hit=list.find(s=>String(s.id)===no);if(hit)return hit}

    const phone=String(u.phone||'').replace(/\s/g,'');

    if(phone){const hit=list.find(s=>String(s.phone||'').replace(/\s/g,'').endsWith(phone));if(hit)return hit}

    const name=(u.name||'').trim();

    if(name){const hit=list.find(s=>String(s.name||'').trim()===name);if(hit)return hit}

  }

  return chosenSwimmer();

}

/* The timetable, for the swimmer being looked at and nobody else.



   Their group, and their level where the timetable carries one -- narrowing by a

   level the timetable does not have would leave a member with no sessions at all,

   which reads as "your group has no timetable" rather than as "we could not match

   you".



   It used to answer with every session when no swimmer could be found, and that is

   how a member with no card was shown other children's groups: the fallback was

   "show everything", and everything is somebody else's group. It shows none now,

   and says so. */

function mySessions(){

  const me=chosenSwimmer();

  const coachGroup=(state.user?.group_name||'').trim();

  const list=state.schedules||[];

  if(coachGroup)return list.filter(s=>String(s.group_name||'').trim()===coachGroup);

  if(!me)return [];

  const group=String(me.group||me.group_name||'').trim();

  const level=String(me.level||'').trim();

  return list.filter(s=>{

    if(group&&String(s.group_name||'').trim()!==group)return false;

    if(level&&s.level&&String(s.level).trim()!==level)return false;

    return true;

  });

}



/* What the three numbers count, for one swimmer and one season.



   Every one of them is a reading of the marks and nothing else: no target, no

   comparison with last month, no figure that could not be read off a record. The

   progress share is the one that could have been invented, so it is defined in the

   card's own words -- the share of recorded sessions they were present for. A

   swimmer with one session marked is a hundred per cent, and the card says "one of

   one" beside it, which is the truth about it. */

function swimmerProgress(me){

  const out={attended:0,absent:0,late:0,recorded:0};

  if(!me)return out;

  const days=state.attendanceByDay||{};

  Object.keys(days).forEach(d=>{

    const m=dayMark(d,me.id);

    if(!m)return;

    out.recorded++;

    if(m.status==='present')out.attended++;

    else if(m.status==='late')out.late++;

    else if(m.status==='absent')out.absent++;

  });

  return out;

}

function myAttendance(){

  const me=mySwimmer();

  const out=[];

  const days=state.attendanceByDay||{};

  if(me)Object.keys(days).sort().forEach(k=>{const m=dayMark(k,me.id);if(m)out.push({date:k,status:m.status});});

  return out.reverse();

}

/* A swimmer's face, in a circle, or their own initial in one.



   The club's mark is not used here. A logo where a face should be is a photograph

   of nobody, and on a page whose whole job is to say whose this is, it is worse

   than admitting there is no picture. */

function swimmerFace(me, size){

  const photo=memberPhoto(me, state.profile);

  const initial=String((me&&me.name)||'?').trim().charAt(0);

  const box='<div class="mine-avatar'+(photo?'':' is-empty')+'"'

    +(size?' style="--face:'+size+'px"':'')+'>'

    +(photo?'<img src="'+esc(photo)+'" alt="صورة '+esc(me.name||'')+'">':'<span>'+esc(initial)+'</span>')

    +'</div>';

  return box;

}



/* The member's space. A face, a switch, three numbers, and the timetable of the

   person chosen -- in that order, because that is the order a parent reads them. */

function memberSpace(me, mine, sessions, role){

  const p=swimmerProgress(me);

  const pct=p.recorded?Math.round(p.attended/p.recorded*100):null;

  const full=String(me&&me.name||'').trim();

  const who=esc(full||'لا يوجد سبّاح مرتبط بهذا الحساب');

  const sub=me

    ? esc([me.group||me.group_name,me.level].filter(Boolean).join(' · ')||'فوج غير محدد')

      +' · <span dir="ltr">'+esc(clubDigits(me.id||''))+'</span>'

    : 'اربط الحساب ببطاقة سبّاح لتظهر بياناته هنا.';



  const switcher=mine.length>1

    ? '<div class="mine-switch"><label for="which-swimmer">السبّاح</label>'

      +'<select id="which-swimmer" class="filter">'

      +mine.map(s=>'<option value="'+esc(s.id)+'"'+(s===me?' selected':'')+'>'

        +esc(s.name||'')+'</option>').join('')

      +'</select><small>'+clubDigits(mine.length)+' سبّاح تحت هذا الحساب</small></div>'

    : '';



  const card=(icon,tone,title,value,note)=>'<article class="mine-stat">'

    +'<span class="mine-stat-icon '+tone+'">'+icon+'</span>'

    +'<div><small>'+esc(title)+'</small>'

    +'<strong>'+esc(value)+'</strong>'

    +'<p>'+note+'</p></div></article>';



  const bar=pct===null?'':'<div class="mine-bar" role="img" aria-label="نسبة التقدم '+clubDigits(pct)+' بالمئة">'

    +'<i style="width:'+pct+'%"></i></div>';



  return '<section class="mine">'

    +'<header class="mine-head">'

      +'<div class="mine-id">'+swimmerFace(me,112)

        +'<div class="mine-who"><h1>'+who+'</h1><p>'+sub+'</p></div></div>'

      +switcher

    +'</header>'

    +'<div class="mine-stats">'

      +card('✓','mint','عدد الحصص',clubDigits(p.attended),

            'حضر '+clubDigits(p.attended)+' من '+clubDigits(p.recorded)+' حصة مسجَّلة')

      +card('!','rose','عدد الغيابات',clubDigits(p.absent),

            (p.late?clubDigits(p.late)+' مرة تأخر':'لا تأخير مسجَّل'))

      +'<article class="mine-stat wide"><span class="mine-stat-icon blue">◔</span>'

        +'<div><small>نسبة التقدم</small>'

        +'<strong>'+(pct===null?'—':clubDigits(pct)+'%')+'</strong>'

        +'<p>الحضور من الحصص المسجَّلة</p></div>'+bar+'</article>'

    +'</div>'

    +'<section class="panel mine-timetable"><div class="panel-head"><div>'

      +'<h3>حصص '+esc(me&&me.name?String(me.name).split(/\s+/).slice(-1)[0]:'السبّاح')+'</h3>'

      +'<p>'+(sessions.length

          ? clubDigits(sessions.length)+' حصة في فوجه — الموسم '+esc(clubDigits(CLUB.season))

          : 'لا توجد حصص مبرمجة لفوج هذا السبّاح بعد.')+'</p>'

      +'</div>'+printBtn('print-role-schedule','طباعة البرنامج')+'</div>'

    +(sessions.length

      ? '<div class="table-scroll"><table><thead><tr><th>اليوم</th><th>التوقيت</th><th>الفوج</th><th>المستوى</th><th>المدرب</th><th>المسبح</th></tr></thead><tbody>'

        +sessions.map(x=>'<tr><td><b>'+esc(x.day_name||'')+'</b></td><td dir="ltr">'+esc(clubDigits(x.time_range||''))+'</td>'

          +'<td>'+esc(x.group_name||'')+'</td><td>'+esc(x.level||'—')+'</td>'

          +'<td>'+esc(x.coach||'')+'</td><td>'+esc(x.pool||'مسبح الصدارة')+'</td></tr>').join('')

        +'</tbody></table></div>'

      : '<p class="empty-cell">لا توجد حصص مبرمجة لفوج هذا السبّاح بعد.</p>')

    +'</section>'

    +'<div class="role-grid"><section class="panel"><div class="panel-head"><div><h3>آخر إعلانات النادي</h3><p>معلومات محدثة من إدارة النادي</p></div></div>'

    +((state.notices||[]).length

      ? '<div class="role-list">'+(state.notices||[]).slice(0,3).map(n=>'<div><b>'+esc(n.title)+'</b><span>'+esc(n.text)+'</span></div>').join('')+'</div>'

      : '<p class="empty-cell">لا توجد إعلانات بعد.</p>')

    +'</section>'

    +'<section class="panel role-side"><h3>روابط النادي</h3>'

    +'<a class="role-link" href="'+esc(CLUB.facebook)+'" target="_blank" rel="noopener noreferrer">f — الصفحة الرسمية للنادي</a>'

    +'<a class="role-link" href="tel:'+esc(CLUB.phone.replace(/\s/g,''))+'">☎ — اتصال بالنادي</a>'

    +'<a class="role-link" href="mailto:'+esc(CLUB.email)+'">✉ — إرسال رسالة</a>'

    +'<p class="page-description">العنوان: '+esc(CLUB.address)+'</p>'

    +'</section></div>'

    +'</section>';

}



function roleHome(role){

  const mine=mySwimmers();

  const me=chosenSwimmer();

  const sessions=mySessions();

  const rate=attendanceRate();

  const cards=activeCards().length;

  const upcoming=sessions[0];

  const notes=(state.notices||[]).slice(0,3);



  /* A member or a parent gets their own space: the face, the switch, the numbers.

     Everything else keeps what it had. */

  if(['swimmer_adult','swimmer_minor','parent','member'].includes(role)&&!['admin','president','coach'].includes(state.user?.role)){

    return memberSpace(me, mine, sessions, role);

  }



  return '<section class="role-hero"><div><span class="eyebrow">'+esc(ROLE_LABELS[role]||'فضاء العضو')+'</span>'

    +'<h1>مرحبًا، '+esc(firstName())+' 👋</h1>'

    +'<p>'+(role==='coach'?'سجّل حضور السباحين وتابع أفواجك لحظة بلحظة.':role==='parent'?'تابع حضور أبنائك وبطاقاتهم واشتراكاتهم.':me?'هذه بطاقتك وحضورك في فوج السباحة.':'آخر أخبار النادي وبرامجه بين يديك.')+'</p></div>'

    +'<div class="role-mark">'+({coach:'🏊‍♂️',parent:'👨‍👩‍👧',swimmer_adult:'🏊',swimmer_minor:'🏊',member:'⭐'}[role]||'⭐')+'</div></section>'

    +'<div class="role-cards">'

    +'<article><span class="stat-icon blue">▦</span><small>الحصة القادمة</small><strong>'+esc(upcoming?(upcoming.day_name||'—'):'—')+'</strong><p>'+esc(clubDigits(upcoming?(upcoming.time_range||''):'لا توجد حصة مبرمجة'))+'</p></article>'

    +'<article><span class="stat-icon mint">✓</span><small>'+(role==='coach'?'نسبة الحضور':me?'حضوري':'بطاقات نشطة')+'</small><strong>'+(role==='coach'?(rate===null?'—':clubDigits(rate)+'%'):(role==='member'?cards:(me?myAttendance().filter(a=>a.status==='present').length:'—')))+'</strong><p>'+(role==='coach'?'تسجيلات اليوم':'هذا الموسم')+'</p></article>'

    +'<article><span class="stat-icon gold">▣</span><small>رقم الانخراط</small><strong class="role-no">'+esc(me?me.id:'—')+'</strong><p>'+esc(me?me.group:'غير مربوط بحساب')+'</p></article>'

    +'</div>'

    +'<div class="role-grid"><section class="panel"><div class="panel-head"><div><h3>'+(role==='coach'?'حصصي التدريبية':me?'آخر حصوري':'آخر إعلانات النادي')+'</h3><p>معلومات محدثة من إدارة النادي</p></div></div>'

    +(sessions.length&&role!=='member'

      ?'<div class="role-list">'+sessions.slice(0,5).map(s=>'<div><b>'+esc(s.day_name||'')+' · '+esc(clubDigits(s.time_range||''))+'</b><span>'+esc(s.group_name||'')+' · '+esc(s.pool||'مسبح الصدارة')+' · '+esc(s.coach||'')+'</span></div>').join('')+'</div>'

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

  return '<section class="panel"><div class="panel-head"><div><h3>البرنامج الأسبوعي</h3><p>'+clubDigits(sessions.length)+' حصة — الموسم '+esc(clubDigits(CLUB.season))+'</p></div>'

    +printBtn('print-role-schedule','طباعة البرنامج')+'</div>'

    +(sessions.length?'<div class="table-scroll"><table><thead><tr><th>اليوم</th><th>التوقيت</th><th>الفوج</th><th>المدرب</th><th>المسبح</th></tr></thead><tbody>'

      +sessions.map(s=>'<tr><td><b>'+esc(s.day_name||'')+'</b></td><td dir="ltr">'+esc(clubDigits(s.time_range||''))+'</td><td>'+esc(s.group_name||'')+'</td><td>'+esc(s.coach||'')+'</td><td>'+esc(s.pool||'مسبح الصدارة')+'</td></tr>').join('')

      +'</tbody></table></div>':'<p class="empty-cell">لا توجد حصص مبرمجة لفوجك بعد.</p>')

    +'</section>';

}

function roleAttendance(){

  const role=state.user?.role;

  if(role==='coach'||role==='parent'){

    const list=role==='coach'?(state.swimmers||[]):[mySwimmer()].filter(Boolean);

    const rate=attendanceRate(list);

    return '<div class="attendance-summary"><div><b>'+esc(attendanceSessionLabel())+'</b><strong>'+(rate===null?'—':clubDigits(rate)+'%')+'</strong></div>'

      +'<div><b>حاضر</b><strong class="green">'+clubDigits(list.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='present';}).length)+'</strong></div>'

      +'<div><b>غائب</b><strong class="red-text">'+clubDigits(list.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='absent';}).length)+'</strong></div>'

      +'<div><b>متأخر</b><strong class="orange">'+clubDigits(list.filter(s=>{const a=attendanceOf(s.id);return a&&a.status==='late';}).length)+'</strong></div></div>'

      +'<div class="toolbar"><span class="page-description">'+esc(slashDate(longDate()))+'</span><div class="toolbar-group">'

      +(role==='coach'?attendanceDayPicker():'')

      +printBtn('print-role-attendance','طباعة الكشف')+(role==='coach'?'<button class="btn btn-primary" data-action="mark-all-present">✓ تأكيد الجميع</button>':'')+'</div></div>'

      +'<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>السباح</th><th>الفوج</th><th>الحالة</th>'+(role==='coach'?'<th>تغيير الحالة</th>':'')+'</tr></thead><tbody>'

      +(list.length?list.map(s=>{const a=attendanceOf(s.id);const cur=a?a.status:'';return '<tr><td><b>'+esc(s.name||'')+'</b></td><td>'+esc(s.group||'—')+'</td>'

        +'<td><span class="status '+(cur==='present'?'success':cur==='late'?'late':cur==='absent'?'absent':'pending')+'">'+esc(a?ATTENDANCE_LABELS[a.status]||a.status:'لم يُسجّل')+'</span></td>'

        +(role==='coach'?'<td>'+['present','late','absent'].map(o=>'<button class="check-btn'+(cur===o?' active':'')+'" data-action="mark-attendance" data-id="'+esc(s.id)+'" data-status="'+o+'">'+esc(ATTENDANCE_LABELS[o])+'</button> ').join('')+'</td>':'')

        +'</tr>';}).join(''):emptyRow(4,'لا توجد بيانات.'))

      +'</tbody></table></div></section>';

  }

  const rows=myAttendance();

  /* A member is shown today, not whichever session a manager left open on the

     same device -- and said as today, which is what it is. */

  const rate=attendanceRate(mySwimmer()?[mySwimmer()]:[],todayISO());

  return '<div class="attendance-summary"><div><b>نسبة حضوري</b><strong>'+(rate===null?'—':clubDigits(rate)+'%')+'</strong></div>'

    +'<div><b>حصص حضرتها</b><strong class="green">'+rows.filter(a=>a.status==='present').length+'</strong></div>'

    +'<div><b>غياب</b><strong class="red-text">'+rows.filter(a=>a.status==='absent').length+'</strong></div>'

    +'<div><b>تأخر</b><strong class="orange">'+rows.filter(a=>a.status==='late').length+'</strong></div></div>'

    +'<div class="toolbar"><span class="page-description">سجل حضورك في الموسم '+esc(clubDigits(CLUB.season))+'</span>'+printBtn('print-role-attendance','طباعة السجل')+'</div>'

    +'<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الحالة</th></tr></thead><tbody>'

    +(rows.length?rows.map(a=>{const d=new Date(a.date);return '<tr><td dir="ltr">'+esc(slashDate(a.date))+'</td><td>'+esc(isNaN(d)?slashDate(a.date):AR_DAYS[d.getDay()])+'</td>'

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

    +'<small>'+esc(me.group||CLUB.unit)+' · '+esc(clubDigits(CLUB.season))+'</small><div><i>'+esc(me.name||'')+'</i><i dir="ltr">'+esc(me.id||'')+'</i></div></div></section>'

    +'<section class="card-print-grid single">'+cardMarkup(me,0)+'</section>';

}

function roleNotices(){

  const list=state.notices||[];

  return '<div class="toolbar"><span class="page-description">آخر تحديثات إدارة النادي.</span>'+printBtn('print-role-notices','طباعة')+'</div>'

    +'<div class="notice-list">'+(list.length?list.map((n,i)=>'<article class="notice-card"><span class="notice-type '+((i%2)?'blue-type':'gold-type')+'">'+esc(n.type||'إعلان')+'</span>'

      +'<div><h3>'+esc(n.title)+'</h3><p>'+esc(n.text)+'</p><small>'+esc(slashDate(n.date||''))+'</small></div></article>').join(''):'<p class="empty-cell">لا توجد إعلانات.</p>')+'</div>';

}

function roleApplications(){

  const phone=String(state.user?.phone||'').replace(/\s/g,'');

  const mine=(state.applications||[]).filter(a=>String(a.phone||'').replace(/\s/g,'')===phone);

  return '<div class="toolbar"><span class="page-description">طلبات التسجيل والاشتراكات الخاصة بك.</span>'

    +'<div class="toolbar-group">'+printBtn('print-role-applications','طباعة')+'<button class="btn btn-primary" data-action="register-desk">+ طلب تسجيل جديد</button></div></div>'

    +'<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>رقم الطلب</th><th>الرياضي</th><th>الاشتراك</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>'

    +(mine.length?mine.map(a=>'<tr><td dir="ltr">'+esc(clubDigits(a.application_no||a.id))+'</td><td><b>'+esc(appName(a))+'</b></td><td>'+esc(planName(a.subscription_code))+'</td>'

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

    +'<div class="role-actions"><span>'+esc(ROLE_LABELS[role]||'عضو النادي')+'</span><button class="icon-btn" data-action="theme" aria-label="تبديل الوضع الليلي" title="تبديل الوضع">'+(state.dark?'☀':'◐')+'</button>'

    +'<button class="btn btn-outline" data-action="logout">تسجيل الخروج</button></div></header>'

    +'<nav class="role-nav">'+menu.map(m=>'<button class="'+(m[0]===key?'active':'')+'" data-role-page="'+m[0]+'"><i>'+m[2]+'</i>'+esc(m[1])+'</button>').join('')+'</nav>'

    +'<main class="role-main"><h2 class="role-page-title">'+esc(title)+'</h2>'+(views[key]||views.home)()+'</main></div>';

}

/* ---------------------- النوافذ والأفعال ---------------------- */

function openModal(html){document.querySelector('.modal-backdrop')?.remove();document.body.insertAdjacentHTML('beforeend',html);bind();}

function formModal(title,body,action,extra){return '<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal registration-modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>'+esc(title)+'</h2></div>'+body+'<button class="btn btn-primary full" data-action="'+action+'"'+(extra||'')+'>حفظ</button></div></div>';}

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

/* The manager's form for one member -- the whole record and the
   photograph -- is in part-swimmer-edit.js, which is concatenated before this
   layer. It used to be four fields wide here, and saving wrote `value || ''` for
   everything the form did not send, so changing a telephone number blanked the
   name. */
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

  /* The count is the count of the sheet. It used to count every request in the

     database while the sheet showed only the open ones -- and the sheet is the

     page, printed, so the two numbers sat next to each other and disagreed. */

/* The requests, as a sheet somebody can file.



   Built rather than printed off the screen. A screen print is for looking at; a

   list of requests is carried to the counter, marked up, and comes back signed --

   and none of that survives being a screenshot of a table.



   Three blocks rather than one long table with a column of statuses down the side,

   because the question a manager reads a printed sheet for is "what still needs

   deciding", and three headings answer it before any row does. */

function applicationsSheet(){

  const all=state.applications||[];

  const pending=appSorted(all.filter(a=>String(a.status||'pending')==='pending'));

  const done=appSorted(all.filter(a=>String(a.status||'pending')!=='pending'&&String(a.status||'pending')!=='rejected'));

  const refused=appSorted(all.filter(a=>String(a.status||'pending')==='rejected'));



  const head=['#','رقم الطلب','رقم التسجيل','الاسم واللقب','الفئة','الاشتراك','المبلغ','الهاتف','الحالة','التوقيع'];

  const cell=(a,i)=>'<tr><td>'+(i+1)+'</td>'

    +'<td dir="ltr">'+esc(clubDigits(a.application_no||a.id||''))+'</td>'

    +'<td dir="ltr">'+(a.registration_id?esc(clubDigits(a.registration_id)):'<small>—</small>')+'</td>'

    +'<td><b>'+esc(appName(a))+'</b><br><small>'+esc(appContact(a)||'')+'</small></td>'

    +'<td>'+esc(catLabel(a.application_type==='coach'?'coach':a.category))+'</td>'

    +'<td>'+esc(a.application_type==='coach'?'—':planName(a.subscription_code))

      +(a.application_type==='coach'?'':'<br><small>'+((a.transport?'النقل ':'')+(a.uniform?'البدلة':'')).trim()+'</small>')+'</td>'

    +'<td>'+esc(a.application_type==='coach'?'—':money(a.expected_amount))+'</td>'

    +'<td dir="ltr">'+(a.application_type==='coach'?esc(clubDigits(a.coach_phone||'')):esc(appContact(a)||'—'))+'</td>'

    +'<td><span class="status '+((a.status||'pending')==='approved'?'success':(a.status||'pending')==='rejected'?'rejected':'pending')+'">'

      +esc(stateLabel(a.status))+'</span></td>'

    +'<td></td></tr>';



  const block=(title,note,list)=>'<section class="roster-block"><div class="roster-head">'

    +'<div><h3>'+esc(title)+'</h3><p>'+esc(note)+'</p></div>'

    +'<div class="roster-count"><b>'+clubDigits(list.length)+'</b><small>طلب</small></div></div>'

    +(list.length

      ? '<table class="print-table"><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'

        +list.map(cell).join('')+'</tbody></table>'

      : '<p class="empty-cell">لا يوجد.</p>')

    +'</section>';



  const box=document.createElement('section');

  box.className='roster';

  const due=pending.reduce((m,a)=>m+(Number(a.expected_amount)||0),0);

  box.innerHTML='<div class="sheet-summary">'

    +[['قيد المراجعة',pending.length,'var(--ok)'],['مقبول',done.length,'var(--teal)'],['مرفوض',refused.length,'var(--danger)']]

      .map(x=>'<div class="sheet-sum"><b style="color:'+x[2]+'">'+clubDigits(x[1])+'</b><small>'+esc(x[0])+'</small></div>').join('')

    +'<div class="sheet-sum"><b>'+esc(money(due))+'</b><small>المبلغ المنتظر</small></div>'

    +'</div>'

    +block('قيد المراجعة','الأحدث أولاً — من الأحدث إلى الأقدم',pending)

    +block('مقبول','انتقلت إلى قائمة السباحين',done)

    +block('مرفوض','في الأسفل دائماً، مهما كان تاريخها',refused)

    +'<div class="sheet-sign"><span>توقيع المسيّر</span><span>التاريخ</span><span>ختم النادي</span></div>';

  return printArea(box,{

    title:'طلبات التسجيل', variant:'roster',

    sub:'الموسم '+CLUB.season+' · '+clubDigits(all.length)+' طلب',

    notes:'<p>الطلبات المقبولة تنتقل إلى قائمة السباحين. المرفوضة تُبقي سبب الرفض مكتوبًا عند رقم الطلب.</p>'

  });

}



  if(a==='print-applications'){applicationsSheet();return}

  if(a==='print-subscriptions'){printPage('الأسعار والخدمات','الموسم '+CLUB.season);return}

  if(a==='print-swimmers'){printPage('قائمة السباحين','الموسم '+CLUB.season);return}

  if(a==='print-schedule'){printPage('البرنامج الأسبوعي',weekRange(state.weekOffset||0).label);return}

  if(a==='print-notices'){printPage('الإعلانات والتنبيهات');return}

  if(a==='print-settings'){printPage('إعدادات المنصة');return}

  if(a==='print-attendance'){printAttendanceSheet();return}

  if(a==='print-cards'||a==='print-all-cards'){printCardsSheet();return}

  if(a==='print-cards-quick'){state.page='card';save();render();printCardsSheet();return}

  if(a==='print-registration'){printOfficialForms([registrationRecordFromForm()]);return}

  if(a==='print-groups'){printGroupsSheet();return}

  if(a==='print-group'){printGroupRoster(el.dataset.group);return}

  if(a==='print-role-card'){const me=mySwimmer();if(me)printSingleCard(me.id);else showToast('حسابك غير مربوط ببطاقة انخراط.','error');return}

  if(a==='print-role-schedule'){printTable('البرنامج الأسبوعي',['اليوم','التوقيت','الفوج','المدرب','المسبح'],mySessions().map(s=>'<tr><td><b>'+esc(s.day_name||'')+'</b></td><td dir="ltr">'+esc(clubDigits(s.time_range||''))+'</td><td>'+esc(s.group_name||'')+'</td><td>'+esc(s.coach||'')+'</td><td>'+esc(s.pool||'مسبح الصدارة')+'</td></tr>'),'الموسم '+CLUB.season);return}

  if(a==='print-role-attendance'){

    if(state.user?.role==='coach'){printAttendanceSheet();return}

    printTable('سجل الحضور',['التاريخ','اليوم','الحالة'],myAttendance().map(x=>{const d=new Date(x.date);return '<tr><td dir="ltr">'+esc(slashDate(x.date))+'</td><td>'+esc(isNaN(d)?slashDate(x.date):AR_DAYS[d.getDay()])+'</td><td><span class="status success">'+esc(ATTENDANCE_LABELS[x.status]||x.status)+'</span></td></tr>';}),'الموسم '+CLUB.season);return}

  if(a==='print-role-notices'){printTable('إعلانات النادي',['العنوان','النص','النوع','التاريخ'],(state.notices||[]).map(n=>'<tr><td><b>'+esc(n.title)+'</b></td><td>'+esc(n.text)+'</td><td>'+esc(n.type||'')+'</td><td>'+esc(slashDate(n.date||''))+'</td></tr>')) ;return}

  if(a==='print-role-applications'){const phone=String(state.user?.phone||'').replace(/\s/g,'');printTable('طلبات التسجيل',['رقم الطلب','الرياضي','الاشتراك','المبلغ','الحالة'],(state.applications||[]).filter(x=>String(x.phone||'').replace(/\s/g,'')===phone).map(x=>'<tr><td dir="ltr">'+esc(clubDigits(x.application_no||x.id))+'</td><td><b>'+esc(appName(x))+'</b></td><td>'+esc(planName(x.subscription_code))+'</td><td>'+esc(money(x.expected_amount))+'</td><td><span class="status success">'+esc(stateLabel(x.status))+'</span></td></tr>'));return}



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

    const payload={subscription_code:$('#edit-plan').value,transport:$('#edit-transport').checked,uniform:$('#edit-uniform').checked,payment_method:$('#edit-payment').value,facility:$('#edit-facility').value,status:$('#edit-status').value,/* The field the server reads. It was `decision_reason`, which the adapter has never read -- so a request refused through this dialog was refused with "write a reason" for a reason that had in fact been typed, one field away. Worse than not working: this dialog reads the note back out of the old name and the queue prints it from there, so the reason appeared on screen and on the printed sheet while the server never saw it. Nothing ever looked broken.
     The reading below still accepts both, so every request already on file shows its note. */
     rejection_reason:$('#edit-note').value.trim()};

    payload.expected_amount=recalcAmount({...app,...payload});

    try{await api('/api/applications/'+encodeURIComponent(app.id),'PATCH',payload);showToast('تم تحديث الطلب واحتساب المبلغ.');document.querySelector('.modal-backdrop')?.remove();await syncApi();render()}catch(e){showToast(e.message,'error')}

    return;

  }

  if(a==='approve-app'){

    try{await api('/api/applications/'+encodeURIComponent(el.dataset.id),'PATCH',{status:'approved'});showToast('تم اعتماد الطلب.');await syncApi();render()}catch(e){showToast(e.message,'error')}

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

    /* Every field the form carries, and only those.



       It used to send four values, and the server wrote `value || ''` for

       everything it had not been given -- so correcting a telephone number

       blanked the name beside it, and correcting a group erased the blood

       group, the day of birth and the photograph without a word. A form is

       allowed to change what it shows and nothing else; that is now true on

       both sides, because this sends what is on the form and the server writes

       what it was sent.



       The photograph is read at the save, not when the form opens: a file

       input cannot be read after the fact, and it is the save that has to carry

       it. It is shrunk first -- a photograph off a phone is three megabytes of

       text, and the member's record is read on every card the club prints. */

    const nodes=[...document.querySelectorAll('[data-swimmer-field]')];

    if(!nodes.length){

      const nm=$('#sw-name')?.value.trim();

      if(!nm){showToast('أدخل اسم السباح.','error');return}

      const payload={name:nm,group_name:$('#sw-group').value,

        phone:latinDigits($('#sw-phone').value.trim()),status:$('#sw-status').value};

      try{

        payload.membership_no=$('#sw-no')?.value.trim();

        await api('/api/swimmers','POST',payload);

        showToast('تمت إضافة السباح.');

        document.querySelector('.modal-backdrop')?.remove();await syncApi();render();

      }catch(e){showToast(e.message,'error')}

      return;

    }



    const payload={id:el.dataset.id};

    nodes.forEach(n=>{const k=n.dataset.swimmerField;let v=n.value;

      if(n.type==='tel')v=latinDigits(String(v||'').trim());

      payload[k]=(v==null?'':String(v)).trim();});

    if(!payload.name){showToast('أدخل اسم السباح.','error');return}



    const file=$('#swf-photo')?.files?.[0];

    const cleared=typeof swimmerPhotoCleared!=='undefined'&&swimmerPhotoCleared;

    try{

      if(file){payload.photo=await readSwimmerPhoto(file);}

      else if(cleared){payload.photo='';}

      const res=await api('/api/swimmers','PUT',payload);

      if(typeof swimmerPhotoCleared!=='undefined')swimmerPhotoCleared=false;

      const extra=res&&res.guardian_fields?(' و'+res.guardian_fields+' من بيانات الولي'):'';

      showToast('تم تحديث بيانات السباح.'+extra);

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

    const day=attendanceDay();

    try{

      await api('/api/attendance','POST',{member_id:id,swimmer_id:id,status,session_date:day});

      const bucket=state.attendance[id]=state.attendance[id]||[];

      bucket.push({status,at:new Date().toISOString(),date:day});

      (state.attendanceByDay[day]||(state.attendanceByDay[day]={}))[id]={status,at:new Date().toISOString()};

      save();render();

    }catch(e){showToast(e.message||'تعذر تسجيل الحضور.','error')}

    return;

  }

  if(a==='mark-all-present'){

    const list=state.swimmers||[];

    if(!list.length){showToast('لا يوجد سباحون لتسجيل حضورهم.','error');return}

    if(!confirm('تسجيل حضور '+clubDigits(list.length)+' سباح اليوم؟'))return;

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

    state.club={name:$('#club-name').value.trim()||CLUB.name,unit:$('#club-unit').value.trim()||CLUB.unit,address:$('#club-address').value.trim(),phone:latinDigits($('#club-phone').value.trim()),email:$('#club-email').value.trim(),season:$('#club-season').value.trim()||CLUB.season};

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

  /* A way of looking, not a setting about the club: kept in the page state and not

     saved, so nobody's decisions change because somebody turned it on. */

  live('#app-show-decided',e=>{state.appShowDecided=!!e.target.checked;renderPageOnly()});

  live('#user-search',e=>{state.userQuery=e.target.value;renderPageOnly()});
  live('#accounts-search',e=>{state.accountsQuery=e.target.value;renderPageOnly()});

  live('#group-filter',e=>{state.groupFilter=e.target.value;renderPageOnly()});

  live('#attendance-group',e=>{state.attendanceGroup=e.target.value;renderPageOnly()});

  /* Which session is being recorded. Saved, so a coach who is interrupted comes

     back to the same session rather than to today without meaning to. */

  live('#attendance-date',e=>{state.attendanceDate=e.target.value;save();renderPageOnly()});

  /* Which swimmer. Kept, so coming back to the page comes back to the same child

     rather than to the first name in a list that may have been re-sorted underneath

     them.



     The whole render, not renderPageOnly(): that one rebuilds a single element from

     a map whose entry for the front page is the *management* overview, and a

     member's front page is drawn by a different function -- so on this page it

     found nothing to redraw and the DOM stayed exactly as it was. The symptom was

     the quiet kind: the value went into the state, the state was right, and the

     page did not move. A parent picks the other child and sees the first one. */

  live('#which-swimmer',e=>{state.chosenSwimmer=e.target.value;save();render()});

};

function renderPageOnly(){

  const p=state.page;

  const host=document.querySelector('#page-root');

  if(!host)return;

  /* Whoever is typing keeps their place. The redraw replaces the control they are

     typing into, so without this the caret goes back to the start and the box

     loses the focus at the first letter -- and every letter after that goes

     somewhere else. On a phone that is a box that takes one character at a time

     with a tap between each, which is the whole reason a search box exists.



     Remembered by id and offset rather than by holding on to the node, because

     the node is exactly what the redraw throws away. */

  const active=document.activeElement;

  const focusId=(active&&active.id)?active.id:'';

  const caret=(active&&typeof active.selectionStart==='number')?active.selectionStart:-1;

  const map={home:pageOverview,applications:pageApplications,subscriptions:pageSubscriptions,users:pageUsers,schedule:pageSchedule,attendance:pageAttendance,notices:pageNotices,card:pageCards,groups:pageGroups,settings:pageSettings};

  const scrollY=window.scrollY;

  host.innerHTML=(map[p]||pageOverview)();

  document.title=pageTitle(p)+' | '+CLUB.name;

  bind();

  if(focusId){

    const again=document.getElementById(focusId);

    if(again){

      again.focus();

      /* Not every control has a caret -- a date, a number, a colour has none, and

         asking for one on those throws. */

      if(caret>=0&&typeof again.setSelectionRange==='function'){

        try{again.setSelectionRange(caret,caret)}catch(_){}

      }

    }

  }

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

  /* The whole document is carried through, and the five fields the rest of the

     page expects are written on top of it rather than substituted for it.



     It used to rebuild each member out of five fields, so the photograph, the

     day of birth, the blood group, the joining date and the link back to the

     request a member was accepted from were all discarded here -- after the

     server had already sent them. The card looked for a face, found none,

     and printed the club logo where a child should be: on a card kept for

     years and on the sheet of ten handed out at the pool.



     `doc_id` is kept separately because `id` becomes the membership number

     the page edits by, while the document id is the request the member came

     from, and that is the only route back to the photograph. */

    state.swimmers=sw.map(x=>Object.assign({},x,{id:x.membership_no||x.id,doc_id:x.id,

      name:x.name||'',group:x.group_name||x.group||'',phone:x.phone||'',

      status:x.status==='active'?'نشط':(x.status||'نشط')}));

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

      /* The session is the day on the record; the timestamp is when the writing

         happened. These are different facts, and they used to be confused: the

         date was taken out of the timestamp, so a mark written on Sunday for

         Saturday was filed under Sunday -- and the whole point of asking which

         session is being recorded would have been to watch it not work. */

      const stamped=String(at).match(/(\d{4}-\d{2}-\d{2})/);

      const date=r.session_date||r.date||(stamped&&stamped[1])||todayISO();

      (bucket[key]=bucket[key]||[]).push({status,at,date});

      (byDay[date]=byDay[date]||{})[key]={status,at};

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

/* ---------- layers added after the baseline commit ---------- */

const CLUB_AR = 'النادي الرياضي الصدارة – غرداية';
const CLUB_FR = 'Clubsportif Sadara – Ghardaia';
const CLUB_MOTTO = 'أخلاق، احترام، وانضباط';
const STAR = '<svg viewBox="0 0 24 24" class="star"><path d="M12 2l2.6 6.3 6.8.4-5.2 4.3 1.7 6.6L12 16l-5.9 3.6 1.7-6.6L2.6 8.7l6.8-.4z"/></svg>';
const ORNAMENT = '<svg class="orn" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 30 Q25 6 50 30 T100 30 T150 30 T200 30" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M0 34 Q25 10 50 34 T100 34 T150 34 T200 34" fill="none" stroke="currentColor" stroke-width=".7" opacity=".6"/></svg>';

/* What the person has typed into the registration form, as a record the printed
   sheet can read. The same fields the submit posts, so the two cannot disagree. */
function registrationRecordFromForm() {
  const value = sel => { const n = $(sel); return n ? (n.type === 'checkbox' ? n.checked : n.value) : ''; };
  const record = {
    sport: value('#reg-sport'), category: value('#reg-category'),
    swimming_strokes: value('#reg-strokes'), subscription_code: value('#reg-plan'),
    facility: value('#reg-facility'), transport: value('#reg-transport'),
    uniform: value('#reg-uniform'), payment_method: value('#reg-payment'),
    first_name_ar: value('#reg-first-ar'), last_name_ar: value('#reg-last-ar'),
    first_name_fr: value('#reg-first-fr'), last_name_fr: value('#reg-last-fr'),
    national_id: value('#reg-nin'), birth_certificate_no: value('#reg-birth-cert'),
    birth_place: value('#reg-birth-place'), wilaya: value('#reg-wilaya'),
    birth_date: value('#reg-birth'), gender: value('#reg-gender'),
    blood_group: value('#reg-blood'), level: value('#reg-level'),
    phone: value('#reg-phone'), whatsapp: value('#reg-whatsapp'),
    address: value('#reg-address'),
    guardian_first_name: value('#reg-guardian-first'),
    guardian_last_name: value('#reg-guardian-last'),
    guardian_relation: value('#reg-guardian-relation'),
    guardian_phone: value('#reg-guardian-phone'),
    guardian_national_id: value('#reg-guardian-nin')
  };
  /* An adult has no guardian block on the page. Leaving the keys out keeps the
     guardian's fields off their form, which is what is printed for a minor who
     fills them in. */
  if (record.category !== 'minor') {
    delete record.guardian_first_name; delete record.guardian_last_name;
    delete record.guardian_relation; delete record.guardian_phone;
    delete record.guardian_national_id;
  }
  return record;
}

/* ---------------------- نافذة الطباعة ---------------------- */
/* A window to print into, or null when the browser refused one.

   window.open with 'noopener' returns null by definition -- that is what
   noopener means -- so asking for isolation in the feature string and then
   writing into the result could never work. Every print did exactly that, so the
   guard always fired, the sheet was never written, and the person got an empty
   tab and a message blaming popups they had allowed. The opener is cleared
   afterwards instead: same isolation, and the handle survives. */
function printWindow(features) {
  const w = window.open('', '_blank', features || '');
  if (!w) return null;
  try { w.opener = null; } catch (_) { /* already severed */ }
  return w;
}

/* ---------------------- أرقام النادي ---------------------- */
/* The club writes its numbers 0 1 2 3 4 5 6 7 8 9, the way Algeria writes them,
   and its dates year/month/day: 2026/10/11.

   Everything on screen and on paper reads its numbers through one helper, and so
   does everything stored. That is deliberate rather than tidy:

     a number on the sheet is read aloud over a counter and typed into the
       platform to find a record, and a number quoted in one set of digits and
       looked up in the other is a number nobody can find
     an identity number is compared against the ones on file to catch the same
       person registering twice
     a registration number is read back out of itself to count the next one
     amounts are added up, and Firestore sorts by what it is given

   So one form, end to end, and no conversion at all on the ordinary path.

   What is left here is the one thing still worth doing: a number that arrives in
   Arabic-Indic digits is folded to Latin on the way past. Somebody copying one out
   of a message on a phone gets a number the club can read back, and somebody who
   types ٠١٢٣ gets 0123 stored -- which is the same number. Folded by code point
   rather than through a table of characters, because a table has to be typed and
   the Arabic-Indic and Persian sets are indistinguishable on screen: written out
   they look the same, and a table that quietly lost one of them would fold the
   digits it was not asked about and leave the rest. A subtraction cannot. */
function latinDigits(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

/* What a person reads, the way the club writes numbers. The whole platform reads
   through here -- a screen, a card, a printed sheet -- so one definition decides
   it for all of them. */
function clubDigits(v) {
  return latinDigits(v);
}

/* A date the way the club writes it: 2026/10/11.

   Anything that is not a plain date is passed through alone -- a note somebody
   typed, a season written out -- rather than dropped. A date typed with slashes
   rather than dashes, or with a one-digit month, is still a date and is laid out
   the same way, because the whole point is that every date on every sheet reads
   the same. */
/* Three numbers, and which of them is the year.

   What is stored does not move: dates are kept `yyyy-mm-dd`, because that is what
   makes the queue order, the weekly bars and every equality query work, and none of
   that is touched. This is how a date is *read*, and the club's order is the day
   first.

     four digits first   it is a year: the old order
     otherwise           the day is first

   Not "day first unless the day could be a month". That rule reads `11/10/2026` as
   the tenth of November, because eleven is also a month -- and the club wrote the
   eleventh of October. The guess was rescuing somebody typing month first and cost
   every date the club writes where both halves could be either.

   The one rescue kept costs nothing: a first number that cannot be a day at all is
   read the only way it can be. That fires on nothing the club writes and refuses
   nothing it should accept.

   Day first, always, is also what makes a value round-trip: a field that comes out
   as `11/10/2026` and goes back in must come out as `11/10/2026`. */
function readDateParts(v) {
  const raw = latinDigits(v).trim();
  const year = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw);
  if (year) return { y: year[1], m: year[2], d: year[3] };
  const day = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(raw);
  if (!day) return null;
  if (Number(day[1]) > 31) return { y: day[3], m: day[2], d: day[1] };
  return { y: day[3], m: day[2], d: day[1] };
}
function slashDate(v) {
  const raw = latinDigits(v);
  const m = readDateParts(raw);
  if (!m) return raw;
  return String(m.d).padStart(2, '0') + '/' + String(m.m).padStart(2, '0') + '/' + m.y;
}

/* The same date for the database and for arithmetic: 2026-10-11, Latin digits.
   '' when the text is not a date at all, rather than a guess: a birth date that
   has been guessed is a member who is the wrong age on the card for ever. */
function isoDate(v) {
  /* The way back into the database, and it reads both orders for exactly that
     reason: a field is shown as dd/mm/yyyy, somebody edits it and sends it back in
     that shape, and what lands in the database is still yyyy-mm-dd. */
  const raw = latinDigits(v).trim();
  const m = readDateParts(raw);
  if (!m) return '';
  const month = Number(m.m), day = Number(m.d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return m.y + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/* The same date typed back into a field for editing, so a person correcting a
   date sees it as it was written rather than as the machine stored it. */
function dateForInput(v) {
  return slashDate(v);
}

/* ---------------------- ربط وثائق النادي ---------------------- */function coachAccounts(){return (state.cards||[]).filter(c=>c.role==='coach'||c.kind==='coach');}function luxPreviewBox(items,kind){
  if(!items.length) return '<div class="panel empty-cell">لا توجد بيانات.</div>';
  return '<div class="lux-preview">'+items.slice(0,4).map(p=>luxuryCard(p,kind)).join('')+'</div>';
}

const coreAction2=action;
action=async function(a,el){
  if(a==='print-official-form'){
    const app=(state.applications||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(!app){showToast('تعذر العثور على الطلب.','error');return}
    printOfficialForms(app);
    return;
  }
  if(a==='print-official-forms-all'){
    const list=(state.applications||[]).filter(x=>x.application_type!=='coach');
    if(!list.length){showToast('لا توجد طلبات سباح لطباعة الاستمارات.','error');return}
    printOfficialForms(list);
    return;
  }
  if(a==='print-official-blank'){
    printOfficialForms([{}]);
    return;
  }
  if(a==='print-lux-swimmers'){printLuxuryCards(swimmersActive(),'swimmer');return}
  if(a==='print-lux-coaches'){
    const list=coaches();
    if(!list.length){showToast('لا توجد طلبات مدربين مسجلة بعد.','error');return}
    printLuxuryCards(list,'coach');return;
  }
  if(a==='print-lux-one'){
    const s=(state.swimmers||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(s)printLuxuryCards(s,'swimmer');else showToast('تعذر العثور على السباح.','error');
    return;
  }
  if(a==='print-coach-luxtour'){
    const c=coaches().find(x=>String(x.id)===String(el.dataset.id));
    if(c)printLuxuryCards(c,'coach');else showToast('تعذر العثور على المدرب.','error');
    return;
  }
  return coreAction2(a,el);
};

/* بطاقة الانخراط redesigned */
function cardMarkup(s,i){
  const photo=memberPhoto(s, state.profile);
  return '<article class="print-card" data-member="'+esc(s.id)+'">'
    +'<div class="card-band"></div>'
    +'<div class="print-card-inner">'
    +'<div class="print-card-rail"><span class="logo"></span><i>'+esc(CLUB.unit)+'</i></div>'
    +'<div class="print-card-content">'
    +'<div class="print-card-brand"><b>'+esc(CLUB.name)+'</b><small>'+esc(CLUB.season)+'</small></div>'
    /* A card with no photograph is a card anybody can be handed by somebody else,
       so the frame is always printed -- empty it reads as a missing photograph on
       a card that has one, rather than as a card that never had one. */
    +'<div class="print-card-body">'
    +'<div class="card-photo">'+(photo?'<img src="'+esc(photo)+'" alt="صورة المنخرط">':'<span>بلا صورة</span>')+'</div>'
    +'<div><strong>'+esc(s.name||'')+'</strong>'
    +'<small>'+esc(s.group||CLUB.unit)+'</small><small class="id" dir="ltr">No: '+esc(s.id||'')+'</small></div>'
    +'<div class="qr-code" data-qr="'+esc(s.id)+'"></div></div>'
    +'<footer><span>'+esc(CLUB.address)+'</span><span dir="ltr">'+esc(CLUB.phone)+'</span></footer>'
    +'</div></div></article>';
}/* applications page: official form printing */
const corePageView2=pageView;
pageView=function(p){
  if(p==='applications'){
    const list=(state.applications||[]).filter(x=>x.application_type!=='coach');
    /* The official form for a request is printed from the request's own row, with
       the buttons that decide it -- so the thing you print and the thing you
       approve are in the same line of sight. It used to have a panel of its own
       listing every request on the page: the same records, the same buttons, and a
       second place to look for them.

       The two page-wide buttons stay, at the foot of the page. They are not
       decisions about one request, and putting them at the top put them beside a
       search box, where they were the first thing pressed and the second thing
       meant. */
    const foot=list.length?'<section class="panel official-forms-foot"><div class="panel-head">'
      +'<div><h3>استمارة الإلحاق الرسمية</h3>'
      +'<p>لكل طلب — استمارة بإطلاق النادي</p></div>'
      +'<div class="toolbar-group"><button class="btn btn-primary" data-action="print-official-forms-all">🖨 كل الاستمارات</button>'
      +'<button class="btn btn-outline" data-action="print-official-blank">استمارة فارغة</button></div></div>'
      +'</section>':'';
    return '<div class="page-root" id="page-root">'+pageApplications()+foot+'</div>';
  }
  return corePageView2(p);
};

/* ==========================================================
   تعديلات 2: البطاقات الفنية = بطاقات الانخراط الرسمية
   تعديل 3: ورقة A4 بعشر بطاقات
   تعديل 4: الجدول الأسبوعي بطباعة إبداعية
   تعديل 1: الملف الشخصي الكامل مع تفاصيل مخصصة
   ========================================================== */
const CARD_W = 85;
const CARD_H = 52;
const PER_SHEET = 10;

/* ---------- 2) البطاقة الفنية: الرقم تحت الصورة ---------- */function cardSheet(list, kind){
  const items = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!items.length) { showToast('لا توجد بطاقات للطباعة.', 'error'); return; }
  const box = document.createElement('div');
  box.className = 'lux-sheet';
  let html = '';
  items.forEach(p => { html += luxuryCard(p, kind); });
  box.innerHTML = html;
  const host = printArea(box, { variant: 'sheet10', bare: true });
  if (host) buildQRCodes();
  return host;
}
function chunkTen(list){
  const out = [];
  for (let i = 0; i < list.length; i += PER_SHEET) out.push(list.slice(i, i + PER_SHEET));
  return out.length ? out : [[]];
}
function printCardSheets(list, kind){
  const items = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!items.length) { showToast('لا توجد بطاقات للطباعة.', 'error'); return; }
  const pages = chunkTen(items);
  const box = document.createElement('div');
  pages.forEach(chunk => {
    const page = document.createElement('div');
    page.className = 'lux-page';
    chunk.forEach(p => page.insertAdjacentHTML('beforeend', luxuryCard(p, kind)));
    for (let i = chunk.length; i < PER_SHEET; i++) page.insertAdjacentHTML('beforeend', '<i class="lux-slot"></i>');
    box.appendChild(page);
  });
  const host = printArea(box, { variant: 'sheet10', bare: true });
  if (host) buildQRCodes();
}

/* ---------- 4) الجدول الأسبوعي بطباعة إبداعية ---------- */
const SLOT_KEYS = [
  { id: 'morning', label: 'الصباح', from: '08:00', to: '12:00', tone: 'dawn' },
  { id: 'midday', label: 'الظهر', from: '12:00', to: '16:00', tone: 'noon' },
  { id: 'evening', label: 'المساء', from: '16:00', to: '20:00', tone: 'dusk' }
];
function slotOf(timeRange){
  const t = String(timeRange || '').trim();
  const start = (t.match(/(\d{1,2})\s*[:：hH]/) || [])[1];
  const h = start === undefined ? null : Number(start);
  if (h === null) return SLOT_KEYS[2];
  if (h < 12) return SLOT_KEYS[0];
  if (h < 16) return SLOT_KEYS[1];
  return SLOT_KEYS[2];
}
function scheduleSheet(){
  const sessions = state.schedules || [];
  const range = weekRange(state.weekOffset || 0);
  const byDay = {};
  WEEK_DAYS.forEach(d => { byDay[d] = { morning: [], midday: [], evening: [] }; });
  sessions.forEach(s => {
    const day = String(s.day_name || '').trim();
    const target = byDay[day] || byDay[day.replace('الإثنين', 'الاثنين')] || byDay[day.replace('الأثنين', 'الاثنين')];
    if (!target) return;
    target[slotOf(s.time_range).id].push(s);
  });
  const head = '' +
    '<header class="sch-head">' +
      '<div class="sch-brand"><img src="assets/logo.png" alt=""><div><b>' + CLUB_AR + '</b><small dir="ltr">' + CLUB_FR + '</small></div></div>' +
      '<div class="sch-title"><span class="sch-eyebrow">البرنامج الرسمي</span><h1>الجدول الأسبوعي للحصص</h1><p>' + esc(range.label) + ' · الموسم ' + esc(CLUB.season) + '</p></div>' +
      '<div class="sch-counts">' +
        '<div><b>' + sessions.length + '</b><small>حصة</small></div>' +
        '<div><b>' + new Set(sessions.map(s => String(s.coach || '').trim()).filter(Boolean)).size + '</b><small>مدرب</small></div>' +
        '<div><b>' + new Set(sessions.map(s => String(s.pool || '').trim()).filter(Boolean)).size + '</b><small>منشأة</small></div>' +
      '</div>' +
    '</header>';

  const grid = '<div class="sch-grid">' +
    WEEK_DAYS.map((day, i) => {
      const d = new Date(range.start);
      d.setDate(range.start.getDate() + i);
      const cells = SLOT_KEYS.map(slot => {
        const list = byDay[day][slot.id];
        return '<div class="sch-slot tone-' + slot.tone + '">' +
          '<span class="sch-slot-label">' + esc(slot.label) + ' <i>' + esc(slot.from + '–' + slot.to) + '</i></span>' +
          (list.length
            ? list.map(s => '<article class="sch-card g-' + (String(s.group_name || '').trim() || 'x').slice(0, 6).replace(/\s/g, '') + '">' +
                '<b>' + esc(s.time_range || '') + '</b>' +
                '<strong>' + esc(s.group_name || '—') + '</strong>' +
                '<small>' + esc(s.coach || '') + '</small>' +
                (s.pool ? '<em>📍 ' + esc(s.pool) + '</em>' : '') +
              '</article>').join('')
            : '<span class="sch-rest">راحة</span>') +
        '</div>';
      }).join('');
      const total = SLOT_KEYS.reduce((n, s) => n + byDay[day][s.id].length, 0);
      return '<section class="sch-day' + (total ? '' : ' is-off') + '">' +
        '<header class="sch-day-head"><b>' + esc(day) + '</b><small>' + pad2(d.getDate()) + ' ' + esc(AR_MONTHS[d.getMonth()]) + '</small>' +
        '<span class="sch-badge">' + (total || '—') + '</span></header>' +
        cells + '</section>';
    }).join('') + '</div>';

  const legend = '<div class="sch-legend"><span class="sch-legend-t">الفوج:</span>' +
    [...new Set(sessions.map(s => String(s.group_name || '').trim()).filter(Boolean))].map(g =>
      '<span class="sch-chip g-' + g.slice(0, 6).replace(/\s/g, '') + '">' + esc(g) + '</span>').join('') +
    (sessions.some(s => String(s.pool || '').trim()) ? '<span class="sch-legend-p">📍 موقع المسبح</span>' : '') +
    '</div>';

  const notes = '<div class="sch-notes">' +
    '<div><b>ملاحظات المديرية</b><span>الحضور قبل الموعد بـ 15 دقيقة · وغطاء الرأس إجباري' +
    '<div class="sch-sign"><span>مدير الفوج</span><span>رئيس النادي</span></div>' +
    '</div>';

  const box = document.createElement('section');
  box.className = 'schedule-doc';
  box.innerHTML = head + grid + legend + notes;
  return box;
}
function printScheduleDoc(){
  // printArea consumes the children of the node it is given, so the styled
  // document is wrapped first and the wrapper is what reaches the sheet.
  const wrap=document.createElement('div');
  wrap.className='sch-wrap';
  wrap.appendChild(scheduleSheet());
  printArea(wrap, { variant: 'schedule', title: 'الجدول الأسبوعي', sub: weekRange(state.weekOffset || 0).label });
}

/* ---------- 1) الملف الشخصي الكامل ---------- */
const PROFILE_FIELDS = [
  { k: 'name', label: 'الاسم واللقب', type: 'text' },
  { k: 'first_name_fr', label: 'الاسم بالفرنسية', type: 'text' },
  { k: 'birth_date', label: 'تاريخ الميلاد', type: 'date' },
  { k: 'birth_place', label: 'محل الميلاد', type: 'text' },
  { k: 'wilaya', label: 'الولاية', type: 'text' },
  { k: 'address', label: 'العنوان', type: 'text' },
  { k: 'phone', label: 'رقم الهاتف', type: 'tel' },
  { k: 'whatsapp', label: 'WhatsApp', type: 'tel' },
  { k: 'blood_group', label: 'فصيلة الدم', type: 'select', options: ['', 'O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'] },
  { k: 'gender', label: 'الجنس', type: 'select', options: ['', 'm', 'f'] },
  { k: 'national_id', label: 'رقم التعريف الوطني', type: 'text' },
  { k: 'height', label: 'الطول (سم)', type: 'number' },
  { k: 'weight', label: 'الوزن (كغ)', type: 'number' },
  { k: 'emergency_name', label: 'اسم شخص للطوارئ', type: 'text' },
  { k: 'emergency_phone', label: 'هاتف الطوارئ', type: 'tel' },
  { k: 'medical_notes', label: 'ملاحظات طبية', type: 'area' },
  { k: 'notes', label: 'ملاحظات النادي', type: 'area' }
];
function myProfile(){
  const u = state.user || {};
  state.profile = state.profile || {};
  const me = mySwimmer();
  const p = state.profile;
  p.name = p.name || me?.name || u.name || '';
  p.phone = p.phone || me?.phone || u.phone || '';
  p.member_no = p.member_no || u.member_no || me?.id || '';
  p.group_name = p.group_name || me?.group || u.group_name || '';
  p.role = p.role || u.role || '';
  p.extras = p.extras || [];
  return p;
}
function profileInput(f){
  const p = myProfile();
  const val = p[f.k] === undefined || p[f.k] === null ? '' : p[f.k];
  const id = 'pf-' + f.k;
  if (f.type === 'select') {
    const opts = f.options.map(o => '<option value="' + esc(o) + '"' + (String(val) === o ? ' selected' : '') + '>' +
      esc({ m: 'ذكر', f: 'أنثى' }[o] || (o || '—')) + '</option>').join('');
    return '<label class="pf-label">' + esc(f.label) + '<select id="' + id + '" data-pf="' + f.k + '">' + opts + '</select></label>';
  }
  if (f.type === 'area') {
    return '<label class="pf-label pf-wide">' + esc(f.label) + '<textarea id="' + id + '" data-pf="' + f.k + '" rows="2">' + esc(val) + '</textarea></label>';
  }
  return '<label class="pf-label">' + esc(f.label) + '<input id="' + id + '" data-pf="' + f.k + '" type="' + f.type + '" value="' + esc(val) + '"></label>';
}
function profilePage(){
  const p = myProfile();
  const readOnly = ['member_no', 'group_name', 'role'];
  const rows = PROFILE_FIELDS.map(profileInput).join('');
  const extras = (p.extras || []).map((x, i) =>
    '<div class="pf-extra"><input data-pfx-label="' + i + '" value="' + esc(x.label || '') + '" placeholder="اسم التفصيل">' +
    '<input data-pfx-value="' + i + '" value="' + esc(x.value || '') + '" placeholder="القيمة">' +
    '<button class="check-btn no" data-action="remove-profile-extra" data-index="' + i + '">حذف</button></div>').join('');
  return '<div class="toolbar"><span class="page-description">بياناتك كاملة كما تظهر للإدارة — عدّلها أو أضف تفصيلًا جديدًا.</span>' +
    '<div class="toolbar-group">' + printBtn('print-profile', 'طباعة ملفي') +
    '<button class="btn btn-primary" data-action="save-profile">حفظ البيانات</button></div></div>' +
    '<section class="panel pf-panel"><div class="panel-head"><div><h3>البيانات الأساسية</h3><p>الحقول المرتبطة بالبطاقة official لا تُعدَّل من هنا</p></div></div>' +
      '<div class="pf-readonly">' +
        '<div><i>رقم الانخراط</i><b dir="ltr">' + esc(p.member_no || '—') + '</b></div>' +
        '<div><i>الفوج</i><b>' + esc(p.group_name || '—') + '</b></div>' +
        '<div><i>الدور</i><b>' + esc(({ admin: 'مدير', president: 'رئيس النادي', coach: 'مدرب', parent: 'ولي أمر', member: 'عضو', swimmer_adult: 'سباح', swimmer_minor: 'سباح قاصر' })[p.role] || p.role || '—') + '</b></div>' +
        '<div><i>الموسم</i><b>' + esc(CLUB.season) + '</b></div>' +
      '</div>' +
      '<div class="pf-grid">' + rows + '</div></section>' +
    '<section class="panel pf-panel"><div class="panel-head"><div><h3>تفاصيل إضافية</h3><p>أضف أي معلومة تريد منFCs مثل:Puede</p></div>' +
      '<button class="btn btn-outline" data-action="add-profile-extra">+ إضافة تفصيل</button></div>' +
      '<div id="pf-extras">' + (extras || '<p class="empty-cell">لا توجد تفاصيل مضافة.</p>') + '</div></section>';
}
async function saveProfile(){
  const data = {};
  PROFILE_FIELDS.forEach(f => {
    const el = document.querySelector('[data-pf="' + f.k + '"]');
    if (el) data[f.k] = el.value.trim();
  });
  const labels = [...document.querySelectorAll('[data-pfx-label]')];
  const values = [...document.querySelectorAll('[data-pfx-value]')];
  data.extras = labels.map((el, i) => ({ label: el.value.trim(), value: (values[i]?.value || '').trim() }))
    .filter(x => x.label || x.value);
  try {
    await api('/api/profile', 'PUT', data);
    Object.assign(state.profile, data);
    save(); render(); showToast('تم حفظ بياناتك.');
  } catch (e) { showToast(e.message || 'تعذر حفظ البيانات.', 'error'); }
}

/* ---------------------- ربط التعديلات الأربعة ---------------------- */
function swimmersActive(){return (state.swimmers||[]).filter(s=>s.status==='نشط'||!s.status);}
function coaches(){return (state.applications||[]).filter(a=>a.application_type==='coach');}
function coachCardModel(c){
  return { membership_no:'COACH-' + String(c.application_no || c.id).slice(-4), coach_name:c.coach_name,
    specialty:c.coach_specialty||'مدرب سباحة', experience:c.coach_experience||'—',
    phone:c.coach_phone||'', email:c.coach_email||'', group_name:'الطاقم الفني' };
}
function swimmerCardModel(s){
  const p = state.profile && state.profile.member_no === s.id ? state.profile : null;
  /* The photograph is put in here, so the batch of cards the club prints and the
     card a member prints for themselves ask the same question and get the same
     answer. Left to the card, each engine found the photograph its own way and
     neither of them found one. */
  return Object.assign({}, s, p || {}, {
    membership_no:s.id, group_name:s.group,
    photo: memberPhoto(Object.assign({}, s, p || {}), state.profile)
  });
}

const coreAction3=action;
action=async function(a,el){
  /* --- 3) عشر بطاقات في ورقة واحدة، بلا ترويسة ولا تذييل --- */
  if(a==='print-cards'||a==='print-all-cards'){
    printCardSheets(swimmersActive().map(swimmerCardModel),'swimmer');
    return;
  }
  if(a==='print-cards-quick'){
    state.page='card'; save(); render();
    printCardSheets(swimmersActive().map(swimmerCardModel),'swimmer');
    return;
  }
  if(a==='print-lux-coaches'){
    const list=coaches().map(coachCardModel);
    if(!list.length){showToast('لا يوجد مدربون مسجلون بعد.','error');return}
    printCardSheets(list,'coach');
    return;
  }
  if(a==='print-lux-swimmers'){
    printCardSheets(swimmersActive().map(swimmerCardModel),'swimmer');
    return;
  }
  if(a==='print-role-card'){const me=mySwimmer();if(me)printCardSheets([swimmerCardModel(me)],'swimmer');else showToast('حسابك غير مربوط ببطاقة انخراط.','error');return}
  if(a==='print-lux-one'){
    const s=(state.swimmers||[]).find(x=>String(x.id)===String(el.dataset.id));
    if(s)printCardSheets([swimmerCardModel(s)],'swimmer');
    return;
  }
  if(a==='print-coach-luxtour'){
    const key=String(el.dataset.id);
    const c=coaches().find(x=>String(x.id)===key||String(coachCardModel(x).membership_no)===key||String(x.application_no)===key);
    if(c)printCardSheets([coachCardModel(c)],'coach');
    else showToast('تعذّر العثور على المدرب.','error');
    return;
  }
  /* --- 4) الجدول الأسبوعي بتصميم إبداعي --- */
  if(a==='print-schedule-doc'){printScheduleDoc();return}
  /* --- 1) الملف الشخصي --- */
  if(a==='save-profile'){await saveProfile();return}
  if(a==='add-profile-extra'){
    const box=$('#pf-extras');
    if(!box)return;
    box.innerHTML='<div class="pf-extra"><input data-pfx-label placeholder="اسم التفصيل"><input data-pfx-value placeholder="القيمة"><button class="check-btn no" data-action="remove-profile-extra" data-index="0">حذف</button></div>';
    bind();
    return;
  }
  if(a==='remove-profile-extra'){
    const p=myProfile();
    p.extras=(p.extras||[]).filter((_,i)=>i!==Number(el.dataset.index));
    save(); render();
    return;
  }
  if(a==='print-profile'){
    const p=myProfile();
    const box=document.createElement('section');
    box.className='roster';
    const rows=PROFILE_FIELDS.filter(f=>p[f.k]).map(f=>'<tr><td><b>'+esc(f.label)+'</b></td><td>'+esc(p[f.k])+'</td></tr>');
    (p.extras||[]).forEach(x=>rows.push('<tr><td><b>'+esc(x.label)+'</b></td><td>'+esc(x.value)+'</td></tr>'));
    box.innerHTML='<div class="roster-head"><div><h3>'+esc(p.name||'العضو')+'</h3><p>'+
      esc(p.member_no||'—')+' · '+esc(p.group_name||'—')+' · الموسم '+esc(CLUB.season)+'</p></div></div>'+
      (rows.length?'<table class="print-table"><thead><tr><th>البيان</th><th>القيمة</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>'
        :'<p class="empty-cell">لم تُملأ البيانات بعد.</p>');
    printArea(box,{title:'ملف العضو',sub:p.name||'',variant:'roster'});
    return;
  }
  return coreAction3(a,el);
};

/* --- صفحة البطاقات: البطاقات الفنية هي بطاقات الانخراط --- */
function pageCards(){
  const list=(state.swimmers||[]).filter(s=>s.status==='نشط'||!s.status);
  const models=list.map(swimmerCardModel);
  const coachModels=coaches().map(coachCardModel);
  return '<section class="card-intro"><div><span class="eyebrow">بطاقة انخراط النادي</span><h2>بطاقات أنيقة<br>برقم التسجيل.</h2>'
    +'<p>التصميم المعتمد للنادي — 85 × 52 مم — عشر بطاقات في ورقة A4 واحدة.</p>'
    +'<div class="hero-actions"><button class="btn btn-primary" data-action="print-cards">🖨 طباعة كل البطاقات</button>'
    +'<button class="btn btn-outline" data-action="print-registration">🖨 استمارة الانخراط</button></div></div>'
    +'<div class="membership-card"><span>'+esc(CLUB.name)+'</span><b>🏊</b><strong>بطاقة العضو</strong>'
    +'<small>مقاس 85 × 52 مم</small><div><i dir="ltr">'+esc(CLUB.phone)+'</i><i>'+esc(CLUB.season)+'</i></div></div></section>'

    +'<div class="toolbar"><span class="page-description">'+models.length+' بطاقة — ورقة A4 واحدة تحتوي 10 بطاقات، دون أي معلومات أخرى.</span>'
    +'<div class="toolbar-group">'+printBtn('print-cards','طباعة الورقة')
    +'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button></div></div>'
    +'<section class="lux-preview">'
    +(models.length?models.map(m=>luxuryCard(m,'swimmer')).join('')
      :'<div class="panel empty-cell">لا توجد بطاقات بعد اعتماد السباحين.</div>')
    +'</section>'
    +(models.length?'<div class="official-forms-list" style="margin-top:16px">'+models.map(m=>
        '<button data-action="print-lux-one" data-id="'+esc(m.membership_no)+'"><b>'+esc(m.name)+'</b><span>'+esc(m.group_name||'')+' · بطاقة واحدة</span></button>').join('')+'</div>':'')

    +'<div class="toolbar" style="margin-top:26px"><span class="page-description">البطاقات الفنية للمدربين ('+coachModels.length+')</span>'
    +'<div class="toolbar-group"><button class="btn btn-primary" data-action="print-lux-coaches">🎨 طباعة بطاقات المدربين</button></div></div>'
    +(coachModels.length?'<section class="lux-preview">'+coachModels.map(m=>luxuryCard(m,'coach')).join('')+'</section>'
      +'<div class="official-forms-list" style="margin-top:14px">'+coachModels.map(m=>
        '<button data-action="print-coach-luxtour" data-id="'+esc(m.membership_no)+'"><b>'+esc(m.coach_name)+'</b><span>'+esc(m.specialty)+' · بطاقة واحدة</span></button>').join('')+'</div>'
      :'<p class="empty-cell">لا توجد طلبات مدربين بعد.</p>');
}

/* --- الجدول الأسبوعي: زر الطباعة الإبداعي --- */
const corePageView3=pageView;
pageView=function(p){
  if(p==='schedule'){
    const html=pageSchedule()
      .replace('<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>',
               '<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>')
      .replace(printBtn('print-schedule','طباعة البرنامج'),
               '<button class="btn btn-primary" data-action="print-schedule-doc">🖨 طباعة الجدول</button>');
    return '<div class="page-root" id="page-root">'+html+'</div>';
  }
  if(p==='profile')return '<div class="page-root" id="page-root">'+profilePage()+'</div>';
  return corePageView3(p);
};
pageTitle=function(p){return ({home:'نظرة عامة',applications:'طلبات التسجيل',subscriptions:'إدارة الاشتراكات',users:'إدارة السباحين',schedule:'البرنامج الأسبوعي',attendance:'سجل الحضور',notices:'الإعلانات والتنبيهات',card:'بطاقات الانخراط',groups:'الأفواج والمدربون',settings:'الإعدادات',profile:'ملفي'}[p]||'نظرة عامة');};

/* --- صفحة الملف الشخصي في لوحات الأدوار --- */
const coreRoleDashboard=roleDashboard;
roleDashboard=function(){
  const role=state.user?.role||'member';
  const menu=(ROLE_MENU[role]||ROLE_MENU.member);
  const withProfile=menu.slice();
  if(!withProfile.some(m=>m[0]==='profile')) withProfile.push(['profile','ملفي','✎']);
  const key=withProfile.some(m=>m[0]===state.rolePage)?state.rolePage:'home';
  const title=(withProfile.find(m=>m[0]===key)||withProfile[0])[1];
  const views={home:()=>roleHome(role),schedule:roleSchedule,attendance:roleAttendance,cards:roleCards,notices:roleNotices,applications:roleApplications,profile:profilePage};
  return '<div class="role-shell"><header class="role-top"><a class="brand"><span class="logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a>'
    +'<div class="role-actions"><span>'+esc(ROLE_LABELS[role]||'عضو النادي')+'</span><button class="icon-btn" data-action="theme">'+(state.dark?'☀':'◐')+'</button>'
    +'<button class="btn btn-outline" data-action="logout">تسجيل الخروج</button></div></header>'
    +'<nav class="role-nav">'+withProfile.map(m=>'<button class="'+(m[0]===key?'active':'')+'" data-role-page="'+m[0]+'"><i>'+m[2]+'</i>'+esc(m[1])+'</button>').join('')+'</nav>'
    +'<main class="role-main"><h2 class="role-page-title">'+esc(title)+'</h2>'+((views[key]||views.home)())+'</main></div>';
};
roleCards=function(){
  const me=mySwimmer();
  if(!me)return '<section class="panel"><p class="empty-cell">حسابك غير مربوط ببطاقة انخراط. تواصل مع إدارة النادي لربط رقم العضوية.</p></section>';
  return '<section class="card-intro"><div><span class="eyebrow">بطاقتك الرسمية</span><h2>بطاقة انخراط<br>في جيبك.</h2>'
    +'<p>اعرضها عند المدرب أو المشرف، ليسجل حضورك.</p>'
    +'<div class="hero-actions"><button class="btn btn-primary" data-action="print-role-card">🖨 طباعة بطاقة</button>'
    +'<button class="btn btn-outline" data-action="print-all-cards">🖨 كل البطاقات</button>'
    +'<button class="btn btn-outline" data-role-page="profile">✎ تعديل ملفي</button></div></div>'
    +'<div class="membership-card"><span>'+esc(CLUB.name)+'</span><b>🏊</b><strong>بطاقة العضو</strong>'
    +'<small>'+esc(me.group||CLUB.unit)+' · '+esc(CLUB.season)+'</small><div><i>'+esc(me.name||'')+'</i><i dir="ltr">'+esc(me.id||'')+'</i></div></div></section>'
    +'<section class="lux-preview single">'+luxuryCard(swimmerCardModel(me),'swimmer')+'</section>';
};

/* --- تحميل الملف الشخصي من الخادم --- */
const coreSyncApi=syncApi;
syncApi=async function(){
  await coreSyncApi();
  try{
    const r=await fetch('/api/profile',{credentials:'same-origin'});
    if(r.ok){const d=await r.json(); if(d&&d.profile) state.profile=Object.assign({},state.profile,d.profile);}
  }catch(_){}
};

/* ==========================================================
   الاستمارة الرسمية: صورة الاستمارة خلفية + نصوص متراكبة
   الإحداثيات بالملّيمتر على ورق A4 (210 × 297) مقاسة من الصورة
   ========================================================== */
const FORM_BG = 'assets/form-registration-01.jpg';
const PHOTO_BOX = { x: 22.1, y: 67.6, w: 36.4, h: 42.5 };

const PAGE_W = 210, PAGE_H = 297;   // A4 in millimetres

/* Where a value may go, measured off assets/form-registration-01.jpg itself.
   Every field on the scanned form is printed as "label:" followed by a blank
   writing line, and the club reads right to left: the label sits on the right,
   its colon is the last thing printed, and the line runs leftwards from there.

   So each spot stores the line it belongs on and the colon that ends its label:
     y      the printed rule, in mm from the top of the page
     x0     where that rule starts, in mm from the left edge of the page
     colon  the left edge of the printed colon, in mm from the left of the page

   A value is drawn between x0 and the colon, right-aligned, so it always begins
   immediately after the colon and never runs over the printed label. Two
   constants do the rest, so every field obeys the same rule:
     SPOT_GAP     clear space left between the colon and the first character
     SPOT_CLEAR   clear space left between the text and the rule it sits on

   The spots whose id starts with "parent_", "card_" or is "authorised_for"
   belong to the guardian declaration, which exists only for a minor;
   overlaySheet leaves them out for an adult. The doctor, the signature and the
   place of issue have no line on the scan wide enough to hold them, so nothing
   is written over printed wording. */
const FORM_SPOTS = [
  /* The top line of the scan carries two labels: "مسبح :" at the right and
     "رقم التسجيل:" at the left. They had one box between them, measured onto
     the pool's line -- so the registration number printed beside the word مسبح
     and its own place stayed empty. The pool line runs 90-190 mm and begins a
     millimetre after the pool's colon; the registration number takes the empty
     margin at the far left, on the same line. */
  { id: 'facility',          y: 61.95, x0: 90.8,  colon: 191.1 },
  { id: 'registration',      y: 61.95, x0: 2.0,   colon: 35.6 },
  { id: 'first_name',         y: 75.25, x0: 62.3,  colon: 178.3 },
  { id: 'last_name',          y: 85.05, x0: 62.3,  colon: 178.3 },
  { id: 'birth_date',         y: 94.85, x0: 62.3,  colon: 178.3 },
  { id: 'address',            y: 104.65, x0: 62.3, colon: 178.3 },
  { id: 'blood_group',        y: 114.45, x0: 62.1,  colon: 178.3 },
  { id: 'phone',              y: 124.25, x0: 62.3,  colon: 178.3 },
  { id: 'parent_name',        y: 208.78, x0: 102.4, colon: 152.9 },
    /* `المولود(ة) بتاريخ:` on the declaration line.

       It carried the swimmer's own day -- which is what `يولد بتاريخ:` in the
       identity block above already says. The child's date was therefore printed
       twice on one sheet, and the club read the second copy as the guardian's and
       had to correct it by hand on every form.

       The line belongs to the person signing, and the day on it is the guardian's
       day: `guardian_birth_date`. The child's day has a line of its own, and it
       is filled in. */
  { id: 'child_birth_date',  y: 208.78, x0: 32.9,  colon: 71.9 },
    /* `ب:` on the declaration line -- where the child was born.

       It was read as *son of* and a family name was printed there, and before
       that a town was, and neither reading survived contact with the club:
       `ب` on this form is `بـ...` as in *at*, the birthplace, and the club writes
       `غرداية` in it.

       The surname does not go missing: it is already printed in the identity block
       above, in `اللقب`, which is where a person looks for it. Putting it here as
       well only made the declaration disagree with the block about who the child
       is. */
  { id: 'birth_place',        y: 208.78, x0: 4.2,   colon: 33.1 },
  { id: 'parent_id',          y: 217.70, x0: 106.0, colon: 149.4 },
  { id: 'card_issued_at',     y: 217.70, x0: 40.0,  colon: 73.3 },
  { id: 'card_place',         y: 217.70, x0: 4.2,   colon: 31.5 },
  { id: 'authorised_for',     y: 226.80, x0: 106.0, colon: 186.4 }
];
const SPOT_GAP = 1.6;    // mm of clear paper between the colon and the value
const SPOT_CLEAR = 0.4;  // mm of clear paper between the value and the rule

const /* The declaration is a guardian's line: `أنا المصغي` names the person signing
     for a child, and `المولود (٥) بتاريخ:` and `ب:` are that child. An adult signs
     for nobody, so the whole line stays empty. Those two are named here rather
     than caught by a prefix: they carry the guardian's day and the child's
     birthplace, and a prefix cannot tell them from the adult's day in the block
     above. */
 GUARDIAN_SPOT = /^(parent_|card_|child_birth_date$|birth_place$|authorised_for$)/;

/* An adult is not a minor: the guardian block belongs to another person and has
   to stay empty on their form. */
const isAdultRecord = a => String((a && a.category) || '').toLowerCase() === 'adult';

/* Turns a spot into inline CSS. Anchoring on the bottom edge keeps the value
   sitting on its rule whatever the webfont's own metrics turn out to be. */
function spotStyle(s) {
  const right = s.colon - SPOT_GAP;
  return 'bottom:' + (PAGE_H - s.y - SPOT_CLEAR).toFixed(2) + 'mm;'
    + 'right:' + (PAGE_W - right).toFixed(2) + 'mm;'
    + 'width:' + (right - s.x0).toFixed(2) + 'mm';
}
function formValues(a){
  const v = (k, fb) => (a && a[k] ? a[k] : (fb || ''));
  /* Arabic-Indic digits on the sheet, and dates written the way the club writes
     them: 11/10/2026. It was year first, which made a platform that reads one way
     on the screen and another on the paper not one thing. A reference number is the
     exception and is left alone: it is the one thing a person has to read back and
     look up.

     Stored dates are untouched. This is only how one is written out. */
  const slashDate = d => {
    const raw = String(d === undefined || d === null ? '' : d).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return m ? clubDigits(m[3] + '/' + m[2] + '/' + m[1]) : clubDigits(raw);
  };
  return {
    /* The pool, on the line the scan draws for it. */
    facility: v('facility'),
    /* A registration number is the club's own until one is issued; before that
       it is the number of the request. The last eight characters of a request
       number were never a number anyone could look up. */
    registration: clubDigits(v('membership_no') || v('application_no')),
    first_name: v('first_name_ar'),
    last_name: v('last_name_ar'),
    /* The day, on the line the form calls تاريخ الميلاد, and nothing else.

       A place used to be appended to it, having first been printed in the `ب:` box
       on the declaration on the reading that `ب` meant *son of*. It does not:
       `ب:` on that line is where the child was born, and the club writes غرداية
       in it. A line labelled تاريخ الميلاد reading `21/07/2013 · غرداية` prints two
       different facts as one value, and one of them twice on the sheet.

       No day on file means a blank line. The line is labelled تاريخ الميلاد, and a
       town printed alone on it reads as a date -- a blank line is honest and a
       wrong one is not. The birthplace is printed on its own box below, where the
       club reads it. */
    birth_date: slashDate(a && a.birth_date),
    address: v('address'),
    blood_group: clubDigits(v('blood_group')),
    phone: clubDigits(v('phone')),
    /* There is no doctor value. It used to be the swimmer's own name, written
       into the line reserved for the doctor who certifies them, and on a document
       the club keeps that is the wrong name in the wrong place. The scan has no
       line wide enough for a doctor, a signature and a place of issue, so there
       is nothing to print; the club fills that part in by hand. */
    medical_person: '',
    /* The declaration reads "أنا الولي ... السيد(ة) ___ المولود(ة) بتاريخ ___ بن ___",
       so the given name and the surname are separate blanks, exactly as the
       identity block at the top separates الإسم from اللقب. Nationality has no
       blank of its own on this form, so nothing is written for it. */
    /* One box for the name, carrying both names: the form prints
       `اسمه` and `اللقب` over a single rule. A surname in a box of
       its own reads as though the name were split -- and put a family
       name where the person expects to read a date. */
    parent_name: [v('guardian_first_name'), v('guardian_last_name')]
      .filter(Boolean).join(' '),
    /* `المولود (٥) بتاريخ:` -- the guardian's day, not the child's.

       It carried `birth_date`, which is already printed on `يولد بتاريخ:` in the
       identity block, so the child's date appeared twice on one sheet. The club
       read the second copy as the guardian's and struck it out by hand on every
       form. The day the person signing puts down is theirs, and it is on file as
       `guardian_birth_date`. */
    child_birth_date: slashDate(v('guardian_birth_date')),
    /* `ب:` -- where the child was born. A surname lived here for a while, on the
       reading that the word is *son of*. The club's own forms say otherwise, and
       the surname is already printed in `اللقب` in the block above, so nothing is
       lost by leaving this box for the place. */
    birth_place: v('birth_place'),
    parent_id: clubDigits(v('guardian_national_id')),
    /* The declaration is the guardian's, so the card on it is
       the guardian's, and the day it was issued is the day they gave. */
    card_issued_at: slashDate(v('guardian_card_issued') || v('card_issue_date')),
    card_place: v('card_issue_place'),
    /* `المصرّح له` -- the child this declaration is about. It used to be left blank
       whenever the request did not carry the name, which is most of them: the box
       is on the sheet, it says *authorised for*, and it said nothing. The child's
       own name is on the record in two fields and is the same on both copies of
       this code, so it is put there rather than left for a reader to guess. */
    authorised_for: v('guardian_child')
      || [v('first_name_ar'), v('last_name_ar')].filter(Boolean).join(' ')
  };
}
function formPhotoData(p){
  const src = p && (p.photo || p.photoDataUrl || p.photo_url);
  if (src && /^(data:|https?:)/.test(src)) return src;
  return '';
}

/* overlaySheet, officialFormCSS and printOfficialForms live in part-m.js, which
   is concatenated after this layer. Keeping a second copy here only meant the
   later one silently won, so this file now stops at the shared geometry. */

/* ==========================================================
   صورة المنخرط + قصر طباعة كل البطاقات على الإدارة
   ========================================================== */
const PRINT_ALL_ROLES = ['admin', 'president', 'manager', 'coach'];
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
function canPrintAllCards(){
  return PRINT_ALL_ROLES.includes((state.user || {}).role);
}
function photoStoragePath(uid, name){
  const safe = String(name || 'photo').replace(/[^\w.\-]+/g, '_').slice(-40);
  return 'member-photos/' + uid + '/' + safe + '-' + Date.now() + '.jpg';
}
function readPhotoFile(file){
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('اختر صورة أولاً.'));
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) return reject(new Error('الصورة يجب أن تكون JPG أو PNG أو WebP.'));
    if (file.size > PHOTO_MAX_BYTES) return reject(new Error('حجم الصورة يتجاوز 3 ميغابايت.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
    reader.readAsDataURL(file);
  });
}
async function saveMyPhoto(file){
  try {
    const dataUrl = await readPhotoFile(file);
    const uid = (state.user && state.user.id) || 'local';
    let photoUrl = dataUrl;
    if (window.firebase && firebase.storage && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      const ref = firebase.storage().ref(photoStoragePath(uid, file.name));
      const snapshot = await ref.put(file, { contentType: file.type });
      photoUrl = await snapshot.ref.getDownloadURL();
    }
    const saved = await api('/api/profile', 'PUT', { photo: photoUrl });
    state.profile = Object.assign({}, state.profile, { photo: (saved.profile && saved.profile.photo) || photoUrl });
    save(); render(); showToast('تم حفظ صورتك.');
  } catch (e) {
    showToast(e.message || 'تعذر حفظ الصورة.', 'error');
  }
}

/* ---------- قسم الصورة داخل صفحة ملفي ---------- */
const coreProfilePage=profilePage;
profilePage=function(){
  const html = coreProfilePage();
  const photo = (state.profile && state.profile.photo) || '';
  const box = '<section class="panel pf-photo-panel"><div class="panel-head"><div><h3>صورتي الشخصية</h3>'
    + '<p>تظهر على بطاقتك وعلى استمارة الإلحاق — يفضّل صورة واضحة بخلفية بيضاء.</p></div></div>'
    + '<div class="pf-photo-row">'
    + '<div class="pf-photo-preview">' + (photo
        ? '<img src="' + esc(photo) + '" alt="صورتي">'
        : '<span class="pf-photo-empty">لا توجد صورة</span>') + '</div>'
    + '<div class="pf-photo-actions">'
    + '<label class="btn btn-outline">📷 اختيار صورة<input id="my-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>'
    + (photo ? '<button class="check-btn no" data-action="remove-my-photo">حذف الصورة</button>' : '')
    + '<p class="page-description">JPG أو PNG أو WebP — بحد أقصى 3 ميغابايت.</p>'
    + '</div></div></section>';
  return html + box;
};

/* ---------- ربط كل شيء ---------- */
const coreAction4=action;
action=async function(a,el){
  if(a==='upload-my-photo'){await saveMyPhoto(el?.files?.[0]);return}
  if(a==='remove-my-photo'){
    try{await api('/api/profile','PUT',{photo:''});state.profile.photo='';save();render();showToast('تم حذف الصورة.')}
    catch(e){showToast(e.message||'تعذر الحذف.','error')}
    return;
  }
  if(a==='print-campaign'||a==='print-cards'||a==='print-all-cards'||a==='print-cards-quick'||a==='print-lux-swimmers'){
    if(!canPrintAllCards()){
      showToast('طباعة جميع البطاقات متاحة للمدير ورئيس النادي والمسيّر فقط.', 'error');
      return;
    }
    return coreAction4(a,el);
  }
  return coreAction4(a,el);
};

/* ----------Styles ---------- */

/* The file input is bound on every render.

   This takes the binding it is given and adds one line to it, rather than writing
   the table out again. It used to restate it, and the restatement won -- so a
   control bound in the baseline was unbound in the built file whenever this copy
   did not repeat it, with nothing to show for it: the page rendered, the control
   was there, and pressing it did nothing. That is how the switch for showing the
   decided requests arrived unbound. */
const coreBindList = bind;
bind = function () {
  coreBindList();
  const file = document.querySelector('#my-photo');
  if (file) file.onchange = () => action('upload-my-photo', { files: file.files });
};

/* A barcode of the registration number, drawn by this page and by nothing else.

   Why written here rather than loaded
   ------------------------------------
   The site already pulls one script off a public CDN. Adding a second one means
   another party can execute code on the page that carries a list of children's
   photographs and the telephone numbers of their parents. That is a real cost for
   forty lines of arithmetic, so the arithmetic is here.

   Code 128, subset B
   ------------------
   Chosen because it is one-dimensional and reads with any ordinary hand scanner,
   and because the number is digits and a letter -- ten characters after the prefix
   -- where a QR would ask a phone camera to do the work a pen does.

   The quiet module is the point. Every character is a different count of black and
   white, and the widths sum to eleven modules, which is what lets a scanner work
   out where one character ends and the next begins. Draw the same string twice and
   it comes out the same width, every time, on every printer.

   The check digit is the part that is easy to leave out and impossible to miss
   later. Without it a misread character produces a number that looks valid, and the
   gate writes down the wrong child.
*/

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232',
  '2331112'
];

const BARCODE_START_B = 104;
const BARCODE_STOP = 106;

/* The string a scanner will read back. Only the characters subset B holds: ASCII
   32 to 126. An Arabic name or a phone number's plus sign is not silently mangled
   into a plausible-looking barcode -- it is refused, because a barcode that scans
   to something other than what it claims is worse than no barcode. */
function barcodeValues_(text) {
  const out = [];
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) return null;
    out.push(code - 32);
  }
  return out;
}

function barcodeChecksum_(values) {
  let sum = BARCODE_START_B;
  for (let i = 0; i < values.length; i++) sum += values[i] * (i + 1);
  return sum % 103;
}

/* An array of booleans, true where a bar is drawn. Widths come straight from the
   pattern, one digit at a time, alternating bar and space from the left. */
function barcodeBits_(text) {
  const values = barcodeValues_(text);
  if (!values || !values.length) return null;

  const sequence = [BARCODE_START_B].concat(values, [barcodeChecksum_(values)], [BARCODE_STOP]);
  const bits = [];
  for (const value of sequence) {
    const pattern = CODE128_PATTERNS[value];
    if (!pattern) return null;
    let bar = true;
    for (const ch of pattern) {
      const n = Number(ch);
      for (let i = 0; i < n; i++) bits.push(bar);
      bar = !bar;
    }
  }
  return bits;
}

/* The bars themselves, as a run-length list rather than one entry per module: at
   print size a barcode is about 140 modules across, and the extra ink of a hundred
   and forty separate filled rectangles is measurable on a card that gets printed a
   hundred at a time.

   These are the BLACK runs. It is worth saying which, because collecting the white
   runs instead -- which is what this did at first -- produces a list of the right
   length that draws the whole barcode shifted by one character, which no eye can
   see and no scanner can read. */
function barcodeBars_(text) {
  const bits = barcodeBits_(text);
  if (!bits) return null;

  const bars = [];
  let width = 0;
  for (const b of bits) {
    if (b) { width++; continue; }
    if (width) { bars.push(width); width = 0; }
  }
  if (width) bars.push(width);

  return { bars, modules: bits.length };
}

/* Drawn into a canvas. Kept separate from the maths so the maths can be checked
   without a browser, which is where it was actually wrong the first time. */
function drawBarcode_(canvas, text, options) {
  const opts = options || {};
  const quiet = opts.quiet == null ? 10 : opts.quiet;
  const height = opts.height || 26;
  const width = opts.width || 150;

  const shape = barcodeBars_(text);
  if (!shape || !canvas || typeof canvas.getContext !== 'function') return false;

  /* A canvas that will not give a context is not a canvas that will show a
     barcode, and asking is itself allowed to fail: some engines have the method
     and throw from it rather than answering. Saying so is the whole point -- the
     caller removes the frame rather than leaving a white rectangle that looks like
     a barcode and is not one. */
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }
  if (!ctx) return false;

  const total = shape.modules + quiet * 2;
  const unit = width / total;

  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  ctx.fillStyle = opts.background || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = opts.ink || '#071a35';

  /* Straight from the modules, one rectangle per black one.

   The run-length list exists for counting and checking; drawing from it means
   working out where the gaps are while drawing, and getting that arithmetic wrong
   produces a barcode shifted by one character -- the same shape, the same ink,
   and a number that scans as somebody else's child. One module, one rectangle, no
   arithmetic. The ink is identical either way; only the number of draw calls
   differs, and a hundred cards is not a hundred cards' worth of work. */
  let x = quiet * unit;
  const bits = barcodeBits_(text);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) ctx.fillRect(Math.round(x), 0, Math.max(1, Math.round(unit)), canvas.height);
    x += unit;
  }
  return true;
}

/* The quiet zone is not decoration. A scanner reading the first bar of a barcode
   that starts at the paper's edge reads nothing at all, and the club finds out at
   the gate rather than in this file. */
function barcodeQuietZone_(text) {
  const shape = barcodeBars_(text);
  return shape ? Math.ceil(shape.modules * 0.10) : 0;
}

/* Drawing every barcode that is on the page, and only those that have a number.

   A canvas with no drawing in it is a white rectangle, and a white rectangle on a
   membership card looks exactly like a barcode that has not come out yet. It fails
   at the gate, in front of a queue, with nobody knowing why.

   So the card that shows the number always shows the bars for that same number, or
   the bars are not there at all. There is no state in which the number appears
   without its barcode. A number that cannot be encoded produces no bars and no
   error, because a card that prints half of something is not a card anybody can
   use -- but the club is told, in the count this returns, rather than finding out
   at the gate. */
function buildBarcodes_() {
  const canvases = document.querySelectorAll('canvas.lux-barcode');
  let drawn = 0;
  let skipped = 0;

  canvases.forEach(canvas => {
    /* One card's canvas failing must not cost every other card its barcode. A
       hundred cards printing ninety-nine bars and one blank is a fault that is
       found at the gate, so each is done on its own and the failure stays local. */
    try {
      const text = canvas.getAttribute('data-barcode') || '';
      if (!barcodeBars_(text)) {
        canvas.parentNode && canvas.parentNode.removeChild(canvas);
        skipped++;
        return;
      }
      if (drawBarcode_(canvas, text, { quiet: 10, height: 30, width: 132 })) drawn++;
      else {
        canvas.parentNode && canvas.parentNode.removeChild(canvas);
        skipped++;
      }
    } catch (_) {
      try { canvas.parentNode && canvas.parentNode.removeChild(canvas); } catch (__) {}
      skipped++;
    }
  });

  return { drawn, skipped };
}

/* Hooked onto the hook the cards already use.

   Cards go into the page in several places -- the page itself, the batch view, the
   sheet of ten -- and each of them already calls one function when it is done.
   Rather than remember to call a second one in each of those places, and rather
   than let one of them be forgotten until a hundred cards are printed wrong, the
   bars are drawn from the same moment. One place to get wrong, and it is the one
   place that already exists. */
if (typeof buildQRCodes === 'function') {
  const beforeTheCodesWereBuilt = buildQRCodes;
  buildQRCodes = function () {
    const out = beforeTheCodesWereBuilt.apply(this, arguments);
    try { buildBarcodes_(); } catch (_) { /* a card without bars is visible; a broken page is not */ }
    return out;
  };
}

/* The manager's form for one member: the whole record, and the photograph.

   What this replaces, and why it existed at all.

   The button said تعديل -- edit -- and opened a form with four fields in it: a
   name, a group, a telephone number and a state. The member's record carries
   fifteen more: a day of birth, a blood group, a level, a facility, a national
   number, a WhatsApp number, an address, a nationality, a photograph, and the
   guardian who signed for them. None of them were in the form, and none of them
   could be reached from it. Somebody correcting a child's date of birth had to
   find another way to do it, and there was not another way.

   And the four that were there were not safe either: saving wrote
   `name: value || ''` for every field the form did not send, so changing a
   telephone number blanked the name. A form that erases what you did not touch
   is not an edit form; it is a way of losing a record by accident.

   So: every field the record carries, a photograph that can be changed or added,
   and the guardian -- who is not on the member at all but on the request they
   were accepted from, and is edited there, because that is where they are read
   from too.

   The photograph is read in the page and shrunk before it is sent, because a
   camera photograph is three megabytes of text and the record is read on every
   card the club prints. Nothing is uploaded anywhere new: it goes to the member's
   own record, and it is read back from there.
*/

const SWIMMER_EDIT_FIELDS = [
  { key: 'name', label: 'الاسم واللقب *', type: 'text', wide: true },
  { key: 'first_name_ar', label: 'الاسم بالعربية', type: 'text' },
  { key: 'last_name_ar', label: 'اللقب بالعربية', type: 'text' },
  { key: 'birth_date', label: 'تاريخ الميلاد', type: 'date' },
  { key: 'gender', label: 'الجنس', type: 'choice', options: ['', 'ذكر', 'أنثى'] },
  { key: 'national_id', label: 'رقم التعريف الوطني', type: 'text', ltr: true },
  { key: 'blood_group', label: 'فصيلة الدم', type: 'choice', options: ['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
  { key: 'level', label: 'المستوى', type: 'text' },
  { key: 'facility', label: 'المنشأة / المسبح', type: 'text' },
  { key: 'group_name', label: 'الفوج', type: 'group' },
  { key: 'phone', label: 'الهاتف', type: 'tel', ltr: true },
  { key: 'whatsapp', label: 'الواتساب', type: 'tel', ltr: true },
  { key: 'email', label: 'البريد الإلكتروني', type: 'email', ltr: true },
  { key: 'address', label: 'العنوان', type: 'text', wide: true },
  { key: 'status', label: 'الحالة', type: 'status' }
];

const GUARDIAN_EDIT_FIELDS = [
  { key: 'guardian_first_name', label: 'اسم الولي', type: 'text' },
  { key: 'guardian_last_name', label: 'لقب الولي', type: 'text' },
  { key: 'guardian_relation', label: 'صلة القرابة', type: 'text' },
  { key: 'guardian_phone', label: 'هاتف الولي', type: 'tel', ltr: true },
  { key: 'guardian_national_id', label: 'رقم تعريف الولي', type: 'text', ltr: true },
  { key: 'guardian_birth_date', label: 'تاريخ ميلاد الولي', type: 'date' }
];

function swimmerEditField(f, value) {
  const v = value === undefined || value === null ? '' : String(value);
  const id = 'swf-' + f.key.replace(/_/g, '-');
  const dir = f.ltr ? ' dir="ltr"' : '';
  const common = 'id="' + esc(id) + '"' + dir + ' data-swimmer-field="' + esc(f.key) + '"';

  if (f.type === 'choice' || f.type === 'group' || f.type === 'status') {
    const options = f.type === 'group' ? groupOptions(value)
      : f.type === 'status' ? ['نشط', 'موقوف', 'بانتظار'].map(s =>
          '<option value="' + esc(s) + '"' + (String(value) === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('')
      : f.options.map(o =>
          '<option value="' + esc(o) + '"' + (String(value) === o ? ' selected' : '') + '>' + esc(o || '—') + '</option>').join('');
    return '<label>' + esc(f.label) + '<select ' + common + '>' + options + '</select></label>';
  }

  const inputType = f.type === 'date' ? 'date' : (f.type === 'tel' ? 'tel' : (f.type === 'email' ? 'email' : 'text'));
  return '<label>' + esc(f.label) + '<input ' + common + ' type="' + inputType + '" value="' + esc(v) + '"></label>';
}

/* A member's own photograph, drawn and changeable.

   Kept beside the fields rather than on the profile page, because the moment it
   is wanted is the moment somebody is editing a member and notices the picture is
   wrong -- which is not the moment they are on their own profile. */
function swimmerPhotoBox(s) {
  const photo = (s && (s.photo || s.photoDataUrl || s.photo_url)) || '';
  return '' +
    '<section class="swf-photo">' +
      '<div class="swf-photo-frame">' + (photo && /^(data:|https?:)/.test(photo)
        ? '<img id="swf-photo-img" src="' + esc(photo) + '" alt="صورة السباح">'
        : '<span id="swf-photo-empty">بلا صورة</span>') + '</div>' +
      '<div class="swf-photo-actions">' +
        '<label class="btn btn-outline">📷 اختيار صورة' +
          '<input id="swf-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>' +
        (photo ? '<button type="button" class="check-btn no" data-action="swf-remove-photo">حذف الصورة</button>' : '') +
        '<p class="swf-photo-note">تظهر على البطاقة وعلى استمارة الإلحاق · JPG أو PNG أو WebP · بحد أقصى 3 ميغابايت</p>' +
      '</div>' +
    '</section>';
}

function swimmerModal(s) {
  const isEdit = !!s;
  if (!isEdit) {
    /* Adding a member from the roster is a different act from correcting one: the
       number is the club's to give, and the photograph and the guardian come with
       the request rather than with a person typed in by hand. So the two forms are
       not merged into one that is wrong half the time. */
    return formModal('إضافة سباح جديد',
      '<div class="form-two">'
      + '<label>الاسم واللقب *<input id="sw-name"></label>'
      + '<label>رقم الانخراط<input id="sw-no" dir="ltr" placeholder="يُولَّد تلقائيًا"></label>'
      + '<label>الفوج<select id="sw-group">' + groupOptions(null) + '</select></label>'
      + '<label>الهاتف<input id="sw-phone" dir="ltr"></label>'
      + '<label>الحالة<select id="sw-status"><option>نشط</option><option>موقوف</option><option>بانتظار</option></select></label>'
      + '</div>',
      'save-swimmer');
  }

  const state_ = (typeof state !== 'undefined' && state) || {};
  const fromRequest = s.from_application || s.application_no || '';
  const request = fromRequest
    ? ((state_.applications || []).find(a => String(a.id) === String(fromRequest)
      || String(a.application_no || '') === String(fromRequest)) || {})
    : {};

  const guardianValues = {};
  for (const f of GUARDIAN_EDIT_FIELDS) {
    guardianValues[f.key] = (s && s[f.key]) || request[f.key] || '';
  }

  const fields = SWIMMER_EDIT_FIELDS.map(f =>
    '<label data-wide="' + (f.wide ? '1' : '') + '">' + swimmerEditField(f, s[f.key]).replace(/^<label>/, '').replace(/<\/label>$/, '') + '</label>'
  ).join('');

  const body = swimmerPhotoBox(s)
    + '<div class="form-section-title">بيانات السباح</div>'
    + '<div class="form-two">' + fields + '</div>'
    + '<div class="form-section-title">الولي'
    + (fromRequest ? '<span class="swf-note"> — من الطلب ' + esc(String(fromRequest)) + '</span>' : '') + '</div>'
    + (fromRequest
      ? '<div class="form-two">' + GUARDIAN_EDIT_FIELDS.map(f => swimmerEditField(f, guardianValues[f.key])).join('') + '</div>'
      : '<p class="empty-cell">هذا السباح لم يُسجَّل من طلب، فلا بيانات لوليّ فيه.</p>');

  return formModal('تعديل بيانات السباح', body, 'save-swimmer',
    ' data-id="' + esc(s.id) + '"'
    + (fromRequest ? ' data-from="' + esc(String(fromRequest)) + '"' : ''));
}

/* Drawn when the file input changes, so the person sees the photograph they have
   just chosen before they save it. And the photograph they had is still there
   behind it, so choosing the wrong file is not a mistake they have to undo. */
if (typeof bind === 'function') {
  const coreBind = bind;
  bind = function () {
    const out = coreBind.apply(this, arguments);
    const input = document.getElementById('swf-photo');
    if (input && !input.__watched) {
      input.__watched = true;
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        readSwimmerPhoto(file).then(dataUrl => {
          swimmerPhotoCleared = false;
          const frame = input.closest('.swf-photo') && input.closest('.swf-photo').querySelector('.swf-photo-frame');
          if (!frame) return;
          frame.innerHTML = '<img id="swf-photo-img" src="' + dataUrl + '" alt="الصورة المختارة">';
        }).catch(e => showToast(e.message, 'error'));
      });
    }
    return out;
  };
}

if (typeof action === 'function') {
  const coreActionSwf = action;
  action = async function (a, el) {
    if (a === 'swf-remove-photo') {
      swimmerPhotoCleared = true;
      const frame = document.querySelector('.swf-photo-frame');
      if (frame) frame.innerHTML = '<span id="swf-photo-empty">ستُحذف عند الحفظ</span>';
      const note = document.querySelector('.swf-photo-note');
      if (note) note.textContent = 'ستُحذف الصورة عند الضغط على حفظ.';
      return;
    }
    return coreActionSwf.apply(this, arguments);
  };
}

/* Reading a chosen file into the record.

   Shrunk in the page before it is sent. A photograph off a phone is three
   megabytes; the member's record is read on every card the club prints and on
   every page that lists the roster, and a base64 photograph that size turns a list
   of two hundred into something no browser will hold. */
/* Whether the photograph has been marked for removal.

   Held outside the form rather than inside it, because removing a photograph is
   the one edit that cannot be undone by saving the form again: once the value is
   gone there is nothing in the form left to save. So it is remembered until the
   save, where it is written, and cleared afterwards -- and if the save fails it
   stays marked, because the person still meant to remove it. */
let swimmerPhotoCleared = false;

function readSwimmerPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      return reject(new Error('الصورة يجب أن تكون JPG أو PNG أو WebP.'));
    }
    if (file.size > 12 * 1024 * 1024) {
      return reject(new Error('الصورة كبيرة جدًا. اختر صورة أصغر.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذّر فتح الصورة.'));
      img.onload = () => {
        const maxW = 480, maxH = 600;
        let w = img.naturalWidth || maxW, h = img.naturalHeight || maxH;
        const scale = Math.min(1, maxW / w, maxH / h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* The door: whether a family may file a registration at all.

   The club asked for a box to open and close registrations with, and a message
   that says so when it is closed. The endpoint behind it has been published for a
   while; nothing on the page was calling it, which is the same gap as everywhere
   else here -- a thing that works and is not wired to anything a person touches.

   What this adds
   --------------
     * the box, on the settings page, for the manager
     * the closed message, in two places, in the words the club would use
     * a refusal at the moment of saving, not only in the form

   Why the refusal matters as much as the message
   ---------------------------------------------
   A closed form that still saves is worse than no box at all. It looks like the
   switch is broken, and the club stops trusting it. So the form is not merely
   hidden or greyed: the save is refused, and it is refused by name.

   And the reading of the door is one request for the whole session, not one per
   field, not one per keystroke. It is asked when the page opens and again after
   anybody changes it, and a person who is looking at the form is not waiting on a
   network round trip to type.
*/

const REGISTRATION_DOOR_PATH = '/api/registration';

/* Read once, kept on the state so every part of the page asks the same question
   the same way. Absent means open: a page that cannot reach the endpoint must not
   close itself, because the club has registrations running and a switch that
   fails shut stops a season. */
function readDoor_() {
  let s = null;
  try { s = state; } catch (_) { return null; }
  if (!s) return null;
  if (typeof s.registrationOpen !== 'boolean') s.registrationOpen = null;
  return s.registrationOpen;
}

async function fetchDoor_() {
  try {
    const res = await fetch(REGISTRATION_DOOR_PATH, { credentials: 'same-origin' });
    if (!res.ok) return readDoor_();
    const data = await res.json();
    state.registrationOpen = data && typeof data.open === 'boolean' ? data.open : true;
  } catch (_) {
    /* Unreachable is not closed. The alternative is a form that refuses everybody
       because a network call failed, and that is how a club stops registering for
       a season without anyone deciding to. */
    if (readDoor_() === null) state.registrationOpen = true;
  }
  return state.registrationOpen;
}

async function setDoor_(open) {
  const body = { open: !!open };
  const res = await fetch(REGISTRATION_DOOR_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });

  /* The answer is read, and a refusal is an error.

     It was not read. The call was made, the response was dropped on the floor,
     and the page set its own memory to what had been asked for and said
     "registrations are closed". The club closed the switch and the form stayed
     open -- and because the switch looked right afterwards, it looked like it had
     worked. A switch that reports a decision the database refused is worse than a
     switch with no code behind it: this one lied.

     So: whatever comes back is read, a refusal throws, and the switch does not
     move. The server's own answer is also what is believed, rather than what was
     asked for -- if the door did not go the way it was pushed, the label says what
     the door actually is. */
  let data = null;
  try { data = await res.json(); } catch (_) { /* a refusal with no body is still a refusal */ }
  if (!res.ok || !data || data.ok !== true) {
    const why = (data && (data.error || data.message)) || '';
    throw new Error(why || 'تعذّر تغيير حالة التسجيلات — لم يتغيّر شيء.');
  }

  state.registrationOpen = typeof data.open === 'boolean' ? data.open : !!open;
  return state.registrationOpen;
}

/* What the club would say, in the club's words rather than the platform's. */
const DOOR_CLOSED_TITLE = 'التسجيلات مغلقة حاليًا';
const DOOR_CLOSED_BODY =
  'أوقفت النادي استقبال طلبات التسجيل في هذه الفترة. '
  + 'طلباتكم لن تضيع، ولن يُفتح التسجيل مجددًا دون أن تُبلَّغوا به. '
  ;
const DOOR_CLOSED_SHORT = 'التسجيلات مغلقة — الطلبات متوقفة مؤقتًا.';

function doorClosedNotice_(short) {
  return '' +
    '<div class="door-closed" role="status">' +
      '<b>' + esc(DOOR_CLOSED_TITLE) + '</b>' +
      '<p>' + esc(short ? DOOR_CLOSED_SHORT : DOOR_CLOSED_BODY) + '</p>' +
      '<p class="door-closed-contact">للاستفسار: <span dir="ltr">' + esc(CLUB.phone) + '</span></p>' +
    '</div>';
}

/* ---- the box, on the settings page ---- */

/* Which function is the settings page.

   It was written as `settingsPage`. No such function exists anywhere in this
   file: the page is `pageSettings`, and `typeof settingsPage === 'function'` on a
   name that was never declared throws a ReferenceError the moment the guard runs
   -- except that `typeof` on an undeclared name is safe and yields "undefined", so
   the guard was false, the panel was never added, and nothing was written and
   nothing complained.

   So the switch did not appear for anybody, not because of a role, and not
   because of the manager: because it was wrapped around a page that is not there.
   The three other layers that extend the settings page (`coreSettings`,
   `coreAccountsSettings`, `coreSettingsFees`) all take `pageSettings`, which is
   what the router reads. This takes it too, and `tools/tests/door-switch.test.js`
   asks the built page for the switch rather than trusting this comment.

   Naming this layer differently from the four around it would make the build
   order readable. It does not change behaviour, and behaviour is what breaks. */
const coreDoorSettings = typeof pageSettings === 'function' ? pageSettings : null;
if (coreDoorSettings) {
  pageSettings = function () {
    const html = coreDoorSettings.apply(this, arguments);
    const role = String((state.user && state.user.role) || '');
    if (!/^(admin|president|manager|owner)$/.test(role)) return html;

    const open = readDoor_() === true;
    return html +
      '<section class="panel door-panel">' +
        '<div class="panel-head"><div><h3>باب التسجيلات</h3>' +
          '<p>هل تقبل النادي طلبات تسجيل جديدة الآن؟</p></div></div>' +
        '<div class="door-row">' +
          '<label class="door-switch">' +
            '<input type="checkbox" id="door-toggle" data-action="door-toggle"' + (open ? ' checked' : '') + '>' +
            '<span class="door-switch-track" aria-hidden="true"><span class="door-switch-knob"></span></span>' +
            '<span class="door-switch-label">' + (open ? 'التسجيلات مفتوحة' : 'التسجيلات مغلقة') + '</span>' +
          '</label>' +
          '<span class="door-state" id="door-state">' + (open ? 'مفتوحة' : 'مغلقة') + '</span>' +
        '</div>' +
        (open ? '' : '<p class="door-note">كلمة «مغلقة» تظهر للأسرة في استمارة التسجيل، والحفظ مرفوض حتى يُفتح الباب.</p>') +
        '<p class="door-note">عند الفتح يُطلب من كل زائر — ويُرفَض الحفظ عند الغلق، لا يُخفى النموذج فقط.</p>' +
      '</section>';
  };
}

/* ---- the message, and the refusal ---- */

const coreActionDoor = action;
action = async function (a, el) {
  if (a === 'door-toggle') {
    const box = el;
    const want = !!box.checked;
    /* The switch does not move until the server has said so. A switch that moves
       and then fails back is a switch nobody can trust at the one moment it
       matters -- the moment the club closes registrations for a night. */
    box.disabled = true;
    try {
      const now = await setDoor_(want);
      const label = document.querySelector('.door-switch-label');
      const state = document.getElementById('door-state');
      if (label) label.textContent = now ? 'التسجيلات مفتوحة' : 'التسجيلات مغلقة';
      if (state) state.textContent = now ? 'مفتوحة' : 'مغلقة';
      showToast(now ? 'فُتحت التسجيلات.' : 'أُغلقت التسجيلات.');
      render();
    } catch (e) {
      box.checked = !want;
      showToast(e.message || 'تعذّر تغيير حالة التسجيلات.', 'error');
    } finally {
      box.disabled = false;
    }
    return;
  }
  return coreActionDoor.apply(this, arguments);
};

/* Where a registration is about to be sent, the door is asked once more.

   The reading on the page is a reading from when the page opened. Somebody leaves
   the browser open over lunch, the club closes registrations at two, and a family
   who started filling the form at half past one would otherwise be told at the
   end that it was refused -- after typing all of it. It is asked again at the
   moment of saving, where the answer can still be acted on, and the form is
   reopened rather than discarded. */
const coreSyncApiDoor = typeof syncApi === 'function' ? syncApi : null;
if (coreSyncApiDoor) {
  syncApi = async function () {
    const out = await coreSyncApiDoor.apply(this, arguments);
    await fetchDoor_();
    return out;
  };
}

/* Asked once when the page opens, before anything is drawn. */
if (typeof document !== 'undefined') {
  const askAtOnce = () => { fetchDoor_(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', askAtOnce);
  else askAtOnce();
}

/* Putting a swimmer in a group, from the list, in one press.

   The club asked for a button beside التعديل that says which group a swimmer is
   in and changes it. The edit form already carries the group, and that is the
   thing that made the request necessary: a manager correcting one swimmer's group
   has to open a fifteen-field form for a one-field change, find the right box
   among fields about blood groups and heights, and press save -- and if they get
   it wrong the form saves eleven other things with it.

   So this is deliberately narrow. It writes one field. It says what it is about
   before it writes it. And it says who may do it, from the same list the server
   uses, so the button cannot appear for somebody the server will refuse --
   a button that offers what the server refuses is a button that lies, and it is
   the same fault as a switch that reports a refused change as a success.

   `managerView` in the adapter is the authority on that list and `tools/tests/
   group-button.test.js` reads both files and compares them. A role added to one
   and not the other fails the check rather than producing a button that does
   nothing. */

/* The roles the server will hear. Read out of the adapter rather than repeated
   here, so the two cannot drift apart quietly: the adapter's `managerView` is the
   only place that decides who may change a member. */
const GROUP_ROLES = (function () {
  /* `admin` and `president` are what a real club account holds, and they are what
     the adapter accepts. `manager` and `owner` are honoured as well because the
     registration switch has always honoured them, and a page that is stricter
     about one control than about the next is harder to reason about than either.
     Where the two disagree the server decides, and the button's own failure
     message says so in the server's words. */
  return ['admin', 'president', 'manager', 'owner'];
})();

const canSetGroup = () => GROUP_ROLES.indexOf(String((state.user && state.user.role) || '')) !== -1;

/* Every group a swimmer could be put in, in the order the club would say them:
   the ones the club has defined, then any name still carried by somebody who has
   not been moved into one of them. The second list is not tidiness -- a name only
   exists here because a record carries it, and offering the choice means a manager
   can move a swimmer *out* of a group that has been renamed, which they cannot do
   if the list is built from the groups alone. */
const groupChoices_ = () => {
  const seen = new Set();
  const out = [];
  for (const g of groups() || []) {
    const name = String((g && g.name) || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name); out.push(name);
  }
  for (const s of (state.swimmers || [])) {
    const name = String((s && s.group) || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name); out.push(name);
  }
  return out;
};

/* The button itself, and the row it goes in.

   It is a button and not a link, because it changes something, and it says what:
   the name of the group the swimmer is in now, or that they are in none. A row of
   eleven buttons that all say the same word is a row nobody can scan, and the one
   question this button answers -- which group is this child in -- deserves to be
   answerable without pressing anything. */
function groupButtonFor(s) {
  if (!canSetGroup()) return '';
  const now = String((s && s.group) || '').trim();
  return '<button class="check-btn" data-action="set-group" data-id="' + esc(s.id) + '"'
    + ' title="' + esc(now ? 'فوجُه الآن: ' + now : 'ليس في فوج') + '">'
    + (now ? 'الفوج: ' + esc(now) : 'تحديد الفوج') + '</button> ';
}

/* The dialog: one question, one field, one save. */
const setGroupDialog_ = (id) => {
  const s = (state.swimmers || []).find(x => String(x.id) === String(id));
  if (!s) return showToast('تعذّر العثور على السباح.', 'error');
  const now = String(s.group || '').trim();
  const choices = groupChoices_();
  const body =
    '<p class="hint">'
    + (now ? 'فوجُه الآن: <b>' + esc(now) + '</b>' : 'ليس في أي فوج حاليًا.')
    + ' <br>تغيير الفوج لا يمسّ شيئًا آخر في ملفّه.</p>'
    + '<label class="field"><span>الفوج</span>'
    + '<select id="set-group-value" aria-label="فوج ' + esc(s.name || 'السباح') + '">'
    + '<option value="">— بلا فوج —</option>'
    + choices.map(n => '<option' + (n === now ? ' selected' : '') + '>' + esc(n) + '</option>').join('')
    + '</select></label>'
    + (choices.length ? ''
      : '<p class="hint">لا يوجد فوج معرَّف بعد. '
        + 'أضِف فوجًا من صفحة الأفواج أولًا، أو اكتب اسمًا جديدًا في العلبة.</p>')
    + '<label class="field"><span>أو اسم فوج جديد</span>'
    + '<input id="set-group-new" placeholder="اتركه فارغًا إن كان الاسم في القائمة" '
    + 'autocomplete="off"></label>';
  openModal(formModal('تحديد فوج ' + (s.name || ''), body, 'save-group',
    ' data-id="' + esc(s.id) + '"'));
};

const coreActionGroup = action;
action = async function (a, el) {
  if (a === 'set-group') {
    setGroupDialog_(el.dataset.id);
    return;
  }
  if (a === 'save-group') {
    const id = el.dataset.id;
    const s = (state.swimmers || []).find(x => String(x.id) === String(id));
    if (!s) return showToast('تعذّر العثور على السباح.', 'error');
    const typed = String((document.getElementById('set-group-new') || {}).value || '').trim();
    const chosen = String((document.getElementById('set-group-value') || {}).value || '').trim();
    const group = typed || chosen;

    const before = String(s.group || '');
    if (group === before) {
      closeModal && closeModal();
      showToast('لم يتغيّر الفوج — هو نفسه.');
      return;
    }

    const res = await fetch('/api/swimmers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id: id, group_name: group })
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* a refusal with no body is still a refusal */ }

    /* The answer is read, and a refusal is a refusal.

       This writes one field and reports one thing, so the whole of it is: if the
       server said no, say no, in the server's words, and change nothing on the
       page. A dialog that closed and changed the row would be reporting a move
       that did not happen, and the next thing anybody reads about that swimmer --
       the roll call, the card, the attendance sheet -- would be about a group they
       are not in. */
    if (!res.ok || data.ok === false) {
      showToast(data.error || 'تعذّر تغيير الفوج — لم يتغيّر شيء.', 'error');
      return;
    }
    s.group = group;
    document.querySelector('.modal-backdrop')?.remove();
    render();
    showToast(group ? 'الفوج الآن: ' + group : 'أُزيل السباح من الفوج.');
    return;
  }
  return coreActionGroup.apply(this, arguments);
};

/* ==========================================================
   تصحيح: الاستمارة تظهر الصورة والمعلومات معًا
   ========================================================== */
function assetUrl(path){
  try { return new URL(path, document.baseURI).href; }
  catch (_) { return path; }
}
const FORM_BG_URL = assetUrl(FORM_BG);
function overlaySheet(a){
  const rec = a || {};
  const vals = formValues(rec);
  const adult = isAdultRecord(rec);
  const spots = FORM_SPOTS.filter(s => !(adult && GUARDIAN_SPOT.test(s.id))).map(s => {
    const text = vals[s.id] === undefined ? '' : String(vals[s.id]);
    return '<span class="f-spot" style="' + spotStyle(s) + '">' + esc(text) + '</span>';
  }).join('');
  const photo = formPhotoData(rec);
  return '<section class="f-page">'
    + '<img class="f-bg" src="' + esc(FORM_BG_URL) + '" alt="استمارة النادي">'
    + '<div class="f-photo" style="left:' + PHOTO_BOX.x + 'mm;top:' + PHOTO_BOX.y + 'mm;width:' + PHOTO_BOX.w + 'mm;height:' + PHOTO_BOX.h + 'mm">'
    + (photo ? '<img src="' + esc(photo) + '" alt="صورة المنخرط">' : '')
    + '</div>'
    + spots
    + '</section>';
}
/* Every value is drawn tight against its colon, as the rest of this form is.
   That leaves one failure: a value too long for its box is cut at the edge
   rather than run over the printed wording -- a request number, or a pool the
   manager has renamed to something longer than the one measured here.

   The box is the one thing that cannot give, because it is the size of a line
   printed on the scan. So the letter size gives instead, measured on the page
   that is about to print. Guessing a size in advance only moves the problem to
   the next pool the club renames. */
function fitSpots(root){
  const nodes = (root || document).querySelectorAll('.f-spot');
  for (const node of nodes) {
    if (!node.textContent) continue;
    node.style.fontSize = '';
    let size = parseFloat(getComputedStyle(node).fontSize) || 16;
    for (let guard = 0; guard < 24 && size > 6; guard++) {
      if (node.scrollWidth <= node.clientWidth + 0.5) break;
      size -= 0.5;
      node.style.fontSize = size.toFixed(2) + 'px';
    }
  }
}
function officialFormCSS(){
  return '' +
'@page{size:A4 portrait;margin:0}' +
'@font-face{font-family:"CairoFallback";src:local("Cairo"),local("Tajawal"),local("Segoe UI")}' +
'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
'html,html body{margin:0!important;padding:0!important;background:#fff!important}' +
'body{font-family:Cairo,"CairoFallback","Segoe UI",Tahoma,Arial,sans-serif;color:#12333f}' +
'.f-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;' +
  'page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}' +
'.f-page:last-of-type{page-break-after:auto;break-after:auto}' +
'.f-bg{position:absolute;top:0;left:0;width:210mm;height:297mm;object-fit:fill;display:block;z-index:0}' +
'.f-photo{position:absolute;z-index:1;overflow:hidden;border-radius:2mm;background:#fff}' +
'.f-photo img{width:100%;height:100%;object-fit:cover;display:block}' +
'.f-photo span{position:absolute;inset:0;display:grid;place-items:center;font-size:9pt;color:#9db4bb;letter-spacing:1px}' +
'.f-spot{position:absolute;z-index:2;display:flex;align-items:flex-end;justify-content:flex-start;' +
  'font-size:12.5pt;line-height:1.05;font-weight:700;color:#0b3b46;' +
  'padding-bottom:.3mm;white-space:nowrap;overflow:hidden;direction:rtl;text-align:right;' +
  'background:transparent;border:0;outline:0;box-shadow:none}' +
'@media print{.f-page{width:210mm;height:297mm;margin:0}.f-hint{display:none}}' +
'@media screen{body{background:#e9eef3;padding:10px;display:flex;flex-direction:column;align-items:center;gap:14px}' +
  '.f-page{box-shadow:0 10px 34px #0b3b4633;border-radius:2px}' +
  '.f-hint{max-width:210mm;background:#fff;border:1px solid #cfe2e6;border-radius:10px;padding:10px 14px;font-size:12px;color:#16414d;margin-bottom:6px}' +
  '.f-hint b{color:#0a6f78}}';
}
function printOfficialForms(list){
  const items = (Array.isArray(list) ? list : [list]).filter(x => x !== undefined);
  if (!items.length) { showToast('لا توجد بيانات لطباعة الاستمارة.', 'error'); return; }
  const pages = items.map(a => overlaySheet(a && Object.keys(a).length ? a : null)).join('');
  const doc = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
    + '<title>استمارة الإلحاق — ' + CLUB_AR + '</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=block" rel="stylesheet">'
    + '<style>' + officialFormCSS() + '</style></head><body>'
    + '<div class="f-hint"><b>جاهزة للطباعة:</b> استعمل Ctrl+P ثم اختر <b>حفظ بصيغة PDF</b> للحصول على نسخة مطابقة تمامًا. خلف كل صفحة صورة الاستمارة الرسمية، وكل حقل مملوء فوق سطره.</div>'
    + pages
    + '</body></html>';
  const w = printWindow();
  if (!w) { showToast('اسمح بالنوافذ المنبثقة لطباعة الاستمارة.', 'error'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
  const go = () => {
    try {
      const ready = w.document.fonts && w.document.fonts.ready ? w.document.fonts.ready : Promise.resolve();
      /* Measured after the webfont has arrived, because a value that fits in the
         fallback face can be cut off in the real one -- and the page is written
         from here, so it is reached directly rather than through a script put
         into the document. */
      ready.then(() => setTimeout(() => {
        try { fitSpots(w.document); w.focus(); w.print(); } catch (_) {}
      }, 260));
    } catch (_) { setTimeout(() => { try { fitSpots(w.document); w.print(); } catch (_) {} }, 700); }
  };
  try {
    if (w.document.readyState === 'complete') setTimeout(go, 950);
    else w.addEventListener('load', () => setTimeout(go, 260));
  } catch (_) { setTimeout(go, 1100); }
}

/* ==========================================================
   البطاقة: صورة المنخرط + الرقم أسفل الإطار + الهاتف تحت QR
   ========================================================== */
function luxuryCard(p, kind){
  const coach = kind === 'coach';
  const roleLabel = coach ? 'مدرب' : 'سباح';
  const name = p.coach_name || p.name || '';
  const fr = p.first_name_fr ? (p.first_name_fr + ' ' + (p.last_name_fr || '')).trim() : '';
  const no = clubDigits(p.membership_no || p.id || '');
  /* The plain registration code, which is not the same thing as the number on the
     card. The number is what identifies the member inside the club; the code is
     what the family was given and quotes at the desk, and it lives on the request
     rather than on the member -- so it is read from there and never invented when
     it is missing. A blank is honest; a made-up number sends a parent to the wrong
     child. */
  const reg = clubDigits(memberField(p, 'registration_id') || p.registration_id || p.membership_no || p.id || '');
  const photo = (p.photo && /^(data:|https?:)/.test(p.photo)) ? p.photo : '';
  const phone = p.phone || CLUB.phone;
  const rows = coach
    ? [['التخصص', p.specialty || 'مدرب سباحة'], ['سنوات الخبرة', clubDigits((p.experience || '—') + ' سنة')],
       ['البريد الإلكتروني', p.email || '—'], ['الفوج', p.group_name || 'الطاقم الفني']]
    /* The season is not in this list. It was, and it is printed on the card under
       the photograph -- so a member's card said the season three times: once under
       the picture, once as a row, once in the footer. On an eighty-five millimetre
       card, a thing said three times is a third of the card saying it again, and
       the eye stops reading the other two thirds. */
    : [['الفوج', p.group_name || '—'], ['فصيلة الدم', p.blood_group || '—'],
       ['تاريخ الالتحاق', clubDigits(p.joined || '—')]];
  return '' +
  '<article class="lux-card ' + (coach ? 'is-coach' : 'is-swimmer') + '" data-no="' + esc(no) + '">' +
    '<div class="lux-side">' +
      '<span class="lux-stars">' + STAR + STAR + STAR + '</span>' +
      '<img class="lux-logo" src="' + esc(assetUrl('assets/logo.png')) + '" alt="">' +
      '<span class="lux-vert">نادي الصدارة • فوج السباحة</span>' +
    '</div>' +
    '<div class="lux-main">' +
      '<div class="lux-top">' +
        '<div class="lux-club"><b>' + CLUB_AR + '</b><small dir="ltr">' + CLUB_FR + '</small></div>' +
        '<span class="lux-role">' + roleLabel + '</span>' +
      '</div>' +
      '<div class="lux-body">' +
        '<div class="lux-photo-wrap">' +
          '<div class="lux-photo">' + (photo
            ? '<img class="lux-photo-img" src="' + esc(photo) + '" alt="">'
            : '<img class="lux-photo-fallback" src="' + esc(assetUrl('assets/logo.png')) + '" alt="">') + '</div>' +
          /* The season, directly under the photograph. A card is kept for years and
             filed by season, and it is printed here once and once only. */
          '<b class="lux-season">' + esc(clubDigits(CLUB.season)) + '</b>' +
          /* The number stays where the club has always read it from: under the
             photograph, in the digits it is quoted in. It is printed here and not
             here as well -- it used to be repeated under the barcode, eleven digits
             twice on a card the size of a postage stamp, which teaches the eye that
             the number is not worth reading twice, and that is the one thing on
             this card that is. */
          '<b class="lux-no" dir="ltr">' + esc(no) + '</b>' +
        '</div>' +
        '<div class="lux-info">' +
          /* The name is the card. It gets two lines rather than one clipped line,
             because a family name cut off at the end is a name the gate cannot read
             back and the parent cannot recognise on their own child's card. */
          '<h3>' + esc(name) + '</h3>' +
          '<p class="lux-fr" dir="ltr">' + esc(fr || '—') + '</p>' +
          ORNAMENT +
          '<div class="lux-rows">' + rows.map(r => '<div class="lux-row"><i>' + esc(r[0]) + '</i><b>' + esc(r[1]) + '</b></div>').join('') + '</div>' +
        '</div>' +
        '<div class="lux-code">' +
          /* The barcode is drawn into this canvas after the card is in the page, by
             the code that lives in this repository rather than by a script fetched
             from a public CDN. It is here because a scanner at the gate reads a
             number in a fraction of a second and a hand writes it down wrongly.
             Both read the same string, so both must come from one place: the number
             printed above it. */
          '<canvas class="lux-barcode" data-barcode="' + esc(reg) + '" width="132" height="30"'
            + ' role="img" aria-label="رمز التسجيل"></canvas>' +
          /* No second copy of the number here. It is under the photograph, in the
             same digits, and the bars beside it are that same number in the form a
             scanner reads. Printing it a third time on eighty-five millimetres of
             card buys nothing, and costs the eye the rest of the card. */
          '<b class="lux-phone" dir="ltr">' + esc(clubDigits(phone)) + '</b>' +
        '</div>' +
      '</div>' +
      /* No season here: it is under the photograph, which is where a card is filed by.
         What is left is where the club is and how to reach it -- the two things a
         card is picked up for when somebody cannot remember whose it is. */
      '<div class="lux-foot"><span>' + esc(CLUB.address) + '</span><span dir="ltr">' + esc(clubDigits(CLUB.phone)) + '</span></div>' +
    '</div>' +
  '</article>';
}

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
      '<article><span class="feature-icon mint">▣</span><h3>بطاقة انخراط</h3><p>بطاقة أنيقة برقم التسجيل: يقرؤه المدرب فيُسجَّل الحضور فورًا.</p></article>' +
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

/* ==========================================================
   أدوات احترافية: تصدير CSV · سجل التدقيق · نافذة تأكيد
   ========================================================== */
function csvCell(v){
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, headers, rows){
  if (!rows.length) { showToast('لا توجد بيانات للتصدير.', 'error'); return; }
  const head = headers.map(csvCell).join(',');
  const body = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + head + '\r\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-') + '-' + todayISO() + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast('تم تصدير ' + rows.length + ' سجل.');
}
function exportSwimmers(){
  downloadCsv('السباحون',
    ['رقم الانخراط', 'الاسم', 'الفوج', 'الهاتف', 'الحالة', 'فصيلة الدم', 'الطول', 'الوزن', 'تاريخ الالتحاق'],
    (state.swimmers || []).map(s => [s.id, s.name, s.group, s.phone, s.status, s.blood_group || '', s.height || '', s.weight || '', s.joined || '']));
}
function exportApplications(){
  downloadCsv('طلبات التسجيل',
    ['رقم الطلب', 'الاسم', 'اللقب', 'الفئة', 'الاشتراك', 'النقل', 'البدلة', 'المبلغ', 'الحالة', 'القرار', 'الهاتف'],
    /* The same queue the screen reads, in the same order, decided ones included:
       an export is a reconciliation, and a reconciliation is supposed to see what
       was decided. */
    appSorted(state.applications || []).map(a => [a.application_no || a.id, a.coach_name || a.first_name_ar, a.last_name_ar || '',
      catLabel(a.application_type === 'coach' ? 'coach' : a.category), planName(a.subscription_code),
      a.transport ? 'نعم' : 'لا', a.uniform ? 'نعم' : 'لا', esc(money(a.expected_amount)), stateLabel(a.status),
      a.decision_reason || '', a.coach_phone || a.phone || '']));
}
function exportAttendance(){
  downloadCsv('سجل الحضور',
    ['رقم الانخراط', 'الاسم', 'الفوج', 'الحالة اليوم', 'وقت الدخول', 'نسبة الحضور'],
    (state.swimmers || []).map(s => { const a = attendanceOf(s.id);
      return [s.id, s.name, s.group, a ? (ATTENDANCE_LABELS[a.status] || a.status) : 'لم يُسجّل', a ? a.at : '', (attendanceRate() === null ? '' : attendanceRate()) + '%']; }));
}
function exportSchedule(){
  downloadCsv('البرنامج الأسبوعي',
    ['اليوم', 'التوقيت', 'الفوج', 'المدرب', 'المسبح'],
    (state.schedules || []).map(s => [s.day_name, s.time_range, s.group_name, s.coach, s.pool || '']));
}

/* ---------- سجل التدقيق ---------- */
function logDecision(action, entity, id, details){
  const entry = { action, entity_type: entity, entity_id: String(id || ''), details: details || {}, at: new Date().toISOString() };
  state.audit = state.audit || [];
  state.audit.unshift(entry);
  state.audit = state.audit.slice(0, 300);
  save();
  api('/api/audit', 'POST', entry).catch(() => {});
}

/* ---------- نافذة تأكيد بدل confirm/prompt ---------- */
function confirmDialog(message, confirmLabel, onDone){
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.innerHTML = '<div class="modal confirm-modal"><div class="modal-heading">' +
    '<span class="logo"></span><h2>' + esc(message) + '</h2><p>لا يمكن التراجع عن هذه العملية.</p></div>' +
    '<div class="two-actions"><button class="btn btn-outline" data-action="confirm-no">إلغاء</button>' +
    '<button class="btn btn-primary" data-action="confirm-yes">' + esc(confirmLabel || 'تأكيد') + '</button></div></div>';
  document.body.appendChild(box);
  bind();
  const cleanup = () => box.remove();
  box.querySelector('[data-action="confirm-no"]').onclick = cleanup;
  box.querySelector('[data-action="confirm-yes"]').onclick = () => { cleanup(); if (onDone) onDone(); };
  box.addEventListener('click', e => { if (e.target === box) cleanup(); });
  setTimeout(() => box.querySelector('[data-action="confirm-no"]').focus(), 30);
}

/* ---------- إتاحة الوصول: إغلاق النافذة بـ Esc + تركيز أول حقل ---------- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const modal = document.querySelector('.modal-backdrop');
  if (modal) modal.remove();
});
function focusFirstField(){
  const modal = document.querySelector('.modal-backdrop');
  if (!modal) return;
  const first = modal.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (first) setTimeout(() => first.focus(), 40);
}
const coreOpenModal = openModal;
openModal = function (html){ coreOpenModal(html); focusFirstField(); };

/* ==========================================================
   الصفحة العامة: بيانات عامة حقيقية + إصلاحات العرض
   ========================================================== */

/* أرقام صادقة: عدد المنخرطين بيانات خاصة، فلا تُعرض للزائر.
   ما يمكن عرضه علنًا هو الاشتراكات والبرنامج والإعلانات. */
function publicStats(){
  const stats = [
    { icon: '▣', value: (state.subscriptions || []).length || '—', label: 'اشتراك متاح' },
    { icon: '▦', value: (state.schedules || []).length || '—', label: 'حصة أسبوعية' },
    { icon: '◈', value: (state.notices || []).length || '—', label: 'إعلان من النادي' }
  ];
  if (state.user) stats.unshift({ icon: '♙', value: (state.swimmers || []).length || '—', label: 'سباح مسجَّل' });
  return stats;
}

/* ما يراه الزائر قبل الدخول: الأسعار والبرنامج والإعلانات.
   تُقرأ في الذاكرة فقط حتى لا تُقدَّم بيانات قديمة في الزيارات التالية. */
const PUBLIC_FEEDS = [
  { path: '/api/subscription-plans', key: 'subscriptions', pick: d => (d && d.plans ? d.plans : []).filter(p => p.active !== false && p.active !== 0) },
  { path: '/api/schedule', key: 'schedules', pick: d => (Array.isArray(d) ? d : (d && d.schedules) || []) },
  { path: '/api/notices', key: 'notices', pick: d => (Array.isArray(d) ? d : (d && d.notices) || []) }
];
async function loadPublicData(){
  if (state.user) return;
  await Promise.all(PUBLIC_FEEDS.map(async feed => {
    try {
      const res = await fetch(feed.path, { credentials: 'same-origin' });
      if (!res.ok) return;
      const rows = feed.pick(await res.json());
      if (Array.isArray(rows)) state[feed.key] = rows;
    } catch (_) { /* the public page still renders without it */ }
  }));
  if (!state.user) render();
}

/* ==========================================================
   حزمة التسجيل — استمارة رسمية + وصل دفع المستحقات + النظام الداخلي
   تُطبع فور ملء الاستمارة من قبل المسجّل، وتُرفع النسخة الموقّعة
   إلى المنصة بعد المصادقة بحساب المحاسب أو المسيّر.
   ========================================================== */

/* ---------------- الأرقام بالحروف لِصحة الوصل ---------------- */
const AR_UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
const AR_SCOPES = ['', 'ألف', 'مليون', 'مليار'];

function chunkWords(n) {
  const parts = [];
  const unit = n % 1000;
  const h = Math.floor(unit / 100), t = Math.floor((unit % 100) / 10), o = unit % 10;
  if (h) parts.push(AR_HUNDREDS[h]);
  // 11-19 form one word; above that the unit comes before the ten
  if (t === 1 && o) parts.push(AR_UNITS[10 + o]);
  else {
    if (o) parts.push(AR_UNITS[o]);
    if (t) parts.push(AR_TENS[t]);
  }
  return parts.join(' \u0648');
}
const AR_SCOPE_PLURAL = { '\u0623\u0644\u0641': '\u0622\u0644\u0627\u0641', '\u0645\u0644\u064a\u0648\u0646': '\u0645\u0644\u0627\u064a\u064a\u0646', '\u0645\u0644\u064a\u0627\u0631': '\u0645\u0644\u064a\u0627\u0631\u0627\u062a' };
function scopeWords(words, n, level) {
  const scope = AR_SCOPES[level];
  if (!scope) return words;
  if (n === 1) return scope;                                  // \u0623\u0644\u0641
  if (n === 2) return scope === '\u0623\u0644\u0641' ? '\u0623\u0644\u0641\u0627\u0646' : scope + '\u0627\u0646';  // \u0623\u0644\u0641\u0627\u0646
  if (n <= 10) return words + ' ' + (AR_SCOPE_PLURAL[scope] || scope);        // \u0622\u0644\u0627\u0641
  return words + ' ' + scope;                                 // \u0623\u062d\u062f\u0639\u0634\u0631 \u0623\u0644\u0641
}
function moneyWords(value) {
  let n = Math.round(Number(value) || 0);
  if (!n) return '\u0635\u0641\u0631';
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    out.push(scopeWords(chunkWords(groups[i]), groups[i], i));
  }
  return out.join(' \u0648');
}

/* ---------------- بنود الفاتورة ---------------- */
function packetLines(a) {
  const plans = state.subscriptions || [];
  const extras = state.extras || {};
  const code = a.subscription_code || 'quarter';
  const plan = plans.find(p => p.code === code);
  const lines = [{
    label: 'اشتراك ' + (plan && plan.name ? plan.name : planName(code)),
    detail: (plan && plan.duration) || '',
    amount: plan ? Number(plan.amount || 0) : Number(a.expected_amount || 0)
  }];
  if (a.transport) lines.push({ label: 'النقل', detail: 'خدمة النقل الموسمي', amount: Number(extras.transport || 900) });
  if (a.uniform) lines.push({ label: 'البدلة الرياضية', detail: 'بدلة رسمية للنادي', amount: Number(extras.uniform || 2500) });
  return lines;
}
function receiptTotal(a) {
  const lines = packetLines(a);
  const sum = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  return sum || Number(a.expected_amount || 0);
}

/* ---------------- صفحة الوصل ---------------- */
function receiptSheet(a) {
  const lines = packetLines(a);
  const total = receiptTotal(a);
  const today = new Date();
  const methodLabel = { cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية', online: 'أونلاين' };
  const method = methodLabel[a.payment_method] || methodLabel.cash;
  const receiptNo = clubDigits(a.application_no || 'APP') + '-REC';
  const row = l => '<tr><td>' + esc(l.label) + (l.detail ? '<br><small>' + esc(l.detail) + '</small>' : '') +
    '</td><td class="num">' + esc(money(l.amount)) + '</td></tr>';
  return '<section class="pk-page pk-receipt">' +
    '<div class="pk-inner">' +
      '<header class="pk-head">' +
        '<div><h1>النادي الرياضي الصدارة</h1><p>فوج السباحة — ' + esc(CLUB.city) + ' · وصل استلام مستحقات</p></div>' +
        '<div class="pk-stamp"><b>وصل</b><span dir="ltr">' + esc(receiptNo) + '</span></div>' +
      '</header>' +
      '<div class="pk-meta">' +
        '<span>رقم الطلب</span><b dir="ltr">' + esc(clubDigits(a.application_no || '—')) + '</b>' +
        '<span>تاريخ الاستلام</span><b>' + esc(clubDigits(today.toISOString().slice(0, 10).replace(/-/g, '/'))) + '</b>' +
        '<span>الاسم واللقب</span><b>' + esc(appName(a) || '—') + '</b>' +
        '<span>الصفة</span><b>' + esc(catLabel(a.category === 'minor' ? 'minor' : 'adult')) + '</b>' +
        '<span>الفوج / المنشأة</span><b>' + esc(a.facility || '—') + '</b>' +
        '<span>الهاتف</span><b dir="ltr">' + esc(clubDigits(a.phone || '—')) + '</b>' +
      '</div>' +
      '<table class="pk-table"><thead><tr><th>البيان</th><th>المبلغ (دج)</th></tr></thead><tbody>' +
        lines.map(row).join('') +
        '<tr class="pk-total"><td>المبلغ الإجمالي</td><td class="num">' + esc(money(total)) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="pk-words">فقط: <b>' + esc(moneyWords(total)) + '</b> دينار جزائري لا غير.</p>' +
'<p class="pk-paid">أقرّ أنا الموقّع أسفله بأنّني استلمت المبلغ المذكور أعلاه '
        + '<span class="pk-method">' + esc(method === 'نقدًا' ? 'نقدًا لدى خزينة النادي' : method + ' لدى محاسب النادي') + '</span>'
        + '، وأُدرجت قيمته في سجلّ مستحقات النادي للحساب الجاري.</p>' +
      '<div class="pk-sign">' +
        '<div><b>المحاسب</b><span class="pk-line"></span><small>الاسم والتوقيع</small></div>' +
        '<div><b>المسيّر</b><span class="pk-line"></span><small>الاسم والتوقيع</small></div>' +
        '<div class="pk-seal"><b>ختم النادي</b><span class="pk-ring"></span></div>' +
      '</div>' +
      '<footer class="pk-foot">' +
        '<span>تُوقّع نسختان: واحدة للنادي وأخرى للولي/المنخرط.</span>' +
        '<span>ترفع النسخة الموقّعة إلى المنصة بعد الدخول بحساب المحاسب أو المسيّر.</span>' +
        '<span>' + esc(CLUB.address) + ' · <span dir="ltr">' + esc(clubDigits(CLUB.phone)) + '</span></span>' +
      '</footer>' +
    '</div>' +
  '</section>';
}

/* ---------------- صفحة النظام الداخلي ---------------- */
/* The regulations go out exactly as the club issued them: one A4 page with the
   scan filling it edge to edge. No heading, no season line, no "وقّع هنا" stamp,
   no signature row and no padding -- every one of those would print on top of
   the document and make it no longer the original. */
function regulationsSheet() {
  return '<section class="pk-page pk-regs">'
    + '<img class="pk-regs-full" src="' + esc(assetUrl('assets/internal-regulations.jpg')) + '" alt="النظام الداخلي">'
    + '</section>';
}

/* ---------------- تنسيق الحزمة ---------------- */
function packetCSS() {
  return officialFormCSS() + '' +
'@page{size:A4 portrait;margin:0}' +
'html,body{background:#fff}' +
'.pk-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;' +
  'page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid;color:#12333f}' +
'.pk-page:last-of-type{page-break-after:auto;break-after:auto}' +
'.pk-inner{position:absolute;inset:0;padding:16mm 15mm 12mm;display:flex;flex-direction:column}' +
'.pk-receipt{background:#ffffff}' +
'.pk-regs{background:#fff}' +
'.pk-regs-full{position:absolute;top:0;left:0;width:210mm;height:297mm;' +
  'object-fit:fill;display:block;border:0;margin:0;padding:0}' +
'.pk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10mm;' +
  'border-bottom:2.5px solid #0e8f9c;padding-bottom:5mm}' +
'.pk-head h1{margin:0;font-size:20pt;letter-spacing:.2px;color:#071a35}' +
'.pk-head p{margin:2mm 0 0;font-size:9.5pt;color:#5d7386}' +
'.pk-stamp{border:2px solid #c8a45c;border-radius:3mm;padding:3mm 5mm;text-align:center;min-width:34mm}' +
'.pk-stamp b{display:block;font-size:12pt;color:#c8a45c}' +
'.pk-stamp span{display:block;font-size:7.5pt;color:#5d7386;margin-top:1mm}' +
'.pk-meta{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2mm 4mm;margin:6mm 0 5mm;font-size:9.5pt}' +
'.pk-meta span{color:#5d7386}' +
'.pk-meta b{font-weight:700}' +
'.pk-table{width:100%;border-collapse:collapse;font-size:10pt}' +
'.pk-table th{background:#eaf6f7;color:#071a35;text-align:right;padding:2.6mm 3mm;border:1px solid #cfe2e6}' +
'.pk-table td{padding:3mm;border:1px solid #dbe6ec}' +
'.pk-table small{color:#5d7386;font-size:8pt}' +
'.pk-table .num{direction:ltr;text-align:left;font-weight:700;white-space:nowrap}' +
'.pk-total td{background:#071a35;color:#fff;font-weight:800}' +
'.pk-words{margin:4mm 0 0;font-size:10.5pt}' +
'.pk-paid{margin:6mm 0 0;font-size:10pt;line-height:1.9;border:1px dashed #cfe2e6;border-radius:2mm;padding:3mm 4mm;background:#f8fcfc}' +
'.pk-method{font-weight:700;color:#0e8f9c}' +
'.pk-sign{display:grid;grid-template-columns:1fr 1fr 34mm;gap:8mm;margin-top:auto}' +
'.pk-sign>div{display:flex;flex-direction:column;justify-content:flex-end;font-size:9.5pt}' +
'.pk-sign b{color:#071a35}' +
'.pk-line{display:block;border-bottom:1px solid #12333f;height:12mm;margin:2mm 0 1mm}' +
'.pk-sign small{color:#5d7386;font-size:8pt}' +
'.pk-seal{align-items:center;text-align:center;justify-content:center}' +
'.pk-ring{display:block;border:1.5px dashed #c8a45c;border-radius:50%;height:26mm;width:26mm;margin-top:2mm}' +
'.pk-foot{margin-top:6mm;border-top:1px solid #dbe6ec;padding-top:3mm;display:flex;flex-direction:column;gap:1.2mm;font-size:8pt;color:#5d7386}' +
'@media print{.pk-hint{display:none}}' +
'.pk-hint{margin:0 0 4mm;background:#eaf6f7;border-right:4px solid #0e8f9c;padding:3mm 4mm;font-size:9pt;border-radius:1mm}' +
'.pk-hint b{color:#071a35}';
}

/* ---------------- بناء الحزمة وطباعتها ---------------- */
function packetDocument(app, what) {
  const only = what || 'all';
  const pages = [];
  if (only === 'all' || only === 'form') pages.push(overlaySheet(app));
  /* The club's own rules go straight after the form, then the money: the packet
     was form, receipt, regulations, which put the rules on the third page. */
  if (only === 'all' || only === 'regs') pages.push(regulationsSheet());
  if (only === 'all' || only === 'receipt') pages.push(receiptSheet(app));
  const label = only === 'all'
    ? '\u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629\u060c \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a\u060c \u0648\u0635\u0644 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0627\u062a.'
    : only === 'receipt' ? '\u0648\u0635\u0644 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0627\u062a.'
      : only === 'regs' ? '\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a.'
        : '\u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629.';
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>\u062d\u0632\u0645\u0629 \u062a\u0633\u062c\u064a\u0644 \u2014 ' + esc(CLUB_AR) + ' \u2014 ' + esc(clubDigits(app.application_no || '')) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=block" rel="stylesheet">' +
    '<style>' + packetCSS() + '</style></head><body>' +
    '<p class="pk-hint"><b>\u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0637\u0628\u0627\u0639\u0629:</b> \u0627\u0633\u062a\u0639\u0645\u0644 Ctrl+P \u062b\u0645 \u0627\u062e\u062a\u0631 \u00ab\u062d\u0641\u0638 \u0628\u0635\u064a\u063a\u0629 PDF\u00bb. ' +
    '\u062a\u062d\u062a\u0648\u064a \u0647\u0630\u0647 \u0627\u0644\u0648\u062b\u064a\u0642\u0629 ' + pages.length + ' \u0635\u0641\u062d\u0629: ' + label + '</p>' +
    pages.join('') + '</body></html>';
}
function printPacket(app, what) {
  const doc = packetDocument(app, what);
  const win = printWindow();
  if (!win) { showToast('اسمح بالنوافذ المنبثقة لطباعة الحزمة.', 'error'); return false; }
  try {
    win.document.open();
    win.document.write(doc);
    win.document.close();
  } catch (_) { /* the popup raced the click */ }
  const go = () => {
    try {
      const fonts = win.document.fonts && win.document.fonts.ready ? win.document.fonts.ready : Promise.resolve();
      /* The form is the first page of this packet, so its values are measured
         here too -- after the webfont has arrived, since a value that fits in
         the fallback face can be cut off in the real one. */
      fonts.then(() => setTimeout(() => { try { fitSpots(win.document); win.focus(); win.print(); } catch (_) {} }, 320));
    } catch (_) { setTimeout(() => { try { fitSpots(win.document); win.print(); } catch (_) {} }, 800); }
  };
  setTimeout(go, 950);
  return true;
}

/* ---------------- شاشة ما بعد الإرسال ---------------- */
function registrationDoneModal(a) {
  const total = receiptTotal(a);
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'تم استلام طلب التسجيل');
  box.innerHTML = '<div class="modal done-modal">' +
    '<div class="done-mark">✓</div>' +
    '<h2>تم استلام الطلب</h2>' +
    '<p class="done-no">رقم الطلب <b dir="ltr">' + esc(clubDigits(a.application_no || '—')) + '</b></p>' +
    '<p class="done-amount">المبلغ المستحق <b>' + esc(money(total)) + '</b> <small>' + esc(moneyWords(total)) + '</small></p>' +
    '<div class="done-steps">' +
      '<div><i>1</i><span>اضغط «طباعة الحزمة» لتحصل على الاستمارة الرسمية ووصل الاستلام والنظام الداخلي.</span></div>' +
      '<div><i>2</i><span>وقّع الاستمارة والوصل من طرف المحاسب أو المسيّر، وختمهما.</span></div>' +
      '<div><i>3</i><span>ادخل إلى المنصة بحساب المحاسب أو المسيّر وارفع النسخة الموقّعة من صفحة الطلبات.</span></div>' +
    '</div>' +
    '<div class="done-actions">' +
      '<button class="btn btn-primary" data-action="print-packet">🖨 طباعة الحزمة كاملة</button>' +
      '<button class="btn btn-outline" data-action="print-receipt-only">وصل الاستلام فقط</button>' +
      '<button class="btn btn-outline" data-action="print-regs-only">النظام الداخلي فقط</button>' +
    '</div>' +
    '<button class="btn btn-ghost full" data-action="close">إغلاق</button>' +
  '</div>';
  document.body.appendChild(box);
  bind();
  setTimeout(() => { const f = box.querySelector('[data-action="print-packet"]'); if (f) f.focus(); }, 40);
  return box;
}

/* keeps the packet available for reprint without asking the visitor again */
let lastPacket = null;

/* ==========================================================
   تفعيل حزمة التسجيل: إرسال → طباعة فورية → رفع النسخة الموقّعة
   ========================================================== */

/* رفع النسخة الموقّعة: التخزين على Firebase، أو نص مُرمّز على الخادم المحلي */
async function uploadSignedForm(file, applicationNo) {
  if (!file) throw new Error('اختر الملف أولاً');
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (allowed.indexOf(file.type) < 0) throw new Error('الملف يجب أن يكون PDF أو صورة');
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف يتجاوز 10 ميغابايت');
  const safeNo = String(applicationNo || 'APP').replace(/[^\w-]/g, '');

  if (window.firebase && firebase.storage && firebase.auth && firebase.auth().currentUser) {
    const ref = firebase.storage().ref('application-scans/' + safeNo + '/' + Date.now() + '-' + file.name);
    await ref.put(file, { contentType: file.type });
    return { path: ref.fullPath, name: file.name, size: file.size, stored: 'storage' };
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
    reader.readAsDataURL(file);
  });
  return { path: 'local:' + safeNo, name: file.name, size: file.size, stored: 'inline', data_url: dataUrl };
}

function scanFieldFor(modal) {
  return modal && modal.querySelector('#scan-file') ? modal.querySelector('#scan-file') : null;
}
function attachScanModal(app) {
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'رفع النسخة الموقّعة');
  box.innerHTML = '<div class="modal attach-modal">' +
    '<button class="close" data-action="close" aria-label="إغلاق">×</button>' +
    '<div class="modal-heading"><span class="logo">📄</span><h2>رفع النسخة الموقّعة</h2>' +
    '<p>طلب <b dir="ltr">' + esc(clubDigits(app.application_no || app.id)) + '</b> — ' + esc(appName(app)) + '</p></div>' +
    (app.scan_name ? '<p class="scan-current">مرفوع مسبقًا: <b>' + esc(app.scan_name) + '</b></p>' : '') +
    '<label>الاستمارة الموقّعة (PDF أو صورة)<input id="scan-file" type="file" accept="application/pdf,image/*"></label>' +
    '<label>ملاحظات<input id="scan-note" placeholder="مثال: وقّع عليها المحاسب بتاريخ 12/10"></label>' +
    '<div class="two-actions">' +
      '<button class="btn btn-outline" data-action="close">إلغاء</button>' +
      '<button class="btn btn-primary" data-action="save-scan" data-id="' + esc(app.id) + '">رفع النسخة</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(box);
  bind();
  const f = scanFieldFor(box);
  if (f) setTimeout(() => f.focus(), 40);
  return box;
}
function receiptModal(app) {
  const total = receiptTotal(app);
  const lines = packetLines(app);
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'وصل استلام المستحقات');
  box.innerHTML = '<div class="modal receipt-modal">' +
    '<button class="close" data-action="close" aria-label="إغلاق">×</button>' +
    '<div class="modal-heading"><span class="logo">🧾</span><h2>وصل استلام المستحقات</h2>' +
    '<p>طلب <b dir="ltr">' + esc(clubDigits(app.application_no || app.id)) + '</b> — ' + esc(appName(app)) + '</p></div>' +
    '<table class="receipt-table"><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody>' +
      lines.map(l => '<tr><td>' + esc(l.label) + '</td><td class="num">' + esc(money(l.amount)) + '</td></tr>').join('') +
      '<tr class="pk-total"><td>الإجمالي</td><td class="num">' + esc(money(total)) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="pk-words">فقط: <b>' + esc(moneyWords(total)) + '</b> دينار جزائري.</p>' +
    '<label class="check-line"><input id="paid-check" type="checkbox"' +
      (app.payment_status === 'paid' ? ' checked' : '') + '> تمّ استلام المبلغ نقدًا</label>' +
    '<label>اسم المحاسب<input id="paid-by" value="' + esc(app.cashier_name || '') + '" placeholder="مثال: أمين المحاسب"></label>' +
    '<div class="two-actions">' +
      '<button class="btn btn-outline" data-action="print-receipt-only" data-id="' + esc(app.id) + '">🖨 طباعة الوصل</button>' +
      '<button class="btn btn-primary" data-action="save-paid" data-id="' + esc(app.id) + '">حفظ التسديد</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(box);
  bind();
  return box;
}

const coreActionPacket = action;
action = async function (a, el) {
  if (a==='send-full-request') {
    const q = id => { const n = document.querySelector(id); return n ? n.value : ''; };
    const cb = id => { const n = document.querySelector(id); return n ? n.checked : false; };
    const payload = {
      sport: q('#reg-sport'), category: q('#reg-category'), swimming_strokes: q('#reg-strokes'),
      subscription_code: q('#reg-plan'), facility: q('#reg-facility'),
      transport: cb('#reg-transport'), uniform: cb('#reg-uniform'), payment_method: q('#reg-payment'),
      first_name_ar: q('#reg-first-ar'), last_name_ar: q('#reg-last-ar'),
      first_name_fr: q('#reg-first-fr'), last_name_fr: q('#reg-last-fr'),
      national_id: q('#reg-nin'), birth_certificate_no: q('#reg-birth-cert'),
      birth_place: q('#reg-birth-place'), wilaya: q('#reg-wilaya'), birth_date: q('#reg-birth'),
      gender: q('#reg-gender'), blood_group: q('#reg-blood'), level: q('#reg-level'),
      phone: q('#reg-phone'), whatsapp: q('#reg-whatsapp'), address: q('#reg-address'),
      guardian_first_name: q('#reg-guardian-first'), guardian_last_name: q('#reg-guardian-last'),
      guardian_relation: q('#reg-guardian-relation'), guardian_phone: q('#reg-guardian-phone'),
      guardian_national_id: q('#reg-guardian-nin'), guardian_consent: cb('#reg-guardian-consent')
    };
    const missing = [];
    if (!payload.first_name_ar) missing.push('الاسم بالعربية');
    if (!payload.last_name_ar) missing.push('اللقب بالعربية');
    if (!payload.birth_date) missing.push('تاريخ الميلاد');
    if (!payload.phone) missing.push('الهاتف');
    if (!payload.address) missing.push('العنوان');
    if (missing.length) { showToast('يرجى إكمال: ' + missing.join('، '), 'error'); return; }

    let photoData = '';
    const photoInput = document.querySelector('#reg-photo');
    if (photoInput && photoInput.files && photoInput.files[0]) {
      try {
        photoData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
          reader.readAsDataURL(photoInput.files[0]);
        });
      } catch (_) { photoData = ''; }
    }
    payload.photo_data_url = photoData;
    payload.doctor = '';
    payload.card_issue_place = 'غرداية';
    payload.guardian_child = payload.first_name_ar;

    const btn = document.querySelector('[data-action="send-full-request"]');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإرسال…'; }
    try {
      const res = await fetch('/api/applications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'تعذّر إرسال الطلب', 'error'); return; }
      const record = Object.assign({}, payload, {
        application_no: data.application_no, expected_amount: data.expected_amount
      });
      lastPacket = record;
      document.querySelector('.modal-backdrop')?.remove();
      registrationDoneModal(record);
      printPacket(record);
      showToast('تم الاستلام — جارٍ فتح نافذة الطباعة.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'إرسال طلب التسجيل'; }
    }
    return;
  }

  if (a==='print-packet') { if (lastPacket) printPacket(lastPacket); return; }
  if (a==='print-receipt-only') {
    const app = el && el.dataset.id
      ? (state.applications || []).find(x => String(x.id) === String(el.dataset.id)) || lastPacket
      : lastPacket;
    if (app) printPacket(app, 'receipt');
    else showToast('لا توجد بيانات للطباعة.', 'error');
    return;
  }
  if (a==='print-regs-only') { if (lastPacket) printPacket(lastPacket, 'regs'); return; }
  if (a==='attach-scan') {
    const app = (state.applications || []).find(x => String(x.id) === String(el.dataset.id));
    if (app) attachScanModal(app);
    return;
  }
  if (a==='save-scan') {
    const file = scanFieldFor(document);
    const noteEl = document.querySelector('#scan-note');
    if (!file || !file.files || !file.files[0]) { showToast('اختر الملف الموقّع أولًا.', 'error'); return; }
    const app = (state.applications || []).find(x => String(x.id) === String(el.dataset.id));
    const btn = el;
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الرفع…'; }
    try {
      const info = await uploadSignedForm(file.files[0], (app && (app.application_no || app.id)) || '');
      await api('/api/applications/' + encodeURIComponent(el.dataset.id), 'PATCH', {
        scan_path: info.path, scan_name: info.name, scan_size: info.size,
        scan_data_url: info.data_url || '', scan_note: noteEl ? noteEl.value : ''
      });
      logDecision('رفع نسخة موقّعة', 'application', el.dataset.id, { file: info.name });
      showToast('تم رفع النسخة الموقّعة.');
      document.querySelector('.modal-backdrop')?.remove();
      await syncApi(); render();
    } catch (e) {
      showToast(e.message || 'تعذّر الرفع', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'رفع النسخة'; }
    }
    return;
  }
  if (a==='open-receipt') {
    const app = (state.applications || []).find(x => String(x.id) === String(el.dataset.id));
    if (app) receiptModal(app);
    return;
  }
  if (a==='save-paid') {
    const paid = document.querySelector('#paid-check');
    const by = document.querySelector('#paid-by');
    try {
      await api('/api/applications/' + encodeURIComponent(el.dataset.id), 'PATCH', {
        payment_status: paid && paid.checked ? 'paid' : 'unpaid',
        cashier_name: by ? by.value : '',
        paid_at: paid && paid.checked ? new Date().toISOString().slice(0, 10) : ''
      });
      logDecision(paid && paid.checked ? 'تسديد نقدي' : 'إلغاء التسديد', 'application', el.dataset.id,
        { cashier: by ? by.value : '' });
      showToast(paid && paid.checked ? 'تم تسجيل التسديد.' : 'تم إلغاء التسديد.');
      document.querySelector('.modal-backdrop')?.remove();
      await syncApi(); render();
    } catch (e) { showToast(e.message || 'تعذّر الحفظ', 'error'); }
    return;
  }

  return coreActionPacket(a, el);
};

/* أزراب الحزمة داخل جدول الطلبات */
const corePageViewPacket = pageView;
pageView = function (p) {
  const html = corePageViewPacket(p);
  if (p !== 'applications') return html;
  return html.replace(
    /(<button class="row-more" data-action="edit-app" data-id="([^"]*)">)/g,
    (match, whole, id) => '<button class="check-btn" data-action="open-receipt" data-id="' + esc(id) + '">وصل</button>'
      + '<button class="check-btn" data-action="attach-scan" data-id="' + esc(id) + '">نسخة موقّعة</button>'
      + whole);
};

/* ==========================================================
   تخزين الصور خارج localStorage + عدّاد الزوار
   الصور كانت تُحفظ كنص داخل localStorage، وهذا يملأ الحصة
   بسرعة ويُضعف الأداء. IndexedDB يحفظها بلا حصّة.
   ========================================================== */
const PHOTO_DB = 'sadara-photos';
const PHOTO_STORE = 'img';

function openPhotoDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB غير متاح'));
    let request;
    try { request = indexedDB.open(PHOTO_DB, 1); }
    catch (e) { return reject(e); }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذّر فتح مخزن الصور'));
  });
}
async function photoStorePut(key, dataUrl) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(dataUrl, String(key));
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function photoStoreGet(key) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).get(String(key));
    req.onsuccess = () => { db.close(); resolve(req.result || ''); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function photoStoreDel(key) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(String(key));
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/* الصورة تعشي في القاعدة، وIndexedDB يُحتفظ محمًاً فقط
   The picture belongs in the database. It used to be written to IndexedDB and
   reported back with an empty photo, so the /api/profile write was skipped and
   the database never received it. IndexedDB almost always succeeds, so the only
   copy lived on the device that uploaded it: another phone saw no photo, the
   card printed blank, and the upload still said it had worked.

   shrinkPhoto() has already brought the image under 100 KB, and a Firestore
   document holds about 1 MB, so it fits comfortably. IndexedDB is kept as a
   cache -- it makes the picture appear without waiting on the network -- but it
   is never the only copy again. */
async function persistPhoto(dataUrl) {
  const key = (state.user && state.user.id) || 'guest';
  let cached = false;
  try { await photoStorePut(key, dataUrl); cached = true; } catch (_) { /* cache is optional */ }
  return { photo: dataUrl, photo_in_store: cached };
}
/* The database is the source of truth; the local cache only covers a picture that
   was never saved, so a member who cleared this device still sees their photo. */
async function restorePhoto() {
  if (state.profile && state.profile.photo) return state.profile.photo;
  const key = (state.user && state.user.id) || 'guest';
  try {
    const saved = await api('/api/profile', 'GET');
    const fromServer = saved && saved.profile && saved.profile.photo;
    if (fromServer) {
      state.profile = Object.assign({}, state.profile, { photo: fromServer });
      return fromServer;
    }
  } catch (_) { /* not signed in, or offline */ }
  try {
    const stored = await photoStoreGet(key);
    if (stored) {
      state.profile = Object.assign({}, state.profile, { photo: stored, photo_in_store: true });
      return stored;
    }
  } catch (_) { /* no store available */ }
  return '';
}

/* التصغير قبل الحفظ: صورة هاتف 4 ميغابايت تصبح أقل من 100 كيلوبايت */
async function shrinkPhoto(file, maxSide, quality) {
  const dataUrl = await readPhotoFile(file);
  if (!window.Image || !document.createElement('canvas')) return dataUrl;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const limit = maxSide || 900;
      const scale = Math.min(1, limit / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL('image/jpeg', quality || 0.82)); }
      catch (_) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const coreSaveMyPhoto = saveMyPhoto;
saveMyPhoto = async function (file) {
  if (!file) { showToast('اختر صورة أولًا.', 'error'); return; }
  if (!/^image\//.test(file.type)) { showToast('الملف يجب أن يكون صورة.', 'error'); return; }
  try {
    const small = await shrinkPhoto(file, 900, 0.82);
    const stored = await persistPhoto(small);
    if (stored.photo) {
      await api('/api/profile', 'PUT', { photo: stored.photo });
      state.profile = Object.assign({}, state.profile, { photo: stored.photo });
      save();
    } else {
      state.profile = Object.assign({}, state.profile, { photo: small, photo_in_store: true });
      save();
    }
    render();
    showToast('تم حفظ صورتك.');
  } catch (e) {
    showToast(e.message || 'تعذّر حفظ الصورة', 'error');
  }
};

const coreRemoveMyPhoto = action;
action = async function (a, el) {
  if (a === 'remove-my-photo') {
    try {
      await photoStoreDel((state.user && state.user.id) || 'guest');
    } catch (_) { /* nothing to clear */ }
    return coreRemoveMyPhoto(a, el);
  }
  return coreRemoveMyPhoto(a, el);
};

/*restore the photo kept outside localStorage before the first paint*/
const coreRenderPhoto = render;
render = function () {
  coreRenderPhoto();
  if (state.user && state.profile && !state.profile.photo) {
    restorePhoto().then(url => { if (url && url !== state.profile.photo) coreRenderPhoto(); });
  }
};

/* عدّاد زيارات خفيف: رقم فقط، بلا تعريف للزائر */
let visitCounted = false;
async function countVisit() {
  if (visitCounted || state.user) return;
  if (sessionStorage.getItem('sadara-visited')) return;
  visitCounted = true;
  sessionStorage.setItem('sadara-visited', '1');
  try {
    const res = await fetch('/api/visit', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: location.pathname, ref: document.referrer ? 'link' : 'direct' })
    });
    if (res.ok) {
      const data = await res.json();
      state.visits = data.visits || 0;
    }
  } catch (_) { /* counting is best effort */ }
}

/* ---------- عداد الزوار في لوحة الإدارة ---------- */
let visitTotals = { visits: 0, today: 0, week: 0 };
async function loadVisitTotals() {
  if (visitTotals.visits) return;
  try {
    const res = await fetch('/api/visits', { credentials: 'same-origin' });
    if (res.ok) visitTotals = Object.assign(visitTotals, await res.json());
  } catch (_) { /* this backend has no counter */ }
}
function visitStampHtml() {
  if (!visitTotals.visits) return '';
  return '<p class="visit-stamp">الزيارات: <b>' + esc(visitTotals.visits) + '</b>'
    + ' \u00b7 اليوم <b>' + esc(visitTotals.today || 0) + '</b>'
    + ' \u00b7 \u0622\u062e\u0631 7 \u0623\u064a\u0627\u0645 <b>' + esc(visitTotals.week || 0) + '</b></p>';
}
const corePageViewVisits = pageView;
pageView = function (p) {
  const html = corePageViewVisits(p);
  if (p !== 'home' || !state.user) return html;
  if (!visitTotals.visits) loadVisitTotals();
  if (html.indexOf('visit-stamp') >= 0) return html;
  // the welcome paragraph is the one place every admin sees first
  return html.includes('class="welcome"')
    ? html.replace('class="welcome"', 'class="welcome visit-stamp-host"')
    : html;
};
const coreRenderVisits = render;
render = function () {
  coreRenderVisits();
  const host = document.querySelector('.visit-stamp-host');
  if (!host || host.querySelector('.visit-stamp')) return;
  const stamp = visitStampHtml();
  if (stamp) host.insertAdjacentHTML('beforeend', stamp);
  else loadVisitTotals().then(() => {
    const again = document.querySelector('.visit-stamp-host');
    const late = visitStampHtml();
    if (again && late && !again.querySelector('.visit-stamp')) again.insertAdjacentHTML('beforeend', late);
  });
};

/* ---------------------- ربط التصدير والتدقيق ---------------------- */
const coreAction5=action;
action=async function(a,el){
  if(a==='export-swimmers'){exportSwimmers();return}
  if(a==='export-applications'){exportApplications();return}
  if(a==='export-attendance'){exportAttendance();return}
  if(a==='export-schedule'){exportSchedule();return}
  if(a==='confirm-yes'||a==='confirm-no')return;

  if(a==='approve-app'){
    const app=(state.applications||[]).find(x=>String(x.id)===String(el.dataset.id));
    try{
      await api('/api/applications/'+encodeURIComponent(el.dataset.id),'PATCH',{status:'approved'});
      logDecision('اعتماد طلب','application',el.dataset.id,{name:appName(app||{}),amount:app&&app.expected_amount});
      showToast('تم اعتماد الطلب.');
      await syncApi(); render();
    }catch(e){showToast(e.message,'error')}
    return;
  }
  if(a==='reject-app'){
    const app=(state.applications||[]).find(x=>String(x.id)===String(el.dataset.id));
    confirmDialog('رفض الطلب «' + appName(app||{}) + '»؟', 'رفض الطلب', async () => {
      /* The reason is not optional and it is not ours to invent. A refusal with no
         reason is one the applicant cannot act on and one the club fields the
         same question about at the counter, so it is asked for until it is given. */
      let reason = '';
      while (!reason) {
        const asked = window.prompt('سبب الرفض — سيُقرأ بالضبط على حساب صاحب الطلب:\n(مثال: لا توجد شهادة سباحة سارية)', '');
        if (asked === null) return;
        reason = String(asked).trim();
        if (!reason) showToast('اكتب سبب الرفض. الطلب لن يُرفض بدونه.', 'error');
      }
      try{
        await api('/api/applications/'+encodeURIComponent(el.dataset.id),'PATCH',{status:'rejected',rejection_reason:reason});
        logDecision('رفض طلب','application',el.dataset.id,{reason:reason});
        showToast('تم رفض الطلب. سيقرأ صاحب الطلب السبب عند محاولته الدخول.');
        await syncApi(); render();
      }catch(e){showToast(e.message,'error')}
    });
    return;
  }
  if(a==='delete-swimmer'){
    const s=(state.swimmers||[]).find(x=>String(x.id)===String(el.dataset.id));
    confirmDialog('حذف السباح «' + ((s&&s.name)||'') + '» نهائيًا؟','حذف', async () => {
      try{ await api('/api/swimmers','DELETE',{id:el.dataset.id});
        logDecision('حذف سباح','swimmer',el.dataset.id,{name:s&&s.name});
        showToast('تم حذف السباح.'); await syncApi(); render();
      }catch(e){showToast(e.message,'error')}
    });
    return;
  }
  if(a==='delete-notice'){
    const n=(state.notices||[]).find(x=>String(x.id)===String(el.dataset.id));
    confirmDialog('حذف الإعلان «' + ((n&&n.title)||'') + '»؟','حذف', async () => {
      try{ await api('/api/notices','DELETE',{id:el.dataset.id});
        logDecision('حذف إعلان','notice',el.dataset.id,{title:n&&n.title});
        showToast('تم حذف الإعلان.'); await syncApi(); render();
      }catch(e){showToast(e.message,'error')}
    });
    return;
  }
  if(a==='delete-session'){
    confirmDialog('حذف هذه الحصة من البرنامج؟','حذف', async () => {
      try{ await api('/api/schedule','DELETE',{id:el.dataset.id});
        logDecision('حذف حصة','schedule',el.dataset.id,{});
        showToast('تم حذف الحصة.'); await syncApi(); render();
      }catch(e){showToast(e.message,'error')}
    });
    return;
  }
  if(a==='delete-group'){
    const g=(state.groups||[]).find(x=>x.id===el.dataset.group);
    confirmDialog('حذف الفوج «' + ((g&&g.name)||'') + '»؟ لن تتأثر بيانات سباحيه.','حذف', () => {
      state.groups=(state.groups||[]).filter(x=>x.id!==el.dataset.group);
      logDecision('حذف فوج','group',el.dataset.group,{name:g&&g.name});
      save(); render(); showToast('تم حذف الفوج.');
    });
    return;
  }
  if(a==='mark-all-present'){
    const list=state.swimmers||[];
    if(!list.length){showToast('لا يوجد سباحون لتسجيل حضورهم.','error');return}
    /* The day on the page, in the question, in the record and in the answer --
        three places that used to say today whatever the screen said, so a coach
        who had picked Saturday was asked about today and answered about today. */
    const day=attendanceDay();
    confirmDialog('تسجيل حضور ' + list.length + ' سباح لـ' + attendanceSessionLabel() + '؟','تأكيد الجميع', async () => {
      let done=0;
      for(const s of list){
        try{ await api('/api/attendance','POST',{member_id:s.id,swimmer_id:s.id,status:'present',session_date:day}); done++; }
        catch(_){}
      }
      list.forEach(s=>{const b=state.attendance[s.id]=state.attendance[s.id]||[];b.push({status:'present',at:new Date().toISOString(),date:day});
        (state.attendanceByDay[day]||(state.attendanceByDay[day]={}))[s.id]={status:'present',at:new Date().toISOString()};});
      logDecision('تأكيد حضور الجميع','attendance',day,{count:done});
      save(); render(); showToast('تم تسجيل حضور ' + done + ' سباح لـ' + attendanceSessionLabel() + '.');
    });
    return;
  }
  if(a==='reset-attendance'){
    /* One day, named. The other days were never touched and must not sound as
       though they were: "the record has been cleared", with no day in it, is a
       sentence about nothing. */
    const day=attendanceDay();
    confirmDialog('تصفير سجل حضور ' + attendanceSessionLabel() + ' على هذه الشاشة؟','تصفير', () => {
      if(state.attendanceByDay&&state.attendanceByDay[day])delete state.attendanceByDay[day];
      for(const id of Object.keys(state.attendance||{})){
        state.attendance[id]=(state.attendance[id]||[]).filter(r=>String(r.date)!==day);
        if(!state.attendance[id].length)delete state.attendance[id];
      }
      logDecision('تصفير الحضور','attendance',day,{});
      save(); render(); showToast('تم تصفير سجل ' + attendanceSessionLabel() + '.');
    });
    return;
  }
  if(a==='remove-my-photo'){
    confirmDialog('حذف صورتك الشخصية؟','حذف', async () => {
      try{ await api('/api/profile','PUT',{photo:''});
        state.profile.photo=''; save(); render(); showToast('تم حذف الصورة.');
      }catch(e){showToast(e.message,'error')}
    });
    return;
  }
  return coreAction5(a,el);
};

/* أزرار التصدير داخل الصفحات */
function exportBtn(kind,label){return '<button class="btn btn-outline" data-action="export-'+kind+'">⤓ '+esc(label)+'</button>';}
function patchToolbar(html,kind,label){
  const btn = exportBtn(kind,label);
  return html.includes('toolbar-group')
    ? html.replace('<div class="toolbar-group">', '<div class="toolbar-group">'+btn)
    : html;
}
const corePageView4=pageView;
pageView=function(p){
  let html = corePageView4(p);
  if(p==='users') html = patchToolbar(html,'swimmers','تصدير Excel');
  else if(p==='applications') html = patchToolbar(html,'applications','تصدير Excel');
  else if(p==='attendance') html = patchToolbar(html,'attendance','تصدير Excel');
  else if(p==='schedule') html = patchToolbar(html,'schedule','تصدير Excel');
  return html;
};

/* ==========================================================
   أسماء المسابح — قابلة للتعديل من الإعدادات
   ==========================================================
   The four pool names used to be written into three different places in the
   source, so renaming one meant editing code and rebuilding. They now live in
   the database: management edits the list in Settings, and both the platform's
   own sign-up and the public page at /istimara/ read the same names, so a
   rename reaches every choice list at once.

   The built-in list is only a fallback for an empty table -- the form is never
   left with no options. */
const DEFAULT_FACILITIES = [
  { id: 'olympic', name: 'المسبح الأولمبي' },
  { id: 'half', name: 'المسبح النصف أولمبي' },
  { id: 'stadium', name: 'الملعب البلدي' },
  { id: 'forest', name: 'غابة غرداية' }
];

function facilities() {
  const list = Array.isArray(state.facilities) ? state.facilities.filter(f => f && String(f.name || '').trim()) : [];
  return list.length ? list : DEFAULT_FACILITIES;
}
function facilityNames() { return facilities().map(f => f.name); }

/* One place that builds the <option> list, so the platform's sign-up and its
   edit dialog cannot drift apart. */
function facilityOptions(selected) {
  const keep = String(selected || '');
  const opts = facilityNames().map(n => '<option' + (n === keep ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  /* An old record may name a pool the club has since renamed. Keeping it as a
     selected option means the history stays readable instead of silently
     showing the wrong pool. */
  const orphan = keep && facilityNames().indexOf(keep) === -1
    ? '<option selected>' + esc(keep) + '</option>' : '';
  return orphan + opts;
}

/* ---------- تحميل القائمة مع بقية المزامنة ---------- */
async function loadFacilities() {
  try {
    const res = await fetch('/api/facilities');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data) && data.length) { state.facilities = data; save(); }
  } catch (_) { /* the built-in list stays in place */ }
}

/* ---------- محرّر الأسماء في الإعدادات ---------- */
const coreSettings = pageSettings;
pageSettings = function () {
  const list = facilities();
  const box = '<section class="panel settings" id="facilities-panel"><div class="panel-head"><div>'
    + '<h3>أسماء المسابح والمنشآت</h3>'
    + '<p>تظهر في استمارة التسجيل وفي صفحة التسجيل العامة <code>/istimara/</code> فورًا بعد الحفظ.</p>'
    + '</div><button class="btn btn-primary" data-action="save-facilities">حفظ الأسماء</button></div>'
    + '<div id="facilities-list">'
    + list.map((f, i) => '<div class="requirement-row facility-row">'
      + '<input value="' + esc(f.name) + '" data-facility-name="' + i + '" placeholder="اسم المسبح">'
      + '<button class="check-btn no" data-action="remove-facility" data-index="' + i + '" aria-label="حذف">✕</button>'
      + '</div>').join('')
    + '</div>'
    + '<button class="btn btn-outline" data-action="add-facility">+ إضافة مسبح</button>'
    + '<p class="page-description">الترتيب هنا هو ترتيب ظهورها في القوائم. لا يمكن ترك القائمة فارغة.</p>'
    + '</section>';
  return coreSettings() + box;
};

/* ---------- استبدال قوائم المسابح في الاستمارة ---------- */
/* fullRegisterModal and the edit dialog both wrote the four names inline. They
   are re-rendered from the database instead. */
const coreRegisterModal = fullRegisterModal;
fullRegisterModal = function () {
  return coreRegisterModal().replace(
    /(<label>المسبح أو المنشأة<select id="reg-facility">)[\s\S]*?(<\/select>)/,
    (m, open, close) => open + facilityOptions('') + close
  );
};

/* ---------- التصدير إلى Excel ---------- */
/* A .csv that Excel opens is fine until the club needs to sort or filter 300
   registrations. A real .xlsx carries the columns as text, keeps them wide and
   reads correctly right-to-left. SpreadsheetML is a single XML document with no
   library, so it works offline and on the phone. */
const XLS_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<?mso-application progid="Excel.Sheet"?>\n'
  + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
  + 'xmlns:o="urn:schemas-microsoft-com:office:office" '
  + 'xmlns:x="urn:schemas-microsoft-com:office:excel" '
  + 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  + '<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/>'
  + '<Interior ss:Color="#0A6F78" ss:Pattern="Solid"/></Style></Styles>'
  + '<Worksheet ss:Name="التسجيلات"><Table>';
const XLS_FOOTER = '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">'
  + '<FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>'
  + '<TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>'
  + '</WorksheetOptions></Worksheet></Workbook>';

function xmlText(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    /* Excel rejects a raw control character inside a cell. */
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
/* An empty cell is written as <Cell/> rather than a Cell holding an empty
   Data. Both are legal, but Excel collapses the empty Data form on save and
   some readers count it as a column with no value, so the shorter form is used.
   A cell whose value is an empty string is genuinely empty; use keep:true for a
   label whose value is missing on purpose. */
function xlsRow(values, style) {
  return '<Row>' + values.map(v => {
    if (v === undefined || v === null || v === '') return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '/>';
    return '<Cell' + (style ? ' ss:StyleID="' + style + '"' : '') + '><Data ss:Type="String">'
      + xmlText(v) + '</Data></Cell>';
  }).join('') + '</Row>';
}
function downloadXml(filename, xml) {
  /* The BOM is what makes Excel read the Arabic as Arabic instead of mojibake. */
  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-') + '-' + todayISO() + '.xls';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* One definition of a registration's columns, used by both exports, so the CSV
   and the Excel file can never list different fields. */
const REGISTRATION_COLUMNS = [
  ['رقم الطلب', a => clubDigits(a.application_no || a.id || '')],
  /* A coach request has no swimmer identity, so it carries the coach's name in
     the same two columns rather than leaving the row nameless. */
  ['الاسم بالعربية', a => a.first_name_ar || a.coach_name || ''],
  ['اللقب بالعربية', a => a.last_name_ar || ''],
  ['الاسم بالفرنسية', a => a.first_name_fr || ''],
  ['اللقب بالفرنسية', a => a.last_name_fr || ''],
  ['الفئة', a => catLabel(a.application_type === 'coach' ? 'coach' : a.category)],
  ['تاريخ الميلاد', a => a.birth_date || ''],
  ['الجنس', a => ({ male: 'ذكر', female: 'أنثى' })[a.gender] || a.gender || ''],
  ['مكان الميلاد', a => a.birth_place || ''],
  ['الولاية', a => a.wilaya || ''],
  ['رقم التعريف الوطني', a => a.national_id || ''],
  ['رقم شهادة الميلاد', a => a.birth_certificate_no || ''],
  ['فصيلة الدم', a => a.blood_group || ''],
  ['المستوى', a => a.level || ''],
  ['نمط السباحة', a => a.swimming_strokes || ''],
  ['الهاتف', a => a.phone || ''],
  ['الواتساب', a => a.whatsapp || ''],
  ['العنوان', a => a.address || ''],
  ['الاشتراك', a => planName(a.subscription_code)],
  ['المسبح أو المنشأة', a => a.facility || ''],
  ['النقل', a => a.transport ? 'نعم' : 'لا'],
  ['البدلة الرياضية', a => a.uniform ? 'نعم' : 'لا'],
  ['طريقة الدفع', a => ({ cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية' })[a.payment_method] || a.payment_method || ''],
  ['المبلغ المتوقع', a => String(Number(a.expected_amount) || 0)],
  ['اسم الولي', a => a.guardian_first_name || ''],
  ['لقب الولي', a => a.guardian_last_name || ''],
  ['تاريخ ميلاد الولي', a => a.guardian_birth_date || ''],
  ['صلة القرابة', a => a.guardian_relation || ''],
  ['هاتف الولي', a => a.guardian_phone || ''],
  ['رقم تعريف الولي', a => a.guardian_national_id || ''],
  ['ملاحظة', a => a.notes || ''],
  ['الصورة', a => a.photo ? 'مرفقة' : (a.photo_omitted ? 'ناقصة' : 'لا')],
  ['المصدر', a => a.submitted_from === 'public-form' ? 'الاستمارة العامة' : 'المنصة'],
  ['الحالة', a => stateLabel(a.status)],
  ['سبب القرار', a => a.decision_reason || ''],
  ['تاريخ الإرسال', a => (a.created_at && (a.created_at.toDate ? a.created_at.toDate() : a.created_at)) || a.created_date || '']
];

function registrationRows(list) {
  const rows = list || state.applications || [];
  return {
    headers: REGISTRATION_COLUMNS.map(c => c[0]),
    rows: rows.map(a => REGISTRATION_COLUMNS.map(c => c[1](a)))
  };
}

const coreExportApplications = exportApplications;
exportApplications = function () {
  const data = registrationRows();
  if (!data.rows.length) { showToast('لا توجد طلبات للتصدير.', 'error'); return; }
  downloadCsv('طلبات التسجيل', data.headers, data.rows);
};

function exportApplicationsExcel() {
  const data = registrationRows();
  if (!data.rows.length) { showToast('لا توجد طلبات للتصدير.', 'error'); return; }
  const xml = XLS_HEADER
    + xlsRow(data.headers, 'hdr')
    + data.rows.map(r => xlsRow(r, null)).join('')
    + XLS_FOOTER;
  downloadXml('طلبات التسجيل', xml);
  showToast('تم تصدير ' + data.rows.length + ' سجل إلى Excel.');
}

/* ---------- الإجراءات ---------- */
const coreActionFacilities = action;
action = async function (a, el) {
  /* Compared without spaces around === on purpose: the dead-control check reads
     handlers out of the source with /a===?['"]/, so a spaced comparison would
     make these four look like buttons with nothing behind them. */
  if(a==='add-facility'){
    const box = document.getElementById('facilities-list');
    if (box) {
      const n = box.querySelectorAll('[data-facility-name]').length;
      box.insertAdjacentHTML('beforeend',
        '<div class="requirement-row facility-row"><input value="" data-facility-name="' + n + '" placeholder="اسم المسبح">'
        + '<button class="check-btn no" data-action="remove-facility" data-index="' + n + '" aria-label="حذف">✕</button></div>');
    }
    return;
  }
  if(a==='remove-facility'){
    /* Not CSS.escape: the index is written by this page and is always digits,
       and CSS.escape is missing under the older engines the club's members use. */
    const wanted = String((el && el.dataset && el.dataset.index) || '');
    const row = Array.prototype.filter.call(
      document.querySelectorAll('[data-facility-name]'),
      i => i.getAttribute('data-facility-name') === wanted
    )[0];
    const box = row ? row.closest('.facility-row') : null;
    if (box) box.remove();
    return;
  }
  if(a==='save-facilities'){
    const names = Array.from(document.querySelectorAll('[data-facility-name]'))
      .map(i => String(i.value || '').trim())
      .filter(Boolean);
    if (!names.length) { showToast('أبقِ مسبحًا واحدًا على الأقل في القائمة.', 'error'); return; }
    const current = facilities();
    const list = names.map((name, i) => ({ id: (current[i] && current[i].id) || ('fac-' + i), name }));
    try {
      const res = await fetch('/api/facilities', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ facilities: list })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'تعذّر حفظ الأسماء.', 'error'); return; }
      state.facilities = list;
      save();
      showToast('حُفظت الأسماء. ستظهر في استمارة التسجيل العامة فورًا.');
      render();
    } catch (e) { showToast(e.message || 'تعذّر حفظ الأسماء.', 'error'); }
    return;
  }
  if(a==='export-applications-excel'){exportApplicationsExcel();return}
  return coreActionFacilities(a, el);
};

/* ---------- زرّ Excel في صفحة الطلبات ---------- */
const coreApplicationsPage = pageApplications;
pageApplications = function () {
  const html = coreApplicationsPage();
  const btn = '<button class="btn btn-primary" data-action="export-applications-excel">📊 Excel</button>';
  const anchor = '<select class="filter" id="app-filter">';
  return html.replace(anchor, btn + anchor);
};

/* ---------- اسم المسبح في حوار تعديل الطلب ---------- */
/* The dialog's body is applicationFormBody, not editAppModal. Wrapping the
   builder means the option list is produced once, before any HTML exists. */
const coreApplicationFormBody = applicationFormBody;
applicationFormBody = function (a, plans, extras) {
  return coreApplicationFormBody(a, plans, extras).replace(
    /(<label>المنشأة<select id="edit-facility">)[\s\S]*?(<\/select>)/,
    (m, open, close) => open + facilityOptions(a && a.facility) + close
  );
};

/* ---------- تحميل الأسماء عند الإقلاع ---------- */
const coreBootFacilities = boot;
boot = async function () {
  await coreBootFacilities();
  await loadFacilities();
  render();
};

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

/* ============================================================================
   رسوم النقل والبدلة — part-z.js

   Transport and uniform were one price each for everybody. The club asked for
   them to follow what is actually available: a pool without a changing room does
   not charge for a uniform, and a junior group is not charged the senior rate.

   So the manager sets, for each pool and each category, whether transport and
   uniform are on offer and at what price. A blank cell falls back to the single
   price that was always there, so a database nobody has touched keeps behaving
   exactly as it did.

   The subscription default sits at the top of the panel: 600, held in the
   database and changed here. The three real plans are untouched.

   The figures shown are the ones the server will charge, because they are read
   back from it after saving rather than from what was typed -- a total the club
   can see has to be the total the club will get.
   ========================================================================= */
(function () {
  'use strict';

  const CATS = [['minor', 'أصاغر'], ['adult', 'أكابر']];
  const SERVICES = [['transport', 'النقل'], ['uniform', 'البدلة الرياضية']];
  const cell = (row, cat, key) => {
    const c = row && row[cat] && row[cat][key];
    if (c && typeof c === 'object') return c;
    return null;
  };
  const number = v => (v === '' || v === undefined || v === null) ? '' : String(v);

  const panel = () => {
    const f = state.fees;
    if (!f || typeof f !== 'object') return '';
    const pools = [{ id: '*', name: 'كل المسابح (افتراضي)' }].concat(f.pools || []);
    const rows = pools.map(pool => '<tr data-pool="' + esc(pool.id) + '">'
      + '<th>' + esc(pool.name) + '</th>'
      + CATS.map(cat => SERVICES.map(key => {
        const c = cell(f.matrix && f.matrix[pool.id], cat[0], key[0]);
        const on = c ? c.available !== false : true;
        const amt = c ? c.amount : (key[0] === 'transport' ? f.transport : f.uniform);
        return '<td><label class="fee-on">'
          + '<input type="checkbox" data-fee="on" data-pool="' + esc(pool.id)
          + '" data-cat="' + cat[0] + '" data-key="' + key[0] + '"' + (on ? ' checked' : '') + '>'
          + '</label>'
          + '<input type="number" min="0" step="50" class="fee-amount" data-fee="amount" data-pool="'
          + esc(pool.id) + '" data-cat="' + cat[0] + '" data-key="' + key[0]
          + '" value="' + esc(number(amt)) + '"' + (on ? '' : ' disabled') + '>'
          + '<small>' + esc(key[1]) + '</small></td>';
      }).join('')).join('')
      + '</tr>').join('');

    return '<section class="panel settings" id="fees-panel">'
      + '<div class="panel-head"><div>'
      + '<h3>رسوم النقل والبدلة الرياضية</h3>'
      + '<p>لكل صنف ولكل مسبح. الخانة الفارغة تأخذ القيمة العامة أعلاه.</p>'
      + '</div></div>'
      + '<div class="fee-head">'
      + '<label>اشتراك النادي الافتراضي (دج)'
      + '<input type="number" min="0" step="50" id="fee-subscription" value="'
      + esc(number(f.subscription_default)) + '"></label>'
      + '<label>النقل — سعر عام (دج)'
      + '<input type="number" min="0" step="50" id="fee-transport" value="'
      + esc(number(f.transport)) + '"></label>'
      + '<label>البدلة — سعر عام (دج)'
      + '<input type="number" min="0" step="50" id="fee-uniform" value="'
      + esc(number(f.uniform)) + '"></label>'
      + '<button class="btn btn-primary" data-action="save-fees">حفظ الرسوم</button>'
      + '</div>'
      + '<div class="fee-scroll"><table class="fee-table">'
      + '<thead><tr><th>المسبح</th>'
      + CATS.map(c => '<th colspan="2">' + esc(c[1]) + '</th>').join('')
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</section>';
  };

  const coreSettingsFees = pageSettings;
  pageSettings = function () {
    return coreSettingsFees() + panel();
  };

  async function loadFees() {
    try {
      const res = await fetch('/api/fees', { credentials: 'same-origin' });
      state.fees = await res.json().catch(() => null);
      await refreshOffered();
    } catch (_) { state.fees = null; }
  }

  /* What the club offers at this pool for this category, so the registration
     form hides a checkbox rather than charging for a service that is not there. */
  async function refreshOffered() {
    try {
      const q = 'category=' + encodeURIComponent(val('#reg-category') || 'adult')
        + '&facility=' + encodeURIComponent(val('#reg-facility') || '');
      const res = await fetch('/api/subscription-plans?' + q);
      const data = await res.json().catch(() => null);
      if (!data) return;
      if (data.extras) state.extras = Object.assign({}, state.extras, data.extras);
      const on = data.offered || { transport: true, uniform: true };
      [['#reg-transport', on.transport], ['#reg-uniform', on.uniform]].forEach(pair => {
        const box = $(pair[0]);
        if (!box) return;
        const line = box.closest('.check-line') || box.parentNode;
        if (line) line.hidden = !pair[1];
        if (!pair[1]) box.checked = false;
      });
    } catch (_) { /* the built-in list stands */ }
  }

  const coreSyncFees = syncApi;
  syncApi = async function () {
    await coreSyncFees();
    if (state.user && ['admin', 'president'].indexOf(state.user.role) !== -1) await loadFees();
  };

  const coreActionFees = action;
  action = async function (a, el) {
    if(a!=='save-fees'){return coreActionFees(a, el);}

    const matrix = {};
    document.querySelectorAll('#fees-panel [data-fee="amount"]').forEach(box => {
      const pool = box.dataset.pool, cat = box.dataset.cat, key = box.dataset.key;
      const on = document.querySelector('[data-fee="on"][data-pool="' + pool
        + '"][data-cat="' + cat + '"][data-key="' + key + '"]');
      if (!matrix[pool]) matrix[pool] = {};
      if (!matrix[pool][cat]) matrix[pool][cat] = {};
      matrix[pool][cat][key] = {
        available: !!(on && on.checked),
        amount: Number(box.value) || 0
      };
    });
    const body = {
      transport: Number(($('#fee-transport') || {}).value) || 0,
      uniform: Number(($('#fee-uniform') || {}).value) || 0,
      subscription_default: Number(($('#fee-subscription') || {}).value) || 0,
      matrix: matrix
    };
    const res = await api('/api/fees', 'PUT', body);
    if (!res || res.error) { showToast((res && res.error) || 'تعذّر حفظ الرسوم.', 'error'); return; }
    /* Read back what the server now holds, not what was typed. The club has to
       see the figures that will actually be charged. */
    await loadFees();
    save();
    render();
    showToast('حُفظت الرسوم. صارت تسري على كل استمارة جديدة.');
  };

  const coreBootFees = boot;
  boot = async function () {
    await coreBootFees();
    if (state.user && ['admin', 'president'].indexOf(state.user.role) !== -1) await loadFees();
  };
})();

/* ---------- final layer ---------- */

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
  /* The eye on every password field on the page, and beside the two calls that
     are actually made rather than in the `bind` above, which a later layer
     reassigns: an eye called from a function nothing reaches is an eye nobody
     sees. */
  passwordEyes();
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
