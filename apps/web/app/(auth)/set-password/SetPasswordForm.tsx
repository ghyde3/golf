"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function SetPasswordForm({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not set password"
        );
        setPending(false);
        return;
      }
      setMessage("Password saved. You can sign in.");
    } catch {
      setError("Network error");
    }
    setPending(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white text-center mb-1">
          Set password
        </h1>
        <p className="text-slate-400 text-sm text-center mb-8">
          Complete your staff account setup
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="token"
              className="block text-xs text-slate-400 mb-1"
            >
              Invite token
            </label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs text-slate-400 mb-1"
            >
              New password (min 8 characters)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          {message && (
            <p className="text-emerald-400 text-sm text-center">{message}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save password"}
          </button>
        </form>

        <p className="text-slate-500 text-xs text-center mt-8">
          <Link href="/login" className="underline hover:text-slate-400">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
