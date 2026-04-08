"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

/**
 * Pass `session` from `await auth()` in a server layout so `useSession()` has
 * data immediately (including `accessToken`). Without it, the client starts in
 * `loading` with no token — cross-origin API calls miss `Authorization` and
 * bookings are stored as guests.
 */
export function AuthSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return <SessionProvider session={session ?? undefined}>{children}</SessionProvider>;
}
