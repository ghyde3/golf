/** Escape `%` / `_` / `\` for use inside ILIKE patterns (literal match). */
export function escapeLikePattern(user: string): string {
  return user
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
