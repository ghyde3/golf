"use client";

import { PlatformSidebar } from "@/components/platform/PlatformSidebar";
import {
  PlatformTopBarProvider,
} from "@/components/platform/PlatformTopBarContext";
import { PlatformTopBar } from "@/components/platform/PlatformTopBar";
import { Suspense, type ReactNode } from "react";

export function PlatformShell({
  userName,
  userInitials,
  children,
}: {
  userName: string;
  userInitials: string;
  children: ReactNode;
}) {
  return (
    <PlatformTopBarProvider>
      <div className="flex h-screen overflow-hidden bg-warm-white">
        <PlatformSidebar userName={userName} userInitials={userInitials} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Suspense
            fallback={
              <div className="h-14 shrink-0 border-b border-stone bg-warm-white" />
            }
          >
            <PlatformTopBar />
          </Suspense>
          <main className="min-h-0 flex-1 overflow-y-auto bg-cream">{children}</main>
        </div>
      </div>
    </PlatformTopBarProvider>
  );
}
