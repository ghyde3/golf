import * as React from "react";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { eq, desc } from "drizzle-orm";
import { db, failedJobs, bookings, clubConfig } from "@teetimes/db";
import { formatInTimeZone } from "date-fns-tz";
import { BookingConfirmationEmail } from "../emails/BookingConfirmation";
import { BookingReminderEmail } from "../emails/BookingReminder";
import { BookingCancellationEmail } from "../emails/BookingCancellation";

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

  const html = await render(
    React.createElement(BookingConfirmationEmail, {
      clubName: club.name,
      bookingRef: ref,
      whenLabel,
      playersCount: booking.playersCount,
      notes: booking.notes,
      manageUrl,
    })
  );

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email] skip send (no RESEND_API_KEY)", { to, ref });
    return;
  }

  const resend = new Resend(key);
  const from = process.env.RESEND_FROM || "TeeTimes <onboarding@resend.dev>";
  await resend.emails.send({
    from,
    to,
    subject: `Tee time confirmed — ${ref}`,
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

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email] skip reminder (no RESEND_API_KEY)", { to, ref });
    return;
  }

  const resend = new Resend(key);
  const from = process.env.RESEND_FROM || "TeeTimes <onboarding@resend.dev>";
  await resend.emails.send({
    from,
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
  if (name === "email:booking-cancellation") {
    const to = String(data.guestEmail ?? "");
    const clubName = String(data.clubName ?? "the club");
    const whenLabel =
      typeof data.whenLabel === "string" ? data.whenLabel : undefined;
    if (!to) return;
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.info("[email] skip cancellation (no RESEND_API_KEY)", { to });
      return;
    }
    const html = await render(
      React.createElement(BookingCancellationEmail, {
        clubName,
        whenLabel,
      })
    );
    const resend = new Resend(key);
    const from = process.env.RESEND_FROM || "TeeTimes <onboarding@resend.dev>";
    await resend.emails.send({
      from,
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
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.info("[email] skip invite (no RESEND_API_KEY)", { to });
      return;
    }
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resend = new Resend(key);
    const from = process.env.RESEND_FROM || "TeeTimes <onboarding@resend.dev>";
    await resend.emails.send({
      from,
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
