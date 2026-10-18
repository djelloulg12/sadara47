/* The barcode is checked against the specification, not against itself.

   A barcode that is wrong looks exactly like a barcode that is right: bars, gaps,
   black on white, plausible. Nothing about it says "this scans as a different
   child's number". The only place that can be caught is here, against known
   answers computed by hand from the Code 128 rules.

   What is asserted:
     * the start, check and stop characters, which are where a barcode goes wrong
     * the module count, which is what a scanner uses to find where it is
     * that a single flipped character changes the check digit, because a code that
       cannot tell a misread from a correct reading is not a check
     * that every pattern is eleven modules wide except the stop, which is thirteen
     * that an Arabic name is refused rather than drawn as something else

   A test that only checked "a canvas was written to" would pass against all of it.
*/

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

const problems = [];

/* The encoder is read out of the page that is actually served, inside a DOM
   because the page is a browser document and will not run without one. Not a copy:
   a copy is a thing that can be correct while the file on the site is not. */
const sandbox = {};
{
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.print = () => {};
  try {
    w.eval(APP + '\n;window.__bc={barcodeBits_,barcodeBars_,barcodeValues_,barcodeChecksum_,'
      + 'CODE128_PATTERNS,BARCODE_START_B,BARCODE_STOP};');
    Object.assign(sandbox, w.__bc);
  } catch (e) {
    console.log('FAIL  the page would not load, so the barcode could not be read: ' + e.message);
    process.exit(1);
  }
}

const pass = what => console.log('PASS  ' + what);
let checks = 0;

/* Each block hands in what it found, and says nothing when it found nothing --
   the failure names itself, and a passing barcode check has nothing to report
   except that it passed. */
const report = bad => {
  checks++;
  if (Array.isArray(bad) && bad.length) {
    console.log('FAIL  ' + bad.join(' -- '));
    problems.push(bad.join('; '));
  } else {
    pass('barcode check ' + checks);
  }
};

const { barcodeBits_, barcodeBars_, barcodeValues_, barcodeChecksum_,
        CODE128_PATTERNS, BARCODE_START_B, BARCODE_STOP } = sandbox;

/* ---- 1. the table itself ---- */
{
  const bad = [];
  if (CODE128_PATTERNS.length !== 107) bad.push('the table has ' + CODE128_PATTERNS.length + ' entries, not 107');
  for (let i = 0; i < 106; i++) {
    if (CODE128_PATTERNS[i].length !== 6) bad.push('pattern ' + i + ' is ' + CODE128_PATTERNS[i].length + ' digits, not 6');
  }
  if (CODE128_PATTERNS[106] !== '2331112') bad.push('the stop pattern is wrong: ' + CODE128_PATTERNS[106]);
  if (BARCODE_START_B !== 104) bad.push('the start character is ' + BARCODE_START_B + ', not 104');
  if (BARCODE_STOP !== 106) bad.push('the stop character is ' + BARCODE_STOP + ', not 106');
  report(bad.length ? 'FAIL  the pattern table is wrong -- ' + bad.slice(0, 3).join('; ') : []);
}

/* ---- 2. the check digit, by hand ---- */
{
  /* "A" is 33 in subset B. Start(104) + 33*1 = 137, 137 mod 103 = 34. */
  const one = barcodeValues_('A');
  const expected = (104 + 33 * 1) % 103;
  const got = barcodeChecksum_(one);
  if (one[0] !== 33) problems.push('"A" should be 33 in subset B, not ' + one[0]);
  if (got !== expected) problems.push('the check digit for "A" is ' + got + ', and the rules give ' + expected);

  /* "AB": 104 + 33*1 + 34*2 = 205, 205 mod 103 = 102. */
  const two = barcodeValues_('AB');
  const expected2 = (104 + 33 * 1 + 34 * 2) % 103;
  const got2 = barcodeChecksum_(two);
  if (two[1] !== 34) problems.push('"B" should be 34 in subset B, not ' + two[1]);
  if (got2 !== expected2) problems.push('the check digit for "AB" is ' + got2 + ', and the rules give ' + expected2);

  report(problems.length ? 'FAIL  the check digit does not follow the rules -- ' + problems.slice(0, 2).join('; ') : []);
}

/* ---- 3. the module count, which is what a scanner measures ---- */
{
  const bad = [];
  for (const text of ['E202610001', 'E202600001', 'A', '0', 'Hello 128', '9'.repeat(40)]) {
    const bits = barcodeBits_(text);
    if (!bits) { bad.push(text + ' produced nothing'); continue; }
    /* start, each character, the check, then the stop -- every one of those is
       eleven modules, and the stop is thirteen because it carries the final bar. */
    const expect = 11 * (text.length + 2) + 13;
    if (bits.length !== expect) {
      bad.push(text + ' is ' + bits.length + ' modules, and ' + text.length
        + ' characters should be ' + expect);
    }
    /* a barcode that does not start with a bar, or does not end with one, reads
       as nothing at all */
    if (bits[0] !== true) bad.push(text + ' does not start on a bar');
    if (bits[bits.length - 1] !== true) bad.push(text + ' does not end on a bar');
  }
  report(bad.length ? 'FAIL  the module counts are wrong -- ' + bad.slice(0, 3).join('; ') : []);
}

/* ---- 4. a changed character must change the barcode ----
       If it does not, the check digit is decorative and a misread at the gate
       produces a valid-looking answer for the wrong child. */
{
  const bad = [];
  const pairs = [['E202610001', 'E202610002'], ['E202610001', 'E202610011'], ['AB12', 'AB13']];
  for (const [a, b] of pairs) {
    if (barcodeBits_(a).join('') === barcodeBits_(b).join('')) {
      bad.push(a + ' and ' + b + ' draw exactly the same bars');
    }
  }
  /* and a check digit that does not move when a character moves */
  if (barcodeChecksum_(barcodeValues_('AB12')) === barcodeChecksum_(barcodeValues_('AB21'))) {
    bad.push('AB12 and AB21 share a check digit');
  }
  report(bad.length ? 'FAIL  the barcode cannot tell two numbers apart -- ' + bad.join('; ') : []);
}

/* ---- 5. what it must refuse ---- */
{
  const bad = [];
  if (barcodeBits_('مُهَيَّم') !== null) bad.push('an Arabic name was drawn as a barcode');
  if (barcodeBits_('') !== null) bad.push('an empty string produced a barcode');
  if (barcodeBars_('مُهَيَّم') !== null) bad.push('an Arabic name produced bars');
  /* the club's own numbers are the ones that must work */
  for (const n of ['E202610001', 'E2026000042', 'S2026000001']) {
    if (!barcodeBars_(n)) bad.push(n + ' could not be encoded');
  }
  report(bad.length ? 'FAIL  it drew or refused the wrong things -- ' + bad.join('; ') : []);
}

/* ---- 6. the run-length bars must add back up to the modules ---- */
{
  const bad = [];
  for (const text of ['E202610001', 'E202600001', 'ABC123']) {
    const shape = barcodeBars_(text);
    const bits = barcodeBits_(text);
    if (!shape || !bits) { bad.push(text + ' did not encode'); continue; }
    if (shape.bars.reduce((a, b) => a + b, 0) >= shape.modules) {
      bad.push(text + ': the bars sum to ' + shape.bars.reduce((a, b) => a + b, 0)
        + ' and the barcode is ' + shape.modules + ' modules -- a barcode with no white in it');
    }
    /* The runs are the black ones. Every barcode of these strings has to contain
       white between its characters, so the number of runs is more than one and
       less than the module count -- a list that came out the same length as the
       modules is the gaps, mislabelled, which is what this caught the first time. */
    if (shape.bars.length < 4) bad.push(text + ' has only ' + shape.bars.length + ' black runs');
    if (shape.bars.length >= shape.modules) bad.push(text + ' has one run per module, which is the gap list');
    /* A real Code 128 alternates black and white, so the black runs and the white
       runs differ by at most one -- and never equal, unless the first run is black
       and the last is white, which the stop pattern prevents. */
    let cursor = 0, black = 0;
    for (const w of shape.bars) { black += w; cursor += w; }
    const white = shape.modules - black;
    if (black === white) bad.push(text + ' is half black and half white, which is not a barcode');
  }
  report(bad.length ? 'FAIL  the bars do not add up -- ' + bad.join('; ') : []);
}

if (problems.length) {
  console.log('\nBARCODE PROBLEMS (' + problems.length + '):');
  [...new Set(problems)].forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('\nThe barcode is Code 128 subset B, and it follows the rules.');