/* Do the guards bite?

   Each one is removed from `functions/guards.js`, the file is written back, the
   checks are re-run, and the file is restored whatever the run says. Nothing here
   touches a network or a database, which is the point: a guard that can only be
   tested by deploying is a guard that gets tested once, and this endpoint is the
   first thing in the project that can reach an authentication record.

   Two guards were already caught by the checks before this file existed -- the one
   that protected the owner was reading a flag the caller supplied, and an address
   of "@" passed. Those are in the history of the checks rather than in it, and
   they are why the guards were written as plain functions in the first place: they
   can be examined by a person in an afternoon, which is not true of a guard buried
   in a request handler.

   Every write is verified by reading the file back. A buffered write that was never
   closed once made this kind of check report "nothing broke" seven times in a row.
*/

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GUARDS = path.join(ROOT, 'functions', 'guards.js');
const CHECK = path.join(ROOT, 'functions', 'test', 'guards.test.js');

const original = fs.readFileSync(GUARDS);

/* Nothing is mirrored. `functions/` is deployed by the functions runtime and is
   never served as a static file, so there is no second copy to keep in step -- and
   a check that patches a mirror while testing the original is a check that can
   prove the wrong file was correct. */
function restore() {
  fs.writeFileSync(GUARDS, original);
  if (!fs.readFileSync(GUARDS).equals(original)) {
    console.log('  *** the restore did not land. Fix that before trusting anything here.');
    process.exit(2);
  }
}

const BREAKS = [
  ['the manager check',
   "  if (MANAGER_ROLES.indexOf(normalise(caller.role)) === -1) {",
   "  if (false) {"],

  ['the self-deletion refusal',
   "  if (caller.uid && uid === caller.uid) {",
   "  if (false) {"],

  ['the owner, recognised by address',
   "  if (owners.indexOf(address) !== -1 || target.owner === true) {",
   "  if (false) {"],

  ['the reason required',
   "  if (!reason) {\n    return { allow: false, status: 400,\n      error: 'اكتب سبب الحذف",
   "  if (false) {\n    return { allow: false, status: 400,\n      error: 'اكتب سبب الحذف"],

  ['the identity needed',
   "  if (!address) {\n    return { allow: false, status: 403,",
   "  if (false) {\n    return { allow: false, status: 403,"],

  ['the address has to look like an address',
   "  if (at < 1 || domain.indexOf('.') === -1 || domain.endsWith('.')) {",
   "  if (false) {"],
];

let uncaught = 0;
for (const [why, from, to] of BREAKS) {
  const text = original.toString('utf8');
  if (!text.includes(from)) {
    console.log('  !! ' + why + ': not found -- is the guard still what it was?');
    uncaught++;
    continue;
  }
  const broken = text.replace(from, to);
  fs.writeFileSync(GUARDS, broken, 'utf8');
  try {
    const run = spawnSync(process.execPath, [CHECK], { encoding: 'utf8', cwd: ROOT });
    const out = (run.stdout || '') + (run.stderr || '');
    const caught = /FAIL/.test(out);
    console.log('  ' + (caught ? 'caught    ' : 'NOT CAUGHT') + '  ' + why);
    if (!caught) uncaught++;
  } finally {
    restore();
  }
}

console.log('');
console.log('  the file is restored, and the restore was checked');
console.log(uncaught
  ? '  ' + uncaught + ' guard(s) went unnoticed -- these checks are not measuring them'
  : '  every guard, removed, was caught by the checks that exist for it');
process.exit(uncaught ? 1 : 0);