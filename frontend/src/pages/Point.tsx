import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "../ui/Layout";
import { FavoriteHeartIcon } from "../ui/FavoriteHeartIcon";
import { ReviewLikeIcon } from "../ui/ReviewLikeIcon";

type Point = {
  slug: string;
  title: string;
  description: string;
  image_url: string;
  audio_url: string;
};

const FAV_KEY = "iziumGuide_favorites";
const REVIEW_AUTHOR_KEY = "iziumGuide_reviewAuthorId";

type PublicReview = {
  id: number | string;
  author_id: string;
  rating: number;
  text: string;
  voice_data_url?: string | null;
  photo_data_url?: string | null;
  created_at: string;
  likes_count?: number;
  liked_by_me?: boolean;
};

function getOrCreateReviewAuthorId() {
  try {
    const existing = window.localStorage.getItem(REVIEW_AUTHOR_KEY);
    if (existing) return existing;
    const created = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(REVIEW_AUTHOR_KEY, created);
    return created;
  } catch {
    return `u_fallback_${Date.now().toString(36)}`;
  }
}

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

export function PointPage() {
  const { expoSlug, pointSlug } = useParams();
  const [point, setPoint] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allPoints, setAllPoints] = useState<Point[] | null>(null);
  const [listenedSlugs, setListenedSlugs] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const recoListRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewVoiceDataUrl, setReviewVoiceDataUrl] = useState<string | null>(null);
  const [reviewPhotoDataUrl, setReviewPhotoDataUrl] = useState<string | null>(null);
  const [isReviewEditorExpanded, setIsReviewEditorExpanded] = useState(false);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewLikeBusyId, setReviewLikeBusyId] = useState<number | string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [, setReviewSaved] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reviewAuthorId = useMemo(() => getOrCreateReviewAuthorId(), []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [expoSlug, pointSlug]);

  useEffect(() => {
    if (!expoSlug || !pointSlug) {
      setError("Invalid URL params");
      return;
    }

    // читаем прогресс из localStorage
    try {
      const raw = window.localStorage.getItem("iziumGuide_listenedPoints");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setListenedSlugs(parsed.filter((x) => typeof x === "string"));
        }
      }
    } catch {
      // игнорируем ошибки чтения
    }

    // избранное
    if (expoSlug && pointSlug) {
      const favs = readFavoriteIds();
      setIsFavorite(favs.includes(`${expoSlug}:${pointSlug}`));
    }

    // Загружаем текущую точку
    fetch(`/api/point/${expoSlug}/${pointSlug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Omit<Point, "slug">;
        setPoint({
          slug: pointSlug,
          title: data.title,
          description: data.description,
          image_url: data.image_url,
          audio_url: data.audio_url,
        });
      })
      .catch((e) => setError(e.message));

    // Загружаем все точки этой экспозиции, чтобы показать рекомендации
    fetch(`/api/public/exhibitions/${expoSlug}/points`)
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        setAllPoints((data.points ?? []) as Point[]);
      })
      .catch(() => {
        /* игнорируем, рекомендации необязательны */
      });
  }, [expoSlug, pointSlug]);

  const imgSrc = point?.image_url ?? "";
  const audioSrc = point?.audio_url ?? "";

  const markListened = () => {
    if (!pointSlug) return;
    setListenedSlugs((prev) => {
      if (prev.includes(pointSlug)) return prev;
      const next = [...prev, pointSlug];
      try {
        window.localStorage.setItem(
          "iziumGuide_listenedPoints",
          JSON.stringify(next),
        );
      } catch {
        // если localStorage недоступен, просто игнорируем
      }
      return next;
    });
  };

  const clearProgress = () => {
    setListenedSlugs([]);
    try {
      window.localStorage.removeItem("iziumGuide_listenedPoints");
    } catch {
      // игнорируем ошибки
    }
  };

  const [speedIndex, setSpeedIndex] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const SPEEDS = [1, 1.25, 1.5, 2];

  const toggleFavorite = () => {
    if (!expoSlug || !pointSlug) return;
    const id = `${expoSlug}:${pointSlug}`;
    setIsFavorite((prev) => {
      const favs = readFavoriteIds();
      const exists = favs.includes(id);
      const next = exists ? favs.filter((x) => x !== id) : [...favs, id];
      writeFavoriteIds(next);
      return !prev;
    });
  };

  const changeSpeed = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = SPEEDS[index];
    setSpeedIndex(index);
    setShowSpeedMenu(false);
  };

  const recommended = useMemo(() => {
    if (!allPoints || !pointSlug) return [];
    const listenedSet = new Set(listenedSlugs);
    // показываем только те точки, которые ещё не прослушаны и не совпадают с текущей
    return allPoints.filter(
      (p) => p.slug !== pointSlug && !listenedSet.has(p.slug),
    );
  }, [allPoints, pointSlug, listenedSlugs]);

  const { completedCount, totalCount, percent } = useMemo(() => {
    if (!allPoints || allPoints.length === 0) {
      return { completedCount: 0, totalCount: 0, percent: 0 };
    }
    const slugsSet = new Set(listenedSlugs);
    const done = allPoints.filter((p) => slugsSet.has(p.slug)).length;
    const total = allPoints.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { completedCount: done, totalCount: total, percent: pct };
  }, [allPoints, listenedSlugs]);

  const routeCompleteAnnouncedRef = useRef(false);

  useEffect(() => {
    if (!totalCount) return;
    if (percent >= 100 && !routeCompleteAnnouncedRef.current) {
      routeCompleteAnnouncedRef.current = true;
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
    }
    if (percent < 100) {
      routeCompleteAnnouncedRef.current = false;
    }
  }, [expoSlug, completedCount, percent, totalCount]);

  const scrollRecommendations = (direction: "left" | "right") => {
    const container = recoListRef.current;
    if (!container) return;
    const delta = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  };

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const whole = Math.floor(sec);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleAudioLoaded = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
  };

  const handleAudioTime = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
    if (
      audio.duration > 0 &&
      Number.isFinite(audio.duration) &&
      audio.currentTime / audio.duration >= 0.8
    ) {
      markListened();
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    markListened();
  };

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch {
      // игнорируем ошибки воспроизведения (например, без взаимодействия)
    }
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  useEffect(() => {
    // при смене точки останавливаем плеер и сбрасываем время
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioSrc]);

  useEffect(() => {
    if (!expoSlug || !pointSlug) return;
    setReviewRating(0);
    setReviewText("");
    setReviewVoiceDataUrl(null);
    setReviewPhotoDataUrl(null);
    setIsReviewEditorExpanded(false);
    setReviewSaved(false);
    setReviewError(null);
    setIsRecordingVoice(false);
    setReviewLikeBusyId(null);
  }, [expoSlug, pointSlug]);

  useEffect(() => {
    if (!expoSlug || !pointSlug) return;
    let cancelled = false;
    setReviewsLoading(true);
    fetch(
      `/api/public/exhibitions/${expoSlug}/points/${pointSlug}/reviews?likerAuthorId=${encodeURIComponent(
        reviewAuthorId,
      )}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const rows = (data.reviews ?? []) as PublicReview[];
        if (!cancelled) {
          setReviews(
            rows.map((row) => ({
              ...row,
              likes_count: Number(row.likes_count ?? 0),
              liked_by_me: Boolean(row.liked_by_me),
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expoSlug, pointSlug, reviewAuthorId]);

  const toggleReviewLike = async (reviewId: number | string) => {
    if (!expoSlug || !pointSlug) return;
    setReviewLikeBusyId(reviewId);
    try {
      const r = await fetch(
        `/api/public/exhibitions/${expoSlug}/points/${pointSlug}/reviews/${encodeURIComponent(
          String(reviewId),
        )}/like`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorId: reviewAuthorId }),
        },
      );
      const data = (await r.json().catch(() => ({}))) as {
        liked?: boolean;
        likes_count?: number;
        message?: string;
      };
      if (!r.ok) {
        const msg = typeof data.message === "string" ? data.message : "";
        if (
          msg.includes("Review likes are not available") ||
          msg.includes("not available in current database")
        ) {
          setReviewError(
            "Лайки пока не работают: в базе нет таблицы для лайков (point_review_likes). Выполните SQL из backend/sql/001_init.sql или дайте пользователю БД права на авто-миграцию при старте сервера.",
          );
        } else if (msg) {
          setReviewError(msg);
        } else {
          setReviewError("Не удалось обновить лайк.");
        }
        return;
      }
      setReviewError(null);
      const liked = Boolean(data.liked);
      const likes_count = Number(data.likes_count ?? 0);
      setReviews((prev) =>
        prev.map((x) =>
          String(x.id) === String(reviewId) ? { ...x, liked_by_me: liked, likes_count } : x,
        ),
      );
    } finally {
      setReviewLikeBusyId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== "inactive") {
        voiceRecorderRef.current.stop();
      }
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("Не удалось прочитать аудио"));
      };
      reader.onerror = () => reject(new Error("Ошибка чтения аудио"));
      reader.readAsDataURL(blob);
    });

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("Не удалось прочитать изображение"));
      };
      reader.onerror = () => reject(new Error("Ошибка чтения изображения"));
      reader.readAsDataURL(file);
    });

  const startVoiceRecording = async () => {
    if (isRecordingVoice) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setReviewError("На этом устройстве запись голоса не поддерживается.");
      return;
    }

    setReviewError(null);
    setReviewSaved(false);
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(voiceChunksRef.current, { type: mimeType });
        try {
          const dataUrl = await blobToDataUrl(blob);
          setReviewVoiceDataUrl(dataUrl);
        } catch {
          setReviewError("Не удалось сохранить голосовой отзыв.");
        }
        if (voiceStreamRef.current) {
          voiceStreamRef.current.getTracks().forEach((track) => track.stop());
          voiceStreamRef.current = null;
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setIsRecordingVoice(false);
      };

      recorder.start();
      setIsRecordingVoice(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setReviewError("Не удалось получить доступ к микрофону.");
      setIsRecordingVoice(false);
    }
  };

  const stopVoiceRecording = () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const handleMicPressStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!isRecordingVoice) {
      void startVoiceRecording();
    }
  };

  const handleMicPressEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    stopVoiceRecording();
  };

  const clearVoiceReview = () => {
    setReviewVoiceDataUrl(null);
    setReviewSaved(false);
  };

  const onPickReviewPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setReviewError("Нужно выбрать изображение.");
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      setReviewError("Фото слишком большое (до 7 МБ).");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setReviewPhotoDataUrl(dataUrl);
      setReviewSaved(false);
      setReviewError(null);
    } catch {
      setReviewError("Не удалось обработать изображение.");
    }
  };

  const clearReviewPhoto = () => {
    setReviewPhotoDataUrl(null);
    setReviewSaved(false);
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatReviewDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const saveReview = () => {
    if (!expoSlug || !pointSlug) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Выберите оценку от 1 до 5.");
      setReviewSaved(false);
      return;
    }

    const text = reviewText.trim();

    fetch(`/api/public/exhibitions/${expoSlug}/points/${pointSlug}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: reviewRating,
        text,
        authorId: reviewAuthorId,
        voiceDataUrl: reviewVoiceDataUrl,
        photoDataUrl: reviewPhotoDataUrl,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        const created = data.review as PublicReview | undefined;
        if (created) {
          const withLikes: PublicReview = {
            ...created,
            likes_count: Number(created.likes_count ?? 0),
            liked_by_me: Boolean(created.liked_by_me),
          };
          setReviews((prev) => [withLikes, ...prev]);
        }
        setReviewSaved(true);
        setReviewError(null);
        setReviewText("");
        setReviewRating(0);
        setReviewVoiceDataUrl(null);
        setReviewPhotoDataUrl(null);
        setIsReviewEditorExpanded(false);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Не удалось сохранить отзыв";
        setReviewError(message);
        setReviewSaved(false);
      });
  };

  return (
    <Layout title={point?.title ?? "Точка"} fullBleed>
      {error && (
        <p style={{ color: "crimson", padding: 16 }}>Ошибка: {error}</p>
      )}
      {!point && !error && (
        <p style={{ color: "var(--muted)", padding: 16 }}>Загрузка…</p>
      )}

      {point && (
        <>
          <section
            className="hero-section"
            style={{
              position: "relative",
              minHeight: "calc(100vh - 56px)",
              display: "flex",
              alignItems: "center",
              backgroundColor: "#020617",
            }}
          >
            <div
              className="hero-layer"
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: imgSrc
                  ? `linear-gradient(90deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.88) 32%, rgba(15,23,42,0.55) 60%, rgba(15,23,42,0.05) 100%), url("${imgSrc}")`
                  : 'linear-gradient(90deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.88) 32%, rgba(15,23,42,0.55) 60%, rgba(15,23,42,0.05) 100%), url("/hero-main.jpg")',
                backgroundSize: "cover, cover",
                backgroundPosition: "center center, center center",
                backgroundRepeat: "no-repeat, no-repeat",
                transform: "scale(1.02)",
              }}
            />

            <div
              className="hero-text"
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0 36px",
                width: "50%",
                maxWidth: "50%",
                color: "#e5e7eb",
              }}
            >
              <Link to={`/g/${expoSlug}/points`} className="back-link">
                ← Назад к списку точек
              </Link>

              <h1
                style={{
                  margin: 0,
                  fontFamily:
                    '"Playfair Display", "Times New Roman", "Georgia", system-ui, -apple-system, serif',
                  fontSize: 40,
                  lineHeight: 1.08,
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  color: "#f9fafb",
                }}
              >
                <span>{point.title}</span>{" "}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={
                    "favorite-star" +
                    (isFavorite ? " favorite-star--active" : "")
                  }
                  aria-label={
                    isFavorite ? "Убрать из избранного" : "Добавить в избранное"
                  }
                  style={{ marginLeft: 8, verticalAlign: "middle" }}
                >
                  <FavoriteHeartIcon />
                </button>
              </h1>

              <p
                style={{
                  marginTop: 18,
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "rgba(229,231,235,0.92)",
                  maxWidth: 560,
                }}
              >
                {point.description}
              </p>

              <div style={{ marginTop: 22, width: "100%", maxWidth: 420 }}>
                {point.audio_url ? (
                  <div className="audio-shell">
                    <audio
                      key={point.audio_url}
                      ref={audioRef}
                      src={audioSrc}
                      onLoadedMetadata={handleAudioLoaded}
                      onTimeUpdate={handleAudioTime}
                      onEnded={handleAudioEnded}
                    />
                    <div className="audio-controls-row">
                      <button
                        type="button"
                        className="audio-play audio-skip"
                        onClick={() => handleSeek(Math.max(currentTime - 10, 0))}
                        aria-label="Перемотать назад на 10 секунд"
                      >
                        -10
                      </button>
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="audio-play"
                        aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
                      >
                        {isPlaying ? (
                          <span className="audio-play-icon audio-play-icon--pause">
                            ❚❚
                          </span>
                        ) : (
                          <span className="audio-play-icon audio-play-icon--play">
                            ▶
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="audio-play audio-skip"
                        onClick={() =>
                          handleSeek(Math.min(currentTime + 10, duration || 0))
                        }
                        aria-label="Перемотать вперёд на 10 секунд"
                      >
                        +10
                      </button>
                    </div>
                    <div className="audio-top-row">
                      <div className="audio-timeline">
                        <input
                          type="range"
                          min={0}
                          max={duration || 0}
                          step={0.1}
                          value={currentTime}
                          onChange={(e) =>
                            handleSeek(Number((e.target as HTMLInputElement).value))
                          }
                          className="audio-range"
                        />
                      </div>
                      <div className="audio-right">
                        <div className="audio-time">
                          {formatTime(Math.max((duration || 0) - currentTime, 0))}
                        </div>
                        <button
                          type="button"
                          className="audio-speed"
                          onClick={() => setShowSpeedMenu((v) => !v)}
                          aria-label="Изменить скорость воспроизведения"
                        >
                          {SPEEDS[speedIndex]}x
                        </button>
                        {showSpeedMenu && (
                          <div className="audio-speed-menu">
                            {SPEEDS.map((s, idx) => (
                              <button
                                key={s}
                                type="button"
                                className={
                                  "audio-speed-option" +
                                  (idx === speedIndex ? " audio-speed-option--active" : "")
                                }
                                onClick={() => changeSpeed(idx)}
                              >
                                {s}x
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "rgba(209,213,219,0.9)" }}>
                    Аудиодорожка для этой точки ещё не добавлена.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="point-review-section">
            <div className="point-review-card">
              <h2 className="point-review-title">Оставьте отзыв о точке</h2>
              <p className="point-review-lead">
                Оцените по 5-балльной шкале и добавьте текстовый или
                голосовой отзыв.
              </p>

              <div className="point-review-rating" role="radiogroup" aria-label="Оценка точки">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={
                      "point-review-star" + (reviewRating >= score ? " point-review-star--active" : "")
                    }
                    onClick={() => {
                      setReviewRating(score);
                      setReviewSaved(false);
                    }}
                    aria-label={`Оценка ${score} из 5`}
                    aria-pressed={reviewRating >= score}
                  >
                    ★
                  </button>
                ))}
              </div>

              <div className="point-review-text-row">
                {isRecordingVoice ? (
                  <div className="point-review-recording-inline">
                    Идет запись: {formatRecordingTime(recordingSeconds)}
                  </div>
                ) : reviewVoiceDataUrl ? (
                  <audio className="point-review-audio-inline" controls src={reviewVoiceDataUrl} />
                ) : (
                  <textarea
                    className={
                      "point-review-text" + (isReviewEditorExpanded ? " point-review-text--expanded" : "")
                    }
                    placeholder="Напишите ваш отзыв..."
                    value={reviewText}
                    onFocus={() => setIsReviewEditorExpanded(true)}
                    onChange={(e) => {
                      setReviewText(e.target.value);
                      setReviewSaved(false);
                    }}
                  />
                )}
                {reviewVoiceDataUrl && !isRecordingVoice ? (
                  <button
                    type="button"
                    className="point-review-button point-review-button--ghost point-review-inline-delete"
                    onClick={clearVoiceReview}
                    aria-label="Удалить голос"
                  >
                    <img
                      src="/trash-outline.svg"
                      alt=""
                      aria-hidden="true"
                      className="point-review-delete-icon"
                    />
                  </button>
                ) : (
                  <div className="point-review-mic-wrap">
                    <button
                      type="button"
                      className={
                        "point-review-mic-button" +
                        (isRecordingVoice ? " point-review-mic-button--recording" : "")
                      }
                      onPointerDown={handleMicPressStart}
                      onPointerUp={handleMicPressEnd}
                      onPointerLeave={handleMicPressEnd}
                      onPointerCancel={handleMicPressEnd}
                      aria-label="Удерживайте для записи"
                    >
                      <img
                        src="/mic-outline.svg"
                        alt=""
                        aria-hidden="true"
                        className="point-review-mic-icon"
                      />
                    </button>
                    <div className="point-review-mic-tooltip" role="tooltip">
                      {isRecordingVoice
                        ? "Нажмите на микрофон, чтобы остановить запись"
                        : "Нажмите на микрофон для записи отзыва"}
                    </div>
                  </div>
                )}
              </div>

              {reviewPhotoDataUrl && (
                <div className="point-review-photo-preview-wrap">
                  <img
                    src={reviewPhotoDataUrl}
                    alt="Предпросмотр фото для отзыва"
                    className="point-review-photo-preview"
                  />
                </div>
              )}

              <div className="point-review-photo-row">
                {!reviewPhotoDataUrl ? (
                  <label className="point-review-button point-review-photo-upload">
                    Прикрепить фото
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        onPickReviewPhoto(e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    className="point-review-button point-review-button--ghost"
                    onClick={clearReviewPhoto}
                  >
                    Удалить фото
                  </button>
                )}
                <button
                  type="button"
                  className="point-review-button point-review-button--save"
                  onClick={saveReview}
                >
                  Опубликовать
                </button>
              </div>

              {reviewError && <p className="point-review-error">{reviewError}</p>}

              <div className="point-review-existing">
                <h3 className="point-review-list-title">Отзывы по этой точке</h3>
                <div className="point-review-list-scroll">
                  {reviewsLoading && (
                    <p className="point-review-list-empty">Загружаем отзывы...</p>
                  )}
                  {!reviewsLoading && reviews.length === 0 && (
                    <p className="point-review-list-empty">
                      Пока отзывов нет. Вы можете оставить первый.
                    </p>
                  )}
                  {!reviewsLoading &&
                    reviews.map((item) => (
                      <article key={item.id} className="point-review-item">
                        <div className="point-review-item-meta">
                          <strong>
                            {item.author_id === reviewAuthorId ? "Вы" : "Посетитель"}
                          </strong>
                          <span>{formatReviewDate(item.created_at)}</span>
                          <span className="point-review-item-rating">
                            {"★".repeat(Math.max(1, Math.min(5, item.rating)))}
                          </span>
                        </div>
                        {item.text ? (
                          <p className="point-review-item-text">{item.text}</p>
                        ) : null}
                        {item.voice_data_url && (
                          <audio
                            className="point-review-item-audio"
                            controls
                            src={item.voice_data_url}
                          />
                        )}
                        {item.photo_data_url && (
                          <img
                            src={item.photo_data_url}
                            alt="Фото в отзыве"
                            className="point-review-item-photo"
                          />
                        )}
                        <div className="point-review-item-footer">
                          <button
                            type="button"
                            className={
                              "point-review-like" +
                              (item.liked_by_me ? " point-review-like--active" : "")
                            }
                            disabled={reviewLikeBusyId === item.id}
                            onClick={() => void toggleReviewLike(item.id)}
                            aria-label={item.liked_by_me ? "Убрать лайк" : "Поставить лайк"}
                            aria-pressed={Boolean(item.liked_by_me)}
                          >
                            <ReviewLikeIcon />
                            <span className="point-review-like-count">
                              {item.likes_count ?? 0}
                            </span>
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            </div>
          </section>

          {/* Декоративная лента-перегородка перед рекомендациями */}
          <div
            style={{
              height: 30,
              background:
                "linear-gradient(135deg, #fbf4e6, #f0ddc0)",
              borderTop: "1px solid rgba(120,90,52,0.35)",
              borderBottom: "1px solid rgba(120,90,52,0.35)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              lineHeight: 1,
              color: "var(--muted)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: "translateY(2px)",
              }}
            >
              Продолжение маршрута
            </span>
          </div>

          {totalCount > 0 && (
            <section
              className="reco-section"
              style={{
                position: "relative",
                padding: "22px 16px 32px",
                overflow: "hidden",
              }}
            >
              {/* фон как на странице списка точек */}
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

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  maxWidth: 860,
                  margin: "0 auto",
                }}
              >
                {totalCount > 0 && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(43,32,21,0.92)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    <span>
                      Прослушано точек:{" "}
                      <strong>
                        {completedCount} из {totalCount}
                      </strong>
                    </span>
                    <span>{percent}% маршрута</span>
                  </div>
                )}

                {totalCount > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="route-segments route-segments--compact">
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
                )}

                {totalCount > 0 && (
                  <button
                    type="button"
                    onClick={clearProgress}
                    className="progress-reset"
                    style={{ marginBottom: 12, marginLeft: "auto", display: "block" }}
                  >
                    Сбросить прогресс маршрута
                  </button>
                )}

                {recommended.length > 0 && (
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: 10,
                      fontSize: 15,
                    }}
                  >
                    Что послушать дальше
                  </div>
                )}

                {recommended.length === 0 && totalCount > 0 ? (
                  <div
                    style={{
                      padding: "16px 2px 4px",
                      fontSize: 14,
                      color: "rgba(43,32,21,0.95)",
                      fontWeight: 600,
                    }}
                  >
                    Спасибо, вы прослушали все точки этого маршрута.
                  </div>
                ) : (
                  <div
                    className="reco-list"
                    ref={recoListRef}
                    style={{
                      display: "flex",
                      gap: 10,
                      overflowX: "auto",
                      paddingBottom: 4,
                    }}
                  >
                    {recommended.map((p) => (
                      <Link
                        key={p.slug}
                        to={`/g/${expoSlug}/p/${p.slug}`}
                        className="reco-card"
                        style={{
                          flex: "0 0 220px",
                          display: "block",
                          borderRadius: 16,
                          border: "1px solid rgba(152,110,60,0.35)",
                          background:
                            "linear-gradient(135deg, rgba(255,249,238,0.96), rgba(244,226,199,0.96))",
                          boxShadow: "0 10px 24px rgba(120,90,52,0.35)",
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.title}
                            style={{
                              width: "100%",
                              height: 110,
                              objectFit: "cover",
                              borderTopLeftRadius: 16,
                              borderTopRightRadius: 16,
                              display: "block",
                            }}
                          />
                        )}
                        <div style={{ padding: "8px 10px 10px" }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            {p.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              lineHeight: 1.4,
                            }}
                          >
                            {p.description}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {recommended.length > 0 && (
                  <>
                    {/* стрелки навигации по рекомендациям (desktop) */}
                    <button
                      type="button"
                      className="reco-nav reco-nav--left"
                      onClick={() => scrollRecommendations("left")}
                    >
                      <span className="reco-nav-icon reco-nav-icon--left">
                        ‹
                      </span>
                    </button>
                    <button
                      type="button"
                      className="reco-nav reco-nav--right"
                      onClick={() => scrollRecommendations("right")}
                    >
                      <span className="reco-nav-icon reco-nav-icon--right">
                        ›
                      </span>
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </Layout>
  );
}