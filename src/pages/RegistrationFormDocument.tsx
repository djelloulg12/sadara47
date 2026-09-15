import React from 'react';
import { Waves, ArrowRight, Printer } from 'lucide-react';
import { useAppContext } from '@/context';
import { getPrintData } from '@/data';
import { formatDate } from '@/utils/helpers';

const RegistrationFormDocument: React.FC = () => {
  const { setRoute } = useAppContext();
  const data = getPrintData();

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 gap-6">
        <p className="text-gray-500 font-bold">لا توجد بيانات للطباعة.</p>
        <button onClick={() => setRoute('register')} className="px-8 py-4 bg-[#1A3A5F] text-white rounded-2xl font-bold">
          العودة للتسجيل
        </button>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10">
      <div className="flex justify-end gap-3 mb-6 no-print">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-[#007377] text-white rounded-2xl font-bold shadow-lg">
          <Printer size={18} /> طباعة
        </button>
        <button onClick={() => setRoute('login')} className="flex items-center gap-2 px-6 py-3 bg-white text-gray-500 rounded-2xl font-bold shadow-sm">
          <ArrowRight size={18} /> عودة
        </button>
      </div>

      <div id="printable-area" className="max-w-3xl mx-auto bg-white p-10 md:p-14 rounded-md shadow-lg relative border-t-8 border-t-[#D4AF37]">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 luxury-gradient-gold rounded-2xl">
              <Waves className="text-[#0B121E]" size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1A3A5F]">نادي الصدارة الرياضي - غرداية</h1>
              <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.2em]">Club Sportif Sadara</p>
            </div>
          </div>
          <div className="text-left text-xs font-bold text-gray-400 space-y-1">
            <p>المرجع: {data.nin ? data.nin.slice(-6) : '---'}</p>
            <p>التاريخ: {today}</p>
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-[#0B121E] tracking-wide">استمارة طلب الإخراط</h2>
          <p className="text-xs text-gray-400 font-bold mt-1">بطاقة معلومات شخصية ورياضية</p>
          <div className="h-0.5 w-2/3 mx-auto bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mt-3"></div>
        </div>

        <div className="space-y-6 text-sm">
          {[
            ['الاسم واللقب', `${data.name} ${data.lastName}`],
            ['رقم التعريف الوطني NIN', data.nin || '---'],
            ['تاريخ الميلاد', formatDate(data.dob)],
            ['الجنس', data.gender],
            ['الرياضة', data.sport],
            ['الأسلوب المفضل', data.swimStyle || '—'],
            ['المستوى', data.level],
            ['الهاتف', data.phone],
            ['العنوان', data.address],
            ['فصيلة الدم', data.bloodType],
            ['ولي الأمر', data.guardianName || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-gray-400 font-bold">{label}</span>
              <span className="font-black text-[#0B121E]">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3">
          <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <span className="w-5 h-5 bg-green-500 rounded-full text-white flex items-center justify-center text-[10px]">✓</span>
            أقر بأن جميع المعلومات المذكورة صحيحة وسألتزم بالقوانين الداخلية للنادي.
          </p>
          <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <span className="w-5 h-5 bg-[#007377] rounded-full text-white flex items-center justify-center text-[10px]">✓</span>
            أوافق على معالجة بياناتي وفق القانون 18-07 لحماية المعطيات ذات الطابع الشخصي.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 mt-14 text-center">
          <div className="space-y-2">
            <div className="h-10"></div>
            <div className="border-t border-gray-300 pt-2 text-xs font-bold text-gray-500">إمضاء ولي الأمر / المترشح</div>
          </div>
          <div className="space-y-2">
            <div className="h-10"></div>
            <div className="border-t border-gray-300 pt-2 text-xs font-bold text-gray-500">ختم النادي</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationFormDocument;