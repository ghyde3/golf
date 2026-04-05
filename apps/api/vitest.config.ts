import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@teetimes/db": path.resolve(__dirname, "../../packages/db/src"),
      "@teetimes/types": path.resolve(__dirname, "../../packages/types/src"),
      "@teetimes/validators": path.resolve(
        __dirname,
        "../../packages/validators/src"
      ),
    },
  },
});
