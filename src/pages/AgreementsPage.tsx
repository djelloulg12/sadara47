import React, { useState } from 'react';
import { Building2, FileSignature, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useData } from '@/context';
import { Agreement } from '@/types';
import { formatDate } from '@/utils/helpers';

const AgreementsPage: React.FC = () => {
  const { agreements, addAgreement, updateAgreement, deleteAgreement } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agreement | null>(null);
  const [form, setForm] = useState({ name: '', institution: '', reference: '', status: 'نشطة' as Agreement['status'] });
  const [toDelete, setToDelete] = useState<Agreement | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', institution: '', reference: '', status: 'نشطة' });
    setModalOpen(true);
  };

  const openEdit = (a: Agreement) => {
    setEditing(a);
    setForm({ name: a.name, institution: a.institution, reference: a.reference, status: a.status });
    setModalOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateAgreement(editing.id, form);
    } else {
      addAgreement(form);
    }
    setModalOpen(false);
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#D4AF37] font-bold text-sm';

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-[#0B121E]">
            الاتفاقيات <span className="text-[#007377]">المتعاهدات</span>
          </h2>
          <p className="text-gray-400 font-medium italic">إدارة الاتفاقيات المؤسسية المعتمدة التي تُغذّي قائمة الاشتراك في بوابة الإخراط</p>
        </div>
        <button
          onClick={openAdd}
          className="luxury-gradient-gold text-[#0B121E] px-8 py-4 rounded-2xl font-black shadow-lg gold-glow flex items-center gap-3 active:scale-95 transition-all"
        >
          <Plus size={20} /> إضافة اتفاقية
        </button>
      </div>

      {agreements.length === 0 && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
          <EmptyState title="لا توجد اتفاقيات" hint="أضف اتفاقية مؤسسية لتظهر في نموذج التسجيل." />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {agreements.map((a) => (
          <div key={a.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden border-r-8 border-r-[#007377]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#007377]/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-[#007377]/10 text-[#007377] rounded-2xl">
                  <FileSignature size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0B121E]">{a.name}</h3>
                  <p className="text-xs text-gray-400 font-bold mt-1 flex items-center gap-1.5">
                    <Building2 size={12} /> {a.institution}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${a.status === 'نشطة' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {a.status}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-50 pt-5 mt-4 relative z-10">
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">المرجع • أُضيفت</p>
                <p className="text-xs font-black text-[#0B121E] mt-1" dir="ltr">{a.reference || '—'}</p>
              </div>
              <p className="text-[11px] text-gray-400 font-bold">{formatDate(a.createdAt)}</p>
              <div className="flex gap-2">
                <button onClick={() => openEdit(a)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-[#D4AF37] transition-all">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setToDelete(a)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 p-5 bg-teal-50 border border-teal-100 rounded-3xl text-teal-800 text-xs font-bold">
        <Building2 size={18} className="shrink-0" />
        تظهر الاتفاقيات النشطة هنا قائمة منسدلة ديناميكية في خطوة «نوع الاشتراك» ببوابة الإخراط.
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل اتفاقية' : 'إضافة اتفاقية مؤسسية'} subtitle="المتعاهدات المعتمدة - نادي الصدارة" accent="teal" maxWidth="max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">اسم الاتفاقية</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: اتفاقية المدرسة الوطنية للرياضات الأولمبية" className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المؤسسة الشريكة</label>
            <input required value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="المؤسسة / الإدارة" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المرجع</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="AGR-2026-000" className={`${inputCls} font-mono`} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Agreement['status'] })} className={inputCls}>
                <option value="نشطة">نشطة</option>
                <option value="منتهية">منتهية</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl">
            {editing ? 'حفظ التعديل' : 'إضافة الاتفاقية'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        message={<>حذف الاتفاقية <b className="text-[#0B121E]">{toDelete?.name}</b> نهائياً؟</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteAgreement(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default AgreementsPage;