import type { Request, Response } from "express";
import type { JWTPayload, UserRole } from "@teetimes/types";
import { verifyToken } from "./jwt";

export function getBearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

export function getAuthPayload(req: Request): JWTPayload | null {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function hasPlatformAdmin(roles: UserRole[]): boolean {
  return roles.some((r) => r.role === "platform_admin" && r.clubId === null);
}

export function canAccessClub(roles: UserRole[], clubId: string): boolean {
  if (hasPlatformAdmin(roles)) return true;
  return roles.some(
    (r) =>
      (r.role === "club_admin" || r.role === "staff") && r.clubId === clubId
  );
}

export function sendUnauthorized(res: Response): void {
  res.status(401).json({ error: "Unauthorized" });
}

export function sendForbidden(res: Response): void {
  res.status(403).json({ error: "Forbidden" });
}
