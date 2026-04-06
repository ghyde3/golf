import type { JWTPayload } from "@teetimes/types";

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
    }
  }
}

export {};
