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
    saidKind = kind || 'error';
  }
  var saidKind = '';

  /* What a notification looks like: one kind of glyph, one kind of strip, and a
     second line only when there is something else worth saying. */
  var NOTIFY_GLYPH = { ok: '✓', error: '!', info: 'i' };
  /* How long a notice stays. Good news goes by itself; bad news waits, because the
     person comes back to this screen to find out why nothing happened, and a
     message that has already gone answers nothing. */
  var NOTIFY_MS = { ok: 6500, info: 6500, error: 0 };

  var tray = el('toasts');

  function notify(text, kind, more) {
    if (!tray || !text) return null;
    var tone = kind || 'info';
    var card = document.createElement('div');
    card.className = 'toast ' + tone;

    var ic = document.createElement('span');
    ic.className = 'toast-ic';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = NOTIFY_GLYPH[tone] || NOTIFY_GLYPH.info;

    var body = document.createElement('div');
    body.className = 'toast-body';
    var line = document.createElement('p');
    /* Not a heading: a screen reader announcing "تمّ — the request arrived" says
       the same thing twice, and the sentence is what carries the meaning. */
    line.textContent = text;
    body.appendChild(line);
    if (more) {
      var second = document.createElement('p');
      second.textContent = more;
      body.appendChild(second);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-x';
    close.setAttribute('aria-label', 'إغلاق التنبيه');
    close.textContent = '×';

    card.appendChild(ic);
    card.appendChild(body);
    card.appendChild(close);
    tray.insertBefore(card, tray.firstChild);

    /* No more than three at once: a fourth pushes the first off the top, and the
       oldest is the one somebody is most likely to still be reading. */
    while (tray.children.length > 3) tray.removeChild(tray.lastChild);

    var timer = null;
    function dismiss() {
      if (!card.parentNode) return;
      if (timer) { clearTimeout(timer); timer = null; }
      var gone = function () { if (card.parentNode) card.parentNode.removeChild(card); };
      var still = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) { gone(); return; }
      card.classList.add('leaving');
      /* Removed once the animation has run. Without the wait the card would be
         cut off mid-slide; with it, on a machine that has asked for no motion,
         it is cut off immediately -- which is what that machine asked for. */
      setTimeout(gone, 240);
    }
    close.addEventListener('click', dismiss);

    var ms = NOTIFY_MS[tone];
    if (ms) timer = setTimeout(dismiss, ms);
    return dismiss;
  }

  /* What the panel says under the switch, once per arrangement. The third is the
     case in between: the account this device already holds, where not even the
     password is asked for -- a guardian registering a second child, on the same
     phone, minutes after the first. */
  var ACCOUNT_SAYS = {
    new: 'به تفتح طلبك، وترى مصيره، وتطبع استمارتك في أي وقت. لا تُحفظ كلمة المرور '
      + 'في قاعدة بياناتنا — يحفظها Firebase مُشفّرة، ولا يطّلع عليها أحد.',
    returning: 'اسم المستخدم في حسابك، فلا يُطلب منك. تكتب كلمة المرور فقط، '
      + 'وبالحساب نفسه تسجّل كل أبناءك واحدًا بعد الآخر.',
    open: 'حسابك مفتوح على هذا الجهاز — تكتب بيانات السبّاح فقط، ولا اسم مستعمل '
      + 'ولا كلمة مرور. وبه تسجّل كل أبناءك واحدًا بعد الآخر.'
  };

  /* On the same object the print helpers are on, so the checks can raise one the
     way the page does rather than reaching past the front door. */
  F.notify = notify;
  F.setPhoto = acceptPhoto;

  /* An error stops being true the moment the person starts fixing what it was
     about, and leaving it on screen says the request is still refused when it is
     not. Only a complaint is taken back this way: the note that a draft came back
     is still true, and "please wait" would be worse than saying nothing. */
  function clearComplaintOnEdit() {
    if (saidKind === 'error' && !msg.hidden) {
      msg.hidden = true;
      saidKind = '';
      Array.prototype.forEach.call(form.querySelectorAll('.bad'), function (n) {
        n.classList.remove('bad');
      });
    }
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
  /* The club writes its numbers 0 1 2 3 4 5 6 7 8 9 and its dates year/month/day.

     One form, end to end, and that is deliberate: a number read off the sheet is
     read aloud over a counter and typed back in to find the record, an identity
     number is compared against the ones on file to catch the same person twice,
     and a birth date is subtracted from today to work out an age.

     What is left to do is fold a number that arrives in Arabic-Indic digits, so
     somebody copying one out of a message gets a number the club can read back --
     and somebody who types ٠١٢٣ watches it become 0123 as they type, rather than
     being told at the end that what they typed was not a number.

     Folded by code point rather than through a table of characters: the
     Arabic-Indic and Persian sets are indistinguishable on screen, and a table
     that quietly lost one of them would fold the digits it was not asked about
     and leave the rest. A subtraction cannot get that wrong. */
  function latinDigits(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  /* What the person reads. One definition decides it for every field. */
  function clubDigits(value) {
    return latinDigits(value);
  }

  function pad2(v) { return String(v).length < 2 ? '0' + v : String(v); }

  /* The date the club writes: 2026/10/11. A date typed with dashes, or with a
     one-digit month, is still a date and is laid out the same way. */
  function slashDate(value) {
    var raw = latinDigits(value);
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw.trim());
    if (!m) return latinDigits(value);
    return m[1] + '/' + pad2(m[2]) + '/' + pad2(m[3]);
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
  var DATE_FIELDS = [
    'birth_date', 'guardian_birth_date',
    'national_id_expiry', 'guardian_national_id_expiry', 'guardian_card_issued'
  ];

  /* A national identity card number is nine digits. Checked here rather than left
     to the eye at the counter, because this is the number the club looks a member
     up by: one written with eight is not the same member as one written with ten,
     and it is also what the duplicate check compares -- a number written wrongly
     here is how one person ends up on the list twice. */
  var CARD_DIGITS = 9;
  var cardNumberError = function (who) {
    return who + ' يجب أن يكون ' + CARD_DIGITS + ' أرقام، كما هو مكتوب على البطاقة.';
  };

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
    if (!hasSep && digits.length <= 4) return clubDigits(digits);
    if (!hasSep && digits.length <= 6) return clubDigits(digits.slice(0, 4) + '/' + digits.slice(4));
    if (!hasSep && digits.length <= 8) return clubDigits(digits.slice(0, 4) + '/' + digits.slice(4, 6) + '/' + digits.slice(6));
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text.trim());
    if (m) return slashDate(m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]));
    return clubDigits(text.slice(0, 12));
  }

  /* A number as it is finished: folded to Latin and otherwise exactly as it was
     typed. The spaces and dashes a person reads a number with are how it is
     written on the card and are not part of the number, so they are left alone. */
  function layOutNumber(raw) {
    return latinDigits(raw);
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
    form.addEventListener('input', clearComplaintOnEdit);
    form.addEventListener('change', clearComplaintOnEdit);
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

  /* A photograph that has been read and made small. Named, because this is what
     both halves of the page do once the reading is done -- and what the checks
     do, so there is one place that knows what accepting a photograph means. */
  function acceptPhoto(dataUrl) {
    state.photo = dataUrl || '';
    paintPhoto();
    saveDraft();
    return state.photo;
  }

  function takePhoto(file) {
    shrinkPhoto(file).then(acceptPhoto).catch(function (e) {
      say(e.message || 'تعذّر تحميل الصورة.', 'error');
    });
  }

  /* ---------------- validation ---------------- */

  /* Returns the fields that still need an answer, in the order they appear, so
     the person is walked to the first one that is missing. */
  function validate() {
    var missing = [];
    var required = ['first_name_ar', 'last_name_ar', 'birth_date',
                    'phone', 'address',
                    'email', 'username', 'password', 'password_confirm'];
    /* The photograph is part of the registration and not something the club asks
       for at the counter. The official form has a frame for it and the membership
       card has a frame for it, and a registration that cannot be turned into a
       card is not a registration. Asked of everybody: the frame is the same size
       whether the swimmer is eight or forty. */
    if (!state.photo) missing.push('photo');
    if (category() === 'minor') {
      /* The place of birth, for a minor: it is one of the three things that say a
         child is who they are -- two children born the same year in the same
         place are two children -- and it is written on the club's own form after
         the `ب:` on the declaration. An adult has no declaration, so an adult is
         not stopped by a field nothing would print. */
      required = required.concat(GUARDIAN_FIELDS).concat(['birth_place']);
    }

    required.forEach(function (id) { if (!val(id)) missing.push(id); });

    /* Which of the account step's fields are asked for depends on which face is
       showing, and this runs after the walk above because `missing` is what the
       walk fills -- asked for too early, it would take from a list nothing has
       been read into yet, and the guardian with an account already open would be
       stopped by a field they were never shown. */
    if (sessionIsOpen()) {
      /* Everything the step asks for is already held by the browser: the name is
         on the account, the address is signed in, and the password is the one
         this device opened the session with. Nothing here should stand between a
         guardian and a second child. */
      var held = ['username', 'password_confirm', 'password'];
      for (var h = 0; h < held.length; h++) {
        var atHeld = missing.indexOf(held[h]);
        if (atHeld !== -1) missing.splice(atHeld, 1);
      }
    } else if (accountMode() === 'returning') {
      /* The name is the account's and is read from it; the confirmation catches a
         typing slip in a password being set, and no password is being set. */
      var drop = ['username', 'password_confirm'];
      for (var k = 0; k < drop.length; k++) {
        var at = missing.indexOf(drop[k]);
        if (at !== -1) missing.splice(at, 1);
      }
    }

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
    /* The card, for whoever holds one: an adult, and the guardian of a minor. A
       child holds no card, so nothing is asked of one. */
    if (category() === 'adult') {
      if (!val('national_id')) missing.push('national_id');
      else if (latinDigits(val('national_id')).length !== CARD_DIGITS) missing.push('national_id');
      if (!val('national_id_expiry')) missing.push('national_id_expiry');
      else if (!isoDate(val('national_id_expiry'))) missing.push('national_id_expiry');
    }
    if (category() === 'minor') {
      if (!val('guardian_national_id')) missing.push('guardian_national_id');
      else if (latinDigits(val('guardian_national_id')).length !== CARD_DIGITS) {
        missing.push('guardian_national_id');
      }
      if (!val('guardian_national_id_expiry')) missing.push('guardian_national_id_expiry');
      else if (!isoDate(val('guardian_national_id_expiry'))) {
        missing.push('guardian_national_id_expiry');
      }
      if (val('guardian_card_issued') && !isoDate(val('guardian_card_issued'))) {
        missing.push('guardian_card_issued');
      }
    }
    /* And the reverse: a child holds no card, so nothing is asked of one. An adult
       is otherwise stopped by the card fields they never see. */
    if (category() === 'minor') {
      ['national_id', 'national_id_expiry'].forEach(function (id) {
        var i = missing.indexOf(id);
        if (i !== -1) missing.splice(i, 1);
      });
    }
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
    national_id: cardNumberError('رقم بطاقتك'),
    national_id_expiry: 'اكتب تاريخ انتهاء البطاقة بصيغة سنة/شهر/يوم — 2031/04/17.',
    guardian_national_id: cardNumberError('رقم بطاقة الولي'),
    guardian_national_id_expiry: 'اكتب تاريخ انتهاء بطاقة الولي بصيغة سنة/شهر/يوم — 2031/06/02.',
    guardian_card_issued: 'اكتب تاريخ إصدار بطاقة الولي بصيغة سنة/شهر/يوم — 2021/06/02.',
    photo: 'الصورة إجبارية. اختر صورة واضحة، والوجه داخل الإطار.',
    birth_place: 'اختر بلدية الميلاد من القائمة -- تُكتب في استمارة النادي بعد «ب:».',
    password: 'كلمة المرور ثماني خانات على الأقل.',
    password_confirm: 'كلمتا المرور غير متطابقتين. أعد كتابة كلمة المرور.',
    guardian_first_name: 'اكتب اسم الولي.',
    guardian_last_name: 'اكتب لقب الولي.',
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
          : (NUMBER_FIELDS.indexOf(key) !== -1 ? clubDigits(data[key]) : data[key]);
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
      /* The card and the day it runs out. */
      national_id: valNumber('national_id'),
      national_id_expiry: valDate('national_id_expiry'),
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
      guardian_national_id_expiry: valDate('guardian_national_id_expiry'),
      guardian_card_issued: valDate('guardian_card_issued'),
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

  /* What the provider says, in the club's words. Shared by both doors -- making an
     account and returning to one -- because a message that is right on one and
     missing on the other is how the same failure reads in two languages. */
  var SADARA_AUTH_SAYS = {
    'auth/network-request-failed': 'تعذّر الاتصال. تحقّق من الإنترنت ثم أعد المحاولة — ما كتبته محفوظ.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
    'auth/operation-not-allowed': 'تسجيل الحسابات معطّل على هذه المنصة. اتصل بالنادي.',
    'auth/unauthorized-domain': 'هذه الصفحة غير مصرّح لها بالتسجيل. اتصل بالنادي.'
  };

  var ACCOUNT_FIELDS = ['email', 'username', 'password', 'password_confirm'];

  /* Which account this is: one being made, or one already held. Read from the
     buttons rather than remembered, so what is on the screen and what is on the
     way cannot disagree. */
  function accountMode() {
    var back = el('acct-returning');
    return back && back.classList.contains('is-on') ? 'returning' : 'new';
  }

  /* A session this page already holds. Somebody who has not been asked a question
     must not be stopped by a password they were not asked for. */
  function sessionIsOpen() {
    return accountMode() === 'returning' && !!openAccountFor(val('email'));
  }

  function setAccountMode(mode, open) {
    var returning = mode === 'returning';
    var pair = [['acct-new', 'new'], ['acct-returning', 'returning']];
    pair.forEach(function (p) {
      var b = el(p[0]);
      if (!b) return;
      var on = p[1] === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    /* The panel carries the arrangement as well: the tint is the same information
       the button carries, said a second way, because somebody glancing at a phone
       reads the colour and not a line of small text. */
    var panel = el('acct-panel');
    if (panel) panel.setAttribute('data-mode', mode);

    /* The user name belongs to the account, so somebody signing in to an account
       they already hold does not choose one -- it is read from their profile. And
       the confirmation exists to catch a typing slip in a password being set,
       which is not happening here.

       Both leave the row rather than sitting there greyed out. A disabled field
       beside somebody who must not fill it in has told them the wrong thing; one
       that is not there has told them the truth -- and the row closes up around
       what is left instead of holding an empty half. */
    var userField = el('acct-username-field');
    var confirmField = el('acct-confirm-field');
    if (userField) userField.hidden = returning;
    if (confirmField) confirmField.hidden = returning;

    /* What the password field is now for. Not a new sentence, but a different
       one: it is the password of an account that already exists. */
    var passName = el('acct-pass-name');
    var passHint = el('acct-pass-hint');
    var pass = el('password');
    if (passName) passName.textContent = returning ? 'كلمة مرور حسابك *' : 'كلمة المرور *';
    if (passHint) {
      passHint.textContent = open
        ? 'حسابك مفتوح — لا تُكتب هنا.'
        : returning ? 'ثماني خانات على الأقل.' : 'ثماني خانات على الأقل.';
    }
    if (pass) {
      pass.setAttribute('autocomplete', returning ? 'current-password' : 'new-password');
      if (open) pass.disabled = true; else pass.disabled = false;
    }

    var say = el('acct-say');
    if (say) {
      say.textContent = ACCOUNT_SAYS[open && returning ? 'open'
        : returning ? 'returning' : 'new'];
    }
    clearComplaintOnEdit();
  }

  el('acct-new').addEventListener('click', function () { setAccountMode('new'); });
  el('acct-returning').addEventListener('click', function () {
    setAccountMode('returning', !!openAccountFor(val('email')));
  });

  /* The address decides, and only the address. An account this browser already
     holds for exactly the address in the box is the same person -- there is no
     second one -- so the step turns itself rather than asking for a password
     that is already held, which is the last thing between a guardian and a second
     registration. Typed one character at a time, so it says it once: the moment
     the address matches, and never again while it keeps matching. */
  function recogniseOpenSession() {
    if (accountMode() === 'returning') return;
    if (!openAccountFor(val('email'))) return;
    setAccountMode('returning', true);
    notify('حسابك مفتوح على هذا الجهاز.', 'info',
      'تسجيل سبّاح آخر لن يطلب منك كلمة مرور من جديد.');
  }
  el('email').addEventListener('input', recogniseOpenSession);
  el('email').addEventListener('change', recogniseOpenSession);

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
        /* The club fills this in on a phone, often on a weak connection, and a
           provider's own wording at the end of it is not what makes somebody
           press the button again. */
        if (SADARA_AUTH_SAYS[code]) throw new Error(SADARA_AUTH_SAYS[code]);
        throw new Error((error && error.message) || 'تعذّر إنشاء الحساب.');
      });
  }

  /* The name an account chose for itself. Read, never asked: a person signing in
     to an account they hold is not choosing a name again, and a name chosen again
     is a name somebody else could have taken in between.

     A failure here is not worth stopping for. The request can be filed without
     the name on it -- the club's screen asks a member by other means -- and a
     profile that cannot be read is not a reason to turn away a child whose
     registration is otherwise complete. */
  function accountUsername(uid) {
    if (!uid || !(window.firebase && firebase.firestore)) return Promise.resolve('');
    try {
      return firebase.firestore().collection('users').doc(uid).get()
        .then(function (snap) {
          var data = snap && snap.data ? snap.data() : null;
          return (data && data.username) || '';
        })
        .catch(function () { return ''; });
    } catch (_) { return Promise.resolve(''); }
  }

  /* Which account this request belongs to, worked out from what the browser is
     actually signed in with. Never from the form: a field saying which account to
     use is a field anybody can set. */
  function openAccountFor(email) {
    if (!(window.firebase && firebase.auth)) return null;
    try {
      var user = firebase.auth().currentUser;
      if (!user) return null;
      var at = String(email || '').trim().toLowerCase();
      var mine = String(user.email || '').toLowerCase();
      return at && mine && at !== mine ? null : user;
    } catch (_) { return null; }
  }

  /* Signing in to an account that already exists. Every way this can go wrong has
     its own sentence, because "wrong password" and "no such account" send a person
     to two different places. */
  function signInAccount(email, password) {
    return firebase.auth().signInWithEmailAndPassword(email, password)
      .then(function (credential) {
        return { uid: credential.user.uid, returning: true };
      })
      .catch(function (error) {
        var code = String((error && error.code) || '');
        /* The two failures that are about this person and not the provider:
           a wrong password and an address with no account. They send somebody to
           two different places, so each says which. */
        var mine = {
          'auth/wrong-password': 'كلمة المرور غير صحيحة.',
          'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
          'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني. اختر «حساب جديد».'
        };
        throw new Error(mine[code] || SADARA_AUTH_SAYS[code]
          || ((error && error.message) || 'تعذّر تسجيل الدخول.'));
      });
  }

  /* The account stands at the door until the club answers, and the reason for a
     refusal is written where the person reads it when they try again. */
  function openAccount(uid, record, returning) {
    if (!uid || !(window.firebase && firebase.firestore)) return Promise.resolve();
    var users = firebase.firestore().collection('users').doc(uid);
    /* A profile that already exists belongs to the person, not to the request that
       happens to be in front of it. Writing it again for a second child would
       rename the guardian's account after the child, and put an account the club
       has already answered back behind the door asking to be answered again. So:
       written once when it is made, and afterwards only where something is
       missing. */
    if (returning) {
      return users.get().then(function (snap) {
        var already = snap && snap.exists ? (snap.data() || {}) : {};
        var gaps = {};
        if (!already.username && record.username) gaps.username = record.username;
        if (!already.name && !already.first_name) gaps.name = record.first_name_ar || '';
        if (!Object.keys(gaps).length) return null;
        return users.set(gaps, { merge: true });
      }).catch(function () { return null; });
    }
    try {
      return users.set({
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
       up on. For a guardian coming back for their second child there is nothing
       to make, so this is the order of preference rather than a sequence. */
    var already = openAccountFor(credentials.email);
    var account$;
    if (already) {
      /* A session this page opened earlier -- the second child, on the same
         phone. Asking for the password again would be asking for a thing the
         browser already holds, and refusing on the strength of it would refuse a
         child for a reason that has nothing to do with the child. */
      account$ = Promise.resolve({ uid: already.uid, returning: true });
    } else if (accountMode() === 'returning') {
      account$ = signInAccount(credentials.email, credentials.password);
    } else {
      account$ = createAccount(credentials);
    }

    return account$.then(function (account) {
      if (account.returning) {
        /* The name comes from the account, so a family that comes back cannot be
           refused by their own first registration. */
        return accountUsername(account.uid).then(function (own) {
          if (own) {
            var box = el('username');
            if (box) box.value = own;
            body.username = own;
            state.accountName = own;
          }
          return account;
        });
      }
      return account;
    }).then(function (account) {
      button.textContent = 'جارٍ الإرسال…';
      if (account.uid) body.applicant_uid = account.uid;
      /* Says plainly to the server that this is the same person coming back. It
         carries no right of its own -- the server decides from the account this
         page is signed in with, not from this -- but without it a second request
         from one account would be treated as a stranger's. */
      if (account.returning) body.returning_account = true;
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
      return openAccount(out.account.uid, body, out.account.returning).then(function () {
        clearDraft();
        /* The password is not kept anywhere on this device, not even in the
           draft: a draft is a convenience and a draft that holds a password is a
           password left on a phone. */
        el('password').value = '';
        el('password_confirm').value = '';
        showDone();
        notify('تم استلام طلبك.', 'ok',
          'رقم الطلب ' + clubDigits(out.data.application_no || '')
          + ' — اطبع الاستمارة، وقّعها، ثم أحضرها إلى النادي.');
      });
    }).catch(function (e) {
      /* The draft is deliberately kept: nothing the person typed is lost when
         a send fails, so they can try again on the same phone. */
      say(e.message || 'تعذّر إرسال الطلب.', 'error');
      notify('تعذّر إرسال الطلب.', 'error',
        'لم يُفقد ما كتبته. أعد المحاولة من نفس الهاتف.');
      button.disabled = false;
      button.textContent = 'إرسال الاستمارة';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------- after sending ---------------- */

  var SUMMARY_LABELS = {
    first_name_ar: 'الاسم', last_name_ar: 'اللقب', birth_date: 'تاريخ الميلاد',
    gender: 'الجنس', blood_group: 'فصيلة الدم',
    national_id: 'رقم بطاقة التعريف', national_id_expiry: 'انتهاء البطاقة',
    phone: 'الهاتف', whatsapp: 'الواتساب', address: 'العنوان',
    birth_place: 'مكان الميلاد', wilaya: 'الولاية', level: 'المستوى',
    swimming_strokes: 'نمط السباحة', facility: 'المنشأة',
    guardian_first_name: 'اسم الولي', guardian_last_name: 'لقب الولي',
    guardian_relation: 'القرابة', guardian_phone: 'هاتف الولي',
    guardian_national_id: 'بطاقة الولي',
    guardian_national_id_expiry: 'انتهاء بطاقة الولي',
    guardian_card_issued: 'إصدار بطاقة الولي', notes: 'ملاحظة'
  };

  var PAYMENTS = { cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية' };
  var GENDERS = { male: 'ذكر', female: 'أنثى' };

  /* The offer appears when there is an account to come back to, and says what
     it will keep -- somebody about to clear a screen needs to know it is the
     child's answers that go and not the first registration. */
  function showDone() {
    var rec = state.sent;
    form.hidden = true;
    done.hidden = false;

    var sibling = el('done-sibling');
    if (sibling) sibling.hidden = !(rec && rec.applicant_uid);

    el('done-no').textContent = clubDigits(rec.application_no || '\u2014');
    el('done-amount').textContent = clubDigits(
      (Number(rec.expected_amount) || 0).toLocaleString('fr-DZ')) + ' دج';
    el('done-date').textContent = longDate();

    /* Say so plainly rather than let the person believe the picture is on the
       paperwork: it can be added at the club, and everything else is stored. */
    var warn = el('done-warning');
    if (rec.photo_omitted) {
      warn.textContent = 'وصل طلبك، لكن الصورة لم تُرفق لأن الملف صار أكبر من المسموح. '
        + 'أعد إرسال الطلب بصورة أصغر حجمًا — مربوطة من الأسفل كما في المثال — '
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
      else if (NUMBER_FIELDS.indexOf(key) !== -1) value = clubDigits(value);
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
      /* The photograph is not an input, so being walked to it means being walked
         to the control that picks one. */
      if (first) first.focus();
      else if (bad.indexOf('photo') !== -1 && el('photo')) {
        var choose = el('photo').closest('label');
        if (choose) { choose.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
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
    notify('حُفظت المسودة.', 'ok', 'ستعود تلقائياً في المرة القادمة على هذا الجهاز.');
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

  /* The swimmer's own answers, by name. Written out rather than worked out from
     what is on the screen, because the fields that must survive are the ones that
     are not the child's, and guessing which is which from a list of everything
     else is how a request goes out with no parent on it. */
  var SWIMMER_FIELDS = [
    'first_name_ar', 'last_name_ar', 'first_name_fr', 'last_name_fr',
    'birth_date', 'birth_place', 'blood_group', 'gender', 'notes', 'photo'
  ];

  function anotherSwimmer() {
    done.hidden = true;
    form.hidden = false;
    state.sent = null;
    SWIMMER_FIELDS.forEach(function (id) {
      var n = el(id);
      if (!n) return;
      n.value = '';
      n.classList.remove('bad');
      n.setAttribute('aria-invalid', 'false');
    });
    state.photo = '';
    paintPhoto();
    /* The other face of the step is the right one. Whether the password is asked
       for as well is not assumed -- it is asked of the session, because a device
       that has not kept the account open still needs it. */
    setAccountMode('returning', !!openAccountFor(val('email')));
    syncCategory();
    updateTotal();
    saveDraft();
    say('');
    notify('حقلت استمارة سبّاح جديد.', 'info',
      'بيانات الولي كما هي، والحساب مفتوح — لا تكتب كلمة المرور من جديد.');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  el('another').addEventListener('click', anotherSwimmer);

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
  /* Every date field gets a calendar. Attached by class, so a date field added
     later is a date field with a calendar on it -- and each field says for itself
     which dates it will take, because nothing is born next year and a card does
     not run out before the club's own records begin. */
  if (window.SADARA_CALENDAR) window.SADARA_CALENDAR.attachAll();
  syncCategory();
  updateTotal();
  paintPhoto();

  if (applyDraft(readDraft())) {
    say('استعدنا مسودة حفظتها على هذا الجهاز. راجعها ثم أرسل.', 'ok');
    notify('استُعيدت مسودة من هذا الجهاز.', 'info', 'راجعها ثم أرسل.');
  }
  loadPlans();
  loadFacilities();
})();
