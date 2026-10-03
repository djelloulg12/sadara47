/* Firebase bridge for the Sadara UI. It keeps the UI API-shaped while
   replacing the local Python session/SQLite calls with Auth + Firestore. */
(function () {
  const config = window.SADARA_FIREBASE_CONFIG;
  if (!config || !window.firebase) return;
  firebase.initializeApp(config);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const jsonResponse = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
  const currentUser = () => new Promise(resolve => {
    let stop = () => {};
    stop = auth.onAuthStateChanged(user => { stop(); resolve(user); });
  });
  const userView = async user => {
    if (!user) return null;
    let profile = {};
    try { const snap = await db.collection('users').doc(user.uid).get(); profile = snap.exists ? snap.data() : {}; }
    catch (error) { console.warn('Firestore profile unavailable; using Auth account', error); }
    return {
      id: user.uid,
      name: profile.name || user.displayName || user.email || 'عضو النادي',
      role: profile.role || 'member',
      email: user.email || '',
      phone: profile.phone || user.phoneNumber || '',
      member_no: profile.member_no || '',
      group_name: profile.group_name || ''
    };
  };
  const managerView = async (message) => {
    const user = await currentUser();
    if (!user) return { error: 'يرجى تسجيل الدخول', status: 401 };
    const profile = await userView(user);
    if (!profile || !['admin', 'president'].includes(profile.role)) return { error: message, status: 403 };
    return { profile };
  };
  const rows = async name => (await db.collection(name).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const extrasDoc = () => db.collection('fee_settings').doc('extras');
  const readExtras = async () => {
    try { const snap = await extrasDoc().get(); return snap.exists ? (snap.data() || {}) : {}; }
    catch (_) { return {}; }
  };
  const DEFAULT_PLANS = [
    { code: 'quarter', name: 'اشتراك فصلي', amount: 1000, duration: '3 أشهر' },
    { code: 'season', name: 'اشتراك موسمي', amount: 3000, duration: 'موسم' },
    { code: 'agreement', name: 'ضمن اتفاقية معتمدة', amount: 3000, duration: 'موسم' }
  ];
  const DEFAULT_REQUIREMENTS = [
    { id: 'identity', label: 'نسخة بطاقة التعريف الوطنية', required: true, order: 1 },
    { id: 'cv', label: 'السيرة الذاتية والشهادات التدريبية', required: true, order: 2 },
    { id: 'medical', label: 'شهادة طبية تثبت القدرة على التدريب', required: true, order: 3 },
    { id: 'criminal-record', label: 'صحيفة السوابق العدلية', required: false, order: 4 }
  ];
  const amountFor = (d, plans, extras) => {
    const plan = plans.find(x => x.code === (d.subscription_code || 'quarter'));
    return (Number(plan && plan.amount) || 0)
      + (d.transport ? Number(extras && extras.transport) || 900 : 0)
      + (d.uniform ? Number(extras && extras.uniform) || 2500 : 0);
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
      /* ---------------- session ---------------- */
      if (path === '/api/login' && method === 'POST') {
        const credential = await auth.signInWithEmailAndPassword(body.email, body.password);
        return jsonResponse({ user: await userView(credential.user) });
      }
      if (path === '/api/logout' && method === 'POST') { await auth.signOut(); return jsonResponse({ ok: true }); }
      if (path === '/api/session' && method === 'GET') {
        const user = await currentUser();
        return user ? jsonResponse({ user: await userView(user) }) : jsonResponse({ error: 'يرجى تسجيل الدخول' }, 401);
      }

      /* ---------------- plans & extras ---------------- */
      if (path === '/api/subscriptions' && method === 'GET') {
        const plans = (await rows('subscription_plans')).filter(p => p.active !== false);
        return jsonResponse(plans.length ? plans : DEFAULT_PLANS);
      }
      if (path === '/api/subscription-plans' && method === 'GET') {
        const [plans, extras] = await Promise.all([rows('subscription_plans'), readExtras()]);
        return jsonResponse({
          plans: plans.length ? plans : DEFAULT_PLANS.map((p, i) => ({ id: p.code, active: true, ...p, order: i + 1 })),
          extras: { transport: Number(extras.transport) || 900, uniform: Number(extras.uniform) || 2500 }
        });
      }
      if (path === '/api/subscription-plans' && method === 'PUT') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const plans = Array.isArray(body.plans) ? body.plans.filter(p => p && p.code) : [];
        const extras = body.extras || {};
        const batch = db.batch();
        const existing = await db.collection('subscription_plans').get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        plans.forEach((item, index) => batch.set(db.collection('subscription_plans').doc(item.id || item.code), {
          code: item.code, name: item.name || item.code, amount: Number(item.amount) || 0,
          duration: item.duration || 'موسم', active: item.active !== false, order: index + 1
        }));
        batch.set(extrasDoc(), { transport: Number(extras.transport) || 0, uniform: Number(extras.uniform) || 0, updated_by: gate.profile.id });
        await batch.commit();
        return jsonResponse({ ok: true });
      }

      /* ---------------- coach documents ---------------- */
      if (path === '/api/coach-requirements' && method === 'GET') {
        const saved = await rows('coach_requirements');
        return jsonResponse(saved.length ? saved.sort((a, b) => (a.order || 0) - (b.order || 0)) : DEFAULT_REQUIREMENTS);
      }
      if (path === '/api/coach-requirements' && (method === 'POST' || method === 'PUT')) {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const requirements = Array.isArray(body.requirements) ? body.requirements : [];
        const batch = db.batch();
        const existing = await db.collection('coach_requirements').get();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        requirements.filter(x => x && x.label).forEach((item, index) => batch.set(
          db.collection('coach_requirements').doc(item.id || ('req-' + Date.now() + '-' + index)),
          { label: item.label, required: item.required !== false, order: index + 1 }
        ));
        await batch.commit();
        return jsonResponse({ ok: true });
      }

      /* ---------------- swimmers ---------------- */
      if (path === '/api/swimmers' && method === 'GET') return jsonResponse(await rows('swimmers'));
      if (path === '/api/swimmers' && method === 'POST') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const ref = db.collection('swimmers').doc();
        await ref.set({
          membership_no: body.membership_no || 'SDR-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
          name: body.name || '', group_name: body.group_name || 'المبتدئون',
          phone: body.phone || '', status: body.status === 'نشط' ? 'active' : (body.status || 'active')
        });
        return jsonResponse({ ok: true, id: ref.id }, 201);
      }
      if (path === '/api/swimmers' && method === 'PUT') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف السباح مطلوب' }, 400);
        await db.collection('swimmers').doc(String(body.id)).set({
          name: body.name || '', group_name: body.group_name || 'المبتدئون', phone: body.phone || '',
          status: body.status === 'نشط' ? 'active' : (body.status || 'active')
        }, { merge: true });
        return jsonResponse({ ok: true });
      }
      if (path === '/api/swimmers' && method === 'DELETE') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف السباح مطلوب' }, 400);
        await db.collection('swimmers').doc(String(body.id)).delete();
        return jsonResponse({ ok: true });
      }

      /* ---------------- notices ---------------- */
      if (path === '/api/notices' && method === 'GET') return jsonResponse((await rows('notices')).map(x => ({ ...x, text: x.text || x.body || '', date: x.date || '' })));
      if (path === '/api/notices' && method === 'POST') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        await db.collection('notices').add({
          title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان',
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        return jsonResponse({ ok: true }, 201);
      }
      if (path === '/api/notices' && (method === 'PUT' || method === 'DELETE')) {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف الإعلان مطلوب' }, 400);
        const ref = db.collection('notices').doc(String(body.id));
        if (method === 'DELETE') await ref.delete();
        else await ref.set({ title: body.title || '', body: body.body || '', kind: body.kind || 'إعلان', updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return jsonResponse({ ok: true });
      }

      /* ---------------- schedule ---------------- */
      if (path === '/api/schedule' && method === 'GET') return jsonResponse(await rows('schedules'));
      if (path === '/api/schedule' && (method === 'POST' || method === 'PUT')) {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const payload = {
          day_name: body.day_name || 'السبت', time_range: body.time_range || '',
          group_name: body.group_name || 'المبتدئون', coach: body.coach || '', pool: body.pool || 'مسبح الصدارة'
        };
        if (method === 'PUT' && body.id) await db.collection('schedules').doc(String(body.id)).set(payload, { merge: true });
        else await db.collection('schedules').add(payload);
        return jsonResponse({ ok: true }, method === 'POST' ? 201 : 200);
      }
      if (path === '/api/schedule' && method === 'DELETE') {
        const gate = await managerView('هذه العملية لرئيس النادي فقط');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        if (!body.id) return jsonResponse({ error: 'معرّف الحصة مطلوب' }, 400);
        await db.collection('schedules').doc(String(body.id)).delete();
        return jsonResponse({ ok: true });
      }

      /* ---------------- cards ---------------- */
      if (path === '/api/cards' && method === 'GET') return jsonResponse(await rows('cards'));

      /* ---------------- attendance ---------------- */
      if (path === '/api/attendance' && method === 'GET') return jsonResponse(await rows('attendance'));
      if (path === '/api/attendance' && method === 'POST') {
        const user = await currentUser();
        if (!user) return jsonResponse({ error: 'يرجى تسجيل الدخول قبل تسجيل الحضور' }, 401);
        const profile = await userView(user);
        if (!profile || !['admin', 'president', 'coach'].includes(profile.role))
          return jsonResponse({ error: 'تسجيل الحضور من صلاحية المدرب أو الإدارة فقط' }, 403);
        const memberId = body.member_id || body.swimmer_id || '';
        if (!memberId) return jsonResponse({ error: 'يجب تحديد السباح' }, 400);
        const day = new Date().toISOString().slice(0, 10);
        const status = body.status || 'present';
        await db.collection('attendance').doc('att_' + day + '_' + String(memberId).replace(/[^\w-]/g, '_')).set({
          member_id: memberId, session_date: day, status,
          marked_by: user.uid, marked_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return jsonResponse({ ok: true, message: 'تم تسجيل الحضور بنجاح' }, 201);
      }

      /* ---------------- applications ---------------- */
      if (path === '/api/applications' && method === 'GET') {
        const gate = await managerView('صلاحية رئيس النادي مطلوبة');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        return jsonResponse(await rows('applications'));
      }
      if (path === '/api/applications' && method === 'POST') {
        const [plans, extras] = await Promise.all([rows('subscription_plans'), readExtras()]);
        const list = plans.length ? plans : DEFAULT_PLANS;
        const applicationNo = body.application_no
          || ('APP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(16).slice(2, 6).toUpperCase());
        const record = { ...body, application_no: applicationNo, status: 'pending', expected_amount: amountFor(body, list, extras), created_at: firebase.firestore.FieldValue.serverTimestamp() };
        await db.collection('applications').doc(applicationNo).set(record);
        return jsonResponse({ ok: true, application_no: applicationNo, expected_amount: record.expected_amount }, 201);
      }
      const appMatch = path.match(/^\/api\/applications\/([^/]+)$/);
      if (appMatch && method === 'PATCH') {
        const gate = await managerView('صلاحية رئيس النادي مطلوبة');
        if (gate.error) return jsonResponse({ error: gate.error }, gate.status);
        const patch = { ...body };
        if ('subscription_code' in patch || 'transport' in patch || 'uniform' in patch) {
          const [plans, extras] = await Promise.all([rows('subscription_plans'), readExtras()]);
          patch.expected_amount = amountFor(patch, plans.length ? plans : DEFAULT_PLANS, extras);
        }
        delete patch.id;
        await db.collection('applications').doc(appMatch[1]).set({ ...patch, reviewed_by: gate.profile.id, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return jsonResponse({ ok: true, expected_amount: patch.expected_amount });
      }
      return jsonResponse({ error: 'المسار غير موجود' }, 404);
    } catch (error) {
      console.error('Firebase API error', error);
      const denied = String(error && error.code || '').includes('permission-denied');
      return jsonResponse({ error: denied ? 'ليست لديك صلاحية لهذه العملية' : (error.message || 'تعذر تنفيذ الطلب') }, error.code && String(error.code).startsWith('auth/') ? 401 : (denied ? 403 : 400));
    }
  };
})();