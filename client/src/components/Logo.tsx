import React from 'react';
import logoImage from '@/images/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

const sizeMap = {
  sm: 'w-auto h-4',
  md: 'w-auto  h-6',
  lg: 'w-auto  h-8',
  xl: 'w-auto h-12',
};

export function Logo({ className = '', size = 'md', alt = 'Grupo PBE Logo' }: LogoProps) {
  const sizeClass = sizeMap[size];
  
  return (
    <img 
      src={logoImage} 
      alt={alt}
      className={`${sizeClass} ${className}`}
    />
  );
}

