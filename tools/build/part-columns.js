/* ==========================================================
   الطبقة: تخصيص الأعمدة
   ==========================================================

   A manager reads three things from the swimmers list: the name, the group and
   whether today's subscription is settled. The list carries six columns and a
   column of buttons, and the columns that do not matter sit between the ones
   that do, so the eye crosses a phone number to reach a group and an attendance
   to reach anything at all.

   The ask is small and it is right: let the manager tick the columns they want,
   untick the rest, keep the choice for next time, and never let them hide the
   two things a row is useless without -- who the child is and which group they
   are in.

   Two rules shape the build.

   The first is that a hidden column must vanish from the desktop table AND from
   the phone card. The phone card is built from the same cells -- every cell is a
   block, named by the `data-label` stamped on it -- so hiding a cell hides its
   block, and the two views can never disagree about which columns are shown.

   The second is that a preference belongs to a person, not to a tablet. A coach
   and a manager share the office machine. If the choice is kept per browser, the
   manager's six-column list becomes the coach's list on the next login, and
   neither of them asked for it. So it is kept per account, per table.
*/

/* The roles the server will hear for a preference that changes nothing but this
   browser -- read the same way the group button reads its own. */
const COLUMN_ROLES = (function () {
  return ['admin', 'president', 'manager', 'owner'];
})();

const canChooseColumns = () => COLUMN_ROLES.indexOf(String((state.user && state.user.role) || '')) !== -1;

/* The columns a table will not let go of.

   Two, and they are the two a row without them is unreadable: the child's name
   and the group they swim in. The decision column carries no header, so it can
   never be hidden -- there is nothing to name it and nothing to tick -- which is
   the sticky action column the club asked to keep always in reach. */
const LOCKED_COLUMNS = ['السباح', 'الفوج'];

/* ---- the key a preference is kept under ----

   `state.page` names the page; the table's position on the page separates the
   swimmers list from the print-only sheet that shares the page with it. The
   account is the third part, so a screen shared by two people keeps two lists.

   When there is nobody signed in the key carries `guest` -- a preference stored
   before anyone signed in belongs to nobody, and must not be handed to the next
   person who does. */
function columnsAccountKey() {
  const u = state.user || {};
  const who = String(u.email || u.id || u.name || '').trim();
  return who ? who.toLowerCase() : 'guest';
}
function columnsStorageKey(page, index) {
  return 'sadara-cols:' + columnsAccountKey() + ':' + String(page || '') + ':' + String(index);
}

/* ---- reading and writing the choice ----

   A read that fails is not an empty choice: an empty object means "show
   everything", which is the safe direction -- a column nobody can see is worse
   than one they did not ask for -- so every failure falls back to it, loudly in
   the console and silently on the screen. */
function readColumnChoice(page, index) {
  try {
    const raw = localStorage.getItem(columnsStorageKey(page, index));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    console.warn('Sadara: the column choice could not be read; showing every column.', e);
    return {};
  }
}
function writeColumnChoice(page, index, choice) {
  try {
    localStorage.setItem(columnsStorageKey(page, index), JSON.stringify(choice));
    return true;
  } catch (e) {
    /* The choice is a preference, not a record. Losing it costs a tick; failing
       the save would cost the manager their list, which is worse. */
    console.warn('Sadara: the column choice could not be saved.', e);
    return false;
  }
}

/* ---- naming the tables ----

   A table is found, not declared. `stampTableLabels` already gave every cell the
   header it sits under, so a table's columns are the headers of the last header
   row, and the ones that carry a name are the ones that can be ticked. */
function tableColumnsOf(table) {
  const head = table.tHead || table.querySelector('thead');
  if (!head || !head.rows.length) return null;
  const heads = head.rows[head.rows.length - 1].cells;
  const out = [];
  for (let i = 0; i < heads.length; i++) {
    const label = (heads[i].textContent || '').replace(/\s+/g, ' ').trim();
    out.push({ index: i, label: label });
  }
  return out;
}

/* Every table on the page, in the order it is drawn, each with the key it is
   remembered under. A table with no named columns is not offered, because there
   is nothing to tick and a menu that opens onto nothing is worse than no menu. */
function pageTables_() {
  const tables = document.querySelectorAll('#app table');
  const found = [];
  for (let t = 0; t < tables.length; t++) {
    const cols = tableColumnsOf(tables[t]);
    if (!cols) continue;
    const named = cols.filter(c => c.label);
    if (!named.length) continue;
    found.push({ table: tables[t], cols: cols, named: named, key: t });
  }
  return found;
}

/* ---- applying the choice ----

   A hidden column is marked on its header and on every cell beneath it, as
   `data-col-hidden`. The stylesheet does the hiding, which is what makes the
   desktop table and the phone card agree: both read the same marks.

   A locked column is never hidden, whatever is stored. A choice written before a
   column was locked -- or edited by hand -- cannot take the name away. */
function applyColumnChoice(table, cols, choice) {
  const body = table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
  const head = table.tHead || table.querySelector('thead');
  const headRow = head && head.rows.length ? head.rows[head.rows.length - 1] : null;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const hidden = !!col.label
      && LOCKED_COLUMNS.indexOf(col.label) === -1
      && choice[col.label] === false;
    const mark = (cell) => {
      if (!cell) return;
      if (hidden) cell.setAttribute('data-col-hidden', '1');
      else cell.removeAttribute('data-col-hidden');
    };
    mark(headRow && headRow.cells[col.index]);
    if (body) {
      for (let r = 0; r < body.rows.length; r++) mark(body.rows[r].cells[col.index]);
    }
  }
}

/* ---- the menu ----

   The button sits on the table's own panel head, beside the title, so the
   question "which columns?" is asked where the columns are. A locked column is
   ticked, greyed and says why, which is more honest than a tick that silently
   refuses to move. */
function columnMenuHtml(page, index, cols, choice) {
  const items = cols.filter(c => c.label).map(c => {
    const locked = LOCKED_COLUMNS.indexOf(c.label) !== -1;
    const shown = locked ? true : choice[c.label] !== false;
    return '<label class="col-choice' + (locked ? ' is-locked' : '') + '">'
      + '<input type="checkbox"' + (shown ? ' checked' : '')
      + (locked ? ' disabled' : '')
      + ' data-col-toggle="' + esc(c.label) + '"'
      + ' data-col-page="' + esc(page) + '" data-col-table="' + String(index) + '">'
      + '<span>' + esc(c.label) + (locked ? ' <small>(ثابت)</small>' : '') + '</span></label>';
  }).join('');
  return '<div class="col-menu" data-col-menu="' + String(index) + '" hidden>'
    + '<p class="col-menu-title">اختر الحقول الظاهرة:</p>' + items + '</div>';
}

function columnToggleButton(page, index) {
  if (!canChooseColumns()) return '';
  return '<div class="col-toggle-wrap">'
    + '<button class="btn btn-outline col-toggle" data-action="toggle-columns"'
    + ' data-col-page="' + esc(page) + '" data-col-table="' + String(index) + '"'
    + ' aria-haspopup="true" aria-expanded="false" title="إظهار وإخفاء أعمدة الجدول">'
    + '⚙️ تخصيص الأعمدة</button>'
    + columnMenuHtml(page, index, tableColumnsOf(document.querySelector('#app table')) || [], {})
    + '</div>';
}

/* ---- putting it on the page, after every render ----

   The button is placed once per table, into the panel head that holds it. A
   table without a panel head -- the print sheet -- gets nothing, which is
   correct: a preference about what is printed is not a preference about what is
   shown, and the club asked for the screen. */
function installColumnToggles() {
  const page = String(state.page || '');
  const found = pageTables_();
  document.querySelectorAll('#app [data-col-menu]').forEach(m => m.remove());
  for (let i = 0; i < found.length; i++) {
    const entry = found[i];
    const choice = readColumnChoice(page, entry.key);
    applyColumnChoice(entry.table, entry.cols, choice);

    if (!canChooseColumns()) continue;
    const panel = entry.table.closest('.panel') || entry.table.closest('section');
    const head = panel && panel.querySelector('.panel-head');
    if (!head || head.querySelector('[data-action="toggle-columns"]')) continue;
    head.insertAdjacentHTML('beforeend', columnToggleButton(page, entry.key));
    /* the menu is built with its own columns, not the first table's */
    const wrap = head.lastElementChild;
    const menu = wrap && wrap.querySelector('[data-col-menu]');
    if (menu) {
      menu.innerHTML = columnMenuHtml(page, entry.key, entry.cols, choice)
        .replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
    }
  }
}

/* ---- the action router ----

   Opening and closing the menu, and each tick. Every name is prefixed with what
   it acts on, so no other layer can be answering it first.

   The wrapper is not `async`, on purpose. Every other layer in this platform
   wraps `action` as an async function and awaits the chain below it; a wrapper
   that returns a bare promise where a caller expected the chain's own value is
   how a stage that drives the page -- and reads state right after the call --
   silently reads it too early. This layer changes nothing about what the chain
   returns, so it hands the chain's value straight back. */
const coreActionColumns = action;
action = function (a, el) {
  const dataset = (el && el.dataset) || {};

  if (a === 'toggle-columns') {
    const menu = document.querySelector('#app [data-col-menu="' + dataset.colTable + '"]');
    if (!menu) return;
    const open = menu.hidden;
    document.querySelectorAll('#app [data-col-menu]').forEach(m => { m.hidden = true; });
    menu.hidden = !open;
    if (el.setAttribute) {
      el.setAttribute('aria-expanded', open ? 'true' : 'false');
      el.classList.toggle('is-open', open);
    }
    return;
  }

  if (a === 'set-column') {
    const label = dataset.colToggle;
    if (!label) return;
    if (LOCKED_COLUMNS.indexOf(label) !== -1) {
      showToast('لا يمكن إخفاء هذا الحقل: الصفّ لا يُقرأ بدونه.', 'error');
      return;
    }
    const page = dataset.colPage || String(state.page || '');
    const choice = readColumnChoice(page, dataset.colTable);
    choice[label] = !!el.checked;
    writeColumnChoice(page, dataset.colTable, choice);
    installColumnToggles();
    return;
  }

  return coreActionColumns(a, el);
};

/* ---- wired after every render, beside the label stamp ---- */

const coreRenderColumns = render;
render = function () {
  coreRenderColumns();
  try { installColumnToggles(); } catch (_) { /* a table showing every column is the safe direction */ }
};

if (typeof renderPageOnly === 'function') {
  const coreRenderPageOnlyColumns = renderPageOnly;
  renderPageOnly = function () {
    coreRenderPageOnlyColumns();
    try { installColumnToggles(); } catch (_) { /* see above */ }
  };
}

/* ---- how the controls are reached ----

   The button and its menu are added *after* `render` returns, so `bind` has
   already run and the new button carries no handler. Calling `bind` again would
   re-run every handler on the page, which is a lot of firing to open a menu.

   So the two controls are reached with one listener on the document, checking
   what was pressed. It survives every redraw, because the listener is on the
   document and the button is never re-created without it. */
document.addEventListener('click', function (e) {
  const el = e.target && e.target.closest ? e.target.closest('[data-action="toggle-columns"]') : null;
  if (!el) return;
  e.preventDefault();
  action('toggle-columns', el);
});
document.addEventListener('change', function (e) {
  const box = e.target;
  if (!box || !box.dataset || box.dataset.colToggle === undefined) return;
  action('set-column', box);
});
