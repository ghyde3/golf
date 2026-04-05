import "server-only";

import { cookies } from "next/headers";

function apiBase(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

function authHeader(): HeadersInit {
  const token = cookies().get("session")?.value;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export async function platformApi(path: string, init?: RequestInit) {
  return fetch(`${apiBase()}/api/platform${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...init?.headers,
    },
  });
}

export async function clubManageApi(clubId: string, path: string, init?: RequestInit) {
  return fetch(`${apiBase()}/api/clubs/${clubId}/manage${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...init?.headers,
    },
  });
}
