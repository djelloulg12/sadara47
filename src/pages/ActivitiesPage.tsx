import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  ClipboardList,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trophy,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useAuth, useData } from '@/context';
import { ClubActivity, NotificationType, UserRole } from '@/types';
import { formatDate } from '@/utils/helpers';

const ACTIVITY_TYPES = ['بطولة', 'تربوي', 'انتقاء', 'رسمي', 'تدريب', 'ندوة'];
const ACTIVITY_STATUS = ['ريان', 'تحضير'];

const ActivitiesPage: React.FC = () => {
  const { user } = useAuth();
  const { activities, addActivity, updateActivity, deleteActivity, athletes, addNotification } = useData();
  const canEdit = !!user && (user.role === UserRole.PRESIDENT || user.role === UserRole.MANAGER);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClubActivity | null>(null);
  const [form, setForm] = useState({ title: '', date: '', location: '', type: ACTIVITY_TYPES[0], status: ACTIVITY_STATUS[0], description: '', participants: [] as string[] });
  const [selected, setSelected] = useState<ClubActivity | null>(null);
  const [toDelete, setToDelete] = useState<ClubActivity | null>(null);
  const [toast, setToast] = useState<{ text: string } | null>(null);

  const showToast = (text: string) => {
    setToast({ text });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', date: '', location: '', type: ACTIVITY_TYPES[0], status: ACTIVITY_STATUS[0], description: '', participants: [] });
    setModalOpen(true);
  };

  const openEdit = (ev: ClubActivity) => {
    setEditing(ev);
    setForm({ title: ev.title, date: ev.date, location: ev.location, type: ev.type, status: ev.status, description: ev.description, participants: ev.participants || [] });
    setModalOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const { title, date, location, type, status, description, participants } = form;
      updateActivity(editing.id, { title, date, location, type, status, description, participants });
    } else {
      addActivity(form);
    }
    setModalOpen(false);
  };

  const toggleParticipant = (id: string) =>
    setForm((p) => ({ ...p, participants: p.participants.includes(id) ? p.participants.filter((x) => x !== id) : [...p.participants, id] }));

  const notifyParticipants = (ev: ClubActivity, type: NotificationType, body: string) => {
    const ids = (ev.participants || []).filter(Boolean);
    addNotification({
      type,
      title: ev.title,
      body,
      fromName: user?.name || 'إدارة النادي',
      athleteId: undefined,
      toUserIds: ids,
    });
    showToast('تم إرسال الإعلان إلى كل المشاركين المسجلين');
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#D4AF37] font-bold text-sm';

  return (
    <div className="space-y-8 animate-fade-up relative">
      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-[#0B121E] text-[#D4AF37] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#D4AF37]/30 animate-in slide-in-from-top-4">
          <Check size={20} />
          <span className="font-black text-sm">{toast.text}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-[#1A3A5F]">نشاطات النادي</h2>
          <p className="text-gray-500 mt-1">الجدول الزمني للفعاليات والبطولات للموسم الحالي</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-3 bg-[#D4AF37] text-white px-8 py-4 rounded-[20px] font-bold shadow-xl hover:bg-[#B8860B] transition-all transform hover:-translate-y-1 active:scale-95 gold-glow"
          >
            <Plus size={20} /> إضافة نشاط جديد
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#1A3A5F] to-[#2c527a] p-6 rounded-[32px] text-white relative overflow-hidden shadow-xl hover:shadow-2xl transition-all">
          <Zap className="absolute top-[-20px] left-[-20px] text-white/10 w-32 h-32" />
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2">الفعالية القادمة</h3>
            <p className="text-3xl font-black text-[#D4AF37]">بعد {Math.max(1, activities.filter((a) => a.status === 'ريان').length || 1)} أيام</p>
            <p className="text-xs text-white/60 mt-4">تابع الجدول الزمني للموسم</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 hover:border-[#D4AF37]/30 transition-all">
          <div className="p-4 bg-yellow-50 text-[#D4AF37] rounded-2xl shadow-inner">
            <Trophy size={32} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">أهداف الموسم</p>
            <p className="text-xl font-black text-[#1A3A5F]">06 ميداليات ذهبية</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
            <Users size={32} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">فعاليات مسجلة</p>
            <p className="text-xl font-black text-[#1A3A5F">{activities.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {activities.map((ev) => (
          <div key={ev.id} className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden border-r-8 border-r-[#D4AF37]">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#D4AF37]/10 text-[#D4AF37] rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
                  <Calendar size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">{ev.type}</span>
                  <h3 className="text-2xl font-black text-[#1A3A5F]">{ev.title}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black shadow-sm ${ev.status === 'ريان' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {ev.status}
                </span>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(ev)} className="p-2 text-gray-300 hover:text-[#D4AF37] transition-all">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setToDelete(ev)} className="p-2 text-gray-300 hover:text-red-500 transition-all">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <Clock size={16} className="text-[#D4AF37]" />
                <span className="font-bold">{formatDate(ev.date)}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <MapPin size={16} className="text-[#D4AF37]" />
                <span>{ev.location}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <ClipboardList size={16} className="text-[#D4AF37]" />
                <span>{ev.participants?.length || 0} رياضي مسجل</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelected(ev)} className="flex-1 py-4 bg-[#1A3A5F] text-white rounded-2xl font-bold shadow-lg hover:bg-[#0d2138] hover:-translate-y-0.5 transition-all active:scale-95">
                عرض التفاصيل
              </button>
              <button onClick={() => showToast('تم نسخ نص الفعالية للمشاركة')} className="px-6 py-4 border-2 border-[#D4AF37] text-[#D4AF37] rounded-2xl font-bold hover:bg-[#D4AF37] hover:text-white hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2 shadow-sm">
                <Share2 size={18} /> مشاركة
              </button>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="col-span-full bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
            <EmptyState title="لا توجد فعاليات" hint="أضف أول فعالية للنادي." />
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل فعالية' : 'إضافة نشاط جديد'} subtitle="الجدول الزمني للنادي" accent="gold" maxWidth="max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">عنوان الفعالية</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: كأس الصدارة الشتوي" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">التاريخ</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المكان</label>
              <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="المكان" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">النوع</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {ACTIVITY_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الوصف</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف الفعالية..." className={inputCls}></textarea>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الرياضيون المشاركون</label>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {athletes.map((a) => (
                <label key={a.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${form.participants.includes(a.id) ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40' : 'bg-gray-50 border-gray-100'}`}>
                  <span className="text-sm font-black text-[#1A3A5F]">{a.name} {a.lastName}</span>
                  <input type="checkbox" checked={form.participants.includes(a.id)} onChange={() => toggleParticipant(a.id)} className="w-4 h-4 accent-[#D4AF37]" />
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl gold-glow">
            {editing ? 'حفظ التعديل' : 'إضافة الفعالية'}
          </button>
        </form>
      </Modal>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B121E]/80 backdrop-blur-md p-4 animate-in fade-in duration-300 no-print">
          <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-[#D4AF37]/20 relative">
            <button onClick={() => setSelected(null)} className="absolute top-6 left-6 p-2 text-gray-400 hover:text-red-500 transition-colors z-10">
              <X size={24} />
            </button>
            <div className="luxury-gradient-navy p-12 text-center text-white relative">
              <Calendar className="text-[#D4AF37] mx-auto mb-4" size={48} />
              <h3 className="text-3xl font-black">{selected.title}</h3>
              <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest mt-2">{selected.type} • {selected.status}</p>
            </div>
            <div className="p-10 space-y-6">
              <p className="text-gray-600 leading-relaxed text-center font-medium">{selected.description || 'لا يوجد وصف لهذه الفعالية.'}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center">
                  <Clock className="text-[#D4AF37] mb-1" size={16} />
                  <span className="text-[10px] text-gray-400 uppercase font-black">التاريخ</span>
                  <span className="text-sm font-black text-[#1A3A5F]">{formatDate(selected.date)}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center">
                  <MapPin className="text-[#D4AF37] mb-1" size={16} />
                  <span className="text-[10px] text-gray-400 uppercase font-black">المكان</span>
                  <span className="text-sm font-black text-[#1A3A5F]">{selected.location}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ClipboardList size={14} className="text-[#D4AF37]" /> المشاركون ({selected.participants?.length || 0})
                </p>
                {selected.participants?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {athletes.filter((a) => selected.participants?.includes(a.id)).map((a) => (
                      <span key={a.id} className="px-3 py-1.5 bg-white rounded-full text-xs font-bold text-[#1A3A5F] border border-gray-200">
                        {a.name} {a.lastName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-bold">لم يُسجل مشاركون بعد.</p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => notifyParticipants(selected, 'competition', `أنتم مسجلون في فعالية «${selected.title}» بتاريخ ${formatDate(selected.date)} - نادي الصدارة`)} className="flex-1 py-4 bg-[#D4AF37] text-white rounded-2xl font-black shadow-lg hover:bg-[#B8860B] transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Bell size={18} /> إعلان للمشاركين
                </button>
                <button onClick={() => setSelected(null)} className="px-8 py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl gold-glow hover:-translate-y-1 transition-all">
                  حسناً، فهمت
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        message={<>حذف الفعالية <b className="text-[#0B121E]">{toDelete?.title}</b> نهائياً؟</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteActivity(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default ActivitiesPage;