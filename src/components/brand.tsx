export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#3b66f5" />
      <path
        d="M20 8.5a11.5 11.5 0 1 0 0 23 11.5 11.5 0 0 0 0-23Zm0 4.2a7.3 7.3 0 0 1 6.9 4.9h-4.3a3 3 0 0 0-5.2 0h-4.3a7.3 7.3 0 0 1 6.9-4.9Zm-7.3 7.8h4.4a3 3 0 0 0 1.4 2.3l-2.2 3.8a7.3 7.3 0 0 1-3.6-6.1Zm7.3 7.3c-.9 0-1.8-.2-2.6-.5l2.2-3.8h.8l2.2 3.8c-.8.3-1.7.5-2.6.5Zm3.7-1.2-2.2-3.8a3 3 0 0 0 1.4-2.3h4.4a7.3 7.3 0 0 1-3.6 6.1Z"
        fill="#fff"
      />
    </svg>
  );
}

export function BrandWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <p className={`text-base font-bold tracking-[0.18em] ${dark ? "text-slate-900" : "text-white"}`}>INVERSAM</p>
        <p className={`text-[10px] font-medium tracking-[0.2em] uppercase ${dark ? "text-slate-500" : "text-brand-200"}`}>
          Manager
        </p>
      </div>
    </div>
  );
}
