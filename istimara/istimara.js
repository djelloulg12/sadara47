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

  /* `door` is a place to go, not a sentence about going there.

     A link inside `textContent` is a link nobody can press, so the only way to
     point at the club's sign-in used to be to write the words "go to the sign-in
     page" and trust the reader to guess which one -- which is what the message for
     an address already on file did, about a page it did not name.

     The message is still set as text and the link is built, so nothing that
     reaches the screen can arrive as markup. And the link is never the only thing
     said: it carries a line saying it leaves this page, because a link appearing
     without warning carries somebody off a form they are half-way through. */
  function say(text, kind, door) {
    if (!text) { msg.hidden = true; return; }
    msg.textContent = text;
    msg.className = 'form-msg ' + (kind || 'error');
    if (door) {
      var line = document.createElement('a');
      line.className = 'form-msg-door';
      line.href = door;
      line.textContent = 'ادخل إلى المنصة ←';
      var note = document.createElement('span');
      note.className = 'form-msg-door-note';
      note.textContent = ' (سيترك هذه الصفحة)';
      var row = document.createElement('p');
      row.className = 'form-msg-door-row';
      row.appendChild(line);
      row.appendChild(note);
      msg.appendChild(row);
    }
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

  /* Three numbers, and which of them is the year.

     The club writes the day first: 11/10/2026. Four copies of these rules live on
     this page and all four said the year came first, which meant the calendar wrote
     a shape and the validator on the same field refused it -- the form rejecting
     the output of its own calendar, and telling the person to type something every
     other screen in the club contradicts.

       four digits first   it is a year: the old order
       otherwise           the day is first, always

     Both orders are read on purpose. A person who has the old shape in front of
     them will type it, and refusing a date they meant is worse than reading it the
     way the club writes it. Day first out is also what makes a value round-trip:
     what comes out of a field is what goes back in. */
  function readDateParts(value) {
    var text = latinDigits(value).trim();
    var year = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
    if (year) return { y: year[1], m: year[2], d: year[3] };
    var day = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
    if (!day) return null;
    /* The one rescue that costs nothing: a first number that cannot be a day at all
       is read the only way it can be. The club never writes one. */
    if (Number(day[1]) > 31) return { y: day[3], m: day[2], d: day[1] };
    return { y: day[3], m: day[2], d: day[1] };
  }

  /* How a date is written out for a person: 11/10/2026. */
  function slashDate(value) {
    var raw = latinDigits(value);
    var m = readDateParts(raw);
    if (!m) return raw;
    return pad2(m.d) + '/' + pad2(m.m) + '/' + m.y;
  }


  /* The same date for the database: yyyy-mm-dd, whatever order it was written in.
     What is stored does not move -- that shape is what the queue order and every
     equality query depend on -- and reading both orders is what keeps a field shown
     as dd/mm/yyyy from storing dd/mm/yyyy.

     '' when the text is not a date, rather than a guess: a birth date that has been
     guessed is a member who is the wrong age on the card for ever. */
  function isoDate(value) {
    var raw = latinDigits(value).trim();
    var m = readDateParts(raw);
    if (!m) return '';
    var month = Number(m.m), day = Number(m.d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return m.y + '-' + pad2(m.m) + '-' + pad2(m.d);
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

  /* The biometric national identity card carries eighteen digits. Checked here
     rather than left to the eye at the counter, because this is the number the
     club looks a family up by: one written with seventeen is not the same member
     as one written with eighteen, and it is also what the duplicate check
     compares -- a number written wrongly here is how one person ends up on the
     list twice. */
  var CARD_DIGITS = 18;
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
    /* Eight digits with no separators, in the club's order: the day first. It was
       year first, which made one field answer in two shapes depending only on
       whether the person typed a slash -- so the same date left the field two ways
       depending on how it was entered. */
    if (!hasSep && digits.length <= 8) return clubDigits(digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4));
    /* Both orders, as it is typed: a person writing 12/03/1996 and a person writing
       12/03/1996 are both writing the same date, and the field must not disagree
       with itself about which one it accepts. */
    var m = readDateParts(text);
    if (m) return slashDate(m.y + '-' + pad2(m.m) + '-' + pad2(m.d));
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
      if (isDate) node.addEventListener('keydown', separateDate);
    });
    form.addEventListener('input', clearComplaintOnEdit);
    form.addEventListener('change', clearComplaintOnEdit);
  }

  /* The slash, written for them.

    A date has to be written day first, and somebody filling a form on a phone at
    the pool has to remember that. The field's own message names the order -- but
    that message only arrives once the field has been read and found wanting, so
    the order is already a mistake by the time anybody reads about it. A month and
    a day the wrong way round is a birthday that says the wrong thing about a
    child.

    So the separator is put in: after the second digit, and after the fourth.

      the caret is put back          setting `value` drops it at the end, so
                                     editing the middle of a date would watch the
                                     cursor jump away on every digit -- worse than
                                     no separator at all
      a typed separator is stepped   somebody who types their own slash must not end
        over, not doubled            up with two
      only while typing              the calendar writes a whole date and a paste
                                     arrives whole; neither needs anything added
      storage does not move          what the field shows is the club's shape;
                                     what the database holds is still yyyy-mm-dd,
                                     which is what the queue, the weekly bars and
                                     every equality query depend on

    Deletes and backspace are left alone: removing the separator is a reasonable
    thing to want to do while correcting, and the relayout puts it straight back
    on the next keystroke anyway. */
  function separateDate(e) {
    /* Folded before anything is decided. The club writes its dates in
       Arabic-Indic digits -- every example on this page is in them -- and the
       first version accepted only Latin keys, so for the people actually filling
       the form in the separator never appeared and nothing was wrong. */
    if (!/^[0-9]$/.test(latinDigits(e.key))) return;
    var node = e.target;
    if (!node || node.tagName !== 'INPUT') return;

    var at = node.selectionStart;
    /* Only at the end, and only while there is room: a date being typed into the
       middle already has a separator where the caret is. */
    if (at !== node.value.length) return;

    var written = node.value.slice(0, at);
    /* How many digits the field holds *before* this keystroke. Two means the day
       is finished, four means the month is, six or more is the year.

       Over the whole field, and not over the part being typed: the second digit
       of the day and the second digit of the year are the same shape, so a count
       taken over the segment cannot tell them apart and puts a third slash in the
       middle of the year. The format settles it -- two digits, two digits, four --
       so the total is the only count that answers the question actually being
       asked.

       Before *this* keystroke, because the character has not arrived yet: the
       handler puts the separator in and leaves the keypress to insert its own
       digit, so a count taken after would be looking at the field one keystroke
       further on than the question is about. */
    var typed = latinDigits(written).replace(/[^0-9]/g, '').length;
    if (typed !== 2 && typed !== 4) return;
    if (node.value.length >= 10) return;

    /* A separator is already there -- typed by hand, or written a keystroke ago.
       Stepping over it is the whole of what happens. */
    if (/[-/.]$/.test(written)) {
      if (document.activeElement === node) {
        try { node.setSelectionRange(at, at); } catch (_) { /* not every field allows it */ }
      }
      return;
    }

    /* Nothing is prevented, and that is the whole trick.

       `keydown` is the event that cancels the character about to be inserted, so
       preventing it throws the digit away: the field would read `17/` when the
       person typed `17/0`. The separator goes in, the caret goes after it, and
       the keypress does what keypresses do -- insert its character at the caret,
       which is now past the separator. The browser's own insertion is left doing
       its work, and with it undo, autocorrect, and a keyboard that is not a
       keyboard. */
    node.value = written + '/' + node.value.slice(at);
    if (document.activeElement === node) {
      try { node.setSelectionRange(at + 1, at + 1); } catch (_) { /* not every field allows it */ }
    }
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
  var GUARDIAN_FIELDS = ['guardian_first_name', 'guardian_last_name',
    'guardian_birth_date', 'guardian_relation', 'guardian_phone',
    'guardian_national_id', 'guardian_national_id_expiry', 'guardian_card_issued'];
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
  /* ================= the pool gate =================

     The person cannot touch the form until they have said which pool they are
     asking for. It opens with the page and is refused until a pool is chosen:
     Escape, a click outside, scrolling the form underneath, and the keyboard all
     find it closed.

     Escape is refused rather than answered. Somebody who presses Escape is not
     asking a question, and a message over the notice they have just read is
     noise -- the notice is what they are refusing to skip past, so it stays
     quiet and the gate stays shut. */

  var gateOpen = false;

  function poolNames() {
    return facilities.length ? facilities : FALLBACK_FACILITIES;
  }

  /* Repainting. Reads what is chosen *now* before it rebuilds, because the
     club's list arrives a moment after the page does and a person who clicked in
     between would otherwise watch their choice vanish. It reads only what is
     chosen now, never what was chosen in a visit already dealt with -- opening
     the gate empties the box first, so there is nothing older to confuse it with.

     `before` is the pool saved on this device. It is *named* beside its option
     and never ticked: somebody who reopens a half-finished form has to be able to
     see what they chose last time, and a guess is worse than the answer -- but a
     remembered tick is not a confirmation, it is a suggestion with the way
     through already open beside it. */
  function paintGatePools() {
    var box = el('pool-gate-pools');
    if (!box) return;
    var chosenBefore = val('selected_pool');
    var live = box.querySelector('input:checked');
    var liveValue = live ? live.value : '';
    var names = poolNames();

    box.innerHTML = names.map(function (name, i) {
      return '<label class="gate-pool">'
        + '<input type="radio" name="selected_pool_choice" value="' + F.esc(name) + '"'
        + (name === liveValue ? ' checked' : '')
        + (i === 0 && !liveValue ? ' data-first' : '') + ' />'
        + '<span class="gate-pool-name">' + F.esc(name) + '</span>'
        + (name === chosenBefore && !liveValue
            ? '<span class="gate-pool-again">اختيارك في المرة الماضية</span>' : '')
        + '</label>';
    }).join('');

    /* Open only on a choice made in front of the gate, in this visit. It is
       disabled in the markup as well, so it is shut before this runs at all. */
    var go = el('pool-gate-go');
    if (go) go.disabled = !liveValue;

    Array.prototype.forEach.call(box.querySelectorAll('input'), function (radio) {
      radio.addEventListener('change', function () {
        var button = el('pool-gate-go');
        if (button) button.disabled = false;
      });
    });
  }

  function gateRefuse() { /* a gate that opens is not a gate */ }

  function openPoolGate() {
    var gate = el('pool-gate');
    if (!gate) return;
    /* Is this a new asking, or the same one being asserted again? The club asked
       to be asked again on every visit, not every time something touches the
       gate -- and the difference is the whole of this branch.

       The form calls this whenever it is sent with no pool, which is exactly when
       the gate is already up. Emptying unconditionally threw away the choice the
       person had just made, re-shut the way through, and left a radio ticked in a
       box nothing could see. A gate that was closed is a new asking, so it starts
       empty; a gate that was already up keeps what is in front of them. */
    var fresh = gate.hidden;
    gateOpen = true;
    gate.hidden = false;
    document.body.classList.add('gate-open');
    if (fresh) {
      var box = el('pool-gate-pools');
      if (box) box.innerHTML = '';
    }
    paintGatePools();

    if (!gate.dataset.bound) {
      gate.dataset.bound = '1';
      /* Outside the panel is refused: the click is taken and answered with
         nothing, rather than left to reach whatever is behind the overlay. */
      gate.addEventListener('mousedown', gateRefuse);
      gate.addEventListener('click', gateRefuse);
      var go = el('pool-gate-go');
      if (go) go.addEventListener('click', acceptPoolGate);
    }

    /* The keyboard finds the gate first, so the first thing a person reaches is
       a choice rather than the top of a form they may not use yet. */
    var first = gate.querySelector('.gate-pool input[data-first]')
      || gate.querySelector('.gate-pool input');
    if (first) { try { first.focus(); } catch (_) { /* older browsers */ } }
  }

  function closePoolGate() {
    var gate = el('pool-gate');
    if (!gate) return;
    gateOpen = false;
    gate.hidden = true;
    document.body.classList.remove('gate-open');
  }

  function acceptPoolGate() {
    var picked = el('pool-gate-pools')
      ? (el('pool-gate-pools').querySelector('input:checked') || {}).value
      : '';
    if (!picked) return;

    /* The name, never an index: a number breaks the day the club reorders. */
    var field = el('selected_pool');
    if (field) field.value = String(picked);

    /* Step four gets the same pool, when that pool is among its options, so a
       request sent straight through does not arrive asking for one pool and
       naming another. The person may still change it in step four -- the notice
       tells them they may -- and `selected_pool` keeps what they asked for. */
    var select = el('facility');
    if (select && select.options) {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === picked) { select.value = picked; break; }
      }
    }

    updateTotal();
    saveDraft();
    closePoolGate();
    /* The form is theirs now, so the form takes the focus. */
    var firstField = form.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox])');
    if (firstField) { try { firstField.focus(); } catch (_) { /* not focusable */ } }
  }

  /* A pool on file that is no longer offered. The form cannot be sent claiming a
     pool nobody is taking requests for, and it is not worth a silence: the club
     has to be told the list moved under them. */
  function reconcilePool(data) {
    var saved = String((data && data.selected_pool) || '').trim();
    if (!saved) return;
    var names = poolNames();
    if (names.indexOf(saved) !== -1) return;
    say('المسبح المحفوظ لم يعد متاحاً. اختر المسبح من جديد.', 'error');
    var field = el('selected_pool');
    if (field) field.value = '';
  }

  function paintFacilities() {
    var names = facilities.length ? facilities : FALLBACK_FACILITIES;
    var select = el('facility');
    var keep = select.value;
    select.innerHTML = names.map(function (n) {
      return '<option value="' + F.esc(n) + '">' + F.esc(n) + '</option>';
    }).join('');
    if (keep && names.indexOf(keep) !== -1) select.value = keep;
    /* The gate's choices are this list. It is drawn from here rather than from a
       second copy in the script, so a pool renamed in Settings is renamed in both
       places at once -- and an open gate is repainted, so the list replacing the
       built-in names is not something the person has to reload to see. */
    if (typeof paintGatePools === 'function') paintGatePools();
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


  /* ---------------- عين كلمة المرور ----------------
     The same eye the platform has on its own password fields, written here rather
     than shared: this page is served on its own and loads none of the platform's
     scripts.

     type="button" because this is inside a form and a button with no type submits
     it -- an eye that posts a registration is worse than no eye. The focus goes
     back to the field, because toggling is something you do while typing. And
     aria-pressed says the state to somebody who cannot see the eye, which is what
     tells them whether the password is on the screen. */
  function addEyes() {
    var fields = document.querySelectorAll('input[type="password"]');
    for (var i = 0; i < fields.length; i++) {
      (function (input) {
        if (input.dataset.eyeReady) return;
        var host = input.parentNode;
        if (!host) return;
        input.dataset.eyeReady = '1';
        if (host.classList) host.classList.add('with-eye');

        var eye = document.createElement('button');
        eye.type = 'button';
        eye.className = 'eye-toggle';
        eye.setAttribute('aria-pressed', 'false');
        eye.setAttribute('aria-label', '\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631');
        eye.title = '\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631';
        eye.textContent = '\u25CB';
        eye.addEventListener('click', function () {
          var shown = input.type === 'text';
          input.type = shown ? 'password' : 'text';
          eye.setAttribute('aria-pressed', shown ? 'false' : 'true');
          eye.setAttribute('aria-label', shown
            ? '\u0625\u0638\u0647\u0627\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631'
            : '\u0625\u062e\u0641\u0627\u0621 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u062b\u0648\u0631');
          eye.title = eye.getAttribute('aria-label');
          eye.textContent = shown ? '\u25CB' : '\u25C9';
          try {
            var at = input.value.length;
            input.focus();
            input.setSelectionRange(at, at);
          } catch (e) {}
        });
        if (input.nextSibling) host.insertBefore(eye, input.nextSibling);
        else host.appendChild(eye);
      })(fields[i]);
    }
  }

  /* The scripts sit at the foot of the page, so the fields are there by now. The
     guard is for the day this page is edited and that stops being true: a page
     that loads without an eye and does not say so is the worst of the outcomes. */
  addEyes();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addEyes);
  }

  /* ---------------- validation ---------------- */

  /* Returns the fields that still need an answer, in the order they appear, so
     the person is walked to the first one that is missing. */
  function validate() {
    var missing = [];
    /* Everything the form asks, except the two fields a person can honestly leave
       empty: a previous registration number, which they have if they are
       renewing and do not if they are new; and a note to the club, which is a
       courtesy rather than an answer.

       Both are optional because asking for them produces a worse form, not a
       better one: somebody who believes the note is needed writes something to
       fill it, and the club reads it. */
    var required = ['first_name_ar', 'last_name_ar', 'first_name_fr', 'last_name_fr',
                    'birth_date', 'gender', 'blood_group', 'level',
                    'birth_certificate_no', 'wilaya', 'facility',
                    'phone', 'whatsapp', 'address',
                    'payment_method',
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
    /* A name written only in Arabic is not a name the club can match on the
       card, and the Latin spelling is what the documents are printed from. */
    if (val('first_name_fr') && !/^\s*[A-Za-z][A-Za-z\s'-]*$/.test(val('first_name_fr'))) {
      missing.push('first_name_fr');
    }
    if (val('last_name_fr') && !/^\s*[A-Za-z][A-Za-z\s'-]*$/.test(val('last_name_fr'))) {
      missing.push('last_name_fr');
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
    birth_date: 'اكتب تاريخ الميلاد بصيغة يوم/شهر/سنة — 17/03/1998.',
    phone: 'اكتب رقم هاتف صحيح.',
    address: 'اكتب العنوان.',
    email: 'اكتب بريدًا إلكترونيًا صحيحًا — مثال: name@example.com',
    username: 'اسم المستخدم: حروف لاتينية وأرقام و . _ - فقط، من 3 إلى 32 خانة.',
    national_id: cardNumberError('رقم بطاقتك'),
    national_id_expiry: 'اكتب تاريخ انتهاء البطاقة بصيغة يوم/شهر/سنة — 17/04/2031.',
    guardian_national_id: cardNumberError('رقم بطاقة الولي'),
    guardian_national_id_expiry: 'اكتب تاريخ انتهاء بطاقة الولي بصيغة يوم/شهر/سنة — 02/06/2031.',
    guardian_card_issued: 'اكتب تاريخ إصدار بطاقة الولي بصيغة يوم/شهر/سنة — 02/06/2021.',
    /* One sentence per field, because a message that belongs to one field and is
       shown for another sends somebody to rewrite the right one. */
    first_name_fr: 'اكتب الاسم باللاتينية كما هو في بطاقة التعريف.',
    last_name_fr: 'اكتب اللقب باللاتينية كما هو في بطاقة التعريف.',
    gender: 'اختر الجنس.',
    blood_group: 'اختر فصيلة الدم.',
    level: 'اختر المستوى.',
    birth_certificate_no: 'اكتب رقم شهادة الميلاد.',
    wilaya: 'اختر الولاية.',
    facility: 'اختر المسبح.',
    selected_pool: 'اختر المسبح الذي تريد التسجيل فيه.',
    whatsapp: 'اكتب رقم واتساب. إن لم يكن لديك رقم آخر فاكتب نفس رقم الهاتف.',
    payment_method: 'اختر طريقة الدفع.',
    guardian_relation: 'اختر صلة القرابة.',
    guardian_phone: 'اكتب هاتف الولي.',
    photo: 'الصورة إجبارية. اختر صورة واضحة، والوجه داخل الإطار.',
    birth_place: 'اختر بلدية الميلاد من القائمة -- تُكتب في استمارة النادي بعد «ب:».',
    password: 'كلمة المرور ثماني خانات على الأقل.',
    password_confirm: 'كلمتا المرور غير متطابقتين. أعد كتابة كلمة المرور.',
    guardian_first_name: 'اكتب اسم الولي.',
    guardian_last_name: 'اكتب لقب الولي.',
    guardian_birth_date: 'اكتب تاريخ ميلاد الولي بصيغة يوم/شهر/سنة — 02/06/1975.',
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
    var data = {
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
      /* Where the request was aimed at the gate, kept apart from `facility`,
         which is where the person may change their mind in step four. The
         committee is entitled to see both: the notice says they may redirect a
         request, and it cannot do that without knowing where it was sent. */
      selected_pool: val('selected_pool'),
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
    /* An adult is their own guardian: the same eighteen-digit number is the
       family reference, and the guardian block stays off the form. Sending it
       explicitly keeps the public page and the platform on one rule. */
    if (data.category === 'adult') {
      data.guardian_national_id = data.national_id;
      data.guardian_first_name = data.first_name_ar;
      data.guardian_last_name = data.last_name_ar;
      data.guardian_phone = data.phone;
      data.guardian_relation = 'نفسه';
    }
    return data;
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
          /* What this page is not. It can sign in -- `signInAccount` exists -- but
             only from inside `send()`, after every field of a registration form
             has been filled and the create button pressed. So the sentence used to
             point at two doors that are not on this page at all, and somebody with
             an account and a forgotten password was left with nowhere to go on the
             one page they had been sent to.

             So it points at the door that exists: the club's own sign-in, with the
             address they already typed, so it is not asked for twice. A second
             sign-in flow here would be a second way into the same accounts
             answering to nobody but itself. */
          var e = new Error('هذا البريد الإلكتروني مسجّل مسبقًا. لستَ في حاجة إلى طلب جديد: ادخل من صفحة دخول النادي، أو استرجع كلمة مرورك من هناك.');
          e.duplicate = true;
          e.door = platformSignIn(val('email'));
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

  /* The club's own sign-in, with the address already typed.

     A door, not a subsystem. The address is carried so it is not asked for twice,
     and it is the same door everybody else uses -- the page that answers for the
     account, refuses it, or restores its password, rather than a second set of
     rules living on a form for swimmers.

     The address is put in the fragment rather than the query so it is not written
     into a server log on the way, and because a fragment is never sent anywhere:
     it is a value the page reads and then drops. */
  function platformSignIn(email) {
    var at = String(email || '').trim();
    return '/?signin=1#' + (at ? 'email=' + encodeURIComponent(at) : '');
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
            /* Two refusals, and a family must not be told they are the same one.

               A shut door is the club's decision, and the family has nothing to
               do but wait for the season. A door the club could not read is the
               club's own problem: the request has been refused rather than lost,
               and the one useful thing to say is that nothing was written and a
               telephone call will get it filed.

               Saying "closed" to a family whose door is only unreadable sends them
               home for nothing; saying "try again" to a family whose season is
               full makes them type the whole of it again tomorrow. */
            err.closed = !!data.closed;
            err.unreadable = !!data.unreadable;
            /* The other way a person with an account ends up on a form for a new
               swimmer: the server refuses them as a duplicate. Same door, same
               address they have already typed. */
            if (data.duplicate) err.door = platformSignIn(val('email'));
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
      say(e.message || 'تعذّر إرسال الطلب.', 'error', e.door);
      notify(e.unreadable ? 'لم نتمكن من تأكيد حالة التسجيلات.' : 'تعذّر إرسال الطلب.', 'error',
        e.unreadable
          ? 'لم يُكتب أي طلب، ولم يُفقد ما كتبته. اتصل بالنادي ليسجّل طلبك، أو أعد المحاولة بعد قليل.'
          : e.closed
            ? 'ما كتبته باقٍ. التسجيلات مغلقة لهذا الموسم، ونرجو انتظار إعلان فتحها.'
            : 'لم يُفقد ما كتبته. أعد المحاولة بعد قليل أو اتصل بالنادي إن استمر.');
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

  /* What the keyboard can reach while the gate is up.

     With a mouse the gate was shut already: the overlay takes every click. With a
     keyboard it was not -- Tab walked straight past into the fields behind, and
     the whole form could be filled while the gate stood there refusing to open.
     Sending it then re-opened the gate, so nothing got past, but the person who
     had typed all of it was not told why. The club's words are that the form
     cannot be filled before the pool is chosen, and that is what this makes true
     for everyone rather than for those with a mouse.

     Tab and Shift+Tab are wrapped at both ends; everything between them is free,
     so the gate is walked in its own order like any other dialog. Escape is
     refused on the same handler, in the same place, because two rules about the
     same key would be two rules that could disagree. */
  /* Which controls a Tab may reach.

     Not by asking whether they have an `offsetParent` -- the usual way to ask
     "is this visible", and wrong here for a reason that has nothing to do with
     testing. The gate is `position: fixed`, and a descendant of a fixed-position
     element reports `offsetParent` as null in every browser whether it is on
     screen or not. So that filter threw away the whole list, the Tab handler found
     nothing to move focus to, and answered by refusing the key without moving
     focus anywhere: a keyboard user pressing Tab inside the gate was stuck, held
     by a gate that would neither let them out nor let them in.

     What can actually make a control unusable is asked instead -- disabled, or
     hidden -- and the gate's own `hidden` attribute already answers for the whole
     panel. Nothing else is filtered, so the list cannot come back empty while the
     gate is up, which is the property the handler depends on. */
  var gateTabbables = function () {
    var gate = el('pool-gate');
    if (!gate || gate.hidden) return [];
    return [].slice.call(gate.querySelectorAll(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (node) {
        return !node.disabled && !node.hidden && node.getAttribute('aria-hidden') !== 'true';
      });
  };

  document.addEventListener('keydown', function (e) {
    if (!gateOpen) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== 'Tab') return;

    var inside = gateTabbables();
    if (!inside.length) { e.preventDefault(); return; }
    var first = inside[0], last = inside[inside.length - 1];
    var here = document.activeElement;
    var isIn = here && inside.indexOf(here) !== -1;

    /* Wrapped at whichever end the focus is leaving from -- and, when the focus is
       not in the gate at all, sent in from the near end rather than left to walk
       out through the page behind. */
    if (e.shiftKey ? (!isIn || here === first) : (!isIn || here === last)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });

  /* And the other direction: focus arriving from outside -- a restored browser
     field, a browser's own find, an extension -- is brought back to the gate
     rather than left in a form the person is not allowed to use yet. */
  document.addEventListener('focusin', function (e) {
    if (!gateOpen) return;
    var gate = el('pool-gate');
    if (!gate || gate.contains(e.target)) return;
    var inside = gateTabbables();
    if (inside.length) inside[0].focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    say('');
    /* The gate is not decoration, so it is checked here too and not only in the
       overlay. A form that can be sent without a pool would put a request on
       file that nobody can answer, and the committee's first question about it
       would be which pool it was for. */
    if (gateOpen) { openPoolGate(); return; }
    if (!val('selected_pool')) { openPoolGate(); return; }
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

  /* The gate opens before anything else is read, so the pools on the books are
     on the gate before the club's own list arrives -- the built-in names first,
     then replaced by the real ones.

     Nothing is ticked and nothing is remembered into the visit: the club asked to
     be asked again every time, so the way through opens on a choice made in front
     of the gate now. The pool chosen last time is named beside its option, so
     somebody reopening a half-finished form can see it without having to
     remember -- and still has to choose it. */
  openPoolGate();

  var kept = readDraft();
  if (applyDraft(kept)) {
    say('استعدنا مسودة حفظتها على هذا الجهاز. راجعها ثم أرسل.', 'ok');
    notify('استُعيدت مسودة من هذا الجهاز.', 'info', 'راجعها ثم أرسل.');
  }
  /* After the draft is back in, because that is when there is a saved pool to
     check against the pools on offer. */
  reconcilePool(kept);
  paintGatePools();
  loadPlans();
  loadFacilities();
  var door_ = { open: null };

/* ==========================================================================
     باب التسجيلات — الاستمارة العامة
     ==========================================================================
     The club asked for this in plain terms: when registrations are closed, the
     form does not appear, and what appears instead says so.

     Three things have to be true together, and the difference between them is the
     difference between a switch that works and a switch believed for an afternoon:

       the form is not there  -- hidden, not greyed. A greyed form full of fields
                                is a form somebody fills in and is then told
                                about at the end, after a child has been described
                                on paper.
       the reason is there    -- in the club's words, with the telephone, because
                                a closed form with no reason reads as a broken
                                website, and a family who think that tries again
                                the next day, and the day after.
       the sending is refused -- the endpoint refuses it anyway, and this page
                                refuses it before it gets there, so the two agree.

     Asked once when the page opens and again at the moment of sending. The second
     reading is the one that matters: the club can close registrations while this
     page is open, and a form filled in over lunch must be found closed rather
     than refused an hour later with everything typed in -- so what was typed is
     left alone, and the message says why. */
  function doorState() { return door_.open; }

  function doorPhone() {
    var el = document.querySelector('[data-club-phone], .club-contact, footer, .f-contact');
    if (el) {
      var m = /(\+?213[\s\d]{8,}|0\d{2}[\s\d]{8,})/.exec(el.textContent || '');
      if (m) return m[1].trim();
    }
    return '';
  }

/* The announcement, in the club's words.

     Written out rather than assembled from pieces. This is a notice to parents
     about their children, and it is going to be read on a phone by somebody who
     was told the season was full. It carries two things that have to be said
     exactly as the club said them: that registrations are closed for the season,
     and that a subscription is suspended for anybody whose photograph is not an
     official one. The second is the part a summary would lose, and it is the part
     a family acts on tomorrow morning.

     The notice replaces the form entirely. A greyed form full of fields is a form
     somebody fills in and is then told about, at the end, after a child has been
     described on paper -- so nothing of the form is left on the page to fill in. */
  function doorNotice() {
    return '<section class="door-closed-page" aria-labelledby="door-title">'
      + '<div class="door-ribbon"><span>باب التسجيلات مغلق</span></div>'
      + '<article class="door-letter">'

      + '<h1 id="door-title">إعلان هام: إغلاق التسجيلات للموسم الحالي '
      + 'وتنبيه يخص الصور الشخصية</h1>'

      + '<p class="door-salute">أعضاءنا الكرام، أولياء الأمور الفاضلون،</p>'

      + '<p>يعلن النادي الرياضي للسباحة عن غلق باب التسجيلات رسميًا للموسم '
      + 'الرياضي الحالي، بعد اكتمال العدد المطلوب. نتقدم بخالص الشكر لكل من بادر '
      + 'بالتسجيل، ونتمنى لجميع منخرطينا موسمًا رياضيًا حافلًا بالنشاط، '
      + 'والانضباط، والتفوق.</p>'

      + '<div class="door-warn">'
      + '<p class="door-warn-title"><span class="door-warn-mark" aria-hidden="true">!</span>'
      + 'تنبيه هام جدًا وعاجل للمسجلين</p>'
      + '<p>لوحظ قيام بعض المنخرطين برفع صور عادية (صور سيلفي أو غير رسمية) في '
      + 'ملفاتهم على المنصة. نؤكد أن الإدارة تقبل الصور الشمسية الرسمية فقط '
      + '(ذات خلفية موحدة وواضحة، مطابقة لصور الوثائق الرسمية) لاستخدامها في '
      + 'استخراج بطاقات العضوية الرقمية والمطبوعة.</p>'
      + '</div>'

      + '<p>بناءً عليه، سيتم تجميد أي اشتراك وإيقاف الحساب على المنصة لكل منخرط '
      + 'لم يلتزم برفع صورة شمسية مطابقة للمواصفات. نرجو من المعنيين تدارك '
      + 'الأمر وتحديث صورهم فورًا لتفادي تعليق عضويتهم.</p>'

      + '<p>شكرًا لتفهمكم وتعاونكم المستمر.</p>'

      + '<p class="door-sign">إدارة نادي الصدارة للسباحة</p>'

      + '<p class="door-contact">وللاستفسار: <span dir="ltr">' + doorPhone() + '</span></p>'

      + '</article></section>';
  }
  function doorApply(open) {
    var form = document.getElementById('reg-form');
    if (!form) return;
    door_.open = open;

    var shown = document.querySelector('.door-closed-page');
    if (open === false) {
      form.hidden = true;
      form.setAttribute('aria-hidden', 'true');
      if (!shown && form.parentNode) {
        var holder = document.createElement('div');
        holder.innerHTML = doorNotice();
        form.parentNode.insertBefore(holder.firstChild, form);
      }
      /* Two things still point at a form that is no longer there.

         The skip link at the top of every page on this site jumps to #reg-form,
         and the tab says the visitor is looking at a registration form. Both
         describe a page they are not on, and both are the first things a person
         meets after the notice -- so the tab is renamed and the skip link is sent
         to the notice instead. A closed door that leaves the rest of the page
         describing an open one is only half shut. */
      var skip = document.querySelector('.skip');
      if (skip) skip.setAttribute('href', '#door-title');
      document.title = 'التسجيلات مغلقة | نادي الصدارة للسباحة';
    } else {
      form.hidden = false;
      form.removeAttribute('aria-hidden');
      if (shown && shown.parentNode) shown.parentNode.removeChild(shown);
      var back = document.querySelector('.skip');
      if (back && back.getAttribute('href') === '#door-title') back.setAttribute('href', '#reg-form');
      document.title = 'استمارة التسجيل | نادي الصدارة للسباحة';
    }
  }

  function doorAsk() {
    /* A missing `fetch` throws before a promise exists, so nothing downstream can
       catch it -- and this runs while the page is still starting, so it would stop
       a page from finishing. Asking about the door is never worth that. */
    if (typeof fetch !== 'function') {
      doorApply(true);
      return Promise.resolve(true);
    }
    try {
      return fetch('/api/registration', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('unreachable'); return r.json(); })
        .then(function (d) {
          doorApply(d && typeof d.open === 'boolean' ? d.open : true);
          return door_.open;
        })
        .catch(function () {
          /* Unreachable is not closed. A form that closes itself because a request
             failed is a form that stops a season, and nobody decided that. */
          doorApply(true);
          return true;
        });
    } catch (e) {
      doorApply(true);
      return Promise.resolve(true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doorAsk);
  else doorAsk();

  /* And again at the moment of sending -- the only moment the answer can still be
     acted on. */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.id !== 'reg-form' || door_.open === false) {
      if (form && form.id === 'reg-form' && door_.open === false) {
        e.preventDefault();
        e.stopPropagation();
        var m = document.getElementById('form-msg');
        if (m) { m.hidden = false; m.textContent = 'التسجيلات مغلقة حاليًا — لم يُرسل الطلب.'; }
      }
      return;
    }
    doorAsk().then(function (open) {
      if (open) return;
      e.preventDefault();
      e.stopPropagation();
      var msg = document.getElementById('form-msg');
      if (msg) { msg.hidden = false; msg.textContent = 'التسجيلات أُغلقت للتو — لم يُرسل الطلب، وما كتبته باقٍ.'; }
    });
  }, true);
})();
