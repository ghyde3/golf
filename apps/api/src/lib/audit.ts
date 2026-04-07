import { db, auditLog } from "@teetimes/db";

export async function writeAuditLog(entry: {
  actorId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  await db.insert(auditLog).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    meta: entry.meta ?? null,
  });
}
