import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import platformRoutes from "./routes/platform";
import stripeRoutes from "./routes/stripe";
import clubManageRoutes from "./routes/clubs";
import clubResources from "./routes/clubResources";
import resourceRoutes from "./routes/resources";
import publicClubRoutes from "./routes/publicClub";
import bookingOperations from "./routes/bookingOperations";
import { authenticate, requireClubAccess } from "./middleware/auth";

const app = express();

app.use(cors());
app.use("/api/stripe", stripeRoutes);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
// Public routes must run before `/api/clubs/:clubId` or paths like
// `/api/clubs/public/:slug` are captured as clubId "public" and hit auth (401).
app.use("/api", publicClubRoutes);
app.use("/api/clubs/:clubId/manage", clubManageRoutes);
/** Inventory / resource management — must be registered before the broader `/api/clubs/:clubId` router. */
app.use(
  "/api/clubs/:clubId/resources",
  authenticate,
  requireClubAccess,
  resourceRoutes
);
app.use("/api/clubs/:clubId", clubResources);
app.use("/api/bookings", bookingOperations);

export default app;
