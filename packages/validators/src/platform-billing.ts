import { z } from "zod";

export const PlatformBillingSubscriptionPatchSchema = z.object({
  subscriptionType: z.string().optional(),
  bookingFee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  stripeCustomerId: z.string().optional().nullable(),
  stripeSubscriptionId: z.string().optional().nullable(),
});

export const CreateInvoiceSchema = z.object({
  clubId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().min(0),
});

export const PlatformInvoicePatchSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "void"]).optional(),
  stripeInvoiceId: z.string().optional().nullable(),
  amountCents: z.number().int().min(0).optional(),
});
