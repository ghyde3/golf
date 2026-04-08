"use server";

import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/server-session";

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    redirect("/forgot-password?error=unavailable");
  }

  if (res.ok) {
    redirect("/forgot-password?sent=1");
  }
  redirect("/forgot-password?error=unavailable");
}
