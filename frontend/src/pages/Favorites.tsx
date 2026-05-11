import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../ui/Layout";
import { ButtonLink } from "../ui/ButtonLink";
import { FavoriteHeartIcon } from "../ui/FavoriteHeartIcon";

type PublicPoint = {
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  audio_url: string | null;
  exhibition_slug: string;
  exhibition_title: string;
  average_rating?: number | string | null;
  reviews_count?: number;
};

const FAV_KEY = "iziumGuide_favorites";

function readFavoriteIds(): string[] {
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string");
  } catch {
    return [];
  }
}

function writeFavoriteIds(ids: string[]) {
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function FavoritesPage() {
  const [points, setPoints] = useState<PublicPoint[] | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listenedSet, setListenedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavoriteIds(readFavoriteIds());
    fetch("/api/public/points")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setPoints((data.points ?? []) as PublicPoint[]);
      })
      .catch((e) => setError(e.message));

    // читаем прослушанные точки
    try {
      const raw = window.localStorage.getItem("iziumGuide_listenedPoints");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setListenedSet(
            new Set(parsed.filter((x: unknown) => typeof x === "string")),
          );
        }
      }
    } catch {
      setListenedSet(new Set());
    }
  }, []);

  const favoritePoints = useMemo(() => {
    if (!points || favoriteIds.length === 0) return [];
    const favSet = new Set(favoriteIds);
    return points.filter((p) =>
      favSet.has(`${p.exhibition_slug}:${p.slug}`),
    );
  }, [points, favoriteIds]);

  const toggleFavorite = (p: PublicPoint) => {
    const id = `${p.exhibition_slug}:${p.slug}`;
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      writeFavoriteIds(next);
      return next;
    });
  };

  const clearAllFavorites = () => {
    writeFavoriteIds([]);
    setFavoriteIds([]);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-on-scroll--visible");
          } else {
            entry.target.classList.remove("reveal-on-scroll--visible");
          }
        });
      },
      { threshold: 0.15 },
    );

    const elements = document.querySelectorAll<HTMLElement>(".reveal-on-scroll");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [favoritePoints.length]);

  return (
    <Layout title="Избранное" fullBleed>
      <section
        style={{
          position: "relative",
          minHeight: "100%",
          backgroundColor: "#e8e0d5",
        }}
      >
        {/* Фон страницы избранного (декоративный) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 22%, rgba(255, 248, 228, 0.68) 0%, rgba(255, 248, 228, 0) 34%)," +
              "radial-gradient(circle at 86% 16%, rgba(186, 138, 83, 0.36) 0%, rgba(186, 138, 83, 0) 42%)," +
              "radial-gradient(circle at 78% 84%, rgba(146, 101, 58, 0.32) 0%, rgba(146, 101, 58, 0) 40%)," +
              "radial-gradient(circle at 8% 80%, rgba(190, 147, 100, 0.26) 0%, rgba(190, 147, 100, 0) 36%)," +
              "repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.04) 0 2px, rgba(255, 255, 255, 0) 2px 12px)," +
              "linear-gradient(145deg, #e3c79b 0%, #c99f6d 50%, #a7754c 100%)",
          }}
        />

        {/* Контент поверх фона */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "clamp(16px, 3vw, 26px) clamp(10px, 3vw, 16px) clamp(22px, 4vw, 32px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 860,
              margin: "0 auto",
              padding: "clamp(14px, 2.8vw, 22px) clamp(14px, 2.8vw, 22px) clamp(20px, 3.8vw, 30px)",
              borderRadius: 26,
              background: "rgba(255, 249, 238, 0.35)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <Link to="/" className="back-link">
              ← На главную
            </Link>

            <div style={{ height: 12 }} />

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(22px, 4.5vw, 28px)",
                fontWeight: 750,
                letterSpacing: "0.02em",
                color: "inherit",
              }}
            >
              Избранное
            </h1>
            <p
              style={{
                color: "var(--muted)",
                maxWidth: 520,
                marginTop: 8,
                marginBottom: 0,
                fontSize: 14,
                lineHeight: 1.45,
              }}
            >
              Здесь сохраняются точки маршрута, которые вы отметили сердечком.
            </p>

            <div style={{ height: 12 }} />

            {points && favoritePoints.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  onClick={clearAllFavorites}
                  className="progress-reset"
                >
                  Очистить избранное
                </button>
              </div>
            )}

            {error && <p style={{ color: "crimson" }}>Ошибка: {error}</p>}
            {!points && !error && (
              <p style={{ color: "var(--muted)" }}>Загрузка избранных точек…</p>
            )}

            {points && favoritePoints.length === 0 && (
              <p style={{ color: "var(--muted)", marginTop: 8 }}>
                Пока здесь пусто. Отметьте звёздочкой интересные точки на
                странице маршрута, и они появятся в этом списке.
              </p>
            )}

            {points && favoritePoints.length > 0 && (
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {favoritePoints.map((p) => (
                  (() => {
                    const averageRating =
                      p.average_rating == null ? null : Number(p.average_rating);
                    const hasRating =
                      Number.isFinite(averageRating) && (p.reviews_count ?? 0) > 0;
                    return (
                  <div
                    key={`${p.exhibition_slug}:${p.slug}`}
                    className="reveal-on-scroll points-list-card"
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "stretch",
                      background:
                        "linear-gradient(135deg, rgba(251,244,230,0.72), rgba(240,221,192,0.68))",
                      borderRadius: "var(--radius)",
                      padding: 10,
                      boxShadow: "var(--shadow-soft)",
                    }}
                  >
                    {/* Мини‑превью фото */}
                    <div
                      className="points-list-card__thumb"
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 14,
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "1px solid var(--border)",
                        background: "rgba(0,0,0,0.05)",
                      }}
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            color: "var(--muted)",
                            padding: 4,
                            textAlign: "center",
                          }}
                        >
                          Фото&nbsp;нет
                        </div>
                      )}
                    </div>

                    {/* Текст и кнопка */}
                    <div className="points-list-card__content" style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="points-list-card__header"
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          className="points-list-card__title-row"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <div className="points-list-card__title" style={{ fontSize: 16, fontWeight: 750 }}>
                            {p.title}
                          </div>
                          {hasRating && averageRating !== null && (
                            <span
                              className="point-rating-badge"
                              title={`Оценка ${averageRating.toFixed(1)} из 5`}
                            >
                              ★ {averageRating.toFixed(1)}
                            </span>
                          )}
                          {listenedSet.has(p.slug) && (
                            <span className="point-listened-badge">
                              прослушано
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(p)}
                          className="favorite-star favorite-star--active"
                          aria-label="Убрать из избранного"
                        >
                          <FavoriteHeartIcon />
                        </button>
                      </div>
                      <div
                        style={{
                          color: "var(--muted)",
                          fontSize: 13,
                          marginTop: 2,
                        }}
                      >
                        {p.exhibition_title}
                      </div>
                      <div
                        className="points-list-card__desc"
                        style={{
                          color: "var(--muted)",
                          marginTop: 4,
                          fontSize: 14,
                        }}
                      >
                        {p.description}
                      </div>

                      <div className="points-list-card__action" style={{ marginTop: 10 }}>
                        <ButtonLink to={`/g/${p.exhibition_slug}/p/${p.slug}`}>
                          Открыть точку
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

