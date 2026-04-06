"use client";

import { Suspense, type ReactNode } from "react";
import type { UserRole } from "@teetimes/types";
import { ClubTopBarProvider } from "@/components/club/ClubTopBarContext";
import { Sidebar } from "@/components/club/Sidebar";
import { TopBar } from "@/components/club/TopBar";

export function ClubShell({
  clubId,
  clubSlug,
  clubs,
  userName,
  userInitials,
  roles,
  isPlatformAdmin,
  children,
}: {
  clubId: string;
  clubSlug: string;
  clubs: { id: string; name: string; slug?: string }[];
  userName: string;
  userInitials: string;
  roles: UserRole[];
  isPlatformAdmin: boolean;
  children: ReactNode;
}) {
  return (
    <ClubTopBarProvider>
      <div className="flex h-screen overflow-hidden bg-warm-white">
        <Sidebar
          clubId={clubId}
          clubSlug={clubSlug}
          clubs={clubs}
          userName={userName}
          userInitials={userInitials}
          roles={roles}
          isPlatformAdmin={isPlatformAdmin}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Suspense
            fallback={
              <div className="h-14 shrink-0 border-b border-stone bg-warm-white" />
            }
          >
            <TopBar />
          </Suspense>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </ClubTopBarProvider>
  );
}
