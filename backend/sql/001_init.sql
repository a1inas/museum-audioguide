-- 001_init.sql

CREATE TABLE IF NOT EXISTS exhibitions (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  cover_url    TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points (
  id            BIGSERIAL PRIMARY KEY,
  exhibition_id BIGINT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  image_url     TEXT NOT NULL DEFAULT '',
  audio_url     TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exhibition_id, slug)
);

CREATE TABLE IF NOT EXISTS point_reviews (
  id         BIGSERIAL PRIMARY KEY,
  point_id   BIGINT NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       TEXT NOT NULL,
  voice_data_url TEXT,
  photo_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_reviews_point_id_created_at
  ON point_reviews(point_id, created_at DESC);

CREATE TABLE IF NOT EXISTS point_review_likes (
  id         BIGSERIAL PRIMARY KEY,
  review_id  BIGINT NOT NULL REFERENCES point_reviews(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_point_review_likes_review_id
  ON point_review_likes(review_id);

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
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at
  ON feedback_messages(created_at DESC);
