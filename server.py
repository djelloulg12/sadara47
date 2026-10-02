import hashlib, hmac, json, os, secrets, sqlite3, re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get('SADARA_DB_PATH', os.path.join(ROOT, 'sadara.db'))
SESSIONS = {}

def connect():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c

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
    if not c.execute('SELECT 1 FROM notices LIMIT 1').fetchone():
        c.executemany('INSERT INTO notices(title,body,kind) VALUES(?,?,?)', [('فتح التسجيل للموسم الجديد','التسجيل مفتوح لفوج السباحة. المقاعد محدودة.','مهم'),('تذكير بالحصة التدريبية','يرجى الحضور قبل الموعد بـ 15 دقيقة.','تذكير')])
    if not c.execute('SELECT 1 FROM schedules LIMIT 1').fetchone():
        c.executemany('INSERT INTO schedules(day_name,time_range,group_name,coach) VALUES(?,?,?,?)', [('السبت','16:00 - 17:30','المبتدئون','المدرب سليم'),('الأحد','17:00 - 18:30','المتوسطون','المدرب سليم'),('الإثنين','16:00 - 18:00','المتقدمون','المدربة نادية'),('الثلاثاء','17:00 - 18:30','المبتدئون','المدرب سليم'),('الخميس','16:00 - 18:00','المتقدمون','المدربة نادية')])
    c.commit(); c.close()

class App(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)
    def send_json(self, value, code=200, extra=None):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw)))
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(raw)
    def read_json(self):
        n=int(self.headers.get('Content-Length','0'))
        return json.loads(self.rfile.read(n) or b'{}')
    def current_user(self):
        token=self.headers.get('Cookie','').replace('sadara_session=','').split(';')[0]
        return SESSIONS.get(token)
    def authorized(self):
        user=self.current_user()
        if not user: self.send_json({'error':'يرجى تسجيل الدخول'},401)
        return user
    def do_GET(self):
        path=urlparse(self.path).path
        if not path.startswith('/api/'): return super().do_GET()
        user=self.current_user()
        if path not in ('/api/subscriptions',) and not user:
            self.send_json({'error':'يرجى تسجيل الدخول'},401); return
        c=connect()
        queries={
            '/api/swimmers':'SELECT * FROM swimmers ORDER BY id DESC',
            '/api/notices':"SELECT id,title,body AS text,kind,date(published_at) AS date FROM notices ORDER BY id DESC",
            '/api/schedule':'SELECT * FROM schedules ORDER BY id',
            '/api/cards':'SELECT cards.*,swimmers.name FROM cards JOIN swimmers ON swimmers.id=cards.swimmer_id ORDER BY cards.id DESC',
            '/api/attendance':"SELECT attendance.*,swimmers.name,swimmers.group_name FROM attendance JOIN swimmers ON swimmers.id=attendance.swimmer_id WHERE session_date=date('now') ORDER BY attendance.id",
            '/api/subscriptions':'SELECT * FROM subscription_plans WHERE active=1 ORDER BY id',
            '/api/applications':"SELECT a.*,p.name AS subscription_name FROM applications a LEFT JOIN subscription_plans p ON p.code=a.subscription_code ORDER BY a.id DESC"
        }
        if path == '/api/session': self.send_json({'user':user}); c.close(); return
        if path in queries: self.send_json([dict(x) for x in c.execute(queries[path]).fetchall()]); c.close(); return
        c.close(); self.send_json({'error':'المسار غير موجود'},404)
    def do_POST(self):
        path=urlparse(self.path).path; data=self.read_json()
        if path == '/api/login':
            c=connect(); row=c.execute("SELECT * FROM users WHERE email=? AND status='active'",(data.get('email',''),)).fetchone(); c.close()
            if not row or not password_ok(data.get('password',''),row['password_hash']): self.send_json({'error':'البريد الإلكتروني أو كلمة المرور غير صحيحة'},401); return
            token=secrets.token_urlsafe(32); user={'id':row['id'],'name':row['first_name']+' '+row['last_name'],'role':row['role']}; SESSIONS[token]=user
            self.send_json({'user':user},extra={'Set-Cookie':f'sadara_session={token}; HttpOnly; SameSite=Lax; Path=/' }); return
        if path == '/api/logout':
            token=self.headers.get('Cookie','').replace('sadara_session=','').split(';')[0]; SESSIONS.pop(token,None); self.send_json({'ok':True}); return
        if path == '/api/applications':
            c=connect()
            try:
                d=data; category=d.get('category','adult'); minor=category=='minor'
                plan=c.execute('SELECT amount FROM subscription_plans WHERE code=? AND active=1',(d.get('subscription_code','quarter'),)).fetchone()
                amount=(plan['amount'] if plan else 0)+ (900 if d.get('transport') else 0) + (2500 if d.get('uniform') else 0)
                no='APP-'+date.today().strftime('%Y%m%d')+'-'+secrets.token_hex(2).upper()
                cur=c.execute('''INSERT INTO applications(application_no,sport,category,swimming_strokes,first_name_ar,last_name_ar,first_name_fr,last_name_fr,national_id,birth_certificate_no,birth_place,wilaya,birth_date,gender,blood_group,level,phone,whatsapp,address,facility,subscription_code,transport,uniform,payment_method,expected_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (no,d.get('sport','السباحة'),category,d.get('swimming_strokes',''),d.get('first_name_ar',''),d.get('last_name_ar',''),d.get('first_name_fr',''),d.get('last_name_fr',''),d.get('national_id','') if not minor else '',d.get('birth_certificate_no','') if minor else '',d.get('birth_place',''),d.get('wilaya',''),d.get('birth_date',''),d.get('gender',''),d.get('blood_group',''),d.get('level','مبتدئ'),d.get('phone',''),d.get('whatsapp',''),d.get('address',''),d.get('facility','المسبح الأولمبي'),d.get('subscription_code','quarter'),int(bool(d.get('transport'))),int(bool(d.get('uniform'))),d.get('payment_method','cash'),amount))
                app_id=cur.lastrowid
                if minor and d.get('guardian_first_name'):
                    c.execute('INSERT INTO guardians(application_id,first_name,last_name,relation,national_id,phone,whatsapp,address,consent) VALUES(?,?,?,?,?,?,?,?,?)',(app_id,d.get('guardian_first_name'),d.get('guardian_last_name',''),d.get('guardian_relation','ولي'),d.get('guardian_national_id',''),d.get('guardian_phone',''),d.get('guardian_whatsapp',''),d.get('guardian_address',''),int(bool(d.get('guardian_consent')))))
                c.execute('INSERT INTO payments(application_id,amount,method) VALUES(?,?,?)',(app_id,amount,d.get('payment_method','cash')))
                c.commit(); self.send_json({'ok':True,'application_no':no,'expected_amount':amount},201)
            except sqlite3.IntegrityError as e: self.send_json({'error':str(e)},400)
            finally: c.close()
            return
        if not self.authorized(): return
        c=connect()
        try:
            if path == '/api/swimmers':
                no=data.get('membership_no') or 'SDR-'+secrets.token_hex(2).upper(); c.execute('INSERT INTO swimmers(membership_no,name,group_name,phone) VALUES(?,?,?,?)',(no,data.get('name',''),data.get('group_name','المبتدئون'),data.get('phone','')))
            elif path == '/api/notices': c.execute('INSERT INTO notices(title,body,kind) VALUES(?,?,?)',(data.get('title',''),data.get('body',''),data.get('kind','إعلان')))
            elif path == '/api/attendance': c.execute("INSERT INTO attendance(swimmer_id,session_date,status,check_in) VALUES(?,date('now'),?,datetime('now')) ON CONFLICT(swimmer_id,session_date) DO UPDATE SET status=excluded.status,check_in=excluded.check_in",(data['swimmer_id'],data.get('status','present')))
            else: c.close(); self.send_json({'error':'المسار غير موجود'},404); return
            c.commit(); self.send_json({'ok':True})
        except (sqlite3.IntegrityError, KeyError) as e: self.send_json({'error':str(e)},400)
        finally: c.close()

    def do_PATCH(self):
        path=urlparse(self.path).path; user=self.authorized()
        if not user: return
        if user['role'] not in ('admin','president'):
            self.send_json({'error':'لا تملك صلاحية تعديل الطلبات'},403); return
        data=self.read_json(); match=re.match(r'^/api/applications/(\d+)$',path)
        if not match: self.send_json({'error':'المسار غير موجود'},404); return
        c=connect(); app_id=int(match.group(1)); fields=[]; values=[]
        for key in ('subscription_code','transport','uniform','payment_method','status','decision_note','facility'):
            if key in data: fields.append(key+'=?'); values.append(data[key])
        if 'subscription_code' in data or 'transport' in data or 'uniform' in data:
            current=c.execute('SELECT * FROM applications WHERE id=?',(app_id,)).fetchone(); code=data.get('subscription_code',current['subscription_code']); plan=c.execute('SELECT amount FROM subscription_plans WHERE code=?',(code,)).fetchone(); amount=(plan['amount'] if plan else 0)+(900 if data.get('transport',current['transport']) else 0)+(2500 if data.get('uniform',current['uniform']) else 0); fields.append('expected_amount=?'); values.append(amount)
        if not fields: c.close(); self.send_json({'error':'لا توجد تغييرات'},400); return
        fields.append("updated_at=datetime('now')"); values.append(app_id); c.execute('UPDATE applications SET '+','.join(fields)+' WHERE id=?',values); c.execute('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)',(user['id'],'تعديل طلب','application',app_id,json.dumps(data,ensure_ascii=False))); c.commit(); c.close(); self.send_json({'ok':True})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', '4173'))
    print(f'Sadara platform listening on port {port}')
    ThreadingHTTPServer(('0.0.0.0', port), App).serve_forever()

