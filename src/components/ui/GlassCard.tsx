import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: boolean;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  glow = false,
  interactive = false,
  padding = 'md',
  className = '',
  ...rest
}: GlassCardProps) {
  const padClass =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-4'
        : padding === 'lg'
          ? 'p-7'
          : 'p-5';

  return (
    <div
      className={[
        'rounded-2xl border backdrop-blur-xl transition-all duration-200',
        'bg-white/85 border-amber-900/12 shadow-[0_6px_28px_-12px_rgba(120,75,15,0.12)]',
        'dark:bg-[#111012]/80 dark:border-amber-500/18 dark:shadow-[0_12px_40px_-18px_rgba(0,0,0,0.85)]',
        glow
          ? 'dark:shadow-[0_0_40px_-15px_rgba(245,158,11,0.22)] border-amber-600/25 dark:border-amber-500/30'
          : '',
        interactive
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-amber-600/40 dark:hover:border-amber-400/45 hover:shadow-[0_10px_30px_-10px_rgba(245,158,11,0.2)]'
          : '',
        padClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
