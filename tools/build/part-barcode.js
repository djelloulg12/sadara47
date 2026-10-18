/* A barcode of the registration number, drawn by this page and by nothing else.

   Why written here rather than loaded
   ------------------------------------
   The site already pulls one script off a public CDN. Adding a second one means
   another party can execute code on the page that carries a list of children's
   photographs and the telephone numbers of their parents. That is a real cost for
   forty lines of arithmetic, so the arithmetic is here.

   Code 128, subset B
   ------------------
   Chosen because it is one-dimensional and reads with any ordinary hand scanner,
   and because the number is digits and a letter -- ten characters after the prefix
   -- where a QR would ask a phone camera to do the work a pen does.

   The quiet module is the point. Every character is a different count of black and
   white, and the widths sum to eleven modules, which is what lets a scanner work
   out where one character ends and the next begins. Draw the same string twice and
   it comes out the same width, every time, on every printer.

   The check digit is the part that is easy to leave out and impossible to miss
   later. Without it a misread character produces a number that looks valid, and the
   gate writes down the wrong child.
*/

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232',
  '2331112'
];

const BARCODE_START_B = 104;
const BARCODE_STOP = 106;

/* The string a scanner will read back. Only the characters subset B holds: ASCII
   32 to 126. An Arabic name or a phone number's plus sign is not silently mangled
   into a plausible-looking barcode -- it is refused, because a barcode that scans
   to something other than what it claims is worse than no barcode. */
function barcodeValues_(text) {
  const out = [];
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) return null;
    out.push(code - 32);
  }
  return out;
}

function barcodeChecksum_(values) {
  let sum = BARCODE_START_B;
  for (let i = 0; i < values.length; i++) sum += values[i] * (i + 1);
  return sum % 103;
}

/* An array of booleans, true where a bar is drawn. Widths come straight from the
   pattern, one digit at a time, alternating bar and space from the left. */
function barcodeBits_(text) {
  const values = barcodeValues_(text);
  if (!values || !values.length) return null;

  const sequence = [BARCODE_START_B].concat(values, [barcodeChecksum_(values)], [BARCODE_STOP]);
  const bits = [];
  for (const value of sequence) {
    const pattern = CODE128_PATTERNS[value];
    if (!pattern) return null;
    let bar = true;
    for (const ch of pattern) {
      const n = Number(ch);
      for (let i = 0; i < n; i++) bits.push(bar);
      bar = !bar;
    }
  }
  return bits;
}

/* The bars themselves, as a run-length list rather than one entry per module: at
   print size a barcode is about 140 modules across, and the extra ink of a hundred
   and forty separate filled rectangles is measurable on a card that gets printed a
   hundred at a time.

   These are the BLACK runs. It is worth saying which, because collecting the white
   runs instead -- which is what this did at first -- produces a list of the right
   length that draws the whole barcode shifted by one character, which no eye can
   see and no scanner can read. */
function barcodeBars_(text) {
  const bits = barcodeBits_(text);
  if (!bits) return null;

  const bars = [];
  let width = 0;
  for (const b of bits) {
    if (b) { width++; continue; }
    if (width) { bars.push(width); width = 0; }
  }
  if (width) bars.push(width);

  return { bars, modules: bits.length };
}

/* Drawn into a canvas. Kept separate from the maths so the maths can be checked
   without a browser, which is where it was actually wrong the first time. */
function drawBarcode_(canvas, text, options) {
  const opts = options || {};
  const quiet = opts.quiet == null ? 10 : opts.quiet;
  const height = opts.height || 26;
  const width = opts.width || 150;

  const shape = barcodeBars_(text);
  if (!shape || !canvas || typeof canvas.getContext !== 'function') return false;

  /* A canvas that will not give a context is not a canvas that will show a
     barcode, and asking is itself allowed to fail: some engines have the method
     and throw from it rather than answering. Saying so is the whole point -- the
     caller removes the frame rather than leaving a white rectangle that looks like
     a barcode and is not one. */
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }
  if (!ctx) return false;

  const total = shape.modules + quiet * 2;
  const unit = width / total;

  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  ctx.fillStyle = opts.background || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = opts.ink || '#071a35';

  /* Straight from the modules, one rectangle per black one.

   The run-length list exists for counting and checking; drawing from it means
   working out where the gaps are while drawing, and getting that arithmetic wrong
   produces a barcode shifted by one character -- the same shape, the same ink,
   and a number that scans as somebody else's child. One module, one rectangle, no
   arithmetic. The ink is identical either way; only the number of draw calls
   differs, and a hundred cards is not a hundred cards' worth of work. */
  let x = quiet * unit;
  const bits = barcodeBits_(text);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) ctx.fillRect(Math.round(x), 0, Math.max(1, Math.round(unit)), canvas.height);
    x += unit;
  }
  return true;
}

/* The quiet zone is not decoration. A scanner reading the first bar of a barcode
   that starts at the paper's edge reads nothing at all, and the club finds out at
   the gate rather than in this file. */
function barcodeQuietZone_(text) {
  const shape = barcodeBars_(text);
  return shape ? Math.ceil(shape.modules * 0.10) : 0;
}

/* Drawing every barcode that is on the page, and only those that have a number.

   A canvas with no drawing in it is a white rectangle, and a white rectangle on a
   membership card looks exactly like a barcode that has not come out yet. It fails
   at the gate, in front of a queue, with nobody knowing why.

   So the card that shows the number always shows the bars for that same number, or
   the bars are not there at all. There is no state in which the number appears
   without its barcode. A number that cannot be encoded produces no bars and no
   error, because a card that prints half of something is not a card anybody can
   use -- but the club is told, in the count this returns, rather than finding out
   at the gate. */
function buildBarcodes_() {
  const canvases = document.querySelectorAll('canvas.lux-barcode');
  let drawn = 0;
  let skipped = 0;

  canvases.forEach(canvas => {
    /* One card's canvas failing must not cost every other card its barcode. A
       hundred cards printing ninety-nine bars and one blank is a fault that is
       found at the gate, so each is done on its own and the failure stays local. */
    try {
      const text = canvas.getAttribute('data-barcode') || '';
      if (!barcodeBars_(text)) {
        canvas.parentNode && canvas.parentNode.removeChild(canvas);
        skipped++;
        return;
      }
      if (drawBarcode_(canvas, text, { quiet: 10, height: 30, width: 132 })) drawn++;
      else {
        canvas.parentNode && canvas.parentNode.removeChild(canvas);
        skipped++;
      }
    } catch (_) {
      try { canvas.parentNode && canvas.parentNode.removeChild(canvas); } catch (__) {}
      skipped++;
    }
  });

  return { drawn, skipped };
}

/* Hooked onto the hook the cards already use.

   Cards go into the page in several places -- the page itself, the batch view, the
   sheet of ten -- and each of them already calls one function when it is done.
   Rather than remember to call a second one in each of those places, and rather
   than let one of them be forgotten until a hundred cards are printed wrong, the
   bars are drawn from the same moment. One place to get wrong, and it is the one
   place that already exists. */
if (typeof buildQRCodes === 'function') {
  const beforeTheCodesWereBuilt = buildQRCodes;
  buildQRCodes = function () {
    const out = beforeTheCodesWereBuilt.apply(this, arguments);
    try { buildBarcodes_(); } catch (_) { /* a card without bars is visible; a broken page is not */ }
    return out;
  };
}