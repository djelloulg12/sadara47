/* The column tool: what a manager ticks, and what a manager cannot tick away.

   Three faults are guarded here, and each of them was met while building this.

   The first is the wrapper around `action`. Every other layer in the platform
   wraps it as an async function and awaits the chain. This layer asked for that
   shape out of habit, and it hung the whole page: a stage that drives the group
   form calls `action('add-group')` and reads `state.groups` immediately after,
   and an async wrapper makes that read happen before the chain has resolved. The
   page then blocked on a fetch that was never going to answer. The wrapper here
   must hand the chain's own value straight back, and this check reads that.

   The second is the way the choice is stored. It records whether a column is
   SHOWN, and it is read back as `choice[label] === false` means hidden. Written
   the other way round it saves and loads perfectly and hides nothing, which is
   the worst kind of broken: it looks like it works until somebody uses it.

   The third is that a preference is a person's, not a machine's. The key must
   carry the account, or a manager's list follows the coach who logs in next.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const app = read('app.js');
const css = read('styles.css');

/* ---- the wrapper hands the chain's value back, and is not async ---- */

const wrap = app.match(/const\s+coreActionColumns\s*=\s*action;[\s\S]{0,220}/);
if (!wrap) {
  errors.push('the column layer no longer wraps action, so nothing opens the menu');
} else if (/action\s*=\s*async\s+function/.test(wrap[0])) {
  errors.push('the column layer wraps action as an async function. Every other layer does, '
    + 'and this one must not: a stage that calls action and reads state right after it '
    + 'will read too early, and the page hangs. Return the chain\'s own value.');
}
if (!/return\s+coreActionColumns\s*\(\s*a\s*,\s*el\s*\)/.test(app)) {
  errors.push('the column layer does not return the chain\'s own value for names it does not handle');
}

/* ---- the choice records SHOWN, and is read back the same way ---- */

if (!/choice\s*\[\s*label\s*\]\s*=\s*!!\s*el\.checked/.test(app)) {
  errors.push('the choice no longer records whether the column is shown -- stored the other '
    + 'way round it saves and loads perfectly and hides nothing');
}
if (!/choice\s*\[\s*col\.label\s*\]\s*===\s*false/.test(app)) {
  errors.push('a column is no longer hidden when the choice records it as not shown');
}

/* ---- the account is part of the key ---- */

if (!/sadara-cols:'\s*\+\s*columnsAccountKey\(\)/.test(app)) {
  errors.push('the preference is not keyed by the account, so it follows the next person who signs in');
}
if (!/function\s+columnsAccountKey\s*\(/.test(app) || !/state\.user/.test(app)) {
  errors.push('there is no account key for the preference');
}

/* ---- the columns a row cannot lose ---- */

if (!/LOCKED_COLUMNS\s*=\s*\[[^\]]*السباح[^\]]*الفوج[^\]]*\]/.test(app)) {
  errors.push('the name or the group is no longer locked, so a manager can hide the column '
    + 'that says whose row it is');
}
/* and the lock is enforced where the choice is applied, not only in the menu */
if (!/LOCKED_COLUMNS\.indexOf\(col\.label\)\s*===\s*-1/.test(app)) {
  errors.push('the lock is only in the menu: a choice written by hand still hides a locked column');
}

/* ---- the CSS that actually hides the column ---- */

if (!/\[data-col-hidden\]\s*\{\s*display:\s*none/.test(css.replace(/\s+/g, ' '))) {
  errors.push('no stylesheet rule hides a marked column, so the mark hides nothing');
}

/* ---- it is stamped on both render paths, and before the layer that boots ---- */

if (!/coreRenderColumns\s*\(\)/.test(app) || !/installColumnToggles\(document\)|installColumnToggles\(\)/.test(app)) {
  errors.push('the column tool is never installed after a render');
}
if (!/renderPageOnly\s*=\s*function/.test(app) || !/coreRenderPageOnlyColumns\s*\(\)/.test(app)) {
  errors.push('the column tool is not installed after renderPageOnly(), so it vanishes '
    + 'the moment a manager types in the search box');
}

const installAt = app.indexOf('function installColumnToggles');
const bootAt = app.lastIndexOf('\nboot();');
if (installAt === -1 || bootAt === -1 || installAt > bootAt) {
  errors.push('the column layer is placed after boot(), so the first paint has no tool on it');
}

if (errors.length) {
  console.log('PROBLEMS in the column tool:');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('PASS  the column tool opens, hides, remembers per person, and cannot hide the name');
