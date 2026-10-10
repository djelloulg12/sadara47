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
  var PAGE_W = 210, PAGE_H = 297;          // A4 in millimetres
  var PHOTO_BOX = { x: 22.1, y: 67.6, w: 36.4, h: 42.5 };
  var SPOT_GAP = 1.6;                      // clear paper between the colon and the value
  var SPOT_CLEAR = 0.4;                    // clear paper between the value and its rule

  /* id, the printed rule it sits on, where that rule starts, and the left edge
     of the colon that ends its label -- all in millimetres from the page edge. */
  var FORM_SPOTS = [
    { id: 'membership',         y: 61.95, x0: 90.8,  colon: 193.5 },
    { id: 'first_name',         y: 75.25, x0: 62.3,  colon: 178.3 },
    { id: 'last_name',          y: 85.05, x0: 62.3,  colon: 178.3 },
    { id: 'birth_date',         y: 94.85, x0: 62.3,  colon: 178.3 },
    { id: 'address',            y: 104.65, x0: 62.3, colon: 178.3 },
    { id: 'blood_group',        y: 114.45, x0: 62.1,  colon: 178.3 },
    { id: 'phone',              y: 124.25, x0: 62.3,  colon: 178.3 },
        { id: 'parent_name',        y: 208.78, x0: 105.7, colon: 152.9 },
    { id: 'parent_birth',       y: 208.78, x0: 32.9,  colon: 71.9 },
    { id: 'parent_last_name',   y: 208.78, x0: 4.2,   colon: 31.5 },
    { id: 'parent_id',          y: 217.70, x0: 106.0, colon: 149.4 },
    { id: 'card_issued_at',     y: 217.70, x0: 40.0,  colon: 73.3 },
    { id: 'card_place',         y: 217.70, x0: 4.2,   colon: 31.5 },
    { id: 'authorised_for',     y: 226.80, x0: 106.0, colon: 186.4 }
  ];

  /* These belong to the guardian declaration, which only a minor has. */
  var GUARDIAN_SPOT = /^(parent_|card_|authorised_for$)/;

  var CLUB = {
    name: 'النادي الرياضي الصدارة',
    unit: 'فرع السباحة',
    ar: 'النادي الرياضي الصدارة – غرداية',
    address: 'حي الثنية — غرداية',
    phone: '0660 60 64 67',
    email: 'nadisadara@gmail.com',
    season: '2026 / 2027'
  };

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isAdult(rec) {
    return String((rec && rec.category) || '').toLowerCase() === 'adult';
  }

  /* The card writes the date the way the club reads it: day first. */
  function dayFirst(d) {
    d = String(d || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d;
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
      membership: v('membership_no') || v('application_no'),
      first_name: v('first_name_ar'),
      last_name: v('last_name_ar'),
      birth_date: dayFirst(rec.birth_date),
      address: v('address'),
      blood_group: v('blood_group'),
      phone: v('phone'),
            parent_name: v('guardian_first_name'),
      parent_birth: dayFirst(v('guardian_birth_date')),
      parent_last_name: v('guardian_last_name'),
      parent_id: v('guardian_national_id'),
      /* The place and the date of issue are the club's to fill in, so a public
         form leaves them on the blank line the scan already carries. */
      card_issued_at: '',
      card_place: '',
      authorised_for: rec.guardian_child || ((v('first_name_ar') + ' ' + v('last_name_ar')).trim())
    };
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
  /* The club writes its sections in Arabic-Indic digits. */
  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  function money(n) {
    n = Number(n) || 0;
    return n.toLocaleString('fr-DZ') + ' دج';
  }

  function row(label, value, opts) {
    opts = opts || {};
    if (!value && !opts.keep) return '';
    var attrs = '';
    if (opts.mono) attrs += ' class="mono" dir="ltr"';
    else if (opts.span) attrs += ' class="span2"';
    return '<tr' + (opts.span && !opts.mono ? ' class="span2"' : '') + '>'
      + '<th>' + esc(label) + '</th>'
      + '<td' + attrs + '>' + esc(value || '—') + '</td></tr>';
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
    if (rec.membership_no) extras.push('تسجيل سابق: ' + rec.membership_no);

    var identity = ''
      + row('الاسم بالعربية', rec.first_name_ar)
      + row('اللقب بالعربية', rec.last_name_ar)
      + (rec.first_name_fr ? row('الاسم بالفرنسية', rec.first_name_fr) : '')
      + (rec.last_name_fr ? row('اللقب بالفرنسية', rec.last_name_fr) : '')
      + row('تاريخ الميلاد', dayFirst(rec.birth_date))
      + row('الجنس', GENDERS[rec.gender] || rec.gender)
      + row('مكان الميلاد', rec.birth_place)
      + row('الولاية', rec.wilaya)
      + row('رقم التعريف الوطني', rec.national_id, { mono: true })
      + row('رقم شهادة الميلاد', rec.birth_certificate_no, { mono: true })
      /* A+ and O- are written with the sign after the letter, so an RTL cell
         would print them backwards as +A. */
      + row('فصيلة الدم', rec.blood_group, { mono: true })
      + row('المستوى', rec.level || (LEVELS.indexOf(rec.level) === -1 ? rec.level : rec.level))
      + row('نمط السباحة', rec.swimming_strokes)
      + row('الهاتف', rec.phone, { mono: true })
      + row('الواتساب', rec.whatsapp, { mono: true })
      + row('العنوان', rec.address);

    var guardian = adult ? '' :
      '<h2>' + headGuardian + ' &mdash; ولي الأمر</h2><table>'
      + row('اسم الولي', rec.guardian_first_name)
      + row('لقب الولي', rec.guardian_last_name)
      + row('تاريخ ميلاد الولي', dayFirst(rec.guardian_birth_date))
      + row('صلة القرابة', rec.guardian_relation)
      + row('هاتف الولي', rec.guardian_phone, { mono: true })
      + row('رقم تعريف الولي', rec.guardian_national_id, { mono: true })
      + (rec.guardian_consent ? '<tr class="span2"><th>إذن التدريب</th><td>مصرّح به</td></tr>' : '')
      + '</table>';

    /* The club writes the doctor in by hand: the official form has no room for
       it, so nothing is typed and nothing is printed. An empty ruled block says
       exactly that -- the line is there, waiting for the pen. */
    var medical = ''
      + '<tr><th>الطبيب</th><td class="blank"></td></tr>'
      + '<tr><th>التخصص</th><td class="blank"></td></tr>'
      + '<tr><th>تاريخ الفحص</th><td class="blank"></td></tr>';

    var money_rows = ''
      + row('الاشتراك', plan)
      + row('المسبح أو المنشأة', rec.facility)
      + row('طريقة الدفع', PAYMENTS[rec.payment_method] || rec.payment_method)
      + (extras.length ? row('إضافات', extras.join(' — ')) : '')
      + '<tr class="span2 total"><th>المبلغ المتوقع</th><td><b>' + esc(money(rec.expected_amount)) + '</b></td></tr>';

    return '<section class="s-page">'
      + '<header class="s-head">'
      +   '<img class="s-logo" src="/assets/logo.png" alt="" />'
      +   '<div><b>' + esc(CLUB.ar) + '</b><span>فرع السباحة &middot; موسم ' + esc(CLUB.season) + '</span></div>'
      +   '<div class="s-no"><span>رقم الطلب</span><b dir="ltr">' + esc(rec.application_no || '—') + '</b></div>'
      + '</header>'

      + '<h1>استمارة التسجيل &mdash; ملخّص البيانات</h1>'
      + '<p class="s-lead">هذا الملخّص مرافق لاستمارة النادي المرفقة في الصفحة السابقة،'
      + ' وتُملأ الفراغات التي لا يتّسع لها النموذج الرسمي.</p>'

      + '<div class="s-body">'
      +   '<div class="s-photo">'
      +     (photo ? '<img src="' + esc(photo) + '" alt="صورة المنخرط">' : '<span>لا توجد صورة</span>')
      +     '<small>الصورة الشخصية</small>'
      +   '</div>'
      +   '<div class="s-tables">'
      +     '<h2>' + headSwimmer + ' &mdash; بيانات الرياضي</h2><table>' + identity + '</table>'
      +     (adult ? '' : guardian)
      +     '<h2>' + headMedical + ' &mdash; الفحص الطبي</h2>'
      +     '<table>' + medical + '</table>'
      +     '<h2>' + headMoney + ' &mdash; الاشتراك والدفع</h2><table>' + money_rows + '</table>'
      +     (rec.notes ? '<h2>ملاحظة الرياضي</h2><p class="s-notes">' + esc(rec.notes) + '</p>' : '')
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
      +   esc(CLUB.address) + ' &mdash; هاتف <span dir="ltr">' + esc(CLUB.phone) + '</span>'
      +   ' &mdash; <span dir="ltr">' + esc(CLUB.email) + '</span>'
      +   '<small>أخلاق، احترام، وانضباط</small>'
      + '</footer>'
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

      /* --- the summary --- */
      + '.s-page{position:relative;width:210mm;min-height:297mm;background:#fff;padding:12mm 14mm;'
      +   'page-break-after:always;break-after:page;display:flex;flex-direction:column}'
      + '.s-head{display:flex;align-items:center;gap:8mm;border-bottom:2.5px solid #0a6f78;padding-bottom:3mm}'
      + '.s-logo{width:16mm;height:16mm;border-radius:50%;flex:none;background:#fff}'
      + '.s-head>div:nth-child(2){flex:1;display:flex;flex-direction:column;line-height:1.5}'
      + '.s-head>div:nth-child(2) b{font-size:13pt;color:#075a61}'
      + '.s-head>div:nth-child(2) span{font-size:9.5pt;color:#5c7b85}'
      + '.s-no{text-align:left;display:flex;flex-direction:column;line-height:1.5}'
      + '.s-no span{font-size:8.5pt;color:#5c7b85}'
      + '.s-no b{font-size:11pt;color:#0b3b46}'
      + '.s-page h1{font-size:14pt;color:#075a61;margin:6mm 0 1mm}'
      + '.s-lead{margin:0 0 4mm;font-size:9.5pt;color:#5c7b85;line-height:1.6}'
      + '.s-body{display:flex;gap:7mm;align-items:flex-start}'
      + '.s-photo{width:34mm;height:42mm;flex:none;border:1px solid #cfe2e6;border-radius:2mm;'
      +   'overflow:hidden;background:#f7fbfb;display:flex;flex-direction:column;align-items:center;justify-content:center}'
      + '.s-photo img{width:100%;height:34mm;object-fit:cover;display:block}'
      + '.s-photo span{font-size:8pt;color:#9db4bb}'
      + '.s-photo small{font-size:7.5pt;color:#5c7b85;margin-top:2mm}'
      + '.s-tables{flex:1;min-width:0}'
      + '.s-page h2{font-size:11pt;color:#075a61;margin:5mm 0 1.5mm;padding-bottom:1mm;border-bottom:1px solid #cfe2e6}'
      + '.s-page h2:first-child{margin-top:0}'
      + '.s-page table{width:100%;border-collapse:collapse;font-size:9.5pt}'
      + '.s-page th{width:34%;text-align:right;font-weight:600;color:#5c7b85;padding:1.1mm 1.5mm;'
      +   'border-bottom:1px dotted #cfe2e6;vertical-align:top}'
      + '.s-page td{padding:1.1mm 1.5mm;border-bottom:1px dotted #cfe2e6;vertical-align:top;word-break:break-word}'
      + '.s-page tr.span2 th,.s-page tr.span2 td{width:auto}'
      + '.s-page td.mono{direction:ltr;text-align:left;font-variant-numeric:tabular-nums}'
      + '.s-page tr.total th,.s-page tr.total td{background:#e6f4f5;border-bottom:none;padding:2mm 1.5mm}'
      + '.s-page tr.total td b{font-size:12pt;color:#075a61}'
      /* a line to write the doctor in by hand */
      + '.s-page td.blank{height:9mm;border-bottom:1px solid #12333f}'
      + '.s-notes{margin:0;font-size:9.5pt;line-height:1.6;background:#f7fbfd;border:1px solid #cfe2e6;'
      +   'border-radius:2mm;padding:2mm 3mm}'
      + '.s-sign{display:flex;gap:10mm;margin-top:8mm}'
      + '.s-sign>div{flex:1;display:flex;flex-direction:column;gap:1mm}'
      + '.s-sign span{font-size:9pt;color:#5c7b85}'
      + '.s-sign i{display:block;height:11mm;border-bottom:1px solid #12333f}'
      + '.s-sign small{font-size:7.5pt;color:#9db4bb}'
      + '.s-club{margin-top:7mm;border:1px dashed #cfe2e6;border-radius:2mm;padding:2.5mm 3.5mm;'
      +   'display:flex;flex-wrap:wrap;gap:2mm 8mm;font-size:8.5pt;color:#5c7b85}'
      + '.s-club b{color:#075a61;width:100%}'
      + '.s-foot{margin-top:auto;padding-top:4mm;border-top:1px solid #cfe2e6;font-size:8.5pt;color:#5c7b85;text-align:center}'
      + '.s-foot small{display:block;margin-top:1mm;font-size:8pt;color:#9db4bb}'

      /* on screen the sheets are shown as paper, one under the other */
      + '@media screen{body{background:#e9eef3;padding:10px;display:flex;flex-direction:column;align-items:center;gap:14px}'
      +   '.f-page,.s-page{box-shadow:0 10px 34px #0b3b4633;border-radius:2px;margin:0}'
      +   '.f-page{height:297mm;overflow:hidden}'
      + '.f-hint{max-width:210mm;background:#fff;border:1px solid #cfe2e6;border-radius:10px;padding:10px 14px;'
      +   'font-size:12px;color:#16414d;margin-bottom:6px;text-align:center}'
      + '.f-hint b{color:#0a6f78}}'
      + '@media print{.f-page,.s-page{width:210mm;margin:0}}';
  }

  function documentHTML(rec, options) {
    options = options || {};
    var title = options.title || ('استمارة التسجيل — ' + CLUB.ar);
    var hint = options.hint === false ? '' :
      '<div class="f-hint"><b>استمارة مكتملة.</b> '
      + 'الصفحة الأولى استمارة النادي الرسمية، والثانية ملخّص البيانات. '
      + 'وقّع الاستمارة ثم أحضرها إلى النادي. '
      + '<span dir="ltr">' + esc(rec && rec.application_no ? rec.application_no : '') + '</span></div>';
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
    esc: esc,
    dayFirst: dayFirst,
    isAdult: isAdult,
    spotStyle: spotStyle,
    formValues: formValues,
    formPhotoData: formPhotoData,
    overlaySheet: overlaySheet,
    summarySheet: summarySheet,
    printCSS: printCSS,
    documentHTML: documentHTML,
    printRegistration: printRegistration
  };
})(typeof window !== 'undefined' ? window : this);
