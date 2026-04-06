"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";

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
    <AuthShell>
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-2xl text-ink">
          Set password
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          Complete your staff account setup
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-8 space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="token"
              className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted"
            >
              Invite token
            </label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted"
            >
              New password (min 8 characters)
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-center text-sm text-red-700">{error}</p>
          )}
          {message && (
            <p className="text-center text-sm text-fairway">{message}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>

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
