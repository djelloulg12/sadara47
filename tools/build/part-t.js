/* ==========================================================
   حزمة التسجيل — استمارة رسمية + وصل دفع المستحقات + النظام الداخلي
   تُطبع فور ملء الاستمارة من قبل المسجّل، وتُرفع النسخة الموقّعة
   إلى المنصة بعد المصادقة بحساب المحاسب أو المسيّر.
   ========================================================== */

/* ---------------- الأرقام بالحروف لِصحة الوصل ---------------- */
const AR_UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
const AR_SCOPES = ['', 'ألف', 'مليون', 'مليار'];

function chunkWords(n) {
  const parts = [];
  const unit = n % 1000;
  const h = Math.floor(unit / 100), t = Math.floor((unit % 100) / 10), o = unit % 10;
  if (h) parts.push(AR_HUNDREDS[h]);
  // 11-19 form one word; above that the unit comes before the ten
  if (t === 1 && o) parts.push(AR_UNITS[10 + o]);
  else {
    if (o) parts.push(AR_UNITS[o]);
    if (t) parts.push(AR_TENS[t]);
  }
  return parts.join(' \u0648');
}
const AR_SCOPE_PLURAL = { '\u0623\u0644\u0641': '\u0622\u0644\u0627\u0641', '\u0645\u0644\u064a\u0648\u0646': '\u0645\u0644\u0627\u064a\u064a\u0646', '\u0645\u0644\u064a\u0627\u0631': '\u0645\u0644\u064a\u0627\u0631\u0627\u062a' };
function scopeWords(words, n, level) {
  const scope = AR_SCOPES[level];
  if (!scope) return words;
  if (n === 1) return scope;                                  // \u0623\u0644\u0641
  if (n === 2) return scope === '\u0623\u0644\u0641' ? '\u0623\u0644\u0641\u0627\u0646' : scope + '\u0627\u0646';  // \u0623\u0644\u0641\u0627\u0646
  if (n <= 10) return words + ' ' + (AR_SCOPE_PLURAL[scope] || scope);        // \u0622\u0644\u0627\u0641
  return words + ' ' + scope;                                 // \u0623\u062d\u062f\u0639\u0634\u0631 \u0623\u0644\u0641
}
function moneyWords(value) {
  let n = Math.round(Number(value) || 0);
  if (!n) return '\u0635\u0641\u0631';
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    out.push(scopeWords(chunkWords(groups[i]), groups[i], i));
  }
  return out.join(' \u0648');
}

/* ---------------- بنود الفاتورة ---------------- */
function packetLines(a) {
  const plans = state.subscriptions || [];
  const extras = state.extras || {};
  const code = a.subscription_code || 'quarter';
  const plan = plans.find(p => p.code === code);
  const lines = [{
    label: 'اشتراك ' + (plan && plan.name ? plan.name : planName(code)),
    detail: (plan && plan.duration) || '',
    amount: plan ? Number(plan.amount || 0) : Number(a.expected_amount || 0)
  }];
  if (a.transport) lines.push({ label: 'النقل', detail: 'خدمة النقل الموسمي', amount: Number(extras.transport || 900) });
  if (a.uniform) lines.push({ label: 'البدلة الرياضية', detail: 'بدلة رسمية للنادي', amount: Number(extras.uniform || 2500) });
  return lines;
}
function receiptTotal(a) {
  const lines = packetLines(a);
  const sum = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  return sum || Number(a.expected_amount || 0);
}

/* ---------------- صفحة الوصل ---------------- */
function receiptSheet(a) {
  const lines = packetLines(a);
  const total = receiptTotal(a);
  const today = new Date();
  const methodLabel = { cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية', online: 'أونلاين' };
  const method = methodLabel[a.payment_method] || methodLabel.cash;
  const receiptNo = (a.application_no || 'APP') + '-REC';
  const row = l => '<tr><td>' + esc(l.label) + (l.detail ? '<br><small>' + esc(l.detail) + '</small>' : '') +
    '</td><td class="num">' + esc(money(l.amount)) + '</td></tr>';
  return '<section class="pk-page pk-receipt">' +
    '<div class="pk-inner">' +
      '<header class="pk-head">' +
        '<div><h1>النادي الرياضي الصدارة</h1><p>فوج السباحة — ' + esc(CLUB.city) + ' · وصل استلام مستحقات</p></div>' +
        '<div class="pk-stamp"><b>وصل</b><span dir="ltr">' + esc(receiptNo) + '</span></div>' +
      '</header>' +
      '<div class="pk-meta">' +
        '<span>رقم الطلب</span><b dir="ltr">' + esc(a.application_no || '—') + '</b>' +
        '<span>تاريخ الاستلام</span><b>' + esc(today.toISOString().slice(0, 10)) + '</b>' +
        '<span>الاسم واللقب</span><b>' + esc(appName(a) || '—') + '</b>' +
        '<span>الصفة</span><b>' + esc(catLabel(a.category === 'minor' ? 'minor' : 'adult')) + '</b>' +
        '<span>الفوج / المنشأة</span><b>' + esc(a.facility || '—') + '</b>' +
        '<span>الهاتف</span><b dir="ltr">' + esc(a.phone || '—') + '</b>' +
      '</div>' +
      '<table class="pk-table"><thead><tr><th>البيان</th><th>المبلغ (دج)</th></tr></thead><tbody>' +
        lines.map(row).join('') +
        '<tr class="pk-total"><td>المبلغ الإجمالي</td><td class="num">' + esc(money(total)) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="pk-words">فقط: <b>' + esc(moneyWords(total)) + '</b> دينار جزائري لا غير.</p>' +
'<p class="pk-paid">أقرّ أنا الموقّع أسفله بأنّني استلمت المبلغ المذكور أعلاه '
        + '<span class="pk-method">' + esc(method === 'نقدًا' ? 'نقدًا لدى خزينة النادي' : method + ' لدى محاسب النادي') + '</span>'
        + '، وأُدرجت قيمته في سجلّ مستحقات النادي للحساب الجاري.</p>' +
      '<div class="pk-sign">' +
        '<div><b>المحاسب</b><span class="pk-line"></span><small>الاسم والتوقيع</small></div>' +
        '<div><b>المسيّر</b><span class="pk-line"></span><small>الاسم والتوقيع</small></div>' +
        '<div class="pk-seal"><b>ختم النادي</b><span class="pk-ring"></span></div>' +
      '</div>' +
      '<footer class="pk-foot">' +
        '<span>تُوقّع نسختان: واحدة للنادي وأخرى للولي/المنخرط.</span>' +
        '<span>ترفع النسخة الموقّعة إلى المنصة بعد الدخول بحساب المحاسب أو المسيّر.</span>' +
        '<span>' + esc(CLUB.address) + ' · <span dir="ltr">' + esc(CLUB.phone) + '</span></span>' +
      '</footer>' +
    '</div>' +
  '</section>';
}

/* ---------------- صفحة النظام الداخلي ---------------- */
/* The regulations go out exactly as the club issued them: one A4 page with the
   scan filling it edge to edge. No heading, no season line, no "وقّع هنا" stamp,
   no signature row and no padding -- every one of those would print on top of
   the document and make it no longer the original. */
function regulationsSheet() {
  return '<section class="pk-page pk-regs">'
    + '<img class="pk-regs-full" src="' + esc(assetUrl('assets/internal-regulations.jpg')) + '" alt="النظام الداخلي">'
    + '</section>';
}

/* ---------------- تنسيق الحزمة ---------------- */
function packetCSS() {
  return officialFormCSS() + '' +
'@page{size:A4 portrait;margin:0}' +
'html,body{background:#fff}' +
'.pk-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;' +
  'page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid;color:#12333f}' +
'.pk-page:last-of-type{page-break-after:auto;break-after:auto}' +
'.pk-inner{position:absolute;inset:0;padding:16mm 15mm 12mm;display:flex;flex-direction:column}' +
'.pk-receipt{background:#ffffff}' +
'.pk-regs{background:#fff}' +
'.pk-regs-full{position:absolute;top:0;left:0;width:210mm;height:297mm;' +
  'object-fit:fill;display:block;border:0;margin:0;padding:0}' +
'.pk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10mm;' +
  'border-bottom:2.5px solid #0e8f9c;padding-bottom:5mm}' +
'.pk-head h1{margin:0;font-size:20pt;letter-spacing:.2px;color:#071a35}' +
'.pk-head p{margin:2mm 0 0;font-size:9.5pt;color:#5d7386}' +
'.pk-stamp{border:2px solid #c8a45c;border-radius:3mm;padding:3mm 5mm;text-align:center;min-width:34mm}' +
'.pk-stamp b{display:block;font-size:12pt;color:#c8a45c}' +
'.pk-stamp span{display:block;font-size:7.5pt;color:#5d7386;margin-top:1mm}' +
'.pk-meta{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:2mm 4mm;margin:6mm 0 5mm;font-size:9.5pt}' +
'.pk-meta span{color:#5d7386}' +
'.pk-meta b{font-weight:700}' +
'.pk-table{width:100%;border-collapse:collapse;font-size:10pt}' +
'.pk-table th{background:#eaf6f7;color:#071a35;text-align:right;padding:2.6mm 3mm;border:1px solid #cfe2e6}' +
'.pk-table td{padding:3mm;border:1px solid #dbe6ec}' +
'.pk-table small{color:#5d7386;font-size:8pt}' +
'.pk-table .num{direction:ltr;text-align:left;font-weight:700;white-space:nowrap}' +
'.pk-total td{background:#071a35;color:#fff;font-weight:800}' +
'.pk-words{margin:4mm 0 0;font-size:10.5pt}' +
'.pk-paid{margin:6mm 0 0;font-size:10pt;line-height:1.9;border:1px dashed #cfe2e6;border-radius:2mm;padding:3mm 4mm;background:#f8fcfc}' +
'.pk-method{font-weight:700;color:#0e8f9c}' +
'.pk-sign{display:grid;grid-template-columns:1fr 1fr 34mm;gap:8mm;margin-top:auto}' +
'.pk-sign>div{display:flex;flex-direction:column;justify-content:flex-end;font-size:9.5pt}' +
'.pk-sign b{color:#071a35}' +
'.pk-line{display:block;border-bottom:1px solid #12333f;height:12mm;margin:2mm 0 1mm}' +
'.pk-sign small{color:#5d7386;font-size:8pt}' +
'.pk-seal{align-items:center;text-align:center;justify-content:center}' +
'.pk-ring{display:block;border:1.5px dashed #c8a45c;border-radius:50%;height:26mm;width:26mm;margin-top:2mm}' +
'.pk-foot{margin-top:6mm;border-top:1px solid #dbe6ec;padding-top:3mm;display:flex;flex-direction:column;gap:1.2mm;font-size:8pt;color:#5d7386}' +
'@media print{.pk-hint{display:none}}' +
'.pk-hint{margin:0 0 4mm;background:#eaf6f7;border-right:4px solid #0e8f9c;padding:3mm 4mm;font-size:9pt;border-radius:1mm}' +
'.pk-hint b{color:#071a35}';
}

/* ---------------- بناء الحزمة وطباعتها ---------------- */
function packetDocument(app, what) {
  const only = what || 'all';
  const pages = [];
  if (only === 'all' || only === 'form') pages.push(overlaySheet(app));
  if (only === 'all' || only === 'receipt') pages.push(receiptSheet(app));
  if (only === 'all' || only === 'regs') pages.push(regulationsSheet());
  const label = only === 'all'
    ? '\u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629\u060c \u0648\u0635\u0644 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0627\u062a\u060c \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a.'
    : only === 'receipt' ? '\u0648\u0635\u0644 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u062d\u0642\u0627\u062a.'
      : only === 'regs' ? '\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062f\u0627\u062e\u0644\u064a.'
        : '\u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0631\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629.';
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>\u062d\u0632\u0645\u0629 \u062a\u0633\u062c\u064a\u0644 \u2014 ' + esc(CLUB_AR) + ' \u2014 ' + esc(app.application_no || '') + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=block" rel="stylesheet">' +
    '<style>' + packetCSS() + '</style></head><body>' +
    '<p class="pk-hint"><b>\u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0637\u0628\u0627\u0639\u0629:</b> \u0627\u0633\u062a\u0639\u0645\u0644 Ctrl+P \u062b\u0645 \u0627\u062e\u062a\u0631 \u00ab\u062d\u0641\u0638 \u0628\u0635\u064a\u063a\u0629 PDF\u00bb. ' +
    '\u062a\u062d\u062a\u0648\u064a \u0647\u0630\u0647 \u0627\u0644\u0648\u062b\u064a\u0642\u0629 ' + pages.length + ' \u0635\u0641\u062d\u0629: ' + label + '</p>' +
    pages.join('') + '</body></html>';
}
function printPacket(app, what) {
  const doc = packetDocument(app, what);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) { showToast('اسمح بالنوافذ المنبثقة لطباعة الحزمة.', 'error'); return false; }
  try {
    win.document.open();
    win.document.write(doc);
    win.document.close();
  } catch (_) { /* the popup raced the click */ }
  const go = () => {
    try {
      const fonts = win.document.fonts && win.document.fonts.ready ? win.document.fonts.ready : Promise.resolve();
      fonts.then(() => setTimeout(() => { try { win.focus(); win.print(); } catch (_) {} }, 320));
    } catch (_) { setTimeout(() => { try { win.print(); } catch (_) {} }, 800); }
  };
  setTimeout(go, 950);
  return true;
}

/* ---------------- شاشة ما بعد الإرسال ---------------- */
function registrationDoneModal(a) {
  const total = receiptTotal(a);
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'تم استلام طلب التسجيل');
  box.innerHTML = '<div class="modal done-modal">' +
    '<div class="done-mark">✓</div>' +
    '<h2>تم استلام الطلب</h2>' +
    '<p class="done-no">رقم الطلب <b dir="ltr">' + esc(a.application_no || '—') + '</b></p>' +
    '<p class="done-amount">المبلغ المستحق <b>' + esc(money(total)) + '</b> <small>' + esc(moneyWords(total)) + '</small></p>' +
    '<div class="done-steps">' +
      '<div><i>1</i><span>اضغط «طباعة الحزمة» لتحصل على الاستمارة الرسمية ووصل الاستلام والنظام الداخلي.</span></div>' +
      '<div><i>2</i><span>وقّع الاستمارة والوصل من طرف المحاسب أو المسيّر، وختمهما.</span></div>' +
      '<div><i>3</i><span>ادخل إلى المنصة بحساب المحاسب أو المسيّر وارفع النسخة الموقّعة من صفحة الطلبات.</span></div>' +
    '</div>' +
    '<div class="done-actions">' +
      '<button class="btn btn-primary" data-action="print-packet">🖨 طباعة الحزمة كاملة</button>' +
      '<button class="btn btn-outline" data-action="print-receipt-only">وصل الاستلام فقط</button>' +
      '<button class="btn btn-outline" data-action="print-regs-only">النظام الداخلي فقط</button>' +
    '</div>' +
    '<button class="btn btn-ghost full" data-action="close">إغلاق</button>' +
  '</div>';
  document.body.appendChild(box);
  bind();
  setTimeout(() => { const f = box.querySelector('[data-action="print-packet"]'); if (f) f.focus(); }, 40);
  return box;
}

/* keeps the packet available for reprint without asking the visitor again */
let lastPacket = null;