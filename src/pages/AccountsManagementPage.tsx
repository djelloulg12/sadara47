import React, { useMemo, useState } from 'react';
import {
  Award,
  Ban,
  CheckCircle2,
  FileText,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth, useData } from '@/context';
import { ROLES_LABEL } from '@/constants';
import { CoachApplication, User, UserRole } from '@/types';
import { buildUsername, randomPassword } from '@/services/formService';

type Tab = 'accounts' | 'coachApps';

const ROLE_ORDER: UserRole[] = [UserRole.PRESIDENT, UserRole.MANAGER, UserRole.COACH, UserRole.ATHLETE, UserRole.GUARDIAN];

const ROLE_BADGE: Record<UserRole, string> = {
  [UserRole.PRESIDENT]: 'bg-[#0B121E] text-[#D4AF37]',
  [UserRole.MANAGER]: 'bg-[#007377] text-white',
  [UserRole.COACH]: 'bg-[#0E7490] text-white',
  [UserRole.ATHLETE]: 'bg-[#1E40AF] text-white',
  [UserRole.GUARDIAN]: 'bg-[#7C3AED] text-white',
};

const ACCENT = 'bg-[#0B121E] text-[#D4AF37]';

const AccountsManagementPage: React.FC = () => {
  const { user: me, users, updateUser, deleteUser, addUser } = useAuth();
  const { athletes, coachApplications, addCoachApplication, setCoachApplicationStatus, deleteCoachApplication, addNotification } = useData();

  const [tab, setTab] = useState<Tab>('accounts');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'الكل' | UserRole>('الكل');
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', password: '', phone: '' });
  const [approving, setApproving] = useState<CoachApplication | null>(null);
  const [approveCred, setApproveCred] = useState({ username: '', password: '' });
  const [lightbox, setLightbox] = useState<string | null>(null);

  const isManagerOnly = me?.role === UserRole.MANAGER;
  const canTouch = (u: User) => !(isManagerOnly && u.role === UserRole.PRESIDENT);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== 'الكل' && u.role !== filter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        ROLES_LABEL[u.role].includes(query.trim())
      );
    });
  }, [users, query, filter]);

  const coachAppOrders = useMemo(() => {
    const order: Record<CoachApplication['status'], number> = { pending: 0, approved: 1, rejected: 2 };
    return [...coachApplications].sort(
      (a, b) => order[a.status] - order[b.status] || b.submittedAt.localeCompare(a.submittedAt),
    );
  }, [coachApplications]);

  const openEdit = (u: User) => {
    setEditing(u);
    setEditForm({ name: u.name, username: u.username, password: u.password, phone: u.phone ?? '' });
  };

  const saveEdit = () => {
    if (!editing) return;
    updateUser(editing.id, {
      name: editForm.name.trim() || editing.name,
      username: editForm.username.trim() || editing.username,
      password: editForm.password || editing.password,
      phone: editForm.phone.trim(),
    });
    setEditing(null);
  };

  const toggleActive = (u: User) => {
    if (u.id === me?.id) return;
    updateUser(u.id, { active: u.active === false });
  };

  const openApprove = (app: CoachApplication) => {
    setApproving(app);
    setApproveCred({
      username: buildUsername(app.name, app.lastName),
      password: randomPassword(8),
    });
  };

  const approve = () => {
    if (!approving) return;
    const username = approveCred.username.trim() || buildUsername(approving.name, approving.lastName);
    const password = approveCred.password.trim() || randomPassword(8);
    addUser({
      name: `${approving.name} ${approving.lastName}`.trim(),
      username,
      password,
      role: UserRole.COACH,
      active: true,
      phone: approving.phone,
    });
    setCoachApplicationStatus(approving.id, 'approved', { username, password });
    const admins = users.filter((u) => u.role === UserRole.PRESIDENT || u.role === UserRole.MANAGER);
    if (admins.length > 0) {
      addNotification({
        type: 'registration',
        title: 'قبول طلب انضمام مدرب',
        body: `تم قبول المدرب ${approving.name} ${approving.lastName} (${approving.specialty}) وإنشاء حسابه (${username}).`,
        fromName: me?.name ?? 'المسير',
        toUserIds: admins.map((a) => a.id),
      });
    }
    setApproving(null);
  };

  const roleCount = (r: UserRole) => users.filter((u) => u.role === r).length;
  const athleteName = (id?: string) => athletes.find((a) => a.id === id)?.name ?? '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative bg-[#0B121E] rounded-3xl overflow-hidden p-8 text-white shadow-2xl">
        <div className="absolute -top-24 right-1/3 w-96 h-96 rounded-full bg-[#D4AF37]/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 rounded-full bg-[#007377]/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-black text-[#D4AF37] uppercase tracking-widest">
              <ShieldCheck size={14} />
              لوحة تسيير الحسابات
            </span>
            <h1 className="text-2xl md:text-3xl font-black mt-4">إدارة حسابات المنصة</h1>
            <p className="text-white/55 text-sm mt-2">تفعيل وتجميد الحسابات، تعديل الأدوار، ومراجعة طلبات انضمام المدربين.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setTab('accounts')}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${tab === 'accounts' ? 'bg-[#D4AF37] text-[#0B121E]' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >
              <Users size={17} />
              الحسابات ({users.length})
            </button>
            <button
              onClick={() => setTab('coachApps')}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all relative ${tab === 'coachApps' ? 'bg-[#007377] text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >
              <UserCog size={17} />
              طلبات المدربين
              {coachApplications.some((a) => a.status === 'pending') && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] pulse-red" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ====================== Accounts tab ====================== */}
      {tab === 'accounts' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex-1 min-w-[220px]">
              <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالاسم أو اسم المستخدم..."
                className="w-full bg-white border border-gray-200 rounded-2xl pr-12 pl-4 py-3 outline-none focus:border-[#007377] transition-all text-sm font-bold"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto custom-scrollbar">
              {(['الكل', ...ROLE_ORDER] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setFilter(r)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === r ? ACCENT : 'bg-white text-gray-500 border border-gray-200'}`}
                >
                  {r === 'الكل' ? 'الكل' : ROLES_LABEL[r]}
                  <span className="opacity-60 mr-1">({r === 'الكل' ? users.length : roleCount(r)})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold">لا توجد حسابات مطابقة.</div>
            ) : (
              filteredUsers.map((u) => {
                const self = u.id === me?.id;
                const frozen = u.active === false;
                const linked = athleteName(u.athleteId);
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-[#F8FAFB] transition-colors">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${self ? 'bg-[#0B121E] text-[#D4AF37] ring-2 ring-[#D4AF37]' : 'bg-[#F1F5F9] text-[#0B121E]'}`}>
                      {u.name.charAt(0)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[#0B121E] truncate">{u.name}</p>
                        {self && <span className="text-[9px] font-black text-[#007377] bg-[#007377]/10 rounded-full px-2 py-0.5">أنت</span>}
                        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${ROLE_BADGE[u.role]}`}>{ROLES_LABEL[u.role]}</span>
                        {frozen ? (
                          <span className="text-[9px] font-black text-red-600 bg-red-50 rounded-full px-2 py-0.5 flex items-center gap-1">
                            <Ban size={10} /> مجمّد
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 flex items-center gap-1">
                            <Power size={10} /> نشط
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 font-bold">
                        <span dir="ltr">{u.username}</span>
                        {u.phone && <span dir="ltr">{u.phone}</span>}
                        {linked && <span>سباح: {linked}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={u.role}
                        disabled={!canTouch(u)}
                        onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#007377] disabled:opacity-40"
                      >
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>{ROLES_LABEL[r]}</option>
                        ))}
                      </select>

                      {!self && canTouch(u) && (
                        <button
                          onClick={() => toggleActive(u)}
                          title={frozen ? 'إعادة التفعيل' : 'تجميد الحساب'}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${frozen ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600'}`}
                        >
                          <Power size={16} />
                        </button>
                      )}

                      {canTouch(u) && (
                        <button
                          onClick={() => openEdit(u)}
                          title="تعديل الاسم/كلمة المرور"
                          className="w-9 h-9 rounded-xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center hover:opacity-80 transition-all"
                        >
                          <Pencil size={15} />
                        </button>
                      )}

                      {!self && canTouch(u) && (
                        <button
                          onClick={() => deleteUser(u.id)}
                          title="حذف الحساب"
                          className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ====================== Coach applications tab ====================== */}
      {tab === 'coachApps' && (
        <>
          {coachAppOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <Award size={44} className="mx-auto mb-3 text-gray-300" />
              <p className="font-bold text-gray-400">لا توجد طلبات انضمام للمدربين حالياً.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {coachAppOrders.map((app) => (
                <div key={app.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center font-black text-lg">
                        {app.name.charAt(0)}
                      </span>
                      <div>
                        <p className="font-black text-[#0B121E]">{app.name} {app.lastName}</p>
                        <p className="text-xs text-gray-400 font-bold">{app.specialty}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black rounded-full px-3 py-1 ${
                        app.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : app.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {app.status === 'pending' ? 'قيد المراجعة' : app.status === 'approved' ? 'مقبول' : 'مرفوض'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-gray-600 font-bold"><PhoneIcon /> {app.phone} {app.email ? `• ${app.email}` : ''}</p>
                    <p className="flex items-center gap-2 text-gray-600"><FileText size={15} className="text-[#007377]" /> <b>الشهادة:</b> {app.diploma}{app.diplomaYear ? ` (${app.diplomaYear})` : ''}</p>
                    {app.experienceYears != null && <p className="text-gray-500 font-medium"><b> الخبرة:</b> {app.experienceYears} سنة</p>}
                    {app.certifications && <p className="text-gray-500 text-xs leading-relaxed"><b>شهادات أخرى:</b> {app.certifications}</p>}
                    {app.references && <p className="text-gray-500 text-xs"><b>المراجع:</b> {app.references}</p>}
                    {app.bio && <p className="text-gray-400 text-xs leading-relaxed">{app.bio}</p>}
                  </div>

                  {app.certificateFiles && app.certificateFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {app.certificateFiles.map((f, i) => (
                        <button key={i} onClick={() => setLightbox(f)} className="overflow-hidden rounded-lg border border-gray-200 hover:border-[#007377] transition-all">
                          <img src={f} alt={`شهادة ${i + 1}`} className="w-16 h-16 object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {app.status === 'approved' && app.username && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs">
                      <p className="text-emerald-700 font-black">بيانات الحساب المُنشأ</p>
                      <p className="text-emerald-800 font-bold mt-1" dir="ltr">@{app.username} — {app.password}</p>
                    </div>
                  )}

                  {app.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => openApprove(app)}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-[#007377] text-white font-bold py-2.5 rounded-xl hover:bg-[#0A8696] transition-all"
                      >
                        <CheckCircle2 size={16} /> قبول وإنشاء حساب
                      </button>
                      <button
                        onClick={() => setCoachApplicationStatus(app.id, 'rejected')}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-100 transition-all"
                      >
                        <X size={16} /> رفض
                      </button>
                      <button
                        onClick={() => deleteCoachApplication(app.id)}
                        className="w-11 h-11 flex items-center justify-center bg-gray-100 text-gray-500 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="تعديل الحساب" onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {(
              [
                ['الاسم', 'name'],
                ['اسم المستخدم', 'username'],
                ['كلمة المرور', 'password'],
                ['الهاتف', 'phone'],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs font-black text-[#0B121E] mb-1.5">{label}</label>
                <input
                  dir={key === 'username' || key === 'password' ? 'ltr' : 'rtl'}
                  className={inputCls}
                  value={editForm[key]}
                  onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <button onClick={saveEdit} className="w-full bg-[#0B121E] text-white font-black py-3 rounded-2xl hover:bg-[#1A3A5F] transition-colors">
              حفظ التعديلات
            </button>
          </div>
        </Modal>
      )}

      {/* Approve modal */}
      {approving && (
        <Modal title={`قبول المدرب: ${approving.name} ${approving.lastName}`} onClose={() => setApproving(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              سيتم إنشاء حساب مدرب جديد بالبيانات التالية. يمكنك تعديلها قبل تأكيد القبول.
            </p>
            <div>
              <label className="block text-xs font-black text-[#0B121E] mb-1.5">اسم المستخدم</label>
              <input dir="ltr" className={inputCls} value={approveCred.username} onChange={(e) => setApproveCred((p) => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-black text-[#0B121E] mb-1.5">كلمة المرور</label>
              <input dir="ltr" className={inputCls} value={approveCred.password} onChange={(e) => setApproveCred((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <button onClick={approve} className="w-full bg-[#007377] text-white font-black py-3 rounded-2xl hover:bg-[#0A8696] transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> تأكيد القبول وإنشاء الحساب
            </button>
          </div>
        </Modal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="شهادة" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-all">
        <X size={17} />
      </button>
      <h3 className="font-black text-[#0B121E] text-lg mb-5">{title}</h3>
      {children}
    </div>
  </div>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#007377] transition-all text-right font-bold text-sm';

export default AccountsManagementPage;