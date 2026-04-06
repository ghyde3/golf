"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function groupTimezones(): { label: string; zones: string[] }[] {
  const zones = Intl.supportedValuesOf("timeZone");
  const map = new Map<string, string[]>();
  for (const z of zones) {
    const i = z.indexOf("/");
    const key = i === -1 ? "Other" : z.slice(0, i);
    const list = map.get(key) ?? [];
    list.push(z);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, zs]) => ({
      label,
      zones: zs.sort((x, y) => x.localeCompare(y)),
    }));
}

export function CreateClubForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [slug, setSlug] = useState("");

  const groups = useMemo(() => groupTimezones(), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const slugVal = String(fd.get("slug") ?? "").trim().toLowerCase();
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      slug: slugVal,
      timezone: String(fd.get("timezone") ?? "America/New_York"),
      description: String(fd.get("description") ?? "").trim() || undefined,
    };

    if (!/^[a-z0-9-]+$/.test(slugVal)) {
      setError("Slug: lowercase letters, numbers, and hyphens only.");
      setPending(false);
      return;
    }

    const res = await fetch("/api/platform/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setPending(false);
    if (!res.ok) {
      setError(
        typeof data.error === "string" ? data.error : "Could not create club."
      );
      return;
    }
    if (data.id) {
      router.push(`/platform/clubs/${data.id}`);
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="max-w-md space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
    >
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Club name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          className="w-full rounded-[10px] border-[1.5px] border-stone bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-grass"
        />
      </div>
      <div>
        <label
          htmlFor="slug"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          URL slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9-]+"
          title="Lowercase letters, numbers, hyphens only"
          placeholder="e.g. pinebrook"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          className="w-full rounded-[10px] border-[1.5px] border-stone bg-white px-3.5 py-3 text-sm font-mono text-ink outline-none focus:border-grass"
        />
        <p className="mt-1 text-sm text-muted">
          Public URL: teetimes.com/book/
          <span className="font-mono text-fairway">{slug || "…"}</span>
        </p>
      </div>
      <div>
        <label
          htmlFor="timezone"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          required
          defaultValue="America/New_York"
          className="w-full rounded-[10px] border-[1.5px] border-stone bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-grass"
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.zones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Description <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className="min-h-[80px] w-full resize-y rounded-[10px] border-[1.5px] border-stone bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-grass"
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-fairway text-white hover:bg-fairway/90"
      >
        {pending ? "Creating…" : "Create club"}
      </Button>
    </form>
  );
}
