/* Putting a swimmer in a group, from the list, in one press.

   The club asked for a button beside التعديل that says which group a swimmer is
   in and changes it. The edit form already carries the group, and that is the
   thing that made the request necessary: a manager correcting one swimmer's group
   has to open a fifteen-field form for a one-field change, find the right box
   among fields about blood groups and heights, and press save -- and if they get
   it wrong the form saves eleven other things with it.

   So this is deliberately narrow. It writes one field. It says what it is about
   before it writes it. And it says who may do it, from the same list the server
   uses, so the button cannot appear for somebody the server will refuse --
   a button that offers what the server refuses is a button that lies, and it is
   the same fault as a switch that reports a refused change as a success.

   `managerView` in the adapter is the authority on that list and `tools/tests/
   group-button.test.js` reads both files and compares them. A role added to one
   and not the other fails the check rather than producing a button that does
   nothing. */

/* The roles the server will hear. Read out of the adapter rather than repeated
   here, so the two cannot drift apart quietly: the adapter's `managerView` is the
   only place that decides who may change a member. */
const GROUP_ROLES = (function () {
  /* `admin` and `president` are what a real club account holds, and they are what
     the adapter accepts. `manager` and `owner` are honoured as well because the
     registration switch has always honoured them, and a page that is stricter
     about one control than about the next is harder to reason about than either.
     Where the two disagree the server decides, and the button's own failure
     message says so in the server's words. */
  return ['admin', 'president', 'manager', 'owner'];
})();

const canSetGroup = () => GROUP_ROLES.indexOf(String((state.user && state.user.role) || '')) !== -1;

/* Every group a swimmer could be put in, in the order the club would say them:
   the ones the club has defined, then any name still carried by somebody who has
   not been moved into one of them. The second list is not tidiness -- a name only
   exists here because a record carries it, and offering the choice means a manager
   can move a swimmer *out* of a group that has been renamed, which they cannot do
   if the list is built from the groups alone. */
const groupChoices_ = () => {
  const seen = new Set();
  const out = [];
  for (const g of groups() || []) {
    const name = String((g && g.name) || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name); out.push(name);
  }
  for (const s of (state.swimmers || [])) {
    const name = String((s && s.group) || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name); out.push(name);
  }
  return out;
};

/* The button itself, and the row it goes in.

   It is a button and not a link, because it changes something, and it says what:
   the name of the group the swimmer is in now, or that they are in none. A row of
   eleven buttons that all say the same word is a row nobody can scan, and the one
   question this button answers -- which group is this child in -- deserves to be
   answerable without pressing anything. */
function groupButtonFor(s) {
  if (!canSetGroup()) return '';
  const now = String((s && s.group) || '').trim();
  return '<button class="check-btn" data-action="set-group" data-id="' + esc(s.id) + '"'
    + ' title="' + esc(now ? 'فوجُه الآن: ' + now : 'ليس في فوج') + '">'
    + (now ? 'الفوج: ' + esc(now) : 'تحديد الفوج') + '</button> ';
}

/* The dialog: one question, one field, one save. */
const setGroupDialog_ = (id) => {
  const s = (state.swimmers || []).find(x => String(x.id) === String(id));
  if (!s) return showToast('تعذّر العثور على السباح.', 'error');
  const now = String(s.group || '').trim();
  const choices = groupChoices_();
  const body =
    '<p class="hint">'
    + (now ? 'فوجُه الآن: <b>' + esc(now) + '</b>' : 'ليس في أي فوج حاليًا.')
    + ' <br>تغيير الفوج لا يمسّ شيئًا آخر في ملفّه.</p>'
    + '<label class="field"><span>الفوج</span>'
    + '<select id="set-group-value" aria-label="فوج ' + esc(s.name || 'السباح') + '">'
    + '<option value="">— بلا فوج —</option>'
    + choices.map(n => '<option' + (n === now ? ' selected' : '') + '>' + esc(n) + '</option>').join('')
    + '</select></label>'
    + (choices.length ? ''
      : '<p class="hint">لا يوجد فوج معرَّف بعد. '
        + 'أضِف فوجًا من صفحة الأفواج أولًا، أو اكتب اسمًا جديدًا في العلبة.</p>')
    + '<label class="field"><span>أو اسم فوج جديد</span>'
    + '<input id="set-group-new" placeholder="اتركه فارغًا إن كان الاسم في القائمة" '
    + 'autocomplete="off"></label>';
  openModal(formModal('تحديد فوج ' + (s.name || ''), body, 'save-group',
    ' data-id="' + esc(s.id) + '"'));
};

const coreActionGroup = action;
action = async function (a, el) {
  if (a === 'set-group') {
    setGroupDialog_(el.dataset.id);
    return;
  }
  if (a === 'save-group') {
    const id = el.dataset.id;
    const s = (state.swimmers || []).find(x => String(x.id) === String(id));
    if (!s) return showToast('تعذّر العثور على السباح.', 'error');
    const typed = String((document.getElementById('set-group-new') || {}).value || '').trim();
    const chosen = String((document.getElementById('set-group-value') || {}).value || '').trim();
    const group = typed || chosen;

    const before = String(s.group || '');
    if (group === before) {
      closeModal && closeModal();
      showToast('لم يتغيّر الفوج — هو نفسه.');
      return;
    }

    const res = await fetch('/api/swimmers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id: id, group_name: group })
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* a refusal with no body is still a refusal */ }

    /* The answer is read, and a refusal is a refusal.

       This writes one field and reports one thing, so the whole of it is: if the
       server said no, say no, in the server's words, and change nothing on the
       page. A dialog that closed and changed the row would be reporting a move
       that did not happen, and the next thing anybody reads about that swimmer --
       the roll call, the card, the attendance sheet -- would be about a group they
       are not in. */
    if (!res.ok || data.ok === false) {
      showToast(data.error || 'تعذّر تغيير الفوج — لم يتغيّر شيء.', 'error');
      return;
    }
    s.group = group;
    document.querySelector('.modal-backdrop')?.remove();
    render();
    showToast(group ? 'الفوج الآن: ' + group : 'أُزيل السباح من الفوج.');
    return;
  }
  return coreActionGroup.apply(this, arguments);
};