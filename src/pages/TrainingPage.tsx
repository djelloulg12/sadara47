import React, { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  ClipboardCheck,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  UserCheck,
  UserX,
} from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { BadgeChip, SPORT_STYLE } from '@/constants';
import { useAuth, useData } from '@/context';
import { Sport, TrainingPlan, UserRole } from '@/types';
import { formatDate, formatDateShort } from '@/utils/helpers';
import { generateTrainingTip } from '@/services/gemini';

const TrainingPage: React.FC = () => {
  const { user } = useAuth();
  const { plans, addPlan, updatePlan, deletePlan, athletes, attendance, markAttendance } = useData();
  const isCoach = user?.role === UserRole.COACH;
  const isManager = user?.role === UserRole.MANAGER;
  const isPresident = user?.role === UserRole.PRESIDENT;
  const isAthlete = user?.role === UserRole.ATHLETE;
  const isGuardian = user?.role === UserRole.GUARDIAN;
  const canEdit = isCoach || isManager || isPresident;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingPlan | null>(null);
  const [form, setForm] = useState({ title: '', sport: Sport.SWIMMING as Sport, description: '', schedule: '', location: '' });
  const [toDelete, setToDelete] = useState<TrainingPlan | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);

  const [attOpen, setAttOpen] = useState(false);
  const [attPlanId, setAttPlanId] = useState('general');
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attList, setAttList] = useState<Record<string, boolean>>({});
  const [justify, setJustify] = useState<{ athleteId: string; planId: string; date: string; name: string } | null>(null);
  const [justifyText, setJustifyText] = useState('');

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', sport: Sport.SWIMMING, description: '', schedule: '', location: '' });
    setModalOpen(true);
  };

  const openEdit = (p: TrainingPlan) => {
    setEditing(p);
    setForm({ title: p.title, sport: p.sport, description: p.description, schedule: p.schedule, location: p.location });
    setModalOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updatePlan(editing.id, form);
    } else {
      addPlan(form);
    }
    setModalOpen(false);
  };

  const runTip = async () => {
    setTipLoading(true);
    const sport = plans.length ? plans[0].sport : Sport.SWIMMING;
    setTip(await generateTrainingTip(sport));
    setTipLoading(false);
  };

  const openAttendance = () => {
    const d = new Date().toISOString().slice(0, 10);
    const list: Record<string, boolean> = {};
    athletes.forEach((a) => {
      const rec = attendance.find((r) => r.athleteId === a.id && r.date === d);
      list[a.id] = rec ? rec.present : true;
    });
    setAttDate(d);
    setAttPlanId('general');
    setAttList(list);
    setAttOpen(true);
  };

  const toggleAll = (v: boolean) => setAttList(Object.fromEntries(Object.keys(attList).map((k) => [k, v])));

  const saveAttendance = () => {
    Object.keys(attList).forEach((athleteId) => {
      markAttendance(athleteId, attPlanId, attDate, attList[athleteId]);
    });
    setAttOpen(false);
  };

  const wardIds = useMemo(() => (user?.athleteId ? [user.athleteId] : []), [user]);
  const myAtt = useMemo(
    () => attendance.filter((r) => wardIds.includes(r.athleteId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [attendance, wardIds],
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = attendance.filter((r) => r.date === today);
  const todayPresent = todayRecords.filter((r) => r.present).length;
  const todayAbsent = todayRecords.filter((r) => !r.present).length;
  const presentPct = todayRecords.length ? Math.round((todayPresent / todayRecords.length) * 100) : null;

  const planLabel = (id: string) => plans.find((p) => p.id === id)?.title || (id === 'general' ? 'تدريب جماعي عام' : 'حصة تدريب');

  const submitJustify = () => {
    if (!justify || !justifyText.trim()) return;
    markAttendance(justify.athleteId, justify.planId, justify.date, false, justifyText.trim());
    setJustify(null);
    setJustifyText('');
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#D4AF37] font-bold text-sm';

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-[#0B121E]">
            التدريب <span className="text-[#007377]">والبرمجة</span>
          </h2>
          <p className="text-gray-400 font-medium italic">برامج التدريب، رصد الحضور، وتوجيه الأفواج</p>
        </div>
        {canEdit && (
          <div className="flex gap-3 flex-wrap">
            <button onClick={openAttendance} className="flex items-center gap-3 px-6 py-4 bg-[#007377] text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all">
              <ClipboardCheck size={20} /> تسجيل حضور
            </button>
            <button onClick={openAdd} className="luxury-gradient-gold text-[#0B121E] px-8 py-4 rounded-2xl font-black shadow-lg gold-glow flex items-center gap-3 active:scale-95 transition-all">
              <Plus size={20} /> إضافة برنامج
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 border-r-8 border-r-[#007377]">
          <div className="p-4 bg-teal-50 text-[#007377] rounded-2xl"><UserCheck size={28} /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest">حاضرون اليوم</p>
            <p className="text-2xl font-black text-[#0B121E]">{todayPresent}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 border-r-8 border-r-red-400">
          <div className="p-4 bg-red-50 text-red-500 rounded-2xl"><UserX size={28} /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest">غائبون اليوم</p>
            <p className="text-2xl font-black text-[#0B121E]">{todayAbsent}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 border-r-8 border-r-[#D4AF37]">
          <div className="p-4 bg-yellow-50 text-[#D4AF37] rounded-2xl"><Check size={28} /></div>
          <div>
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest">نسبة الحضور</p>
            <p className="text-2xl font-black text-[#0B121E]">{presentPct === null ? '—' : `${presentPct}%`}</p>
          </div>
        </div>
      </div>

      {!canEdit && wardIds.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
            <ClipboardCheck className="text-[#007377]" size={22} /> سجل حضورك
          </h3>
          {myAtt.length === 0 && <p className="text-sm text-gray-400">لا توجد سجلات حضور بعد في حسابك.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myAtt.map((r) => (
              <div key={r.id} className={`p-5 rounded-2xl border ${r.present ? 'bg-teal-50/60 border-teal-100' : 'bg-red-50/50 border-red-100'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-black text-[#0B121E] text-sm">الحصة: {planLabel(r.planId)}</p>
                    <p className="text-[11px] text-gray-400 font-bold mt-1">{formatDateShort(r.date)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black ${r.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.present ? 'حاضر' : 'غائب'}
                  </span>
                </div>
                {!r.present &&
                  (r.note ? (
                    <p className="mt-3 text-xs font-bold text-gray-500 bg-white rounded-xl p-3">تبرير: {r.note}</p>
                  ) : (
                    <button
                      onClick={() => setJustify({ athleteId: r.athleteId, planId: r.planId, date: r.date, name: athletes.find((a) => a.id === r.athleteId)?.name || '' })}
                      className="mt-3 w-full py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl font-black text-xs hover:border-[#D4AF37] hover:text-[#B8860B] transition-all"
                    >
                      تبرير الغياب
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#0B121E] p-10 rounded-[3.5rem] text-white flex flex-col justify-center items-center text-center relative overflow-hidden">
          <Trophy size={56} className="text-[#D4AF37] mb-4" />
          <h4 className="text-2xl font-black mb-2">تنبيه المدرب</h4>
          <p className="text-gray-400 text-sm leading-relaxed italic">
            "ركّزوا اليوم على قوة الركلة تحت الماء بعد الدوران (Streamline). المراقبة الرقمية ستكون صارمة."
          </p>
          {tip && (
            <p className="mt-5 p-5 bg-white/5 rounded-2xl border border-[#D4AF37]/20 text-[#D4AF37] text-sm leading-relaxed not-italic">
              <Sparkles size={14} className="inline ml-2" />
              {tip}
            </p>
          )}
          <button
            onClick={runTip}
            disabled={tipLoading}
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#D4AF37] hover:bg-[#B8860B] text-[#0B121E] rounded-2xl font-black transition-all active:scale-95 disabled:opacity-60"
          >
            {tipLoading ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
            نصيحة ذكية
          </button>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm col-span-1">
          <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
            <Clock className="text-[#007377]" size={22} /> حصص اليوم (أمسية)
          </h3>
          <div className="space-y-4">
            <div className="p-5 bg-gray-50 rounded-2xl border-r-4 border-[#007377] flex justify-between items-center">
              <div>
                <p className="font-bold text-[#0B121E]">إحماء عام (600م)</p>
                <span className="text-[10px] text-gray-400 uppercase">17:00 - 17:30</span>
              </div>
              <Check className="text-green-500" />
            </div>
            <div className="p-5 bg-blue-50/30 rounded-2xl border-r-4 border-blue-500 flex justify-between items-center animate-pulse">
              <div>
                <p className="font-bold text-[#0B121E]">تمارين السرعة والهجوم</p>
                <span className="text-[10px] text-blue-500 font-black">جارٍ الآن</span>
              </div>
              <Activity className="text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {plans.map((p) => (
          <div key={p.id} className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden group border-r-8 border-r-[#007377]">
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#007377]/10 text-[#007377] rounded-2xl group-hover:scale-110 transition-transform">
                  <Activity size={22} />
                </div>
                <div>
                  <BadgeChip label={p.sport} className={SPORT_STYLE[p.sport].badge} />
                  <p className="text-[10px] text-gray-400 font-bold mt-1">{formatDate(p.createdAt)}</p>
                </div>
              </div>
            </div>
            <h3 className="text-xl font-black text-[#0B121E] mb-2">{p.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{p.description}</p>
            <div className="space-y-1.5 text-xs font-bold text-gray-500">
              <p className="flex items-center gap-2"><Clock size={13} className="text-[#D4AF37]" /> {p.schedule}</p>
              <p className="flex items-center gap-2"><Activity size={13} className="text-[#D4AF37]" /> {p.location}</p>
            </div>
            {canEdit && (
              <div className="flex gap-2 mt-6 pt-4 border-t border-gray-50">
                <button onClick={() => openEdit(p)} className="flex-1 py-3 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:text-[#007377] hover:bg-white transition-all flex items-center justify-center gap-2">
                  <Pencil size={14} /> تعديل
                </button>
                <button onClick={() => setToDelete(p)} className="px-5 py-3 bg-gray-50 text-gray-400 rounded-2xl font-bold hover:text-red-500 hover:bg-white transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full">
            <EmptyState title="لا توجد برامج تدريب" hint="ابدأ بإضافة برنامج جديد." />
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل برنامج' : 'إضافة برنامج تدريب'} subtitle="البرمجة الرياضية - نادي الصدارة" accent="teal" maxWidth="max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">عنوان البرنامج</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: تدريب المسافات" className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الرياضة</label>
            <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })} className={inputCls}>
              {Object.values(Sport).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الوصف</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="تفاصيل الحصة التدريبية..." className={inputCls}></textarea>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المواعيد</label>
              <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="مثال: السبت والثلاثاء - 16:00" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الموقع</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مكان التدريب" className={inputCls} />
            </div>
          </div>
          <button type="submit" className="w-full py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl">
            {editing ? 'حفظ التعديل' : 'إضافة البرنامج'}
          </button>
        </form>
      </Modal>

      <Modal open={attOpen} onClose={() => setAttOpen(false)} title="تسجيل حضور الحصة" subtitle="رصد حضور الأفواج - نادي الصدارة" accent="teal" maxWidth="max-w-xl">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الحصة / البرنامج</label>
              <select value={attPlanId} onChange={(e) => setAttPlanId(e.target.value)} className={inputCls}>
                <option value="general">تدريب جماعي عام</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">التاريخ</label>
              <input type="date" required value={attDate} onChange={(e) => setAttDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-between items-center px-2">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">قائمة الرياضيين</p>
            <div className="flex gap-2 text-[10px] font-black">
              <button type="button" onClick={() => toggleAll(true)} className="px-3 py-1.5 rounded-xl border bg-teal-50 border-teal-200 text-teal-700">الكل حاضر</button>
              <button type="button" onClick={() => toggleAll(false)} className="px-3 py-1.5 rounded-xl border bg-red-50 border-red-200 text-red-600">الكل غائب</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {athletes.map((a) => (
              <label key={a.id} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${attList[a.id] ? 'bg-teal-50/60 border-teal-100' : 'bg-red-50/30 border-red-100'}`}>
                <div className="flex items-center gap-3">
                  <span className="font-black text-[#0B121E] text-sm">{a.name} {a.lastName}</span>
                  <span className="text-[10px] text-gray-400 font-bold">{a.registrationNumber}</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!attList[a.id]}
                  onChange={(e) => setAttList((p) => ({ ...p, [a.id]: e.target.checked }))}
                  className="w-5 h-5 accent-[#007377]"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={saveAttendance} className="w-full py-4 bg-[#007377] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all">
            حفظ الحضور ({Object.values(attList).filter(Boolean).length} / {athletes.length} حاضر)
          </button>
        </div>
      </Modal>

      {justify && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B121E]/80 backdrop-blur-md p-4 animate-in fade-in duration-300 no-print">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 border border-[#D4AF37]/20">
            <h3 className="text-xl font-black text-[#0B121E] mb-1">تبرير غياب — {justify.name}</h3>
            <p className="text-xs text-gray-400 font-bold mb-5">{formatDateShort(justify.date)} • {planLabel(justify.planId)}</p>
            <textarea
              rows={3}
              value={justifyText}
              onChange={(e) => setJustifyText(e.target.value)}
              placeholder="اكتب سبب الغياب (طبي، عائلي، نقل...) المصادق عليه"
              className={inputCls}
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button onClick={submitJustify} disabled={!justifyText.trim()} className="flex-1 py-4 bg-[#007377] text-white rounded-2xl font-black disabled:opacity-40 active:scale-95 transition-all">
                إرسال التبرير
              </button>
              <button onClick={() => setJustify(null)} className="px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black hover:text-red-500 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        message={<>حذف البرنامج <b className="text-[#0B121E]">{toDelete?.title}</b> نهائياً؟</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deletePlan(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default TrainingPage;