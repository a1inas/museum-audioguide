import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../ui/Layout";

type Point = {
  slug: string;
  title: string;
  description: string;
  image_url: string;
  audio_url: string;
};

type MapMarker = {
  slug: string;
  x: number;
  y: number;
  accent: string;
};

type MappedPoint = MapMarker & {
  order: number;
  point: Point;
};

type MarkerDraft = MapMarker | null;

const EXHIBITION_SLUG = "polotsk-collegium";
const MAP_IMAGE_SRC = "/route-map-photo.png";
const EDITOR_ACCENTS = ["#8b5e34", "#356f91", "#8f4b93", "#4f8b47", "#c46b2d"];
const MAP_MARKERS_STORAGE_KEY = "iziumGuide_mapMarkers";

const MAP_MARKERS: MapMarker[] = [
  { slug: "magic-piano", x: 35.73, y: 54.54, accent: "#8b5e34" },
  { slug: "gabriel-gruber", x: 41.72, y: 59.38, accent: "#356f91" },
  { slug: "open-air-gallery", x: 39.42, y: 46.43, accent: "#8f4b93" },
  { slug: "wittgenstein-cannonball", x: 34.33, y: 36.26, accent: "#4f8b47" },
  { slug: "talking-head", x: 56.5, y: 59.58, accent: "#c46b2d" },
  { slug: "courtyard-well", x: 46.43, y: 50.03, accent: "#8b5e34" },
  { slug: "musical-clock", x: 44.39, y: 44.52, accent: "#356f91" },
  { slug: "catherine-staircase", x: 57.26, y: 40.16, accent: "#8f4b93" },
  { slug: "rector-entrance", x: 60.07, y: 49.52, accent: "#4f8b47" },
  { slug: "student-professor", x: 65.42, y: 77.68, accent: "#c46b2d" },
];

const INITIAL_MARKERS_BY_SLUG = new Map(MAP_MARKERS.map((marker) => [marker.slug, marker]));
const FALLBACK_POINTS: Point[] = [
  {
    slug: "magic-piano",
    title: "Живой рояль",
    description: "Музыкальная точка маршрута.",
    image_url: "",
    audio_url: "",
  },
  {
    slug: "gabriel-gruber",
    title: "Экспозиция Габриэля Грубера",
    description: "Одна из ключевых точек экспозиции.",
    image_url: "",
    audio_url: "",
  },
];

function normalizePoints(input: unknown): Point[] {
  if (!Array.isArray(input)) return [];

  return input.filter((item): item is Point => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Point).slug === "string" &&
      typeof (item as Point).title === "string" &&
      typeof (item as Point).description === "string" &&
      typeof (item as Point).image_url === "string" &&
      typeof (item as Point).audio_url === "string"
    );
  });
}

function readStoredMarkers(): MapMarker[] {
  try {
    const raw = window.localStorage.getItem(MAP_MARKERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is MapMarker => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as MapMarker).slug === "string" &&
        typeof (item as MapMarker).x === "number" &&
        typeof (item as MapMarker).y === "number" &&
        typeof (item as MapMarker).accent === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeStoredMarkers(markers: MapMarker[]) {
  try {
    window.localStorage.setItem(MAP_MARKERS_STORAGE_KEY, JSON.stringify(markers));
  } catch {
    // ignore
  }
}

function MapContent(props: { editable: boolean }) {
  const { editable } = props;
  const [points, setPoints] = useState<Point[]>(FALLBACK_POINTS);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draftMarkers, setDraftMarkers] = useState<Record<string, MarkerDraft>>({});
  const [selectedSlug, setSelectedSlug] = useState("");
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [isAdminEditEnabled, setIsAdminEditEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const previewHideTimerRef = useRef<number | null>(null);
  const isEditing = editable && isAdminEditEnabled;

  const clearPreviewHideTimer = () => {
    if (previewHideTimerRef.current != null) {
      window.clearTimeout(previewHideTimerRef.current);
      previewHideTimerRef.current = null;
    }
  };

  const schedulePreviewHide = () => {
    clearPreviewHideTimer();
    previewHideTimerRef.current = window.setTimeout(() => {
      previewHideTimerRef.current = null;
      setPreviewSlug(null);
    }, 220);
  };

  useEffect(() => () => clearPreviewHideTimer(), []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    fetch(`/api/public/exhibitions/${EXHIBITION_SLUG}/points`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const nextPoints = normalizePoints(data.points);
        if (nextPoints.length > 0) {
          setPoints(nextPoints);
        }
        setError(null);
      })
      .catch(() => {
        setError("Не удалось загрузить точки с сервера, показаны локальные данные.");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setIsLoading(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const markerBySlug = new Map(INITIAL_MARKERS_BY_SLUG);
    readStoredMarkers().forEach((marker) => {
      markerBySlug.set(marker.slug, marker);
    });

    setDraftMarkers((prev) => {
      const next: Record<string, MarkerDraft> = { ...prev };
      points.forEach((point, index) => {
        if (point.slug in next) return;
        next[point.slug] =
          markerBySlug.get(point.slug) ?? {
            slug: point.slug,
            x: 50,
            y: 50,
            accent: EDITOR_ACCENTS[index % EDITOR_ACCENTS.length],
          };
      });
      return next;
    });

    setSelectedSlug((prev) => prev || points[0]?.slug || "");
  }, [points]);

  useEffect(() => {
    if (!previewSlug) return;
    const exists = points.some((point) => point.slug === previewSlug);
    if (!exists) setPreviewSlug(null);
  }, [points, previewSlug]);

  const mappedPoints = useMemo(() => {
    return points
      .map((point, index) => {
        const marker = draftMarkers[point.slug];
        if (!marker) return null;
        return { ...marker, point, order: index + 1 };
      })
      .filter((item): item is MappedPoint => item !== null);
  }, [draftMarkers, points]);

  const selectedMarker = selectedSlug ? draftMarkers[selectedSlug] : null;
  const previewItem = !editable && previewSlug
    ? mappedPoints.find((item) => item.slug === previewSlug) ?? null
    : null;

  const handleStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isEditing || !selectedSlug || !stageRef.current) {
      if (!editable) {
        clearPreviewHideTimer();
        setPreviewSlug(null);
      }
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    const x = Number((((event.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = Number((((event.clientY - rect.top) / rect.height) * 100).toFixed(2));

    setDraftMarkers((prev) => {
      const current = prev[selectedSlug];
      return {
        ...prev,
        [selectedSlug]: {
          slug: selectedSlug,
          x: Math.min(100, Math.max(0, x)),
          y: Math.min(100, Math.max(0, y)),
          accent: current?.accent ?? EDITOR_ACCENTS[0],
        },
      };
    });
    setStatusMessage("");
  };

  const handleSaveMarkers = () => {
    const markersToSave = points
      .map((point) => draftMarkers[point.slug])
      .filter((marker): marker is MapMarker => marker != null);

    writeStoredMarkers(markersToSave);
    setStatusMessage("Координаты сохранены.");
  };

  const selectedPoint = points.find((point) => point.slug === selectedSlug) ?? null;

  const editorHint = selectedPoint
    ? `Выбрана точка: ${selectedPoint.title}. Кликните по карте, чтобы поставить метку.`
    : "Выберите точку и кликните по карте.";

  return (
    <div className="map-page">
        {!editable && (
          <p className="map-page__lead">
            Выберите точку на схеме коллегиума, чтобы сразу открыть страницу
            остановки аудиомаршрута.
          </p>
        )}

        {error && <p style={{ color: "#8b4513" }}>{error}</p>}
        {isLoading && <p style={{ color: "var(--muted)" }}>Загрузка точек…</p>}

        {editable && (
            <section className="map-editor">
              <p className="map-editor__lead">
                Выберите точку, включите режим редактирования и кликните по нужному
                месту на карте. Координаты обновятся сразу.
              </p>

              <div className="map-editor__controls">
                <label className="map-editor__field">
                  <span>Текущая точка</span>
                  <select
                    value={selectedSlug}
                    onChange={(event) => setSelectedSlug(event.target.value)}
                    className="map-editor__select"
                  >
                    {points.map((point) => (
                      <option key={point.slug} value={point.slug}>
                        {point.title} ({point.slug})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="map-editor__coords">
                  {selectedMarker ? (
                    <>
                      <strong>X:</strong> {selectedMarker.x.toFixed(2)}%{" "}
                      <strong>Y:</strong> {selectedMarker.y.toFixed(2)}%
                    </>
                  ) : (
                    "Координаты для выбранной точки ещё не заданы."
                  )}
                </div>

                <div className="map-editor__buttons">
                  <button
                    type="button"
                    className="map-editor__button map-editor__button--ghost"
                    onClick={() => setIsAdminEditEnabled((prev) => !prev)}
                  >
                    Редактирование: {isAdminEditEnabled ? "включено" : "выключено"}
                  </button>
                  <button
                    type="button"
                    className="map-editor__button"
                    onClick={handleSaveMarkers}
                  >
                    Сохранить координаты
                  </button>
                </div>
              </div>

              <p className="map-editor__status">
                {statusMessage || "Сохраняйте координаты после правок."}
              </p>
            </section>
        )}

            <section className="map-card">
              <div
                ref={stageRef}
                className={"map-stage" + (isEditing ? " map-stage--editable" : "")}
                onClick={handleStageClick}
              >
                <div className="map-stage__media">
                  <img
                    src={MAP_IMAGE_SRC}
                    alt="Фотография карты маршрута по зданию коллегиума"
                    className="map-stage__image"
                  />
                </div>

                {editable && (
                  <div className="map-stage__hint">
                    {isEditing
                      ? editorHint
                      : "Редактирование выключено. Включите его кнопкой выше."}
                  </div>
                )}

                {mappedPoints.map(({ slug, x, y, accent, point }) => (
                  <Link
                    key={slug}
                    to={`/g/${EXHIBITION_SLUG}/p/${slug}`}
                    className={
                      "map-marker" +
                      (isEditing ? " map-marker--editing" : "") +
                      (selectedSlug === slug ? " map-marker--selected" : "")
                    }
                    onClick={(event) => {
                      if (isEditing) {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedSlug(slug);
                      } else {
                        event.preventDefault();
                        event.stopPropagation();
                        clearPreviewHideTimer();
                        setPreviewSlug(slug);
                      }
                    }}
                    onMouseEnter={
                      isEditing
                        ? undefined
                        : () => {
                            clearPreviewHideTimer();
                            setPreviewSlug(slug);
                          }
                    }
                    onMouseLeave={isEditing ? undefined : schedulePreviewHide}
                    style={
                      {
                        left: `${x}%`,
                        top: `${y}%`,
                        "--map-marker-accent": accent,
                      } as CSSProperties
                    }
                    aria-label={`Открыть точку: ${point.title}`}
                    title={point.title}
                  >
                    <span className="map-marker__index" aria-hidden="true" />
                  </Link>
                ))}

                {previewItem && (
                  <article
                    className="map-preview"
                    style={
                      {
                        left: `${previewItem.x}%`,
                        top: `${previewItem.y}%`,
                        "--map-preview-accent": previewItem.accent,
                      } as CSSProperties
                    }
                    onMouseEnter={clearPreviewHideTimer}
                    onMouseLeave={schedulePreviewHide}
                  >
                    <button
                      type="button"
                      className="map-preview__close"
                      aria-label="Закрыть окно точки"
                      onClick={() => {
                        clearPreviewHideTimer();
                        setPreviewSlug(null);
                      }}
                    >
                      ×
                    </button>
                    {previewItem.point.image_url ? (
                      <img
                        src={previewItem.point.image_url}
                        alt={previewItem.point.title}
                        className="map-preview__image"
                      />
                    ) : (
                      <div className="map-preview__image map-preview__image--empty">
                        Фото пока не добавлено
                      </div>
                    )}
                    <div className="map-preview__title">{previewItem.point.title}</div>
                    <Link
                      to={`/g/${EXHIBITION_SLUG}/p/${previewItem.slug}`}
                      className="map-preview__action"
                    >
                      Перейти к прослушиванию
                    </Link>
                  </article>
                )}
              </div>
            </section>
      </div>
  );
}

export function MapPage() {
  return (
    <Layout title="Карта маршрута" fullBleed>
      <section
        style={{
          position: "relative",
          minHeight: "100%",
          backgroundColor: "#e8e0d5",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 14% 20%, rgba(233, 247, 239, 0.55) 0%, rgba(233, 247, 239, 0) 36%)," +
              "radial-gradient(circle at 86% 16%, rgba(173, 214, 194, 0.34) 0%, rgba(173, 214, 194, 0) 40%)," +
              "radial-gradient(circle at 78% 82%, rgba(121, 170, 151, 0.3) 0%, rgba(121, 170, 151, 0) 38%)," +
              "repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, rgba(255, 255, 255, 0) 1px 14px)," +
              "linear-gradient(140deg, #dbe9df 0%, #bfd7c9 48%, #a8c6b8 100%)",
          }}
        />
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
            <h1
              style={{
                margin: "0 0 18px",
                fontSize: "clamp(24px, 5vw, 32px)",
                lineHeight: 1.15,
                fontWeight: 750,
                letterSpacing: "0.03em",
              }}
            >
              Карта маршрута
            </h1>
            <MapContent editable={false} />
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function AdminMapPanel() {
  return <MapContent editable />;
}
