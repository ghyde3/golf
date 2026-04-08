"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { WizardStepConfirm } from "./WizardStepConfirm";
import { WizardStepDetails } from "./WizardStepDetails";
import { WizardStepIndicator } from "./WizardStepIndicator";
import { WizardStepType } from "./WizardStepType";
import {
  defaultWizardForm,
  hoursInputToMinutes,
  WINDOW_KEYS,
  type WizardFormData,
} from "./wizard-types";

export type AddItemWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  clubId: string;
  preselectedType?: "rental" | "consumable" | "service" | null;
};

const stepTitle = (step: 1 | 2 | 3): string => {
  if (step === 1) return "Choose type";
  if (step === 2) return "Details";
  return "Confirm";
};

const stepDescription = (step: 1 | 2 | 3): string => {
  if (step === 1) return "Select rental, inventory, or service.";
  if (step === 2) return "Name and configure this resource.";
  return "Review and add to your catalog.";
};

export function AddItemWizard({
  isOpen,
  onClose,
  onCreated,
  clubId,
  preselectedType = null,
}: AddItemWizardProps) {
  const titleId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<
    "rental" | "consumable" | "service" | null
  >(null);
  const [form, setForm] = useState<WizardFormData>(defaultWizardForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(defaultWizardForm());
    setError("");
    setFieldErrors({});
    setSubmitting(false);
    if (preselectedType) {
      setSelectedType(preselectedType);
      setStep(2);
    } else {
      setSelectedType(null);
      setStep(1);
    }
  }, [isOpen, preselectedType]);

  useEffect(() => {
    if (!fieldErrors.name || step !== 2) return;
    const el = document.getElementById("wiz-name");
    el?.focus();
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [fieldErrors.name, step]);

  const patchForm = useCallback((data: Partial<WizardFormData>) => {
    setForm((f) => ({ ...f, ...data }));
    if (data.name !== undefined) {
      setFieldErrors((e) => ({ ...e, name: undefined }));
    }
  }, []);

  const goBack = useCallback(() => {
    setError("");
    setFieldErrors({});
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }, [step]);

  const onSelectType = useCallback((t: "rental" | "consumable" | "service") => {
    setSelectedType(t);
  }, []);

  const onNextFromStep1 = useCallback(() => {
    if (!selectedType) return;
    setStep(2);
  }, [selectedType]);

  const onNextFromStep2 = useCallback(() => {
    if (!form.name.trim()) {
      setFieldErrors({ name: "Name is required" });
      return;
    }
    setFieldErrors({});
    setStep(3);
  }, [form.name]);

  const submit = useCallback(async () => {
    if (!selectedType) return;
    setSubmitting(true);
    setError("");
    try {
      let body: Record<string, unknown>;

      if (selectedType === "rental") {
        const rentalWindows: Record<string, number> = {};
        for (const k of WINDOW_KEYS) {
          rentalWindows[k] = hoursInputToMinutes(form.rentalHours[k] ?? "4.5");
        }
        body = {
          name: form.name.trim(),
          usageModel: "rental",
          trackingMode: form.trackingMode,
          assignmentStrategy:
            form.trackingMode === "pool" ? "none" : form.assignmentStrategy,
          totalUnits: form.trackingMode === "pool" ? form.totalUnits : null,
          rentalWindows,
          turnaroundBufferMinutes: form.turnaroundBufferMinutes,
          notes: form.notes.trim() || null,
          sortOrder: 0,
          active: true,
        };
      } else if (selectedType === "consumable") {
        body = {
          name: form.name.trim(),
          usageModel: "consumable",
          trackingMode: null,
          assignmentStrategy: "none",
          trackInventory: true,
          currentStock: form.startingStock,
          notes: form.notes.trim() || null,
          sortOrder: 0,
          active: true,
        };
      } else {
        body = {
          name: form.name.trim(),
          usageModel: "service",
          trackingMode: null,
          assignmentStrategy: "none",
          notes: form.notes.trim() || null,
          sortOrder: 0,
          active: true,
        };
      }

      const res = await fetch(`/api/clubs/${clubId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ?? "Could not create resource"
        );
        return;
      }

      const created = (await res.json()) as { id: string };

      if (
        selectedType === "rental" &&
        form.trackingMode === "individual" &&
        form.totalUnits > 0
      ) {
        for (let i = 1; i <= form.totalUnits; i++) {
          const ir = await fetch(
            `/api/clubs/${clubId}/resources/${created.id}/items`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                label: `Unit ${i}`,
                operationalStatus: "available",
              }),
            }
          );
          if (!ir.ok) {
            const data = await ir.json().catch(() => ({}));
            setError(
              (data as { error?: string }).error ??
                `Failed creating unit ${i}`
            );
            return;
          }
        }
      }

      toast.success("Added to inventory");
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [clubId, form, onClose, onCreated, selectedType]);

  const type = selectedType;
  const wasPreselected =
    preselectedType !== null && preselectedType !== undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-labelledby={titleId}
        className={cn(
          "max-h-[90vh] max-w-[520px] gap-0 overflow-hidden rounded-2xl border-stone bg-warm-white p-0 shadow-card"
        )}
      >
        <DialogHeader className="space-y-0 border-b border-stone px-5 py-4 text-left sm:px-[22px] sm:py-[17px]">
          <DialogTitle
            id={titleId}
            className="font-display text-[17px] font-normal leading-snug text-ink"
          >
            {stepTitle(step)}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-relaxed text-muted">
            {stepDescription(step)}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-stone bg-cream/50 px-4 py-3.5 sm:px-6">
          <WizardStepIndicator step={step} wasPreselected={wasPreselected} />
        </div>

        <div className="max-h-[min(52vh,480px)] overflow-y-auto px-5 py-5 sm:px-[22px]">
          {step === 1 ? (
            <WizardStepType selected={selectedType} onSelect={onSelectType} />
          ) : null}

          {step === 2 && type ? (
            <WizardStepDetails
              type={type}
              formData={form}
              onChange={patchForm}
              onChangeType={() => setStep(1)}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {step === 3 && type ? (
            <WizardStepConfirm type={type} formData={form} />
          ) : null}

          {error && step === 3 ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone bg-warm-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-[22px]">
          <div className="flex flex-wrap gap-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted hover:text-ink"
                onClick={goBack}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-stone bg-white"
              onClick={onClose}
            >
              Cancel
            </Button>
            {step === 1 ? (
              <Button
                type="button"
                className="min-w-[100px] bg-fairway hover:bg-fairway/90"
                disabled={!selectedType}
                onClick={onNextFromStep1}
              >
                Next
              </Button>
            ) : null}
            {step === 2 ? (
              <Button
                type="button"
                className="min-w-[100px] bg-fairway hover:bg-fairway/90"
                onClick={onNextFromStep2}
              >
                Next
              </Button>
            ) : null}
            {step === 3 ? (
              <Button
                type="button"
                className="min-w-[100px] bg-fairway hover:bg-fairway/90"
                disabled={submitting}
                onClick={() => void submit()}
              >
                {submitting ? "Saving…" : "Add to inventory"}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
