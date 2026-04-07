/** Matches API `parseHoleCountQuery` — layout filter, not a place name. */
export function isHoleLayoutQuery(q: string): boolean {
  return /^\s*(9|18)\s*holes?\s*$/i.test(q.trim());
}
