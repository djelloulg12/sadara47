import { AgeCategory } from '../types';

export const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

export const getAgeCategory = (age: number): AgeCategory => {
  if (age >= 18) return AgeCategory.SENIORS;
  if (age >= 16) return AgeCategory.JUNIORS;
  if (age >= 14) return AgeCategory.CADETS;
  if (age >= 12) return AgeCategory.MINIMES;
  return AgeCategory.BENJAMINS;
};

export const formatDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateShort = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const uid = (prefix = 'id'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const initials = (name: string, lastName: string): string =>
  `${(name || '').charAt(0)}${(lastName || '').charAt(0)}`;

export const generateRegistrationNumber = (existingCount: number): string =>
  `SD-${new Date().getFullYear()}-${String(existingCount + 1).padStart(4, '0')}`;

export const currentDateISO = (): string => new Date().toISOString().slice(0, 10);

export const maskNin = (nin: string): string => {
  const clean = (nin || '').trim();
  if (!clean) return '---';
  if (clean.length <= 4) return clean;
  return `••••••${clean.slice(-4)}`;
};

export const normalizeSearch = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export const matchSearch = (haystack: string, query: string): boolean =>
  normalizeSearch(haystack).includes(normalizeSearch(query));

export const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};