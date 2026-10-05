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