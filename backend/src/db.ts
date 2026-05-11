import { readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

function sqlDir(): string {
  return path.join(__dirname, "..", "sql");
}

async function runInitSqlFile(filename: string) {
  const full = path.join(sqlDir(), filename);
  const raw = readFileSync(full, "utf8");
  const withoutLineComments = raw
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  const statements = withoutLineComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

export const pool = hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

export async function pingDb() {
  const r = await pool.query("SELECT NOW() as now");
  return r.rows[0];
}

export async function ensureDbSchema() {
  try {
    await runInitSqlFile("001_init.sql");

    await pool.query(`
      ALTER TABLE points
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS point_reviews (
        id         BIGSERIAL PRIMARY KEY,
        point_id   BIGINT NOT NULL REFERENCES points(id) ON DELETE CASCADE,
        author_id  TEXT NOT NULL,
        rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text       TEXT NOT NULL,
        voice_data_url TEXT,
        photo_data_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE point_reviews
      ADD COLUMN IF NOT EXISTS voice_data_url TEXT
    `);

    await pool.query(`
      ALTER TABLE point_reviews
      ADD COLUMN IF NOT EXISTS photo_data_url TEXT
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_point_reviews_point_id_created_at
      ON point_reviews(point_id, created_at DESC)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS point_review_likes (
        id         BIGSERIAL PRIMARY KEY,
        review_id  BIGINT NOT NULL REFERENCES point_reviews(id) ON DELETE CASCADE,
        author_id  TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (review_id, author_id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_point_review_likes_review_id
      ON point_review_likes(review_id)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_messages (
        id               BIGSERIAL PRIMARY KEY,
        kind             TEXT NOT NULL,
        message          TEXT NOT NULL,
        contact          TEXT,
        voice_data_url   TEXT,
        photo_data_url   TEXT,
        source_path      TEXT,
        expo_slug        TEXT,
        completed_points INTEGER,
        total_points     INTEGER,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE feedback_messages
      ADD COLUMN IF NOT EXISTS voice_data_url TEXT
    `);

    await pool.query(`
      ALTER TABLE feedback_messages
      ADD COLUMN IF NOT EXISTS photo_data_url TEXT
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at
      ON feedback_messages(created_at DESC)
    `);
  } catch (error: any) {
    // In some environments DB user is not table owner.
    // If migration cannot run, continue startup and rely on existing schema.
    if (error?.code === "42501") {
      console.warn("Skipping schema auto-migration (insufficient privileges).");
      return;
    }
    throw error;
  }
}
