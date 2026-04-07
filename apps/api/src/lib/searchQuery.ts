import { and, eq, exists, ilike, or, type SQL } from "drizzle-orm";
import { clubs, courses, db } from "@teetimes/db";
import { escapeLikePattern } from "./escapeLike";

/** Common tokens in Google formatted regions that are not useful for text match. */
const SEARCH_STOPWORDS = new Set([
  "usa",
  "us",
  "u.s",
  "u.s.",
  "u.s.a",
  "united",
  "states",
  "america",
  "the",
  "of",
  "in",
  "and",
]);

/**
 * Matches home / search bar phrases like "9 holes", "18 hole", "18 holes"
 * (course layout filter — uses `courses.holes`, not substring search).
 */
export function parseHoleCountQuery(q: string): number | null {
  const m = q.trim().match(/^\s*(9|18)\s*holes?\s*$/i);
  return m ? Number(m[1]) : null;
}

/**
 * Split a free-text location query into searchable tokens (e.g. Google "Edison, NJ, USA"
 * → ["Edison", "NJ"]) so we can AND-match across city/state/name fields.
 */
export function searchTokensFromQuery(q: string): string[] {
  return q
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/\.+$/g, ""))
    .filter((t) => t.length >= 2)
    .filter((t) => !SEARCH_STOPWORDS.has(t.toLowerCase()));
}

/** Pattern matches club fields or any course name under the club. */
function textMatchesPattern(pattern: string): SQL {
  return or(
    ilike(clubs.name, pattern),
    ilike(clubs.description, pattern),
    ilike(clubs.slug, pattern),
    ilike(clubs.city, pattern),
    ilike(clubs.state, pattern),
    exists(
      db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.clubId, clubs.id), ilike(courses.name, pattern)))
    )
  )!;
}

/** One token must match at least one club field or a course name. */
function clubMatchesToken(token: string): SQL {
  const pattern = `%${escapeLikePattern(token)}%`;
  return textMatchesPattern(pattern);
}

/**
 * Build WHERE fragment for public club list search. Returns null when there is no q.
 */
export function clubPublicSearchSql(q: string): SQL | null {
  const trimmed = q.trim();
  if (!trimmed) return null;

  const holeCount = parseHoleCountQuery(trimmed);
  if (holeCount != null) {
    return exists(
      db
        .select({ id: courses.id })
        .from(courses)
        .where(
          and(eq(courses.clubId, clubs.id), eq(courses.holes, holeCount))
        )
    );
  }

  const tokens = searchTokensFromQuery(trimmed);

  if (tokens.length === 0) {
    const pattern = `%${escapeLikePattern(trimmed)}%`;
    return textMatchesPattern(pattern);
  }

  if (tokens.length === 1) {
    return clubMatchesToken(tokens[0]);
  }

  return and(...tokens.map((t) => clubMatchesToken(t)))!;
}
