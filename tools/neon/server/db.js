/* الوصول إلى Neon: اتصال واحد مشترك، واستعلامات مسمّاة.
   ----------------------------------------------------------------------------
   قاعدة بيانات حيّة واحدة، ومجمّع اتصالات صغير. كل استعلام يُمرَّر بمعاملات
   ($1، $2) ولا يُبنى بالنصّ: اسم سباح فيه فاصلة عليا لا يجوز أن يكون جملة SQL.

   و`raw` يبقى مرجعًا في كل قراءة: الأعمدة المطبوعة راحة، والوثيقة الكاملة
   هي الحقيقة. فما لا عمود له لا يضيع.
*/
'use strict';
const { Pool } = require('pg');

let pool = null;

function db() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL || require('../../neon-env').dbUrl();
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 8,
    idleTimeoutMillis: 30000
  });
  pool.on('error', err => console.error('idle database client failed:', err.message));
  return pool;
}

async function all(sql, params = []) {
  const r = await db().query(sql, params);
  return r.rows;
}

async function one(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  const r = await db().query(sql, params);
  return { rowCount: r.rowCount, rows: r.rows };
}

async function close() { if (pool) { await pool.end(); pool = null; } }

/* كل مستند يعود من قاعدة البيانات بنفس شكل ما كان يعود من Firestore:
   `raw` يُفكّ ويُدمج فوق الأعمدة، فالصفحة لا تعرف الفرق. */
function doc(row) {
  if (!row) return null;
  const raw = (row.raw && typeof row.raw === 'object') ? row.raw : {};
  const out = Object.assign({}, raw);
  for (const [k, v] of Object.entries(row)) {
    if (k === 'raw' || k === 'firestore_path') continue;
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

/* معرّف المستند كما تعرفه الصفحة: `swimmers/abc` -> `abc`. */
function idOf(path) {
  return String(path || '').split('/').pop();
}

module.exports = { db, all, one, run, close, doc, idOf };
