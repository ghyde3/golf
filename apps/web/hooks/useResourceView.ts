"use client";

import { useCallback, useEffect, useState } from "react";

export type ResourceViewMode = "grouped" | "flat" | "list";

const STORAGE_PREFIX = "teetimes:resources:view:";

function readStored(clubId: string): ResourceViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${clubId}`);
    if (raw === "grouped" || raw === "flat" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function useResourceView(clubId: string): {
  view: ResourceViewMode;
  setView: (v: ResourceViewMode) => void;
} {
  const [view, setViewState] = useState<ResourceViewMode>("grouped");

  useEffect(() => {
    setViewState(readStored(clubId) ?? "grouped");
  }, [clubId]);

  const setView = useCallback(
    (v: ResourceViewMode) => {
      setViewState(v);
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${clubId}`, v);
      } catch {
        /* ignore */
      }
    },
    [clubId]
  );

  return { view, setView };
}
