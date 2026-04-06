"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ClubTopBarContextValue = {
  title: string;
  setTitle: (t: string) => void;
  actions: ReactNode;
  setActions: (n: ReactNode) => void;
};

const ClubTopBarContext = createContext<ClubTopBarContextValue | null>(null);

export function ClubTopBarProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("Dashboard");
  const [actions, setActions] = useState<ReactNode>(null);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      actions,
      setActions,
    }),
    [title, actions]
  );

  return (
    <ClubTopBarContext.Provider value={value}>
      {children}
    </ClubTopBarContext.Provider>
  );
}

export function useClubTopBar() {
  const ctx = useContext(ClubTopBarContext);
  if (!ctx) {
    throw new Error("useClubTopBar must be used within ClubTopBarProvider");
  }
  return ctx;
}

export function SetTopBar({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  const { setTitle, setActions } = useClubTopBar();
  const stableActions = actions ?? null;

  useEffect(() => {
    setTitle(title);
    setActions(stableActions);
    return () => {
      setTitle("Dashboard");
      setActions(null);
    };
  }, [title, stableActions, setTitle, setActions]);

  return null;
}
