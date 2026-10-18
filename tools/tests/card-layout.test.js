/* The card, measured in a real browser, from a command line.

   Everything else in this file checks the page in a DOM that has no layout engine,
   which means the shape of a membership card has never actually been checked --
   only whether the right words are in it. That is how a name came to be cut off
   with an ellipsis on every card the club printed, a footer fell off the bottom of
   every card, and forty-one millimetres of barcode got printed on the paper beside
   the card: all three visible on screen, all three invisible to a DOM.

   So this one runs Chrome. There is no screen: it asks for the rendered geometry,
   writes the answer into the page, and is read back from the dumped DOM. When
   there is no Chrome it says so and passes, rather than failing for a reason that
   has nothing to do with the club.
*/

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const problems = [];

const CHROME = [
  process.env.SADARA_CHROME,
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });

if (!CHROME) {
  console.log('SKIP  no Chrome on this machine, so the card was not measured.');
  console.log('      (the words on the card are still checked by the other suites)');
  process.exit(0);
}

/* Served over HTTP rather than opened as a file.

   The page loads the real application, and the application makes requests of its
   own. From a `file://` origin those are refused and the page never finishes
   starting, which looks exactly like a card that will not build -- and the check
   then reports a fault that is not in the card. So a short-lived server on a port
   nobody else is using, for the length of this one command, and then it is gone. */
/* The rehearsal is served from a flat scratch folder.

   The page needs the real stylesheet and the real page. Pointing it at them
   through `../../` from where it is kept produced a URL the browser could not
   resolve -- the path is Arabic, and it does not survive the trip -- and pointing
   it at `file://` produced nothing at all. So the four files it needs are copied
   into one empty folder beside each other, with plain names, and served from
   there. Nothing about the page changes; only where it is standing does. */
const SCRATCH = path.join(process.env.TEMP || '.', 'sadara-card-rehearsal');
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

for (const name of ['styles.css', 'app.js', 'firebase-config.js', 'firebase-adapter.js']) {
  fs.copyFileSync(path.join(ROOT, 'firebase-public', name), path.join(SCRATCH, name));
}
const page = fs.readFileSync(path.join(ROOT, 'tools', 'card-rehearsal', 'card-measure.html'), 'utf8')
  .replace(/(\.\.\/)+firebase-public\//g, '');
fs.writeFileSync(path.join(SCRATCH, 'index.html'), page, 'utf8');

const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(SCRATCH, name);
  if (!file.startsWith(SCRATCH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const type = /\.html$/.test(file) ? 'text/html; charset=utf-8'
    : /\.css$/.test(file) ? 'text/css; charset=utf-8'
    : /\.js$/.test(file) ? 'text/javascript; charset=utf-8'
    : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(file));
});

const port = 8341;
server.listen(port, '127.0.0.1');
const PAGE_URL = 'http://127.0.0.1:' + port + '/index.html';

/* Chrome is told to do nothing but render.

   Left alone it starts reaching for Google's background services on the way up --
   registration, synchronisation, component updates -- and on a machine with an
   interception certificate in the chain, or behind a slow one, it sits there until
   the command times out and produces nothing at all. The result would be read as
   "the card would not build", which is not what happened and is not a fault in
   the card. */
const QUIET = [
  '--headless', '--disable-gpu', '--no-sandbox',
  '--disable-background-networking', '--disable-sync', '--disable-component-update',
  '--disable-default-apps', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-client-side-phishing-detection',
  '--virtual-time-budget=8000'
];

const { spawn } = require('child_process');

/* Chrome is run without waiting for it, and the page is served while it runs.

   The obvious way to do this -- run Chrome and block until it answers -- cannot
   work here, and the reason is worth writing down: the server answering Chrome is
   this same process, and blocking until Chrome finishes is blocking until this
   process answers a request it is not reading. Chrome waits for a page, the page
   waits for a server, and the server is asleep inside its own wait. It does not
   time out politely; it simply never makes the request at all.

   So the browser is started and the process keeps serving. */
function renderAndDump(url) {
  return new Promise(resolve => {
    const child = spawn(CHROME, QUIET.concat([
      '--user-data-dir=' + path.join(process.env.TEMP || '.', 'sadara-card-measure'),
      '--dump-dom', url
    ]), { stdio: ['ignore', 'pipe', 'ignore'] });

    let out = '';
    child.stdout.on('data', d => { out += d.toString(); });

    const giveUp = setTimeout(() => { try { child.kill(); } catch (_) {} }, 100000);
    child.on('error', e => { clearTimeout(giveUp); resolve({ error: String(e.message).slice(0, 200) }); });
    child.on('close', () => { clearTimeout(giveUp); resolve({ dom: out }); });
  });
}

renderAndDump(PAGE_URL).then(result => {
  server.close();

  if (result.error) {
    console.log('FAIL  Chrome would not render the card: ' + result.error);
    process.exit(1);
  }
  check(result.dom);
}).catch(e => {
  server.close();
  console.log('FAIL  the measurement itself broke: ' + String(e && e.message || e).slice(0, 200));
  process.exit(1);
});

function check(dom) {
const problems = [];
const m = dom.match(/<pre id="report">([\s\S]*?)<\/pre>/);
if (!m) {
  problems.push('the measuring page produced no report at all');
} else {
  const raw = m[1]
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let report = null;
  try { report = JSON.parse(raw); } catch (e) {
    problems.push('the report is not readable as a measurement: ' + e.message);
  }
  if (report) {
    if (!report.card) {
      problems.push('the card was never measured: ' + (report.problems || []).join('; '));
    } else {
      console.log('      card            : ' + report.card.w + ' x ' + report.card.h + ' px');
      if (report.name) {
        console.log('      name            : needs ' + report.name.scrollW + ' x ' + report.name.scrollH
          + ', has ' + report.name.clientW + ' x ' + report.name.clientH);
      }
      if (report.barcode) {
        console.log('      barcode         : ' + report.barcode.w + ' x ' + report.barcode.h
          + ', ' + report.barcode.darkColumns + ' dark columns, ' + report.barcode.transitions
          + ' edges, quiet ' + report.barcode.quietLeft + '/' + report.barcode.quietRight);
      }
      (report.problems || []).forEach(p => problems.push('the card: ' + p));

      /* Ten of these have to fit an A4 page: five rows of the card's height plus the
         page's own margins. Measured here rather than assumed, because the card used
         to be a fixed height that its contents did not fit inside. */
      const mm = report.card.h / 96 * 25.4;
      const page = 5 * mm + 2 * 12;
      console.log('      ten on A4       : ' + mm.toFixed(1) + ' mm each, ' + page.toFixed(0)
        + ' mm of 297 -- ' + (page <= 297 ? 'fits' : 'DOES NOT FIT'));
      if (page > 297) problems.push('ten cards need ' + page.toFixed(0) + ' mm and an A4 page has 297');

      /* The same information printed more than once is not a layout, it is a card
         with a third of itself given up to one fact. Counted from what is actually
         on the card, and printed, so a count that was never taken cannot be
         mistaken for a count of zero. */
      const texts = report.texts || {};
      if (!Object.keys(texts).length) {
        problems.push('the card was measured for repetition and nothing was counted');
      }
      for (const [label, count] of Object.entries(texts)) {
        console.log('      ' + label.padEnd(26) + ' printed ' + count + ' time(s)');
        if (count > 1) problems.push('the ' + label + ' is printed ' + count + ' times on one card');
      }
    }
  }
}

if (problems.length) {
  console.log('\nCARD LAYOUT PROBLEMS (' + problems.length + '):');
  [...new Set(problems)].forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('\nThe card fits itself, the name is whole, and the barcode is on the paper.');
process.exit(0);
}