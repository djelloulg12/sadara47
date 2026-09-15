import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialog: React.FC<{
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title = 'هل أنت متأكد؟', message, confirmLabel = 'تأكيد الحذف', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0B121E]/80 backdrop-blur-md p-4 animate-in fade-in duration-300 no-print">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 text-center space-y-6">
        <div className="p-5 bg-red-50 text-red-500 w-fit mx-auto rounded-3xl">
          <AlertTriangle size={48} />
        </div>
        <h3 className="text-2xl font-black text-[#0B121E]">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-4">
          <button onClick={onCancel} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-xl shadow-red-200"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;