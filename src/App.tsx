import React, { useState } from 'react';
import { AppProvider, AuthProvider, DataProvider, useAuth, useAppContext } from './context';
import Layout, { PageId, isPageAllowed } from './components/Layout';
import AccessDenied from './components/AccessDenied';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import CoachApplyPage from './pages/CoachApplyPage';
import RegistrationFormDocument from './pages/RegistrationFormDocument';
import HomePage from './pages/HomePage';
import ProgramsPage from './pages/ProgramsPage';
import HallOfFamePage from './pages/HallOfFamePage';
import DashboardPage from './pages/DashboardPage';
import AccountsManagementPage from './pages/AccountsManagementPage';
import SchedulePage from './pages/SchedulePage';
import SchedulePrintDocument from './pages/SchedulePrintDocument';
import AthletesPage from './pages/AthletesPage';
import AthleteProfilePage from './pages/AthleteProfilePage';
import TrainingPage from './pages/TrainingPage';
import ApplicationsPage from './pages/ApplicationsPage';
import ActivitiesPage from './pages/ActivitiesPage';
import DisciplinaryPage from './pages/DisciplinaryPage';
import LegalPage from './pages/LegalPage';
import SettingsPage from './pages/SettingsPage';
import AgreementsPage from './pages/AgreementsPage';
import { UserRole } from './types';

const App: React.FC = () => {
  const { user } = useAuth();
  const { route } = useAppContext();

  if (route === 'print-form') {
    return <RegistrationFormDocument />;
  }
  if (route === 'register') {
    return <RegistrationPage />;
  }
  if (route === 'apply-coach') {
    return <CoachApplyPage />;
  }
  if (route === 'print-schedule') {
    return <SchedulePrintDocument />;
  }
  if (!user) {
    return <LoginPage />;
  }
  return <MainApp />;
};

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [profileAthleteId, setProfileAthleteId] = useState<string | null>(null);

  const isOwnProfile =
    !!user && (user.role === UserRole.ATHLETE || user.role === UserRole.GUARDIAN);

  const handleNavigate = (next: PageId, athleteId?: string) => {
    if (!isPageAllowed(next, user?.role)) {
      setPage('dashboard');
      return;
    }
    setPage(next);
    if (athleteId) setProfileAthleteId(athleteId);
    if (next === 'dashboard') setProfileAthleteId(null);
  };

  const renderPage = () => {
    if (!isPageAllowed(page, user?.role)) {
      return <AccessDenied onHome={() => handleNavigate('dashboard')} />;
    }
    switch (page) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'programs':
        return <ProgramsPage />;
      case 'hall':
        return <HallOfFamePage />;
      case 'athletes':
        return (
          <AthletesPage
            onOpenProfile={(id) => {
              setProfileAthleteId(id);
              setPage('profile');
            }}
          />
        );
      case 'profile':
        return (
          <AthleteProfilePage
            key={isOwnProfile ? 'self' : profileAthleteId || 'self'}
            athleteId={isOwnProfile ? user?.athleteId ?? null : profileAthleteId}
            onBack={() => handleNavigate(isOwnProfile ? 'dashboard' : 'athletes')}
          />
        );
      case 'training':
        return <TrainingPage />;
      case 'schedule':
        return <SchedulePage />;
      case 'applications':
        return <ApplicationsPage />;
      case 'activities':
        return <ActivitiesPage />;
      case 'agreements':
        return <AgreementsPage />;
      case 'disciplinary':
        return <DisciplinaryPage />;
      case 'legal':
        return <LegalPage />;
      case 'settings':
        return <SettingsPage />;
      case 'accounts':
        return <AccountsManagementPage />;
      case 'dashboard':
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout page={page} onNavigate={handleNavigate}>
      <div className="min-h-full">{renderPage()}</div>
    </Layout>
  );
};

const Root: React.FC = () => (
  <AuthProvider>
    <DataProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </DataProvider>
  </AuthProvider>
);

export default Root;