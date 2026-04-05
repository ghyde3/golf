import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

type RoleClaim = { role: string; clubId: string | null };

function getSecretKey() {
  const s = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const secret = getSecretKey();
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const token = request.cookies.get("session")?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  let roles: RoleClaim[];
  try {
    const { payload } = await jwtVerify(token, secret);
    roles = (payload.roles as RoleClaim[]) ?? [];
  } catch {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/platform")) {
    const ok = roles.some((r) => r.role === "platform_admin" && r.clubId === null);
    if (!ok) {
      return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
    }
  }

  if (pathname.startsWith("/club/")) {
    const parts = pathname.split("/").filter(Boolean);
    const clubId = parts[1];
    if (clubId) {
      const ok =
        roles.some((r) => r.role === "platform_admin" && r.clubId === null) ||
        roles.some(
          (r) =>
            (r.role === "club_admin" || r.role === "staff") && r.clubId === clubId
        );
      if (!ok) {
        return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/platform/:path*", "/club", "/club/:path*"],
};
