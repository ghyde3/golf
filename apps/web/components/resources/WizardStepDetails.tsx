"use client";

import { cn } from "@/lib/utils";
import { Car, Package, Wrench } from "lucide-react";
import type { WizardFormData } from "./wizard-types";
import { WINDOW_KEYS } from "./wizard-types";

export type WizardStepDetailsProps = {
  type: "rental" | "consumable" | "service";
  formData: WizardFormData;
  onChange: (data: Partial<WizardFormData>) => void;
  onChangeType: () => void;
  fieldErrors?: { name?: string };
};

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted";

const inputCls =
  "w-full rounded-lg border-[1.5px] border-stone bg-white px-[11px] py-[9px] text-[13px] text-ink outline-none transition placeholder:text-muted/70 focus:border-grass focus:ring-0 focus-visible:ring-2 focus-visible:ring-grass/25";

const inputErrorCls =
  "border-red-400 focus:border-red-500 focus-visible:ring-red-200";

const sectionGap = "mt-8 first:mt-0";

type Accent = "rental" | "inventory" | "service";

function RadioTile({
  selected,
  onSelect,
  accent,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  accent: Accent;
  children: React.ReactNode;
}) {
  const sel =
    accent === "rental"
      ? "border-fairway bg-[var(--rental-tint)] text-fairway"
      : accent === "inventory"
        ? "border-gold bg-[var(--inventory-tint)] text-[color:var(--tag-gold-fg)]"
        : "border-[color:var(--service-accent)] bg-[var(--service-tint)] text-[color:var(--service-accent)]";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex-1 rounded-[7px] border-[1.5px] px-2.5 py-2 text-center text-xs font-medium transition",
        selected ? sel : "border-stone bg-white text-muted hover:border-stone"
      )}
    >
      {children}
    </button>
  );
}

function RentalModeCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col rounded-xl border-2 px-3 py-3 text-left transition sm:min-h-[100px]",
        selected
          ? "border-fairway bg-[var(--rental-tint)]"
          : "border-stone bg-white hover:border-grass"
      )}
    >
      <span
        className={cn(
          "text-[13px] font-semibold",
          selected ? "text-fairway" : "text-ink"
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "mt-1.5 text-[11px] leading-snug",
          selected ? "text-fairway/90" : "text-muted"
        )}
      >
        {description}
      </span>
    </button>
  );
}

function AssignmentModeCard({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col rounded-xl border-2 px-3 py-3 text-left transition sm:min-h-[88px]",
        selected
          ? "border-fairway bg-[var(--rental-tint)]"
          : "border-stone bg-white hover:border-grass"
      )}
    >
      <span
        className={cn(
          "text-[13px] font-semibold",
          selected ? "text-fairway" : "text-ink"
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "mt-1.5 text-[11px] leading-snug",
          selected ? "text-fairway/90" : "text-muted"
        )}
      >
        {description}
      </span>
    </button>
  );
}

const HOLE_LABELS: Record<(typeof WINDOW_KEYS)[number], string> = {
  "9hole": "9h",
  "18hole": "18h",
  "27hole": "27h",
  "36hole": "36h",
  default: "Default",
};

export function WizardStepDetails({
  type,
  formData,
  onChange,
  onChangeType,
  fieldErrors,
}: WizardStepDetailsProps) {
  const chipIcon =
    type === "rental" ? (
      <Car className="h-[15px] w-[15px]" strokeWidth={2} />
    ) : type === "consumable" ? (
      <Package className="h-[15px] w-[15px]" strokeWidth={2} />
    ) : (
      <Wrench className="h-[15px] w-[15px]" strokeWidth={2} />
    );
  const chipLabel =
    type === "rental" ? "Rental" : type === "consumable" ? "Inventory" : "Service";

  const chipWrap =
    type === "rental"
      ? "border-fairway/30 bg-[var(--rental-tint)]"
      : type === "consumable"
        ? "border-gold/35 bg-[var(--inventory-tint)]"
        : "border-[color:var(--service-accent)]/35 bg-[var(--service-tint)]";

  const nameErr = fieldErrors?.name;

  const setAllRentalHours = (value: string) => {
    const next: Record<string, string> = {};
    for (const k of WINDOW_KEYS) next[k] = value;
    onChange({ rentalHours: next });
  };

  const syncDefaultChange = (value: string) => {
    setAllRentalHours(value);
  };

  return (
    <div className="flex flex-col">
      {/* Type banner — always on step 2 */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-[10px] border-[1.5px] px-3.5 py-2.5",
          chipWrap
        )}
      >
        <span
          className={cn(
            "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg",
            type === "rental" && "bg-white/80 text-fairway",
            type === "consumable" &&
              "bg-white/80 text-[color:var(--tag-gold-fg)]",
            type === "service" &&
              "bg-white/80 text-[color:var(--service-accent)]"
          )}
        >
          {chipIcon}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            Type
          </p>
          <p className="text-[13px] font-semibold text-ink">{chipLabel}</p>
        </div>
        <button
          type="button"
          onClick={onChangeType}
          className="shrink-0 text-[11px] font-medium text-muted underline decoration-transparent underline-offset-2 transition hover:text-ink hover:decoration-muted"
        >
          Change
        </button>
      </div>

      {/* Name */}
      <div className={sectionGap}>
        <label className={labelCls} htmlFor="wiz-name">
          Name
        </label>
        <input
          id="wiz-name"
          required
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn(inputCls, nameErr && inputErrorCls)}
          placeholder="e.g. Cart fleet"
          aria-invalid={nameErr ? true : undefined}
          aria-describedby={nameErr ? "wiz-name-error" : undefined}
        />
        {nameErr ? (
          <p id="wiz-name-error" className="mt-1.5 text-xs font-medium text-red-700">
            {nameErr}
          </p>
        ) : null}
      </div>

      {type === "rental" ? (
        <>
          <div className={sectionGap}>
            <p className={labelCls}>Rental mode</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <RentalModeCard
                selected={formData.trackingMode === "pool"}
                onSelect={() => onChange({ trackingMode: "pool" })}
                title="Pool"
                description="One shared fleet count. Use maintenance holds for downtime—no separate unit records."
              />
              <RentalModeCard
                selected={formData.trackingMode === "individual"}
                onSelect={() => onChange({ trackingMode: "individual" })}
                title="Individual"
                description="Each item is a tracked unit (Unit 1, Unit 2…) with its own available or maintenance status."
              />
            </div>
          </div>

          {formData.trackingMode === "individual" ? (
            <div className={sectionGap}>
              <p className={labelCls}>Assignment</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <AssignmentModeCard
                  selected={formData.assignmentStrategy === "auto"}
                  onSelect={() => onChange({ assignmentStrategy: "auto" })}
                  title="Auto"
                  description="System picks an available unit when the booking is placed."
                />
                <AssignmentModeCard
                  selected={formData.assignmentStrategy === "manual"}
                  onSelect={() => onChange({ assignmentStrategy: "manual" })}
                  title="Manual"
                  description="Staff assigns a specific unit at check-in or handoff."
                />
              </div>
            </div>
          ) : null}

          <div className={sectionGap}>
            <label className={labelCls} htmlFor="wiz-units">
              {formData.trackingMode === "pool"
                ? "Total units"
                : "Units to create"}
            </label>
            <input
              id="wiz-units"
              type="number"
              min={1}
              required
              value={formData.totalUnits}
              onChange={(e) =>
                onChange({ totalUnits: Number(e.target.value) || 1 })
              }
              className={inputCls}
            />
            {formData.trackingMode === "individual" ? (
              <p className="mt-1.5 text-[10px] leading-snug text-muted">
                Creates labeled units (Unit 1 … Unit N) after the resource is
                saved.
              </p>
            ) : null}
          </div>

          <div className={sectionGap}>
            <p className={labelCls}>Rental duration (hours)</p>
            <p className="mb-3 text-[11px] leading-relaxed text-muted">
              How long a booking typically reserves this equipment. Used for
              scheduling windows by round length.
            </p>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-stone/80 bg-cream/50 px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone text-fairway focus:ring-fairway"
                checked={formData.syncRentalWindows}
                onChange={(e) => {
                  const sync = e.target.checked;
                  if (sync) {
                    const v = formData.rentalHours.default ?? "4.5";
                    const next: Record<string, string> = {};
                    for (const k of WINDOW_KEYS) next[k] = v;
                    onChange({ syncRentalWindows: true, rentalHours: next });
                  } else {
                    onChange({ syncRentalWindows: false });
                  }
                }}
              />
              <span>
                <span className="text-[13px] font-medium text-ink">
                  Same duration for all round lengths
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                  Recommended unless you need different hours for 9 vs 18 holes,
                  etc.
                </span>
              </span>
            </label>

            {formData.syncRentalWindows ? (
              <div className="mt-4">
                <label className={labelCls} htmlFor="wiz-hours-sync">
                  Hours
                </label>
                <input
                  id="wiz-hours-sync"
                  type="text"
                  inputMode="decimal"
                  value={formData.rentalHours.default ?? ""}
                  onChange={(e) => syncDefaultChange(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 4.5"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-stone bg-white">
                <table className="w-full min-w-[340px] border-collapse text-center text-[12px]">
                  <thead>
                    <tr className="border-b border-stone bg-cream">
                      {WINDOW_KEYS.map((k) => (
                        <th
                          key={k}
                          className="px-1.5 py-2 font-semibold text-muted"
                        >
                          {HOLE_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {WINDOW_KEYS.map((k) => (
                        <td key={k} className="border-stone p-1.5 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.rentalHours[k] ?? ""}
                            onChange={(e) =>
                              onChange({
                                rentalHours: {
                                  ...formData.rentalHours,
                                  [k]: e.target.value,
                                },
                              })
                            }
                            className="w-full min-w-0 rounded border border-stone px-1 py-1.5 text-center text-[13px] text-ink focus:border-grass focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={sectionGap}>
            <label className={labelCls} htmlFor="wiz-turn">
              Turnaround buffer (minutes)
            </label>
            <p className="mb-2 text-[11px] leading-relaxed text-muted">
              Buffer between consecutive rentals (prep, return, cleaning).
            </p>
            <input
              id="wiz-turn"
              type="number"
              min={0}
              value={formData.turnaroundBufferMinutes}
              onChange={(e) =>
                onChange({
                  turnaroundBufferMinutes: Number(e.target.value) || 0,
                })
              }
              className={inputCls}
            />
          </div>
        </>
      ) : null}

      {type === "consumable" ? (
        <div className={sectionGap}>
          <label className={labelCls} htmlFor="wiz-stock">
            Starting stock
          </label>
          <input
            id="wiz-stock"
            type="number"
            min={0}
            required
            value={formData.startingStock}
            onChange={(e) =>
              onChange({ startingStock: Number(e.target.value) || 0 })
            }
            className={inputCls}
          />
          <p className="mt-2 text-[10px] leading-snug text-muted">
            Low-stock highlighting uses a default threshold until the API
            supports per-item restock levels.
          </p>
        </div>
      ) : null}

      {type === "service" ? (
        <div className={sectionGap}>
          <p className={labelCls}>Availability</p>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            How golfers see this service when booking or asking staff.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ serviceAvailability: "manual" })}
              className={cn(
                "flex flex-col rounded-xl border-2 px-3 py-3 text-left sm:min-h-[88px]",
                formData.serviceAvailability === "manual"
                  ? "border-[color:var(--service-accent)] bg-[var(--service-tint)]"
                  : "border-stone bg-white hover:border-grass"
              )}
            >
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  formData.serviceAvailability === "manual"
                    ? "text-[color:var(--service-accent)]"
                    : "text-ink"
                )}
              >
                Manual
              </span>
              <span className="mt-1.5 text-[11px] leading-snug text-muted">
                Turn on or off from the resource detail panel as needed.
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ serviceAvailability: "always" })}
              className={cn(
                "flex flex-col rounded-xl border-2 px-3 py-3 text-left sm:min-h-[88px]",
                formData.serviceAvailability === "always"
                  ? "border-[color:var(--service-accent)] bg-[var(--service-tint)]"
                  : "border-stone bg-white hover:border-grass"
              )}
            >
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  formData.serviceAvailability === "always"
                    ? "text-[color:var(--service-accent)]"
                    : "text-ink"
                )}
              >
                Always available
              </span>
              <span className="mt-1.5 text-[11px] leading-snug text-muted">
                Listed as available whenever the club offers it.
              </span>
            </button>
          </div>
        </div>
      ) : null}

      <div className={sectionGap}>
        <label className={labelCls} htmlFor="wiz-notes">
          Notes
        </label>
        <textarea
          id="wiz-notes"
          value={formData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
          className={cn(inputCls, "resize-y")}
          placeholder="Optional"
        />
      </div>
    </div>
  );
}
