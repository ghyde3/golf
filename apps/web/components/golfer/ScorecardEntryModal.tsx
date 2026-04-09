"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type HoleRow = {
  holeNumber: number;
  par: number | null;
  score: number | "";
};

type CourseHoleApi = {
  holeNumber: number;
  par: number;
};

interface Props {
  booking: {
    id: string;
    bookingRef: string;
    teeSlot: {
      datetime: string;
      courseName: string;
      clubName: string;
      clubId: string;
      courseId: string;
    };
    holes: number;
  };
  accessToken: string;
  existingScorecard?: { holes: { holeNumber: number; score: number }[] } | null;
  onSaved: () => void;
  trigger: React.ReactNode;
}

export function ScorecardEntryModal({
  booking,
  accessToken,
  existingScorecard,
  onSaved,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loadingHoles, setLoadingHoles] = useState(false);
  const [rows, setRows] = useState<HoleRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const totalScore = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (typeof r.score === "number" && !Number.isNaN(r.score)) {
        return sum + r.score;
      }
      return sum;
    }, 0);
  }, [rows]);

  const loadHoleRows = useCallback(async () => {
    setLoadingHoles(true);
    setInlineError(null);
    const token = accessToken.trim();
    const existingMap = new Map(
      existingScorecard?.holes.map((h) => [h.holeNumber, h.score]) ?? []
    );

    let parByHole = new Map<number, number>();
    try {
      const res = await fetch(
        `${API_URL}/api/clubs/${booking.teeSlot.clubId}/courses/${booking.teeSlot.courseId}/holes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as CourseHoleApi[];
        if (Array.isArray(data) && data.length > 0) {
          parByHole = new Map(
            data.map((h) => [h.holeNumber, h.par])
          );
        }
      }
    } catch {
      parByHole = new Map();
    }

    const next: HoleRow[] = [];
    for (let n = 1; n <= booking.holes; n += 1) {
      next.push({
        holeNumber: n,
        par: parByHole.get(n) ?? null,
        score: existingMap.get(n) ?? "",
      });
    }
    setRows(next);
    setLoadingHoles(false);
  }, [
    accessToken,
    booking.holes,
    booking.teeSlot.clubId,
    booking.teeSlot.courseId,
    existingScorecard,
  ]);

  useEffect(() => {
    if (!open) return;
    void loadHoleRows();
  }, [open, loadHoleRows]);

  function updateScore(holeNumber: number, raw: string) {
    if (raw === "") {
      setRows((prev) =>
        prev.map((r) =>
          r.holeNumber === holeNumber ? { ...r, score: "" } : r
        )
      );
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setRows((prev) =>
      prev.map((r) =>
        r.holeNumber === holeNumber ? { ...r, score: n } : r
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    const token = accessToken.trim();
    if (!token) {
      setInlineError("Sign in to save your scorecard.");
      return;
    }

    const holesPayload: { holeNumber: number; score: number }[] = [];
    for (const r of rows) {
      if (r.score === "" || typeof r.score !== "number") {
        setInlineError("Enter a score for every hole.");
        return;
      }
      holesPayload.push({ holeNumber: r.holeNumber, score: r.score });
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/me/scorecards`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
          holes: holesPayload,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };

      if (res.status === 201) {
        onSaved();
        setOpen(false);
        toast.success("Scorecard saved");
        return;
      }

      if (res.status === 400 && body.code === "ROUND_NOT_YET_PLAYED") {
        setInlineError("This round hasn't been played yet.");
        return;
      }

      setInlineError(
        typeof body.error === "string" ? body.error : "Could not save scorecard."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[85vh] max-w-md overflow-y-auto border-ds-stone bg-warm-white p-5 sm:p-6"
        )}
      >
        <DialogTitle className="pr-8 font-display text-ds-forest">
          Scorecard
        </DialogTitle>
        <p className="text-sm text-ds-muted">
          {booking.teeSlot.courseName}
          <span className="text-ds-stone"> · </span>
          {booking.teeSlot.clubName}
        </p>
        <p className="mt-0.5 font-mono text-xs text-ds-muted">
          {booking.bookingRef}
        </p>

        {loadingHoles ? (
          <p className="mt-4 text-sm text-ds-muted">Loading holes…</p>
        ) : (
          <form className="mt-4" onSubmit={(ev) => void handleSubmit(ev)}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-x-2 gap-y-1 text-sm">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                Hole
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                Par
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-gold">
                Score
              </div>
              {rows.map((r) => (
                <div
                  key={r.holeNumber}
                  className="contents"
                >
                  <div className="flex items-center border-t border-ds-stone/60 py-1.5 font-medium text-ds-ink">
                    {r.holeNumber}
                  </div>
                  <div className="flex items-center border-t border-ds-stone/60 py-1.5 text-ds-ink">
                    {r.par !== null ? r.par : "—"}
                  </div>
                  <div className="border-t border-ds-stone/60 py-1">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      required
                      className="w-full rounded-md border border-ds-stone bg-white px-2 py-1 font-mono text-sm text-ds-ink outline-none focus:ring-2 focus:ring-ds-fairway"
                      value={r.score === "" ? "" : r.score}
                      onChange={(e) =>
                        updateScore(r.holeNumber, e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 font-display text-lg text-ds-forest">
              Total: <span className="tabular-nums">{totalScore}</span>
            </p>

            {inlineError && (
              <p className="mt-2 text-sm text-amber-800" role="alert">
                {inlineError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={submitting || loadingHoles || rows.length === 0}
              >
                {submitting ? "Saving…" : "Save scorecard"}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="border-ds-stone">
                  Cancel
                </Button>
              </DialogClose>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
