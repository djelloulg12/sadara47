/* قراءة `DATABASE_URL` من البيئة أو من `.env` في جذر المشروع.
   ----------------------------------------------------------------------------
   كلمة مرور القاعدة لا تُكتب في الشيفرة: تُقرأ من `.env` (متجاهَل في git)
   أو من بيئة النشر. وغيابها خطأ يُقال، لا قيمة افتراضية تُخفي الخطأ.

   الاستعمال:
     const dbUrl = require('./neon-env').dbUrl();
*/
const fs = require('fs');
const path = require('path');

function fromDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return '';
  const text = fs.readFileSync(file, 'utf8');
  const line = text.split(/\r?\n/).find(l => /^\s*DATABASE_URL\s*=/.test(l));
  if (!line) return '';
  return line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^["']|["']$/g, '');
}

function dbUrl() {
  const url = process.env.DATABASE_URL || fromDotEnv();
  if (!url) {
    throw new Error('DATABASE_URL is not set. Put it in .env (one line, DATABASE_URL=...) '
      + 'or export it before running. It is deliberately not written in the code.');
  }
  return url;
}

module.exports = { dbUrl };
