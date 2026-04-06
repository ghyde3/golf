import { auth } from "@/auth";
import { apiProxyBase } from "@/lib/api-proxy-base";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  ctx: { params: { bookingId: string; playerId: string } }
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const res = await fetch(
    `${apiProxyBase()}/api/bookings/${ctx.params.bookingId}/players/${ctx.params.playerId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
