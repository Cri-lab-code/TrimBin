import React from 'react';

interface BrassBadgeProps {
  label: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrassBadge: React.FC<BrassBadgeProps> = ({
  label,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-[8px]',
    md: 'px-3 py-1 text-[9.5px]',
    lg: 'px-4 py-1.5 text-[11px]',
  };

  return (
    <div
      className={`skeuo-brass-badge relative inline-flex items-center justify-center font-sans font-semibold tracking-[0.15em] uppercase text-[var(--text-primary)] shadow-lg ${sizeClasses[size]} ${className}`}
    >
      <div className="absolute top-[2px] left-[2px] skeuo-screw-head" />
      <div className="absolute top-[2px] right-[2px] skeuo-screw-head" />
      <div className="absolute bottom-[2px] left-[2px] skeuo-screw-head" />
      <div className="absolute bottom-[2px] right-[2px] skeuo-screw-head" />
      <span className="mx-2 drop-shadow-sm">
        {label}
      </span>
    </div>
  );
};
