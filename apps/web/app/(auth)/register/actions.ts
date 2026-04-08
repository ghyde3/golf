"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { apiBaseUrl } from "@/lib/server-session";

type SignInResult = {
  error?: string;
};

function safeRedirectPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

export async function registerAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeRedirectPath(formData.get("redirect"));

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
  } catch {
    redirect("/register?error=unavailable");
  }

  if (res.status === 409) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { code?: string };
      code = body.code;
    } catch {
      /* ignore */
    }
    if (code === "EMAIL_TAKEN") {
      redirect("/register?error=taken");
    }
    redirect("/register?error=unavailable");
  }

  if (!res.ok) {
    redirect("/register?error=unavailable");
  }

  let result: SignInResult | undefined;
  try {
    result = (await signIn("credentials", {
      email,
      password,
      redirect: false,
    })) as SignInResult;
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/register?error=unavailable");
    }
    throw error;
  }

  if (result?.error) {
    redirect("/register?error=unavailable");
  }

  redirect(nextPath ?? "/account?section=bookings");
}
