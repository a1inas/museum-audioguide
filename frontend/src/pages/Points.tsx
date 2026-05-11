import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "../ui/Layout";
import { ButtonLink } from "../ui/ButtonLink";
import { FavoriteHeartIcon } from "../ui/FavoriteHeartIcon";

type Point = {
  slug: string;
  title: string;
  description: string;
  image_url: string;
  audio_url: string;
  average_rating?: number | string | null;
  reviews_count?: number;
};

const FAV_KEY = "iziumGuide_favorites";
const FEEDBACK_HIDE_UNTIL_KEY = "iziumGuide_feedbackHideUntil";
const FEEDBACK_SENT_FOR_ROUTE_KEY = "iziumGuide_feedbackSentForRoute";

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

export function Points() {
  const { expoSlug } = useParams();
  const [q, setQ] = useState("");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressVersion, setProgressVersion] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/public/exhibitions/${expoSlug}/points`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setPoints(data.points as Point[]);
      })
      .catch((e) => setError(e.message));

    setFavoriteIds(readFavoriteIds());
  }, [expoSlug]);

  const filtered = useMemo(() => {
    if (!points) return [];
    const s = q.trim().toLowerCase();
    if (!s) return points;
    return points.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s)
    );
  }, [points, q]);

  const { completedCount, totalCount, percent, listenedSet } = useMemo(() => {
    if (!points || points.length === 0) {
      return {
        completedCount: 0,
        totalCount: 0,
        percent: 0,
        listenedSet: new Set<string>(),
      };
    }
    let listened: string[] = [];
    try {
      const raw = window.localStorage.getItem("iziumGuide_listenedPoints");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          listened = parsed.filter((x) => typeof x === "string");
        }
      }
    } catch {
      // игнорируем ошибки чтения
    }
    const set = new Set(listened);
    const done = points.filter((p) => set.has(p.slug)).length;
    const total = points.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { completedCount: done, totalCount: total, percent: pct, listenedSet: set };
  }, [points, progressVersion]);

  useEffect(() => {
    if (!totalCount || percent < 100) return;
    try {
      const sentRoute = window.localStorage.getItem(FEEDBACK_SENT_FOR_ROUTE_KEY);
      if (sentRoute === `${expoSlug ?? ""}:${totalCount}`) return;
      const hiddenUntilRaw = window.localStorage.getItem(FEEDBACK_HIDE_UNTIL_KEY) ?? "0";
      const hiddenUntil = Number(hiddenUntilRaw);
      if (Number.isFinite(hiddenUntil) && hiddenUntil > Date.now()) return;
    } catch {
      // ignore localStorage errors
    }
    try {
      window.dispatchEvent(
        new CustomEvent("izium-route-completed", {
          detail: {
            expoSlug: expoSlug ?? "",
            completedPoints: completedCount,
            totalPoints: totalCount,
          },
        }),
      );
    } catch {
      // ignore
    }
  }, [expoSlug, percent, totalCount]);

  const clearProgress = () => {
    try {
      window.localStorage.removeItem("iziumGuide_listenedPoints");
    } catch {
      // игнорируем
    }
    setProgressVersion((v) => v + 1);
  };

  const toggleFavorite = (slug: string) => {
    if (!expoSlug) return;
    const id = `${expoSlug}:${slug}`;
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      writeFavoriteIds(next);
      return next;
    });
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
  }, [filtered.length]);

  return (
    <Layout title="Точки" fullBleed>
      <section
        style={{
          position: "relative",
          minHeight: "100%",
          backgroundColor: "#020617",
        }}
      >
        {/* Фон с фотографией музея */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: 'url("/points-bg.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center top",
            opacity: 0.45,
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

            {totalCount > 0 && (
              <div
                style={{
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 13,
                    color: "var(--muted)",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    Прогресс маршрута:{" "}
                    <strong>
                      {completedCount} из {totalCount} точек
                    </strong>
                  </span>
                  <span>{percent}%</span>
                </div>
                <div style={{ marginTop: 6, width: "100%" }}>
                  <div className="route-segments">
                    {Array.from({ length: totalCount }).map((_, idx) => {
                      const threshold = ((idx + 1) / totalCount) * 100;
                      const active = percent >= threshold;
                      return (
                        <span
                          key={idx}
                          className={
                            "route-segment" +
                            (active ? " route-segment--active" : "")
                          }
                        />
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearProgress}
                  className="progress-reset"
                  style={{ marginTop: 6, marginLeft: "auto", display: "block" }}
                >
                  Сбросить прогресс маршрута
                </button>
              </div>
            )}

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск…"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border-strong)",
                background: "transparent",
                color: "#24160b",
                outline: "none",
              }}
            />

            {error && <p style={{ color: "crimson" }}>Ошибка: {error}</p>}
            {!points && !error && (
              <p style={{ color: "var(--muted)" }}>Загрузка…</p>
            )}

            {points && (
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {filtered.map((p) => {
                  const isListened = listenedSet.has(p.slug);
                  const averageRating =
                    p.average_rating == null ? null : Number(p.average_rating);
                  const hasRating =
                    Number.isFinite(averageRating) && (p.reviews_count ?? 0) > 0;
                  return (
                  <div
                    key={p.slug}
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
                            <span className="point-rating-badge" title={`Оценка ${averageRating.toFixed(1)} из 5`}>
                              ★ {averageRating.toFixed(1)}
                            </span>
                          )}
                          {isListened && (
                            <span className="point-listened-badge">
                              прослушано
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(p.slug)}
                          className={
                            "favorite-star" +
                            (favoriteIds.includes(
                              `${expoSlug}:${p.slug}`,
                            )
                              ? " favorite-star--active"
                              : "")
                          }
                          aria-label={
                            favoriteIds.includes(`${expoSlug}:${p.slug}`)
                              ? "Убрать из избранного"
                              : "Добавить в избранное"
                          }
                        >
                          <FavoriteHeartIcon />
                        </button>
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
                        <ButtonLink to={`/g/${expoSlug}/p/${p.slug}`}>
                          Открыть точку
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                  );
                })}

                {filtered.length === 0 && (
                  <p style={{ color: "var(--muted)" }}>Ничего не найдено.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
