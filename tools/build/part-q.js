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