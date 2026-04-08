import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  bookings,
  roundScorecards,
  roundScorecardHoles,
} from "@teetimes/db";
import { ScorecardSubmitSchema } from "@teetimes/validators";
import { authenticate } from "../middleware/auth";

const router = Router();

// POST /api/me/scorecards — upsert scorecard for a past booking
router.post("/", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = ScorecardSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { bookingId, holes } = parsed.data;

  // Verify booking ownership and that the round is in the past
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: { teeSlot: { with: { course: { with: { club: true } } } } },
  });

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  if (booking.userId !== auth.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!booking.teeSlot) {
    res.status(400).json({ error: "Booking has no tee slot" });
    return;
  }
  if (new Date(booking.teeSlot.datetime) > new Date()) {
    res
      .status(400)
      .json({ error: "Round not yet played", code: "ROUND_NOT_YET_PLAYED" });
    return;
  }

  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
  const completedHoles = holes.length;
  const courseId = booking.teeSlot.courseId;

  const scorecard = await db.transaction(async (tx) => {
    // Upsert the scorecard header
    const [sc] = await tx
      .insert(roundScorecards)
      .values({
        bookingId,
        userId: auth.userId,
        courseId,
        totalScore,
        completedHoles,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [roundScorecards.bookingId],
        set: { totalScore, completedHoles, updatedAt: new Date() },
      })
      .returning();

    // Delete existing hole scores and reinsert
    await tx
      .delete(roundScorecardHoles)
      .where(eq(roundScorecardHoles.scorecardId, sc.id));
    await tx.insert(roundScorecardHoles).values(
      holes.map((h) => ({
        scorecardId: sc.id,
        holeNumber: h.holeNumber,
        score: h.score,
      }))
    );

    return sc;
  });

  res.status(201).json({ id: scorecard.id, totalScore, completedHoles });
});

// GET /api/me/scorecards — list golfer's scorecards
router.get("/", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db.query.roundScorecards.findMany({
    where: eq(roundScorecards.userId, auth.userId),
    orderBy: [desc(roundScorecards.createdAt)],
    with: {
      holes: true,
      booking: {
        with: {
          teeSlot: {
            with: { course: { with: { club: true } } },
          },
        },
      },
      course: true,
    },
  });

  res.json(
    rows.map((sc) => ({
      id: sc.id,
      totalScore: sc.totalScore,
      completedHoles: sc.completedHoles,
      createdAt: sc.createdAt?.toISOString(),
      holes: sc.holes.map((h) => ({
        holeNumber: h.holeNumber,
        score: h.score,
      })),
      booking: sc.booking
        ? {
            bookingRef: sc.booking.bookingRef,
            teeSlot: sc.booking.teeSlot
              ? {
                  datetime: sc.booking.teeSlot.datetime.toISOString(),
                  courseName: sc.booking.teeSlot.course?.name ?? "",
                  clubName: sc.booking.teeSlot.course?.club?.name ?? "",
                  clubId: sc.booking.teeSlot.course?.club?.id ?? "",
                  courseId: sc.booking.teeSlot.courseId,
                }
              : null,
          }
        : null,
    }))
  );
});

export default router;
