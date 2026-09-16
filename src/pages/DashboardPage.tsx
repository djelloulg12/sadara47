import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Droplets,
  HeartPulse,
  MapPin,
  Medal,
  Printer,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  Waves,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/StatCard';
import { useAuth, useData } from '@/context';
import { Sport, UserRole } from '@/types';
import { ROLES_LABEL, WEEK_DAYS } from '@/constants';
import { formatDateShort } from '@/utils/helpers';
import { generateTrainingTip } from '@/services/gemini';
import { PageId } from '@/components/Layout';

const CLUB_TREND = [
  { name: 'أكتوبر', score: 72 },
  { name: 'نوفمبر', score: 75 },
  { name: 'ديسمبر', score: 82 },
  { name: 'جانفي', score: 86 },
  { name: 'فيفري', score: 91 },
  { name: 'مارس', score: 94 },
];

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const todayName = () => DAY_NAMES[new Date().getDay()];

const nextDays = (from: string) => {
  const i = WEEK_DAYS.indexOf(from as (typeof WEEK_DAYS)[number]);
  const start = i >= 0 ? i : 0;
  return Array.from({ length: WEEK_DAYS.length }, (_, k) => WEEK_DAYS[(start + k) % WEEK_DAYS.length]);
};

const AVATAR_COLORS = [
  'from-sky-500 to-blue-700',
  'from-cyan-500 to-sky-700',
  'from-blue-600 to-indigo-800',
  'from-teal-500 to-cyan-700',
  'from-indigo-500 to-blue-800',
];

const DashboardPage: React.FC<{ onNavigate: (page: PageId) => void }> = ({ onNavigate }) => {
  const { user, users } = useAuth();
  const {
    athletes,
    applications,
    activities,
    records,
    notifications,
    markNotificationRead,
    attendance,
    plans,
    groups,
    sessions,
    disciplinary,
  } = useData();

  const isPresident = user?.role === UserRole.PRESIDENT;
  const isManager = user?.role === UserRole.MANAGER;
  const isCoach = user?.role === UserRole.COACH;
  const isAthlete = user?.role === UserRole.ATHLETE;
  const isGuardian = user?.role === UserRole.GUARDIAN;
  const isStaff = isPresident || isManager || isCoach;

  /* ------------------------- تحديد الأبناء تحت الوصاية ------------------------- */
  const wards = useMemo(() => {
    if (!isGuardian || !user) return [];
    const direct = athletes.filter((a) => a.guardianUserId === user.id);
    if (direct.length > 0) return direct;
    // ملاحظة: الرابط الاسمي كملاذ احتياطي للتجربة
    const byName = athletes.filter((a) => a.guardianName && user.name.includes(a.guardianName.split(' ')[0]));
    return byName.slice(0, 3);
  }, [isGuardian, user, athletes]);

  const [wardIndex, setWardIndex] = useState(0);
  const selectedWard = isGuardian ? wards[Math.min(wardIndex, Math.max(wards.length - 1, 0))] : undefined;

  /* ------------------------- المستهدف (ولي: الابن المختار / رياضي: نفسه) ------------------------- */
  const targetAthlete = useMemo(() => {
    if (isGuardian) return selectedWard;
    if (isAthlete && user?.athleteId) return athletes.find((a) => a.id === user.athleteId);
    return null;
  }, [isGuardian, isAthlete, user, athletes, selectedWard]);

  const athleteGroups = useMemo(
    () => (targetAthlete ? groups.filter((g) => g.memberIds.includes(targetAthlete.id)) : []),
    [targetAthlete, groups],
  );

  const coachName = (id?: string) => users.find((u) => u.id === id)?.name ?? '';

  const athleteSessions = useMemo(() => {
    if (athleteGroups.length === 0) return [];
    const gids = athleteGroups.map((g) => g.id);
    return sessions.filter((s) => s.status === 'approved' && s.groupIds.some((g) => gids.includes(g)));
  }, [athleteGroups, sessions]);

  const nextSessions = useMemo(() => {
    const ordered = nextDays(todayName());
    return [...athleteSessions]
      .sort((a, b) => ordered.indexOf(a.day) - ordered.indexOf(b.day) || a.start.localeCompare(b.start))
      .filter((s) => ordered.indexOf(s.day) >= 0)
      .slice(0, 2);
  }, [athleteSessions]);

  const hasTodaySession = useMemo(
    () => athleteSessions.some((s) => s.day === (todayName() as (typeof WEEK_DAYS)[number])),
    [athleteSessions],
  );

  /* ------------------------- إحصائيات الالتزام (شهر جارٍ) ------------------------- */
  const monthAttendance = useMemo(() => {
    if (!targetAthlete) return { total: 0, present: 0, pct: 0 };
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const list = attendance.filter(
      (r) => r.athleteId === targetAthlete.id && r.date.startsWith(month),
    );
    const present = list.filter((r) => r.present).length;
    return { total: list.length, present, pct: list.length ? Math.round((present / list.length) * 100) : 0 };
  }, [targetAthlete, attendance]);

  const wardDiscipline = useMemo(
    () => (targetAthlete ? disciplinary.filter((d) => d.targetId === targetAthlete.id) : []),
    [targetAthlete, disciplinary],
  );

  const wardAbsences = useMemo(
    () =>
      targetAthlete
        ? attendance.filter((r) => r.athleteId === targetAthlete.id && !r.present).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
        : [],
    [targetAthlete, attendance],
  );

  /* ------------------------- البيانات العامة ------------------------- */
  const myNotifications = useMemo(() => {
    if (!user) return [];
    return notifications
      .filter((n) => {
        if (isStaff) return n.toUserIds.length === 0 || n.toUserIds.includes(user.id);
        return n.athleteId === targetAthlete?.id || n.toUserIds.includes(user.id) || (n.type === 'competition' || n.type === 'general');
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [notifications, user, isStaff, targetAthlete]);

  const unreadCount = myNotifications.filter((n) => !n.readBy.includes(user?.id || '')).length;

  const todayAtt = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return attendance.filter((r) => r.date === todayStr).slice(0, 6);
  }, [attendance]);

  const myRecords = useMemo(
    () => (targetAthlete ? records.filter((r) => r.athleteId === targetAthlete.id) : []).sort((a, b) => a.date.localeCompare(b.date)),
    [records, targetAthlete],
  );

  const pendingApps = applications.filter((a) => a.status === 'pending').length;
  const activeAthletes = athletes.filter((a) => a.membershipStatus === 'نشط').length;
  const upcomingEvents = activities.filter((a) => a.status === 'ريان').length;

  const chartData = targetAthlete ? myRecords.map((r) => ({ name: formatDateShort(r.date), value: r.numeric ?? 0 })) : CLUB_TREND;

  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runAI = async () => {
    setAnalyzing(true);
    try {
      const tip = await generateTrainingTip(targetAthlete?.sport ?? Sport.SWIMMING);
      setAiAdvice(tip);
    } catch {
      setAiAdvice('تعذر الوصول إلى الذكاء الاصطناعي في الوقت الحالي.');
    } finally {
      setAnalyzing(false);
    }
  };

  const initials = (a?: { name: string; lastName: string }) => (a ? `${a.name.charAt(0)}${a.lastName.charAt(0)}` : '؟');
  const avatarClass = (i: number) => AVATAR_COLORS[i % AVATAR_COLORS.length];

  const isVerified = (a?: { medicalClearance: boolean }) => !!a?.medicalClearance;

  const passRing: React.CSSProperties = {
    background: `conic-gradient(#10B981 ${monthAttendance.pct}%, #1E293B 0)`,
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <span className="px-3 py-1 bg-[#1E3A8A]/10 text-[#1E3A8A] text-[10px] font-black rounded-full border border-[#1E3A8A]/20 uppercase tracking-widest inline-block">
            {user ? ROLES_LABEL[user.role] : ''}
            {isAthlete ? ' — بوابة الرياضي' : isPresident ? ' — منصة الرئيس' : isManager ? ' — منصة المسير' : isCoach ? ' — منصة المدرب' : isGuardian ? ' — لوحة الولي' : ''}
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-[#0F172A]">
            {isGuardian ? 'لوحة أولادي' : isAthlete ? 'بطاقتي الرياضية' : 'مؤشرات النادي'}{' '}
            <span className="text-[#0284C7]">{isGuardian || isAthlete ? 'والتزامي' : 'الإدارية'}</span>
          </h2>
          <p className="text-gray-400 font-bold flex items-center gap-2">
            <MapPin size={16} className="text-[#38BDF8]" /> مجمع السباحة الأولمبي - ولاية غرداية
          </p>
        </div>
        <div className="px-8 py-4 bg-[#0F172A] text-white rounded-2xl flex items-center gap-3 shadow-xl border-b-4 border-[#38BDF8]">
          <Droplets size={22} className="text-[#38BDF8]" />
          <span className="text-sm font-black uppercase tracking-widest">الموسم الذهبي 2026</span>
        </div>
      </header>

      {/* ====================== لوحة الولي / الرياضي (الألوان المائية) ====================== */}
      {(isGuardian || isAthlete) && (
        <>
          {/* شريط تبديل الأبناء (خاص بالولي) */}
          {isGuardian && (
            <div className="bg-white/70 backdrop-blur-xl border border-[#38BDF8]/20 rounded-2xl shadow-lg p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2.5 bg-[#1E3A8A]/10 text-[#1E3A8A] rounded-xl">
                  <Users size={22} />
                </span>
                <div>
                  <h3 className="font-black text-[#0F172A] text-lg">الأبناء تحت الوصاية</h3>
                  <p className="text-xs text-slate-500">اضغط على أي ابن لمتابعة جدوله وتقاريره فوراً</p>
                </div>
              </div>

              {wards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 font-bold">
                  لا يوجد أبناء مرتبطون بحسابك بعد. يُربط كل ابن بحساب وليّه عبر رقم التعريف الوطني أثناء التسجيل.
                </div>
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1">
                  {wards.map((w, idx) => {
                    const myGroups = groups.filter((g) => g.memberIds.includes(w.id));
                    const dayName = todayName() as (typeof WEEK_DAYS)[number];
                    const active = sessions.some(
                      (s) => s.status === 'approved' && s.day === dayName && s.groupIds.some((g) => myGroups.some((mg) => mg.id === g)),
                    );
                    const isCurrent = idx === wardIndex;
                    return (
                      <button
                        key={w.id}
                        onClick={() => setWardIndex(idx)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                          isCurrent
                            ? 'bg-[#1E3A8A] border-2 border-[#38BDF8] text-white shadow-lg'
                            : 'bg-white border-2 border-slate-200 hover:border-[#38BDF8] opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="relative">
                          {w.photoUrl ? (
                            <img src={w.photoUrl} alt={w.name} className="w-10 h-10 rounded-full object-cover border-2 border-white" />
                          ) : (
                            <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarClass(idx)} text-white flex items-center justify-center text-sm font-black`}>
                              {initials(w)}
                            </span>
                          )}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} title={active ? 'توجد حصة اليوم' : 'لا حصة اليوم'} />
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold">{w.name}</p>
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-bold ${isCurrent ? 'bg-[#38BDF8]/20 text-[#BAE6FD]' : 'bg-[#0284C7]/10 text-[#0284C7]'}`}>
                            {myGroups[0]?.name || w.category}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {targetAthlete && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* بطاقة المنخرط الرقمية */}
              <div
                className="bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#0F172A] text-white p-6 rounded-2xl shadow-xl relative overflow-hidden lg:col-span-1"
              >
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#38BDF8]/10 rounded-full blur-2xl" />
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#0284C7]/20 rounded-full blur-2xl" />

                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {targetAthlete.photoUrl ? (
                        <img src={targetAthlete.photoUrl} alt={targetAthlete.name} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#38BDF8]" />
                      ) : (
                        <span className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarClass(0)} flex items-center justify-center text-xl font-black ring-2 ring-[#38BDF8]`}>
                          {initials(targetAthlete)}
                        </span>
                      )}
                      {isVerified(targetAthlete) && (
                        <span className="absolute -bottom-1 -left-1 bg-[#10B981] text-white rounded-full p-1 border-2 border-[#0F172A]">
                          <CheckCircle2 size={12} />
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] tracking-wider uppercase text-[#38BDF8] font-semibold">بطاقة منخرط</span>
                      <h3 className="text-lg font-black mt-0.5">{targetAthlete.name} {targetAthlete.lastName}</h3>
                      <p className="text-xs text-slate-300">
                        رقم القيد: <span className="font-mono text-[#38BDF8]">{targetAthlete.registrationNumber}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 my-6 pt-4 border-t border-white/10 text-center relative z-10">
                  <div className="bg-white/5 backdrop-blur-sm p-2 rounded-xl">
                    <p className="text-[10px] text-slate-400">الفئة</p>
                    <p className="text-xs font-black">{targetAthlete.category}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm p-2 rounded-xl">
                    <p className="text-[10px] text-slate-400">الفصيلة</p>
                    <p className="text-xs font-black text-[#38BDF8] font-mono" dir="ltr">{targetAthlete.bloodType}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-sm p-2 rounded-xl">
                    <p className="text-[10px] text-slate-400">حضور الشهر</p>
                    <p className="text-xs font-black text-[#10B981]">{monthAttendance.pct}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 relative z-10">
                  <span className="font-bold">نادي الصدارة الرياضي</span>
                  <span className="inline-flex items-center gap-1.5 text-[#10B981] font-bold">
                    {isVerified(targetAthlete) ? (
                      <>
                        <ShieldCheck size={13} /> ملف مصادق عليه
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={13} className="text-amber-400" /> ملف قيد الاستكمال
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* الالتزام الدائري + نظرة الولي */}
              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-lg lg:col-span-1 flex flex-col items-center justify-center text-center">
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={passRing}
                >
                  <div className="w-24 h-24 rounded-full bg-[#0F172A] flex flex-col items-center justify-center text-white">
                    <p className="text-2xl font-black text-[#10B981]">{monthAttendance.pct}%</p>
                    <p className="text-[9px] text-white/50 font-bold uppercase">التزام</p>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-4">الحضور التراكمي في الشهر الجاري</p>
                <p className="text-sm font-black text-[#0F172A] mt-1">
                  {monthAttendance.present} / {monthAttendance.total} حصة منجزة
                </p>
                <div className="flex gap-2 mt-4 flex-wrap justify-center">
                  <button
                    onClick={() => onNavigate('schedule')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#0284C7] bg-[#0284C7]/10 rounded-full px-4 py-2 hover:bg-[#0284C7] hover:text-white transition-all"
                  >
                    <CalendarDays size={13} /> برنامجي الأسبوعي
                  </button>
                  <button
                    onClick={() => onNavigate('profile')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#0F172A] bg-[#0F172A]/5 rounded-full px-4 py-2 hover:bg-[#0F172A] hover:text-white transition-all"
                  >
                    <UserCheck size={13} /> ملفي الكامل
                  </button>
                </div>
              </div>

              {/* الحصة القادمة والمدربون */}
              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-lg lg:col-span-1 flex flex-col">
                <div>
                  <p className="text-[11px] font-black text-[#0284C7] uppercase tracking-wide">الحصة القادمة المبرمجة</p>
                  {nextSessions.length === 0 ? (
                    <p className="text-sm text-slate-400 font-bold mt-3">لا حصص معتمدة لفوج هذا الابن حالياً.</p>
                  ) : (
                    <>
                      <h4 className="font-black text-[#0F172A] mt-1.5">
                        {nextSessions[0].focus || 'حصة تدريبية'}
                      </h4>
                      <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-black bg-[#F59E0B]/15 text-[#B45309] border border-[#F59E0B]/30 rounded-full px-3 py-1">
                        <Clock size={12} />
                        {nextSessions[0].day} — {nextSessions[0].start}
                      </span>
                    </>
                  )}
                </div>

                {athleteGroups[0] && (
                  <div className="mt-4 space-y-2">
                    {athleteGroups[0].headCoachId && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-xl">
                        <span className="w-9 h-9 rounded-lg bg-[#0284C7] text-white flex items-center justify-center font-bold text-xs">
                          {coachName(athleteGroups[0].headCoachId).charAt(0) || 'ك'}
                        </span>
                        <div>
                          <p className="text-[10px] text-slate-500">المدرب الرئيسي</p>
                          <p className="text-xs font-black text-[#0F172A]">{coachName(athleteGroups[0].headCoachId) || 'طاقم النادي'}</p>
                        </div>
                      </div>
                    )}
                    {athleteGroups[0].assistantCoachId && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-xl">
                        <span className="w-9 h-9 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs">
                          {coachName(athleteGroups[0].assistantCoachId).charAt(0) || 'ك'}
                        </span>
                        <div>
                          <p className="text-[10px] text-slate-500">المدرب المساعد</p>
                          <p className="text-xs font-black text-[#0F172A]">{coachName(athleteGroups[0].assistantCoachId) || 'طاقم النادي'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 mt-auto border-t border-slate-200 text-xs text-slate-500">
                  <span className="font-bold">
                    المسبح: <strong className="text-[#0F172A]">{nextSessions[0]?.pool || '—'}</strong>
                  </span>
                  <button onClick={() => onNavigate('schedule')} className="text-[#0284C7] font-black hover:underline flex items-center gap-1">
                    كامل البرنامج <ArrowLeft size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ملخص الولي السريع: إشعار + غيابات + انضباط الابن المختار */}
          {isGuardian && targetAthlete && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => onNavigate('schedule')}
                className="group bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-lg flex items-center justify-between hover:scale-[1.01] transition-all duration-200 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center"><CalendarDays size={21} /></span>
                  <div className="text-right">
                    <p className="font-black text-[#0F172A] text-sm">{athleteGroups[0]?.name || 'فوج الابن'}</p>
                    <p className="text-[11px] text-slate-400 font-bold">{targetAthlete.category} • {athleteGroups[0]?.memberIds.length || 0} منخرط</p>
                  </div>
                </div>
                <ArrowLeft size={16} className="text-slate-300 group-hover:text-[#0284C7] group-hover:-translate-x-0.5 transition-all" />
              </button>

              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center"><UserCheck size={21} /></span>
                  <div>
                    <p className="font-black text-[#0F172A] text-sm">{monthAttendance.total} حصة</p>
                    <p className="text-[11px] text-slate-400 font-bold">مخطط لها خلال الشهر</p>
                  </div>
                </div>
                <span className="text-[11px] font-black text-[#10B981]">{monthAttendance.pct}%</span>
              </div>

              <button
                onClick={() => onNavigate('schedule')}
                className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-lg flex items-center justify-between hover:scale-[1.01] transition-all duration-200 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center"><AlertTriangle size={21} /></span>
                  <div>
                    <p className="font-black text-[#0F172A] text-sm">{wardDiscipline.length + wardAbsences.length} تنبيه</p>
                    <p className="text-[11px] text-slate-400 font-bold">غيابات وتقارير سلوكية للابن</p>
                  </div>
                </div>
                <ArrowLeft size={16} className="text-slate-300" />
              </button>
            </div>
          )}

          {/* سجل الابن المختار: غيابات حديثة + تقارير انضباط */}
          {isGuardian && targetAthlete && (wardAbsences.length > 0 || wardDiscipline.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-lg">
                <h3 className="font-black text-[#0F172A] flex items-center gap-2 mb-4">
                  <UserX size={18} className="text-[#EF4444]" /> غيابات {targetAthlete.name}
                </h3>
                {wardAbsences.length === 0 && <p className="text-xs text-slate-400 font-bold">لا غيابات مسجلة — التزام ممتاز.</p>}
                <div className="space-y-2">
                  {wardAbsences.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50/60 border border-red-100">
                      <div>
                        <p className="text-xs font-black text-[#0F172A]">غياب {r.note ? 'مبرر: ' + r.note : 'غير مبرر'}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatDateShort(r.date)} • {plans.find((p) => p.id === r.planId)?.title || 'حصة تدريب'}</p>
                      </div>
                      <span className="text-[10px] font-black text-red-600 bg-white px-3 py-1 rounded-full">غياب</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-lg">
                <h3 className="font-black text-[#0F172A] flex items-center gap-2 mb-4">
                  <ShieldCheck size={18} className="text-[#F59E0B]" /> تقارير سلوكية وتوجيهات
                </h3>
                {wardDiscipline.length === 0 && <p className="text-xs text-slate-400 font-bold">لا توجد تقارير سلوكية مسجلة.</p>}
                <div className="space-y-2">
                  {wardDiscipline.map((d) => (
                    <div key={d.id} className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                      <p className="text-[11px] font-black text-[#0F172A]">{d.reason}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatDateShort(d.date)} • {d.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ====================== بطاقات المؤشرات ====================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard
          label={targetAthlete ? 'فئتي العمرية' : 'الرياضيين المسجلين'}
          value={targetAthlete ? (targetAthlete.category || '—') : String(athletes.length)}
          icon={Users}
          color="#0284C7"
          onOpen={targetAthlete ? () => onNavigate('profile') : undefined}
        />
        <StatCard
          label={targetAthlete ? 'نسبة التقدم' : 'الأعضاء النشطون'}
          value={targetAthlete ? `${targetAthlete.progress ?? 0}%` : String(activeAthletes)}
          icon={Activity}
          color="#0F172A"
        />
        <StatCard
          label={targetAthlete ? 'أرقامي المسجلة' : 'طلبات الإخراط'}
          value={targetAthlete ? String(myRecords.length) : String(pendingApps)}
          icon={targetAthlete ? Medal : Users}
          color="#10B981"
          onOpen={isPresident || isManager ? () => onNavigate('applications') : undefined}
        />
        <StatCard
          label="الفعاليات القادمة"
          value={String(upcomingEvents)}
          icon={CalendarDays}
          color="#0F172A"
          onOpen={() => onNavigate('activities')}
        />
      </div>

      {/* ====================== منحنى الأداء + الذكاء ====================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm border-t-8 border-t-[#0284C7]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-[#0F172A] flex items-center gap-3">
                <TrendingUp className="text-[#0284C7]" size={24} />
                {targetAthlete ? 'منحنى أرقامي الشخصية' : 'مؤشر أداء النادي العام'}
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                {targetAthlete ? `بناءً على أرقام ${targetAthlete.name} المسجلة` : 'بناءً على نتائج الاختبارات الدورية هذا الموسم'}
              </p>
            </div>
          </div>
          <div className="h-[300px] w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284C7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0284C7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000005" vertical={false} />
                <XAxis dataKey="name" stroke="#E2E8F0" axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                <YAxis stroke="#E2E8F0" axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Tooltip />
                <Area type="monotone" dataKey={targetAthlete ? 'value' : 'score'} stroke="#0284C7" strokeWidth={4} fill="url(#colorPerf)" name={targetAthlete ? 'الرقم' : 'المؤشر'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0F172A] p-8 rounded-2xl relative overflow-hidden shadow-2xl border-b-[10px] border-b-[#38BDF8] flex flex-col justify-between group">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#38BDF8]/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-[#38BDF8] mb-6">
              <Sparkles size={22} className="animate-pulse" />
              <span className="font-black uppercase tracking-[0.2em] text-[10px]">Sadara Intelligence AI</span>
            </div>
            <h3 className="text-2xl font-black text-white mb-5 leading-tight">
              {targetAthlete ? 'نصائح لكسر' : 'رؤية النادي'} <span className="text-[#38BDF8]">{targetAthlete ? 'أرقامك؟' : 'الاستراتيجية'}</span>
            </h3>
            <div className="space-y-5 text-white/70 text-sm leading-relaxed italic">
              {aiAdvice ? (
                <p className="border-r-2 border-[#38BDF8]/40 pr-4 not-italic">{aiAdvice}</p>
              ) : (
                <p className="border-r-2 border-[#38BDF8]/40 pr-4">
                  {targetAthlete
                    ? 'اضغط على الزر أدناه للحصول على توصيات تدريبية مخصصة حسب تخصصك الرياضي.'
                    : 'اضغط على الزر أدناه لتوليد توصية استراتيجية موسمية مخصصة لأقسام النادي.'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={runAI}
            disabled={analyzing}
            className="w-full py-4 bg-[#38BDF8] hover:bg-[#0284C7] text-[#0F172A] font-black rounded-xl shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all mt-6 relative z-10 disabled:opacity-50"
          >
            {analyzing ? 'جاري التحليل...' : 'توليد توصية ذكية'}
          </button>
        </div>
      </div>

      {!isAthlete && !isGuardian && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-[#0F172A] flex items-center gap-3 mb-6">
              <CalendarDays className="text-[#38BDF8]" size={22} /> أقرب الفعاليات
            </h3>
            <div className="space-y-4">
              {activities.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onNavigate('activities')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#0284C7]/5 rounded-2xl group transition-all text-right"
                >
                  <div>
                    <p className="font-black text-[#0F172A] text-sm">{ev.title}</p>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5">{formatDateShort(ev.date)} • {ev.location}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black ${ev.status === 'ريان' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ev.status}
                  </span>
                </button>
              ))}
              {activities.length === 0 && <p className="text-sm text-gray-400">لا توجد فعاليات مسجلة.</p>}
            </div>
          </div>
          <div className="flex-1 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-[#0F172A] flex items-center gap-3 mb-6">
              <Clock className="text-[#0284C7]" size={22} /> نظرة سريعة
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-[#38BDF8]/8 rounded-2xl border border-[#38BDF8]/15">
                <p className="font-black text-[#0F172A] text-sm">طلبات إخراط معلقة: {pendingApps}</p>
                <button onClick={() => onNavigate('applications')} className="text-[11px] font-bold text-[#0284C7] mt-1.5 hover:underline">
                  مراجعة الطلبات ←
                </button>
              </div>
              <div className="p-4 bg-[#0284C7]/5 rounded-2xl border border-[#0284C7]/10">
                <p className="font-black text-[#0F172A] text-sm">رياضيون باشتراك نشط: {activeAthletes}</p>
                <button onClick={() => onNavigate('athletes')} className="text-[11px] font-bold text-[#0284C7] mt-1.5 hover:underline">
                  فتح قائمة الرياضيين ←
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================== الإشعارات ====================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
              <Bell className="text-[#38BDF8]" size={20} /> الإشعارات
              {unreadCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-[#EF4444] text-white text-[10px] font-black">{unreadCount} جديد</span>
              )}
            </h3>
          </div>
          {myNotifications.length === 0 && <p className="text-sm text-gray-400">لا توجد إشعارات بعد.</p>}
          <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
            {myNotifications.slice(0, 12).map((n) => {
              const isRead = n.readBy.includes(user?.id || '');
              const typeBadge: Record<string, string> = {
                absence: 'bg-amber-100 text-amber-700',
                health: 'bg-red-100 text-red-700',
                disciplinary: 'bg-red-100 text-red-700',
                competition: 'bg-blue-100 text-blue-700',
                registration: 'bg-green-100 text-green-700',
                general: 'bg-gray-100 text-gray-600',
              };
              return (
                <button
                  key={n.id}
                  onClick={() => user && !isRead && markNotificationRead(n.id, user.id)}
                  className={`w-full text-right p-4 rounded-2xl border transition-all flex gap-3 ${isRead ? 'bg-white border-gray-100' : 'bg-[#38BDF8]/[0.05] border-[#38BDF8]/25'}`}
                >
                  <span className={`shrink-0 mt-1 w-2.5 h-2.5 rounded-full ${isRead ? 'bg-gray-200' : 'bg-[#0284C7]'}`}></span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center gap-3">
                      <p className="font-black text-sm text-[#0F172A]">{n.title}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${typeBadge[n.type] || typeBadge.general}`}>
                        {n.type === 'absence' ? 'غياب' : n.type === 'competition' ? 'فعالية' : n.type === 'registration' ? 'إخراط' : n.type === 'disciplinary' ? 'انضباط' : n.type === 'health' ? 'صحي' : 'عام'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-1">{n.body}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1.5">{n.fromName} • {formatDateShort(n.date)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {isStaff ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2 mb-5">
              <Clock className="text-[#0284C7]" size={20} /> حضور اليوم
            </h3>
            {todayAtt.length === 0 && <p className="text-sm text-gray-400">لم يُسجل حضور أي حصة اليوم.</p>}
            <div className="space-y-3">
              {todayAtt.map((r) => {
                const a = athletes.find((x) => x.id === r.athleteId);
                const plan = plans.find((p) => p.id === r.planId);
                return (
                  <div key={r.id} className={`flex items-center justify-between p-4 rounded-2xl border ${r.present ? 'bg-emerald-50/60 border-emerald-100' : 'bg-red-50/60 border-red-100'}`}>
                    <div>
                      <p className="font-black text-[#0F172A] text-sm">{a?.name} {a?.lastName}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">{plan?.title || (r.planId === 'general' ? 'تدريب جماعي' : r.planId)} — {formatDateShort(r.date)}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${r.present ? 'bg-[#10B981] text-white' : 'bg-[#EF4444] text-white'}`}>
                      {r.present ? <UserCheck size={12} /> : <UserX size={12} />}
                      {r.present ? 'حاضر' : r.note ? 'غائب (مبرر)' : 'غائب'}
                    </span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => onNavigate('training')} className="mt-5 w-full py-3.5 bg-[#0284C7]/10 text-[#0284C7] rounded-xl font-black text-xs hover:bg-[#0284C7] hover:text-white transition-all">
              فتح سجل التدريب ←
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2 mb-5">
              <Waves className="text-[#0284C7]" size={20} /> هدف {targetAthlete?.name} التدريبي
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-gray-400">التقدم الموسمي</span>
                  <span className="text-[#10B981] font-black">{targetAthlete?.progress ?? 0}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0284C7] transition-all duration-1000" style={{ width: `${targetAthlete?.progress ?? 0}%` }}></div>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed italic">
                {targetAthlete
                  ? `واصل العمل على ${targetAthlete.sport === 'السباحة' ? 'تقنيات الركلة والسباحة الأنسب لمسافتك' : 'ترتيب أنفاسك والثبات الخطي عند المجهود العالي'} — فريقك يرصد تطورك أسبوعياً.`
                  : 'أكمل تسجيل ملفك للانضمام إلى برنامج هذا الموسم.'}
              </p>
              <button
                onClick={() => onNavigate('training')}
                className="mt-2 w-full py-3.5 bg-[#38BDF8]/10 text-[#0284C7] rounded-xl font-black text-xs hover:bg-[#0284C7] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <HeartPulse size={14} /> تماريني وتوجيهاتي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* رابط الطباعة للملفات (ولي/رياضي) */}
      {(isGuardian || isAthlete) && (
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-[#0F172A] text-[#38BDF8] flex items-center justify-center"><Printer size={20} /></span>
            <div>
              <p className="font-black text-[#0F172A] text-sm">وثائق {targetAthlete?.name}</p>
              <p className="text-[11px] text-slate-400 font-bold">برنامج الأسبوع، الوصلات، وشهادات الإخراط المصادق عليها</p>
            </div>
          </div>
          <button onClick={() => onNavigate('schedule')} className="inline-flex items-center gap-2 bg-[#0F172A] text-white font-black px-5 py-3 rounded-xl text-xs hover:bg-[#1E3A8A] transition-all">
            <Printer size={14} /> فتح البرنامج والطباعة
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;