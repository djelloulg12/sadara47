import {
  AgeCategory,
  Agreement,
  AppNotification,
  Athlete,
  AttendanceRecord,
  ClubActivity,
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
  seeded: 'sadara47_seeded_v1',
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

const rawSeedAthletes: Array<Omit<Athlete, 'age' | 'category' | 'registrationNumber' | 'joinedAt'>> = [
  {
    id: 'a1',
    nin: '20902030405060701',
    name: 'علي',
    lastName: 'محمد',
    dob: '1998-05-20',
    gender: Gender.MALE,
    level: SkillLevel.ELITE,
    sport: Sport.SWIMMING,
    swimStyle: [SwimStyle.FREE, SwimStyle.MEDLEY],
    progress: 88,
    assignedCoach: 'جلول قندوز',
    membershipStatus: MembershipStatus.ACTIVE,
    medicalClearance: true,
    medicalNotes: 'لائق طبياً - لا ملاحظات',
    address: 'حي الأمل - غرداية',
    phone: '0661000001',
    bloodType: 'O+',
    guardianName: '',
    location: 'المسبح الأولمبي',
    transport: true,
  },
  {
    id: 'a2',
    nin: '20902030405060702',
    name: 'فاطمة',
    lastName: 'الزهراء',
    dob: '2005-01-15',
    gender: Gender.FEMALE,
    level: SkillLevel.ADVANCED,
    sport: Sport.SPRINTING,
    progress: 72,
    assignedCoach: 'أحمد سباح',
    membershipStatus: MembershipStatus.ACTIVE,
    medicalClearance: true,
    address: 'حي النور - غرداية',
    phone: '0661000002',
    bloodType: 'A-',
    guardianName: '',
    location: 'الملعب البلدي',
    transport: false,
  },
  {
    id: 'a3',
    nin: '20902030405060703',
    name: 'يوسف',
    lastName: 'أحمد',
    dob: '1994-11-30',
    gender: Gender.MALE,
    level: SkillLevel.ELITE,
    sport: Sport.CROSS_COUNTRY,
    progress: 82,
    assignedCoach: 'جلول قندوز',
    membershipStatus: MembershipStatus.ACTIVE,
    medicalClearance: true,
    address: 'وسط المدينة - غرداية',
    phone: '0661000003',
    bloodType: 'B+',
    guardianName: '',
    location: 'غابة غرداية',
    transport: true,
  },
  {
    id: 'a4',
    nin: '20902030405060704',
    name: 'سارة',
    lastName: 'خالد',
    dob: '2008-08-10',
    gender: Gender.FEMALE,
    level: SkillLevel.INTERMEDIATE,
    sport: Sport.SWIMMING,
    swimStyle: [SwimStyle.BREAST, SwimStyle.BACK],
    progress: 64,
    assignedCoach: 'أحمد سباح',
    membershipStatus: MembershipStatus.ACTIVE,
    medicalClearance: true,
    address: 'حي المطار - غرداية',
    phone: '0661000004',
    bloodType: 'AB+',
    guardianName: 'خالد بن أحمد',
    location: 'المسبح النصف أولمبي',
    transport: false,
  },
  {
    id: 'a5',
    nin: '20902030405060705',
    name: 'حسن',
    lastName: 'عبدالله',
    dob: '1996-03-25',
    gender: Gender.MALE,
    level: SkillLevel.ADVANCED,
    sport: Sport.SPRINTING,
    progress: 78,
    assignedCoach: 'جلول قندوز',
    membershipStatus: MembershipStatus.PENDING,
    medicalClearance: false,
    medicalNotes: 'بإنتظار تجديد الشهادة الطبية',
    address: 'حي الواحات - غرداية',
    phone: '0661000005',
    bloodType: 'O-',
    guardianName: '',
    location: 'الملعب البلدي',
    transport: true,
  },
];

const seedAthletes = (): Athlete[] =>
  rawSeedAthletes.map((a, index) => {
    const age = calculateAge(a.dob);
    return {
      ...a,
      age,
      category: getAgeCategory(age),
      registrationNumber: `SD-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
      joinedAt: '2024-09-01',
    };
  });

const seedUsers = (): User[] => [
  { id: 'u1', name: 'رئيس النادي', username: 'president', password: '123', role: UserRole.PRESIDENT },
  { id: 'u2', name: 'مسير النادي', username: 'manager', password: '123', role: UserRole.MANAGER },
  { id: 'u3', name: 'المدرب الرئيسي', username: 'coach', password: '123', role: UserRole.COACH },
  { id: 'u4', name: 'علي محمد', username: 'athlete', password: '123', role: UserRole.ATHLETE, athleteId: 'a1' },
  { id: 'u5', name: 'ولي سارة', username: 'parent', password: '123', role: UserRole.GUARDIAN, athleteId: 'a4' },
];

const seedPlans = (): TrainingPlan[] => [
  {
    id: 'p1',
    title: 'تدريب المسافات - تقنية حرة',
    sport: Sport.SWIMMING,
    description: 'إحماء 400م + 8×100م سباحة حرة + تقنيات الانطلاق والوصول والركلة تحت الماء.',
    schedule: 'السبت والثلاثاء - 16:00',
    location: 'المسبح الأولمبي - غرداية',
    createdAt: '2025-09-01',
  },
  {
    id: 'p2',
    title: 'تمارين اللياقة والتكتيك',
    sport: Sport.CROSS_COUNTRY,
    description: 'جري في الطبيعة 6كم + تمارين سرعة وتنفس + تقوية لعضلات الساق.',
    schedule: 'الاثنين والخميس - 17:00',
    location: 'غابة غرداية',
    createdAt: '2025-09-01',
  },
  {
    id: 'p3',
    title: 'سباقات السرعة والانطلاقة',
    sport: Sport.SPRINTING,
    description: 'انطلاقات 30م، 60م و100م + تمارين خفيفة موجهة لتحسين التردد الخطوي.',
    schedule: 'الأحد والأربعاء - 17:30',
    location: 'الملعب البلدي - غرداية',
    createdAt: '2025-09-01',
  },
];

const seedApplications = (): RegistrationApplication[] => [
  {
    id: 'app1',
    status: 'pending',
    nin: '20902030405060709',
    name: 'أمينة',
    lastName: 'بلحاج',
    dob: '2010-02-11',
    gender: Gender.FEMALE,
    sport: Sport.SWIMMING,
    swimStyle: [SwimStyle.FREE],
    level: SkillLevel.BEGINNER,
    phone: '0770001112',
    address: 'حي الوئام - غرداية',
    bloodType: 'A+',
    guardianName: 'بلحاج الطاهر',
    medicalClearance: true,
    category: 'أصاغر',
    subscriptionType: 'اشتراك حر',
    pool: 'المسبح الأولمبي',
    guardianBirthDate: '1980-05-14',
    guardianBirthPlace: 'غرداية',
    idCardNumber: '10987654321',
    idIssueDate: '2019-01-20',
    idIssueAuthority: 'غرداية',
    consent18_07: true,
    submittedAt: '2026-09-10',
  },
  {
    id: 'app2',
    status: 'pending',
    nin: '20902030405060710',
    name: 'رياض',
    lastName: 'بن يحيى',
    dob: '2007-06-22',
    gender: Gender.MALE,
    sport: Sport.SPRINTING,
    level: SkillLevel.INTERMEDIATE,
    phone: '0550111222',
    address: 'حي 200 مسكن - غرداية',
    bloodType: 'B-',
    guardianName: '',
    medicalClearance: true,
    category: 'أصاغر',
    subscriptionType: 'ضمن اتفاقية معتمدة',
    agreementName: 'اتفاقية المدرسة الوطنية للرياضات الأولمبية',
    pool: 'الملعب البلدي',
    guardianBirthDate: '1985-02-09',
    guardianBirthPlace: 'الجزائر العاصمة',
    idCardNumber: '10987654322',
    idIssueDate: '2018-06-11',
    idIssueAuthority: 'الجزائر العاصمة',
    consent18_07: true,
    submittedAt: '2026-09-12',
  },
];

const seedRecords = (): PersonalRecord[] => [
  { id: 'r1', athleteId: 'a1', discipline: '50م سباحة حرة', value: '27.9 ث', numeric: 27.9, date: '2026-10-15' },
  { id: 'r2', athleteId: 'a1', discipline: '50م سباحة حرة', value: '28.4 ث', numeric: 28.4, date: '2026-07-15' },
  { id: 'r3', athleteId: 'a1', discipline: '100م سباحة حرة', value: '1:02.4', numeric: 62.4, date: '2026-05-20' },
  { id: 'r4', athleteId: 'a2', discipline: '100م عدو', value: '12.85 ث', numeric: 12.85, date: '2026-06-02' },
  { id: 'r5', athleteId: 'a3', discipline: '5كم عدو ريفي', value: '18:40', numeric: 1120, date: '2026-08-10' },
  { id: 'r6', athleteId: 'a4', discipline: '50م سباحة حرة', value: '35.2 ث', numeric: 35.2, date: '2026-09-01' },
  { id: 'r7', athleteId: 'a5', discipline: '100م عدو', value: '11.9 ث', numeric: 11.9, date: '2026-09-18' },
];

const seedActivities = (): ClubActivity[] => [
  {
    id: 'ev1',
    title: 'كأس الصدارة الشتوي',
    date: '2026-03-15',
    location: 'المسبح الأولمبي بغرداية',
    type: 'بطولة',
    status: 'ريان',
    description: 'بطولة ولائية مؤهلة للأدوار الجهوية.',
  },
  {
    id: 'ev2',
    title: 'دورة الأخلاق والروح الرياضية',
    date: '2026-03-20',
    location: 'قاعة المحاضرات - النادي',
    type: 'تربوي',
    status: 'ريان',
    description: 'ندوة تثقيفية حول قيم النبلاء في الرياضة.',
  },
  {
    id: 'ev3',
    title: 'يوم الانتقاء للفئات الصغرى',
    date: '2026-04-02',
    location: 'المسبح النصف أولمبي',
    type: 'انتقاء',
    status: 'تحضير',
    description: 'اختبارات دخول للسباحين الجدد.',
  },
  {
    id: 'ev4',
    title: 'البطولة الوطنية بالجزائر العاصمة',
    date: '2026-05-12',
    location: 'مجمع 05 جويلية',
    type: 'رسمي',
    status: 'تحضير',
    description: 'المشاركة في الحدث الرياضي الأبرز وطنياً.',
  },
];

const seedDisciplinary = (): DisciplinaryCase[] => [
  {
    id: 'dis1',
    targetId: 'a1',
    targetName: 'علي محمد',
    targetRole: 'ATHLETE',
    reporterName: 'جلول قندوز',
    reason: 'تأخر متكرر عن حصص التدريب الصباحية (3 مرات في أسبوع واحد)',
    date: '2026-03-01',
    status: 'REPORTED',
  },
  {
    id: 'dis2',
    targetId: 'u3',
    targetName: 'جلول قندوز',
    targetRole: 'COACH',
    reporterName: 'الإدارة',
    reason: 'عدم تسليم تقارير الأداء الفني في الوقت المحدد لشهر فيفري',
    date: '2026-02-25',
    status: 'FINAL',
    finalDecision: 'تنبيه كتابي أول مع خصم من علاوة الأداء',
  },
];

const seedAgreements = (): Agreement[] => [
  {
    id: 'ag1',
    name: 'اتفاقية المدرسة الوطنية للرياضات الأولمبية',
    institution: 'المدرسة الوطنية للرياضات الأولمبية - الجزائر',
    reference: 'AGR-2026-001',
    status: 'نشطة',
    discountPct: 20,
    createdAt: '2026-01-10',
  },
  {
    id: 'ag2',
    name: 'اتفاقية مديرية الشباب والرياضة لولاية غرداية',
    institution: 'مديرية الشباب والرياضة - غرداية',
    reference: 'AGR-2026-014',
    status: 'نشطة',
    discountPct: 15,
    createdAt: '2026-02-01',
  },
];

const seedAttendance = (): AttendanceRecord[] => [
  { id: 'at1', athleteId: 'a1', planId: 'p1', date: '2026-09-14', present: true },
  { id: 'at2', athleteId: 'a4', planId: 'p1', date: '2026-09-14', present: false, note: 'غياب غير مبرر' },
  { id: 'at3', athleteId: 'a3', planId: 'p2', date: '2026-09-14', present: true },
];

const seedNotifications = (): AppNotification[] => [
  {
    id: 'n1',
    type: 'competition',
    title: 'إشعار تأهل رسمي',
    body: 'تم إدراج سارة خالد ضمن القائمة الرسمية لبطولة الولاية - سباحة.',
    fromName: 'الإدارة',
    date: '2026-09-10',
    athleteId: 'a4',
    toUserIds: ['u5'],
    readBy: [],
  },
  {
    id: 'n2',
    type: 'disciplinary',
    title: 'تقرير سلوكي',
    body: 'تأخر متكرر عن حصص التدريب الصباحية - تم تسجيله في سجل الانضباط.',
    fromName: 'جلول قندوز',
    date: '2026-03-01',
    athleteId: 'a1',
    toUserIds: ['u4'],
    readBy: [],
  },
];

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
  discountPct?: number;
  receiptNumber?: string;
  paymentMethod?: string;
}

export const setPrintData = (data: PrintData): void => saveValue(KEYS.printData, data);
export const getPrintData = (): PrintData | null => load<PrintData | null>(KEYS.printData, null);
export const clearPrintData = (): void => localStorage.removeItem(KEYS.printData);

export const saveSession = (user: User | null): void => saveValue(KEYS.session, user);
export const getSession = (): User | null => load<User | null>(KEYS.session, null);

export const getRegistrationOpen = (): boolean => load<boolean>(KEYS.regOpen, true);
export const setRegistrationOpenValue = (open: boolean): void => saveValue(KEYS.regOpen, open);