import { Router } from "express";
import { db, courseHoles, courses } from "@teetimes/db";
import { eq, asc, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router({ mergeParams: true });

// GET /api/clubs/:clubId/courses/:courseId/holes
// Auth: any authenticated user (golfers need this for scorecard par display)
router.get(
  "/api/clubs/:clubId/courses/:courseId/holes",
  authenticate,
  async (req, res) => {
    const clubId = String(req.params.clubId);
    const courseId = String(req.params.courseId);

    const course = await db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.clubId, clubId)),
      columns: { id: true, holes: true },
    });
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const holes = await db
      .select()
      .from(courseHoles)
      .where(eq(courseHoles.courseId, courseId))
      .orderBy(asc(courseHoles.holeNumber));

    res.json(holes);
  }
);

export default router;
