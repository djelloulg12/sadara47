/* ============================================================================
   شريط الميدان — part-mobile.js

   On a phone the sidebar folds to a column of icons at the edge of the screen,
   and the three things a coach actually does at the pool -- scan a card, open
   the attendance sheet, change a password -- are a thumb's width away from each
   other and one mis-tap apart. And the sidebar scrolls away with the page.

   So on a narrow screen the three are lifted out into a bar fixed to the bottom
   of the viewport, where a thumb already is, each one at least 48 pixels tall.
   It is drawn only for the accounts that may press them, and only on a phone:
   on a desk the sidebar is already there and a second copy would be noise.

   The bar lives outside the rendered page, so a redraw does not take it away
   and does not stack a second one on top of the first.
   ========================================================================= */
(function () {
  'use strict';

  const STAFF = ['owner', 'admin', 'president', 'manager', 'coach'];

  function mayMount() {
    if (!state.user) return false;
    const role = state.user.owner === true ? 'owner' : String(state.user.role || '');
    return STAFF.indexOf(role) !== -1;
  }

  function mount() {
    const existing = document.getElementById('field-bar');
    if (!mayMount()) { if (existing) existing.remove(); return; }

    const page = String(state.page || '');
    const link = (key, icon, text) =>
      '<a data-page="' + key + '"' + (page === key ? ' class="active"' : '') + '>'
      + '<i>' + icon + '</i>' + text + '</a>';

    const html = '<nav class="field-bar" id="field-bar" aria-label="إجراءات سريعة">'
      + link('scan', '▣', 'المسح')
      + link('attendance', '✓', 'الحضور')
      + link('profile', '🔑', 'كلمة المرور')
      + '</nav>';

    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    /* bind() reaches the rendered page; the bar is outside it, so it carries its
       own two lines rather than being wired from a distance. */
    const bar = document.getElementById('field-bar');
    if (bar) {
      bar.querySelectorAll('[data-page]').forEach(a => {
        a.onclick = () => { state.page = a.dataset.page; save(); render(); };
      });
    }
  }

  const coreRenderMobile = render;
  render = function () {
    const out = coreRenderMobile.apply(this, arguments);
    try { mount(); } catch (_) { /* a bar is not worth a broken page */ }
    return out;
  };

  /* أول رسم بعد الدخول يمرّ بـ render، وهذا يغطّي إعادة التحميل أيضًا. */
  if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    try { mount(); } catch (_) {}
  }
})();
