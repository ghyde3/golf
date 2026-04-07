/** Base URL for the Express API (public booking + discovery). */
export function publicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}
