"use client";

import { toast } from "sonner";
import { useState } from "react";
import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const fieldClass =
  "min-h-[80px] w-full resize-y rounded-md border border-stone bg-warm-white px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function EmailSettingsClient({
  initialSettings,
}: {
  initialSettings: Record<string, unknown>;
}) {
  const [bookingConfirmationSubject, setBookingConfirmationSubject] = useState(
    str(initialSettings["email.bookingConfirmationSubject"])
  );
  const [bookingConfirmationBody, setBookingConfirmationBody] = useState(
    str(initialSettings["email.bookingConfirmationBody"])
  );
  const [cancellationSubject, setCancellationSubject] = useState(
    str(initialSettings["email.cancellationSubject"])
  );
  const [cancellationBody, setCancellationBody] = useState(
    str(initialSettings["email.cancellationBody"])
  );
  const [reminderSubject, setReminderSubject] = useState(
    str(initialSettings["email.reminderSubject"])
  );
  const [reminderBody, setReminderBody] = useState(
    str(initialSettings["email.reminderBody"])
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const entries: [string, unknown][] = [
        ["email.bookingConfirmationSubject", bookingConfirmationSubject],
        ["email.bookingConfirmationBody", bookingConfirmationBody],
        ["email.cancellationSubject", cancellationSubject],
        ["email.cancellationBody", cancellationBody],
        ["email.reminderSubject", reminderSubject],
        ["email.reminderBody", reminderBody],
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
        toast.error(data.error ?? "Failed to save templates");
        return;
      }
      toast.success("Templates saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SetPlatformTopBar
        title="Email"
        backLink={{ href: "/platform/settings", label: "← Settings" }}
      />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Booking confirmation, cancellation, and reminder email templates.
        </p>
        <form
          className="max-w-2xl space-y-4 rounded-xl border border-stone bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <label
              htmlFor="bc-subject"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Booking confirmation subject
            </label>
            <Input
              id="bc-subject"
              value={bookingConfirmationSubject}
              onChange={(e) => setBookingConfirmationSubject(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="bc-body"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Booking confirmation body
            </label>
            <textarea
              id="bc-body"
              rows={6}
              className={fieldClass}
              value={bookingConfirmationBody}
              onChange={(e) => setBookingConfirmationBody(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="cx-subject"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Cancellation subject
            </label>
            <Input
              id="cx-subject"
              value={cancellationSubject}
              onChange={(e) => setCancellationSubject(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="cx-body"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Cancellation body
            </label>
            <textarea
              id="cx-body"
              rows={6}
              className={fieldClass}
              value={cancellationBody}
              onChange={(e) => setCancellationBody(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="rem-subject"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Reminder subject
            </label>
            <Input
              id="rem-subject"
              value={reminderSubject}
              onChange={(e) => setReminderSubject(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="rem-body"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted"
            >
              Reminder body
            </label>
            <textarea
              id="rem-body"
              rows={4}
              className={fieldClass}
              value={reminderBody}
              onChange={(e) => setReminderBody(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving} className="bg-fairway text-white hover:bg-fairway/90">
            {saving ? "Saving…" : "Save templates"}
          </Button>
        </form>
      </div>
    </>
  );
}
