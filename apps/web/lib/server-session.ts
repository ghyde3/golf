import "server-only";

import { auth } from "@/auth";

export async function getSessionToken(): Promise<string | undefined> {
  const session = await auth();
  return session?.accessToken;
}

export function apiBaseUrl(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}
