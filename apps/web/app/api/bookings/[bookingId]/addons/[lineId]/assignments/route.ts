import { auth } from "@/auth";
import { apiProxyBase } from "@/lib/api-proxy-base";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  ctx: { params: { bookingId: string; lineId: string } }
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const res = await fetch(
    `${apiProxyBase()}/api/bookings/${ctx.params.bookingId}/addons/${ctx.params.lineId}/assignments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
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
