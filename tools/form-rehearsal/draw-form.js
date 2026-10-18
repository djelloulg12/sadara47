/* The official form, drawn, with the two dates deliberately different.

   The club reported that the parental-authorization section prints the guardian's
   day of birth where the child's should be. Two dates that are obviously not the
   same are put on one record, the form is drawn, and the page is looked at. A
   field that prints 2013-04-07 when the child was born on it has been proved; a
   field that prints 1978-11-02 has been found.

   Nothing is read from the source to decide this, because the source said the
   right thing: the mapping writes the swimmer's date, and a mapping can be right
   while the thing that draws it puts the value in the wrong box. That is only
   visible on the page.
*/

(function () {
  var report = { problems: [], values: {}, drawnByRow: {}, spots: {} };

  /* The report is written whatever happens. A rehearsal that dies quietly and
     prints nothing looks the same as a rehearsal that never ran, and the second
     is the one that gets believed. */
  function finish() {
    report.verdict = report.problems.length ? 'WRONG' : 'RIGHT';
    try {
      var pre = document.createElement('pre');
      pre.id = 'form-report';
      pre.style.cssText = 'position:fixed;left:-9999px;top:0';
      pre.textContent = JSON.stringify(report, null, 1);
      document.body.appendChild(pre);
      document.body.setAttribute('data-form-verdict', report.verdict);
    } catch (e) { /* nothing left to do about it */ }
  }

  try {
    var PHOTO = 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="#cfe3e2"/></svg>');

    /* A minor, so the guardian block is printed at all, and two dates that cannot
       be mistaken for one another. */
    var record = {
      first_name_ar: 'مُهنَّد', last_name_ar: 'مقدَّم بن طَرَفَة',
      first_name_fr: 'MOHAMED', last_name_fr: 'BEN TARFA',
      birth_date: '2013-04-07',
      birth_place: 'غرداية', wilaya: 'غرداية', gender: 'ذكر',
      blood_group: 'O+', level: 'المستوى الثاني',
      national_id: '201304070012', phone: '0661000001', whatsapp: '0661000001',
      address: 'حي الثنية', facility: 'المسبح النصف أولمبي',
      subscription_code: 'quarter', payment_method: 'cash', expected_amount: 1000,
      category: 'minor',
      guardian_first_name: 'محمد', guardian_last_name: 'مقدَّم',
      guardian_birth_date: '1978-11-02',
      guardian_relation: 'الأب', guardian_phone: '0662000002',
      guardian_national_id: '197811020034',
      guardian_card_issued: '2026-03-15', card_issue_date: '2026-03-15',
      card_issue_place: 'غرداية',
      membership_no: 'E2026100007', application_no: 'APP-20261018-TEST',
      photo: PHOTO, photoDataUrl: PHOTO
    };

    if (typeof overlaySheet !== 'function') {
      report.problems.push('the form is not built on this page at all: overlaySheet is missing');
      finish(); return;
    }

    /* The sheet's own stylesheet, or the boxes float on an un-sized page and the
       form cannot be read at all -- which is a fault in the rehearsal, not in the
       form, and looks exactly like the second. */
    if (typeof officialFormCSS === 'function') {
      var style = document.createElement('style');
      style.textContent = officialFormCSS();
      document.head.appendChild(style);
    } else {
      report.problems.push('the form has no stylesheet here, so it cannot be looked at');
    }

    var host = document.createElement('div');
    host.id = 'form-stage';
    document.body.appendChild(host);
    host.innerHTML = overlaySheet(record);
    if (typeof fitSpots === 'function') fitSpots(host);

    var vals = formValues(record);
    report.values = {
      birth_date: vals.birth_date,
      child_birth_date: vals.child_birth_date,
      parent_name: vals.parent_name,
      medical_person: vals.medical_person
    };

    /* What the page actually drew, read back off the page rather than out of the
       mapping -- because a mapping can be right and the page still put the value
       in the wrong box. */
    var drawn = {};
    var nodes = host.querySelectorAll('.f-spot');
    report.spotCount = nodes.length;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = (el.getAttribute('style') || '');
      var m = /bottom:([\d.]+)mm/.exec(key);
      var row = m ? m[1] : Math.round(el.getBoundingClientRect().top);
      drawn[row] = (drawn[row] || '') + '[' + el.textContent.trim() + ']';
    }
    report.drawnByRow = drawn;

    FORM_SPOTS.forEach(function (s) {
      if (s.id === 'child_birth_date' || s.id === 'birth_date' || s.id === 'parent_name') {
        report.spots[s.id] = { y: s.y, x0: s.x0, colon: s.colon };
      }
    });

    if (String(vals.child_birth_date).indexOf('1978') !== -1) {
      report.problems.push('the declaration prints the GUARDIAN date: ' + vals.child_birth_date);
    }
    if (String(vals.child_birth_date).indexOf('2013') === -1) {
      report.problems.push('the declaration does not print the SWIMMER date: ' + vals.child_birth_date);
    }
    if (vals.medical_person !== '') {
      report.problems.push('the doctor line carries a value: ' + vals.medical_person);
    }
  } catch (e) {
    report.problems.push('the form could not be drawn: ' + ((e && e.message) || e));
  }

  finish();
})();