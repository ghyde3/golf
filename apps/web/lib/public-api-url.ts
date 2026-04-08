/**
 * Base URL for the Express API (public booking + discovery).
 * Prefer `API_URL` on the server (Vercel) so SSR works when only the server
 * env is set; use `NEXT_PUBLIC_API_URL` for the same value so client bundles
 * and SSR both resolve correctly.
 */
export function publicApiUrl(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}
