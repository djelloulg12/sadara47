import React from 'react';

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number | string; className?: string; style?: React.CSSProperties }>;
  color?: string;
  onOpen?: () => void;
}> = ({ label, value, icon: Icon, color = '#007377', onOpen }) => (
  <button
    onClick={onOpen}
    className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden text-right w-full"
  >
    <div
      className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"
      style={{ background: `${color}14` }}
    ></div>
    <div className="flex justify-between items-start mb-8 relative z-10">
      <div className="p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-white" style={{ background: `${color}0f` }}>
        <Icon size={28} style={{ color }} />
      </div>
    </div>
    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{label}</h3>
    <p className="text-4xl font-black text-[#0B121E] tracking-tighter">{value}</p>
  </button>
);

export default StatCard;