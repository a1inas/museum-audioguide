import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { GuideHelper } from "./GuideHelper";

const FEEDBACK_HIDE_UNTIL_KEY = "iziumGuide_feedbackHideUntil";
const FEEDBACK_SENT_FOR_ROUTE_KEY = "iziumGuide_feedbackSentForRoute";

type RouteFeedbackDetail = {
  expoSlug?: string;
  completedPoints?: number;
  totalPoints?: number;
};

export function Layout(props: {
  title?: string;
  children: ReactNode;
  /** Для главной: убрать рамки и сделать контент на всю ширину */
  fullBleed?: boolean;
  hideHeader?: boolean;
}) {
  const year = new Date().getFullYear();
  const location = useLocation();
  const path = location.pathname;

  const isPointsActive =
    path === "/collection" ||
    path.startsWith("/g/polotsk-collegium/points") ||
    path.startsWith("/g/") && path.includes("/p/");

  const isHistoryActive = path.startsWith("/history");
  const isFavoritesActive = path.startsWith("/favorites");
  const isReconstructionActive = path.startsWith("/reconstruction");
  const isMapActive = path.startsWith("/map");
  const isAdminActive = path.startsWith("/admin");
  const isHomePage = path === "/";
  const isPointPage = path.startsWith("/g/") && path.includes("/p/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<"wish" | "issue" | "other">("wish");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackVoiceDataUrl, setFeedbackVoiceDataUrl] = useState<string | null>(null);
  const [feedbackPhotoDataUrl, setFeedbackPhotoDataUrl] = useState<string | null>(null);
  const [isRecordingFeedbackVoice, setIsRecordingFeedbackVoice] = useState(false);
  const [feedbackRecordingSeconds, setFeedbackRecordingSeconds] = useState(0);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackRouteMeta, setFeedbackRouteMeta] = useState<RouteFeedbackDetail | null>(null);
  const feedbackVoiceRecorderRef = useRef<MediaRecorder | null>(null);
  const feedbackVoiceChunksRef = useRef<BlobPart[]>([]);
  const feedbackVoiceStreamRef = useRef<MediaStream | null>(null);
  const feedbackRecordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const footerTheme = isHistoryActive
    ? {
        color: "#4b3520",
        background:
          "linear-gradient(90deg, rgba(208, 180, 136, 0.95) 0%, rgba(192, 160, 116, 0.92) 55%, rgba(178, 145, 103, 0.9) 100%)",
      }
    : isReconstructionActive
      ? {
          color: "#f9f4ea",
          background:
            "linear-gradient(90deg, rgba(123, 88, 55, 0.96) 0%, rgba(110, 76, 45, 0.94) 52%, rgba(95, 64, 36, 0.92) 100%)",
        }
      : isMapActive
        ? {
            color: "#eefaf4",
            background:
              "linear-gradient(90deg, rgba(78, 119, 104, 0.96) 0%, rgba(66, 106, 92, 0.94) 52%, rgba(55, 91, 79, 0.92) 100%)",
          }
        : isFavoritesActive
          ? {
              color: "#fff8ec",
              background:
                "linear-gradient(90deg, rgba(152, 108, 65, 0.96) 0%, rgba(134, 92, 53, 0.94) 52%, rgba(118, 80, 45, 0.92) 100%)",
            }
          : isAdminActive
            ? {
                color: "#4d3420",
                background:
                  "linear-gradient(90deg, rgba(214, 181, 136, 0.95) 0%, rgba(198, 159, 112, 0.93) 52%, rgba(182, 144, 98, 0.91) 100%)",
              }
          : {
              color: "#e5e7eb",
              background:
                "linear-gradient(90deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.9) 45%, rgba(15,23,42,0.7) 75%, rgba(15,23,42,0.5) 100%)",
            };

  const headerTheme = isHomePage
    ? {
        background:
          "linear-gradient(90deg, rgba(224, 211, 189, 0.96) 0%, rgba(216, 201, 177, 0.94) 48%, rgba(207, 188, 162, 0.92) 100%)",
        borderBottom: "1px solid rgba(145, 113, 78, 0.34)",
        isDark: false,
      }
    : isPointPage
    ? {
        background:
          "linear-gradient(90deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.9) 45%, rgba(15,23,42,0.7) 75%, rgba(15,23,42,0.5) 100%)",
        borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
        isDark: true,
      }
    : isHistoryActive
    ? {
        background: "#e3cfae",
        borderBottom: "1px solid rgba(140, 103, 62, 0.38)",
        isDark: false,
      }
    : isReconstructionActive
      ? {
          background: "#b58a5f",
          borderBottom: "1px solid rgba(95, 64, 36, 0.45)",
          isDark: true,
        }
      : isMapActive
        ? {
            background: "#8fb9a8",
            borderBottom: "1px solid rgba(54, 89, 78, 0.4)",
            isDark: false,
          }
        : isFavoritesActive
          ? {
              background: "#c89f70",
              borderBottom: "1px solid rgba(111, 76, 42, 0.42)",
              isDark: true,
            }
          : {
              background: "#e8d8be",
              borderBottom: "1px solid rgba(152, 110, 60, 0.35)",
              isDark: false,
            };

  const headerTextColor = headerTheme.isDark ? "#f8fafc" : "#1f2937";
  const headerNavColor = headerTheme.isDark ? "rgba(248, 250, 252, 0.92)" : "#374151";

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [path]);

  useEffect(() => {
    const onRouteCompleted = (event: Event) => {
      const custom = event as CustomEvent<RouteFeedbackDetail>;
      setFeedbackRouteMeta(custom.detail ?? null);
      setFeedbackKind("wish");
      setFeedbackMessage("");
      setFeedbackContact("");
      setFeedbackVoiceDataUrl(null);
      setFeedbackPhotoDataUrl(null);
      setFeedbackError(null);
      setFeedbackDone(false);
      setFeedbackOpen(true);
    };

    window.addEventListener("izium-route-completed", onRouteCompleted as EventListener);
    return () =>
      window.removeEventListener("izium-route-completed", onRouteCompleted as EventListener);
  }, []);

  const closeFeedback = () => {
    if (feedbackRouteMeta) {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      try {
        window.localStorage.setItem(FEEDBACK_HIDE_UNTIL_KEY, String(Date.now() + weekMs));
      } catch {
        // ignore localStorage errors
      }
    }
    stopFeedbackVoiceRecording();
    if (feedbackRecordingTimerRef.current) {
      clearInterval(feedbackRecordingTimerRef.current);
      feedbackRecordingTimerRef.current = null;
    }
    stopFeedbackVoiceTracks();
    setFeedbackOpen(false);
    setFeedbackRouteMeta(null);
  };

  const openManualFeedback = () => {
    setFeedbackRouteMeta(null);
    setFeedbackKind("wish");
    setFeedbackMessage("");
    setFeedbackContact("");
    setFeedbackVoiceDataUrl(null);
    setFeedbackPhotoDataUrl(null);
    setFeedbackError(null);
    setFeedbackDone(false);
    setFeedbackOpen(true);
  };

  const stopFeedbackVoiceTracks = () => {
    if (feedbackVoiceStreamRef.current) {
      feedbackVoiceStreamRef.current.getTracks().forEach((track) => track.stop());
      feedbackVoiceStreamRef.current = null;
    }
  };

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

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startFeedbackVoiceRecording = async () => {
    if (isRecordingFeedbackVoice) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedbackError("На этом устройстве запись голоса не поддерживается.");
      return;
    }

    setFeedbackError(null);
    setFeedbackRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      feedbackVoiceStreamRef.current = stream;
      feedbackVoiceRecorderRef.current = recorder;
      feedbackVoiceChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          feedbackVoiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(feedbackVoiceChunksRef.current, { type: mimeType });
        try {
          const dataUrl = await blobToDataUrl(blob);
          setFeedbackVoiceDataUrl(dataUrl);
        } catch {
          setFeedbackError("Не удалось сохранить голосовое сообщение.");
        }
        stopFeedbackVoiceTracks();
        if (feedbackRecordingTimerRef.current) {
          clearInterval(feedbackRecordingTimerRef.current);
          feedbackRecordingTimerRef.current = null;
        }
        setIsRecordingFeedbackVoice(false);
      };

      recorder.start();
      setIsRecordingFeedbackVoice(true);
      feedbackRecordingTimerRef.current = setInterval(() => {
        setFeedbackRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setFeedbackError("Не удалось получить доступ к микрофону.");
      setIsRecordingFeedbackVoice(false);
      stopFeedbackVoiceTracks();
    }
  };

  const stopFeedbackVoiceRecording = () => {
    const recorder = feedbackVoiceRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const handleFeedbackMicPressStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!isRecordingFeedbackVoice) {
      void startFeedbackVoiceRecording();
    }
  };

  const handleFeedbackMicPressEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    stopFeedbackVoiceRecording();
  };

  const clearFeedbackVoice = () => {
    setFeedbackVoiceDataUrl(null);
    setFeedbackError(null);
  };

  const onPickFeedbackPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedbackError("Нужно выбрать изображение.");
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      setFeedbackError("Фото слишком большое (до 7 МБ).");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setFeedbackPhotoDataUrl(dataUrl);
      setFeedbackError(null);
    } catch {
      setFeedbackError("Не удалось обработать изображение.");
    }
  };

  const clearFeedbackPhoto = () => {
    setFeedbackPhotoDataUrl(null);
    setFeedbackError(null);
  };

  const submitFeedback = async () => {
    const message = feedbackMessage.trim();
    if (!message && !feedbackVoiceDataUrl && !feedbackPhotoDataUrl) {
      setFeedbackError("Добавьте текст, голосовое или фото.");
      return;
    }
    if (message.length > 0 && message.length < 3) {
      setFeedbackError("Напишите чуть подробнее (минимум 3 символа).");
      return;
    }
    setFeedbackBusy(true);
    setFeedbackError(null);
    try {
      const r = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: feedbackKind,
          message,
          contact: feedbackContact.trim(),
          voiceDataUrl: feedbackVoiceDataUrl,
          photoDataUrl: feedbackPhotoDataUrl,
          sourcePath:
            typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
          expoSlug: feedbackRouteMeta?.expoSlug ?? "",
          completedPoints: feedbackRouteMeta?.completedPoints ?? null,
          totalPoints: feedbackRouteMeta?.totalPoints ?? null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          typeof data?.message === "string" ? data.message : `HTTP ${r.status}`,
        );
      }

      if (
        feedbackRouteMeta &&
        typeof feedbackRouteMeta.totalPoints === "number" &&
        feedbackRouteMeta.totalPoints > 0
      ) {
        try {
          window.localStorage.setItem(
            FEEDBACK_SENT_FOR_ROUTE_KEY,
            `${feedbackRouteMeta.expoSlug ?? ""}:${feedbackRouteMeta.totalPoints}`,
          );
        } catch {
          // ignore localStorage errors
        }
      }

      setFeedbackDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось отправить сообщение";
      if (msg.includes("Feedback table is not available")) {
        setFeedbackError(
          "Форма пока не может отправиться: в базе нет таблицы feedback_messages. Выполните SQL из backend/sql/001_init.sql в pgAdmin.",
        );
      } else {
        setFeedbackError(msg);
      }
    } finally {
      setFeedbackBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (feedbackRecordingTimerRef.current) {
        clearInterval(feedbackRecordingTimerRef.current);
        feedbackRecordingTimerRef.current = null;
      }
      if (
        feedbackVoiceRecorderRef.current &&
        feedbackVoiceRecorderRef.current.state !== "inactive"
      ) {
        feedbackVoiceRecorderRef.current.stop();
      }
      stopFeedbackVoiceTracks();
    };
  }, []);

  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100vh",
        background: "var(--bg-soft)",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {!props.hideHeader && (
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: headerTheme.background,
            borderBottom: headerTheme.borderBottom,
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
          }}
        >
          <div
            className="app-header-inner"
            style={{
              maxWidth: 1120,
              margin: "0 auto",
              padding: "10px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            {/* Логотип */}
            <Link
              to="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 18,
                fontWeight: 700,
                color: headerTextColor,
                textDecoration: "none",
              }}
            >
              <img
                src="/logo-audioguide.png"
                alt="Логотип аудиогида"
                style={{
                  width: 32,
                  height: 32,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <span>ИзиумГид</span>
            </Link>

            {/* Навигация */}
            <button
              type="button"
              className={
                "top-nav-toggle" + (isMobileMenuOpen ? " top-nav-toggle--open" : "")
              }
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Закрыть меню навигации" : "Открыть меню навигации"}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              <span className="top-nav-toggle__line" />
              <span className="top-nav-toggle__line" />
              <span className="top-nav-toggle__line" />
            </button>
            <nav
              className={"top-nav" + (isMobileMenuOpen ? " top-nav--open" : "")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                fontSize: 14,
                color: headerNavColor,
              }}
            >
              <Link
                to="/history"
                className={
                  "top-nav-link" + (isHistoryActive ? " top-nav-link--active" : "")
                }
                style={{ padding: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                История
              </Link>
              <Link
                to="/reconstruction"
                className={
                  "top-nav-link" +
                  (isReconstructionActive ? " top-nav-link--active" : "")
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Реконструкция
              </Link>
              <Link
                to="/map"
                className={
                  "top-nav-link" + (isMapActive ? " top-nav-link--active" : "")
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Карта
              </Link>
              <Link
                to="/g/polotsk-collegium/points"
                className={
                  "top-nav-link" + (isPointsActive ? " top-nav-link--active" : "")
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Точки
              </Link>
              <Link
                to="/favorites"
                className={
                  "top-nav-link" +
                  (isFavoritesActive ? " top-nav-link--active" : "")
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Избранное
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main
        style={{
          flex: 1,
          display: "flex",
          padding: props.fullBleed
            ? 0
            : "clamp(16px, 3vw, 26px) clamp(10px, 3vw, 16px) clamp(22px, 4vw, 32px)",
        }}
      >
        {props.fullBleed ? (
          <div style={{ flex: 1 }}>{props.children}</div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: 860,
              margin: "0 auto",
              padding:
                "clamp(14px, 2.8vw, 22px) clamp(14px, 2.8vw, 22px) clamp(20px, 3.8vw, 30px)",
              borderRadius: "clamp(18px, 3.4vw, 26px)",
              border: "1px solid rgba(152, 110, 60, 0.75)",
              background:
                "linear-gradient(135deg, rgba(255,249,238,0.98), rgba(244,226,199,0.98))",
              boxShadow: "var(--shadow-soft)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "clamp(10px, 2vw, 14px)",
                borderRadius: "clamp(14px, 2.8vw, 20px)",
                border: "1px solid rgba(255,255,255,0.6)",
                pointerEvents: "none",
              }}
            />
            {props.title && (
              <header
                style={{ marginBottom: 18, position: "relative", zIndex: 1 }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(24px, 5vw, 32px)",
                    lineHeight: 1.15,
                    fontWeight: 750,
                    letterSpacing: "0.03em",
                  }}
                >
                  {props.title}
                </h1>
              </header>
            )}
            <div style={{ position: "relative", zIndex: 1 }}>
              {props.children}
            </div>
          </div>
        )}
      </main>

      <GuideHelper />

      {!isAdminActive && !isHomePage && (
        <button
          type="button"
          onClick={openManualFeedback}
          className="feedback-fab"
          aria-label="Открыть форму обратной связи"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            style={{ width: 20, height: 20, display: "block" }}
          >
            <path
              fill="currentColor"
              d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.8l-4.9 3.7A1 1 0 0 1 3 19.9V17a2 2 0 0 1-1-1.7V6a2 2 0 0 1 2-2Zm1.7 6.1a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm6.3 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm6.3 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"
            />
          </svg>
        </button>
      )}

      {feedbackOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(8, 10, 18, 0.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(152, 110, 60, 0.34)",
              background:
                "linear-gradient(135deg, rgba(251,244,230,0.98), rgba(240,221,192,0.98))",
              boxShadow: "0 16px 36px rgba(0, 0, 0, 0.28)",
              padding: feedbackDone ? "18px 18px 16px" : 14,
              position: "relative",
            }}
          >
            <button
              type="button"
              aria-label="Закрыть окно обратной связи"
              onClick={closeFeedback}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                marginTop: 0,
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "1px solid rgba(152, 110, 60, 0.34)",
                background: "rgba(255,255,255,0.72)",
                color: "#5d3515",
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>

            {!feedbackDone && (
              <>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {feedbackRouteMeta
                    ? "Маршрут пройден. Поделитесь впечатлением"
                    : "Поделитесь вашим мнением"}
                </div>
                <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.45 }}>
                  Ваше мнение поможет улучшить аудиогид для следующих посетителей.
                </p>
              </>
            )}

            {!feedbackDone ? (
              <>
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={
                      "point-review-button" + (feedbackKind === "wish" ? " point-review-button--save" : "")
                    }
                    onClick={() => setFeedbackKind("wish")}
                    style={{ width: "auto", flex: "0 0 auto" }}
                  >
                    Пожелание
                  </button>
                  <button
                    type="button"
                    className={
                      "point-review-button" + (feedbackKind === "issue" ? " point-review-button--save" : "")
                    }
                    onClick={() => setFeedbackKind("issue")}
                    style={{ width: "auto", flex: "0 0 auto" }}
                  >
                    Замечание
                  </button>
                  <button
                    type="button"
                    className={
                      "point-review-button" + (feedbackKind === "other" ? " point-review-button--save" : "")
                    }
                    onClick={() => setFeedbackKind("other")}
                    style={{ width: "auto", flex: "0 0 auto" }}
                  >
                    Другое
                  </button>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRecordingFeedbackVoice ? (
                      <div className="point-review-recording-inline" style={{ minHeight: 76 }}>
                        Идет запись: {formatRecordingTime(feedbackRecordingSeconds)}
                      </div>
                    ) : feedbackVoiceDataUrl ? (
                      <audio
                        className="point-review-audio-inline"
                        controls
                        src={feedbackVoiceDataUrl}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      <textarea
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Напишите, что понравилось или что стоит улучшить…"
                        style={{
                          width: "100%",
                          minHeight: 76,
                          maxHeight: 76,
                          borderRadius: 12,
                          border: "1px solid rgba(152, 110, 60, 0.35)",
                          background: "rgba(255, 255, 255, 0.88)",
                          padding: "10px 12px",
                          color: "#2b2015",
                          font: "inherit",
                          resize: "none",
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 8,
                      width: 100,
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    {feedbackVoiceDataUrl && !isRecordingFeedbackVoice ? (
                      <button
                        type="button"
                        className="point-review-button point-review-button--ghost point-review-inline-delete"
                        onClick={clearFeedbackVoice}
                        aria-label="Удалить голос"
                        disabled={feedbackBusy}
                        style={{ width: 46, height: 46, padding: 0, justifyContent: "center" }}
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
                            (isRecordingFeedbackVoice ? " point-review-mic-button--recording" : "")
                          }
                          onPointerDown={handleFeedbackMicPressStart}
                          onPointerUp={handleFeedbackMicPressEnd}
                          onPointerLeave={handleFeedbackMicPressEnd}
                          onPointerCancel={handleFeedbackMicPressEnd}
                          aria-label="Удерживайте для записи"
                          disabled={feedbackBusy}
                          style={{ border: "1px solid rgba(152, 110, 60, 0.42)" }}
                        >
                          <img
                            src="/mic-outline.svg"
                            alt=""
                            aria-hidden="true"
                            className="point-review-mic-icon"
                          />
                        </button>
                        <div className="point-review-mic-tooltip" role="tooltip">
                          {isRecordingFeedbackVoice
                          ? "Запись идет, пока вы держите кнопку"
                          : "Удерживайте кнопку для записи"}
                        </div>
                      </div>
                    )}
                    {!feedbackPhotoDataUrl ? (
                      <label
                        className="point-review-button point-review-photo-upload"
                        aria-label="Прикрепить фото"
                        title="Прикрепить фото"
                        style={{
                          minWidth: 46,
                          width: 46,
                          height: 46,
                          padding: 0,
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                          style={{ width: 18, height: 18, display: "block" }}
                        >
                          <path
                            d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49L12.2 3.31a4 4 0 0 1 5.66 5.66l-8.49 8.49a2 2 0 1 1-2.83-2.83l7.78-7.78"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            onPickFeedbackPhoto(e.target.files?.[0]);
                            e.currentTarget.value = "";
                          }}
                          disabled={feedbackBusy}
                        />
                      </label>
                    ) : (
                      <button
                        type="button"
                        className="point-review-button point-review-button--ghost point-review-inline-delete"
                        onClick={clearFeedbackPhoto}
                        aria-label="Удалить фото"
                        disabled={feedbackBusy}
                      style={{ width: 46, height: 46, padding: 0, justifyContent: "center" }}
                      >
                        <img
                          src="/trash-outline.svg"
                          alt=""
                          aria-hidden="true"
                          className="point-review-delete-icon"
                        />
                      </button>
                    )}
                  </div>
                </div>

                {feedbackPhotoDataUrl && (
                  <div className="point-review-photo-preview-wrap" style={{ marginTop: 8 }}>
                    <img
                      src={feedbackPhotoDataUrl}
                      alt="Предпросмотр фото для обратной связи"
                      className="point-review-photo-preview"
                    />
                  </div>
                )}

                <input
                  value={feedbackContact}
                  onChange={(e) => setFeedbackContact(e.target.value)}
                  placeholder="Контакт для связи (по желанию)"
                  style={{
                    marginTop: 8,
                    width: "100%",
                    borderRadius: 12,
                    border: "1px solid rgba(152, 110, 60, 0.35)",
                    background: "rgba(255, 255, 255, 0.88)",
                    padding: "10px 12px",
                    color: "#2b2015",
                    font: "inherit",
                  }}
                />

                {feedbackError && (
                  <p style={{ margin: "8px 0 0", color: "#b91c1c" }}>{feedbackError}</p>
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="point-review-button point-review-button--save"
                    onClick={() => void submitFeedback()}
                    disabled={feedbackBusy}
                  >
                    {feedbackBusy ? "Отправляем…" : "Отправить"}
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  marginTop: 6,
                  minHeight: 82,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  borderRadius: 14,
                  background:
                    "linear-gradient(135deg, rgba(255, 249, 238, 0.95), rgba(246, 232, 208, 0.92))",
                }}
              >
                <img
                  src="/guide-complete.png"
                  alt="Персонаж-проводник"
                  style={{
                    width: 92,
                    height: 92,
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />
                <p style={{ margin: 0, color: "#1f7a47", fontWeight: 650, fontSize: 18 }}>
                  Спасибо, ваше сообщение отправлено.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Глобальный футер */}
      <footer
        style={{
          padding: "12px 8px 16px 18px",
          borderTop: "1px solid transparent",
          fontSize: 13,
          color: footerTheme.color,
          background: footerTheme.background,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            textAlign: "right",
          }}
        >
          <span>
            © {year} ИзиумГид ·{" "}
            <span style={{ opacity: 0.75 }}>
              Цифровой аудиогид для посетителей музея
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
