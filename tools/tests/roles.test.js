/* The roles a person may hold, in one place.
   Both account tools and the page have to agree on this list, and firestore.rules
   grants management to admin and president only. A role outside the list would
   produce an account that signs in and then finds nothing it may do. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const rules = read('firestore.rules');
const app = read('app.js');
const server = read('server.py');
const createUser = read('tools/create-user.py');
const seed = read('tools/seed-accounts.py');

/* the roles the local tool will create */
const m = createUser.match(/^ROLES = \(([^)]*)\)/m);
if (!m) errors.push('tools/create-user.py no longer declares ROLES on one line');
const localRoles = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];

/* the roles the published-site tool will create */
const s = seed.match(/^ROLES = STAFF_ROLES \+ MEMBER_ROLES$/m);
if (!s) {
  errors.push('tools/seed-accounts.py does not build its role list from STAFF_ROLES + MEMBER_ROLES');
} else {
  const grab = name => {
    const g = seed.match(new RegExp('^' + name + " = \\(([^)]*)\\)", 'm'));
    return g ? g[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  };
  const seeded = grab('STAFF_ROLES').concat(grab('MEMBER_ROLES'));
  const missing = localRoles.filter(r => seeded.indexOf(r) === -1);
  const extra = seeded.filter(r => localRoles.indexOf(r) === -1);
  if (missing.length) errors.push('the published tool cannot create: ' + missing.join(', '));
  if (extra.length) errors.push('the published tool creates roles the local tool does not know: ' + extra.join(', '));
}

/* Every role must be one the page knows. The server only names the privileged
   ones, because everything else is a member by falling through -- the same shape
   as firestore.rules. So only the privileged roles are required there. */
const PRIVILEGED = ['admin', 'president', 'coach'];
for (const role of localRoles) {
  if (!new RegExp("'" + role + "'").test(app)) {
    errors.push('app.js never mentions the role ' + role);
  }
  if (PRIVILEGED.indexOf(role) !== -1 && !new RegExp("'" + role + "'").test(server)) {
    errors.push('server.py never names the privileged role ' + role);
  }
}

/* management belongs to exactly these two */
const managerFn = rules.match(/function manager\(\)\s*\{[^}]*\}/);
if (!managerFn) errors.push('firestore.rules has no manager() function');
else {
  const inside = managerFn[0];
  for (const role of ['admin', 'president']) {
    if (inside.indexOf("'" + role + "'") === -1) errors.push('manager() no longer includes ' + role);
  }
  for (const role of ['coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor']) {
    if (inside.indexOf("'" + role + "'") !== -1) errors.push('manager() now includes ' + role + ', which would grant management to it');
  }
}

/* the roles that get their own page rather than the admin dashboard */
const memberPages = ['coach', 'swimmer_adult', 'swimmer_minor', 'parent', 'member'];
for (const role of memberPages) {
  if (!new RegExp("'" + role + "'").test(app)) errors.push('app.js lost the page for ' + role);
}

/* no account may be created with a role the tools do not list */
if (!/raise SystemExit\(["']Unknown role/.test(seed)) {
  errors.push('tools/seed-accounts.py does not refuse an unknown role');
}

if (errors.length) { console.log('PROBLEMS:\n  - ' + [...new Set(errors)].join('\n  - ')); process.exit(1); }
console.log('Roles agree across the tools, the page and the rules: ' + localRoles.join(', '));
