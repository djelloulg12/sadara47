/**
 * The public registration page in /istimara/.
 *
 * It is a second way into the same data, so three things have to hold:
 *   * it posts what the platform's management screen already reads
 *   * it needs no account, which firestore.rules already allows
 *   * the card it prints is measured from the same geometry as the
 *     platform's, so the club reads both the same way
 *
 * Runs against firebase-public/istimara/, because that is the tree
 * Firebase serves.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUB = path.join(ROOT, 'firebase-public');
const FOLDER = path.join(PUB, 'istimara');
const errors = [];
/* What the club reads: Latin digits, with anything that arrives in
   Arabic-Indic folded, because that is what the page does before it prints.
   Built from the value rather than typed out -- three sets of digits that all look
   the same is how an expectation ends up the wrong length and the check blames
   the sheet. */
function clubShows(v) {
  return Array.from(String(v)).map(c => {
    const p = c.codePointAt(0);
    return (p >= 0x0660 && p <= 0x0669) ? String(p - 0x0660) : c;
  }).join('');
}

/* Checks that need the page to settle run in order at the end, so none of them
   is skipped by an earlier one returning. */
const tasks = [];

const HTML = fs.readFileSync(path.join(FOLDER, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(FOLDER, 'istimara.css'), 'utf8');
const PAGE = fs.readFileSync(path.join(FOLDER, 'istimara.js'), 'utf8');
const PRINT = fs.readFileSync(path.join(FOLDER, 'print.js'), 'utf8');
const CALENDAR = fs.readFileSync(path.join(FOLDER, 'datepicker.js'), 'utf8');
const ALGERIA = fs.readFileSync(path.join(FOLDER, 'algeria.js'), 'utf8');
const COMMUNES = fs.readFileSync(path.join(FOLDER, 'communes.json'), 'utf8');
const APP = fs.readFileSync(path.join(PUB, 'app.js'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

/* Amounts are printed with toLocaleString, which puts a comma or a narrow
   space between the thousands depending on the runtime, so compare on digits
   alone. */
const digits = s => String(s).replace(/[\s\u00a0\u202f\u2009,]/g, '');

/* The smallest thing that is an image. What is being asked of a request is that a
   photograph is on it, not that one decodes -- a check that proved the second
   would be testing the browser. */
const TINY_PHOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const isAmount = (text, want) => digits(text).indexOf(String(want)) !== -1;

/* The wilaya used wherever a check has to choose a place of birth: the first with
   any communes at all. The commune itself is always taken from the list the page
   offers, because a value the list does not carry is silently dropped and the
   field comes back empty with nothing to say why. */
const COMMUNES_BY_WILAYA = JSON.parse(COMMUNES);
const WILAYA_LIST = JSON.parse(ALGERIA.slice(ALGERIA.indexOf('=') + 1, ALGERIA.lastIndexOf(';')));
const A_WILAYA = WILAYA_LIST.find(x => (COMMUNES_BY_WILAYA[x.code] || []).length > 0);

/* ---- 1) the folder is self-contained ---- */
{
  for (const f of ['index.html', 'istimara.css', 'istimara.js', 'print.js']) {
    if (!fs.existsSync(path.join(FOLDER, f))) errors.push('[tree] missing ' + f + ' in firebase-public/istimara');
  }
  if (!/href="istimara\.css"/.test(HTML)) errors.push('[tree] the page does not load its own stylesheet');
  if (!/src="istimara\.js"/.test(HTML)) errors.push('[tree] the page does not load its own script');
  if (!/src="print\.js"/.test(HTML)) errors.push('[tree] the print engine is not loaded');
  /* It shares the project's Firebase config and adapter -- one API contract --
     but it must not pull in the platform shell, which needs a session. */
  if (!/src="\/firebase-adapter\.js"/.test(HTML)) errors.push('[tree] the page bypasses the shared adapter');
  if (/src="app\.js"/.test(HTML)) errors.push('[tree] the page loads the platform shell');
  /* The page opens an account for the person filling it in -- that is what the
     club asked for, and the request is filed under it. What it must never do is
     act on a session that belongs to somebody else: this is a public page, and a
     page that picked up a stranger's session would show it to them.

     A guardian coming back for a second child has to be recognised, so a session
     is read -- through one door, and only when the account's own address is the
     one that was typed. That is the guarantee, and it is counted rather than
     trusted: exactly one place in the page may touch the session at all. */
  const sessionDoor = PAGE.match(/function openAccountFor\([\s\S]*?\n  \}/);
  if (!sessionDoor) {
    errors.push('[tree] the public page has no door a session is read through');
  } else {
    if (!/currentUser/.test(sessionDoor[0])) {
      errors.push('[tree] the door does not look at the session at all');
    }
    /* The comparison is the whole point: without it the page is whoever happens
       to be signed in on this browser, which is the thing being prevented. */
    if (!/at !== mine|said !== mine/.test(sessionDoor[0])) {
      errors.push('[tree] the door does not compare the address with the one typed');
    }
    const readers = (PAGE.match(/currentUser/g) || []).length;
    const inDoor = (sessionDoor[0].match(/currentUser/g) || []).length;
    if (readers !== inDoor) {
      errors.push('[tree] the page reads a session in ' + (readers - inDoor)
        + ' place(s) besides the one door, and a public page must not');
    }
  }
  /* Signing in is how a person proves an account is theirs, so it always carries
     the password they typed. A route into an account without one is the thing to
     look for. */
  const signsIn = PAGE.match(/signInWithEmailAndPassword\(([^)]*)\)/g) || [];
  if (!signsIn.length) {
    errors.push('[tree] an account cannot be returned to at all');
  }
  for (const call of signsIn) {
    if (!/password/.test(call)) {
      errors.push('[tree] the page signs in without asking for a password: ' + call);
    }
  }
  /* Nothing on this page listens for the session. The account is opened by the
     person asking for it, with a password; a page that subscribed would pick up
     whoever was signed in on this browser, which is the one risk with no visible
     trace if it happens. What that session's profile carries is checked where it
     can be seen -- by looking at the page afterwards. */
  if (/onAuthStateChanged/.test(PAGE)) {
    errors.push('[tree] the public page listens for a session rather than opening its own');
  }
  if (!/createUserWithEmailAndPassword/.test(PAGE)) {
    errors.push('[tree] the page asks for a password and never makes an account of it');
  }
  /* A password is offered to the provider and to nobody else: not to the
     request, and not to the draft kept on the device. */
  if (/password[^\n]*:\s*val\(/i.test(PAGE) && !/node\.type === 'password'\) return/.test(PAGE)) {
    errors.push('[tree] the saved draft would keep the password');
  }
  /* Relative links break the moment the page is opened from another path, and a
     root-absolute one has to exist in the deployable tree too. */
  for (const m of HTML.matchAll(/(?:href|src)="(?!https?:|\/\/|#|data:|mailto:)([^"]+)"/g)) {
    const ref = m[1].split('?')[0];
    const abs = ref.startsWith('/') ? path.join(PUB, ref) : path.resolve(FOLDER, ref);
    if (!fs.existsSync(abs)) errors.push('[tree] the page points at a file that is not there: ' + ref);
  }
  if (!/<html[^>]*lang="ar"[^>]*dir="rtl"/.test(HTML)) errors.push('[tree] the page is not Arabic right-to-left');
  if (!/name="viewport"/.test(HTML)) errors.push('[tree] no viewport: it would zoom on a phone');
  if (!/rel="canonical"/.test(HTML)) errors.push('[tree] no canonical url for the page');
  /* The card is drawn from an absolute path, because this page lives one
     folder down from the platform's assets. */
  if (!/FORM_BG\s*=\s*'\/assets\/form-registration-01\.jpg'/.test(PRINT)) {
    errors.push('[tree] the card image is not addressed from the site root');
  }
}


/* ---- every field is as wide as its row ---- */
{
  const w = boot();
  /* jsdom lays nothing out, so the numbers cannot be measured here. What can be
     checked is the rule they come from: that it exists, that it is the general
     one, and that nothing has quietly gone back to naming input types. */
  const GENERAL = /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*,[\s\S]{0,120}?\{[^}]*width:\s*100%/;
  if (!GENERAL.test(CSS)) {
    errors.push('[width] no rule gives a field the width of its row');
  }
  /* Naming the types is the mistake: the address and the password were left off
     the list and came out 177px beside a 353px neighbour, and nothing about that
     looks broken -- it looks like a field. */
  if (/input\[type=[a-z]+\][^{]*\{[^}]*\bwidth:/.test(CSS)) {
    errors.push('[width] a field width is given by type name again');
  }
  /* Every input on the page is either one of the two the rule leaves alone, or
     something it covers. A type nobody thought about is a field sized by the
     browser, and that is the whole of the fault this check exists for. */
  const ALONE = new Set(['checkbox', 'radio', 'file']);
  for (const kind of new Set([...w.document.querySelectorAll('input')]
    .map(n => (n.getAttribute('type') || 'text').toLowerCase()))) {
    if (!ALONE.has(kind)) continue;
    if (kind !== 'file') continue;
    /* The photo picker is behind the button labelled «اختيار صورة» and is never
       shown; it is here because a label cannot open a file dialog on its own on
       every browser. */
    if (!w.document.getElementById('photo')) {
      errors.push('[width] the photo picker is gone from the page');
    }
  }
  /* The account rows are the only ones that close up, so they are the only ones
     that must not be a fixed two-column grid: a grid keeps the half of the row
     that a field has left. */
  const acct = CSS.indexOf('.acct-fields .row.two');
  if (acct === -1 || !/flex-wrap:\s*wrap/.test(CSS.slice(acct, acct + 120))) {
    errors.push('[width] the account rows cannot close up when a field leaves');
  }
}

/* ---- 2) the printed geometry is the platform's, not a second copy that drifts ---- */
{
  const spots = src => {
    const block = (src.match(/(?:const|var) FORM_SPOTS = \[([\s\S]*?)\n\s*\];/) || [])[1] || '';
    return [...block.matchAll(/\{\s*id:\s*'([^']+)',\s*y:\s*([\d.]+),\s*x0:\s*([\d.]+),\s*colon:\s*([\d.]+)\s*\}/g)]
      .map(m => ({ id: m[1], y: Number(m[2]), x0: Number(m[3]), colon: Number(m[4]) }));
  };
  const mine = spots(PRINT);
  const theirs = spots(APP);
  if (!theirs.length) errors.push('[drift] could not read FORM_SPOTS out of app.js');
  if (mine.length !== theirs.length) {
    errors.push(`[drift] the form has ${mine.length} spots, the platform has ${theirs.length}`);
  }
  for (let i = 0; i < Math.min(mine.length, theirs.length); i++) {
    const a = mine[i], b = theirs[i];
    if (a.id !== b.id) { errors.push(`[drift] spot ${i} is "${a.id}" here and "${b.id}" on the platform`); continue; }
    for (const k of ['y', 'x0', 'colon']) {
      if (Math.abs(a[k] - b[k]) > 0.001) {
        errors.push(`[drift] ${a.id}.${k} is ${a[k]} here and ${b[k]} on the platform`);
      }
    }
  }
  /* The geometry is not the only thing that has to agree.

     The two copies also decide what goes in each box, and they decide it in two
     separate `formValues`. The club corrected this mapping in both directions
     over two seasons, and the two copies were corrected separately -- one of them
     first, the other after somebody printed a sheet and read it. Comparing the
     numbers alone would have called that pair identical.

     So the key is compared as well: for every spot, the field it reads. A spot
     that prints `birth_date` on one side and `guardian_birth_date` on the other is
     the same sheet saying two things, and this is where it is caught. */
  const reads = src => {
    const fn = (src.match(/function\s+formValues\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
    const out = {};
    /* Up to a comma, a line break or a fallback -- the value of one key may run
       over three lines, and only its first field is what decides what the box
       reads. */
    for (const m of fn.matchAll(/(\w+)\s*:\s*([^,\n]+?)(?=,|\n|$)/g)) {
      const v = m[2].trim();
      const field = v.match(/v\('(\w+)'\)/) || v.match(/a\s*&&\s*a\.(\w+)/) || v.match(/rec\.(\w+)/);
      if (field) out[m[1]] = field[1];
    }
    return out;
  };
  const whoReads = reads(PRINT), whoReadsThere = reads(APP);
  if (!Object.keys(whoReads).length || !Object.keys(whoReadsThere).length) {
    errors.push('[drift] could not read what each copy puts in the boxes');
  }
  for (const spot of mine.map(s => s.id)) {
    if (!(spot in whoReads) || !(spot in whoReadsThere)) {
      errors.push('[drift] ' + spot + ' is filled from a field in one copy only');
      continue;
    }
    if (whoReads[spot] !== whoReadsThere[spot]) {
      errors.push('[drift] ' + spot + ' is filled from ' + whoReadsThere[spot]
        + ' on the platform and from ' + whoReads[spot] + ' on the public form');
    }
  }

  const box = src => {
    const m = src.match(/PHOTO_BOX\s*=\s*\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*w:\s*([\d.]+),\s*h:\s*([\d.]+)\s*\}/);
    return m ? m.slice(1, 5).map(Number) : null;
  };
  const a = box(PRINT), b = box(APP);
  if (!a || !b) errors.push('[drift] the photo frame could not be read from one of the two');
  else if (a.some((v, i) => Math.abs(v - b[i]) > 0.001)) {
    errors.push('[drift] the photo frame drifted: ' + a.join(',') + ' vs ' + b.join(','));
  }
  for (const key of ['SPOT_GAP', 'SPOT_CLEAR']) {
    const one = (PRINT.match(new RegExp(key + '\\s*=\\s*([\\d.]+)')) || [])[1];
    const two = (APP.match(new RegExp(key + '\\s*=\\s*([\\d.]+)')) || [])[1];
    if (!one || !two) errors.push('[drift] ' + key + ' is missing from one of the two');
    else if (Number(one) !== Number(two)) errors.push(`[drift] ${key} is ${one} here and ${two} on the platform`);
  }
}

/* ---- boot the page ---- */
function boot(seedDraft) {
  const bare = HTML.replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(bare, {
    url: 'http://127.0.0.1:4173/istimara/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.__calls = [];
  w.__frames = [];
  w.__p = 0;
  /* Overridable so a test can rename the pools and watch the form follow. */
  w.__facilities = [
    { id: 'olympic', name: 'المسبح الاختيارمبي' }, { id: 'half', name: 'المسبح النصف أولمبي' },
    { id: 'stadium', name: 'الملعب البلدي' }, { id: 'forest', name: 'غابة غرداية' }
  ];
  w.fetch = function (url, init) {
    w.__calls.push({ url: String(url), method: (init && init.method || 'GET').toUpperCase(), body: init && init.body });
    if (/facilities/.test(String(url))) {
      return Promise.resolve({ ok: true, json: async () => w.__facilities });
    }
    if (/subscription-plans/.test(String(url))) {
      return Promise.resolve({ ok: true, json: async () => ({
        plans: [{ code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
                { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' }],
        extras: { transport: 900, uniform: 2500 }
      }) });
    }
    if (/communes\.json/.test(String(url))) {
      /* The real file, so the counts the page offers are the counts it ships. */
      if (w.__communesFail) return Promise.resolve({ ok: false, status: 503 });
      return Promise.resolve({ ok: true, json: async () => JSON.parse(COMMUNES) });
    }
    return Promise.resolve({
      ok: true, json: async () => ({ ok: true, application_no: 'APP-20260101-AB12', expected_amount: 4400 })
    });
  };
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.alert = () => {};
  w.print = () => { w.__p += 1; };
  /* jsdom has no layout, so it does not implement scrollIntoView. Browsers all
     do; stubbing it keeps the test measuring the page rather than the runner. */
  w.Element.prototype.scrollIntoView = function () {};
  w.Element.prototype.focus = w.Element.prototype.focus || function () {};

  /* printRegistration writes into a same-origin iframe. jsdom gives a real one
     but no layout, so hand it a document stub instead of waiting on images. */
  const realAppend = w.document.body.appendChild.bind(w.document.body);
  w.document.body.appendChild = function (node) {
    if (node && node.tagName === 'IFRAME') {
      Object.defineProperty(node, 'contentWindow', {
        configurable: true,
        value: {
          print: () => { w.__p += 1; },
          focus() {},
          document: { images: [], open() {}, write() {}, close() {} }
        }
      });
      w.__frames.push(node);
    }
    return realAppend(node);
  };

  w.localStorage.clear();
  if (seedDraft) w.localStorage.setItem('sadara-istimara-draft', seedDraft);

  /* jsdom has no canvas and does not decode images, so the photo path is given
     the three browser APIs it needs. toDataURL honours __photoSize, which is how
     a test asks for a picture light enough to keep or heavy enough to drop. */
  w.__photoSize = 40 * 1024;
  const realCreate = w.document.createElement.bind(w.document);
  w.document.createElement = function (tag) {
    if (String(tag).toLowerCase() === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: function () { return { fillStyle: '', fillRect() {}, drawImage() {} }; },
        toDataURL: function () {
          return 'data:image/jpeg;base64,' + 'A'.repeat(Math.max(16, Math.floor(w.__photoSize)));
        }
      };
    }
    return realCreate(tag);
  };
  w.FileReader = function () {
    const self = this;
    this.readAsDataURL = function () {
      setTimeout(function () { self.result = 'data:image/jpeg;base64,AAAA'; if (self.onload) self.onload(); }, 0);
    };
  };
  w.Image = function () {
    const self = this;
    Object.defineProperty(this, 'src', {
      set: function () { setTimeout(function () { self.width = 900; self.height = 1200; if (self.onload) self.onload(); }, 0); },
      get: function () { return ''; }
    });
  };

  w.eval(PRINT);
  /* The calendar is loaded by the page, so the harness loads it too, in the same
     place -- a script the harness cannot see is a script every question about it
     answers "not there", which is a true answer to a false question. */
  w.eval(CALENDAR);
  /* The wilaya list is a separate file the page loads before itself, so it is
     loaded here too -- evaluating the page without it would leave the field
     empty and every check about it would pass for the wrong reason. */
  w.eval(ALGERIA);
  w.eval(PAGE);
  return w;
}

/* The form cannot be filled until a pool is chosen, so every check that means to
   send a request chooses one first -- through the gate, the way a person does,
   rather than by writing the hidden field. Writing the field would let these
   checks pass on a gate that had been removed, which is the fault they exist to
   catch, and it cost this suite a failure before the point was noticed.

   The pool is the one already in step four when the gate offers it, so the rest
   of each check sees what its own `answerEverything` chose. The fallback is the
   gate's first option, which once the club's list arrives is the club's first
   pool -- never a name written here, which would be a pool the club may not
   have. */
function passTheGate(w) {
  const gate = w.document.getElementById('pool-gate');
  if (!gate || gate.hidden) return;
  const wanted = (w.document.getElementById('facility') || {}).value || '';
  const radios = [...w.document.querySelectorAll('#pool-gate-pools input[type=radio]')];
  if (!radios.length) return;
  const radio = radios.find(r => r.value === wanted) || radios[0];
  radio.checked = true;
  radio.dispatchEvent(new w.Event('change', { bubbles: true }));
  const go = w.document.getElementById('pool-gate-go');
  if (go) go.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  if (!w.document.getElementById('pool-gate').hidden) {
    errors.push('[gate] the gate did not open after a pool was chosen, so this check '
      + 'would pass for the wrong reason if it went on to ask about anything else');
  }
}

/* Picks a photo the way the person would, through the real file input. */
function choosePhoto(w, bytes) {
  /* The small photograph every other check carries is taken away first. Waiting
     for a photograph to appear cannot tell this one from that one -- and while it
     could, the wait was answered by the one already there, and the record went
     out with a photograph of a different size than the one under test. */
  w.SADARA_FORM.setPhoto('');
  w.__photoSize = bytes;
  const input = w.document.getElementById('photo');
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'photo.jpg', type: 'image/jpeg' }] });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  return waitFor(w, () => !!w.document.querySelector('#photo-preview img')
    || !!w.document.getElementById('form-msg').textContent);
}

/* Waits for something to become true instead of guessing how long it takes. A
   fixed sleep passes on an idle machine and fails when the whole suite is
   running, which is how a working page came to be reported as broken. */
function waitFor(w, predicate, ms) {
  const limit = ms === undefined ? 4000 : ms;
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      let ok = false;
      try { ok = predicate(); } catch (e) { ok = false; }
      if (ok) return resolve(true);
      if (Date.now() - started > limit) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

/* ---- the club's digits: Arabic on the page, Latin in the database ----
   Typed by hand and laid out as 1998/03/07; stored as 1998-03-07. Everything
   below is the same date written down in more than one way, because that is what
   has to give one answer. */
tasks.push(() => {
  const w = boot();
  /* The club's digits, and the digits somebody may type in. Both come out the
     same, which is the whole point: a number quoted over a counter in one set and
     looked up in the other is a number nobody can find. Built rather than typed
     out -- two sets that look the same on screen is how an expectation ends up the
     wrong length and the check blames the page. */
  const typed = s => Array.from(String(s)).map(c =>
    (c >= '0' && c <= '9') ? String.fromCodePoint(0x0660 + Number(c)) : c).join('');
  const field = id => w.document.getElementById(id);
  const type = (id, v) => {
    /* Set the value and fire the event the same way a keystroke does: the folding
       listens for input, so setting value alone would prove nothing. */
    field(id).value = v;
    field(id).dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  /* The date in the order the club writes it: the day first. Defined once and used
     in five places, so it is changed here and nowhere else. */
  const SHOWN = '07/03/1998';

  /* Typed either way, it reads as the club writes it. */
  for (const [what, entered, shown] of [
    ['a national number typed in Latin', '198501011', '198501011'],
    ['a national number typed in Arabic-Indic', typed('198501011'), '198501011'],
    ['a telephone typed in Arabic-Indic', typed('0661 00 00 01'), '0661 00 00 01']
  ]) {
    const into = what.indexOf('national') === 0 ? 'national_id' : 'phone';
    type(into, entered);
    if (field(into).value !== shown) {
      errors.push('[digits] ' + what + ' reads as ' + field(into).value + ', not ' + shown);
    }
  }

  /* A date stays as it is typed while the first part is still being typed -- taking
     the slashes away under the caret moves it out from under the person -- and is
     laid out in the club's order the moment there is enough of one to be one.

     The club's order is the day first. The form used to ask for year first while
     the calendar wrote day first, so the form rejected the output of its own
     calendar and told the person to type a shape that every other screen in the
     club contradicts. That was a real fault and the person saw it as one.

     Both orders are *read*, and that is checked here too: a person with the old
     shape in front of them will type it -- it is on every older card and in every
     older record -- and refusing a date they meant is worse than reading it the way
     the club writes it. */
  type('birth_date', '19');
  if (field('birth_date').value !== '19') {
    errors.push('[date] a half-typed first part was re-laid out under the caret: ' + field('birth_date').value);
  }
  type('birth_date', '07031998');
  if (field('birth_date').value !== SHOWN) {
    errors.push('[date] a date typed as eight digits is not laid out as day/month/year: '
      + field('birth_date').value);
  }
  for (const entered of ['07/03/1998', '07-03/1998', '7/3/1998',
                         typed('7/3/1998'), typed('7-3-1998')]) {
    type('birth_date', entered);
    if (field('birth_date').value !== SHOWN) {
      errors.push('[date] a date typed as ' + entered + ' reads as ' + field('birth_date').value
        + ', not ' + SHOWN);
    }
  }
  /* The old order still reads. It has to: it is the shape on every card the club
     already holds, and somebody will type it. */
  for (const entered of ['1998/03/07', '1998-3-7', typed('1998/3/7')]) {
    type('birth_date', entered);
    if (field('birth_date').value !== SHOWN) {
      errors.push('[date] the old order is no longer read: ' + entered + ' reads as '
        + field('birth_date').value + ', not ' + SHOWN);
    }
  }

  /* What goes out is the one form the database holds. */
  fill(w, 'adult');
  type('birth_date', typed('1998/03/07'));
  type('national_id', typed('198501011'));
  type('phone', typed('0661000001'));
  passTheGate(w);
  field('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => !field('done').hidden || !!field('form-msg').textContent)
    .catch(() => errors.push('[store] nothing came back after sending'))
    .then(() => {
      const post = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
      if (post.length !== 1) {
        errors.push('[store] expected one post to /api/applications, got ' + post.length
          + (field('form-msg').textContent ? ' -- ' + field('form-msg').textContent : ''));
        return;
      }
      /* The harness records the body as it was handed to fetch, which is a string.
         Read as an object it would be a check that never runs. */
      const body = JSON.parse(post[0].body);
      const stored = {
        birth_date: '1998-03-07',
        national_id: '198501011',
        phone: '0661000001'
      };
      for (const [field2, want] of Object.entries(stored)) {
        if (body[field2] !== want) {
          errors.push('[store] ' + field2 + ' typed in Arabic digits was stored as '
            + JSON.stringify(body[field2]) + ' rather than ' + JSON.stringify(want));
        }
      }
      /* And what the person is shown back is the form the club reads. */
      const rows = field('done-summary').textContent;
      if (rows.indexOf(SHOWN) === -1) {
        errors.push('[store] the confirmation does not show the date as year/month/day: '
          + rows.slice(0, 160));
      }
    });
});

const posted = w => w.__calls.some(c => c.method === 'POST');

/* Everything the form asks of everybody, in one place.

   Three checks used to carry their own copy of this list, and each stopped on a
   field it had not been told about -- the symptom being a check failing about a
   field it was never testing. One list, four callers. */
function answerEverything(w, set) {
  set('first_name_ar', 'أمين');
  set('last_name_ar', 'بلعيد');
  set('first_name_fr', 'Amine');
  set('last_name_fr', 'Belaid');
  set('birth_date', '1994-05-04');
  set('gender', 'male');
  set('blood_group', 'O+');
  set('level', 'مبتدئ');
  set('birth_certificate_no', '1994-1234');
  set('phone', '0661000001');
  set('whatsapp', '0661000004');
  set('address', 'حي الثنية');
  set('payment_method', 'cash');
  set('notes', 'لا شيء');
  /* The pool, from the list the page offers -- for the same reason as the
     commune: a value the list does not carry is dropped and the field comes back
     empty, with nothing in between to say why. */
  const pool = w.document.getElementById('facility');
  if (pool && pool.options.length > 1) {
    pool.value = pool.options[1].value;
    pool.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
}

/* The guardian's fields, for a check that is registering a child. Same reason as
   the list above: two lists of "what a minor's form needs" is one field short of
   a check that fails about something it was not testing. */
function answerForAGuardian(w, set, over) {
  Object.assign(set, over || {});
  set('guardian_first_name', 'كريم');
  set('guardian_last_name', 'بلعيد');
  set('guardian_birth_date', '1978/06/02');
  set('guardian_relation', 'الأب');
  set('guardian_phone', '0661000002');
  set('guardian_national_id', '197809031');
  set('guardian_national_id_expiry', '2031/06/02');
  set('guardian_card_issued', '2021/06/02');
  if (w.document.getElementById('guardian_consent')) {
    w.document.getElementById('guardian_consent').checked = true;
  }
}

function fill(w, category) {
  const set = (id, v) => { const n = w.document.getElementById(id); n.value = v; };
  answerEverything(w, set);
  /* The national identity card. Nine digits, and the day it runs out. Asked of
     the two people who hold one and of nobody else: an adult, and the guardian
     of a minor. */
  if (category === 'adult') {
    set('national_id', '19850101'.slice(0, 8) + '1');
    set('national_id_expiry', '2031/04/17');
  } else {
    answerForAGuardian(w, set, { birth_place: '' });
  }
  /* The account fields, because a form that asks for a password does not send
     without one -- and every send check below goes through this. */
  /* A photograph. The club's card has a frame for it and the registration is not
     finished without one, so it is part of what a request has to carry -- and it
     is set through the page's own door, the one the file picker ends at. */
  w.SADARA_FORM.setPhoto(TINY_PHOTO);
  set('email', 'swimmer@example.com');
  set('username', 'swimmer.test');
  set('password', 'correct-horse');
  set('password_confirm', 'correct-horse');
  const radio = w.document.querySelector('input[name="category"][value="' + category + '"]');
  radio.checked = true;
  w.document.getElementById('terms').checked = true;
  /* The card fields follow the category, so they are re-synced after it is set. */
  radio.dispatchEvent(new w.Event('change', { bubbles: true }));

  /* The place of birth is a commune, and a commune is chosen from a wilaya's own
     list -- so the wilaya goes first and the commune after it. Setting the value
     directly would silently leave the field empty, because an option that is not
     on the list cannot be held by it. */
  const wilaya = w.document.getElementById('wilaya');
  const place = w.document.getElementById('birth_place');
  if (wilaya && place) {
    const book = JSON.parse(COMMUNES);
    const list = JSON.parse(ALGERIA.slice(ALGERIA.indexOf('=') + 1, ALGERIA.lastIndexOf(';')));
    const target = list.find(x => (book[x.code] || []).length > 0);
    wilaya.value = target.name;
    wilaya.dispatchEvent(new w.Event('change', { bubbles: true }));
    const commune = book[target.code][0];
    if (commune) { place.value = commune; place.dispatchEvent(new w.Event('change', { bubbles: true })); }
  }
  /* The pool is chosen by answerEverything. */
  const pool = w.document.getElementById('facility');
  if (pool) {
  }
  return radio;
}

/* ---- 3) a value lands after its colon, on blank paper ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const rec = {
    category: 'minor', application_no: 'APP-20260101-AB12',
    first_name_ar: 'جلول', last_name_ar: 'قندوز', birth_date: '2012-04-17',
    address: 'حي الثنية', blood_group: 'O+', phone: '0661000001',
    guardian_first_name: 'لخضر', guardian_last_name: 'قندوز',
    guardian_birth_date: '1985-02-03', guardian_national_id: '1970011122334',
    doctor_name: 'د. بن عمر', expected_amount: 4400
  };
  const sheet = F.overlaySheet(rec);
  const spots = [...sheet.matchAll(/class="f-spot" style="bottom:([\d.]+)mm;right:([\d.]+)mm;width:([\d.]+)mm"/g)];
  if (spots.length !== F.FORM_SPOTS.length) {
    errors.push('[card] a minor must print every box, got ' + spots.length + ' of ' + F.FORM_SPOTS.length);
  }
  if (/undefined|NaN/.test(sheet)) errors.push('[card] an overlay box has no position');
  F.FORM_SPOTS.forEach((g, i) => {
    const m = spots[i];
    if (!m) { errors.push('[card] no box for ' + g.id); return; }
    const bottom = Number(m[1]), right = Number(m[2]), width = Number(m[3]);
    const edge = 210 - right;                 // the box's right edge, from the page's left
    const left = edge - width;
    if (bottom <= 0 || bottom >= 297) errors.push('[card] ' + g.id + ' sits outside the page');
    if (Math.abs((297 - bottom) - (g.y + F.SPOT_CLEAR)) > 0.02) errors.push('[card] ' + g.id + ' is not sitting on its rule');
    if (edge > g.colon) errors.push('[card] ' + g.id + ' runs over the printed colon');
    if (edge < g.colon - 1.7 || edge > g.colon - 1.5) errors.push('[card] ' + g.id + ' is not tight against the colon');
    if (left < g.x0 - 0.02) errors.push('[card] ' + g.id + ' starts before its printed line');
  });
  if (!sheet.includes('جلول')) errors.push('[card] the given name is missing');
  if (!sheet.includes('2012/04/17')) errors.push('[card] the birth date is not year-first in Arabic digits: 2012/04/17');
  if (!sheet.includes('assets/form-registration-01.jpg')) errors.push('[card] the club scan is missing');
  if (!/class="f-photo"/.test(sheet)) errors.push('[card] the photo frame is missing');

  /* an adult has no guardian, and none of it may reach the paper */
  const adult = F.overlaySheet(Object.assign({}, rec, {
    category: 'adult', guardian_first_name: 'كريم', guardian_national_id: '1234567890'
  }));
  for (const leaked of ['كريم', '1234567890']) {
    if (adult.includes(leaked)) errors.push('[card] a guardian value reached an adult form: ' + leaked);
  }
  const guardians = F.FORM_SPOTS.filter(s => F.GUARDIAN_SPOT.test(s.id)).length;
  if ((adult.match(/class="f-spot"/g) || []).length !== F.FORM_SPOTS.length - guardians) {
    errors.push('[card] an adult printed the wrong number of boxes');
  }
}

/* ---- 4) the summary carries what the card cannot ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const rec = {
    category: 'minor', application_no: 'APP-20260101-AB12',
    first_name_ar: 'جلول', last_name_ar: 'قندوز', birth_date: '2012-04-17',
    gender: 'male', blood_group: 'O+', phone: '0661000001', whatsapp: '0661000002',
    address: 'حي الثنية', wilaya: 'غرداية', birth_place: 'غرداية', level: 'مبتدئ',
    swimming_strokes: 'حرة، ظهر', national_id: '20120417887',
    guardian_first_name: 'لخضر', guardian_last_name: 'قندوز', guardian_relation: 'أب',
    guardian_phone: '0661000003', guardian_national_id: '1970011122334', guardian_consent: true,
    doctor_name: 'د. بن عمر', doctor_specialty: 'طباعة رياضية', medical_date: '2025-09-01',
    facility: 'المسبح الاختيارمبي', subscription_code: 'season', plan_name: 'اشتراك موسمي',
    transport: true, uniform: true, transport_amount: 900, uniform_amount: 2500,
    payment_method: 'cash',
    notes: 'يفضّل التدريب صباحاً', expected_amount: 6400
  };
  const summary = F.summarySheet(rec);
  /* everything the applicant typed has to be readable on paper */
  for (const [key, what] of [
    [clubShows('APP-20260101-AB12'), 'رقم الطلب'], ['جلول', 'الاسم'], ['قندوز', 'اللقب'],
    ['2012/04/17', 'تاريخ الميلاد'], ['حي الثنية', 'العنوان'], ['O+', 'فصيلة الدم'],
    ['0661000001', 'الهاتف'], ['0661000002', 'الواتساب'], ['ذكر', 'الجنس'],
    ['حرة، ظهر', 'نمط السباحة'], ['20120417887', 'رقم التعريف'], ['المسبح الاختيارمبي', 'المسبح'],
    ['لخضر', 'الولي'], ['أب', 'القرابة'], ['0661000003', 'هاتف الولي'],
    ['1970011122334', 'تعريف الولي'], ['المسبح الاختيارمبي', 'المنشأة'],
    ['اشتراك موسمي', 'الاشتراك'], ['نقدًا', 'طريقة الدفع'],
    ['يفضّل التدريب صباحاً', 'الملاحظة']
  ]) {
    if (!summary.includes(key)) errors.push('[summary] ' + what + ' is not on the summary (' + key + ')');
  }
  /* The doctor is written in by hand, so nothing about him may be printed --
     and the line has to be there for the pen to land on. */
  for (const gone of ['د. بن عمر', 'طباعة رياضية', '2025-09-01', 'المصحة الجامعية']) {
    if (summary.includes(gone)) errors.push('[summary] the doctor is printed, but the club writes him by hand: ' + gone);
  }
  /* The three lines are drawn by .s-med i rather than by three empty table cells,
     so the count is read from the markup that draws them. */
  if ((summary.match(/<i><\/i>/g) || []).length < 3) {
    errors.push('[summary] no ruled line for the doctor to be written in by hand');
  }
  if (/doctor_|medical_date|medical_place/.test(PRINT.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    errors.push('[summary] the print still reads a doctor field off the record');
  }
  if (!isAmount(summary, '6400')) errors.push('[summary] the expected amount is not printed');
  /* An added option with no known price must not claim to be free. */
  if (!isAmount(summary, '900') || !isAmount(summary, '2500')) {
    errors.push('[summary] the extras are not priced on the summary');
  }
  /* Sections are numbered once each, in order, so the club can cite one. */
  const heads = [...summary.matchAll(/<h2>([^&]*)\s*&mdash;\s*([^<]+)<\/h2>/g)].map(m => m[1].trim());
  /* The step numbers, in the digits the form writes them in -- these are the
     sheet's own numbering, not a reading of anything. */
  if (heads.join(',') !== '\u0661,\u0662,\u0663,\u0664') {
    errors.push('[summary] the sections are numbered "' + heads.join(',') + '", expected 1,2,3,4');
  }
  if (/undefined|NaN/.test(summary)) errors.push('[summary] a section number came out undefined');
  /* the club has to be able to write on it, and the applicant has to sign */
  for (const need of ['توقيع الرياضي', 'إدارة النادي', 'رقم التسجيل', 'الختم']) {
    if (!summary.includes(need)) errors.push('[summary] no room for "' + need + '"');
  }
  if (!/dir="ltr"/.test(summary)) errors.push('[summary] a mixed-direction field has no ltr mark');
  if (/<script/.test(summary)) errors.push('[summary] the printed sheet carries a script');

  /* An adult has no guardian block, so the sections must close up rather than
     leave a number missing in the middle. */
  const grown = F.summarySheet(Object.assign({}, rec, { category: 'adult' }));
  const grownHeads = [...grown.matchAll(/<h2>([^&]*)\s*&mdash;\s*([^<]+)<\/h2>/g)].map(m => m[1].trim());
  if (grownHeads.join(',') !== '\u0661,\u0662,\u0663') {
    errors.push('[summary] an adult\'s sections are numbered "' + grownHeads.join(',') + '", expected 1,2,3');
  }
  if (/ولي الأمر/.test(grown)) errors.push('[summary] an adult was shown a guardian block');
}

/* ---- 5) the printed document: A4, and both sheets ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const doc = F.documentHTML({ application_no: 'APP-1', first_name_ar: 'أمين', last_name_ar: 'بلعيد' }, { hint: false });
  if ((doc.match(/class="f-page"/g) || []).length !== 1) errors.push('[print] the club card is not one page');
  if ((doc.match(/class="s-page"/g) || []).length !== 1) errors.push('[print] the summary is not one page');
  if (!doc.includes('<html lang="ar" dir="rtl">')) errors.push('[print] the printed document is not RTL');
  const css = F.printCSS();
  if (!/@page\{size:A4 portrait;margin:0\}/.test(css)) errors.push('[print] @page must be A4 with no margin');
  if (!/\.f-page\{[^}]*width:210mm;height:297mm/.test(css)) errors.push('[print] the card must be exactly A4');
  if (!/\.s-page\{[^}]*width:210mm/.test(css)) errors.push('[print] the summary must be A4 wide');
  if (!/object-fit:fill/.test(css)) errors.push('[print] the card scan must stretch to the page');
  if (!/Cairo/.test(css)) errors.push('[print] the Arabic webfont is not declared');
  if (!/background:transparent/.test(css)) errors.push('[print] an overlay box has a background');
  const spot = (css.split('.f-spot')[1] || '').split('}')[0];
  if (/border\s*:\s*(?!0|none)/.test(spot)) errors.push('[print] an overlay box draws a border over the club wording');
  if (!/page-break-after:always|break-after:page/.test(css)) errors.push('[print] the sheets can run together');
  /* The print must not depend on a popup: a phone can block window.open.
     Match the call, not the comment that explains why it is not used. */
  if (/\bwindow\.open\s*\(/.test(PRINT)) errors.push('[print] printing goes through a popup, which a phone can block');
  if (!/print-color-adjust:exact/.test(css)) errors.push('[print] the club colours will not survive the printer');
}

/* ---- 6) nothing in the page points at a control that is not there ---- */
{
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([
    ...[...PAGE.matchAll(/\b(?:el|val)\('([^']+)'\)/g)].map(m => m[1]),
    ...[...(PAGE.match(/GUARDIAN_FIELDS = \[([^\]]*)\]/) || [, ''])[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  ]);
  for (const id of used) {
    if (!ids.has(id)) errors.push('[wiring] the script looks for #' + id + ', which the page does not have');
  }
  /* Every control a visitor can fill must carry a name, or it will not come
     back in a draft and will not be sent. */
  for (const m of HTML.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
    const tag = m[0];
    if (/type="file"|type="submit"/.test(tag)) continue;
    if (!/\sname="[^"]+"/.test(tag)) {
      errors.push('[wiring] a control has no name, so it would be lost: ' + tag.slice(0, 60));
    }
  }
}

/* ---- 7) it needs no account, and lands where management looks ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'adult');
  passTheGate(w);
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  /* The POST is recorded the moment it is sent, but the confirmation is painted
     a few promises later, so wait for the confirmation and not for the request. */
  return waitFor(w, () => !w.document.getElementById('done').hidden
    || !!w.document.getElementById('form-msg').textContent)
    .catch(() => errors.push('[send] nothing came back after sending'))
    .then(() => {
    const post = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
    if (post.length !== 1) { errors.push('[send] expected one post to /api/applications, got ' + post.length); return; }
    const body = JSON.parse(post[0].body);
    /* These are the names the platform's own sign-up sends, because the
       management screen reads those and nothing else. */
    for (const key of ['first_name_ar', 'last_name_ar', 'birth_date', 'phone', 'address',
      'category', 'blood_group', 'national_id', 'whatsapp', 'birth_place', 'wilaya',
      'gender', 'level', 'swimming_strokes', 'subscription_code', 'facility',
      'transport', 'uniform', 'payment_method', 'guardian_first_name', 'guardian_last_name',
      'guardian_consent', 'status']) {
      if (!(key in body)) errors.push('[send] the payload is missing ' + key + ', which management reads');
    }
    if (body.status !== 'pending') errors.push('[send] a public sign-up must arrive pending');
    if ('reviewed_by' in body) errors.push('[send] the payload claims a review nobody did');
    /* It is filed under the account it opened, so the person can follow it up.
       What it must not carry is the password: Firebase hashed it before it was
       ever written anywhere, and this request carries the name, not the secret. */
    if (body.email !== 'swimmer@example.com') errors.push('[send] the request does not name the account it belongs to');
    if (body.username !== 'swimmer.test') errors.push('[send] the request does not carry the chosen user name');
    if ('password' in body || 'password_confirm' in body) {
      errors.push('[send] the password travelled with the request');
    }
    if (body.sport !== 'السباحة') errors.push('[send] the sport is not the swimming branch');
    /* firestore.rules is what actually lets this through, anonymously. */
    if (!/match \/applications\/\{id\}/.test(RULES)) errors.push('[rules] no applications collection');
    if (!/request\.resource\.data\.status == 'pending'/.test(RULES)) {
      errors.push('[rules] an anonymous create is not restricted to pending, so this page could be abused');
    }
    if (!/!\(\s*'reviewed_by' in request\.resource\.data\s*\)/.test(RULES)) {
      errors.push('[rules] a visitor could post reviewed_by');
    }

    /* after sending: the number is shown, and the print opens */
    if (w.document.getElementById('done').hidden) errors.push('[done] the confirmation did not appear');
    /* The number is shown in the club's digits. Built here rather than typed:
       writing the expected value out by hand is how a twelve-character number
       ends up eleven characters long and the test blames the page. */
    const shown = s => Array.from(String(s)).map(c => {
      const p = c.codePointAt(0);
      return (p >= 0x0660 && p <= 0x0669) ? String(p - 0x0660) : c;
    }).join('');
    if (w.document.getElementById('done-no').textContent !== shown('APP-20260101-AB12')) {
      errors.push('[done] the request number is not shown in the club\'s digits: '
        + w.document.getElementById('done-no').textContent);
    }
    w.document.getElementById('print-form').dispatchEvent(new w.Event('click', { bubbles: true }));
    if (!w.__frames.length) errors.push('[done] the print button opened nothing');
    /* the draft must not outlive a sent request, or the next person on the same
       phone would find the first one's data already filled in */
    if (w.localStorage.getItem('sadara-istimara-draft')) errors.push('[draft] the draft survived the send');
  });
});

/* ---- 8) an adult is never stopped by a field they cannot see ---- */
tasks.push(() => {
  const w = boot();
  const minor = w.document.querySelector('input[name="category"][value="minor"]');
  const adult = w.document.querySelector('input[name="category"][value="adult"]');

  minor.checked = true;
  minor.dispatchEvent(new w.Event('change', { bubbles: true }));
  if (w.document.getElementById('guardian-card').hidden) errors.push('[minor] a minor lost the guardian section');
  if (!w.document.getElementById('guardian_first_name').required) errors.push('[minor] the guardian name is not required');

  adult.checked = true;
  adult.dispatchEvent(new w.Event('change', { bubbles: true }));
  if (!w.document.getElementById('guardian-card').hidden) errors.push('[adults] the guardian section is still showing');
  if (w.document.getElementById('guardian_first_name').required) errors.push('[adults] an adult must fill a hidden field');
  /* A child holds no national number, so the swimmer's field belongs to the
     adults only -- and the guardian's own number stays for the minors. */
  const adultOnly = w.document.querySelector('[data-adult-only]');
  if (!adultOnly) errors.push('[ids] the swimmer national number is not marked adult-only');
  else if (adultOnly.hidden) errors.push('[adults] the swimmer national number is hidden from an adult');
  if (!w.document.getElementById('guardian_national_id')) errors.push('[ids] the guardian national number is gone');
  else if (w.document.getElementById('guardian_national_id').required) errors.push('[adults] an adult must fill a hidden guardian number');
  /* What this has always meant: nobody is stopped by a field they cannot see. The
     adult's own number is on the screen for an adult, so it is required there --
     and the same field must not be required for a child, who has no card. */
  if (!w.document.getElementById('national_id').required) {
    errors.push('[adults] an adult is not asked for their own card number');
  }

  minor.checked = true;
  minor.dispatchEvent(new w.Event('change', { bubbles: true }));
  if (adultOnly && !adultOnly.hidden) errors.push('[minor] a child was asked for a national number');
  if (!w.document.getElementById('guardian_national_id').required) {
    errors.push('[minor] the guardian national number must stay compulsory');
  }
  /* the child's birth certificate number is the identifier a minor does have */
  if (w.document.getElementById('birth_certificate_no').closest('[hidden]')) {
    errors.push('[minor] the birth certificate number was hidden from a child');
  }
  /* hidden means hidden, not merely marked */
  if (!/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(CSS)) {
    errors.push('[adults] no [hidden] rule, so a hidden section could stay on screen');
  }

  /* an adult sends without touching a guardian field. Wait for the outcome, not
     for the request: the POST is recorded before the confirmation is painted. */
  fill(w, 'adult');
  passTheGate(w);
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => !w.document.getElementById('done').hidden
    || !!w.document.getElementById('form-msg').textContent)
    .catch(() => errors.push('[adults] nothing happened after sending'))
    .then(() => {
      if (!posted(w)) errors.push('[adults] an adult cannot send without guardian details');
      if (w.document.getElementById('done').hidden) {
        errors.push('[adults] no confirmation after sending: '
          + (w.document.getElementById('form-msg').textContent || '(no message)'));
      }
    });
});

/* ---- 9) a minor cannot slip through without the declaration ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'minor');
  /* One field taken away, and the form is asked to name this one. A full form with
     something missing in it tests whatever the filler forgot; an emptied field
     tests the field. */
  const name = w.document.getElementById('guardian_first_name');
  name.value = '';
  name.dispatchEvent(new w.Event('input', { bubbles: true }));
  passTheGate(w);
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => w.document.getElementById('form-msg').textContent)
    .catch(() => errors.push('[minor] no message explaining what is missing'))
    .then(() => {
      if (posted(w)) errors.push('[minor] sent without the guardian');
      if (!w.document.getElementById('guardian_first_name').classList.contains('bad')) {
        errors.push('[minor] the empty guardian field is not marked');
      }
      if (!/\u0627\u0644\u0648\u0644\u064a|\u0627\u0633\u0645\u0651 \u0627\u0644\u0648\u0644\u064a/.test(
        w.document.getElementById('form-msg').textContent || '')) {
        errors.push('[minor] the message does not name the field that is missing: '
          + (w.document.getElementById('form-msg').textContent || '(no message)'));
      }
      if (w.document.getElementById('form-msg').hidden) errors.push('[minor] no message explaining what is missing');
    });
});

/* ---- 10) the live total matches what the club will confirm ---- */
tasks.push(() => {
  const w = boot();
  const total = () => w.document.getElementById('total-amount').textContent;
  const fire = id => {
    const n = w.document.getElementById(id);
    n.checked = !n.checked;
    n.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  return waitFor(w, () => /\d/.test(total()))
    .catch(() => errors.push('[total] the prices never arrived: ' + total()))
    .then(() => {
    if (!isAmount(total(), '1000')) errors.push('[total] the quarterly subscription did not load: ' + total());
    const select = w.document.getElementById('subscription_code');
    select.value = 'season';
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    if (!isAmount(total(), '3000')) errors.push('[total] the seasonal subscription is wrong: ' + total());
    fire('transport'); fire('uniform');
    if (!isAmount(total(), '6400')) errors.push('[total] the extras were not added: ' + total());
    fire('transport'); fire('uniform');
    if (!isAmount(total(), '3000')) errors.push('[total] the extras did not come back off: ' + total());
  });
});

/* ---- 11) a half-finished form survives a closed tab ---- */
tasks.push(() => {
  const w = boot();
  w.document.getElementById('first_name_ar').value = 'منال';
  w.document.getElementById('first_name_ar').dispatchEvent(new w.Event('input', { bubbles: true }));
  const draft = w.localStorage.getItem('sadara-istimara-draft');
  if (!draft) { errors.push('[draft] typing did not save a draft'); return Promise.resolve(); }
  if (!JSON.parse(draft).first_name_ar) errors.push('[draft] the draft lost what was typed');

  const again = boot(draft);
  if (again.document.getElementById('first_name_ar').value !== 'منال') {
    errors.push('[draft] the draft did not come back');
  }
  return Promise.resolve();
});

/* ---- 11) a heavy photo costs the picture, never the registration ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'adult');
  /* Firestore refuses a document over 1 MiB. The photo rides inside the record,
     so one heavy enough to tip it over must be left out rather than costing the
     whole request -- and the person has to be told, not left guessing. */
  return choosePhoto(w, 1100 * 1024).then(() => {
    passTheGate(w);
    w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
    return waitFor(w, () => !w.document.getElementById('done').hidden
      || !!w.document.getElementById('form-msg').textContent);
  })
    .catch(() => errors.push('[size] nothing came back from an oversized record'))
    .then(() => {
      const post = w.__calls.filter(c => c.method === 'POST');
      if (post.length !== 1) { errors.push('[size] the oversized record was never sent'); return; }
      const body = JSON.parse(post[0].body);
      if (body.photo) errors.push('[size] an oversized photo was still sent, so the whole request would be refused');
      if (!body.photo_omitted) errors.push('[size] the record does not say the picture is missing');
      /* the names are the whole point: they must survive */
      for (const key of ['first_name_ar', 'last_name_ar', 'birth_date', 'phone', 'address']) {
        if (!body[key]) errors.push('[size] the oversized photo cost the field ' + key);
      }
      const warn = w.document.getElementById('done-warning');
      if (warn.hidden) errors.push('[size] the person was never told the picture is missing');
      if (!/الصورة/.test(warn.textContent)) errors.push('[size] the warning does not mention the picture');
    });
});

/* ---- 12) a normal photo is kept ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'adult');
  return choosePhoto(w, 40 * 1024).then(() => {
    passTheGate(w);
    w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
    return waitFor(w, () => !w.document.getElementById('done').hidden);
  })
    .catch(() => errors.push('[size] a normal record did not go through'))
    .then(() => {
      const post = w.__calls.filter(c => c.method === 'POST');
      if (!post.length) { errors.push('[size] a normal record was never sent'); return; }
      const body = JSON.parse(post[0].body);
      if (!body.photo) errors.push('[size] a normal photo was dropped for no reason');
      if (body.photo_omitted) errors.push('[size] a normal record claims the picture is missing');
      if (!w.document.getElementById('done-warning').hidden) {
        errors.push('[size] the warning shows even though nothing was left out');
      }
    });
});

/* ---- 12b) a pool renamed in Settings reaches this form ---- */
tasks.push(() => {
  const w = boot();
  /* Management saved a different list: the form must offer exactly those names,
     because a swimmer cannot pick a pool the club no longer runs. */
  w.__facilities = [{ id: 'a', name: 'مسبح الاخيار' }, { id: 'b', name: 'مسبح الجديدة' }];
  return waitFor(w, () => {
    const opts = [...w.document.querySelectorAll('#facility option')].map(o => o.textContent);
    return opts.length === 2 && opts[0] === 'مسبح الاخيار';
  }, 2000)
    .catch(() => {
      const opts = [...w.document.querySelectorAll('#facility option')].map(o => o.textContent);
      errors.push('[pools] the form ignored the club list; it offers: ' + opts.join(' | '));
    });
});

/* ---- 12c) an empty list must not leave the form with no choice ---- */
tasks.push(() => {
  const w = boot();
  w.__facilities = [];
  return waitFor(w, () => w.__calls.some(c => /facilities/.test(c.url)), 2000)
    .then(() => new Promise(r => setTimeout(r, 40)))
    .then(() => {
      const opts = [...w.document.querySelectorAll('#facility option')].map(o => o.textContent);
      if (!opts.length) errors.push('[pools] an empty club list left the form with no pool at all');
      if (opts.length === 2) errors.push('[pools] the form adopted the empty list instead of the built-in names');
    });
});

/* ---- 13) a failed send keeps what was typed ---- */
tasks.push(() => {
  const w = boot();
  fill(w, 'adult');
  w.fetch = function (u, i) {
    w.__calls.push({ url: String(u), method: (i && i.method || 'GET').toUpperCase(), body: i && i.body });
    return Promise.resolve({ ok: false, json: async () => ({ error: 'تعذّر إرسال الطلب.' }) });
  };
  passTheGate(w);
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => !w.document.getElementById('form-msg').hidden)
    .catch(() => errors.push('[draft] a failed send said nothing'))
    .then(() => {
      if (w.document.getElementById('done').hidden === false) errors.push('[draft] a failed send claimed success');
      const draft = w.localStorage.getItem('sadara-istimara-draft');
      if (!draft || JSON.parse(draft).first_name_ar !== 'أمين') {
        errors.push('[draft] a failed send threw the typed data away');
      }
      if (w.document.getElementById('submit').disabled) {
        errors.push('[draft] the submit button stayed dead after a failure, so there is no retry');
      }
    });
});

/* ---- 14) the request says which kind of file it is ----
   The rules deployed to the project refuse a request with no application_type.
   Without it this page's every registration was answered "you do not have
   permission" while the local server, which does not read the rules, took it
   happily -- so nothing local ever saw the failure. The stub here accepts
   anything, deliberately: what is checked is the request itself. */
tasks.push(() => {
  const w = boot();
  fill(w, 'adult');
  passTheGate(w);
  w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  return waitFor(w, () => w.__calls.some(c => c.method === 'POST'))
    .catch(() => errors.push('[send] the request was never sent'))
    .then(() => {
      const post = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url))[0];
      if (!post) return;
      const body = JSON.parse(post.body);
      if (body.application_type !== 'swimmer') {
        errors.push('[send] the request does not say it is a swimmer\'s file: '
          + JSON.stringify(body.application_type)
          + ' -- the deployed rules refuse it and answer "you do not have permission"');
      }
      if (body.status !== 'pending') errors.push('[send] a public request must start pending');
    });
});

/* ---- 15) the wilaya and the commune are chosen, not spelled ---- */
tasks.push(() => {
  const book = JSON.parse(COMMUNES);
  const list = JSON.parse(ALGERIA.slice(ALGERIA.indexOf('=') + 1, ALGERIA.lastIndexOf(';')));
  const w = boot();
  const d = w.document;

  const wilaya = d.getElementById('wilaya');
  const place = d.getElementById('birth_place');
  if (wilaya.tagName !== 'SELECT') errors.push('[wilaya] the wilaya is still a box to type into');
  if (place.tagName !== 'SELECT') errors.push('[wilaya] the birthplace is still a box to type into');
  /* 69 is the count after the reform of April 2026. The 58-wilaya lists still in
     circulation name several districts that are no longer wilayas at all. */
  if (wilaya.options.length !== 70) {
    errors.push('[wilaya] 69 wilayas plus the empty option expected, got ' + (wilaya.options.length - 1));
  }
  if (wilaya.value !== 'غرداية') {
    errors.push('[wilaya] the form does not open on the club\'s own wilaya: ' + wilaya.value);
  }

  /* choosing a wilaya offers that wilaya's communes and nobody else's */
  const target = list.find(x => (book[x.code] || []).length > 2);
  wilaya.value = target.name;
  wilaya.dispatchEvent(new w.Event('change', { bubbles: true }));
  return waitFor(w, () => place.options.length > 1)
    .catch(() => errors.push('[wilaya] choosing a wilaya left the communes empty'))
    .then(() => {
      const offered = [...place.options].map(o => o.value).filter(Boolean);
      const expected = book[target.code];
      if (offered.length !== expected.length) {
        errors.push('[wilaya] ' + target.name + ' should offer ' + expected.length + ' communes, offered ' + offered.length);
      }
      const stray = offered.filter(n => expected.indexOf(n) === -1);
      if (stray.length) errors.push('[wilaya] communes from another wilaya are on offer: ' + stray.join('، '));
      /* a commune chosen under the old wilaya must not follow the person over */
      place.value = expected[0];
      const other = list.find(x => x.code !== target.code);
      wilaya.value = other.name;
      wilaya.dispatchEvent(new w.Event('change', { bubbles: true }));
      return waitFor(w, () => place.options.length > 1 && place.value === '').then(() => {
        const after = [...place.options].map(o => o.value).filter(Boolean);
        const crossed = after.filter(n => expected.indexOf(n) !== -1);
        if (crossed.length) {
          errors.push('[wilaya] a commune from ' + target.name + ' survived the move to ' + other.name);
        }
      });
    });
});

/* ---- 16) a saved draft comes back in the right order ----
   The wilaya decides the communes, so restoring the commune before the wilaya
   would leave it on an empty list. */
tasks.push(() => {
  const book = JSON.parse(COMMUNES);
  const list = JSON.parse(ALGERIA.slice(ALGERIA.indexOf('=') + 1, ALGERIA.lastIndexOf(';')));
  const target = list.find(x => (book[x.code] || []).length > 2);
  const commune = book[target.code][1];
  const w = boot(JSON.stringify({ first_name_ar: 'أمين', wilaya: target.name, birth_place: commune }));
  return waitFor(w, () => w.document.getElementById('birth_place').value === commune)
    .catch(() => errors.push('[wilaya] a saved draft lost its commune on the way back: '
      + w.document.getElementById('birth_place').value))
    .then(() => {
      if (w.document.getElementById('wilaya').value !== target.name) {
        errors.push('[wilaya] a saved draft lost its wilaya');
      }
    });
});

/* ---- 17) a wilaya the list does not carry is kept, not dropped ----
   A draft saved before the reform may name a district that has since become a
   wilaya of its own. Clearing the field silently would change the record the
   person is about to send. */
tasks.push(() => {
  const w = boot(JSON.stringify({ wilaya: 'وادي مرة', birth_place: 'أحمد راشدي' }));
  return waitFor(w, () => w.document.getElementById('wilaya').value === 'وادي مرة')
    .catch(() => errors.push('[wilaya] a wilaya outside the list was thrown away'))
    .then(() => {
      const place = w.document.getElementById('birth_place');
      if (place.tagName !== 'SELECT' || place.options.length > 1) {
        errors.push('[wilaya] a wilaya with no communes of its own left the birthplace stuck');
      }
    });
});

/* ---- 18) a form that cannot load the lists still sends ---- */
tasks.push(() => {
  const list = JSON.parse(ALGERIA.slice(ALGERIA.indexOf('=') + 1, ALGERIA.lastIndexOf(';')));
  const w = boot();
  w.__communesFail = true;
  const wilaya = w.document.getElementById('wilaya');
  const other = list.find(x => x.code !== '47');
  wilaya.value = other.name;
  wilaya.dispatchEvent(new w.Event('change', { bubbles: true }));
  const wait = () => waitFor(w, () => w.document.getElementById('birth_place').tagName === 'INPUT');
  return wait()
    .catch(() => errors.push('[wilaya] when the commune list will not load, the field is left unusable'))
    .then(() => {
      const place = w.document.getElementById('birth_place');
      if (place.name !== 'birth_place') {
        errors.push('[wilaya] the replacement box lost its name, so the value would not be sent');
      }
      fill(w, 'adult');
      place.value = 'بئر قاصد';
      passTheGate(w);
      w.document.getElementById('reg-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
      return waitFor(w, () => w.__calls.some(c => c.method === 'POST'))
        .catch(() => errors.push('[wilaya] the form would not send once the lists were gone'))
        .then(() => {
          const post = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url))[0];
          if (!post) return;
          if (JSON.parse(post.body).birth_place !== 'بئر قاصد') {
            errors.push('[wilaya] the typed birthplace did not reach the request');
          }
        });
    });
});

/* ---- 19) the medical section is gone from the page ---- */
{
  if (/الفحص الطبي/.test(HTML)) errors.push('[page] the medical section is still on the form');
  const steps = [...HTML.matchAll(/class="step-no">([^<]+)</g)].map(m => m[1]);
  /* In the digits the form writes its step numbers in. */
  if (steps.join('|') !== '\u0661|\u0662|\u0663|\u0664|\u0665|\u0666') {
    errors.push('[page] the steps are numbered ' + steps.join(' ') + ' after the medical section was removed');
  }
}

/* ---- 20) the printed packet: form, summary, then the club's own rules ---- */
{
  const w = boot();
  const F = w.SADARA_FORM;
  const html = F.documentHTML({ application_no: 'APP-20261011-TEST' });
  const pages = [...html.matchAll(/class="(f-page|s-page|r-page)"/g)].map(m => m[1]);
  if (pages.join('>') !== 'f-page>s-page>r-page') {
    errors.push('[print] the packet is [' + pages.join(' > ') + ']; it should be the form, '
      + 'the summary, then the rules');
  }
  if (!/class="r-img" src="[^"]*internal-regulations\.jpg"/.test(html)) {
    errors.push('[print] the rules page is not the club\'s own document');
  }
  /* The bar above the form tells the person to sign it and bring it in. It is an
     instruction for the screen, not part of the document: left in the print it
     lands at the top of page one, over the club's own heading.
     The print block is read from where it starts rather than by matching to the
     first closing brace -- there are rules inside it, and stopping at the first
     one would read a selector and call it the block. */
  const css = F.printCSS();
  const at = css.indexOf('@media print{');
  if (at === -1) errors.push('[print] the print rules are missing altogether');
  else if (!/\.f-hint\{display:none\}/.test(css.slice(at))) {
    errors.push('[print] the instruction bar is still printed at the top of page one');
  }
  /* The stylesheet is assembled by joining strings, and a stray "+" in front of
     a comment makes it `'...' + + '...'` -- which is not a syntax error, it is a
     number, and it silently swallows every rule after it. Caught here rather than
     on a printed page. */
  if (/NaN|undefined/.test(css)) {
    const bad = /[^}]*?(NaN|undefined)[^;]*/.exec(css);
    errors.push('[print] the stylesheet was assembled wrong: ' + (bad ? bad[0].trim() : '?'));
  }
}

/* ---- 21) a value too long for its line is measured down, not cut off ---- */
{
  const F = boot().SADARA_FORM;
  /* A value is drawn tight against its colon, as every field on this form is,
     so a long one is cut at the edge of its box rather than allowed to run over
     the printed wording. jsdom has no layout and cannot measure a glyph, so what
     is checked here is that the measurement exists and happens before the page is
     sent to the printer -- the browser does the rest. */
  if (typeof F.fitSpots !== 'function') {
    errors.push('[print] nothing measures a long value down to the size of its box');
  }
  /* printRegistration lives in print.js, not in the page script beside it. */
  if (!/function printRegistration[\s\S]*?fitSpots\(doc\);[\s\S]*?\.print\(\)/.test(PRINT)) {
    errors.push('[print] the page reaches the printer without being measured first');
  }
  if (!/\.f-spot\{[^}]*overflow:hidden/.test(F.printCSS())) {
    errors.push('[print] a box that could run over the printed wording, with nothing to stop it');
  }
  /* The pool and the registration number were sharing one box, measured onto the
     pool's line: the number printed beside the word مسبح and its own place stayed
     empty. Each is checked on the line the scan actually draws. */
  const spots = F.FORM_SPOTS.filter(s => s.id === 'facility' || s.id === 'registration');
  if (spots.length !== 2) errors.push('[print] the top line has ' + spots.length + ' boxes for two labels');
  const pool = spots.find(s => s.id === 'facility');
  const reg = spots.find(s => s.id === 'registration');
  if (pool && (Math.abs(pool.colon - 191.1) > 0.2 || Math.abs(pool.x0 - 90.8) > 0.2)) {
    errors.push('[print] the pool is not on the line the scan draws for it');
  }
  if (reg && reg.colon > 37 || reg && reg.x0 < 1) {
    errors.push('[print] the registration number is not at the far left of the top line');
  }
  if (pool && reg && pool.y !== reg.y) {
    errors.push('[print] the registration number and the pool are not on the same line');
  }
}

/* ---- 22) the summary is one page, whatever it has to carry ---- */
{
  const F = boot().SADARA_FORM;
  const css = F.printCSS();
  const rec = {
    category: 'minor', application_no: 'APP-T', first_name_ar: 'x', last_name_ar: 'y',
    birth_date: '2013-05-09', phone: '1', address: 'a', expected_amount: 1000,
    first_name_fr: 'x', last_name_fr: 'y', birth_place: 'p', wilaya: 'w',
    national_id: 'n', birth_certificate_no: 'b', blood_group: 'O+', level: 'متوسط',
    whatsapp: '2', guardian_first_name: 'g', guardian_last_name: 'h',
    guardian_birth_date: '1985-02-03', guardian_relation: 'أب',
    guardian_phone: '3', guardian_national_id: '198502031122334455', guardian_consent: true,
    subscription_code: 'quarter', facility: 'f', transport: true, uniform: true,
    transport_amount: 1, uniform_amount: 2, payment_method: 'cash', notes: 'ملاحظة'
  };
  const html = F.summarySheet(rec);

  /* A fixed height is the guarantee. min-height let a minor with every optional
     field run to 483 mm and come out as two sheets, the second nearly empty. */
  const page = /\.s-page\{([^}]*)\}/.exec(css);
  if (!page) errors.push('[summary] the page has no size at all');
  else {
    if (!/height:297mm/.test(page[1])) errors.push('[summary] the page is not a fixed A4 height');
    if (/min-height/.test(page[1])) errors.push('[summary] min-height lets the summary grow past one page');
    if (!/overflow:hidden/.test(page[1])) errors.push('[summary] the page does not clip what does not fit');
  }
  /* Two columns of full-width fields, not three columns of squeezed ones: at
     three across the labels and values stopped fitting and every one wrapped. */
  if ((html.match(/class="s-col"/g) || []).length !== 2) {
    errors.push('[summary] the summary is not laid out in two columns');
  }
  if (!/grid-template-columns:1fr 1fr/.test(css)) {
    errors.push('[summary] the two columns are not side by side');
  }
  /* Nothing may be lost to the tightening: every value still has to be on the
     page. The full list of values is checked separately, above; this is the
     right-hand column, which is the one that grew. */
  for (const needle of ['g', 'h', '1985/02/03', '198502031122334455']) {
    if (!html.includes(needle)) errors.push('[summary] a value was lost in the new layout: ' + needle);
  }
  /* The one thing here that can be any length at all is the swimmer's own note. */
  if (!/\.s-notes\{[^}]*max-height/.test(css)) {
    errors.push('[summary] a long note is not capped, so it can push the signatures off the page');
  }
}

/* ---- 23) the season on the summary, under the request number ---- */
{
  const F = boot().SADARA_FORM;
  const html = F.documentHTML({ application_no: 'APP-20261011-33A7', category: 'adult',
    first_name_ar: 'x', last_name_ar: 'y', birth_date: '2000-01-01', phone: '1', address: 'a' });
  const no = /<div class="s-no">([\s\S]*?)<\/div>/.exec(html);
  if (!no) errors.push('[season] the summary has no block for the request number');
  else {
    /* Directly under it, and in Arabic-Indic digits with the later year first --
       the way a season is read and written in Arabic. */
    const wanted = 'رقم الطلب' + '[\\s\\S]*' + clubShows('APP-20261011-33A7')
      + '[\\s\\S]*' + 'الموسم الرياضي' + '[\\s\\S]*' + '2027 \\/ 2026';
    if (!(new RegExp(wanted)).test(no[1])) {
      errors.push('[season] the summary does not carry the season under the request number');
    }
    /* Nothing on that block may be in Arabic-Indic digits: the club writes 0-9,
       and a number in the other set is one somebody has to convert before they
       can type it back in. */
    if (/[\u0660-\u0669]/.test(no[1])) {
      errors.push('[season] the request number block carries Arabic-Indic digits: '
        + JSON.stringify(no[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
    }
  }
  /* Set larger than the number above it: the number is matched, the season is
     read to know the year. */
  const css = F.printCSS();
  const size = sel => {
    const m = new RegExp('\\' + sel + '\\{[^}]*font-size:([\\d.]+)pt').exec(css);
    return m ? Number(m[1]) : 0;
  };
  const season = size('.s-season'), request = size('.s-no b');
  if (!season) errors.push('[season] the season on the summary has no size of its own');
  else if (season <= request) {
    errors.push('[season] the season is not larger than the request number above it: '
      + season + 'pt against ' + request + 'pt');
  }
  if (F.CLUB.season !== '2027 / 2026') {
    errors.push('[season] the club season is not written later-year-first: ' + F.CLUB.season);
  }
}

/* ---- 24) the sheet is written in Arabic-Indic digits ---- */
{
  const F = boot().SADARA_FORM;
  if (F.ar('2026/10/11') !== '2026/10/11') {
    errors.push('[digits] the conversion to Arabic-Indic digits is wrong: ' + F.ar('2026/10/11'));
  }
  if (F.slashDate('2013-05-09') !== '2013/05/09') {
    errors.push('[digits] a date is not written year-first in Arabic digits: ' + F.slashDate('2013-05-09'));
  }
  /* The values a person reads off the page. */
  const rec = { birth_date: '2013-05-09', phone: '0661234567', blood_group: 'O+',
                guardian_birth_date: '1985-02-03', guardian_national_id: '198502031122334455',
                category: 'minor', first_name_ar: 'x', last_name_ar: 'y',
                birth_place: 'غرداية',
                address: 'a', application_no: 'APP-20261011-33A7', expected_amount: 6400 };
  const vals = F.formValues(rec);
  for (const [what, got, want] of [
    ['the birth date', vals.birth_date, '2013/05/09'],
    /* The box after `المولود (٥) بتاريخ:` is the guardian's day, not the
       child's. The record carries both -- the child 2013, the guardian 1985 -- and
       the child was already printed on the line above, so the club was striking
       the second copy out by hand on every form. */
    ["the guardian's day on the declaration", vals.child_birth_date, '1985/02/03'],
    /* And `ب:` is where the child was born. */
    ['the birthplace', vals.birth_place, 'غرداية'],
    ['the telephone number', vals.phone, '0661234567'],
    ["the guardian's identity number", vals.parent_id, '198502031122334455']
  ]) {
    if (got !== want) errors.push('[digits] ' + what + ' prints as ' + got + ', not ' + want);
  }
  /* The request number too: written the way the club writes every number, with
     its letters and punctuation left alone. It is still looked up by what it
     says -- the platform's search folds digits on both sides -- but what the
     person reads off the sheet is in the club's digits. */
  if (vals.registration !== clubShows('APP-20261011-33A7')) {
    errors.push('[digits] the request number is not written in the club\'s digits: ' + vals.registration);
  }
  if (/[^0-9A-Za-z-]/.test(vals.registration.replace(/-/g, ''))) {
    errors.push('[digits] the request number carries something that is not a digit: ' + vals.registration);
  }
  /* The thousands separator is whatever locale gives -- a narrow no-break space
     here, an ordinary one elsewhere -- so every run of blanks is collapsed to one
     before the amount is compared rather than pinned to one kind of space. */
  const sheet = F.summarySheet(rec).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (sheet.indexOf('المبلغ المتوقع 6 400 دج') === -1) {
    errors.push('[digits] the amount is not written in Arabic digits: '
      + (sheet.match(/المبلغ[^د]*دج/) || ['(not found)'])[0]);
  }
}


/* ---- the identity card, and the place of birth ---- */
const card_fields = () => {
  const book = JSON.parse(COMMUNES);
  const list = JSON.parse(ALGERIA.slice(ALGERIA.indexOf('=') + 1, ALGERIA.lastIndexOf(';')));
  const target = list.find(x => (book[x.code] || []).length > 0);
  const commune = book[target.code][0];

  const w = boot();

  /* A photograph, because the registration is not finished without one --
     set through the page's own door, the one the file picker ends at. */
  w.SADARA_FORM.setPhoto(TINY_PHOTO);
  const id = x => w.document.getElementById(x);
  const say = () => (id('form-msg').textContent || '').trim();

  /* The wilaya before the communes: the commune list is the wilaya's own, so there
     is nothing on it until a wilaya is chosen. */
  const ready = waitFor(w, () => id('wilaya') && id('wilaya').options.length > 1)
    .then(() => {
      const radio = w.document.querySelector('input[name="category"][value="minor"]');
      radio.checked = true;
      radio.dispatchEvent(new w.Event('change', { bubbles: true }));
      id('wilaya').value = target.name;
      id('wilaya').dispatchEvent(new w.Event('change', { bubbles: true }));
      return waitFor(w, () => id('birth_place').options.length > 1);
    });

  const fillShared = () => {
    const set = (f, v) => { const n = id(f); n.value = v; n.dispatchEvent(new w.Event('input', { bubbles: true })); };
  /* Everybody's fields, from the one list. */
  answerEverything(w, set);
  answerForAGuardian(w, set, { birth_place: '' });
    set('first_name_ar', 'أمين');
    set('last_name_ar', 'بلعيد');
    set('birth_date', '2015/04/02');
    set('phone', '0661000001');
    set('address', 'حي الثنية');
    id('terms').checked = true;
    set('email', 'probe.card@example.com');
    set('username', 'probe.card');
    set('password', 'correct-horse');
    set('password_confirm', 'correct-horse');
  };

  const submit = () => { passTheGate(w); return id('reg-form').dispatchEvent(
    new w.Event('submit', { bubbles: true, cancelable: true })); };

  const lastBody = () => {
    const posts = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
    return posts.length ? JSON.parse(posts[posts.length - 1].body) : null;
  };

  return ready.then(() => {
    fillShared();
    /* The list is repainted when the wilaya settles, so the value is set inside
       the wait rather than before it: set once, and set again if the repaint
       cleared it. Writing it before the list has finished arriving leaves the
       field empty and the request unsent, with nothing in between to say why. */
    return waitFor(w, () => {
      const offered = [...id('birth_place').options].map(o => o.value).filter(Boolean);
      if (!offered.length) return false;
      id('birth_place').value = offered[0];
      id('birth_place').dispatchEvent(new w.Event('change', { bubbles: true }));
      return !!id('birth_place').value;
    }).then(() => { if (id('birth_place').value !== commune) return true; });

    /* A card number that is not nine digits is refused before anything is sent. */
    for (const [what, value] of [['eight digits', '19780903'], ['ten digits', '1978090311']]) {
      const n = id('guardian_national_id');
      n.value = value;
      n.dispatchEvent(new w.Event('input', { bubbles: true }));
      id('form-msg').hidden = true;
      submit();
      return waitFor(w, () => say()).then(() => {
        if (!/9/.test(say())) {
          errors.push('[card] a card number of ' + what + ' was not refused: ' + say());
        }
      });
    }
  }).then(() => {
    /* And the right one, with an expiry and the issue date for the box the club's
       own form has. */
    for (const [f, v] of [['guardian_national_id', '197809031'],
                          ['guardian_national_id_expiry', '2031/06/02'],
                          ['guardian_card_issued', '2021/06/02']]) {
      const n = id(f); n.value = v; n.dispatchEvent(new w.Event('input', { bubbles: true }));
    }
    submit();
    return waitFor(w, () => w.__calls.some(c => c.method === 'POST'))
      .catch(() => errors.push('[card] a minor with a card was never sent: ' + say()));
  }).then(() => {
    const body = lastBody();
    if (!body) return;
    const wants = {
      guardian_national_id: '197809031',
      guardian_national_id_expiry: '2031-06-02',
      guardian_card_issued: '2021-06-02',
      birth_place: commune
    };
    for (const [field, want] of Object.entries(wants)) {
      if (body[field] !== want) {
        errors.push('[card] a minor\'s request carries ' + field + ' as ' + JSON.stringify(body[field])
          + ' rather than ' + JSON.stringify(want));
      }
    }
    /* A child holds no card of their own; an adult carries no guardian's. */
    if (body.national_id) errors.push('[card] a minor was sent with a card of their own');
  });
};

/* An adult holds one too, and is stopped by it when it is wrong. */
const adult_card = () => {
  const w = boot();
  /* A photograph, because the registration is not finished without one --
     set through the page's own door, the one the file picker ends at. */
  w.SADARA_FORM.setPhoto(TINY_PHOTO);
  const id = x => w.document.getElementById(x);
  const say = () => (id('form-msg').textContent || '').trim();
  const set = (f, v) => { const n = id(f); n.value = v; n.dispatchEvent(new w.Event('input', { bubbles: true })); };
  /* Everybody's fields, from the one list. */
  answerEverything(w, set);
  const submit = () => { passTheGate(w); return id('reg-form').dispatchEvent(
    new w.Event('submit', { bubbles: true, cancelable: true })); };

  return waitFor(w, () => id('wilaya') && id('wilaya').options.length > 1).then(() => {
    const radio = w.document.querySelector('input[name="category"][value="adult"]');
    radio.checked = true;
    radio.dispatchEvent(new w.Event('change', { bubbles: true }));
    set('first_name_ar', 'أمين');
    set('last_name_ar', 'بلعيد');
    set('birth_date', '1990/01/01');
    set('phone', '0661000003');
    set('address', 'حي');
    id('terms').checked = true;
    set('email', 'probe.adult@example.com');
    set('username', 'probe.adult');
    set('password', 'correct-horse');
    set('password_confirm', 'correct-horse');
    set('national_id', '19850101');
    id('form-msg').hidden = true;
    submit();
    return waitFor(w, () => say()).then(() => {
      if (!/9/.test(say())) {
        errors.push('[card] an adult\'s card number was not checked: ' + say());
      }
    });
  }).then(() => {
    set('national_id', '198501011');
    set('national_id_expiry', '2031/04/17');
    submit();
    return waitFor(w, () => w.__calls.some(c => c.method === 'POST'))
      .catch(() => errors.push('[card] an adult with a card was never sent: ' + say()));
  }).then(() => {
    const posts = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
    const body = posts.length ? JSON.parse(posts[posts.length - 1].body) : null;
    if (!body) return;
    if (body.national_id !== '198501011') {
      errors.push('[card] an adult\'s card number was sent as ' + JSON.stringify(body.national_id));
    }
    if (body.national_id_expiry !== '2031-04-17') {
      errors.push('[card] an adult\'s card expiry was sent as ' + JSON.stringify(body.national_id_expiry));
    }
    if (body.guardian_national_id) errors.push('[card] an adult was sent with a guardian\'s card');
  });
};

/* A wait that times out is a fault to report, not a crash: the check has already
   failed by not getting its answer, and an exception here would stop every check
   after it from running and hide which of them were fine. */
tasks.push(() => card_fields().catch(e => errors.push('[card] the minor check did not finish: ' + e.message)));
tasks.push(() => adult_card().catch(e => errors.push('[card] the adult check did not finish: ' + e.message)));

/* ---- the notifications ---- */
const toasts_rise = () => {
  const w = boot();
  const tray = w.document.getElementById('toasts');
  const say = (t, k, m) => w.SADARA_FORM.notify(t, k, m);

  if (!tray) {
    errors.push('[notify] the page has no tray to show a notification in');
    return Promise.resolve();
  }

  /* Kept and told apart: two notices arriving together must both be readable, and
     the newer one must not push the older off the screen. */
  say('حُفظت المسودة.', 'ok', 'ستعود تلقائياً.');
  say('تعذّر إرسال الطلب.', 'error', 'لم يُفقد ما كتبته.');

  const cards = [...tray.querySelectorAll('.toast')];
  if (cards.length !== 2) {
    errors.push('[notify] two notices produced ' + cards.length + ' cards');
    return Promise.resolve();
  }
  /* Newest at the top: the notice said last is the thing being waited on. A card
     begins with its mark, so this asks where the sentence is, not that it is
     first. */
  if (cards[0].textContent.indexOf('تعذّر إرسال الطلب') === -1) {
    errors.push('[notify] the newest notice is not at the top of the tray');
  }
  if (cards[1].textContent.indexOf('تعذّر إرسال الطلب') !== -1) {
    errors.push('[notify] both notices are the same one');
  }
  if (!cards[0].classList.contains('error')) errors.push('[notify] a refusal is not marked as one');
  if (!cards[1].classList.contains('ok')) errors.push('[notify] a confirmation is not marked as one');

  /* A sentence, not a class name: the glyph and both lines have to be there,
     because that is all anybody ever reads. */
  const body = cards[0].querySelector('.toast-body');
  const lines = body ? [...body.querySelectorAll('p')].map(x => x.textContent) : [];
  if (lines.length !== 2 || lines[0] !== 'تعذّر إرسال الطلب.' || lines[1] !== 'لم يُفقد ما كتبته.') {
    errors.push('[notify] the notice reads ' + JSON.stringify(lines));
  }
  if (!cards[0].querySelector('.toast-ic')) errors.push('[notify] the notice has no mark on it');

  /* A third and a fourth: the oldest goes, so the top of the screen does not grow
     without bound down a form this long. */
  say('ثالث.', 'info');
  say('رابع.', 'info');
  const four = [...tray.querySelectorAll('.toast')];
  if (four.length !== 3) errors.push('[notify] four notices left ' + four.length + ' cards, not 3');
  if (four.some(c => c.textContent.indexOf('حُفظت المسودة') !== -1)) {
    errors.push('[notify] the oldest notice was kept and a newer one dropped');
  }

  /* Every one of them can be closed by hand, which is the only way a refusal ever
     leaves: nobody reads a screen-reader announcement in six seconds. */
  const closers = [...tray.querySelectorAll('.toast-x')];
  if (closers.length !== 3) errors.push('[notify] ' + closers.length + ' ways to close three notices');
  closers.forEach(b => b.click());

  /* Closing is an animation, so the card is still there for the length of it --
     that is the one moment it is meant to be. Look again once it is over. */
  if (tray.querySelectorAll('.toast').length === 0) {
    errors.push('[notify] a notice vanished before it had finished leaving');
  }
  return new Promise(resolve => setTimeout(() => {
    if (tray.querySelectorAll('.toast').length !== 0) {
      errors.push('[notify] closing a notice left it on the screen');
    }
    resolve();
  }, 400));
};

tasks.push(() => toasts_rise().catch(e => errors.push('[notify] the check did not finish: ' + e.message)));

/* One guardian, several swimmers -- and nothing from the session put on the page.

   The thing being proved is that a second child of the same family can be
   registered at all. Before this, the form made an account every time, so the
   address was taken, the account could not be made again, and the chosen name was
   already held: the second child simply could not be filed.

   The session that stands in for a real one is dressed as a profile the club would
   really have written: a role and an answer. Neither may appear anywhere on the
   page afterwards. That is checked here rather than by reading the source, because
   reading the source cannot tell a value that is written into a profile from one
   that is shown to a visitor -- and it is the second that matters. */
const CHILD_UID = 'guardian-uid-0001';
const CHILD_PROFILE = {
  username: 'karim.belaid',
  name: 'كريم بلعيد',
  role: 'admin',
  request_status: 'rejected',
  rejection_reason: 'سبب ما协调发展 يجب ألا يظهر'
};

/* A session this page can find: the account it is signed in with, and the one
   profile document it may open -- its own. */
function signInAs(w, email, uid) {
  w.firebase = {
    auth: () => ({
      currentUser: { uid: uid || CHILD_UID, email: email },
      signInWithEmailAndPassword: () => Promise.reject({ code: 'auth/wrong-password' }),
      createUserWithEmailAndPassword: () => Promise.reject({ code: 'auth/email-already-in-use' })
    }),
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: () => Promise.resolve({ exists: true, data: () => CHILD_PROFILE }),
          set: () => Promise.resolve()
        })
      })
    })
  };
}

const guardian_returns = () => {
  const w = boot();
  /* A photograph, because the registration is not finished without one --
     set through the page's own door, the one the file picker ends at. */
  w.SADARA_FORM.setPhoto(TINY_PHOTO);
  const id = x => w.document.getElementById(x);
  const set = (f, v) => { const n = id(f); n.value = v; n.dispatchEvent(new w.Event('input', { bubbles: true })); };
  /* Everybody's fields, from the one list. */
  answerEverything(w, set);
  answerForAGuardian(w, set, { birth_place: '' });
  const say = () => (id('form-msg').textContent || '').trim();

  return waitFor(w, () => id('wilaya') && id('wilaya').options.length > 1).then(() => {
    signInAs(w, 'guardian@example.com');

    const radio = w.document.querySelector('input[name="category"][value="minor"]');
    radio.checked = true;
    radio.dispatchEvent(new w.Event('change', { bubbles: true }));
    id('wilaya').value = A_WILAYA.name;
    id('wilaya').dispatchEvent(new w.Event('change', { bubbles: true }));

    return waitFor(w, () => {
      const offered = [...id('birth_place').options].map(o => o.value).filter(Boolean);
      if (!offered.length) return false;
      id('birth_place').value = offered[0];
      return true;
    });
  }).then(() => {
    /* The guardian answers everything but their own account: the address is on
       the form and the browser already holds the account that address belongs to. */
    set('first_name_ar', 'يوسف');
    set('last_name_ar', 'بلعيد');
    set('birth_date', '2017/09/14');
    set('phone', '0661000009');
    set('address', 'حي الثنية');
    set('birth_certificate_no', '04512');
    id('terms').checked = true;
    set('email', 'guardian@example.com');
    /* No password, and no user name: this is the whole point. A field that is
       still demanded here is the field that stops a second child. */
    id('password').value = '';
    id('password_confirm').value = '';
    id('username').value = '';
    id('form-msg').hidden = true;
    passTheGate(w);
    id('reg-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    return waitFor(w, () => w.__calls.some(c => c.method === 'POST'))
      .catch(() => errors.push('[sibling] the second child was never sent: ' + say()));
  }).then(() => {
    const posts = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
    const body = posts.length ? JSON.parse(posts[posts.length - 1].body) : null;
    if (!body) return;
    /* The account the session named is the one the request is filed under. */
    if (body.applicant_uid !== CHILD_UID) {
      errors.push('[sibling] the request was filed under ' + JSON.stringify(body.applicant_uid));
    }
    /* And the name is the one that account already holds, not one chosen again. */
    if (body.username !== CHILD_PROFILE.username) {
      errors.push('[sibling] the request carries the name ' + JSON.stringify(body.username)
        + ' rather than the one the account holds');
    }
    /* The password is offered to the provider and to nobody else -- including the
       second request, which is the request most likely to be made carelessly. */
    if (/password/.test(JSON.stringify(body))) {
      errors.push('[sibling] a password reached the request');
    }

    /* Nothing out of that profile on the page. */
    const shown = w.document.body.textContent || '';
    for (const word of [CHILD_PROFILE.role, CHILD_PROFILE.request_status,
                        CHILD_PROFILE.rejection_reason, CHILD_PROFILE.name]) {
      if (shown.indexOf(word) !== -1) {
        errors.push('[sibling] the page shows "' + word + '" out of the session');
      }
    }
    /* And the offer for the next one, which is the point of all of it. */
    const offer = id('done-sibling');
    if (!offer || offer.hidden) {
      errors.push('[sibling] no offer to register the next swimmer of this family');
    }
  });
};

tasks.push(() => guardian_returns().catch(
  e => errors.push('[sibling] the check did not finish: ' + e.message)));
/* The calendar, and a photograph that is not optional.

   The photograph first, because it is a rule and a rule that is not written down
   is a rule somebody changes by accident.

   The calendar second, and what is checked is the writing and the refusing, not
   the grid: a calendar that looks right and writes a date in a shape nobody reads
   has made the date worse, not better. So what the check chooses is picked up off
   the field and compared with the form the club writes -- `dd/mm/yyyy`.

   What is *stored* is a separate question and is settled elsewhere: dates are kept
   `yyyy-mm-dd`, because that is what the queue order and every equality query
   depend on. This check is about the writing a person reads.

   And the two dates a person is most likely to be stopped by: a birth date three
   years from now, and a card that ran out in 1975. The field says what it will
   take, and the calendar asks the field. */
const calendar_writes = () => {
  const w = boot();
  const id = x => w.document.getElementById(x);
  const cal = w.SADARA_CALENDAR;

  if (!cal) {
    errors.push('[cal] the page has no calendar on its date fields');
    return Promise.resolve();
  }

  /* One form -- the club's -- from everything the calendar might be handed, in
     either order: a person who has the old shape in front of them will type it,
     and refusing their date would be refusing a date they meant. */
  const forms = [
    ['11/10/2026', '11/10/2026'],
    ['2026/10/11', '11/10/2026'],
    ['2026-1-5', '05/01/2026'],
    ['2026/1/5', '05/01/2026'],
    ['2026.01.05', '05/01/2026'],
    ['5-1-2026', '05/01/2026'],
    ['13-9-2013', '13/09/2013'],
    ['\u0661\u0661/\u0661\u0660/\u0662\u0660\u0662\u0666', '11/10/2026'],
    ['\u0662\u0660\u0662\u0666/\u0661\u0660/\u0661\u0661', '11/10/2026']
  ];
  for (const [typed, want] of forms) {
    const got = cal.format(cal.parse(typed) || {});
    if (got !== want) {
      errors.push('[cal] ' + JSON.stringify(typed) + ' is read back as ' + got + ', not ' + want);
    }
  }
  /* And what is not a date is refused rather than guessed. The 31st of February
     is the one everybody's finger writes. */
  /* The 31st of February, written the way the club writes dates as well as the
     way it used to: the refusal has to cover both orders or it covers neither. */
  /* Impossibilities in both orders, and nothing else. `13/09/2013` was on this
     list and is not on it now: it was a refusal because a year last is not a year,
     and since the club writes the day first it is the plainest date there is. A
     check that wants a value and refuses it in the same file is not a check. */
  for (const bad of ['', '2013/02/31', '2013/13/01', 'not a date',
                     '31/02/2013', '01/13/2013', '2013/00/10', '32/01/2013']) {
    if (cal.parse(bad)) {
      errors.push('[cal] ' + JSON.stringify(bad) + ' was taken for a date');
    }
  }

  return waitFor(w, () => !!id('birth_date') && !!id('birth_date').parentNode
    && !!id('birth_date').parentNode.querySelector('.cal-open')).then(() => {
    /* Choosing a day writes the club's date and says so, so the draft keeps it. */
    const field = id('birth_date');
    let heard = 0;
    field.addEventListener('input', () => { heard++; });
    id('birth_date').parentNode.querySelector('.cal-open').click();
    const pick = w.document.querySelector('.cal-pop button.cal-cell:not([disabled])');
    if (!pick) {
      errors.push('[cal] the calendar opened with nothing to choose');
      return;
    }
    pick.click();
    /* Day first, the way the club writes it. The date picked is the same either
       way; the way it is written is the thing that changed. */
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(field.value)) {
      errors.push('[cal] a chosen day was written as ' + JSON.stringify(field.value));
    }
    if (!heard) errors.push('[cal] the field was written without saying so, so the draft is stale');

    /* Nothing is born next year. The field says which bound it has and the
       calendar asks the field, so the question is put to this one and counted: in
       this month, the days after today are forbidden and the rest are not. */
    const now = new Date();
    const yy = now.getFullYear(), mm = now.getMonth() + 1;
    const stamp = yy + '/' + String(mm).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0');
    field.value = stamp;
    field.dispatchEvent(new w.Event('input', { bubbles: true }));
    field.parentNode.querySelector('.cal-open').click();
    const expectedOff = new Date(yy, mm, 0).getDate() - now.getDate();
    const off = [...w.document.querySelectorAll('.cal-pop button.cal-cell.cal-off')]
      .filter(n => Number(n.textContent) > now.getDate()).length;
    if (off !== expectedOff) {
      errors.push('[cal] a birth date may be chosen in the future: ' + off
        + ' of the days after today are forbidden, and there are ' + expectedOff);
    }

    /* A card, on the other hand, does run out in the future -- that is the whole
       point of it -- and it is the same calendar. The difference has to come from
       the field, or the calendar is deciding for both on its own. */
    if (id('national_id_expiry').getAttribute('data-cal-max') === 'today') {
      errors.push('[cal] a card cannot expire in the future');
    }
    if (!field.getAttribute('data-cal-max')) {
      errors.push('[cal] a birth date was not given a bound');
    }
  }).catch(e => errors.push('[cal] the check did not finish: ' + e.message));
};

/* The photograph. Without one the request is not sent, and that is said in words
   rather than by leaving the button looking the same. */
const photo_is_required = () => {
  const w = boot();
  const id = x => w.document.getElementById(x);
  return waitFor(w, () => id('reg-form')).then(() => {
    const before = w.__calls.filter(c => c.method === 'POST').length;
    fill(w, 'adult');
    /* Taken away again, which is the state a person is in who has not chosen one. */
    w.SADARA_FORM.setPhoto('');
    passTheGate(w);
    id('reg-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    const after = w.__calls.filter(c => c.method === 'POST').length;
    if (after !== before) {
      errors.push('[photo] a request was sent with no photograph on it');
    }
    const said = (id('form-msg').textContent || '');
    if (!/\u0627\u0644\u0635\u0648\u0631\u0629/.test(said)) {
      errors.push('[photo] nobody was told the photograph is needed: ' + said);
    }
    /* And with one, it goes. */
    w.SADARA_FORM.setPhoto(TINY_PHOTO);
    id('form-msg').hidden = true;
    passTheGate(w);
    id('reg-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    return waitFor(w, () => w.__calls.some(c => c.method === 'POST'))
      .catch(() => errors.push('[photo] the request never went with a photograph on it'));
  }).then(() => {
    const posts = w.__calls.filter(c => c.method === 'POST');
    const body = posts.length ? JSON.parse(posts[posts.length - 1].body) : {};
    if (body.photo !== TINY_PHOTO) {
      errors.push('[photo] the photograph did not travel with the request');
    }
  }).catch(e => errors.push('[photo] the check did not finish: ' + e.message));
};

/* ---- the separator is written for them ----
   Typed as a keyboard types: a keydown, then the input that follows it. A harness
   that only sets the value never meets a handler on `keydown`, which is how a
   check passes against a page that has none. */
tasks.push(() => {
  const w = boot();
  /* Its own, bound to its own window: this suite declares that helper inside the
     tasks that use it, so a block at this level cannot borrow it -- and stopping
     on a name error teaches nobody anything about the separators. */
  const $ = name => w.document.getElementById(name);
  /* Arabic-Indic digits, written out here rather than borrowed: the suite keeps
     that helper inside one task, and a block at this level that reaches for it
     stops on a name error. */
  const arabic = str => Array.from(String(str)).map(c =>
    (c >= '0' && c <= '9') ? String.fromCodePoint(0x0660 + Number(c)) : c).join('');
  const latin = str => String(str).replace(/[\u0660-\u0669]/g,
    d => String(d.charCodeAt(0) - 0x0660));
  const node = $('birth_date');

  /* In the order a keyboard does it: the keydown first, and the character only if
     nothing prevented it. The first version appended the digit *before*
     dispatching the key, so the handler and the harness disagreed about when the
     character arrives -- and the handler's arithmetic came out right by accident,
     which is the worst way for a check to pass.

     And it is also what makes the handler's own choice checkable: a handler that
     prevented the key to insert the separator itself would swallow the digit, and
     the field would read `17/` for `17/0`. */
  const typeInto = (field, text) => {
    for (const ch of String(text)) {
      const e = new w.KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true });
      field.dispatchEvent(e);
      if (!e.defaultPrevented) {
        field.value += ch;
        try { field.setSelectionRange(field.value.length, field.value.length); }
        catch (_) { /* not every field allows it */ }
      }
      field.dispatchEvent(new w.Event('input', { bubbles: true }));
    }
  };
  const fresh = () => {
    node.value = '';
    node.focus();
    try { node.setSelectionRange(0, 0); } catch (_) { /* not every field allows it */ }
  };

  /* Eight digits in, the club's shape out -- and every digit still there, which
     is what a handler that cancels the key would lose. */
  fresh();
  typeInto(node, '17031998');
  if (latin(node.value) !== '17/03/1998') {
    errors.push('[date] typing 17031998 gave "' + latin(node.value) + '" and not 17/03/1998');
  }

  /* The caret ends after the last digit, ready for the next thing typed: a
     separator put in at the end of the value with the caret left behind is the
     cursor-in-the-middle fault wearing a different hat. */
  if (node.selectionStart !== node.value.length) {
    errors.push('[date] the caret was left at ' + node.selectionStart + ' of '
      + node.value.length + ', so the next character lands in the wrong place');
  }

  /* A separator typed by hand is one separator. */
  fresh();
  typeInto(node, '1703');
  node.value += '/';
  try { node.setSelectionRange(node.value.length, node.value.length); } catch (_) { /* */ }
  typeInto(node, '1998');
  if (latin(node.value) !== '17/03/1998') {
    errors.push('[date] a separator typed by hand came out as "' + latin(node.value)
      + '" and not 17/03/1998 -- somebody who types their own slash must not end up with two');
  }

  /* Arabic-Indic digits count the same. They are what the club writes with and
     what every example on this page is written in, so a handler that only accepts
     Latin keys leaves the people filling the form in with no separator at all. */
  fresh();
  typeInto(node, arabic('17031998'));
  if (latin(node.value) !== '17/03/1998') {
    errors.push('[date] the same digits in Arabic-Indic gave "' + latin(node.value)
      + '" and not 17/03/1998');
  }

  /* A whole date is left exactly as it is: the calendar writes one, and a paste
     arrives whole. */
  fresh();
  node.value = '17/03/1998';
  node.focus();
  try { node.setSelectionRange(node.value.length, node.value.length); } catch (_) { /* */ }
  typeInto(node, '9');
  if (latin(node.value) !== '17/03/1998') {
    errors.push('[date] typing into a date that was already whole changed it to "'
      + latin(node.value) + '" -- the calendar writes a whole date and this must not touch it');
  }

  /* And the digits themselves are never swallowed: eight in, eight out. */
  fresh();
  typeInto(node, '01021980');
  if (latin(node.value).replace(/[^0-9]/g, '') !== '01021980') {
    errors.push('[date] a digit was swallowed: "' + latin(node.value) + '"');
  }

  /* Storage does not move. The field shows the club's order; the request goes out
     in the order the database has always held -- the queue, the weekly bars and
     every equality query depend on it. */
  fill(w, 'adult');
  fresh();
  typeInto(node, '17031998');
  if (latin(node.value) !== '17/03/1998') {
    errors.push('[date] typing into a filled form gave "' + latin(node.value) + '"');
    return Promise.resolve();
  }
  w.SADARA_FORM.setPhoto(TINY_PHOTO);
  $('terms').checked = true;
  $('form-msg').hidden = true;
  passTheGate(w);
  $('reg-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  return waitFor(w, () => w.__calls.some(c => c.method === 'POST')).then(() => {
    const posts = w.__calls.filter(c => c.method === 'POST' && /\/api\/applications$/.test(c.url));
    const body = posts.length ? JSON.parse(posts[posts.length - 1].body) : null;
    if (!body) { errors.push('[date] nothing was sent, so the stored shape is untested'); return; }
    if (body.birth_date !== '1998-03-17') {
      errors.push('[date] the field shows the club\'s order but the request went out as "'
        + JSON.stringify(body.birth_date) + '" -- storage must stay yyyy-mm-dd');
    }
  }).catch(() => errors.push('[date] the request never went, so the stored shape is untested'));
});

tasks.push(() => calendar_writes().catch(
  e => errors.push('[cal] the check did not finish: ' + e.message)));
tasks.push(() => photo_is_required().catch(
  e => errors.push('[photo] the check did not finish: ' + e.message)));
/* ---- run the settling checks in order ---- */
tasks.reduce((chain, task) => chain.then(task), Promise.resolve()).then(() => {
  if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
  console.log('All public registration-page checks passed.');
});
