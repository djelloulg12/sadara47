import React from 'react';
import {
  Check,
  CheckCircle2,
  FileScan,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { BadgeChip, CATEGORY_STYLE, LEVEL_STYLE, SPORT_STYLE } from '@/constants';
import { useAuth, useData } from '@/context';
import { MembershipStatus, RegistrationApplication, RegistrationStatus, UserRole } from '@/types';
import { formatDate, generateRegistrationNumber, getAgeCategory, calculateAge, toStyles } from '@/utils/helpers';
import { buildUsername, randomPassword } from '@/services/formService';

const ApplicationsPage: React.FC = () => {
  const { applications, setApplicationStatus, deleteApplication, addAthlete, athletes } = useData();
  const { users, addUser } = useAuth();
  const [toDelete, setToDelete] = React.useState<RegistrationApplication | null>(null);
  const [audit, setAudit] = React.useState<RegistrationApplication | null>(null);

  const handleDecision = (app: RegistrationApplication, status: RegistrationStatus) => {
    if (status === 'approved') {
      const athlete = addAthlete({
        registrationNumber: generateRegistrationNumber(athletes.length),
        nin: app.nin,
        name: app.name,
        lastName: app.lastName,
        dob: app.dob,
        gender: app.gender,
        level: app.level,
        sport: app.sport,
        swimStyle: app.swimStyle,
        progress: 50,
        assignedCoach: '',
        membershipStatus: MembershipStatus.ACTIVE,
        medicalClearance: app.medicalClearance,
        address: app.address,
        phone: app.phone,
        bloodType: app.bloodType,
        guardianName: app.guardianName,
        photoUrl: app.photoUrl,
        location: app.pool,
        transport: app.transport,
        joinedAt: new Date().toISOString().slice(0, 10),
      });
      const username = app.username || buildUsername(app.firstNameLatin || app.name, app.lastNameLatin || app.lastName);
      const password = app.password || randomPassword(8);
      const alreadyExists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!alreadyExists) {
        addUser({
          name: `${app.firstNameLatin || app.name} ${app.lastNameLatin || app.lastName}`.trim(),
          username,
          password,
          role: UserRole.ATHLETE,
          athleteId: athlete.id,
        });
      }
    }
    setApplicationStatus(app.id, status);
  };

  const statusBadge: Record<RegistrationStatus, { badge: string; label: string }> = {
    pending: { badge: 'bg-amber-100 text-amber-700', label: 'قيد المراجعة' },
    approved: { badge: 'bg-green-100 text-green-700', label: 'مقبول' },
    rejected: { badge: 'bg-red-100 text-red-700', label: 'مرفوض' },
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-4xl font-black text-[#0B121E]">
          طلبات <span className="text-[#D4AF37]">الإخراط</span>
        </h2>
        <p className="text-gray-400 font-medium italic">مراجعة الملفات، المصادقة على المستندات، وقبول طلبات التسجيل</p>
      </div>

      <div className="space-y-6">
        {applications.map((app) => {
          const st = statusBadge[app.status];
          const age = calculateAge(app.dob);
          return (
            <div key={app.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-2 h-full ${app.status === 'pending' ? 'bg-amber-400' : app.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-5">
                  {app.photoUrl ? (
                    <img src={app.photoUrl} alt="صورة المترشح" className="w-16 h-20 rounded-2xl object-cover border-2 border-[#D4AF37] shadow shrink-0" />
                  ) : (
                    <div className="w-16 h-16 luxury-gradient-navy rounded-2xl flex items-center justify-center text-[#D4AF37] font-black text-xl shrink-0">
                      {app.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-xl font-black text-[#0B121E]">{app.name} {app.lastName}</h4>
                      <BadgeChip label={app.sport} className={SPORT_STYLE[app.sport].badge} />
                      <BadgeChip label={app.category} className={app.category === 'أصاغر' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'} />
                    </div>
                    <p className="text-sm text-gray-500 font-medium mt-1.5 max-w-xl">{app.address} • {app.phone}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <BadgeChip label={CATEGORY_STYLE[getAgeCategory(age)].label} className={CATEGORY_STYLE[getAgeCategory(age)].badge} />
                      <BadgeChip label={app.level} className={LEVEL_STYLE[app.level].badge} />
                      {toStyles(app.swimStyle).map((s) => <BadgeChip key={s} label={s} className="bg-indigo-50 text-indigo-600" />)}
                      {app.transport && <BadgeChip label="نقل" className="bg-blue-50 text-blue-700" />}
                      {app.subscriptionType === 'ضمن اتفاقية معتمدة' ? (
                        <BadgeChip label={`${app.subscriptionType}`} className="bg-blue-50 text-blue-700" />
                      ) : (
                        <BadgeChip label={app.subscriptionType} className="bg-blue-50 text-blue-700" />
                      )}
                      {app.guardianName && <BadgeChip label={`ولي: ${app.guardianName}`} className="bg-purple-50 text-purple-700" />}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mt-2">أُرسل في {formatDate(app.submittedAt)} • NIN: <span className="font-mono">{app.nin.slice(-4).padStart(18, '•')}</span></p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${st.badge}`}>{st.label}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAudit(app)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs transition-all ${
                        app.scanUrl && app.filledFormUrl ? 'bg-[#007377] text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-[#007377]'
                      }`}
                      title="تدقيق المستندات"
                    >
                      <FileScan size={15} /> تدقيق الملف
                    </button>
                    {app.status === 'pending' ? (
                      <>
                        <button onClick={() => handleDecision(app, 'approved')} className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-green-100 hover:-translate-y-0.5 transition-all active:scale-95">
                          <CheckCircle2 size={15} /> قبول
                        </button>
                        <button onClick={() => handleDecision(app, 'rejected')} className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs hover:text-red-500 transition-all active:scale-95">
                          <XCircle size={15} /> رفض
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2 items-center">
                        {app.status === 'approved' && (
                          <span className="text-[11px] font-bold text-green-600 flex items-center gap-1">
                            <Check size={14} /> في قائمة الرياضيين
                          </span>
                        )}
                        <button onClick={() => setToDelete(app)} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 transition-all">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {applications.length === 0 && (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
            <EmptyState title="لا توجد طلبات" hint="جميع طلبات الإخراط تمت معالجتها." />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 p-5 bg-blue-50 border border-blue-100 rounded-3xl text-blue-800 text-xs font-bold">
        <UserCheck size={18} className="shrink-0" />
        عند قبول الطلب يتم إنشاء ملف رياضي تلقائياً برقم تسجيل {generateRegistrationNumber(athletes.length)} وإضافته إلى قائمة الرياضيين.
      </div>

      {/* Audit modal */}
      {audit && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#0B121E]/80 backdrop-blur-md p-4 overflow-y-auto no-print animate-in fade-in">
          <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl my-8 relative border border-[#D4AF37]/20">
            <button onClick={() => setAudit(null)} className="absolute top-5 left-5 p-2 text-gray-400 hover:text-red-500 transition-colors z-10">
              <X size={24} />
            </button>
            <div className="p-8 border-b border-gray-100">
              <h3 className="text-2xl font-black text-[#0B121E] flex items-center gap-3">
                <FileScan className="text-[#007377]" size={24} /> تدقيق المستندات — {audit.name} {audit.lastName}
              </h3>
              <p className="text-xs text-gray-400 font-bold mt-1">مطابقة الصورة والاستمارة المولدة مع المسح المرفوع قبل الاعتماد</p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">الصورة الشخصية</p>
                {audit.photoUrl ? (
                  <img src={audit.photoUrl} alt="الصورة" className="w-full rounded-3xl border border-gray-200 shadow-sm" />
                ) : (
                  <div className="p-10 bg-gray-50 rounded-3xl text-center text-[11px] font-bold text-gray-400 border border-dashed">لا توجد صورة</div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">الاستمارة المولدة آلياً</p>
                {audit.filledFormUrl ? (
                  <img src={audit.filledFormUrl} alt="الاستمارة المولدة" className="w-full rounded-3xl border border-gray-200 shadow-sm" />
                ) : (
                  <div className="p-10 bg-gray-50 rounded-3xl text-center text-[11px] font-bold text-gray-400 border border-dashed">لم تُولّد</div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">المسح المرفوع (المصادقة)</p>
                {audit.scanUrl ? (
                  <img src={audit.scanUrl} alt="المسح" className="w-full rounded-3xl border border-green-300 shadow-sm animate-in fade-in" />
                ) : (
                  <div className="p-10 bg-gray-50 rounded-3xl text-center text-[11px] font-bold text-gray-400 border border-dashed">لم يُرفع المسح</div>
                )}
              </div>
            </div>
            <div className="p-8 pt-0 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
              <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-gray-400 text-[10px] mb-1">الاسم</p><p className="text-[#0B121E]">{audit.name} {audit.lastName}</p></div>
              <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-gray-400 text-[10px] mb-1">NIN</p><p className="text-[#0B121E] font-mono">{audit.nin.slice(0, 6)}••••••••{audit.nin.slice(-4)}</p></div>
              <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-gray-400 text-[10px] mb-1">الملف</p><p className="text-[#0B121E]">{audit.photoUrl ? '✓ مرفق' : '—'} / {audit.scanUrl ? '✓ ممسوح' : '—'}</p></div>
              <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-gray-400 text-[10px] mb-1">المنشأة</p><p className="text-[#0B121E]">{audit.pool || '—'}</p></div>
            </div>
            <div className="px-8 pb-8">
              <div className="rounded-2xl border border-[#007377]/20 bg-[#007377]/5 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                <div>
                  <p className="text-gray-400 text-[10px] mb-1 flex items-center gap-2"><UserCheck size={12} /> معلومات الحساب (الوجه الثاني من الاستمارة)</p>
                  <p className="text-[#0B121E] font-mono" dir="ltr">user: {audit.username || buildUsername(audit.firstNameLatin || audit.name, audit.lastNameLatin || audit.lastName)}</p>
                  <p className="text-[#0B121E] font-mono text-[11px] mt-1" dir="ltr">pass: {audit.password || '— (يُنشأ عند القبول)'}</p>
                </div>
                <p className="text-[11px] text-[#007377] leading-relaxed self-center">
                  عند قبول الطلب يُنشأ حساب دخول للرياضي بهذا الإسم المستخدم وكلمة المرور تلقائياً.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        message={<>حذف طلب <b className="text-[#0B121E]">{toDelete?.name} {toDelete?.lastName}</b> نهائياً؟</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteApplication(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default ApplicationsPage;