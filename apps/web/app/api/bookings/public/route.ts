import { apiProxyBase } from "@/lib/api-proxy-base";
import { NextRequest } from "next/server";

/** Proxies public booking creation (creates tee slot when needed). No JWT required on Express. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${apiProxyBase()}/api/bookings/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
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
