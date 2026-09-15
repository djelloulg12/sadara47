import React, { useState } from 'react';
import Modal from './Modal';
import {
  Athlete,
  Gender,
  MembershipStatus,
  SkillLevel,
  Sport,
  SwimStyle,
  UserRole,
} from '@/types';
import { useAuth } from '@/context';

export interface AthleteFormValues {
  name: string;
  lastName: string;
  nin: string;
  dob: string;
  gender: Gender;
  sport: Sport;
  swimStyle?: SwimStyle;
  level: SkillLevel;
  progress: number;
  assignedCoach: string;
  membershipStatus: MembershipStatus;
  medicalClearance: boolean;
  medicalNotes?: string;
  phone: string;
  address: string;
  bloodType: string;
  guardianName?: string;
  location?: string;
  transport?: boolean;
  photoUrl?: string;
}

const emptyForm = (): AthleteFormValues => ({
  name: '',
  lastName: '',
  nin: '',
  dob: '',
  gender: Gender.MALE,
  sport: Sport.SWIMMING,
  swimStyle: SwimStyle.FREE,
  level: SkillLevel.BEGINNER,
  progress: 50,
  assignedCoach: '',
  membershipStatus: MembershipStatus.ACTIVE,
  medicalClearance: true,
  medicalNotes: '',
  phone: '',
  address: '',
  bloodType: 'O+',
  guardianName: '',
  location: '',
  transport: false,
  photoUrl: '',
});

const Field: React.FC<{
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, className = '', children }) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-[10px] font-black text-gray-400 uppercase px-2 tracking-widest">{label}</label>
    {children}
  </div>
);

const AthleteForm: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AthleteFormValues) => void;
  initial?: Athlete | null;
}> = ({ open, onClose, onSubmit, initial }) => {
  const { users } = useAuth();
  const coaches = users
    .filter((u) => u.role === UserRole.COACH || u.role === UserRole.PRESIDENT)
    .map((u) => u.name);

  const [form, setForm] = useState<AthleteFormValues>(
    initial
      ? {
          name: initial.name,
          lastName: initial.lastName,
          nin: initial.nin,
          dob: initial.dob,
          gender: initial.gender,
          sport: initial.sport,
          swimStyle: initial.swimStyle,
          level: initial.level,
          progress: initial.progress,
          assignedCoach: initial.assignedCoach,
          membershipStatus: initial.membershipStatus,
          medicalClearance: initial.medicalClearance,
          medicalNotes: initial.medicalNotes || '',
          phone: initial.phone,
          address: initial.address,
          bloodType: initial.bloodType,
          guardianName: initial.guardianName || '',
          location: initial.location || '',
          transport: initial.transport || false,
          photoUrl: initial.photoUrl || '',
        }
      : emptyForm(),
  );

  const set = <K extends keyof AthleteFormValues>(key: K, value: AthleteFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const inputCls =
    'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#D4AF37] font-bold text-sm';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'تعديل بيانات رياضي' : 'إضافة رياضي جديد'}
      subtitle="نادي الصدارة - الملف الكامل للرياضي"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم">
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="الاسم" className={inputCls} />
          </Field>
          <Field label="اللقب">
            <input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="اللقب" className={inputCls} />
          </Field>
          <Field label="رقم التعريف الوطني NIN">
            <input
              value={form.nin}
              onChange={(e) => set('nin', e.target.value)}
              placeholder="18 رقم"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="تاريخ الميلاد">
            <input type="date" required value={form.dob} onChange={(e) => set('dob', e.target.value)} className={inputCls} />
          </Field>
          <Field label="الجنس">
            <select value={form.gender} onChange={(e) => set('gender', e.target.value as Gender)} className={inputCls}>
              {Object.values(Gender).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="الرياضة">
            <select
              value={form.sport}
              onChange={(e) => set('sport', e.target.value as Sport)}
              className={inputCls}
            >
              {Object.values(Sport).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          {form.sport === Sport.SWIMMING && (
            <Field label="الأسلوب المفضل">
              <select value={form.swimStyle} onChange={(e) => set('swimStyle', e.target.value as SwimStyle)} className={inputCls}>
                {Object.values(SwimStyle).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="المستوى">
            <select value={form.level} onChange={(e) => set('level', e.target.value as SkillLevel)} className={inputCls}>
              {Object.values(SkillLevel).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="نسبة التقدم (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={(e) => set('progress', Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="المدرب المشرف">
            <select value={form.assignedCoach} onChange={(e) => set('assignedCoach', e.target.value)} className={inputCls}>
              <option value="">— اختر —</option>
              {coaches.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="حالة العضوية">
            <select
              value={form.membershipStatus}
              onChange={(e) => set('membershipStatus', e.target.value as MembershipStatus)}
              className={inputCls}
            >
              {Object.values(MembershipStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="موقع التدريب">
            <input value={form.location || ''} onChange={(e) => set('location', e.target.value)} placeholder="مثال: المسبح الأولمبي" className={inputCls} />
          </Field>
          <Field label="الهاتف">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05/06..." className={inputCls} />
          </Field>
          <Field label="فصيلة الدم">
            <input value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)} className={inputCls} />
          </Field>
          <Field label="ولي الأمر (اختياري)">
            <input value={form.guardianName || ''} onChange={(e) => set('guardianName', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="العنوان">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
          </Field>
          <Field label="ملاحظات صحية">
            <input value={form.medicalNotes || ''} onChange={(e) => set('medicalNotes', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer border border-gray-100">
            <input
              type="checkbox"
              checked={form.medicalClearance}
              onChange={(e) => set('medicalClearance', e.target.checked)}
              className="w-5 h-5 accent-[#007377]"
            />
            <span className="text-sm font-bold text-[#0B121E]">شهادة طبية سارية</span>
          </label>
          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer border border-gray-100">
            <input
              type="checkbox"
              checked={!!form.transport}
              onChange={(e) => set('transport', e.target.checked)}
              className="w-5 h-5 accent-[#007377]"
            />
            <span className="text-sm font-bold text-[#0B121E]">نقل النادي</span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full py-5 luxury-gradient-gold text-[#0B121E] rounded-[1.5rem] font-black shadow-xl gold-glow hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          {initial ? 'حفظ التعديلات' : 'إضافة الرياضي'}
        </button>
      </form>
    </Modal>
  );
};

export default AthleteForm;