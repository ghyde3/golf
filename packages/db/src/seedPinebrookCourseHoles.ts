import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema/index";
import { courseHoles, courses } from "./schema/clubs";

type DrizzleDB = PostgresJsDatabase<typeof schema>;

export const PINEBROOK_COURSE_NAMES = [
  "The Championship",
  "The Meadows",
  "The Pines",
  "The Lakes",
] as const;

type HoleSeed = { par: number; yardage: number; handicapIndex: number };

/** Par 72, ~6,840 yards — primary layout. */
const CHAMPIONSHIP_HOLES: HoleSeed[] = [
  { par: 4, yardage: 420, handicapIndex: 11 },
  { par: 5, yardage: 540, handicapIndex: 3 },
  { par: 4, yardage: 405, handicapIndex: 9 },
  { par: 3, yardage: 185, handicapIndex: 17 },
  { par: 4, yardage: 445, handicapIndex: 7 },
  { par: 4, yardage: 410, handicapIndex: 13 },
  { par: 3, yardage: 175, handicapIndex: 15 },
  { par: 5, yardage: 515, handicapIndex: 1 },
  { par: 4, yardage: 415, handicapIndex: 5 },
  { par: 4, yardage: 430, handicapIndex: 10 },
  { par: 4, yardage: 395, handicapIndex: 14 },
  { par: 5, yardage: 505, handicapIndex: 6 },
  { par: 3, yardage: 195, handicapIndex: 18 },
  { par: 4, yardage: 455, handicapIndex: 2 },
  { par: 4, yardage: 400, handicapIndex: 12 },
  { par: 4, yardage: 435, handicapIndex: 8 },
  { par: 3, yardage: 165, handicapIndex: 16 },
  { par: 5, yardage: 525, handicapIndex: 4 },
];

/** Par 72, ~6,420 yards — wider fairways, slightly shorter than Championship. */
const MEADOWS_HOLES: HoleSeed[] = [
  { par: 4, yardage: 405, handicapIndex: 12 },
  { par: 4, yardage: 395, handicapIndex: 14 },
  { par: 5, yardage: 495, handicapIndex: 4 },
  { par: 4, yardage: 425, handicapIndex: 8 },
  { par: 3, yardage: 175, handicapIndex: 18 },
  { par: 4, yardage: 400, handicapIndex: 10 },
  { par: 5, yardage: 500, handicapIndex: 2 },
  { par: 3, yardage: 165, handicapIndex: 16 },
  { par: 4, yardage: 410, handicapIndex: 6 },
  { par: 4, yardage: 415, handicapIndex: 9 },
  { par: 5, yardage: 510, handicapIndex: 3 },
  { par: 4, yardage: 385, handicapIndex: 15 },
  { par: 3, yardage: 190, handicapIndex: 17 },
  { par: 4, yardage: 440, handicapIndex: 1 },
  { par: 4, yardage: 375, handicapIndex: 13 },
  { par: 4, yardage: 405, handicapIndex: 11 },
  { par: 3, yardage: 155, handicapIndex: 7 },
  { par: 5, yardage: 485, handicapIndex: 5 },
];

/** Par 72, ~6,180 yards — tree-lined, tighter lines. */
const PINES_HOLES: HoleSeed[] = [
  { par: 4, yardage: 385, handicapIndex: 10 },
  { par: 4, yardage: 370, handicapIndex: 14 },
  { par: 4, yardage: 395, handicapIndex: 8 },
  { par: 3, yardage: 170, handicapIndex: 18 },
  { par: 5, yardage: 480, handicapIndex: 2 },
  { par: 4, yardage: 360, handicapIndex: 16 },
  { par: 4, yardage: 400, handicapIndex: 6 },
  { par: 3, yardage: 145, handicapIndex: 4 },
  { par: 5, yardage: 470, handicapIndex: 12 },
  { par: 4, yardage: 375, handicapIndex: 9 },
  { par: 4, yardage: 350, handicapIndex: 15 },
  { par: 4, yardage: 410, handicapIndex: 3 },
  { par: 3, yardage: 180, handicapIndex: 17 },
  { par: 4, yardage: 420, handicapIndex: 1 },
  { par: 4, yardage: 365, handicapIndex: 13 },
  { par: 4, yardage: 390, handicapIndex: 7 },
  { par: 4, yardage: 175, handicapIndex: 5 },
  { par: 5, yardage: 495, handicapIndex: 11 },
];

/** Par 36 nine — water in play on several holes. */
const LAKES_HOLES: HoleSeed[] = [
  { par: 4, yardage: 395, handicapIndex: 3 },
  { par: 4, yardage: 380, handicapIndex: 5 },
  { par: 3, yardage: 165, handicapIndex: 7 },
  { par: 5, yardage: 485, handicapIndex: 1 },
  { par: 4, yardage: 370, handicapIndex: 4 },
  { par: 4, yardage: 360, handicapIndex: 6 },
  { par: 3, yardage: 150, handicapIndex: 9 },
  { par: 5, yardage: 475, handicapIndex: 2 },
  { par: 4, yardage: 385, handicapIndex: 8 },
];

const HOLES_BY_COURSE_NAME: Record<(typeof PINEBROOK_COURSE_NAMES)[number], HoleSeed[]> =
  {
    "The Championship": CHAMPIONSHIP_HOLES,
    "The Meadows": MEADOWS_HOLES,
    "The Pines": PINES_HOLES,
    "The Lakes": LAKES_HOLES,
  };

/**
 * Upserts `course_holes` for Pinebrook's four courses (par, yardage, stroke index).
 * Safe to re-run: uses onConflictDoUpdate on (course_id, hole_number).
 */
export async function seedPinebrookCourseHoles(db: DrizzleDB, clubId: string) {
  for (const name of PINEBROOK_COURSE_NAMES) {
    const course = await db.query.courses.findFirst({
      where: and(eq(courses.clubId, clubId), eq(courses.name, name)),
    });
    if (!course) {
      console.warn(`seedPinebrookCourseHoles: missing course "${name}", skipping holes`);
      continue;
    }

    const layout = HOLES_BY_COURSE_NAME[name];
    if (layout.length !== course.holes) {
      console.warn(
        `seedPinebrookCourseHoles: "${name}" seed has ${layout.length} holes but course.holes=${course.holes}; skipping`
      );
      continue;
    }

    for (let i = 0; i < layout.length; i++) {
      const holeNumber = i + 1;
      const h = layout[i]!;
      await db
        .insert(courseHoles)
        .values({
          courseId: course.id,
          holeNumber,
          par: h.par,
          handicapIndex: h.handicapIndex,
          yardage: h.yardage,
        })
        .onConflictDoUpdate({
          target: [courseHoles.courseId, courseHoles.holeNumber],
          set: {
            par: h.par,
            handicapIndex: h.handicapIndex,
            yardage: h.yardage,
          },
        });
    }
  }
}
