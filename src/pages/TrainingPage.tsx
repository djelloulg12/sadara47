import React, { useState } from 'react';
import { Activity, Check, Clock, Pencil, Plus, RefreshCw, Sparkles, Trash2, Trophy } from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { BadgeChip, SPORT_STYLE } from '@/constants';
import { useAuth, useData } from '@/context';
import { Sport, TrainingPlan, UserRole } from '@/types';
import { formatDate } from '@/utils/helpers';
import { generateTrainingTip } from '@/services/gemini';

const TrainingPage: React.FC = () => {
  const { user } = useAuth();
  const { plans, addPlan, updatePlan, deletePlan } = useData();
  const isCoach = user?.role === UserRole.COACH;
  const isManager = user?.role === UserRole.MANAGER;
  const isPresident = user?.role === UserRole.PRESIDENT;
  const canEdit = isCoach || isManager || isPresident;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingPlan | null>(null);
  const [form, setForm] = useState({ title: '', sport: Sport.SWIMMING as Sport, description: '', schedule: '', location: '' });
  const [toDelete, setToDelete] = useState<TrainingPlan | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);

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

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#D4AF37] font-bold text-sm';

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-[#0B121E]">
            التدريب <span className="text-[#007377]">والبرمجة</span>
          </h2>
          <p className="text-gray-400 font-medium italic">برامج التدريب، جدول الحصص، والتوجيه الذكي</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="luxury-gradient-gold text-[#0B121E] px-8 py-4 rounded-2xl font-black shadow-lg gold-glow flex items-center gap-3 active:scale-95 transition-all">
            <Plus size={20} /> إضافة برنامج
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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