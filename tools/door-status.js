/* Close the door for real, once, and prove it, against the published page.

   The rule is published and the page is published, and neither of those is the
   door being shut. So this opens the club's own registration page in a real
   browser and asks the question a visitor asks -- and it is read from the page,
   not from the source, because the source is not what the visitor gets.

   There is no stub here and no handler. Nothing is written: this only says what
   the door is, so that the state can be confirmed rather than assumed. Turning it
   is the switch's job, and the switch now reads the server's answer and says so
   when it is refused. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const SITE = process.env.SADARA_SITE || 'https://sadara-platform-774c8.web.app';
const PAGE = SITE + '/istimara/';
const WANT = process.argv.includes('--open') ? true : false;
const PROJECT = process.env.SADARA_PROJECT || 'sadara-platform-774c8';
const REST = 'https://firestore.googleapis.com/v1/projects/' + PROJECT
  + '/databases/(default)/documents/config/registration';

const CHROME = [
  process.env.SADARA_CHROME,
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });

if (!CHROME) {
  console.log('SKIP  no Chrome on this machine, so the published page was not opened.');
  process.exit(0);
}

/* The one thing this adds to the page: it writes down what it found, so the answer
   can be read out of the dump. It changes nothing else -- no stubbed request, no
   hidden form, nothing about how the page decides. */
const READER = `<script>
addEventListener('load', function () {
  setTimeout(function () {
    var pre = document.createElement('pre');
    pre.id = 'door-read';
    pre.style.display = 'none';
    document.body.appendChild(pre);
    try {
      var form = document.getElementById('reg-form');
      var notice = document.querySelector('.door-closed-page');
      var hidden = !!(form && (form.hidden || getComputedStyle(form).display === 'none'));
      var answer = {
        formHidden: hidden,
        notice: !!notice,
        noticeText: notice ? (notice.querySelector('h1') || {}).textContent : null,
        title: document.title
      };
      pre.textContent = JSON.stringify(answer);
    } catch (e) {
      pre.textContent = JSON.stringify({ error: String((e && e.message) || e) });
    }
  }, 3500);
});
</script>`;

const SCRATCH = path.join(os.tmpdir(), 'sadara-door-status');
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

/* The published page, fetched as a visitor fetches it, with one line added so the
   answer can be read out of the dump. Nothing is stubbed: the request the page
   makes is the real one, to the real database, with no session -- which is the
   only way to see what a family sees. */
https.get(PAGE, res => {
  let html = '';
  res.on('data', d => { html += d; });
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.log('NOT MEASURED  the published page answered HTTP ' + res.statusCode + '.');
      process.exit(0);
    }
    const patched = html.replace('</head>', READER + '\n</head>');
    const file = path.join(SCRATCH, 'index.html');
    fs.writeFileSync(file, patched, 'utf8');

    const server = require('http').createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(patched);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const chrome = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--disable-background-networking', '--disable-sync', '--no-first-run',
        '--virtual-time-budget=12000',
        `--user-data-dir=${path.join(SCRATCH, 'profile')}`,
        '--window-size=1280,900',
        '--dump-dom', `http://127.0.0.1:${port}/`
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      let out = '';
      chrome.stdout.on('data', d => { out += d; });
      chrome.on('close', async () => {
        server.close();
        const m = out.match(/<pre id="door-read"[^>]*>([\s\S]*?)<\/pre>/);
        if (!m) { console.log('NOT MEASURED  the published page produced no answer.'); return process.exit(0); }
        let row;
        try {
          row = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
        } catch (e) { console.log('NOT MEASURED  the answer is not readable: ' + e.message); return process.exit(0); }
        if (row.error) { console.log('NOT MEASURED  reading the page threw: ' + row.error); return process.exit(0); }

        /* Whether the door is readable by a visitor at all, asked from outside
           with no session and no credentials -- which is exactly the case the rule
           is written for.

           Asked here and not from inside the page because the page cannot answer
           it: the adapter catches a failed reading and opens the door, because a
           door that shuts itself when the network is down stops a season. That is
           the right default, and it makes "open" ambiguous -- an open door and an
           unreadable door are the same thing to a visitor, and they were the same
           thing to this check for a season. */
        const raw = await new Promise(resolve => {
          https.get(REST, res => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
          }).on('error', () => resolve(null));
        });
        if (!raw) {
          console.log('    the door document could not be asked about from here.');
        } else if (raw.status === 200) {
          let open = true;
          try {
            const f = JSON.parse(raw.body).fields || {};
            open = !(f.open && f.open.booleanValue === false);
          } catch (_) { /* a document with nothing in it is an open door */ }
          console.log('    a visitor with no session and no credentials READ the door document'
            + ' -- and it says ' + (open ? 'open' : 'shut')
            + '. A refused reading is no longer being taken for an open door.');
        } else if (raw.status === 429) {
          /* Not a refusal. The daily read quota is spent, which is a different
             thing entirely -- and a tool that cannot tell them apart will one day
             report the rules as closed to a visitor on the strength of a quota
             blip. */
          console.log('    the door document could not be asked about right now: the'
            + ' daily read quota is spent (HTTP 429). That is not a refusal, and no'
            + ' conclusion is drawn from it.');
        } else {
          console.log('    a visitor with no session was REFUSED the door document (HTTP '
            + raw.status + '). So "open" above would mean the reading failed, not that'
            + ' the club opened it -- which is what it meant for a whole season.');
        }
        console.log('');
        const shut0 = row.formHidden && row.notice;
        console.log('  the published page, opened as a visitor, with no session:');
        console.log('    the form is ' + (row.formHidden ? 'gone' : 'STILL ON THE PAGE'));
        console.log('    the announcement is ' + (row.notice ? 'there' : 'not there'));
        if (row.noticeText) console.log('    it says: ' + String(row.noticeText).trim().slice(0, 80));
        console.log('    the tab says: ' + row.title);
        console.log('');
        const shut = shut0;
        console.log(shut
          ? 'The door is SHUT. A family opening the registration page now reads the notice and not a form.'
          : 'The door is OPEN. A family opening the registration page now reads the form.');
        console.log('To ' + (shut ? 'open' : 'shut') + ' it: settings, the switch beside باب التسجيلات.');
        process.exit(0);
      });
    });
  });
}).on('error', e => {
  console.log('NOT MEASURED  the published page could not be reached from here: ' + e.message);
  process.exit(0);
});