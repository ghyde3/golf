import express, { Router } from "express";
import {
  db,
  invoices,
  platformSettings,
  bookings,
  teeSlots,
} from "@teetimes/db";
import { eq, sql } from "drizzle-orm";

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

    let event: {
      type: string;
      data: {
        object: {
          id: string;
          status?: string;
          metadata?: Record<string, string>;
        };
      };
    };
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
    } else if (event.type === "payment_intent.payment_failed") {
      const piObject = event.data.object;
      const bookingId = piObject.metadata?.bookingId;
      if (bookingId) {
        const booking = await db.query.bookings.findFirst({
          where: eq(bookings.id, bookingId),
        });
        if (booking && booking.paymentStatus === "pending_payment") {
          await db.transaction(async (tx) => {
            await tx
              .update(bookings)
              .set({ paymentStatus: "failed", deletedAt: new Date() })
              .where(eq(bookings.id, bookingId));
            if (booking.teeSlotId) {
              await tx
                .update(teeSlots)
                .set({
                  bookedPlayers: sql`${teeSlots.bookedPlayers} - ${booking.playersCount}`,
                })
                .where(eq(teeSlots.id, booking.teeSlotId));
            }
          });
        }
      }
    }

    res.json({ received: true });
  }
);

export default router;
