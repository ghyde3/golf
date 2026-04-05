import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = searchParams.next?.startsWith("/") ? searchParams.next : "/";
  const err = searchParams.error;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white text-center mb-1">
          TeeTimes
        </h1>
        <p className="text-slate-400 text-center text-sm mb-8">
          Sign in to the admin console
        </p>

        {err === "forbidden" && (
          <p className="text-amber-400 text-sm text-center mb-4">
            You do not have access to that area.
          </p>
        )}
        {err === "config" && (
          <p className="text-red-400 text-sm text-center mb-4">
            Server misconfiguration: set JWT_SECRET or NEXTAUTH_SECRET.
          </p>
        )}

        <form
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
          action={loginAction}
        >
          <div>
            <label htmlFor="email" className="block text-xs text-slate-400 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs text-slate-400 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <input type="hidden" name="next" value={next} readOnly />
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            Sign in
          </button>
        </form>

        {err === "auth" && (
          <p className="text-red-400 text-sm text-center mt-4">
            Invalid email or password.
          </p>
        )}

        <p className="text-slate-500 text-xs text-center mt-8">
          <Link href="/" className="underline hover:text-slate-400">
            Back to public site
          </Link>
        </p>
      </div>
    </main>
  );
}
