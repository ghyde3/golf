/**
 * Clears persisted booking data so `pnpm seed` + `pnpm seed:bookings` can rebuild a clean dev state.
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`TRUNCATE TABLE booking_players, bookings, tee_slots RESTART IDENTITY CASCADE`;
    console.log("Truncated booking_players, bookings, tee_slots.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
