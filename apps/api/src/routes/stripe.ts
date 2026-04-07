import express, { Router } from "express";
import { db, invoices, platformSettings } from "@teetimes/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripeSignature = req.headers["stripe-signature"];

    const secretRow = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "stripe.webhookSecret"),
    });

    if (!secretRow || !stripeSignature) {
      res.status(400).json({ error: "Missing webhook secret or signature" });
      return;
    }

    let event: { type: string; data: { object: { id: string; status?: string } } };
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    if (event.type === "invoice.paid") {
      const stripeInvoiceId = event.data.object.id;
      await db
        .update(invoices)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(invoices.stripeInvoiceId, stripeInvoiceId));
    } else if (event.type === "invoice.payment_failed") {
      const stripeInvoiceId = event.data.object.id;
      await db
        .update(invoices)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(invoices.stripeInvoiceId, stripeInvoiceId));
    }

    res.json({ received: true });
  }
);

export default router;
