import "server-only";

import { cookies } from "next/headers";

export function getSessionToken(): string | undefined {
  return cookies().get("session")?.value;
}

export function apiBaseUrl(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}
