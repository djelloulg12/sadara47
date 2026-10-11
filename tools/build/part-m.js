/* ==========================================================
   تصحيح: الاستمارة تظهر الصورة والمعلومات معًا
   ========================================================== */
function assetUrl(path){
  try { return new URL(path, document.baseURI).href; }
  catch (_) { return path; }
}
const FORM_BG_URL = assetUrl(FORM_BG);
function overlaySheet(a){
  const rec = a || {};
  const vals = formValues(rec);
  const adult = isAdultRecord(rec);
  const spots = FORM_SPOTS.filter(s => !(adult && GUARDIAN_SPOT.test(s.id))).map(s => {
    const text = vals[s.id] === undefined ? '' : String(vals[s.id]);
    return '<span class="f-spot" style="' + spotStyle(s) + '">' + esc(text) + '</span>';
  }).join('');
  const photo = formPhotoData(rec);
  return '<section class="f-page">'
    + '<img class="f-bg" src="' + esc(FORM_BG_URL) + '" alt="استمارة النادي">'
    + '<div class="f-photo" style="left:' + PHOTO_BOX.x + 'mm;top:' + PHOTO_BOX.y + 'mm;width:' + PHOTO_BOX.w + 'mm;height:' + PHOTO_BOX.h + 'mm">'
    + (photo ? '<img src="' + esc(photo) + '" alt="صورة المنخرط">' : '')
    + '</div>'
    + spots
    + '</section>';
}
/* Every value is drawn tight against its colon, as the rest of this form is.
   That leaves one failure: a value too long for its box is cut at the edge
   rather than run over the printed wording -- a request number, or a pool the
   manager has renamed to something longer than the one measured here.

   The box is the one thing that cannot give, because it is the size of a line
   printed on the scan. So the letter size gives instead, measured on the page
   that is about to print. Guessing a size in advance only moves the problem to
   the next pool the club renames. */
function fitSpots(root){
  const nodes = (root || document).querySelectorAll('.f-spot');
  for (const node of nodes) {
    if (!node.textContent) continue;
    node.style.fontSize = '';
    let size = parseFloat(getComputedStyle(node).fontSize) || 16;
    for (let guard = 0; guard < 24 && size > 6; guard++) {
      if (node.scrollWidth <= node.clientWidth + 0.5) break;
      size -= 0.5;
      node.style.fontSize = size.toFixed(2) + 'px';
    }
  }
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
'@media print{.f-page{width:210mm;height:297mm;margin:0}.f-hint{display:none}}' +
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
  const w = printWindow();
  if (!w) { showToast('اسمح بالنوافذ المنبثقة لطباعة الاستمارة.', 'error'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
  const go = () => {
    try {
      const ready = w.document.fonts && w.document.fonts.ready ? w.document.fonts.ready : Promise.resolve();
      /* Measured after the webfont has arrived, because a value that fits in the
         fallback face can be cut off in the real one -- and the page is written
         from here, so it is reached directly rather than through a script put
         into the document. */
      ready.then(() => setTimeout(() => {
        try { fitSpots(w.document); w.focus(); w.print(); } catch (_) {}
      }, 260));
    } catch (_) { setTimeout(() => { try { fitSpots(w.document); w.print(); } catch (_) {} }, 700); }
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
  const no = arDigits(p.membership_no || p.id || '');
  const photo = (p.photo && /^(data:|https?:)/.test(p.photo)) ? p.photo : '';
  const phone = p.phone || CLUB.phone;
  const rows = coach
    ? [['التخصص', p.specialty || 'مدرب سباحة'], ['سنوات الخبرة', arDigits((p.experience || '—') + ' سنة')],
       ['البريد الإلكتروني', p.email || '—'], ['الفوج', p.group_name || 'الطاقم الفني']]
    : [['الفوج', p.group_name || '—'], ['فصيلة الدم', p.blood_group || '—'],
       ['تاريخ الالتحاق', arDigits(p.joined || '—')], ['الموسم', arDigits(CLUB.season)]];
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
          /* The season, directly under the photograph. A card is kept for years and
             filed by season, and the season used to appear only in the footer, at
             the far edge of a card 85 mm wide -- the one thing on it that says
             which year it is. */
          '<b class="lux-season">' + esc(arDigits(CLUB.season)) + '</b>' +
          /* The number stays in the digits it is quoted and looked up in. */
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
          '<b class="lux-phone" dir="ltr">' + esc(arDigits(phone)) + '</b>' +
          '<small>امسح لتسجيل الحضور</small>' +
        '</div>' +
      '</div>' +
      '<div class="lux-foot"><span>' + esc(arDigits(CLUB.season)) + '</span><span>' + esc(CLUB.address) + '</span></div>' +
    '</div>' +
  '</article>';
}