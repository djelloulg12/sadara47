import React, { useMemo, useState } from 'react';
import { Activity, Bell, Clock, Crown, MapPin, Medal, Sparkles, TrendingUp, UserCheck, UserX, Users, Calendar, ClipboardList } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/StatCard';
import { useAuth, useData } from '@/context';
import { Sport, UserRole } from '@/types';
import { ROLES_LABEL } from '@/constants';
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

const DashboardPage: React.FC<{ onNavigate: (page: PageId) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { athletes, applications, activities, records, notifications, markNotificationRead, attendance, plans } = useData();

  const isPresident = user?.role === UserRole.PRESIDENT;
  const isManager = user?.role === UserRole.MANAGER;
  const isCoach = user?.role === UserRole.COACH;
  const isAthlete = user?.role === UserRole.ATHLETE;
  const isGuardian = user?.role === UserRole.GUARDIAN;
  const isStaff = isPresident || isManager || isCoach;

  const targetAthlete = useMemo(() => {
    if ((isAthlete || isGuardian) && user?.athleteId) {
      return athletes.find((a) => a.id === user.athleteId);
    }
    return null;
  }, [isAthlete, isGuardian, user, athletes]);

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
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    return attendance.filter((r) => r.date === todayStr).slice(0, 6);
  }, [attendance]);

  const myRecords = useMemo(
    () =>
      (targetAthlete
        ? records.filter((r) => r.athleteId === targetAthlete.id)
        : []
      ).sort((a, b) => a.date.localeCompare(b.date)),
    [records, targetAthlete],
  );

  const pendingApps = applications.filter((a) => a.status === 'pending').length;
  const activeAthletes = athletes.filter((a) => a.membershipStatus === 'نشط').length;
  const upcomingEvents = activities.filter((a) => a.status === 'ريان').length;

  const chartData = isAthlete || isGuardian ? myRecords.map((r) => ({ name: formatDateShort(r.date), value: r.numeric ?? 0 })) : CLUB_TREND;

  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runAI = async () => {
    setAnalyzing(true);
    try {
      const tip = await generateTrainingTip(targetAthlete ? targetAthlete.sport : Sport.SWIMMING);
      setAiAdvice(tip);
    } catch {
      setAiAdvice('تعذر الوصول إلى الذكاء الاصطناعي في الوقت الحالي.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <span className="px-3 py-1 bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-black rounded-full border border-[#D4AF37]/20 uppercase tracking-widest inline-block">
            {user ? ROLES_LABEL[user.role] : ''}
            {isAthlete ? ' — بوابة الرياضي' : isPresident ? ' — منصة الرئيس' : isManager ? ' — منصة المسير' : isCoach ? ' — منصة المدرب' : isGuardian ? ' — بوابة ولي الأمر' : ''}
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-[#0B121E]">
            {isAthlete ? 'لوحة أرقامي' : 'مؤشرات النادي'} <span className="text-[#007377]">{isAthlete ? 'القياسية' : 'الإدارية'}</span>
          </h2>
          <p className="text-gray-400 font-bold flex items-center gap-2">
            <MapPin size={16} className="text-[#D4AF37]" /> مجمع السباحة الأولمبي - ولاية غرداية
          </p>
        </div>
        <div className="px-8 py-4 bg-[#0B121E] text-white rounded-2xl flex items-center gap-3 shadow-xl border-b-4 border-[#D4AF37]">
          {isPresident ? <Crown size={22} className="text-[#D4AF37]" /> : <Activity size={22} className="text-[#D4AF37]" />}
          <span className="text-sm font-black uppercase tracking-widest">الموسم الذهبي 2026</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard
          label={isAthlete || isGuardian ? 'فئتي العمرية' : 'الرياضيين المسجلين'}
          value={isAthlete || isGuardian ? (targetAthlete?.category || '—') : String(athletes.length)}
          icon={Users}
          color="#007377"
          onOpen={isAthlete || isGuardian ? () => onNavigate('profile') : undefined}
        />
        <StatCard
          label={isAthlete || isGuardian ? 'نسبة التقدم' : 'الأعضاء النشطون'}
          value={isAthlete || isGuardian ? `${targetAthlete?.progress ?? 0}%` : String(activeAthletes)}
          icon={Activity}
          color="#0B121E"
        />
        <StatCard
          label={isAthlete || isGuardian ? 'أرقامي المسجلة' : 'طلبات الإخراط'}
          value={isAthlete || isGuardian ? String(myRecords.length) : String(pendingApps)}
          icon={isAthlete || isGuardian ? Medal : ClipboardList}
          color="#D4AF37"
          onOpen={isPresident || isManager ? () => onNavigate('applications') : undefined}
        />
        <StatCard
          label="الفعاليات القادمة"
          value={String(upcomingEvents)}
          icon={Calendar}
          color="#0B121E"
          onOpen={() => onNavigate('activities')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-gray-50 shadow-sm border-t-8 border-t-[#007377] relative">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-2xl font-black text-[#0B121E] flex items-center gap-3">
                <TrendingUp className="text-[#007377]" size={28} />
                {isAthlete || isGuardian ? 'منحنى أرقامي الشخصية' : 'مؤشر أداء النادي العام'}
              </h3>
              <p className="text-xs text-gray-400 font-bold mt-1">
                {isAthlete || isGuardian ? 'بناءً على أرقامك المسجلة فعلياً' : 'بناءً على نتائج الاختبارات الدورية هذا الموسم'}
              </p>
            </div>
          </div>
          <div className="h-[360px] w-full dir-ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007377" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#007377" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00000005" vertical={false} />
                <XAxis dataKey="name" stroke="#E2E8F0" axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                <YAxis stroke="#E2E8F0" axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Tooltip />
                <Area type="monotone" dataKey={isAthlete || isGuardian ? 'value' : 'score'} stroke="#007377" strokeWidth={5} fill="url(#colorPerf)" name={isAthlete || isGuardian ? 'الرقم' : 'المؤشر'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0B121E] p-10 rounded-[3rem] relative overflow-hidden shadow-2xl border-b-[12px] border-b-[#D4AF37] flex flex-col justify-between group">
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-[#D4AF37] mb-8">
              <Sparkles size={24} className="animate-pulse" />
              <span className="font-black uppercase tracking-[0.2em] text-[10px]">Sadara Intelligence AI</span>
            </div>
            <h3 className="text-3xl font-black text-white mb-6 leading-tight">
              {isAthlete || isGuardian ? 'نصائح لكسر' : 'رؤية النادي'} <span className="text-[#D4AF37]">{isAthlete || isGuardian ? 'أرقامك؟' : 'الاستراتيجية'}</span>
            </h3>
            <div className="space-y-6 text-white/70 text-sm leading-relaxed italic">
              {aiAdvice ? (
                <p className="border-r-2 border-[#D4AF37]/40 pr-5 not-italic">{aiAdvice}</p>
              ) : (
                <p className="border-r-2 border-[#D4AF37]/40 pr-5">
                  {isAthlete || isGuardian
                    ? 'اضغط على الزر أدناه للحصول على توصيات تدريبية مخصصة حسب تخصصك الرياضي.'
                    : 'اضغط على الزر أدناه لتوليد توصية استراتيجية موسمية مخصصة لأقسام النادي.'}
                </p>
              )}
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 not-italic">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{isAthlete || isGuardian ? 'هدفي القادم' : 'جاهزية النخبة'}</span>
                  <span className="text-[#D4AF37] font-black">{isAthlete || isGuardian ? `${targetAthlete?.progress ?? 0}%` : '94%'}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#D4AF37] transition-all duration-1000" style={{ width: `${targetAthlete?.progress ?? 72}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={runAI}
            disabled={analyzing}
            className="w-full py-5 bg-[#D4AF37] hover:bg-[#B8860B] text-[#0B121E] font-black rounded-[1.5rem] shadow-xl hover:-translate-y-1 active:scale-95 transition-all mt-10 relative z-10 disabled:opacity-50"
          >
            {analyzing ? 'جاري التحليل...' : 'توليد توصية ذكية'}
          </button>
          <span className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#D4AF37]/10 rounded-full"></span>
        </div>
      </div>

      {!isAthlete && !isGuardian && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <Calendar className="text-[#D4AF37]" size={22} /> أقرب الفعاليات
            </h3>
            <div className="space-y-4">
              {activities.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onNavigate('activities')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#D4AF37]/5 rounded-2xl group transition-all text-right"
                >
                  <div>
                    <p className="font-black text-[#0B121E] text-sm">{ev.title}</p>
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
          <div className="flex-1 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <Clock className="text-[#007377]" size={22} /> نظرة سريعة
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-[#D4AF37]/8 rounded-2xl border border-[#D4AF37]/15">
                <p className="font-black text-[#0B121E] text-sm">طلبات إخراط معلقة: {pendingApps}</p>
                <button onClick={() => onNavigate('applications')} className="text-[11px] font-bold text-[#B8860B] mt-1.5 hover:underline">
                  مراجعة الطلبات ←
                </button>
              </div>
              <div className="p-4 bg-[#007377]/5 rounded-2xl border border-[#007377]/10">
                <p className="font-black text-[#0B121E] text-sm">رياضيون باشتراك نشط: {activeAthletes}</p>
                <button onClick={() => onNavigate('athletes')} className="text-[11px] font-bold text-[#007377] mt-1.5 hover:underline">
                  فتح قائمة الرياضيين ←
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3">
              <Bell className="text-[#D4AF37]" size={22} /> الإشعارات
              {unreadCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black">{unreadCount} جديد</span>
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
                  className={`w-full text-right p-4 rounded-2xl border transition-all flex gap-3 ${isRead ? 'bg-white border-gray-100' : 'bg-[#D4AF37]/[0.04] border-[#D4AF37]/25'}`}
                >
                  <span className={`shrink-0 mt-1 w-2.5 h-2.5 rounded-full ${isRead ? 'bg-gray-200' : 'bg-[#D4AF37]'}`}></span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center gap-3">
                      <p className="font-black text-sm text-[#0B121E]">{n.title}</p>
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
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <Clock className="text-[#007377]" size={22} /> حضور اليوم
            </h3>
            {todayAtt.length === 0 && <p className="text-sm text-gray-400">لم يُسجل حضور أي حصة اليوم.</p>}
            <div className="space-y-3">
              {todayAtt.map((r) => {
                const a = athletes.find((x) => x.id === r.athleteId);
                const plan = plans.find((p) => p.id === r.planId);
                return (
                  <div key={r.id} className={`flex items-center justify-between p-4 rounded-2xl border ${r.present ? 'bg-teal-50/50 border-teal-100' : 'bg-red-50/50 border-red-100'}`}>
                    <div>
                      <p className="font-black text-[#0B121E] text-sm">{a?.name} {a?.lastName}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">{plan?.title || (r.planId === 'general' ? 'تدريب جماعي' : r.planId)} — {formatDateShort(r.date)}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${r.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.present ? <UserCheck size={12} /> : <UserX size={12} />}
                      {r.present ? 'حاضر' : r.note ? 'غائب (مبرر)' : 'غائب'}
                    </span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => onNavigate('training')} className="mt-5 w-full py-3.5 bg-[#007377]/10 text-[#007377] rounded-2xl font-black text-xs hover:bg-[#007377] hover:text-white transition-all">
              فتح سجل التدريب ←
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <Activity className="text-[#007377]" size={22} /> أهدافي
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-gray-400">الهدف الموسمي</span>
                  <span className="text-[#D4AF37] font-black">{targetAthlete?.progress ?? 0}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#D4AF37] transition-all duration-1000" style={{ width: `${targetAthlete?.progress ?? 0}%` }}></div>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed italic">
                {targetAthlete
                  ? `واصل العمل على ${targetAthlete.sport === 'سباحة' ? 'تقنيات الركلة والسباحة الأنسب لمسافتك' : 'ترتيب أنفاسك والثبات الخطي عند المجهود العالي'} — فريقك يرصد تطورك أسبوعياً.`
                  : 'أكمل تسجيل ملفك للانضمام إلى برنامج هذا الموسم.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;