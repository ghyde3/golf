"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Tags,
  Users as UsersIcon,
} from "lucide-react";
import { SignOutDialog } from "@/components/SignOutDialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function NavLink({
  href,
  label,
  icon,
  active,
  iconOnly,
}: NavItem & { active: boolean; iconOnly: boolean }) {
  const inner = (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-fairway text-white"
          : "text-white/55 hover:bg-white/[0.06] hover:text-white/80"
      )}
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      {!iconOnly && <span className="truncate">{label}</span>}
    </Link>
  );

  if (iconOnly) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

function SectionLabel({
  children,
  iconOnly,
}: {
  children: React.ReactNode;
  iconOnly: boolean;
}) {
  if (iconOnly) return null;
  return (
    <p className="px-2 pb-2 pt-4 text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">
      {children}
    </p>
  );
}

export function PlatformSidebar({
  userName,
  userInitials,
}: {
  userName: string;
  userInitials: string;
}) {
  const pathname = usePathname();
  const isTablet = useMediaQuery("(max-width: 1023px)");
  const iconOnly = isTablet;
  const [signOutOpen, setSignOutOpen] = useState(false);

  const overview: NavItem[] = [
    { href: "/platform", label: "Dashboard", icon: <LayoutDashboard /> },
    { href: "/platform/clubs", label: "Clubs", icon: <Building2 /> },
    { href: "/platform/tags", label: "Tags", icon: <Tags /> },
  ];

  const system: NavItem[] = [
    { href: "/platform/billing", label: "Billing", icon: <CreditCard /> },
    { href: "/platform/settings", label: "Settings", icon: <Settings /> },
    { href: "/platform/users", label: "Users", icon: <UsersIcon /> },
    { href: "/platform/audit-log", label: "Audit Log", icon: <ClipboardList /> },
    { href: "/platform/announcements", label: "Announcements", icon: <Megaphone /> },
  ];

  const isActive = (href: string) => {
    if (href === "/platform") {
      return pathname === "/platform" || pathname === "/platform/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-white/[0.07] bg-slate-900",
        iconOnly ? "w-16" : "w-[220px]"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-1.5 border-b border-white/[0.07] px-4 py-4",
          iconOnly && "items-center px-2"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2.5",
            iconOnly && "justify-center"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold text-xs font-bold text-forest">
            T
          </div>
          {!iconOnly && (
            <span className="font-display text-lg text-white">TeeTimes</span>
          )}
        </div>
        {!iconOnly && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-2">
            Platform admin
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-2">
        <SectionLabel iconOnly={iconOnly}>Overview</SectionLabel>
        {overview.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            iconOnly={iconOnly}
          />
        ))}

        <SectionLabel iconOnly={iconOnly}>System</SectionLabel>
        {system.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            iconOnly={iconOnly}
          />
        ))}
      </nav>

      <div className="mt-auto border-t border-white/[0.07] p-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2",
            iconOnly && "justify-center"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-xs font-semibold text-white/80">
            {userInitials}
          </div>
          {!iconOnly && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/60">
                {userName}
              </p>
              <button
                type="button"
                onClick={() => setSignOutOpen(true)}
                className="text-xs text-white/40 transition-colors hover:text-white/70"
              >
                Sign out
              </button>
            </div>
          )}
          {iconOnly && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSignOutOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </aside>
  );
}
