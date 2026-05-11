import type { Request, Response } from "express";
import { pool } from "../db";

/** Normalize review row for JSON (bigint ids, counts, booleans). */
function reviewForClient(row: Record<string, unknown>) {
  return {
    ...row,
    id: row.id != null ? String(row.id) : row.id,
    likes_count: Number(row.likes_count ?? 0),
    liked_by_me:
      row.liked_by_me === true ||
      row.liked_by_me === "t" ||
      row.liked_by_me === "true" ||
      row.liked_by_me === 1,
  };
}

export const publicController = {
  exhibitions: async (_req: Request, res: Response) => {
    const r = await pool.query(
      `SELECT slug, title, description, cover_url
       FROM exhibitions
       WHERE is_published = TRUE
       ORDER BY created_at DESC`
    );
    res.json(r.rows);
  },

  pointsByExhibition: async (req: Request, res: Response) => {
    const { expoSlug } = req.params;

    const expo = await pool.query(
      `SELECT id, slug, title, description, cover_url
       FROM exhibitions
       WHERE slug = $1 AND is_published = TRUE`,
      [expoSlug]
    );

    if (expo.rowCount === 0) {
      return res.status(404).json({ message: "Exhibition not found" });
    }

    let points;
    try {
      points = await pool.query(
        `SELECT
           p.slug,
           p.title,
           p.description,
           p.image_url,
           p.audio_url,
           ROUND(AVG(pr.rating)::numeric, 1) AS average_rating,
           COUNT(pr.id)::int AS reviews_count
         FROM points p
         LEFT JOIN point_reviews pr ON pr.point_id = p.id
         WHERE p.exhibition_id = $1 AND p.is_published = TRUE
         GROUP BY p.id
         ORDER BY p.sort_order ASC, p.created_at DESC`,
        [expo.rows[0].id]
      );
    } catch (error: any) {
      if (error?.code === "42P01") {
        points = await pool.query(
          `SELECT
             slug,
             title,
             description,
             image_url,
             audio_url,
             NULL::numeric AS average_rating,
             0::int AS reviews_count
           FROM points
           WHERE exhibition_id = $1 AND is_published = TRUE
           ORDER BY sort_order ASC, created_at DESC`,
          [expo.rows[0].id]
        );
      } else {
        throw error;
      }
    }

    res.json({
      exhibition: expo.rows[0],
      points: points.rows,
    });
  },

  // Все опубликованные точки всех опубликованных экспозиций
  allPoints: async (_req: Request, res: Response) => {
    let r;
    try {
      r = await pool.query(
        `SELECT
           p.slug,
           p.title,
           p.description,
           p.image_url,
           p.audio_url,
           e.slug  AS exhibition_slug,
           e.title AS exhibition_title,
           ROUND(AVG(pr.rating)::numeric, 1) AS average_rating,
           COUNT(pr.id)::int AS reviews_count
         FROM points p
         JOIN exhibitions e ON e.id = p.exhibition_id
         LEFT JOIN point_reviews pr ON pr.point_id = p.id
         WHERE p.is_published = TRUE
           AND e.is_published = TRUE
         GROUP BY p.id, e.slug, e.title
         ORDER BY e.slug, p.sort_order ASC, p.created_at DESC`
      );
    } catch (error: any) {
      if (error?.code === "42P01") {
        r = await pool.query(
          `SELECT 
             p.slug,
             p.title,
             p.description,
             p.image_url,
             p.audio_url,
             e.slug  AS exhibition_slug,
             e.title AS exhibition_title,
             NULL::numeric AS average_rating,
             0::int AS reviews_count
           FROM points p
           JOIN exhibitions e ON e.id = p.exhibition_id
           WHERE p.is_published = TRUE
             AND e.is_published = TRUE
           ORDER BY e.slug, p.sort_order ASC, p.created_at DESC`
        );
      } else {
        throw error;
      }
    }

    res.json({ points: r.rows });
  },

  // Получить одну точку по slug экспозиции и slug точки
  pointBySlug: async (req: Request, res: Response) => {
    const { exhibition, slug } = req.params;

    // находим экспозицию по slug (только опубликованные)
    const expo = await pool.query(
      `SELECT id
       FROM exhibitions
       WHERE slug = $1 AND is_published = TRUE`,
      [exhibition]
    );

    if (expo.rowCount === 0) {
      return res.status(404).json({ message: "Exhibition not found" });
    }

    const point = await pool.query(
      `SELECT title, description, image_url, audio_url
       FROM points
       WHERE exhibition_id = $1
         AND slug = $2
         AND is_published = TRUE`,
      [expo.rows[0].id, slug]
    );

    if (point.rowCount === 0) {
      return res.status(404).json({ message: "Point not found" });
    }

    res.json(point.rows[0]);
  },

  listPointReviews: async (req: Request, res: Response) => {
    const { expoSlug, pointSlug } = req.params;

    try {
      const point = await pool.query(
        `SELECT p.id
         FROM points p
         JOIN exhibitions e ON e.id = p.exhibition_id
         WHERE e.slug = $1
           AND e.is_published = TRUE
           AND p.slug = $2
           AND p.is_published = TRUE`,
        [expoSlug, pointSlug]
      );

      if (point.rowCount === 0) {
        return res.status(404).json({ message: "Point not found" });
      }

      const pointId = point.rows[0].id as number;
      const likerRaw = String(req.query.likerAuthorId ?? "").trim();
      const likerParam = likerRaw.length > 0 ? likerRaw : null;

      const likesSelect = `
        COALESCE(lc.cnt, 0)::int AS likes_count,
        (my.review_id IS NOT NULL) AS liked_by_me
      `;
      const likesJoin = `
        LEFT JOIN (
          SELECT review_id, COUNT(*)::int AS cnt
          FROM point_review_likes
          GROUP BY review_id
        ) lc ON lc.review_id = pr.id
        LEFT JOIN point_review_likes my
          ON my.review_id = pr.id
          AND $2::text IS NOT NULL
          AND my.author_id = $2::text
      `;

      let reviews;
      try {
        reviews = await pool.query(
          `SELECT pr.id, pr.author_id, pr.rating, pr.text, pr.voice_data_url, pr.photo_data_url, pr.created_at,
                  ${likesSelect}
           FROM point_reviews pr
           ${likesJoin}
           WHERE pr.point_id = $1
           ORDER BY pr.created_at DESC`,
          [pointId, likerParam]
        );
      } catch (innerError: any) {
        if (innerError?.code === "42703") {
          try {
            reviews = await pool.query(
              `SELECT pr.id, pr.author_id, pr.rating, pr.text, pr.voice_data_url, NULL::text AS photo_data_url, pr.created_at,
                      ${likesSelect}
               FROM point_reviews pr
               ${likesJoin}
               WHERE pr.point_id = $1
               ORDER BY pr.created_at DESC`,
              [pointId, likerParam]
            );
          } catch (inner2: any) {
            if (
              inner2?.code === "42P01" &&
              String(inner2?.message ?? "").includes("point_review_likes")
            ) {
              reviews = await pool.query(
                `SELECT id, author_id, rating, text, voice_data_url, NULL::text AS photo_data_url, created_at
                 FROM point_reviews
                 WHERE point_id = $1
                 ORDER BY created_at DESC`,
                [pointId]
              );
              reviews.rows = reviews.rows.map((row: any) => ({
                ...row,
                likes_count: 0,
                liked_by_me: false,
              }));
            } else {
              throw inner2;
            }
          }
        } else if (
          innerError?.code === "42P01" &&
          String(innerError?.message ?? "").includes("point_review_likes")
        ) {
          try {
            reviews = await pool.query(
              `SELECT id, author_id, rating, text, voice_data_url, photo_data_url, created_at
               FROM point_reviews
               WHERE point_id = $1
               ORDER BY created_at DESC`,
              [pointId]
            );
          } catch (noPhoto: any) {
            if (noPhoto?.code === "42703") {
              reviews = await pool.query(
                `SELECT id, author_id, rating, text, voice_data_url, NULL::text AS photo_data_url, created_at
                 FROM point_reviews
                 WHERE point_id = $1
                 ORDER BY created_at DESC`,
                [pointId]
              );
            } else {
              throw noPhoto;
            }
          }
          reviews.rows = reviews.rows.map((row: any) => ({
            ...row,
            likes_count: 0,
            liked_by_me: false,
          }));
        } else {
          throw innerError;
        }
      }

      return res.json({
        reviews: reviews.rows.map((row) => reviewForClient(row as Record<string, unknown>)),
      });
    } catch (error: any) {
      // If table does not exist in current DB, return empty list instead of 500.
      if (error?.code === "42P01") {
        return res.json({ reviews: [] });
      }
      console.error("listPointReviews error:", error);
      return res.status(500).json({ message: "Failed to load reviews" });
    }
  },

  createPointReview: async (req: Request, res: Response) => {
    const { expoSlug, pointSlug } = req.params;
    const rating = Number(req.body?.rating ?? 0);
    const text = String(req.body?.text ?? "").trim();
    const authorId = String(req.body?.authorId ?? "").trim();
    const voiceDataUrlRaw = req.body?.voiceDataUrl;
    const voiceDataUrl =
      typeof voiceDataUrlRaw === "string" && voiceDataUrlRaw.trim().length > 0
        ? voiceDataUrlRaw.trim()
        : null;
    const photoDataUrlRaw = req.body?.photoDataUrl;
    const photoDataUrl =
      typeof photoDataUrlRaw === "string" && photoDataUrlRaw.trim().length > 0
        ? photoDataUrlRaw.trim()
        : null;

    if (!authorId || authorId.length > 128) {
      return res.status(400).json({ message: "Invalid author id" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be from 1 to 5" });
    }
    if (text.length > 3000) {
      return res.status(400).json({ message: "Text max length is 3000 chars" });
    }
    if (voiceDataUrl && voiceDataUrl.length > 10_000_000) {
      return res.status(400).json({ message: "Voice message is too large" });
    }
    if (photoDataUrl && photoDataUrl.length > 10_000_000) {
      return res.status(400).json({ message: "Photo is too large" });
    }

    try {
      const point = await pool.query(
        `SELECT p.id
         FROM points p
         JOIN exhibitions e ON e.id = p.exhibition_id
         WHERE e.slug = $1
           AND e.is_published = TRUE
           AND p.slug = $2
           AND p.is_published = TRUE`,
        [expoSlug, pointSlug]
      );

      if (point.rowCount === 0) {
        return res.status(404).json({ message: "Point not found" });
      }

      let created;
      try {
        created = await pool.query(
          `INSERT INTO point_reviews(point_id, author_id, rating, text, voice_data_url, photo_data_url)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, author_id, rating, text, voice_data_url, photo_data_url, created_at`,
          [point.rows[0].id, authorId, rating, text, voiceDataUrl, photoDataUrl]
        );
      } catch (e: any) {
        if (e?.code === "42703") {
          // photo_data_url column missing in older DB schema
          created = await pool.query(
            `INSERT INTO point_reviews(point_id, author_id, rating, text, voice_data_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, author_id, rating, text, voice_data_url, NULL::text AS photo_data_url, created_at`,
            [point.rows[0].id, authorId, rating, text, voiceDataUrl]
          );
        } else {
          throw e;
        }
      }

      const row = created.rows[0] as Record<string, unknown>;
      return res.status(201).json({
        review: reviewForClient({
          ...row,
          likes_count: 0,
          liked_by_me: false,
        }),
      });
    } catch (error: any) {
      if (error?.code === "42P01") {
        return res.status(503).json({
          message: "Reviews table is not available in current database",
        });
      }
      console.error("createPointReview error:", error);
      return res.status(500).json({ message: "Failed to save review" });
    }
  },

  toggleReviewLike: async (req: Request, res: Response) => {
    const { expoSlug, pointSlug, reviewId } = req.params;
    const authorId = String(req.body?.authorId ?? "").trim();
    const ridRaw = String(reviewId ?? "").trim();

    if (!/^\d+$/.test(ridRaw) || ridRaw.length > 19) {
      return res.status(400).json({ message: "Invalid review id" });
    }
    if (!authorId || authorId.length > 128) {
      return res.status(400).json({ message: "Invalid author id" });
    }

    try {
      const found = await pool.query(
        `SELECT pr.id
         FROM point_reviews pr
         JOIN points p ON p.id = pr.point_id
         JOIN exhibitions e ON e.id = p.exhibition_id
         WHERE e.slug = $1
           AND e.is_published = TRUE
           AND p.slug = $2
           AND p.is_published = TRUE
           AND pr.id = $3::bigint`,
        [expoSlug, pointSlug, ridRaw]
      );

      if (found.rowCount === 0) {
        return res.status(404).json({ message: "Review not found" });
      }

      const del = await pool.query(
        `DELETE FROM point_review_likes WHERE review_id = $1::bigint AND author_id = $2 RETURNING id`,
        [ridRaw, authorId]
      );

      if ((del.rowCount ?? 0) > 0) {
        const c = await pool.query(
          `SELECT COUNT(*)::int AS n FROM point_review_likes WHERE review_id = $1::bigint`,
          [ridRaw]
        );
        return res.json({ liked: false, likes_count: Number(c.rows[0].n) });
      }

      try {
        await pool.query(
          `INSERT INTO point_review_likes(review_id, author_id) VALUES ($1::bigint, $2)`,
          [ridRaw, authorId]
        );
      } catch (ins: any) {
        if (ins?.code !== "23505") throw ins;
      }

      const c2 = await pool.query(
        `SELECT COUNT(*)::int AS n FROM point_review_likes WHERE review_id = $1::bigint`,
        [ridRaw]
      );
      const mine = await pool.query(
        `SELECT 1 FROM point_review_likes WHERE review_id = $1::bigint AND author_id = $2`,
        [ridRaw, authorId]
      );
      return res.json({
        liked: (mine.rowCount ?? 0) > 0,
        likes_count: Number(c2.rows[0].n),
      });
    } catch (error: any) {
      if (error?.code === "42P01") {
        return res.status(503).json({
          message: "Review likes are not available in current database",
        });
      }
      console.error("toggleReviewLike error:", error);
      return res.status(500).json({ message: "Failed to update like" });
    }
  },

  createFeedback: async (req: Request, res: Response) => {
    const kindRaw = String(req.body?.kind ?? "other").trim().toLowerCase();
    const kind =
      kindRaw === "wish" || kindRaw === "issue" || kindRaw === "other"
        ? kindRaw
        : "other";
    const message = String(req.body?.message ?? "").trim();
    const contact = String(req.body?.contact ?? "").trim();
    const voiceDataUrlRaw = req.body?.voiceDataUrl;
    const voiceDataUrl =
      typeof voiceDataUrlRaw === "string" && voiceDataUrlRaw.trim().length > 0
        ? voiceDataUrlRaw.trim()
        : null;
    const photoDataUrlRaw = req.body?.photoDataUrl;
    const photoDataUrl =
      typeof photoDataUrlRaw === "string" && photoDataUrlRaw.trim().length > 0
        ? photoDataUrlRaw.trim()
        : null;
    const sourcePath = String(req.body?.sourcePath ?? "").trim();
    const expoSlug = String(req.body?.expoSlug ?? "").trim();
    const parseOptionalInt = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      const rounded = Math.trunc(n);
      return rounded >= 0 ? rounded : null;
    };
    const completedPoints = parseOptionalInt(req.body?.completedPoints);
    const totalPoints = parseOptionalInt(req.body?.totalPoints);

    if (!message && !voiceDataUrl && !photoDataUrl) {
      return res.status(400).json({
        message: "Добавьте текст, голосовое или фото для обратной связи",
      });
    }
    if (message.length > 0 && message.length < 3) {
      return res.status(400).json({ message: "Опишите обратную связь подробнее" });
    }
    if (message.length > 5000) {
      return res.status(400).json({ message: "Текст слишком длинный (до 5000 символов)" });
    }
    if (contact.length > 500) {
      return res.status(400).json({ message: "Контакт слишком длинный" });
    }
    if (voiceDataUrl && voiceDataUrl.length > 10_000_000) {
      return res.status(400).json({ message: "Голосовое сообщение слишком большое" });
    }
    if (photoDataUrl && photoDataUrl.length > 10_000_000) {
      return res.status(400).json({ message: "Фото слишком большое" });
    }
    if (sourcePath.length > 500) {
      return res.status(400).json({ message: "Служебный путь слишком длинный" });
    }
    if (expoSlug.length > 200) {
      return res.status(400).json({ message: "Некорректный slug экспозиции" });
    }

    try {
      try {
        await pool.query(
          `INSERT INTO feedback_messages
             (kind, message, contact, voice_data_url, photo_data_url, source_path, expo_slug, completed_points, total_points)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            kind,
            message,
            contact || null,
            voiceDataUrl,
            photoDataUrl,
            sourcePath || null,
            expoSlug || null,
            completedPoints,
            totalPoints,
          ]
        );
      } catch (innerError: any) {
        if (innerError?.code === "42703") {
          await pool.query(
            `INSERT INTO feedback_messages
               (kind, message, contact, source_path, expo_slug, completed_points, total_points)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              kind,
              message,
              contact || null,
              sourcePath || null,
              expoSlug || null,
              completedPoints,
              totalPoints,
            ]
          );
        } else {
          throw innerError;
        }
      }
      return res.status(201).json({ ok: true });
    } catch (error: any) {
      if (error?.code === "42P01") {
        return res.status(503).json({
          message: "Feedback table is not available in current database",
        });
      }
      console.error("createFeedback error:", error);
      return res.status(500).json({ message: "Failed to save feedback" });
    }
  },
};
