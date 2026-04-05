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
