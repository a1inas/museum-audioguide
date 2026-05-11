import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../ui/Layout";
import { Card } from "../ui/Card";
import { QRCodeCanvas } from "qrcode.react";
import { AdminMapPanel } from "./Map";

type AdminPoint = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  audio_url: string;
  sort_order?: number;
  exhibition_slug: string;
  exhibition_title: string;
};

type AdminReview = {
  id: number;
  author_id: string;
  rating: number;
  text: string;
  voice_data_url: string | null;
  photo_data_url: string | null;
  created_at: string;
  point_slug: string;
  point_title: string;
  exhibition_slug: string;
  exhibition_title: string;
  likes_count?: number;
};

type AdminFeedback = {
  id: number;
  kind: "wish" | "issue" | "other" | string;
  message: string;
  contact: string | null;
  voice_data_url: string | null;
  photo_data_url: string | null;
  source_path: string | null;
  expo_slug: string | null;
  completed_points: number | null;
  total_points: number | null;
  created_at: string;
};

function fileNameFromUrl(url: string) {
  try {
    const name = url.split("/").pop() || url;
    return decodeURIComponent(name);
  } catch {
    return url.split("/").pop() || url;
  }
}

export function Admin(props: { section?: "points" | "map" | "reviews" | "feedback" } = {}) {
  const section = props.section ?? "points";
  const [authed, setAuthed] = useState<boolean | null>(null);

  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [points, setPoints] = useState<AdminPoint[] | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [reviewsBusy, setReviewsBusy] = useState(false);
  const [reviewPointFilter, setReviewPointFilter] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedback[] | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackKindFilter, setFeedbackKindFilter] = useState<"all" | "wish" | "issue" | "other">("all");

  // форма добавления
  const [newExpoSlug, setNewExpoSlug] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const qrBaseOrigin =
    typeof window === "undefined"
      ? (import.meta.env.VITE_PUBLIC_ORIGIN ?? "")
      : window.location.origin;

  const qrLinksWontWorkOnPhone =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");
  const adminCardStyle = {
    background: "rgba(241, 227, 198, 0.78)",
    border: "1px solid rgba(168, 129, 82, 0.42)",
  } as const;

  const load = async () => {
    const r = await fetch("/api/admin/points");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    setPoints(data.points as AdminPoint[]);
  };

  const loadReviews = async () => {
    setReviewsBusy(true);
    try {
      const query = reviewPointFilter
        ? `?pointSlug=${encodeURIComponent(reviewPointFilter)}`
        : "";
      const r = await fetch(`/api/admin/reviews${query}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setReviews((data.reviews ?? []) as AdminReview[]);
    } catch (e: any) {
      alert(e.message);
      setReviews([]);
    } finally {
      setReviewsBusy(false);
    }
  };

  const loadFeedback = async () => {
    setFeedbackBusy(true);
    try {
      const r = await fetch("/api/admin/feedback");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setFeedbackItems((data.feedback ?? []) as AdminFeedback[]);
    } catch (e: any) {
      alert(e.message);
      setFeedbackItems([]);
    } finally {
      setFeedbackBusy(false);
    }
  };

  const checkAuth = async () => {
    const r = await fetch("/api/admin/me");
    setAuthed(r.ok);
    return r.ok;
  };

  const login = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }

      setPassword("");
      setAuthed(true);
      await load();
      if (section === "reviews") await loadReviews();
      if (section === "feedback") await loadFeedback();
      setNewExpoSlug((prev) => prev || "polotsk-collegium");
    } catch (e: any) {
      setAuthError(e.message);
      setAuthed(false);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setPoints(null);
  };

  useEffect(() => {
    checkAuth()
      .then(async (ok) => {
        if (ok) {
          await load();
          if (section === "reviews") await loadReviews();
          if (section === "feedback") await loadFeedback();
          setNewExpoSlug((prev) => prev || "polotsk-collegium");
        }
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed !== true || section !== "reviews") return;
    loadReviews().catch(() => undefined);
  }, [authed, section, reviewPointFilter]);

  useEffect(() => {
    if (authed !== true || section !== "feedback") return;
    loadFeedback().catch(() => undefined);
  }, [authed, section]);

  const expoOptions = useMemo(() => {
    const list = points ?? [];
    const uniq = new Map<string, string>();
    for (const p of list) uniq.set(p.exhibition_slug, p.exhibition_title);
    return Array.from(uniq.entries()).map(([slug, title]) => ({ slug, title }));
  }, [points]);

  const filtered = useMemo(() => {
    if (!points) return [];
    const s = q.trim().toLowerCase();
    if (!s) return points;
    return points.filter(
      (p) =>
        p.slug.toLowerCase().includes(s) ||
        p.title.toLowerCase().includes(s) ||
        p.exhibition_slug.toLowerCase().includes(s) ||
        p.exhibition_title.toLowerCase().includes(s)
    );
  }, [points, q]);

  const filteredFeedback = useMemo(() => {
    const list = feedbackItems ?? [];
    if (feedbackKindFilter === "all") return list;
    return list.filter((item) => item.kind === feedbackKindFilter);
  }, [feedbackItems, feedbackKindFilter]);

  const onChangeField = (slug: string, patch: Partial<AdminPoint>) => {
    setPoints((prev) =>
      (prev ?? []).map((p) => (p.slug === slug ? { ...p, ...patch } : p))
    );
  };

  const savePoint = async (slug: string) => {
    const p = (points ?? []).find((x) => x.slug === slug);
    if (!p) return;

    setSavingSlug(slug);
    try {
      const r = await fetch(`/api/admin/points/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          description: p.description,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingSlug(null);
    }
  };

  const uploadAudio = async (slug: string, file: File) => {
    const fd = new FormData();
    fd.append("audio", file);

    setSavingSlug(slug);
    try {
      const r = await fetch(`/api/admin/upload-audio/${slug}`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingSlug(null);
    }
  };

  const uploadImage = async (slug: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);

    setSavingSlug(slug);
    try {
      const r = await fetch(`/api/admin/upload-image/${slug}`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingSlug(null);
    }
  };

  const deletePoint = async (slug: string) => {
    const ok = confirm(`Удалить точку "${slug}"?`);
    if (!ok) return;

    setSavingSlug(slug);
    try {
      const r = await fetch(`/api/admin/points/${slug}`, { method: "DELETE" });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }

      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingSlug(null);
    }
  };

  const createNewPoint = async () => {
    if (!newExpoSlug || !newSlug.trim() || !newTitle.trim()) {
      alert("Заполни экспозицию, slug и название");
      return;
    }

    setSavingSlug("__create__");
    try {
      const r = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exhibition_slug: newExpoSlug,
          slug: newSlug.trim(),
          title: newTitle.trim(),
          description: newDesc,
        }),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }

      setNewSlug("");
      setNewTitle("");
      setNewDesc("");
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingSlug(null);
    }
  };

  const movePoint = async (slug: string, direction: "up" | "down") => {
    const currentPoints = points ?? [];
    const current = currentPoints.find((item) => item.slug === slug);
    if (!current) return;

    const exhibitionSlug = current.exhibition_slug;
    const exhibitionPoints = currentPoints
      .filter((item) => item.exhibition_slug === exhibitionSlug)
      .slice()
      .sort((a, b) => {
        const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.slug.localeCompare(b.slug);
      });

    const index = exhibitionPoints.findIndex((item) => item.slug === slug);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= exhibitionPoints.length) return;

    const reordered = exhibitionPoints.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const orderedSlugs = reordered.map((item) => item.slug);
    const orderBySlug = new Map(orderedSlugs.map((itemSlug, idx) => [itemSlug, idx]));

    setPoints((prev) =>
      (prev ?? []).map((item) =>
        item.exhibition_slug === exhibitionSlug
          ? { ...item, sort_order: orderBySlug.get(item.slug) ?? item.sort_order }
          : item
      )
    );

    setSavingSlug(`__reorder__:${slug}`);
    try {
      const response = await fetch("/api/admin/points/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exhibition_slug: exhibitionSlug,
          ordered_slugs: orderedSlugs,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      await load();
    } catch (e: any) {
      alert(e.message);
      await load();
    } finally {
      setSavingSlug(null);
    }
  };

  const togglePointExpanded = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const deleteReviewById = async (id: number) => {
    const ok = confirm("Удалить этот отзыв?");
    if (!ok) return;
    setReviewsBusy(true);
    try {
      const r = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      await loadReviews();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReviewsBusy(false);
    }
  };

  const deleteFeedbackById = async (id: number) => {
    const ok = confirm("Удалить это сообщение обратной связи?");
    if (!ok) return;
    setFeedbackBusy(true);
    try {
      const r = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      await loadFeedback();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setFeedbackBusy(false);
    }
  };

  const formatReviewDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFeedbackKind = (value: string) => {
    if (value === "wish") return "Пожелание";
    if (value === "issue") return "Проблема";
    return "Другое";
  };

  const downloadQrPng = (p: AdminPoint) => {
    const id = `qr-${p.exhibition_slug}-${p.slug}`;
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) {
      alert("QR не найден (canvas отсутствует)");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr_${p.exhibition_slug}_${p.slug}.png`;
    a.click();
  };

  // ---- UI ----

  if (authed === false) {
    return (
      <Layout title="Вход в админку" hideHeader fullBleed>
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
                "radial-gradient(circle at 16% 20%, rgba(247, 233, 204, 0.46) 0%, rgba(247, 233, 204, 0) 34%)," +
                "radial-gradient(circle at 86% 14%, rgba(196, 152, 98, 0.42) 0%, rgba(196, 152, 98, 0) 40%)," +
                "radial-gradient(circle at 82% 82%, rgba(167, 123, 76, 0.34) 0%, rgba(167, 123, 76, 0) 38%)," +
                "radial-gradient(circle at 10% 78%, rgba(205, 162, 112, 0.28) 0%, rgba(205, 162, 112, 0) 35%)," +
                "repeating-linear-gradient(110deg, rgba(255, 255, 255, 0.04) 0 2px, rgba(255, 255, 255, 0) 2px 14px)," +
                "linear-gradient(145deg, #dfc49a 0%, #cba473 48%, #b4885b 100%)",
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
                maxWidth: 960,
                margin: "0 auto",
                padding: "clamp(14px, 2.8vw, 22px) clamp(14px, 2.8vw, 22px) clamp(20px, 3.8vw, 30px)",
                borderRadius: 26,
                background: "rgba(255, 246, 230, 0.3)",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              <h1
                style={{
                  margin: "0 0 14px",
                  fontSize: "clamp(24px, 5vw, 32px)",
                  lineHeight: 1.15,
                  fontWeight: 750,
                  letterSpacing: "0.03em",
                }}
              >
                Вход в админку
              </h1>
              <Card style={adminCardStyle}>
                <div style={{ color: "var(--muted)", marginBottom: 10 }}>
                  Введите пароль администратора.
                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    outline: "none",
                  }}
                />

                <div style={{ height: 12 }} />

                <button
                  onClick={login}
                  disabled={authBusy || password.length === 0}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: authBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {authBusy ? "Входим…" : "Войти"}
                </button>

                {authError && (
                  <div style={{ marginTop: 10, color: "crimson" }}>{authError}</div>
                )}
              </Card>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  if (authed === null) {
    return (
      <Layout title="Админка" hideHeader>
        <p style={{ color: "var(--muted)" }}>Проверка доступа…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Админка" hideHeader fullBleed>
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
              "radial-gradient(circle at 16% 20%, rgba(247, 233, 204, 0.46) 0%, rgba(247, 233, 204, 0) 34%)," +
              "radial-gradient(circle at 86% 14%, rgba(196, 152, 98, 0.42) 0%, rgba(196, 152, 98, 0) 40%)," +
              "radial-gradient(circle at 82% 82%, rgba(167, 123, 76, 0.34) 0%, rgba(167, 123, 76, 0) 38%)," +
              "radial-gradient(circle at 10% 78%, rgba(205, 162, 112, 0.28) 0%, rgba(205, 162, 112, 0) 35%)," +
              "repeating-linear-gradient(110deg, rgba(255, 255, 255, 0.04) 0 2px, rgba(255, 255, 255, 0) 2px 14px)," +
              "linear-gradient(145deg, #dfc49a 0%, #cba473 48%, #b4885b 100%)",
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
              maxWidth: 960,
              margin: "0 auto",
              padding: "clamp(14px, 2.8vw, 22px) clamp(14px, 2.8vw, 22px) clamp(20px, 3.8vw, 30px)",
              borderRadius: 26,
              background: "rgba(255, 246, 230, 0.3)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
      <h1
        style={{
          margin: "0 0 14px",
          fontSize: "clamp(24px, 5vw, 32px)",
          lineHeight: 1.15,
          fontWeight: 750,
          letterSpacing: "0.03em",
        }}
      >
        Админка
      </h1>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ color: "var(--muted)", marginTop: 6 }}>
          {section === "map"
            ? "Редактирование расположения точек на карте."
            : section === "reviews"
              ? "Управление отзывами: просмотр новых, фильтр по точке, удаление."
              : section === "feedback"
                ? "Сообщения от посетителей после завершения маршрута."
              : "Управление точками: текст, аудио, картинки, QR."}
        </div>

        <button
          onClick={logout}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text)",
          }}
        >
          Выйти
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          to="/admin"
          className={"top-nav-link" + (section === "points" ? " top-nav-link--active" : "")}
        >
          Точки
        </Link>
        <Link
          to="/admin/map"
          className={"top-nav-link" + (section === "map" ? " top-nav-link--active" : "")}
        >
          Карта
        </Link>
        <Link
          to="/admin/reviews"
          className={"top-nav-link" + (section === "reviews" ? " top-nav-link--active" : "")}
        >
          Отзывы
        </Link>
        <Link
          to="/admin/feedback"
          className={"top-nav-link" + (section === "feedback" ? " top-nav-link--active" : "")}
        >
          Обратная связь
        </Link>
      </div>

      <div style={{ height: 12 }} />

      {section === "map" ? (
        <AdminMapPanel />
      ) : section === "reviews" ? (
        <>
          <Card style={adminCardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Отзывы пользователей</div>
            <div style={{ color: "var(--muted)", marginBottom: 10 }}>
              Сначала показываются самые новые отзывы.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={reviewPointFilter}
                onChange={(e) => setReviewPointFilter(e.target.value)}
                style={{
                  minWidth: 260,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="" style={{ color: "#000" }}>
                  Все точки
                </option>
                {(points ?? []).map((p) => (
                  <option key={p.slug} value={p.slug} style={{ color: "#000" }}>
                    {p.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => loadReviews()}
                disabled={reviewsBusy}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                }}
              >
                Обновить
              </button>
            </div>
          </Card>

          <div style={{ height: 12 }} />

          {reviewsBusy && <p style={{ color: "var(--muted)" }}>Загрузка отзывов…</p>}

          {!reviewsBusy && (reviews ?? []).length === 0 && (
            <Card style={adminCardStyle}>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Пока отзывов нет.
              </p>
            </Card>
          )}

          {!reviewsBusy && (reviews ?? []).length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {(reviews ?? []).map((r) => (
                <Card key={r.id} style={adminCardStyle}>
                  {(() => {
                    const hasText = Boolean(r.text && r.text.trim().length > 0);
                    const hasVoice = Boolean(r.voice_data_url);
                    const hasPhoto = Boolean(r.photo_data_url);
                    return (
                      <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {r.point_title}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
                        Автор: {r.author_id} · {formatReviewDate(r.created_at)} · Оценка:{" "}
                        {"★".repeat(Math.max(1, Math.min(5, r.rating)))}
                        {" · "}
                        Лайков: {Number(r.likes_count ?? 0)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteReviewById(r.id)}
                      disabled={reviewsBusy}
                      style={{
                        height: 36,
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid crimson",
                        background: "transparent",
                        color: "crimson",
                      }}
                    >
                      Удалить
                    </button>
                  </div>

                  {hasText ? (
                    <p style={{ marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>{r.text}</p>
                  ) : !hasVoice && !hasPhoto ? (
                    <p style={{ marginTop: 10, marginBottom: 0, color: "var(--muted)" }}>
                      Текстового или голосового комментария нет.
                    </p>
                  ) : null}

                  {hasVoice && (
                    <audio
                      controls
                      src={r.voice_data_url ?? undefined}
                      className="admin-review-audio"
                    />
                  )}

                  {hasPhoto && (
                    <img
                      src={r.photo_data_url ?? ""}
                      alt="Фото отзыва"
                      className="admin-review-photo"
                    />
                  )}
                      </>
                    );
                  })()}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : section === "feedback" ? (
        <>
          <Card style={adminCardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Обратная связь от пользователей</div>
            <div style={{ color: "var(--muted)", marginBottom: 10 }}>
              Сообщения показываются от новых к старым.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={feedbackKindFilter}
                onChange={(e) =>
                  setFeedbackKindFilter(
                    (e.target.value as "all" | "wish" | "issue" | "other") ?? "all",
                  )
                }
                style={{
                  minWidth: 220,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="all" style={{ color: "#000" }}>
                  Все типы
                </option>
                <option value="wish" style={{ color: "#000" }}>
                  Пожелание
                </option>
                <option value="issue" style={{ color: "#000" }}>
                  Замечание
                </option>
                <option value="other" style={{ color: "#000" }}>
                  Другое
                </option>
              </select>

              <button
                type="button"
                onClick={() => loadFeedback()}
                disabled={feedbackBusy}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                }}
              >
                Обновить
              </button>
            </div>
          </Card>

          <div style={{ height: 12 }} />

          {feedbackBusy && <p style={{ color: "var(--muted)" }}>Загрузка сообщений…</p>}

          {!feedbackBusy && filteredFeedback.length === 0 && (
            <Card style={adminCardStyle}>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Сообщений по выбранному фильтру нет.
              </p>
            </Card>
          )}

          {!feedbackBusy && filteredFeedback.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredFeedback.map((item) => (
                <Card key={item.id} style={adminCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        {formatFeedbackKind(item.kind)}
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
                        {formatReviewDate(item.created_at)}
                        {item.expo_slug ? ` · Экспозиция: ${item.expo_slug}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteFeedbackById(item.id)}
                      disabled={feedbackBusy}
                      style={{
                        height: 36,
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid crimson",
                        background: "transparent",
                        color: "crimson",
                      }}
                    >
                      Удалить
                    </button>
                  </div>

                  <p style={{ marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                    {item.message}
                  </p>

                  {item.voice_data_url && (
                    <audio
                      controls
                      src={item.voice_data_url}
                      className="admin-review-audio"
                    />
                  )}

                  {item.photo_data_url && (
                    <img
                      src={item.photo_data_url}
                      alt="Фото из обратной связи"
                      className="admin-review-photo"
                    />
                  )}

                  {(item.contact || item.source_path) && (
                    <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
                      {item.contact ? `Контакт: ${item.contact}` : "Контакт не указан"}
                      {item.source_path ? ` · Страница: ${item.source_path}` : ""}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
      {qrLinksWontWorkOnPhone && (
        <Card style={adminCardStyle}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#92400e" }}>
            QR и ссылки для телефона
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.55 }}>
            Вы открыли админку через <code>localhost</code>. На телефоне{" "}
            <code>localhost</code> — это сам телефон, а не ваш ноутбук, поэтому такие
            ссылки не откроются. Откройте сайт по адресу вида{" "}
            <code>http://IP-ноутбука:5174</code> (IP из <code>ipconfig</code>, тот же
            порт, что в строке браузера) и заново скачайте QR.
          </p>
        </Card>
      )}

      {qrLinksWontWorkOnPhone && <div style={{ height: 12 }} />}

      {/* Добавление точки */}
      <Card style={adminCardStyle}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Добавить точку</div>

        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ color: "var(--muted)", marginBottom: 6 }}>
              Экспозиция
            </div>

            <select
              value={newExpoSlug}
              onChange={(e) => setNewExpoSlug(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                outline: "none",
              }}
            >
              {expoOptions.length === 0 ? (
                <option value="polotsk-collegium" style={{ color: "#000" }}>
                  Иезуитский коллегиум в Полоцке (polotsk-collegium)
                </option>
              ) : (
                expoOptions.map((x) => (
                  <option key={x.slug} value={x.slug} style={{ color: "#000" }}>
                    {x.title} ({x.slug})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <div style={{ color: "var(--muted)", marginBottom: 6 }}>Slug</div>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="например: tower"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                outline: "none",
              }}
            />
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 12 }}>
              slug — латиницей, без пробелов: a-z, 0-9, -
            </div>
          </div>

          <div>
            <div style={{ color: "var(--muted)", marginBottom: 6 }}>
              Название
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="например: Башня"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ color: "var(--muted)", marginBottom: 6 }}>
              Описание
            </div>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              placeholder="краткое описание точки"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          <button
            onClick={createNewPoint}
            disabled={savingSlug === "__create__"}
            style={{
              height: 40,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              cursor: savingSlug === "__create__" ? "not-allowed" : "pointer",
              width: "fit-content",
            }}
          >
            {savingSlug === "__create__" ? "Создание…" : "Добавить"}
          </button>
        </div>
      </Card>

      <div style={{ height: 12 }} />

      {/* Поиск */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по экспозиции / slug / названию…"
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          outline: "none",
        }}
      />

      {!points && <p style={{ color: "var(--muted)" }}>Загрузка…</p>}

      {points && (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {filtered.map((p) => {
            const isExpanded = expandedSlugs.has(p.slug);
            const isReordering = savingSlug?.startsWith("__reorder__:");
            return (
            <Card key={p.slug} style={adminCardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: isExpanded ? 800 : 500 }}>{p.title}</div>
                <button
                  type="button"
                  onClick={() => togglePointExpanded(p.slug)}
                  style={{
                    height: 34,
                    width: 34,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                  aria-label={isExpanded ? "Свернуть точку" : "Развернуть точку"}
                  title={isExpanded ? "Свернуть" : "Развернуть"}
                >
                  {isExpanded ? "^" : "˅"}
                </button>
              </div>

              {isExpanded && (
                <>
              <div style={{ color: "var(--muted)", marginTop: 8 }}>
                {p.exhibition_title} ({p.exhibition_slug})
              </div>
              <div style={{ color: "var(--muted)", marginTop: 4 }}>
                slug: <code>{p.slug}</code>
              </div>

              <div style={{ height: 12 }} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => movePoint(p.slug, "up")}
                  disabled={savingSlug === p.slug || isReordering}
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor:
                      savingSlug === p.slug || isReordering
                        ? "not-allowed"
                        : "pointer",
                  }}
                  aria-label="Переместить точку выше"
                  title="Переместить выше"
                >
                  ↑
                </button>
                <button
                  onClick={() => movePoint(p.slug, "down")}
                  disabled={savingSlug === p.slug || isReordering}
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor:
                      savingSlug === p.slug || isReordering
                        ? "not-allowed"
                        : "pointer",
                  }}
                  aria-label="Переместить точку ниже"
                  title="Переместить ниже"
                >
                  ↓
                </button>
                <button
                  onClick={() => savePoint(p.slug)}
                  disabled={savingSlug === p.slug}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor:
                      savingSlug === p.slug ? "not-allowed" : "pointer",
                  }}
                >
                  {savingSlug === p.slug ? "Сохранение…" : "Сохранить"}
                </button>

                <button
                  onClick={() => deletePoint(p.slug)}
                  disabled={savingSlug === p.slug}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid crimson",
                    background: "transparent",
                    color: "crimson",
                    cursor:
                      savingSlug === p.slug ? "not-allowed" : "pointer",
                  }}
                >
                  Удалить
                </button>
              </div>

              <div style={{ height: 12 }} />

              <label
                style={{
                  display: "block",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                Название
              </label>
              <input
                value={p.title}
                onChange={(e) => onChangeField(p.slug, { title: e.target.value })}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  outline: "none",
                }}
              />

              <div style={{ height: 12 }} />

              <label
                style={{
                  display: "block",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                Описание
              </label>
              <textarea
                value={p.description}
                onChange={(e) =>
                  onChangeField(p.slug, { description: e.target.value })
                }
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  outline: "none",
                  resize: "vertical",
                }}
              />

              <div style={{ height: 12 }} />

              {/* QR + скачать */}
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ color: "var(--muted)", marginBottom: 6 }}>
                    QR для точки
                  </div>
                  <QRCodeCanvas
                    id={`qr-${p.exhibition_slug}-${p.slug}`}
                    value={`${qrBaseOrigin}/g/${p.exhibition_slug}/p/${p.slug}`}
                    size={140}
                    includeMargin
                  />

                  <div style={{ height: 10 }} />

                  <button
                    onClick={() => downloadQrPng(p)}
                    style={{
                      height: 36,
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    Скачать QR (PNG)
                  </button>
                </div>

                <div style={{ color: "var(--muted)" }}>
                  Ссылка:
                  <div>
                    <a
                      href={`${qrBaseOrigin}/g/${p.exhibition_slug}/p/${p.slug}`}
                      target="_blank"
                      style={{ wordBreak: "break-all" }}
                    >
                      {`${qrBaseOrigin}/g/${p.exhibition_slug}/p/${p.slug}`}
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              {/* Картинка — новый UI */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: "var(--muted)" }}>
                  Картинка:{" "}
                  {p.image_url ? (
                    <>
                      <strong>загружена</strong> — {fileNameFromUrl(p.image_url)}
                    </>
                  ) : (
                    "нет"
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {p.image_url && (
                    <a
                      href={p.image_url}
                      target="_blank"
                      style={{
                        height: 36,
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        textDecoration: "none",
                      }}
                    >
                      Открыть
                    </a>
                  )}

                  <label
                    style={{
                      height: 36,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    {p.image_url ? "Заменить…" : "Загрузить…"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(p.slug, f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ height: 12 }} />

              {/* Аудио — новый UI */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ color: "var(--muted)" }}>
                  Аудио:{" "}
                  {p.audio_url ? (
                    <>
                      <strong>загружено</strong> — {fileNameFromUrl(p.audio_url)}
                    </>
                  ) : (
                    "нет"
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {p.audio_url && (
                    <a
                      href={p.audio_url}
                      target="_blank"
                      style={{
                        height: 36,
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0 10px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        textDecoration: "none",
                      }}
                    >
                      Открыть
                    </a>
                  )}

                  <label
                    style={{
                      height: 36,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0 10px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    {p.audio_url ? "Заменить…" : "Загрузить…"}
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadAudio(p.slug, f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
                </>
              )}
            </Card>
            );
          })}

          {filtered.length === 0 && (
            <p style={{ color: "var(--muted)" }}>Ничего не найдено.</p>
          )}
        </div>
      )}
        </>
      )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
