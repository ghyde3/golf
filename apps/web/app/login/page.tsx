import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const err = searchParams.error;

  return (
    <AuthShell>
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">
          Sign in
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          Staff and club admin access
        </p>

        {err === "forbidden" && (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            You do not have access to that area.
          </p>
        )}
        {err === "config" && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            Server misconfiguration: set JWT_SECRET or NEXTAUTH_SECRET.
          </p>
        )}

        <form
          className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
          action={loginAction}
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
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        {err === "auth" && (
          <p className="mt-4 text-center text-sm text-red-700">
            Invalid email or password.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          <Link
            href="/"
            className="font-medium text-fairway underline-offset-4 hover:underline"
          >
            Back to public site
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
