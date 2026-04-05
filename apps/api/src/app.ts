import express from "express";
import cors from "cors";
import { db } from "@teetimes/db";
import { clubs, clubConfig } from "@teetimes/db";
import { eq, desc } from "drizzle-orm";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/clubs/public/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const club = await db.query.clubs.findFirst({
      where: eq(clubs.slug, slug),
      with: {
        courses: true,
        configs: {
          orderBy: [desc(clubConfig.effectiveFrom)],
        },
      },
    });

    if (!club || club.status === "suspended") {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const effectiveConfig = club.configs.find(
      (c) => c.effectiveFrom <= today
    ) ?? club.configs[0];

    res.json({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      heroImageUrl: club.heroImageUrl,
      primaryColor: effectiveConfig?.primaryColor ?? "#16a34a",
      courses: club.courses.map((c) => ({
        id: c.id,
        name: c.name,
        holes: c.holes,
      })),
      config: effectiveConfig
        ? {
            slotIntervalMinutes: effectiveConfig.slotIntervalMinutes,
            bookingWindowDays: effectiveConfig.bookingWindowDays,
            cancellationHours: effectiveConfig.cancellationHours,
            openTime: effectiveConfig.openTime,
            closeTime: effectiveConfig.closeTime,
            schedule: effectiveConfig.schedule,
            timezone: effectiveConfig.timezone,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching club profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
