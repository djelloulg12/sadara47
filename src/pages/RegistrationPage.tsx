import React, { useState } from 'react';
import {
  Waves,
  ArrowRight,
  CheckCircle2,
  User,
  Phone,
  Droplet,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import { useAppContext, useData } from '@/context';
import { setPrintData } from '@/data';
import { Gender, SkillLevel, Sport, SwimStyle } from '@/types';

const RegistrationPage: React.FC = () => {
  const { setRoute } = useAppContext();
  const { addApplication, registrationOpen } = useData();

  const [form, setForm] = useState({
    nin: '',
    name: '',
    lastName: '',
    dob: '',
    gender: Gender.MALE,
    sport: Sport.SWIMMING,
    swimStyle: SwimStyle.FREE,
    level: SkillLevel.BEGINNER,
    phone: '',
    address: '',
    bloodType: 'O+',
    guardianName: '',
    medicalClearance: false,
    consent: false,
  });
  const [success, setSuccess] = useState(false);

  const set = (key: string, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

  const inputCls =
    'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 outline-none focus:border-[#D4AF37] font-bold text-sm';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addApplication({
      nin: form.nin,
      name: form.name,
      lastName: form.lastName,
      dob: form.dob,
      gender: form.gender,
      sport: form.sport,
      swimStyle: form.sport === Sport.SWIMMING ? form.swimStyle : undefined,
      level: form.level,
      phone: form.phone,
      address: form.address,
      bloodType: form.bloodType,
      guardianName: form.guardianName,
      medicalClearance: form.medicalClearance,
    });
    setPrintData({
      nin: form.nin,
      name: form.name,
      lastName: form.lastName,
      dob: form.dob,
      gender: form.gender,
      address: form.address,
      bloodType: form.bloodType,
      phone: form.phone,
      sport: form.sport,
      guardianName: form.guardianName,
      level: form.level,
      swimStyle: form.swimStyle,
    });
    setSuccess(true);
  };

  if (!registrationOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[40px] border border-[#D4AF37]/20 shadow-2xl text-center space-y-6 animate-fade-up">
          <div className="p-6 bg-gray-100 rounded-3xl mx-auto w-fit">
            <Waves className="text-[#1A3A5F]" size={48} />
          </div>
          <h1 className="text-2xl font-black text-[#1A3A5F]">التسجيل مغلق حالياً</h1>
          <p className="text-sm text-gray-500">تم إيقاف باب الإخراط مؤقتاً. تابعنا لمعرفة موعد فتح باب التسجيل الجديد.</p>
          <button
            onClick={() => setRoute('login')}
            className="w-full py-4 bg-[#1A3A5F] text-white rounded-2xl font-bold"
          >
            العودة للدخول
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="max-w-lg w-full bg-white p-12 rounded-[40px] border border-[#D4AF37]/20 shadow-2xl text-center space-y-6 animate-fade-up">
          <div className="p-6 bg-green-50 text-green-500 rounded-3xl mx-auto w-fit">
            <CheckCircle2 size={56} />
          </div>
          <h1 className="text-3xl font-black text-[#0B121E]">تم استلام طلبك!</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            شكراً <b className="text-[#0B121E]">{form.name} {form.lastName}</b>، تم إرسال طلب الإخراط بنجاح.
            <br />
            ستتم مراجعة الطلب من قبل إدارة النادي. يمكنك تحميل أو طباعة نسخة من طلبك.
          </p>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setRoute('print-form')} className="flex-1 py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
              <Printer size={18} /> طباعة / تحميل الطلب
            </button>
            <button onClick={() => setRoute('login')} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">
              إنهاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-full h-1.5 luxury-gradient-gold"></div>
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
        <div className="text-center space-y-3">
          <div className="p-4 luxury-gradient-gold rounded-3xl gold-glow w-fit mx-auto">
            <Waves className="text-[#0B121E]" size={40} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-[#1A3A5F]">بوابة الإخراط - نادي الصدارة</h1>
          <p className="text-[#D4AF37] font-bold text-xs uppercase tracking-[0.25em]">Ghardaia • Season 2026</p>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            املأ استمارة الإخراط، وسيتواصل معك طاقم النادي بعد دراسة طلبك. جميع البيانات محمية وفق القانون 18-07.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#D4AF37]/20 p-8 md:p-12 rounded-[40px] shadow-xl space-y-8 border-t-8 border-t-[#D4AF37]">
          <div>
            <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <User className="text-[#007377]" size={22} /> المعلومات الشخصية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الاسم</label>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="الاسم" className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">اللقب</label>
                <input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="اللقب" className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">رقم التعريف الوطني NIN</label>
                <input required value={form.nin} onChange={(e) => set('nin', e.target.value)} placeholder="18 رقم" className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">تاريخ الميلاد</label>
                <input required type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الجنس</label>
                <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">فصيلة الدم</label>
                <select value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)} className={inputCls}>
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <Droplet className="text-[#007377]" size={22} /> الاختيار الرياضي
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الرياضة</label>
                <select value={form.sport} onChange={(e) => set('sport', e.target.value)} className={inputCls}>
                  {Object.values(Sport).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {form.sport === Sport.SWIMMING && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الأسلوب المفضل</label>
                  <select value={form.swimStyle} onChange={(e) => set('swimStyle', e.target.value)} className={inputCls}>
                    {Object.values(SwimStyle).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">المستوى الرياضي</label>
                <select value={form.level} onChange={(e) => set('level', e.target.value)} className={inputCls}>
                  {Object.values(SkillLevel).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">ولي الأمر (للقاصرين)</label>
                <input value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} placeholder="الاسم الكامل" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
              <Phone className="text-[#007377]" size={22} /> التواصل
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الهاتف</label>
                <input required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05/06..." className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">العنوان</label>
                <input required value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="الحي - البلدية" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <label className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:border-[#007377]/40 transition-all">
              <input type="checkbox" required checked={form.medicalClearance} onChange={(e) => set('medicalClearance', e.target.checked)} className="w-5 h-5 accent-[#007377]" />
              <span className="text-sm font-bold text-[#0B121E]">أقر بإرفاق كشف طبي ساري المفعول عند أول حصة تدريبية</span>
            </label>
            <label className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:border-[#D4AF37]/40 transition-all">
              <input type="checkbox" required checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="w-5 h-5 accent-[#D4AF37]" />
              <span className="text-sm font-bold text-[#0B121E] flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#007377] shrink-0" />
                أوافق على معالجة بياناتي وفق القانون 18-07 المتعلق بحماية المعطيات ذات الطابع الشخصي
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!form.consent || !form.medicalClearance}
            className="w-full py-5 luxury-gradient-gold text-[#0B121E] rounded-[1.5rem] font-black shadow-xl gold-glow hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:pointer-events-none"
          >
            إرسال طلب الإخراط <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegistrationPage;