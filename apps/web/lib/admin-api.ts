import "server-only";

import { auth } from "@/auth";

function apiBase(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

async function authHeader(): Promise<HeadersInit> {
  const session = await auth();
  const token = session?.accessToken;
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
      ...(await authHeader()),
      ...init?.headers,
    },
  });
}

export async function clubManageApi(
  clubId: string,
  path: string,
  init?: RequestInit
) {
  return fetch(`${apiBase()}/api/clubs/${clubId}/manage${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...init?.headers,
    },
  });
}

/** Club-scoped routes mounted at `/api/clubs/:clubId` (courses, config, teesheet, etc.) */
export async function clubApi(
  clubId: string,
  path: string,
  init?: RequestInit
) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${apiBase()}/api/clubs/${clubId}${p}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...init?.headers,
    },
  });
}
