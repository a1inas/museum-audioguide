import { Request, Response } from "express";
import { pool } from "../db";
import fs from "fs/promises";
import path from "path";

function getUploadsDir() {
  // backend/src/controllers -> backend/uploads
  return path.join(__dirname, "..", "..", "uploads");
}

export async function tryDeleteUploadsFile(url: string | null) {
  if (!url) return;
  if (!url.startsWith("/uploads/")) return;

  const uploadsDir = getUploadsDir();

  // убираем префикс /uploads/ и получаем относительный путь: images/..., audio/...
  const relPath = url.replace(/^\/uploads\//, "");
  const filePath = path.normalize(path.join(uploadsDir, relPath));

  // Защита: не выходим за пределы каталога uploads
  if (!filePath.startsWith(uploadsDir)) return;

  try {
    await fs.unlink(filePath);
  } catch {
    // файл мог отсутствовать — не критично
  }
}

export const deletePoint = async (req: Request, res: Response) => {
  const slug = req.params.slug;

  try {
    // удаляем запись и забираем audio_url + image_url чтобы удалить файлы
    const r = await pool.query(
      `DELETE FROM points
       WHERE slug = $1
       RETURNING audio_url, image_url`,
      [slug]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Точка не найдена" });
    }

    const audioUrl: string | null = r.rows[0]?.audio_url ?? null;
    const imageUrl: string | null = r.rows[0]?.image_url ?? null;

    await tryDeleteUploadsFile(audioUrl);
    await tryDeleteUploadsFile(imageUrl);

    return res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

export async function listPoints(_req: Request, res: Response) {
  const q = `
    SELECT 
      p.id,
      p.slug,
      p.title,
      p.description,
      p.image_url,
      p.audio_url,
      p.sort_order,
      e.slug AS exhibition_slug,
      e.title AS exhibition_title
    FROM points p
    JOIN exhibitions e ON e.id = p.exhibition_id
    ORDER BY e.slug, p.sort_order ASC, p.created_at DESC
  `;
  const { rows } = await pool.query(q);
  res.json({ ok: true, points: rows });
}

export async function createPoint(req: Request, res: Response) {
  const { exhibition_slug, slug, title, description } = req.body ?? {};

  if (!exhibition_slug || !slug || !title) {
    return res.status(400).json({
      ok: false,
      error: "Нужно передать exhibition_slug, slug, title",
    });
  }

  const findExpo = await pool.query("SELECT id FROM exhibitions WHERE slug = $1", [
    exhibition_slug,
  ]);

  if (findExpo.rowCount === 0) {
    return res.status(404).json({ ok: false, error: "Экспозиция не найдена" });
  }

  const exhibition_id = findExpo.rows[0].id as number;

  const nextOrderResult = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM points
     WHERE exhibition_id = $1`,
    [exhibition_id]
  );
  const nextOrder = Number(nextOrderResult.rows[0]?.next_order ?? 0);

  const ins = await pool.query(
    `
    INSERT INTO points (exhibition_id, slug, title, description, sort_order)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING slug, title, description, image_url, audio_url, sort_order
    `,
    [exhibition_id, slug, title, description ?? "", nextOrder]
  );

  res.status(201).json({ ok: true, point: ins.rows[0] });
}

export async function updatePoint(req: Request, res: Response) {
  const { slug } = req.params;
  const { title, description, image_url, audio_url } = req.body ?? {};

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (typeof title === "string") {
    fields.push(`title = $${idx++}`);
    values.push(title);
  }
  if (typeof description === "string") {
    fields.push(`description = $${idx++}`);
    values.push(description);
  }
  if (typeof image_url === "string") {
    fields.push(`image_url = $${idx++}`);
    values.push(image_url);
  }
  if (typeof audio_url === "string") {
    fields.push(`audio_url = $${idx++}`);
    values.push(audio_url);
  }

  if (fields.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "Передай хотя бы одно поле: title/description/image_url/audio_url",
    });
  }

  values.push(slug);

  const upd = await pool.query(
    `
    UPDATE points
    SET ${fields.join(", ")}
    WHERE slug = $${idx}
    RETURNING slug, title, description, image_url, audio_url, sort_order
    `,
    values
  );

  if (upd.rowCount === 0) {
    return res.status(404).json({ ok: false, error: "Точка не найдена" });
  }

  res.json({ ok: true, point: upd.rows[0] });
}

export async function reorderPoints(req: Request, res: Response) {
  const { exhibition_slug, ordered_slugs } = req.body ?? {};

  if (
    typeof exhibition_slug !== "string" ||
    !Array.isArray(ordered_slugs) ||
    ordered_slugs.some((slug) => typeof slug !== "string")
  ) {
    return res.status(400).json({
      ok: false,
      error: "Нужно передать exhibition_slug и ordered_slugs (массив slug)",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const expo = await client.query(
      `SELECT id FROM exhibitions WHERE slug = $1`,
      [exhibition_slug]
    );
    if (expo.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Экспозиция не найдена" });
    }
    const exhibitionId = expo.rows[0].id as number;

    const dbPoints = await client.query(
      `SELECT slug
       FROM points
       WHERE exhibition_id = $1
       ORDER BY sort_order ASC, created_at DESC`,
      [exhibitionId]
    );
    const dbSlugs = dbPoints.rows.map((row) => row.slug as string);

    if (dbSlugs.length !== ordered_slugs.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: "Количество точек в порядке не совпадает с базой",
      });
    }

    const dbSet = new Set(dbSlugs);
    const inputSet = new Set(ordered_slugs as string[]);
    if (
      dbSet.size !== inputSet.size ||
      dbSlugs.some((slug) => !inputSet.has(slug))
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: "Передан некорректный список slug для перестановки",
      });
    }

    for (let index = 0; index < ordered_slugs.length; index += 1) {
      const slug = ordered_slugs[index];
      await client.query(
        `UPDATE points
         SET sort_order = $1
         WHERE exhibition_id = $2 AND slug = $3`,
        [index, exhibitionId, slug]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  } finally {
    client.release();
  }
}


// ✅ удалить ТОЛЬКО аудио у точки
export async function deletePointAudio(req: Request, res: Response) {
  const { slug } = req.params;

  try {
    const cur = await pool.query(
      `SELECT audio_url FROM points WHERE slug = $1`,
      [slug]
    );

    if (cur.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Точка не найдена" });
    }

    const oldUrl: string | null = cur.rows[0]?.audio_url ?? null;

    await pool.query(
      `UPDATE points SET audio_url = NULL WHERE slug = $1`,
      [slug]
    );

    await tryDeleteUploadsFile(oldUrl);

    return res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// ✅ удалить ТОЛЬКО картинку у точки
export async function deletePointImage(req: Request, res: Response) {
  const { slug } = req.params;

  try {
    const cur = await pool.query(
      `SELECT image_url FROM points WHERE slug = $1`,
      [slug]
    );

    if (cur.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Точка не найдена" });
    }

    const oldUrl: string | null = cur.rows[0]?.image_url ?? null;

    await pool.query(
      `UPDATE points SET image_url = NULL WHERE slug = $1`,
      [slug]
    );

    await tryDeleteUploadsFile(oldUrl);

    return res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export async function listReviews(req: Request, res: Response) {
  const pointSlug = String(req.query.pointSlug ?? "").trim();

  try {
    const values: string[] = [];
    let whereSql = "";
    if (pointSlug) {
      values.push(pointSlug);
      whereSql = `WHERE p.slug = $1`;
    }

    const likesJoin = `
      LEFT JOIN (
        SELECT review_id, COUNT(*)::int AS cnt
        FROM point_review_likes
        GROUP BY review_id
      ) lc ON lc.review_id = pr.id
    `;
    const likesSelect = `COALESCE(lc.cnt, 0)::int AS likes_count`;
    const likesSelectZero = `0::int AS likes_count`;

    async function queryReviews(includePhotoUrl: boolean, includeLikesJoin: boolean) {
      const photoSelect = includePhotoUrl ? "pr.photo_data_url" : "NULL::text AS photo_data_url";
      const likesPart = includeLikesJoin ? likesSelect : likesSelectZero;
      const joinPart = includeLikesJoin ? likesJoin : "";
      const { rows } = await pool.query(
        `
        SELECT
          pr.id,
          pr.author_id,
          pr.rating,
          pr.text,
          pr.voice_data_url,
          ${photoSelect},
          pr.created_at,
          p.slug AS point_slug,
          p.title AS point_title,
          e.slug AS exhibition_slug,
          e.title AS exhibition_title,
          ${likesPart}
        FROM point_reviews pr
        ${joinPart}
        JOIN points p ON p.id = pr.point_id
        JOIN exhibitions e ON e.id = p.exhibition_id
        ${whereSql}
        ORDER BY pr.created_at DESC
        `,
        values
      );
      return rows;
    }

    let rows: any[];
    try {
      rows = await queryReviews(true, true);
    } catch (innerError: any) {
      if (innerError?.code === "42703") {
        try {
          rows = await queryReviews(false, true);
        } catch (inner2: any) {
          if (
            inner2?.code === "42P01" &&
            String(inner2?.message ?? "").includes("point_review_likes")
          ) {
            rows = await queryReviews(false, false);
          } else {
            throw inner2;
          }
        }
      } else if (
        innerError?.code === "42P01" &&
        String(innerError?.message ?? "").includes("point_review_likes")
      ) {
        try {
          rows = await queryReviews(true, false);
        } catch (inner2: any) {
          if (inner2?.code === "42703") {
            rows = await queryReviews(false, false);
          } else {
            throw inner2;
          }
        }
      } else {
        throw innerError;
      }
    }

    return res.json({
      ok: true,
      reviews: rows.map((r) => ({
        ...r,
        likes_count: Number(r.likes_count ?? 0),
      })),
    });
  } catch (e: any) {
    if (e?.code === "42P01") {
      return res.json({ ok: true, reviews: [] });
    }
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export async function deleteReview(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: "Некорректный id отзыва" });
  }

  try {
    const r = await pool.query(
      `DELETE FROM point_reviews WHERE id = $1 RETURNING id`,
      [id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Отзыв не найден" });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "42P01") {
      return res.status(503).json({ ok: false, error: "Таблица отзывов недоступна" });
    }
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export async function listFeedback(_req: Request, res: Response) {
  try {
    let rows;
    try {
      const result = await pool.query(
        `SELECT
           id,
           kind,
           message,
           contact,
           voice_data_url,
           photo_data_url,
           source_path,
           expo_slug,
           completed_points,
           total_points,
           created_at
         FROM feedback_messages
         ORDER BY created_at DESC`
      );
      rows = result.rows;
    } catch (innerError: any) {
      if (innerError?.code === "42703") {
        const result = await pool.query(
          `SELECT
             id,
             kind,
             message,
             contact,
             NULL::text AS voice_data_url,
             NULL::text AS photo_data_url,
             source_path,
             expo_slug,
             completed_points,
             total_points,
             created_at
           FROM feedback_messages
           ORDER BY created_at DESC`
        );
        rows = result.rows;
      } else {
        throw innerError;
      }
    }
    return res.json({ ok: true, feedback: rows });
  } catch (e: any) {
    if (e?.code === "42P01") {
      return res.json({ ok: true, feedback: [] });
    }
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export async function deleteFeedback(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: "Некорректный id сообщения" });
  }

  try {
    const r = await pool.query(
      `DELETE FROM feedback_messages WHERE id = $1 RETURNING id`,
      [id]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Сообщение не найдено" });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "42P01") {
      return res.status(503).json({ ok: false, error: "Таблица обратной связи недоступна" });
    }
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

