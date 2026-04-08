import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string; error?: string };
}) {
  const sent = searchParams.sent === "1";
  const err = searchParams.error;

  return (
    <AuthShell>
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">
          Forgot password
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          We&apos;ll email you a link to reset it
        </p>

        {err === "unavailable" && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            Something went wrong — please try again.
          </p>
        )}

        {sent ? (
          <div className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm">
            <p className="text-center text-sm text-ink">
              Check your inbox. If that email is registered, you&apos;ll receive a
              reset link shortly.
            </p>
            <p className="text-center">
              <Link
                href="/login"
                className="font-medium text-fairway underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
            action={forgotPasswordAction}
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full">
              Send reset link
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
