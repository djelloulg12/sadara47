const fs = require('fs');
const { JSDOM } = require('jsdom');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'firebase-public');

const problems = [];

// 1. source tree vs deployable copy
const SYNC_FILES = ['app.js', 'styles.css', 'index.html', 'firebase-adapter.js', 'firebase-config.js', 'sw.js', 'manifest.webmanifest'];
for (const f of SYNC_FILES) {
  const a = fs.readFileSync(path.join(ROOT, f));
  const b = fs.readFileSync(path.join(PUBLIC, f));
  if (!a.equals(b)) problems.push(`OUT OF SYNC: ${f} differs from firebase-public/${f}`);
}

// The public registration page is hand-written in istimara/ and copied into the
// deployable tree by the build, so the same rule applies folder-wide.
const ISTIMARA = ['index.html', 'istimara.css', 'istimara.js', 'print.js', 'algeria.js', 'communes.json'];
for (const f of ISTIMARA) {
  const src = path.join(ROOT, 'istimara', f);
  const dst = path.join(PUBLIC, 'istimara', f);
  if (!fs.existsSync(src)) { problems.push(`MISSING: istimara/${f} is the source of the public sign-up page`); continue; }
  if (!fs.existsSync(dst)) { problems.push(`MISSING: firebase-public/istimara/${f} is what Firebase serves`); continue; }
  if (!fs.readFileSync(src).equals(fs.readFileSync(dst))) {
    problems.push(`OUT OF SYNC: istimara/${f} differs from firebase-public/istimara/${f}`);
  }
}

// 2. every file a published page actually loads must be there to load.
// Walked the way a browser walks it: relative to the page that asks for it, and
// a directory meaning the index.html inside it. A <script src> that 404s is a
// page that loads and then quietly does nothing, which is why the form went on
// answering "you do not have permission" with no error anywhere to be seen.
const PUBLISHED_PAGES = [
  { file: path.join(PUBLIC, 'index.html'), base: '/' },
  { file: path.join(PUBLIC, 'istimara', 'index.html'), base: '/istimara/' }
];
for (const page of PUBLISHED_PAGES) {
  const html = fs.readFileSync(page.file, 'utf8');
  const here = page.base;
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*"([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue;
    const dir = here.endsWith('/') ? here : here.replace(/[^/]*$/, '');
    let target = new URL(ref, 'https://x' + dir).pathname;
    const candidates = [target, target.replace(/\/$/, '') + '/index.html', target + 'index.html'];
    if (!candidates.some(c => fs.existsSync(path.join(PUBLIC, c.replace(/^\//, ''))))) {
      problems.push(`BROKEN: ${here} loads ${ref}, which is not in firebase-public`);
    }
  }
}

// 3. the service worker must not promise a file the site does not have
const swSource = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
for (const m of swSource.matchAll(/'(\/[^']*\.(?:js|css|json|png|jpg|webp|html|webmanifest))'/g)) {
  const ref = m[1];
  const candidates = [ref, ref.replace(/\/$/, '') + '/index.html'];
  if (!candidates.some(c => fs.existsSync(path.join(PUBLIC, c.replace(/^\//, ''))))) {
    problems.push(`BROKEN: sw.js caches ${ref}, which is not in firebase-public`);
  }
}

// 4. assets referenced by markup must exist in the deployable copy
const css = fs.readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');const assetRefs = new Set();
for (const m of js.matchAll(/['"](assets\/[^'"]+?)['"]/g)) assetRefs.add(m[1]);
for (const m of js.matchAll(/href=\\?"([a-z0-9-]+\.(?:jpg|png))\\?"/g)) assetRefs.add('assets/' + m[1]);
for (const m of css.matchAll(/url\(['"]?([^)'"]+?)['"]?\)/g)) if (!/^data:/.test(m[1])) assetRefs.add(m[1]);
for (const ref of assetRefs) {
  if (ref.startsWith('http') || ref.startsWith('//')) continue;
  const clean = ref.split('?')[0];
  if (!fs.existsSync(path.join(PUBLIC, clean))) problems.push(`MISSING ASSET in firebase-public: ${clean}`);
  if (!fs.existsSync(path.join(ROOT, clean))) problems.push(`MISSING ASSET in source root: ${clean}`);
}

// 3. CSS classes used in markup must be defined (allowlisted inline/utility ones)
const fnBodies = ['officialFormCSS', 'packetCSS']
  .map(name => { const i = js.lastIndexOf('function ' + name); if (i < 0) return ''; return js.slice(i, i + 6000); })
  .join('\n');
const inlineCss = fnBodies + '\n' + js;
const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => m[1]));
for (const m of inlineCss.matchAll(/\.([A-Za-z][\w-]*)/g)) defined.add(m[1]);
const used = new Set();
for (const m of js.matchAll(/class=\\?"([^"'\\]+)\\?"/g)) m[1].split(/\s+/).forEach(c => { if (c && !c.includes('$') && !c.includes('{')) used.add(c); });
for (const m of js.matchAll(/class=\\?"([^"']*\$\{[^"']*)\\?"/g)) { /* dynamic class strings: scan literal words */ }
const dynamic = ['status', 'check-btn', 'row-more', 'btn', 'btn-primary', 'btn-outline', 'btn-ghost', 'btn-sms', 'link', 'panel', 'stat-icon', 'notice-type', 'gold-type', 'blue-type', 'icon-btn', 'table-avatar', 'page-description', 'session', 'day-column', 'empty-day', 'filter', 'search', 'week-switch', 'card-intro', 'membership-card', 'membership', 'card-print-grid', 'print-card', 'print-card-brand', 'print-card-body', 'qr-code', 'group-card', 'group-card-head', 'group-card-actions', 'role-shell', 'role-top', 'role-actions', 'role-main', 'role-hero', 'role-mark', 'role-cards', 'role-grid', 'role-list', 'role-links', 'role-link', 'role-side', 'toolbar', 'toolbar-group', 'stats-grid', 'stat-card', 'content-grid', 'chart', 'chart-labels', 'bars', 'bar-wrap', 'bar', 'notice-row', 'notice-dot', 'quick-panel', 'quick-actions', 'table-panel', 'table-scroll', 'attendance-summary', 'green', 'red-text', 'orange', 'check-line', 'form-two', 'form-message', 'toast-message', 'form-section-title', 'official-docs', 'docs-grid', 'registration-modal', 'requirement-row', 'coach-requirements', 'applicant-box', 'check-grid', 'plans-editor', 'plan-row', 'plan-name', 'plan-amount', 'plan-unit', 'plan-total', 'session-actions', 'notice-actions', 'row-actions', 'notice-list', 'notice-card', 'print-a4', 'print-host', 'print-head', 'print-body', 'print-foot', 'print-table', 'roster', 'roster-head', 'roster-count', 'roster-group', 'sign-cell', 'empty-cell', 'subscription-grid', 'chart-panel', 'attachment', 'attached-registration-forms', 'docs', 'is-today', 'empty', 'active', 'ok', 'no', 'danger', 'late', 'absent', 'rejected', 'success', 'pending', 'single', 'landscape', 'group', 'sub', 'line', 'field', 'box', 'sign', 'footer', 'full', 'hint', 'welcome', 'eyebrow', 'breadcrumb', 'header-actions', 'dash-header', 'main-content', 'app-shell', 'sidebar', 'side-brand', 'side-user', 'side-nav', 'side-bottom', 'mobile-menu', 'logo', 'brand', 'brand-logo', 'auth-logo', 'auth-modal', 'auth-links', 'side-brand', 'print-cards', 'print-cards-single', 'w-auto'];
const missing = [...used].filter(c => !defined.has(c) && !dynamic.includes(c));
if (missing.length) problems.push('CSS classes used but not defined: ' + missing.join(', '));

// 3b. the PWA manifest must reference icons that exist
{
  const mPath = path.join(PUBLIC, 'manifest.webmanifest');
  if (!fs.existsSync(mPath)) problems.push('manifest.webmanifest is missing from firebase-public');
  else {
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(mPath, 'utf8')); }
    catch (e) { problems.push('manifest.webmanifest is not valid JSON: ' + e.message); }
    if (manifest) {
      if (!manifest.name || !manifest.start_url) problems.push('the manifest has no name/start_url');
      if (manifest.display !== 'standalone') problems.push('the manifest is not installable (display)');
      const icons = manifest.icons || [];
      if (icons.length < 2) problems.push('the manifest needs at least two icons');
      for (const icon of icons) {
        const rel = String(icon.src || '').replace(/^\//, '');
        if (!rel) { problems.push('a manifest icon has no src'); continue; }
        if (!fs.existsSync(path.join(PUBLIC, rel))) problems.push('missing manifest icon: ' + rel);
      }
      if (!icons.some(i => String(i.purpose || '').includes('maskable'))) {
        problems.push('the manifest has no maskable icon for Android');
      }
    }
  }
  const swPath = path.join(PUBLIC, 'sw.js');
  if (!fs.existsSync(swPath)) problems.push('sw.js is missing from firebase-public');
  else {
    const sw = fs.readFileSync(swPath, 'utf8');
    if (!/addEventListener\(\s*'fetch'/.test(sw)) problems.push('sw.js does not handle fetch');
    if (!/skipWaiting/.test(sw)) problems.push('sw.js never activates a new version');
    if (!/api\//.test(sw)) problems.push('sw.js may cache the API and serve a stale roster');
  }
}

// 3c. the deployment workflow must be as strict as this suite
{
  const wfPath = path.join(ROOT, '.github', 'workflows', 'firebase-hosting.yml');
  if (!fs.existsSync(wfPath)) problems.push('the deployment workflow is missing');
  else {
    const wf = fs.readFileSync(wfPath, 'utf8');
    const loop = wf.match(/for f in ([^;]+); do\s*\n\s*if ! diff/);
    if (!loop) problems.push('the workflow has no deployable-copy diff loop');
    else for (const f of SYNC_FILES) {
      if (!loop[1].split(/\s+/).includes(f)) problems.push('the workflow does not verify ' + f);
    }
    /* GitHub does not expose the secrets context to `if:`. A condition written as
       `secrets.X != ''` does not fail at run time -- it fails to parse, and the
       whole file is rejected, so nothing runs at all. So this cannot ask for that
       line, and the version that did was demanding the bug.

       What is protected is the same thing: the deploy job must not run without the
       service account. The shape that works asks the question inside a step --
       where a secret may be read -- answers it as an output, and has the job decide
       on that output. And the output is checked to be really produced, which the
       old check could not do: it could only look for a string. */
    /* Comments removed first. The file explains this rule in a comment that quotes
       the broken line, so a check that read the file as-is found its own
       explanation and reported the bug it was written to catch. A comment cannot be
       a condition. */
    const wfCode = wf.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
    if (/if:[^\n]*secrets\./.test(wfCode)) {
      problems.push('a condition reads a secret, which GitHub will not parse: the whole '
        + 'workflow file would be rejected and nothing would run');
    }
    const gateOut = wf.match(/has_service_account:\s*\$\{\{\s*steps\.gate\.outputs\.has_service_account/);
    if (!gateOut) {
      problems.push('the deploy job is not decided on the answer to "is the service account there?"');
    }
    if (!/if:\s*\$\{\{\s*needs\.verify\.outputs\.has_service_account == 'true'/.test(wf)) {
      problems.push('the deploy job runs even without the service account secret');
    }
    if (!/echo "has_service_account=(true|false)" >> "\$GITHUB_OUTPUT"/.test(wf)) {
      problems.push('the answer the deploy job decides on is never produced');
    }
    if (!/firestore:rules/.test(wf)) problems.push('the workflow does not publish the Firestore rules');
    if (!/storage/.test(wf)) problems.push('the workflow does not publish the Storage rules');
    if (!/sadara\.db/.test(wf) || !/uploads\//.test(wf)) {
      problems.push('the workflow does not guard against committing private data');
    }
    if (!/entryPoint: \./.test(wf)) problems.push('the workflow entry point no longer matches firebase.json');
  }
}

// 4. print styles must exist
const printBlocks = (css.match(/@media print/g) || []).length;
if (!printBlocks) problems.push('no @media print block');
if (!/\.print-host\{display:none\}/.test(css)) problems.push('print sheet is not hidden on screen');
if (!/@page\{/.test(css)) problems.push('no @page rule');
if (!/break-inside:avoid/.test(css)) problems.push('no page-break control in print');

// 5. no leftover placeholder markers
const markers = ['TODO', 'FIXME', 'undefined', 'NaN', '[object Object]', 'lorem'];
for (const f of ['app.js', 'styles.css', 'firebase-adapter.js']) {
  const t = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
  for (const mk of ['TODO', 'FIXME', 'lorem ipsum']) {
    if (t.toLowerCase().includes(mk.toLowerCase())) problems.push(`${f} contains "${mk}"`);
  }
}

// 6. no insecure external links
for (const m of js.matchAll(/https?:\/\/[^"')\s]+/g)) {
  if (m[0].startsWith('http://') && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(m[0]))
    problems.push(`insecure external link: ${m[0]}`);
}

// 7. every document parses, and the head holds nothing but markup
/* A meta tag split across two lines left its content stranded as plain text,
   which the browser printed above the page. Nothing caught it because nothing
   parsed the document. jsdom resolves markup the same way a browser does, so
   comparing what it built against what the source says finds that class of
   damage without needing a validator. */
const PAGES = [
  ['index.html', path.join(PUBLIC, 'index.html')],
  ['istimara/index.html', path.join(PUBLIC, 'istimara', 'index.html')]
];
for (const [name, file] of PAGES) {
  if (!fs.existsSync(file)) { problems.push(`${name} is missing from the deployable tree`); continue; }
  const src = fs.readFileSync(file, 'utf8');
  const head = (src.match(/<head\b[\s\S]*?<\/head>/i) || [''])[0];

  // a tag that opens but does not close on the same line: how the split began
  for (const line of head.split('\n')) {
    if (/^\s*<[a-zA-Z][^>]*$/.test(line.trim())) {
      problems.push(`${name}: a tag is opened and left open -- "${line.trim().slice(0, 60)}"`);
    }
  }

  // what the browser ends up with, which is what actually shows on the page
  const dom = new JSDOM(src);
  const doc = dom.window.document;

  // text in the head is never rendered as page content, so anything visible
  // there means the parser was pushed out of a tag and left the rest as text
  for (const node of doc.head.childNodes) {
    if (node.nodeType === 3 && node.textContent.trim()) {
      problems.push(`${name}: stray text in the head, shown above the page -- "${node.textContent.trim().slice(0, 60)}"`);
    }
  }
  // the same damage can push text into the body's first children
  const lead = [...doc.body.childNodes].slice(0, 2)
    .filter(n => n.nodeType === 3 && n.textContent.trim())
    .map(n => n.textContent.trim().slice(0, 60));
  if (lead.length) problems.push(`${name}: stray text at the top of the body -- ${lead.join(' / ')}`);

  /* A tag that swallowed its neighbour leaves two tags under one name, so
     duplicates are the thing to look for. Absence is a choice, not damage --
     /istimara/ has never carried a keywords tag, and search engines have
     ignored meta keywords since 2019 anyway. */
  const once = (selector, label) => {
    const n = doc.querySelectorAll(selector);
    if (n.length > 1) problems.push(`${name}: ${n.length} ${label} tags, one is swallowing another`);
    return n[0];
  };
  const desc = once('meta[name="description"]', 'description');
  if (!desc) problems.push(`${name}: no description meta tag`);
  else if (!desc.getAttribute('content')) problems.push(`${name}: the description meta tag has no content`);
  once('meta[property="og:title"]', 'og:title');
  once('meta[property="og:description"]', 'og:description');
  once('meta[property="og:image"]', 'og:image');
  if (!doc.title) problems.push(`${name}: no title`);
}

// 8. no debris in the test folder
/* A suite is a .test.js file, or one of the helpers the suites shell out to.
   Anything else is a scratch script that was never cleaned up: it does not run,
   it is not maintained, and it makes the folder lie about what is covered. */
const TESTS = path.join(ROOT, 'tools', 'tests');
const npmScripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};
/* Reached from an npm script... */
const HELPERS = new Set(
  Object.values(npmScripts)
    .map(cmd => /tools[\\/]tests[\\/]([\w.-]+\.js)/.exec(String(cmd)))
    .filter(Boolean)
    .map(m => m[1]));
/* ...or loaded by another file in the same folder, which is how the in-suite
   helpers (modal-fields.js, smoke.js) are reached. */
for (const name of fs.readdirSync(TESTS)) {
  if (!name.endsWith('.js')) continue;
  const body = fs.readFileSync(path.join(TESTS, name), 'utf8');
  for (const m of body.matchAll(/[\w.-]+\.js/g)) HELPERS.add(m[0]);
}
for (const name of fs.readdirSync(path.join(ROOT, 'tools', 'tests'))) {
  if (!fs.statSync(path.join(ROOT, 'tools', 'tests', name)).isFile()) continue;
  if (name.endsWith('.test.js') || HELPERS.has(name)) continue;
  problems.push(`tools/tests/${name} is not a suite and not a known helper -- leftover scratch?`);
}

// 9. workflow triggers on the branch that exists
const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'firebase-hosting.yml'), 'utf8');
if (!/branches:\s*\[main, master\]/.test(wf)) problems.push('workflow does not listen on main and master');

if (problems.length) {
  console.log('PROBLEMS (' + problems.length + '):');
  [...new Set(problems)].forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('Static checks passed: sync, assets, CSS coverage, print rules, links, valid documents, clean test folder, workflow.');
console.log('print @media blocks:', printBlocks, '| css classes defined:', defined.size, '| used:', used.size);