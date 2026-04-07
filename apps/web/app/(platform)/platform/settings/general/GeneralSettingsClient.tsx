"use client";

import { toast } from "sonner";
import { useState } from "react";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function GeneralSettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, unknown>;
}) {
  const [name, setName] = useState(str(initialSettings["platform.name"]));
  const [supportEmail, setSupportEmail] = useState(
    str(initialSettings["platform.supportEmail"])
  );
  const [timezone, setTimezone] = useState(str(initialSettings["platform.timezone"]));
  const [logoUrl, setLogoUrl] = useState(str(initialSettings["platform.logoUrl"]));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const entries: [string, unknown][] = [
        ["platform.name", name],
        ["platform.supportEmail", supportEmail],
        ["platform.timezone", timezone],
        ["platform.logoUrl", logoUrl],
      ];
      const results = await Promise.all(
        entries.map(([key, value]) =>
          fetch(`/api/platform/settings/${encodeURIComponent(key)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          })
        )
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = (await failed.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Failed to save settings");
        return;
      }
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SetPlatformTopBar
        title="General"
        backLink={{ href: "/platform/settings", label: "← Settings" }}
      />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Platform name, logo, support email, and default timezone.
        </p>
        <form
          className="max-w-md space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <label
              htmlFor="platform-name"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Platform name
            </label>
            <Input
              id="platform-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div>
            <label
              htmlFor="support-email"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Support email
            </label>
            <Input
              id="support-email"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label
              htmlFor="platform-tz"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Default timezone
            </label>
            <Input
              id="platform-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. America/New_York"
            />
          </div>
          <div>
            <label
              htmlFor="logo-url"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Logo URL
            </label>
            <Input
              id="logo-url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <Button type="submit" disabled={saving} className="bg-fairway text-white hover:bg-fairway/90">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </div>
    </>
  );
}
