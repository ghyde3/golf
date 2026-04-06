import { Router } from "express";
import { publicRateLimit, bookingRateLimit } from "../middleware/rateLimit";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, clubs, clubConfig, teeSlots, bookings, bookingPlayers } from "@teetimes/db";
import { PublicBookingBodySchema } from "@teetimes/validators";
import { generateUniqueBookingRef } from "../lib/bookingRef";
import {
  getCachedAvailability,
  setCachedAvailability,
  invalidateAvailabilityCache,
  type AvailabilityCacheVariant,
} from "../lib/availabilityCache";
import { buildFilteredAvailability } from "../lib/availabilityMerge";
import { enqueueEmail, getEmailQueue } from "../lib/queue";

const router = Router();

router.get("/clubs/public/:slug", publicRateLimit, async (req, res) => {
  try {
    const slug = String(req.params.slug);

    const club = await db.query.clubs.findFirst({
      where: eq(clubs.slug, slug),
      with: {
        courses: true,
        configs: {
          orderBy: [desc(clubConfig.effectiveFrom)],
        },
      },
    });

    if (!club || club.status === "suspended") {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const configs = club.configs;
    const effectiveConfig =
      configs.find((c) => {
        const ef =
          typeof c.effectiveFrom === "string"
            ? c.effectiveFrom
            : (c.effectiveFrom as Date).toISOString().split("T")[0];
        return ef <= today;
      }) ?? configs[0];

    res.json({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      heroImageUrl: club.heroImageUrl,
      primaryColor: effectiveConfig?.primaryColor ?? "#16a34a",
      courses: club.courses.map((c) => ({
        id: c.id,
        name: c.name,
        holes: c.holes,
      })),
      config: effectiveConfig
        ? {
            slotIntervalMinutes: effectiveConfig.slotIntervalMinutes,
            bookingWindowDays: effectiveConfig.bookingWindowDays,
            cancellationHours: effectiveConfig.cancellationHours,
            openTime: effectiveConfig.openTime,
            closeTime: effectiveConfig.closeTime,
            schedule: effectiveConfig.schedule,
            timezone: effectiveConfig.timezone,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching club profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clubs/:clubId/availability", publicRateLimit, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const { date, courseId, players } = req.query;

    if (!date || !courseId) {
      res.status(400).json({ error: "date and courseId are required" });
      return;
    }

    const dateStr = date as string;
    const playersCount = Math.min(4, Math.max(1, Number(players) || 1));
    const fullGrid =
      req.query.full === "1" ||
      req.query.full === "true" ||
      req.query.includeFull === "1";
    const cacheVariant: AvailabilityCacheVariant = fullGrid ? "full" : playersCount;

    const cached = await getCachedAvailability(
      clubId,
      String(courseId),
      dateStr,
      cacheVariant
    );
    if (cached) {
      res.json(cached);
      return;
    }

    let merged;
    try {
      merged = await buildFilteredAvailability(
        clubId,
        String(courseId),
        dateStr,
        playersCount,
        fullGrid
      );
    } catch (e) {
      if ((e as Error).message === "NO_CONFIG") {
        res.status(404).json({ error: "Club config not found" });
        return;
      }
      throw e;
    }

    await setCachedAvailability(
      clubId,
      String(courseId),
      dateStr,
      cacheVariant,
      merged
    );
    res.json(merged);
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/public", bookingRateLimit, async (req, res) => {
  const parsed = PublicBookingBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const body = parsed.data;
  const {
    playersCount,
    guestName,
    guestEmail,
    notes,
    players,
    clubSlug,
    teeSlotId: bodyTeeSlotId,
    courseId,
    datetime,
  } = body;

  try {
    const { booking, updatedSlot, clubIdForCache } = await db.transaction(
      async (tx) => {
        let slotId = bodyTeeSlotId;

        if (!slotId && courseId && datetime) {
          const [newSlot] = await tx
            .insert(teeSlots)
            .values({
              courseId,
              datetime: new Date(datetime),
              maxPlayers: 4,
              bookedPlayers: 0,
              status: "open",
            })
            .returning();
          slotId = newSlot.id;
        }

        if (!slotId) {
          throw new Error("MISSING_SLOT");
        }

        const [updatedSlot] = await tx
          .update(teeSlots)
          .set({
            bookedPlayers: sql`${teeSlots.bookedPlayers} + ${playersCount}`,
          })
          .where(
            and(
              eq(teeSlots.id, slotId),
              sql`${teeSlots.bookedPlayers} + ${playersCount} <= ${teeSlots.maxPlayers}`,
              eq(teeSlots.status, "open")
            )
          )
          .returning();

        if (!updatedSlot) {
          throw new Error("SLOT_FULL");
        }

        const slotWithCourse = await tx.query.teeSlots.findFirst({
          where: eq(teeSlots.id, slotId),
          with: { course: { with: { club: true } } },
        });

        const slug =
          slotWithCourse?.course?.club?.slug ?? clubSlug ?? "club";
        const clubIdForCache = slotWithCourse?.course?.club?.id ?? "";

        const bookingRef = await generateUniqueBookingRef(slug, tx);

        const [booking] = await tx
          .insert(bookings)
          .values({
            bookingRef,
            teeSlotId: slotId,
            guestName,
            guestEmail,
            playersCount,
            notes: notes ?? null,
            status: "confirmed",
            paymentStatus: "unpaid",
          })
          .returning();

        if (players && Array.isArray(players)) {
          for (const p of players) {
            await tx.insert(bookingPlayers).values({
              bookingId: booking.id,
              name: p.name,
              email: p.email ?? null,
            });
          }
        }

        return { booking, updatedSlot, clubIdForCache };
      }
    );

    const dateStr = updatedSlot.datetime.toISOString().split("T")[0];
    if (clubIdForCache) {
      await invalidateAvailabilityCache(
        clubIdForCache,
        updatedSlot.courseId,
        dateStr
      );
    }

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

    res.status(201).json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      teeSlotId: updatedSlot.id,
      playersCount: booking.playersCount,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      notes: booking.notes,
      status: booking.status,
      datetime: updatedSlot.datetime.toISOString(),
    });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "SLOT_FULL") {
      res.status(409).json({ code: "SLOT_FULL", error: "That slot is full" });
      return;
    }
    if (msg === "MISSING_SLOT") {
      res
        .status(400)
        .json({ error: "teeSlotId or (courseId + datetime) required" });
      return;
    }
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
