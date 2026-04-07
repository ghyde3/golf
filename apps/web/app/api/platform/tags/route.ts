import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

function apiBase() {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

async function forward(req: NextRequest, method: string) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();
  const res = await fetch(`${apiBase()}/api/platform/tags`, {
    method,
    headers: {
      "Content-Type":
        req.headers.get("content-type") || "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body || undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  return forward(req, "GET");
}

export async function POST(req: NextRequest) {
  return forward(req, "POST");
}
