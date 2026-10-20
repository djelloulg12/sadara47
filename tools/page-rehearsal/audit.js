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

    /* A control below the fold is only a fault when nothing can bring it into view.

       Two things can: the document, and any box that scrolls on its own. Once the
       long lists were given a scrollbar of their own -- which is what the club
       asked for -- every row below the first few became "below the fold" and was
       reported as unreachable, which is the opposite of the truth: they are one
       scroll away, which is what a scrollbar is for.

       So reachability is asked of the whole chain of boxes above the control,
       not of the window alone. A control that no scroll, anywhere, can reach is a
       control that is not there. */
    function canReachVertically(el) {
      /* the document itself */
      if (scrollable) {
        var r0 = el.getBoundingClientRect();
        if (r0.top <= reach + vh) return true;
      } else if (el.getBoundingClientRect().top <= vh) return true;

      /* any box that scrolls between here and the document */
      for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        var s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return true;
        /* a box that is itself off screen but inside a scrollable one is fine */
      }
      return false;
    }

    for (var i = 0; i < all.length; i++) {
      var el = all[i], r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var label = (el.textContent || '').trim().slice(0, 28);
      var name = String(el.className || el.tagName);

      if (interactive(el) && r.top > vh && !canReachVertically(el)) {
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

    /* The club's own complaint, asked of the page rather than of the controls.

       "The view is tedious: I want the page to stay put and the list to scroll."
       That is a statement about which thing moves. If the document scrolls, the
       page moves and the sidebar -- which is fixed -- sits beside it doing
       nothing. If the list scrolls inside its own box, the page holds still, the
       sidebar holds still, and the only thing that moves is the list.

       So this records, for every page with a long list, whether the document
       scrolls and whether the list has a scrollbar of its own. */
    line.pageScrolls = scrollable;
    var boxes = [];
    for (var q = 0; q < all.length; q++) {
      if (all[q].classList && all[q].classList.contains('table-scroll')) {
        boxes.push({ scrolls: all[q].scrollHeight > all[q].clientHeight + 2,
                     h: Math.round(all[q].clientHeight),
                     content: Math.round(all[q].scrollHeight) });
      }
    }
    line.tables = boxes.slice(0, 3);
    if (boxes.length && boxes[0].scrolls && !line.hasOwnProperty('scrollerFixed')) {
      line.scrollerFixed = false;
    }

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

    /* ---- the things this walk exists to be asked about ----

       A page that renders is not a page that is finished. The club asked for the
       settings page to carry the box that opens and closes registrations, and for
       this a season ago it carried nothing at all -- the layer that drew it was
       wrapped around a page that does not exist, so the guard was false, nothing
       was written, nothing complained, and the switch was simply not there for
       anybody. Every other finding in this file would still have read CLEAN.

       So it is asked of the drawn page, by name, for the roles that are meant to
       see it. A switch that has been written and cannot be seen is the same fault
       as one that was never written, and only looking finds it. */
    if (page === 'settings') {
      var box = document.getElementById('door-toggle');
      var who = ['admin', 'president', 'owner'].indexOf(role) !== -1;
      if (who && !box) {
        line.findings.push('the registration door is not on this page for a '
          + role + ': the switch the club opens and closes registrations with is not here');
      }
      if (!who && box) {
        line.findings.push('the registration door is on this page for a ' + role
          + ', who has no business closing registrations');
      }
      line.door = who ? (box ? 'present' : 'MISSING') : 'not for this role';
    }

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

  /* ------------------------------------------------------------------
     Pressing the things, not just looking at them.

     The walk above measures what is drawn. It cannot tell a form that saves
     from a form that only looks like one, and that is the fault the club just
     met: «إضافة فوج» opened, it filled in, and حفظ did nothing, because the
     layer added for the swimmer-group button answered `save-group` -- the
     name that form's own save uses -- before the page could.

     So the form is filled in and its own save button is pressed, and what is
     asked is only what a manager would ask: is there now a group called that?
     Nothing here knows how the collision happened, so it will notice the next
     one whatever shape it takes. The fetch wrapper is proof of the narrower
     question still: saving a group must not be a write to a swimmer.
  ------------------------------------------------------------------ */
  function driveGroupForm() {
    var report = { steps: [], problems: [] };
    var innerFetch = window.fetch;
    try {
      var seed = seedFor('groups', 'admin');
      seed.groups = [{ id: 'g1', name: 'المبتدئون', coach: 'مدرّب سليم', schedule: 'السبت' }];
      try { localStorage.setItem('sadara-state', JSON.stringify(seed)); } catch (e) {}
      var mount = document.getElementById('app');
      if (mount) mount.innerHTML = '';
      try { state = Object.assign(state || {}, seed); } catch (e) {}
      state.page = 'groups';
      render();

      var puts = [];
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url);
        if (init && String(init.method || '').toUpperCase() === 'PUT') puts.push(String(url));
        return Promise.resolve({
          ok: true, status: 200,
          json: function () { return Promise.resolve({ ok: true }); }
        });
      };

      var addBtn = document.querySelector('[data-action="new-group"]');
      if (!addBtn) {
        report.problems.push('the groups page offers no «إضافة فوج» button');
      } else {
        action('new-group', addBtn);
        var nameBox = document.getElementById('g-name');
        report.opened = !!nameBox;
        if (!nameBox) {
          report.problems.push('«إضافة فوج» opened no form with a name in it');
        } else {
          nameBox.value = 'فوج الأشبال';
          var before = state.groups.length;
          action('save-group', { dataset: {} });
          report.added = state.groups.length - before;
          report.names = state.groups.map(function (g) { return String(g.name || ''); });
          if (state.groups.length !== before + 1) {
            report.problems.push('pressing حفظ on «إضافة فوج» saved ' + report.added
              + ' groups -- the form a manager fills in does not save');
          }
          if (report.names.indexOf('فوج الأشبال') === -1) {
            report.problems.push('the group is not saved under the name that was typed');
          }
          var grid = document.querySelector('.group-grid');
          report.drawn = grid ? grid.textContent.indexOf('فوج الأشبال') !== -1 : null;
          if (grid && !report.drawn) {
            report.problems.push('the saved group is not drawn on the page it was saved from');
          }
          report.puts = puts;
          if (puts.indexOf('/api/swimmers') !== -1) {
            report.problems.push('saving a group wrote to a swimmer instead');
          }
        }
      }
    } catch (e) {
      report.problems.push('the group form could not be driven at all: ' + ((e && e.message) || e));
    }
    window.fetch = innerFetch;
    return report;
  }

  try {
    out.groupForm = driveGroupForm();
    for (var gi = 0; gi < out.groupForm.problems.length; gi++) {
      out.problems.push('groups page, pressing حفظ: ' + out.groupForm.problems[gi]);
    }
  } catch (e) {
    out.problems.push('the group form stage did not run: ' + ((e && e.message) || e));
  }

  /* ------------------------------------------------------------------
     ورقة الفوج: المعاينة والطباعة.

     الورقة التي يقف عليها المدرب في المسبح ويعلّم عليها بالقلم. الفحص
     لا يسأل هل الزرّ موجود -- ذلك يقرؤه المشي أعلاه -- بل هل خرجت ورقة
     فيها أعمدة الحصص الأربع وموضعا التوقيع والختم، وهل عدد سطورها عدد
     سباحي الفوج لا عدد آخر، وهل الطباعة أعطت الورقة لا المعاينة.

     يُقاس في المتصفح لأن ما لا يُقاس يُدَّعى: جدول فيه عمود خامس فارغ
     يبدو في الشيفرة كجدول تام.
  ------------------------------------------------------------------ */
  function driveGroupRoster() {
    var report = { problems: [] };
    var innerFetch = window.fetch;
    var innerPrint = window.print;
    try {
      var seed = seedFor('groups', 'admin');
      seed.groups = [{ id: 'g1', name: 'المبتدئون', coach: 'مدرّب سليم', schedule: 'السبت · 16:00' }];
      try { localStorage.setItem('sadara-state', JSON.stringify(seed)); } catch (e) {}
      var mount = document.getElementById('app');
      if (mount) mount.innerHTML = '';
      try { state = Object.assign(state || {}, seed); } catch (e) {}
      state.page = 'groups';
      render();

      window.fetch = function () {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
      };
      var printed = 0;
      window.print = function () { printed++; };

      var button = document.querySelector('[data-action="group-roster"]');
      if (!button) {
        report.problems.push('the groups page offers no way to preview and print a group list');
        window.fetch = innerFetch;
        window.print = innerPrint;
        return report;
      }
      report.label = (button.textContent || '').trim();
      if (report.label.indexOf('معاينة') === -1) {
        report.problems.push('the group list button does not say that it previews: "' + report.label + '"');
      }

      button.click();
      var sheet = document.querySelector('.roster-sheet');
      if (!sheet) {
        report.problems.push('pressing the button opened no preview');
      } else {
        var heads = [];
        var ths = sheet.querySelectorAll('th');
        for (var t = 0; t < ths.length; t++) heads.push((ths[t].textContent || '').trim());
        report.heads = heads;
        for (var s = 1; s <= 4; s++) {
          if (heads.indexOf('حصة ' + s) === -1) {
            report.problems.push('the roster has no column for «حصة ' + s + '»: ' + JSON.stringify(heads));
          }
        }
        if (!heads.some(function (h) { return /ملاحظات/.test(h); })) {
          report.problems.push('the roster has no column for the coach\'s notes: ' + JSON.stringify(heads));
        }

        var want = 0;
        try { want = swimmersOf('المبتدئون').length; } catch (e) {}
        var rows = sheet.querySelectorAll('tbody tr');
        report.rows = rows.length;
        report.wanted = want;
        if (want && rows.length !== want) {
          report.problems.push('the sheet lists ' + rows.length + ' swimmers where the group has ' + want);
        }
        var marks = 0, notes = 0;
        for (var i = 0; i < rows.length; i++) {
          marks += rows[i].querySelectorAll('td.mark-cell').length;
          notes += rows[i].querySelectorAll('td.note-cell').length;
        }
        report.marks = marks;
        if (rows.length && (marks !== rows.length * 4 || notes !== rows.length)) {
          report.problems.push('the marking row is not four sessions and a note per swimmer: '
            + marks + ' session boxes and ' + notes + ' note boxes over ' + rows.length + ' rows');
        }
        report.signSlots = sheet.querySelectorAll('.roster-sign .sign-slot').length;
        if (report.signSlots !== 2) {
          report.problems.push('the sheet has ' + report.signSlots
            + ' places to sign; it is signed by the coach and stamped by the administration');
        }
        var head = document.querySelector('.roster-modal-head');
        report.headText = head ? (head.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
        if (!/النادي الرياضي الصدارة/.test(report.headText) || !/تاريخ الاستخراج/.test(report.headText)) {
          report.problems.push('the preview does not carry the club\'s name and the date it was produced: "'
            + report.headText + '"');
        }
        var box = document.querySelector('.roster-modal');
        if (box) {
          var r = box.getBoundingClientRect();
          report.box = { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
          if (r.right > window.innerWidth + 2 || r.left < -2) {
            report.problems.push('the preview is drawn past the edge of the window: '
              + Math.round(r.width) + 'px wide in ' + window.innerWidth + 'px');
          }
        }

        var print = document.querySelector('[data-action="print-group-roster"]');
        if (!print) {
          report.problems.push('the preview offers no way to print the sheet');
        } else {
          print.click();
          var host = document.querySelector('.print-host');
          if (!host) {
            report.problems.push('printing produced no sheet');
          } else {
            report.printed = printed;
            var prows = host.querySelectorAll('table.roster-table tbody tr');
            report.printRows = prows.length;
            if (!host.querySelector('.print-head')) {
              report.problems.push('the printed sheet has no club header');
            }
            if (!/قائمة الفوج/.test(host.textContent || '')) {
              report.problems.push('the printed sheet is not titled as a group list');
            }
            if (want && prows.length !== want) {
              report.problems.push('the printed sheet carries ' + prows.length + ' of the group\'s ' + want);
            }
            var pmarks = 0;
            for (var p = 0; p < prows.length; p++) pmarks += prows[p].querySelectorAll('td.mark-cell').length;
            if (prows.length && pmarks !== prows.length * 4) {
              report.problems.push('the printed sheet has ' + pmarks + ' session boxes over '
                + prows.length + ' rows -- a coach cannot mark what is not printed');
            }
            /* asking for the dialog is deferred by a moment, so what is checked
               here is that the print was armed, not that the dialog has opened */
            report.armed = (typeof printReset === 'function');
            if (!report.armed) {
              report.problems.push('printing built a sheet but never armed the print dialog');
            }
          }
        }
      }
    } catch (e) {
      report.problems.push('the group sheet could not be driven at all: ' + ((e && e.message) || e));
    }
    window.fetch = innerFetch;
    window.print = innerPrint;
    return report;
  }

  try {
    out.roster = driveGroupRoster();
    for (var ri = 0; ri < out.roster.problems.length; ri++) {
      out.problems.push('groups page, the group sheet: ' + out.roster.problems[ri]);
    }
  } catch (e) {
    out.problems.push('the group sheet stage did not run: ' + ((e && e.message) || e));
  }

  /* ------------------------------------------------------------------
     الجدول على الهاتف: هل تقول كل خلية من أي عمود جاءت؟

     الورقة تحوّل صفّ الجدول على الهاتف إلى مكدّس من الكتل، وتضع اسم العمود
     أمام كل كتلة بقاعدة `content:attr(data-label)`. القاعدة موجودة، ووسم
     `data-label` لم يكن على خلية واحدة في المنصة كلها، فكان الأب على هاتفه
     يرى عمودًا من قيم عارية -- «المتوسطون»، «06610000»، «O+» -- ولا شيء
     يقول له أيّها الفوج وأيّها الهاتف وأيّها فصيلة الدم.

     يُقاس في المتصفح لأن ما لا يُقاس يُدَّعى: قاعدة `::before` تشير إلى سمة
     غائبة تبدو في الشيفرة كأنها تعمل. لا يُقاس الحجم هنا -- لا محرّك عرض
     للهاتف في هذا المشي -- بل يُقاس أن الوسم موجود وغير فارغ على كل خلية
     تحت رأس مسمّى، وهو الشرط الذي بدونه لا يظهر اسم العمود أبدًا.
  ------------------------------------------------------------------ */
  function driveTableLabels() {
    var report = { problems: [], tables: [] };
    try {
      var seed = seedFor('card', 'admin');
      try { localStorage.setItem('sadara-state', JSON.stringify(seed)); } catch (e) {}
      var mount = document.getElementById('app');
      if (mount) mount.innerHTML = '';
      try { state = Object.assign(state || {}, seed); } catch (e) {}

      var pages = ['applications', 'attendance', 'settings', 'users'];
      for (var pi = 0; pi < pages.length; pi++) {
        var page = pages[pi];
        if (mount) mount.innerHTML = '';
        state.page = page;
        try { render(); } catch (e) { continue; }
        var tables = document.querySelectorAll('#app table');
        for (var ti = 0; ti < tables.length; ti++) {
          var table = tables[ti];
          var head = table.tHead || table.querySelector('thead');
          var body = table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
          if (!head || !head.rows.length || !body) continue;
          var heads = head.rows[head.rows.length - 1].cells;
          var row = body.rows[0];
          if (!row) continue;
          var cells = row.cells;
          var named = 0, blank = 0;
          for (var c = 0; c < cells.length; c++) {
            var headText = (heads[c] ? (heads[c].textContent || '') : '').replace(/\s+/g, ' ').trim();
            if (!headText) continue; /* a decision column is labelled by its buttons */
            var label = cells[c].getAttribute('data-label');
            if (label && label.length) named++;
            else blank++;
          }
          report.tables.push({ page: page, named: named, blank: blank });
          if (blank) {
            report.problems.push('a table on «' + page + '» has ' + blank
              + ' cell(s) in one row with a named column above them and no data-label, '
              + 'so on a phone the value stands with no saying which column it is');
          }
        }
      }
    } catch (e) {
      report.problems.push('the table labels could not be inspected at all: ' + ((e && e.message) || e));
    }
    return report;
  }

  try {
    out.tableLabels = driveTableLabels();
    for (var li = 0; li < out.tableLabels.problems.length; li++) {
      out.problems.push('tables on a phone: ' + out.tableLabels.problems[li]);
    }
  } catch (e) {
    out.problems.push('the table-label stage did not run: ' + ((e && e.message) || e));
  }

  /* ------------------------------------------------------------------
     تخصيص الأعمدة: القائمة تفتح، والعلامة تُخفي، والاختيار يُحفظ لصاحبه.

     الزرّ ظاهر في الشيفرة، والقائمة تُبنى، والاختيار يُكتب في التخزين المحلي
     -- وكلّها يمكن أن تكون ولا تفعل شيئًا: زرّ يُضاف بعد أن يكون `bind` قد
     مرّ لا يحمل معالجًا، وعلامة مقلوبة تُحفظ فلا تُخفي، وتفضيل يُحفظ باسم
     المتصفح فيتبع من يدخل بعده.

     فيُضغط الزرّ الحقيقي، وتُلمس العلامة الحقيقية، ويُقرأ الـDOM الحقيقي.
  ------------------------------------------------------------------ */
  function driveColumnTool() {
    var report = { problems: [], steps: [] };
    try {
      var swimmers = [];
      var FAM = ['بن طَرَفَة', 'قندوز', 'بوصيلة', 'جبريط'];
      for (var i = 0; i < 6; i++) {
        var no = 'E202610' + ('000' + (i + 1)).slice(-4);
        swimmers.push({
          id: no, membership_no: no, name: 'سباح ' + FAM[i % FAM.length],
          group: i % 2 ? 'المبتدئون' : 'المتوسطون', phone: '06610000' + i,
          status: 'نشط', blood_group: 'O+', joined: '2026-10-0' + (1 + i % 9),
          photo: PHOTO, level: 'المستوى 1'
        });
      }

      function draw(role, email) {
        var s = seedFor('users', role);
        s.user = { id: 1, name: 'المسيّر', role: role, email: email };
        s.swimmers = swimmers;
        try { localStorage.setItem('sadara-state', JSON.stringify(s)); } catch (e) {}
        var mount = document.getElementById('app');
        if (mount) mount.innerHTML = '';
        try { state = Object.assign(state || {}, s); } catch (e) {}
        state.page = 'users';
        render();
        return document.querySelector('#app table');
      }

      /* A preference left by an earlier run of this very check would make it ask
         its first question about the wrong state: «is the phone hidden before
         anything was unticked?» is only a sensible question on a list nobody has
         configured yet. So the two accounts this check uses are cleared first --
         the check is about the tool, not about what is already in the browser. */
      function forgetChoices() {
        try {
          var doomed = [];
          for (var k = 0; k < localStorage.length; k++) {
            var key = localStorage.key(k);
            if (key && key.indexOf('sadara-cols:') === 0
                && (key.indexOf('mgr@sadara.dz') !== -1 || key.indexOf('other@sadara.dz') !== -1)) {
              doomed.push(key);
            }
          }
          for (var d = 0; d < doomed.length; d++) localStorage.removeItem(doomed[d]);
        } catch (e) {}
      }

      function headerIndex(table, label) {
        var head = table.tHead || table.querySelector('thead');
        var heads = head.rows[head.rows.length - 1].cells;
        for (var h = 0; h < heads.length; h++) {
          if ((heads[h].textContent || '').replace(/\s+/g, ' ').trim() === label) return h;
        }
        return -1;
      }
      function cellHidden(table, colIndex) {
        var cell = table.tBodies[0].rows[0].cells[colIndex];
        if (!cell) return null;
        return { marked: cell.hasAttribute('data-col-hidden'),
                 styled: getComputedStyle(cell).display === 'none' };
      }

      /* 1. the button, for a manager and not for a coach */
      forgetChoices();
      var table = draw('admin', 'mgr@sadara.dz');
      if (!table) { report.problems.push('the swimmers table did not render, so the column tool could not be driven'); return report; }
      var btn = document.querySelector('#app [data-action="toggle-columns"]');
      report.steps.push('button for manager: ' + (btn ? 'present' : 'MISSING'));
      if (!btn) report.problems.push('the manager has no «تخصيص الأعمدة» button on the swimmers list');

      draw('coach', 'coach@sadara.dz');
      var coachBtn = document.querySelector('#app [data-action="toggle-columns"]');
      report.steps.push('button for coach: ' + (coachBtn ? 'present' : 'absent'));
      if (coachBtn) report.problems.push('a coach is offered the column tool');

      /* 2. it opens a menu with a tick per column */
      table = draw('admin', 'mgr@sadara.dz');
      btn = document.querySelector('#app [data-action="toggle-columns"]');
      btn.click();
      var menu = document.querySelector('#app [data-col-menu]');
      report.steps.push('menu after press: ' + (menu && !menu.hidden ? 'open' : 'MISSING or hidden'));
      if (!menu || menu.hidden) {
        report.problems.push('pressing «تخصيص الأعمدة» opens no menu -- the button is added after '
          + 'bind has run, so it may carry no handler');
        return report;
      }
      var boxes = menu.querySelectorAll('input[type="checkbox"]');
      report.steps.push('ticks in the menu: ' + boxes.length);
      if (boxes.length < 3) report.problems.push('the menu carries ' + boxes.length + ' columns to tick');

      /* 3. the locked columns */
      var nameBox = menu.querySelector('[data-col-toggle="السباح"]');
      var groupBox = menu.querySelector('[data-col-toggle="الفوج"]');
      if (!nameBox || !nameBox.disabled) report.problems.push('«السباح» is not locked, so the name can be hidden');
      if (!groupBox || !groupBox.disabled) report.problems.push('«الفوج» is not locked, so the group can be hidden');
      report.steps.push('locked: السباح=' + (nameBox && nameBox.disabled) + ' الفوج=' + (groupBox && groupBox.disabled));

      /* 4. untick a real column: it goes from the table and the phone card */
      var phoneIndex = headerIndex(table, 'الهاتف');
      report.steps.push('الهاتف column index: ' + phoneIndex);
      if (phoneIndex === -1) { report.problems.push('no «الهاتف» column on the swimmers table'); return report; }
      var before = cellHidden(table, phoneIndex);
      if (!before || before.styled) report.problems.push('«الهاتف» is hidden before anything was unticked');

      var phoneBox = menu.querySelector('[data-col-toggle="الهاتف"]');
      phoneBox.checked = false;
      action('set-column', phoneBox);
      table = document.querySelector('#app table');
      var after = cellHidden(table, phoneIndex);
      report.steps.push('الهاتف after untick: marked=' + (after && after.marked) + ' hidden=' + (after && after.styled));
      if (!after || !after.styled) {
        report.problems.push('unticking «الهاتف» left it on the table -- a tick that hides nothing '
          + 'is the fault this stage exists for (the choice may be stored the wrong way round)');
      }

      /* 5. the choice is kept for this account, away from another */
      var keptKey = null;
      try {
        for (var k = 0; k < localStorage.length; k++) {
          var key = localStorage.key(k);
          if (key && key.indexOf('sadara-cols:') === 0 && key.indexOf('mgr@sadara.dz') !== -1) keptKey = key;
        }
      } catch (e) {}
      report.steps.push('stored under: ' + keptKey);
      if (!keptKey) report.problems.push('the choice is not kept for the manager who made it');

      table = draw('admin', 'mgr@sadara.dz');
      var again = cellHidden(table, headerIndex(table, 'الهاتف'));
      report.steps.push('kept across a redraw: hidden=' + (again && again.styled));
      if (!again || !again.styled) report.problems.push('the column comes back on the next render');

      var other = draw('admin', 'other@sadara.dz');
      var forOther = cellHidden(other, headerIndex(other, 'الهاتف'));
      report.steps.push('for another account: hidden=' + (forOther && forOther.styled));
      if (forOther && forOther.styled) {
        report.problems.push('a column one manager hid is hidden for another account -- the preference '
          + 'is kept per browser, not per person');
      }
    } catch (e) {
      report.problems.push('the column tool could not be driven at all: ' + ((e && e.message) || e));
    }
    return report;
  }

  try {
    out.columnTool = driveColumnTool();
    for (var ci = 0; ci < out.columnTool.problems.length; ci++) {
      out.problems.push('the column tool: ' + out.columnTool.problems[ci]);
    }
  } catch (e) {
    out.problems.push('the column-tool stage did not run: ' + ((e && e.message) || e));
  }

  /* ------------------------------------------------------------------
     الصمود: الحاجز يمسك الخطأ، والهيكل يظهر أثناء الجلب، والشريط يقول الحقيقة.

     A boundary that is written but never catches is a boundary nobody has. So a
     record is made to throw the way a missing field does -- a getter that fails
     on the one swimmer nobody filled in completely -- and what is asked is
     whether the application is still there: a panel, a sentence that says the
     data is safe, and two ways back. Not a white screen.

     Then a fetch is held open, and the list must show a skeleton rather than its
     empty message -- "لا يوجد سباحون" told for two seconds while the data is on
     its way is a lie a club will believe.
  ------------------------------------------------------------------ */
  function driveResilience() {
    var report = { problems: [], steps: [] };
    try {
      var seed = seedFor('users', 'admin');
      try { localStorage.setItem('sadara-state', JSON.stringify(seed)); } catch (e) {}
      var mount = document.getElementById('app');
      if (mount) mount.innerHTML = '';
      try { state = Object.assign(state || {}, seed); } catch (e) {}
      state.page = 'users';

      /* ---- 1. a throw out of render must leave a panel, not a white screen ----

         `esc` is a `const` and is not on window, so the probe cannot patch it
         from outside the module. A record whose `name` getter throws reaches
         every builder that reads a name, which is the same surface a missing
         field lands on -- and it is the honest shape of the fault: one record
         the club did not finish filling in. */
      var poison = { id: 'poison', membership_no: 'poison', group: 'المبتدئون', status: 'نشط' };
      Object.defineProperty(poison, 'name', {
        get: function () { throw new Error('probe: a field was read that was not there'); }
      });
      state.swimmers = [poison];
      var escaped = false;
      try { render(); } catch (e) { escaped = true; }

      var panelText = (document.getElementById('app') || {}).textContent || '';
      var hasPanel = /تعذّر عرض هذه الصفحة/.test(panelText);
      var hasRetry = !!document.querySelector('[data-action="recover-render"]');
      report.steps.push('boundary on a record that throws: escapedToCaller=' + escaped
        + ' panel=' + hasPanel + ' retry=' + hasRetry);
      if (escaped) {
        report.problems.push('a record with a field that throws escaped out of render() -- the '
          + 'application white-screens, which is the fault this stage exists for');
      }
      if (!hasPanel) report.problems.push('a throw out of render() left no panel on the screen');
      if (!hasRetry) report.problems.push('the error panel offers no way back');

      /* the panel must say the data is safe: a red screen about a field reads as
         a red screen about the club's records unless it says otherwise */
      if (hasPanel && !/بياناتك لم تُمسّ/.test(panelText)) {
        report.problems.push('the error panel does not tell the manager their data is safe');
      }

      /* ---- 2. the way back works ---- */
      state.swimmers = seed.swimmers; /* the field was fixed, as it would be */
      var retry = document.querySelector('[data-action="recover-render"]');
      if (retry) {
        retry.click();
        var after = (document.getElementById('app') || {}).textContent || '';
        report.steps.push('after «إعادة المحاولة»: recovered=' + !/تعذّر عرض هذه الصفحة/.test(after));
        if (/تعذّر عرض هذه الصفحة/.test(after)) {
          report.problems.push('pressing «إعادة المحاولة» did not draw the page again');
        }
      }

      /* ---- 3. the skeleton, while a fetch is in flight ----

         The fetch is held, not failed: that is a slow line, which is the common
         case and the one that shows the empty message for two seconds. */
      var held = null;
      var innerFetch = window.fetch;
      window.fetch = function () { return new Promise(function (res) { held = res; }); };
      try {
        state.swimmers = [];
        var p = syncApi();
        if (p && p.catch) p.catch(function () {});
        render();
        var rows = document.querySelectorAll('#app .table-scroll tr.skeleton-row');
        report.steps.push('skeleton rows while a fetch is in flight: ' + rows.length);
        if (!rows.length) {
          report.problems.push('a list with a fetch in flight shows its empty message instead of a '
            + 'skeleton, so a slow line looks like a club with no members');
        }
        if (held) held({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
      } catch (e) {
        report.problems.push('the skeleton could not be inspected: ' + ((e && e.message) || e));
      }
      window.fetch = innerFetch;

      /* ---- 4. the stale banner, after a sync that failed ----

         The club works without wifi. What must not happen is the screen claiming
         to be current when it is not. */
      var innerFetch2 = window.fetch;
      window.fetch = function () {
        return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({}); } });
      };
      /* The observer must sit on top of the stub, or it is looking underneath the
         thing it is meant to observe -- which is what it does in the real
         application, where nothing else wraps fetch. */
      if (typeof watchRequests_ === 'function') watchRequests_();
      try {
        var q = syncApi();
        if (q && q.catch) q.catch(function () {});
      } catch (e) {}
      /* What is asked: after a sync that failed, does the screen say so? The
         club works without wifi; what must not happen is the screen claiming to
         be current when it is not. */
      window.__sadaraBannerProbe = function () {
        render();
        var text = (document.body.textContent || '');
        var shown = /تعذّر تحديث البيانات|لا يوجد اتصال بالإنترنت/.test(text);
        report.steps.push('stale banner after a failed sync: ' + shown);
        if (!shown) {
          report.problems.push('a sync that failed leaves no notice, so a manager cannot tell that '
            + 'what is on the screen may be out of date');
        }
        return report;
      };
      /* The failure is reported on a later turn. So the report is written on that
         turn too -- one `setTimeout` after the rejection has been handled, which
         is the earliest moment the banner can exist. */
      setTimeout(function () {
        window.fetch = innerFetch2;
        if (typeof window.__sadaraFinishBanner === 'function') window.__sadaraFinishBanner();
      }, 120);
      return { deferred: true };
    } catch (e) {
      report.problems.push('the resilience stage could not be driven at all: ' + ((e && e.message) || e));
      return report;
    }
  }

  try {
    out.resilience = driveResilience();
    if (out.resilience && out.resilience.deferred) {
      /* The banner is written a turn after the failed sync, so the report cannot
         be written in this turn. It is written when the probe says the turn has
         passed -- and if the probe never runs, the report says so rather than
         silently passing a check that never happened. */
      out.resilience = null;
      window.__sadaraFinishBanner = function () {
        var r = (typeof window.__sadaraBannerProbe === 'function')
          ? window.__sadaraBannerProbe()
          : { problems: ['the deferred banner check never ran'], steps: [] };
        for (var i = 0; i < r.problems.length; i++) out.problems.push('resilience: ' + r.problems[i]);
        out.resilience = r;
        out.measured = measured;
        out.verdict = out.problems.length ? 'PROBLEMS' : 'CLEAN';
        var pre2 = document.createElement('pre');
        pre2.id = 'page-audit-report';
        pre2.style.cssText = 'position:fixed;left:-9999px;top:0';
        pre2.textContent = JSON.stringify(out, null, 1);
        document.body.appendChild(pre2);
        document.body.setAttribute('data-page-verdict', out.verdict);
      };
      return;
    }
    for (var ri2 = 0; ri2 < out.resilience.problems.length; ri2++) {
      out.problems.push('resilience: ' + out.resilience.problems[ri2]);
    }
  } catch (e) {
    out.problems.push('the resilience stage did not run: ' + ((e && e.message) || e));
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