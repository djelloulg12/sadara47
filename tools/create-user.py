"""إنشاء أو تحديث حساب مستخدم في قاعدة SQLite المحلية.

الاستخدام:
    python tools/create-user.py --db sadara-local.db --email a@b.dz --password secret --role coach

الأدوار المدعومة: admin, president, coach, member, parent,
swimmer_adult, swimmer_minor
"""
import argparse
import hashlib
import hmac
import os
import secrets
import sqlite3
import sys

ROLES = ('admin', 'president', 'coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor')
ROUNDS = 120000


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ROUNDS).hex()
    return salt + '$' + digest


def password_ok(password, stored):
    salt, digest = stored.split('$', 1)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ROUNDS).hex()
    return hmac.compare_digest(value, digest)


def normalize_role(role):
    aliases = {
        'مدرب': 'coach', 'رئيس': 'president', 'مدير': 'admin',
        'ولي': 'parent', 'أولياء': 'parent', 'سباح': 'swimmer_adult',
        'قاصر': 'swimmer_minor', 'عضو': 'member',
    }
    role = (role or '').strip()
    role = aliases.get(role, role)
    return role if role in ROLES else None


def main():
    parser = argparse.ArgumentParser(description='Create or update a Sadara user')
    parser.add_argument('--db', default=os.environ.get('SADARA_DB_PATH', 'sadara.db'))
    parser.add_argument('--email', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--role', required=True)
    parser.add_argument('--first-name', default='')
    parser.add_argument('--last-name', default='')
    parser.add_argument('--phone', default='')
    parser.add_argument('--member-no', default='', help='links a swimmer account to a membership card')
    parser.add_argument('--group-name', default='', help='the group a coach supervises')
    args = parser.parse_args()

    role = normalize_role(args.role)
    if not role:
        print('دور غير معروف: %s\nالمسموح: %s' % (args.role, ', '.join(ROLES)), file=sys.stderr)
        return 2
    if len(args.password) < 8:
        print('كلمة المرور قصيرة جدًا (8 رموز على الأقل).', file=sys.stderr)
        return 2

    if not os.path.exists(args.db):
        print('قاعدة البيانات غير موجودة: %s' % args.db, file=sys.stderr)
        return 2

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cols = {r['name'] for r in conn.execute('PRAGMA table_info(users)')}
    for extra in ('member_no', 'group_name'):
        if extra not in cols:
            conn.execute('ALTER TABLE users ADD COLUMN %s TEXT' % extra)
    try:
        row = conn.execute('SELECT id FROM users WHERE email=?', (args.email,)).fetchone()
        if row:
            conn.execute(
                "UPDATE users SET password_hash=?, role=?, status='active', first_name=COALESCE(NULLIF(?,''),first_name),"
                " last_name=COALESCE(NULLIF(?,''),last_name), phone=COALESCE(NULLIF(?,''),phone),"
                " member_no=COALESCE(NULLIF(?,''),member_no), group_name=COALESCE(NULLIF(?,''),group_name) WHERE id=?",
                (password_hash(args.password), role, args.first_name, args.last_name, args.phone,
                 args.member_no, args.group_name, row['id']))
            action, user_id = 'تحديث', row['id']
        else:
            cur = conn.execute(
                'INSERT INTO users(first_name,last_name,email,password_hash,role,phone,member_no,group_name)'
                ' VALUES(?,?,?,?,?,?,?,?)',
                (args.first_name or 'عضو', args.last_name or 'النادي', args.email,
                 password_hash(args.password), role, args.phone, args.member_no, args.group_name))
            action, user_id = 'إنشاء', cur.lastrowid
        conn.commit()
    finally:
        conn.close()

    print('%s: %s  (%s)  id=%d  db=%s' % (action, args.email, role, user_id, args.db))
    if args.member_no:
        print('  مرتبط ببطاقة: %s' % args.member_no)
    if args.group_name:
        print('  الفوج: %s' % args.group_name)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())