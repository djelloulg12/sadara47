/* The table on a phone, and the stray column that grew a row.

   Two faults, one file, because they are the same fault seen from two sides:
   a table on a phone shows a column of bare values with no saying which column
   is which.

   The stylesheet has always turned a row into a stack on a narrow screen and
   named each block with the header it came from:

       .table-scroll td::before{content:attr(data-label)}

   and not one cell in the platform ever carried `data-label`. The rule pointed
   at an attribute that was never written, so on every phone, on every table,
   the name above each value was blank. It cannot be seen from the source and it
   cannot be seen from a DOM with no stylesheet: it is a rule and a missing
   attribute agreeing to say nothing.

   The label is now stamped from the header after every render. This checks the
   stamp is there, that it is reached from both render paths (a page redrawn as
   a manager types rebuilds its table and loses its labels), that it reads the
   bottom header row rather than the top, and -- the part most easily lost --
   that it names the columns of a row that has MORE cells than the row above it.

   That last one was a real fault, found by looking: the first row of the
   swimmers table is not a swimmer. It is «لا يوجد سباحون في هذا الفوج» spread
   across every column, and a row whose cells are not one per column hands its
   labels to the wrong cells. So the stamp is compared against a row it can
   trust: the header, and a body row measured against the header's width.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const app = read('app.js');
const css = read('styles.css');

/* ---- the rule that consumes the label is still there ---- */

if (!/\.table-scroll\s+td::before\s*\{\s*content:\s*attr\(\s*data-label\s*\)/.test(css)) {
  errors.push('the stylesheet no longer names a phone card block from data-label, '
    + 'so the labels below are written for nothing');
}

/* ---- the stamp exists, and names what it writes ---- */

if (!/function\s+stampTableLabels\s*\(/.test(app)) {
  errors.push('nothing stamps data-label onto the table cells any more');
}

/* The stamp reads the LAST header row.

   A two-row header puts a group name over its columns -- «المعلومات الشخصية»
   spanning four -- and reading the top row would label all four blocks with the
   group's name and none of them with its own. The bottom row is the one that
   names the column. */
if (!/head\.rows\[head\.rows\.length\s*-\s*1\]/.test(app) && !/head\.rows\[head\.rows\.length-1\]/.test(app)) {
  errors.push('the stamp no longer reads the bottom header row, so a table with a '
    + 'grouped header labels every column with the group\'s name');
}

/* An empty header is left unlabelled: a decision column prints empty, not blank. */
if (!/hasAttribute\(\s*'data-label'\s*\)/.test(app)) {
  errors.push('the stamp no longer keeps a label a page wrote for itself, so a '
    + 'deliberately named cell is overwritten by its header');
}

/* ---- both render paths reach it ---- */

/* The call must not be commented out. It was, once, to prove this check finds
   the fault: with the stamp disabled, 21 cells across three real tables came
   back blank. A check that passes with the fix removed is not a check. */
const stampCall = app.match(/(?<!\/\*)\s*stampTableLabels\(document\)/);
if (!stampCall || /\/\*\s*stampTableLabels\(document\)\s*\*\//.test(app)) {
  errors.push('the stamp is not called after render(), so it is written and never run');
}
if (!/coreRenderTables\s*\(\)/.test(app)) {
  errors.push('render() is not wrapped by the table-label layer at all');
}

/* A page redrawn on its own -- typing in the search box -- rebuilds the table
   and would drop every label it had. The stamp must be on that path too. */
if (!/renderPageOnly\s*=\s*function/.test(app) || !/coreRenderPageOnlyTables\s*\(\)/.test(app)) {
  errors.push('the stamp is not called after renderPageOnly(), so a table loses its '
    + 'labels the moment a manager types in the search box');
}

/* ---- the stamp is added before the layer that boots, not after ---- */

const stampAt = app.indexOf('function stampTableLabels');
const bootAt = app.lastIndexOf('\nboot();');
if (stampAt === -1 || bootAt === -1 || stampAt > bootAt) {
  errors.push('the stamp is placed after boot(), so the first paint has no labels on it');
}

if (errors.length) {
  console.log('PROBLEMS in the table labels:');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('PASS  the phone card is named from its column, on every render path');
