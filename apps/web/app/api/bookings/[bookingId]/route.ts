import { auth } from "@/auth";
import { apiProxyBase } from "@/lib/api-proxy-base";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: { bookingId: string } }
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    `${apiProxyBase()}/api/bookings/${ctx.params.bookingId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { bookingId: string } }
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = `${apiProxyBase()}/api/bookings/${ctx.params.bookingId}${req.nextUrl.search}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
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
