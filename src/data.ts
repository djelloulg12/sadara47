import {
  AgeCategory,
  Agreement,
  AppNotification,
  Athlete,
  AttendanceRecord,
  ClubActivity,
  ClubSettings,
  DisciplinaryCase,
  Gender,
  MembershipStatus,
  PersonalRecord,
  RegistrationApplication,
  SkillLevel,
  Sport,
  SwimStyle,
  TrainingPlan,
  User,
  UserRole,
} from './types';
import { calculateAge, getAgeCategory } from './utils/helpers';
import { DEFAULT_CLUB_SETTINGS } from './constants';
import { SWIMMER_SEED } from './seeds/swimmers';

const KEYS = {
  athletes: 'sadara47_athletes',
  users: 'sadara47_users',
  plans: 'sadara47_plans',
  applications: 'sadara47_applications',
  records: 'sadara47_records',
  activities: 'sadara47_activities',
  disciplinary: 'sadara47_disciplinary',
  agreements: 'sadara47_agreements',
  attendance: 'sadara47_attendance',
  notifications: 'sadara47_notifications',
  session: 'sadara47_session',
  printData: 'sadara47_print_data',
  regOpen: 'sadara47_registration_open',
  seeded: 'sadara47_seeded_v2',
  settings: 'sadara47_club_settings',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveValue(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('فشل حفظ البيانات', error);
  }
}

/* ------------------------------- Seeds ------------------------------- */

const seedAthletes = (): Athlete[] =>
  SWIMMER_SEED.map((a, index) => {
    const age = calculateAge(a.dob);
    return {
      ...a,
      age,
      category: getAgeCategory(age),
      registrationNumber: `SD-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
      joinedAt: new Date().toISOString().slice(0, 10),
    };
  });

const seedUsers = (): User[] => [
  { id: 'u_admin', name: 'محمد حناي', username: 'admin', password: 'admin', role: UserRole.PRESIDENT },
  ...SWIMMER_SEED.map((a, i) => ({
    id: `usw${i + 1}`,
    name: `${a.name} ${a.lastName}`.trim(),
    username: 'user',
    password: '123',
    role: UserRole.ATHLETE,
    athleteId: a.id,
  })),
];

const seedPlans = (): TrainingPlan[] => [];

const seedApplications = (): RegistrationApplication[] => [];

const seedRecords = (): PersonalRecord[] => [];

const seedActivities = (): ClubActivity[] => [];

const seedDisciplinary = (): DisciplinaryCase[] => [];

const seedAgreements = (): Agreement[] => [];

const seedAttendance = (): AttendanceRecord[] => [];

const seedNotifications = (): AppNotification[] => [];

export interface AppState {
  athletes: Athlete[];
  users: User[];
  plans: TrainingPlan[];
  applications: RegistrationApplication[];
  records: PersonalRecord[];
  activities: ClubActivity[];
  disciplinary: DisciplinaryCase[];
  agreements: Agreement[];
  attendance: AttendanceRecord[];
  notifications: AppNotification[];
}

export function getInitialState(): AppState {
  if (!localStorage.getItem(KEYS.seeded)) {
    const state: AppState = {
      athletes: seedAthletes(),
      users: seedUsers(),
      plans: seedPlans(),
      applications: seedApplications(),
      records: seedRecords(),
      activities: seedActivities(),
      disciplinary: seedDisciplinary(),
      agreements: seedAgreements(),
      attendance: seedAttendance(),
      notifications: seedNotifications(),
    };
    Object.entries(state).forEach(([key, value]) => saveValue(`sadara47_${key}`, value));
    localStorage.setItem(KEYS.seeded, '1');
    return state;
  }
  return {
    athletes: load<Athlete[]>(KEYS.athletes, []),
    users: load<User[]>(KEYS.users, []),
    plans: load<TrainingPlan[]>(KEYS.plans, []),
    applications: load<RegistrationApplication[]>(KEYS.applications, []),
    records: load<PersonalRecord[]>(KEYS.records, []),
    activities: load<ClubActivity[]>(KEYS.activities, []),
    disciplinary: load<DisciplinaryCase[]>(KEYS.disciplinary, []),
    agreements: load<Agreement[]>(KEYS.agreements, []),
    attendance: load<AttendanceRecord[]>(KEYS.attendance, []),
    notifications: load<AppNotification[]>(KEYS.notifications, []),
  };
}

export const saveAthletes = (v: Athlete[]) => saveValue(KEYS.athletes, v);
export const savePlans = (v: TrainingPlan[]) => saveValue(KEYS.plans, v);
export const saveApplications = (v: RegistrationApplication[]) => saveValue(KEYS.applications, v);
export const saveRecords = (v: PersonalRecord[]) => saveValue(KEYS.records, v);
export const saveActivities = (v: ClubActivity[]) => saveValue(KEYS.activities, v);
export const saveDisciplinary = (v: DisciplinaryCase[]) => saveValue(KEYS.disciplinary, v);
export const saveAgreements = (v: Agreement[]) => saveValue(KEYS.agreements, v);
export const saveAttendance = (v: AttendanceRecord[]) => saveValue(KEYS.attendance, v);
export const saveNotifications = (v: AppNotification[]) => saveValue(KEYS.notifications, v);

export const getClubSettings = (): ClubSettings => {
  const saved = load<Partial<ClubSettings>>(KEYS.settings, {});
  return {
    season: saved.season || DEFAULT_CLUB_SETTINGS.season,
    subscriptionTypes:
      Array.isArray(saved.subscriptionTypes) && saved.subscriptionTypes.length > 0
        ? saved.subscriptionTypes
        : DEFAULT_CLUB_SETTINGS.subscriptionTypes,
    insuranceFee: typeof saved.insuranceFee === 'number' ? saved.insuranceFee : DEFAULT_CLUB_SETTINGS.insuranceFee,
    transportFee: typeof saved.transportFee === 'number' ? saved.transportFee : DEFAULT_CLUB_SETTINGS.transportFee,
    kitFee: typeof saved.kitFee === 'number' ? saved.kitFee : DEFAULT_CLUB_SETTINGS.kitFee,
    defaultDiscountPct:
      typeof saved.defaultDiscountPct === 'number' ? saved.defaultDiscountPct : DEFAULT_CLUB_SETTINGS.defaultDiscountPct,
  };
};

export const saveClubSettings = (settings: ClubSettings): void => saveValue(KEYS.settings, settings);

export interface PrintData {
  name: string;
  lastName: string;
  firstNameLatin?: string;
  lastNameLatin?: string;
  whatsapp?: string;
  dob: string;
  gender: string;
  address: string;
  bloodType: string;
  phone: string;
  sport: Sport;
  guardianName?: string;
  nin: string;
  level: string;
  swimStyle?: string[];
  category?: string;
  subscriptionType?: string;
  subscriptionPeriod?: string;
  agreementName?: string;
  pool?: string;
  photoUrl?: string;
  guardianBirthDate?: string;
  guardianBirthPlace?: string;
  idCardNumber?: string;
  idIssueDate?: string;
  idIssueAuthority?: string;
  username?: string;
  password?: string;
  transport?: boolean;
  kit?: boolean;
  discountPct?: number;
  receiptNumber?: string;
  paymentMethod?: string;
  season?: string;
  membershipNumber?: string;
  subscriptionAmount?: number;
  insuranceFee?: number;
  transportFee?: number;
  kitFee?: number;
}

export const setPrintData = (data: PrintData): void => saveValue(KEYS.printData, data);
export const getPrintData = (): PrintData | null => load<PrintData | null>(KEYS.printData, null);
export const clearPrintData = (): void => localStorage.removeItem(KEYS.printData);

export const saveSession = (user: User | null): void => saveValue(KEYS.session, user);
export const getSession = (): User | null => load<User | null>(KEYS.session, null);

export const getRegistrationOpen = (): boolean => load<boolean>(KEYS.regOpen, true);
export const setRegistrationOpenValue = (open: boolean): void => saveValue(KEYS.regOpen, open);