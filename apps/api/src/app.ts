import express from "express";
import cors from "cors";
import { db } from "@teetimes/db";
import { clubs, clubConfig, teeSlots, bookings, bookingPlayers } from "@teetimes/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { resolveConfig, resolveHours } from "./lib/configResolver";
import { generateSlots } from "./lib/slotGenerator";
import { generateBookingRef } from "./lib/bookingRef";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/clubs/public/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

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
    const effectiveConfig = club.configs.find(
      (c) => c.effectiveFrom <= today
    ) ?? club.configs[0];

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

// Availability endpoint (public)
app.get("/api/clubs/:clubId/availability", async (req, res) => {
  try {
    const { clubId } = req.params;
    const { date, courseId, players } = req.query;

    if (!date || !courseId) {
      res.status(400).json({ error: "date and courseId are required" });
      return;
    }

    const dateStr = date as string;
    const playersCount = Number(players) || 1;

    const configs = await db.query.clubConfig.findMany({
      where: eq(clubConfig.clubId, clubId),
      orderBy: [desc(clubConfig.effectiveFrom)],
    });

    if (configs.length === 0) {
      res.status(404).json({ error: "Club config not found" });
      return;
    }

    const targetDate = new Date(dateStr + "T12:00:00Z");
    const config = resolveConfig(
      configs.map((c) => ({
        ...c,
        slotIntervalMinutes: c.slotIntervalMinutes,
        openTime: c.openTime,
        closeTime: c.closeTime,
        schedule: c.schedule,
        timezone: c.timezone,
      })),
      targetDate
    );

    const dayOfWeek = targetDate.getUTCDay();
    const hours = resolveHours(config, dayOfWeek);

    const generatedSlots = generateSlots(
      {
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        slotIntervalMinutes: config.slotIntervalMinutes ?? 10,
        timezone: config.timezone ?? "America/New_York",
      },
      dateStr
    );

    const startOfDay = new Date(dateStr + "T00:00:00Z");
    const endOfDay = new Date(dateStr + "T23:59:59Z");

    const dbSlots = await db.query.teeSlots.findMany({
      where: and(
        eq(teeSlots.courseId, courseId as string),
        gte(teeSlots.datetime, startOfDay),
        lte(teeSlots.datetime, endOfDay)
      ),
    });

    const dbSlotMap = new Map(
      dbSlots.map((s) => [s.datetime.toISOString(), s])
    );

    const now = new Date();
    const merged = generatedSlots
      .map((slot) => {
        const key = slot.datetime.toISOString();
        const dbSlot = dbSlotMap.get(key);
        if (dbSlot) {
          return {
            id: dbSlot.id,
            datetime: dbSlot.datetime.toISOString(),
            maxPlayers: dbSlot.maxPlayers ?? 4,
            bookedPlayers: dbSlot.bookedPlayers ?? 0,
            status: dbSlot.status ?? "open",
            price: dbSlot.price ? Number(dbSlot.price) : null,
            slotType: dbSlot.slotType ?? "18hole",
          };
        }
        return {
          id: null,
          datetime: slot.datetime.toISOString(),
          maxPlayers: slot.maxPlayers,
          bookedPlayers: slot.bookedPlayers,
          status: slot.status,
          price: slot.price,
          slotType: slot.slotType,
        };
      })
      .filter(
        (s) =>
          s.status === "open" &&
          s.maxPlayers - s.bookedPlayers >= playersCount &&
          new Date(s.datetime) > now
      );

    res.json(merged);
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public booking endpoint
app.post("/api/bookings/public", async (req, res) => {
  try {
    const { teeSlotId, playersCount, guestName, guestEmail, notes, courseId, datetime, clubSlug } = req.body;

    if (!playersCount || !guestName || !guestEmail) {
      res.status(400).json({ error: "playersCount, guestName, and guestEmail are required" });
      return;
    }

    let slotId = teeSlotId;

    // If no existing tee_slot, create one (slot was generated in-memory)
    if (!slotId && courseId && datetime) {
      const [newSlot] = await db
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
      res.status(400).json({ error: "teeSlotId or (courseId + datetime) required" });
      return;
    }

    // Atomic update: increment booked_players
    const [updatedSlot] = await db
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
      res.status(409).json({ code: "SLOT_FULL", error: "That slot is full" });
      return;
    }

    const slug = clubSlug || "club";
    const bookingRef = generateBookingRef(slug);

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingRef,
        teeSlotId: slotId,
        guestName,
        guestEmail,
        playersCount,
        notes: notes || null,
        status: "confirmed",
        paymentStatus: "unpaid",
      })
      .returning();

    // Insert booking players
    if (req.body.players && Array.isArray(req.body.players)) {
      for (const p of req.body.players) {
        await db.insert(bookingPlayers).values({
          bookingId: booking.id,
          name: p.name,
          email: p.email || null,
        });
      }
    }

    res.status(201).json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      teeSlotId: slotId,
      playersCount: booking.playersCount,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      notes: booking.notes,
      status: booking.status,
      datetime: updatedSlot.datetime.toISOString(),
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
