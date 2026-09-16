import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardList,
  Droplet,
  FileScan,
  FileDown,
  FileText,
  Handshake,
  ImagePlus,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
  User,
  Waves,
} from 'lucide-react';
import { useAppContext, useData } from '@/context';
import { setPrintData } from '@/data';
import { Gender, SkillLevel, Sport, SwimStyle, ApplicantCategory, SubscriptionType } from '@/types';
import logo from '@/assets/logo.png';
import { cropResizePhoto, downloadFormImage, downloadFormPdf, renderFormCanvas } from '@/services/formService';

const STEPS = ['الاختيار الرياضي', 'البيانات الشخصية', 'الولي / التصريحات', 'الاستمارة والمصادقة'];

const RegistrationPage: React.FC = () => {
  const { setRoute } = useAppContext();
  const { addApplication, agreements, registrationOpen } = useData();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filledFormUrl, setFilledFormUrl] = useState<string | null>(null);
  const formCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);

  const [f, setF] = useState({
    sport: Sport.SWIMMING,
    swimStyle: SwimStyle.FREE,
    category: 'أصاغر' as ApplicantCategory,
    subscriptionType: 'اشتراك حر' as SubscriptionType,
    agreementName: '',
    pool: 'المسبح الأولمبي',
    nin: '',
    name: '',
    lastName: '',
    dob: '',
    gender: Gender.MALE,
    bloodType: 'O+',
    level: SkillLevel.BEGINNER,
    phone: '',
    address: '',
    photoUrl: '',
    guardianName: '',
    guardianBirthDate: '',
    guardianBirthPlace: '',
    idCardNumber: '',
    idIssueDate: '',
    idIssueAuthority: '',
    medicalClearance: false,
    consent18_07: false,
    signatureConfirmed: false,
  });

  const set = (key: string, value: string | boolean) => setF((prev) => ({ ...prev, [key]: value }));

  const printData = useMemo(
    () => ({
      nin: f.nin,
      name: f.name,
      lastName: f.lastName,
      dob: f.dob,
      gender: f.gender,
      address: f.address,
      bloodType: f.bloodType,
      phone: f.phone,
      sport: f.sport,
      guardianName: f.guardianName,
      level: f.level,
      swimStyle: f.sport === Sport.SWIMMING ? f.swimStyle : undefined,
      category: f.category,
      subscriptionType: f.subscriptionType,
      agreementName: f.agreementName,
      pool: f.pool,
      photoUrl: f.photoUrl || undefined,
      guardianBirthDate: f.guardianBirthDate,
      guardianBirthPlace: f.guardianBirthPlace,
      idCardNumber: f.idCardNumber,
      idIssueDate: f.idIssueDate,
      idIssueAuthority: f.idIssueAuthority,
    }),
    [f],
  );

  const isMinor = f.category === 'أصاغر';

  const canNext =
    step === 0
      ? true
      : step === 1
        ? f.nin.length >= 12 && f.name && f.lastName && f.dob && f.phone && f.address
        : step === 2
          ? f.medicalClearance &&
            f.consent18_07 &&
            (!isMinor || (f.guardianName && f.idCardNumber && f.idIssueDate))
          : !!filledFormUrl && !!scanUrl && f.signatureConfirmed;

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await cropResizePhoto(file);
    setF((prev) => ({ ...prev, photoUrl: dataUrl }));
  };

  const handleScan = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScanUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const canvas = await renderFormCanvas(printData, { photoUrl: f.photoUrl || undefined });
      formCanvasRef.current = canvas;
      setFilledFormUrl(canvas.toDataURL('image/jpeg', 0.92));
    } catch {
      setFilledFormUrl(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (formCanvasRef.current) downloadFormImage(formCanvasRef.current);
  };

  const handleDownloadPdf = () => {
    if (formCanvasRef.current) downloadFormPdf(formCanvasRef.current);
  };

  const submit = () => {
    setSubmitting(true);
    addApplication({
      nin: f.nin,
      name: f.name,
      lastName: f.lastName,
      dob: f.dob,
      gender: f.gender,
      sport: f.sport,
      swimStyle: f.sport === Sport.SWIMMING ? f.swimStyle : undefined,
      level: f.level,
      phone: f.phone,
      address: f.address,
      bloodType: f.bloodType,
      guardianName: isMinor ? f.guardianName : undefined,
      medicalClearance: f.medicalClearance,
      category: f.category,
      subscriptionType: f.subscriptionType,
      agreementName: f.subscriptionType === 'ضمن اتفاقية معتمدة' ? f.agreementName || undefined : undefined,
      pool: f.pool,
      photoUrl: f.photoUrl || undefined,
      filledFormUrl: filledFormUrl || undefined,
      scanUrl: scanUrl || undefined,
      guardianBirthDate: isMinor ? f.guardianBirthDate : undefined,
      guardianBirthPlace: isMinor ? f.guardianBirthPlace : undefined,
      idCardNumber: isMinor ? f.idCardNumber : undefined,
      idIssueDate: isMinor ? f.idIssueDate : undefined,
      idIssueAuthority: isMinor ? f.idIssueAuthority : undefined,
      consent18_07: f.consent18_07,
    });
    setPrintData(printData);
    setSuccess(true);
    setSubmitting(false);
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
          <button onClick={() => setRoute('login')} className="w-full py-4 bg-[#1A3A5F] text-white rounded-2xl font-bold">
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
            شكراً <b className="text-[#0B121E]">{f.name} {f.lastName}</b>، تم إرسال طلب الإخراط بنجاح إلى إدارة النادي للمراجعة والمصادقة على المستندات.
          </p>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setRoute('print-form')} className="flex-1 py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
              <Printer size={18} /> عرض / طباعة المستند
            </button>
            <button onClick={() => setRoute('login')} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">
              إنهاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 outline-none focus:border-[#D4AF37] font-bold text-sm';
  const labelCls = 'text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest';
  const selectCls = (active: boolean) =>
    `p-6 rounded-[2rem] border-2 text-right transition-all cursor-pointer ${
      active ? 'border-[#D4AF37] bg-[#D4AF37]/10 shadow-lg scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-200'
    }`;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-full h-1.5 luxury-gradient-gold"></div>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
        {/* Header with logo */}
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => setRoute('login')} className="flex items-center gap-3 group">
            <img src={logo} alt="شعار نادي الصدارة" className="w-14 h-14 rounded-full object-cover border-2 border-[#D4AF37] shadow-lg group-hover:scale-105 transition-transform" />
            <div className="text-right">
              <h1 className="text-xl md:text-2xl font-black text-[#1A3A5F] leading-tight">بوابة الإخراط - نادي الصدارة</h1>
              <p className="text-[#D4AF37] font-bold text-[10px] uppercase tracking-[0.25em]">Ghardaia • Season 2026</p>
            </div>
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 md:gap-4 no-print overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s}>
                {i > 0 && <div className={`h-0.5 flex-1 min-w-6 rounded ${i <= step ? 'bg-[#D4AF37]' : 'bg-gray-200'}`}></div>}
                <button onClick={() => i < step && setStep(i)} className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-black whitespace-nowrap transition-all ${active ? 'bg-[#0B121E] text-[#D4AF37] shadow-lg' : done ? 'bg-green-50 text-green-600' : 'bg-white border border-gray-100 text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${active ? 'bg-[#D4AF37] text-[#0B121E]' : done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {done ? '✓' : i + 1}
                  </span>
                  {s}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) setStep(step + 1);
            else submit();
          }}
          className="bg-white border border-[#D4AF37]/20 p-6 md:p-10 rounded-[40px] shadow-xl space-y-8 border-t-8 border-t-[#D4AF37]"
        >
          {/* STEP 1 — الرياضة والفئة والاشتراك */}
          {step === 0 && (
            <div className="space-y-10">
              <div>
                <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-5">
                  <Waves className="text-[#007377]" size={22} /> نوع الرياضة
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.values(Sport) as Sport[]).map((s, i) => (
                    <button type="button" key={s} onClick={() => set('sport', s)} className={selectCls(f.sport === s)}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${f.sport === s ? 'text-[#0B121E]' : 'text-white'} ${i === 0 ? 'bg-cyan-500' : i === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}>{i + 1}</span>
                        <span className="font-black text-[#0B121E]">{s}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        {i === 0 ? 'الرياضة المحورية للنادي - النشاط الرئيسي' : i === 1 ? 'لياقة وتحمل في الطبيعة' : 'سرعة وانطلاقة على المضمار'}
                      </p>
                      {f.sport === s && i === 0 && (
                        <div className="mt-4">
                          <select value={f.swimStyle} onChange={(e) => set('swimStyle', e.target.value)} className="w-full bg-white border border-[#D4AF37]/30 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#D4AF37]">
                            {Object.values(SwimStyle).map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-5">
                  <User className="text-[#007377]" size={22} /> الفئة
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['أصاغر', 'أكابر'] as ApplicantCategory[]).map((c) => (
                    <button type="button" key={c} onClick={() => set('category', c)} className={selectCls(f.category === c)}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${c === 'أصاغر' ? 'bg-purple-500 text-white' : 'bg-teal-500 text-white'}`}>{c === 'أصاغر' ? 'أ' : 'أ'}</span>
                        <span className="font-black text-[#0B121E] text-lg">{c}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        {c === 'أصاغر' ? 'تتطلب بيانات الولي والتصريح الأبوي (للفئات السنية الصغرى).' : 'تسجيل مباشر للرياضي البالغ مع التصريح الشخصي.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-5">
                  <Handshake className="text-[#007377]" size={22} /> نوع الاشتراك
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['اشتراك حر', 'ضمن اتفاقية معتمدة'] as SubscriptionType[]).map((t) => (
                    <button type="button" key={t} onClick={() => set('subscriptionType', t)} className={selectCls(f.subscriptionType === t)}>
                      <span className="font-black text-[#0B121E]">{t}</span>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {t === 'اشتراك حر' ? 'الاشتراك الفردي المباشر' : 'انضمام عبر اتفاقية مؤسسية معتمدة من الإدارة'}
                      </p>
                      {f.subscriptionType === t && t === 'ضمن اتفاقية معتمدة' && (
                        <select value={f.agreementName} onChange={(e) => set('agreementName', e.target.value)} className="w-full mt-4 bg-white border border-[#D4AF37]/30 rounded-xl px-3 py-2 text-xs font-bold outline-none" required>
                          <option value="">— اختر الاتفاقية —</option>
                          {agreements.filter((a) => a.status === 'نشطة').map((a) => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))}
                        </select>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelCls}>المسبح / المنشأة</label>
                <select value={f.pool} onChange={(e) => set('pool', e.target.value)} className={inputCls}>
                  {['المسبح الأولمبي', 'المسبح النصف أولمبي', 'الملعب البلدي', 'غابة غرداية'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 2 — البيانات الشخصية */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
                  <User className="text-[#007377]" size={22} /> المعلومات الشخصية
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2"><label className={labelCls}>الاسم *</label><input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="الاسم" className={inputCls} /></div>
                  <div className="space-y-2"><label className={labelCls}>اللقب *</label><input required value={f.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="اللقب" className={inputCls} /></div>
                  <div className="space-y-2"><label className={labelCls}>رقم التعريف الوطني NIN *</label><input required minLength={12} value={f.nin} onChange={(e) => set('nin', e.target.value)} placeholder="18 رقم" className={`${inputCls} font-mono`} /></div>
                  <div className="space-y-2"><label className={labelCls}>تاريخ الميلاد *</label><input required type="date" value={f.dob} onChange={(e) => set('dob', e.target.value)} className={inputCls} /></div>
                  <div className="space-y-2"><label className={labelCls}>الجنس</label><select value={f.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>{Object.values(Gender).map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
                  <div className="space-y-2"><label className={labelCls}>فصيلة الدم</label><select value={f.bloodType} onChange={(e) => set('bloodType', e.target.value)} className={inputCls}>{['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
                  <div className="space-y-2"><label className={labelCls}>المستوى الرياضي</label><select value={f.level} onChange={(e) => set('level', e.target.value)} className={inputCls}>{Object.values(SkillLevel).map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
                  <div className="space-y-2"><label className={labelCls}>الهاتف *</label><input required value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05/06..." className={inputCls} /></div>
                  <div className="space-y-2 col-span-full"><label className={labelCls}>العنوان *</label><input required value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="الحي - البلدية" className={inputCls} /></div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-lg font-black text-[#0B121E] flex items-center gap-3 mb-4">
                  <Camera className="text-[#007377]" size={20} /> الصورة الشخصية
                  <span className="text-[10px] font-bold text-gray-400">(اقتصاص وتصغير تلقائي)</span>
                </h3>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-28 h-36 rounded-3xl border-4 border-dashed border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">
                    {f.photoUrl ? (
                      <img src={f.photoUrl} alt="الصورة الشخصية" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="text-gray-300" size={32} />
                    )}
                  </div>
                  <div className="space-y-3 w-full">
                    <label className="flex items-center justify-center gap-3 px-6 py-4 bg-[#0B121E] text-white rounded-2xl font-black cursor-pointer hover:-translate-y-0.5 transition-all active:scale-95 border-b-4 border-[#D4AF37]">
                      <Camera size={18} className="text-[#D4AF37]" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] as File)} />
                      {f.photoUrl ? 'تغيير الصورة' : 'رفع صورة المترشح'}
                    </label>
                    <p className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      تُقصّ الصورة تلقائياً بنسبة عمودية (3:4) وتُدمج داخل إطار PHOTO في الاستمارة الرسمية.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — الولي والتصريحات */}
          {step === 2 && (
            <div className="space-y-8">
              {isMinor ? (
                <>
                  <div>
                    <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
                      <User className="text-[#007377]" size={22} /> بيانات الولي (الفئة أصاغر)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2"><label className={labelCls}>اسم الولي *</label><input required value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} placeholder="الاسم الكامل" className={inputCls} /></div>
                      <div className="space-y-2"><label className={labelCls}>تاريخ ميلاد الولي</label><input type="date" value={f.guardianBirthDate} onChange={(e) => set('guardianBirthDate', e.target.value)} className={inputCls} /></div>
                      <div className="space-y-2"><label className={labelCls}>مكان الميلاد</label><input value={f.guardianBirthPlace} onChange={(e) => set('guardianBirthPlace', e.target.value)} placeholder="البلدية / الولاية" className={inputCls} /></div>
                      <div className="space-y-2"><label className={labelCls}>رقم بطاقة التعريف / رخصة السياقة *</label><input required value={f.idCardNumber} onChange={(e) => set('idCardNumber', e.target.value)} placeholder="ب.ت / ر.س رقم" className={inputCls} /></div>
                      <div className="space-y-2"><label className={labelCls}>تاريخ الإصدار *</label><input required type="date" value={f.idIssueDate} onChange={(e) => set('idIssueDate', e.target.value)} className={inputCls} /></div>
                      <div className="space-y-2"><label className={labelCls}>جهة الإصدار</label><input value={f.idIssueAuthority} onChange={(e) => set('idIssueAuthority', e.target.value)} placeholder="البلدية المصدرة" className={inputCls} /></div>
                    </div>
                  </div>
                  <div className="p-5 bg-purple-50 border border-purple-100 rounded-3xl flex gap-3">
                    <ShieldCheck className="text-purple-600 shrink-0" size={20} />
                    <p className="text-xs text-purple-800 font-bold leading-relaxed">
                      سيتم تضمين التصريح الأبوي التالي آلياً في الاستمارة: «أصرح لـ {f.name || '.....'} {f.lastName || '.....'} بالانخراط في نادي الصدارة».
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-5 bg-teal-50 border border-teal-100 rounded-3xl flex gap-3">
                  <ShieldCheck className="text-teal-600 shrink-0" size={20} />
                  <p className="text-xs text-teal-800 font-bold leading-relaxed">
                    فئة <b>أكابر</b>: الرياضي يحرر التصريح الشخصي بنفسه دون الحاجة لبيانات الولي.
                  </p>
                </div>
              )}

              <div className="pt-2 space-y-4">
                <label className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:border-[#007377]/40 transition-all">
                  <input type="checkbox" required checked={f.medicalClearance} onChange={(e) => set('medicalClearance', e.target.checked)} className="w-5 h-5 accent-[#007377]" />
                  <span className="text-sm font-bold text-[#0B121E]">أقر بإرفاق كشف طبي ساري المفعول وتوثيقه بختم الطبيب على الاستمارة</span>
                </label>
                <label className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:border-[#D4AF37]/40 transition-all">
                  <input type="checkbox" required checked={f.consent18_07} onChange={(e) => set('consent18_07', e.target.checked)} className="w-5 h-5 accent-[#D4AF37]" />
                  <span className="text-sm font-bold text-[#0B121E] flex items-center gap-2">
                    <ShieldCheck size={18} className="text-[#007377] shrink-0" />
                    أوافق على معالجة بياناتي وفق القانون 18-07 المتعلق بحماية المعطيات ذات الطابع الشخصي
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4 — الاستمارة والمصادقة */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-3">
                  <FileText className="text-[#007377]" size={22} /> 1. توليد الاستمارة آلياً
                </h2>
                <p className="text-xs text-gray-400 font-bold mb-5 leading-relaxed">
                  تُملأ الاستمارة الرسمية تلقائياً (خريطة إحداثيات نسبية) ويمكن تنزيلها كصورة أو PDF للطباعة.
                </p>
                {!filledFormUrl ? (
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="w-full py-5 luxury-gradient-gold text-[#0B121E] rounded-[1.5rem] font-black shadow-xl gold-glow active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                  >
                    {generating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    {generating ? 'جاري توليد الاستمارة...' : 'توليد الاستمارة الرسمية'}
                  </button>
                ) : (
                  <>
                    <img src={filledFormUrl} alt="الاستمارة المولدة" className="w-full rounded-3xl border border-gray-200 shadow-xl my-4" />
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleDownloadImage} className="flex items-center gap-2 px-5 py-3 bg-[#0B121E] text-white rounded-2xl font-black text-xs border-b-4 border-[#D4AF37] hover:-translate-y-0.5 transition-all">
                        <FileDown size={16} className="text-[#D4AF37]" /> تنزيل صورة
                      </button>
                      <button type="button" onClick={handleDownloadPdf} className="flex items-center gap-2 px-5 py-3 bg-[#007377] text-white rounded-2xl font-black text-xs border-b-4 border-green-900 hover:-translate-y-0.5 transition-all">
                        <FileDown size={16} /> تنزيل PDF
                      </button>
                      <button type="button" onClick={() => setRoute('print-form')} className="flex items-center gap-2 px-5 py-3 bg-white text-gray-500 rounded-2xl font-black text-xs border border-gray-200 hover:-translate-y-0.5 transition-all no-print">
                        <Printer size={16} /> طباعة
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h2 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-3">
                  <FileScan className="text-[#007377]" size={22} /> 2. المصادقة وإعادة الرفع (Scan)
                </h2>
                <p className="text-xs text-gray-400 font-bold mb-5 leading-relaxed">
                  اطبع الاستمارة، وقّعها، ثم صادق عليها من البلدية وختم الطبيب، وأعد رفع المسح الضوئي للتأكد من اكتمال الأختام والتوقيعات قبل الإرسال.
                </p>
                {!scanUrl ? (
                  <label className="flex flex-col items-center justify-center gap-4 w-full py-10 border-2 border-dashed border-gray-300 rounded-3xl bg-gray-50 cursor-pointer hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all active:scale-[0.99]">
                    <FileScan size={40} className="text-gray-300" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleScan(e.target.files?.[0] as File)} />
                    <span className="font-black text-[#0B121E] text-sm">اضغط لرفع الاستمارة الممسوحة ضوئياً</span>
                    <span className="text-[11px] text-gray-400 font-bold">PNG / JPG — معاينة حية مباشرة</span>
                  </label>
                ) : (
                  <>
                    <img src={scanUrl} alt="الاستمارة الممسوحة" className="w-full max-h-[420px] object-contain rounded-3xl border border-green-300 shadow-xl my-4 animate-in fade-in" />
                    <button type="button" onClick={() => setScanUrl(null)} className="text-[11px] font-bold text-red-500 hover:underline">
                      إزالة المسح ورفع صورة أخرى
                    </button>
                  </>
                )}
              </div>

              <label className="flex items-center gap-4 p-5 bg-green-50 rounded-2xl border border-green-200 cursor-pointer hover:border-green-400/50 transition-all">
                <input type="checkbox" required checked={f.signatureConfirmed} onChange={(e) => set('signatureConfirmed', e.target.checked)} className="w-5 h-5 accent-green-600" />
                <span className="text-sm font-bold text-[#0B121E]">
                  أقر بأن الاستمارة <b>مصادق عليها</b> (توقيع + ختم الطبيب + مصادقة البلدية) وأن البيانات مطابقة للوثائق الرسمية
                </span>
              </label>
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex gap-3 pt-2 no-print">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="flex items-center gap-2 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black hover:bg-gray-200 transition-all">
                <ArrowRight size={18} /> السابق
              </button>
            )}
            <button
              type="submit"
              disabled={!canNext || submitting}
              className="flex-1 py-4 luxury-gradient-gold text-[#0B121E] rounded-[1.5rem] font-black shadow-xl gold-glow hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : null}
              {step === STEPS.length - 1 ? (
                <>
                  <ClipboardList size={20} /> إرسال طلب الإخراط
                </>
              ) : (
                <>
                  متابعة <ArrowLeft size={20} />
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-gray-400 font-bold flex items-center justify-center gap-2 pb-4">
          <Droplet size={12} className="text-[#007377]" /> جميع البيانات محمية وفق القانون 18-07 • نادي الصدارة الرياضي - غرداية
        </p>
      </div>
    </div>
  );
};

export default RegistrationPage;