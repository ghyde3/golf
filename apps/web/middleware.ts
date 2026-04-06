import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole } from "@teetimes/types";

export default auth((req) => {
  const roles =
    (req.auth?.user as { roles?: UserRole[] } | undefined)?.roles ?? [];
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/platform")) {
    if (!req.auth?.user) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    const ok = roles.some(
      (r) => r.role === "platform_admin" && r.clubId === null
    );
    if (!ok) {
      return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
    }
  }

  if (pathname.startsWith("/club/") || pathname === "/club") {
    if (!req.auth?.user) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    const parts = pathname.split("/").filter(Boolean);
    const clubId = parts[1];
    if (clubId) {
      const ok =
        roles.some((r) => r.role === "platform_admin" && r.clubId === null) ||
        roles.some(
          (r) =>
            (r.role === "club_admin" || r.role === "staff") &&
            r.clubId === clubId
        );
      if (!ok) {
        return NextResponse.redirect(new URL("/login?error=forbidden", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/platform/:path*", "/club", "/club/:path*"],
};
