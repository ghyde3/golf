import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

function apiBase() {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs ? `${apiBase()}/api/platform/users?${qs}` : `${apiBase()}/api/platform/users`;
  const res = await fetch(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
