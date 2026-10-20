/* شاشة المسح: من يسجّل الحضور، ومن سجّله.

   بطاقة السباح تحمل رمز QR إلى الآن، ولا شيء في المنصة يقرؤه. هذه الطبقة
   تقرؤه: شاشة واحدة يفتحها المسير أو المدرب على هاتفه، يوجّه الكاميرا إلى
   البطاقة، فيُكتب الحضور. وثلاثة أشياء تسبق الكاميرا:

     1. من يقف أمامها. تسجيل الحضور بالمسح للـمسير والمدرب، لا للسباح ولا
        للولي. والفحص في مكانين: هنا في الشاشة، وهناك في الخادم -- لأن صفحة
        تُخفي زرًّا ليست صفحة تمنع كتابة.

     2. من سُجّل له. الرقم وحده لا يكفي ليعرف القارئ أنه سجّل لطفل في
        النادي: بطاقة من نادٍ آخر تحمل رقمًا ليس عندنا، ورقم مكتوب بخطأ
        حرف واحد. كل QR يُقابَل بسجل السباحين قبل أن يُكتب، ويُقال ما
        قُرئ بالحرف حين لا يُقابَل.

     3. من سجّل. اسم الماسح وصفته وتوقيت المسح يُكتبون في قاعدة البيانات
        ويظهرون في القائمة تحت الكاميرا وفي كشف الحضور المطبوع.

   ولا يتكرر الحضور: بطاقة تُوجَّه إلى الكاميرا مرتين خلال ثانيتين لا
   تُكتب مرتين، والقيد الثاني يُعلَن «سُجّل قبل قليل» لا يُسكَت عنه --
   سكوتٌ يُظهر بطاقةً لم تُكتب.

   والكتابة نفسها تمرّ من `recordPendingAttendance` الذي تعرفه المنصة:
   الرابط `?attendance=...` المطبوع على البطاقة وزرّ المسح يسلكان الطريق
   نفسه، فلا يختلف حضور عن حضور بحسب من كتبه. */

/* من يسجّل الحضور. الأدوار الأربعة هي التي يقبلها الخادم في
   `scannerView`؛ والقائمة هنا للعرض والرسالة، والحكم هناك. */
const SCAN_ROLES = ['admin', 'president', 'manager', 'coach'];

const SCAN_DUPLICATE_MS = 5000;

const SCAN_REASON = 'تسجيل الحضور بالمسح خاص بالمسيرين والمدربين فقط.';

/* ترتيب صفة من مسح، للوسم في القائمة: «سجّله: فلان (مدرب)». */
function recorderLabel_(name, role) {
  const who = String(name || '').trim();
  if (!who) return '';
  const title = String(role || '') === 'coach' ? 'مدرب' : (String(role || '') ? 'مسير' : '');
  return title ? who + ' (' + title + ')' : who;
}

/* التوقيت من الطابع الزمني، بالثواني كما طُلب: 17:15:30. */
function scanClock_(at) {
  const m = String(at || '').match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : '';
}

const scanState_ = {
  open: false,
  stream: null,
  running: false,
  reader: null,
  results: [],
  pendingId: '',
  lastSent: {},
  notice: '',
  noticeKind: '',
  typed: '',
  listLoaded: false
};

function canScan() {
  return !!(state.user && SCAN_ROLES.indexOf(String(state.user.role || '')) !== -1);
}

/* لون واحد للصف: أخضر لمن كُتب، أحمر لمن رُفض، رمادي لمن لم يُقابل. */
const SCAN_BADGE = { ok: 'success', refused: 'absent', unknown: 'pending' };

/* ---- القراءة: العلامة في الرابط، أو الرقم وحده ---- */

/* ما يقرؤه أي قارئ QR: الرابط الكامل أو الرقم وحده. والصفحة تعرف قراءة
   الرابط من `recordPendingAttendance`، وهذه قراءتها نفسها. */
function scanToken_(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  const marked = raw.match(/[?&]attendance=([^&\s]+)/i);
  if (marked) {
    try { return decodeURIComponent(marked[1]); } catch (_) { return marked[1]; }
  }
  if (/^https?:\/\//i.test(raw)) {
    /* رابط بلا علامة الحضور بطاقة من مكان آخر، لا بطاقة رقمها رابط. */
    try {
      const url = new URL(raw);
      return (url.searchParams.get('attendance') || '').trim();
    } catch (_) { return ''; }
  }
  return raw;
}

/* السباح الذي يحمل هذا الرقم، بالرقم الذي على البطاقة. */
function findScanned_(id) {
  const want = String(id || '').trim();
  if (!want) return null;
  const swimmers = state.swimmers || [];
  return swimmers.find(s => String(s.id) === want)
    || swimmers.find(s => String(s.registration_id || '') === want)
    || swimmers.find(s => String(s.membership_no || '') === want)
    || null;
}

/* ---- الكتابة: الطريق الذي تعرفه المنصة ---- */

/* تسجيل واحد: من القراءة إلى الكتابة.

   الردود أربعة، ولكل واحد معناه:

     كتب        الحضور مكتوب، ويُعلن باسم من سجّله.
     كُتب للتوّ  البطاقة نفسها قُدّمت مرتين خلال ثوانٍ: لم يُكتب شيء
                ثانٍ، ويُقال ذلك بدل أن يُعاد عرضه كأنه جديد.
     رُفض       الخادم رفض -- دور أو تاريخ أو اتصال. يُقال نصًّا.
     لم يُقابل  الرقم ليس في سجل السباحين: يُعرض كما قُرئ ليُقارَن. */
async function recordScan_(value, options) {
  const opts = options || {};
  const token = scanToken_(value);
  if (!token) return { kind: 'unknown', id: '', reason: 'لم يُقرأ من الرمز أي رقم.' };

  const swimmer = findScanned_(token);
  if (!swimmer) {
    return {
      kind: 'unknown',
      id: token,
      reason: 'هذا الرقم ليس في سجل السباحين: ' + token
    };
  }

  const now = Date.now();
  const sentAt = scanState_.lastSent[swimmer.id];
  if (sentAt && (now - sentAt) < SCAN_DUPLICATE_MS) {
    return {
      kind: 'repeat',
      id: swimmer.id,
      name: swimmer.name || '',
      group: swimmer.group || '',
      reason: 'سُجّل قبل قليل — لم يُكتب مرة أخرى.'
    };
  }

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ member_id: swimmer.id, swimmer_id: swimmer.id, status: 'present' })
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* a refusal with no body is still a refusal */ }
    if (!res.ok) {
      return {
        kind: 'refused',
        id: swimmer.id,
        name: swimmer.name || '',
        reason: data.error || 'رفض الخادم تسجيل الحضور.'
      };
    }
    const recorder = (data && data.recorded_by) || null;
    scanState_.lastSent[swimmer.id] = now;
    /* العلامة تُكتب في الحالة المحلية أيضًا، فقائمة اليوم تُظهرها في
       الحال بلا انتظار تحديث. */
    try {
      const day = todayISO();
      state.attendanceByDay = state.attendanceByDay || {};
      (state.attendanceByDay[day] = state.attendanceByDay[day] || {})[swimmer.id] = {
        status: 'present',
        at: new Date().toISOString(),
        recorder: (recorder && recorder.name) || (state.user && state.user.name) || '',
        recorderRole: (recorder && recorder.role) || (state.user && state.user.role) || ''
      };
      save();
    } catch (_) { /* the server has it; the page's copy is a convenience */ }
    return {
      kind: 'ok',
      id: swimmer.id,
      name: swimmer.name || '',
      group: swimmer.group || '',
      at: new Date().toISOString(),
      recorder: recorder || {
        name: (state.user && state.user.name) || '',
        role: (state.user && state.user.role) || ''
      },
      reason: ''
    };
  } catch (err) {
    return {
      kind: 'refused',
      id: swimmer.id,
      name: swimmer.name || '',
      reason: (err && err.message) ? err.message : 'تعذّر الوصول إلى الخادم.'
    };
  }
}

/* ---- الشاشة ---- */

function scanRecorder_() {
  try {
    const m = dayMark(attendanceDay(), '');
    return m;
  } catch (_) { return null; }
}

/* سطر واحد في «آخر ما سُجل»، وهو الشكل الذي يُقرأ في المسبح: الاسم،
   ثم «سجّله: فلان (مدرب)» ثم الساعة. */
function scanResultHtml_(r) {
  const badge = SCAN_BADGE[r.kind] || 'pending';
  const who = r.kind === 'ok' ? recorderLabel_((r.recorder && r.recorder.name) || '', (r.recorder && r.recorder.role) || '') : '';
  const clock = scanClock_(r.at) || '';
  return '<div class="scan-result ' + esc(r.kind) + '">'
    + '<div class="scan-result-main"><b>' + esc(r.name || r.id || '—') + '</b>'
    + '<small dir="ltr">' + esc(clubDigits(r.id || '')) + (r.group ? ' • ' + esc(r.group) : '') + '</small></div>'
    + '<div class="scan-result-side">'
    + (r.kind === 'ok'
      ? '<span class="status ' + badge + '">سجّله: ' + esc(who || '—') + '</span>'
      : '<span class="status ' + badge + '">' + esc(r.kind === 'repeat' ? 'مكرر' : r.kind === 'unknown' ? 'غير معروف' : 'مرفوض') + '</span>')
    + (clock ? '<small dir="ltr">' + esc(clock) + '</small>' : '')
    + '<p class="scan-result-note">' + esc(r.reason || (r.kind === 'ok' ? 'تم تسجيل الحضور.' : '')) + '</p>'
    + '</div></div>';
}

function pageScan() {
  const me = state.user || {};
  const meLabel = recorderLabel_(me.name || '', me.role || '');
  return '<div class="toolbar"><span class="page-description">وجّه الكاميرا إلى رمز QR على بطاقة السباح — يُسجَّل الحضور باسمك أنت.</span>'
    + '<div class="toolbar-group">'
    + '<button class="btn btn-outline" data-action="scan-typed">⌨ إدخال الرقم يدويًا</button>'
    + '<button class="btn btn-outline" data-action="refresh-data">↻ تحديث</button>'
    + '</div></div>'
    + '<p class="groups-note" role="status">الماسح الآن: <b>' + esc(meLabel || '—') + '</b> · '
    + 'التاريخ: <span dir="ltr">' + esc(clubDigits(slashDate(longDate()))) + '</span></p>'
    + '<section class="panel scan-panel">'
    + '<div class="panel-head"><div><h3>ماسح البطاقات</h3>'
    + '<p>الحضور يُسجَّل للمسير والمدرب فقط، ويُحفظ معه اسم من سجّله وصفته وتوقيت المسح.</p></div>'
    + '<div class="toolbar-group">'
    + '<button class="btn btn-primary" data-action="scan-start">▶ تشغيل الكاميرا</button>'
    + '<button class="btn btn-outline" data-action="scan-stop">■ إيقاف</button>'
    + '</div></div>'
    + '<div class="scan-stage" id="scan-stage" hidden>'
    + '<video class="scan-video" id="scan-video" playsinline muted></video>'
    + '<div class="scan-frame" aria-hidden="true"></div>'
    + '</div>'
    + '<p class="scan-hint" id="scan-hint">'
    + (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia
      ? 'هذا المتصفح لا يفتح الكاميرا. استعمل «إدخال الرقم يدويًا» أو اكتب الرقم في المربّع أسفله.'
      : 'إن لم تُفتح الكاميرا فالهاتف يحتاج اتصالًا آمنًا (https) وإذنًا بالكاميرا.')
    + '</p>'
    + '<label class="scan-manual">رقم السباح أو رمز البطاقة'
    + '<span class="scan-row"><input id="scan-input" dir="ltr" placeholder="E202610001" value="' + esc(scanState_.typed || '') + '">'
    + '<button class="btn btn-primary" data-action="scan-submit">تسجيل</button></span></label>'
    + '</section>'
    + '<section class="panel scan-log"><div class="panel-head"><div><h3>آخر ما سُجل</h3>'
    + '<p>' + clubDigits(scanState_.results.length) + ' عملية في هذه الجلسة</p></div>'
    + '<button class="btn btn-outline" data-action="scan-clear">مسح القائمة</button></div>'
    + (scanState_.results.length
      ? scanState_.results.map(scanResultHtml_).join('')
      : '<p class="empty-cell">لم يُسجَّل شيء بعد في هذه الجلسة.</p>')
    + '</section>';
}

function scanNotice_(text, kind) {
  scanState_.notice = String(text || '');
  scanState_.noticeKind = kind || '';
}

/* ---- الكاميرا ---- */

function scanStop_() {
  scanState_.running = false;
  if (scanState_.reader) {
    try { scanState_.reader.cancel(); } catch (_) {}
    scanState_.reader = null;
  }
  if (scanState_.stream) {
    try { scanState_.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    scanState_.stream = null;
  }
  const video = document.getElementById('scan-video');
  if (video) { try { video.pause(); video.srcObject = null; } catch (_) {} }
  const stage = document.getElementById('scan-stage');
  if (stage) stage.hidden = true;
}

async function scanStart_() {
  if (!canScan()) { showToast(SCAN_REASON, 'error'); return; }
  const video = document.getElementById('scan-video');
  const stage = document.getElementById('scan-stage');
  const hint = document.getElementById('scan-hint');
  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanNotice_('لا يمكن فتح الكاميرا على هذا الجهاز. استعمل إدخال الرقم يدويًا.', 'error');
    showToast('لا يمكن فتح الكاميرا على هذا الجهاز — استعمل إدخال الرقم يدويًا.', 'error');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false
    });
    scanState_.stream = stream;
    video.srcObject = stream;
    try { await video.play(); } catch (_) {}
    if (stage) stage.hidden = false;
    if (hint) hint.textContent = 'وجّه الكاميرا إلى رمز QR على البطاقة.';
    scanState_.running = true;
    scanLoop_();
  } catch (err) {
    const why = (err && err.name === 'NotAllowedError')
      ? 'لم يُسمح باستعمال الكاميرا. اسمح بالكاميرا من إعدادات المتصفح ثم أعد المحاولة.'
      : 'تعذّر فتح الكاميرا — استعمل إدخال الرقم يدويًا.';
    scanNotice_(why, 'error');
    showToast(why, 'error');
  }
}

/* حلقة القراءة: قارئ QR إن وُجد في المتصفح، وإلا قارئ الباركود. ولا شيء
   منهما في كل المتصفحات، ولهذا يبقى المربّع اليدوي معروضًا دائمًا. */
function scanLoop_() {
  if (!scanState_.running) return;
  const video = document.getElementById('scan-video');
  if (!video) return;
  const Detector = window.BarcodeDetector;
  if (!Detector) {
    scanNotice_('هذا المتصفح لا يقرأ الرموز آليًا — استعمل إدخال الرقم يدويًا.', 'error');
    scanState_.running = false;
    return;
  }
  let detector = null;
  try { detector = new Detector({ formats: ['qr_code'] }); } catch (_) { detector = null; }
  const step = async () => {
    if (!scanState_.running || !detector) return;
    try {
      const found = await detector.detect(video);
      if (found && found.length) {
        await scanHandle_(String(found[0].rawValue || ''));
      }
    } catch (_) { /* a frame that could not be read is a frame, not a failure */ }
    if (scanState_.running) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

/* قراءةٌ واحدة: تُكتب، ثم يُحدَّث السطر الأول من القائمة، ولا تُعاد
   الصفحة كاملة -- إعادة الرسم تُغلق الكاميرا. */
async function scanHandle_(value) {
  const id = scanToken_(value);
  if (!id) return;
  if (scanState_.pendingId === id) return;
  scanState_.pendingId = id;
  const result = await recordScan_(value);
  scanState_.pendingId = '';
  if (result.kind === 'repeat') { scanNotice_(result.reason, ''); return; }
  if (result.kind === 'unknown') { scanNote_(result.reason, 'error'); }
  scanState_.results.unshift(result);
  if (scanState_.results.length > 30) scanState_.results.length = 30;
  const log = document.querySelector('.scan-log');
  if (log) log.outerHTML = pageScan().match(/<section class="panel scan-log">[\s\S]*<\/section>/)[0];
  else renderPageOnly();
}

function scanNote_(text, kind) {
  scanNotice_(text, kind);
  if (kind === 'error') showToast(text, 'error');
}

/* ---- بعد الدخول: الشاشة والعنصر ---- */

/* لا تُفتح شاشة المسح لغير المسير والمدرب.

   `checkScannerAccess` في الشاشة و`scannerView` في الخادم يقولان الشيء
   نفسه: من قرأ هذا السطر ومن قرأ ذاك يجب أن يتفقا، وإلا عرضنا شاشة
   يرفضها الخادم عند أول كتابة. */
function scanAccess_() {
  if (!state.user) return { ok: false, why: 'يرجى تسجيل الدخول أولًا للوصول إلى ماسح الحضور.' };
  if (!canScan()) return { ok: false, why: SCAN_REASON };
  return { ok: true, why: '' };
}

/* عنصر الشاشة في قائمة المنصة، للمسير والمدرب وحدهما.

   وللمنصة قائمتان: قائمة الإدارة (`.side-nav`) وقائمة الدور
   (`.role-nav`). المدرب يرى الثانية، والمسير الأولى -- ولذلك يُضاف
   العنصر إلى أيّهما وُجد، ولا يُضاف إلى قائمة لا يحقّ لصاحبها. */
function injectScanNav() {
  if (!canScan()) return;
  const side = document.querySelector('.side-nav');
  if (side && !side.querySelector('[data-page="scan"]')) {
    side.insertAdjacentHTML('beforeend',
      '<a class="' + (state.page === 'scan' ? 'active' : '') + '" data-page="scan"><i>▣</i>ماسح الحضور</a>');
  }
  const roleNav = document.querySelector('.role-nav');
  if (roleNav && !roleNav.querySelector('[data-role-page="scan"]')) {
    roleNav.insertAdjacentHTML('beforeend',
      '<button class="' + (state.rolePage === 'scan' ? 'active' : '') + '" data-role-page="scan"><i>▣</i>ماسح الحضور</button>');
  }
}

/* زرّ المسح في مساحة المدرب، وفي لوحة المسير. */
function injectScanButton() {
  if (!canScan()) return;
  const host = document.querySelector('.dash-header .header-actions') || document.querySelector('.role-actions');
  if (!host || host.querySelector('[data-action="open-scan"]')) return;
  host.insertAdjacentHTML('afterbegin',
    '<button class="btn btn-outline" data-action="open-scan">▣ ماسح الحضور</button>');
}

const coreRenderScan = render;
render = function () {
  /* الصفحة تُرسم أولًا، ثم تُضاف إليها أزرارها: الطبقات الأخرى تفعل
     الشيء نفسه بـ`injectGroupsNav`، وزرٌّ يُضاف بعد الرسم لا يقفز. */
  const page = state.page;
  coreRenderScan.apply(this, arguments);
  if (state.user) { injectScanNav(); injectScanButton(); }
  /* ماسحٌ مفتوح يبقى مفتوحًا: إعادة الرسم تُفرغ `#app` فتقتل الكاميرا،
     وهذا يحدث مع كل تحديث للبيانات. */
  if (page === 'scan' && state.page === 'scan' && scanState_.running && !document.getElementById('scan-video')) {
    scanState_.running = false;
    scanState_.stream = null;
  }
};

/* ---- الأفعال ---- */

/* مساحة الدور (المدرب) تعرض الماسح كما تعرضه قائمة الإدارة.
   `roleDashboard` تبنيها من `ROLE_MENU`، ولا تعرف `scan`؛ فالنتيجة
   تُبنى أولًا ثم يُستبدل متنها بمتن الماسح حين يكون الدور دور مسح. */
const coreRoleDashboardScan = roleDashboard;
roleDashboard = function () {
  const html = coreRoleDashboardScan.apply(this, arguments);
  const access = scanAccess_();
  if (state.rolePage !== 'scan' || !access.ok) return html;
  return html.replace(/<h2 class="role-page-title">[\s\S]*?<\/h2>[\s\S]*<\/main>/,
    '<h2 class="role-page-title">ماسح الحضور</h2><main class="role-main">' + pageScan() + '</main>');
};

/* الصفحة تعرف `scan` في `dashboard()` كصفحة عادية؛ وهذا يضمن أن الشاشة
   تُبنى وتُحرس في مكان واحد. */
const corePageViewScan = pageView;
pageView = function (p) {
  if (p === 'scan') {
    const access = scanAccess_();
    if (!access.ok) {
      showToast(access.why, 'error');
      state.page = 'home';
      return corePageViewScan.call(this, 'home');
    }
    return '<div class="page-root" id="page-root">' + pageScan() + '</div>';
  }
  return corePageViewScan.apply(this, arguments);
};
const coreActionScan = action;
action = async function (a, el) {
  const dataset = (el && el.dataset) || {};

  if (a === 'open-scan') {
    const access = scanAccess_();
    if (!access.ok) {
      /* من لا يحقّ له يُردّ إلى الرئيسية، فلا تبقى صفحةٌ ممنوعة مفتوحةً
         في الرابط يعيدها التحديث. */
      showToast(access.why, 'error');
      if (state.page === 'scan') state.page = 'home';
      if (state.rolePage === 'scan') state.rolePage = 'home';
      save();
      render();
      return;
    }
    state.page = 'scan';
    state.rolePage = 'scan';
    save();
    render();
    return;
  }

  if (a === 'scan-start') { await scanStart_(); return; }
  if (a === 'scan-stop') { scanStop_(); scanNotice_('أُوقفت الكاميرا.', ''); return; }

  if (a === 'scan-typed') {
    const box = document.getElementById('scan-input');
    if (box) { box.focus(); box.select(); }
    if (!window.BarcodeDetector) {
      showToast('اكتب رقم البطاقة هنا ثم اضغط «تسجيل».', '');
    }
    return;
  }

  if (a === 'scan-submit') {
    const box = document.getElementById('scan-input');
    const value = box ? String(box.value || '').trim() : '';
    if (!value) { showToast('اكتب رقم البطاقة أولًا.', 'error'); return; }
    await scanHandle_(value);
    if (box) box.value = '';
    return;
  }

  if (a === 'scan-clear') {
    scanState_.results = [];
    scanNotice_('', '');
    renderPageOnly();
    return;
  }

  return coreActionScan.apply(this, arguments);
};

/* الإدخال اليدوي يبقى ممكنًا حين لا تقرأ الكاميرا: Enter يكتب. المستمع
   على المستند لأن اللوحة تُعاد بناؤها بعد كل قراءة. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const box = e.target;
  if (!box || box.id !== 'scan-input') return;
  e.preventDefault();
  const value = String(box.value || '').trim();
  if (!value) return;
  scanHandle_(value).then(() => { box.value = ''; });
});

/* إغلاق الكاميرا عند مغادرة الصفحة: كاميرا تعمل في الخلفية ضوء أخضر
   دائم على هاتف المدرب، وهو أوّل ما يسأل عنه. */
document.addEventListener('click', (e) => {
  const link = e.target && e.target.closest ? e.target.closest('[data-page]') : null;
  if (!link) return;
  if (link.getAttribute('data-page') !== 'scan') scanStop_();
});
