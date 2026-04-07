"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

export function StripeSettingsClient({
  initialSettings,
  loadFailed,
}: {
  initialSettings: Record<string, unknown>;
  loadFailed?: boolean;
}) {
  const [publishable, setPublishable] = useState(
    str(initialSettings["stripe.publishableKey"])
  );
  const [secret, setSecret] = useState(str(initialSettings["stripe.secretKey"]));
  const [webhookSecret, setWebhookSecret] = useState(
    str(initialSettings["stripe.webhookSecret"])
  );
  const [testMode, setTestMode] = useState(
    bool(initialSettings["stripe.testMode"])
  );
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const entries: [string, unknown][] = [
        ["stripe.publishableKey", publishable],
        ["stripe.secretKey", secret],
        ["stripe.webhookSecret", webhookSecret],
        ["stripe.testMode", testMode],
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
        const data = (await failed.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "Failed to save");
        return;
      }
      toast.success("Stripe settings saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SetPlatformTopBar
        title="Stripe"
        backLink={{ href: "/platform/billing", label: "← Billing" }}
      />
      <div className="p-6">
        {loadFailed && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Could not load settings. You can still edit and save.
          </p>
        )}
        <p className="mb-5 text-sm text-muted">
          Store Stripe API keys in platform settings. Keys are only shown here
          after load if already saved.
        </p>

        <form
          className="max-w-lg space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <label
              htmlFor="pk"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Stripe publishable key
            </label>
            <Input
              id="pk"
              value={publishable}
              onChange={(e) => setPublishable(e.target.value)}
              autoComplete="off"
              placeholder="pk_live_… or pk_test_…"
            />
          </div>

          <div>
            <label
              htmlFor="sk"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Stripe secret key
            </label>
            <div className="relative">
              <Input
                id="sk"
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
                className="pr-10"
                placeholder="sk_live_… or sk_test_…"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-stone/60"
                onClick={() => setShowSecret((s) => !s)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="wh"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Webhook signing secret
            </label>
            <div className="relative">
              <Input
                id="wh"
                type={showWebhook ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="off"
                className="pr-10"
                placeholder="whsec_…"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-stone/60"
                onClick={() => setShowWebhook((s) => !s)}
                aria-label={showWebhook ? "Hide webhook secret" : "Show webhook secret"}
              >
                {showWebhook ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone text-fairway focus:ring-fairway"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
            />
            Test mode (Stripe test keys)
          </label>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>

        <div className="mt-8 max-w-lg space-y-3 rounded-xl border border-stone bg-cream/40 p-6">
          <h2 className="font-display text-lg text-ink">Webhook status</h2>
          <p className="text-sm text-muted">
            Register this endpoint in the Stripe Dashboard (Developers →
            Webhooks) so invoice events update local records.
          </p>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Endpoint URL
            </p>
            <code className="mt-1 block break-all rounded-md border border-stone bg-white px-3 py-2 font-mono text-xs text-ink">
              https://[your-domain]/api/stripe/webhook
            </code>
          </div>
          <p className="text-sm text-muted">
            Use the signing secret from that webhook destination in the field
            above. For local development, use the Stripe CLI to forward events.
          </p>
        </div>
      </div>
    </>
  );
}
