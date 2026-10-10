import base64, hashlib, hmac, json, os, re, secrets, sqlite3, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get('SADARA_DB_PATH', os.path.join(ROOT, 'sadara-local.db'))
SESSIONS = {}

def connect():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c

def read_extras(c):
    values = {r['key']: r['value'] for r in c.execute('SELECT key,value FROM fee_settings')}
    return {'transport': values.get('transport', 900), 'uniform': values.get('uniform', 2500)}

def write_extras(c, data):
    for key in ('transport', 'uniform'):
        if key in data:
            c.execute('INSERT INTO fee_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, int(data[key] or 0)))

SCAN_DIR = os.path.join(ROOT, 'uploads', 'scans')

def store_inline_scan(app_id, data_url, name):
    """Persist a data URL as a file; returns the stored name, or None if it is not usable."""
    if not data_url.startswith('data:'):
        return None
    try:
        header, payload = data_url.split(',', 1)
        mime = header[5:].split(';')[0] or 'application/octet-stream'
        ext = {'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png',
               'image/webp': '.webp'}.get(mime, '.bin')
        blob = base64.b64decode(payload)
    except Exception:
        return None
    if not blob or len(blob) > 10 * 1024 * 1024:
        return None
    os.makedirs(SCAN_DIR, exist_ok=True)
    fname = 'app-%s-%s%s' % (app_id, int(time.time()), ext)
    with open(os.path.join(SCAN_DIR, fname), 'wb') as fh:
        fh.write(blob)
    return {'path': 'uploads/scans/' + fname, 'name': name, 'size': len(blob)}


def ensure_columns(c, table, spec):
    """Add columns introduced after a database was first created."""
    existing = {r['name'] for r in c.execute('PRAGMA table_info(' + table + ')')}
    for name, decl in spec.items():
        if name not in existing:
            c.execute('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + decl)

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 120000).hex()
    return salt + '$' + value

def password_ok(password, stored):
    salt, digest = stored.split('$', 1)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 120000).hex()
    return hmac.compare_digest(value, digest)

def init_db():
    c = connect()
    with open(os.path.join(ROOT, 'schema.sql'), encoding='utf-8') as f:
        c.executescript(f.read())
    ensure_columns(c, 'applications', {
        'application_type': "TEXT NOT NULL DEFAULT 'swimmer'", 'applicant_uid': 'TEXT',
        'coach_name': 'TEXT', 'coach_email': 'TEXT', 'coach_phone': 'TEXT',
        'coach_experience': 'TEXT', 'coach_specialty': 'TEXT', 'coach_notes': 'TEXT',
        'documents': 'TEXT'})
    ensure_columns(c, 'users', {
        'member_no': 'TEXT', 'group_name': 'TEXT'})
    ensure_columns(c, 'payments', {'cashier_name': 'TEXT'})
    ensure_columns(c, 'applications', {
        'payment_status': "TEXT NOT NULL DEFAULT 'unpaid'", 'cashier_name': 'TEXT',
        'paid_at': 'TEXT', 'scan_path': 'TEXT', 'scan_name': 'TEXT',
        'scan_size': 'INTEGER', 'scan_note': 'TEXT'})
    # Production-safe account bootstrap: credentials are supplied only through
    # environment variables and are never stored in the public source tree.
    accounts = [
        ('SADARA_ADMIN_EMAIL', 'SADARA_ADMIN_PASSWORD', 'admin', 'مدير', 'النادي'),
        ('SADARA_PRESIDENT_EMAIL', 'SADARA_PRESIDENT_PASSWORD', 'president', 'رئيس', 'الجمعية'),
        ('SADARA_COACH_EMAIL', 'SADARA_COACH_PASSWORD', 'coach', 'مدرب', 'النادي'),
    ]
    for email_key, password_key, role, first_name, last_name in accounts:
        email, password = os.environ.get(email_key), os.environ.get(password_key)
        if email and password:
            c.execute('INSERT OR IGNORE INTO users(first_name,last_name,email,password_hash,role) VALUES(?,?,?,?,?)', (first_name,last_name,email,password_hash(password),role))
    if not c.execute('SELECT 1 FROM subscription_plans LIMIT 1').fetchone():
        c.executemany('INSERT INTO subscription_plans(code,name,amount,duration) VALUES(?,?,?,?)', [('season','اشتراك حر',3000,'موسم'),('quarter','اشتراك فصلي',1000,'3 أشهر'),('agreement','ضمن اتفاقية معتمدة',3000,'موسم')])
    write_extras(c, {'transport': 900, 'uniform': 2500})
    if not c.execute('SELECT 1 FROM notices LIMIT 1').fetchone():
        c.executemany('INSERT INTO notices(title,body,kind) VALUES(?,?,?)', [('فتح التسجيل للموسم الجديد','التسجيل مفتوح لفوج السباحة. المقاعد محدودة.','مهم'),('تذكير بالحصة التدريبية','يرجى الحضور قبل الموعد بـ 15 دقيقة.','تذكير')])
    if not c.execute('SELECT 1 FROM schedules LIMIT 1').fetchone():
        c.executemany('INSERT INTO schedules(day_name,time_range,group_name,coach) VALUES(?,?,?,?)', [('السبت','16:00 - 17:30','المبتدئون','المدرب سليم'),('الأحد','17:00 - 18:30','المتوسطون','المدرب سليم'),('الإثنين','16:00 - 18:00','المتقدمون','المدربة نادية'),('الثلاثاء','17:00 - 18:30','المبتدئون','المدرب سليم'),('الخميس','16:00 - 18:00','المتقدمون','المدربة نادية')])
    c.commit(); c.close()

# The three accounts a developer expects to find on their own machine. This is
# the local development database and nothing else: the name has to say so, and a
# password is only ever written here when the file it lands in is the local one.
LOCAL_DB_NAME = 'sadara-local.db'
# The roles the platform recognises. One that is not here would produce an
# account that can do nothing at all, so it is refused rather than stored.
ROLES = ('admin', 'president', 'coach', 'member', 'parent', 'swimmer_adult', 'swimmer_minor')

LOCAL_PASSWORD = 'Sadara@2026'
LOCAL_ACCOUNTS = (
    ('admin@sadara.local', 'admin', 'مدير', 'النادي'),
    ('president@sadara.local', 'president', 'رئيس', 'الجمعية'),
    ('coach@sadara.local', 'coach', 'مدرب', 'النادي'),
)


def db_path():
    return os.environ.get('SADARA_DB_PATH', LOCAL_DB_NAME)


def seed_local_accounts(path):
    """Gives a fresh local database someone to sign in as.

    Without this, a clean checkout serves a login page that nobody can get past,
    because the only other source of credentials is the environment. It applies
    to the local development file only: any other path, and any database that
    already holds an account, is left untouched.
    """
    if os.path.basename(path) != LOCAL_DB_NAME:
        return []
    c = sqlite3.connect(path)
    try:
        if c.execute('SELECT 1 FROM users LIMIT 1').fetchone():
            return []
        c.executemany('INSERT OR IGNORE INTO users(first_name,last_name,email,password_hash,role)'
                      ' VALUES(?,?,?,?,?)',
                      [(first, last, email, password_hash(LOCAL_PASSWORD), role)
                       for email, role, first, last in LOCAL_ACCOUNTS])
        c.commit()
    finally:
        c.close()
    return [a[0] for a in LOCAL_ACCOUNTS]


class App(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)
    def end_headers(self):
        # This is the development server. A browser that keeps its own copy of
        # app.js goes on running the build it started with, which is how you end
        # up staring at a fix that "did not take". Never let it cache.
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def send_json(self, value, code=200, extra=None):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw)))
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(raw)
    def read_json(self):
        n=int(self.headers.get('Content-Length','0'))
        return json.loads(self.rfile.read(n) or b'{}')
    def session_user(self, row):
        return {'id': row['id'], 'name': row['first_name'] + ' ' + row['last_name'], 'role': row['role'],
                'email': row['email'], 'phone': row['phone'] or '',
                'member_no': row['member_no'] or '', 'group_name': row['group_name'] or ''}
    def current_user(self):
        token=self.headers.get('Cookie','').replace('sadara_session=','').split(';')[0]
        return SESSIONS.get(token)
    def authorized(self):
        user=self.current_user()
        if not user: self.send_json({'error':'يرجى تسجيل الدخول'},401)
        return user

    def require_roles(self, roles):
        """Signed in, and holding one of these roles. Mirrors firestore.rules."""
        user=self.authorized()
        if not user: return None
        if user['role'] not in roles:
            self.send_json({'error':'هذه الصلاحية محموة لك'},403)
            return None
        return user
    def do_GET(self):
        path=urlparse(self.path).path
        if not path.startswith('/api/'): return super().do_GET()
        user=self.current_user()
        # a visitor may read prices, the weekly timetable and the announcements
        public = ('/api/subscriptions', '/api/subscription-plans', '/api/coach-requirements',
                  '/api/notices', '/api/schedule', '/api/facilities')
        if path not in public and not user:
            self.send_json({'error':'يرجى تسجيل الدخول'},401); return
        # other people's records stay inside the staff, exactly like firestore.rules
        manager_read = ('/api/applications', '/api/audit')
        staff_read = ('/api/swimmers', '/api/attendance', '/api/cards')
        if path in manager_read or path in staff_read:
            roles = ('admin', 'president') if path in manager_read else ('admin', 'president', 'coach')
            if not self.require_roles(roles): return
        c=connect()
        queries={
            '/api/swimmers':'SELECT * FROM swimmers ORDER BY id DESC',
            '/api/notices':"SELECT id,title,body AS text,kind,date(published_at) AS date FROM notices ORDER BY id DESC",
            '/api/schedule':'SELECT * FROM schedules ORDER BY id',
            '/api/cards':'SELECT cards.*,swimmers.name FROM cards JOIN swimmers ON swimmers.id=cards.swimmer_id ORDER BY cards.id DESC',
            '/api/attendance':"SELECT attendance.*,swimmers.membership_no AS member_id,swimmers.name,swimmers.group_name FROM attendance JOIN swimmers ON swimmers.id=attendance.swimmer_id WHERE session_date=date('now') ORDER BY attendance.id",
            '/api/subscriptions':'SELECT * FROM subscription_plans WHERE active=1 ORDER BY id',
            '/api/applications':"SELECT a.*,p.name AS subscription_name FROM applications a LEFT JOIN subscription_plans p ON p.code=a.subscription_code ORDER BY a.id DESC"
        }
        if path == '/api/visits':
            total = c.execute('SELECT COUNT(*) AS n FROM visits').fetchone()['n']
            today = c.execute("SELECT COUNT(*) AS n FROM visits WHERE date(visited_at)=date('now')").fetchone()['n']
            week = c.execute("SELECT COUNT(*) AS n FROM visits WHERE visited_at >= date('now','-7 day')").fetchone()['n']
            c.close(); self.send_json({'visits': total, 'today': today, 'week': week}); return
        if path == '/api/accounts':
            user = self.authorized()
            if not user: return
            if user['role'] not in ('admin', 'president'):
                self.send_json({'error': 'عرض الحسابات لرئيس النادي فقط'}, 403); return
            c = connect()
            try:
                rows = c.execute("SELECT id,first_name,last_name,email,role,created_at FROM users"
                                 " ORDER BY case role when 'admin' then 0 when 'president' then 1"
                                 " when 'coach' then 2 else 3 end, email").fetchall()
                self.send_json([{
                    'id': r['id'],
                    'name': (str(r['first_name'] or '') + ' ' + str(r['last_name'] or '')).strip(),
                    'email': r['email'] or '', 'role': r['role'] or 'member',
                    'owner': False, 'joined': r['created_at'] or ''
                } for r in rows])
            finally:
                c.close()
            return
        if path == '/api/session': self.send_json({'user':user}); c.close(); return
        if path == '/api/audit':
            rows=[{'action':r['action'],'entity_type':r['entity_type'],'entity_id':r['entity_id'],
                   'details':json.loads(r['details']) if r['details'] else {},'actor':r['user_id'],
                   'created_at':r['created_at']} for r in c.execute('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200')]
            c.close(); self.send_json({'audit':rows}); return
        if path == '/api/profile':
            row=c.execute('SELECT data FROM member_profiles WHERE user_id=?',(user['id'],)).fetchone()
            try: data=json.loads(row['data']) if row else {}
            except json.JSONDecodeError: data={}
            c.close(); self.send_json({'profile':data}); return
        if path == '/api/subscription-plans':
            self.send_json({'plans':[dict(x) for x in c.execute('SELECT * FROM subscription_plans ORDER BY id')],'extras':read_extras(c)}); c.close(); return
        if path == '/api/coach-requirements':
            rows=[{'id':r['id'],'label':r['label'],'required':bool(r['required']),'order':r['position']} for r in c.execute('SELECT * FROM coach_requirements ORDER BY position')]
            if not rows: rows=[{'id':'identity','label':'نسخة بطاقة التعريف الوطنية','required':True,'order':1},{'id':'cv','label':'السيرة الذاتية والشهادات التدريبية','required':True,'order':2},{'id':'medical','label':'شهادة طبية تثبت القدرة على التدريب','required':True,'order':3},{'id':'criminal-record','label':'صحيفة السوابق العدلية','required':False,'order':4}]
            self.send_json(rows); c.close(); return
        if path == '/api/facilities':
            rows=[{'id':r['id'],'name':r['name'],'order':r['position']} for r in c.execute('SELECT * FROM facilities WHERE active=1 ORDER BY position')]
            if not rows: rows=[{'id':'olympic','name':'المسبح الأولمبي','order':1},{'id':'half','name':'المسبح النصف أولمبي','order':2},{'id':'stadium','name':'الملعب البلدي','order':3},{'id':'forest','name':'غابة غرداية','order':4}]
            self.send_json(rows); c.close(); return
        if path in queries: self.send_json([dict(x) for x in c.execute(queries[path]).fetchall()]); c.close(); return
        c.close(); self.send_json({'error':'المسار غير موجود'},404)
    def do_POST(self):
        path=urlparse(self.path).path; data=self.read_json()
        if path == '/api/login':
            c=connect(); row=c.execute("SELECT * FROM users WHERE email=? AND status='active'",(data.get('email',''),)).fetchone(); c.close()
            if not row or not password_ok(data.get('password',''),row['password_hash']): self.send_json({'error':'البريد الإلكتروني أو كلمة المرور غير صحيحة'},401); return
            token=secrets.token_urlsafe(32); user=self.session_user(row); SESSIONS[token]=user
            self.send_json({'user':user},extra={'Set-Cookie':f'sadara_session={token}; HttpOnly; SameSite=Lax; Path=/' }); return
        if path == '/api/visit':
            c=connect()
            try:
                c.execute('INSERT INTO visits(page,source) VALUES(?,?)',
                          (str(data.get('page','/'))[:120], str(data.get('ref','direct'))[:40]))
                c.commit()
                total = c.execute('SELECT COUNT(*) AS n FROM visits').fetchone()['n']
                c.close(); self.send_json({'ok':True,'visits':total},201)
            except sqlite3.Error as e:
                c.close(); self.send_json({'error':str(e)},400)
            return
        if path == '/api/logout':
            token=self.headers.get('Cookie','').replace('sadara_session=','').split(';')[0]; SESSIONS.pop(token,None); self.send_json({'ok':True}); return
        if path == '/api/applications':
            c=connect()
            try:
                d=data; category=d.get('category','adult'); minor=category=='minor'
                extras=read_extras(c)
                plan=c.execute('SELECT amount FROM subscription_plans WHERE code=? AND active=1',(d.get('subscription_code','quarter'),)).fetchone()
                amount=(plan['amount'] if plan else 0)+ (extras['transport'] if d.get('transport') else 0) + (extras['uniform'] if d.get('uniform') else 0)
                no=d.get('application_no') or 'APP-'+date.today().strftime('%Y%m%d')+'-'+secrets.token_hex(2).upper()
                record={'application_no':no,'sport':d.get('sport','السباحة'),'category':category,
                    'application_type':d.get('application_type','swimmer'),'applicant_uid':d.get('applicant_uid',''),
                    'coach_name':d.get('coach_name',''),'coach_email':d.get('coach_email',''),'coach_phone':d.get('coach_phone',''),
                    'coach_experience':str(d.get('coach_experience','')),'coach_specialty':d.get('coach_specialty',''),
                    'coach_notes':d.get('coach_notes',''),'documents':json.dumps(d['documents'],ensure_ascii=False) if d.get('documents') else None,
                    'swimming_strokes':d.get('swimming_strokes',''),
                    'first_name_ar':d.get('first_name_ar','') or d.get('coach_name',''),'last_name_ar':d.get('last_name_ar',''),
                    'first_name_fr':d.get('first_name_fr',''),'last_name_fr':d.get('last_name_fr',''),
                    'national_id':'' if minor else d.get('national_id',''),
                    'birth_certificate_no':d.get('birth_certificate_no','') if minor else '',
                    'birth_place':d.get('birth_place',''),'wilaya':d.get('wilaya',''),
                    'birth_date':d.get('birth_date') or '2000-01-01',
                    'gender':d.get('gender',''),'blood_group':d.get('blood_group',''),'level':d.get('level','مبتدئ'),
                    'phone':d.get('phone','') or d.get('coach_phone',''),'whatsapp':d.get('whatsapp',''),'address':d.get('address',''),
                    'facility':d.get('facility','المسبح الأولمبي'),
                    'subscription_code':d.get('subscription_code','quarter'),
                    'transport':int(bool(d.get('transport'))),'uniform':int(bool(d.get('uniform'))),
                    'payment_method':d.get('payment_method','cash'),'expected_amount':amount}
                cur=c.execute('INSERT INTO applications('+','.join(record)+') VALUES('+','.join('?'*len(record))+')',tuple(record.values()))
                app_id=cur.lastrowid
                if minor and d.get('guardian_first_name'):
                    c.execute('INSERT INTO guardians(application_id,first_name,last_name,relation,national_id,phone,whatsapp,address,consent) VALUES(?,?,?,?,?,?,?,?,?)',(app_id,d.get('guardian_first_name'),d.get('guardian_last_name',''),d.get('guardian_relation','ولي'),d.get('guardian_national_id',''),d.get('guardian_phone',''),d.get('guardian_whatsapp',''),d.get('guardian_address',''),int(bool(d.get('guardian_consent')))))
                c.execute('INSERT INTO payments(application_id,amount,method) VALUES(?,?,?)',(app_id,amount,d.get('payment_method','cash')))
                c.commit(); self.send_json({'ok':True,'application_no':no,'expected_amount':amount},201)
            except sqlite3.IntegrityError as e: self.send_json({'error':str(e)},400)
            finally: c.close()
            return
        if not self.authorized(): return
        if path == '/api/audit':
            if self.current_user()['role'] not in ('admin','president'):
                self.send_json({'error':'سجل التدقيق للرئيس فقط'},403); return
            c=connect()
            try:
                c.execute('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',
                          (self.current_user()['id'],str(data.get('action',''))[:120],str(data.get('entity_type',''))[:40],
                           str(data.get('entity_id',''))[:60],json.dumps(data.get('details') or {},ensure_ascii=False)))
                c.commit(); self.send_json({'ok':True},201)
            finally: c.close()
            return
        # a coach records attendance; only management edits the club's records
        roles = ('admin', 'president', 'coach') if path == '/api/attendance' else ('admin', 'president')
        user = self.require_roles(roles)
        if not user: return
        c=connect()
        created={}
        try:
            if path == '/api/swimmers':
                no=data.get('membership_no') or 'SDR-'+secrets.token_hex(2).upper(); cur=c.execute('INSERT INTO swimmers(membership_no,name,group_name,phone) VALUES(?,?,?,?)',(no,data.get('name',''),data.get('group_name','المبتدئون'),data.get('phone',''))); created={'membership_no':no,'id':cur.lastrowid}
            elif path == '/api/notices': cur=c.execute('INSERT INTO notices(title,body,kind) VALUES(?,?,?)',(data.get('title',''),data.get('body',''),data.get('kind','إعلان'))); created={'id':cur.lastrowid}
            elif path == '/api/attendance':
                row=c.execute('SELECT id FROM swimmers WHERE membership_no=?',(str(data.get('member_id') or ''),)).fetchone()
                swimmer_id=row['id'] if row else data.get('swimmer_id')
                if not swimmer_id: c.close(); self.send_json({'error':'يجب تحديد السباح برقم الانخراط'},400); return
                c.execute("INSERT INTO attendance(swimmer_id,session_date,status,check_in) VALUES(?,date('now'),?,datetime('now')) ON CONFLICT(swimmer_id,session_date) DO UPDATE SET status=excluded.status,check_in=excluded.check_in",(int(swimmer_id),data.get('status','present')))
            elif path == '/api/schedule': c.execute('INSERT INTO schedules(day_name,time_range,group_name,coach,pool) VALUES(?,?,?,?,?)',(data.get('day_name','السبت'),data.get('time_range',''),data.get('group_name','المبتدئون'),data.get('coach',''),data.get('pool','مسبح الصدارة')))
            else: c.close(); self.send_json({'error':'المسار غير موجود'},404); return
            c.commit(); self.send_json({'ok':True, **created})
        except (sqlite3.IntegrityError, KeyError, ValueError) as e: self.send_json({'error':str(e)},400)
        finally: c.close()

    def do_PUT(self):
        path=urlparse(self.path).path; data=self.read_json()
        user=self.authorized()
        if not user: return
        if path == '/api/accounts':
            # An unknown role is refused rather than stored: an account holding one
            # can do nothing at all and looks broken rather than wrong. And you
            # may not change your own role, because there is no second manager
            # here to undo it.
            if user['role'] not in ('admin', 'president'):
                self.send_json({'error': 'تعديل الصلاحيات لرئيس النادي فقط'}, 403); return
            uid = str(data.get('id', '')).strip()
            role = str(data.get('role', '')).strip()
            if not uid:
                self.send_json({'error': 'معرّف الحساب مطلوب'}, 400); return
            if role not in ROLES:
                self.send_json({'error': 'دور غير معروف: ' + role}, 400); return
            if str(user['id']) == uid:
                self.send_json({'error': 'لا تُغيّر صلاحياتك بنفسك'}, 400); return
            c = connect()
            try:
                row = c.execute('SELECT id FROM users WHERE id=?', (uid,)).fetchone()
                if not row:
                    self.send_json({'error': 'الحساب غير موجود'}, 404); return
                c.execute('UPDATE users SET role=? WHERE id=?', (role, uid))
                c.execute('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)'
                          ' VALUES(?,?,?,?,?)',
                          (user['id'], 'role_changed', 'user', uid,
                           json.dumps({'role': role}, ensure_ascii=False)))
                c.commit()
                self.send_json({'ok': True, 'id': uid, 'role': role})
            finally:
                c.close()
            return
        if path == '/api/profile':
            allowed={k:str(v)[:2000] for k,v in data.items() if k in (
                'name','first_name_fr','last_name_fr','birth_date','birth_place','wilaya','address',
                'phone','whatsapp','blood_group','gender','national_id','height','weight',
                'emergency_name','emergency_phone','medical_notes','notes','member_no','group_name','photo')}
            if 'extras' in data:
                items=[x for x in (data.get('extras') or []) if isinstance(x,dict) and (x.get('label') or x.get('value'))][:20]
                allowed['extras']=[{'label':str(x.get('label',''))[:80],'value':str(x.get('value',''))[:400]} for x in items]
            c=connect()
            try:
                row=c.execute('SELECT data FROM member_profiles WHERE user_id=?',(user['id'],)).fetchone()
                try: current=json.loads(row['data']) if row else {}
                except json.JSONDecodeError: current={}
                merged=dict(current)
                for k,v in allowed.items():
                    if v!='' or k in ('extras','phone'): merged[k]=v
                c.execute('INSERT INTO member_profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=CURRENT_TIMESTAMP',
                          (user['id'],json.dumps(merged,ensure_ascii=False)))
                if allowed.get('name'): c.execute('UPDATE users SET first_name=? WHERE id=?',(str(allowed['name']).split(' ')[0],user['id']))
                if allowed.get('phone'): c.execute('UPDATE users SET phone=? WHERE id=?',(allowed['phone'],user['id']))
                c.commit(); self.send_json({'ok':True,'profile':merged})
            except sqlite3.Error as e: self.send_json({'error':str(e)},400)
            finally: c.close()
            return
        if user['role'] not in ('admin','president'):
            self.send_json({'error':'هذه العملية لرئيس النادي فقط'},403); return

        if not self.require_roles(('admin', 'president')): return
        c=connect()
        try:
            if path == '/api/subscription-plans':
                for plan in data.get('plans',[]):
                    if not plan.get('code'): continue
                    c.execute('''INSERT INTO subscription_plans(code,name,amount,duration,active) VALUES(?,?,?,?,?)
                                 ON CONFLICT(code) DO UPDATE SET name=excluded.name,amount=excluded.amount,duration=excluded.duration,active=excluded.active''',
                              (plan['code'],plan.get('name') or plan['code'],int(plan.get('amount') or 0),plan.get('duration') or 'موسم',1 if plan.get('active',True) else 0))
                write_extras(c, data.get('extras') or {})
            elif path == '/api/swimmers':
                if not data.get('id'): c.close(); self.send_json({'error':'معرّف السباح مطلوب'},400); return
                c.execute('UPDATE swimmers SET name=?,group_name=?,phone=?,status=? WHERE membership_no=?',
                          (data.get('name',''),data.get('group_name','المبتدئون'),data.get('phone',''),data.get('status','active'),data['id']))
            elif path == '/api/notices':
                if not data.get('id'): c.close(); self.send_json({'error':'معرّف الإعلان مطلوب'},400); return
                c.execute('UPDATE notices SET title=?,body=?,kind=? WHERE id=?',(data.get('title',''),data.get('body',''),data.get('kind','إعلان'),int(data['id'])))
            elif path == '/api/schedule':
                if not data.get('id'): c.close(); self.send_json({'error':'معرّف الحصة مطلوب'},400); return
                c.execute('UPDATE schedules SET day_name=?,time_range=?,group_name=?,coach=?,pool=? WHERE id=?',
                          (data.get('day_name',''),data.get('time_range',''),data.get('group_name',''),data.get('coach',''),data.get('pool','مسبح الصدارة'),int(data['id'])))
            elif path == '/api/coach-requirements':
                items=[x for x in (data.get('requirements') or []) if x and x.get('label')]
                c.execute('DELETE FROM coach_requirements')
                c.executemany('INSERT INTO coach_requirements(id,label,required,position) VALUES(?,?,?,?)',[(x.get('id') or 'req-'+str(i),x['label'],1 if x.get('required',True) else 0,i+1) for i,x in enumerate(items)])
            elif path == '/api/facilities':
                items=[x for x in (data.get('facilities') or []) if x and str(x.get('name','')).strip()]
                if not items: c.close(); self.send_json({'error':'أبقِ مسبحًا واحدًا على الأقل في القائمة.'},400); return
                c.execute('DELETE FROM facilities')
                c.executemany('INSERT INTO facilities(id,name,position,active) VALUES(?,?,?,1)',
                              [(re.sub(r'[^\w-]','_',str(x.get('id') or 'fac-'+str(i))), str(x['name']).strip()[:120], i+1) for i,x in enumerate(items)])
            else: c.close(); self.send_json({'error':'المسار غير موجود'},404); return
            c.commit(); self.send_json({'ok':True})
        except (sqlite3.IntegrityError, ValueError) as e: self.send_json({'error':str(e)},400)
        finally: c.close()

    def do_DELETE(self):
        path=urlparse(self.path).path; data=self.read_json()
        user=self.authorized()
        if not user: return
        if user['role'] not in ('admin','president'):
            self.send_json({'error':'هذه العملية لرئيس النادي فقط'},403); return
        if not data.get('id'):
            self.send_json({'error':'معرّف السجل مطلوب'},400); return
        table={'/api/swimmers':'swimmers','/api/notices':'notices','/api/schedule':'schedules'}.get(path)
        if not table: self.send_json({'error':'المسار غير موجود'},404); return
        c=connect()
        key='membership_no' if table=='swimmers' else 'id'
        try:
            c.execute(f'DELETE FROM {table} WHERE {key}=?',(data['id'],)); c.commit(); self.send_json({'ok':True})
        except sqlite3.Error as e: self.send_json({'error':str(e)},400)
        finally: c.close()

    def do_PATCH(self):
        path=urlparse(self.path).path; user=self.authorized()
        if not user: return
        if user['role'] not in ('admin','president'):
            self.send_json({'error':'لا تملك صلاحية تعديل الطلبات'},403); return
        data=self.read_json(); match=re.match(r'^/api/applications/(\d+)$',path)
        if not match: self.send_json({'error':'المسار غير موجود'},404); return
        if 'decision_reason' in data: data['decision_note']=data['decision_reason']
        # a signed scan arrives as a data URL and is stored as a real file
        inline = data.pop('scan_data_url', '') if isinstance(data.get('scan_data_url'), str) else ''
        wanted_name = str(data.get('scan_name') or '')[:120]
        c=connect()
        try:
            app_id=int(match.group(1)); fields=[]; values=[]
            # when the copy travels inline the stored file decides these three columns,
            # so they must not also come from the body or the bindings would not line up
            if inline:
                for key in ('scan_path','scan_name','scan_size'): data.pop(key, None)
            for key in ('subscription_code','transport','uniform','payment_method','status','decision_note','facility',
                        'payment_status','cashier_name','paid_at','scan_note','scan_path','scan_name','scan_size'):
                if key in data and data[key] is not None: fields.append(key+'=?'); values.append(data[key])
            if 'subscription_code' in data or 'transport' in data or 'uniform' in data:
                current=c.execute('SELECT * FROM applications WHERE id=?',(app_id,)).fetchone()
                if not current: c.close(); self.send_json({'error':'الطلب غير موجود'},404); return
                code=data.get('subscription_code',current['subscription_code']); plan=c.execute('SELECT amount FROM subscription_plans WHERE code=?',(code,)).fetchone(); extras=read_extras(c); amount=(plan['amount'] if plan else 0)+(extras['transport'] if data.get('transport',current['transport']) else 0)+(extras['uniform'] if data.get('uniform',current['uniform']) else 0); fields.append('expected_amount=?'); values.append(amount)
            if inline:
                stored = store_inline_scan(app_id, inline, wanted_name or 'scan')
                if stored is None:
                    c.close(); self.send_json({'error':'تعذّر حفظ النسخة'},400); return
                data['scan_path'] = stored['path']; data['scan_name'] = stored['name']
                data['scan_size'] = stored['size']
                fields += ['scan_path=?', 'scan_name=?', 'scan_size=?']
                values += [stored['path'], stored['name'], stored['size']]
            if not fields: c.close(); self.send_json({'error':'لا توجد تغييرات'},400); return
            if data.get('payment_status') == 'paid':
                c.execute("INSERT INTO payments(application_id,amount,method,paid_at,cashier_name) "
                          "SELECT id,expected_amount,COALESCE(?,'cash'),?,? FROM applications WHERE id=?",
                          (data.get('payment_method'), data.get('paid_at') or None,
                           data.get('cashier_name') or '', app_id))
            fields.append("updated_at=datetime('now')"); values.append(app_id)
            c.execute('UPDATE applications SET '+','.join(fields)+' WHERE id=?',values)
            # Accepting a request used to change its status and stop there, so the
            # club approved a child and then added them again by hand, and the
            # two records could disagree. The application number is the swimmer's
            # identity, so approving twice updates one person, not two.
            if data.get('status') == 'approved':
                row = c.execute('SELECT * FROM applications WHERE id=?', (app_id,)).fetchone()
                if row and (row['application_type'] or 'swimmer') != 'coach':
                    no = row['application_no'] or str(app_id)
                    name = ' '.join(x for x in [row['first_name_ar'], row['last_name_ar']] if x)
                    group = row['level'] or 'المبتدئون'
                    have = c.execute('SELECT id FROM swimmers WHERE membership_no=?', (no,)).fetchone()
                    if have:
                        c.execute('UPDATE swimmers SET name=?,group_name=?,phone=?,status=? WHERE membership_no=?',
                                  (name, group, row['phone'] or '', 'active', no))
                    else:
                        c.execute('INSERT INTO swimmers(membership_no,name,group_name,phone,status)'
                                  " VALUES(?,?,?,?,'active')", (no, name, group, row['phone'] or ''))
            c.execute('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',
                      (user['id'],'تعديل طلب','application',app_id,json.dumps(data,ensure_ascii=False)))
            c.commit(); self.send_json({'ok':True})
        except sqlite3.Error as e:
            self.send_json({'error':str(e)},400)
        finally:
            c.close()

def report_accounts(db_path):
    """Say who can sign in, and what to do if nobody can.

    A fresh database gets no accounts at all, because credentials only ever come
    from the environment. Without this line the club sees a login page and no
    explanation of why nobody can get past it.
    """
    try:
        c = sqlite3.connect(db_path)
        c.row_factory = sqlite3.Row
        rows = c.execute(
            "select email, role from users where status is null or status!='disabled'"
            " order by case role when 'admin' then 0 when 'president' then 1"
            " when 'manager' then 2 when 'coach' then 3 else 4 end, email").fetchall()
        c.close()
    except sqlite3.Error as e:
        print('  تعذّر قراءة الحسابات (%s). شغّل مرة واحدة: npm run serve' % e)
        return
    if not rows:
        print('  لا يوجد أي حساب بعد — قاعدة البيانات جديدة.')
        print('  أنشئ حسابًا الآن:  npm run user')
        return
    print('  الحسابات التي يمكنها الدخول (%d):' % len(rows))
    for r in rows:
        print('    %-30s %s' % (r['email'], r['role']))
    print('  كلمة المرور: ما اخترته أنت عند إنشاء الحساب.')
    print('  لإنشاء حساب أو تغيير كلمة مرور:  npm run user')


if __name__ == '__main__':
    db = db_path()
    init_db()
    seeded = seed_local_accounts(db)
    port = int(os.environ.get('PORT', '4173'))
    print(f'Sadara platform listening on port {port}')
    print(f'  قاعدة البيانات: {os.path.abspath(db)}')
    if seeded:
        print()
        print('  قاعدة بيانات محلية جديدة — أُنشئت حسابات التطوير التالية:')
        for email in seeded:
            print('    %-30s كلمة المرور: %s' % (email, LOCAL_PASSWORD))
        print()
        print('  هذه كلمة مرور للتطوير المحلي فقط، وهي معروفة للجميع.')
        print('  لا تستعملها على المنصة المنشورة، وغيرها قبل أي استعمال حقيقي:')
        print('    npm run user')
    report_accounts(db)
    print()
    ThreadingHTTPServer(('0.0.0.0', port), App).serve_forever()
