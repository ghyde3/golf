import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  const token = searchParams.token ?? "";
  const err = searchParams.error;

  if (!token && err !== "expired") {
    redirect("/forgot-password");
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">
          Reset password
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          Choose a new password for your account
        </p>

        {err === "unavailable" && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            Something went wrong — please try again.
          </p>
        )}

        {err === "expired" ? (
          <div className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm">
            <p className="text-center text-sm text-ink">
              This link has expired or is invalid.{" "}
              <Link
                href="/forgot-password"
                className="font-medium text-fairway underline-offset-4 hover:underline"
              >
                Request a new one →
              </Link>
            </p>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
            action={resetPasswordAction}
          >
            <input type="hidden" name="token" value={token} />
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted"
              >
                New password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Set new password
            </Button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          <Link
            href="/login"
            className="font-medium text-fairway underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
