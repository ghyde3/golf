import type { UserRole } from "@teetimes/types";

/**
 * Default landing path after a successful staff login (no `next` query).
 * Platform admins go to the platform console; club staff to their first club dashboard.
 */
export function getDefaultLoginRedirect(roles: UserRole[]): string {
  const isPlatformAdmin = roles.some(
    (r) => r.role === "platform_admin" && r.clubId == null
  );
  if (isPlatformAdmin) return "/platform";

  const clubRole = roles.find(
    (r) =>
      (r.role === "club_admin" || r.role === "staff") && r.clubId !== null
  );
  if (clubRole?.clubId) {
    return `/club/${clubRole.clubId}/dashboard`;
  }

  return "/";
}
