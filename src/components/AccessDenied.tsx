import React from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';

const AccessDenied: React.FC<{ onHome: () => void }> = ({ onHome }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="max-w-md w-full text-center bg-[#0F172A] border border-white/10 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#EF4444]/15 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EF4444]/15 text-[#EF4444] mx-auto mb-5">
          <ShieldAlert size={30} />
        </span>
        <p className="text-[10px] font-black text-[#38BDF8] uppercase tracking-[0.25em]">403 Forbidden</p>
        <h2 className="text-2xl font-black text-white mt-3">مسار غير مصرح به</h2>
        <p className="text-sm text-white/60 mt-3 leading-relaxed">
          هذا القسم غير مفتوح لنوع حسابك الحالي وفق مصفوفة الصلاحيات. أُعيد توجيهك تلقائياً إلى لوحتك الرئيسية.
        </p>
        <button
          onClick={onHome}
          className="mt-8 inline-flex items-center gap-2 bg-[#38BDF8] hover:bg-[#0284C7] text-[#0F172A] font-black px-8 py-3.5 rounded-2xl transition-all active:scale-95"
        >
          <ArrowRight size={18} /> العودة إلى لوحتي
        </button>
      </div>
    </div>
  </div>
);

export default AccessDenied;