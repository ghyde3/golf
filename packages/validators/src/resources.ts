import { z } from "zod";

const usageModelSchema = z.enum(["rental", "consumable", "service"]);
const trackingModeSchema = z.enum(["pool", "individual"]);
const assignmentStrategySchema = z.enum(["auto", "manual", "none"]);

const RENTAL_WINDOW_KEYS = new Set([
  "9hole",
  "18hole",
  "27hole",
  "36hole",
  "default",
]);

function refineRentalWindowsValue(
  rentalWindows: Record<string, number>,
  ctx: z.RefinementCtx
): void {
  for (const key of Object.keys(rentalWindows)) {
    if (!RENTAL_WINDOW_KEYS.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid rentalWindows key "${key}". Allowed: 9hole, 18hole, 27hole, 36hole, default`,
        path: ["rentalWindows", key],
      });
    }
  }
  if (!Object.prototype.hasOwnProperty.call(rentalWindows, "default")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'rentalWindows must include a "default" key',
      path: ["rentalWindows"],
    });
  }
}

/** Cross-field rules for usageModel, trackingMode, assignmentStrategy, stock, and rental windows. */
function refineResourceTypeCoreFields(
  data: {
    usageModel: "rental" | "consumable" | "service";
    trackingMode: "pool" | "individual" | null;
    assignmentStrategy: "auto" | "manual" | "none";
    totalUnits?: number | null;
    trackInventory?: boolean;
    currentStock?: number | null;
    rentalWindows?: Record<string, number> | null | undefined;
  },
  ctx: z.RefinementCtx
): void {
  if (data.usageModel === "rental") {
    if (data.trackingMode === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "trackingMode is required when usageModel is rental",
        path: ["trackingMode"],
      });
    }
  } else if (data.trackingMode !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "trackingMode must be null when usageModel is consumable or service",
      path: ["trackingMode"],
    });
  }

  if (data.trackingMode === "pool") {
    if (data.assignmentStrategy !== "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'assignmentStrategy must be "none" when trackingMode is pool',
        path: ["assignmentStrategy"],
      });
    }
  }

  if (data.usageModel === "consumable" || data.usageModel === "service") {
    if (data.assignmentStrategy !== "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'assignmentStrategy must be "none" when usageModel is consumable or service',
        path: ["assignmentStrategy"],
      });
    }
  }

  if (data.trackingMode === "individual") {
    if (data.assignmentStrategy !== "auto" && data.assignmentStrategy !== "manual") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'assignmentStrategy must be "auto" or "manual" when trackingMode is individual',
        path: ["assignmentStrategy"],
      });
    }
  }

  if (data.trackingMode === "pool") {
    if (data.totalUnits === undefined || data.totalUnits === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "totalUnits is required when trackingMode is pool",
        path: ["totalUnits"],
      });
    }
  }

  if (data.usageModel === "consumable") {
    if (data.trackInventory === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "trackInventory is required when usageModel is consumable",
        path: ["trackInventory"],
      });
    }
    if (data.trackInventory === true) {
      if (data.currentStock === undefined || data.currentStock === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "currentStock is required when usageModel is consumable and trackInventory is true",
          path: ["currentStock"],
        });
      }
    }
  }

  if (data.usageModel === "rental") {
    if (data.rentalWindows === undefined || data.rentalWindows === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rentalWindows is required when usageModel is rental",
        path: ["rentalWindows"],
      });
    } else {
      refineRentalWindowsValue(data.rentalWindows, ctx);
    }
  } else if (data.rentalWindows != null) {
    refineRentalWindowsValue(data.rentalWindows, ctx);
  }
}

/**
 * Validates core resource-type fields (same rules as create). Use on the server after merging
 * `PatchResourceTypeInput` with the existing row to enforce cross-field rules on PATCH.
 */
export const ResourceTypeCoreFieldsSchema = z
  .object({
    usageModel: usageModelSchema,
    trackingMode: trackingModeSchema.nullable(),
    assignmentStrategy: assignmentStrategySchema,
    totalUnits: z.number().int().positive().nullable().optional(),
    trackInventory: z.boolean().optional(),
    currentStock: z.number().int().min(0).nullable().optional(),
    rentalWindows: z
      .record(z.string(), z.number().int().positive())
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    refineResourceTypeCoreFields(data, ctx);
  });

export const CreateResourceTypeSchema = z
  .object({
    name: z.string().min(1).max(100),
    usageModel: usageModelSchema,
    trackingMode: trackingModeSchema.nullable(),
    assignmentStrategy: assignmentStrategySchema,
    totalUnits: z.number().int().positive().nullable().optional(),
    trackInventory: z.boolean().optional(),
    currentStock: z.number().int().min(0).nullable().optional(),
    rentalWindows: z
      .record(z.string(), z.number().int().positive())
      .nullable()
      .optional(),
    turnaroundBufferMinutes: z.number().int().min(0).default(0),
    notes: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    refineResourceTypeCoreFields(data, ctx);
  });

/**
 * Request body for PATCH. `usageModel` and `trackingMode` are rejected if present (immutable).
 * After merge with the persisted row, validate core fields with `ResourceTypeCoreFieldsSchema`.
 */
export const PatchResourceTypeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    usageModel: usageModelSchema.optional(),
    trackingMode: trackingModeSchema.nullable().optional(),
    assignmentStrategy: assignmentStrategySchema.optional(),
    totalUnits: z.number().int().positive().nullable().optional(),
    trackInventory: z.boolean().optional(),
    currentStock: z.number().int().min(0).nullable().optional(),
    rentalWindows: z
      .record(z.string(), z.number().int().positive())
      .nullable()
      .optional(),
    turnaroundBufferMinutes: z.number().int().min(0).optional(),
    notes: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.usageModel !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "usageModel cannot be changed after creation",
        path: ["usageModel"],
      });
    }
    if (data.trackingMode !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "trackingMode cannot be changed after creation",
        path: ["trackingMode"],
      });
    }

    if (data.rentalWindows != null) {
      refineRentalWindowsValue(data.rentalWindows, ctx);
    }

    if (data.trackInventory === true) {
      if (data.currentStock === undefined || data.currentStock === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "currentStock is required when trackInventory is true (consumable types with stock tracking)",
          path: ["currentStock"],
        });
      }
    }
  });

export const CreateResourceItemSchema = z.object({
  label: z.string().min(1).max(100),
  operationalStatus: z.enum(["available", "maintenance"]),
  maintenanceNote: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const PatchResourceItemSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  operationalStatus: z
    .enum(["available", "maintenance", "retired"])
    .optional(),
  maintenanceNote: z.string().nullable().optional(),
  lastServicedAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  sortOrder: z.number().int().optional(),
  reason: z.string().nullable().optional(),
});

export const RestockSchema = z.object({
  deltaQuantity: z
    .number()
    .int()
    .refine((v) => v !== 0, {
      message: "deltaQuantity must be non-zero",
    }),
  reason: z.string().nullable().optional(),
});

export const AssignResourceItemSchema = z.object({
  resourceItemId: z.string().uuid(),
});

export const SupersedeAssignmentSchema = z.object({
  resourceItemId: z.string().uuid(),
});

export const CreatePoolMaintenanceHoldSchema = z.object({
  units: z.number().int().positive(),
  reason: z.string().nullable().optional(),
});

export const ResolvePoolMaintenanceHoldSchema = z.object({});

export type CreateResourceTypeInput = z.infer<typeof CreateResourceTypeSchema>;
export type PatchResourceTypeInput = z.infer<typeof PatchResourceTypeSchema>;
export type ResourceTypeCoreFieldsInput = z.infer<
  typeof ResourceTypeCoreFieldsSchema
>;
export type CreateResourceItemInput = z.infer<typeof CreateResourceItemSchema>;
export type PatchResourceItemInput = z.infer<typeof PatchResourceItemSchema>;
export type RestockInput = z.infer<typeof RestockSchema>;
export type AssignResourceItemInput = z.infer<typeof AssignResourceItemSchema>;
export type SupersedeAssignmentInput = z.infer<
  typeof SupersedeAssignmentSchema
>;
export type CreatePoolMaintenanceHoldInput = z.infer<
  typeof CreatePoolMaintenanceHoldSchema
>;
export type ResolvePoolMaintenanceHoldInput = z.infer<
  typeof ResolvePoolMaintenanceHoldSchema
>;
