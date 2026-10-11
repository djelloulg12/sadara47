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

  /* ---------------------- الأرقام العربية ---------------------- */
  /* The club writes its numbers the way it writes its forms, in Arabic-Indic
     digits, and its dates as year/month/day. Both are accepted in either set of
     digits, and both are read back in Arabic-Indic.

     What is stored is Latin, and that is not a preference: an identity number is
     compared against the ones already on file to catch the same person
     registering twice, a registration number is read back out of itself to count
     the next one, and a birth date is subtracted from today to work out an age.
     Storing ١٩٨٥ where those expect 1985 would make the club's own duplicate
     check answer "not seen before" for somebody already on the list. So the
     person reads and writes Arabic digits, and the database holds the one form
     both of those are converted to on the way through. */
  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  function arDigits(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/[0-9]/g, function (d) { return AR_DIGITS[Number(d)]; });
  }

  /* Folded by code point, not through a table of characters: written out, the
     Arabic-Indic and Persian sets are indistinguishable, and a table that quietly
     lost one of them would leave the digits it was not asked about unchanged. A
     subtraction cannot get that wrong. */
  function latinDigits(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  function pad2(v) { return String(v).length < 2 ? '0' + v : String(v); }

  /* The date the club writes: 2026/10/11, in Arabic-Indic digits. Anything that
     is not a plain date is passed through arDigits alone, so a note somebody typed
     is still shown rather than dropped. */
  function slashDate(value) {
    var raw = latinDigits(value);
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw.trim());
    if (!m) return arDigits(raw);
    return arDigits(m[1] + '/' + pad2(m[2]) + '/' + pad2(m[3]));
  }

  /* The same date for the database. '' when the text is not a date rather than a
     guess: a birth date that has been guessed is a member who is the wrong age on
     the card for ever. */
  function isoDate(value) {
    var raw = latinDigits(value).trim();
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw);
    if (!m) return '';
    var month = Number(m[2]), day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  }

  /* The fields that hold a number rather than a name. Their digits are folded to
     Arabic as they pass the field and back to Latin as they leave it, so the same
     number is found whichever set it was typed in -- a number quoted over the
     phone in Arabic and typed in Latin is still the same number. */
  var NUMBER_FIELDS = [
    'national_id', 'birth_certificate_no', 'membership_no',
    'phone', 'whatsapp', 'guardian_phone', 'guardian_national_id'
  ];
  var DATE_FIELDS = ['birth_date', 'guardian_birth_date'];

  /* What a number field gives up: the digits as they were typed, in either set. */
  function valNumber(id) {
    return latinDigits(val(id));
  }

  /* What a date field gives up: one form, for the database. '' when what was typed
     is not a date, which is caught by validate() before the request is sent. */
  function valDate(id) {
    return isoDate(val(id));
  }

  /* A date laid out as it is finished.
     Nothing is re-written while the year is still being typed -- taking the
     slashes away under the caret moves it out from under the person and turns
     four keystrokes into an argument with the field. Once there is enough to be a
     date it is laid out, and a dash typed where a slash belongs is taken as a
     dash, because that is how the date is written on the card. */
  function layOutDate(raw) {
    var text = latinDigits(raw);
    var digits = text.replace(/[^0-9]/g, '');
    var hasSep = /[-/.]/.test(text);
    if (!hasSep && digits.length <= 4) return arDigits(digits);
    if (!hasSep && digits.length <= 6) return arDigits(digits.slice(0, 4) + '/' + digits.slice(4));
    if (!hasSep && digits.length <= 8) return arDigits(digits.slice(0, 4) + '/' + digits.slice(4, 6) + '/' + digits.slice(6));
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text.trim());
    if (m) return slashDate(m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]));
    return arDigits(text.slice(0, 12));
  }

  /* A number as it is finished: its digits shown in Arabic, and the spaces and
     dashes a person reads a number with left exactly as they were typed -- those
     are how it is written on the card and are not part of the number. */
  function layOutNumber(raw) {
    return String(raw).replace(/[0-9]/g, function (d) { return AR_DIGITS[Number(d)]; });
  }

  function listenForDigits() {
    NUMBER_FIELDS.concat(DATE_FIELDS).forEach(function (id) {
      var node = el(id);
      if (!node) return;
      var isDate = DATE_FIELDS.indexOf(id) !== -1;
      var relayout = function () {
        var before = node.value;
        var after = isDate ? layOutDate(before) : layOutNumber(before);
        if (after === before) return;
        var at = node.selectionStart;
        node.value = after;
        /* The caret goes back to where it was in the text being edited. Setting the
           value alone drops it at the end, so a digit typed in the middle of a
           number lands in the wrong place. */
        if (document.activeElement === node) {
          try { node.setSelectionRange(at, at); } catch (_) { /* not every field allows it */ }
        }
      };
      node.addEventListener('input', relayout);
      /* A number pasted from a message arrives in whichever digits the sender used;
         the same folding puts it in the shape a typed one would be in. */
      node.addEventListener('paste', function () { window.setTimeout(relayout, 0); });
    });
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
        applyArrival();
        updateTotal();
      })
      .catch(function () { /* the fallback list stays in place */ });
  }

  /* What the visitor was told on the way here: a plan chosen on the platform's
     price cards travels in the query, and this applies it. Without it the form
     opens on the first plan in the list, so the person would pick one price and
     be registered on another.

     Applied after the prices arrive, because until then the select holds the
     built-in list and paintPlans() would overwrite it. A parameter naming a plan
     that no longer exists is ignored rather than leaving the select on nothing. */
  function applyArrival() {
    var wanted = null;
    try { wanted = new URLSearchParams(location.search).get('plan'); } catch (_) { /* older browser */ }
    if (!wanted) return;
    var box = el('subscription_code');
    if (!box) return;
    var known = Array.prototype.some.call(box.options, function (o) { return o.value === wanted; });
    if (!known) return;
    box.value = wanted;
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
    var required = ['first_name_ar', 'last_name_ar', 'birth_date', 'phone', 'address',
                    'email', 'username', 'password', 'password_confirm'];
    if (category() === 'minor') required = required.concat(GUARDIAN_FIELDS);

    required.forEach(function (id) { if (!val(id)) missing.push(id); });

    if (!val('birth_date')) missing.push('birth_date');
    /* A date that is present but is not one is not a date. It is caught here
       rather than being sent and quietly stored, because a birth date that has
       been guessed is a member who is the wrong age on the card for ever. */
    else if (!isoDate(val('birth_date'))) missing.push('birth_date');
    if (val('guardian_birth_date') && !isoDate(val('guardian_birth_date'))) {
      missing.push('guardian_birth_date');
    }
    var phone = val('phone');
    if (phone && latinDigits(phone).replace(/[\s.\-()]/g, '').length < 9) missing.push('phone');
    /* The shape of an address is checked here rather than being left to the mail
       provider, so a typo is caught before a request is written rather than after
       somebody has tried to sign in with something that was never an address. */
    if (val('email') && !EMAIL_RE.test(val('email').trim())) missing.push('email');
    if (val('username') && !USERNAME_RE.test(val('username').trim())) missing.push('username');
    if (val('password') && val('password').length < 8) missing.push('password');
    /* Typed twice so nobody is locked out by a character nobody can see. */
    if (val('password') && val('password') !== val('password_confirm')) missing.push('password_confirm');
    if (!el('terms').checked) missing.push('terms');
    if (category() === 'minor' && !el('guardian_consent').checked) missing.push('guardian_consent');

    return Array.from(new Set(missing));
  }

  var MESSAGES = {
    first_name_ar: 'اكتب الاسم بالعربية.',
    last_name_ar: 'اكتب اللقب بالعربية.',
    birth_date: 'اكتب تاريخ الميلاد بصيغة سنة/شهر/يوم — 1998/03/17.',
    phone: 'اكتب رقم هاتف صحيح.',
    address: 'اكتب العنوان.',
    email: 'اكتب بريدًا إلكترونيًا صحيحًا — مثال: name@example.com',
    username: 'اسم المستخدم: حروف لاتينية وأرقام و . _ - فقط، من 3 إلى 32 خانة.',
    password: 'كلمة المرور ثماني خانات على الأقل.',
    password_confirm: 'كلمتا المرور غير متطابقتين. أعد كتابة كلمة المرور.',
    guardian_first_name: 'اكتب اسم الولي.',
    guardian_last_name: 'اكتب لقب الولي.',
    guardian_national_id: 'اكتب رقم تعريف الولي.',
    guardian_birth_date: 'اكتب تاريخ ميلاد الولي بصيغة سنة/شهر/يوم — 1975/06/02.',
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
      /* A password never goes into the draft. The draft is a convenience -- it is
         there so nothing typed is lost when a send fails -- and a draft that holds
         a password is a password left lying on the device, readable by the next
         person to pick up the phone and by anything that reads the page's
         storage. The account fields are typed again instead; everything else is
         restored. */
      if (node.type === 'password') return;
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
      } else {
        /* A draft written before this change holds a date as the machine stored
           it, or a number in Latin digits; one written after holds them as the
           club reads them. Both are laid out again rather than trusted, so a
           restored form never shows one shape while another shows the other. */
        node.value = DATE_FIELDS.indexOf(key) !== -1 ? slashDate(data[key])
          : (NUMBER_FIELDS.indexOf(key) !== -1 ? arDigits(data[key]) : data[key]);
      }
    });
    state.photo = data.__photo || '';
    paintPhoto();
    syncCategory();
    /* Restored in the order the form reads them: the wilaya first, because it is
       what decides the communes, and the commune is then put back inside it. */
    adoptWilaya(data.wilaya, data.birth_place);
    updateTotal();
    return true;
  }

  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} }

  /* ---------------- sending ---------------- */

  function payload() {
    var plan = selectedPlan();
    return {
      /* Which kind of file this is. The rules separate a coach's own request from
         a public sign-up, and the deployed rules require the field to be there
         -- a request that leaves it out is refused with "you do not have
         permission", which is a true statement that tells the person nothing.
         It was missing here, so every registration from this page was rejected
         while the local server, which does not read the rules, accepted it. */
      application_type: 'swimmer',
      sport: 'السباحة',
      category: category(),
      first_name_ar: val('first_name_ar'),
      last_name_ar: val('last_name_ar'),
      first_name_fr: val('first_name_fr'),
      last_name_fr: val('last_name_fr'),
      national_id: valNumber('national_id'),
      birth_certificate_no: valNumber('birth_certificate_no'),
      birth_place: val('birth_place'),
      wilaya: val('wilaya'),
      birth_date: valDate('birth_date'),
      gender: val('gender'),
      blood_group: val('blood_group'),
      level: val('level'),
      /* The stroke field is off the form: the club takes it from the swimmer's level
       at the pool. The key stays so the shape of a request does not change, and
       records collected before this still print it. */
      swimming_strokes: '',
      phone: valNumber('phone'),
      whatsapp: valNumber('whatsapp'),
      address: val('address'),
      membership_no: valNumber('membership_no'),
      guardian_first_name: val('guardian_first_name'),
      guardian_last_name: val('guardian_last_name'),
      guardian_birth_date: valDate('guardian_birth_date'),
      guardian_relation: val('guardian_relation'),
      guardian_phone: valNumber('guardian_phone'),
      guardian_national_id: valNumber('guardian_national_id'),
      guardian_consent: checked('guardian_consent'),
      guardian_child: (val('first_name_ar') + ' ' + val('last_name_ar')).trim(),
      subscription_code: val('subscription_code'),
      plan_name: plan.name,
      facility: val('facility'),
      /* The account the request is filed under. The password is not among them
         and never is: Firebase hashed it before it was ever written anywhere, and
         this request carries the name, not the secret. */
      email: val('email'),
      username: val('username'),
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

  /* ---------------- the account ---------------- */

  /* Checked here as well as by the mail provider, so a typo is caught before a
     request is written rather than after somebody has tried to sign in with an
     address that was never an address. */
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  var USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;

  var ACCOUNT_FIELDS = ['email', 'username', 'password', 'password_confirm'];

  /* Firebase keeps the password and hands back nothing: it is hashed there and is
     never readable, by us or by anybody. It is offered to the provider and to
     nobody else -- not to the request, not to the draft, not to the console. */
  function createAccount(credentials) {
    if (!(window.firebase && firebase.auth)) {
      return Promise.resolve({ uid: '', skipped: true });
    }
    return firebase.auth().createUserWithEmailAndPassword(credentials.email, credentials.password)
      .then(function (credential) { return { uid: credential.user.uid }; })
      .catch(function (error) {
        var code = String((error && error.code) || '');
        if (code === 'auth/email-already-in-use') {
          var e = new Error('هذا البريد الإلكتروني مسجّل مسبقًا. سجّل الدخول أو استعمل «نسيت كلمة المرور؟».');
          e.duplicate = true;
          throw e;
        }
        if (code === 'auth/weak-password') {
          throw new Error('كلمة المرور ضعيفة. اختر ثماني خانات على الأقل.');
        }
        throw new Error((error && error.message) || 'تعذّر إنشاء الحساب.');
      });
  }

  /* The account stands at the door until the club answers, and the reason for a
     refusal is written where the person reads it when they try again. */
  function openAccount(uid, record) {
    if (!uid || !(window.firebase && firebase.firestore)) return Promise.resolve();
    try {
      return firebase.firestore().collection('users').doc(uid).set({
        name: [record.first_name_ar, record.last_name_ar].filter(Boolean).join(' '),
        email: record.email,
        username: record.username,
        role: 'member',
        /* The club's own wording for the three states, so the page and the
           database never disagree about what a status means. Written to
           request_status, because `status` on the club's own accounts has always
           meant whether the account may be used at all. */
        request_status: 'pending',
        phone: record.phone || '',
        birth_date: record.birth_date || '',
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {
        /* The account exists either way. Failing to write the profile must not
           lose the registration that was accepted a moment ago. */
      });
    } catch (_) { return Promise.resolve(); }
  }

  function send() {
    var button = el('submit');
    button.disabled = true;
    button.textContent = 'جارٍ الإنشاء…';

    var body = payload();
    var credentials = {
      email: val('email'),
      password: val('password'),
      username: val('username')
    };
    /* The account is made first: it is what the request is filed under, and a
       request with no account behind it is a request the person can never follow
       up on. */
    return createAccount(credentials).then(function (account) {
      button.textContent = 'جارٍ الإرسال…';
      if (account.uid) body.applicant_uid = account.uid;
      /* Firestore refuses a document over 1 MiB, and the photo travels inside it.
         A photo heavy enough to tip the record over would cost the whole
         registration, not just the picture, so the size is checked here and the
         photo is left out rather than losing the names with it. */
      if (state.photo && payloadBytes(body) > DOC_MAX_BYTES) {
        body.photo = '';
        body.photo_omitted = true;
      }
      return fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) {
            var err = new Error(data.error || 'تعذّر إرسال الطلب. تحقّق من الاتصال وحاول مجدداً.');
            err.duplicate = !!data.duplicate;
            throw err;
          }
          return { data: data, account: account };
        });
      });
    }).then(function (out) {
      /* The printed form shows what was actually stored, not what was typed,
         so the two can never disagree on paper. */
      state.sent = Object.assign(body, {
        application_no: out.data.application_no,
        registration_id: out.data.registration_id,
        expected_amount: out.data.expected_amount
      });
      return openAccount(out.account.uid, body).then(function () {
        clearDraft();
        /* The password is not kept anywhere on this device, not even in the
           draft: a draft is a convenience and a draft that holds a password is a
           password left on a phone. */
        el('password').value = '';
        el('password_confirm').value = '';
        showDone();
      });
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

    el('done-no').textContent = arDigits(rec.application_no || '\u2014');
    el('done-amount').textContent = arDigits(
      (Number(rec.expected_amount) || 0).toLocaleString('fr-DZ')) + ' دج';
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
      /* What the person reads is the form the club reads: numbers in Arabic-Indic
         digits and dates as year/month/day. The request behind it holds the other
         form, and the two are converted into each other rather than stored twice. */
      else if (DATE_FIELDS.indexOf(key) !== -1) value = slashDate(value);
      else if (NUMBER_FIELDS.indexOf(key) !== -1) value = arDigits(value);
      return '<div><span>' + F.esc(SUMMARY_LABELS[key]) + '</span><b>' + F.esc(value) + '</b></div>';
    }).join('');
    rows += '<div><span>الاشتراك</span><b>' + F.esc(rec.plan_name || rec.subscription_code || '') + '</b></div>';
    rows += '<div><span>الدفع</span><b>' + F.esc(PAYMENTS[rec.payment_method] || '') + '</b></div>';
    el('done-summary').innerHTML = rows;

    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function longDate() {
    /* The day the request reached the club, written the way the club writes a
       date: year/month/day, in Arabic-Indic digits. An Intl long date names the
       month, which is right for a letter and wrong for a form the club fills in by
       hand and matches against the numbers on a birth certificate. */
    try {
      var now = new Date();
      return slashDate(now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()));
    } catch (_) { return slashDate(new Date().toISOString().slice(0, 10)); }
  }

  /* ---------------- where ---------------- */

  /* The 69 wilayas of Algeria as reorganised in April 2026 (Law 26-06), and the
     1,541 communes inside them. Both are generated by tools/build-algeria.py
     into algeria.js and communes.json, from the published structure -- the 58
     wilayas still circulating online predate the reform, so several names on
     those lists no longer name a wilaya at all.

     Typed, these two fields produced the most useless record the club received:
     a wilaya spelled three ways, or a commune belonging to the wilaya next door.
     A list removes the guesswork and costs the person one click. */

  var HOME_WILAYA = 'غرداية';
  var communeBook = null;  /* the 1,541 communes, fetched once and kept */
  var communeCode = null;  /* the wilaya whose communes are currently listed */

  function paintWilayas() {
    var box = el('wilaya');
    if (!box) return;
    var list = window.SADARA_WILAYAS;
    if (!list || !list.length) return freeText(box, box.value);
    box.innerHTML = '<option value="">--</option>' + list.map(function (w) {
      return '<option value="' + F.esc(w.name) + '" data-code="' + F.esc(w.code) + '"'
        + (w.name === HOME_WILAYA ? ' selected' : '') + '>' + F.esc(w.name) + '</option>';
    }).join('');
  }

  function wilayaCode() {
    var box = el('wilaya');
    if (!box || box.tagName !== 'SELECT') return '';
    var opt = box.options[box.selectedIndex];
    return opt ? (opt.getAttribute('data-code') || '') : '';
  }

  function communeList() {
    if (communeBook) return Promise.resolve(communeBook);
    return fetch('communes.json').then(function (r) {
      if (!r.ok) throw new Error('communes ' + r.status);
      return r.json();
    }).then(function (book) { communeBook = book; return book; });
  }

  function paintCommunes(code, wanted) {
    var box = el('birth_place');
    if (!box || box.tagName !== 'SELECT') return Promise.resolve();
    if (!code) {
      communeCode = null;
      box.innerHTML = '<option value="">--</option>';
      return Promise.resolve();
    }
    if (communeCode !== code) {
      communeCode = code;
      box.innerHTML = '<option value="">…</option>';
    }
    return communeList().then(function (book) {
      /* A slower request for a wilaya the person has already moved away from
         must not repaint the list they are now looking at. */
      if (communeCode !== code) return;
      var names = book[code] || [];
      if (!names.length) return freeText(box, wanted || box.value);
      box.innerHTML = '<option value="">--</option>' + names.map(function (n) {
        return '<option value="' + F.esc(n) + '">' + F.esc(n) + '</option>';
      }).join('');
      /* Only re-select when the commune still belongs to this wilaya. Carrying a
         commune across from the previous wilaya would put a wrong pairing into
         the record, which is the very thing the list exists to prevent. */
      if (wanted && names.indexOf(wanted) !== -1) box.value = wanted;
    }).catch(function () { freeText(box, wanted || ''); });
  }

  /* Swaps a select for a free-text box, keeping the id, the name and whatever
     was already typed. Used when the lists cannot be loaded at all: a form that
     will not send is worse than one the club has to tidy up afterwards. */
  function freeText(node, keep) {
    if (!node || node.getAttribute('data-freetext')) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.id = node.id;
    input.name = node.name;
    input.maxLength = 60;
    input.value = keep || '';
    input.setAttribute('data-freetext', '1');
    if (node.parentNode) node.parentNode.replaceChild(input, node);
  }

  /* Puts a wilaya back onto the form. A value that is not in the list -- a draft
     from before the reform, or a wilaya that has since gone -- is kept as an
     extra option rather than dropped: clearing it silently would change the
     record the person is about to send without their knowing. */
  function adoptWilaya(name, place) {
    var box = el('wilaya');
    if (!box || box.tagName !== 'SELECT') return;
    if (name && !Array.prototype.some.call(box.options, function (o) { return o.value === name; })) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      box.insertBefore(opt, box.options[1] || null);
    }
    if (name) box.value = name;
    paintCommunes(wilayaCode(), place);
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
    /* The wilaya decides which communes are on offer, and a commune from the
       wilaya just left behind is a wrong pairing, so the other list is rebuilt
       from scratch and the old choice cleared. */
    if (e.target.name === 'wilaya') paintCommunes(wilayaCode(), '');
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

  /* Before anything is restored: a draft can only put a value on a control that
     already offers it. */
  paintWilayas();
  paintPlans();
  paintFacilities();
  /* Laid out before the draft is read, so a restored value and a typed one are in
     the same shape rather than the form holding both. */
  listenForDigits();
  syncCategory();
  updateTotal();
  paintPhoto();

  if (applyDraft(readDraft())) {
    say('استعدنا مسودة حفظتها على هذا الجهاز. راجعها ثم أرسل.', 'ok');
  }
  loadPlans();
  loadFacilities();
})();
