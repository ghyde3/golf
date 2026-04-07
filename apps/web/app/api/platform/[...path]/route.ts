import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

function apiBase() {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

async function forward(
  req: NextRequest,
  method: string,
  pathSegments: string[]
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const path = pathSegments.map((p) => encodeURIComponent(p)).join("/");
  const url = new URL(req.url);
  const target = `${apiBase()}/api/platform/${path}${url.search}`;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();
  const res = await fetch(target, {
    method,
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body || undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(
  req: NextRequest,
  ctx: { params: { path: string[] } }
) {
  return forward(req, "GET", ctx.params.path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: { path: string[] } }
) {
  return forward(req, "POST", ctx.params.path);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { path: string[] } }
) {
  return forward(req, "PUT", ctx.params.path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { path: string[] } }
) {
  return forward(req, "PATCH", ctx.params.path);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { path: string[] } }
) {
  return forward(req, "DELETE", ctx.params.path);
}
