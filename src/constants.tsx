import React from 'react';
import { AgeCategory, ClubSettings, MembershipStatus, SkillLevel, Sport, UserRole } from './types';

export const ROLES_LABEL: Record<UserRole, string> = {
  [UserRole.PRESIDENT]: 'رئيس النادي',
  [UserRole.MANAGER]: 'مسير النادي',
  [UserRole.COACH]: 'مدرب',
  [UserRole.ATHLETE]: 'رياضي',
  [UserRole.GUARDIAN]: 'ولي الأمر',
};

export const WILAYAS: { num: string; name: string }[] = [
  { num: '01', name: 'أدرار' },
  { num: '02', name: 'الشلف' },
  { num: '03', name: 'الأغواط' },
  { num: '04', name: 'أم البواقي' },
  { num: '05', name: 'باتنة' },
  { num: '06', name: 'بجاية' },
  { num: '07', name: 'بسكرة' },
  { num: '08', name: 'بشار' },
  { num: '09', name: 'البليدة' },
  { num: '10', name: 'البويرة' },
  { num: '11', name: 'تمنراست' },
  { num: '12', name: 'تبسة' },
  { num: '13', name: 'تلمسان' },
  { num: '14', name: 'تيارت' },
  { num: '15', name: 'تيزي وزو' },
  { num: '16', name: 'الجزائر' },
  { num: '17', name: 'الجلفة' },
  { num: '18', name: 'جيجل' },
  { num: '19', name: 'سطيف' },
  { num: '20', name: 'سعيدة' },
  { num: '21', name: 'سكيكدة' },
  { num: '22', name: 'سيدي بلعباس' },
  { num: '23', name: 'عنابة' },
  { num: '24', name: 'قالمة' },
  { num: '25', name: 'قسنطينة' },
  { num: '26', name: 'المدية' },
  { num: '27', name: 'مستغانم' },
  { num: '28', name: 'المسيلة' },
  { num: '29', name: 'معسكر' },
  { num: '30', name: 'ورقلة' },
  { num: '31', name: 'وهران' },
  { num: '32', name: 'البيض' },
  { num: '33', name: 'إليزي' },
  { num: '34', name: 'برج بوعريريج' },
  { num: '35', name: 'بومرداس' },
  { num: '36', name: 'الطارف' },
  { num: '37', name: 'تندوف' },
  { num: '38', name: 'تيسمسيلت' },
  { num: '39', name: 'الوادي' },
  { num: '40', name: 'خنشلة' },
  { num: '41', name: 'سوق أهراس' },
  { num: '42', name: 'تيبازة' },
  { num: '43', name: 'ميلة' },
  { num: '44', name: 'عين الدفلى' },
  { num: '45', name: 'النعامة' },
  { num: '46', name: 'عين تموشنت' },
  { num: '47', name: 'غرداية' },
  { num: '48', name: 'غليزان' },
  { num: '49', name: 'تيميمون' },
  { num: '50', name: 'برج باجي مختار' },
  { num: '51', name: 'أولاد جلال' },
  { num: '52', name: 'بني عباس' },
  { num: '53', name: 'عين صالح' },
  { num: '54', name: 'عين قزام' },
  { num: '55', name: 'تقرت' },
  { num: '56', name: 'جانت' },
  { num: '57', name: 'المغير' },
  { num: '58', name: 'المنيعة' },
];

export const SPORT_STYLE: Record<Sport, { badge: string; solid: string; gradient: string; icon: string }> = {
  [Sport.SWIMMING]: {
    badge: 'bg-cyan-100 text-cyan-800',
    solid: 'bg-cyan-500',
    gradient: 'from-cyan-400 to-blue-500',
    icon: 'text-cyan-600',
  },
  [Sport.CROSS_COUNTRY]: {
    badge: 'bg-emerald-100 text-emerald-800',
    solid: 'bg-emerald-500',
    gradient: 'from-emerald-400 to-teal-500',
    icon: 'text-emerald-600',
  },
  [Sport.SPRINTING]: {
    badge: 'bg-amber-100 text-amber-800',
    solid: 'bg-amber-500',
    gradient: 'from-amber-400 to-orange-500',
    icon: 'text-amber-600',
  },
};

export const CATEGORY_STYLE: Record<AgeCategory, { badge: string; label: string }> = {
  [AgeCategory.BENJAMINS]: { badge: 'bg-violet-100 text-violet-700', label: 'براعم' },
  [AgeCategory.MINIMES]: { badge: 'bg-sky-100 text-sky-700', label: 'أصاغر' },
  [AgeCategory.CADETS]: { badge: 'bg-indigo-100 text-indigo-700', label: 'أشبال' },
  [AgeCategory.JUNIORS]: { badge: 'bg-orange-100 text-orange-700', label: 'أواسط' },
  [AgeCategory.SENIORS]: { badge: 'bg-rose-100 text-rose-700', label: 'أكابر' },
};

export const LEVEL_STYLE: Record<SkillLevel, { badge: string; label: string }> = {
  [SkillLevel.BEGINNER]: { badge: 'bg-gray-100 text-gray-600', label: 'مبتدئ' },
  [SkillLevel.INTERMEDIATE]: { badge: 'bg-blue-100 text-blue-700', label: 'متوسط' },
  [SkillLevel.ADVANCED]: { badge: 'bg-teal-100 text-teal-800', label: 'متقدم' },
  [SkillLevel.ELITE]: { badge: 'bg-[#D4AF37]/15 text-[#8a6d1a]', label: 'نخبة' },
};

export const STATUS_STYLE: Record<MembershipStatus, { badge: string; label: string }> = {
  [MembershipStatus.ACTIVE]: { badge: 'bg-green-50 text-green-700', label: 'نشط' },
  [MembershipStatus.FROZEN]: { badge: 'bg-red-50 text-red-700', label: 'مجمد' },
  [MembershipStatus.PENDING]: { badge: 'bg-amber-50 text-amber-700', label: 'قيد الانتظار' },
};

export const sportGradient = (sport: Sport): string =>
  `bg-gradient-to-br ${SPORT_STYLE[sport].gradient}`;

export interface SportChipProps {
  sport: Sport;
  size?: 'sm' | 'md';
}

export const SportChip: React.FC<SportChipProps> = ({ sport, size = 'md' }) => (
  <span
    className={`inline-flex items-center gap-1.5 font-bold ${SPORT_STYLE[sport].badge} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    } rounded-full`}
  >
    {sport}
  </span>
);

export interface BadgeChipProps {
  label: string;
  className?: string;
}

export const BadgeChip: React.FC<BadgeChipProps> = ({ label, className = '' }) => (
  <span className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full ${className}`}>
    {label}
  </span>
);

export const progressColor = (value: number): string => {
  if (value >= 85) return 'bg-[#D4AF37]';
  if (value >= 70) return 'bg-[#007377]';
  if (value >= 50) return 'bg-blue-500';
  return 'bg-gray-400';
};

/* المسبح الأولمبي / النصف أولمبي / الملعب البلدي / غابة غرداية */
const POOLS = ['المسبح الأولمبي', 'المسبح النصف أولمبي', 'الملعب البلدي', 'غابة غرداية'] as const;
export type PoolKey = (typeof POOLS)[number];
export const poolKeys = [...POOLS];

/** مصفوفة حقوق الاشتراك السنوية (دج) حسب الفئة والمنشأة */
export const BASE_FEES: Record<'أصاغر' | 'أكابر', Record<string, number>> = {
  'أصاغر': { 'المسبح الأولمبي': 3000, 'المسبح النصف أولمبي': 2800, 'الملعب البلدي': 2600, 'غابة غرداية': 2400 },
  'أكابر': { 'المسبح الأولمبي': 3500, 'المسبح النصف أولمبي': 3200, 'الملعب البلدي': 3000, 'غابة غرداية': 2800 },
};

export const INSURANCE_FEE = 600; // قسط التأمين السنوي الإجباري (دج)
export const TRANSPORT_FEE = 900; // خدمة النقل السنوية عند التفعيل (دج)
export const DEFAULT_DISCOUNT_PCT = 15; // خصم الاتفاقية الافتراضي (%)
export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  season: 'موسم 2026 / 2027',
  subscriptionTypes: [
    { id: 'free', name: 'اشتراك حر', periodLabel: 'موسم', amount: 3000 },
    { id: 'quarterly', name: 'اشتراك فصلي (3 أشهر)', periodLabel: 'فصل 1', amount: 1000 },
    { id: 'agreement', name: 'ضمن اتفاقية معتمدة', periodLabel: 'موسم', amount: 3000 },
  ],
  insuranceFee: 600,
  transportFee: 900,
  kitFee: 2500,
  defaultDiscountPct: 15,
};