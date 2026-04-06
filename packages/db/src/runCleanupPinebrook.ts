/**
 * Applies packages/db/scripts/cleanup-pinebrook-duplicate-courses.sql
 * against DATABASE_URL (e.g. Docker Postgres on localhost:5432 from docker-compose).
 */
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import postgres from "postgres";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const sqlPath = path.join(
    __dirname,
    "../scripts/cleanup-pinebrook-duplicate-courses.sql"
  );
  const raw = fs.readFileSync(sqlPath, "utf8");
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await client.unsafe(raw);
    console.log("Pinebrook duplicate courses cleanup applied.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
