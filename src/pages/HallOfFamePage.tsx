import React, { useMemo, useState } from 'react';
import { Award, Crown, Medal, Target, Timer } from 'lucide-react';
import { useData } from '@/context';

const RANK_STYLES = [
  'bg-gradient-to-l from-[#D4AF37] to-[#F3D076] text-[#0B121E] shadow-[0_10px_30px_-8px_rgba(212,175,55,0.7)]',
  'bg-gradient-to-l from-slate-300 to-slate-100 text-slate-800',
  'bg-gradient-to-l from-amber-700 to-amber-500 text-white',
];

const HallOfFamePage: React.FC = () => {
  const { records, athletes } = useData();

  const disciplines = useMemo(() => {
    const set = new Set(records.map((r) => r.discipline));
    return ['الكل', ...Array.from(set)];
  }, [records]);

  const [discipline, setDiscipline] = useState('الكل');

  const athleteById = useMemo(() => {
    const map: Record<string, (typeof athletes)[number]> = {};
    athletes.forEach((a) => {
      map[a.id] = a;
    });
    return map;
  }, [athletes]);

  const ranked = useMemo(() => {
    const pool = discipline === 'الكل' ? records : records.filter((r) => r.discipline === discipline);
    return [...pool]
      .sort((a, b) => (a.numeric ?? Number.MAX_SAFE_INTEGER) - (b.numeric ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 12);
  }, [records, discipline]);

  return (
    <div className="space-y-8">
      <div className="relative bg-[#0B121E] rounded-3xl overflow-hidden p-8 md:p-10 text-center shadow-2xl">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#D4AF37]/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-black text-[#D4AF37] uppercase tracking-widest">
            <Crown size={14} />
            صالة مشاهير النادي
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-white mt-5">لوحة الشرف</h1>
          <p className="text-white/55 mt-3 text-sm max-w-xl mx-auto leading-relaxed">
            أسرع الأزمنة المسجلة في كل تخصص. الترتيب بالأرقام الرسمية للمنافسات المحلية والوطنية.
          </p>
        </div>
      </div>

      {/* Category selector */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 -mx-1 px-1">
        {disciplines.map((d) => (
          <button
            key={d}
            onClick={() => setDiscipline(d)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              discipline === d
                ? 'bg-[#0B121E] text-[#D4AF37] shadow-[0_8px_20px_-6px_rgba(11,18,30,0.6)]'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#D4AF37]/50 hover:text-[#0B121E]'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400 font-bold">
          لا توجد أرقام مسجلة في هذا التخصص بعد.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[64px_1fr_1fr_120px] gap-4 px-6 py-4 bg-[#F8FAFB] border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span className="text-center">الترتيب</span>
            <span>السباح</span>
            <span>التخصص</span>
            <span className="text-center">أفضل زمن</span>
          </div>

          {ranked.map((r, i) => {
            const a = athleteById[r.athleteId];
            const year = new Date(r.date).getFullYear();
            return (
              <div
                key={r.id}
                className={`grid grid-cols-[64px_1fr] sm:grid-cols-[64px_1fr_1fr_120px] gap-4 px-6 py-4 items-center border-b border-gray-50 last:border-0 transition-colors hover:bg-[#F8FAFB] ${
                  i === 0 ? 'bg-[#FFFBEB]' : ''
                }`}
              >
                <div className="flex justify-center">
                  {i < 3 ? (
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${RANK_STYLES[i]}`}>
                      {i === 0 ? <Crown size={18} /> : <Medal size={18} />}
                    </span>
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-black text-sm">
                      {i + 1}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg overflow-hidden ${i === 0 ? 'bg-[#0B121E] text-[#D4AF37]' : 'bg-[#F1F5F9] text-[#0B121E]'}`}>
                    {a?.photoUrl ? <img src={a.photoUrl} alt="" className="w-full h-full object-cover" /> : (a?.name || '؟').charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-[#0B121E] truncate">{a?.name ?? 'رياضي النادي'}</p>
                    <p className="text-[11px] text-gray-400 font-bold mt-0.5">{a?.category ?? '—'} • سجل {year}</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 font-bold min-w-0">
                  <Target size={15} className="text-[#007377] shrink-0" />
                  <span className="truncate">{r.discipline}</span>
                </div>

                <div className="flex sm:justify-center items-center gap-1.5">
                  <Timer size={15} className="text-[#D4AF37] sm:hidden" />
                  <span className="font-black tabular-nums text-[#0B121E]">{r.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Award, label: 'أرقام رسمية موثقة', value: records.length },
          { icon: Medal, label: 'فئات تنافسية', value: disciplines.length - 1 },
          { icon: Crown, label: 'سباحون على المنصة', value: ranked.filter((r) => typeof r.numeric === 'number').length },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
            <span className="w-12 h-12 rounded-2xl bg-[#0B121E] text-[#D4AF37] flex items-center justify-center">
              <s.icon size={20} />
            </span>
            <div>
              <p className="text-2xl font-black text-[#0B121E] tabular-nums">{s.value}</p>
              <p className="text-xs font-bold text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HallOfFamePage;