/* ==========================================================
   الطبقة: الصمود
   ==========================================================

   Three faults a club meets on a Tuesday afternoon, and none of them is a
   mistake in the data:

   - a field is missing on one swimmer -- a group that was deleted, a name that
     was never filled in -- and `render` throws while drawing the list. What the
     manager sees is a white screen. The other hundred and fourteen swimmers are
     still in the database; they are just not on the screen, and there is no way
     to tell from the screen whether the club's data is gone or the page is.

   - the network drops, or the server is slow. The list is drawn from whatever
     was last fetched, and nothing says it may be out of date.

   - the first load has nothing yet. The page is drawn empty for a moment and
     then fills in, which on a slow connection looks like a club with no members.

   So this layer does three things: it makes `render` unable to white-screen the
   application (an error is caught and shown, with a way back); it says when what
   is on the screen may be out of date; and it shows a skeleton where the list
   will be, so an empty box means "loading" rather than "empty".

   It does not swallow errors. A caught error is logged in full and named on the
   screen -- a boundary that hides the error hides the fault with it, and the
   next thing the club reports is that the platform is quiet about something.
*/

/* ---- the error boundary around render ----

   `render` draws the whole application into one box. Every layer wraps it, and
   none of them catches: the baseline's `render` sets `#app.innerHTML` and if any
   page builder throws while building its string, the box is left half-written or
   untouched and nothing else runs.

   This wrapper is outermost -- it is added last, before the layer that boots --
   so it sees the throw from whichever layer produced it, however deep. */
function renderBoundaryMessage(err) {
  const detail = err && err.message ? String(err.message) : String(err || 'خطأ غير معروف');
  return '<div class="page-root" id="page-root"><section class="panel boundary-panel">'
    + '<div class="boundary-icon">⚠️</div>'
    + '<h3>تعذّر عرض هذه الصفحة</h3>'
    + '<p>حدث خطأ أثناء رسم الصفحة، فلم يظهر محتواها. بياناتك لم تُمسّ: '
    + 'هذا خطأ في العرض فقط.</p>'
    + '<p class="boundary-detail" dir="ltr">' + esc(detail) + '</p>'
    + '<div class="boundary-actions">'
    + '<button class="btn btn-primary" data-action="recover-render">↻ إعادة المحاولة</button>'
    + '<button class="btn btn-outline" data-action="recover-render-home">الصفحة الرئيسية</button>'
    + '</div></section></div>';
}

const coreRenderResilient = render;
render = function () {
  try {
    coreRenderResilient();
  } catch (err) {
    /* The whole error, where a person debugging can find it, and a sentence on
       the screen, where the manager is. Neither replaces the other. */
    console.error('Sadara: the page could not be drawn.', err);
    const mount = document.getElementById('app');
    if (mount) mount.innerHTML = renderBoundaryMessage(err);
    /* The boundary's own buttons carry `data-action`, and whichever layer last
       wrapped `bind` is the one that wires them -- so they are wired here, where
       the buttons were made, and never depend on a layer above. */
    wireBoundaryButtons_();
    if (typeof showToast === 'function') showToast('تعذّر عرض الصفحة، وحُفظت البيانات.', 'error');
  }
};

function wireBoundaryButtons_() {
  document.querySelectorAll('[data-action="recover-render"], [data-action="recover-render-home"]')
    .forEach(b => {
      b.onclick = () => action(b.dataset.action, b);
    });
}

/* The two ways back. A retry re-draws the same page; the home button moves to a
   page that is much harder to break, so a manager is never stuck on a page that
   cannot draw. */
const coreActionResilient = action;
action = function (a, el) {
  if (a === 'recover-render') {
    render();
    return;
  }
  if (a === 'recover-render-home') {
    state.page = 'home';
    try { save(); } catch (_) {}
    render();
    return;
  }
  return coreActionResilient(a, el);
};

/* ---- the connection, said out loud ----

   What is on the screen is whatever was last fetched. When the network is gone
   that is still the right thing to show -- a club does not stop working because
   the wifi did -- but it must not pretend to be current. */
const syncState_ = { at: null, failed: false, running: 0 };

function offlineBannerHtml() {
  const offline = (typeof navigator !== 'undefined') && navigator.onLine === false;
  const stale = syncState_.failed;
  if (!offline && !stale) return '';
  const when = syncState_.at ? new Date(syncState_.at).toLocaleTimeString('ar-DZ') : '';
  const text = offline
    ? 'لا يوجد اتصال بالإنترنت — ما يظهر هو آخر نسخة محفوظة.'
    : 'تعذّر تحديث البيانات — ما يظهر قد يكون قديمًا.';
  return '<div class="offline-banner" role="status">'
    + '<span class="offline-dot"></span>'
    + '<span>' + esc(text) + (when ? ' (آخر تحديث: ' + esc(when) + ')' : '') + '</span>'
    + '<button class="btn btn-outline" data-action="refresh-data">↻ حاول الآن</button>'
    + '</div>';
}

/* The banner is drawn into the top of the page area after every render, so it
   appears on whichever page the manager is looking at, not only on the one that
   happened to be open when the connection dropped. */
const coreRenderOffline = render;
render = function () {
  coreRenderOffline();
  try {
    const host = document.querySelector('.main-content') || document.getElementById('app');
    if (!host) return;
    const existing = document.getElementById('offline-banner-host');
    if (existing) existing.remove();
    const html = offlineBannerHtml();
    if (!html) return;
    const box = document.createElement('div');
    box.id = 'offline-banner-host';
    box.innerHTML = html;
    host.insertBefore(box, host.firstChild);
    box.querySelectorAll('[data-action]').forEach(b => {
      b.onclick = () => action(b.dataset.action, b);
    });
  } catch (_) { /* a banner that fails to draw must not take the page with it */ }
};

/* ---- the skeleton, where the list will be ----

   A list that has not been fetched yet draws its empty state, which says "لا
   يوجد سباحون". On a slow line that sentence is a lie told for two seconds. A
   skeleton in the same place says "loading" in the only way a page can say it
   without words. */
function skeletonRowsHtml(cols, rows) {
  const cells = [];
  for (let c = 0; c < (cols || 4); c++) cells.push('<td><span class="skeleton-bar"></span></td>');
  const one = '<tr class="skeleton-row">' + cells.join('') + '</tr>';
  return new Array(rows || 5).fill(one).join('');
}

/* Any table that is drawn while a fetch is in flight, and has no rows yet, gets
   a skeleton instead of its empty message. It is stamped after the render, the
   same way the column labels are, so it works on every table without each page
   builder knowing about it. */
function stampSkeletons() {
  if (!syncState_.running) return;
  document.querySelectorAll('#app .table-scroll table').forEach(table => {
    const body = table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
    if (!body) return;
    const only = body.querySelector('.empty-cell');
    if (!only) return; /* the table has rows, or a skeleton, already */
    const cols = (table.tHead || table.querySelector('thead'))
      ? (table.tHead || table.querySelector('thead')).rows[0].cells.length : 4;
    body.innerHTML = skeletonRowsHtml(cols, 5);
    table.classList.add('is-loading');
  });
}

const coreRenderSkeleton = render;
render = function () {
  coreRenderSkeleton();
  try { stampSkeletons(); } catch (_) { /* an empty list is still a list */ }
};

/* ---- counting the fetch in flight ----

   The count, not a flag: two syncs can overlap -- the page syncs on load and the
   manager presses «تحديث» -- and a flag cleared by whichever finishes first
   would say the page is ready while the other is still waiting. */
const coreSyncResilient = syncApi;
syncApi = async function () {
  syncState_.running++;
  syncState_.failed = false;
  syncState_.sawFailure = false;
  render();
  try {
    await coreSyncResilient.apply(this, arguments);
    syncState_.at = Date.now();
    /* The chain below catches its own failures and reports them to the console
       only -- so `await` returning is not the same as the fetch having worked.
       What actually happened is watched at the one place every request passes
       through, and this layer reads that instead of guessing from the return. */
    if (syncState_.sawFailure) syncState_.failed = true;
  } catch (e) {
    syncState_.failed = true;
    throw e;
  } finally {
    syncState_.running = Math.max(0, syncState_.running - 1);
    render();
  }
};

/* The observer. It does nothing but look: a response that is not ok, or a
   request that never arrives, is one thing -- the page may be out of date -- and
   it says so once per sync, not once per request. The wrapper is marked so a
   second copy of this layer cannot wrap it twice.

   It is a named function because the check that drives this page replaces
   `fetch` with a stub to make a sync fail, and a stub installed after the
   observer would put the observer underneath it, where it sees nothing. The
   check calls this again so the observer is outermost, which is where it is in
   the real application. */
function watchRequests_() {
  if (typeof window === 'undefined' || !window.fetch || window.fetch.__sadaraWatched) return;
  const inner = window.fetch;
  const watched = function () {
    const out = inner.apply(this, arguments);
    if (syncState_.running) {
      try {
        out.then(
          (res) => { if (res && res.ok === false) syncState_.sawFailure = true; },
          () => { if (syncState_.running) syncState_.sawFailure = true; }
        );
      } catch (_) {}
    }
    return out;
  };
  watched.__sadaraWatched = true;
  window.fetch = watched;
}
watchRequests_();

/* ---- the connection coming back ----

   Pressing «حاول الآن» after the wifi returned is a thing a person should not
   have to know to do. */
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => {
    try { syncApi().then(() => render(), () => render()); } catch (_) { render(); }
  });
  window.addEventListener('offline', () => { try { render(); } catch (_) {} });
}
