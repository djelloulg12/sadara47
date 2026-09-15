import React from 'react';
import { AgeCategory, MembershipStatus, SkillLevel, Sport, UserRole } from './types';

export const ROLES_LABEL: Record<UserRole, string> = {
  [UserRole.PRESIDENT]: 'رئيس النادي',
  [UserRole.MANAGER]: 'مسير النادي',
  [UserRole.COACH]: 'مدرب',
  [UserRole.ATHLETE]: 'رياضي',
  [UserRole.GUARDIAN]: 'ولي الأمر',
};

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