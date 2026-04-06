"use client";

export function LogoutButton() {
  function logout() {
    const callback = encodeURIComponent("/login");
    window.location.href = `/api/auth/signout?callbackUrl=${callback}`;
  }

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="text-sm text-slate-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
