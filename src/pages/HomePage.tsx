import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Bell, Calendar, Gavel, MapPin, Medal, Search, ShieldCheck, Sparkles, Timer, Trophy, Users } from 'lucide-react';
import { useAuth, useData } from '@/context';
import { PageId } from '@/components/Layout';
import logo from '@/assets/logo.png';

const VALUES = [
  { label: 'أخلاق', icon: ShieldCheck },
  { label: 'احترام', icon: Gavel },
  { label: 'انضباط', icon: Sparkles },
];

const TICKER = 'أخلاق • احترام • انضباط';

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const countdownTo = (target: string): Countdown => {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
};

const pad = (n: number) => String(n).padStart(2, '0');

const HomePage: React.FC<{ onNavigate: (page: PageId) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { athletes, plans, records, activities, notifications } = useData();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nextEvent = useMemo(() => {
    const upcoming = activities
      .filter((a) => new Date(a.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] ?? null;
  }, [activities, now]);

  const cdown = nextEvent ? countdownTo(nextEvent.date) : null;
  const unread = notifications.filter((n) => !!user && !n.readBy.includes(user.id)).length;
  const activeCount = athletes.filter((a) => a.membershipStatus === 'نشط').length;

  const swimmingPlans = useMemo(() => plans.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3), [plans]);

  const topRecords = useMemo(() => {
    return [...records]
      .filter((r) => typeof r.numeric === 'number')
      .sort((a, b) => (a.numeric ?? 0) - (b.numeric ?? 0))
      .slice(0, 3);
  }, [records]);

  const athleteName = (id: string) => athletes.find((a) => a.id === id)?.name ?? 'رياضي النادي';
  const athleteCategory = (id: string) => athletes.find((a) => a.id === id)?.category;

  const navLinks: { label: string; page: PageId; active: boolean }[] = [
    { label: 'الواجهة', page: 'home', active: true },
    { label: 'البرامج والمسارات', page: 'programs', active: false },
    { label: 'لوحة الشرف', page: 'hall', active: false },
    { label: 'جدول التمارين', page: 'training', active: false },
  ];

  const statCards = [
    { label: 'رياضي مسجل', value: athletes.length, icon: Users },
    { label: 'انخراط نشط', value: activeCount, icon: Activity },
    { label: 'برنامج تدريب', value: plans.length, icon: Timer },
    { label: 'رقم قياسي', value: records.length, icon: Trophy },
  ];

  return (
    <div className="bg-[#071318] text-[#F8FAFC] rounded-3xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(3,10,14,0.9)] ring-1 ring-[#1B3E48]">
      {/* Top header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#071318]/80 border-b border-[#1B3E48]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={logo} alt="شعار نادي الصدارة" className="w-11 h-11 rounded-full object-cover ring-2 ring-[#0A8696] shadow-[0_0_20px_rgba(10,134,150,0.4)] shrink-0" />
              <div className="leading-tight min-w-0">
                <h1 className="text-xl font-black tracking-tight truncate">نادي الصدارة</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0A8696] truncate">Ghardaia • sadara47</p>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-1 text-sm font-bold">
              {navLinks.map((l) => (
                <button
                  key={l.page}
                  onClick={() => onNavigate(l.page)}
                  className={`px-4 py-2 rounded-full transition-all ${
                    l.label === 'الواجهة' ? 'bg-[#0A8696] text-white shadow-[0_0_20px_rgba(10,134,150,0.45)]' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <label className="hidden md:flex items-center gap-2 bg-[#0F2229] border border-[#1B3E48] rounded-full px-4 py-2 text-sm">
                <Search size={15} className="text-white/40" />
                <input
                  placeholder="ابحث عن سباح أو برنامج..."
                  className="bg-transparent outline-none text-sm w-40 placeholder:text-white/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onNavigate('athletes');
                  }}
                />
              </label>
              <button
                onClick={() => onNavigate('activities')}
                className="relative w-10 h-10 rounded-full bg-[#0F2229] border border-[#1B3E48] flex items-center justify-center text-white/70 hover:text-white transition-all"
                title="إشعارات النادي"
              >
                <Bell size={17} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.9)] pulse-red" />
                )}
              </button>
              <button
                onClick={() => onNavigate(user?.role === 'ATHLETE' || user?.role === 'GUARDIAN' ? 'profile' : 'dashboard')}
                className="hidden sm:flex items-center gap-2 bg-[#0A8696] hover:bg-[#0B96A8] text-white font-black text-sm px-5 py-2.5 rounded-full transition-all shadow-[0_0_25px_rgba(10,134,150,0.5)]"
              >
                <span>دخول المنصة</span>
                <ArrowLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#0A8696]/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#0F766E]/15 blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-72 h-72 rounded-full bg-[#F59E0B]/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-5 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 bg-[#0F2229] border border-[#1B3E48] rounded-full px-4 py-1.5 text-xs font-bold text-[#0A8696]">
              <span className="w-2 h-2 rounded-full bg-[#0A8696] pulse-red" />
              موسم {new Date().getFullYear()} — التسجيلات مفتوحة
            </div>
            <h2 className="text-4xl lg:text-5xl font-black leading-[1.15] tracking-tight">
              نادي الصدارة الرياضي
              <span className="block text-transparent bg-clip-text bg-gradient-to-l from-[#0A8696] via-[#2DD4BF] to-[#F59E0B]"> للسباحة 47</span>
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-lg">
              تدريب نوعي بإشراف مدربين معتمدين، أخلاق رفيعة، وأرقام تتنافس على منصات التتويج المحلية والوطنية.
              الانضباط هنا صناعة أبطال.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {VALUES.map((v) => (
                <span key={v.label} className="flex items-center gap-2 bg-[#0F2229] border border-[#1B3E48] rounded-full px-4 py-2 text-sm font-bold text-white/85">
                  <v.icon size={16} className="text-[#2DD4BF]" />
                  {v.label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('hall')}
                className="inline-flex items-center gap-2 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#071318] font-black px-7 py-3.5 rounded-2xl transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)]"
              >
                <Trophy size={18} />
                اكتشف لوحة الشرف
              </button>
              <button
                onClick={() => onNavigate('activities')}
                className="inline-flex items-center gap-2 border border-[#1B3E48] text-white hover:bg-white/5 font-bold px-7 py-3.5 rounded-2xl transition-all"
              >
                <Calendar size={18} className="text-[#0A8696]" />
                تأكيد المشاركة في النشاط
              </button>
            </div>
          </div>

          {/* Countdown */}
          <div className="space-y-5">
            <div className="bg-[#0F2229]/80 backdrop-blur border border-[#1B3E48] rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] font-black text-[#0A8696] uppercase tracking-widest">الفعالية القادمة</p>
                  <h3 className="font-black text-lg mt-1">{nextEvent?.title ?? 'لا توجد فعالية مجدولة'}</h3>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#EF4444]">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] pulse-red" />
                  مباشر
                </span>
              </div>
              {cdown ? (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { v: cdown.days, l: 'يوم' },
                    { v: cdown.hours, l: 'ساعة' },
                    { v: cdown.minutes, l: 'دقيقة' },
                    { v: cdown.seconds, l: 'ثانية' },
                  ].map((u) => (
                    <div key={u.l} className="bg-[#071318] border border-[#1B3E48] rounded-2xl py-4 text-center">
                      <p className="text-3xl font-black text-[#2DD4BF] tabular-nums" dir="ltr">{pad(u.v)}</p>
                      <p className="text-[10px] font-bold text-white/50 mt-1">{u.l}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/50 text-sm py-6 text-center">ننتظر تسجيل فعالية جديدة قريباً.</p>
              )}
              <div className="flex items-center gap-2 mt-4 text-xs text-white/50">
                <MapPin size={13} className="text-[#0A8696]" />
                <span>{nextEvent?.location ?? 'قاعة المسبح البلدي — غرداية'}</span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-3">
              {statCards.map((s) => (
                <div key={s.label} className="bg-[#0F2229] border border-[#1B3E48] rounded-2xl p-4 text-center">
                  <s.icon size={17} className="mx-auto mb-2 text-[#0A8696]" />
                  <p className="text-2xl font-black tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-white/50 mt-1 font-bold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pool schedule preview */}
      <section className="border-t border-[#1B3E48] bg-[#0A1014]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] font-black text-[#0A8696] uppercase tracking-widest mb-2">جدول التدريب الأسبوعي</p>
              <h3 className="text-2xl font-black">برنامج السباحة والمسارات</h3>
            </div>
            <button
              onClick={() => onNavigate('programs')}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#2DD4BF] hover:text-[#0A8696] transition-colors"
            >
              عرض الكل
              <ArrowLeft size={16} />
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {swimmingPlans.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onNavigate('training')}
                className="text-right group bg-[#0F2229] border border-[#1B3E48] rounded-2xl p-5 hover:border-[#0A8696] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="w-10 h-10 rounded-xl bg-[#0A8696]/10 text-[#2DD4BF] flex items-center justify-center font-black">{i + 1}</span>
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold ${i === 0 ? 'text-[#EF4444]' : 'text-[#0A8696]'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current pulse-red" />
                    {i === 0 ? 'حصص مباشرة' : 'مفتوح'}
                  </span>
                </div>
                <h4 className="font-black group-hover:text-[#2DD4BF] transition-colors">{p.title}</h4>
                <p className="text-white/50 text-xs mt-2 line-clamp-2">{p.description}</p>
                <div className="flex items-center gap-3 mt-4 text-[11px] text-white/50 font-bold">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-[#0A8696]" />
                    {p.schedule}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-[#0A8696]" />
                    {p.location}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Hall of fame preview */}
      <section className="border-t border-[#1B3E48]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14">
          <p className="text-[11px] font-black text-[#0A8696] uppercase tracking-widest mb-2">أسرع الأزمنة المسجلة</p>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <h3 className="text-2xl font-black">لوحة الشرف</h3>
            <button
              onClick={() => onNavigate('hall')}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#2DD4BF] hover:text-[#0A8696] transition-colors"
            >
              القائمة الكاملة
              <ArrowLeft size={16} />
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {topRecords.map((r, i) => (
              <div key={r.id} className={`relative bg-[#0F2229] border rounded-2xl p-5 overflow-hidden ${i === 0 ? 'border-[#F59E0B] shadow-[0_0_40px_-10px_rgba(245,158,11,0.4)]' : 'border-[#1B3E48]'}`}>
                <div className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center ${i === 0 ? 'bg-[#F59E0B] text-[#071318]' : i === 1 ? 'bg-slate-300 text-slate-900' : 'bg-amber-700 text-white'}`}>
                  <Medal size={16} />
                </div>
                <p className="text-3xl font-black tabular-nums mt-2">{r.value}</p>
                <p className="text-white/60 text-sm mt-1 font-bold">{r.discipline}</p>
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#1B3E48] text-xs">
                  <div>
                    <p className="font-black">{athleteName(r.athleteId)}</p>
                    <p className="text-white/40 mt-0.5">{athleteCategory(r.athleteId) ?? '—'}</p>
                  </div>
                  <p className="text-[#0A8696] font-bold">سجل {new Date(r.date).getFullYear()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values ticker */}
      <footer className="border-t border-[#1B3E48] bg-[#0A1014] py-6 text-center">
        <p className="text-sm font-black tracking-[0.35em] text-[#F59E0B]">{TICKER}</p>
        <p className="text-[11px] text-white/35 mt-2 font-bold">نادي الصدارة الرياضي للسباحة 47 — غرداية © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default HomePage;