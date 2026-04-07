"use client";

import { SetPlatformTopBar } from "@/components/platform/PlatformTopBarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type PlatformUserRow = {
  id: string;
  name: string | null;
  email: string;
  status: "active" | "suspended";
  roles: { role: string; clubId: string | null; clubName: string | null }[];
  createdAt: string;
};

function roleBadgeClass(role: string) {
  switch (role) {
    case "platform_admin":
      return "bg-amber-100 text-amber-900";
    case "club_admin":
      return "bg-blue-100 text-blue-800";
    case "staff":
      return "bg-stone-200 text-stone-700";
    case "golfer":
      return "bg-green-100 text-green-800";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

function roleLabel(
  r: PlatformUserRow["roles"][number]
): string {
  const base = r.role.replace(/_/g, " ");
  if (r.role === "platform_admin") return "Platform admin";
  if (r.clubName) return `${base} · ${r.clubName}`;
  return base;
}

export function UsersClient({
  initialUsers,
  initialPage,
  initialLimit,
  initialTotal,
}: {
  initialUsers: PlatformUserRow[];
  initialPage: number;
  initialLimit: number;
  initialTotal: number;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [total, setTotal] = useState(initialTotal);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const skipFirstFetch = useRef(true);
  const prevDebouncedRef = useRef(debouncedSearch);
  const lastRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = useCallback(async (pageToUse: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(pageToUse),
        limit: String(limit),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/platform/users?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to load users");
        return;
      }
      const body = data as {
        users: PlatformUserRow[];
        page: number;
        total: number;
      };
      setUsers(body.users ?? []);
      setTotal(body.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [limit, debouncedSearch]);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      prevDebouncedRef.current = debouncedSearch;
      lastRequestKeyRef.current = `${debouncedSearch}|${page}`;
      return;
    }

    const searchChanged = prevDebouncedRef.current !== debouncedSearch;
    prevDebouncedRef.current = debouncedSearch;
    const pageToUse = searchChanged ? 1 : page;
    if (searchChanged && page !== 1) {
      setPage(1);
    }

    const key = `${debouncedSearch}|${pageToUse}`;
    if (lastRequestKeyRef.current === key) {
      return;
    }
    lastRequestKeyRef.current = key;
    void fetchUsers(pageToUse);
  }, [debouncedSearch, page, limit, fetchUsers]);

  async function patchUser(userId: string, body: Record<string, unknown>) {
    setError("");
    setNotice("");
    setActionUserId(userId);
    try {
      const res = await fetch(`/api/platform/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Update failed");
        return;
      }
      await fetchUsers(page);
    } finally {
      setActionUserId(null);
    }
  }

  async function resetPassword(userId: string) {
    setError("");
    setNotice("");
    setActionUserId(userId);
    try {
      const res = await fetch(
        `/api/platform/users/${encodeURIComponent(userId)}/reset-password`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Reset failed");
        return;
      }
      setNotice(
        `Stub: ${(data as { message?: string }).message ?? "OK"} (token: ${(data as { token?: string }).token ?? ""})`
      );
      await fetchUsers(page);
    } finally {
      setActionUserId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showPagination = total > limit;

  return (
    <>
      <SetPlatformTopBar
        title="Users"
        backLink={{ href: "/platform", label: "← Dashboard" }}
      />
      <div className="p-6">
        <p className="mb-5 text-sm text-muted">
          Manage all platform users
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4 rounded-lg border border-stone bg-cream px-4 py-2 text-sm text-ink">
            {notice}
          </div>
        ) : null}

        <div className="mb-4 max-w-md">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Search
          </label>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="max-w-md"
          />
          {loading ? (
            <p className="mt-2 text-xs text-muted">Loading…</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-stone bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-stone bg-cream/50 text-left text-[10px] font-bold uppercase tracking-widest text-muted">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-stone/80">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-ink">
                          {u.name ?? "—"}
                        </div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-ink">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            u.roles.map((r) => (
                              <span
                                key={`${u.id}-${r.role}-${r.clubId ?? "none"}`}
                                className={cn(
                                  "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                                  roleBadgeClass(r.role)
                                )}
                              >
                                {roleLabel(r)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                            u.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          )}
                        >
                          {u.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <details className="relative inline-block text-left">
                          <summary
                            className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-stone bg-warm-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream [&::-webkit-details-marker]:hidden"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            Actions
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                          </summary>
                          <div className="absolute right-0 z-20 mt-1 min-w-[220px] rounded-lg border border-stone bg-white py-1 shadow-lg">
                            {u.status === "active" ? (
                              <button
                                type="button"
                                disabled={actionUserId === u.id}
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-50"
                                onClick={() => {
                                  void patchUser(u.id, { status: "suspended" });
                                }}
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={actionUserId === u.id}
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-50"
                                onClick={() => {
                                  void patchUser(u.id, { status: "active" });
                                }}
                              >
                                Reactivate
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={actionUserId === u.id}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-50"
                              onClick={() => {
                                void patchUser(u.id, {
                                  role: "platform_admin",
                                });
                              }}
                            >
                              Promote to Platform Admin
                            </button>
                            <button
                              type="button"
                              disabled={actionUserId === u.id}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-cream disabled:opacity-50"
                              onClick={() => {
                                void resetPassword(u.id);
                              }}
                            >
                              Reset Password
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {showPagination ? (
            <div className="flex items-center justify-between gap-4 border-t border-stone px-4 py-3 text-sm text-muted">
              <span>
                Page {page} of {totalPages} ({total} users)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() =>
                    setPage((p) => (p < totalPages ? p + 1 : p))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
