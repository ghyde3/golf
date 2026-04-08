"use client";

import { cn } from "@/lib/utils";
import { Car, Package, Wrench } from "lucide-react";

export type WizardStepTypeProps = {
  selected: "rental" | "consumable" | "service" | null;
  onSelect: (type: "rental" | "consumable" | "service") => void;
};

const tiles: {
  id: "rental" | "consumable" | "service";
  icon: typeof Car;
  title: string;
  body: string;
  selClass: string;
  iconWell: string;
}[] = [
  {
    id: "rental",
    icon: Car,
    title: "Rental",
    body: "Equipment you rent out — carts, clubs, pull carts",
    selClass: "border-fairway bg-[var(--rental-tint)]",
    iconWell: "bg-[var(--rental-tint)] text-fairway",
  },
  {
    id: "consumable",
    icon: Package,
    title: "Inventory",
    body: "Stock items that get used — balls, water, scorecards",
    selClass: "border-gold bg-[var(--inventory-tint)]",
    iconWell: "bg-[var(--inventory-tint)] text-[color:var(--tag-gold-fg)]",
  },
  {
    id: "service",
    icon: Wrench,
    title: "Service",
    body: "Things your team provides — cleaning, caddies, lessons",
    selClass: "border-[color:var(--service-accent)] bg-[var(--service-tint)]",
    iconWell: "bg-[var(--service-tint)] text-[color:var(--service-accent)]",
  },
];

export function WizardStepType({ selected, onSelect }: WizardStepTypeProps) {
  return (
    <div>
      <p className="mb-[18px] text-[13px] leading-relaxed text-muted">
        Pick what you&apos;re adding. You can fine-tune details on the next step.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          const isSel = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "rounded-xl border-2 px-3 py-4 text-center transition-colors duration-150",
                isSel
                  ? t.selClass
                  : "border-stone bg-white hover:border-grass"
              )}
            >
              <span
                className={cn(
                  "mx-auto mb-2.5 flex h-[38px] w-[38px] items-center justify-center rounded-[10px]",
                  isSel ? t.iconWell : "border border-stone/50 bg-white text-ink"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <p className="text-[13px] font-semibold text-ink">{t.title}</p>
              <p className="mt-1 text-[11px] leading-normal text-muted">
                {t.body}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
