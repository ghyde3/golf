import type { Request, RequestHandler } from "express";
import type { UserRole } from "@teetimes/types";
import {
  getAuthPayload,
  hasPlatformAdmin,
  canAccessClub,
  sendUnauthorized,
  sendForbidden,
} from "../lib/auth";

function attachAuth(req: Request): void {
  if (!req.auth) {
    const p = getAuthPayload(req);
    if (p) req.auth = p;
  }
}

export const authenticate: RequestHandler = (req, res, next) => {
  const payload = getAuthPayload(req);
  if (!payload) {
    sendUnauthorized(res);
    return;
  }
  req.auth = payload;
  next();
};

export function requireRole(role: string): RequestHandler {
  return (req, res, next) => {
    attachAuth(req);
    const auth = req.auth;
    if (!auth) {
      sendUnauthorized(res);
      return;
    }
    const ok = auth.roles.some((r: UserRole) => {
      if (role === "platform_admin") {
        return r.role === "platform_admin" && r.clubId === null;
      }
      return r.role === role;
    });
    if (!ok) {
      sendForbidden(res);
      return;
    }
    next();
  };
}

export function requireClubRole(allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    attachAuth(req);
    const auth = req.auth;
    if (!auth) {
      sendUnauthorized(res);
      return;
    }
    const clubId = req.params.clubId;
    if (!clubId || typeof clubId !== "string") {
      res.status(400).json({ error: "clubId required" });
      return;
    }
    if (hasPlatformAdmin(auth.roles)) {
      next();
      return;
    }
    const ok = auth.roles.some(
      (r: UserRole) =>
        r.clubId === clubId && allowedRoles.includes(r.role)
    );
    if (!ok) {
      sendForbidden(res);
      return;
    }
    next();
  };
}

export const requireClubAccess: RequestHandler = (req, res, next) => {
  attachAuth(req);
  const auth = req.auth;
  if (!auth) {
    sendUnauthorized(res);
    return;
  }
  const clubId = req.params.clubId;
  if (!clubId || typeof clubId !== "string") {
    res.status(400).json({ error: "clubId required" });
    return;
  }
  if (!canAccessClub(auth.roles, clubId)) {
    sendForbidden(res);
    return;
  }
  next();
};
