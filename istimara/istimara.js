/* ==========================================================
   استمارة التسجيل — الصفحة
   ==========================================================
   A public form, so it carries no session and no role. It posts
   to the same endpoint the platform's own sign-up uses
   (POST /api/applications), which firestore.rules already lets an
   anonymous visitor do as long as the request is pending -- so the
   club's existing management screen picks these up with no change.

   Print is handled by print.js; nothing here knows the millimetre
   geometry of the club's card.
   ========================================================== */
(function () {
  'use strict';

  var F = window.SADARA_FORM;
  var DRAFT_KEY = 'sadara-istimara-draft';
  var PHOTO_MAX_BYTES = 3 * 1024 * 1024;

  /* Same numbers firebase-adapter.js falls back to, so the total shown before
     sending matches the amount the club will confirm. */
  var FALLBACK_PLANS = [
    { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
    { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' },
    { code: 'agreement', name: 'ضمن اتفاقية معتمدة', amount: 3000, duration: 'موسم' }
  ];
  var FALLBACK_EXTRAS = { transport: 900, uniform: 2500 };

  var plans = FALLBACK_PLANS.slice();
  var extras = { transport: FALLBACK_EXTRAS.transport, uniform: FALLBACK_EXTRAS.uniform };

  var el = function (id) { return document.getElementById(id); };
  var form = el('reg-form');
  var done = el('done');
  var msg = el('form-msg');

  var state = { photo: '', sent: null, submitted: false };

  /* ---------------- small helpers ---------------- */

  function say(text, kind) {
    if (!text) { msg.hidden = true; return; }
    msg.textContent = text;
    msg.className = 'form-msg ' + (kind || 'error');
    msg.hidden = false;
  }

  function val(id) {
    var node = el(id);
    return node ? String(node.value || '').trim() : '';
  }

  function checked(id) { var n = el(id); return !!(n && n.checked); }

  function category() {
    var picked = form.querySelector('input[name="category"]:checked');
    return picked ? picked.value : 'minor';
  }

  /* The minor's fields are not required of an adult, so they must leave the
     required list when the category changes -- otherwise an adult is stopped by
     a field they never see. */
  var GUARDIAN_FIELDS = ['guardian_first_name', 'guardian_last_name'];
  function syncCategory() {
    var minor = category() === 'minor';
    var card = el('guardian-card');
    card.hidden = !minor;
    GUARDIAN_FIELDS.forEach(function (id) { el(id).required = minor; });
    if (!minor) clearBad(GUARDIAN_FIELDS);
    updateTotal();
  }

  function clearBad(ids) {
    ids.forEach(function (id) { var n = el(id); if (n) n.classList.remove('bad'); });
  }

  /* ---------------- the plans and the live total ---------------- */

  function loadPlans() {
    /* Prices are public in firestore.rules, and the endpoint answers without a
       session, so a visitor sees what the club actually charges. If it fails the
       form still works on the built-in list. */
    return fetch('/api/subscription-plans')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (Array.isArray(data.plans) && data.plans.length) plans = data.plans;
        if (data.extras) {
          extras = {
            transport: Number(data.extras.transport) || FALLBACK_EXTRAS.transport,
            uniform: Number(data.extras.uniform) || FALLBACK_EXTRAS.uniform
          };
        }
        paintPlans();
        updateTotal();
      })
      .catch(function () { /* the fallback list stays in place */ });
  }

  function paintPlans() {
    var select = el('subscription_code');
    var keep = select.value;
    select.innerHTML = plans.map(function (p) {
      return '<option value="' + F.esc(p.code) + '">'
        + F.esc(p.name) + ' — ' + F.esc(p.amount) + ' دج'
        + (p.duration ? ' (' + F.esc(p.duration) + ')' : '') + '</option>';
    }).join('');
    if (keep) select.value = keep;
  }

  function selectedPlan() {
    var code = val('subscription_code');
    return plans.filter(function (p) { return p.code === code; })[0] || plans[0] || { amount: 0, name: '' };
  }

  function updateTotal() {
    var plan = selectedPlan();
    var total = Number(plan.amount) || 0;
    if (checked('transport')) total += Number(extras.transport) || 0;
    if (checked('uniform')) total += Number(extras.uniform) || 0;
    el('total-amount').textContent = total.toLocaleString('fr-DZ') + ' دج';
  }

  /* ---------------- the photo ---------------- */

  /* The card's frame is 36.4 x 42.5 mm. Rendering straight to that size keeps
     the image small enough to sit inside one Firestore document, instead of
     uploading a phone's 4 MB original that the printed frame would crop anyway. */
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('اختر صورة أولاً.'));
      if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
        return reject(new Error('الصورة يجب أن تكون JPG أو PNG أو WebP.'));
      }
      if (file.size > PHOTO_MAX_BYTES) return reject(new Error('حجم الصورة يتجاوز 3 ميغابايت.'));

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('تعذّر قراءة الصورة.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('تعذّر فتح الصورة.')); };
        img.onload = function () {
          try {
            var TARGET_W = 430, TARGET_H = 502;      // ~300 dpi on the card
            var scale = Math.min(TARGET_W / img.width, TARGET_H / img.height, 1);
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } catch (e) { reject(e); }
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function paintPhoto() {
    var box = el('photo-preview');
    box.innerHTML = state.photo ? '<img src="' + F.esc(state.photo) + '" alt="معاينة الصورة">' : '<span>لا توجد صورة</span>';
    el('photo-clear').hidden = !state.photo;
  }

  function takePhoto(file) {
    shrinkPhoto(file).then(function (dataUrl) {
      state.photo = dataUrl;
      paintPhoto();
      saveDraft();
    }).catch(function (e) {
      say(e.message || 'تعذّر تحميل الصورة.', 'error');
    });
  }

  /* ---------------- validation ---------------- */

  /* Returns the fields that still need an answer, in the order they appear, so
     the person is walked to the first one that is missing. */
  function validate() {
    var missing = [];
    var required = ['first_name_ar', 'last_name_ar', 'birth_date', 'phone', 'address'];
    if (category() === 'minor') required = required.concat(GUARDIAN_FIELDS);

    required.forEach(function (id) { if (!val(id)) missing.push(id); });

    if (!val('birth_date')) missing.push('birth_date');
    var phone = val('phone');
    if (phone && phone.replace(/[\s.\-()]/g, '').length < 9) missing.push('phone');
    if (!el('terms').checked) missing.push('terms');
    if (category() === 'minor' && !el('guardian_consent').checked) missing.push('guardian_consent');

    return Array.from(new Set(missing));
  }

  var MESSAGES = {
    first_name_ar: 'اكتب الاسم بالعربية.',
    last_name_ar: 'اكتب اللقب بالعربية.',
    birth_date: 'اختر تاريخ الميلاد.',
    phone: 'اكتب رقم هاتف صحيح.',
    address: 'اكتب العنوان.',
    guardian_first_name: 'اكتب اسم الولي.',
    guardian_last_name: 'اكتب لقب الولي.',
    guardian_consent: 'التصريح بإذن التدريب ضروري للأصاغر.',
    terms: 'يجب الموافقة على النظام الداخلي قبل الإرسال.'
  };

  function flag(fields) {
    var nodes = fields.map(function (id) { return el(id); }).filter(Boolean);
    nodes.forEach(function (node) { node.classList.add('bad'); });
    return nodes[0];
  }

  /* ---------------- the draft ---------------- */

  function draft() {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (node) {
      if (!node.name || node.type === 'file') return;
      if (node.type === 'radio' || node.type === 'checkbox') out[node.name] = node.checked;
      else if (node.type !== 'submit') out[node.name] = node.value;
    });
    out.__photo = state.photo;
    return out;
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft())); } catch (_) { /* private mode */ }
  }

  function readDraft() {
    var raw;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch (_) { return null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function applyDraft(data) {
    if (!data) return false;
    Object.keys(data).forEach(function (key) {
      if (key === '__photo') return;
      var node = form.elements[key];
      if (!node) return;
      if (node.type === 'radio') {
        Array.prototype.forEach.call(form.elements[key], function (r) { r.checked = (r.value === data[key]); });
      } else if (node.type === 'checkbox') {
        node.checked = !!data[key];
      } else node.value = data[key];
    });
    state.photo = data.__photo || '';
    paintPhoto();
    syncCategory();
    updateTotal();
    return true;
  }

  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} }

  /* ---------------- sending ---------------- */

  function payload() {
    var plan = selectedPlan();
    return {
      sport: 'السباحة',
      category: category(),
      first_name_ar: val('first_name_ar'),
      last_name_ar: val('last_name_ar'),
      first_name_fr: val('first_name_fr'),
      last_name_fr: val('last_name_fr'),
      national_id: val('national_id'),
      birth_certificate_no: val('birth_certificate_no'),
      birth_place: val('birth_place'),
      wilaya: val('wilaya'),
      birth_date: val('birth_date'),
      gender: val('gender'),
      blood_group: val('blood_group'),
      level: val('level'),
      swimming_strokes: val('swimming_strokes'),
      phone: val('phone'),
      whatsapp: val('whatsapp'),
      address: val('address'),
      membership_no: val('membership_no'),
      doctor_name: val('doctor_name'),
      doctor_specialty: val('doctor_specialty'),
      medical_date: val('medical_date'),
      medical_place: val('medical_place'),
      guardian_first_name: val('guardian_first_name'),
      guardian_last_name: val('guardian_last_name'),
      guardian_birth_date: val('guardian_birth_date'),
      guardian_relation: val('guardian_relation'),
      guardian_phone: val('guardian_phone'),
      guardian_national_id: val('guardian_national_id'),
      guardian_consent: checked('guardian_consent'),
      guardian_child: (val('first_name_ar') + ' ' + val('last_name_ar')).trim(),
      subscription_code: val('subscription_code'),
      plan_name: plan.name,
      facility: val('facility'),
      transport: checked('transport'),
      uniform: checked('uniform'),
      transport_amount: Number(extras.transport) || 0,
      uniform_amount: Number(extras.uniform) || 0,
      payment_method: val('payment_method'),
      notes: val('notes'),
      photo: state.photo,
      submitted_from: 'public-form',
      status: 'pending'
    };
  }

  function send() {
    var button = el('submit');
    button.disabled = true;
    button.textContent = 'جارٍ الإرسال…';

    return fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload())
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || 'تعذّر إرسال الطلب. تحقّق من الاتصال وحاول مجدداً.');
        return data;
      });
    }).then(function (data) {
      state.sent = Object.assign(payload(), {
        application_no: data.application_no,
        expected_amount: data.expected_amount
      });
      clearDraft();
      showDone();
    }).catch(function (e) {
      say(e.message || 'تعذّر إرسال الطلب.', 'error');
      button.disabled = false;
      button.textContent = 'إرسال الاستمارة';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------- after sending ---------------- */

  var SUMMARY_LABELS = {
    first_name_ar: 'الاسم', last_name_ar: 'اللقب', birth_date: 'تاريخ الميلاد',
    gender: 'الجنس', blood_group: 'فصيلة الدم', national_id: 'رقم التعريف',
    phone: 'الهاتف', whatsapp: 'الواتساب', address: 'العنوان',
    birth_place: 'مكان الميلاد', wilaya: 'الولاية', level: 'المستوى',
    swimming_strokes: 'نمط السباحة', facility: 'المنشأة',
    guardian_first_name: 'اسم الولي', guardian_last_name: 'لقب الولي',
    guardian_relation: 'القرابة', guardian_phone: 'هاتف الولي',
    guardian_national_id: 'تعريف الولي', doctor_name: 'الطبيب',
    medical_date: 'تاريخ الفحص', notes: 'ملاحظة'
  };

  var PAYMENTS = { cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية' };
  var GENDERS = { male: 'ذكر', female: 'أنثى' };

  function showDone() {
    var rec = state.sent;
    form.hidden = true;
    done.hidden = false;

    el('done-no').textContent = rec.application_no || '—';
    el('done-amount').textContent = (Number(rec.expected_amount) || 0).toLocaleString('fr-DZ') + ' دج';
    el('done-date').textContent = longDate();

    var rows = Object.keys(SUMMARY_LABELS).map(function (key) {
      var value = rec[key];
      if (!value) return '';
      if (key === 'gender') value = GENDERS[value] || value;
      return '<div><span>' + F.esc(SUMMARY_LABELS[key]) + '</span><b>' + F.esc(value) + '</b></div>';
    }).join('');
    rows += '<div><span>الاشتراك</span><b>' + F.esc(rec.plan_name || rec.subscription_code || '') + '</b></div>';
    rows += '<div><span>الدفع</span><b>' + F.esc(PAYMENTS[rec.payment_method] || '') + '</b></div>';
    el('done-summary').innerHTML = rows;

    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function longDate() {
    try {
      return new Intl.DateTimeFormat('ar-DZ', { dateStyle: 'long' }).format(new Date());
    } catch (_) { return new Date().toISOString().slice(0, 10); }
  }

  /* ---------------- wiring ---------------- */

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    say('');
    var bad = validate();
    if (bad.length) {
      var first = flag(bad);
      say(bad.map(function (id) { return MESSAGES[id] || 'أكمل الحقول المطلوبة.'; })[0], 'error');
      if (first) first.focus();
      return;
    }
    saveDraft();
    send();
  });

  form.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('bad')) {
      e.target.classList.remove('bad');
    }
    saveDraft();
  });

  form.addEventListener('change', function (e) {
    if (e.target.name === 'category') syncCategory();
    updateTotal();
    saveDraft();
  });

  el('photo').addEventListener('change', function (e) { takePhoto(e.target.files[0]); });
  el('photo-clear').addEventListener('click', function () {
    state.photo = '';
    el('photo').value = '';
    paintPhoto();
    saveDraft();
  });

  el('save-draft').addEventListener('click', function () {
    saveDraft();
    say('حُفظت مسودة على هذا الجهاز. ستعود تلقائياً في المرة القادمة.', 'ok');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  el('reset').addEventListener('click', function () {
    if (!window.confirm('هل تريد مسح كل ما كتبته؟')) return;
    form.reset();
    state.photo = '';
    paintPhoto();
    syncCategory();
    updateTotal();
    clearDraft();
    say('');
  });

  function printNow() {
    if (!state.sent) return;
    F.printRegistration(state.sent);
  }
  el('print-form').addEventListener('click', printNow);
  el('print-again').addEventListener('click', printNow);

  el('edit-form').addEventListener('click', function () {
    done.hidden = true;
    form.hidden = false;
    say('');
    saveDraft();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  el('new-form').addEventListener('click', function () {
    if (!window.confirm('هل تريد تسجيل شخص آخر؟ ستمسح الاستمارة الحالية من الشاشة.')) return;
    form.reset();
    state.photo = '';
    state.sent = null;
    paintPhoto();
    syncCategory();
    updateTotal();
    clearDraft();
    done.hidden = true;
    form.hidden = false;
    say('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------------- start ---------------- */

  paintPlans();
  syncCategory();
  updateTotal();
  paintPhoto();

  if (applyDraft(readDraft())) {
    say('استعدنا مسودة حفظتها على هذا الجهاز. راجعها ثم أرسل.', 'ok');
  }
  loadPlans();
})();
