import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

/**
 * Regression: public routes must never sit behind `authenticate` / staff-only mounts.
 * Example bug: `GET /api/clubs/public/:slug` matched `/api/clubs/:clubId` with clubId "public" → 401.
 *
 * These tests do not require a working database: we only assert the response is not 401.
 * (With DB down you may see 404/500; with DB up, 200/404.)
 */
describe("Public API invariants", () => {
  it("GET /api/clubs/public/:slug is not gated by JWT (not 401)", async () => {
    const res = await request(app).get("/api/clubs/public/does-not-exist-slug");
    expect(res.status).not.toBe(401);
  });

  it("POST /api/bookings/public validates body (400) and does not require JWT (not 401)", async () => {
    const res = await request(app)
      .post("/api/bookings/public")
      .set("Content-Type", "application/json")
      .send({ notAValidBooking: true });
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(400);
  });
});
