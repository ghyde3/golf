import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import app from "./app";
import { startEmailWorker } from "./workers/emailWorker";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  if (process.env.DISABLE_EMAIL_WORKER !== "1") {
    startEmailWorker();
  }
});
