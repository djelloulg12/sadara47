import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Agreement,
  AppNotification,
  Athlete,
  AttendanceRecord,
  ClubActivity,
  ClubSettings,
  CoachApplication,
  DisciplinaryCase,
  GroupSession,
  PersonalRecord,
  RegistrationApplication,
  RegistrationStatus,
  TrainingGroup,
  TrainingPlan,
  User,
  UserRole,
} from './types';
import {
  getInitialState,
  saveActivities,
  saveAgreements,
  saveApplications,
  saveAthletes,
  saveAttendance,
  saveClubSettings,
  saveCoachApplications,
  saveDisciplinary,
  saveGroups,
  saveNotifications,
  savePlans,
  saveRecords,
  saveSessions,
  saveSession,
  saveValue,
  getSession,
  getRegistrationOpen,
  getClubSettings,
  setRegistrationOpenValue,
} from './data';
import { calculateAge, getAgeCategory, uid } from './utils/helpers';

/* ------------------------------ Routing ------------------------------ */
type Route = 'login' | 'register' | 'print-form' | 'apply-coach' | 'print-schedule' | 'app';

interface AppContextType {
  route: Route;
  setRoute: (route: Route) => void;
}

const AppContext = createContext<AppContextType | null>(null);
export const useAppContext = (): AppContextType => useContext(AppContext)!;

const readRoute = (): Route => {
  const hash = window.location.hash.replace(/^#/, '');
  if (['login', 'register', 'print-form', 'apply-coach', 'print-schedule', 'app'].includes(hash)) return hash as Route;
  return 'login';
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRouteState] = useState<Route>(readRoute);

  const setRoute = useCallback((next: Route) => {
    if (window.location.hash !== `#${next}`) {
      try {
        window.history.replaceState(null, '', `#${next}`);
      } catch {
        window.location.hash = next;
      }
    }
    setRouteState(next);
  }, []);

  useEffect(() => {
    const onHash = () => setRouteState(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return <AppContext.Provider value={{ route, setRoute }}>{children}</AppContext.Provider>;
};

/* --------------------------- Authentication --------------------------- */
interface AuthContextType {
  user: User | null;
  users: User[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (data: Omit<User, 'id'>) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  isRole: (...roles: UserRole[]) => boolean;
  canManage: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = (): AuthContextType => useContext(AuthContext)!;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getSession());
  const [users, setUsers] = useState<User[]>(() => getInitialState().users);

  const login = useCallback(
    (username: string, password: string): boolean => {
      const found = users.find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password,
      );
      if (found && found.active !== false) {
        setUser(found);
        saveSession(found);
        return true;
      }
      return false;
    },
    [users],
  );

  const logout = useCallback(() => {
    setUser(null);
    saveSession(null);
  }, []);

  const addUser = useCallback((data: Omit<User, 'id'>): User => {
    const u: User = { ...data, active: data.active ?? true, id: data.username.replace(/[^a-z0-9]/gi, '').slice(0, 8) || `u${Date.now()}` };
    setUsers((prev) => {
      const exists = prev.find((x) => x.username.toLowerCase() === u.username.toLowerCase());
      const next = exists ? prev.map((x) => (x === exists ? u : x)) : [u, ...prev];
      saveValue('sadara47_users', next);
      return next;
    });
    return u;
  }, []);

  const updateUser = useCallback((id: string, data: Partial<User>) => {
    setUsers((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...data } : x));
      saveValue('sadara47_users', next);
      return next;
    });
    setUser((current) => (current && current.id === id ? { ...current, ...data } : current));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveValue('sadara47_users', next);
      return next;
    });
    setUser((current) => (current && current.id === id ? null : current));
  }, []);

  const isRole = useCallback(
    (...roles: UserRole[]) => !!user && roles.includes(user.role),
    [user],
  );

  const canManage =
    !!user &&
    (user.role === UserRole.PRESIDENT || user.role === UserRole.MANAGER || user.role === UserRole.COACH);

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, updateUser, deleteUser, isRole, canManage }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ------------------------------- Data -------------------------------- */
interface DataContextType {
  athletes: Athlete[];
  plans: TrainingPlan[];
  applications: RegistrationApplication[];
  records: PersonalRecord[];
  activities: ClubActivity[];
  disciplinary: DisciplinaryCase[];
  agreements: Agreement[];
  attendance: AttendanceRecord[];
  notifications: AppNotification[];
  coachApplications: CoachApplication[];
  groups: TrainingGroup[];
  sessions: GroupSession[];
  registrationOpen: boolean;
  clubSettings: ClubSettings;
  updateClubSettings: (settings: ClubSettings) => void;
  setRegistrationOpen: (open: boolean) => void;
  addCoachApplication: (data: Omit<CoachApplication, 'id' | 'status' | 'submittedAt'>) => void;
  setCoachApplicationStatus: (id: string, status: CoachApplication['status'], credentials?: { username: string; password: string }) => void;
  deleteCoachApplication: (id: string) => void;
  addGroup: (data: Omit<TrainingGroup, 'id'>) => TrainingGroup;
  updateGroup: (id: string, data: Partial<TrainingGroup>) => void;
  deleteGroup: (id: string) => void;
  addSession: (data: Omit<GroupSession, 'id' | 'status' | 'managerApproved'>) => GroupSession;
  updateSession: (id: string, data: Partial<GroupSession>) => void;
  approveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addAthlete: (data: Omit<Athlete, 'id' | 'age' | 'category'>) => Athlete;
  updateAthlete: (id: string, data: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  updateAthleteBio: (id: string, bio: string) => void;
  addPlan: (data: Omit<TrainingPlan, 'id' | 'createdAt'>) => void;
  updatePlan: (id: string, data: Partial<TrainingPlan>) => void;
  deletePlan: (id: string) => void;
  addApplication: (data: Omit<RegistrationApplication, 'id' | 'status' | 'submittedAt'>) => void;
  setApplicationStatus: (id: string, status: RegistrationStatus) => void;
  deleteApplication: (id: string) => void;
  addRecord: (data: Omit<PersonalRecord, 'id'>) => void;
  updateRecord: (id: string, data: Partial<PersonalRecord>) => void;
  deleteRecord: (id: string) => void;
  addActivity: (data: Omit<ClubActivity, 'id'>) => void;
  deleteActivity: (id: string) => void;
  updateActivity: (id: string, data: Partial<ClubActivity>) => void;
  addDisciplinary: (data: Omit<DisciplinaryCase, 'id'>) => void;
  updateDisciplinary: (id: string, data: Partial<DisciplinaryCase>) => void;
  deleteDisciplinary: (id: string) => void;
  addAgreement: (data: Omit<Agreement, 'id' | 'createdAt'>) => void;
  updateAgreement: (id: string, data: Partial<Agreement>) => void;
  deleteAgreement: (id: string) => void;
  markAttendance: (athleteId: string, planId: string, date: string, present: boolean, note?: string) => void;
  clearAttendance: (athleteId: string, planId: string, date: string) => void;
  addNotification: (data: Omit<AppNotification, 'id' | 'date' | 'readBy'>) => void;
  markNotificationRead: (id: string, userId: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);
export const useData = (): DataContextType => useContext(DataContext)!;

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialState = getInitialState();

  const [athletes, setAthletes] = useState<Athlete[]>(initialState.athletes);
  const [plans, setPlans] = useState<TrainingPlan[]>(initialState.plans);
  const [applications, setApplications] = useState<RegistrationApplication[]>(initialState.applications);
  const [records, setRecords] = useState<PersonalRecord[]>(initialState.records);
  const [activities, setActivities] = useState<ClubActivity[]>(initialState.activities);
  const [disciplinary, setDisciplinary] = useState<DisciplinaryCase[]>(initialState.disciplinary);
  const [agreements, setAgreements] = useState<Agreement[]>(initialState.agreements);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(initialState.attendance);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialState.notifications);
  const [coachApplications, setCoachApplications] = useState<CoachApplication[]>(initialState.coachApplications);
  const [groups, setGroups] = useState<TrainingGroup[]>(initialState.groups);
  const [sessions, setSessions] = useState<GroupSession[]>(initialState.sessions);
  const [registrationOpen, setRegistrationOpenState] = useState<boolean>(() => getRegistrationOpen());
  const [clubSettings, setClubSettings] = useState<ClubSettings>(() => getClubSettings());

  useEffect(() => saveAthletes(athletes), [athletes]);
  useEffect(() => savePlans(plans), [plans]);
  useEffect(() => saveApplications(applications), [applications]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveActivities(activities), [activities]);
  useEffect(() => saveDisciplinary(disciplinary), [disciplinary]);
  useEffect(() => saveAgreements(agreements), [agreements]);
  useEffect(() => saveAttendance(attendance), [attendance]);
  useEffect(() => saveNotifications(notifications), [notifications]);
  useEffect(() => saveCoachApplications(coachApplications), [coachApplications]);
  useEffect(() => saveGroups(groups), [groups]);
  useEffect(() => saveSessions(sessions), [sessions]);

  const setRegistrationOpen = useCallback((open: boolean) => {
    setRegistrationOpenState(open);
    setRegistrationOpenValue(open);
  }, []);

  const updateClubSettings = useCallback((settings: ClubSettings) => {
    setClubSettings(settings);
    saveClubSettings(settings);
  }, []);

  const addAthlete = useCallback(
    (data: Omit<Athlete, 'id' | 'age' | 'category'>): Athlete => {
      const age = calculateAge(data.dob);
      const category = getAgeCategory(age);
      const athlete: Athlete = { ...data, id: uid('ath'), age, category };
      setAthletes((prev) => [athlete, ...prev]);
      return athlete;
    },
    [],
  );

  const updateAthlete = useCallback((id: string, data: Partial<Athlete>) => {
    setAthletes((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
  }, []);

  const updateAthleteBio = useCallback((id: string, bio: string) => {
    setAthletes((prev) => prev.map((a) => (a.id === id ? { ...a, bio } : a)));
  }, []);

  const deleteAthlete = useCallback((id: string) => {
    setAthletes((prev) => prev.filter((a) => a.id !== id));
    setRecords((prev) => prev.filter((r) => r.athleteId !== id));
  }, []);

  const addPlan = useCallback((data: Omit<TrainingPlan, 'id' | 'createdAt'>) => {
    setPlans((prev) => [{ ...data, id: uid('plan'), createdAt: new Date().toISOString().slice(0, 10) }, ...prev]);
  }, []);

  const updatePlan = useCallback((id: string, data: Partial<TrainingPlan>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }, []);

  const deletePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addApplication = useCallback(
    (data: Omit<RegistrationApplication, 'id' | 'status' | 'submittedAt'>) => {
      setApplications((prev) => [
        { ...data, id: uid('app'), status: 'pending', submittedAt: new Date().toISOString().slice(0, 10) },
        ...prev,
      ]);
    },
    [],
  );

  const setApplicationStatus = useCallback((id: string, status: RegistrationStatus) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const deleteApplication = useCallback((id: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addRecord = useCallback((data: Omit<PersonalRecord, 'id'>) => {
    setRecords((prev) => [{ ...data, id: uid('rec') }, ...prev]);
  }, []);

  const updateRecord = useCallback((id: string, data: Partial<PersonalRecord>) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addActivity = useCallback((data: Omit<ClubActivity, 'id'>) => {
    setActivities((prev) => [{ ...data, id: uid('ev') }, ...prev]);
  }, []);

  const updateActivity = useCallback((id: string, data: Partial<ClubActivity>) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
  }, []);

  const deleteActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addDisciplinary = useCallback((data: Omit<DisciplinaryCase, 'id'>) => {
    setDisciplinary((prev) => [{ ...data, id: uid('dis') }, ...prev]);
  }, []);

  const updateDisciplinary = useCallback((id: string, data: Partial<DisciplinaryCase>) => {
    setDisciplinary((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }, []);

  const deleteDisciplinary = useCallback((id: string) => {
    setDisciplinary((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addAgreement = useCallback((data: Omit<Agreement, 'id' | 'createdAt'>) => {
    setAgreements((prev) => [{ ...data, id: uid('agr'), createdAt: new Date().toISOString().slice(0, 10) }, ...prev]);
  }, []);

  const updateAgreement = useCallback((id: string, data: Partial<Agreement>) => {
    setAgreements((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
  }, []);

  const deleteAgreement = useCallback((id: string) => {
    setAgreements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const markAttendance = useCallback(
    (athleteId: string, planId: string, date: string, present: boolean, note?: string) => {
      setAttendance((prev) => {
        const existing = prev.find((r) => r.athleteId === athleteId && r.planId === planId && r.date === date);
        if (existing) {
          return prev.map((r) => (r === existing ? { ...r, present, note } : r));
        }
        return [{ id: uid('att'), athleteId, planId, date, present, note }, ...prev];
      });
    },
    [],
  );

  const clearAttendance = useCallback((athleteId: string, planId: string, date: string) => {
    setAttendance((prev) => prev.filter((r) => !(r.athleteId === athleteId && r.planId === planId && r.date === date)));
  }, []);

  const addNotification = useCallback((data: Omit<AppNotification, 'id' | 'date' | 'readBy'>) => {
    setNotifications((prev) => [
      { ...data, id: uid('not'), date: new Date().toISOString().slice(0, 10), readBy: [] },
      ...prev,
    ]);
  }, []);

  const markNotificationRead = useCallback((id: string, userId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readBy: n.readBy.includes(userId) ? n.readBy : [...n.readBy, userId] } : n)),
    );
  }, []);

  const addCoachApplication = useCallback((data: Omit<CoachApplication, 'id' | 'status' | 'submittedAt'>) => {
    setCoachApplications((prev) => [
      { ...data, id: uid('coach'), status: 'pending', submittedAt: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
  }, []);

  const setCoachApplicationStatus = useCallback(
    (id: string, status: CoachApplication['status'], credentials?: { username: string; password: string }) => {
      setCoachApplications((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status, username: status === 'approved' ? credentials?.username ?? c.username : c.username, password: status === 'approved' ? credentials?.password ?? c.password : c.password }
            : c,
        ),
      );
    },
    [],
  );

  const deleteCoachApplication = useCallback((id: string) => {
    setCoachApplications((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addGroup = useCallback((data: Omit<TrainingGroup, 'id'>): TrainingGroup => {
    const group: TrainingGroup = { ...data, id: uid('grp') };
    setGroups((prev) => [group, ...prev]);
    return group;
  }, []);

  const updateGroup = useCallback((id: string, data: Partial<TrainingGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setSessions((prev) => prev.map((s) => ({ ...s, groupIds: s.groupIds.filter((g) => g !== id) })).filter((s) => s.groupIds.length > 0));
  }, []);

  const addSession = useCallback(
    (data: Omit<GroupSession, 'id' | 'status' | 'managerApproved'>): GroupSession => {
      const shared = data.groupIds.length > 1;
      const session: GroupSession = {
        ...data,
        id: uid('ses'),
        status: shared ? 'pending' : 'approved',
        managerApproved: !shared,
      };
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    [],
  );

  const updateSession = useCallback((id: string, data: Partial<GroupSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }, []);

  const approveSession = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'approved', managerApproved: true } : s)),
    );
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <DataContext.Provider
      value={{
        athletes,
        plans,
        applications,
        records,
        activities,
        disciplinary,
        agreements,
        attendance,
        notifications,
        coachApplications,
        groups,
        sessions,
        registrationOpen,
        clubSettings,
        updateClubSettings,
        setRegistrationOpen,
        addCoachApplication,
        setCoachApplicationStatus,
        deleteCoachApplication,
        addGroup,
        updateGroup,
        deleteGroup,
        addSession,
        updateSession,
        approveSession,
        deleteSession,
        addAthlete,
        updateAthlete,
        deleteAthlete,
        updateAthleteBio,
        addPlan,
        updatePlan,
        deletePlan,
        addApplication,
        setApplicationStatus,
        deleteApplication,
        addRecord,
        updateRecord,
        deleteRecord,
        addActivity,
        updateActivity,
        deleteActivity,
        addDisciplinary,
        updateDisciplinary,
        deleteDisciplinary,
        addAgreement,
        updateAgreement,
        deleteAgreement,
        markAttendance,
        clearAttendance,
        addNotification,
        markNotificationRead,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};