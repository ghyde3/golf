import type { NextAuthConfig } from "next-auth";
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
    async jwt({ token, user }) {
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
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles as UserRole[]) ?? [];
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
