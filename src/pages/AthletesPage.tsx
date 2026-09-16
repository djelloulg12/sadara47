import React, { useMemo, useState } from 'react';
import { Bus, Eye, Lock, MapPin, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import Avatar from '@/components/Avatar';
import AthleteForm, { AthleteFormValues } from '@/components/AthleteForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useAuth, useData } from '@/context';
import { BadgeChip, CATEGORY_STYLE, LEVEL_STYLE, STATUS_STYLE } from '@/constants';
import { Athlete, MembershipStatus, Sport, UserRole } from '@/types';
import { maskNin } from '@/utils/helpers';

const AthletesPage: React.FC<{ onOpenProfile: (athleteId: string) => void }> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const { athletes, addAthlete, updateAthlete, deleteAthlete } = useData();
  const isCoach = user?.role === UserRole.COACH;
  const isAdmin = user?.role === UserRole.PRESIDENT || user?.role === UserRole.MANAGER;
  const isStaff = isCoach || isAdmin;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCoach, setFilterCoach] = useState('All');
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterTransport, setFilterTransport] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [toDelete, setToDelete] = useState<Athlete | null>(null);

  const coaches = useMemo(
    () => Array.from(new Set(athletes.filter((a) => a.assignedCoach).map((a) => a.assignedCoach))),
    [athletes],
  );
  const locations = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.location || '').filter(Boolean))),
    [athletes],
  );

  const filtered = useMemo(
    () =>
      athletes.filter((a) => {
        if (isCoach && user?.name && a.assignedCoach && a.assignedCoach !== user.name) return false;
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          `${a.name} ${a.lastName}`.toLowerCase().includes(q) ||
          a.nin.includes(searchQuery.trim());
        const matchesCoach = filterCoach === 'All' || a.assignedCoach === filterCoach;
        const matchesLocation = filterLocation === 'All' || a.location === filterLocation;
        const matchesTransport =
          filterTransport === 'All' ||
          (filterTransport === 'Yes' && a.transport) ||
          (filterTransport === 'No' && !a.transport);
        return matchesSearch && matchesCoach && matchesLocation && matchesTransport;
      }),
    [athletes, searchQuery, filterCoach, filterLocation, filterTransport, isCoach, user],
  );

  const handleSubmit = (values: AthleteFormValues) => {
    if (editing) {
      updateAthlete(editing.id, { ...values, progress: values.progress });
    } else {
      addAthlete({
        ...values,
        registrationNumber: `SD-${new Date().getFullYear()}-${String(athletes.length + 1).padStart(4, '0')}`,
        joinedAt: new Date().toISOString().slice(0, 10),
      });
    }
    setFormOpen(false);
    setEditing(null);
  };

  const toggleStatus = (a: Athlete) => {
    updateAthlete(a.id, {
      membershipStatus: a.membershipStatus === MembershipStatus.ACTIVE ? MembershipStatus.FROZEN : MembershipStatus.ACTIVE,
    });
  };

  const selectCls = 'bg-white border border-gray-200 rounded-2xl px-4 py-3 outline-none text-sm font-bold appearance-none min-w-[150px]';

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-[#0B121E]">
            إدارة <span className="text-[#D4AF37]">الرياضيين</span>
          </h2>
          <p className="text-gray-400 font-medium italic">تنظيم العضوية، التصنيف، والعمليات اللوجستية</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!isAdmin}
          className="luxury-gradient-gold text-[#0B121E] px-8 py-4 rounded-2xl font-black shadow-lg gold-glow flex items-center gap-3 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={20} /> إضافة رياضي
        </button>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-gray-50 overflow-hidden luxury-shadow border-t-[10px] border-t-[#0B121E]">
        <div className="p-8 border-b border-gray-50 bg-[#FDFBFA] flex flex-col lg:flex-row gap-4 justify-between items-end">
          <div className="flex flex-wrap gap-4 w-full lg:w-auto items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">المدرب</label>
              <select value={filterCoach} onChange={(e) => setFilterCoach(e.target.value)} className={selectCls}>
                <option value="All">جميع المدربين</option>
                {coaches.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">موقع التدريب</label>
              <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className={selectCls}>
                <option value="All">كل المواقع</option>
                {locations.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">النقل</label>
              <select value={filterTransport} onChange={(e) => setFilterTransport(e.target.value)} className={selectCls}>
                <option value="All">الكل</option>
                <option value="Yes">نقل النادي</option>
                <option value="No">بدون نقل</option>
              </select>
            </div>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input
              type="text"
              placeholder="بحث (NIN / الاسم)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pr-14 pl-6 py-3 outline-none text-sm font-bold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-[#FDFBFA] text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6">الرياضي</th>
                <th className="px-8 py-6">التصنيف</th>
                <th className="px-8 py-6">اللوجستيك</th>
                <th className="px-8 py-6">الحالة</th>
                <th className="px-8 py-6">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((a) => {
                const st = STATUS_STYLE[a.membershipStatus];
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-all duration-300 group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <Avatar name={`${a.name} ${a.lastName}`} photoUrl={a.photoUrl} sport={a.sport} />
                        <div className="flex flex-col">
                          <button
                            onClick={() => onOpenProfile(a.id)}
                            className="font-black text-[#0B121E] hover:text-[#007377] text-right"
                          >
                            {a.name} {a.lastName}
                          </button>
                          <span className="text-[10px] text-gray-400 font-bold">{maskNin(a.nin)} • {a.registrationNumber}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                        <BadgeChip label={a.sport} className={a.sport === Sport.SWIMMING ? 'bg-cyan-100 text-cyan-800' : a.sport === Sport.CROSS_COUNTRY ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} />
                        <BadgeChip label={CATEGORY_STYLE[a.category].label} className={CATEGORY_STYLE[a.category].badge} />
                        <BadgeChip label={LEVEL_STYLE[a.level].label} className={LEVEL_STYLE[a.level].badge} />
                        {a.swimStyle && <BadgeChip label={a.swimStyle} className="bg-indigo-50 text-indigo-600" />}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-gray-500">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={12} /> {a.location || '—'}
                      </div>
                      {a.transport && (
                        <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md w-fit flex items-center gap-1">
                          <Bus size={10} /> نقل النادي
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <button
                        onClick={() => toggleStatus(a)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 ${st.badge}`}
                      >
                        {a.membershipStatus}
                      </button>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex gap-2">
                        <button onClick={() => onOpenProfile(a.id)} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-[#007377] hover:bg-white transition-all" title="ملف الرياضي">
                          <Eye size={16} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setEditing(a);
                                setFormOpen(true);
                              }}
                              className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-[#D4AF37] hover:bg-white transition-all"
                              title="تعديل"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setToDelete(a)}
                              className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-red-500 hover:bg-white transition-all"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {isStaff && (
                          <span className="p-2.5 text-gray-200" title="قراءة فقط">
                            <Lock size={16} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-8">
              <EmptyState title="لا توجد نتائج مطابقة" hint="جرّب تعديل البحث أو الفلاتر." />
            </div>
          )}
        </div>
      </div>

      <AthleteForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} initial={editing} />
      <ConfirmDialog
        open={!!toDelete}
        message={
          <>
            أنت على وشك حذف العضو <b className="text-[#0B121E]">{toDelete?.name} {toDelete?.lastName}</b> بشكل نهائي مع أرقامه المسجلة.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteAthlete(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
};

export default AthletesPage;