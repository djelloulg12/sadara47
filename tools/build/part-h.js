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