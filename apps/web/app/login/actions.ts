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

/**
 * Same source as `authorize` in auth.ts. We need roles here because `auth()`
 * does not see the new session cookie in the same server-action request as
 * `signIn`, so `session.user.roles` would be empty and everyone would land on `/`.
 */
async function fetchRolesForRedirect(
  email: string,
  password: string
): Promise<UserRole[] | null> {
  const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: { roles?: UserRole[] } };
  return data.user?.roles ?? null;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const roles = await fetchRolesForRedirect(email, password);
  if (!roles) {
    redirect("/login?error=auth");
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
      redirect("/login?error=auth");
    }
    throw error;
  }

  if (result?.error) {
    redirect("/login?error=auth");
  }

  redirect(getDefaultLoginRedirect(roles));
}
