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
  /* Firestore's hard ceiling on one document is 1 MiB. The margin covers the
     keys the adapter adds, so a record that passes this is accepted. */
  var DOC_MAX_BYTES = 900 * 1024;

  /* Measured on the bytes that go over the wire, not on string length: an
     Arabic name is two bytes per character, and the photo is base64. */
  function payloadBytes(body) {
    try {
      return new Blob([JSON.stringify(body)]).size;
    } catch (_) {
      return JSON.stringify(body).length * 2;
    }
  }

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
  var facilities = [];

  /* Shown until the club renames a pool, so the choices are never empty. */
  var FALLBACK_FACILITIES = [
    'المسبح الأولمبي', 'المسبح النصف أولمبي', 'الملعب البلدي', 'غابة غرداية'
  ];

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
     a field they never see. The swimmer's national number goes the other way:
     a child does not hold one, so it leaves the form with the minors. */
  /* The printed declaration carries the guardian's given name, surname, date of
     birth and national number. All four are required of a minor, because the
     declaration cannot be completed without them, and none is required of an
     adult, who has no guardian. */
  var GUARDIAN_FIELDS = ['guardian_first_name', 'guardian_last_name', 'guardian_birth_date', 'guardian_national_id'];
  function syncCategory() {
    var minor = category() === 'minor';
    /* The fee follows the category and the pool, so both changes re-ask. */
    loadPlans();
    var card = el('guardian-card');
    card.hidden = !minor;
    GUARDIAN_FIELDS.forEach(function (id) { el(id).required = minor; });
  /* Hidden alone is not enough: a hidden input can still be filled by keyboard and
     can still carry a value into a record that has no guardian. Disabled and
     cleared, an adult's declaration genuinely does not exist. */
  document.querySelectorAll('#guardian-card input, #guardian-card select').forEach(function (node) {
    node.disabled = !minor;
    if (!minor && node.type !== 'checkbox') { node.value = ''; node.classList.remove('bad'); }
    if (!minor && node.type === 'checkbox') { node.checked = false; }
  });
    /* A child has no national number: asking for one would stop every minor.
       The value is cleared too, so switching back and forth cannot leave a
       number on a child's record. */
    document.querySelectorAll('[data-adult-only]').forEach(function (node) {
      node.hidden = minor;
      if (minor) {
        var input = node.querySelector('input');
        if (input) { input.value = ''; input.classList.remove('bad'); }
      }
    });
    if (!minor) clearBad(GUARDIAN_FIELDS);
    updateTotal();
  }

  function clearBad(ids) {
    ids.forEach(function (id) { var n = el(id); if (n) n.classList.remove('bad'); });
  }

  /* ---------------- the plans and the live total ---------------- */

  /* Which extras the club offers here. Absent means offered, so an answer from
     an older server, or a failed request, leaves the form as it was. */
  var offered = { transport: true, uniform: true };

  function loadPlans() {
    /* Prices are public in firestore.rules, and the endpoint answers without a
       session, so a visitor sees what the club actually charges. If it fails the
       form still works on the built-in list.

       The category and the pool travel with the question, because the fee depends
       on both: asked once for everybody, a junior at a pool with no changing room
       was quoted the senior uniform price and offered a service that pool does
       not have. */
    var q = 'category=' + encodeURIComponent(category())
      + '&facility=' + encodeURIComponent(val('facility') || '');
    return fetch('/api/subscription-plans?' + q)
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
        if (data.offered) {
          offered = { transport: data.offered.transport !== false, uniform: data.offered.uniform !== false };
          /* A service the club does not offer here is not shown, and is not
             silently charged for either. */
          ['transport', 'uniform'].forEach(function (key) {
            var box = el(key);
            if (!box) return;
            var line = box.closest('.opt') || box.parentNode;
            if (line && line.classList) line.hidden = !offered[key];
            if (!offered[key]) box.checked = false;
          });
        }
        paintPlans();
        updateTotal();
      })
      .catch(function () { /* the fallback list stays in place */ });
  }

  /* The pool names come from the club, so a rename in Settings reaches this form
     without a code change. An empty or failed list keeps the built-in four. */
  function paintFacilities() {
    var names = facilities.length ? facilities : FALLBACK_FACILITIES;
    var select = el('facility');
    var keep = select.value;
    select.innerHTML = names.map(function (n) {
      return '<option value="' + F.esc(n) + '">' + F.esc(n) + '</option>';
    }).join('');
    if (keep && names.indexOf(keep) !== -1) select.value = keep;
  }

  function loadFacilities() {
    return fetch('/api/facilities')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!Array.isArray(data)) return;
        var names = data.map(function (f) { return String((f && f.name) || '').trim(); })
          .filter(Boolean);
        if (names.length) { facilities = names; paintFacilities(); }
      })
      .catch(function () { /* the built-in list stays in place */ });
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
    guardian_national_id: 'اكتب رقم تعريف الولي.',
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
      /* The stroke field is off the form: the club takes it from the swimmer's level
       at the pool. The key stays so the shape of a request does not change, and
       records collected before this still print it. */
      swimming_strokes: '',
      phone: val('phone'),
      whatsapp: val('whatsapp'),
      address: val('address'),
      membership_no: val('membership_no'),
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

    var body = payload();
    /* Firestore refuses a document over 1 MiB, and the photo travels inside it.
       A photo heavy enough to tip the record over would cost the whole
       registration, not just the picture, so the size is checked here and the
       photo is left out rather than losing the names with it. */
    var dropped = false;
    if (state.photo && payloadBytes(body) > DOC_MAX_BYTES) {
      dropped = true;
      body.photo = '';
      body.photo_omitted = true;
    }

    return fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || 'تعذّر إرسال الطلب. تحقّق من الاتصال وحاول مجدداً.');
        return data;
      });
    }).then(function (data) {
      /* The printed form shows what was actually stored, not what was typed,
         so the two can never disagree on paper. */
      state.sent = Object.assign(body, {
        application_no: data.application_no,
        expected_amount: data.expected_amount
      });
      clearDraft();
      showDone();
    }).catch(function (e) {
      /* The draft is deliberately kept: nothing the person typed is lost when
         a send fails, so they can try again on the same phone. */
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
    guardian_national_id: 'تعريف الولي', notes: 'ملاحظة'
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

    /* Say so plainly rather than let the person believe the picture is on the
       paperwork: it can be added at the club, and everything else is stored. */
    var warn = el('done-warning');
    if (rec.photo_omitted) {
      warn.textContent = 'وصل طلبك كاملًا، لكن الصورة لم تُرفق لحجمها. أضِفها عند النادي، '
        + 'واعرض الرقم أعلاه على الموظف.';
      warn.hidden = false;
    }

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
  paintFacilities();
  syncCategory();
  updateTotal();
  paintPhoto();

  if (applyDraft(readDraft())) {
    say('استعدنا مسودة حفظتها على هذا الجهاز. راجعها ثم أرسل.', 'ok');
  }
  loadPlans();
  loadFacilities();
})();
