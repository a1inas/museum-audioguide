import "dotenv/config";
import express from "express";
import { router } from "./routes";
import path from "path";
import adminRoutes from "./routes/admin.routes";
import cookieParser from "cookie-parser";
import { ensureDbSchema } from "./db";

const app = express();

app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

// статические файлы uploads
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use(router);
app.use("/api/admin", adminRoutes);

const PORT = Number(process.env.PORT) || 4000;

async function startServer() {
  await ensureDbSchema();
  // ВАЖНО: слушаем 0.0.0.0, чтобы телефон мог подключиться
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running: http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
