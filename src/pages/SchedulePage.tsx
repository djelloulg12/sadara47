import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gauge,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Waves,
} from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useAuth, useData, useAppContext } from '@/context';
import {
  POOL_MAX_GROUPS,
  POOL_BASINS,
  SCHEDULE_POOLS,
  WEEK_DAYS,
} from '@/constants';
import {
  AgeCategory,
  GroupCategory,
  GroupSession,
  Sport,
  TrainingGroup,
  UserRole,
  WeekDay,
} from '@/types';
import { setSchedulePrintData } from '@/data';

const CAT_BANDS: Record<GroupCategory, AgeCategory[]> = {
  'أصاغر': [AgeCategory.BENJAMINS, AgeCategory.MINIMES, AgeCategory.CADETS],
  'أكابر': [AgeCategory.JUNIORS, AgeCategory.SENIORS],
};

const overlaps = (a: Pick<GroupSession, 'day' | 'pool' | 'start' | 'end'>, b: Pick<GroupSession, 'day' | 'pool' | 'start' | 'end'>) =>
  a.day === b.day && a.pool === b.pool && a.start < b.end && b.start < a.end;

const SchedulePage: React.FC = () => {
  const { user, users, addUser } = useAuth();
  const { setRoute } = useAppContext();
  const {
    athletes,
    groups,
    sessions,
    addGroup,
    updateGroup,
    deleteGroup,
    addSession,
    updateSession,
    approveSession,
    deleteSession,
    clubSettings,
  } = useData();

  const coaches = useMemo(() => users.filter((u) => u.role === UserRole.COACH), [users]);
  const isManager = user?.role === UserRole.MANAGER;
  const isPresident = user?.role === UserRole.PRESIDENT;
  const canManage = isManager || isPresident;

  const [poolFilter, setPoolFilter] = useState<string>('الكل');
  const [dayTab, setDayTab] = useState<string>('الكل');
  const [groupModal, setGroupModal] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TrainingGroup | null>(null);
  const [editingSession, setEditingSession] = useState<GroupSession | null>(null);
  const [toDelete, setToDelete] = useState<{ type: 'group' | 'session'; id: string } | null>(null);
  const [sessionError, setSessionError] = useState('');

  /* ------------------------------ عزل البيانات حسب الدور ------------------------------ */
  const scope = useMemo(() => {
    if (canManage) return { groupIds: groups.map((g) => g.id), visibleGroups: groups, showAll: true as const };

    let myGroupIds: string[] = [];
    if (user?.role === UserRole.COACH) {
      myGroupIds = groups.filter((g) => g.headCoachId === user.id || g.assistantCoachId === user.id).map((g) => g.id);
    } else if (user?.role === UserRole.ATHLETE) {
      const myGroup = groups.find((g) => user.athleteId && g.memberIds.includes(user.athleteId));
      if (myGroup) myGroupIds = [myGroup.id];
    } else if (user?.role === UserRole.GUARDIAN) {
      const wardIds = athletes.filter((a) => a.guardianUserId === user.id || a.id === user.athleteId).map((a) => a.id);
      myGroupIds = groups.filter((g) => g.memberIds.some((m) => wardIds.includes(m))).map((g) => g.id);
    }
    const visibleGroups = groups.filter((g) => myGroupIds.includes(g.id));
    return { groupIds: myGroupIds, visibleGroups, showAll: false as const };
  }, [canManage, groups, user, athletes]);

  const scopedSessions = useMemo(() => {
    const base = sessions.filter((s) => s.groupIds.some((g) => scope.groupIds.includes(g)));
    return scope.showAll ? base : base.filter((s) => s.status === 'approved');
  }, [sessions, scope]);

  const filtered = useMemo(
    () =>
      scopedSessions.filter(
        (s) =>
          (poolFilter === 'الكل' || s.pool === poolFilter) && (dayTab === 'الكل' || s.day === dayTab),
      ),
    [scopedSessions, poolFilter, dayTab],
  );

  const byDay = useMemo(() => {
    const map: Record<string, GroupSession[]> = {};
    WEEK_DAYS.forEach((d) => (map[d] = []));
    [...filtered].sort((a, b) => a.start.localeCompare(b.start)).forEach((s) => map[s.day].push(s));
    return map;
  }, [filtered]);

  /* ------------------------------ مراقبة الطاقة الاستيعابية ------------------------------ */
  const capacity = useMemo(() => {
    const rows: { pool: string; day: WeekDay; peak: number; sessions: GroupSession[] }[] = [];
    for (const pool of SCHEDULE_POOLS) {
      for (const day of WEEK_DAYS) {
        const list = scopedSessions.filter((s) => s.pool === pool && s.day === day);
        if (list.length === 0) continue;
        let peak = 0;
        const wins: GroupSession[] = [];
        for (const s of list) {
          const clash = list.filter((o) => overlaps(o, s));
          const groupsCount = clash.reduce((n, c) => n + c.groupIds.length, 0);
          if (groupsCount > peak) {
            peak = groupsCount;
            wins.splice(0, wins.length, ...clash);
          }
        }
        rows.push({ pool, day, peak, sessions: list });
      }
    }
    return rows.sort((a, b) => b.peak - a.peak);
  }, [scopedSessions]);

  const overloaded = capacity.filter((r) => r.peak < POOL_MAX_GROUPS && r.peak > 0 && r.peak >= POOL_MAX_GROUPS - 1);
  const breached = capacity.filter((r) => r.peak > POOL_MAX_GROUPS);

  const groupById = (id: string) => groups.find((g) => g.id === id);
  const userById = (id?: string) => users.find((u) => u.id === id);

  const groupCoaches = (g: TrainingGroup) => [userById(g.headCoachId), userById(g.assistantCoachId)].filter(Boolean);

  const sessionGroups = (s: GroupSession) => s.groupIds.map(groupById).filter((g): g is TrainingGroup => !!g);

  /* ------------------------------ بوابات الإضافة/التعديل ------------------------------ */
  const [groupForm, setGroupForm] = useState({
    name: '',
    category: 'أصاغر' as GroupCategory,
    headCoachId: '',
    assistantCoachId: '',
  });
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const openAddGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', category: 'أصاغر', headCoachId: '', assistantCoachId: '' });
    setGroupMembers([]);
    setGroupModal(true);
  };

  const openEditGroup = (g: TrainingGroup) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, category: g.category, headCoachId: g.headCoachId, assistantCoachId: g.assistantCoachId });
    setGroupMembers(g.memberIds);
    setGroupModal(true);
  };

  const eligibleAthletes = useMemo(
    () => athletes.filter((a) => CAT_BANDS[groupForm.category].includes(a.category) && a.membershipStatus === 'نشط'),
    [athletes, groupForm.category],
  );

  const submitGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim() || !groupForm.headCoachId || !groupForm.assistantCoachId || groupMembers.length === 0) return;
    if (groupForm.headCoachId === groupForm.assistantCoachId) return;
    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: groupForm.name.trim(),
        category: groupForm.category,
        headCoachId: groupForm.headCoachId,
        assistantCoachId: groupForm.assistantCoachId,
        memberIds: groupMembers,
      });
    } else {
      addGroup({
        name: groupForm.name.trim(),
        category: groupForm.category,
        sport: Sport.SWIMMING,
        memberIds: groupMembers,
        headCoachId: groupForm.headCoachId,
        assistantCoachId: groupForm.assistantCoachId,
      });
    }
    setGroupModal(false);
  };

  const [sessionForm, setSessionForm] = useState({
    groupIds: [] as string[],
    day: 'السبت' as WeekDay,
    start: '16:00',
    end: '17:30',
    pool: SCHEDULE_POOLS[0],
    basin: POOL_BASINS[0],
    focus: '',
  });

  const openAddSession = () => {
    setEditingSession(null);
    setSessionForm({ groupIds: [], day: 'السبت', start: '16:00', end: '17:30', pool: SCHEDULE_POOLS[0], basin: POOL_BASINS[0], focus: '' });
    setSessionError('');
    setSessionModal(true);
  };

  const openEditSession = (s: GroupSession) => {
    setEditingSession(s);
    setSessionForm({ groupIds: s.groupIds, day: s.day, start: s.start, end: s.end, pool: s.pool, basin: s.basin ?? POOL_BASINS[0], focus: s.focus });
    setSessionError('');
    setSessionModal(true);
  };

  const toggleSessionGroup = (id: string) => {
    setSessionForm((p) => {
      const has = p.groupIds.includes(id);
      if (has) return { ...p, groupIds: p.groupIds.filter((g) => g !== id) };
      if (p.groupIds.length >= POOL_MAX_GROUPS) return p;
      return { ...p, groupIds: [...p.groupIds, id] };
    });
  };

  const submitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionForm.groupIds.length < 1 || sessionForm.groupIds.length > POOL_MAX_GROUPS) {
      setSessionError(`يجب اختيار من فوج واحد إلى ${POOL_MAX_GROUPS} أفواج.`);
      return;
    }
    if (sessionForm.start >= sessionForm.end) {
      setSessionError('توقيت البداية يجب أن يسبق توقيت النهاية.');
      return;
    }
    const candidate = { day: sessionForm.day, pool: sessionForm.pool, start: sessionForm.start, end: sessionForm.end };
    const others = sessions.filter((s) => s.id !== editingSession?.id);
    const clash = others.filter((o) => overlaps(o, candidate));
    const totalGroups = clash.reduce((n, c) => n + c.groupIds.length, 0) + sessionForm.groupIds.length;
    if (totalGroups > POOL_MAX_GROUPS) {
      setSessionError(
        `الطاقة الاستيعابية القصوى ${POOL_MAX_GROUPS} أفواج. هذه الخانة ستتجاوزها (${totalGroups} أفواج). اختر توقيتاً أو مسبحاً آخر، أو قلّل عدد الأفواج.`,
      );
      return;
    }
    if (editingSession) {
      updateSession(editingSession.id, { ...sessionForm });
    } else {
      addSession({ ...sessionForm, createdBy: user?.id ?? '' });
    }
    setSessionModal(false);
  };

  /* ------------------------------ توليد نموذج تجريبي ------------------------------ */
  const generateDemo = () => {
    if (!users.some((u) => u.username.toLowerCase() === 'coach1')) {
      addUser({ name: 'سمير حداد', username: 'coach1', password: '123', role: UserRole.COACH, active: true, phone: '0550000001' });
    }
    if (!users.some((u) => u.username.toLowerCase() === 'coach2')) {
      addUser({ name: 'رضوان بن علي', username: 'coach2', password: '123', role: UserRole.COACH, active: true, phone: '0550000002' });
    }
    const young = athletes.filter((a) => CAT_BANDS['أصاغر'].includes(a.category)).slice(0, 40);
    const senior = athletes.filter((a) => CAT_BANDS['أكابر'].includes(a.category)).slice(0, 40);
    const cut = (list: typeof young) => {
      const mid = Math.ceil(list.length / 2);
      return { a: list.slice(0, mid).map((x) => x.id), b: list.slice(mid).map((x) => x.id) };
    };
    const y = cut(young);
    const s = cut(senior);

    const ga = addGroup({ name: 'فوج الأصاغر (أ)', category: 'أصاغر', sport: Sport.SWIMMING, memberIds: y.a, headCoachId: 'coach1', assistantCoachId: 'coach2' });
    const gb = addGroup({ name: 'فوج الأصاغر (ب)', category: 'أصاغر', sport: Sport.SWIMMING, memberIds: y.b, headCoachId: 'coach2', assistantCoachId: 'coach1' });
    const gk = addGroup({ name: 'فوج الأكابر (أ)', category: 'أكابر', sport: Sport.SWIMMING, memberIds: s.a, headCoachId: 'coach1', assistantCoachId: 'coach2' });
    const gl = addGroup({ name: 'فوج الأكابر (ب)', category: 'أكابر', sport: Sport.SWIMMING, memberIds: s.b, headCoachId: 'coach2', assistantCoachId: 'coach1' });
    const id = (g: TrainingGroup) => g.id;

    const slots: Omit<GroupSession, 'id' | 'status' | 'managerApproved' | 'createdBy'>[] = [
      { groupIds: [id(gk), id(gl)], day: 'السبت', start: '09:00', end: '10:30', pool: SCHEDULE_POOLS[0], basin: 'الحوض 1', focus: 'تحمل عام وانسياب' },
      { groupIds: [id(ga)], day: 'السبت', start: '09:00', end: '10:30', pool: SCHEDULE_POOLS[1], basin: 'الحوض 1', focus: 'أساسيات التنفس والدفع' },
      { groupIds: [id(gb)], day: 'السبت', start: '10:45', end: '12:15', pool: SCHEDULE_POOLS[1], basin: 'الحوض 2', focus: 'تقنيات السباحة الحرة' },
      { groupIds: [id(ga), id(gb)], day: 'الاثنين', start: '16:00', end: '17:30', pool: SCHEDULE_POOLS[0], basin: 'الحوض 1', focus: 'تمارين السرعة والبدء والانعطاف' },
      { groupIds: [id(gk)], day: 'الثلاثاء', start: '17:00', end: '18:30', pool: SCHEDULE_POOLS[0], basin: 'الحوض 2', focus: 'تقنيات السرعة والسباحة الحرة' },
      { groupIds: [id(gl)], day: 'الأربعاء', start: '16:30', end: '18:00', pool: SCHEDULE_POOLS[0], basin: 'الحوض 1', focus: 'تمارين القوة والبدء والانعطاف' },
      { groupIds: [id(gk), id(gl)], day: 'الخميس', start: '09:00', end: '10:30', pool: SCHEDULE_POOLS[1], basin: 'الحوض 1', focus: 'تحمل خاص وسباقات المحاكاة' },
    ];
    slots.forEach((s) => addSession({ ...s, createdBy: user?.id ?? '' }));
  };

  /* ------------------------------ الطباعة ------------------------------ */
  const printSchedule = () => {
    const approvedIds = new Set(filtered.filter((s) => s.status === 'approved').map((s) => s.id));
    const printGroups = scope.showAll ? groups : scope.visibleGroups;
    const printSessions = sessions.filter((s) => approvedIds.has(s.id) && s.groupIds.some((g) => printGroups.some((pg) => pg.id === g)));
    setSchedulePrintData({
      groups: printGroups,
      sessions: printSessions,
      title: 'برنامج التدريب الأسبوعي للموسم الرياضي',
      season: clubSettings.season,
      issuedAt: new Date().toISOString().slice(0, 10),
      coachNames: Object.fromEntries(users.map((u) => [u.id, u.name])),
    });
    setRoute('print-schedule');
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#007377] font-bold text-sm';

  /* ------------------------------ الواجهة ------------------------------ */
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#0B121E]">
            البرنامج <span className="text-[#007377]">الأسبوعي</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            حصص السباحة حسب الفوج والطاقم الفني — بسقف {POOL_MAX_GROUPS} أفواج لكل خانة زمنية في المسبح.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {scope.showAll && groups.length === 0 && (
            <button
              onClick={generateDemo}
              className="inline-flex items-center gap-2 bg-white border border-[#D4AF37]/40 text-[#B8860B] font-bold px-4 py-3 rounded-2xl hover:bg-[#D4AF37]/10 transition-all text-sm"
            >
              <Sparkles size={17} />
              توليد نموذج تجريبي
            </button>
          )}
          {canManage && (
            <button
              onClick={openAddGroup}
              className="inline-flex items-center gap-2 bg-[#0B121E] text-white font-bold px-4 py-3 rounded-2xl hover:bg-[#1A3A5F] transition-all text-sm"
            >
              <Users size={17} />
              إدارة الأفواج
            </button>
          )}
          {canManage && (
            <button
              onClick={openAddSession}
              className="inline-flex items-center gap-2 bg-[#007377] text-white font-bold px-4 py-3 rounded-2xl hover:bg-[#0A8696] transition-all text-sm"
            >
              <Plus size={17} />
              إضافة حصة
            </button>
          )}
          <button
            onClick={printSchedule}
            className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#0B121E] font-black px-4 py-3 rounded-2xl shadow-lg hover:bg-[#B8860B] transition-all text-sm"
          >
            <Printer size={17} />
            طباعة البرنامج / تصدير PDF
          </button>
        </div>
      </div>

      {canManage && groups.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#0B121E] rounded-2xl p-5 text-white relative overflow-hidden col-span-1">
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#D4AF37]/20 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-[#D4AF37] text-[#0B121E] flex items-center justify-center"><Waves size={22} /></span>
              <div>
                <p className="text-2xl font-black">{groups.length}</p>
                <p className="text-white/60 text-xs font-bold">فوج تدريبي نشط</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-teal-50 text-[#007377] flex items-center justify-center"><Clock size={22} /></span>
            <div>
              <p className="text-2xl font-black text-[#0B121E]">{sessions.filter((s) => s.status === 'approved').length}</p>
              <p className="text-xs text-gray-400 font-bold">حصة معتمدة أسبوعياً</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><ShieldCheck size={22} /></span>
            <div>
              <p className="text-2xl font-black text-[#0B121E]">{sessions.filter((s) => s.status === 'pending').length}</p>
              <p className="text-xs text-gray-400 font-bold">بانتظار موافقة المدير</p>
            </div>
          </div>
        </div>
      )}

      {/* مراقبة الطاقة الاستيعابية */}
      {canManage && capacity.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-black text-[#0B121E] flex items-center gap-2">
              <Gauge size={18} className="text-[#007377]" />
              مراقبة الطاقة الاستيعابية للمسابح
            </h3>
            {breached.length > 0 && (
              <span className="text-[11px] font-black text-red-600 bg-red-50 rounded-full px-3 py-1 flex items-center gap-1">
                <AlertTriangle size={13} /> تجاوز السقف
              </span>
            )}
            {overloaded.length > 0 && !breached.length && (
              <span className="text-[11px] font-black text-amber-600 bg-amber-50 rounded-full px-3 py-1 flex items-center gap-1">
                <AlertTriangle size={13} /> قرب السقف ({POOL_MAX_GROUPS} أفواج)
              </span>
            )}
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                  <th className="p-3">المسبح</th>
                  {WEEK_DAYS.map((d) => (
                    <th key={d} className="p-3">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCHEDULE_POOLS.map((pool) => (
                  <tr key={pool} className="border-t border-gray-50">
                    <td className="p-3 font-bold text-[#0B121E]">{pool}</td>
                    {WEEK_DAYS.map((day) => {
                      const c = capacity.find((r) => r.pool === pool && r.day === day);
                      const val = c?.peak ?? 0;
                      const color = val > POOL_MAX_GROUPS ? 'bg-red-50 text-red-600' : val === POOL_MAX_GROUPS ? 'bg-amber-50 text-amber-600' : val >= POOL_MAX_GROUPS - 1 && val > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400';
                      return (
                        <td key={day} className="p-2">
                          <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-center min-w-[3.4rem] justify-center ${color}`}>
                            {val === 0 ? 'ـ' : `${val}/${POOL_MAX_GROUPS}`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* المرشحات */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={poolFilter} onChange={(e) => setPoolFilter(e.target.value)} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-[#007377]">
          <option value="الكل">كل المسابح</option>
          {SCHEDULE_POOLS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="flex gap-2 overflow-x-auto custom-scrollbar">
          {['الكل', ...WEEK_DAYS].map((d) => (
            <button
              key={d}
              onClick={() => setDayTab(d)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${dayTab === d ? 'bg-[#007377] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* جدول الأسبوع */}
      {(!groups.length) || (!filtered.length) ? (
        <EmptyState
          title={groups.length === 0 ? 'لا توجد أفواج تدريبية بعد' : 'لا توجد حصص مطابقة للعرض'}
          hint={
            canManage
              ? groups.length === 0
                ? 'ابدأ بإنشاء أفواج وترتيب حصصها، أو استخدم "توليد نموذج تجريبي".'
                : 'عدّل المرشحات أو أضف حصة جديدة.'
              : 'سيظهر هنا جدول فوجك بمجرد نشر البرنامج من طرف الإدارة.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {WEEK_DAYS.filter((d) => dayTab === 'الكل' || d === dayTab).map((day) => (
            <div key={day} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-[#0B121E] text-white px-5 py-3.5 font-black text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[#D4AF37]" /> {day}</span>
                <span className="text-[10px] text-white/50 font-bold">{byDay[day].length} حصة</span>
              </div>
              <div className="divide-y divide-gray-50">
                {byDay[day].length === 0 ? (
                  <p className="p-6 text-center text-xs text-gray-300 font-bold">راحة أو يوم مستقطع</p>
                ) : (
                  byDay[day].map((s) => {
                    const gs = sessionGroups(s);
                    const isPending = s.status !== 'approved' || !s.managerApproved;
                    return (
                      <div key={s.id} className="p-4 hover:bg-[#F8FAFB] transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-10 h-10 rounded-xl bg-[#007377]/10 text-[#007377] flex items-center justify-center font-black text-xs">
                              {s.start}
                            </span>
                            <div>
                              <p className="text-sm font-black text-[#0B121E]" dir="ltr">{s.start} - {s.end}</p>
                              <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                <Waves size={11} className="text-[#007377]" />
                                {s.pool} • {s.basin}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-black rounded-full px-2.5 py-1 ${
                              isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isPending ? 'بانتظار اعتماد المدير' : 'معتمدة'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {gs.map((g) => (
                            <span key={g.id} className="inline-flex items-center gap-1.5 bg-[#0B121E]/5 text-[#0B121E] rounded-full px-3 py-1 text-[10px] font-black">
                              <Users size={11} className="text-[#007377]" />
                              {g.name}
                              <span className="text-gray-400 font-bold">{g.category}</span>
                            </span>
                          ))}
                        </div>

                        {s.focus && <p className="mt-2 text-xs text-gray-500 leading-relaxed">🎯 {s.focus}</p>}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {gs.flatMap((g) => groupCoaches(g)).map((c, idx) => (
                            <span key={`${c?.id}-${idx}`} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-600">
                              <span className="w-5 h-5 rounded-full bg-[#0B121E] text-[#D4AF37] flex items-center justify-center text-[9px] font-black">
                                {c?.name.charAt(0)}
                              </span>
                              {c?.name}
                            </span>
                          ))}
                        </div>

                        {canManage && (
                          <div className="flex gap-2 mt-3 pt-2 border-t border-gray-50">
                            {isPending && isPresident && (
                              <button
                                onClick={() => approveSession(s.id)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-[#007377] text-white rounded-xl text-[11px] font-black hover:bg-[#0A8696] transition-all"
                              >
                                <CheckCircle2 size={14} /> موافقة المدير والاعتماد
                              </button>
                            )}
                            {isPending && isManager && (
                              <span className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-amber-50 text-amber-700 rounded-xl text-[11px] font-black">
                                <ShieldCheck size={14} /> بانتظار اعتماد المدير
                              </span>
                            )}
                            <button
                              onClick={() => openEditSession(s)}
                              className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-500 rounded-xl hover:text-[#007377] hover:bg-white transition-all"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setToDelete({ type: 'session', id: s.id })}
                              className="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-400 rounded-xl hover:text-red-500 hover:bg-white transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------- إدارة الأفواج --------------------------- */}
      {canManage && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-black text-[#0B121E] flex items-center gap-2"><Users size={18} className="text-[#007377]" /> الأفواج التدريبية</h3>
            <button onClick={openAddGroup} className="text-xs font-black text-[#007377] hover:text-[#0A8696] transition-colors flex items-center gap-1">
              <Plus size={14} /> فوج جديد
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400 font-bold">لا توجد أفواج بعد.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 p-5">
              {groups.map((g) => {
                const coachesN = [userById(g.headCoachId), userById(g.assistantCoachId)].filter(Boolean);
                const sessionsN = sessions.filter((s) => s.groupIds.includes(g.id)).length;
                return (
                  <div key={g.id} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-[#0B121E]">{g.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                          {g.category} • {g.memberIds.length} سباح • {sessionsN} حصة أسبوعياً
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEditGroup(g)} className="w-8 h-8 flex items-center justify-center bg-white text-gray-500 rounded-lg hover:text-[#007377] transition-all"><Pencil size={13} /></button>
                        <button onClick={() => setToDelete({ type: 'group', id: g.id })} className="w-8 h-8 flex items-center justify-center bg-white text-gray-400 rounded-lg hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {coachesN.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-600">
                          <span className="w-4 h-4 rounded-full bg-[#0B121E] text-[#D4AF37] flex items-center justify-center text-[8px] font-black">{c?.name.charAt(0)}</span>
                          {i === 0 ? 'رئيسي: ' : 'مساعد: '}
                          {c?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------- مودال الفوج --------------------------- */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title={editingGroup ? 'تعديل الفوج' : 'فوج تدريبي جديد'} subtitle="مدربان إجباريان لكل فوج" accent="teal" maxWidth="max-w-xl">
        <form onSubmit={submitGroup} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">اسم الفوج</label>
            <input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="مثال: فوج الأصاغر (أ)" className={inputCls} required />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">الفئة</label>
            <select value={groupForm.category} onChange={(e) => setGroupForm({ ...groupForm, category: e.target.value as GroupCategory })} className={inputCls}>
              <option value="أصاغر">أصاغر</option>
              <option value="أكابر">أكابر</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">المدرب الرئيسي *</label>
              <select value={groupForm.headCoachId} onChange={(e) => setGroupForm({ ...groupForm, headCoachId: e.target.value })} className={inputCls} required>
                <option value="">اختر المدرب الرئيسي</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">المدرب المساعد *</label>
              <select value={groupForm.assistantCoachId} onChange={(e) => setGroupForm({ ...groupForm, assistantCoachId: e.target.value })} className={inputCls} required>
                <option value="">اختر المدرب المساعد</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === groupForm.headCoachId}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          {coaches.length === 0 && (
            <p className="text-[11px] font-bold text-amber-600 bg-amber-50 rounded-xl p-3">
              لا يوجد مدربون مسجلون بعد. أنشئ حسابات مدربين من صفحة «تسيير الحسابات» (قبول طلب مدرب أو دور مدرب).
            </p>
          )}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              قائمة السباحين — {eligibleAthletes.length} سباح متاح في فئة {groupForm.category}
            </label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 rounded-2xl p-3">
              {eligibleAthletes.length === 0 && <p className="text-xs text-gray-400 font-bold p-3">لا يوجد سباحون في هذه الفئة.</p>}
              {eligibleAthletes.map((a) => (
                <label key={a.id} className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${groupMembers.includes(a.id) ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-100'}`}>
                  <span className="font-black text-[#0B121E] text-xs">{a.name} {a.lastName}</span>
                  <input type="checkbox" checked={groupMembers.includes(a.id)} onChange={(e) => setGroupMembers((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)))} className="w-4 h-4 accent-[#007377]" />
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setGroupMembers(eligibleAthletes.map((a) => a.id))} className="text-[11px] font-black text-[#007377] hover:underline">
                تحديد الكل ({eligibleAthletes.length})
              </button>
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-[#007377] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">
            {editingGroup ? 'حفظ تعديل الفوج' : 'إنشاء الفوج'}
          </button>
        </form>
      </Modal>

      {/* --------------------------- مودال الحصة --------------------------- */}
      <Modal open={sessionModal} onClose={() => setSessionModal(false)} title={editingSession ? 'تعديل الحصة' : 'حصة تدريبية جديدة'} subtitle={`سقف الطاقة الاستيعابية: ${POOL_MAX_GROUPS} أفواج في المسبح`} accent="navy" maxWidth="max-w-2xl">
        <form onSubmit={submitSession} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">الأفواج المشاركة (حصة فردية أو مشتركة 2-4) *</label>
            {sessionForm.groupIds.length >= POOL_MAX_GROUPS && (
              <p className="text-[10px] font-bold text-amber-600">وصلت الحد الأقصى ({POOL_MAX_GROUPS} أفواج).</p>
            )}
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {groups.map((g) => (
                <label key={g.id} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${sessionForm.groupIds.includes(g.id) ? 'bg-[#007377]/10 border-[#007377]' : 'bg-gray-50 border-gray-100'}`}>
                  <input type="checkbox" checked={sessionForm.groupIds.includes(g.id)} onChange={() => toggleSessionGroup(g.id)} className="w-4 h-4 accent-[#007377]" />
                  <span className="text-xs font-black text-[#0B121E]">{g.name}</span>
                  <span className="text-[9px] text-gray-400 font-bold">{g.category}</span>
                </label>
              ))}
            </div>
            {groups.length === 0 && <p className="text-[11px] font-bold text-amber-600 bg-amber-50 rounded-xl p-3">أنشئ أفواجاً أولاً.</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">اليوم</label>
              <select value={sessionForm.day} onChange={(e) => setSessionForm({ ...sessionForm, day: e.target.value as WeekDay })} className={inputCls}>
                {WEEK_DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">البداية</label>
              <input type="time" value={sessionForm.start} onChange={(e) => setSessionForm({ ...sessionForm, start: e.target.value })} className={inputCls} required />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">النهاية</label>
              <input type="time" value={sessionForm.end} onChange={(e) => setSessionForm({ ...sessionForm, end: e.target.value })} className={inputCls} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">المسبح المخصص</label>
              <select value={sessionForm.pool} onChange={(e) => setSessionForm({ ...sessionForm, pool: e.target.value })} className={inputCls}>
                {SCHEDULE_POOLS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">الحوض</label>
              <select value={sessionForm.basin} onChange={(e) => setSessionForm({ ...sessionForm, basin: e.target.value })} className={inputCls}>
                {POOL_BASINS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">نوع النشاط والتوجيهات</label>
            <textarea rows={2} value={sessionForm.focus} onChange={(e) => setSessionForm({ ...sessionForm, focus: e.target.value })} placeholder="مثال: تحمل عام وانسياب / تقنيات السرعة..." className={inputCls}></textarea>
          </div>
          {sessionError && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{sessionError}</p>}
          {sessionForm.groupIds.length > 1 && (
            <p className="text-[11px] font-bold text-[#007377] bg-teal-50 rounded-xl p-3 flex items-center gap-2">
              <ShieldCheck size={14} />
              حصة مشتركة ({sessionForm.groupIds.length} أفواج) — ستُرسل للمدير للموافقة والاعتماد قبل التثبيت.
            </p>
          )}
          <button type="submit" className="w-full py-4 bg-[#007377] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">
            {editingSession ? 'حفظ تعديل الحصة' : 'تثبيت الحصة'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={
          toDelete?.type === 'group'
            ? <>حذف هذا الفوج نهائياً؟ ستُحذف الحصص المرتبطة به أيضاً.</>
            : 'حذف هذه الحصة من البرنامج الأسبوعي؟'
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete?.type === 'group') deleteGroup(toDelete.id);
          if (toDelete?.type === 'session') deleteSession(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default SchedulePage;