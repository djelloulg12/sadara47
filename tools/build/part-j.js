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