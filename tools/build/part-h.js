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
}/* applications page: official form printing */
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