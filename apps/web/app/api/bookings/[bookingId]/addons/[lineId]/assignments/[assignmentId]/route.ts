import { auth } from "@/auth";
import { apiProxyBase } from "@/lib/api-proxy-base";
import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { bookingId: string; lineId: string; assignmentId: string } }
) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    `${apiProxyBase()}/api/bookings/${ctx.params.bookingId}/addons/${ctx.params.lineId}/assignments/${ctx.params.assignmentId}`,
    {
      method: "DELETE",
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
