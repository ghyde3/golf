import type { UserRole } from "@teetimes/types";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: DefaultSession["user"] & {
      id: string;
      roles: UserRole[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: UserRole[];
    accessToken?: string;
  }
}
