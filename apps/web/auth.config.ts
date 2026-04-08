import type { NextAuthConfig } from "next-auth";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@teetimes/types";

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

/**
 * Shared NextAuth options (JWT/session/callbacks only).
 * Used by middleware on Edge — must not import Credentials or Node-only code.
 * @see https://authjs.dev/guides/edge-compatibility
 */
export default {
  trustHost: true,
  ...(secret ? { secret } : {}),
  providers: [],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: unknown }) {
      if (user) {
        const u = user as {
          roles?: UserRole[];
          accessToken?: string;
        };
        token.roles = u.roles;
        token.accessToken = u.accessToken;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }) {
      if (session.user) {
        const t = token as JWT & { sub?: string };
        session.user.id = t.sub ?? "";
        session.user.roles = (t.roles as UserRole[]) ?? [];
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
