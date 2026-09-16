import React, { useState } from 'react';
import { Calendar, Eye, EyeOff, FileText, Gavel, Plus, ShieldAlert, Trash2, User } from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useData } from '@/context';
import { DisciplinaryCase } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  REPORTED: 'قيد التبليغ',
  APPEALED: 'قيد الاستئناف',
  FINAL: 'قرار نهائي',
};

const DisciplinaryPage: React.FC = () => {
  const { disciplinary, addDisciplinary, updateDisciplinary, deleteDisciplinary } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DisciplinaryCase | null>(null);
  const [form, setForm] = useState({ targetName: '', targetId: 'a', targetRole: 'ATHLETE' as 'ATHLETE' | 'COACH', reporterName: '', reason: '', date: '', status: 'REPORTED' as DisciplinaryCase['status'], internal: false, finalDecision: '' });
  const [toDelete, setToDelete] = useState<DisciplinaryCase | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({ targetName: '', targetId: 'a', targetRole: 'ATHLETE', reporterName: '', reason: '', date: new Date().toISOString().slice(0, 10), status: 'REPORTED', internal: false, finalDecision: '' });
    setModalOpen(true);
  };

  const openEdit = (c: DisciplinaryCase) => {
    setEditing(c);
    setForm({ targetName: c.targetName, targetId: c.targetId, targetRole: c.targetRole, reporterName: c.reporterName, reason: c.reason, date: c.date, status: c.status, internal: !!c.internal, finalDecision: c.finalDecision || '' });
    setModalOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    if (editing) {
      updateDisciplinary(editing.id, payload);
    } else {
      addDisciplinary(payload);
    }
    setModalOpen(false);
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-red-500 font-bold text-sm';

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-4xl font-black text-[#0B121E]">
          سجل <span className="text-red-600">الانضباط</span>
        </h2>
        <p className="text-gray-400 font-medium italic">مراقبة الالتزام بالقوانين الداخلية لنادي الصدارة</p>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-3xl">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#0B121E]">القضايا الانضباطية</h3>
            <p className="text-sm font-medium text-gray-400 italic">{disciplinary.length} قضية مسجلة</p>
          </div>
        </div>
        <button onClick={openAdd} className="luxury-gradient-gold text-[#0B121E] px-8 py-4 rounded-2xl font-black shadow-lg gold-glow flex items-center gap-3 active:scale-95 transition-all">
          <Plus size={20} /> تسجيل مخالفة جديدة
        </button>
      </div>

      <div className="space-y-6">
        {disciplinary.map((c) => {
          const barColor = c.status === 'REPORTED' ? 'bg-amber-400' : c.status === 'APPEALED' ? 'bg-blue-400' : 'bg-red-600';
          const badge =
            c.status === 'REPORTED'
              ? 'bg-amber-100 text-amber-700'
              : c.status === 'APPEALED'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700';
          return (
            <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-2 h-full ${barColor}`}></div>
              <div className="flex items-center gap-6 flex-1">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-red-600 font-black text-xl border border-gray-100">!</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h4 className="text-xl font-black text-[#0B121E]">{c.targetName}</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">
                      {c.targetRole === 'ATHLETE' ? 'رياضي' : 'كادر فني'}
                    </span>
                    {c.internal && (
                      <span className="text-[10px] font-black px-2 py-0.5 bg-[#0B121E] text-[#D4AF37] rounded-md uppercase tracking-widest flex items-center gap-1">
                        <EyeOff size={10} /> داخلي · سري
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-medium max-w-xl">{c.reason}</p>
                  <div className="flex gap-4 mt-3">
                    <span className="text-[10px] font-black text-gray-400 flex items-center gap-1">
                      <Calendar size={12} /> {c.date}
                    </span>
                    <span className="text-[10px] font-black text-gray-400 flex items-center gap-1">
                      <User size={12} /> المبلغ: {c.reporterName}
                    </span>
                  </div>
                  {c.finalDecision && (
                    <p className="mt-3 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                      القرار النهائي: {c.finalDecision}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 min-w-[180px]">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${badge}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-[#0B121E] transition-all">
                    <FileText size={16} />
                  </button>
                  <button onClick={() => setToDelete(c)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {disciplinary.length === 0 && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
            <EmptyState title="لا توجد قضايا انضباطية" hint="النادي ملتزم، رائع!" />
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل قضية انضباطية' : 'تسجيل مخالفة جديدة'} subtitle="نظام الامتثال القانوني والداخلي" accent="red" maxWidth="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المعني بالأمر</label>
              <input required value={form.targetName} onChange={(e) => setForm({ ...form, targetName: e.target.value })} placeholder="اسم الرياضي أو الكادر" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الفئة</label>
              <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value as 'ATHLETE' | 'COACH' })} className={inputCls}>
                <option value="ATHLETE">رياضي</option>
                <option value="COACH">كادر فني</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المبلغ</label>
              <input value={form.reporterName} onChange={(e) => setForm({ ...form, reporterName: e.target.value })} placeholder="من قام بالتبليغ؟" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">التاريخ</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">تفاصيل المخالفة</label>
            <textarea rows={3} required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="اشرح المخالفة بالتفصيل..." className={inputCls}></textarea>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الحالة</label>
            <div className="flex gap-3">
              {(['REPORTED', 'APPEALED', 'FINAL'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black border transition-all ${
                    form.status === s ? 'luxury-gradient-navy text-white shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          {form.status === 'FINAL' && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">القرار النهائي</label>
              <textarea rows={2} value={form.finalDecision} onChange={(e) => setForm({ ...form, finalDecision: e.target.value })} placeholder="القرار الصادر (إيقاف، إنذار، دفع، فسخ...)" className={inputCls}></textarea>
            </div>
          )}
          <label className="flex items-center gap-3 p-4 bg-[#0B121E]/[0.03] rounded-2xl cursor-pointer hover:bg-[#0B121E]/[0.05] transition-colors">
            <input type="checkbox" checked={form.internal} onChange={(e) => setForm({ ...form, internal: e.target.checked })} className="w-5 h-5 accent-[#0B121E]" />
            <div className="flex-1">
              <p className="text-sm font-black text-[#0B121E] flex items-center gap-2">
                {form.internal ? <EyeOff size={15} /> : <Eye size={15} />} ملاحظة داخلية سرية
              </p>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">تظهر للإدارة فقط ولا يطّلع عليها الرياضي أو وليّه.</p>
            </div>
          </label>
          <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-[1.5rem] font-black shadow-xl hover:bg-red-700 active:scale-95 transition-all mt-2">
            {editing ? 'حفظ التعديلات' : 'تأكيد تسجيل المخالفة'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={<>حذف قضية <b className="text-[#0B121E]">{toDelete?.targetName}</b> نهائياً من السجل؟</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteDisciplinary(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default DisciplinaryPage;