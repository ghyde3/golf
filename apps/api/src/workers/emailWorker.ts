import * as React from "react";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { render } from "@react-email/render";
import { sendEmail } from "../lib/email";
import { eq, desc, and, isNull } from "drizzle-orm";
import {
  db,
  failedJobs,
  bookings,
  clubConfig,
  waitlistEntries,
  users,
  bookingAddonLines,
  addonCatalog,
} from "@teetimes/db";
import { formatInTimeZone } from "date-fns-tz";
import { BookingConfirmationEmail } from "../emails/BookingConfirmation";
import { BookingReminderEmail } from "../emails/BookingReminder";
import { BookingCancellationEmail } from "../emails/BookingCancellation";
import { WaitlistNotifyEmail } from "../emails/WaitlistNotify";
import { PasswordResetEmail } from "../emails/PasswordReset";

function bullConnection(): Redis {
  return new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

async function sendConfirmationEmail(bookingId: string): Promise<void> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: {
      teeSlot: {
        with: {
          course: { with: { club: true } },
        },
      },
    },
  });

  if (!booking?.teeSlot?.course?.club) return;

  const club = booking.teeSlot.course.club;
  const cfg = await db.query.clubConfig.findFirst({
    where: eq(clubConfig.clubId, club.id),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });
  const tz = cfg?.timezone ?? "America/New_York";
  const whenLabel = `${formatInTimeZone(
    booking.teeSlot.datetime,
    tz,
    "EEE MMM d, h:mm a"
  )} (${tz})`;
  const ref = booking.bookingRef;
  const to = booking.guestEmail ?? "";
  if (!to) return;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const manageUrl = `${baseUrl}/book/${club.slug}`;

  const addonRows = await db
    .select({
      name: addonCatalog.name,
      quantity: bookingAddonLines.quantity,
      unitPriceCents: bookingAddonLines.unitPriceCents,
    })
    .from(bookingAddonLines)
    .innerJoin(addonCatalog, eq(bookingAddonLines.addonCatalogId, addonCatalog.id))
    .where(eq(bookingAddonLines.bookingId, bookingId));

  const addonLines = addonRows.map((r) => ({
    name: r.name,
    quantity: r.quantity,
    lineTotalCents: r.quantity * r.unitPriceCents,
  }));
  const addonsTotalCents = addonLines.reduce((s, l) => s + l.lineTotalCents, 0);

  const html = await render(
    React.createElement(BookingConfirmationEmail, {
      clubName: club.name,
      bookingRef: ref,
      whenLabel,
      playersCount: booking.playersCount,
      notes: booking.notes,
      manageUrl,
      addonLines: addonLines.length > 0 ? addonLines : undefined,
      addonsTotalCents: addonsTotalCents > 0 ? addonsTotalCents : undefined,
    })
  );

  await sendEmail({
    to,
    subject: `Tee time confirmed — ${ref}`,
    html,
  });
}

async function sendWaitlistNotifyEmail(waitlistEntryId: string): Promise<void> {
  const entry = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.id, waitlistEntryId),
    with: {
      teeSlot: {
        with: {
          course: { with: { club: true } },
        },
      },
    },
  });

  if (!entry?.teeSlot?.course?.club) return;
  if (entry.notifiedAt != null) return;
  if (entry.claimedAt != null) return;

  const club = entry.teeSlot.course.club;
  const cfg = await db.query.clubConfig.findFirst({
    where: eq(clubConfig.clubId, club.id),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });
  const tz = cfg?.timezone ?? "America/New_York";
  const whenLabel = `${formatInTimeZone(
    entry.teeSlot.datetime,
    tz,
    "EEE MMM d, h:mm a"
  )} (${tz})`;

  const to = entry.email.trim();
  if (!to) return;

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3001";
  const claimUrl = `${baseUrl.replace(/\/$/, "")}/api/waitlist/claim?token=${entry.token}`;

  const html = await render(
    React.createElement(WaitlistNotifyEmail, {
      clubName: club.name,
      whenLabel,
      claimUrl,
      playersCount: entry.playersCount,
    })
  );

  await sendEmail({
    to,
    subject: `A spot opened — ${club.name}`,
    html,
  });

  if (!process.env.RESEND_API_KEY) {
    return;
  }

  await db
    .update(waitlistEntries)
    .set({ notifiedAt: new Date() })
    .where(
      and(eq(waitlistEntries.id, entry.id), isNull(waitlistEntries.notifiedAt))
    );
}

async function sendPasswordResetEmail(userId: string, token: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) return;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const html = await render(
    React.createElement(PasswordResetEmail, {
      resetUrl,
      userName: user.name ?? undefined,
    })
  );
  await sendEmail({
    to: user.email,
    subject: "Reset your TeeTimes password",
    html,
  });
}

async function sendReminderEmail(bookingId: string): Promise<void> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: {
      teeSlot: {
        with: {
          course: { with: { club: true } },
        },
      },
    },
  });

  if (!booking?.teeSlot?.course?.club) return;

  const club = booking.teeSlot.course.club;
  const cfg = await db.query.clubConfig.findFirst({
    where: eq(clubConfig.clubId, club.id),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });
  const tz = cfg?.timezone ?? "America/New_York";
  const whenLabel = formatInTimeZone(
    booking.teeSlot.datetime,
    tz,
    "EEE MMM d, h:mm a"
  );
  const ref = booking.bookingRef;
  const to = booking.guestEmail ?? "";
  if (!to) return;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const manageUrl = `${baseUrl}/book/${club.slug}`;

  const html = await render(
    React.createElement(BookingReminderEmail, {
      clubName: club.name,
      bookingRef: ref,
      whenLabel,
      manageUrl,
    })
  );

  await sendEmail({
    to,
    subject: `Reminder: ${ref} at ${club.name}`,
    html,
  });
}

async function processJob(
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  if (name === "email:booking-confirmation") {
    await sendConfirmationEmail(String(data.bookingId));
    return;
  }
  if (name === "email:booking-reminder") {
    await sendReminderEmail(String(data.bookingId));
    return;
  }
  if (name === "email:waitlist-notify") {
    await sendWaitlistNotifyEmail(String(data.waitlistEntryId ?? ""));
    return;
  }
  if (name === "email:password-reset") {
    const uid = String(data.userId ?? "");
    const token = String(data.token ?? "");
    if (!uid || !token) return;
    await sendPasswordResetEmail(uid, token);
    return;
  }
  if (name === "email:booking-cancellation") {
    const to = String(data.guestEmail ?? "");
    const clubName = String(data.clubName ?? "the club");
    const whenLabel =
      typeof data.whenLabel === "string" ? data.whenLabel : undefined;
    if (!to) return;
    const html = await render(
      React.createElement(BookingCancellationEmail, {
        clubName,
        whenLabel,
      })
    );
    await sendEmail({
      to,
      subject: "Booking cancelled",
      html,
    });
    return;
  }
  if (name === "email:staff-invite") {
    const to = String(data.email ?? "");
    const token = String(data.token ?? "");
    if (!to || !token) return;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await sendEmail({
      to,
      subject: "You're invited to TeeTimes",
      html: `<p>Set your password: <a href="${baseUrl}/set-password?token=${encodeURIComponent(token)}">Complete setup</a></p>`,
    });
  }
}

export function startEmailWorker(): void {
  if (!process.env.REDIS_URL) {
    console.warn("Email worker disabled: REDIS_URL not set");
    return;
  }

  const connection = bullConnection();
  const worker = new Worker(
    "email",
    async (job) => {
      await processJob(job.name, job.data as Record<string, unknown>);
    },
    { connection, concurrency: 2 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    try {
      await db.insert(failedJobs).values({
        jobName: job.name,
        jobData: job.data as object,
        error: err?.message ?? "unknown error",
      });
    } catch (e) {
      console.error("failed_jobs insert error", e);
    }
  });

  worker.on("completed", () => {});
  worker.on("error", (err) => console.error("email worker error", err));
  console.log("Email worker started");
}
