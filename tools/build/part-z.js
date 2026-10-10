/* ============================================================================
   رسوم النقل والبدلة — part-z.js

   Transport and uniform were one price each for everybody. The club asked for
   them to follow what is actually available: a pool without a changing room does
   not charge for a uniform, and a junior group is not charged the senior rate.

   So the manager sets, for each pool and each category, whether transport and
   uniform are on offer and at what price. A blank cell falls back to the single
   price that was always there, so a database nobody has touched keeps behaving
   exactly as it did.

   The subscription default sits at the top of the panel: 600, held in the
   database and changed here. The three real plans are untouched.

   The figures shown are the ones the server will charge, because they are read
   back from it after saving rather than from what was typed -- a total the club
   can see has to be the total the club will get.
   ========================================================================= */
(function () {
  'use strict';

  const CATS = [['minor', 'أصاغر'], ['adult', 'أكابر']];
  const SERVICES = [['transport', 'النقل'], ['uniform', 'البدلة الرياضية']];
  const cell = (row, cat, key) => {
    const c = row && row[cat] && row[cat][key];
    if (c && typeof c === 'object') return c;
    return null;
  };
  const number = v => (v === '' || v === undefined || v === null) ? '' : String(v);

  const panel = () => {
    const f = state.fees;
    if (!f || typeof f !== 'object') return '';
    const pools = [{ id: '*', name: 'كل المسابح (افتراضي)' }].concat(f.pools || []);
    const rows = pools.map(pool => '<tr data-pool="' + esc(pool.id) + '">'
      + '<th>' + esc(pool.name) + '</th>'
      + CATS.map(cat => SERVICES.map(key => {
        const c = cell(f.matrix && f.matrix[pool.id], cat[0], key[0]);
        const on = c ? c.available !== false : true;
        const amt = c ? c.amount : (key[0] === 'transport' ? f.transport : f.uniform);
        return '<td><label class="fee-on">'
          + '<input type="checkbox" data-fee="on" data-pool="' + esc(pool.id)
          + '" data-cat="' + cat[0] + '" data-key="' + key[0] + '"' + (on ? ' checked' : '') + '>'
          + '</label>'
          + '<input type="number" min="0" step="50" class="fee-amount" data-fee="amount" data-pool="'
          + esc(pool.id) + '" data-cat="' + cat[0] + '" data-key="' + key[0]
          + '" value="' + esc(number(amt)) + '"' + (on ? '' : ' disabled') + '>'
          + '<small>' + esc(key[1]) + '</small></td>';
      }).join('')).join('')
      + '</tr>').join('');

    return '<section class="panel settings" id="fees-panel">'
      + '<div class="panel-head"><div>'
      + '<h3>رسوم النقل والبدلة الرياضية</h3>'
      + '<p>لكل صنف ولكل مسبح. الخانة الفارغة تأخذ القيمة العامة أعلاه.</p>'
      + '</div></div>'
      + '<div class="fee-head">'
      + '<label>اشتراك النادي الافتراضي (دج)'
      + '<input type="number" min="0" step="50" id="fee-subscription" value="'
      + esc(number(f.subscription_default)) + '"></label>'
      + '<label>النقل — سعر عام (دج)'
      + '<input type="number" min="0" step="50" id="fee-transport" value="'
      + esc(number(f.transport)) + '"></label>'
      + '<label>البدلة — سعر عام (دج)'
      + '<input type="number" min="0" step="50" id="fee-uniform" value="'
      + esc(number(f.uniform)) + '"></label>'
      + '<button class="btn btn-primary" data-action="save-fees">حفظ الرسوم</button>'
      + '</div>'
      + '<div class="fee-scroll"><table class="fee-table">'
      + '<thead><tr><th>المسبح</th>'
      + CATS.map(c => '<th colspan="2">' + esc(c[1]) + '</th>').join('')
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</section>';
  };

  const coreSettingsFees = pageSettings;
  pageSettings = function () {
    return coreSettingsFees() + panel();
  };

  async function loadFees() {
    try {
      const res = await fetch('/api/fees', { credentials: 'same-origin' });
      state.fees = await res.json().catch(() => null);
      await refreshOffered();
    } catch (_) { state.fees = null; }
  }

  /* What the club offers at this pool for this category, so the registration
     form hides a checkbox rather than charging for a service that is not there. */
  async function refreshOffered() {
    try {
      const q = 'category=' + encodeURIComponent(val('#reg-category') || 'adult')
        + '&facility=' + encodeURIComponent(val('#reg-facility') || '');
      const res = await fetch('/api/subscription-plans?' + q);
      const data = await res.json().catch(() => null);
      if (!data) return;
      if (data.extras) state.extras = Object.assign({}, state.extras, data.extras);
      const on = data.offered || { transport: true, uniform: true };
      [['#reg-transport', on.transport], ['#reg-uniform', on.uniform]].forEach(pair => {
        const box = $(pair[0]);
        if (!box) return;
        const line = box.closest('.check-line') || box.parentNode;
        if (line) line.hidden = !pair[1];
        if (!pair[1]) box.checked = false;
      });
    } catch (_) { /* the built-in list stands */ }
  }

  const coreSyncFees = syncApi;
  syncApi = async function () {
    await coreSyncFees();
    if (state.user && ['admin', 'president'].indexOf(state.user.role) !== -1) await loadFees();
  };

  const coreActionFees = action;
  action = async function (a, el) {
    if(a!=='save-fees'){return coreActionFees(a, el);}

    const matrix = {};
    document.querySelectorAll('#fees-panel [data-fee="amount"]').forEach(box => {
      const pool = box.dataset.pool, cat = box.dataset.cat, key = box.dataset.key;
      const on = document.querySelector('[data-fee="on"][data-pool="' + pool
        + '"][data-cat="' + cat + '"][data-key="' + key + '"]');
      if (!matrix[pool]) matrix[pool] = {};
      if (!matrix[pool][cat]) matrix[pool][cat] = {};
      matrix[pool][cat][key] = {
        available: !!(on && on.checked),
        amount: Number(box.value) || 0
      };
    });
    const body = {
      transport: Number(($('#fee-transport') || {}).value) || 0,
      uniform: Number(($('#fee-uniform') || {}).value) || 0,
      subscription_default: Number(($('#fee-subscription') || {}).value) || 0,
      matrix: matrix
    };
    const res = await api('/api/fees', 'PUT', body);
    if (!res || res.error) { showToast((res && res.error) || 'تعذّر حفظ الرسوم.', 'error'); return; }
    /* Read back what the server now holds, not what was typed. The club has to
       see the figures that will actually be charged. */
    await loadFees();
    save();
    render();
    showToast('حُفظت الرسوم. صارت تسري على كل استمارة جديدة.');
  };

  const coreBootFees = boot;
  boot = async function () {
    await coreBootFees();
    if (state.user && ['admin', 'president'].indexOf(state.user.role) !== -1) await loadFees();
  };
})();