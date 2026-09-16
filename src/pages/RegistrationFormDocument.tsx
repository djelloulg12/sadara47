import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileDown, Loader2, Printer, ShieldCheck } from 'lucide-react';
import { useAppContext } from '@/context';
import { getPrintData } from '@/data';
import { downloadFormImage, downloadFormPdf, renderBackCanvas, renderFormCanvas, renderReceiptCanvas } from '@/services/formService';
import logo from '@/assets/logo.png';

const RegistrationFormDocument: React.FC = () => {
  const { setRoute } = useAppContext();
  const data = getPrintData();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const receiptCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!data) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const front = await renderFormCanvas(data, { photoUrl: data.photoUrl });
        const back = await renderBackCanvas(data);
        const receipt = await renderReceiptCanvas(data);
        if (!alive) return;
        canvasRef.current = front;
        backCanvasRef.current = back;
        receiptCanvasRef.current = receipt;
        setDataUrl(front.toDataURL('image/jpeg', 0.92));
        setBackUrl(back ? back.toDataURL('image/jpeg', 0.92) : null);
        setReceiptUrl(receipt ? receipt.toDataURL('image/jpeg', 0.92) : null);
      } catch {
        if (alive) setDataUrl(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [data]);

  const faces = () =>
    [canvasRef.current, backCanvasRef.current, receiptCanvasRef.current].filter(Boolean) as HTMLCanvasElement[];

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 gap-6">
        <p className="text-gray-500 font-bold">لا توجد بيانات للعرض.</p>
        <button onClick={() => setRoute('register')} className="px-8 py-4 bg-[#1A3A5F] text-white rounded-2xl font-bold">
          العودة للتسجيل
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-between gap-3 mb-6 no-print items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار النادي" className="w-12 h-12 rounded-full object-cover border-2 border-[#D4AF37]" />
            <div>
              <p className="font-black text-[#0B121E] text-sm">استمارة الإخراط - نادي الصدارة</p>
              <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.2em]">Official Inscription Form</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => downloadFormImage(faces())}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 bg-[#0B121E] text-white rounded-2xl font-bold shadow-lg border-b-4 border-[#D4AF37]"
            >
              <FileDown size={18} className="text-[#D4AF37]" /> صورة
            </button>
            <button
              onClick={() => downloadFormPdf(faces())}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 bg-[#007377] text-white rounded-2xl font-bold shadow-lg border-b-4 border-green-900"
            >
              <FileDown size={18} /> PDF
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 bg-white text-gray-600 rounded-2xl font-bold shadow-sm border border-gray-200">
              <Printer size={18} /> طباعة
            </button>
            <button onClick={() => setRoute('register')} className="flex items-center gap-2 px-5 py-3 bg-white text-gray-400 rounded-2xl font-bold shadow-sm">
              <ArrowRight size={18} /> عودة
            </button>
          </div>
        </div>

        <div id="printable-area" className="print-container bg-white shadow-2xl rounded-sm mx-auto max-w-[180mm] relative">
          <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-100 mb-3">
            <img src={logo} alt="الشعار" className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]" />
            <div className="text-center text-[10px] font-bold text-gray-400">
              <p className="text-xs font-black text-[#0B121E]">نادي الصدارة الرياضي - غرداية</p>
              <p className="uppercase tracking-widest">Club Sportif Sadara • جمهورية الجزائر</p>
            </div>
          </div>

          {loading ? (
            <div className="p-20 flex flex-col items-center gap-4 text-gray-400">
              <Loader2 size={40} className="animate-spin text-[#D4AF37]" />
              <p className="text-sm font-bold">جاري تجهيز الاستمارة الرسمية...</p>
            </div>
          ) : dataUrl ? (
            <>
              <img src={dataUrl} alt="الاستمارة الرسمية - الوجه الأول" className="w-full h-auto" />
              {backUrl ? (
                <div className="print-page-break">
                  <img src={backUrl} alt="الوجه الثاني - معلومات الحساب" className="w-full h-auto" />
                </div>
              ) : null}
              {receiptUrl ? (
                <div className="print-page-break">
                  <img src={receiptUrl} alt="وصل حقوق الاشتراك والتأمين" className="w-full h-auto" />
                </div>
              ) : null}
            </>
          ) : (
            <div className="p-10 text-center">
              <ShieldCheck className="text-gray-300 mx-auto mb-4" size={48} />
              <p className="text-sm font-bold text-gray-500">تعذّر توليد الاستمارة في هذا المتصفح.</p>
            </div>
          )}

          <div className="p-5 text-center text-[10px] text-gray-400 font-bold pt-2">
            وثيقة مولّدة رقمياً وفق خريطة الإحداثيات النسبية • تُصادق بتوقيع الطبيب وبلدية غرداية قبل الإرسال
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationFormDocument;