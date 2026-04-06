import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import platformRoutes from "./routes/platform";
import clubManageRoutes from "./routes/clubs";
import clubResources from "./routes/clubResources";
import publicClubRoutes from "./routes/publicClub";
import bookingOperations from "./routes/bookingOperations";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/clubs/:clubId/manage", clubManageRoutes);
app.use("/api/clubs/:clubId", clubResources);
app.use("/api", publicClubRoutes);
app.use("/api/bookings", bookingOperations);

export default app;
