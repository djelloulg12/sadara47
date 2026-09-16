import React from 'react';
import {
  Activity,
  Building2,
  Calendar,
  Dumbbell,
  Gavel,
  Home,
  LayoutDashboard,
  LogOut,
  Map,
  ShieldCheck,
  Settings,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { UserRole } from '@/types';
import { ROLES_LABEL } from '@/constants';
import { useAuth } from '@/context';
import logo from '@/assets/logo.png';

export type PageId =
  | 'home'
  | 'dashboard'
  | 'athletes'
  | 'applications'
  | 'training'
  | 'activities'
  | 'disciplinary'
  | 'agreements'
  | 'legal'
  | 'settings'
  | 'profile'
  | 'programs'
  | 'hall';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  roles: UserRole[];
}

const MENU_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'النادي',
    items: [
      { id: 'home', label: 'الواجهة العامة', icon: Home, roles: Object.values(UserRole) },
      { id: 'programs', label: 'البرامج والمسارات', icon: Map, roles: Object.values(UserRole) },
      { id: 'hall', label: 'لوحة الشرف', icon: Trophy, roles: Object.values(UserRole) },
    ],
  },
  {
    title: 'الرئيسية',
    items: [
      { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: Object.values(UserRole) },
      { id: 'activities', label: 'نشاطات النادي', icon: Calendar, roles: Object.values(UserRole) },
    ],
  },
  {
    title: 'الرياضيون',
    items: [
      {
        id: 'athletes',
        label: 'قائمة الرياضيين',
        icon: Users,
        roles: [UserRole.PRESIDENT, UserRole.MANAGER, UserRole.COACH],
      },
      {
        id: 'applications',
        label: 'طلبات الإخراط',
        icon: UserCheck,
        roles: [UserRole.PRESIDENT, UserRole.MANAGER],
      },
      {
        id: 'agreements',
        label: 'الاتفاقيات',
        icon: Building2,
        roles: [UserRole.PRESIDENT, UserRole.MANAGER],
      },
    ],
  },
  {
    title: 'القطاع الرياضي',
    items: [
      {
        id: 'training',
        label: 'التدريب والبرمجة',
        icon: Activity,
        roles: [UserRole.PRESIDENT, UserRole.MANAGER, UserRole.COACH, UserRole.ATHLETE, UserRole.GUARDIAN],
      },
    ],
  },
  {
    title: 'الإدارة والامتثال',
    items: [
      {
        id: 'disciplinary',
        label: 'سجل الانضباط',
        icon: Gavel,
        roles: [UserRole.PRESIDENT, UserRole.MANAGER],
      },
      { id: 'legal', label: 'الخصوصية والأمان', icon: ShieldCheck, roles: Object.values(UserRole) },
      {
        id: 'settings',
        label: 'الإعدادات',
        icon: Settings,
        roles: [UserRole.PRESIDENT, UserRole.MANAGER],
      },
    ],
  },
];

const Layout: React.FC<{
  page: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}> = ({ page, onNavigate, children }) => {
  const { user, logout } = useAuth();

  const canOpenProfile = !!user && (user.role === UserRole.ATHLETE || user.role === UserRole.GUARDIAN);

  const handleProfile = () => {
    if (canOpenProfile) {
      onNavigate('profile');
    }
  };

  const bottomItems: { id: PageId; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'programs', label: 'البرامج', icon: Map },
    { id: 'hall', label: 'الشرف', icon: Trophy },
    canOpenProfile
      ? { id: 'profile' as PageId, label: 'مساري', icon: UserCheck }
      : { id: 'training' as PageId, label: 'التمارين', icon: Dumbbell },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBFA] text-[#1F2937] rtl relative">
      <nav className="app-sidebar no-print w-full md:w-80 bg-[#0B121E] flex flex-col p-8 shadow-2xl z-50 border-l border-white/5 md:h-screen md:fixed md:top-0 md:right-0">
        <div className="flex flex-col items-center gap-4 mb-10 text-center">
          <button onClick={() => onNavigate('dashboard')} title="العودة إلى اللوحة الرئيسية" className="rounded-full overflow-hidden border-2 border-[#D4AF37] shadow-lg gold-glow transform transition-transform hover:scale-105 hover:rotate-3">
            <img src={logo} alt="شعار نادي الصدارة" className="w-20 h-20 object-cover" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white leading-tight">نادي الصدارة</h1>
            <p className="text-[#D4AF37] text-[10px] font-black uppercase tracking-[0.2em] mt-1 opacity-80">
              Ghardaia • sadara47
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center mb-8">
          <button
            onClick={handleProfile}
            className="w-14 h-14 rounded-2xl luxury-gradient-gold flex items-center justify-center text-[#0B121E] font-black text-lg shrink-0"
          >
            {(user?.name || '؟').charAt(0)}
          </button>
          <div className="text-right">
            <p className="text-white font-black text-sm">{user?.name}</p>
            <p className="text-[#D4AF37] text-[11px] font-bold">{user ? ROLES_LABEL[user.role] : ''}</p>
          </div>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar scroll-smooth pr-1">
          {MENU_GROUPS.map((group, groupIndex) => {
            const visibleItems = group.items.filter((item) => user && item.roles.includes(user.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={groupIndex} className="space-y-3">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">
                  {group.title}
                </h3>
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden ${
                      page === item.id
                        ? 'luxury-gradient-gold text-[#0B121E] font-black shadow-[0_10px_30px_-5px_rgba(212,175,55,0.4)] scale-105 border-r-4 border-[#0B121E]'
                        : 'hover:bg-white/5 text-white/60 hover:text-white hover:translate-x-[-4px]'
                    }`}
                  >
                    <item.icon
                      size={20}
                      className={`relative z-10 transition-transform duration-300 ${
                        page === item.id ? 'text-[#0B121E] scale-110' : 'group-hover:text-[#D4AF37] group-hover:scale-110'
                      }`}
                    />
                    <span className="text-sm tracking-wide relative z-10">{item.label}</span>
                    {page === item.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full shimmer"></div>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="pt-8 border-t border-white/10 mt-6">
          <button
            onClick={logout}
            className="w-full flex items-center gap-4 px-5 py-4 text-red-400/70 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all font-bold"
          >
            <LogOut size={20} />
            <span className="text-sm">خروج آمن</span>
          </button>
        </div>
      </nav>

      <main className="app-main md:mr-80 p-6 pb-24 md:p-12 relative bg-[#FDFBFA] scroll-smooth min-h-screen">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>

      <nav className="app-mobile-nav no-print md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#071318]/95 backdrop-blur-md border-t border-[#1B3E48] grid grid-cols-4 items-center px-2 pb-[env(safe-area-inset-bottom)]">
        {bottomItems.map((b) => (
          <button
            key={b.id}
            onClick={() => onNavigate(b.id)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
              page === b.id ? 'text-[#0A8696]' : 'text-white/50 hover:text-white/90'
            }`}
          >
            <b.icon size={19} className={page === b.id ? 'drop-shadow-[0_0_6px_rgba(10,134,150,0.9)]' : ''} />
            <span className="text-[9px] font-black">{b.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;