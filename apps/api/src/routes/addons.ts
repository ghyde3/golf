import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, clubs, addonCatalog, resourceTypes } from "@teetimes/db";
import {
  CreateAddonCatalogSchema,
  PatchAddonCatalogSchema,
} from "@teetimes/validators";
import { authenticate, requireClubAccess, requireClubRole } from "../middleware/auth";

const router = Router();

/** Public catalog for booking flow */
router.get("/clubs/public/:slug/addons", async (req, res) => {
  const slug = String(req.params.slug);
  try {
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.slug, slug),
    });
    if (!club || club.status === "suspended") {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    const rows = await db
      .select({
        id: addonCatalog.id,
        name: addonCatalog.name,
        description: addonCatalog.description,
        priceCents: addonCatalog.priceCents,
        sortOrder: addonCatalog.sortOrder,
        unitsConsumed: addonCatalog.unitsConsumed,
        resourceTypeId: addonCatalog.resourceTypeId,
      })
      .from(addonCatalog)
      .where(
        and(eq(addonCatalog.clubId, club.id), eq(addonCatalog.active, true))
      )
      .orderBy(asc(addonCatalog.sortOrder), asc(addonCatalog.name));

    res.json(rows);
  } catch (e) {
    console.error("GET public addons:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get(
  "/clubs/:clubId/addons",
  authenticate,
  requireClubAccess,
  async (req, res) => {
    const clubId = String(req.params.clubId);
    try {
      const rows = await db
        .select({
          id: addonCatalog.id,
          name: addonCatalog.name,
          description: addonCatalog.description,
          priceCents: addonCatalog.priceCents,
          sortOrder: addonCatalog.sortOrder,
          unitsConsumed: addonCatalog.unitsConsumed,
          taxable: addonCatalog.taxable,
          active: addonCatalog.active,
          resourceTypeId: addonCatalog.resourceTypeId,
          resourceTypeName: resourceTypes.name,
        })
        .from(addonCatalog)
        .leftJoin(
          resourceTypes,
          eq(addonCatalog.resourceTypeId, resourceTypes.id)
        )
        .where(eq(addonCatalog.clubId, clubId))
        .orderBy(asc(addonCatalog.sortOrder), asc(addonCatalog.name));

      res.json(rows);
    } catch (e) {
      console.error("GET club addons:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/clubs/:clubId/addons",
  authenticate,
  requireClubAccess,
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = String(req.params.clubId);
    const parsed = CreateAddonCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    try {
      if (d.resourceTypeId) {
        const rt = await db.query.resourceTypes.findFirst({
          where: and(
            eq(resourceTypes.id, d.resourceTypeId),
            eq(resourceTypes.clubId, clubId)
          ),
        });
        if (!rt) {
          res.status(400).json({ error: "Resource type not found" });
          return;
        }
      }

      const [row] = await db
        .insert(addonCatalog)
        .values({
          clubId,
          name: d.name,
          description: d.description ?? null,
          priceCents: d.priceCents,
          resourceTypeId: d.resourceTypeId ?? null,
          unitsConsumed: d.unitsConsumed ?? 1,
          taxable: d.taxable ?? true,
          sortOrder: d.sortOrder ?? 0,
          active: d.active ?? true,
        })
        .returning();

      res.status(201).json(row);
    } catch (e) {
      console.error("POST addon catalog:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.patch(
  "/clubs/:clubId/addons/:itemId",
  authenticate,
  requireClubAccess,
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = String(req.params.clubId);
    const itemId = String(req.params.itemId);
    const parsed = PatchAddonCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const existing = await db.query.addonCatalog.findFirst({
      where: and(eq(addonCatalog.id, itemId), eq(addonCatalog.clubId, clubId)),
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const d = parsed.data;
    if (d.resourceTypeId !== undefined && d.resourceTypeId !== null) {
      const rt = await db.query.resourceTypes.findFirst({
        where: and(
          eq(resourceTypes.id, d.resourceTypeId),
          eq(resourceTypes.clubId, clubId)
        ),
      });
      if (!rt) {
        res.status(400).json({ error: "Resource type not found" });
        return;
      }
    }

    try {
      const [row] = await db
        .update(addonCatalog)
        .set({
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.priceCents !== undefined ? { priceCents: d.priceCents } : {}),
          ...(d.resourceTypeId !== undefined
            ? { resourceTypeId: d.resourceTypeId }
            : {}),
          ...(d.unitsConsumed !== undefined
            ? { unitsConsumed: d.unitsConsumed }
            : {}),
          ...(d.taxable !== undefined ? { taxable: d.taxable } : {}),
          ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
          ...(d.active !== undefined ? { active: d.active } : {}),
        })
        .where(eq(addonCatalog.id, itemId))
        .returning();

      res.json(row);
    } catch (e) {
      console.error("PATCH addon catalog:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
