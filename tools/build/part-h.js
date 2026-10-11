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

/* ---------------------- الأرقام العربية في الطباعة ---------------------- */
/* The club writes its documents in Arabic-Indic digits, the way its forms and its
   section numbers already are.

   Two directions, and both of them are needed:

     arDigits   what a person reads. Applied to everything on screen and on paper.
     latinDigits what a person types. Applied on the way in, so that a national
                number typed in Arabic-Indic digits is stored, searched and
                matched as the same number as one typed in Latin digits.

   The one place the two must not meet is the database. It holds Latin digits,
   and that is not a preference: the registration number is read back out of
   itself to count the next one, identity numbers are compared to catch the same
   person registering twice, and amounts are added up. Storing ١٩٨٥ where the
   comparison expects 1985 would make the club's own duplicate check answer "not
   seen before" for a member who is already on the list. So Arabic digits are
   what the club reads and what the club may type, and the database holds the one
   form both of those are converted to. */
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function arDigits(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/[0-9]/g, d => AR_DIGITS[Number(d)]);
}

/* Arabic-Indic digits turned back into Latin ones, and nothing else touched.

   Folded by code point rather than through a table of characters, because a table
   has to be typed and two of the three sets look identical on screen: written out
   they are indistinguishable, and a table that quietly lost one of them would fold
   the digits it was not asked about and leave the rest. A subtraction cannot.

   Arabic-Indic is U+0660..U+0669. Persian and Urdu share the shapes and sit at
   U+06F0..U+06F9; a person copying a number out of a message on one of those
   phones should not be told it is not a number. */
function latinDigits(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

/* A date the way the club writes it: 2026/10/11, in Arabic-Indic digits.

   Anything that is not a plain date is passed through arDigits alone -- a note
   somebody typed, a season written out -- rather than dropped. A date written
   with Arabic digits already, or with slashes rather than dashes, is still a
   date and is re-laid-out rather than left alone, because the whole point is that
   every date on every sheet reads the same way. */
function slashDate(v) {
  const raw = latinDigits(v);
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw.trim());
  if (!m) return arDigits(raw);
  return arDigits(m[1] + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0'));
}

/* The same date for the database and for arithmetic: 2026-10-11, Latin digits.
   '' when the text is not a date at all, rather than a guess: a birth date that
   has been guessed is a member who is the wrong age on the card for ever. */
function isoDate(v) {
  const raw = latinDigits(v).trim();
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw);
  if (!m) return '';
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return m[1] + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
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