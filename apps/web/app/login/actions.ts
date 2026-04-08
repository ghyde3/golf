"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getDefaultLoginRedirect } from "@/lib/post-login-redirect";
import { apiBaseUrl } from "@/lib/server-session";
import type { UserRole } from "@teetimes/types";

type SignInResult = {
  error?: string;
};

type LoginPrecheck =
  | { ok: true; roles: UserRole[] }
  | { ok: false; reason: "auth" | "unavailable" };

/**
 * Same source as `authorize` in auth.ts. We need roles here because `auth()`
 * does not see the new session cookie in the same server-action request as
 * `signIn`, so `session.user.roles` would be empty and everyone would land on `/`.
 */
async function fetchRolesForRedirect(
  email: string,
  password: string
): Promise<LoginPrecheck> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!res.ok) return { ok: false, reason: "auth" };
  const data = (await res.json()) as { user?: { roles?: UserRole[] } };
  const roles = data.user?.roles ?? null;
  if (roles === null) return { ok: false, reason: "auth" };
  return { ok: true, roles };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const precheck = await fetchRolesForRedirect(email, password);
  if (!precheck.ok) {
    if (precheck.reason === "unavailable") {
      redirect("/login?error=unavailable");
    }
    redirect("/login?error=auth");
  }
  const { roles } = precheck;

  let result: SignInResult | undefined;
  try {
    result = (await signIn("credentials", {
      email,
      password,
      redirect: false,
    })) as SignInResult;
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=auth");
    }
    throw error;
  }

  if (result?.error) {
    redirect("/login?error=auth");
  }

  redirect(getDefaultLoginRedirect(roles));
}
