import React from 'react';
import { Info, ShieldCheck, Lock, FileCheck2, Eye, ScrollText } from 'lucide-react';

const LegalPage: React.FC = () => {
  const items = [
    {
      icon: Lock,
      title: 'تشفير البيانات',
      desc: 'تشفير رقم التعريف الوطني (NIN) وفق المعايير الوطنية أثناء التخزين والعرض.',
    },
    {
      icon: FileCheck2,
      title: 'تقييد الجمع',
      desc: 'جمع البيانات محصور حصراً في التسيير الرياضي للنادي ولا شيء غيره.',
    },
    {
      icon: ScrollText,
      title: 'سجل التدقيق',
      desc: 'سجل تدقيق كامل (Audit Log) يراقب كل العمليات على المنصة.',
    },
    {
      icon: Eye,
      title: 'حق الوصول والتصحيح',
      desc: 'حق الرياضي أو وليه في ممارسة حقوق الوصول والتصحيح لبياناته في أي وقت.',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="max-w-4xl mx-auto bg-white border border-[#D4AF37]/20 p-10 rounded-[40px] shadow-sm space-y-8 slide-in-from-bottom-10 animate-in">
        <div className="flex items-center gap-6 mb-4">
          <div className="p-4 bg-blue-50 rounded-2xl">
            <ShieldCheck className="text-blue-600" size={40} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[#1A3A5F]">الامتثال القانوني والأمان</h2>
            <p className="text-gray-500">حماية البيانات وفق القانون 18-07 الجزائري</p>
          </div>
        </div>

        <div className="space-y-6 text-gray-600">
          <p className="font-bold text-[#1A3A5F] text-lg">يلتزم نادي الصدارة - غرداية بمقتضيات القانون رقم 18-07:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.title} className="flex gap-4 items-start p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-[#D4AF37]/30 transition-all">
                <div className="p-2.5 bg-[#1A3A5F] text-[#D4AF37] rounded-xl shrink-0">
                  <item.icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-[#0B121E]">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-2xl flex gap-4">
            <Info className="text-yellow-600 shrink-0" />
            <p className="text-xs text-yellow-800 leading-relaxed font-medium">
              المسؤول القانوني: رئيس نادي الصدارة هو الضامن الأول لسرية المعلومات. أي سوء استخدام يعرض الفاعل للمساءلة القانونية والإدارية.
            </p>
          </div>

          <div className="p-6 bg-[#007377]/5 border border-[#007377]/15 rounded-2xl">
            <p className="text-xs font-bold text-[#007377] leading-relaxed">
              💡 هل تعلم؟ في منصة sadara47 تظهر أرقام التعريف الوطني (NIN) بشكل مُقنّع، ولا يكشف عنها إلا في التقارير الفنية الرسمية المطبوعة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;