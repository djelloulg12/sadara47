/* ==========================================================
   اختيار التاريخ — a calendar for the Sadara forms
   ==========================================================
   A date typed by hand is a date that goes wrong: a day and a
   month swapped are both real dates, so nothing complains and the
   member is the wrong age on the card for ever. That is why the
   fields ask for year first -- 1998/03/17, never 17/03/1998 --
   and this is the other half of the answer: let the calendar write
   the date instead of the hands.

   The field stays a plain text box, because the page still works
   without this script and because the keyboard is faster than a
   pointer for somebody who knows their own date. The calendar is
   added beside it, never in place of it.

   One rule for everything here: the date the calendar writes is the
   date the club writes -- four digits, a slash, two digits, a
   slash, two digits, in Latin digits -- and the value it writes is
   exactly what is stored, with no second form of it anywhere.
   ========================================================== */
(function (global) {
  'use strict';

  /* The months as an Algerian club says them. Written out rather than taken from
     Intl, because Intl names the month according to the browser's language and
     locale, and the same form would print a different month on two phones. */
  var MONTHS = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
                'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  /* The week as it runs here: Saturday first, and then right to left, because the
     page is Arabic. The grid inherits the page's direction, so the first cell of
     a row is the Saturday at its right-hand end. */
  var DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  var pad = function (n) { return String(n).length < 2 ? '0' + n : String(n); };

  /* Arabic-Indic in, Latin out. A person who types a date on a keyboard set to
     Arabic produces Arabic-Indic digits, and the field they are typing into has
     already been told to read either set. */
  var latin = function (s) {
    return String(s == null ? '' : s)
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  };

  /* The one date the club writes, read: 11/10/2026. Both orders are read,
     because a person with the old shape in front of them will type it -- and what
     is stored is decided elsewhere and is still yyyy-mm-dd. '' when the text is
     not a date, which is how the form knows to say so rather than storing a
     guess. */
  var parse = function (value) {
    var text = latin(value).trim();
    var m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(text);
    var y, mo, d;
    if (m) {
      y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
    } else {
      var f = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(text);
      if (!f) return null;
      y = Number(f[3]);
      /* The day is first, always -- the club writes 11/10/2026 and means the
         eleventh of October, and reading eleven as a month here turns every such
         date into a different one. The only rescue kept is a first number that
         cannot be a day at all, which the club never writes. */
      d = Number(f[1]); mo = Number(f[2]);
      if (d > 31) { mo = Number(f[1]); d = Number(f[2]); }
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    /* The 31st of February is not a date the calendar offers and the form should
       not accept one either. */
    var probe = new Date(y, mo - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
    return { y: y, m: mo, d: d };
  };

  /* Day first, as the club writes it: 11/10/2026. */
  var format = function (p) { return pad(p.d) + '/' + pad(p.m) + '/' + p.y; };

  var isLeap = function (y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; };
  var daysIn = function (y, m) {
    return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  };

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ------------------------------------------------------------------ */

  function attach(input) {
    if (!input || input.dataset.calReady) return null;
    input.dataset.calReady = '1';

    /* What may be chosen. A birth date is not in the future and a card is not
       older than the club's own records, so both ends are bounded -- but only
       when the page says which bound, because a date of issue has no upper one
       and a birth date has no lower one. */
    var opts = {
      minYear: Number(input.dataset.calMinYear || 1900),
      maxYear: Number(input.dataset.calMaxYear || 0) || (new Date().getFullYear() + 20),
      maxToday: input.dataset.calMax === 'today'
    };
    var thisYear = new Date().getFullYear();
    if (opts.maxYear < thisYear) opts.maxYear = thisYear;
    var today = new Date();

    /* The field is wrapped so the button can sit inside it and the calendar can
       be placed against it without guessing where the field is on the page. */
    var wrap = el('span', 'cal-wrap');
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var open = el('button', 'cal-open');
    open.type = 'button';
    open.setAttribute('aria-label', 'اختر التاريخ');
    open.setAttribute('aria-haspopup', 'dialog');
    open.setAttribute('aria-expanded', 'false');
    open.textContent = '\u{1F4C5}';
    wrap.appendChild(open);

    var pop = el('div', 'cal-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'اختر التاريخ');
    pop.hidden = true;
    document.body.appendChild(pop);

    var head = el('div', 'cal-head');
    var back = el('button', 'cal-nav', '\u2039');       /* ‹ — back one month */
    back.type = 'button';
    back.setAttribute('aria-label', 'الشهر السابق');
    var title = el('div', 'cal-title');
    title.setAttribute('aria-live', 'polite');
    var fwd = el('button', 'cal-nav', '\u203A');        /* › — forward one month */
    fwd.type = 'button';
    fwd.setAttribute('aria-label', 'الشهر التالي');
    head.appendChild(back);
    head.appendChild(title);
    head.appendChild(fwd);

    var week = el('div', 'cal-week');
    DAYS.forEach(function (d) { week.appendChild(el('span', 'cal-dow', d)); });

    var grid = el('div', 'cal-grid');
    grid.setAttribute('role', 'grid');

    var foot = el('div', 'cal-foot');
    var todayBtn = el('button', 'cal-today', 'اليوم');
    todayBtn.type = 'button';
    var clearBtn = el('button', 'cal-clear', 'مسح');
    clearBtn.type = 'button';
    foot.appendChild(todayBtn);
    foot.appendChild(clearBtn);

    pop.appendChild(head);
    pop.appendChild(week);
    pop.appendChild(grid);
    pop.appendChild(foot);

    var view = { y: today.getFullYear(), m: today.getMonth() + 1 };

    function limit() {
      if (opts.maxToday) {
        /* Nothing after today in a birth year. */
        var nowY = today.getFullYear(), nowM = today.getMonth() + 1, nowD = today.getDate();
        if (view.y > nowY || (view.y === nowY && view.m > nowM)) {
          view.y = nowY; view.m = nowM;
        }
        return nowD;
      }
      return daysIn(view.y, view.m);
    }

    function paint() {
      var maxDay = limit();
      var shown = parse(input.value);
      title.textContent = MONTHS[view.m - 1] + ' ' + view.y;

      grid.textContent = '';
      /* The first of the month is a weekday: 0 is Sunday, and this week runs from
         Saturday, so Saturday is the sixth day after Sunday. */
      var first = new Date(view.y, view.m - 1, 1).getDay();
      var lead = (first + 1) % 7;
      for (var b = 0; b < lead; b++) grid.appendChild(el('span', 'cal-cell cal-blank'));

      var total = daysIn(view.y, view.m);
      for (var d = 1; d <= total; d++) {
        var cell = el('button', 'cal-cell');
        cell.type = 'button';
        cell.textContent = String(d);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('data-day', String(d));
        cell.setAttribute('aria-label', d + ' ' + MONTHS[view.m - 1] + ' ' + view.y);
        if (d > maxDay) {
          cell.classList.add('cal-off');
          cell.disabled = true;
        } else {
          cell.addEventListener('click', function () {
            write({ y: view.y, m: view.m, d: Number(this.getAttribute('data-day')) });
          });
        }
        if (shown && shown.y === view.y && shown.m === view.m && shown.d === d) {
          cell.classList.add('cal-on');
          cell.setAttribute('aria-selected', 'true');
        }
        if (d === today.getDate() && view.m === today.getMonth() + 1 && view.y === today.getFullYear()) {
          cell.classList.add('cal-today-mark');
        }
        grid.appendChild(cell);
      }
    }

    function write(p) {
      /* The one form, written the one way. The event is fired so the draft is
         kept and the form knows the field has an answer -- a calendar that filled
         the box without saying so would save a draft with the old date in it. */
      input.value = format(p);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
      input.focus();
    }

    function place() {
      var box = wrap.getBoundingClientRect();
      var width = pop.offsetWidth || 300;
      var left = box.left;
      /* Near the edge of a narrow screen the calendar would hang off it, so it is
         pulled back to the page rather than allowed to overflow. */
      var margin = 8;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
      if (left < margin) left = margin;
      var top = box.bottom + 6;
      var height = pop.offsetHeight || 320;
      /* And if it would run off the bottom, it goes above the field instead. */
      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, box.top - height - 6);
      }
      pop.style.left = Math.round(left + window.scrollX) + 'px';
      pop.style.top = Math.round(top + window.scrollY) + 'px';
    }

    function show() {
      var shown = parse(input.value);
      if (shown) { view.y = shown.y; view.m = shown.m; }
      paint();
      pop.hidden = false;
      open.setAttribute('aria-expanded', 'true');
      place();
      var sel = grid.querySelector('.cal-on') || grid.querySelector('buttonbutton.cal-cell:not([disabled])');
      if (sel) sel.focus();
    }

    function close() {
      if (pop.hidden) return;
      pop.hidden = true;
      open.setAttribute('aria-expanded', 'false');
    }

    open.addEventListener('click', function () { pop.hidden ? show() : close(); });

    /* Typing in the field still works, and the calendar follows what was typed:
       somebody who has already entered a date and then opens the calendar expects
       to see that month, not today's. */
    input.addEventListener('input', function () {
      var typed = parse(input.value);
      if (typed) { view.y = typed.y; view.m = typed.m; }
      if (!pop.hidden) paint();
    });

    back.addEventListener('click', function () {
      view.m--; if (view.m < 1) { view.m = 12; view.y--; } paint(); place();
    });
    fwd.addEventListener('click', function () {
      view.m++; if (view.m > 12) { view.m = 1; view.y++; } paint(); place();
    });

    todayBtn.addEventListener('click', function () {
      write({ y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() });
    });
    clearBtn.addEventListener('click', function () {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      close();
      input.focus();
    });

    /* The keyboard, because a calendar that can only be used with a pointer is a
       calendar that cannot be used by half the people who fill in forms. */
    pop.addEventListener('keydown', function (e) {
      var cell = e.target.closest ? e.target.closest('.cal-cell') : null;
      if (e.key === 'Escape') { e.preventDefault(); close(); open.focus(); return; }
      if (!cell) return;
      var step = { ArrowRight: -1, ArrowLeft: 1, ArrowDown: -7, ArrowUp: 7 }[e.key];
      /* Arrows run in the reading direction: right goes back a day here, because
         this is an Arabic page and a week reads right to left. */
      if (step === undefined) return;
      e.preventDefault();
      var all = [].slice.call(grid.querySelectorAll('buttonbutton.cal-cell:not([disabled])'));
      var at = all.indexOf(cell);
      var to = all[at + step];
      if (to) { to.focus(); return; }
      /* Past the end of the month is past the end of the month. */
      if (step === -1 || step === 7) {
        view.m--; if (view.m < 1) { view.m = 12; view.y--; }
      } else {
        view.m++; if (view.m > 12) { view.m = 1; view.y++; }
      }
      paint(); place();
      var again = [].slice.call(grid.querySelectorAll('buttonbutton.cal-cell:not([disabled])'));
      if (again.length) again[Math.max(0, again.length - (step === -1 ? 1 : 7))].focus();
    });

    document.addEventListener('click', function (e) {
      if (pop.hidden) return;
      if (pop.contains(e.target) || wrap.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', function (e) {
      if (!pop.hidden && e.key === 'Escape') { close(); open.focus(); }
    });
    /* A resize can move the field sideways with no scroll at all, so it is placed
       again. A scroll does not: the calendar is in the document with the field and
       carries the window's offsets, so the two move together and cannot come
       apart. Closing on scroll used to be a habit from calendars fixed to the
       viewport, and it closed on the page's own smooth scroll -- including the
       scroll that walks a person to the field they still have to fill in. */
    window.addEventListener('resize', function () { if (!pop.hidden) place(); });

    return { show: show, close: close };
  }

  /* Every field that asks for a date, on every page of this site that has one. */
  function attachAll(root) {
    var nodes = (root || document).querySelectorAll('input.date-in');
    var made = [];
    for (var i = 0; i < nodes.length; i++) {
      var c = attach(nodes[i]);
      if (c) made.push(c);
    }
    return made;
  }

  global.SADARA_CALENDAR = { attach: attach, attachAll: attachAll, parse: parse, format: format };
})(window);