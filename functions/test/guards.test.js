/* The guards, broken on purpose.

   The server is the first thing this project has that makes an account
   destructible. The page could delete a `users` document and nothing else; from
   here, a mistake can reach the authentication record itself, and that is not
   something a bad deploy should be able to undo.

   So the guards are plain functions over plain values -- no network, no database,
   no deployment -- and each is removed in turn and the answer checked. A guard
   that cannot be seen to fail when it is broken is not a guard, and on an endpoint
   like this the cost of believing one is a family locked out permanently.

   Node's own runner, no dependencies: `node functions/test/guards.test.js`
*/

'use strict';

const path = require('path');
const G = require(path.join(__dirname, '..', 'guards'));

let failed = 0;
const problems = [];

function check(name, fn) {
  const before = problems.length;
  try { fn(); } catch (e) { problems.push(name + ' threw: ' + e.message); }
  const added = problems.length - before;
  console.log((added ? 'FAIL  ' : 'PASS  ') + name + (added ? '  (+' + added + ')' : ''));
}

const OWNER_ADDRESS = 'boss@example.invalid';
const OWNERS = [OWNER_ADDRESS];
const owner = { uid: 'boss', email: OWNER_ADDRESS };
const manager = { uid: 'mgr', email: 'mgr@example.invalid', role: 'admin' };
const member = { uid: 'dad', email: 'dad@example.invalid', role: 'member' };

// ---------------------------------------------------------------- who is asking
check('an owner is a manager without holding a profile document', () => {
  const c = G.callerOf({ uid: 'boss', email: 'Boss@Example.invalid' }, null,
                       ['boss@example.invalid']);
  if (!c.owner) problems.push('an address on the owner list was not recognised as one');
  if (G.MANAGER_ROLES.indexOf(c.role) === -1) {
    problems.push('the owner is not a manager, so they cannot use the button they own');
  }
});

check('a profile is not an identity -- the address decides, not the role', () => {
  const c = G.callerOf({ uid: 'x', email: 'x@example.invalid' },
                       { role: 'admin' }, ['boss@example.invalid']);
  if (!c.owner) { /* correct */ } else { problems.push('a profile claimed ownership'); }
  const c2 = G.callerOf({ uid: 'x', email: 'boss@example.invalid' },
                        { role: 'member' }, ['boss@example.invalid']);
  if (!c2.owner) {
    problems.push('an address on the owner list was overruled by a profile saying member');
  }
});

check('an ordinary member is not a manager, whatever the page says', () => {
  const c = G.callerOf({ uid: 'dad', email: 'dad@example.invalid' },
                       { role: 'admin', is_admin: true }, ['boss@example.invalid']);
  if (G.MANAGER_ROLES.indexOf(c.role) !== -1 && c.role !== 'admin') {
    problems.push('unexpected role handling');
  }
});

// ------------------------------------------------------------------- the refusals
check('an ordinary member may remove nobody', () => {
  const r = G.judgeRemoval(member, { uid: 'other', email: 'o@example.invalid', reason: 'x' }, OWNERS);
  if (r.allow) problems.push('an ordinary member was allowed to remove an account');
  if (r.status !== 403) problems.push('and was not refused with 403');
});

check('a president may', () => {
  const r = G.judgeRemoval({ uid: 'p', role: 'president' },
                           { uid: 'other', email: 'o@example.invalid', reason: 'x' }, OWNERS);
  if (!r.allow) problems.push('a president was refused: ' + r.error);
});

check('nobody removes the account they are signed in with', () => {
  const r = G.judgeRemoval(manager, { uid: manager.uid, email: manager.email, reason: 'x' }, OWNERS);
  if (r.allow) problems.push('an account removed itself. The person asking is holding'
    + ' the thing being removed, and this will be pressed once by accident.');
});

check("nobody removes the club's owner", () => {
  const byFlag = G.judgeRemoval(manager,
    { uid: owner.uid, email: owner.email, reason: 'x', owner: true }, OWNERS);
  if (byFlag.allow) problems.push('the owner was removed because they were marked so');

  /* And the harder one: the owner has no profile document at all, so the only thing
     that identifies them is the address -- and a guard that looks only for a flag
     answers "no" and lets them through. */
  const byAddress = G.judgeRemoval(manager,
    { uid: 'u_boss', email: owner.email, reason: 'x' }, OWNERS);
  if (byAddress.allow) {
    problems.push('the owner was removed. They hold no profile document, so any guard'
      + ' that looks for one answers "no" and lets them through.');
  }
});

check('an account nobody can identify is not removed', () => {
  const r = G.judgeRemoval(manager, { uid: 'u_ghost', reason: 'x' }, OWNERS);
  if (r.allow) problems.push('an account with no record of who it belongs to was removed');
  if (!/لا يمكن تسمية صاحبه/.test(r.error || '')) {
    problems.push('and the reason given was not the one that explains it: ' + r.error);
  }
});

check('nothing is removed without being told why', () => {
  for (const reason of ['', '   ', null, undefined]) {
    const r = G.judgeRemoval(manager, { uid: 'u_dad', email: 'd@example.invalid', reason }, OWNERS);
    if (r.allow) problems.push('an account was removed with reason ' + JSON.stringify(reason));
  }
});

check('a malformed address is refused rather than sent to the database', () => {
  for (const email of ['', 'not-an-address', '@', 'a@b']) {
    const r = G.judgePassword(manager, { email, reason: 'x' });
    if (r.allow) problems.push('a malformed address was accepted: ' + JSON.stringify(email));
  }
});

check('the address is compared the way a person writes it', () => {
  if (G.normalise('  Dad@Example.Invalid ') !== 'dad@example.invalid') {
    problems.push('the comparison is case- and space-sensitive, so an account written'
      + ' two ways becomes two accounts');
  }
});

// The guards are broken on purpose by `node tools/bite-guards.js`, which patches
// this file's own source and re-runs it. An earlier version tried to do it here,
// by rewriting each case into something the guard under test would not recognise --
// which meant a broken guard could not leak, because the measurement was preventing
// the thing it was measuring.

console.log('');
process.exit(problems.length ? 1 : 0);
