"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function PlatformClubStatusButton({
  clubId,
  clubName,
  status,
  onStatusChange,
  size = "default",
}: {
  clubId: string;
  clubName: string;
  status: string;
  onStatusChange: (next: string) => void;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const suspended = status === "suspended";

  async function patch(next: "active" | "suspended") {
    setPending(true);
    const prev = status;
    onStatusChange(next);
    const res = await fetch(`/api/platform/clubs/${clubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(false);
    if (!res.ok) {
      onStatusChange(prev);
      toast.error("Could not update club status.");
      return;
    }
    router.refresh();
  }

  const sm = size === "sm";

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {clubName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately blocks all public bookings for this club.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-600"
              onClick={() => {
                setConfirmOpen(false);
                void patch("suspended");
              }}
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {suspended ? (
        <Button
          type="button"
          variant="secondary"
          size={sm ? "sm" : "default"}
          className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
          disabled={pending}
          onClick={() => void patch("active")}
        >
          {pending ? "Updating…" : "Activate"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size={sm ? "sm" : "default"}
          className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          {pending ? "Updating…" : "Suspend"}
        </Button>
      )}
    </>
  );
}
