import React, { useState } from 'react';
import { Lock, UserCircle2, Eye, EyeOff, LogIn, ClipboardList, UserPlus } from 'lucide-react';
import { useAuth, useAppContext, useData } from '@/context';
import logo from '@/assets/logo.png';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { setRoute } = useAppContext();
  const { registrationOpen } = useData();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(username, password)) {
      setRoute('app');
    } else {
      setError('معلومات الدخول غير صحيحة.');
    }
  };

  const inputCls =
    'w-full bg-gray-50 border border-gray-200 rounded-2xl pr-12 pl-10 py-4 outline-none focus:border-[#D4AF37] transition-all text-right font-bold';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4 relative overflow-hidden font-['Tajawal']">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-[#D4AF37] blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-[#1A3A5F] blur-[150px] rounded-full"></div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start relative z-10 w-full max-w-lg">
        <div className="w-full max-w-lg bg-white border border-[#D4AF37]/20 p-10 rounded-[40px] shadow-2xl border-t-8 border-t-[#D4AF37] animate-fade-up">
          <div className="flex justify-center mb-6">
            <img
              src={logo}
              alt="شعار نادي الصدارة"
              className="w-28 h-28 rounded-full object-cover border-4 border-[#D4AF37] shadow-xl gold-glow transform transition-transform hover:scale-105"
            />
          </div>
          <h1 className="text-3xl font-black text-[#1A3A5F] text-center mb-1">نادي الصدارة الرياضي</h1>
          <p className="text-center text-[#D4AF37] font-bold text-sm tracking-[0.2em] mb-4 uppercase">
            Club Sportif Sadara • Ghardaia
          </p>
          <div className="flex justify-center gap-2 mb-8">
            {['أخلاق', 'احترام', 'انضباط'].map((t) => (
              <span key={t} className="text-[10px] bg-gray-100 px-3 py-1 rounded-full text-gray-500 font-bold">
                {t}
              </span>
            ))}
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 px-2 uppercase tracking-wider">اسم المستخدم</label>
              <div className="relative">
                <UserCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 px-2 uppercase tracking-wider">كلمة المرور</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#D4AF37] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 p-3 rounded-2xl">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-[#D4AF37] text-white py-5 rounded-2xl font-bold shadow-xl hover:bg-[#B8860B] transform hover:-translate-y-0.5 transition-all active:scale-95 mt-2 gold-glow flex items-center justify-center gap-3"
            >
              <LogIn size={20} />
              تسجيل الدخول للمنصة
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center items-center gap-6 text-xs text-gray-400 font-medium">
            {registrationOpen && (
              <button
                onClick={() => setRoute('register')}
                className="hover:text-[#007377] transition-colors flex items-center gap-1.5 font-bold"
              >
                <ClipboardList size={14} />
                بوابة التسجيل
              </button>
            )}
            <span className="text-gray-200">|</span>
            <button
              onClick={() => setRoute('apply-coach')}
              className="hover:text-[#0B121E] transition-colors flex items-center gap-1.5 font-bold"
            >
              <UserPlus size={14} />
              طلب الانضمام كمدرب
            </button>
            <span className="text-gray-200">|</span>
            <span className="hover:text-[#D4AF37] transition-colors">سياسة الخصوصية</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;