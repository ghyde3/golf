"use client";

import { useState } from "react";
import { SetTopBar } from "@/components/club/ClubTopBarContext";

export type StaffRow = {
  id: string;
  name: string | null;
  email: string;
  role: "staff" | "club_admin";
  pending: boolean;
};

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "club_admin";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        isAdmin
          ? "bg-amber-100 text-amber-700"
          : "bg-fairway/10 text-fairway"
      }`}
    >
      {isAdmin ? "Admin" : "Staff"}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-stone px-2 py-0.5 text-xs font-semibold text-muted">
      Pending invite
    </span>
  );
}

export function StaffClient({
  clubId,
  staff: initial,
}: {
  clubId: string;
  staff: StaffRow[];
}) {
  const [staff, setStaff] = useState<StaffRow[]>(initial);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "club_admin">("staff");
  const [inviteError, setInviteError] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setInviteSaving(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/staff/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInviteError(
          (data as { error?: string }).error ?? "Failed to send invite"
        );
        return;
      }
      const data = (await res.json()) as { ok: boolean; existing: boolean };
      setInviteSuccess(
        data.existing
          ? `${inviteEmail} already has an account and has been given ${inviteRole} access.`
          : `Invite sent to ${inviteEmail}.`
      );
      const newMember: StaffRow = {
        id: crypto.randomUUID(),
        name: null,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        pending: !data.existing,
      };
      setStaff((prev) => {
        const exists = prev.some(
          (s) => s.email === newMember.email && s.role === newMember.role
        );
        return exists ? prev : [...prev, newMember];
      });
      setInviteEmail("");
      setInviteRole("staff");
      setShowInvite(false);
    } finally {
      setInviteSaving(false);
    }
  }

  return (
    <>
      <SetTopBar title="Staff" />
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl text-ink">Staff</h2>
            <p className="mt-1 text-sm text-muted">
              Manage who has access to this club&apos;s management panel.
            </p>
          </div>
          <button
            onClick={() => {
              setShowInvite(true);
              setInviteError("");
              setInviteSuccess("");
            }}
            className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 focus:outline-none focus:ring-2 focus:ring-fairway/50"
          >
            Invite staff
          </button>
        </div>

        {inviteSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {inviteSuccess}
          </div>
        )}

        {/* Invite form */}
        {showInvite && (
          <div className="rounded-xl border border-stone bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-display text-base text-ink">Invite a team member</h3>
            <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-stone px-3 py-2 text-sm text-ink placeholder-muted focus:border-fairway focus:outline-none focus:ring-1 focus:ring-fairway"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Role
                </label>
                <div className="flex gap-2">
                  {(["staff", "club_admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                        inviteRole === r
                          ? "border-fairway bg-fairway text-white"
                          : "border-stone bg-white text-ink hover:border-fairway/50"
                      }`}
                    >
                      {r === "club_admin" ? "Admin" : "Staff"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={inviteSaving || !inviteEmail.trim()}
                  className="rounded-lg bg-fairway px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-fairway/90 disabled:opacity-50"
                >
                  {inviteSaving ? "Sending…" : "Send invite"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvite(false);
                    setInviteError("");
                    setInviteEmail("");
                    setInviteRole("staff");
                  }}
                  className="rounded-lg border border-stone px-4 py-2 text-sm font-semibold text-ink hover:bg-cream/50"
                >
                  Cancel
                </button>
              </div>
            </form>
            {inviteError && (
              <p className="mt-2 text-sm text-red-600">{inviteError}</p>
            )}
          </div>
        )}

        {/* Staff table */}
        <div className="flex min-h-0 flex-col rounded-xl border border-stone bg-white shadow-sm">
          <div className="border-b border-stone px-4 py-3">
            <h3 className="font-display text-lg text-ink">Team members</h3>
          </div>
          {staff.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No staff members yet. Invite someone above.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_110px] border-b border-stone bg-cream/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-stone">
                {staff.map((s) => (
                  <div
                    key={`${s.id}-${s.role}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_110px] items-center px-4 py-3"
                  >
                    <span className="truncate text-sm font-medium text-ink">
                      {s.name?.trim() || (
                        <span className="text-muted italic">No name yet</span>
                      )}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {s.email}
                    </span>
                    <RoleBadge role={s.role} />
                    <div>
                      {s.pending ? <PendingBadge /> : (
                        <span className="text-xs text-muted">Active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
