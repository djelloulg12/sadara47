/* ==========================================================
   الصفحة العامة: بيانات عامة حقيقية + إصلاحات العرض
   ========================================================== */

/* أرقام صادقة: عدد المنخرطين بيانات خاصة، فلا تُعرض للزائر.
   ما يمكن عرضه علنًا هو الاشتراكات والبرنامج والإعلانات. */
function publicStats(){
  const stats = [
    { icon: '▣', value: (state.subscriptions || []).length || '—', label: 'اشتراك متاح' },
    { icon: '▦', value: (state.schedules || []).length || '—', label: 'حصة أسبوعية' },
    { icon: '◈', value: (state.notices || []).length || '—', label: 'إعلان من النادي' }
  ];
  if (state.user) stats.unshift({ icon: '♙', value: (state.swimmers || []).length || '—', label: 'سباح مسجَّل' });
  return stats;
}

/* ما يراه الزائر قبل الدخول: الأسعار والبرنامج والإعلانات.
   تُقرأ في الذاكرة فقط حتى لا تُقدَّم بيانات قديمة في الزيارات التالية. */
const PUBLIC_FEEDS = [
  { path: '/api/subscription-plans', key: 'subscriptions', pick: d => (d && d.plans ? d.plans : []).filter(p => p.active !== false && p.active !== 0) },
  { path: '/api/schedule', key: 'schedules', pick: d => (Array.isArray(d) ? d : (d && d.schedules) || []) },
  { path: '/api/notices', key: 'notices', pick: d => (Array.isArray(d) ? d : (d && d.notices) || []) }
];
async function loadPublicData(){
  if (state.user) return;
  await Promise.all(PUBLIC_FEEDS.map(async feed => {
    try {
      const res = await fetch(feed.path, { credentials: 'same-origin' });
      if (!res.ok) return;
      const rows = feed.pick(await res.json());
      if (Array.isArray(rows)) state[feed.key] = rows;
    } catch (_) { /* the public page still renders without it */ }
  }));
  if (!state.user) render();
}