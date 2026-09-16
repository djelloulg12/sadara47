import React, { useRef, useState } from 'react';
import { ArrowRight, Award, BadgeCheck, CheckCircle2, FileUp, GraduationCap, Loader2, Send, UserPlus } from 'lucide-react';
import { useAppContext, useData } from '@/context';
import logo from '@/assets/logo.png';

const inputCls =
  'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#007377] transition-all text-right font-bold text-sm';
const labelCls = 'block text-xs font-black text-[#0B121E] mb-1.5';

const CoachApplyPage: React.FC = () => {
  const { setRoute } = useAppContext();
  const { addCoachApplication } = useData();
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: '',
    lastName: '',
    dob: '',
    phone: '',
    email: '',
    address: '',
    specialty: '',
    experienceYears: '',
    diploma: '',
    diplomaYear: '',
    certifications: '',
    references: '',
    bio: '',
  });
  const [files, setFiles] = useState<string[]>([]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const nextFiles: string[] = [];
    Array.from(list)
      .slice(0, 4)
      .forEach((f) => {
        if (!f.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
          nextFiles.push(reader.result as string);
          setFiles((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(f);
      });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const required = [form.name, form.lastName, form.phone, form.specialty, form.diploma];
    if (required.some((v) => !v.trim())) return;
    setSaving(true);
    setTimeout(() => {
      addCoachApplication({
        name: form.name.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        specialty: form.specialty.trim(),
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        diploma: form.diploma.trim(),
        diplomaYear: form.diplomaYear || undefined,
        certifications: form.certifications.trim() || undefined,
        certificateFiles: files,
        references: form.references.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });
      setDone(true);
      setSaving(false);
    }, 400);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="bg-white max-w-md w-full text-center p-10 rounded-[32px] border border-[#D4AF37]/30 shadow-2xl border-t-8 border-t-emerald-500 animate-fade-up">
          <CheckCircle2 size={56} className="mx-auto mb-5 text-emerald-500" />
          <h1 className="text-xl font-black text-[#0B121E]">تم إرسال طلب الانضمام بنجاح</h1>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            سيراجع مكتب المسير ملفك والشهادات المرفقة وسيتواصل معك مع إنشاء حسابك الرسمي عند القبول.
          </p>
          <button
            onClick={() => setRoute('login')}
            className="mt-8 inline-flex items-center gap-2 bg-[#0B121E] text-white font-bold px-8 py-3 rounded-2xl hover:bg-[#1A3A5F] transition-colors"
          >
            <ArrowRight size={17} />
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src={logo} alt="شعار النادي" className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37] shadow-lg" />
          <button onClick={() => setRoute('login')} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#007377] transition-colors">
            <ArrowRight size={16} />
            العودة
          </button>
        </div>

        <div className="bg-[#0B121E] rounded-[28px] p-8 md:p-10 text-white text-center relative overflow-hidden mt-2">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#D4AF37]/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-black text-[#D4AF37] uppercase tracking-widest">
              <UserPlus size={14} />
              قفزة جديدة إلى الطاقم الفني
            </span>
            <h1 className="text-2xl md:text-3xl font-black mt-5">طلب الانضمام إلى مدربي النادي</h1>
            <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xl mx-auto">
              عبّئ كامل معلوماتك المهنية وأرفق الشهادات والرخص المعتمدة — يُراجع الطلب من طرف مكتب المسير.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-[28px] shadow-xl border border-gray-100 p-6 md:p-8 mt-6 space-y-7">
          {/* البيانات الشخصية */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 font-black text-[#0B121E] text-sm">
              <span className="w-8 h-8 rounded-xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center text-xs">1</span>
              البيانات الشخصية
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>الاسم *</label>
                <input required value={form.name} onChange={set('name')} placeholder="الاسم" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>اللقب *</label>
                <input required value={form.lastName} onChange={set('lastName')} placeholder="اللقب" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>تاريخ الميلاد</label>
                <input type="date" value={form.dob} onChange={set('dob')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>رقم الهاتف *</label>
                <input required value={form.phone} onChange={set('phone')} placeholder="05xxxxxxxx" dir="ltr" className={`${inputCls} text-left`} />
              </div>
              <div>
                <label className={labelCls}>البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="email@exemple.com" dir="ltr" className={`${inputCls} text-left`} />
              </div>
              <div>
                <label className={labelCls}>العنوان</label>
                <input value={form.address} onChange={set('address')} placeholder="العنوان الكامل" className={inputCls} />
              </div>
            </div>
          </section>

          {/* البيانات المهنية */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 font-black text-[#0B121E] text-sm">
              <span className="w-8 h-8 rounded-xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center text-xs">2</span>
              البيانات المهنية
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>التخصص التدريبي *</label>
                <input required value={form.specialty} onChange={set('specialty')} placeholder="مثال: سباحة حرة / صدر / فراشة / تكوين فئات صغرى" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>سنوات الخبرة</label>
                <input type="number" min="0" value={form.experienceYears} onChange={set('experienceYears')} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>الشهادة / الرخصة المعتمدة *</label>
                <input required value={form.diploma} onChange={set('diploma')} placeholder="مثال: بكالوريا تربوية معتمدة من وزارة الشباب والرياضة" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>سنة الحصول على الشهادة</label>
                <input value={form.diplomaYear} onChange={set('diplomaYear')} placeholder="مثال: 2020" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>الشهادات المعتمدة الأخرى (شهادة الإسعاف، التحكيم، ...)</label>
              <textarea value={form.certifications} onChange={set('certifications')} rows={2} placeholder="اذكر كل الشهادات والرخص المعتمدة" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>المراجع الرياضية</label>
              <textarea value={form.references} onChange={set('references')} rows={2} placeholder="أسماء المدربين/النوادي السابقة" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>نبذة تعريفية</label>
              <textarea value={form.bio} onChange={set('bio')} rows={3} placeholder="مسيرتك التدريبية وإنجازاتك..." className={inputCls} />
            </div>
          </section>

          {/* الشهادات المرفقة */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-black text-[#0B121E] text-sm">
              <span className="w-8 h-8 rounded-xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center text-xs">3</span>
              إرفاق صور الشهادات والرخص
            </h2>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-[#007377]/40 hover:border-[#007377] rounded-2xl py-8 text-center transition-colors bg-[#F8FAFB]"
            >
              <FileUp size={28} className="mx-auto mb-2 text-[#007377]" />
              <p className="text-sm font-bold text-[#007377]">اضغط لإرفاق صور الشهادات (حتى 4 صور)</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">شهادات، رخص، كشوف نقاط تدريبية</p>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            {files.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f} alt={`شهادة ${i + 1}`} className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center shadow"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#007377] hover:bg-[#0A8696] text-white font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            إرسال طلب الانضمام
          </button>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: GraduationCap, t: 'شهادة معتمدة' },
              { icon: Award, t: 'خبرة تدريبية' },
              { icon: BadgeCheck, t: 'مراجعة المسير' },
            ].map((s) => (
              <div key={s.t} className="flex items-center gap-2 justify-center text-[11px] font-bold text-gray-500 bg-gray-50 rounded-xl py-3">
                <s.icon size={15} className="text-[#007377]" />
                {s.t}
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CoachApplyPage;