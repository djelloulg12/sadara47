import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bus,
  Calendar,
  ClipboardList,
  Droplets,
  FileText,
  MapPin,
  PencilLine,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Avatar from '@/components/Avatar';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useAuth, useData } from '@/context';
import { BadgeChip, CATEGORY_STYLE, LEVEL_STYLE, STATUS_STYLE } from '@/constants';
import { Athlete, PersonalRecord, SwimStyle, UserRole } from '@/types';
import { formatDate, formatDateShort, maskNin, toStyles } from '@/utils/helpers';
import { analyzePerformance, generateAthleteBio, generateDietPlan } from '@/services/gemini';

const AthleteProfilePage: React.FC<{ athleteId: string | null; onBack: () => void }> = ({ athleteId, onBack }) => {
  const { user } = useAuth();
  const { athletes, records, addRecord, updateRecord, deleteRecord, updateAthleteBio, updateAthlete } = useData();
  const isManagerLike = !!user && (user.role === UserRole.PRESIDENT || user.role === UserRole.MANAGER || user.role === UserRole.COACH);

  const athlete = athletes.find((a) => a.id === athleteId) || null;

  const [bio, setBio] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [diet, setDiet] = useState<string | null>(null);
  const [dietLoading, setDietLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stylesModal, setStylesModal] = useState(false);
  const [draftStyles, setDraftStyles] = useState<SwimStyle[]>([]);

  const [recordModal, setRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonalRecord | null>(null);
  const [recordForm, setRecordForm] = useState({ discipline: '', value: '', numeric: '', date: '' });
  const [toDeleteRecord, setToDeleteRecord] = useState<PersonalRecord | null>(null);

  const myRecords = useMemo(
    () =>
      records
        .filter((r) => r.athleteId === athleteId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [records, athleteId],
  );

  const styles = toStyles(athlete?.swimStyle);

  const openStyles = () => {
    setDraftStyles(styles as SwimStyle[]);
    setStylesModal(true);
  };

  const toggleDraft = (s: SwimStyle) =>
    setDraftStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const saveStyles = () => {
    if (athlete) updateAthlete(athlete.id, { swimStyle: draftStyles });
    setStylesModal(false);
  };

  if (!athlete) {
    return (
      <div className="space-y-8">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 font-bold hover:text-[#007377] transition-all">
          <ArrowRight size={18} /> رجوع
        </button>
        <EmptyState title="الرياضي غير موجود" hint="ربما تم حذفه أو أن الصفحة تم تحديثها." />
      </div>
    );
  }

  const st = STATUS_STYLE[athlete.membershipStatus];

  const openAddRecord = () => {
    setEditingRecord(null);
    setRecordForm({ discipline: '', value: '', numeric: '', date: new Date().toISOString().slice(0, 10) });
    setRecordModal(true);
  };

  const openEditRecord = (r: PersonalRecord) => {
    setEditingRecord(r);
    setRecordForm({ discipline: r.discipline, value: r.value, numeric: r.numeric ? String(r.numeric) : '', date: r.date });
    setRecordModal(true);
  };

  const saveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      discipline: recordForm.discipline,
      value: recordForm.value,
      numeric: recordForm.numeric ? Number(recordForm.numeric) : undefined,
      date: recordForm.date,
    };
    if (editingRecord) {
      updateRecord(editingRecord.id, payload);
    } else {
      addRecord({ athleteId: athlete.id, ...payload });
    }
    setRecordModal(false);
  };

  const runBio = async () => {
    if (!athlete) return;
    setBioLoading(true);
    const result = await generateAthleteBio(athlete.name, athlete.lastName, athlete.age, athlete.sport);
    setBio(result);
    setBioLoading(false);
  };

  const runDiet = async () => {
    if (!athlete) return;
    setDietLoading(true);
    setDiet(await generateDietPlan(athlete.sport));
    setDietLoading(false);
  };

  const runAnalysis = async () => {
    if (!athlete) return;
    setAnalyzing(true);
    setAiAdvice(await analyzePerformance(athlete));
    setAnalyzing(false);
  };

  const recordChart = myRecords
    .filter((r) => typeof r.numeric === 'number')
    .map((r) => ({ name: formatDateShort(r.date), value: r.numeric as number }));

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#D4AF37] font-bold text-sm';

  const InfoRow: React.FC<{ label: string; value: React.ReactNode; icon?: React.ComponentType<{ size?: number | string; className?: string }> }> = ({ label, value, icon: Icon }) => (
    <div className="flex justify-between items-center text-xs font-bold border-b border-gray-50 pb-3 gap-3">
      <span className="text-gray-400 flex items-center gap-2">
        {Icon && <Icon size={14} className="text-[#D4AF37]" />} {label}
      </span>
      <span className="text-[#0B121E] font-black text-left">{value}</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-up">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 font-bold hover:text-[#007377] transition-all no-print">
        <ArrowRight size={18} /> رجوع
      </button>

      {/* Header card */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-gray-50 overflow-hidden luxury-shadow border-t-[10px] border-t-[#007377]">
        <div className="luxury-gradient-navy p-10 text-white relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-[#D4AF37]/10 rounded-full"></div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 relative z-10">
            <Avatar name={`${athlete.name} ${athlete.lastName}`} photoUrl={athlete.photoUrl} sport={athlete.sport} size="xl" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <BadgeChip label={athlete.sport} className={st.badge} />
                <BadgeChip label={athlete.membershipStatus} className={st.badge} />
                <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full text-white/60 font-bold">{athlete.registrationNumber}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black">
                {athlete.name} {athlete.lastName}
              </h2>
              <p className="text-[#D4AF37] text-xs font-black uppercase tracking-[0.2em] mt-1">
                {athlete.category} • {athlete.level} {styles.length > 0 ? `• ${styles.join(' / ')}` : ''}
              </p>
            </div>
            <div className="flex gap-3 no-print">
              <button onClick={() => setReportOpen(true)} className="flex items-center gap-2 px-6 py-4 bg-[#007377] text-white rounded-2xl font-black shadow-lg hover:-translate-y-0.5 transition-all active:scale-95">
                <FileText size={18} /> التقرير الفني
              </button>
            </div>
          </div>
        </div>

        <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-3">
            <InfoRow label="رقم التعريف الوطني NIN" value={<span className="font-mono">{maskNin(athlete.nin)}</span>} />
            <InfoRow label="تاريخ الميلاد / العمر" value={`${formatDate(athlete.dob)} (${athlete.age} سنة)`} icon={Calendar} />
            <InfoRow label="الجنس" value={athlete.gender} icon={User} />
            <InfoRow
              label="الأنماط السباحية"
              value={
                <span className="flex items-center gap-1.5 flex-wrap;">
                  {styles.length > 0 ? (
                    styles.map((s) => <BadgeChip key={s} label={s} className="bg-indigo-50 text-indigo-600" />)
                  ) : (
                    athlete.sport
                  )}
                  {isManagerLike && (
                    <button onClick={openStyles} className="p-1.5 rounded-lg bg-[#0B121E]/5 text-[#0B121E] hover:bg-[#0B121E]/10 transition-all" title="تعديل الأنماط">
                      <PencilLine size={13} />
                    </button>
                  )}
                </span>
              }
            />
            <InfoRow label="المدرب المشرف" value={athlete.assignedCoach || '—'} />
            <InfoRow label="موقع التدريب" value={<span className="flex items-center gap-1">{athlete.location || '—'} {athlete.transport && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[9px] flex items-center gap-1"><Bus size={9} /> نقل</span>}</span>} icon={MapPin} />
            <InfoRow label="الهاتف" value={athlete.phone} icon={Phone} />
            <InfoRow label="العنوان" value={athlete.address} />
            <InfoRow label="فصيلة الدم" value={athlete.bloodType} icon={Droplets} />
            <InfoRow label="ولي الأمر" value={athlete.guardianName || '—'} icon={User} />
            <InfoRow label="الشهادة الطبية" value={athlete.medicalClearance ? <span className="text-green-600">سارية ✓</span> : <span className="text-red-500">غير سارية ✗</span>} />
            <InfoRow label="ملاحظات صحية" value={athlete.medicalNotes || '—'} />
            <InfoRow label="تاريخ الانضمام" value={formatDate(athlete.joinedAt)} icon={Calendar} />
          </div>

          <div className="space-y-6">
            <div className="bg-[#FDFBFA] rounded-[2rem] border border-gray-100 p-6">
              <h4 className="text-sm font-black text-[#0B121E] flex items-center gap-2 mb-4">
                <TrendingUp className="text-[#007377]" size={18} /> التقدم الفني
              </h4>
              <p className="text-4xl font-black text-[#D4AF37] mb-3">{athlete.progress}%</p>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full luxury-gradient-gold transition-all duration-1000" style={{ width: `${athlete.progress}%` }}></div>
              </div>
            </div>

            <div className="bg-[#FDFBFA] rounded-[2rem] border border-gray-100 p-6">
              <h4 className="text-sm font-black text-[#0B121E] flex items-center gap-2 mb-4">
                <Sparkles className="text-[#D4AF37]" size={18} /> السيرة الذكية
              </h4>
              {bio ? (
                <p className="text-xs text-gray-600 leading-relaxed italic">{bio}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">اضغط لتوليد سيرة رياضية احترافية بالذكاء الاصطناعي.</p>
              )}
              <button
                onClick={runBio}
                disabled={bioLoading}
                className="mt-4 w-full py-3 bg-[#0B121E] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {bioLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} className="text-[#D4AF37]" />}
                {bio ? 'إعادة التوليد' : 'توليد السيرة'}
              </button>
            </div>

            <div className="bg-[#FDFBFA] rounded-[2rem] border border-gray-100 p-6">
              <h4 className="text-sm font-black text-[#0B121E] flex items-center gap-2 mb-4">
                <Award className="text-[#D4AF37]" size={18} /> تغذية مخصصة
              </h4>
              {diet ? (
                <div className="text-xs text-gray-600 space-y-1 [&_ul]:space-y-1" dangerouslySetInnerHTML={{ __html: diet }} />
              ) : (
                <p className="text-xs text-gray-400 italic">اقتراح نظام غذائي يناسب تخصص {athlete.sport}.</p>
              )}
              <button
                onClick={runDiet}
                disabled={dietLoading}
                className="mt-4 w-full py-3 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {dietLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {diet ? 'خطة أخرى' : 'توليد الخطة'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Records + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3">
              <ClipboardList className="text-[#007377]" size={22} /> أرقام المسجلة
            </h3>
            <button onClick={openAddRecord} className="px-5 py-3 bg-[#007377] text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:-translate-y-0.5 transition-all active:scale-95">
              <Plus size={16} /> تسجيل رقم
            </button>
          </div>
          <div className="space-y-3">
            {myRecords.slice().reverse().map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group">
                <div>
                  <p className="font-black text-[#0B121E] text-sm">{r.discipline}</p>
                  <p className="text-[11px] text-gray-400 font-bold">{formatDate(r.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-[#007377] text-xl">{r.value}</span>
                  <button onClick={() => openEditRecord(r)} className="p-2 text-gray-300 hover:text-[#D4AF37] transition-all">
                    <ClipboardList size={16} />
                  </button>
                  <button onClick={() => setToDeleteRecord(r)} className="p-2 text-gray-300 hover:text-red-500 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {myRecords.length === 0 && <EmptyState title="لا توجد أرقام مسجلة" hint="سجّل أول رقم شخصي للرياضي." />}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-[#0B121E] flex items-center gap-3 mb-6">
            <TrendingUp className="text-[#D4AF37]" size={22} /> منحنى الأرقام
          </h3>
          {recordChart.length > 0 ? (
            <div className="h-[260px] w-full dir-ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={recordChart}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000005" vertical={false} />
                  <XAxis dataKey="name" stroke="#E2E8F0" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <YAxis stroke="#E2E8F0" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={3} fill="url(#colorRec)" name="الرقم" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="لا توجد بيانات للرسم" hint="سجّل أرقاماً رقمية لرسم المنحنى." />
          )}
        </div>
      </div>

      {/* Record modal */}
      <Modal open={recordModal} onClose={() => setRecordModal(false)} title={editingRecord ? 'تعديل رقم' : 'تسجيل رقم جديد'} subtitle="أرقام المسجلة الشخصية" maxWidth="max-w-md">
        <form onSubmit={saveRecord} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">الاختصاص / المسافة</label>
            <input required value={recordForm.discipline} onChange={(e) => setRecordForm({ ...recordForm, discipline: e.target.value })} placeholder="مثال: 50م سباحة حرة" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">النتيجة</label>
              <input required value={recordForm.value} onChange={(e) => setRecordForm({ ...recordForm, value: e.target.value })} placeholder="مثال: 27.9 ث" className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">القيمة الرقمية</label>
              <input type="number" step="0.01" value={recordForm.numeric} onChange={(e) => setRecordForm({ ...recordForm, numeric: e.target.value })} placeholder="لرسم المنحنى" className={inputCls} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 px-2 uppercase tracking-widest">التاريخ</label>
            <input type="date" required value={recordForm.date} onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })} className={inputCls} />
          </div>
          <button type="submit" className="w-full py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl">
            {editingRecord ? 'حفظ التعديل' : 'تسجيل الرقم'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDeleteRecord}
        message={<>حذف رقم <b className="text-[#0B121E]">{toDeleteRecord?.discipline}</b> ({toDeleteRecord?.value}) نهائياً؟</>}
        onCancel={() => setToDeleteRecord(null)}
        onConfirm={() => {
          if (toDeleteRecord) deleteRecord(toDeleteRecord.id);
          setToDeleteRecord(null);
        }}
      />

      {/* Swim styles editor (coach / admin) */}
      <Modal open={stylesModal} onClose={() => setStylesModal(false)} title="تعديل الأنماط السباحية" subtitle={`${athlete.name} ${athlete.lastName} — تحديث مباشر مع الملف والتقرير`} accent="indigo" maxWidth="max-w-md">
        <div className="space-y-5">
          <p className="text-xs text-gray-400 font-bold leading-relaxed">
            اختيار <b>متعدد</b> لأنماط السباحة (حرة، ظهر، صدر، فراشة، متناوبة). تُحدَّث فوراً في الملف والتقرير الفني وأرقام المسجلة.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(SwimStyle).map((s) => {
              const active = draftStyles.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleDraft(s)}
                  className={`px-4 py-4 rounded-2xl font-black text-sm border-2 transition-all text-center ${
                    active ? 'border-[#007377] bg-[#007377]/10 text-[#007377]' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <button onClick={saveStyles} className="w-full py-4 luxury-gradient-gold text-[#0B121E] rounded-2xl font-black shadow-xl">
            حفظ الأنماط
          </button>
        </div>
      </Modal>

      {/* Technical report modal */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title={`التقرير الفني - ${athlete.name} ${athlete.lastName}`} subtitle="Technical Performance Report • Season 2026" accent="teal" maxWidth="max-w-5xl">
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8 no-print">
          <button onClick={runAnalysis} disabled={analyzing} className="flex items-center gap-2 bg-[#0B121E] text-white px-6 py-4 rounded-2xl font-black border-b-4 border-[#D4AF37] hover:scale-105 active:scale-95 transition-all">
            {analyzing ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} className="text-[#D4AF37]" />} تحليل ذكي
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-[#007377] text-white px-6 py-4 rounded-2xl font-black border-b-4 border-green-900 hover:scale-105 active:scale-95 transition-all">
            <Printer size={18} /> طباعة التقرير
          </button>
        </div>

        <div className="print-container bg-white shadow-2xl rounded-sm border border-gray-100 mx-auto relative min-h-[297mm] p-10">
          <div className="text-center mb-10 border-b-2 border-[#007377]/10 pb-8">
            <div className="flex justify-between items-center mb-6 text-[11px] font-bold text-gray-600 leading-relaxed">
              <div className="text-right">
                <p className="text-[#0B121E] font-black text-sm mb-1">نادي الصدارة الرياضي - غرداية</p>
                <p>بوابة التسيير الرقمي الاحترافي</p>
                <p>غرداية، الجزائر</p>
              </div>
              <div className="text-left">
                <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-DZ')}</p>
                <p>المرجع: {athlete.registrationNumber}</p>
                <p>حالة العضوية: <span className="text-green-600 font-black">{athlete.membershipStatus}</span></p>
              </div>
            </div>
            <div className="h-0.5 w-1/2 mx-auto bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mb-4"></div>
            <h2 className="text-2xl font-black text-[#0B121E] uppercase tracking-[0.2em] mb-1">بطاقة تقييم الأداء الرياضي</h2>
            <p className="text-[10px] text-[#007377] font-black uppercase tracking-[0.3em]">Technical Performance Report • Season 2026</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-3">
                <span className="text-gray-400">الرياضي:</span>
                <span className="text-[#0B121E] font-black">{athlete.name} {athlete.lastName}</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-3">
                <span className="text-gray-400">الفئة العمرية:</span>
                <span className="text-[#0B121E] font-bold">{athlete.category}</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-3">
                <span className="text-gray-400">الاختصاص:</span>
                <span className="text-[#007377] font-black">{styles.length > 0 ? styles.join(' • ') : athlete.sport}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-3">
                <span className="text-gray-400">المدرب المشرف:</span>
                <span className="text-[#0B121E] font-bold">{athlete.assignedCoach}</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-3">
                <span className="text-gray-400">رقم التعريف الوطني:</span>
                <span className="font-mono text-[#0B121E]">{athlete.nin || '---'}</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-b border-gray-100 pb-3">
                <span className="text-gray-400">التقدم الفني:</span>
                <span className="text-[#D4AF37] font-black">{athlete.progress}%</span>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#007377] text-white rounded-lg shadow-md"><TrendingUp size={18} /></div>
              <h3 className="text-sm font-black text-[#0B121E] uppercase tracking-widest">تحليل المنحنى الزمني للاختبارات</h3>
            </div>
            <div className="h-[260px] w-full dir-ltr bg-white p-6 rounded-3xl border border-gray-50 shadow-inner">
              {recordChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recordChart}>
                    <defs>
                      <linearGradient id="colorReport" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007377" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#007377" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="value" stroke="#007377" strokeWidth={4} fill="url(#colorReport)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-gray-400 font-bold">لا توجد بيانات رقمية كافية للرسم.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mb-10 p-8 bg-[#FDFBFA] rounded-[3rem] border border-[#007377]/10 relative shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <Sparkles className="text-[#D4AF37]" size={20} />
              <h3 className="text-sm font-black text-[#0B121E] uppercase tracking-widest">توصيات Sadara AI المخصصة</h3>
            </div>
            {analyzing ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded-full w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded-full w-1/2"></div>
              </div>
            ) : aiAdvice ? (
              <p className="text-xs leading-relaxed text-[#0B121E] font-medium border-r-4 border-[#D4AF37] pr-5 italic whitespace-pre-wrap">{aiAdvice}</p>
            ) : (
              <div className="text-center py-5 border-2 border-dashed border-gray-100 rounded-2xl">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">اضغط على زر "تحليل ذكي" لتوليد التوجيهات</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-10 text-center border-t border-gray-100 pt-12">
            <div className="space-y-8">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">إمضاء المدرب المشرف</p>
              <div className="h-0.5 w-28 mx-auto bg-gray-100"></div>
            </div>
            <div className="space-y-8">
              <p className="text-[10px] font-black text-[#007377] uppercase tracking-[0.3em]">ختم وتوقيع المدير التقني</p>
              <div className="h-0.5 w-28 mx-auto bg-gray-100"></div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AthleteProfilePage;