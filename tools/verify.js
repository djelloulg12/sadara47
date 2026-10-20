/**
 * Runs every check in tools/tests and reports one line per suite.
 *   node tools/verify.js
 * Exits non-zero on the first failing suite's problems, listing them all.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const TESTS = path.join(HERE, 'tests');
const ROOT = path.resolve(HERE, '..');

const SUITES = [
  ['static', 'static.test.js', 'tree, assets, stylesheet, print rules, links, workflow'],
  ['audit', 'audit.test.js', 'no dead controls, no invented numbers, form, card layout'],
  ['review', 'review.test.js', 'first paint, public page, quota, CSV, audit, privacy, a11y'],
  ['packet', 'packet.test.js', 'instant print, receipt, regulations, signed copy, settlement'],
  ['photo-form', 'photo-form.test.js', 'member photo, print gate, official form overlay'],
  ['istimara', 'istimara.test.js', 'public registration page, no login, print both sheets'],
  ['pool-gate', 'pool-gate.test.js', 'the pool gate cannot be passed, the column adds without a row'],
  ['facilities', 'facilities.test.js', 'editable pool names, complete Excel export'],
  ['signin', 'signin.test.js', 'sign-in always answers in Arabic'],
  ['roles', 'roles.test.js', 'roles agree across tools, page and rules'],
  ['modifications', 'modifications.test.js', 'roster, cards, timetable, roles'],
  ['documents', 'documents.test.js', 'every generated document'],
  ['search-digits', 'search-digits.test.js', 'a number typed in either script finds the same record'],
  ['barcode', 'barcode.test.js', 'the card barcode is Code 128 and follows the rules'],
  ['qr', 'qr.test.js', 'the code on the card is a real QR, against an outside encoder'],
  ['card-layout', 'card-layout.test.js', 'the card is measured in a real browser: nothing cut, nothing off the edge'],
  ['official-form', 'official-form.test.js', 'the printed form: the declaration names the guardian, the ب: box the birthplace, and the child’s day appears once'],
  ['page-layout', 'page-layout.test.js', 'every page, every role, measured in a real browser at a real window'],
  ['group-button', 'group-button.test.js', 'the group button: one field, the roles the server accepts, a refusal is a refusal'],
  ['groups', 'groups.test.js', 'one group list, the id travels with the name, the filter bar, the A4 group sheet'],
  ['scanner', 'scanner.test.js', 'who may scan, the card is matched before it is written, every mark carries who made it'],
  ['schema-neon', 'schema-neon.test.js', 'the Neon schema covers every collection and field, and destroys nothing'],
  ['password-gate', 'password-gate.test.js', 'the forced-password wall cannot be dismissed, and rises only where the flag is written'],
  ['notice-layout', 'notice-layout.test.js', 'the announcement in the shut door, measured on a phone and a desk'],
  ['deploy', 'deploy.test.js', 'the platform deploys as one service: pg locked, secrets from the environment, the Neon entry point'],
  ['keep-awake', 'keep-awake.test.js', 'the ping keeps the service up inside Render\'s free-hour cap, and refuses without its token'],
  ['usage', 'usage.test.js', 'the window is derived from real activity and cannot spend a month of hours on one rare event'],
  ['table-labels', 'table-labels.test.js', 'the phone card is named from its column, on both render paths'],
  ['column-tool', 'column-tool.test.js', 'the column tool opens, hides, remembers per person, locks the name'],
  ['resilience', 'resilience.test.js', 'a page that fails to draw shows a panel with a way back, and stale data says so'],
  ['smoke', 'smoke.js', 'every page, every control, every role'],
  ['adapter', 'adapter.test.js', 'Firestore adapter authorisation and limits']
];

function runNode(script) {
  return spawnSync(process.execPath, [path.join(TESTS, script)], {
    cwd: ROOT, encoding: 'utf8', timeout: 600000
  });
}

let failed = 0;
const lines = [];

for (const [name, script, covers] of SUITES) {
  if (!fs.existsSync(path.join(TESTS, script))) {
    failed++;
    lines.push('  ' + name.padEnd(14) + ' MISSING  ' + script);
    continue;
  }
  const started = Date.now();
  const res = runNode(script);
  const ms = Date.now() - started;
  if (res.status === 0) {
    const out = (res.stdout || '').trim().split('\n')[0] || '';
    lines.push('  ' + name.padEnd(14) + ' PASS  ' + (ms / 1000).toFixed(1) + 's  ' + covers);
    if (out && !/^(All|PASS)/.test(out) && /passed/i.test(out)) {
      lines.push('  ' + ' '.repeat(14) + '        ' + out.slice(0, 96));
    }
  } else {
    failed++;
    lines.push('  ' + name.padEnd(14) + ' FAIL');
    const problems = ((res.stdout || '') + (res.stderr || ''))
      .split('\n')
      .filter(l => /^\s*-\s|PROBLEMS|Error:|SyntaxError|ReferenceError/.test(l))
      .slice(0, 6);
    for (const p of problems) lines.push('  ' + ' '.repeat(14) + '  ' + p.trim().slice(0, 110));
  }
}

console.log('Sadara platform — verification');
console.log(lines.join('\n'));
console.log('');
console.log(failed ? failed + ' suite(s) failing' : 'all ' + SUITES.length + ' suites green');
process.exit(failed ? 1 : 0);