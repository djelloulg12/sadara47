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
  /** تفعيل/تجميد الحساب — المجمّد لا يمكنه الدخول */
  active?: boolean;
  phone?: string;
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
  swimStyle?: SwimStyle[];
  progress: number;
  assignedCoach: string;
  membershipStatus: MembershipStatus;
  medicalClearance: boolean;
  medicalNotes?: string;
  address: string;
  phone: string;
  bloodType: string;
  guardianName?: string;
  guardianUserId?: string;
  photoUrl?: string;
  location?: string;
  transport?: boolean;
  joinedAt: string;
  bio?: string;
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type ApplicantCategory = 'أصاغر' | 'أكابر';
export type SubscriptionType = 'اشتراك حر' | 'ضمن اتفاقية معتمدة';

export interface RegistrationApplication {
  id: string;
  status: RegistrationStatus;
  nin: string;
  name: string;
  lastName: string;
  firstNameLatin?: string;
  lastNameLatin?: string;
  whatsapp?: string;
  username?: string;
  password?: string;
  dob: string;
  gender: Gender;
  sport: Sport;
  level: SkillLevel;
  swimStyle?: SwimStyle[];
  phone: string;
  address: string;
  bloodType: string;
  guardianName?: string;
  medicalClearance: boolean;
  category: ApplicantCategory;
  subscriptionType: string;
  agreementName?: string;
  pool: string;
  photoUrl?: string;
  filledFormUrl?: string;
  scanUrl?: string;
  guardianBirthDate?: string;
  guardianBirthPlace?: string;
  idCardNumber?: string;
  idIssueDate?: string;
  idIssueAuthority?: string;
  consent18_07: boolean;
  transport?: boolean;
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
  internal?: boolean;
}

export interface ClubActivity {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
  status: string;
  description: string;
  participants?: string[];
}

/** طلب انضمام مدرب إلى النادي (تعبئة كاملة + شهادات معتمدة) */
export interface CoachApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  name: string;
  lastName: string;
  dob?: string;
  phone: string;
  email?: string;
  address?: string;
  specialty: string;
  experienceYears?: number;
  diploma: string;
  diplomaYear?: string;
  certifications?: string;
  certificateFiles?: string[];
  references?: string;
  bio?: string;
  username?: string;
  password?: string;
  submittedAt: string;
}

export interface Agreement {
  id: string;
  name: string;
  institution: string;
  reference: string;
  status: 'نشطة' | 'منتهية';
  discountPct?: number;
  createdAt: string;
}

/** نوع اشتراك قابل للتكوين من لوحة تحكم المسير (الاسم + القيمة + المدة) */
export interface SubscriptionTier {
  id: string;
  name: string;
  periodLabel: string;
  amount: number;
}

/** إعدادات الاشتراك والوصل التي يضبطها المسير/الرئيس */
export interface ClubSettings {
  season: string;
  subscriptionTypes: SubscriptionTier[];
  insuranceFee: number;
  transportFee: number;
  kitFee: number;
  defaultDiscountPct: number;
}

export interface AttendanceRecord {
  id: string;
  athleteId: string;
  planId: string;
  date: string;
  present: boolean;
  note?: string;
}

/* ----------------------------- البرنامج الأسبوعي ----------------------------- */
/** أيام الأسبوع التدريبي */
export type WeekDay = 'السبت' | 'الأحد' | 'الاثنين' | 'الثلاثاء' | 'الأربعاء' | 'الخميس';

/** فئات الأفواج (أصاغر / أكابر) */
export type GroupCategory = 'أصاغر' | 'أكابر';

export type SessionStatus = 'pending' | 'approved';

/** فوج تدريبي: قائمة رياضيين + مدربان إجباريان (رئيسي + مساعد) */
export interface TrainingGroup {
  id: string;
  name: string;
  category: GroupCategory;
  sport: Sport;
  memberIds: string[];
  headCoachId: string;
  assistantCoachId: string;
}

/**
 * حصة تدريبية (خانة زمنية في مسبح واحد).
 * الاشتراك: حصة مشتركة بين 2 إلى 4 أفواج في نفس المسبح والتوقيت.
 * الحصص المشتركة يتطلب تفعيل `managerApproved` قبل اعتمادها.
 */
export interface GroupSession {
  id: string;
  groupIds: string[];
  day: WeekDay;
  start: string;
  end: string;
  pool: string;
  basin?: string;
  focus: string;
  status: SessionStatus;
  managerApproved: boolean;
  createdBy: string;
}

export type NotificationType =
  | 'absence'
  | 'health'
  | 'disciplinary'
  | 'competition'
  | 'registration'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  fromName: string;
  date: string;
  athleteId?: string;
  toUserIds: string[];
  readBy: string[];
}