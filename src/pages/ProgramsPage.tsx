import React, { useMemo, useState } from 'react';
import { Activity, Calendar, CheckCircle2, Clock, MapPin, Waves } from 'lucide-react';
import { useAuth, useData } from '@/context';
import { UserRole } from '@/types';

const BANDS = [
  { key: 'الكل', label: 'الكل' },
  { key: 'براعم', label: 'براعم (10-11)' },
  { key: 'أصاغر', label: 'أصاغر (12-13)' },
  { key: 'أشبال', label: 'أشبال (14-15)' },
  { key: 'أواسط', label: 'أواسط (16-17)' },
  { key: 'أكابر', label: 'أكابر (18+)' },
  { key: 'نخبة', label: 'نخبة' },
  { key: 'لياقة', label: 'لياقة وترفيه' },
];

const detectBand = (text: string): string => {
  for (const b of BANDS) {
    if (b.key !== 'الكل' && text.includes(b.key)) return b.key;
  }
  return 'أكابر';
};

const ProgramsPage: React.FC = () => {
  const { users } = useAuth();
  const { plans, attendance } = useData();
  const [band, setBand] = useState('الكل');

  const coaches = useMemo(() => users.filter((u) => u.role === UserRole.COACH), [users]);

  const filtered = useMemo(() => {
    const ordered = [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return band === 'الكل' ? ordered : ordered.filter((p) => detectBand(`${p.title} ${p.description}`) === band);
  }, [plans, band]);

  const countFor = (planId: string) => attendance.filter((a) => a.planId === planId).length;

  const laneOf = (index: number) => (index % 8) + 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#0B121E]">البرامج والمسارات</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">جدول سباحة أسبوعي حسب الفئة العمرية والمستوى.</p>
        </div>
        <span className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-bold text-[#007377] shadow-sm">
          <Waves size={15} />
          {plans.length} برنامج متاح
        </span>
      </div>

      {/* Lane tabs */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
        {BANDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBand(b.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              band === b.key
                ? 'bg-[#007377] text-white shadow-[0_8px_20px_-6px_rgba(0,115,119,0.5)]'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#007377]/40 hover:text-[#007377]'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Schedule grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400 font-bold">
          لا توجد برامج في هذه الفئة.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p, i) => {
            const coach = coaches.length > 0 ? coaches[i % coaches.length].name : 'طاقم التدريب';
            const done = countFor(p.id);
            const isLive = i === 0;
            return (
              <article
                key={p.id}
                className="group relative bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#007377]/30 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-[#007377] via-[#0A8696] to-[#D4AF37]" />
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center font-black text-lg shadow-md">
                      {laneOf(i)}
                    </span>
                    <div>
                      <p className="text-[10px] font-black text-[#007377] uppercase tracking-widest">مسار السباحة</p>
                      <p className="text-xs font-bold text-gray-400">{p.sport}</p>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1 ${
                      isLive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'pulse-red' : ''}`} />
                    {isLive ? 'انطلقت الحصص الآن' : 'مفتوح للتسجيل'}
                  </span>
                </div>

                <h3 className="font-black text-[#0B121E] text-lg leading-snug">{p.title}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-3">{p.description}</p>

                <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={15} className="text-[#007377]" />
                    <span className="font-bold">{p.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={15} className="text-[#007377]" />
                    <span className="font-bold">{p.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Activity size={15} className="text-[#0A8696]" />
                    <span className="font-bold">إشراف: {coach}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007377]">
                    <CheckCircle2 size={14} />
                    {done} حصة مسجلة
                  </span>
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                    المدرب {laneOf(i)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="relative bg-[#0B121E] rounded-2xl overflow-hidden p-8 text-center shadow-2xl">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[#007377]/25 blur-3xl" />
        <div className="relative">
          <h3 className="text-2xl font-black text-white">هل أنت جاهز للانضمام إلى بركة الأبطال؟</h3>
          <p className="text-white/60 mt-2 text-sm">سجّل انخراطك وسيتواصل معك طاقم النادي لاختيار المسار المناسب.</p>
          <span className="inline-flex items-center gap-2 mt-5 bg-[#D4AF37] text-[#0B121E] font-black px-8 py-3 rounded-2xl shadow-[0_0_30px_rgba(212,175,55,0.4)]">
            <Calendar size={17} />
            التسجيلات مفتوحة — موسم {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProgramsPage;