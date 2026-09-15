import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  accent?: 'navy' | 'teal' | 'red' | 'gold';
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, subtitle, accent = 'navy', children, maxWidth = 'max-w-2xl' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const headerBg =
    accent === 'red' ? 'bg-red-600' : accent === 'teal' ? 'teal-gradient' : 'luxury-gradient-navy';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B121E]/90 backdrop-blur-md p-4 animate-in fade-in duration-300 no-print">
      <div className={`w-full ${maxWidth} bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-[#D4AF37]/20 relative max-h-[92vh] flex flex-col`}>
        <button
          onClick={onClose}
          className="absolute top-6 left-6 p-2.5 text-gray-400 hover:text-red-500 bg-white/90 hover:bg-white rounded-full transition-all z-20 shadow-sm"
        >
          <X size={20} />
        </button>
        {(title || subtitle) && (
          <div className={`${headerBg} p-8 text-center text-white shrink-0`}>
            {title && <h3 className="text-2xl font-black">{title}</h3>}
            {subtitle && (
              <p className="text-[#D4AF37] text-xs font-black uppercase tracking-[0.2em] mt-1.5">{subtitle}</p>
            )}
          </div>
        )}
        <div className="p-8 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Modal;