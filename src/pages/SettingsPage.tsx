import React from 'react';
import { CheckCircle2, Coins, Info, Plus, RefreshCw, Settings, ToggleRight, Trash2, XCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useData } from '@/context';
import { ClubSettings } from '@/types';
import { saveValue } from '@/data';

const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#007377] transition-all';

const SettingsPage: React.FC = () => {
  const { registrationOpen, setRegistrationOpen, clubSettings, updateClubSettings } = useData();
  const [resetOpen, setResetOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ClubSettings>(() => clubSettings);
  const [saved, setSaved] = React.useState(false);

  const editTier = (i: number, key: 'name' | 'periodLabel' | 'amount', value: string | number) => {
    const next = [...draft.subscriptionTypes];
    next[i] = { ...next[i], [key]: value as never };
    setDraft({ ...draft, subscriptionTypes: next });
  };

  const addTier = () => {
    setDraft({
      ...draft,
      subscriptionTypes: [...draft.subscriptionTypes, { id: `t${Date.now()}`, name: 'نوع جديد', periodLabel: 'موسم', amount: 1000 }],
    });
  };

  const removeTier = (i: number) => {
    setDraft({ ...draft, subscriptionTypes: draft.subscriptionTypes.filter((_, x) => x !== i) });
  };

  const saveSettings = () => {
    const clean = {
      ...draft,
      subscriptionTypes: draft.subscriptionTypes.filter((t) => t.name.trim() !== ''),
      insuranceFee: Math.max(0, Number(draft.insuranceFee) || 0),
      transportFee: Math.max(0, Number(draft.transportFee) || 0),
      kitFee: Math.max(0, Number(draft.kitFee) || 0),
      defaultDiscountPct: Math.min(100, Math.max(0, Number(draft.defaultDiscountPct) || 0)),
    };
    updateClubSettings(clean);
    setDraft(clean);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 4000);
  };

  const resetData = () => {
    ['sadara47_athletes', 'sadara47_users', 'sadara47_plans', 'sadara47_applications', 'sadara47_records', 'sadara47_activities', 'sadara47_disciplinary', 'sadara47_seeded_v1'].forEach((k) =>
      localStorage.removeItem(k),
    );
    localStorage.removeItem('sadara47_session');
    saveValue('sadara47_registration_open', true);
    window.location.reload();
  };

  const renderFeeField = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="space-y-2">
      <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">{label}</label>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
    </div>
  );

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
            <Coins className="text-[#007377]" size={24} /> إعدادات الاشتراك والوصل
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            حدّد أنواع الاشتراك وقيمها؛ تنعكس على بوابة التسجيل وعلى كشكول حقوق الاشتراك والتأمين (الرقم الأخضر المؤطر + جدول الرسوم + المجموع الصافي).
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الموسم (فترة الاشتراك)</label>
              <input value={draft.season} onChange={(e) => setDraft({ ...draft, season: e.target.value })} className={inputCls} placeholder="موسم 2026 / 2027" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">أنواع الاشتراك وقيمتها (دج)</label>
                <button onClick={addTier} className="text-[11px] font-black text-[#007377] flex items-center gap-1 hover:text-[#005f63] transition-all">
                  <Plus size={12} /> إضافة نوع
                </button>
              </div>
              <div className="space-y-2">
                {draft.subscriptionTypes.map((t, i) => (
                  <div key={t.id} className="flex gap-2 items-center">
                    <input value={t.name} onChange={(e) => editTier(i, 'name', e.target.value)} className={inputCls} placeholder="اسم النوع" />
                    <input value={t.periodLabel} onChange={(e) => editTier(i, 'periodLabel', e.target.value)} className={`${inputCls} w-24 text-center`} placeholder="المدة" />
                    <input type="number" min={0} value={t.amount} onChange={(e) => editTier(i, 'amount', Number(e.target.value))} className={`${inputCls} w-28`} />
                    <button onClick={() => removeTier(i)} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-all shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {renderFeeField('التأمين السنوي (دج)', draft.insuranceFee, (v) => setDraft({ ...draft, insuranceFee: v }))}
              {renderFeeField('خدمة النقل (دج)', draft.transportFee, (v) => setDraft({ ...draft, transportFee: v }))}
              {renderFeeField('البدلة الرياضية (دج)', draft.kitFee, (v) => setDraft({ ...draft, kitFee: v }))}
              {renderFeeField('خصم الاتفاقية الافتراضي %', draft.defaultDiscountPct, (v) => setDraft({ ...draft, defaultDiscountPct: v }))}
            </div>

            <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl text-[11px] font-bold text-teal-800 leading-relaxed">
              بند «اشتراك العضوية» بقيمة النوع المختار في التسجيل + قسط التأمين الإجباري + النقل / البدلة عند التفعيل، ثم خصم الاتفاقية عند التطبيق والمجموع الصافي (المبلغ المدفوع).
            </div>

            <button onClick={saveSettings} className="w-full py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl active:scale-95 transition-all">
              حفظ إعدادات الاشتراك
            </button>
            {saved && (
              <p className="text-center text-xs font-black text-green-600 flex items-center justify-center gap-1">
                <CheckCircle2 size={14} /> تم حفظ الإعدادات وتطبيقها فوراً على التسجيل والوصل
              </p>
            )}
          </div>
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