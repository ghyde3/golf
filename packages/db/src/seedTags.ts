import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";
import { clubTagAssignments, clubTagDefinitions } from "./schema/clubTags";
import { clubs } from "./schema/clubs";
import { eq } from "drizzle-orm";

type DrizzleDB = PostgresJsDatabase<typeof schema>;

export type TagSeedRow = {
  slug: string;
  label: string;
  sortOrder: number;
  groupName: string;
};

/** Platform-managed catalog; keep slugs stable for URLs/API. */
export const CLUB_TAG_DEFINITIONS_SEED: TagSeedRow[] = [
  { slug: "municipal", label: "Municipal", sortOrder: 10, groupName: "Course character" },
  { slug: "resort", label: "Resort", sortOrder: 20, groupName: "Course character" },
  { slug: "links", label: "Links", sortOrder: 30, groupName: "Course character" },
  { slug: "parkland", label: "Parkland", sortOrder: 40, groupName: "Course character" },
  { slug: "desert", label: "Desert", sortOrder: 50, groupName: "Course character" },
  { slug: "mountain", label: "Mountain", sortOrder: 60, groupName: "Course character" },
  { slug: "coastal", label: "Coastal", sortOrder: 70, groupName: "Course character" },
  { slug: "championship", label: "Championship", sortOrder: 80, groupName: "Course character" },
  { slug: "private-club", label: "Private club", sortOrder: 90, groupName: "Course character" },
  { slug: "semi-private", label: "Semi-private", sortOrder: 100, groupName: "Course character" },
  { slug: "daily-fee", label: "Daily fee / public", sortOrder: 110, groupName: "Course character" },
  { slug: "driving-range", label: "Driving range", sortOrder: 200, groupName: "Amenities" },
  { slug: "practice-facility", label: "Practice facility", sortOrder: 210, groupName: "Amenities" },
  { slug: "pro-shop", label: "Pro shop", sortOrder: 220, groupName: "Amenities" },
  { slug: "lessons", label: "Lessons / instruction", sortOrder: 230, groupName: "Amenities" },
  { slug: "restaurant", label: "Restaurant", sortOrder: 240, groupName: "Amenities" },
  { slug: "bar-grill", label: "Bar & grill", sortOrder: 250, groupName: "Amenities" },
  { slug: "cart-rental", label: "Cart rental", sortOrder: 260, groupName: "Amenities" },
  { slug: "club-rental", label: "Club rental", sortOrder: 270, groupName: "Amenities" },
  { slug: "simulator", label: "Simulator / indoor", sortOrder: 280, groupName: "Amenities" },
  { slug: "stay-and-play", label: "Stay & play", sortOrder: 290, groupName: "Amenities" },
  { slug: "family-friendly", label: "Family-friendly", sortOrder: 300, groupName: "Experience" },
  { slug: "beginner-friendly", label: "Beginner-friendly", sortOrder: 310, groupName: "Experience" },
];

export async function seedClubTagDefinitions(db: DrizzleDB) {
  for (const row of CLUB_TAG_DEFINITIONS_SEED) {
    await db
      .insert(clubTagDefinitions)
      .values({
        slug: row.slug,
        label: row.label,
        sortOrder: row.sortOrder,
        groupName: row.groupName,
        active: true,
      })
      .onConflictDoNothing({ target: clubTagDefinitions.slug });
  }
}

/** Demo assignments by club slug → tag slugs (idempotent). */
export const SEED_CLUB_TAG_ASSIGNMENTS: Record<string, string[]> = {
  pinebrook: ["parkland", "championship", "daily-fee", "driving-range", "pro-shop"],
  riverbend: ["parkland", "daily-fee", "cart-rental"],
  "oak-ridge": ["private-club", "parkland", "restaurant"],
  "sunset-valley": ["links", "daily-fee", "practice-facility"],
  maplewood: ["family-friendly", "beginner-friendly", "daily-fee"],
  "cypress-point": ["municipal", "daily-fee", "beginner-friendly"],
  "eagle-ridge": ["resort", "stay-and-play", "championship", "restaurant"],
  "willow-creek": ["parkland", "daily-fee", "lessons"],
  "highland-park": ["mountain", "daily-fee", "cart-rental"],
};

export async function seedClubTagAssignments(db: DrizzleDB) {
  const defs = await db.select().from(clubTagDefinitions);
  const idBySlug = new Map(defs.map((d) => [d.slug, d.id]));

  for (const [clubSlug, tagSlugs] of Object.entries(SEED_CLUB_TAG_ASSIGNMENTS)) {
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.slug, clubSlug),
    });
    if (!club) continue;

    for (const tagSlug of tagSlugs) {
      const tagId = idBySlug.get(tagSlug);
      if (!tagId) continue;
      await db
        .insert(clubTagAssignments)
        .values({ clubId: club.id, tagId })
        .onConflictDoNothing();
    }
  }
}
