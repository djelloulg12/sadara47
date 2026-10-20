/* ==========================================================
   الطبقة: جدول يُقرأ على الهاتف
   ==========================================================

   On a phone the stylesheet turns every table row into a stack of blocks, and
   each block is supposed to name itself with the header it came from:

       .table-scroll td::before{content:attr(data-label)}

   That rule has been in the stylesheet all along, and it has never once been
   seen, because not a single cell in the whole platform carries `data-label`.
   The pseudo-element is empty on every row of every table, so a parent on a
   phone is shown a column of bare values -- «المتوسطون», «06610000», «O+» --
   with nothing to say which is the group, which is the phone and which is the
   blood type. The card layout is there and it is unreadable.

   Writing `data-label` into a hundred cells, by hand, in twenty-two tables, is
   how this stays broken: the next table added is the next table blank on a
   phone, and nobody notices, because a desk shows the table correctly.

   So the label is not written into the cells. It is stamped onto them, after
   every render, from the header directly above -- one pass, every table that
   exists now and every one added later. The header is already there; the cell
   is already there; the only thing missing was for the two to be told about
   each other.
*/

function stampTableLabels(root) {
  const tables = root.querySelectorAll('table');
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    const head = table.tHead || table.querySelector('thead');
    if (!head || !head.rows.length) continue;
    /* The last header row is the one that names the columns.
       A table with two header rows states a group over its columns: «المعلومات
       الشخصية» spans four, and the four are named one row down. Reading the top
       row would label the whole block with the group's name. */
    const heads = head.rows[head.rows.length - 1].cells;
    const labels = [];
    for (let h = 0; h < heads.length; h++) {
      labels.push((heads[h].textContent || '').replace(/\s+/g, ' ').trim());
    }
    const body = table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
    if (!body) continue;
    for (let r = 0; r < body.rows.length; r++) {
      const cells = body.rows[r].cells;
      for (let c = 0; c < cells.length; c++) {
        /* A cell that already names itself keeps its name: a page may know
           something about its own column that the header does not say, and a
           stamp must not overwrite what a person wrote deliberately. */
        if (cells[c].hasAttribute('data-label')) continue;
        const label = labels[c] || '';
        /* An empty header (a button column, a spacer) is left alone: labelling
           a decision cell with nothing prints an empty line above the buttons. */
        if (!label) continue;
        cells[c].setAttribute('data-label', label);
      }
    }
  }
}

/* Stamped after every render, because every render rebuilds the tables from
   strings and the stamps do not survive innerHTML.

   The last layer reassigns `bind`, and the layer that runs this file is added
   before it, so the call is put beside the render it follows rather than in a
   `bind` that a later file replaces. */
const coreRenderTables = render;
render = function () {
  coreRenderTables();
  try { stampTableLabels(document); } catch (_) { /* a table without labels still shows */ }
};

/* The two pages whose tables are redrawn on their own -- typing in the search
   box, changing a filter -- call renderPageOnly instead of render, and a label
   stamped only on a full render would vanish the moment a manager typed. */
if (typeof renderPageOnly === 'function') {
  const coreRenderPageOnlyTables = renderPageOnly;
  renderPageOnly = function () {
    coreRenderPageOnlyTables();
    try { stampTableLabels(document); } catch (_) { /* see above */ }
  };
}
