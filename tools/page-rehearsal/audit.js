/* Walking the platform, page by page, and writing down what is out of reach.

   Loaded into the platform's own index.html, not into a page of its own. That is
   not tidiness: the application draws into a shell that a page invented for itself
   does not have, so every render came back with "cannot set innerHTML of null",
   every page measured nothing, and the walk reported the whole platform as clean.
   A check that measures nothing and says everything is fine is the most dangerous
   thing in this repository, and it is the reason this file is loaded the way it is.

   It also refuses to report clean if any page failed. A walk that quietly skips
   the page it could not open is a walk that has only walked part of the way.
*/

(function () {
  var PHOTO = 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150"><rect width="120" height="150" fill="#cfe3e2"/></svg>');

  function seedFor(page, role) {
    var swimmers = [], applications = [], coaches = [], schedules = [], groups = [];
    var FAM = ['بن طَرَفَة', 'قندوز', 'بوصيلة', 'جبريط', 'قرادي', 'معمري', 'بوهيشة', 'زرقاط'];
    for (var i = 0; i < 22; i++) {
      var no = 'E202610' + ('000' + (i + 1)).slice(-4);
      swimmers.push({
        id: no, doc_id: 'APP-D' + i, membership_no: no, registration_id: no,
        name: 'مُهنَّد ب ' + FAM[i % FAM.length], group: i % 2 ? 'المبتدئون' : 'المتوسطون',
        phone: '06610000' + ('0' + i).slice(-2), status: i % 4 === 3 ? 'بانتظار' : 'نشط',
        blood_group: 'O+', joined: '2026-10-0' + (1 + i % 9), photo: i % 3 ? PHOTO : '',
        level: 'المستوى ' + (1 + i % 4), facility: 'المسبح النصف اولمبي', national_id: 'NI-' + (100000 + i)
      });
      applications.push({
        id: 'APP-D' + i, application_no: 'APP-D' + i,
        first_name_ar: 'مُهنَّد', last_name_ar: 'ب ' + FAM[i % FAM.length],
        status: i % 5 === 0 ? 'approved' : (i % 7 === 0 ? 'rejected' : 'pending'),
        registration_id: no, birth_date: '20' + (10 + i % 8) + '-0' + (1 + i % 9) + '-1' + (i % 9),
        phone: '06610000' + ('0' + i).slice(-2), national_id: 'NI-' + (100000 + i),
        subscription_code: 'quarter', expected_amount: 1000, photo: i % 3 ? PHOTO : '',
        submitted_at: '2026-10-1' + (i % 9)
      });
      if (i % 5 === 0) coaches.push({
        id: 'COACH-' + i, doc_id: 'COACH-' + i, name: 'مدرّب ' + FAM[i % FAM.length],
        specialty: 'سباحة', phone: '07710000' + ('0' + i).slice(-2), email: 'c' + i + '@x.dz',
        experience: 5 + i, group_name: 'الطاقم الفني', status: 'نشط',
        registration_id: 'C2026' + ('000' + i).slice(-4), photo: i % 2 ? PHOTO : ''
      });
    }
    for (var g = 0; g < 5; g++) schedules.push({
      id: g + 1, day_name: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'][g],
      time_range: '16:00 - 17:30', group_name: ['المبتدئون', 'المتوسطون', 'المتقدمون'][g % 3],
      coach: 'مدرّب ' + FAM[g], pool: 'المسبح النصف اولمبي'
    });
    for (var q = 0; q < 4; q++) groups.push({
      id: 'g' + q, name: ['المبتدئون', 'المتوسطون', 'المتقدمون', 'الفوج الذهبي'][q],
      coach: 'مدرّب ' + FAM[q], schedule: 'السبت'
    });
    return {
      user: { id: 1, name: 'المسيّر', role: role, email: 'x@x.dz' },
      page: page,
      swimmers: swimmers, applications: applications, coaches: coaches,
      schedules: schedules, groups: groups,
      attendance: {}, attendanceByDay: {}, attendanceMap: {},
      subscriptions: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر', active: true }],
      notices: [{ id: 1, title: 'إعلان', text: 'نص الإعلان', date: '02 أكتوبر', type: 'مهم' }],
      coachRequirements: [{ id: 'a', label: 'شهادة', required: true }],
      cards: [], cardsByMember: {}, extras: { transport: 900, uniform: 2500 }
    };
  }

  /* The names the page picker is actually given. `requests` was in the first list
   and is not here: the picker falls through to the dashboard for it, so walking
   it measured the dashboard and filed the findings against the wrong page. */
  var PAGES = ['dashboard', 'applications', 'coaches', 'groups', 'card',
               'attendance', 'schedule', 'payments', 'subscriptions', 'settings', 'users'];
  var ROLES = ['admin', 'president', 'coach'];

  var out = { at: new Date().toISOString(), problems: [], pages: [] };

  function interactive(el) {
    var t = el.tagName;
    return t === 'BUTTON' || t === 'A' || t === 'SELECT' || t === 'TEXTAREA'
        || el.getAttribute('role') === 'button' || el.getAttribute('data-action');
  }

  function measure(page, role) {
    var line = { page: page, role: role, findings: [] };
    var seed = seedFor(page, role);
    try { localStorage.setItem('sadara-state', JSON.stringify(seed)); } catch (e) {}

    /* Each page is measured on an empty document.

       Without this the walk carries one page's controls into the next page's
       measurements: four buttons belonging to the dashboard were reported on the
       coaches page, the payments page and four others, at exactly the same height
       every time. That is not what those pages contain -- it is what the page
       before left behind. Measuring a page that has not been cleaned is measuring
       the previous one, and it is how a real fault gets blamed on the wrong page. */
    var mount = document.getElementById('app');
    if (mount) mount.innerHTML = '';

    try { state = Object.assign(state || {}, seed); } catch (e) {}
    try { if (typeof setState === 'function') setState(seed); } catch (e) {}

    var err = null;
    try { render(); } catch (e) { err = String((e && e.message) || e); }
    line.error = err;

    /* Which page actually drew. Without this the walk attributes one page's
       measurements to another page's name, and every finding is filed against the
       wrong door -- which is exactly what happened here: the dashboard was being
       measured six times over and reported as six different pages. */
    var head = mount ? mount.querySelector('h1, h2, .page-title, .panel-head h3') : null;
    line.drew = head ? (head.textContent || '').trim().slice(0, 40) : '(nothing)';
    try { line.wantedPage = String((typeof state !== 'undefined' && state.page) || '?'); } catch (e) {}

    /* Nothing rendered at all is a failure to measure, not a page that is fine. */
    if (err || !mount || mount.innerHTML.length < 40) {
      line.findings.push('this page did not render, so nothing about it was measured -- '
        + (err || ('the page drew ' + (mount ? mount.innerHTML.length : 0) + ' characters')));
      out.problems.push(page + ' (' + role + '): ' + line.findings[0]);
      out.pages.push(line);
      return;
    }

    var vh = window.innerHeight, vw = window.innerWidth;
    line.viewport = { w: vw, h: vh };

    var scope = document.querySelector('.main-content') || document.body;
    var all = scope.querySelectorAll('*');
    var belowFold = 0, examples = [], cut = [], tiny = [], offscreen = 0;

    /* A control below the fold is only a fault if scrolling cannot bring it into
       view. A list of two hundred rows has two hundred rows of buttons, all of
       them below the fold on a short window, and every one of them reachable by
       scrolling -- which is what a list is for.

       What is wrong is a control that is below the fold on a page that does not
       scroll, or below a document's full height and still out of sight. That is
       the club's complaint exactly: four buttons on every page, at a thousand
       pixels, on a document two hundred pixels tall -- nothing to scroll. */
    var docHeight = Math.round(document.documentElement.scrollHeight);
    var scrollable = docHeight > vh + 8;
    var reach = scrollable ? docHeight - vh : 0;

    /* Something drawn past the edge of the window is only a fault when there is
       nothing to scroll. A wide table inside a box that scrolls sideways is not
       broken -- the box exists for that. What is broken is a person who has to
       scroll sideways to reach the button that decides a child's registration,
       which is a different complaint and is answered by pinning the column
       rather than by narrowing the table.

       So the check asks whether the element is inside something that scrolls, and
       if it is, the answer is "reachable", not "wrong". */
    function canScrollX(el) {
      for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        var s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
      }
      return false;
    }

    for (var i = 0; i < all.length; i++) {
      var el = all[i], r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var label = (el.textContent || '').trim().slice(0, 28);
      var name = String(el.className || el.tagName);

      /* `top` is measured from the viewport, so a control can be scrolled to when
         its distance down the page is within what the document scrolls by. */
      if (interactive(el) && r.top > vh && (!scrollable || r.top > reach + vh)) {
        belowFold++;
        if (examples.length < 5) examples.push({ el: name, text: label, top: Math.round(r.top) });
      }
      if ((r.right > vw + 2 || r.left < -2) && !canScrollX(el)) {
        offscreen++;
        if (line.findings.length < 5) line.findings.push('drawn past the edge with nothing to scroll: ' + name);
      }
      if (!el.children.length && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 2) {
        cut.push({ el: name, text: label, by: el.scrollHeight - el.clientHeight });
      }
      if (interactive(el) && el.tagName !== 'INPUT' && (r.height < 28 || r.width < 24)) {
        tiny.push({ el: name, text: label, w: Math.round(r.width), h: Math.round(r.height) });
      }
    }

    line.belowFold = belowFold;
    line.belowFoldExamples = examples;
    line.offscreen = offscreen;
    line.cut = cut.slice(0, 6);
    line.tiny = tiny.slice(0, 6);
    line.docHeight = Math.round(document.documentElement.scrollHeight);
    line.scrollable = scrollable;
    line.horizontalScroll = document.documentElement.scrollWidth > vw + 1;

    if (belowFold) {
      line.findings.push(belowFold + ' control(s) cannot be reached by scrolling'
        + ' (the document is ' + line.docHeight + 'px in a ' + vh + 'px window;'
        + ' the lowest is at ' + (examples[0] ? examples[0].top + 'px' : '?') + ')');
    }
    if (line.horizontalScroll) {
      line.findings.push('the page scrolls sideways: ' + document.documentElement.scrollWidth
        + 'px wide in a ' + vw + 'px window');
    }
    if (cut.length) line.findings.push(cut.length + ' piece(s) of text do not fit their box');
    if (tiny.length) line.findings.push(tiny.length + ' control(s) too small to press reliably');

    out.pages.push(line);
    out.problems.push.apply(out.problems, line.findings.map(function (f) {
      return page + ' (' + role + '): ' + f;
    }));
  }

  var measured = 0;
  for (var r = 0; r < ROLES.length; r++) {
    for (var p = 0; p < PAGES.length; p++) {
      try { measure(PAGES[p], ROLES[r]); measured++; }
      catch (e) {
        out.problems.push(PAGES[p] + ' (' + ROLES[r] + '): could not be walked at all -- '
          + ((e && e.message) || e));
      }
    }
  }

  out.measured = measured;
  out.verdict = out.problems.length ? 'PROBLEMS' : 'CLEAN';

  var pre = document.createElement('pre');
  pre.id = 'page-audit-report';
  pre.style.cssText = 'position:fixed;left:-9999px;top:0';
  pre.textContent = JSON.stringify(out, null, 1);
  document.body.appendChild(pre);
  document.body.setAttribute('data-page-verdict', out.verdict);
})();