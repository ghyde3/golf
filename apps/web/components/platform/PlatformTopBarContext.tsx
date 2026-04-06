"use client";

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlatformBackLink = { href: string; label: string };

type PlatformTopBarContextValue = {
  title: string;
  setTitle: (t: string) => void;
  actions: ReactNode;
  setActions: (n: ReactNode) => void;
  backLink: PlatformBackLink | null;
  setBackLink: (b: PlatformBackLink | null) => void;
};

const PlatformTopBarContext = createContext<PlatformTopBarContextValue | null>(
  null
);

export function PlatformTopBarProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("Dashboard");
  const [actions, setActions] = useState<ReactNode>(null);
  const [backLink, setBackLink] = useState<PlatformBackLink | null>(null);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      actions,
      setActions,
      backLink,
      setBackLink,
    }),
    [title, actions, backLink]
  );

  return (
    <PlatformTopBarContext.Provider value={value}>
      {children}
    </PlatformTopBarContext.Provider>
  );
}

export function usePlatformTopBar() {
  const ctx = useContext(PlatformTopBarContext);
  if (!ctx) {
    throw new Error(
      "usePlatformTopBar must be used within PlatformTopBarProvider"
    );
  }
  return ctx;
}

export function SetPlatformTopBar({
  title,
  actions,
  backLink,
}: {
  title: string;
  actions?: ReactNode;
  backLink?: PlatformBackLink | null;
}) {
  const { setTitle, setActions, setBackLink } = usePlatformTopBar();
  const stableActions = actions ?? null;
  const stableBack = backLink ?? null;

  useEffect(() => {
    setTitle(title);
    setActions(stableActions);
    setBackLink(stableBack);
    return () => {
      setTitle("Dashboard");
      setActions(null);
      setBackLink(null);
    };
  }, [title, stableActions, stableBack, setTitle, setActions, setBackLink]);

  return null;
}
