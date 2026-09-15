import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState: React.FC<{ title?: string; hint?: string }> = ({
  title = 'لا توجد بيانات بعد',
  hint = 'ابدأ بإضافة عنصر جديد ليرى النور هنا.',
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300 mb-6">
      <Inbox size={40} />
    </div>
    <h4 className="text-lg font-black text-[#0B121E]">{title}</h4>
    <p className="text-sm text-gray-400 font-medium mt-1">{hint}</p>
  </div>
);

export default EmptyState;