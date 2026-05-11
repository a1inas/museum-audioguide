import { Router } from "express";
import { uploadAudio, uploadImage } from "../middleware/upload";
import { pool } from "../db";
import {
  createPoint,
  deletePoint,
  listPoints,
  updatePoint,
  reorderPoints,
  deletePointAudio,
  deletePointImage,
  listReviews,
  deleteReview,
  listFeedback,
  deleteFeedback,
  tryDeleteUploadsFile,
} from "../controllers/admin.controller";
import {
  issueAdminCookie,
  clearAdminCookie,
  requireAdmin,
} from "../middleware/admin-auth";

const router = Router();

/**
 * PUBLIC-ish endpoints for admin auth
 */

// Проверка сессии (для фронта)
router.get("/me", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

// Логин по паролю
router.post("/login", (req, res) => {
  const pass = String(req.body?.password ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  if (!expected) {
    return res
      .status(500)
      .json({ ok: false, error: "ADMIN_PASSWORD is not set" });
  }

  if (pass !== expected) {
    return res.status(401).json({ ok: false, error: "wrong password" });
  }

  issueAdminCookie(res);
  res.json({ ok: true });
});

// Выход
router.post("/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

/**
 * PROTECTED admin endpoints
 */
router.use(requireAdmin);

// 1) список точек для админки
router.get("/points", listPoints);

// 2) создать точку
router.post("/points", createPoint);

// 3) обновить точку
router.put("/points/:slug", updatePoint);
router.post("/points/reorder", reorderPoints);
router.get("/reviews", listReviews);
router.delete("/reviews/:id", deleteReview);
router.get("/feedback", listFeedback);
router.delete("/feedback/:id", deleteFeedback);

// 4) удалить точку (+ удаление файлов в controller)
router.delete("/points/:slug", deletePoint);
router.delete("/points/:slug/audio", deletePointAudio);
router.delete("/points/:slug/image", deletePointImage);
// 5) загрузка аудио и привязка к точке
router.post("/upload-audio/:pointSlug", uploadAudio.single("audio"), async (req, res) => {
  try {
    const { pointSlug } = req.params;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Файл не загружен" });
    }

    const old = await pool.query(`SELECT audio_url FROM points WHERE slug = $1`, [pointSlug]);
    const oldUrl: string | null = old.rows[0]?.audio_url ?? null;

    const fileUrl = `/uploads/audio/${req.file.filename}`;

    await pool.query("UPDATE points SET audio_url = $1 WHERE slug = $2", [
      fileUrl,
      pointSlug,
    ]);

    // удалим старый файл (если был)
    await tryDeleteUploadsFile(oldUrl);

    res.json({ ok: true, audio_url: fileUrl });
  } catch (err: any) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Ошибка загрузки аудио";
    res.status(400).json({ ok: false, error: message });
  }
});

// 6) загрузка картинки и привязка к точке
router.post("/upload-image/:pointSlug", uploadImage.single("image"), async (req, res) => {
  try {
    const { pointSlug } = req.params;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Файл не загружен" });
    }

    const old = await pool.query(`SELECT image_url FROM points WHERE slug = $1`, [pointSlug]);
    const oldUrl: string | null = old.rows[0]?.image_url ?? null;

    const fileUrl = `/uploads/images/${req.file.filename}`;

    await pool.query("UPDATE points SET image_url = $1 WHERE slug = $2", [
      fileUrl,
      pointSlug,
    ]);

    // удалим старый файл (если был)
    await tryDeleteUploadsFile(oldUrl);

    res.json({ ok: true, image_url: fileUrl });
  } catch (err: any) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Ошибка загрузки изображения";
    res.status(400).json({ ok: false, error: message });
  }
});

export default router;
