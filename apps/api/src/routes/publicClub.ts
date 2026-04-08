import { Router } from "express";
import Stripe from "stripe";
import { publicRateLimit, bookingRateLimit } from "../middleware/rateLimit";
import {
  eq,
  desc,
  asc,
  sql,
  and,
  or,
  exists,
  inArray,
  isNull,
  lt,
  lte,
  type SQL,
} from "drizzle-orm";
import {
  db,
  clubs,
  clubConfig,
  courses,
  teeSlots,
  bookings,
  bookingPlayers,
  clubTagDefinitions,
  clubTagAssignments,
  platformSettings,
  waitlistEntries,
} from "@teetimes/db";
import { clubPublicSearchSql } from "../lib/searchQuery";
import { JoinWaitlistSchema, PublicBookingBodySchema } from "@teetimes/validators";
import { generateUniqueBookingRef } from "../lib/bookingRef";
import {
  getCachedAvailability,
  setCachedAvailability,
  invalidateAvailabilityCache,
  type AvailabilityCacheVariant,
} from "../lib/availabilityCache";
import { buildFilteredAvailability } from "../lib/availabilityMerge";
import { enqueueEmail, getEmailQueue } from "../lib/queue";
import { getAuthPayload } from "../lib/auth";
import {
  checkAndInsertAddons,
  AddOnUnavailableError,
  restoreAddonResourcesForBooking,
} from "../lib/bookingAddons";

const router = Router();

async function waitlistQueuePosition(
  teeSlotId: string,
  createdAt: Date,
  entryId: string
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.teeSlotId, teeSlotId),
        isNull(waitlistEntries.notifiedAt),
        or(
          lt(waitlistEntries.createdAt, createdAt),
          and(
            eq(waitlistEntries.createdAt, createdAt),
            lte(waitlistEntries.id, entryId)
          )
        )
      )
    );
  return Number(row?.n ?? 0);
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

async function resolveClubForPublicBooking(body: {
  clubSlug?: string;
  courseId?: string;
}) {
  if (body.clubSlug) {
    return db.query.clubs.findFirst({ where: eq(clubs.slug, body.clubSlug) });
  }
  if (body.courseId) {
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, body.courseId),
      with: { club: true },
    });
    return course?.club ?? null;
  }
  return null;
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number | null,
  lng2: number | null
): number {
  if (lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

router.get("/clubs/public", publicRateLimit, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const qRaw = req.query.q;
    const q =
      typeof qRaw === "string" && qRaw.trim().length > 0 ? qRaw.trim() : "";
    const sortRaw = req.query.sort;
    const sortNew = sortRaw === "new";

    const tagRaw = req.query.tag;
    const tagSlug =
      typeof tagRaw === "string" && tagRaw.trim().length > 0
        ? tagRaw.trim()
        : "";

    const nearLatRaw = req.query.near_lat;
    const nearLngRaw = req.query.near_lng;
    let nearLat: number | null = null;
    let nearLng: number | null = null;
    if (typeof nearLatRaw === "string" && typeof nearLngRaw === "string") {
      const la = Number.parseFloat(nearLatRaw);
      const ln = Number.parseFloat(nearLngRaw);
      if (!Number.isNaN(la) && !Number.isNaN(ln)) {
        nearLat = la;
        nearLng = ln;
      }
    }

    const statusOk: SQL = sql`(${clubs.status} IS NULL OR ${clubs.status} <> 'suspended')`;
    const filters: SQL[] = [statusOk];

    const textSearch = clubPublicSearchSql(q);
    if (textSearch) {
      filters.push(textSearch);
    }

    if (tagSlug) {
      filters.push(
        exists(
          db
            .select({ id: clubTagAssignments.clubId })
            .from(clubTagAssignments)
            .innerJoin(
              clubTagDefinitions,
              eq(clubTagAssignments.tagId, clubTagDefinitions.id)
            )
            .where(
              and(
                eq(clubTagAssignments.clubId, clubs.id),
                eq(clubTagDefinitions.slug, tagSlug),
                eq(clubTagDefinitions.active, true)
              )
            )
        )
      );
    }

    const whereClause = and(...filters);

    const rows = await db.query.clubs.findMany({
      where: whereClause,
      with: { courses: true },
      orderBy: sortNew ? [desc(clubs.createdAt)] : [asc(clubs.name)],
    });

    type Row = (typeof rows)[number];
    const ordered: Row[] = [...rows];
    if (nearLat != null && nearLng != null) {
      ordered.sort((a, b) => {
        const da = haversineMiles(
          nearLat!,
          nearLng!,
          a.latitude,
          a.longitude
        );
        const db = haversineMiles(
          nearLat!,
          nearLng!,
          b.latitude,
          b.longitude
        );
        return da - db;
      });
    }

    const total = ordered.length;
    const page = ordered.slice(offset, offset + limit);

    const pageIds = page.map((c) => c.id);
    const tagsByClubId = new Map<
      string,
      { slug: string; label: string }[]
    >();
    if (pageIds.length > 0) {
      const tagRows = await db
        .select({
          clubId: clubTagAssignments.clubId,
          slug: clubTagDefinitions.slug,
          label: clubTagDefinitions.label,
          sortOrder: clubTagDefinitions.sortOrder,
        })
        .from(clubTagAssignments)
        .innerJoin(
          clubTagDefinitions,
          eq(clubTagAssignments.tagId, clubTagDefinitions.id)
        )
        .where(
          and(
            inArray(clubTagAssignments.clubId, pageIds),
            eq(clubTagDefinitions.active, true)
          )
        )
        .orderBy(asc(clubTagDefinitions.sortOrder), asc(clubTagDefinitions.slug));
      for (const r of tagRows) {
        const list = tagsByClubId.get(r.clubId) ?? [];
        list.push({ slug: r.slug, label: r.label });
        tagsByClubId.set(r.clubId, list);
      }
    }

    res.json({
      clubs: page.map((c) => {
        const courseList = c.courses ?? [];
        const coursesCount = courseList.length;
        const maxHoles =
          coursesCount === 0
            ? 0
            : Math.max(...courseList.map((x) => x.holes));
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          heroImageUrl: c.heroImageUrl,
          city: c.city,
          state: c.state,
          latitude: c.latitude,
          longitude: c.longitude,
          coursesCount,
          maxHoles,
          createdAt: c.createdAt?.toISOString() ?? null,
          tags: tagsByClubId.get(c.id) ?? [],
        };
      }),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error listing public clubs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clubs/public/tags", publicRateLimit, async (_req, res) => {
  try {
    const rows = await db
      .select({
        slug: clubTagDefinitions.slug,
        label: clubTagDefinitions.label,
        groupName: clubTagDefinitions.groupName,
        sortOrder: clubTagDefinitions.sortOrder,
      })
      .from(clubTagDefinitions)
      .where(eq(clubTagDefinitions.active, true))
      .orderBy(asc(clubTagDefinitions.sortOrder), asc(clubTagDefinitions.slug));
    res.json({
      tags: rows.map((t) => ({
        slug: t.slug,
        label: t.label,
        groupName: t.groupName,
        sortOrder: t.sortOrder,
      })),
    });
  } catch (e) {
    console.error("Public tag catalog:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

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

    const tagRows = await db
      .select({
        slug: clubTagDefinitions.slug,
        label: clubTagDefinitions.label,
      })
      .from(clubTagAssignments)
      .innerJoin(
        clubTagDefinitions,
        eq(clubTagAssignments.tagId, clubTagDefinitions.id)
      )
      .where(
        and(
          eq(clubTagAssignments.clubId, club.id),
          eq(clubTagDefinitions.active, true)
        )
      )
      .orderBy(asc(clubTagDefinitions.sortOrder), asc(clubTagDefinitions.slug));

    const waitlistFlagRow = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "features.waitlist"),
    });
    const waitlistEnabled = waitlistFlagRow?.value === true;

    res.json({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      heroImageUrl: club.heroImageUrl,
      bookingFee: club.bookingFee != null ? String(club.bookingFee) : null,
      primaryColor: effectiveConfig?.primaryColor ?? "#16a34a",
      waitlistEnabled,
      tags: tagRows.map((t) => ({ slug: t.slug, label: t.label })),
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

router.post(
  "/bookings/public/payment-intent",
  bookingRateLimit,
  async (req, res) => {
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
      addOns,
    } = body;

    const clubRow = await resolveClubForPublicBooking(body);
    if (!clubRow) {
      res.status(400).json({ error: "Unable to resolve club" });
      return;
    }

    const bookingFee = parseFloat(String(clubRow.bookingFee ?? "0"));
    const baseAmountCents = Math.round(bookingFee * playersCount * 100);
    const hasAddOns = Boolean(addOns && addOns.length > 0);
    if (baseAmountCents === 0 && !hasAddOns) {
      res.json({ requiresPayment: false });
      return;
    }

    const authPayload = getAuthPayload(req);
    const publicUserId = authPayload?.userId ?? null;
    const publicSource = authPayload ? "online_user" : "online_guest";

    try {
      const { booking, updatedSlot, clubIdForCache, addonTotalCents } =
        await db.transaction(async (tx) => {
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
              userId: publicUserId,
              source: publicSource,
              guestName,
              guestEmail,
              playersCount,
              notes: notes ?? null,
              status: "confirmed",
              paymentStatus: "pending_payment",
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

          const clubIdForAddon = slotWithCourse?.course?.club?.id;
          if (!clubIdForAddon) {
            throw new Error("NO_CLUB");
          }

          const { addonTotalCents } = await checkAndInsertAddons(tx, {
            clubId: clubIdForAddon,
            bookingId: booking.id,
            teeSlot: {
              id: updatedSlot.id,
              datetime: updatedSlot.datetime,
              slotType: updatedSlot.slotType ?? null,
            },
            addOns,
          });

          return { booking, updatedSlot, clubIdForCache, addonTotalCents };
        });

      const dateStr = updatedSlot.datetime.toISOString().split("T")[0];
      if (clubIdForCache) {
        await invalidateAvailabilityCache(
          clubIdForCache,
          updatedSlot.courseId,
          dateStr
        );
      }

      const totalAmountCents = baseAmountCents + addonTotalCents;
      if (totalAmountCents === 0) {
        await db
          .update(bookings)
          .set({ paymentStatus: "unpaid" })
          .where(eq(bookings.id, booking.id));
        res.json({
          requiresPayment: false,
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
          amountCents: 0,
          datetime: updatedSlot.datetime.toISOString(),
        });
        return;
      }

      try {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.create({
          amount: totalAmountCents,
          currency: "usd",
          metadata: {
            bookingId: booking.id,
            bookingRef: booking.bookingRef,
          },
          description: `Tee time booking ${booking.bookingRef}`,
        });

        res.json({
          requiresPayment: true,
          clientSecret: intent.client_secret,
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
          amountCents: totalAmountCents,
          datetime: updatedSlot.datetime.toISOString(),
        });
      } catch (stripeErr) {
        console.error("Stripe payment intent error:", stripeErr);
        await db.transaction(async (tx) => {
          await restoreAddonResourcesForBooking(tx, booking.id);
          await tx
            .update(bookings)
            .set({
              status: "cancelled",
              paymentStatus: "failed",
              deletedAt: new Date(),
            })
            .where(eq(bookings.id, booking.id));
          await tx
            .update(teeSlots)
            .set({
              bookedPlayers: sql`${teeSlots.bookedPlayers} - ${playersCount}`,
            })
            .where(eq(teeSlots.id, booking.teeSlotId!));
        });
        if (clubIdForCache) {
          await invalidateAvailabilityCache(
            clubIdForCache,
            updatedSlot.courseId,
            dateStr
          );
        }
        res.status(500).json({ error: "Payment setup failed" });
      }
    } catch (error) {
      if (error instanceof AddOnUnavailableError) {
        res.status(409).json({
          code: error.code,
          error: "Add-on is not available",
          addonCatalogId: error.addonCatalogId,
          name: error.addonName,
        });
        return;
      }
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
      if (msg === "NO_CLUB") {
        res.status(400).json({ error: "Invalid tee slot" });
        return;
      }
      console.error("Error creating payment intent booking:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/bookings/public/confirm-payment",
  bookingRateLimit,
  async (req, res) => {
    const { bookingId, paymentIntentId } = req.body as {
      bookingId?: string;
      paymentIntentId?: string;
    };
    if (!bookingId || !paymentIntentId) {
      res.status(400).json({ error: "bookingId and paymentIntentId required" });
      return;
    }

    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (intent.metadata.bookingId !== bookingId) {
        res.status(403).json({ error: "Payment intent does not match booking" });
        return;
      }

      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: { teeSlot: true },
      });

      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      if (intent.status === "succeeded") {
        await db
          .update(bookings)
          .set({ paymentStatus: "paid" })
          .where(eq(bookings.id, bookingId));

        await enqueueEmail("email:booking-confirmation", { bookingId });

        if (booking.teeSlot) {
          const teeTime = booking.teeSlot.datetime.getTime();
          const reminderAt = teeTime - 24 * 60 * 60 * 1000 - Date.now();
          if (reminderAt > 60 * 60 * 1000) {
            const q = getEmailQueue();
            if (q) {
              await q.add(
                "email:booking-reminder",
                { bookingId },
                {
                  delay: reminderAt,
                  attempts: 3,
                  backoff: { type: "exponential", delay: 2000 },
                  removeOnComplete: true,
                }
              );
            }
          }
        }

        res.json({
          bookingRef: booking.bookingRef,
          datetime: booking.teeSlot?.datetime?.toISOString(),
          paymentStatus: "paid",
        });
      } else {
        await db.transaction(async (tx) => {
          await tx
            .update(bookings)
            .set({ paymentStatus: "failed", deletedAt: new Date() })
            .where(eq(bookings.id, bookingId));

          if (booking.teeSlotId) {
            await tx
              .update(teeSlots)
              .set({
                bookedPlayers: sql`${teeSlots.bookedPlayers} - ${booking.playersCount}`,
              })
              .where(eq(teeSlots.id, booking.teeSlotId));
          }
        });

        if (booking.teeSlot) {
          const dateStr = booking.teeSlot.datetime.toISOString().split("T")[0];
          const courseRow = await db.query.courses.findFirst({
            where: eq(courses.id, booking.teeSlot.courseId),
          });
          if (courseRow) {
            await invalidateAvailabilityCache(
              courseRow.clubId,
              courseRow.id,
              dateStr
            );
          }
        }

        res.status(402).json({
          error: "Payment not completed",
          status: intent.status,
        });
      }
    } catch (error) {
      console.error("confirm-payment error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

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
    addOns,
  } = body;

  const authPayload = getAuthPayload(req);
  const publicUserId = authPayload?.userId ?? null;
  const publicSource = authPayload ? "online_user" : "online_guest";

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
            userId: publicUserId,
            source: publicSource,
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

        const clubIdForAddon = slotWithCourse?.course?.club?.id;
        if (!clubIdForAddon) {
          throw new Error("NO_CLUB");
        }

        await checkAndInsertAddons(tx, {
          clubId: clubIdForAddon,
          bookingId: booking.id,
          teeSlot: {
            id: updatedSlot.id,
            datetime: updatedSlot.datetime,
            slotType: updatedSlot.slotType ?? null,
          },
          addOns,
        });

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
    if (error instanceof AddOnUnavailableError) {
      res.status(409).json({
        code: error.code,
        error: "Add-on is not available",
        addonCatalogId: error.addonCatalogId,
        name: error.addonName,
      });
      return;
    }
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
    if (msg === "NO_CLUB") {
      res.status(400).json({ error: "Invalid tee slot" });
      return;
    }
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clubs/public/:slug/waitlist", publicRateLimit, async (req, res) => {
  const parsed = JoinWaitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const slug = String(req.params.slug);
  const body = parsed.data;
  const emailNorm = body.email.trim().toLowerCase();

  try {
    const waitlistFlagRow = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "features.waitlist"),
    });
    if (waitlistFlagRow?.value !== true) {
      res.status(403).json({ code: "WAITLIST_DISABLED" });
      return;
    }

    const club = await db.query.clubs.findFirst({
      where: eq(clubs.slug, slug),
    });
    if (!club || club.status === "suspended") {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    const slot = await db.query.teeSlots.findFirst({
      where: eq(teeSlots.id, body.teeSlotId),
      with: { course: true },
    });
    if (!slot || slot.course.clubId !== club.id) {
      res.status(404).json({ error: "Tee slot not found" });
      return;
    }

    const maxP = slot.maxPlayers ?? 4;
    const booked = slot.bookedPlayers ?? 0;
    const status = slot.status ?? "open";
    if (status !== "open") {
      res.status(409).json({ code: "SLOT_NOT_FULL" });
      return;
    }
    if (booked < maxP) {
      res.status(409).json({ code: "SLOT_NOT_FULL" });
      return;
    }

    const playersToWait = Math.min(Math.max(1, body.playersCount), maxP);

    const existing = await db.query.waitlistEntries.findFirst({
      where: and(
        eq(waitlistEntries.teeSlotId, body.teeSlotId),
        eq(waitlistEntries.email, emailNorm)
      ),
    });
    if (existing) {
      const position = await waitlistQueuePosition(
        existing.teeSlotId,
        existing.createdAt!,
        existing.id
      );
      res.status(409).json({ code: "ALREADY_ON_WAITLIST", position });
      return;
    }

    try {
      const [inserted] = await db
        .insert(waitlistEntries)
        .values({
          teeSlotId: body.teeSlotId,
          email: emailNorm,
          name: body.name.trim(),
          playersCount: playersToWait,
        })
        .returning();

      if (!inserted) {
        res.status(500).json({ error: "Failed to join waitlist" });
        return;
      }

      const position = await waitlistQueuePosition(
        inserted.teeSlotId,
        inserted.createdAt!,
        inserted.id
      );
      res.status(201).json({ position });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        const dup = await db.query.waitlistEntries.findFirst({
          where: and(
            eq(waitlistEntries.teeSlotId, body.teeSlotId),
            eq(waitlistEntries.email, emailNorm)
          ),
        });
        if (dup) {
          const position = await waitlistQueuePosition(
            dup.teeSlotId,
            dup.createdAt!,
            dup.id
          );
          res.status(409).json({ code: "ALREADY_ON_WAITLIST", position });
          return;
        }
      }
      throw e;
    }
  } catch (err) {
    console.error("Waitlist join error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
