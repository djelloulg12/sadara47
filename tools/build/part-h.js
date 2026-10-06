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