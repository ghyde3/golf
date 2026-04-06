"use client";

export function LogoutButton() {
  function logout() {
    const callback = encodeURIComponent("/login?signedOut=1");
    window.location.href = `/api/auth/signout?callbackUrl=${callback}`;
  }

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="text-sm text-white/40 transition-colors hover:text-white/70"
    >
      Sign out
    </button>
  );
}
