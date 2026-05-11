import { useEffect, useMemo, useState } from "react";
import { Layout } from "../ui/Layout";
import { Card } from "../ui/Card";
import { ButtonLink } from "../ui/ButtonLink";

type PublicPoint = {
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  audio_url: string | null;
  exhibition_slug: string;
  exhibition_title: string;
};

export function CollectionPage() {
  const [points, setPoints] = useState<PublicPoint[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/points")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setPoints((data.points ?? []) as PublicPoint[]);
      })
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!points) return [];
    const s = q.trim().toLowerCase();
    if (!s) return points;
    return points.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.description.toLowerCase().includes(s) ||
        p.exhibition_title.toLowerCase().includes(s)
    );
  }, [points, q]);

  return (
    <Layout title="Коллекция">
      <p style={{ color: "var(--muted)", maxWidth: 520 }}>
        Все опубликованные точки аудиогида из коллекции музея. Выберите точку,
        чтобы открыть подробности и запустить аудиогид.
      </p>

      <div style={{ height: 12 }} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по названию или экспозиции…"
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

      {error && <p style={{ color: "crimson" }}>Ошибка: {error}</p>}
      {!points && !error && (
        <p style={{ color: "var(--muted)" }}>Загрузка точек…</p>
      )}

      {points && (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {filtered.map((p) => (
            <Card key={`${p.exhibition_slug}-${p.slug}`}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 750 }}>{p.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {p.exhibition_title}
                </div>
                <div style={{ color: "var(--muted)", marginTop: 4 }}>
                  {p.description}
                </div>

                <div style={{ marginTop: 10 }}>
                  <ButtonLink to={`/g/${p.exhibition_slug}/p/${p.slug}`}>
                    Открыть точку
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ))}

          {filtered.length === 0 && (
            <p style={{ color: "var(--muted)" }}>Точек пока нет или ничего не найдено.</p>
          )}
        </div>
      )}
    </Layout>
  );
}

