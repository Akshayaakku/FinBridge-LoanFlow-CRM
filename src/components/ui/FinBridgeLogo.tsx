import { cn } from '../../lib/utils';

export function FinBridgeLogo({
  size = 'md',
  variant = 'dark',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const dims =
    size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-9 h-9 rounded-xl';

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0 select-none relative overflow-hidden',
        dims,
        variant === 'dark'
          ? 'bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#0F172A] ring-1 ring-white/20 shadow-[0_6px_18px_-4px_rgba(37,99,235,0.55)]'
          : 'bg-gradient-to-br from-[#0B1220] via-[#1E293B] to-[#1D4ED8] ring-1 ring-slate-900/15 shadow-sm',
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5')}
      >
        {/* Left & Right Architectural Bridge Pillars */}
        <rect x="6" y="13" width="4.5" height="15.5" rx="1.4" fill="white" fillOpacity="0.96" />
        <rect x="25.5" y="9" width="4.5" height="19.5" rx="1.4" fill="white" fillOpacity="0.96" />
        {/* Ascending Bridge Arch */}
        <path
          d="M8.25 19.5C11.5 13 15.8 11.2 18.2 11.2C20.6 11.2 24.4 12.8 27.75 16.8"
          stroke="#93C5FD"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Keystone Span Bar */}
        <path
          d="M6 25.5H30"
          stroke="white"
          strokeOpacity="0.55"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        {/* Emerald Verification Keystone Node */}
        <rect x="16" y="8.2" width="4" height="4" rx="1" fill="#34D399" />
      </svg>
    </div>
  );
}
