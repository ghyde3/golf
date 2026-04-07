import { auth } from "@/auth";
import { apiProxyBase } from "@/lib/api-proxy-base";
import { NextRequest } from "next/server";

async function forward(
  req: NextRequest,
  method: string,
  clubId: string,
  pathSegments: string[]
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = pathSegments.join("/");
  const url = `${apiProxyBase()}/api/clubs/${clubId}/${path}${req.nextUrl.search}`;
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.text();

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type":
        req.headers.get("content-type") || "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body || undefined,
    cache: "no-store",
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: { clubId: string; path: string[] } }
) {
  return forward(req, "GET", ctx.params.clubId, ctx.params.path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: { clubId: string; path: string[] } }
) {
  return forward(req, "POST", ctx.params.clubId, ctx.params.path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { clubId: string; path: string[] } }
) {
  return forward(req, "PATCH", ctx.params.clubId, ctx.params.path);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: { clubId: string; path: string[] } }
) {
  return forward(req, "PUT", ctx.params.clubId, ctx.params.path);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { clubId: string; path: string[] } }
) {
  return forward(req, "DELETE", ctx.params.clubId, ctx.params.path);
}
