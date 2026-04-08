"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

function StepNum({
  n,
  label,
  done,
  active,
}: {
  n: 1 | 2 | 3;
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={cn(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          done && !active && "border-fairway bg-fairway text-white",
          active &&
            "border-fairway bg-fairway text-white shadow-[0_0_0_3px_rgba(45,90,61,0.12)]",
          !done && !active && "border-stone bg-cream text-muted"
        )}
      >
        {done && !active ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
      </div>
      <span
        className={cn(
          "hidden truncate text-[11px] font-semibold sm:inline",
          (done || active) && "text-fairway",
          !done && !active && "text-muted"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div
      className={cn(
        "mx-1 h-px min-w-[12px] flex-1 sm:mx-2",
        done ? "bg-fairway" : "bg-stone"
      )}
      aria-hidden
    />
  );
}

export function WizardStepIndicator({
  step,
  wasPreselected,
}: {
  step: 1 | 2 | 3;
  wasPreselected: boolean;
}) {
  const step1Done = step > 1 || (wasPreselected && step >= 2);
  const step2Done = step > 2;
  const step3Done = step > 3;

  return (
    <div className="flex items-center">
      <StepNum
        n={1}
        label="Type"
        done={step1Done}
        active={step === 1}
      />
      <Connector done={step >= 2 || (wasPreselected && step >= 2)} />
      <StepNum
        n={2}
        label="Details"
        done={step2Done}
        active={step === 2}
      />
      <Connector done={step >= 3} />
      <StepNum
        n={3}
        label="Confirm"
        done={step3Done}
        active={step === 3}
      />
    </div>
  );
}
