import type { ReactNode } from "react";

/**
 * Auth pages (login, set-password) — same visual language as the club dashboard:
 * dark sidebar strip + warm-white content, Playfair logo, fairway primary actions.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-warm-white lg:flex-row">
      <aside className="flex flex-col items-center justify-center border-b border-white/10 bg-sidebar-bg px-6 py-8 lg:w-[220px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-sm font-bold text-forest">
            T
          </div>
          <span className="font-display text-lg text-white">TeeTimes</span>
        </div>
        <p className="mt-3 max-w-[180px] text-center text-xs leading-relaxed text-white/45">
          Golf tee time management
        </p>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 lg:py-12">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold text-xs font-bold text-forest">
            T
          </div>
          <span className="font-display text-lg text-ink">TeeTimes</span>
        </div>
        {children}
      </div>
    </div>
  );
}
