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