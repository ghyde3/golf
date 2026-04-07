import { describe, expect, it } from "vitest";
import { parseHoleCountQuery, searchTokensFromQuery } from "./searchQuery";

describe("parseHoleCountQuery", () => {
  it("detects 9/18 hole layout phrases", () => {
    expect(parseHoleCountQuery("18 holes")).toBe(18);
    expect(parseHoleCountQuery("18 hole")).toBe(18);
    expect(parseHoleCountQuery("9 holes")).toBe(9);
    expect(parseHoleCountQuery("  9  holes  ")).toBe(9);
  });

  it("returns null for free text", () => {
    expect(parseHoleCountQuery("Edison")).toBeNull();
    expect(parseHoleCountQuery("18-hole parkland")).toBeNull();
  });
});

describe("searchTokensFromQuery", () => {
  it("splits Google-style regions and drops USA", () => {
    expect(searchTokensFromQuery("Edison, NJ, USA").sort()).toEqual(
      ["Edison", "NJ"].sort()
    );
  });

  it("keeps single place tokens", () => {
    expect(searchTokensFromQuery("Edison")).toEqual(["Edison"]);
    expect(searchTokensFromQuery("cypress")).toEqual(["cypress"]);
  });

  it("strips trailing period on tokens", () => {
    expect(searchTokensFromQuery("Edison, NJ.")).toEqual(["Edison", "NJ"]);
  });
});
