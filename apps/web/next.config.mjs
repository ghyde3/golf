import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "..", "..");
// Next.js only auto-loads `.env*` from `apps/web`; load repo-root `.env` so
// NEXTAUTH_SECRET / API_URL match `pnpm dev` from the monorepo root.
loadEnv({ path: path.join(monorepoRoot, ".env") });
loadEnv({ path: path.join(__dirname, ".env.local") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@teetimes/types", "@teetimes/validators"],
};

export default nextConfig;
