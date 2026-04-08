import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAction } from "./actions";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { error?: string; redirect?: string };
}) {
  const err = searchParams.error;
  const redirectTo = searchParams.redirect ?? "";
  const loginHref = redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/login";

  return (
    <AuthShell>
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">
          Create account
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          Book tee times with your golfer profile
        </p>

        {err === "taken" && (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            An account with that email already exists.{" "}
            <Link
              href={loginHref}
              className="font-medium text-fairway underline-offset-4 hover:underline"
            >
              Sign in →
            </Link>
          </p>
        )}
        {err === "unavailable" && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            Something went wrong — please try again.
          </p>
        )}
        {err === "invalid" && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            Please check your details and try again.
          </p>
        )}

        <form
          className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
          action={registerAction}
        >
          {redirectTo ? (
            <input type="hidden" name="redirect" value={redirectTo} />
          ) : null}
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted"
            >
              Name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
            />
          </div>
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
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-medium text-fairway underline-offset-4 hover:underline"
          >
            Sign in →
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
