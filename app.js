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

function fullRegisterModal(){return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal registration-modal"><button class="close" data-action="close" aria-label="إغلاق">×</button><div class="modal-heading"><span class="logo">🏊</span><h2>استمارة التسجيل</h2><p>بطاقة المعلومات الرسمية لنادي الصدارة</p></div><div class="form-section-title">1. الاختيار الرياضي والاشتراك</div><label>الرياضة<select id="reg-sport"><option>السباحة</option><option>العدو الريفي</option><option>العدو السريع</option></select></label><label>الفئة<select id="reg-category"><option value="minor">أصاغر — بيانات الولي مطلوبة</option><option value="adult">أكابر — تسجيل مباشر</option></select></label><label>نمط السباحة<input id="reg-strokes" placeholder="حرة، ظهر، صدر، فراشة، متناوبة"></label><label>الاشتراك<select id="reg-plan"><option value="quarter">فصلي — 1000 دج</option><option value="season">موسمي — 3000 دج</option><option value="agreement">اتفاقية — 3000 دج</option></select></label><label>المسبح أو المنشأة<select id="reg-facility"><option>المسبح الأولمبي</option><option>المسبح النصف أولمبي</option><option>الملعب البلدي</option><option>غابة غرداية</option></select></label><label class="check-line"><input id="reg-transport" type="checkbox"> النقل — 900 دج</label><label class="check-line"><input id="reg-uniform" type="checkbox"> البدلة الرياضية — 2500 دج</label><label>طريقة الدفع<select id="reg-payment"><option value="cash">نقدًا</option><option value="postal_check">صك بريدي</option><option value="postal_transfer">حوالة بريدية</option></select></label><div class="form-section-title">2. معلومات الرياضي</div><div class="form-two"><label>الاسم بالعربية *<input id="reg-first-ar"></label><label>اللقب بالعربية *<input id="reg-last-ar"></label><label>الاسم بالفرنسية<input id="reg-first-fr"></label><label>اللقب بالفرنسية<input id="reg-last-fr"></label><label>رقم التعريف الوطني<input id="reg-nin"></label><label>رقم شهادة الميلاد<input id="reg-birth-cert"></label><label>بلدية الميلاد<input id="reg-birth-place"></label><label>الولاية<input id="reg-wilaya" placeholder="غرداية"></label></div><label>تاريخ الميلاد *<input id="reg-birth" type="date"></label><div class="form-two"><label>الجنس<select id="reg-gender"><option>ذكر</option><option>أنثى</option></select></label><label>فصيلة الدم<select id="reg-blood"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label><label>المستوى الرياضي<select id="reg-level"><option>مبتدئ</option><option>متوسط</option><option>متقدم</option><option>نخبة</option></select></label><label>الهاتف *<input id="reg-phone" placeholder="05xx xx xx xx"></label></div><label>رقم واتساب<input id="reg-whatsapp"></label><label>العنوان *<input id="reg-address"></label><label>الصورة الشخصية<input id="reg-photo" type="file" accept="image/*"></label><div class="form-section-title">3. معلومات الولي والتصريح</div><div class="form-two"><label>اسم الولي<input id="reg-guardian-first"></label><label>لقب الولي<input id="reg-guardian-last"></label><label>صلة القرابة<input id="reg-guardian-relation" value="الأب"></label><label>هاتف الولي<input id="reg-guardian-phone"></label></div><label>رقم تعريف الولي<input id="reg-guardian-nin"></label><label class="check-line"><input id="reg-guardian-consent" type="checkbox"> أقر بصحة المعلومات وأوافق على ممارسة النشاط الرياضي</label><div class="official-docs"><a href="assets/registration-card.jpg" target="_blank">معاينة بطاقة التسجيل الرسمية</a><a href="assets/internal-regulations.jpg" target="_blank">معاينة النظام الداخلي</a></div><button class="btn btn-primary full" data-action="send-full-request">إرسال طلب التسجيل</button></div></div>`}
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
  const category = document.querySelector('#reg-category');
  const sectionTitle = [...document.querySelectorAll('.form-section-title')].find(x => x.textContent.includes('معلومات الولي'));
  if (!category || !sectionTitle) return;
  const guardianNodes = [];
  let node = sectionTitle;
  while (node) { if (node.querySelector?.('[data-action="send-full-request"]')) break; guardianNodes.push(node); node = node.nextElementSibling; }
  const toggle = () => { const visible = category.value === 'minor'; guardianNodes.forEach(x => { x.hidden = !visible; }); if (!visible) guardianNodes.forEach(x => x.querySelectorAll?.('input').forEach(i => { if (i.type !== 'checkbox') i.value = ''; i.checked = false; })); };
  category.addEventListener('change', toggle); toggle();
  const submit = document.querySelector('[data-action="send-full-request"]');
  if (submit && !document.querySelector('.attached-registration-forms')) submit.insertAdjacentHTML('beforebegin','<div class="official-docs attached-registration-forms"><a href="form-registration-01.jpg" target="_blank" rel="noopener">استمارة النادي</a><a href="internal-regulations.jpg" target="_blank" rel="noopener">النظام الداخلي</a><a href="form-registration-02.jpg" target="_blank" rel="noopener">استمارة النظام</a><a href="registration-card.jpg" target="_blank" rel="noopener">نموذج بطاقة الانخراط</a></div>');
  if (submit && !document.querySelector('[data-action="print-registration-form"]')) submit.insertAdjacentHTML('beforebegin','<button class="btn btn-outline full" data-action="print-registration-form">طباعة نموذج التسجيل A4</button>');
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
  if(a==='reject-app'){const reason=prompt('سبب رفض الطلب:','الوثائق ناقصة');if(reason===null)return;await fetch('/api/applications/'+el.dataset.id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({status:'rejected',decision_reason:reason})});await syncApi();render();return}
  if(a==='register'){document.querySelector('.modal-backdrop')?.remove();document.body.insertAdjacentHTML('beforeend',fullRegisterModal());bind();setupRegistrationMode();return}
  if(a==='send-full-request'){
    const payload={sport:$('#reg-sport').value,category:$('#reg-category').value,swimming_strokes:$('#reg-strokes').value,subscription_code:$('#reg-plan').value,facility:$('#reg-facility').value,transport:$('#reg-transport').checked,uniform:$('#reg-uniform').checked,payment_method:$('#reg-payment').value,first_name_ar:$('#reg-first-ar').value,last_name_ar:$('#reg-last-ar').value,first_name_fr:$('#reg-first-fr').value,last_name_fr:$('#reg-last-fr').value,national_id:$('#reg-nin').value,birth_certificate_no:$('#reg-birth-cert').value,birth_place:$('#reg-birth-place').value,wilaya:$('#reg-wilaya').value,birth_date:$('#reg-birth').value,gender:$('#reg-gender').value,blood_group:$('#reg-blood').value,level:$('#reg-level').value,phone:$('#reg-phone').value,whatsapp:$('#reg-whatsapp').value,address:$('#reg-address').value,guardian_first_name:$('#reg-guardian-first').value,guardian_last_name:$('#reg-guardian-last').value,guardian_relation:$('#reg-guardian-relation').value,guardian_phone:$('#reg-guardian-phone').value,guardian_national_id:$('#reg-guardian-nin').value,guardian_consent:$('#reg-guardian-consent').checked};
    if(!payload.first_name_ar||!payload.last_name_ar||!payload.birth_date||!payload.phone||!payload.address){alert('يرجى إكمال الحقول الإلزامية');return}
    const res=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok){alert(data.error||'تعذر إرسال الطلب');return}alert('تم إرسال الطلب رقم '+data.application_no+' والمبلغ المتوقع '+data.expected_amount+' دج');document.querySelector('.modal-backdrop')?.remove();return
  }
  return legacyAction(a,el);
};

function roleDashboard(){
  const role=state.user?.role||'member';
  const labels={coach:'لوحة المدرب',swimmer_adult:'مساحة السباح',swimmer_minor:'مساحة السباح القاصر',parent:'لوحة الولي',member:'مساحة عضو النادي'};
  const names={coach:'المدرب',swimmer_adult:'السباح',swimmer_minor:'السباح',parent:'ولي السباح',member:'عضو النادي'};
  const coach=role==='coach', parent=role==='parent', swimmer=role.startsWith('swimmer');
  return `<div class="role-shell"><header class="role-top"><a class="brand"><span class="logo">🏊</span><span><b>الصدارة</b><small>فوج السباحة</small></span></a><div class="role-actions"><span>${labels[role]}</span><button class="icon-btn" data-action="theme" aria-label="تبديل الوضع الليلي" title="تبديل الوضع">${state.dark?'☀':'◐'}</button><button class="btn btn-outline" data-action="logout">تسجيل الخروج</button></div></header><main class="role-main"><section class="role-hero"><div><span class="eyebrow">${labels[role]}</span><h1>مرحبًا، ${names[role]} 👋</h1><p>${coach?'تابع حصصك وسجّل حضور السباحين بسهولة.':parent?'تابع حضور أبنائك واشتراكاتهم وتنبيهات النادي.':swimmer?'اطّلع على حصصك وحضورك وبطاقة الانخراط.':'آخر أخبار النادي وبرامجه بين يديك.'}</p></div><div class="role-mark">${coach?'🏊‍♂️':parent?'👨‍👩‍👧':swimmer?'🏊':'⭐'}</div></section><div class="role-cards"><article><span class="stat-icon blue">▦</span><small>الحصة القادمة</small><strong>${coach?'اليوم 16:00':swimmer?'الخميس 16:00':'الخميس 16:00'}</strong><p>${coach?'مجموعة التدريب':'مسبح الصدارة'}</p></article><article><span class="stat-icon mint">✓</span><small>${coach?'سباحون نشطون':parent?'حضور الأبناء':'نسبة الحضور'}</small><strong>${coach?'—':parent?'—':'—'}</strong><p>هذا الموسم</p></article><article><span class="stat-icon gold">▣</span><small>الاشتراك</small><strong>${role==='member'?'عضو':'الحالة'}</strong><p>الموسم الرياضي</p></article></div><div class="role-grid"><section class="panel"><div class="panel-head"><div><h3>${coach?'حصصي التدريبية':parent?'آخر حضور الأبناء':swimmer?'سجل حضوري':'آخر إعلانات النادي'}</h3><p>معلومات محدثة من إدارة النادي</p></div></div>${coach?'<div class="role-list"><div><b>الخميس · 16:00 — 18:00</b><span>مجموعة التدريب · مسبح الصدارة</span></div><div><b>السبت · 16:00 — 17:30</b><span>مجموعة التدريب · مسبح الصدارة</span></div></div>':parent?'<div class="role-list"><div><b>بيانات الأبناء</b><span>لا توجد بيانات مسجلة بعد</span></div><div><b>الاشتراك</b><span>تظهر المستحقات بعد الربط بالحساب</span></div></div>':swimmer?'<div class="role-list"><div><b>سجل الحضور</b><span>ستظهر السجلات بعد تسجيل الحصص</span></div><div><b>نسبة الحضور</b><span>لا توجد بيانات كافية بعد</span></div></div>':'<div class="role-list"><div><b>فتح التسجيل للموسم الجديد</b><span>التسجيل مفتوح لفوج السباحة</span></div><div><b>تذكير بالحصة التدريبية</b><span>يرجى الحضور قبل الموعد بـ 15 دقيقة</span></div></div>'}</section><section class="panel role-links"><h3>الوصول السريع</h3><button data-page="schedule">▦ البرنامج الأسبوعي</button><button data-page="attendance">✓ الحضور</button><button data-page="card">▣ بطاقة الانخراط</button></section></div></main></div>`;
}
const adminDashboard=dashboard;
dashboard=function(){return ['coach','swimmer_adult','swimmer_minor','parent','member'].includes(state.user?.role)?roleDashboard():adminDashboard()};
const currentAction=action;
function authMessage(text, kind='info') {
  const box = document.querySelector('#auth-message');
  if (box) { box.textContent = text; box.className = 'form-message ' + kind; }
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
    const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email,password})});
    const data=await res.json();
    if(!res.ok){authMessage(data.error||'تعذر تسجيل الدخول. تحقق من البيانات.','error');return}
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
    try{const credential=await window.sadaraPhoneConfirmation.confirm(code);const data={user:{id:credential.user.uid,name:credential.user.phoneNumber||'عضو النادي',role:'member',email:''}};state.user=data.user;state.page='home';save();document.querySelector('.modal-backdrop')?.remove();await syncApi();render();showToast('تم التحقق من رقم الهاتف وتسجيل الدخول.');}
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
  if(a==='print-registration-form'){printOfficialForms([{}]);return}
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

// minimal base declarations; the Sadara Core layers below rebind both names
function pageView(p){ return pageApplications(); }
function pageTitle(p){ return '\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629'; }
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
}

function cardMarkup(s,i){
  return '<article class="print-card" data-member="'+esc(s.id)+'">'
    +'<div class="print-card-brand"><span class="logo"></span><b>'+esc(CLUB.name)+'</b></div>'
    +'<div class="print-card-body"><div><strong>'+esc(s.name||'')+'</strong><small>'+esc(s.group||CLUB.unit)+'</small>'
    +'<small dir="ltr">No: '+esc(s.id||'')+'</small></div><div class="qr-code" data-qr="'+esc(s.id)+'"></div></div>'
    +'<footer><span>'+esc(CLUB.season)+'</span><span>'+esc(CLUB.phone)+'</span></footer></article>';
}
function pageCards(){
  const list=state.swimmers||[];
  const active=list.filter(s=>s.status==='نشط'||!s.status);
  return '<section class="card-intro"><div><span class="eyebrow">بطاقات 8.5 × 5.5 سم</span><h2>بطاقات انخراط<br>بـ QR للحضور.</h2>'
    +'<p>يمسح المشرف أو المدرب الرمز لتسجيل حضور السباح مباشرة.</p>'
    +'<div class="hero-actions"><button class="btn btn-primary" data-action="print-cards">🖨 طباعة كل البطاقات</button>'
    +'<button class="btn btn-outline" data-action="print-registration">🖨 استمارة الانخراط</button></div></div>'
    +'<div class="membership-card"><span>'+esc(CLUB.name)+'</span><b>🏊</b><strong>بطاقة العضو</strong><small>مقاس 8.5 × 5.5 سم</small><div><i dir="ltr">'+esc(CLUB.phone)+'</i><i>'+esc(CLUB.season)+'</i></div></div></section>'
    +'<div class="toolbar"><span class="page-description">'+active.length+' بطاقة جاهزة للطباعة — انقر "طباعة" لبطاقة واحدة.</span>'
    +'<div class="toolbar-group">'+printBtn('print-cards','طباعة الكل')+'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button></div></div>'
    +'<section class="card-print-grid" id="card-print-grid">'
    +(active.length?active.map(cardMarkup).join(''):'<div class="panel empty-cell">لا توجد بطاقات بعد اعتماد السباحين.</div>')
    +'</section>';
}

function pageGroups(){
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
  if(a==='print-registration'){printOfficialForms([{}]);return}
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

/* ---------- layers added after the baseline commit ---------- */

const CLUB_AR = 'النادي الرياضي الصدارة – غرداية';
const CLUB_FR = 'Clubsportif Sadara – Ghardaia';
const CLUB_MOTTO = 'أخلاق، احترام، وانضباط';
const STAR = '<svg viewBox="0 0 24 24" class="star"><path d="M12 2l2.6 6.3 6.8.4-5.2 4.3 1.7 6.6L12 16l-5.9 3.6 1.7-6.6L2.6 8.7l6.8-.4z"/></svg>';
const ORNAMENT = '<svg class="orn" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 30 Q25 6 50 30 T100 30 T150 30 T200 30" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M0 34 Q25 10 50 34 T100 34 T150 34 T200 34" fill="none" stroke="currentColor" stroke-width=".7" opacity=".6"/></svg>';

/* ---------------------- ربط وثائق النادي ---------------------- */
function coaches(){return (state.applications||[]).filter(a=>a.application_type==='coach');}
function coachAccounts(){return (state.cards||[]).filter(c=>c.role==='coach'||c.kind==='coach');}
function swimmersActive(){return (state.swimmers||[]).filter(s=>s.status==='نشط'||!s.status);}
function luxPreviewBox(items,kind){
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
  return '<article class="print-card" data-member="'+esc(s.id)+'">'
    +'<div class="card-band"></div>'
    +'<div class="print-card-inner">'
    +'<div class="print-card-rail"><span class="logo"></span><i>'+esc(CLUB.unit)+'</i></div>'
    +'<div class="print-card-content">'
    +'<div class="print-card-brand"><b>'+esc(CLUB.name)+'</b><small>'+esc(CLUB.season)+'</small></div>'
    +'<div class="print-card-body"><div><strong>'+esc(s.name||'')+'</strong>'
    +'<small>'+esc(s.group||CLUB.unit)+'</small><small class="id" dir="ltr">No: '+esc(s.id||'')+'</small></div>'
    +'<div class="qr-code" data-qr="'+esc(s.id)+'"></div></div>'
    +'<footer><span>'+esc(CLUB.address)+'</span><span dir="ltr">'+esc(CLUB.phone)+'</span></footer>'
    +'</div></div></article>';
}
function pageCards(){
  const list=state.swimmers||[];
  const active=list.filter(s=>s.status==='نشط'||!s.status);
  const coachApps=coaches();
  return '<section class="card-intro"><div><span class="eyebrow">بطاقات 8.5 × 5.5 سم</span><h2>بطاقات انخراط<br>بـ QR للحضور.</h2>'
    +'<p>يمسح المشرف أو المدرب الرمز لتسجيل حضور السباح مباشرة.</p>'
    +'<div class="hero-actions"><button class="btn btn-primary" data-action="print-cards">🖨 طباعة كل البطاقات</button>'
    +'<button class="btn btn-outline" data-action="print-registration">🖨 استمارة الانخراط</button></div></div>'
    +'<div class="membership-card"><span>'+esc(CLUB.name)+'</span><b>🏊</b><strong>بطاقة العضو</strong><small>مقاس 8.5 × 5.5 سم</small><div><i dir="ltr">'+esc(CLUB.phone)+'</i><i>'+esc(CLUB.season)+'</i></div></div></section>'

    +'<div class="toolbar"><span class="page-description">'+active.length+' بطاقة انخراط جاهزة للطباعة — بطاقة واحدة بنقرة.</span>'
    +'<div class="toolbar-group">'+printBtn('print-cards','طباعة الكل')+'<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button></div></div>'
    +'<section class="card-print-grid" id="card-print-grid">'
    +(active.length?active.map(cardMarkup).join(''):'<div class="panel empty-cell">لا توجد بطاقات بعد اعتماد السباحين.</div>')
    +'</section>'

    +'<div class="toolbar" style="margin-top:26px"><span class="page-description">البطاقات الفنية — تصميم فاخر بالهوية البصرية للنادي، للسباحين والمدربين.</span>'
    +'<div class="toolbar-group">'
    +'<button class="btn btn-primary" data-action="print-lux-swimmers">🎨 بطاقات فنية للسباحين</button>'
    +'<button class="btn btn-outline" data-action="print-lux-coaches">🎨 بطاقات فنية للمدربين</button>'
    +'</div></div>'
    +luxPreviewBox(active,'swimmer')
    +(coachApps.length?'<div class="toolbar" style="margin-top:20px"><span class="page-description">معاينة البطاقات الفنية للمدربين ('+coachApps.length+')</span>'
      +'<div class="official-forms-list">'+coachApps.map(c=>'<button data-action="print-coach-luxtour" data-id="'+esc(c.id)+'"><b>'+esc(c.coach_name||'مدرب')+'</b><span>'+esc(c.coach_phone||c.coach_email||'')+' · بطاقة فنية واحدة</span></button>').join('')+'</div></div>'
      +luxPreviewBox(coachApps,'coach'):'');
}

/* applications page: official form printing */
const corePageView2=pageView;
pageView=function(p){
  if(p==='applications'){
    const list=(state.applications||[]).filter(x=>x.application_type!=='coach');
    const extra=list.length?'<section class="panel"><div class="panel-head"><div><h3>استمارة الإلحاق الرسمية</h3><p>تُطبع بتخطيط استمارة النادي — كل معلومة في مكانها</p></div>'
      +'<div class="toolbar-group"><button class="btn btn-primary" data-action="print-official-forms-all">🖨 كل الاستمارات</button>'
      +'<button class="btn btn-outline" data-action="print-official-blank">استمارة فارغة</button></div></div>'
      +'<div class="official-forms-list">'+list.map(x=>'<button data-action="print-official-form" data-id="'+esc(x.id)+'"><b>'+esc(appName(x))+'</b><span>'+esc(x.application_no||'')+' · '+(x.status==='approved'?'مقبول':'قيد المراجعة')+'</span></button>').join('')+'</div>'
      +'</section>':'';
    return '<div class="page-root" id="page-root">'+pageApplications()+extra+'</div>';
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

/* ---------- 2) البطاقة الفنية: الرقم تحت الصورة ---------- */
function luxuryCard(p, kind){
  const coach = kind === 'coach';
  const roleLabel = coach ? 'مدرب' : 'سباح';
  const name = p.coach_name || p.name || '';
  const fr = p.first_name_fr ? (p.first_name_fr + ' ' + (p.last_name_fr || '')).trim() : '';
  const no = p.membership_no || p.id || '';
  const group = p.group_name || '';
  const rows = coach
    ? [['التخصص', p.specialty || 'مدرب سباحة'], ['سنوات الخبرة', (p.experience || '—') + ' سنة'],
       ['رقم الهاتف', p.phone || '—'], ['البريد الإلكتروني', p.email || '—']]
    : [['الفوج', group || '—'], ['رقم الهاتف', p.phone || '—'],
       ['فصيلة الدم', p.blood_group || '—'], ['تاريخ الالتحاق', p.joined || '—']];
  return '' +
  '<article class="lux-card ' + (coach ? 'is-coach' : 'is-swimmer') + '" data-no="' + esc(no) + '">' +
    '<div class="lux-side">' +
      '<span class="lux-stars">' + STAR + STAR + STAR + '</span>' +
      '<img class="lux-logo" src="assets/logo.png" alt="">' +
      '<span class="lux-vert">نادي الصدارة • فوج السباحة</span>' +
    '</div>' +
    '<div class="lux-main">' +
      '<div class="lux-top">' +
        '<div class="lux-club"><b>' + CLUB_AR + '</b><small dir="ltr">' + CLUB_FR + '</small></div>' +
        '<span class="lux-role">' + roleLabel + '</span>' +
      '</div>' +
      '<div class="lux-body">' +
        '<div class="lux-photo">' +
          '<img src="assets/logo.png" alt="">' +
          '<span class="lux-photo-label">الصورة الشخصية</span>' +
          '<b class="lux-no" dir="ltr">' + esc(no) + '</b>' +
        '</div>' +
        '<div class="lux-info">' +
          '<h3>' + esc(name) + '</h3>' +
          '<p class="lux-fr" dir="ltr">' + esc(fr || '—') + '</p>' +
          ORNAMENT +
          '<div class="lux-rows">' + rows.map(r => '<div class="lux-row"><i>' + esc(r[0]) + '</i><b>' + esc(r[1]) + '</b></div>').join('') + '</div>' +
        '</div>' +
        '<div class="lux-qr"><div class="qr-code" data-qr="' + esc(no) + '"></div><small>امسح لتسجيل الحضور</small></div>' +
      '</div>' +
      '<div class="lux-foot"><span>' + esc(CLUB.season) + '</span><span>' + esc(CLUB.address) + '</span><span dir="ltr">' + esc(CLUB.phone) + '</span></div>' +
    '</div>' +
  '</article>';
}

function cardSheet(list, kind){
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
  return Object.assign({}, s, p || {}, { membership_no:s.id, group_name:s.group });
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
  return '<section class="card-intro"><div><span class="eyebrow">بطاقة انخراط النادي</span><h2>بطاقات أنيقة<br>بـ QR للحضور.</h2>'
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
    +'<p>اعرضها عند المدرب أو المشرف، أو امسح رمز QR لتسجيل حضورك.</p>'
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
const FORM_SPOTS = [
  { id: 'membership', y: 75.9, x1: 170, x2: 60 },
  { id: 'first_name', y: 85.8, x1: 170, x2: 60 },
  { id: 'last_name', y: 95.6, x1: 170, x2: 60 },
  { id: 'birth_date', y: 105.7, x1: 170, x2: 60 },
  { id: 'address', y: 115.8, x1: 172, x2: 62 },
  { id: 'blood_group', y: 125.5, x1: 170, x2: 60 },
  { id: 'phone', y: 137.6, x1: 170, x2: 60 },
  { id: 'medical_person', y: 149.8, x1: 150, x2: 60 },
  { id: 'doctor', y: 181.4, x1: 168, x2: 90 },
  { id: 'parent_name', y: 210.2, x1: 200, x2: 140 },
  { id: 'parent_birth', y: 210.2, x1: 100, x2: 55 },
  { id: 'parent_nationality', y: 210.2, x1: 44, x2: 14 },
  { id: 'parent_id', y: 219.4, x1: 200, x2: 120 },
  { id: 'card_issued_at', y: 219.4, x1: 108, x2: 55 },
  { id: 'card_place', y: 219.4, x1: 44, x2: 14 },
  { id: 'authorised_for', y: 229.1, x1: 200, x2: 120 },
  { id: 'child_place', y: 229.1, x1: 112, x2: 55 },
  { id: 'signature', y: 238.8, x1: 150, x2: 60 }
];
function formValues(a){
  const v = (k, fb) => (a && a[k] ? a[k] : (fb || ''));
  const bd = a && a.birth_date ? String(a.birth_date) : '';
  const dateAr = /^\d{4}-\d{2}-\d{2}$/.test(bd) ? bd.split('-').reverse().join('/') : bd;
  return {
    membership: v('membership_no', a && a.application_no ? String(a.application_no).slice(-8) : ''),
    first_name: v('first_name_ar'),
    last_name: v('last_name_ar'),
    birth_date: dateAr,
    address: v('address'),
    blood_group: v('blood_group'),
    phone: v('phone'),
    medical_person: (v('first_name_ar') + ' ' + v('last_name_ar')).trim(),
    doctor: v('doctor'),
    parent_name: (v('guardian_first_name') + ' ' + v('guardian_last_name')).trim(),
    parent_birth: v('guardian_birth_date'),
    parent_nationality: v('guardian_nationality', 'جزائري'),
    parent_id: v('guardian_national_id') || v('national_id'),
    card_issued_at: v('card_issue_date'),
    card_place: v('card_issue_place', 'غرداية'),
    authorised_for: v('guardian_child', v('first_name_ar')),
    child_place: v('child_place', 'غرداية'),
    signature: ''
  };
}
function formPhotoData(p){
  const src = p && (p.photo || p.photoDataUrl || p.photo_url);
  if (src && /^(data:|https?:)/.test(src)) return src;
  return '';
}
function overlaySheet(a){
  const vals = formValues(a || {});
  const spots = FORM_SPOTS.map(s => {
    const text = vals[s.id] === undefined ? '' : String(vals[s.id]);
    return '<span class="f-spot" style="top:' + s.y + 'mm;right:' + s.x1 + 'mm;width:' + (s.x1 - s.x2) + 'mm">' + esc(text) + '</span>';
  }).join('');
  const photo = formPhotoData(a);
  return '<section class="f-page">'
    + '<img class="f-bg" src="' + FORM_BG + '" alt="">'
    + '<div class="f-photo" style="left:' + PHOTO_BOX.x + 'mm;top:' + PHOTO_BOX.y + 'mm;width:' + PHOTO_BOX.w + 'mm;height:' + PHOTO_BOX.h + 'mm">'
    + (photo ? '<img src="' + esc(photo) + '" alt="">' : '<span>الصورة</span>')
    + '</div>'
    + spots
    + '</section>';
}
function officialFormCSS(){
  return '' +
'@page{size:A4 portrait;margin:0}' +
'@font-face{font-family:"CairoFallback";src:local("Cairo"),local("Tajawal"),local("Segoe UI")}' +
'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
'html,body{margin:0;padding:0;background:#fff}' +
'body{font-family:Cairo,"CairoFallback","Segoe UI",Tahoma,Arial,sans-serif;color:#12333f}' +
'.f-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page;margin:0 auto}' +
'.f-page:last-child{page-break-after:auto;break-after:auto}' +
'.f-bg{position:absolute;inset:0;width:210mm;height:297mm;object-fit:fill;display:block;user-select:none}' +
'.f-spot{position:absolute;display:flex;align-items:flex-end;justify-content:flex-start;' +
  'font-size:12.5pt;line-height:1.05;font-weight:700;color:#0b3b46;letter-spacing:-.1px;' +
  'padding-bottom:.3mm;white-space:nowrap;overflow:hidden;text-overflow:clip;' +
  'direction:rtl;text-align:right;background:transparent}' +
'.f-photo{position:absolute;overflow:hidden;border-radius:2mm;background:#fff}' +
'.f-photo img{width:100%;height:100%;object-fit:cover;display:block}' +
'.f-photo span{position:absolute;inset:0;display:grid;place-items:center;font-size:9pt;color:#9db4bb;letter-spacing:1px}';
}
function printOfficialForms(list){
  const items = (Array.isArray(list) ? list : [list]).filter(x => x !== undefined);
  if (!items.length) { showToast('لا توجد بيانات لطباعة الاستمارة.', 'error'); return; }
  const pages = items.map(a => overlaySheet(a && Object.keys(a).length ? a : null)).join('');
  const doc = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
    + '<title>استمارة الإلحاق — ' + CLUB_AR + '</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=block" rel="stylesheet">'
    + '<style>' + officialFormCSS() + '</style></head><body>' + pages
    + '</body></html>';
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) { showToast('اسمح بالنوافذ المنبثقة لطباعة الاستمارة.', 'error'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
  try {
    const go = () => {
      if (w.document.fonts && w.document.fonts.ready) { w.document.fonts.ready.then(() => setTimeout(() => w.print(), 120)); }
      else setTimeout(() => w.print(), 600);
    };
    if (w.document.readyState === 'complete') setTimeout(go, 900);
    else w.addEventListener('load', () => setTimeout(go, 200));
  } catch (_) { /* printing is still available from the popup menu */ }
}

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

/* the file input is bound on every render */
bind=function(){
  baseBind();
  document.querySelectorAll('[data-role-page]').forEach(e=>e.onclick=()=>{state.rolePage=e.dataset.rolePage;save();render()});
  const live=(sel,fn)=>{const el=document.querySelector(sel);if(el){el.oninput=fn;el.onchange=fn;el.onkeyup=fn}};
  live('#app-search',e=>{state.appQuery=e.target.value;renderPageOnly()});
  live('#app-filter',e=>{state.appFilter=e.target.value;renderPageOnly()});
  live('#user-search',e=>{state.userQuery=e.target.value;renderPageOnly()});
  live('#group-filter',e=>{state.groupFilter=e.target.value;renderPageOnly()});
  live('#attendance-group',e=>{state.attendanceGroup=e.target.value;renderPageOnly()});
  const file=document.querySelector('#my-photo');
  if(file) file.onchange=()=>action('upload-my-photo',{files:file.files});
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
  const vals = formValues(a || {});
  const spots = FORM_SPOTS.map(s => {
    const text = vals[s.id] === undefined ? '' : String(vals[s.id]);
    return '<span class="f-spot" style="top:' + s.y + 'mm;right:' + s.x1 + 'mm;width:' + (s.x1 - s.x2) + 'mm">' + esc(text) + '</span>';
  }).join('');
  const photo = formPhotoData(a);
  return '<section class="f-page">'
    + '<img class="f-bg" src="' + esc(FORM_BG_URL) + '" alt="استمارة النادي">'
    + '<div class="f-photo" style="left:' + PHOTO_BOX.x + 'mm;top:' + PHOTO_BOX.y + 'mm;width:' + PHOTO_BOX.w + 'mm;height:' + PHOTO_BOX.h + 'mm">'
    + (photo ? '<img src="' + esc(photo) + '" alt="صورة المنخرط">' : '')
    + '</div>'
    + spots
    + '</section>';
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
'@media print{.f-page{width:210mm;height:297mm;margin:0}}' +
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
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) { showToast('اسمح بالنوافذ المنبثقة لطباعة الاستمارة.', 'error'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
  const go = () => {
    try {
      const ready = w.document.fonts && w.document.fonts.ready ? w.document.fonts.ready : Promise.resolve();
      ready.then(() => setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 260));
    } catch (_) { setTimeout(() => { try { w.print(); } catch (_) {} }, 700); }
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
  const no = p.membership_no || p.id || '';
  const photo = (p.photo && /^(data:|https?:)/.test(p.photo)) ? p.photo : '';
  const phone = p.phone || CLUB.phone;
  const rows = coach
    ? [['التخصص', p.specialty || 'مدرب سباحة'], ['سنوات الخبرة', (p.experience || '—') + ' سنة'],
       ['البريد الإلكتروني', p.email || '—'], ['الفوج', p.group_name || 'الطاقم الفني']]
    : [['الفوج', p.group_name || '—'], ['فصيلة الدم', p.blood_group || '—'],
       ['تاريخ الالتحاق', p.joined || '—'], ['الموسم', CLUB.season]];
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
          '<b class="lux-no" dir="ltr">' + esc(no) + '</b>' +
        '</div>' +
        '<div class="lux-info">' +
          '<h3>' + esc(name) + '</h3>' +
          '<p class="lux-fr" dir="ltr">' + esc(fr || '—') + '</p>' +
          ORNAMENT +
          '<div class="lux-rows">' + rows.map(r => '<div class="lux-row"><i>' + esc(r[0]) + '</i><b>' + esc(r[1]) + '</b></div>').join('') + '</div>' +
        '</div>' +
        '<div class="lux-qr">' +
          '<div class="qr-code" data-qr="' + esc(no) + '"></div>' +
          '<b class="lux-phone" dir="ltr">' + esc(phone) + '</b>' +
          '<small>امسح لتسجيل الحضور</small>' +
        '</div>' +
      '</div>' +
      '<div class="lux-foot"><span>' + esc(CLUB.season) + '</span><span>' + esc(CLUB.address) + '</span></div>' +
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
    (state.applications || []).map(a => [a.application_no || a.id, a.coach_name || a.first_name_ar, a.last_name_ar || '',
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
  const receiptNo = (a.application_no || 'APP') + '-REC';
  const row = l => '<tr><td>' + esc(l.label) + (l.detail ? '<br><small>' + esc(l.detail) + '</small>' : '') +
    '</td><td class="num">' + esc(money(l.amount)) + '</td></tr>';
  return '<section class="pk-page pk-receipt">' +
    '<div class="pk-inner">' +
      '<header class="pk-head">' +
        '<div><h1>النادي الرياضي الصدارة</h1><p>فوج السباحة — ' + esc(CLUB.city) + ' · وصل استلام مستحقات</p></div>' +
        '<div class="pk-stamp"><b>وصل</b><span dir="ltr">' + esc(receiptNo) + '</span></div>' +
      '</header>' +
      '<div class="pk-meta">' +
        '<span>رقم الطلب</span><b dir="ltr">' + esc(a.application_no || '—') + '</b>' +
        '<span>تاريخ الاستلام</span><b>' + esc(today.toISOString().slice(0, 10)) + '</b>' +
        '<span>الاسم واللقب</span><b>' + esc(appName(a) || '—') + '</b>' +
        '<span>الصفة</span><b>' + esc(catLabel(a.category === 'minor' ? 'minor' : 'adult')) + '</b>' +
        '<span>الفوج / المنشأة</span><b>' + esc(a.facility || '—') + '</b>' +
        '<span>الهاتف</span><b dir="ltr">' + esc(a.phone || '—') + '</b>' +
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
        '<span>' + esc(CLUB.address) + ' · <span dir="ltr">' + esc(CLUB.phone) + '</span></span>' +
      '</footer>' +
    '</div>' +
  '</section>';
}

/* ---------------- صفحة النظام الداخلي ---------------- */
function regulationsSheet() {
  return '<section class="pk-page pk-regs">' +
    '<div class="pk-inner">' +
      '<header class="pk-head">' +
        '<div><h1>النظام الداخلي</h1><p>نادي الصدارة الرياضي — فوج السباحة · ' + esc(CLUB.season) + '</p></div>' +
        '<div class="pk-stamp"><b>وثيقة</b><span>وقّع هنا</span></div>' +
      '</header>' +
      '<div class="pk-regs-body"><img src="' + esc(assetUrl('assets/internal-regulations.jpg')) + '" alt="النظام الداخلي"></div>' +
      '<div class="pk-sign">' +
        '<div><b>المنخرط / الولي</b><span class="pk-line"></span><small>التاريخ والتوقيع</small></div>' +
        '<div><b>المدرب المسؤول</b><span class="pk-line"></span><small>التوقيع</small></div>' +
        '<div class="pk-seal"><b>ختم النادي</b><span class="pk-ring"></span></div>' +
      '</div>' +
    '</div>' +
  '</section>';
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
'.pk-regs{background:#fdfefe}' +
'.pk-regs .pk-inner{padding:14mm 15mm 12mm}' +
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
'.pk-regs-body{flex:1;margin:5mm 0;display:grid;place-items:start center;overflow:hidden}' +
'.pk-regs-body img{max-width:100%;max-height:225mm;object-fit:contain;border:1px solid #dbe6ec;border-radius:2mm}' +
'@media print{.pk-hint{display:none}}' +
'.pk-hint{margin:0 0 4mm;background:#eaf6f7;border-right:4px solid #0e8f9c;padding:3mm 4mm;font-size:9pt;border-radius:1mm}' +
'.pk-hint b{color:#071a35}';
}

/* ---------------- بناء الحزمة وطباعتها ---------------- */
function packetDocument(app, what) {
  const only = what || 'all';
  const pages = [];
  if (only === 'all' || only === 'form') pages.push(overlaySheet(app));
  if (only === 'all' || only === 'receipt') pages.push(receiptSheet(app));
  if (only === 'all' || only === 'regs') pages.push(regulationsSheet());
  const label = only === 'all'
    ? '\u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629\u060c \u0648\u0635\u0644 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0627\u062a\u060c \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a.'
    : only === 'receipt' ? '\u0648\u0635\u0644 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0627\u062a.'
      : only === 'regs' ? '\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a.'
        : '\u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629.';
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>\u062d\u0632\u0645\u0629 \u062a\u0633\u062c\u064a\u0644 \u2014 ' + esc(CLUB_AR) + ' \u2014 ' + esc(app.application_no || '') + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=block" rel="stylesheet">' +
    '<style>' + packetCSS() + '</style></head><body>' +
    '<p class="pk-hint"><b>\u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0637\u0628\u0627\u0639\u0629:</b> \u0627\u0633\u062a\u0639\u0645\u0644 Ctrl+P \u062b\u0645 \u0627\u062e\u062a\u0631 \u00ab\u062d\u0641\u0638 \u0628\u0635\u064a\u063a\u0629 PDF\u00bb. ' +
    '\u062a\u062d\u062a\u0648\u064a \u0647\u0630\u0647 \u0627\u0644\u0648\u062b\u064a\u0642\u0629 ' + pages.length + ' \u0635\u0641\u062d\u0629: ' + label + '</p>' +
    pages.join('') + '</body></html>';
}
function printPacket(app, what) {
  const doc = packetDocument(app, what);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) { showToast('اسمح بالنوافذ المنبثقة لطباعة الحزمة.', 'error'); return false; }
  try {
    win.document.open();
    win.document.write(doc);
    win.document.close();
  } catch (_) { /* the popup raced the click */ }
  const go = () => {
    try {
      const fonts = win.document.fonts && win.document.fonts.ready ? win.document.fonts.ready : Promise.resolve();
      fonts.then(() => setTimeout(() => { try { win.focus(); win.print(); } catch (_) {} }, 320));
    } catch (_) { setTimeout(() => { try { win.print(); } catch (_) {} }, 800); }
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
    '<p class="done-no">رقم الطلب <b dir="ltr">' + esc(a.application_no || '—') + '</b></p>' +
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
    '<p>طلب <b dir="ltr">' + esc(app.application_no || app.id) + '</b> — ' + esc(appName(app)) + '</p></div>' +
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
    '<p>طلب <b dir="ltr">' + esc(app.application_no || app.id) + '</b> — ' + esc(appName(app)) + '</p></div>' +
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

/* يفضّل IndexedDB، ويرجع إلى الحقل النصي حين لا تتوفر */
async function persistPhoto(dataUrl) {
  const key = (state.user && state.user.id) || 'guest';
  try {
    await photoStorePut(key, dataUrl);
    return { photo: '', photo_in_store: true };
  } catch (_) {
    return { photo: dataUrl, photo_in_store: false };
  }
}
async function restorePhoto() {
  if (state.profile && state.profile.photo) return state.profile.photo;
  const key = (state.user && state.user.id) || 'guest';
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
      const reason = window.prompt('سبب الرفض (اختياري):', 'الوثائق ناقصة');
      if (reason === null) return;
      try{
        await api('/api/applications/'+encodeURIComponent(el.dataset.id),'PATCH',{status:'rejected',decision_reason:reason});
        logDecision('رفض طلب','application',el.dataset.id,{reason:reason});
        showToast('تم رفض الطلب.');
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
    confirmDialog('تسجيل حضور ' + list.length + ' سباح اليوم؟','تأكيد الجميع', async () => {
      let done=0;
      for(const s of list){
        try{ await api('/api/attendance','POST',{member_id:s.id,swimmer_id:s.id,status:'present'}); done++; }
        catch(_){}
      }
      list.forEach(s=>{const b=state.attendance[s.id]=state.attendance[s.id]||[];b.push({status:'present',at:new Date().toISOString(),date:todayISO()});
        (state.attendanceByDay[todayISO()]||(state.attendanceByDay[todayISO()]={}))[s.id]='present';});
      logDecision('تأكيد حضور الجميع','attendance','today',{count:done});
      save(); render(); showToast('تم تسجيل حضور ' + done + ' سباح.');
    });
    return;
  }
  if(a==='reset-attendance'){
    confirmDialog('تصفير سجل حضور اليوم على هذه الشاشة؟','تصفير', () => {
      state.attendance={}; state.attendanceByDay={};
      logDecision('تصفير الحضور','attendance','today',{});
      save(); render(); showToast('تم تصفير سجل اليوم.');
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
