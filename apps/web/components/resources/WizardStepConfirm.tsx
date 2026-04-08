"use client";

import { cn } from "@/lib/utils";
import type { WizardFormData } from "./wizard-types";
import { WINDOW_KEYS } from "./wizard-types";

export type WizardStepConfirmProps = {
  type: "rental" | "consumable" | "service";
  formData: WizardFormData;
};

function dot(type: WizardStepConfirmProps["type"]): string {
  if (type === "rental") return "bg-fairway";
  if (type === "consumable") return "bg-gold";
  return "bg-[color:var(--service-accent)]";
}

function typeLabel(type: WizardStepConfirmProps["type"]): string {
  if (type === "rental") return "Rental";
  if (type === "consumable") return "Inventory";
  return "Service";
}

const HOLE_LABELS: Record<(typeof WINDOW_KEYS)[number], string> = {
  "9hole": "9-hole",
  "18hole": "18-hole",
  "27hole": "27-hole",
  "36hole": "36-hole",
  default: "Default",
};

export function WizardStepConfirm({ type, formData }: WizardStepConfirmProps) {
  const infoRows: { label: string; value: string }[] = [];

  if (type === "rental") {
    infoRows.push(
      {
        label: "Mode",
        value:
          formData.trackingMode === "pool"
            ? "Pool"
            : "Individual",
      },
      ...(formData.trackingMode === "individual"
        ? [
            {
              label: "Assignment",
              value:
                formData.assignmentStrategy === "auto" ? "Auto" : "Manual",
            },
          ]
        : []),
      {
        label:
          formData.trackingMode === "pool" ? "Total units" : "Units to create",
        value: String(formData.totalUnits),
      },
      {
        label: "Turnaround",
        value: `${formData.turnaroundBufferMinutes} min`,
      }
    );
  } else if (type === "consumable") {
    infoRows.push({
      label: "Starting stock",
      value: String(formData.startingStock),
    });
  } else {
    infoRows.push({
      label: "Availability",
      value:
        formData.serviceAvailability === "always"
          ? "Always available"
          : "Manual",
    });
  }

  infoRows.push({
    label: "Notes",
    value: formData.notes.trim() || "—",
  });

  let note = "";
  if (type === "rental" && formData.trackingMode === "individual") {
    note = `${formData.totalUnits} unit records will be created automatically (Unit 1 through Unit ${formData.totalUnits}). You can rename individual units and set their maintenance status after adding.`;
  } else if (type === "rental" && formData.trackingMode === "pool") {
    note =
      "Pool items track total count. You can add individual maintenance holds from the item detail panel.";
  } else if (type === "consumable") {
    note =
      "This item will appear in your Inventory section. Staff will see a low-stock alert when stock is low.";
  } else {
    note =
      "Availability is managed manually. Staff can adjust this service from the detail panel.";
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[11px] border border-stone bg-cream px-[15px] py-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", dot(type))} />
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            {typeLabel(type)}
          </span>
        </div>
        <p className="font-display text-[17px] leading-snug text-ink">
          {formData.name.trim() || "—"}
        </p>

        {type === "rental" ? (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              Rental windows (hours)
            </p>
            <div className="overflow-x-auto rounded-lg border border-stone bg-white">
              <table className="w-full min-w-[300px] border-collapse text-center text-[12px]">
                <thead>
                  <tr className="border-b border-stone bg-cream">
                    {WINDOW_KEYS.map((k) => (
                      <th
                        key={k}
                        className="whitespace-nowrap px-1.5 py-2 font-semibold text-muted"
                      >
                        {HOLE_LABELS[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {WINDOW_KEYS.map((k) => (
                      <td
                        key={k}
                        className="border-t border-stone px-1.5 py-2 font-medium tabular-nums text-ink"
                      >
                        {formData.rentalHours[k] ?? "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {formData.syncRentalWindows ? (
              <p className="mt-2 text-[10px] text-muted">
                Same duration applied to all round lengths.
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-4 space-y-0 text-xs">
          {infoRows.map((r) => (
            <div
              key={r.label}
              className="flex justify-between gap-3 border-b border-stone py-2 last:border-b-0"
            >
              <dt className="text-muted">{r.label}</dt>
              <dd className="max-w-[58%] text-right font-medium text-ink">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-lg border border-stone bg-white px-2.5 py-2.5 text-[11px] leading-relaxed text-muted">
        {note}
      </div>
    </div>
  );
}
