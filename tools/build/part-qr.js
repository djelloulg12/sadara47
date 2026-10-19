/* ==========================================================================
   رمز QR للبطاقة — يُرسم هنا، بصيغة SVG متجهة، ولا يُقرأ من أي موقع خارجي.

   لماذا هنا وليس من شبكة عامة
   ---------------------------
   الصفحة كانت تسحب سكربت QR من CDN. وكل سكربت من طرف ثالث يعمل على صفحة
   تحمل صور أطفال وهواتف أوليائهم هو باب مفتوح لا يُغلق بالثقة. فالترميز كله
   مكتوب هنا: جدول جالوا، ورموز ريد-سولومون، ووضع الوحدات، واختيار القناع --
   ثم يُرسم مصفوفةً من الوحدات في مسار SVG حاد، لا في لوحة نقطية.

   لماذا SVG لا canvas
   -------------------
   البطاقة تُطبع. واللوحة النقطية على طابعة بمقاس ٨٥ مم تخرج ناعمة الحواف،
   وحدود الوحدة الرمادية يقرأها الماسح خطأً. أما المسار المتجه فيحدّده الطابعة
   نفسه، فيخرج الحد أسودَ صريحًا على أي دقة.

   ما يُشفَّر
   ---------
   رقم الانخراط، في صورة رابط حضور مباشر إن كانت الصفحة تخدم من عنوان http.
   وهذا هو الرابط الذي تعرفه الصفحة أصلًا وتقرأه عند الدخول (?attendance=...).
   وإن كانت الصفحة تعمل من ملف محلي فلا يُختلق عنوان، ويُشفَّر الرقم وحده.

   الحدود المتوقَّعة
   ----------------
   المستويات L و M، والإصدارات 1 إلى 10 -- أي ما يتّسع لرابط حضور ولاسم رقم
   من عشرة أحرف. وما لا يتّسع يُرفض صراحةً (يعود null) ولا يُرسم رمزٌ ناقص.
   ========================================================================== */

/* ---------- حقل جالوا GF(256)، كثير الحدود البدائي 0x11D ---------- */
const QR_EXP = new Uint8Array(512);
const QR_LOG = new Uint8Array(256);
function qrBuildField_(){
  let x = 1;
  for (let i = 0; i < 255; i++){
    QR_EXP[i] = x;
    QR_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
}
qrBuildField_();

function qrMul_(a, b){ return (a === 0 || b === 0) ? 0 : QR_EXP[QR_LOG[a] + QR_LOG[b]]; }

/* كثير حدود المولّد ∏(x - α^i)، بمعاملات من أعلى درجة إلى أدناها. */
function qrGenerator_(degree){
  let poly = [1];
  for (let i = 0; i < degree; i++){
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++){
      next[j] ^= poly[j];
      next[j + 1] ^= qrMul_(poly[j], QR_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/* باقي القسمة على المولّد: رموز تصحيح الخطأ للكتلة. */
function qrRemainder_(data, degree){
  const gen = qrGenerator_(degree);
  const rem = new Array(degree).fill(0);
  for (let k = 0; k < data.length; k++){
    const factor = data[k] ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= qrMul_(gen[i + 1], factor);
  }
  return rem;
}

/* ---------- جدول الكتل: لكل مستوى وإصدار [رموز تصحيح لكل كتلة، [[عدد، بيانات]]] ----------
   الأعداد مأخوذة من جدول المواصفة، ومجموع كل سطر يساوي عدد رموز الإصدار
   (26, 44, 70, 100, 134, 172, 196, 242, 292, 346) -- وهذا ما يُتحقّق منه في
   الاختبار، فسطرٌ مجموعه غير ذلك يُكشف لا يُغتفر. */
const QR_BLOCKS = {
  L: {
    1:  [7,  [[1, 19]]],
    2:  [10, [[1, 34]]],
    3:  [15, [[1, 55]]],
    4:  [20, [[1, 80]]],
    5:  [26, [[1, 108]]],
    6:  [18, [[2, 68]]],
    7:  [20, [[2, 78]]],
    8:  [24, [[2, 97]]],
    9:  [30, [[2, 116]]],
    10: [18, [[2, 68], [2, 69]]]
  },
  M: {
    1:  [10, [[1, 16]]],
    2:  [16, [[1, 28]]],
    3:  [26, [[1, 44]]],
    4:  [18, [[2, 32]]],
    5:  [24, [[2, 43]]],
    6:  [16, [[4, 27]]],
    7:  [18, [[4, 31]]],
    8:  [22, [[2, 38], [2, 39]]],
    9:  [22, [[3, 36], [2, 37]]],
    10: [26, [[4, 43], [1, 44]]]
  }
};

/* مراكز أنماط المحاذاة. */
const QR_ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

/* بتّا مستوى التصحيح كما يظهران في معلومة الصيغة (لا كما تُكتب). */
const QR_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

/* ---------- النص إلى بايتات UTF-8 ---------- */
function qrBytes_(text){
  const out = [];
  const s = String(text == null ? '' : text);
  for (let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      const cp = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
  }
  return out;
}

/* ---------- اختيار أصغر إصدار يتّسع، ثم بناء الرموز ---------- */
function qrEncode_(text, wantedLevel, wantedVersion, forceMask){
  const bytes = qrBytes_(text);
  const levels = wantedLevel ? [wantedLevel] : ['M', 'L'];
  for (let li = 0; li < levels.length; li++){
    const level = levels[li];
    for (let version = 1; version <= 10; version++){
      if (wantedVersion && version !== wantedVersion) continue;
      const row = QR_BLOCKS[level][version];
      if (!row) continue;
      let dataWords = 0;
      for (let gi = 0; gi < row[1].length; gi++) dataWords += row[1][gi][0] * row[1][gi][1];
      const countBits = version <= 9 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 > dataWords * 8) continue;
      return qrBuild_(bytes, version, level, forceMask);
    }
  }
  return null;
}

function qrBuild_(bytes, version, level, forceMask){
  const row = QR_BLOCKS[level][version];
  const ecPer = row[0];
  const groups = row[1];
  let totalDataWords = 0;
  for (let i = 0; i < groups.length; i++) totalDataWords += groups[i][0] * groups[i][1];

  const bits = [];
  const push = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (let i = 0; i < bytes.length; i++) push(bytes[i], 8);

  const terminator = Math.min(4, totalDataWords * 8 - bits.length);
  for (let i = 0; i < terminator; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const words = [];
  for (let i = 0; i < bits.length; i += 8){
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    words.push(v);
  }
  for (let pad = 0xec; words.length < totalDataWords; pad = pad === 0xec ? 0x11 : 0xec) words.push(pad);

  const dataBlocks = [], ecBlocks = [];
  let at = 0;
  for (let gi = 0; gi < groups.length; gi++){
    const count = groups[gi][0], per = groups[gi][1];
    for (let i = 0; i < count; i++){
      const block = words.slice(at, at + per);
      at += per;
      dataBlocks.push(block);
      ecBlocks.push(qrRemainder_(block, ecPer));
    }
  }

  const interleaved = [];
  let maxData = 0;
  for (let i = 0; i < dataBlocks.length; i++) maxData = Math.max(maxData, dataBlocks[i].length);
  for (let i = 0; i < maxData; i++){
    for (let b = 0; b < dataBlocks.length; b++) if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < ecPer; i++){
    for (let b = 0; b < ecBlocks.length; b++) interleaved.push(ecBlocks[b][i]);
  }

  return qrMatrix_(version, level, interleaved, forceMask);
}

/* ---------- مصفوفة الوحدات ---------- */
function qrMatrix_(version, level, codewords, forceMask){
  const size = version * 4 + 17;
  const modules = [], isFn = [];
  for (let y = 0; y < size; y++){
    modules.push(new Array(size).fill(false));
    isFn.push(new Array(size).fill(false));
  }
  const setFn = (x, y, v) => { modules[y][x] = !!v; isFn[y][x] = true; };

  /* خطّا التزامن: يُرسمان أولًا، لأن نمطي الكشف في الزوايا يعلوان عليهما في
     أطرافهما. ولو رُسم الخطّ بعد الكشف لمحا حاشية الزاوية، وهذا ما كشفه
     الاختبار عند مقارنة المصفوفة بمرجع خارجي: اثنتا عشرة وحدة في أطراف
     الأنماط الثلاثة كانت مقلوبة. */
  for (let i = 0; i < size; i++){ setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }

  /* أنماط الكشف الثلاثة في الزوايا، مع فاصلها. */
  const corners = [[3, 3], [size - 4, 3], [3, size - 4]];
  for (let ci = 0; ci < corners.length; ci++){
    const cx = corners[ci][0], cy = corners[ci][1];
    for (let dy = -4; dy <= 4; dy++){
      for (let dx = -4; dx <= 4; dx++){
        const xx = cx + dx, yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  /* أنماط المحاذاة، عدا ما يقع فوق الزوايا. */
  const centers = QR_ALIGN[version] || [];
  for (let a = 0; a < centers.length; a++){
    for (let b = 0; b < centers.length; b++){
      const cx = centers[b], cy = centers[a];
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
      for (let dy = -2; dy <= 2; dy++){
        for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  /* معلومة الصيغة (بقناع مؤقّت) ومعلومة الإصدار: كلتاهما تشغل مواقعها لتُحسب
     وحدات دالّة قبل وضع البيانات. */
  qrDrawFormat_(size, setFn, level, 0);
  qrDrawVersion_(size, setFn, version);

  /* البيانات: نزول متعرّج من أسفل اليمين، عمودان عمودان، صعودًا ونزولًا. */
  let i = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++){
      for (let j = 0; j < 2; j++){
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && i < totalBits){
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  /* ثمانية أقنعة، وأقلّها عقوبةً هو المستعمل. */
  let best = 0, bestPenalty = -1;
  const masks = (forceMask === undefined || forceMask === null) ? [0, 1, 2, 3, 4, 5, 6, 7] : [forceMask];
  for (let mi = 0; mi < masks.length; mi++){
    const mask = masks[mi];
    qrApplyMask_(size, modules, isFn, mask);
    qrDrawFormat_(size, setFn, level, mask);
    const penalty = qrPenalty_(size, modules);
    if (bestPenalty < 0 || penalty < bestPenalty){ bestPenalty = penalty; best = mask; }
    qrApplyMask_(size, modules, isFn, mask);
  }
  qrApplyMask_(size, modules, isFn, best);
  qrDrawFormat_(size, setFn, level, best);

  return { version: version, size: size, level: level, mask: best, modules: modules };
}

function qrDrawFormat_(size, setFn, level, mask){
  const data = (QR_FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = i => (bits >>> i) & 1;
  for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
  setFn(8, 7, bit(6));
  setFn(8, 8, bit(7));
  setFn(7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
  setFn(8, size - 8, true);
}

function qrDrawVersion_(size, setFn, version){
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++){
    const v = (bits >>> i) & 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFn(a, b, v);
    setFn(b, a, v);
  }
}

function qrApplyMask_(size, modules, isFn, mask){
  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      if (isFn[y][x]) continue;
      let invert = false;
      switch (mask){
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = (((x * y) % 2) + ((x * y) % 3)) === 0; break;
        case 6: invert = ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0; break;
        case 7: invert = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
      }
      if (invert) modules[y][x] = !modules[y][x];
    }
  }
}

/* عقوبة القناع: ما يجعل الرمز يبدو كأنماط الكشف أو ينقسم إلى كتل مسطّحة. */
const QR_PENALTY = { N1: 3, N2: 3, N3: 40, N4: 10 };

function qrPenalty_(size, modules){
  let result = 0;
  const runHistory = [0, 0, 0, 0, 0, 0, 0];

  const countPatterns = () => {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
         + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  };
  const addHistory = (len) => {
    if (runHistory[0] === 0) len += size;
    for (let i = runHistory.length - 1; i > 0; i--) runHistory[i] = runHistory[i - 1];
    runHistory[0] = len;
  };
  const terminate = (color, len) => {
    if (color){ addHistory(len); len = 0; }
    len += size;
    addHistory(len);
    return countPatterns();
  };

  for (let y = 0; y < size; y++){
    let runColor = false, runX = 0;
    runHistory.fill(0);
    for (let x = 0; x < size; x++){
      if (modules[y][x] === runColor){
        runX++;
        if (runX === 5) result += QR_PENALTY.N1;
        else if (runX > 5) result++;
      } else {
        addHistory(runX);
        if (!runColor) result += countPatterns() * QR_PENALTY.N3;
        runColor = modules[y][x];
        runX = 1;
      }
    }
    result += terminate(runColor, runX) * QR_PENALTY.N3;
  }

  for (let x = 0; x < size; x++){
    let runColor = false, runY = 0;
    runHistory.fill(0);
    for (let y = 0; y < size; y++){
      if (modules[y][x] === runColor){
        runY++;
        if (runY === 5) result += QR_PENALTY.N1;
        else if (runY > 5) result++;
      } else {
        addHistory(runY);
        if (!runColor) result += countPatterns() * QR_PENALTY.N3;
        runColor = modules[y][x];
        runY = 1;
      }
    }
    result += terminate(runColor, runY) * QR_PENALTY.N3;
  }

  for (let y = 0; y < size - 1; y++){
    for (let x = 0; x < size - 1; x++){
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += QR_PENALTY.N2;
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const total = size * size;
  const k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
  result += k * QR_PENALTY.N4;
  return result;
}

/* ---------- المصفوفة إلى مسار SVG ----------
   كل مدى أفقي متّصل يصير أمرًا واحدًا، فيكون المسار أقصر ما يمكن وحدّه حادًّا. */
function qrSvgPath_(matrix, quiet){
  const size = matrix.length;
  const pad = quiet === undefined ? 2 : quiet;
  let path = '';
  for (let y = 0; y < size; y++){
    let x = 0;
    while (x < size){
      if (!matrix[y][x]){ x++; continue; }
      let run = 1;
      while (x + run < size && matrix[y][x + run]) run++;
      path += 'M' + (x + pad) + ' ' + (y + pad) + 'h' + run + 'v1h-' + run + 'z';
      x += run;
    }
  }
  const edge = size + pad * 2;
  return { path: path, edge: edge };
}

function qrSvgMarkup_(text, options){
  const opts = options || {};
  const made = qrEncode_(text, opts.level || null);
  if (!made) return null;
  const drawn = qrSvgPath_(made.modules, opts.quiet);
  const label = opts.label || 'رمز الاستجابة السريعة';
  return '<svg class="lux-qr-svg" viewBox="0 0 ' + drawn.edge + ' ' + drawn.edge + '"'
    + ' shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet" role="img"'
    + ' aria-label="' + esc(label) + '" data-qr-version="' + made.version + '" data-qr-mask="' + made.mask + '">'
    + '<rect x="0" y="0" width="' + drawn.edge + '" height="' + drawn.edge + '" fill="#ffffff"></rect>'
    + '<path d="' + drawn.path + '" fill="#000000"></path>'
    + '</svg>';
}

/* ---------- الرابط الذي يقرأه الهاتف ----------
   الرقم وحده يقرأه ماسح الجدول؛ والرابط يفتح المنصة على شاشة الهاتف. تُفضَّل
   الصيغة التي تعرفها الصفحة أصلًا (?attendance=)، ولا يُختلق عنوان من ملف محلي. */
function qrPayloadFor_(id){
  const value = String(id == null ? '' : id).trim();
  if (!value) return '';
  try {
    const origin = window.location && window.location.origin;
    if (/^https?:\/\//i.test(origin)) return origin + '/?attendance=' + encodeURIComponent(value);
  } catch (_) {}
  return value;
}

/* ---------- رسم كل مواضع الرموز في الصفحة ----------
   الصفحة كانت تطلب canvas من مكتبة CDN. الآن كل [data-qr] يحمل نصّه، فيُرسم
   هنا. وفشل رمز واحد لا يكلّف بقية البطاقات رموزَها. */
function qrRenderPage_(){
  const nodes = document.querySelectorAll('[data-qr]');
  let drawn = 0, refused = 0;
  Array.prototype.forEach.call(nodes, node => {
    const text = node.getAttribute('data-qr') || '';
    if (!text){ node.innerHTML = ''; node.setAttribute('data-qr-state', 'empty'); return; }
    let svg = null;
    try { svg = qrSvgMarkup_(text, { level: 'M', label: node.getAttribute('data-qr-label') || 'رمز الاستجابة السريعة' }); }
    catch (_) { svg = null; }
    if (svg){ node.innerHTML = svg; node.setAttribute('data-qr-state', 'drawn'); drawn++; }
    else { node.innerHTML = ''; node.setAttribute('data-qr-state', 'refused'); refused++; }
  });
  return { drawn: drawn, refused: refused };
}

buildQRCodes = function(){ try { return qrRenderPage_(); } catch (_) { return null; } };
