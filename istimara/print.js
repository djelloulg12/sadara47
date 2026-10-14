/* ==========================================================
   استمارة التسجيل — الطباعة
   ==========================================================
   Two sheets come out of one click:

     page 1  the club's own استمارة الإلحاق, with the values laid
             over the printed lines of the real scan
     page 2  a full A4 summary, because the official card has no
             room for the doctor, the payment details or the terms

   The card is not a layout of our own: FORM_SPOTS below is the
   same measured geometry the platform prints with (app.js) and the
   same numbers tools/check-form-placement.py verifies against the
   image. A value always begins just after the printed colon, so it
   reads "after the :" and never covers the club's wording.

   Exposed as window.SADARA_FORM so the test suite can measure it.
   ========================================================== */
(function (global) {
  'use strict';

  var FORM_BG = '/assets/form-registration-01.jpg';
  var REGS_BG = '/assets/internal-regulations.jpg';
  var PAGE_W = 210, PAGE_H = 297;          // A4 in millimetres
  var PHOTO_BOX = { x: 22.1, y: 67.6, w: 36.4, h: 42.5 };
  var SPOT_GAP = 1.6;                      // clear paper between the colon and the value
  var SPOT_CLEAR = 0.4;                    // clear paper between the value and its rule

  /* id, the printed rule it sits on, where that rule starts, and the left edge
     of the colon that ends its label -- all in millimetres from the page edge. */
  var FORM_SPOTS = [
    /* The top line carries two labels: "مسبح :" at the right, "رقم التسجيل:" at
       the left. They shared one box, measured onto the pool's line, so the
       registration number printed beside the word مسبح and its own place stayed
       empty. Measured off the scan: the pool's line runs 90-190 mm and begins a
       millimetre after the pool's colon, and the margin left of رقم التسجيل: is
       empty. So the pool takes the line, and the number takes the far left of
       the same line, which is where it is being asked to go. */
    { id: 'facility',          y: 61.95, x0: 90.8,  colon: 191.1 },
    { id: 'registration',      y: 61.95, x0: 2.0,   colon: 35.6 },
    { id: 'first_name',         y: 75.25, x0: 62.3,  colon: 178.3 },
    { id: 'last_name',          y: 85.05, x0: 62.3,  colon: 178.3 },
    { id: 'birth_date',         y: 94.85, x0: 62.3,  colon: 178.3 },
    { id: 'address',            y: 104.65, x0: 62.3, colon: 178.3 },
    { id: 'blood_group',        y: 114.45, x0: 62.1,  colon: 178.3 },
    { id: 'phone',              y: 124.25, x0: 62.3,  colon: 178.3 },
        { id: 'parent_name',        y: 208.78, x0: 102.4, colon: 152.9 },
    { id: 'child_birth_date',  y: 208.78, x0: 32.9,  colon: 71.9 },
    /* The `ب:` on the declaration line. That line reads
       `المولود (٥) بتاريخ: ___ ب: ___` -- the child, on this date, at this place --
       so this box is where the swimmer was born. */
    { id: 'birth_place',        y: 208.78, x0: 4.2,   colon: 33.1 },
    { id: 'parent_id',          y: 217.70, x0: 106.0, colon: 149.4 },
    { id: 'card_issued_at',     y: 217.70, x0: 40.0,  colon: 73.3 },
    { id: 'card_place',         y: 217.70, x0: 4.2,   colon: 31.5 },
    { id: 'authorised_for',     y: 226.80, x0: 106.0, colon: 186.4 }
  ];

  /* These belong to the guardian declaration, which only a minor has. */
  var /* The declaration is a guardian's line: `أنا المصغي` names the person signing
     for a child, and `المولود (٥) بتاريخ:` and `ب:` are that child. An adult signs
     for nobody, so the whole line stays empty. Those two are named here rather
     than caught by a prefix: they carry the swimmer's own date and place, and a
     prefix cannot tell them from the adult's date in the block above. */
 GUARDIAN_SPOT = /^(parent_|card_|child_birth_date$|birth_place$|authorised_for$)/;

  var CLUB = {
    name: 'النادي الرياضي الصدارة',
    unit: 'فرع السباحة',
    ar: 'النادي الرياضي الصدارة – غرداية',
    address: 'حي الثنية — غرداية',
    phone: '0660 60 64 67',
    email: 'nadisadara@gmail.com',
    /* Written the way the club reads a season aloud and writes it on its forms:
       the later year first, since Arabic is read from the right. */
    season: '2027 / 2026'
  };

  /* The club writes its sections in Arabic-Indic digits. */
  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  /* Arabic-Indic digits, for anything printed.

     Applied to the sheets, not to what is stored and not to a reference number.
     A membership number and a request number are the two things a person has to
     read back over the phone or type into the platform, and a number quoted in
     one set of digits and looked up in the other is a number that cannot be
     found. Everything else -- dates, money, phone numbers, identity numbers, the
     season -- is read by eye off a printed page and is written this way. */
  /* The club writes its numbers 0 1 2 3 4 5 6 7 8 9 and its dates year/month/day.
     One form, end to end: a number read off the sheet is read aloud over a counter
     and typed back in to find the record, and an identity number is compared
     against the ones on file to catch the same person twice. What is left to do
     here is fold a number that arrives in Arabic-Indic digits, so somebody copying
     one out of a message gets a number the club can read back. */
  function ar(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isAdult(rec) {
    return String((rec && rec.category) || '').toLowerCase() === 'adult';
  }

  /* A date, written the way the club writes it: year first, then month, then
     day -- 2026/10/11 -- and in Arabic-Indic digits.

     The value arrives from a date input as YYYY-MM-DD, so only the separators
     change and the order is already the one asked for. It used to be day first;
     the same function was doing the opposite of this. */
  /* The date the way the club writes it: 2026/10/11.

     A date typed with slashes rather than dashes, or with a one-digit month, is
     still a date and is laid out the same way -- the point is that every date on
     every sheet reads the same, whichever way the person who typed it wrote it.
     Anything that is not a date is left as it stands rather than dropped: a note
     somebody wrote is not a date and is still worth printing. */
  function slashDate(v) {
    var raw = ar(v).trim();
    /* Both orders, for the same reason as the form: a date typed in the club's
      order and a date typed in the old one are the same date, and the printed
      sheet must not read only one of them. */
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw)
      || /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(raw);
    if (!m) return ar(v);
    return m[1] + '/' + (m[2].length < 2 ? '0' + m[2] : m[2])
      + '/' + (m[3].length < 2 ? '0' + m[3] : m[3]);
  }

  /* Anchoring on the bottom edge keeps the value sitting on its rule whatever
     the webfont's own metrics turn out to be. */
  function spotStyle(s) {
    var right = s.colon - SPOT_GAP;
    return 'bottom:' + (PAGE_H - s.y - SPOT_CLEAR).toFixed(2) + 'mm;'
      + 'right:' + (PAGE_W - right).toFixed(2) + 'mm;'
      + 'width:' + (right - s.x0).toFixed(2) + 'mm';
  }

  function formPhotoData(rec) {
    var src = rec && (rec.photo || rec.photo_data_url || rec.photo_url);
    return src && /^(data:|https?:)/.test(src) ? src : '';
  }

  function formValues(rec) {
    rec = rec || {};
    var v = function (k) { return rec[k] ? rec[k] : ''; };
    return {
      /* The pool, on the line the scan draws for it. */
    facility: v('facility'),
    /* A registration number is the club's own until one is issued; before that
       it is the number of the request. */
    registration: ar(v('membership_no') || v('application_no')),
      first_name: v('first_name_ar'),
      last_name: v('last_name_ar'),
      birth_date: slashDate(rec.birth_date),
      address: v('address'),
      blood_group: ar(v('blood_group')),
      phone: ar(v('phone')),
            /* One box for the name, carrying both names: the form asks for `اسمه` and
         `اللقب` over a single rule, and a surname on its own in a box of its own
         reads as though the name were split -- and put a family name where the
         person expects to read a date. */
      parent_name: [v('guardian_first_name'), v('guardian_last_name')]
        .filter(Boolean).join(' '),
      /* `المولود (٥) بتاريخ:` -- the swimmer, not the guardian. */
      child_birth_date: slashDate(v('birth_date')),
      /* `ب: ___` -- where the swimmer was born. */
      birth_place: v('birth_place'),
      parent_id: ar(v('guardian_national_id')),
      /* The day the card was issued, which the guardian is asked for and which
         the club's own form has a box for: `الصادرة بتاريخ`. The place of issue
         is still nobody's to write but the club's, so it stays on the blank line
         the scan already carries. */
      card_issued_at: slashDate(v('guardian_card_issued')),
      card_place: '',
      authorised_for: rec.guardian_child || ((v('first_name_ar') + ' ' + v('last_name_ar')).trim())
    };
  }

  /* Every value is drawn tight against its colon, as the rest of this form is.
     That leaves one failure: a value too long for its box is cut at the edge
     rather than run over the printed wording -- a request number, or a pool the
     manager has renamed to something longer than the one measured here.

     The box is the one thing that cannot give, because it is the size of a line
     printed on the scan. So the letter size gives instead, measured on the page
     that is about to print. Guessing a size in advance only moves the problem to
     the next pool the club renames. */
  function fitSpots(root) {
    var nodes = (root || document).querySelectorAll('.f-spot');
    var view = (root && root.defaultView) || window;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.textContent) continue;
      node.style.fontSize = '';
      var size = parseFloat(view.getComputedStyle(node).fontSize) || 16;
      for (var guard = 0; guard < 24 && size > 6; guard++) {
        if (node.scrollWidth <= node.clientWidth + 0.5) break;
        size -= 0.5;
        node.style.fontSize = size.toFixed(2) + 'px';
      }
    }
  }

  /* ---------------- page 1: the club's own card ---------------- */
  function overlaySheet(rec) {
    rec = rec || {};
    var vals = formValues(rec);
    var adult = isAdult(rec);
    var spots = FORM_SPOTS.filter(function (s) {
      return !(adult && GUARDIAN_SPOT.test(s.id));
    }).map(function (s) {
      var text = vals[s.id] === undefined ? '' : String(vals[s.id]);
      return '<span class="f-spot" style="' + spotStyle(s) + '">' + esc(text) + '</span>';
    }).join('');

    var photo = formPhotoData(rec);
    return '<section class="f-page">'
      + '<img class="f-bg" src="' + esc(FORM_BG) + '" alt="استمارة النادي">'
      + '<div class="f-photo" style="left:' + PHOTO_BOX.x + 'mm;top:' + PHOTO_BOX.y + 'mm;'
      + 'width:' + PHOTO_BOX.w + 'mm;height:' + PHOTO_BOX.h + 'mm">'
      + (photo ? '<img src="' + esc(photo) + '" alt="صورة المنخرط">' : '')
      + '</div>'
      + spots
      + '</section>';
  }

  /* ---------------- page 2: everything that does not fit ---------------- */
  var GENDERS = { male: 'ذكر', female: 'أنثى' };
  var LEVELS = ['مبتدئ', 'متوسط', 'متقدم', 'محترف'];
  var FACILITIES = ['المسبح الأولمبي', 'المسبح النصف أولمبي', 'الملعب البلدي', 'غابة غرداية'];
  var PAYMENTS = { cash: 'نقدًا', postal_check: 'صك بريدي', postal_transfer: 'حوالة بريدية' };
  var PLANS = { quarter: 'اشتراك فصلي', season: 'اشتراك موسمي', agreement: 'ضمن اتفاقية معتمدة' };

  function money(n) {
    n = Number(n) || 0;
    return ar(n.toLocaleString('fr-DZ')) + ' دج';
  }

  /* One field of the grid: a label and its value, with no table around them.

     The summary was a stack of two-column tables, one row per value, which put a
     minor who had filled in every optional field at 483 mm of content on a 297 mm
     page -- a page and a half. The values are the same and none of them is
     dropped; what changed is what they are written in. Two across rather than one
     per row is most of the saving, and it reads better besides: a field is a label
     and a value, and a row of a table takes longer to say so. */
  function field(label, value, opts) {
    opts = opts || {};
    if (!value) return '';
    var cls = 's-f' + (opts.mono ? ' s-mono' : '') + (opts.wide ? ' s-wide' : '');
    /* Arabic-Indic digits on the sheet. A reference number is not one of the
       values -- the request number sits in the header and the registration number
       on the card, both left in the digits they are quoted in. */
    return '<div class="' + cls + '"><b>' + esc(label) + '</b>'
      + '<span' + (opts.mono ? ' dir="ltr"' : '') + '>' + esc(ar(value)) + '</span></div>';
  }

  /* A titled group of fields. An empty group prints nothing at all, so an adult
     has no guardian heading rather than a heading over nothing.

     Three across for the blocks that carry the most values: the identity block is
     fifteen fields for a minor, and on two across it was taller than everything
     else on the page put together. Two across for the rest, which is easier to
     read where there are four values or fewer. */
  function block(head, title, fields, body, three) {
    if (!fields && !body) return '';
    return '<section class="s-block">'
      + '<h2>' + head + ' &mdash; ' + esc(title) + '</h2>'
      + (body || ('<div class="s-grid' + (three ? '3' : '') + '">' + fields + '</div>'))
      + '</section>';
  }

  function summarySheet(rec) {
    rec = rec || {};
    var adult = isAdult(rec);
    var photo = formPhotoData(rec);
    var plan = rec.plan_name || PLANS[rec.subscription_code] || rec.subscription_code || '';

    /* Sections are numbered in the order they are printed, and an adult has no
       guardian block, so its sections close up instead of leaving a gap or
       repeating a number the club would read as two of the same thing. */
    var headSwimmer = AR_DIGITS[1];
    var headGuardian = adult ? null : AR_DIGITS[2];
    var headMedical = AR_DIGITS[adult ? 2 : 3];
    var headMoney = AR_DIGITS[adult ? 3 : 4];

    var extras = [];
    if (rec.transport) {
      extras.push(rec.transport_amount ? 'النقل ' + money(rec.transport_amount) : 'النقل');
    }
    if (rec.uniform) {
      extras.push(rec.uniform_amount ? 'البدلة الرياضية ' + money(rec.uniform_amount) : 'البدلة الرياضية');
    }
    if (rec.membership_no) extras.push('تسجيل سابق: ' + ar(rec.membership_no));

    var identity = ''
      + field('الاسم بالعربية', rec.first_name_ar)
      + field('اللقب بالعربية', rec.last_name_ar)
      + field('الاسم بالفرنسية', rec.first_name_fr)
      + field('اللقب بالفرنسية', rec.last_name_fr)
      + field('تاريخ الميلاد', slashDate(rec.birth_date))
      + field('الجنس', GENDERS[rec.gender] || rec.gender)
      + field('مكان الميلاد', rec.birth_place)
      + field('الولاية', rec.wilaya)
      + field('رقم التعريف الوطني', rec.national_id, { mono: true })
      + field('رقم شهادة الميلاد', rec.birth_certificate_no, { mono: true })
      /* A+ and O- are written with the sign after the letter, so an RTL cell
         would print them backwards as +A. */
      + field('فصيلة الدم', rec.blood_group, { mono: true })
      + field('المستوى', rec.level)
      + field('الهاتف', rec.phone, { mono: true })
      + field('الواتساب', rec.whatsapp, { mono: true })
      /* An address is a sentence and reads badly broken in half, so it is given
         the whole width rather than one column of the pair. */
      + field('العنوان', rec.address, { wide: true })
      + field('نمط السباحة', rec.swimming_strokes);

    var guardian = adult ? ''
      : field('اسم الولي', rec.guardian_first_name)
      + field('لقب الولي', rec.guardian_last_name)
      + field('تاريخ ميلاد الولي', slashDate(rec.guardian_birth_date))
      + field('صلة القرابة', rec.guardian_relation)
      + field('هاتف الولي', rec.guardian_phone, { mono: true })
      + field('رقم تعريف الولي', rec.guardian_national_id, { mono: true })
      + field('إذن التدريب', rec.guardian_consent ? 'مصرّح به' : '');

    /* The club writes the doctor in by hand: the official form has no room for
       it, so nothing is typed and nothing is printed. The three lines say exactly
       that -- they are there, waiting for the pen -- and laid side by side they
       take a third of the height three stacked rows did. */
    var medical = '<div class="s-med">'
      + '<span>الطبيب</span><i></i>'
      + '<span>التخصص</span><i></i>'
      + '<span>تاريخ الفحص</span><i></i>'
      + '</div>';

    var money_rows = ''
      + field('الاشتراك', plan)
      + field('المسبح أو المنشأة', rec.facility)
      + field('طريقة الدفع', PAYMENTS[rec.payment_method] || rec.payment_method)
      + (extras.length ? field('إضافات', extras.join(' — '), { wide: true }) : '')
      + '<div class="s-total"><span>المبلغ المتوقع</span><b>'
      +   esc(money(rec.expected_amount)) + '</b></div>';

    return '<section class="s-page">'
      + '<header class="s-head">'
      +   '<img class="s-logo" src="/assets/logo.png" alt="" />'
      +   '<div class="s-id"><b>' + esc(CLUB.ar) + '</b>'
      +     '<span>فرع السباحة &middot; موسم ' + esc(ar(CLUB.season)) + '</span></div>'
      /* The photograph moved up into the header. It used to hold a 34 mm column
         open down the whole page for a picture 42 mm tall. */
      +   '<div class="s-photo">'
      +     (photo ? '<img src="' + esc(photo) + '" alt="صورة المنخرط">' : '<span>لا توجد صورة</span>')
      +   '</div>'
      +   '<div class="s-no"><span>رقم الطلب</span><b>' + esc(ar(rec.application_no || '—')) + '</b>'
      /* The season belongs under the request number: on a sheet that may be read
         again next season, the two are what say which one it is. It is set larger
         than the number above it because the number is a reference to be
         matched, while the season is what a person reads to know the year. */
      +     '<em class="s-season-lbl">الموسم الرياضي</em>'
      +     '<em class="s-season">' + esc(ar(CLUB.season)) + '</em>'
      +   '</div>'
      + '</header>'

      + '<h1>استمارة التسجيل &mdash; ملخّص البيانات</h1>'

      + '<div class="s-flow">'
      /* Two columns, each field the width it had before. The saving is not from
         squeezing fields narrower -- at three across the labels and values no
         longer fitted and every one of them wrapped -- but from running two
         independent lists down the page side by side instead of stacking all
         thirty values in one.

         The swimmer's own details sit on the right, where the eye starts in
         Arabic, and the declarations and the money beside them. Read right to
         left and top to bottom the sections come in their usual order, so they
         are not renumbered. */
      +   '<div class="s-cols">'
      +     '<div class="s-col">'
      +       block(headSwimmer, 'بيانات الرياضي', identity)
      +     '</div>'
      +     '<div class="s-col">'
      +       block(headGuardian, 'ولي الأمر', guardian)
      +       block(headMedical, 'الفحص الطبي', '', medical)
      +       block(headMoney, 'الاشتراك والدفع', '', money_rows)
      +       (rec.notes ? '<section class="s-block"><h2>ملاحظة الرياضي</h2>'
      +         '<p class="s-notes">' + esc(rec.notes) + '</p></section>' : '')
      +     '</div>'
      +   '</div>'
      + '</div>'

      + '<div class="s-sign">'
      +   '<div><span>توقيع الرياضي / الولي</span><i></i><small>التاريخ</small></div>'
      +   '<div><span>إدارة النادي</span><i></i><small>الختم والتوقيع</small></div>'
      + '</div>'

      /* The club fills this in when it accepts the request. */
      + '<div class="s-club"><b>على حساب النادي فقط</b>'
      +   '<span>رقم التسجيل: ......................</span>'
      +   '<span>تاريخ الاستلام: ......................</span>'
      +   '<span>ملاحظات: ....................................................</span>'
      + '</div>'

      + '<footer class="s-foot">'
      +   esc(CLUB.address) + ' &mdash; هاتف <span dir="ltr">' + esc(ar(CLUB.phone)) + '</span>'
      +   ' &mdash; <span dir="ltr">' + esc(CLUB.email) + '</span>'
      +   '<small>أخلاق، احترام، وانضباط</small>'
      + '</footer>'
      + '</section>';
  }

  /* ---------------- page 3: the club's own rules ---------------- */

  /* It goes out exactly as the club issued it: one A4 page with the scan filling
     it edge to edge. No heading, no season line, no "sign here" stamp, no
     signature row and no padding -- every one of those would print on top of the
     document and make it no longer the original. It comes after the form so the
     person signing at the club has what they are signing in front of them. */
  function regulationsSheet() {
    return '<section class="r-page">'
      + '<img class="r-img" src="' + esc(REGS_BG) + '" alt="النظام الداخلي">'
      + '</section>';
  }

  /* ---------------- the printed document ---------------- */
  function printCSS() {
    return ''
      + '@page{size:A4 portrait;margin:0}'
      + '@font-face{font-family:"CairoFallback";src:local("Cairo"),local("Tajawal"),local("Segoe UI")}'
      + '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'html,html body{margin:0!important;padding:0!important;background:#fff!important}'
      + 'body{font-family:Cairo,"CairoFallback","Segoe UI",Tahoma,Arial,sans-serif;color:#12333f}'

      /* --- the card --- */
      + '.f-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;'
      +   'page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}'
      + '.f-page:last-of-type{page-break-after:auto;break-after:auto}'
      + '.f-bg{position:absolute;top:0;left:0;width:210mm;height:297mm;object-fit:fill;display:block;z-index:0}'
      + '.f-photo{position:absolute;z-index:1;overflow:hidden;border-radius:2mm;background:#fff}'
      + '.f-photo img{width:100%;height:100%;object-fit:cover;display:block}'
      + '.f-spot{position:absolute;z-index:2;display:flex;align-items:flex-end;justify-content:flex-start;'
      +   'font-size:12.5pt;line-height:1.05;font-weight:700;color:#0b3b46;'
      +   'padding-bottom:.3mm;white-space:nowrap;overflow:hidden;direction:rtl;text-align:right;'
      +   'background:transparent;border:0;outline:0;box-shadow:none}'

      /* --- the summary ---
         A fixed 297 mm with the flow area clipped, so a summary is one page
         whatever it carries. It used to be min-height, which let a minor with
         every optional field run to 483 mm and come out as two sheets, the second
         of them nearly empty. */
      + '.s-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;padding:9mm 12mm 8mm;'
      +   'page-break-after:always;break-after:page;display:flex;flex-direction:column}'
      + '.s-head{display:flex;align-items:center;gap:5mm;border-bottom:2.5px solid #0a6f78;padding-bottom:2.2mm;flex:none}'
      + '.s-logo{width:13mm;height:13mm;border-radius:50%;flex:none;background:#fff}'
      + '.s-id{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.4}'
      + '.s-id b{font-size:11.5pt;color:#075a61}'
      + '.s-id span{font-size:8.8pt;color:#5c7b85}'
      + '.s-photo{width:24mm;height:29mm;flex:none;border:1px solid #cfe2e6;border-radius:2mm;'
      +   'overflow:hidden;background:#f7fbfd;display:flex;align-items:center;justify-content:center}'
      + '.s-photo img{width:100%;height:100%;object-fit:cover;display:block}'
      + '.s-photo span{font-size:7.6pt;color:#9db4bb}'
      + '.s-no{text-align:left;display:flex;flex-direction:column;line-height:1.4;flex:none}'
      + '.s-no span{font-size:8.2pt;color:#5c7b85}'
      + '.s-no b{font-size:10pt;color:#0b3b46}'
      + '.s-season-lbl{display:block;font-style:normal;font-size:8pt;color:#5c7b85;margin-top:2mm}'
      + '.s-season{display:block;font-style:normal;font-size:13pt;font-weight:700;color:#075a61;'
      +   'letter-spacing:.3px;margin-top:.4mm}'
      + '.s-page h1{font-size:12.5pt;color:#075a61;margin:3mm 0 2.5mm;flex:none}'
      + '.s-flow{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}'
      + '.s-cols{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:6mm;align-items:start}'
      + '.s-col{display:flex;flex-direction:column;gap:3.6mm;min-width:0}'
      + '.s-block{min-width:0}'
      + '.s-page h2{font-size:9.6pt;color:#075a61;margin:0 0 1.3mm;padding-bottom:.6mm;border-bottom:1px solid #cfe2e6}'
      /* One value per line: each block already sits in half the page, and a grid
         inside that only made the labels and values fight for the same space. */
      + '.s-grid{display:grid;grid-template-columns:1fr;gap:1.2mm}'
      + '.s-f{display:flex;gap:1.6mm;align-items:baseline;min-width:0;'
      +   'border-bottom:.4px dotted #cfe2e6;padding-bottom:.65mm}'
      + '.s-f b{font-weight:600;font-size:8pt;color:#5c7b85;white-space:nowrap;flex:none}'
      + '.s-f span{font-size:9pt;color:#0b3b46;min-width:0;word-break:break-word;line-height:1.3}'
      + '.s-f.s-wide{grid-column:1/-1}'
      + '.s-mono span{direction:ltr;text-align:left;font-variant-numeric:tabular-nums}'
      /* the three lines the doctor is written into by hand, side by side */
      + '.s-med{display:flex;align-items:baseline;gap:1.2mm 2.6mm}'
      + '.s-med span{font-size:8pt;color:#5c7b85;white-space:nowrap}'
      + '.s-med i{flex:1;min-width:20mm;border-bottom:1px solid #12333f;height:4.5mm}'
      + '.s-total{display:flex;align-items:baseline;gap:3mm;background:#e6f4f5;border-radius:1.5mm;'
      +   'padding:1.2mm 2.6mm;margin-top:1mm}'
      + '.s-total span{font-size:9pt;color:#5c7b85;font-weight:600}'
      + '.s-total b{font-size:11.5pt;color:#075a61}'
      /* The swimmer's note is the one thing here that can be any length at all, so
         it is capped rather than allowed to push the signatures onto a second
         sheet. What is cut says so, rather than stopping mid-word. */
      + '.s-notes{margin:0;font-size:8.8pt;line-height:1.45;background:#f7fbfd;border:1px solid #cfe2e6;'
      +   'border-radius:2mm;padding:1.4mm 2.6mm;max-height:13mm;overflow:hidden;'
      +   'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}'
      + '.s-sign{display:flex;gap:10mm;margin-top:5mm;flex:none}'
      + '.s-sign>div{flex:1;display:flex;flex-direction:column;gap:1mm}'
      + '.s-sign span{font-size:9pt;color:#5c7b85}'
      + '.s-sign i{display:block;height:10mm;border-bottom:1px solid #12333f}'
      + '.s-sign small{font-size:7.5pt;color:#9db4bb}'
      + '.s-club{flex:none;margin-top:3mm;border:1px dashed #cfe2e6;border-radius:2mm;padding:1.6mm 3mm;'
      +   'display:flex;flex-wrap:wrap;gap:2mm 8mm;font-size:8.5pt;color:#5c7b85}'
      + '.s-club b{color:#075a61;width:100%}'
      + '.s-foot{flex:none;margin-top:auto;padding-top:2.5mm;border-top:1px solid #cfe2e6;'
      +   'font-size:8.5pt;color:#5c7b85;text-align:center}'
      + '.s-foot small{display:block;margin-top:1mm;font-size:8pt;color:#9db4bb}'

      /* --- the club's own rules, one page, edge to edge --- */
      + '.r-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;'
      +   'page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}'
      + '.r-page:last-of-type{page-break-after:auto;break-after:auto}'
      + '.r-img{position:absolute;top:0;left:0;width:210mm;height:297mm;object-fit:fill;display:block}'

      /* on screen the sheets are shown as paper, one under the other */
      + '@media screen{body{background:#e9eef3;padding:10px;display:flex;flex-direction:column;align-items:center;gap:14px}'
      +   '.f-page,.s-page{box-shadow:0 10px 34px #0b3b4633;border-radius:2px;margin:0}'
      +   '.f-page{height:297mm;overflow:hidden}'
      + '.f-hint{max-width:210mm;background:#fff;border:1px solid #cfe2e6;border-radius:10px;padding:10px 14px;'
      +   'font-size:12px;color:#16414d;margin-bottom:6px;text-align:center}'
      + '.f-hint b{color:#0a6f78}}'
      + '@media print{.f-page,.s-page{width:210mm;margin:0}'
      /* The bar above the form tells the person what to do with it: sign it and
         bring it in. It is an instruction for the screen, not part of the
         document, and left in the print it lands at the top of page one over
         the club's own heading. */
      +   '.f-hint{display:none}}'
  }

  function documentHTML(rec, options) {
    options = options || {};
    var title = options.title || ('استمارة التسجيل — ' + CLUB.ar);
    var hint = options.hint === false ? '' :
      '<div class="f-hint"><b>استمارة مكتملة.</b> '
      + 'الصفحة الأولى استمارة النادي الرسمية، والثانية ملخّص البيانات، والثالثة النظام الداخلي. '
      + 'وقّع الاستمارة ثم أحضرها إلى النادي. '
      + '<span>' + esc(ar(rec && rec.application_no ? rec.application_no : '')) + '</span></div>';
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(title) + '</title>'
      + '<link rel="preconnect" href="https://fonts.googleapis.com">'
      + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
      + '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=block" rel="stylesheet">'
      + '<style>' + printCSS() + '</style></head><body>'
      + hint
      + overlaySheet(rec)
      + summarySheet(rec)
      + regulationsSheet()
      + '</body></html>';
  }

  /* Printing goes through a hidden iframe rather than window.open: a phone can
     block a popup, and an iframe cannot be blocked. The document is written,
     then the browser is asked to print once the images are in, otherwise the
     card comes out with an empty photo frame. */
  function printRegistration(rec, options) {
    options = options || {};
    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;';
    document.body.appendChild(frame);

    var doc = frame.contentWindow.document;
    doc.open();
    doc.write(documentHTML(rec, options));
    doc.close();

    var go = function () {
      try {
        /* Measured here, on the document that is about to print and after the
           webfont has arrived: a value that fits in the fallback face can be cut
           off in the real one. The frame is written from here and is same-origin,
           so the page is reached directly rather than through a script put into
           the document. */
        fitSpots(doc);
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        if (typeof options.onError === 'function') options.onError(e);
      }
      window.setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); },
        options.keep === true ? 60000 : 1500);
    };

    /* Printing too early gives a half-styled page: wait for the card image and
       the webfont, but never hang if one of them never arrives. */
    var images = Array.prototype.slice.call(doc.images || []);
    var pending = images.length;
    var fonts = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      window.setTimeout(go, options.delay === undefined ? 120 : options.delay);
    };
    var tick = function () { if (--pending <= 0) finish(); };
    images.forEach(function (img) {
      if (img.complete) tick();
      else {
        img.addEventListener('load', tick);
        img.addEventListener('error', tick);
      }
    });
    if (!pending) finish();
    fonts.then(finish, finish);
    window.setTimeout(finish, 4000);   // a stuck asset must not trap the print
    return frame;
  }

  global.SADARA_FORM = {
    FORM_BG: FORM_BG,
    PAGE_W: PAGE_W,
    PAGE_H: PAGE_H,
    PHOTO_BOX: PHOTO_BOX,
    SPOT_GAP: SPOT_GAP,
    SPOT_CLEAR: SPOT_CLEAR,
    FORM_SPOTS: FORM_SPOTS,
    GUARDIAN_SPOT: GUARDIAN_SPOT,
    CLUB: CLUB,
    REGS_BG: REGS_BG,
    esc: esc,
    ar: ar,
    slashDate: slashDate,
    isAdult: isAdult,
    spotStyle: spotStyle,
    formValues: formValues,
    formPhotoData: formPhotoData,
    fitSpots: fitSpots,
    overlaySheet: overlaySheet,
    summarySheet: summarySheet,
    regulationsSheet: regulationsSheet,
    printCSS: printCSS,
    documentHTML: documentHTML,
    printRegistration: printRegistration
  };
})(typeof window !== 'undefined' ? window : this);
