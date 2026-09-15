export enum Sport {
  SWIMMING = 'السباحة',
  CROSS_COUNTRY = 'العدو الريفي',
  SPRINTING = 'العدو السريع',
}

export enum UserRole {
  PRESIDENT = 'PRESIDENT',
  MANAGER = 'MANAGER',
  COACH = 'COACH',
  ATHLETE = 'ATHLETE',
  GUARDIAN = 'GUARDIAN',
}

export enum Gender {
  MALE = 'ذكر',
  FEMALE = 'أنثى',
}

export enum SkillLevel {
  BEGINNER = 'مبتدئ',
  INTERMEDIATE = 'متوسط',
  ADVANCED = 'متقدم',
  ELITE = 'نخبة',
}

export enum AgeCategory {
  BENJAMINS = 'براعم (10-11)',
  MINIMES = 'أصاغر (12-13)',
  CADETS = 'أشبال (14-15)',
  JUNIORS = 'أواسط (16-17)',
  SENIORS = 'أكابر (18+)',
}

export enum SwimStyle {
  FREE = 'حرة (FREE)',
  BACK = 'ظهر (BACK)',
  BREAST = 'صدر (BREAST)',
  FLY = 'فراشة (FLY)',
  MEDLEY = 'متناوبة (MEDLEY)',
}

export enum MembershipStatus {
  ACTIVE = 'نشط',
  FROZEN = 'مجمد',
  PENDING = 'قيد الانتظار',
}

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  athleteId?: string;
}

export interface Athlete {
  id: string;
  registrationNumber: string;
  nin: string;
  name: string;
  lastName: string;
  dob: string;
  age: number;
  gender: Gender;
  category: AgeCategory;
  level: SkillLevel;
  sport: Sport;
  swimStyle?: SwimStyle;
  progress: number;
  assignedCoach: string;
  membershipStatus: MembershipStatus;
  medicalClearance: boolean;
  medicalNotes?: string;
  address: string;
  phone: string;
  bloodType: string;
  guardianName?: string;
  photoUrl?: string;
  location?: string;
  transport?: boolean;
  joinedAt: string;
  bio?: string;
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationApplication {
  id: string;
  status: RegistrationStatus;
  nin: string;
  name: string;
  lastName: string;
  dob: string;
  gender: Gender;
  sport: Sport;
  level: SkillLevel;
  swimStyle?: SwimStyle;
  phone: string;
  address: string;
  bloodType: string;
  guardianName?: string;
  medicalClearance: boolean;
  submittedAt: string;
}

export interface TrainingPlan {
  id: string;
  title: string;
  sport: Sport;
  description: string;
  schedule: string;
  location: string;
  createdAt: string;
}

export interface PersonalRecord {
  id: string;
  athleteId: string;
  discipline: string;
  value: string;
  numeric?: number;
  date: string;
}

export interface DisciplinaryCase {
  id: string;
  targetId: string;
  targetName: string;
  targetRole: 'ATHLETE' | 'COACH';
  reporterName: string;
  reason: string;
  date: string;
  status: 'REPORTED' | 'APPEALED' | 'FINAL';
  appealText?: string;
  finalDecision?: string;
}

export interface ClubActivity {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
  status: string;
  description: string;
}