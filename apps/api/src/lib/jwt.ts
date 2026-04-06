import jwt from "jsonwebtoken";
import type { Secret } from "jsonwebtoken";
import type { JWTPayload } from "@teetimes/types";

function getSecret(): Secret {
  const s = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error("JWT_SECRET or NEXTAUTH_SECRET must be set");
  }
  return s;
}

const SEVEN_DAYS_SEC = 60 * 60 * 24 * 7;

export function signToken(payload: JWTPayload, expiresInSec = SEVEN_DAYS_SEC): string {
  return jwt.sign({ ...payload }, getSecret(), { expiresIn: expiresInSec });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, getSecret()) as JWTPayload;
}

export function signGuestCancelToken(bookingId: string): string {
  return jwt.sign(
    { type: "guest_cancel", bookingId },
    getSecret(),
    { expiresIn: "48h" }
  );
}

export function verifyGuestCancelToken(token: string): { bookingId: string } {
  const p = jwt.verify(token, getSecret()) as {
    type?: string;
    bookingId?: string;
  };
  if (p.type !== "guest_cancel" || !p.bookingId) {
    throw new Error("Invalid cancel token");
  }
  return { bookingId: p.bookingId };
}

export function signInviteToken(userId: string): string {
  return jwt.sign(
    { type: "invite_password", userId },
    getSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyInviteToken(token: string): { userId: string } {
  const p = jwt.verify(token, getSecret()) as {
    type?: string;
    userId?: string;
  };
  if (p.type !== "invite_password" || !p.userId) {
    throw new Error("Invalid invite token");
  }
  return { userId: p.userId };
}
