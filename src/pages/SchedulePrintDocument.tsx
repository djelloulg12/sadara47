import React, { useEffect, useState } from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { getSchedulePrintData, SchedulePrintData } from '@/data';
import { useAppContext } from '@/context';
import logo from '@/assets/logo.png';

// نمط اللون المتماسك في الواجهة داخل وثيقة الطباعة (رأس A4 رسمي بتقنين الحبر)
const HEAD_STYLE = 'bg-[#0B121E] text-white';
const TH = 'border border-slate-400 p-2 text-center text-[12px] font-black bg-gray-100';
const TD = 'border border-slate-400 p-2 text-center text-[12px]';

const SchedulePrintDocument: React.FC = () => {
  const { setRoute } = useAppContext();
  const [data, setData] = useState<SchedulePrintData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setData(getSchedulePrintData());
    setDateStr(
      new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' }),
    );
  }, []);

  useEffect(() => {
    if (!data) return;
    const payload = JSON.stringify({
      title: data.title,
      season: data.season,
      issuedAt: data.issuedAt,
      sessions: data.sessions.map((s) => ({ d: s.day, t: `${s.start}-${s.end}`, p: s.pool, g: s.groupIds.length })),
      groups: data.groups.map((g) => g.name),
    });
    QRCode.toDataURL(payload, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null));
  }, [data]);

  useEffect(() => {
    if (!qr) return;
    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [qr]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6 no-print">
        <div className="bg-white rounded-3xl p-10 text-center shadow-xl max-w-sm">
          <p className="font-black text-gray-700">لا توجد بيانات برنامج أسبوعي للطباعة.</p>
          <button onClick={() => setRoute('app')} className="mt-6 inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold">
            <ArrowRight size={17} /> العودة للمنصة
          </button>
        </div>
      </div>
    );
  }

  const groupById = (id: string) => data.groups.find((g) => g.id === id);
  const coachName = (id?: string) => (id ? data.coachNames?.[id] ?? '' : '');
  const sorted = [...data.sessions].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="min-h-screen bg-slate-200/70 py-8 px-4">
      {/* شريط التحكم */}
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between no-print">
        <button
          onClick={() => setRoute('app')}
          className="inline-flex items-center gap-2 bg-white text-gray-700 font-bold px-4 py-2.5 rounded-xl shadow hover:bg-gray-50 text-sm"
        >
          <ArrowRight size={16} /> رجوع
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-[#0B121E] text-white font-black px-5 py-2.5 rounded-xl shadow hover:bg-[#1A3A5F] text-sm"
        >
          <Printer size={16} /> طباعة / حفظ PDF
        </button>
      </div>

      {/* وثيقة A4 */}
      <div className="print-document max-w-[820px] mx-auto bg-white border border-slate-300 rounded-xl p-10 shadow-2xl">
        {/* الترويسة */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار النادي" className="w-16 h-16 rounded-full object-cover border-2 border-slate-300" />
            <div>
              <h1 className="text-xl font-black text-slate-900">نادي الصدارة الرياضي</h1>
              <p className="text-xs font-bold text-slate-500">Club Sportif Sadara • Ghardaïa</p>
              <p className="text-[11px] text-slate-400 font-semibold">منصة التسيير الرقمية — قانون 18/07</p>
            </div>
          </div>

          <div className="text-center flex-1 px-4">
            <p className="text-[13px] font-black text-slate-800">{data.title}</p>
            <p className="text-[11px] font-bold text-slate-500">{data.season}</p>
          </div>

          <div className="text-center">
            {qr ? (
              <img src={qr} alt="رمز التحقق الرقمي" className="w-[92px] h-[92px]" />
            ) : (
              <div className="w-[92px] h-[92px] border border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-400">
                QR
              </div>
            )}
            <p className="text-[8px] text-slate-400 font-semibold mt-1">رمز التحقق الرقمي</p>
          </div>
        </div>

        {/* بطاقة معلومات الفوج */}
        {data.groups.length > 0 && (
          <div className="grid grid-cols-2 gap-px bg-slate-300 border border-slate-300 mt-5 text-[12px]">
            <div className="bg-slate-50 p-2.5">
              <span className="font-black text-slate-700">الفوج:</span>{' '}
              {data.groups.map((g) => `${g.name} (${g.category})`).join(' • ')}
            </div>
            <div className="bg-slate-50 p-2.5">
              <span className="font-black text-slate-700">الرياضة:</span> السباحة
            </div>
            {data.groups.map((g) => (
              <React.Fragment key={g.id}>
                <div className="bg-slate-50 p-2.5">
                  <span className="font-black text-slate-700">المدرب الرئيسي:</span>{' '}
                  {coachName(g.headCoachId) || '—'}
                </div>
                <div className="bg-slate-50 p-2.5">
                  <span className="font-black text-slate-700">المدرب المساعد:</span>{' '}
                  {coachName(g.assistantCoachId) || '—'}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* جدول التوقيت */}
        <table className="w-full border-collapse border border-slate-400 mt-5 text-right">
          <thead>
            <tr className={HEAD_STYLE}>
              <th className={TH}>اليوم</th>
              <th className={TH}>توقيت الحصة (من - إلى)</th>
              <th className={TH}>الحوض / المسبح</th>
              <th className={TH}>الأفواج</th>
              <th className={TH}>توجيهات وملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className={TD}>لا توجد حصص معتمدة.</td>
              </tr>
            )}
            {sorted.map((s, i) => (
              <tr key={s.id} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                <td className={`${TD} font-black`}>{s.day}</td>
                <td className={TD} dir="ltr">{s.start} - {s.end}</td>
                <td className={TD}>{s.pool}{s.basin ? ` • ${s.basin}` : ''}</td>
                <td className={TD}>
                  {s.groupIds.map(groupById).filter(Boolean).map((g) => g?.name).join(' + ')}
                </td>
                <td className={TD}>{s.focus || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* التذييل والمصادقة */}
        <div className="flex justify-between items-end pt-5 mt-6 border-t border-slate-400">
          <div className="text-[11px]">
            <p className="font-black text-slate-800 mb-1">توجيهات انضباطية:</p>
            <p className="text-slate-600 font-semibold leading-relaxed max-w-md">
              يرجى التواجد قبل انطلاق الحصة بـ 15 دقيقة مصحوبين بالعتاد الكامل والمعدات المعتمدة،
              مع إبراز بطاقة العضوية عند البوابة.
            </p>
            <p className="text-slate-500 mt-2">تاريخ الإصدار: {dateStr}</p>
          </div>
          <div className="text-center">
            <p className="font-black text-slate-800 text-[11px] mb-10">ختم وتأشيرة إدارة النادي</p>
            <div className="w-36 h-16 border-2 border-dashed border-slate-400 rounded flex items-center justify-center text-[9px] text-slate-300">
              ...
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-4 no-print font-semibold">
        وثيقة رسمية صادرة عن منصة نادي الصدارة الرياضي — تُعتمد بالتوقيع والختم.
      </p>

      <style>{`
        @media print {
          body { background: transparent !important; }
          .no-print { display: none !important; }
          .print-document { border: none !important; box-shadow: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
    </div>
  );
};

export default SchedulePrintDocument;