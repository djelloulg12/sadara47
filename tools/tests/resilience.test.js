/* When a page cannot be drawn, and when the network goes.

   Two faults that look alike from the manager's chair -- an empty screen -- and
   are opposite underneath. One is the page failing to draw; the other is the
   page drawn from data that is out of date. Neither is a mistake in the club's
   records, and the screen must not look as though it is.

   The boundary is the part most easily lost, because a page that never throws
   never shows it: it can be deleted and every check still passes, until the
   afternoon one swimmer is missing a group. So this reads the boundary as the
   real code that runs, and reads the three things that make it honest -- that a
   throw does not escape, that the panel says the data is safe, and that there is
   a way back.

   It also guards the shape that hung the whole platform while this was built.
   The retry and the notice are reached through `action`, and a layer that wraps
   `action` as an async function changes what a caller gets back. That cost an
   afternoon and it is written down here so it cannot cost another.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const app = read('app.js');
const css = read('styles.css');

/* ---- the boundary itself ---- */

if (!/function\s+renderBoundaryMessage\s*\(/.test(app)) {
  errors.push('there is no message for a page that could not be drawn, so a throw is a white screen');
}

/* The word that keeps a red panel from reading as a red panel about the club's
   records. Without it the manager cannot tell whether the data is gone. */
if (!/بياناتك لم تُمسّ/.test(app)) {
  errors.push('the error panel does not tell the manager their data is safe, so a drawing '
    + 'fault reads as a lost record');
}

/* The throw must be caught where the page is drawn, and it must NOT be swallowed
   into silence: a boundary that hides the error hides the fault with it. */
if (!/catch\s*\(\s*err\s*\)\s*\{[\s\S]{0,400}?console\.error\(/.test(app)) {
  errors.push('a page that fails to draw is caught but not reported, so the fault is hidden '
    + 'from whoever would fix it');
}
if (!/mount\.innerHTML\s*=\s*renderBoundaryMessage\(err\)/.test(app)) {
  errors.push('the boundary does not put its message on the screen, so the throw still leaves it blank');
}

/* Two ways back, and the retry must be wired where it is made: the button is
   added after `bind` has run, so a handler that waits for `bind` never arrives. */
if (!/data-action="recover-render"/.test(app)) {
  errors.push('the error panel has no «إعادة المحاولة» button, so a manager is stuck on a page '
    + 'that cannot draw');
}
if (!/wireBoundaryButtons_/.test(app)
    || !/querySelectorAll\(\s*'\[data-action="recover-render"\], \[data-action="recover-render-home"\]'\s*\)/.test(app)
    || !/b\.onclick\s*=\s*\(\)\s*=>\s*action\(/.test(app)) {
  errors.push('the retry button is not wired where it is made, so pressing it does nothing');
}

/* ---- the wrapper around action must hand back the chain's own value ---- */

const wrap = app.match(/const\s+coreActionResilient\s*=\s*action;[\s\S]{0,160}/);
if (!wrap) {
  errors.push('the resilience layer no longer wraps action, so the retry and the notice go nowhere');
} else if (/action\s*=\s*async\s+function/.test(wrap[0])) {
  errors.push('the resilience layer wraps action as an async function. This is the shape that hung '
    + 'the platform: a caller that reads state right after action() reads it too early, and the '
    + 'page blocks on a request that never answers. Return the chain\'s own value.');
}
if (!/return\s+coreActionResilient\s*\(\s*a\s*,\s*el\s*\)/.test(app)) {
  errors.push('the resilience layer does not return the chain\'s own value for names it does not handle');
}

/* ---- the notice that what is on the screen may be out of date ---- */

if (!/function\s+offlineBannerHtml\s*\(/.test(app)) {
  errors.push('nothing says when the data on the screen may be out of date');
}
if (!/نavigator\.onLine\s*===?\s*false|navigator\.onLine/.test(app)) {
  errors.push('the notice does not read the browser\'s own answer about the connection');
}

/* The chain below catches its own failures and only warns, so `await` returning
   is NOT the same as the fetch having worked. The failure has to be watched where
   the requests pass, or a failed sync looks like a successful one. */
if (!/function\s+watchRequests_\s*\(/.test(app) || !/\.ok\s*===\s*false/.test(app)) {
  errors.push('a sync that fails is not noticed: the chain swallows its own errors, so the layer '
    + 'must watch the requests, not the return');
}
if (!/syncState_\.sawFailure/.test(app)) {
  errors.push('the failure the observer sees is never read, so the notice never appears');
}

/* ---- the skeleton ---- */

if (!/function\s+skeletonRowsHtml\s*\(/.test(app)) {
  errors.push('a list waiting on a fetch shows its empty message, so a slow line looks like a club '
    + 'with no members');
}
/* The count, not a flag: two syncs can overlap and a flag would be cleared by
   whichever finished first, saying the page is ready while the other waits. */
if (!/syncState_\.running\s*\+\+/.test(app) || !/Math\.max\(\s*0\s*,\s*syncState_\.running\s*-\s*1\s*\)/.test(app)) {
  errors.push('the fetches in flight are not counted, so overlapping syncs clear each other\'s mark');
}

/* ---- the CSS, without which a panel and a banner are invisible ---- */

const flat = css.replace(/\s+/g, ' ');
if (!/\.boundary-panel/.test(flat)) errors.push('the error panel has no styling, so it reads as unformatted text');
if (!/\.offline-banner/.test(flat)) errors.push('the stale notice has no styling, so it goes unread');
if (!/\.skeleton-bar/.test(flat)) errors.push('the skeleton has no styling, so it is an invisible empty row');

/* ---- it is on both render paths, and before the layer that boots ---- */

if (!/coreRenderResilient\s*\(\s*\)/.test(app)) {
  errors.push('the boundary is written and never called');
}
const boundaryAt = app.indexOf('function renderBoundaryMessage');
const bootAt = app.lastIndexOf('\nboot();');
if (boundaryAt === -1 || bootAt === -1 || boundaryAt > bootAt) {
  errors.push('the resilience layer is placed after boot(), so the first paint is unprotected');
}

if (errors.length) {
  console.log('PROBLEMS in the resilience layer:');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('PASS  a page that fails to draw shows a panel with a way back, and stale data says so');
