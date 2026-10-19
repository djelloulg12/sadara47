/* The QR on the card is checked against an encoder that is not this one.

   A QR code that is wrong looks exactly like a QR code that is right: a square of
   black and white, plausible at a glance, and readable only by the gate's phone.
   Nothing about it says "this scans as nothing at all". So it is checked here
   against reference matrices produced by an independent, external generator and
   stored in tools/tests/fixtures/qr-reference.json -- captured once and compared
   for ever, with no network in the loop after that.

   What is asserted:
     * seven payloads, versions 1 to 8, at levels L and M, reproduce the reference
       matrix module for module -- which is the whole encoder at once: the UTF-8
       bytes, the Reed-Solomon remainder, the block interleaving, the module
       placement, the timing lines, the finder rings, the alignment patterns, the
       format information and the version information
     * the block table's own arithmetic, because every row of it must account for
       exactly the number of codewords its version holds
     * the mask is chosen by the penalty the specification defines, and the choice
       is the lowest-penalty mask
     * the drawing is an SVG whose edge is a whole number of modules plus its quiet
       margin, whose marks are the dark modules and nothing else, and which is
       drawn with sharp edges so a printer cannot blur it
     * what is refused is refused whole: a payload too long for version 10 comes
       back as nothing rather than as a code that scans as a different number
     * the payload a card carries: the attendance link the page already reads, and
       never an address invented from a file:// page

   A test that only checked "an SVG was written" would pass against all of it.
*/

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUBLIC = path.resolve(__dirname, '..', '..', 'firebase-public');
const APP = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
const FIXTURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'qr-reference.json'), 'utf8'));

const problems = [];

/* The encoder is read out of the page that is actually served, inside a DOM because
   the page is a browser document and will not run without one. Not a copy: a copy is
   a thing that can be correct while the file on the site is not. */
const sandbox = {};
{
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.print = () => {};
  try {
    w.eval(APP + '\n;window.__qr={qrBytes_,qrRemainder_,qrEncode_,qrMatrix_,qrPenalty_,qrSvgPath_,'
      + 'qrSvgMarkup_,qrPayloadFor_,qrRenderPage_,QR_BLOCKS,QR_ALIGN,QR_FORMAT_BITS};');
    Object.assign(sandbox, w.__qr);
    sandbox.window = w;
    sandbox.document = w.document;
  } catch (e) {
    console.log('FAIL  the page would not load, so the QR encoder could not be read: ' + e.message);
    process.exit(1);
  }
}

let checks = 0;
const report = (bad, what) => {
  checks++;
  if (bad && bad.length) {
    console.log('FAIL  ' + what + ' -- ' + bad.slice(0, 3).join('; '));
    problems.push(...bad);
  } else {
    console.log('PASS  ' + what);
  }
};

const {
  qrBytes_, qrRemainder_, qrEncode_, qrPenalty_, qrSvgPath_,
  qrSvgMarkup_, qrPayloadFor_, qrRenderPage_, QR_BLOCKS, QR_ALIGN
} = sandbox;

/* The matrix the encoder produced, as the reference is stored: rows of 0 and 1. */
const asRows = made => made.modules.map(row => row.map(m => (m ? '1' : '0')).join(''));

/* ---- 1. the reference matrices, module for module ----
   The external generator picks its own mask, and goqr.me always reports mask 2 --
   while the specification says to choose by penalty, which is a cosmetic choice and
   this encoder makes it honestly. So each reference is matched by forcing every one
   of the eight masks in turn: exactly one of them must reproduce it. If none does,
   the encoding itself is wrong, and no mask can hide that. */
{
  const bad = [];
  for (const ref of FIXTURES) {
    const version = (ref.modules - 17) / 4;
    let matched = -1;
    for (let mask = 0; mask < 8; mask++) {
      const made = qrEncode_(ref.data, ref.ecc, version, mask);
      if (made && asRows(made).join('|') === ref.rows.join('|')) { matched = mask; break; }
    }
    if (matched === -1) {
      bad.push('"' + ref.data.slice(0, 24) + '" (' + ref.ecc + ' v' + version
        + ') does not reproduce the reference in any of the eight masks');
    }
    /* And the encoder's own choice of version must be the reference's version when
       it is left to choose: a payload that fits version 4 must not be pushed into
       version 10 by an off-by-one in the capacity arithmetic. */
    const auto = qrEncode_(ref.data, ref.ecc, null, null);
    if (!auto || auto.version !== version) {
      bad.push('"' + ref.data.slice(0, 24) + '" is version ' + (auto && auto.version)
        + ' when left to choose, and the reference is version ' + version);
    }
  }
  report(bad, 'seven reference matrices reproduced, versions 1 to 8, levels L and M');
}

/* ---- 2. the bytes, before anything is drawn ----
   Arabic is the case that matters: it is the whole reason the bytes are UTF-8 and
   not char codes, and a wrong byte here is a code that scans as a different string. */
{
  const bad = [];
  const want = [0xd8, 0xb3, 0xd8, 0xa8, 0xd8, 0xa7, 0xd8, 0xad];
  const got = qrBytes_('سباح');
  if (got.join(',') !== want.join(',')) bad.push('"سباح" is ' + got.join(',') + ' and not its UTF-8 bytes');
  if (qrBytes_('E202610001').length !== 10) bad.push('ten ASCII characters are not ten bytes');
  /* A character outside the basic plane is four bytes, and the surrogate pair has to
     be read as one code point rather than as two broken halves. */
  if (qrBytes_('\u{1F3CA}').join(',') !== '240,159,143,138') {
    bad.push('a swimmer emoji is not encoded as one four-byte code point: ' + qrBytes_('\u{1F3CA}').join(','));
  }
  report(bad, 'the payload is UTF-8, and Arabic is two bytes a letter');
}

/* ---- 3. the block table has to add up ----
   Every row of it names how many error-correction codewords go with each data block
   and how many blocks there are. The sum must be exactly the number of codewords
   the version holds -- and the numbers are the ones the specification prints, not
   derived from this file. */
{
  const bad = [];
  const TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346 };
  for (const level of Object.keys(QR_BLOCKS)) {
    for (const v of Object.keys(QR_BLOCKS[level])) {
      const [ecPer, groups] = QR_BLOCKS[level][v];
      let blocks = 0, data = 0;
      for (const [count, per] of groups) { blocks += count; data += count * per; }
      const total = blocks * ecPer + data;
      if (total !== TOTAL[v]) {
        bad.push(v + '-' + level + ' holds ' + total + ' codewords and the specification says ' + TOTAL[v]);
      }
      /* An error-correction block cannot be larger than the data blocks it protects
         by an unreasonable margin; the specification's largest is 30. */
      if (ecPer < 7 || ecPer > 30) bad.push(v + '-' + level + ' has ' + ecPer + ' error-correction codewords per block');
    }
  }
  /* The alignment centres of each version, counted: a version of 32 modules or more
     has three, and none of them may fall on a finder. */
  for (const v of Object.keys(QR_ALIGN)) {
    const c = QR_ALIGN[v];
    if (Number(v) >= 7 && c.length !== 3) bad.push('version ' + v + ' has ' + c.length + ' alignment centres and should have three');
    for (const x of c) {
      const max = Number(v) * 4 + 17 - 7;
      if (x < 6 || x > max) bad.push('version ' + v + ' has an alignment centre at ' + x + ', outside the symbol');
    }
  }
  report(bad, 'every row of the block table accounts for its version\'s codewords');
}

/* ---- 4. the mask is chosen by the penalty, and the choice is the cheapest ----
   Six choices are cosmetic and one is wrong: an unchosen mask leaves the code
   legible, a badly chosen one leaves it full of shapes a scanner reads as a finder
   pattern. So the mask that comes back must be the one with the lowest penalty. */
{
  const bad = [];
  for (const text of ['E202610001', 'https://sadara.web.app/?attendance=E2026100001', 'سباح', 'x'.repeat(60)]) {
    const chosen = qrEncode_(text, 'M', null, null);
    if (!chosen) { bad.push('"' + text.slice(0, 20) + '" could not be encoded at all'); continue; }
    let best = -1, bestPenalty = -1;
    for (let mask = 0; mask < 8; mask++) {
      const made = qrEncode_(text, 'M', chosen.version, mask);
      const penalty = qrPenalty_(made.size, made.modules);
      if (bestPenalty < 0 || penalty < bestPenalty) { bestPenalty = penalty; best = mask; }
    }
    if (chosen.mask !== best) {
      bad.push('"' + text.slice(0, 20) + '" took mask ' + chosen.mask + ' and mask ' + best
        + ' is cheaper (' + bestPenalty + ')');
    }
  }
  report(bad, 'the mask with the lowest penalty is the mask that is used');
}

/* ---- 5. the drawing ----
   The code is printed at seventeen millimetres, so its module is under half a
   millimetre: what is drawn has to be a whole number of modules plus the two-module
   quiet margin at every side, and its marks have to be the dark modules exactly. */
{
  const bad = [];
  const text = 'https://sadara.web.app/?attendance=E2026100001';
  const made = qrEncode_(text, 'M', null, null);
  const svg = qrSvgMarkup_(text, { level: 'M' });
  if (!made || !svg) bad.push('the card\'s own payload could not be drawn');
  else {
    const edge = made.size + 4;
    const view = (svg.match(/viewBox="0 0 (\d+) (\d+)"/) || []).slice(1).map(Number);
    if (view[0] !== edge || view[1] !== edge) {
      bad.push('the code is drawn ' + view.join('x') + ' and version ' + made.version
        + ' plus its quiet margin is ' + edge);
    }
    if (!/shape-rendering="crispEdges"/.test(svg)) bad.push('the code is not drawn with sharp edges');
    if (/xmlns/.test(svg)) bad.push('the code carries a namespace, which is a link a static check has to allow');
    /* One white ground and one black mark, and no second of either: a code drawn as
       thousands of separate squares is a code a printer rounds off. */
    if ((svg.match(/<rect /g) || []).length !== 1) bad.push('the code does not have exactly one white ground');
    if ((svg.match(/<path /g) || []).length !== 1) bad.push('the code is not drawn as a single path');

    const drawn = qrSvgPath_(made.modules, 2);
    let dark = 0;
    for (const row of made.modules) for (const m of row) if (m) dark++;
    let area = 0;
    for (const m of drawn.path.matchAll(/h(\d+)v1h-/g)) area += Number(m[1]);
    if (area !== dark) bad.push('the drawing covers ' + area + ' modules and the matrix has ' + dark + ' dark ones');
    if (!/data-qr-version="/.test(svg) || !/data-qr-mask="/.test(svg)) {
      bad.push('the drawing does not say which version and mask it is, so a scan failure cannot be diagnosed');
    }
  }
  report(bad, 'the code is drawn as one crisp path, a whole number of modules across');
}

/* ---- 6. what is refused ---- */
{
  const bad = [];
  /* Too long for version 10 at either level: refused whole. A partial code is worse
     than no code -- it scans, and it scans as something else. */
  if (qrEncode_('a'.repeat(300), null, null, null) !== null) {
    bad.push('a payload of 300 bytes was encoded instead of refused');
  }
  /* And what does fit at the top is still encoded: a refusal at the boundary is only
     meaningful if the last size that fits still fits. */
  if (!qrEncode_('a'.repeat(250), null, null, null)) {
    bad.push('a payload of 250 bytes did not fit, though it does');
  }
  /* A symbol that cannot be drawn is refused rather than drawn empty. */
  if (qrSvgMarkup_('a'.repeat(300), {}) !== null) bad.push('an undrawable payload produced an image');
  report(bad, 'a payload too long for version 10 is refused rather than truncated');
}

/* ---- 7. the payload, and the page that draws it ---- */
{
  const bad = [];
  /* The page is served, so the code opens the attendance page the platform already
     reads: ?attendance= is the hook that records a present member. */
  const real = qrPayloadFor_('E2026100001');
  if (!/^https?:\/\/[^/]+\/\?attendance=E2026100001$/.test(real)) {
    bad.push('the code does not carry the attendance link: ' + real);
  }
  if (qrPayloadFor_('') !== '') bad.push('an empty number produced a payload');
  if (qrPayloadFor_('  ') !== '') bad.push('a number of spaces produced a payload');
  /* A number with a character that has to be escaped is escaped rather than pasted
     in, or the link opens the wrong page. */
  if (!/attendance=A%2FB/.test(qrPayloadFor_('A/B'))) bad.push('the number is not escaped in the link');
  /* And a page opened from a file, with no address to point at, carries the number
     alone: inventing an origin there would be a code for a page that does not exist.
     The function is lifted out of the served source and run in a file:// document,
     so what is tested is the code on the site and not a copy of it. */
  {
    const at = APP.lastIndexOf('function qrPayloadFor_');
    const src = APP.slice(at, APP.indexOf('\n}', at) + 2);
    const off = new JSDOM('<!doctype html><html></html>', { url: 'file:///C:/x/index.html' }).window;
    const plain = off.eval('(' + src + ')("E2026100001")');
    if (plain !== 'E2026100001') bad.push('a page opened from a file invented an address: ' + plain);
  }
  report(bad, 'the code carries the attendance link when served and the bare number from a file');
}

/* ---- 8. every [data-qr] on a page gets a code, and one that cannot be drawn says so ---- */
{
  const bad = [];
  const result = sandbox.window.eval(
    '(function(){'
    + 'var host=document.createElement("div");'
    + 'host.innerHTML=\'<div class="a" data-qr="E2026100001"></div>'
    + '<div class="b" data-qr=""></div>'
    + '<div class="c" data-qr="\' + "x".repeat(300) + \'"></div>\';'
    + 'document.body.appendChild(host);'
    + 'var counts=qrRenderPage_();'
    + 'var shape=[].map.call(host.querySelectorAll("[data-qr]"),function(n){return n.getAttribute("data-qr-state");});'
    + 'var svgs=host.querySelectorAll("svg.lux-qr-svg").length;'
    + 'host.remove();'
    + 'return { counts: counts, shape: shape, svgs: svgs };'
    + '})()');
  if (result.counts.drawn !== 1 || result.counts.refused !== 1) {
    bad.push('the page drew ' + result.counts.drawn + ' and refused ' + result.counts.refused
      + ', and there is one of each to do');
  }
  if (result.shape.join(',') !== 'drawn,empty,refused') {
    bad.push('the three code boxes report ' + result.shape.join(', ') + '; they should be drawn, empty, refused');
  }
  if (result.svgs !== 1) bad.push(result.svgs + ' images were drawn for one code');
  report(bad, 'each code box is drawn, and a box that cannot be drawn says so');
}

if (problems.length) {
  console.log('\nQR PROBLEMS (' + problems.length + '):');
  [...new Set(problems)].forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('\nThe code is a real QR: byte mode, Reed-Solomon, and the reference encoder agrees.');
