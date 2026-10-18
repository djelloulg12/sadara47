/* The notice, drawn in a real browser and measured.

   The announcement is the only thing a family gets when registrations are shut,
   and it is read on a phone by somebody who was told the season was full. It
   carries two things they have to act on: that the season is closed, and that a
   subscription is suspended for a photograph that is not an official one. Both
   have to fit the screen they are read on, in the place they were put, without
   being cut and without running under the phone's edge -- and without leaving the
   warning block, which is the part with the deadline in it, below the fold.

   It is measured on the real page, not on a page built here. A hand-assembled
   copy of the announcement would prove only that the copy fits, and the last
   version of this file did exactly that and reported a page that does not exist:
   the real page threw before it drew anything, and a missing notice and a broken
   page look identical from the outside.

   So: the club's own index.html, with one thing changed -- a line of script that
   answers the door question the way a shut door answers it. Everything else, the
   stylesheet, the markup, the page's own code deciding for itself, is theirs. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');
const problems = [];
const say = [];

const CHROME = [
  process.env.SADARA_CHROME,
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });

if (!CHROME) {
  console.log('SKIP  no Chrome on this machine, so the announcement was not drawn.');
  console.log('      (the words on it are still checked by the other suites)');
  process.exit(0);
}

/* The one line that differs. It runs before the page's own scripts, so the door
   is shut before the page asks -- which is what a visitor with a shut door gets,
   and not a page whose form was removed by hand afterwards. */
const STUB = `<script>
window.__why = []; window.__asked = 0;
addEventListener('error', function (e) { window.__why.push(String(e.message || e)); });
/* The stub has to survive the page's own scripts replacing window.fetch.

   A plain assignment here was overwritten the moment firebase-adapter.js took
   over -- the adapter is the platform's own fetch, and it went to Firestore for a
   document the rehearsal has no way to reach, caught the failure and answered
   "open". The door was then read as open, correctly, from an answer the page had
   manufactured itself. Measuring a notice behind a door that was never shut
   measures nothing.

   So window.fetch is given a setter: whatever is assigned to it afterwards is wrapped,
   and the door's answer still comes from here. */
(function () {
  var inner = function (url, init) {
    if (String(url) === '/api/registration') {
      window.__asked++;
      return Promise.resolve({ ok: true, json: async () => ({ open: false, note: '' }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  };
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    get: function () { return inner; },
    set: function (f) {
      var was = f;
      inner = function (url, init) {
        if (String(url) === '/api/registration') {
          window.__asked++;
          return Promise.resolve({ ok: true, json: async () => ({ open: false, note: '' }) });
        }
        try { return was.apply(this, arguments); }
        catch (e) { return Promise.reject(e); }
      };
    }
  });
})();
function measureIt(doc) {
  /* It answers with a string and the shell writes it down. It used to write the
     answer into a second element with the same id inside the frame, and the dump
     then contained two of them -- an empty one and a full one -- and the reader
     took whichever came first. An answer that is written into the wrong element
     reads exactly like no answer at all. */
  var answer = '';
  try {
      var vw = doc.defaultView.innerWidth, vh = doc.defaultView.innerHeight;
      var notice = doc.querySelector('.door-closed-page');
      var out = { vw: vw, vh: vh, why: window.__why, asked: window.__asked, ready: doc.readyState };
      var form = doc.getElementById('reg-form');
      out.formHidden = !!(form && (form.hidden || getComputedStyle(form).display === 'none'));
      out.title = document.title;
      var skipEl = doc.querySelector('.skip');
      out.skipHref = skipEl ? skipEl.getAttribute('href') : null;
      if (!notice) {
        out.missing = true;
      } else {
        var r = notice.getBoundingClientRect();
        out.w = Math.round(r.width); out.h = Math.round(r.height);
        out.fitsWidth = r.width <= vw + 1;
        out.pageScrolls = doc.documentElement.scrollWidth > vw + 1;
        var warn = doc.querySelector('.door-warn');
        var ribbon = doc.querySelector('.door-ribbon');
        out.warnTop = warn ? Math.round(warn.getBoundingClientRect().top + window.scrollY) : null;
        out.warnBottom = warn ? Math.round(warn.getBoundingClientRect().bottom + window.scrollY) : null;
        out.ribbonH = ribbon ? Math.round(ribbon.getBoundingClientRect().height) : 0;
        var cut = [];
        var all = doc.querySelectorAll('.door-closed-page h1,.door-closed-page p,.door-closed-page span');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (el.scrollWidth > el.clientWidth + 1) cut.push((el.textContent || '').trim().slice(0, 44));
          if (el.scrollHeight > el.clientHeight + 1) cut.push('(tall) ' + (el.textContent || '').trim().slice(0, 44));
        }

        /* Clipped by an ancestor, which the line above cannot see.

           A box that is too small for its text is one kind of cut. The other is
           text that fits its own box perfectly and is then cut by something above
           it -- and this notice carries overflow:hidden on its card, so that is
           what actually happens: the notice stayed 328px wide and reported itself
           as fitting, while the lines inside it ran 1400px wide and vanished at
           the card's edge. The page scrolls nowhere, so there was nothing else to
           catch it either.

           So every piece of text is compared with the card it has to stay inside.
           A person does not care which box did the cutting. */
        var clipped = [];
        var box = notice.getBoundingClientRect();
        for (var j = 0; j < all.length; j++) {
          var q = all[j], g = q.getBoundingClientRect();
          if (g.width === 0) continue;
          if (g.left < box.left - 1 || g.right > box.right + 1) {
            clipped.push((q.textContent || '').trim().slice(0, 44));
          }
        }
        out.cut = cut;
        out.clipped = clipped;
        out.warnAboveFold = out.warnTop !== null && out.warnTop < vh;
        var text = notice.textContent || '';
        out.hasClosure = text.indexOf('غلق باب التسجيلات') !== -1;
        out.hasPhotoRule = text.indexOf('الصور الشمسية الرسمية فقط') !== -1;
        out.hasConsequence = text.indexOf('تجميد أي اشتراك') !== -1;
        out.hasClub = text.indexOf('إدارة نادي الصدارة للسباحة') !== -1;
      }
      answer = JSON.stringify(out);
  } catch (e) {
    answer = JSON.stringify({ error: String((e && e.message) || e), why: window.__why });
  }
  return answer;
}
window.__measure = measureIt;
</script>`;

const SIZES = [
  { label: 'phone  360×740', w: 360, h: 740, phone: true },
  { label: 'desk  1280×900', w: 1280, h: 900, phone: false }
];

const SCRATCH = path.join(process.env.TEMP || '.', 'sadara-notice-rehearsal');
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(path.join(SCRATCH, 'istimara'), { recursive: true });

/* The club's page, with the one line in it. Nothing else is touched: not the
   stylesheet, not the markup, not the page's own code. */
const realHtml = fs.readFileSync(path.join(PUBLIC, 'istimara', 'index.html'), 'utf8');
fs.writeFileSync(path.join(SCRATCH, 'inner.html'),
  realHtml.replace('</head>', STUB + '\n</head>'), 'utf8');

/* The page is put in a frame of the size being claimed, because Chrome would not
   give it one: asked for a 360px window it drew at 500px, which is the narrowest
   it will do here, and every reading of the notice was then true of a screen no
   phone in Algeria has. A frame is not a decoration -- the page's own media
   queries are answered by the frame's width, so the phone case exercises the
   phone rules rather than describing them.

   The frame is same-origin and the measurement happens inside it, so what is
   measured is the real page and not a copy of it. */
/* Written afresh for each size, because a shell written once measured every size
   at the size it was written with -- and the desk case was reported as a 360px
   phone. */
function writeShell(w, h) {
fs.writeFileSync(path.join(SCRATCH, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}'
  + 'iframe{border:0;display:block}</style></head><body>'
  + '<iframe id="f" src="/inner.html" width="' + w + '" height="' + h + '"></iframe>'
  + '<pre id="notice-report" style="display:none"></pre>'
  + '<script>document.getElementById("f").addEventListener("load", function () {'
  + 'setTimeout(function () { try { var f = document.getElementById("f"); document.getElementById("notice-report").textContent = f.contentWindow.__measure(f.contentDocument); }'
  + 'catch (e) { document.getElementById("notice-report").textContent = JSON.stringify({ error: String((e && e.message) || e) }); }'
  + '}, 700); });</script></body></html>', 'utf8');
}
fs.copyFileSync(path.join(PUBLIC, 'istimara', 'index.html'), path.join(SCRATCH, 'istimara', 'index.html'));
/* The page's own scripts are named without a folder -- `src="istimara.js"` -- so it
   asks for them at the root of wherever it is served from, and asks for the
   stylesheet as `istimara.css` beside itself.

   They were laid out in a folder instead, and the page asked for all of them at
   the root and got a 404 for every one. A 404 on a script is not an error the page
   reports: the page simply never started, and the check said the announcement was
   missing -- which is what a page whose scripts failed to load looks like, and not
   what a page with a fault in the announcement looks like. Both files are laid out
   where the page actually looks for them. */
for (const f of ['istimara.js', 'istimara.css', 'algeria.js', 'communes.json',
  'datepicker.js', 'print.js']) {
  const src = path.join(PUBLIC, 'istimara', f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(SCRATCH, f));
    fs.copyFileSync(src, path.join(SCRATCH, 'istimara', f));
  }
}
fs.cpSync(path.join(PUBLIC, 'assets'), path.join(SCRATCH, 'assets'), { recursive: true });
fs.cpSync(path.join(PUBLIC, 'firebase-config.js'), path.join(SCRATCH, 'firebase-config.js'));
fs.cpSync(path.join(PUBLIC, 'firebase-adapter.js'), path.join(SCRATCH, 'firebase-adapter.js'));

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(SCRATCH, rel === '/' ? 'index.html' : rel.replace(/^\/+/, ''));
  if (!file.startsWith(SCRATCH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8'
    : ext === '.js' ? 'text/javascript; charset=utf-8'
    : ext === '.css' ? 'text/css; charset=utf-8'
    : ext === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

function run(size, done) {
  const port = server.address().port;
  const dump = path.join(SCRATCH, `dump-${size.w}.html`);
  const shot = path.join(SCRATCH, `notice-${size.w}.png`);
  writeShell(size.w, size.h);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--disable-background-networking', '--disable-sync', '--no-first-run',
    '--virtual-time-budget=9000',
    `--user-data-dir=${path.join(SCRATCH, 'profile' + size.w)}`,
    `--window-size=${size.w},${size.h}`,
    `--screenshot=${shot}`,
    '--dump-dom', `http://127.0.0.1:${port}/`
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let out = '';
  chrome.stdout.on('data', d => { out += d; });
  chrome.on('close', () => {
    fs.writeFileSync(dump, out, 'utf8');
    const m = out.match(/<pre id="notice-report"[^>]*>([\s\S]*?)<\/pre>/);
    if (!m) { problems.push(size.label + ': the page produced no answer at all -- it did not finish drawing'); return done(); }
    let row;
    try {
      row = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    } catch (e) { problems.push(size.label + ': the answer is not readable: ' + e.message); return done(); }

    if (row.error) { problems.push(size.label + ': measuring the notice threw: ' + row.error); return done(); }
    if ((row.why || []).length) {
      problems.push(size.label + ': the page itself reported: ' + row.why.slice(0, 3).join(' | '));
    }
    if (row.missing) {
      problems.push(size.label + ': the announcement is not on the page when the door is shut [asked=' + row.asked + ' ready=' + row.ready + ' scripts=' + row.scripts + ']'
        + ' (the page answered, so the door was read and the notice was still not drawn)');
      return done();
    }
    if (!row.formHidden) problems.push(size.label + ': the form is still on the page. It must be gone, not greyed -- a greyed form is a form somebody fills in and is then told about.');
    if (!row.fitsWidth) problems.push(size.label + ': the notice is ' + row.w + 'px wide in a ' + row.vw + 'px window');
    if (row.pageScrolls) problems.push(size.label + ': the page scrolls sideways');
    if ((row.cut || []).length) problems.push(size.label + ': ' + row.cut.length + ' piece(s) of the notice do not fit their box: ' + row.cut.slice(0, 3).join(' | '));
    if ((row.clipped || []).length) problems.push(size.label + ': ' + row.clipped.length + ' line(s) of the notice run outside the card and are cut off at its edge: ' + row.clipped.slice(0, 3).join(' | '));
    if (size.phone && row.warnAboveFold === false) {
      problems.push(size.label + ': the photograph warning begins at ' + row.warnTop + 'px, below the ' + row.vh
        + 'px screen -- the one part with a deadline in it is the part a family misses');
    }
    if (!row.hasClosure) problems.push(size.label + ': the notice does not say the season is closed');
    if (!row.hasPhotoRule) problems.push(size.label + ': the notice does not say the photograph must be an official one');
    if (!row.hasConsequence) problems.push(size.label + ': the notice does not say a subscription is suspended');
    if (!row.hasClub) problems.push(size.label + ': the notice is not signed by the club');
    if (!/مغلقة/.test(String(row.title))) {
      problems.push(size.label + ': the tab still says "' + row.title + '" -- it describes a form the visitor is not looking at');
    }
    if (row.skipHref !== '#door-title') {
      problems.push(size.label + ': the skip link still jumps to "' + row.skipHref + '", which is not on the page any more');
    }
    /* The window it was actually given, said out loud.

       `--window-size` was not honoured -- the page was drawn 589px wide under a
       label that said 360 -- and every measurement below was then true of a
       screen nobody reads this on, while the run reported the phone case as
       passed. A check that cannot tell whether it is looking at the thing it was
       sent to look at is a check about the wrong thing, however green it is. */
    if (Math.abs(row.vw - size.w) > 40) {
      problems.push(size.label + ': the window was ' + row.vw + '×' + row.vh
        + 'px, not ' + size.w + '×' + size.h
        + 'px -- what was measured is not the screen it claims to be');
    }
    say.push('  ' + size.label + '  window ' + row.vw + '×' + row.vh + 'px · notice '
      + row.w + '×' + row.h + 'px · ribbon ' + row.ribbonH
      + 'px · warning at ' + row.warnTop + 'px'
      + (row.warnAboveFold ? ' (above the fold)' : ''));
    done();
  });
}

server.listen(0, '127.0.0.1', () => {
  let i = 0;
  (function next() {
    if (i >= SIZES.length) {
      if (say.length) { console.log(''); say.forEach(s => console.log(s)); }
      if (problems.length) {
        console.log('\nNOTICE PROBLEMS (' + problems.length + '):');
        problems.forEach(p => console.log('  - ' + p));
        process.exit(1);
      }
      console.log('\nThe announcement stands in the door: the form is gone, both halves of the notice '
        + 'are in it, the photograph warning is above the fold on a phone, and nothing is cut.');
      return process.exit(0);
    }
    run(SIZES[i++], next);
  })();
});