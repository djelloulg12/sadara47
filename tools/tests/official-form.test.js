/* The official form, drawn, and read back off the page.

   The club reported that the parental-authorization section prints the guardian's
   day of birth where the child's belongs. The source said the right thing -- the
   mapping writes the swimmer's date -- and that is exactly why reading the source
   did not find it. A mapping can be right while the page draws it in the wrong
   box, or while a box on the scan is positioned over the wrong printed line.

   So the form is drawn with two dates that cannot be mistaken for each other, and
   the page is read back: what the mapping produced, and what was printed on it.

   The scan itself is a picture laid over the page. Which printed line a box sits
   on is therefore a question about the picture and not about the code, and it is
   answered here by looking, once, rather than by reading coordinates and hoping.
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
  console.log('SKIP  no Chrome on this machine, so the form was not drawn.');
  process.exit(0);
}

const SCRATCH = path.join(process.env.TEMP || '.', 'sadara-form-rehearsal');
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

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

const css = fs.readFileSync(path.join(SCRATCH, 'styles.css'), 'utf8');
fs.writeFileSync(path.join(SCRATCH, 'index.html'),
  '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
  + '<title>استمارة</title></head><body>'
  + '<script src="firebase-config.js"><\/script>'
  + '<script src="firebase-adapter.js"><\/script>'
  + '<script src="app.js"><\/script>'
  + '<script src="draw-form.js"><\/script>'
  + '</body></html>', 'utf8');

/* The form brings its own stylesheet; it is applied to the page so the geometry
   is the geometry that will print. */
fs.writeFileSync(path.join(SCRATCH, 'draw-form.js'),
  fs.readFileSync(path.join(ROOT, 'tools', 'form-rehearsal', 'draw-form.js'), 'utf8')
    .replace('</script>', '<\/script>'), 'utf8');

const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(SCRATCH, name);
  if (!file.startsWith(SCRATCH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Length': '0', 'Connection': 'close' }); res.end(); return;
  }
  const type = /\.html$/.test(file) ? 'text/html; charset=utf-8'
    : /\.css$/.test(file) ? 'text/css; charset=utf-8'
    : /\.js$/.test(file) ? 'text/javascript; charset=utf-8'
    : 'application/octet-stream';
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
});
server.listen(8343, '127.0.0.1');

/* A picture and Chrome run together; the server answering it is this process. */
const QUIET = [
  '--headless', '--disable-gpu', '--no-sandbox',
  '--disable-background-networking', '--disable-sync', '--disable-component-update',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--window-size=900,1300', '--virtual-time-budget=12000'
];

const child = spawn(CHROME, QUIET.concat([
  '--user-data-dir=' + path.join(process.env.TEMP || '.', 'sadara-form-draw'),
  '--screenshot=' + path.join(process.env.TEMP || '.', 'sadara-form.png'),
  '--dump-dom', 'http://127.0.0.1:8343/index.html'
]), { stdio: ['ignore', 'pipe', 'ignore'] });

let dom = '';
child.stdout.on('data', d => { dom += d.toString(); });
const giveUp = setTimeout(() => { try { child.kill(); } catch (_) {} }, 120000);

child.on('close', () => {
  clearTimeout(giveUp); server.close();

  const m = dom.match(/<pre id="form-report"[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) {
    console.log('FAIL  the form produced no report (' + dom.length + ' bytes of page)');
    process.exit(1);
  }
  const raw = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let report;
  try { report = JSON.parse(raw); } catch (e) {
    console.log('FAIL  the report is not readable: ' + e.message);
    process.exit(1);
  }

  console.log('      the child was born        : 2013-04-07');
  console.log('      the guardian was born     : 1978-11-02');
  console.log('      identity block prints     : ' + report.values.birth_date);
  console.log('      declaration prints        : ' + report.values.child_birth_date);
  console.log('      the line names            : ' + report.values.parent_name);
  console.log('');
  console.log('      what the page drew, by row:');
  for (const [row, text] of Object.entries(report.drawnByRow || {})) {
    console.log('        ' + String(row).padStart(4) + 'px  ' + text);
  }
  console.log('');
  if (report.problems.length) {
    console.log('FORM PROBLEMS (' + report.problems.length + '):');
    report.problems.forEach(p => console.log('  - ' + p));
    process.exit(1);
  }
  console.log("The declaration prints the swimmer's date.");
  process.exit(0);
});