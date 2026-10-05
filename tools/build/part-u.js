/* ==========================================================
   تفعيل حزمة التسجيل: إرسال → طباعة فورية → رفع النسخة الموقّعة
   ========================================================== */

/* رفع النسخة الموقّعة: التخزين على Firebase، أو نص مُرمّز على الخادم المحلي */
async function uploadSignedForm(file, applicationNo) {
  if (!file) throw new Error('اختر الملف أولاً');
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (allowed.indexOf(file.type) < 0) throw new Error('الملف يجب أن يكون PDF أو صورة');
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف يتجاوز 10 ميغابايت');
  const safeNo = String(applicationNo || 'APP').replace(/[^\w-]/g, '');

  if (window.firebase && firebase.storage && firebase.auth && firebase.auth().currentUser) {
    const ref = firebase.storage().ref('application-scans/' + safeNo + '/' + Date.now() + '-' + file.name);
    await ref.put(file, { contentType: file.type });
    return { path: ref.fullPath, name: file.name, size: file.size, stored: 'storage' };
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
    reader.readAsDataURL(file);
  });
  return { path: 'local:' + safeNo, name: file.name, size: file.size, stored: 'inline', data_url: dataUrl };
}

function scanFieldFor(modal) {
  return modal && modal.querySelector('#scan-file') ? modal.querySelector('#scan-file') : null;
}
function attachScanModal(app) {
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'رفع النسخة الموقّعة');
  box.innerHTML = '<div class="modal attach-modal">' +
    '<button class="close" data-action="close" aria-label="إغلاق">×</button>' +
    '<div class="modal-heading"><span class="logo">📄</span><h2>رفع النسخة الموقّعة</h2>' +
    '<p>طلب <b dir="ltr">' + esc(app.application_no || app.id) + '</b> — ' + esc(appName(app)) + '</p></div>' +
    (app.scan_name ? '<p class="scan-current">مرفوع مسبقًا: <b>' + esc(app.scan_name) + '</b></p>' : '') +
    '<label>الاستمارة الموقّعة (PDF أو صورة)<input id="scan-file" type="file" accept="application/pdf,image/*"></label>' +
    '<label>ملاحظات<input id="scan-note" placeholder="مثال: وقّع عليها المحاسب بتاريخ 12/10"></label>' +
    '<div class="two-actions">' +
      '<button class="btn btn-outline" data-action="close">إلغاء</button>' +
      '<button class="btn btn-primary" data-action="save-scan" data-id="' + esc(app.id) + '">رفع النسخة</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(box);
  bind();
  const f = scanFieldFor(box);
  if (f) setTimeout(() => f.focus(), 40);
  return box;
}
function receiptModal(app) {
  const total = receiptTotal(app);
  const lines = packetLines(app);
  const box = document.createElement('div');
  box.className = 'modal-backdrop';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'وصل استلام المستحقات');
  box.innerHTML = '<div class="modal receipt-modal">' +
    '<button class="close" data-action="close" aria-label="إغلاق">×</button>' +
    '<div class="modal-heading"><span class="logo">🧾</span><h2>وصل استلام المستحقات</h2>' +
    '<p>طلب <b dir="ltr">' + esc(app.application_no || app.id) + '</b> — ' + esc(appName(app)) + '</p></div>' +
    '<table class="receipt-table"><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody>' +
      lines.map(l => '<tr><td>' + esc(l.label) + '</td><td class="num">' + esc(money(l.amount)) + '</td></tr>').join('') +
      '<tr class="pk-total"><td>الإجمالي</td><td class="num">' + esc(money(total)) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="pk-words">فقط: <b>' + esc(moneyWords(total)) + '</b> دينار جزائري.</p>' +
    '<label class="check-line"><input id="paid-check" type="checkbox"' +
      (app.payment_status === 'paid' ? ' checked' : '') + '> تمّ استلام المبلغ نقدًا</label>' +
    '<label>اسم المحاسب<input id="paid-by" value="' + esc(app.cashier_name || '') + '" placeholder="مثال: أمين المحاسب"></label>' +
    '<div class="two-actions">' +
      '<button class="btn btn-outline" data-action="print-receipt-only" data-id="' + esc(app.id) + '">🖨 طباعة الوصل</button>' +
      '<button class="btn btn-primary" data-action="save-paid" data-id="' + esc(app.id) + '">حفظ التسديد</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(box);
  bind();
  return box;
}

const coreActionPacket = action;
action = async function (a, el) {
  if (a==='send-full-request') {
    const q = id => { const n = document.querySelector(id); return n ? n.value : ''; };
    const cb = id => { const n = document.querySelector(id); return n ? n.checked : false; };
    const payload = {
      sport: q('#reg-sport'), category: q('#reg-category'), swimming_strokes: q('#reg-strokes'),
      subscription_code: q('#reg-plan'), facility: q('#reg-facility'),
      transport: cb('#reg-transport'), uniform: cb('#reg-uniform'), payment_method: q('#reg-payment'),
      first_name_ar: q('#reg-first-ar'), last_name_ar: q('#reg-last-ar'),
      first_name_fr: q('#reg-first-fr'), last_name_fr: q('#reg-last-fr'),
      national_id: q('#reg-nin'), birth_certificate_no: q('#reg-birth-cert'),
      birth_place: q('#reg-birth-place'), wilaya: q('#reg-wilaya'), birth_date: q('#reg-birth'),
      gender: q('#reg-gender'), blood_group: q('#reg-blood'), level: q('#reg-level'),
      phone: q('#reg-phone'), whatsapp: q('#reg-whatsapp'), address: q('#reg-address'),
      guardian_first_name: q('#reg-guardian-first'), guardian_last_name: q('#reg-guardian-last'),
      guardian_relation: q('#reg-guardian-relation'), guardian_phone: q('#reg-guardian-phone'),
      guardian_national_id: q('#reg-guardian-nin'), guardian_consent: cb('#reg-guardian-consent')
    };
    const missing = [];
    if (!payload.first_name_ar) missing.push('الاسم بالعربية');
    if (!payload.last_name_ar) missing.push('اللقب بالعربية');
    if (!payload.birth_date) missing.push('تاريخ الميلاد');
    if (!payload.phone) missing.push('الهاتف');
    if (!payload.address) missing.push('العنوان');
    if (missing.length) { showToast('يرجى إكمال: ' + missing.join('، '), 'error'); return; }

    let photoData = '';
    const photoInput = document.querySelector('#reg-photo');
    if (photoInput && photoInput.files && photoInput.files[0]) {
      try {
        photoData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
          reader.readAsDataURL(photoInput.files[0]);
        });
      } catch (_) { photoData = ''; }
    }
    payload.photo_data_url = photoData;
    payload.doctor = '';
    payload.card_issue_place = 'غرداية';
    payload.guardian_child = payload.first_name_ar;

    const btn = document.querySelector('[data-action="send-full-request"]');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإرسال…'; }
    try {
      const res = await fetch('/api/applications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'تعذّر إرسال الطلب', 'error'); return; }
      const record = Object.assign({}, payload, {
        application_no: data.application_no, expected_amount: data.expected_amount
      });
      lastPacket = record;
      document.querySelector('.modal-backdrop')?.remove();
      registrationDoneModal(record);
      printPacket(record);
      showToast('تم الاستلام — جارٍ فتح نافذة الطباعة.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'إرسال طلب التسجيل'; }
    }
    return;
  }

  if (a==='print-packet') { if (lastPacket) printPacket(lastPacket); return; }
  if (a==='print-receipt-only') {
    const app = el && el.dataset.id
      ? (state.applications || []).find(x => String(x.id) === String(el.dataset.id)) || lastPacket
      : lastPacket;
    if (app) printPacket(app, 'receipt');
    else showToast('لا توجد بيانات للطباعة.', 'error');
    return;
  }
  if (a==='print-regs-only') { if (lastPacket) printPacket(lastPacket, 'regs'); return; }
  if (a==='attach-scan') {
    const app = (state.applications || []).find(x => String(x.id) === String(el.dataset.id));
    if (app) attachScanModal(app);
    return;
  }
  if (a==='save-scan') {
    const file = scanFieldFor(document);
    const noteEl = document.querySelector('#scan-note');
    if (!file || !file.files || !file.files[0]) { showToast('اختر الملف الموقّع أولًا.', 'error'); return; }
    const app = (state.applications || []).find(x => String(x.id) === String(el.dataset.id));
    const btn = el;
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الرفع…'; }
    try {
      const info = await uploadSignedForm(file.files[0], (app && (app.application_no || app.id)) || '');
      await api('/api/applications/' + encodeURIComponent(el.dataset.id), 'PATCH', {
        scan_path: info.path, scan_name: info.name, scan_size: info.size,
        scan_data_url: info.data_url || '', scan_note: noteEl ? noteEl.value : ''
      });
      logDecision('رفع نسخة موقّعة', 'application', el.dataset.id, { file: info.name });
      showToast('تم رفع النسخة الموقّعة.');
      document.querySelector('.modal-backdrop')?.remove();
      await syncApi(); render();
    } catch (e) {
      showToast(e.message || 'تعذّر الرفع', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'رفع النسخة'; }
    }
    return;
  }
  if (a==='open-receipt') {
    const app = (state.applications || []).find(x => String(x.id) === String(el.dataset.id));
    if (app) receiptModal(app);
    return;
  }
  if (a==='save-paid') {
    const paid = document.querySelector('#paid-check');
    const by = document.querySelector('#paid-by');
    try {
      await api('/api/applications/' + encodeURIComponent(el.dataset.id), 'PATCH', {
        payment_status: paid && paid.checked ? 'paid' : 'unpaid',
        cashier_name: by ? by.value : '',
        paid_at: paid && paid.checked ? new Date().toISOString().slice(0, 10) : ''
      });
      logDecision(paid && paid.checked ? 'تسديد نقدي' : 'إلغاء التسديد', 'application', el.dataset.id,
        { cashier: by ? by.value : '' });
      showToast(paid && paid.checked ? 'تم تسجيل التسديد.' : 'تم إلغاء التسديد.');
      document.querySelector('.modal-backdrop')?.remove();
      await syncApi(); render();
    } catch (e) { showToast(e.message || 'تعذّر الحفظ', 'error'); }
    return;
  }

  return coreActionPacket(a, el);
};

/* أزراب الحزمة داخل جدول الطلبات */
const corePageViewPacket = pageView;
pageView = function (p) {
  const html = corePageViewPacket(p);
  if (p !== 'applications') return html;
  return html.replace(
    /(<button class="row-more" data-action="edit-app" data-id="([^"]*)">)/g,
    (match, whole, id) => '<button class="check-btn" data-action="open-receipt" data-id="' + esc(id) + '">وصل</button>'
      + '<button class="check-btn" data-action="attach-scan" data-id="' + esc(id) + '">نسخة موقّعة</button>'
      + whole);
};
