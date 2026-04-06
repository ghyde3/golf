"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/");
  const next = nextRaw.startsWith("/") ? nextRaw : "/";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: next,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=auth");
    }
    throw error;
  }
}
