import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import platformRoutes from "./routes/platform";
import stripeRoutes from "./routes/stripe";
import clubManageRoutes from "./routes/clubs";
import clubResources from "./routes/clubResources";
import courseHolesRoutes from "./routes/courseHoles";
import resourceRoutes from "./routes/resources";
import addonRoutes from "./routes/addons";
import publicClubRoutes from "./routes/publicClub";
import { handleWaitlistClaim } from "./routes/waitlistClaim";
import bookingOperations from "./routes/bookingOperations";
import meRoutes from "./routes/me";
import { authenticate, requireClubAccess } from "./middleware/auth";
import { publicRateLimit } from "./middleware/rateLimit";

const app = express();

app.use(cors());
app.use("/api/stripe", stripeRoutes);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/me", meRoutes);
// Public routes must run before `/api/clubs/:clubId` or paths like
// `/api/clubs/public/:slug` are captured as clubId "public" and hit auth (401).
app.get("/api/waitlist/claim", publicRateLimit, handleWaitlistClaim);
app.use("/api", addonRoutes);
app.use("/api", publicClubRoutes);
app.use("/api/clubs/:clubId/manage", clubManageRoutes);
/** Inventory / resource management — must be registered before the broader `/api/clubs/:clubId` router. */
app.use(
  "/api/clubs/:clubId/resources",
  authenticate,
  requireClubAccess,
  resourceRoutes
);
// GET holes is open to all authenticated users (golfers need par data for scorecards).
// Must be before the /api/clubs/:clubId clubResources mount to avoid requireClubAccess.
app.use(courseHolesRoutes);
app.use("/api/clubs/:clubId", clubResources);
app.use("/api/bookings", bookingOperations);

export default app;
