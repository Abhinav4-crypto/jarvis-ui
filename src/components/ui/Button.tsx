import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs gap-1.5 min-h-[34px]'
      : size === 'lg'
        ? 'px-6 py-3 text-sm gap-2.5 min-h-[44px]'
        : 'px-4 py-2 text-sm gap-2 min-h-[40px]';

  const variantClass =
    variant === 'primary'
      ? 'bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 text-[#0A0908] font-semibold shadow-[0_0_24px_-6px_rgba(245,158,11,0.55)] hover:brightness-110 active:scale-[0.98]'
      : variant === 'secondary'
        ? 'bg-amber-950/5 dark:bg-white/[0.04] border border-amber-900/15 dark:border-amber-500/22 text-[#1E1914] dark:text-[#FAF6EE] font-medium hover:bg-amber-500/10 dark:hover:bg-amber-500/12 hover:border-amber-500/40'
        : variant === 'danger'
          ? 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 font-medium hover:bg-red-500/20'
          : 'bg-transparent text-[#574E44] dark:text-[#B5ABA0] font-medium hover:bg-amber-950/5 dark:hover:bg-white/[0.05] hover:text-[#171411] dark:hover:text-[#FAF6EE]';

  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center rounded-xl whitespace-nowrap shrink-0 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-45 disabled:pointer-events-none cursor-pointer',
        sizeClass,
        variantClass,
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}
