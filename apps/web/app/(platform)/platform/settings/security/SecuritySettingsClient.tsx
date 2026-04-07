"use client";

import { toast } from "sonner";
import { useState } from "react";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function SecuritySettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, unknown>;
}) {
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() =>
    String(num(initialSettings["security.sessionTimeoutMinutes"], 60))
  );
  const [allowedDomains, setAllowedDomains] = useState(
    str(initialSettings["security.allowedDomains"])
  );
  const [minPasswordLength, setMinPasswordLength] = useState(() =>
    String(num(initialSettings["security.minPasswordLength"], 8))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const sessionN = Number.parseInt(sessionTimeoutMinutes, 10);
      const passN = Number.parseInt(minPasswordLength, 10);
      const entries: [string, unknown][] = [
        [
          "security.sessionTimeoutMinutes",
          Number.isFinite(sessionN) ? sessionN : 60,
        ],
        ["security.allowedDomains", allowedDomains],
        ["security.minPasswordLength", Number.isFinite(passN) ? passN : 8],
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
        title="Security"
        backLink={{ href: "/platform/settings", label: "← Settings" }}
      />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Session timeout, allowed email domains, and password policy.
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
              htmlFor="session-timeout"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Session timeout (minutes)
            </label>
            <Input
              id="session-timeout"
              type="number"
              min={1}
              value={sessionTimeoutMinutes}
              onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="allowed-domains"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Allowed email domains
            </label>
            <Input
              id="allowed-domains"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              placeholder="golf.com, example.com"
            />
            <p className="mt-1 text-xs text-muted">Comma-separated domain names.</p>
          </div>
          <div>
            <label
              htmlFor="min-password"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Minimum password length
            </label>
            <Input
              id="min-password"
              type="number"
              min={6}
              max={128}
              value={minPasswordLength}
              onChange={(e) => setMinPasswordLength(e.target.value)}
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
