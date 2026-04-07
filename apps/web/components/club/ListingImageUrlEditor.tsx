"use client";

import { useState } from "react";

type Props = {
  /** PATCH endpoint (e.g. `/api/clubs/:id/profile` or `/api/platform/clubs/:id`) */
  patchUrl: string;
  initialHeroImageUrl: string | null;
  /** Shown in label; default mentions search listing */
  label?: string;
  onSaved?: (url: string | null) => void;
};

export function ListingImageUrlEditor({
  patchUrl,
  initialHeroImageUrl,
  label = "Course image (search listing)",
  onSaved,
}: Props) {
  const [value, setValue] = useState(initialHeroImageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const trimmed = value.trim();
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroImageUrl: trimmed.length === 0 ? null : trimmed,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          typeof data.error === "string" ? data.error : "Could not save image URL."
        );
        return;
      }
      setSuccess("Saved.");
      onSaved?.(trimmed.length === 0 ? null : trimmed);
    } finally {
      setSaving(false);
    }
  }

  const preview = value.trim();

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-3">
      <div>
        <label
          htmlFor="hero-image-url"
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          {label}
        </label>
        <p className="mb-2 text-xs text-muted">
          Paste an image URL, or a site path such as{" "}
          <span className="font-mono text-ink">/pinebrook.png</span> for files in the web
          app public folder.
        </p>
        <input
          id="hero-image-url"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSuccess("");
            setError("");
          }}
          placeholder="https://… or /your-image.png"
          className="w-full rounded-lg border border-stone px-3 py-2 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
        />
      </div>
      {preview ? (
        <div className="overflow-hidden rounded-lg border border-stone bg-cream/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URL or same-origin path */}
          <img
            src={preview}
            alt=""
            className="h-32 w-full object-cover"
            onError={() => {}}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save image URL"}
      </button>
    </form>
  );
}
