/* ==========================================================
   وثائق النادي الرسمية — استمارة الإلحاق والبطاقات الفنية
   ========================================================== */
const CLUB_AR = 'النادي الرياضي الصدارة – غرداية';
const CLUB_FR = 'Clubsportif Sadara – Ghardaia';
const CLUB_MOTTO = 'أخلاق، احترام، وانضباط';
const ALGERIA_SVG = '<svg viewBox="0 0 120 96" class="dz" aria-label="الجزائر"><path fill="#1d6b3f" d="M8 44c14-6 22-14 34-16 16-3 22 4 34 2 10-2 14-8 22-6 6 2 6 10 2 14-6 6-4 12-14 16-12 5-18 2-28 6-12 5-16 14-28 14-10 0-16-6-20-14-4-7-6-13-2-16z"/><path fill="#d21034" d="M62 26a13 13 0 100 26 15 15 0 010-26z"/><path fill="#1d6b3f" d="M70 30l3 7 7 .6-5.4 4.6 1.7 7-6.3-3.8-6.3 3.8 1.7-7L61 33.6l7-.6z"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" class="star"><path d="M12 2l2.6 6.3 6.8.4-5.2 4.3 1.7 6.6L12 16l-5.9 3.6 1.7-6.6L2.6 8.7l6.8-.4z"/></svg>';

function chk(label){return '<label><span class="box"></span> ' + esc(label) + '</label>';}
function appFullName(a){return appName(a);}
function appGender(a){return a.gender==='f'?'أنثى':a.gender==='F'?'أنثى':'ذكر';}
function appBirthDate(a){
  const v=String(a.birth_date||'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v.split('-').reverse().join('/');
  return v||'';
}
function appWilaya(a){return a.wilaya||a.birth_place||'';}
function regNo(a){return a.application_no||a.id||'';}
function memberNoFor(a){return a.membership_no||(a.application_no?'SDR-'+String(a.application_no).slice(-4):'—');}

/* ---------------- استمارة الإلحاق الرسمية (A4) ---------------- */
function officialFormSheet(applicant, opts){
  const blank = !applicant || opts && opts.blank;
  const a = applicant || {};
  const minor = (a.category || 'minor') === 'minor';
  const v = (key, fallback) => (blank ? '' : (a[key] || fallback || ''));
  const line = (label, value, cls) => '<div class="f-row ' + (cls || '') + '"><span class="f-label">' + label + '</span><span class="f-value">' + esc(String(value)) + '</span></div>';
  const photo = '<div class="photo-box"><div class="photo-inner"><span>PHOTO</span><i>صورة شخصية 3×4</i></div></div>';

  const head = '' +
    '<header class="f-head">' +
      '<div class="f-head-side">' + ALGERIA_SVG + '</div>' +
      '<div class="f-head-main">' +
        '<h1>' + CLUB_AR + '</h1>' +
        '<h2 dir="ltr">' + CLUB_FR + '</h2>' +
        '<p class="motto">' + CLUB_MOTTO + '</p>' +
      '</div>' +
      '<div class="f-head-side logo"><img src="assets/logo.png" alt="شعار النادي"><span class="sports">أ.trackers • إCitations • انضباط<br>ب.medical الصدارة</span></div>' +
    '</header>' +
    '<div class="f-title">بطاقة المعلومات للإلخاق بالنادي</div>' +
    '<div class="f-dots"></div>';

  const identity = '' +
    '<section class="f-ident">' +
      '<div class="f-photo-col">' + line('رقم التسجيل', v('membership_no', memberNoFor(a))) + photo + '</div>' +
      '<div class="f-fields">' +
        line('رقم الاستمارة', v('application_no', regNo(a))) +
        line('الإسم', v('first_name_ar')) +
        line('اللقب', v('last_name_ar')) +
        line('تاريخ الميلاد', v('birth_date', appBirthDate(a))) +
        line('العنوان', v('address')) +
        line('فصيلة الدم', v('blood_group')) +
        line('رقم الهاتف', v('phone')) +
        line('البلدية / الولاية', v('wilaya', appWilaya(a))) +
      '</div>' +
    '</section>';

  const sport = '' +
    '<h2 class="f-section">شهادة طبية</h2>' +
    '<div class="f-sec-body">' +
      '<div class="f-row"><span class="f-label">أنا المعني أسفله (ة)</span><span class="f-value">' + esc(v('first_name_ar') + ' ' + v('last_name_ar') || 'المعني') + '</span></div>' +
      '<div class="f-checks">' +
        chk('صاحب البطاقة') + chk('وليّ الأمر') + chk('المعني') +
      '</div>' +
      '<p class="f-para">وأضحى بأن المعني غير مصاب ب <span class="blank sm"></span> (بأي مرض مزمن)، وأن الفحص الذي تم إجراؤه على <span class="blank sm"></span> (طبيب / مخبر)، لم يكشف عن أعراض الأمراض المتنقلة والمزمنة وأمراض الجهاز التنفسي، لم يكشف عن أي مرض من هذه الأمراض.</p>' +
      '<h3 class="f-sub">فحص الأمراض المعدية</h3>' +
      '<p class="f-para">وأضحى بأن المعني (ة) سليم (ة) من مرض <span class="blank sm"></span>.</p>' +
      line('الطبيب (ة)', v('doctor'), 'doc') +
    '</div>';

  const consent = '' +
    '<h2 class="f-section">تصريح أبوي</h2>' +
    '<div class="f-sec-body">' +
      '<div class="f-row"><span class="f-label">أنا الممضي أسفله (ة)</span><span class="f-value">' + esc(v('guardian_first_name') + ' ' + v('guardian_last_name')) + '</span></div>' +
      '<div class="f-two">' +
        line('المولد (ة) بتاريخ', v('guardian_birth_date')) +
        line('بن', v('guardian_last_name')) +
      '</div>' +
      line('حامل (ة) لبطاقة التعريف رقم', v('national_id', v('guardian_national_id'))) +
      line('الصادرة بتاريخ', v('card_issue_date')) + line('عن', v('card_issue_place')) +
      '<div class="f-row"><span class="f-label">أصرح لـ</span><span class="f-value">' + esc(CLUB_AR) + '</span></div>' +
      '<p class="f-para">بأنه مولود لـ <span class="blank sm"></span> ، لنشاط السباحة أو النشاط الرياضي بنادي الصدارة غرداية.</p>' +
      '<p class="f-privacy">أوافق للنادي، وفقا للشروط المنصوص عليها في القانون، بنقل المعطيات ذات الطابع الشخصي و معالجتها.</p>' +
      '<div class="f-two"><div class="f-sign">مضا و توقيع <span class="blank"></span></div><div class="f-sign">التاريخ <span class="blank"></span></div></div>' +
    '</div>';

  const notes = '' +
    '<section class="f-notes"><h2>ملاحظات</h2><div class="f-notes-box"></div></section>' +
    '<div class="f-foot">02 صورة شخصية — مستخرجة من بطاقة التعريف الوطني — نسخة محفوظة لدى النادي — حقوق النادي</div>' +
    '<div class="f-bar"><span class="f-bar-note">الرياضة للأقل من 18 سنة تشترط تصريحا أباويًا لدى البلدية</span>'
    + '<span class="f-contact"><b>☎</b> ' + CLUB.phone + ' <b>✉</b> ' + CLUB.email + ' <b>f</b> nadiSadara47</span></div>';

  return head + identity + sport + consent + notes;
}

function officialFormCSS(){
  return '' +
'@page{size:A4 portrait;margin:9mm}' +
'*{box-sizing:border-box}' +
'html,body{margin:0;padding:0;background:#fff;color:#16323f;font-family:"Cairo","Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
'.sheet{width:100%;max-width:196mm;margin:0 auto;padding:6mm 7mm;position:relative;page-break-after:always;overflow:hidden}' +
'.sheet:last-child{page-break-after:auto}' +
'.sheet:before{content:"";position:absolute;inset:0;background-image:radial-gradient(#0d5f6b22 1.1px,transparent 1.1px);background-size:9px 9px;opacity:.55;pointer-events:none}' +
'.sheet>*{position:relative}' +
'.f-dots{position:absolute;inset:0;background-image:radial-gradient(#0f4d5c14 1px,transparent 1px);background-size:14px 14px;pointer-events:none}' +
'.f-head{display:grid;grid-template-columns:26mm 1fr 30mm;gap:3mm;align-items:center;border-bottom:1px solid #c9a24a;padding-bottom:2mm}' +
'.f-head-side{text-align:center}' +
'.f-head-side .dz{width:23mm;height:auto}' +
'.f-head-main{text-align:center}' +
'.f-head-main h1{margin:0;font-size:16pt;color:#0b3b46;letter-spacing:.2px}' +
'.f-head-main h2{margin:1mm 0 0;font-size:11pt;font-weight:500;color:#3c6b78}' +
'.f-head-main .motto{margin:1mm 0 0;font-size:9.5pt;color:#1c5a68;font-weight:700}' +
'.f-head-side.logo img{width:20mm;height:auto;display:block;margin:0 auto}' +
'.f-head-side .sports{font-size:6.5pt;color:#2b6470;line-height:1.5;margin-top:.6mm}' +
'.f-title{text-align:center;font-size:15pt;font-weight:800;color:#0b3b46;margin:2mm 0 1mm}' +
'.f-ident{display:grid;grid-template-columns:34mm 1fr;gap:4mm;margin-bottom:1mm}' +
'.f-photo-col .f-row{margin-bottom:1mm}' +
'.photo-box{width:30mm;height:38mm;border:1px solid #16414d;border-radius:3mm;background:#fff;display:grid;place-items:center}' +
'.photo-inner{text-align:center;color:#8aa7b0}' +
'.photo-inner span{display:block;font-size:10pt;letter-spacing:2px}' +
'.photo-inner i{display:block;font-size:6pt;font-style:normal;margin-top:1mm}' +
'.f-fields .f-row{margin-bottom:1.6mm}' +
'.f-row{display:flex;align-items:flex-end;gap:2mm}' +
'.f-label{font-size:9.5pt;font-weight:700;color:#16414d;white-space:nowrap}' +
'.f-value{flex:1;min-height:5mm;border-bottom:1.2px solid #2b6470;font-size:10pt;font-weight:600;padding:0 1mm .6mm;color:#0b3b46}' +
'.f-section{display:flex;align-items:center;justify-content:center;gap:4mm;margin:2.5mm 0 1.5mm;font-size:14pt;font-weight:800;color:#12a0a8;white-space:nowrap}' +
'.f-section:before,.f-section:after{content:"";height:2.6mm;flex:1;border-radius:1mm}' +
'.f-section:before{background:linear-gradient(90deg,#eaf7f8,#0e6f78)}' +
'.f-section:after{background:linear-gradient(270deg,#eaf7f8,#0e6f78)}' +
'.f-sec-body{padding:0 2mm}' +
'.f-checks{display:flex;gap:6mm;margin:1.5mm 0;font-size:9pt;color:#16414d}' +
'.f-checks label{display:flex;align-items:center;gap:1.5mm}' +
'.box{width:3.4mm;height:3.4mm;border:1px solid #2b6470;border-radius:.6mm;display:inline-block}' +
'.f-para{font-size:9pt;line-height:2;color:#1e4b56;margin:1mm 0;text-align:justify}' +
'.blank{display:inline-block;min-width:38mm;border-bottom:1px solid #2b6470}' +
'.blank.sm{min-width:24mm}' +
'.f-sub{font-size:10.5pt;color:#a2703a;text-align:center;margin:2mm 0 1mm}' +
'.f-row.doc{margin-top:1.5mm}' +
'.f-two{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:1mm 0}' +
'.f-privacy{font-size:8.5pt;font-weight:700;color:#123a72;background:#eaf1f9;border-right:2mm solid #123a72;padding:1.4mm 2mm;margin:1.5mm 0;line-height:1.7}' +
'.f-sign{font-size:8.5pt;color:#16414d;border-bottom:1px solid #8aa7b0;padding-bottom:1mm}' +
'.f-notes{margin-top:2mm}' +
'.f-notes h2{font-size:11pt;color:#0b3b46;margin:0 0 1mm}' +
'.f-notes-box{height:16mm;border:1px solid #b9cdd4;border-radius:1mm}' +
'.f-foot{margin-top:2mm;border:1px solid #a2703a;padding:1.2mm 2mm;font-size:7.5pt;color:#5c4326;text-align:center;background:#fdf6ec}' +
'.f-bar{margin-top:1.5mm;background:#12a0a8;color:#fff;border-radius:2mm;padding:1.4mm 3mm;display:flex;justify-content:space-between;align-items:center;font-size:8pt}' +
'.f-bar-note{font-weight:700}' +
'.f-contact b{margin-inline-start:3mm}';
}

function printOfficialForms(list){
  const items = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!items.length) { showToast('لا توجد بيانات لطباعة الاستمارة.', 'error'); return; }
  const sheets = items.map(a => '<section class="sheet">' + officialFormSheet(a) + '</section>').join('');
  const doc = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>استمارة الإلحاق — ' + CLUB_AR + '</title><style>' + officialFormCSS() + '</style></head>' +
    '<body>' + sheets +
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},350)})<\/script>' +
    '</body></html>';
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) { showToast('اسمح بالنوافذ المنبثقة لطباعة الاستمارة.', 'error'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

/* ---------------- البطاقة الفنية الفاخرة ---------------- */
const ORNAMENT = '<svg class="orn" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 30 Q25 6 50 30 T100 30 T150 30 T200 30" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M0 34 Q25 10 50 34 T100 34 T150 34 T200 34" fill="none" stroke="currentColor" stroke-width=".7" opacity=".6"/></svg>';

function luxuryCard(p, kind){
  const coach = kind === 'coach';
  const roleLabel = coach ? 'مدرب' : 'سباح';
  const name = p.coach_name || p.name || '';
  const fr = p.first_name_fr ? (p.first_name_fr + ' ' + (p.last_name_fr || '')).trim() : '';
  const no = p.membership_no || p.id || '';
  const group = p.group_name || p.group_name || p.coach_group || '';
  const rows = coach
    ? [['التخصص', p.specialty || 'مدرب سباحة'], ['الخبرة', (p.experience || '—') + ' سنة'], ['الهاتف', p.phone || '—'], ['البريد', p.email || '—']]
    : [['الفوج', group || '—'], ['رقم الانخراط', no], ['الهاتف', p.phone || '—'], ['فصيلة الدم', p.blood_group || '—']];
  return '' +
  '<article class="lux-card ' + (coach ? 'is-coach' : 'is-swimmer') + '" data-no="' + esc(no) + '">' +
    '<div class="lux-side">' +
      '<span class="lux-stars">' + STAR + STAR + STAR + '</span>' +
      '<img class="lux-logo" src="assets/logo.png" alt="">' +
      '<span class="lux-vert">نادي الصدارة • فوج السباحة</span>' +
      '<span class="lux-season">' + esc(CLUB.season) + '</span>' +
    '</div>' +
    '<div class="lux-main">' +
      '<div class="lux-top">' +
        '<div class="lux-club"><b>' + CLUB_AR + '</b><small dir="ltr">' + CLUB_FR + '</small></div>' +
        '<span class="lux-role">' + roleLabel + '</span>' +
      '</div>' +
      '<div class="lux-body">' +
        '<div class="lux-photo"><img src="assets/logo.png" alt=""><span>الصورة</span></div>' +
        '<div class="lux-info">' +
          '<h3>' + esc(name) + '</h3>' +
          (fr ? '<p class="lux-fr" dir="ltr">' + esc(fr) + '</p>' : '<p class="lux-fr">—</p>') +
          ORNAMENT +
          '<div class="lux-rows">' + rows.map(r => '<div class="lux-row"><i>' + esc(r[0]) + '</i><b>' + esc(r[1]) + '</b></div>').join('') + '</div>' +
        '</div>' +
        '<div class="lux-qr"><div class="qr-code" data-qr="' + esc(no) + '"></div><small>امسح للحضور</small></div>' +
      '</div>' +
      '<div class="lux-foot"><span>' + esc(CLUB.address) + '</span><span dir="ltr">' + esc(CLUB.phone) + '</span></div>' +
    '</div>' +
  '</article>';
}

function printLuxuryCards(list, kind){
  const items = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!items.length) { showToast('لا توجد بطاقات فنية للطباعة.', 'error'); return; }
  const box = document.createElement('div');
  box.className = 'lux-grid';
  items.forEach(p => box.insertAdjacentHTML('beforeend', luxuryCard(p, kind)));
  const host = printArea(box, { title: kind === 'coach' ? 'البطاقات الفنية — المدربون' : 'البطاقات الفنية — السباحون', sub: 'الموسم ' + CLUB.season, variant: 'lux' });
  if (host) buildQRCodes();
}