/** Builds GET /manage/bookings query string from URL search params (Next.js). */

export type BookingsPageQuery = {
  page: string;
  limit: string;
  sort: string;
  order: string;
  q: string;
  status: string;
  courseId: string;
  from: string;
  to: string;
  range: string;
};

function first(
  v: string | string[] | undefined
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parseBookingsSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): BookingsPageQuery {
  return {
    page: first(searchParams.page) ?? "1",
    limit: first(searchParams.limit) ?? "25",
    sort: first(searchParams.sort) ?? "createdAt",
    order: first(searchParams.order) ?? "desc",
    q: first(searchParams.q) ?? "",
    status: first(searchParams.status) ?? "",
    courseId: first(searchParams.courseId) ?? "",
    from: first(searchParams.from) ?? "",
    to: first(searchParams.to) ?? "",
    range: first(searchParams.range) ?? "created",
  };
}

export function toManageBookingsApiQuery(q: BookingsPageQuery): string {
  const p = new URLSearchParams();
  const set = (k: keyof BookingsPageQuery, v: string) => {
    if (v !== "") p.set(k, v);
  };
  set("page", q.page);
  set("limit", q.limit);
  set("sort", q.sort);
  set("order", q.order);
  set("q", q.q);
  set("status", q.status);
  set("courseId", q.courseId);
  set("from", q.from);
  set("to", q.to);
  set("range", q.range);
  return p.toString();
}

export function toBookingsPageHref(
  clubId: string,
  base: BookingsPageQuery,
  patch: Partial<BookingsPageQuery>
): string {
  const next = { ...base, ...patch };
  const p = new URLSearchParams();
  const set = (k: keyof BookingsPageQuery, v: string) => {
    if (v !== "") p.set(k, v);
  };
  set("page", next.page);
  set("limit", next.limit);
  set("sort", next.sort);
  set("order", next.order);
  set("q", next.q);
  set("status", next.status);
  set("courseId", next.courseId);
  set("from", next.from);
  set("to", next.to);
  set("range", next.range);
  const qs = p.toString();
  return qs ? `/club/${clubId}/bookings?${qs}` : `/club/${clubId}/bookings`;
}
