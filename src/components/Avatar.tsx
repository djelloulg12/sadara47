import React from 'react';
import { sportGradient } from '@/constants';
import { Sport } from '@/types';

const Avatar: React.FC<{
  name: string;
  photoUrl?: string;
  sport?: Sport;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ name, photoUrl, sport, size = 'md' }) => {
  const sizes = {
    sm: 'w-10 h-10 text-sm rounded-xl',
    md: 'w-12 h-12 text-lg rounded-2xl',
    lg: 'w-16 h-16 text-xl rounded-2xl',
    xl: 'w-24 h-24 text-3xl rounded-[2rem]',
  }[size];

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizes} object-cover border-2 border-white shadow-md shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizes} flex items-center justify-center font-black text-white ${sportGradient(sport ?? Sport.SWIMMING)} shrink-0`}
    >
      {(name || '؟').charAt(0)}
    </div>
  );
};

export default Avatar;