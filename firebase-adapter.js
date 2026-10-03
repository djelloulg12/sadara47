/* Firebase bridge for the existing Sadara UI. It keeps the UI API-shaped while
   replacing the local Python session/SQLite calls with Auth + Firestore. */
(function () {
  const config = window.SADARA_FIREBASE_CONFIG;
  if (!config || !window.firebase) return;
  firebase.initializeApp(config);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const jsonResponse = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
  const currentUser = () => new Promise(resolve => {
    const stop = auth.onAuthStateChanged(user => { stop(); resolve(user); });
  });
  const userView = async user => {
    if (!user) return null;
    let profile = {};
    try { const snap = await db.collection('users').doc(user.uid).get(); profile = snap.exists ? snap.data() : {}; }
    catch (error) { console.warn('Firestore profile unavailable; using Auth account', error); }
    return { id: user.uid, name: profile.name || user.email || 'عضو النادي', role: profile.role || 'member', email: user.email || '' };
  };
  const rows = async (name) => (await db.collection(name).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const amountFor = (d, plans) => {
    const plan = plans.find(x => x.code === (d.subscription_code || 'quarter'));
    return (plan ? Number(plan.amount) : 0) + (d.transport ? 900 : 0) + (d.uniform ? 2500 : 0);
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (!url || !url.startsWith('/api/')) return originalFetch(input, init);
    const path = new URL(url, location.origin).pathname;
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch (_) {}
    try {
      if (path === '/api/login' && method === 'POST') {
        const credential = await auth.signInWithEmailAndPassword(body.email, body.password);
        return jsonResponse({ user: await userView(credential.user) });
      }
      if (path === '/api/logout' && method === 'POST') { await auth.signOut(); return jsonResponse({ ok: true }); }
      if (path === '/api/session' && method === 'GET') {
        const user = await currentUser();
        return user ? jsonResponse({ user: await userView(user) }) : jsonResponse({ error: 'يرجى تسجيل الدخول' }, 401);
      }
      if (path === '/api/subscriptions' && method === 'GET') {
        const plans = await rows('subscription_plans');
        return jsonResponse(plans.length ? plans : [
          { id: 'quarter', code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
          { id: 'season', code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' },
          { id: 'agreement', code: 'agreement', name: 'ضمن اتفاقية معتمدة', amount: 3000, duration: 'موسم' }
        ]);
      }
      if (path === '/api/coach-requirements' && method === 'GET') {
        const saved = await rows('coach_requirements');
        return jsonResponse(saved.length ? saved.sort((a, b) => (a.order || 0) - (b.order || 0)) : [
          { id: 'identity', label: 'نسخة بطاقة التعريف الوطنية', required: true, order: 1 },
          { id: 'cv', label: 'السيرة الذاتية والشهادات التدريبية', required: true, order: 2 },
          { id: 'medical', label: 'شهادة طبية تثبت القدرة على التدريب', required: true, order: 3 },
          { id: 'criminal-record', label: 'صحيفة السوابق العدلية', required: false, order: 4 }
        ]);
      }
      if (path === '/api/coach-requirements' && (method === 'POST' || method === 'PUT')) {
        const user = await currentUser();
        const profile = user ? await userView(user) : null;
        if (!profile || !['admin', 'president'].includes(profile.role)) return jsonResponse({ error: 'هذه العملية لرئيس النادي فقط' }, 403);
        const requirements = Array.isArray(body.requirements) ? body.requirements : [];
        const batch = db.batch();
        const existing = await db.collection('coach_requirements').get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        requirements.filter(x => x && x.label).forEach((item, index) => batch.set(db.collection('coach_requirements').doc(item.id || ('req-' + Date.now() + '-' + index)), { label: item.label, required: item.required !== false, order: index + 1 }));
        await batch.commit();
        return jsonResponse({ ok: true });
      }
      if (path === '/api/swimmers' && method === 'GET') return jsonResponse(await rows('swimmers'));
      if (path === '/api/notices' && method === 'GET') return jsonResponse((await rows('notices')).map(x => ({ ...x, text: x.text || x.body || '', date: x.date || '' })));
      if (path === '/api/schedule' && method === 'GET') return jsonResponse(await rows('schedules'));
      if (path === '/api/cards' && method === 'GET') return jsonResponse(await rows('cards'));
      if (path === '/api/attendance' && method === 'GET') return jsonResponse(await rows('attendance'));
      if (path === '/api/attendance' && method === 'POST') {
        const user = await currentUser(); if (!user) return jsonResponse({ error: 'يرجى تسجيل الدخول قبل تسجيل الحضور' }, 401);
        await db.collection('attendance').add({ member_id: body.member_id || '', status: body.status || 'present', marked_by: user.uid, marked_at: firebase.firestore.FieldValue.serverTimestamp() });
        return jsonResponse({ ok: true, message: 'تم تسجيل الحضور بنجاح' }, 201);
      }
      if (path === '/api/applications' && method === 'GET') {
        const user = await currentUser(); const profile = user ? await userView(user) : null;
        if (!profile || !['admin', 'president'].includes(profile.role)) return jsonResponse({ error: 'صلاحية رئيس النادي مطلوبة' }, 403);
        return jsonResponse(await rows('applications'));
      }
      if (path === '/api/applications' && method === 'POST') {
        const plans = await rows('subscription_plans');
        const application_no = body.application_no || ('APP-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + Math.random().toString(16).slice(2, 6).toUpperCase());
        const record = { ...body, application_no, status: 'pending', expected_amount: amountFor(body, plans), created_at: firebase.firestore.FieldValue.serverTimestamp() };
        await db.collection('applications').doc(application_no).set(record);
        return jsonResponse({ ok: true, application_no, expected_amount: record.expected_amount }, 201);
      }
      const appMatch = path.match(/^\/api\/applications\/([^/]+)$/);
      if (appMatch && method === 'PATCH') {
        const user = await currentUser(); const profile = user ? await userView(user) : null;
        if (!profile || !['admin', 'president'].includes(profile.role)) return jsonResponse({ error: 'صلاحية رئيس النادي مطلوبة' }, 403);
        await db.collection('applications').doc(appMatch[1]).set({ ...body, reviewed_by: user.uid, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); return jsonResponse({ ok: true });
      }
      if (path === '/api/swimmers' && method === 'POST') { await db.collection('swimmers').add({ membership_no: body.membership_no || 'SDR-' + Date.now().toString(36).toUpperCase(), name: body.name || '', group_name: body.group_name || 'المبتدئون', phone: body.phone || '', status: 'active' }); return jsonResponse({ ok: true }); }
      if (path === '/api/notices' && method === 'POST') { await db.collection('notices').add({ title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان', created_at: firebase.firestore.FieldValue.serverTimestamp() }); return jsonResponse({ ok: true }); }
      return jsonResponse({ error: 'المسار غير موجود' }, 404);
    } catch (error) {
      console.error('Firebase API error', error);
      return jsonResponse({ error: error.message || 'تعذر تنفيذ الطلب' }, error.code && error.code.startsWith('auth/') ? 401 : 400);
    }
  };
})();

