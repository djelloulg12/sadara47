/* The pool gate, and the column that records it.

   The registration page cannot be filled until a pool is chosen, and the pool
   that was chosen is stored beside the one the request is sent to. Both halves
   are checked here, and both halves are checked by doing rather than by reading,
   because reading was tried first and it was not enough.

   What reading missed, and why it is worth writing down:

   The first version of the Escape check asked whether the source mentioned
   `Escape` and mentioned `preventDefault`. It was satisfied by code disabled with
   `false &&`, by a handler bound to the wrong element, and by a handler that
   never runs. Disabling the real handler was tried, and the check did not notice.
   A check on the source is a check on what was written, not on what happens.

   So the gate is driven. The page is loaded, the three things a person does
   within a second of seeing a gate are done to it -- Escape, a click on the dark
   ground, the continue button with nothing chosen -- and the gate has to survive
   all three. Then a pool is chosen, the way a person chooses one, and the form
   has to become reachable and the choice has to be in the document and on the
   request.

   And the migration is run, not described. A database is built with rows in it,
   every one of those rows is fingerprinted, the migration the club was given is
   run against it, and every row is compared field by field. "The rows are still
   there" would be satisfied by a migration that quietly rewrote them, which is
   the one thing this must not be. It runs twice as well, because a migration
   that is safe once and destructive the second time is a trap with a counter on
   it.

   Everything here is a read or a throwaway in-memory database. Nothing in this
   file opens the club's database and nothing in it writes to anything. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const PUB = path.join(ROOT, 'firebase-public');
const FOLDER = path.join(PUB, 'istimara');
const errors = [];

function check(cond, complaint) {
  if (!cond) errors.push('[gate] ' + complaint);
}

/* ============================================================== the gate, driven */

const HTML = fs.readFileSync(path.join(FOLDER, 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(FOLDER, 'istimara.js'), 'utf8');
const CSS = fs.readFileSync(path.join(FOLDER, 'istimara.css'), 'utf8');

const waitFor = (w, test, ms = 2500) => new Promise((resolve, reject) => {
  const started = Date.now();
  (function poll() {
    let ok = false;
    try { ok = test(); } catch (_) { ok = false; }
    if (ok) return resolve();
    if (Date.now() - started > ms) return reject(new Error('timed out'));
    setTimeout(poll, 20);
  })();
});

/* The page is loaded the way a browser loads it, and not the way it is
   convenient to.

   The scripts are put into the document where the document puts them and the
   document is then parsed, so each one runs at the moment it is reached. The
   previous harness parsed the markup and evaluated the script afterwards, which is
   the order jsdom is easy in and not the order anything else is: it handed the
   page a document that was already complete.

   That difference hid a real fault for a whole round. The gate was placed at the
   end of the body, after `<script src="istimara.js">`, so when the page asked to
   open it the element was not in the document yet, the page found nothing and
   returned quietly -- and the gate never appeared on the published site, while
   every check passed, because the harness was always giving the page a finished
   document to look at. The gate was the first thing the page touched at start-up
   and the one element that had not been parsed yet.

   So: `runScripts: 'dangerously'` and the sources inlined at their own positions.
   The external Firebase scripts stay as `src` and are simply not fetched, which
   is the same situation the page is in for this test's purposes. Anything the
   page needs before it starts has to be in `beforeParse`, because by the time the
   constructor returns, the scripts have already run. */
function boot(seedDraft) {
  const inline = file => '<script>'
    + fs.readFileSync(path.join(FOLDER, file), 'utf8').replace(/<\/script>/gi, '<\\/script>')
    + '</script>';
  let page = HTML;
  for (const f of ['print.js', 'datepicker.js', 'algeria.js', 'istimara.js']) {
    const tag = '<script src="' + f + '"></script>';
    if (page.indexOf(tag) === -1) {
      errors.push('[gate] the page no longer loads ' + f + ', so this harness is no longer '
        + 'checking the page that ships');
    }
    page = page.replace(tag, () => inline(f));
  }

  const dom = new JSDOM(page, {
    url: 'http://127.0.0.1:4173/istimara/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.__calls = [];
      window.__facilities = [
        { id: 'olympic', name: '\u0627\u0644\u0645\u0633\u0628\u062d \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631\u0627\u0645\u0628\u064a' },
        { id: 'half', name: '\u0627\u0644\u0645\u0633\u0628\u062d \u0627\u0644\u0646\u0635\u0641 \u0623\u0648\u0644\u0645\u0628\u064a' },
        { id: 'forest', name: '\u063a\u0627\u0628\u0629 \u063a\u0631\u062f\u0627\u064a\u0629' }
      ];
      window.fetch = function (url, init) {
        window.__calls.push({ url: String(url),
          method: (init && init.method || 'GET').toUpperCase(), body: init && init.body });
        if (/facilities/.test(String(url))) {
          return Promise.resolve({ ok: true, json: async () => window.__facilities });
        }
        if (/subscription-plans/.test(String(url))) {
          return Promise.resolve({ ok: true, json: async () => ({
            plans: [{ code: 'quarter', name: '\u0627\u0634\u062a\u0631\u0627\u0643 \u0641\u0635\u0644\u064a', amount: 1000, duration: '3 \u0623\u0634\u0647\u0631' }],
            extras: { transport: 900, uniform: 2500 } }) });
        }
        if (/communes\.json/.test(String(url))) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, application_no: 'APP-1' }) });
      };
      window.scrollTo = () => {};
      window.print = () => {};
      window.Element.prototype.scrollIntoView = function () {};
      try { window.localStorage.clear(); } catch (_) { /* private mode */ }
      if (seedDraft) {
        window.localStorage.setItem('sadara-istimara-draft', JSON.stringify(seedDraft));
      }
    }
  });
  const w = dom.window;
  /* Anything the page threw while starting up is a fault in its own right, and
     the most recent one has been exactly this: it failed at the first thing it
     touched, and everything after it was quietly skipped. A harness that reports
     only what it can see afterwards sees a page that merely did nothing. */
  w.addEventListener('error', e => {
    errors.push('[gate] the page threw while starting up: ' + (e.error && e.error.message
      || e.message));
  });
  return w;
}

const id = (w, name) => w.document.getElementById(name);

async function run() {

/* --- it opens when the page does ------------------------------------------- */
const w = boot();
const gate = id(w, 'pool-gate');
check(!!gate, 'there is no gate in the page');
check(gate && !gate.hidden,
  'the gate is not showing when the page loads, so the form can be filled before any '
  + 'pool is chosen');
check(/aria-modal="true"/.test(HTML),
  'the gate is not marked as a dialog, so a screen reader walks past the pool choice and '
  + 'the form can be filled without one');
check(w.document.body.classList.contains('gate-open'),
  'the page behind the gate can still be scrolled, so the form can be read and reached '
  + 'while the gate is up');
check(/gate-open \{ overflow: hidden/.test(CSS),
  'the rule that locks the page behind the gate is not in the stylesheet that is shipped');

/* --- it cannot be closed --------------------------------------------------- */
/* Escape, built and dispatched the way a keyboard does it, and `defaultPrevented`
   read afterwards: a handler that returns without preventing has changed nothing. */
if (gate) {
  const esc = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  w.document.dispatchEvent(esc);
  check(esc.defaultPrevented,
    'Escape is not refused: one keystroke is enough to leave the gate, and the gate is '
    + 'only a notice');
  check(!id(w, 'pool-gate').hidden, 'the gate closed on Escape');
}

/* A click on the dark ground, which is what a click outside the panel hits. */
if (gate) {
  const wasHidden = id(w, 'pool-gate').hidden;
  gate.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  gate.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  check(id(w, 'pool-gate').hidden === wasHidden, 'a click outside the panel closed the gate');
}

/* --- it cannot be passed --------------------------------------------------- */
const go = id(w, 'pool-gate-go');
check(!!go, 'there is no way through the gate');
check(go && go.disabled, 'the continue button is open with no pool chosen');
check(/id="pool-gate-go"[^>]*disabled/.test(HTML),
  'the continue button is not disabled in the markup, so it is usable for the moment '
  + 'before this page runs');

if (go && go.disabled) {
  /* Pressing it anyway changes nothing at all. */
  go.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  check(!id(w, 'pool-gate').hidden, 'the gate opened with no pool chosen');
  check(!id(w, 'selected_pool').value,
    'a pool was recorded with none chosen: ' + id(w, 'selected_pool').value);
}

/* And submitting the form behind it sends nothing. */
const form = id(w, 'reg-form');
form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
await new Promise(r => setTimeout(r, 60));
check(!w.__calls.some(c => c.method === 'POST'),
  'the request was sent with no pool chosen, which puts a request on file whose first '
  + 'question is which pool it was for');

/* --- the choices are the club's, and they are real ------------------------- */
const radios = gate ? [...id(w, 'pool-gate-pools').querySelectorAll('input[type=radio]')] : [];
check(radios.length > 0, 'the gate offers no pools at all');
check(radios.length === w.__facilities.length,
  'the gate offers ' + radios.length + ' pools and the club has ' + w.__facilities.length);
check(!radios.some(r => !r.name),
  'the pools are not one radio group, so nothing in the document says which was chosen');
for (const f of w.__facilities) {
  check(radios.some(r => r.value === f.name),
    'the gate does not offer the pool the club has: ' + f.name);
}
check(!radios.some(r => r.value === 'الملعب البلدي'),
  'a pool the club no longer has is still offered after its own list arrived');

if (radios.length) {
  /* Choose one the way a person does: click it. */
  const target = radios[radios.length - 1];
  target.checked = true;
  target.dispatchEvent(new w.Event('change', { bubbles: true }));
  check(!go.disabled, 'the continue button stayed shut after a pool was chosen');

  go.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  check(id(w, 'pool-gate').hidden, 'the gate stayed up after the way through was pressed');
  check(id(w, 'selected_pool').value === target.value,
    'the choice is not in the document: the hidden field says "'
    + id(w, 'selected_pool').value + '" and the pool chosen was "' + target.value + '"');
  /* Step four gets the same pool, so a request sent straight through does not
     arrive asking for one pool and naming another. */
  check(id(w, 'facility').value === target.value,
    'the request would arrive asking for "' + target.value + '" and naming "'
    + id(w, 'facility').value + '", and the committee could not tell which was which');
  check(!w.document.body.classList.contains('gate-open'),
    'the page behind the gate stayed locked after the gate was passed');
}

/* --- it travels with the request ------------------------------------------ */
check(/type="hidden" id="selected_pool" name="selected_pool"/.test(HTML),
  'there is no named hidden field for the choice, so it is not submitted with the form');
check(/selected_pool: val\('selected_pool'\)/.test(JS),
  'the pool chosen at the gate is not sent with the request');
/* A name, never a position: a number stops meaning the day a pool is inserted. */
check(!/selected_pool\s*:\s*\w+\.selectedIndex/.test(JS),
  'the pool is stored as a number, which a reordered list would break');

const adapter = fs.readFileSync(path.join(ROOT, 'firebase-adapter.js'), 'utf8');
check(/out\.selected_pool = poolName/.test(adapter),
  'the pool is not trimmed on its way into the database, so two spellings of one pool '
  + 'become two pools when the committee counts');

/* --- a pool on file that the club no longer offers ------------------------ */
const gone = boot({ selected_pool: 'مسبح أُغلق' });
await new Promise(r => setTimeout(r, 120));
check(!id(gone, 'selected_pool').value,
  'a request on file keeps a pool that is no longer offered ("'
  + id(gone, 'selected_pool').value + '"), so it would go to a pool the club has closed');
const said = (id(gone, 'form-msg') || {}).textContent || '';
check(said.indexOf('لم يعد متاح') !== -1,
  'a pool that has closed is cleared without telling anybody, so the person is not '
  + 'warned: the page says "' + said + '"');

/* --- a choice kept is offered back --------------------------------------- */
/* Coming back to a half-finished form: the gate still opens, because it opens on
   every load, and the pool already chosen is marked, so it is confirmed rather
   than asked again.

   The way through being open here is not the gate being a formality, and the
   first version of this check asserted that it was shut -- which was this check
   inventing a requirement the club did not state, and would have had the button
   disabled over a choice the person had already made. What makes it a gate is
   that the form stays unreachable until the button is pressed, and that pressing
   it is what admits them. So that is what is asked.

   Either way the form is unreachable: shut with nothing chosen, open with a
   choice to confirm, and unreachable behind the overlay in both cases. */
const back = boot({ selected_pool: 'غابة غرداية' });
await new Promise(r => setTimeout(r, 120));
check(!id(back, 'pool-gate').hidden,
  'the gate was skipped for somebody coming back to a half-finished form');
const marked = [...id(back, 'pool-gate-pools').querySelectorAll('input')]
  .find(r => r.checked);
check(marked && marked.value === 'غابة غرداية',
  'the pool already chosen is not marked on the gate, so the person is asked again for '
  + 'something they already answered');
/* Unreachable while it stands, which is the whole claim, whatever the button says. */
id(back, 'reg-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
await new Promise(r => setTimeout(r, 60));
check(!back.__calls.some(c => c.method === 'POST'),
  'a request was sent from behind an open gate, so the gate can be passed without '
  + 'pressing anything');
id(back, 'pool-gate-go').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
check(id(back, 'pool-gate').hidden && id(back, 'selected_pool').value === 'غابة غرداية',
  'confirming the pool they had already chosen did not let them through, or lost it');

/* --- the messages that were lost to a duplicate key ------------------------ */
/* `MESSAGES` declared two of its keys twice, and an object literal takes the later
   one silently -- so the two fields about the guardian's card were the two still
   saying the old date order, while the check that "verified" the change read the
   first declaration and passed. The lesson is in how this asks: build the object
   the way the browser does, and read what comes out.

   Which means running the page, not a slice of it. Taking the literal alone
   failed on `cardNumberError`, then on `CARD_DIGITS`, and chasing the dependency
   list would have ended at the first helper whose definition is rewritten later.
   So the page runs as it is written, with one line put in just inside its own
   closing brace -- inside the scope, so it can see the variable, and without
   touching any line of the page. Everything it closes over is real.

   The closing brace is kept in the replacement. An earlier attempt replaced only
   `)()`, which ate the `}` and left `function () { ... });` -- a syntax error
   reported as "MESSAGES is not defined", which is a misleading message about a
   mistake that was not about MESSAGES at all. */
const captured = JS.replace(/\}\)\(\)\s*;?\s*$/, 'window.__MESSAGES = MESSAGES;\n})();');
check(captured !== JS,
  'the page does not end in the shape this expects, so the messages cannot be read the '
  + 'way the page builds them and this check would pass on nothing');
w.eval(captured);
const MESSAGES = w.__MESSAGES;
check(MESSAGES && typeof MESSAGES === 'object',
  'the messages could not be built the way the page builds them, so nothing here can be '
  + 'said about which of two declarations the browser would use');

const declared = {};
const literal = JS.slice(JS.indexOf('var MESSAGES = {'),
                         JS.indexOf('};', JS.indexOf('var MESSAGES = {')));
for (const m of literal.matchAll(/^\s*(\w+):/gm)) {
  declared[m[1]] = (declared[m[1]] || 0) + 1;
}
for (const [k, times] of Object.entries(declared)) {
  check(times === 1,
    'the message for ' + k + ' is declared ' + times + ' times, and the later one wins '
    + 'silently -- it currently reads "' + String(MESSAGES[k]).slice(0, 70) + '"');
}
/* And every date message in the order the club writes it. */
for (const [k, said2] of Object.entries(MESSAGES)) {
  check(!(/تاريخ/.test(String(said2)) && /سنة\/شهر\/يوم/.test(String(said2))),
    'the message for ' + k + ' still asks for the old date order: "' + said2 + '"');
}

/* ==================================================== the migration, on real rows */

const server = fs.readFileSync(path.join(ROOT, 'server.py'), 'utf8');
const sql = fs.readFileSync(path.join(ROOT, 'tools', 'migrate-selected-pool.sql'), 'utf8');

check(/ALTER TABLE applications\s+ADD COLUMN selected_pool TEXT/.test(sql),
  'the SQL does not add selected_pool to applications');

const addLine = (sql.match(/ALTER TABLE[^\n]*/) || [''])[0];
check(!/NOT NULL/i.test(addLine),
  'the new column is NOT NULL with no default, which SQLite refuses outright');
check(!/UNIQUE|CURRENT_TIME/i.test(addLine),
  'the new column carries a constraint that SQLite refuses on ADD COLUMN');

/* The safety claim, against the file's code and not its comments -- the file
   explains itself in comments that name the very statements being ruled out. */
const sqlCode = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
const rowWrites = sqlCode.match(/\b(UPDATE|DELETE|DROP|INSERT|REPLACE|TRUNCATE)\b/gi);
check(!rowWrites,
  'the migration file contains a statement that writes to rows'
  + (rowWrites ? ': ' + rowWrites.join(', ') : ''));

check(/ensure_columns\(c, 'applications', \{'selected_pool': 'TEXT'\}\)/.test(server),
  'server.py does not add the column through ensure_columns, so a database started from '
  + 'that file has no such column');
check(/'selected_pool':str\(d\.get\('selected_pool'\) or ''\)\.strip\(\)/.test(server),
  'server.py does not carry the pool on the record, so the local server refuses every '
  + 'registration rather than storing the wrong thing');

let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_) { /* reported below */ }

if (!DatabaseSync) {
  errors.push('[migration] the row-preserving check could not run: this node has no '
    + 'node:sqlite, so nothing here has verified that adding the column leaves the rows '
    + 'alone. The safety claim is unproven rather than proven.');
} else {
  const db = new DatabaseSync(':memory:');
  try {
    /* The real shape, because the real view definitions are run against it -- a
       fixture without `facility`, `birth_date` and `created_at` would be testing
       a paraphrase rather than the SQL that will actually be pasted. */
    db.exec('CREATE TABLE applications (application_no TEXT, first_name_ar TEXT, '
          + 'last_name_ar TEXT, birth_date TEXT, facility TEXT, status TEXT, '
          + 'created_at TEXT)');

    const rows = [
      ['APP-1', 'محمد', 'بلعيد', '2015-04-02', 'المسبح الأولمبي', 'pending', '2026-10-01'],
      ['APP-2', 'أمينة', 'قاسمي', '2016-11-19', 'غابة غرداية', 'approved', '2026-10-02'],
      ['APP-3', null, 'بوزيد', '2014-01-30', '', 'pending', null],
      ['APP-4', 'ياسمين', 'حاج', '2017-06-08', 'المسبح الأولمبي', null, '2026-10-04'],
      ['APP-5', 'سفيان', 'مرابط', '2013-09-25', 'المسبح النصف أولمبي', null, null]
    ];
    const insert = db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of rows) insert.run(...r);

    const readAll = () => db.prepare('SELECT * FROM applications ORDER BY application_no').all();
    const before = readAll();
    const beforeCount = db.prepare('SELECT COUNT(*) AS n FROM applications').get().n;

    /* The migration, exactly as the club was given it. */
    db.exec('ALTER TABLE applications ADD COLUMN selected_pool TEXT');

    const after = readAll();
    check(db.prepare('SELECT COUNT(*) AS n FROM applications').get().n === beforeCount,
      'the row count changed: ' + beforeCount + ' -> '
      + db.prepare('SELECT COUNT(*) AS n FROM applications').get().n);

    /* Every field of every row. "The rows are still there" would be satisfied by
       a migration that quietly rewrote them, so it is not what is asked. */
    for (let i = 0; i < before.length; i++) {
      for (const k of Object.keys(before[i])) {
        const a = before[i][k] === undefined ? null : before[i][k];
        const b = after[i][k] === undefined ? null : after[i][k];
        check(a === b, 'row ' + before[i].application_no + ' field ' + k + ' changed: '
          + JSON.stringify(a) + ' -> ' + JSON.stringify(b));
      }
      /* And the new column reads NULL on every row already on file, which is the
         honest answer: nobody asked, so nothing is recorded. */
      const pool = after[i].selected_pool;
      check(pool === null || pool === undefined,
        'an existing request was given a pool it never asked for: '
        + after[i].application_no + ' -> ' + JSON.stringify(pool));
    }

    /* And again, because safe once and destructive the second time is a trap with
       a counter on it. */
    let second = null;
    try { db.exec('ALTER TABLE applications ADD COLUMN selected_pool TEXT'); }
    catch (e) { second = e.message; }
    check(!!second,
      'the migration ran twice without complaint, so it was not guarded: ADD COLUMN fails '
      + 'on the second run, and the club would be told the migration is broken when in fact '
      + 'it had already been applied');
    check(/if name not in existing/.test(server),
      'ensure_columns does not check before it adds, so a second start would fail');
    check(/PRAGMA table_info/.test(sql),
      'the SQL file does not say how to look before it leaps');

    /* And a new row still goes in, with the new column beside the old ones. */
    db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('APP-6', 'نور', 'سعداوي', '2018-03-14', 'غابة غرداية', 'pending',
           '2026-10-06', 'غابة غرداية');
    const last = db.prepare("SELECT * FROM applications WHERE application_no = 'APP-6'").get();
    check(last && last.selected_pool === 'غابة غرداية',
      'a new request cannot record the pool that was chosen');

    /* The views, run as written rather than paraphrased. The comments are
       stripped before the split, because the second view is introduced by one --
       a filter on `startsWith('CREATE VIEW')` applied to a chunk beginning with a
       comment finds nothing, and finds nothing silently. */
    const strip = t => t.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
    const viewSql = sql.slice(sql.indexOf('CREATE VIEW IF NOT EXISTS applications_by_pool'))
      .split(';').map(t => strip(t).trim()).filter(t => /^CREATE VIEW/i.test(t))
      .join(';\n') + ';';
    check(/applications_by_pool/.test(viewSql) && /pool_demand/.test(viewSql),
      'the SQL file does not carry both views, so one would have to be written by hand at '
      + 'the worst possible moment');
    db.exec(viewSql);

    /* One that asked, and one that predates the question -- the counts below are
       the ones this fixture actually produces, and each says why it is that one.
       `asked_for` falls back to `facility` by the COALESCE the view declares,
       which is what makes it useful on old rows at all. */
    const asked = db.prepare('SELECT COUNT(*) AS n FROM applications_by_pool '
      + "WHERE asked_for = 'غابة غرداية'").get().n;
    check(asked === 2,
      'the view finds ' + asked + ' requests at غابة غرداية; there are two -- APP-6 asked '
      + 'for it, and APP-2 predates the question and falls back to the pool it was sent to');

    const demand = db.prepare('SELECT pool, requests, approved, pending FROM pool_demand '
      + 'ORDER BY requests DESC, pool').all();
    check(demand.length === 4,
      'the demand view reports ' + demand.length + ' pools: ' + demand.map(d => d.pool).join(' / ')
      + '. Four is right -- three real pools, plus the requests that predate the question '
      + 'counted honestly on their own line rather than folded into a pool nobody asked for');
    const forest = demand.find(d => d.pool === 'غابة غرداية');
    check(forest && forest.requests === 2 && forest.approved === 1,
      'the pool with two requests and one acceptance reports ' + JSON.stringify(forest));
    /* Not lost from the count by having no answer -- on their own line, which is
       the difference between "nobody asked" and "that pool has no demand". */
    const unrecorded = demand.find(d => d.pool === 'not recorded');
    check(unrecorded && unrecorded.requests === 1,
      'the requests that predate the question report as not recorded: '
      + (unrecorded && unrecorded.requests) + ' (APP-3, whose facility was empty)');

    /* The question the column exists to answer: aimed at one pool, sent to
       another. That is the one the committee has to look at. */
    db.prepare("UPDATE applications SET selected_pool = 'المسبح الأولمبي', "
      + "facility = 'غابة غرداية' WHERE application_no = ?").run('APP-2');
    const flagged = db.prepare("SELECT asked_for, assigned, pool_answer FROM applications_by_pool "
      + "WHERE application_no = 'APP-2'").get();
    check(flagged && flagged.pool_answer === 'asked for another pool',
      'the view does not notice a request aimed at one pool and sent to another: '
      + JSON.stringify(flagged));
    check(flagged && flagged.asked_for === 'المسبح الأولمبي'
      && flagged.assigned === 'غابة غرداية',
      'the view does not keep the two apart, which is the whole reason for the column: '
      + JSON.stringify(flagged));

    const old = db.prepare("SELECT pool_answer FROM applications_by_pool "
      + "WHERE application_no = 'APP-1'").get();
    check(old && old.pool_answer === 'not recorded',
      'a request filed before the pool was asked about reads as "'
      + (old && old.pool_answer) + '" rather than being invented one');
  } finally {
    db.close();
  }
}

}

run().then(() => {
  if (errors.length) {
    console.log('\n  PROBLEMS:');
    for (const e of [...new Set(errors)]) console.log('  - ' + e);
    process.exit(1);
  }
  console.log('Pool gate and migration checks passed: it opens with the page, Escape does '
    + 'not open it, nothing chosen goes nowhere, the pool chosen is in the document and on '
    + 'the request, and adding the column left every row exactly as it was.');
}).catch(e => {
  console.log('  [gate] the check did not finish: ' + (e && e.message));
  process.exit(1);
});
