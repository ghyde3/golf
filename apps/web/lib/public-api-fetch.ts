/**
 * Server-side fetch to the Express API. Logs non-OK and network errors so
 * misconfigured API URLs (e.g. missing env on Vercel) show up in server logs.
 */
export async function fetchPublicJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[fetchPublicJson] ${res.status} ${res.statusText}`,
        url,
        body ? body.slice(0, 200) : ""
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("[fetchPublicJson] network error", url, e);
    return null;
  }
}
