"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="text-sm text-slate-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
