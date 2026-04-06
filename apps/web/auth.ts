import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@teetimes/types";

function apiBase(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password || typeof email !== "string") {
          return null;
        }

        const res = await fetch(`${apiBase()}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(email).trim(),
            password: String(password),
          }),
        });

        if (!res.ok) {
          return null;
        }

        const data = (await res.json()) as {
          token: string;
          user: {
            id: string;
            email: string;
            name: string | null;
            roles: UserRole[];
          };
        };

        if (!data?.token || !data?.user) {
          return null;
        }

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name ?? undefined,
          roles: data.user.roles,
          accessToken: data.token,
        };
      },
    }),
  ],
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
});
