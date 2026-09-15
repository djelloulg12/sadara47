import React from 'react';
import { CheckCircle2, Info, RefreshCw, Settings, ToggleRight, XCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useData } from '@/context';
import { saveValue } from '@/data';

const SettingsPage: React.FC = () => {
  const { registrationOpen, setRegistrationOpen } = useData();
  const [resetOpen, setResetOpen] = React.useState(false);

  const resetData = () => {
    ['sadara47_athletes', 'sadara47_users', 'sadara47_plans', 'sadara47_applications', 'sadara47_records', 'sadara47_activities', 'sadara47_disciplinary', 'sadara47_seeded_v1'].forEach((k) =>
      localStorage.removeItem(k),
    );
    localStorage.removeItem('sadara47_session');
    saveValue('sadara47_registration_open', true);
    window.location.reload();
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-4xl font-black text-[#0B121E]">
          الإعدادات <span className="text-[#007377]">والتحكم</span>
        </h2>
        <p className="text-gray-400 font-medium italic">ضبط بوابة التسجيل وبيانات المنصة</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
            <ToggleRight className="text-[#D4AF37]" size={24} /> بوابة الإخراط
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            عند فتح البوابة، يظهر رابط "بوابة التسجيل" في صفحة الدخول وتُقبل الطلبات الجديدة.
          </p>
          <button
            onClick={() => setRegistrationOpen(!registrationOpen)}
            className={`w-full flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all ${
              registrationOpen ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center gap-4">
              {registrationOpen ? (
                <CheckCircle2 className="text-green-600" size={32} />
              ) : (
                <XCircle className="text-red-500" size={32} />
              )}
              <div className="text-right">
                <p className="font-black text-[#0B121E]">{registrationOpen ? 'البوابة مفتوحة' : 'البوابة مغلقة'}</p>
                <p className="text-xs text-gray-400 font-bold">{registrationOpen ? 'يمكن للمترشحين إرسال الطلبات' : 'لا يمكن إرسال طلبات حالياً'}</p>
              </div>
            </div>
            <span className={`font-black text-sm ${registrationOpen ? 'text-green-600' : 'text-red-500'}`}>
              {registrationOpen ? 'إغلاق' : 'فتح'}
            </span>
          </button>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
            <RefreshCw className="text-red-500" size={24} /> إعادة الضبط
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            إعادة ضبط المنصة تعيد البيانات التجريبية (الرياضيين، الطلبات، النشاطات، السجل الانضباطي) إلى حالتها الأولى.
          </p>
          <button
            onClick={() => setResetOpen(true)}
            className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} /> إعادة ضبط البيانات التجريبية
          </button>
        </div>

        <div className="lg:col-span-2 bg-[#0B121E] p-10 rounded-[3rem] text-white relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-[#D4AF37]/10 rounded-full"></div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
              <Settings className="text-[#D4AF37]" size={28} />
            </div>
            <div>
              <h4 className="text-lg font-black">حول المنصة</h4>
              <p className="text-[11px] font-black text-[#D4AF37] uppercase tracking-[0.2em]">sadara47 • v1.0</p>
            </div>
          </div>
          <p className="text-sm text-white/60 leading-relaxed relative z-10">
            مثار منصة الصدارة الرقمية الموحّدة: دمجت منصة سبعينيات الحلم بالتصميم الفاخر، وقدرة التسيير الكاملة
            (أدوار، طلبات، تقارير فنية، ذكاء اصطناعي) لحماية نادي الصدارة الرياضي - غرداية. جميع البيانات محفوظة محلياً في متصفحك.
          </p>
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 mt-6 relative z-10">
            <Info size={16} className="text-[#D4AF37] shrink-0" />
            <p className="text-[11px] text-white/50">تظهر التقارير الفنية المطبوعة أرقام NIN كاملة كما هو مطلوب رسمياً؛ داخل التطبيق تُعرض مُقنّعة.</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="إعادة ضبط البيانات؟"
        message={<>سيتم حذف جميع البيانات الحالية وإعادة تحميل البيانات التجريبية الافتراضية. <b className="text-[#0B121E]">لا يمكن التراجع عن هذا الإجراء.</b></>}
        confirmLabel="نعم، إعادة الضبط"
        onCancel={() => setResetOpen(false)}
        onConfirm={resetData}
      />
    </div>
  );
};

export default SettingsPage;