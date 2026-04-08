"use client";

import { ClubSwitcher } from "@/components/ClubSwitcher";
import { SignOutDialog } from "@/components/SignOutDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { UserRole } from "@teetimes/types";
import {
  BarChart3,
  BookOpen,
  Calendar,
  ExternalLink,
  Flag,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | "dot";
};

function NavLink({
  href,
  label,
  icon,
  active,
  badge,
  iconOnly,
}: NavItem & { active: boolean; iconOnly: boolean }) {
  const showDot =
    badge === "dot" ||
    (iconOnly && typeof badge === "number" && badge > 0);
  const showPill =
    !iconOnly && typeof badge === "number" && badge > 0;

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
      {showDot ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
      ) : null}
      {showPill ? (
        <span className="ml-auto min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
          {badge! > 99 ? "99+" : badge}
        </span>
      ) : null}
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

export function Sidebar({
  clubId,
  clubSlug,
  clubs,
  userName,
  userInitials,
  roles,
  isPlatformAdmin,
}: {
  clubId: string;
  clubSlug: string;
  clubs: { id: string; name: string; slug?: string }[];
  userName: string;
  userInitials: string;
  roles: UserRole[];
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isTablet = useMediaQuery("(max-width: 1023px)");
  const iconOnly = isTablet;

  const [bookingsBadge, setBookingsBadge] = useState<number>(0);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/manage/summary`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { bookingsToday?: number };
        if (!cancelled && typeof data.bookingsToday === "number") {
          setBookingsBadge(data.bookingsToday);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const roleForClub =
    roles.find((r) => r.clubId === clubId)?.role ?? null;
  const roleLabel =
    roleForClub === "club_admin"
      ? "Admin"
      : roleForClub === "staff"
        ? "Staff"
        : isPlatformAdmin
          ? "Platform"
          : null;

  const base = `/club/${clubId}`;
  const bookingsNavBadge: NavItem["badge"] =
    bookingsBadge > 0
      ? iconOnly
        ? "dot"
        : bookingsBadge
      : undefined;

  const ops: NavItem[] = [
    {
      href: `${base}/dashboard`,
      label: "Dashboard",
      icon: <LayoutDashboard />,
    },
    {
      href: `${base}/teesheet`,
      label: "Tee sheet",
      icon: <Calendar />,
    },
    {
      href: `${base}/bookings`,
      label: "Bookings",
      icon: <BookOpen />,
      badge: bookingsNavBadge,
    },
  ];

  const management: NavItem[] = [
    { href: `${base}/courses`, label: "Courses", icon: <Flag /> },
    { href: `${base}/resources`, label: "Resources", icon: <Package /> },
    { href: `${base}/staff`, label: "Staff", icon: <Users /> },
    { href: `${base}/settings`, label: "Settings", icon: <Settings /> },
    { href: `${base}/reports`, label: "Reports", icon: <BarChart3 /> },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-white/[0.07] bg-sidebar-bg",
          iconOnly ? "w-16" : "w-[220px]"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-4",
            iconOnly && "justify-center px-2"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold text-xs font-bold text-forest">
            T
          </div>
          {!iconOnly && (
            <span className="font-display text-lg text-white">TeeTimes</span>
          )}
        </div>

        <div
          className={cn(
            "border-b border-white/[0.07] px-2 py-2",
            iconOnly && "px-1.5"
          )}
        >
          {iconOnly ? (
            <div className="relative flex justify-center">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fairway text-xs font-bold text-white">
                    {(clubs.find((c) => c.id === clubId)?.name ?? "C")
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {clubs.find((c) => c.id === clubId)?.name ?? "Club"}
                </TooltipContent>
              </Tooltip>
              {clubs.length > 1 ? (
                <select
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Switch club"
                  value={clubId}
                  onChange={(e) => {
                    router.push(`/club/${e.target.value}/dashboard`);
                  }}
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              <ClubSwitcher
                clubId={clubId}
                clubs={clubs}
                variant="sidebar"
                roleLabel={roleLabel}
              />
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-2">
          <SectionLabel iconOnly={iconOnly}>Operations</SectionLabel>
          {ops.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              iconOnly={iconOnly}
            />
          ))}

          <SectionLabel iconOnly={iconOnly}>Management</SectionLabel>
          {management.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              iconOnly={iconOnly}
            />
          ))}

          {iconOnly ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <a
                  href={`/book/${clubSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center rounded-lg px-2.5 py-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="right">Public page</TooltipContent>
            </Tooltip>
          ) : (
            <a
              href={`/book/${clubSlug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span>Public page</span>
            </a>
          )}
        </nav>

        <div className="mt-auto border-t border-white/[0.07] p-2">
          {isPlatformAdmin && !iconOnly && (
            <Link
              href="/platform"
              className="mb-2 block rounded-lg px-2.5 py-2 text-xs text-grass hover:bg-white/[0.06]"
            >
              Platform admin
            </Link>
          )}
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
