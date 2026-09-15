import React from 'react';
import { Check, CheckCircle2, Trash2, UserCheck, XCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { BadgeChip, CATEGORY_STYLE, LEVEL_STYLE, SPORT_STYLE } from '@/constants';
import { useData } from '@/context';
import { MembershipStatus, RegistrationApplication, RegistrationStatus } from '@/types';
import { formatDate, generateRegistrationNumber, getAgeCategory, calculateAge } from '@/utils/helpers';

const ApplicationsPage: React.FC = () => {
  const { applications, setApplicationStatus, deleteApplication, addAthlete, athletes } = useData();
  const [toDelete, setToDelete] = React.useState<RegistrationApplication | null>(null);

  const handleDecision = (app: RegistrationApplication, status: RegistrationStatus) => {
    if (status === 'approved') {
      const age = calculateAge(app.dob);
      addAthlete({
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
        joinedAt: new Date().toISOString().slice(0, 10),
      });
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
        <p className="text-gray-400 font-medium italic">مراجعة وقبول طلبات التسجيل الجديدة</p>
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
                  <div className="w-16 h-16 luxury-gradient-navy rounded-2xl flex items-center justify-center text-[#D4AF37] font-black text-xl shrink-0">
                    {app.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-xl font-black text-[#0B121E]">{app.name} {app.lastName}</h4>
                      <BadgeChip label={app.sport} className={SPORT_STYLE[app.sport].badge} />
                      <BadgeChip label={`${app.gender}`} className="bg-gray-100 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium mt-1.5 max-w-xl">{app.address} • {app.phone}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <BadgeChip label={CATEGORY_STYLE[getAgeCategory(age)].label} className={CATEGORY_STYLE[getAgeCategory(age)].badge} />
                      <BadgeChip label={app.level} className={LEVEL_STYLE[app.level].badge} />
                      {app.swimStyle && <BadgeChip label={app.swimStyle} className="bg-indigo-50 text-indigo-600" />}
                      {app.guardianName && <BadgeChip label={`ولي: ${app.guardianName}`} className="bg-purple-50 text-purple-700" />}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold mt-2">أُرسل في {formatDate(app.submittedAt)} • NIN: <span className="font-mono">{app.nin.slice(-4).padStart(18, '•')}</span></p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${st.badge}`}>{st.label}</span>
                  {app.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleDecision(app, 'approved')} className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-green-100 hover:-translate-y-0.5 transition-all active:scale-95">
                        <CheckCircle2 size={15} /> قبول
                      </button>
                      <button onClick={() => handleDecision(app, 'rejected')} className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs hover:text-red-500 transition-all active:scale-95">
                        <XCircle size={15} /> رفض
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      {app.status === 'approved' && (
                        <span className="text-[11px] font-bold text-green-600 flex items-center gap-1">
                          <Check size={14} /> تم إدراجه ضمن الرياضيين
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