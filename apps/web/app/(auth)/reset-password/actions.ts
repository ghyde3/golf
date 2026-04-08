"use server";

import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/server-session";

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
  } catch {
    redirect(
      `/reset-password?error=unavailable&token=${encodeURIComponent(token)}`
    );
  }

  if (res.status === 400) {
    redirect(
      `/reset-password?error=expired&token=${encodeURIComponent(token)}`
    );
  }

  if (!res.ok) {
    redirect(
      `/reset-password?error=unavailable&token=${encodeURIComponent(token)}`
    );
  }

  redirect("/login?message=password_reset");
}
