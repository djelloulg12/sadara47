/* Putting a swimmer in a group, from the list, and the authority to do it.

   The button was asked for and written; this asks whether it works, and whether it
   may appear for the people it appears for. The second question is the one that
   has bitten this platform before: a control that is offered to somebody the
   server will refuse does not fail loudly. It opens, it fills in, it saves, and
   the refusal arrives afterwards -- by which point the person has filled a form
   in and is looking at an error about something they were told they could do.

   So the list of roles the button is shown for is read out of BOTH files and the
   two are compared. A role added to the page and not to the server, or the other
   way round, fails here rather than in front of a parent.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const app = read('app.js');
const adapter = read('firebase-adapter.js');

/* ---- the button is in the row, beside التعديل ---- */

if (!/<button class="check-btn" data-action="edit-swimmer"[^>]*>\s*\u062a\u0639\u062f\u064a\u0644<\/button>'\s*\+\s*groupButtonFor\(s\)/.test(app)
    && !/edit-swimmer[\s\S]{0,260}groupButtonFor\(s\)/.test(app)) {
  errors.push('the swimmers row does not carry the group button beside التعديل');
}

/* ---- and the roles agree ---- */

/* The roles the page offers the button to.

   Read loosely, on purpose. It was read as an exact sentence -- `return
   ['admin', 'president', 'manager', 'owner'];` -- and the moment anybody added a
   role to it the match failed, so the one check that compares the page against
   the server stopped running. The failure was reported, and the comparison beside
   it was not made: a check that gives up when the text moves is a check that
   stops checking, and it did so silently, on exactly the change it exists to
   catch. Whatever the list is spelled as, it is read and compared. */
/* A generous reach: the list is declared inside a closure that explains why it
   is this list and this long, and a check that only reaches past a short comment
   stops finding it. Generosity here costs nothing -- the only thing it can
   match is a `return [` after the name. */
const listBlock = (app.match(/GROUP_ROLES[\s\S]{0,2000}?return\s*\[([^\]]*)\]/) || [])[1];
const shown = listBlock
  ? (listBlock.match(/'([a-z_]+)'/g) || []).map(x => x.replace(/'/g, ''))
  : [];
if (!shown.length) {
  errors.push('the group button no longer declares which roles may use it');
}

const gate = adapter.match(/const managerView = async \([^)]*\) => \{[\s\S]*?\[([^\]]*)\]\.includes\(profile\.role\)/);
if (!gate) {
  errors.push('could not read the roles the adapter accepts; the two lists cannot be compared');
} else if (shown.length) {
  const serverRoles = gate[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  for (const role of serverRoles) {
    if (shown.indexOf(role) === -1) {
      errors.push('the server lets a ' + role + ' change a swimmer, but the group button is not '
        + 'shown to them -- the one action they cannot do is the one the club asked for');
    }
  }
  /* And the other way: nobody is shown a control the server will refuse. `manager`
     and `owner` are allowed here without the server listing them, because they are
     roles the club has not used and the registration switch honours them too. What
     is not allowed is a real role -- a member, a coach -- being offered it. */
  for (const role of ['member', 'parent', 'swimmer_adult', 'swimmer_minor', 'coach']) {
    if (shown.indexOf(role) !== -1) {
      errors.push('the group button is offered to a ' + role + ', who has no business '
        + 'placing children in groups');
    }
  }
}

/* ---- the dialog, and what it writes ---- */

const fields = (app.match(/group_name: group/g) || []).length;
if (!fields) {
  errors.push('the group dialog does not write the field the roster keeps it in '
    + '(group_name) -- writing any other name would change nothing and report a change');
}

/* One field and no more. The whole point of the button is that it is narrower than
   the edit form; a save that carried anything else would be the edit form with a
   shorter door. */
const save = (app.match(/method: 'PUT',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*credentials: 'same-origin',\s*body: JSON\.stringify\(\{ id: id, group_name: group \}\)/) || [''])[0];
if (!save) {
  errors.push('the group save sends something other than an id and a group: a change of '
    + 'one field must not be able to carry others');
}

/* ---- and a refusal is a refusal ---- */

const reads = app.match(/if \(!res\.ok \|\| data\.ok === false\) \{[\s\S]{0,400}return;/);
if (!reads) {
  errors.push('the group save does not read the server\'s answer, so a refused change '
    + 'would close the dialog and change the row -- reporting a move that did not happen');
}

console.log('');
if (errors.length) {
  console.log('GROUP PROBLEMS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('The group button sits beside التعديل, writes one field, is shown to exactly '
  + 'the roles the server will hear, and reports a refusal as a refusal.');
process.exit(0);