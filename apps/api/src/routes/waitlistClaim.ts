import type { Request, Response } from "express";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  db,
  waitlistEntries,
  teeSlots,
  bookings,
} from "@teetimes/db";
import { generateUniqueBookingRef } from "../lib/bookingRef";
import { invalidateAvailabilityCache } from "../lib/availabilityCache";
import { enqueueEmail, getEmailQueue } from "../lib/queue";
import { getAuthPayload } from "../lib/auth";

function waitlistErrorHtml(title: string, body: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${esc(
    title
  )}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:2rem;background:#faf9f7;color:#1a1a1a;max-width:28rem;margin-left:auto;margin-right:auto}
h1{font-size:1.25rem;font-weight:600}p{color:#555;line-height:1.5}</style></head><body><h1>${esc(
    title
  )}</h1><p>${esc(body)}</p></body></html>`;
}

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

export async function handleWaitlistClaim(req: Request, res: Response): Promise<void> {
  const tokenRaw = req.query.token;
  const token =
    typeof tokenRaw === "string" && tokenRaw.trim().length > 0
      ? tokenRaw.trim()
      : "";

  if (!token) {
    res
      .status(400)
      .type("html")
      .send(
        waitlistErrorHtml(
          "Invalid link",
          "This waitlist link is missing a token. Please use the link from your email."
        )
      );
    return;
  }

  const entry = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.token, token),
    with: {
      teeSlot: {
        with: {
          course: { with: { club: true } },
        },
      },
    },
  });

  if (!entry?.teeSlot?.course?.club) {
    res
      .status(404)
      .type("html")
      .send(
        waitlistErrorHtml(
          "Link not found",
          "We could not find this waitlist entry. It may have been removed."
        )
      );
    return;
  }

  if (entry.claimedAt != null) {
    res
      .status(409)
      .type("html")
      .send(
        waitlistErrorHtml(
          "Already claimed",
          "This waitlist spot has already been used to complete a booking."
        )
      );
    return;
  }

  if (entry.notifiedAt == null) {
    res
      .status(403)
      .type("html")
      .send(
        waitlistErrorHtml(
          "Not available yet",
          "This link is not active yet. You will receive email when a spot opens for you."
        )
      );
    return;
  }

  if (Date.now() - entry.notifiedAt.getTime() > TWENTY_FOUR_H_MS) {
    res
      .status(410)
      .type("html")
      .send(
        waitlistErrorHtml(
          "This link has expired",
          "Waitlist claim links are valid for 24 hours. Please join the waitlist again if you still need a tee time."
        )
      );
    return;
  }

  const slot = entry.teeSlot;
  const club = slot.course.club;
  const slug = club.slug;
  const playersCount = entry.playersCount;

  const maxP = slot.maxPlayers ?? 4;
  const booked = slot.bookedPlayers ?? 0;
  if ((slot.status ?? "open") !== "open" || booked + playersCount > maxP) {
    res
      .status(409)
      .type("html")
      .send(
        waitlistErrorHtml(
          "Sorry, this slot filled again",
          "The tee time is no longer available for your party size. You can try booking another time from the club page."
        )
      );
    return;
  }

  const authPayload = getAuthPayload(req);
  const publicUserId = authPayload?.userId ?? null;

  try {
    const { booking, updatedSlot } = await db.transaction(async (tx) => {
      const [updatedSlot] = await tx
        .update(teeSlots)
        .set({
          bookedPlayers: sql`${teeSlots.bookedPlayers} + ${playersCount}`,
        })
        .where(
          and(
            eq(teeSlots.id, slot.id),
            sql`${teeSlots.bookedPlayers} + ${playersCount} <= ${teeSlots.maxPlayers}`,
            eq(teeSlots.status, "open")
          )
        )
        .returning();

      if (!updatedSlot) {
        throw new Error("SLOT_FULL_AGAIN");
      }

      const bookingRef = await generateUniqueBookingRef(slug, tx);

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingRef,
          teeSlotId: slot.id,
          userId: publicUserId,
          source: "online_guest",
          guestName: entry.name,
          guestEmail: entry.email,
          playersCount,
          notes: null,
          status: "confirmed",
          paymentStatus: "unpaid",
        })
        .returning();

      await tx
        .update(waitlistEntries)
        .set({ claimedAt: new Date() })
        .where(
          and(eq(waitlistEntries.id, entry.id), isNull(waitlistEntries.claimedAt))
        );

      return { booking, updatedSlot };
    });

    const dateStr = updatedSlot.datetime.toISOString().split("T")[0];
    await invalidateAvailabilityCache(club.id, updatedSlot.courseId, dateStr);

    await enqueueEmail("email:booking-confirmation", {
      bookingId: booking.id,
    });

    const teeTime = updatedSlot.datetime.getTime();
    const reminderAt = teeTime - 24 * 60 * 60 * 1000 - Date.now();
    if (reminderAt > 60 * 60 * 1000) {
      const q = getEmailQueue();
      if (q) {
        await q.add(
          "email:booking-reminder",
          { bookingId: booking.id },
          {
            delay: reminderAt,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true,
          }
        );
      }
    }

    const webBase =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const params = new URLSearchParams({
      bookingRef: booking.bookingRef,
      datetime: updatedSlot.datetime.toISOString(),
      players: String(playersCount),
      slotType: updatedSlot.slotType ?? "18hole",
      guestName: entry.name,
      guestEmail: entry.email,
    });

    res.redirect(302, `${webBase}/book/${slug}/success?${params.toString()}`);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "SLOT_FULL_AGAIN") {
      res
        .status(409)
        .type("html")
        .send(
          waitlistErrorHtml(
            "Sorry, this slot filled again",
            "The tee time is no longer available for your party size. You can try booking another time from the club page."
          )
        );
      return;
    }
    console.error("waitlist claim error:", e);
    res.status(500).type("html").send(
      waitlistErrorHtml(
        "Something went wrong",
        "We could not complete your booking. Please try again or contact the club."
      )
    );
  }
}
