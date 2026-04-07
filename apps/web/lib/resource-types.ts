/** Shapes returned by GET /api/clubs/:clubId/resources (aggregated list). */

export type ResourceTypeRow = {
  id: string;
  name: string;
  usageModel: "rental" | "consumable" | "service";
  trackingMode: "pool" | "individual" | null;
  assignmentStrategy: "auto" | "manual" | "none";
  totalUnits: number | null;
  trackInventory: boolean;
  currentStock: number | null;
  rentalWindows: Record<string, number> | null;
  turnaroundBufferMinutes: number;
  notes: string | null;
  sortOrder: number;
  active: boolean;
  availableNow: number | null;
  inMaintenance: number;
  inUseBooked: number;
  overAllocated: boolean;
  activeHoldsCount: number | null;
};

export type ResourceItemRow = {
  id: string;
  label: string;
  operationalStatus: string;
  maintenanceNote: string | null;
};

export type PoolMaintenanceHoldRow = {
  id: string;
  resourceTypeId: string;
  clubId: string;
  units: number;
  reason: string | null;
  startedAt: string;
  resolvedAt: string | null;
  createdBy: string;
  resolvedBy: string | null;
};

/** UI default when API has no restock threshold field (alerts / “low stock” pill). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
