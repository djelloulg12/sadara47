/* Walking the whole platform in a browser, at the size a person sees it.

   The club's complaint was that on some pages the buttons are below the fold --
   you have to scroll to reach the rest of them. Nobody had looked, because every
   other check runs in a DOM with no layout engine, where a page with a button
   three screens down is indistinguishable from a page whose buttons are all in
   view.

   So this renders every page with a season's worth of people on it, at a window a
   person could actually be looking through, and counts what is out of reach. It
   is the check that would have found that on the day it was built.

   Skipped, not failed, where there is no browser: a machine without Chrome cannot
   measure a layout, and saying so is more useful than a green tick that means
   nothing happened.
*/

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const CHROME = [
  process.env.SADARA_CHROME,
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });

if (!CHROME) {
  console.log('SKIP  no Chrome on this machine, so the pages were not measured.');
  process.exit(0);
}

const SCRATCH = path.join(process.env.TEMP || '.', 'sadara-page-rehearsal');
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

/* The whole site into one flat folder, under the names the page asks for. The
   path of the repository is Arabic and does not survive being put in a URL; a
   folder of copies with plain names does. */
function copyTree(from, into) {
  fs.mkdirSync(into, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (name === 'node_modules' || name === '.git') continue;
    const src = path.join(from, name);
    const dst = path.join(into, name);
    if (fs.statSync(src).isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}
copyTree(path.join(ROOT, 'firebase-public'), SCRATCH);

/* The platform's own page, with the walk appended to it.

   A page invented for the rehearsal does not have the shell the application draws
   into, so every render came back empty, nothing was measured, and the walk
   reported the whole platform as clean. The measurement runs inside the real page
   and is added as one more script at the end of it. */
const index = fs.readFileSync(path.join(SCRATCH, 'index.html'), 'utf8');
if (!/<\/body>/i.test(index)) {
  console.log('FAIL  the platform page has no body to add a script to.');
  process.exit(1);
}
fs.writeFileSync(path.join(SCRATCH, 'index.html'),
  index.replace(/<\/body>/i, '  <script src="page-audit.js"></script>\n</body>'), 'utf8');
fs.copyFileSync(path.join(ROOT, 'tools', 'page-rehearsal', 'audit.js'),
  path.join(SCRATCH, 'page-audit.js'));

const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'audit.html';
  const file = path.join(SCRATCH, name);
  if (!file.startsWith(SCRATCH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Length': '0', 'Connection': 'close' }); res.end(); return;
  }
  const type = /\.html$/.test(file) ? 'text/html; charset=utf-8'
    : /\.css$/.test(file) ? 'text/css; charset=utf-8'
    : /\.js$/.test(file) ? 'text/javascript; charset=utf-8'
    : /\.css$/.test(file) ? 'text/css' : 'application/octet-stream';
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
});

const port = 8342;
server.listen(port, '127.0.0.1');

/* Chrome is started, not waited on: the server answering it is this same process,
   and blocking here would put it to sleep until Chrome gave up. */
const QUIET = [
  '--headless', '--disable-gpu', '--no-sandbox',
  '--disable-background-networking', '--disable-sync', '--disable-component-update',
  '--disable-default-apps', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-client-side-phishing-detection',
  '--window-size=1366,768', '--virtual-time-budget=20000'
];

const child = spawn(CHROME, QUIET.concat([
  '--user-data-dir=' + path.join(process.env.TEMP || '.', 'sadara-page-audit'),
  '--dump-dom', 'http://127.0.0.1:' + port + '/index.html'
]), { stdio: ['ignore', 'pipe', 'ignore'] });

let out = '';
child.stdout.on('data', d => { out += d.toString(); });
const giveUp = setTimeout(() => { try { child.kill(); } catch (_) {} }, 150000);

child.on('error', e => {
  clearTimeout(giveUp); server.close();
  console.log('FAIL  Chrome would not start: ' + String(e.message).slice(0, 160));
  process.exit(1);
});

child.on('close', () => {
  clearTimeout(giveUp); server.close();

  /* The report carries a style attribute, so the tag is matched loosely rather
     than exactly. An exact match here would find nothing and be read as a page
     that could not be measured -- which is the failure it was written to catch. */
  const m = out.match(/<pre id="page-audit-report"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) {
    console.log('FAIL  the walk produced no report at all (' + out.length + ' bytes of page)');
    console.log('      A walk that did not report is a walk that did not happen, and it is');
    console.log('      never reported as clean.');
    process.exit(1);
  }
  const raw = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let report;
  try { report = JSON.parse(raw); } catch (e) {
    console.log('FAIL  the report is not readable: ' + e.message);
    process.exit(1);
  }

  console.log('      window: ' + (report.pages[0] ? report.pages[0].viewport.w + ' x ' + report.pages[0].viewport.h : '?'));
  console.log('');
  /* A page that did not render carries none of these. Saying "zero below the fold"
     about a page that never opened is the exact lie this check exists to stop. */
  for (const p of report.pages) {
    const findings = p.findings || [];
    const unmeasured = findings.some(f => /did not render/.test(f));
    console.log('  ' + (findings.length ? 'WORRY' : 'ok   ')
      + '  ' + (p.page + '/' + p.role).padEnd(22)
      + (p.error ? ' ERROR ' + String(p.error).slice(0, 40) : '')
      + (p.drew ? '  drew: ' + p.drew : '')
      + (p.tables && p.tables.length
        ? '  | page ' + (p.pageScrolls ? 'scrolls' : 'holds')
        + ', list ' + (p.tables[0].scrolls ? 'scrolls' : 'fits')
        + ' (' + p.tables[0].h + ' of ' + p.tables[0].content + 'px)'
        : '')
      + (unmeasured ? ' NOT MEASURED'
        : '  ' + String(p.belowFold || 0).padStart(3) + ' below the fold'
        + '  ' + String(p.offscreen || 0).padStart(3) + ' past the edge'
        + '  ' + String((p.cut || []).length).padStart(3) + ' cut'
        + '  ' + String((p.tiny || []).length).padStart(3) + ' too small'));
    for (const f of findings) console.log('           - ' + f);
    for (const b of (p.belowFoldExamples || [])) {
      console.log('           below: <' + b.el + '> "' + b.text + '" at ' + b.top + 'px');
    }
    for (const c of (p.cut || [])) console.log('           cut: ' + c.el + ' "' + c.text + '" by ' + c.by + 'px');
    for (const t of (p.tiny || [])) console.log('           small: ' + t.el + ' "' + t.text + '" ' + t.w + 'x' + t.h);
  }

  if (report.problems.length) {
    console.log('\nPAGE PROBLEMS (' + report.problems.length + '):');
    [...new Set(report.problems)].slice(0, 40).forEach(p => console.log('  - ' + p));
    process.exit(1);
  }
  console.log('\nEvery page fits the window it is shown in.');
  process.exit(0);
});