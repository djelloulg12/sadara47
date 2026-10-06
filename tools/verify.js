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
  ['facilities', 'facilities.test.js', 'editable pool names, complete Excel export'],
  ['signin', 'signin.test.js', 'sign-in always answers in Arabic'],
  ['roles', 'roles.test.js', 'roles agree across tools, page and rules'],
  ['modifications', 'modifications.test.js', 'roster, cards, timetable, roles'],
  ['documents', 'documents.test.js', 'every generated document'],
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