import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Health endpoint", () => {
  it("GET /health returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
