import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../ui/Layout";
import { Card } from "../ui/Card";
import { ButtonLink } from "../ui/ButtonLink";

type Exhibition = {
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
};

export function Home() {
  const [items, setItems] = useState<Exhibition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/exhibitions")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as Exhibition[];
      })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  const main = useMemo(() => (items && items.length > 0 ? items[0] : null), [items]);
  const rest = useMemo(
    () => (items && items.length > 1 ? items.slice(1) : []),
    [items]
  );

  return (
    <Layout title={main ? main.title : "Аудиогид"} fullBleed>
      {error && <p style={{ color: "crimson" }}>Ошибка: {error}</p>}
      {!items && !error && <p style={{ color: "var(--muted)" }}>Загрузка…</p>}

      {items && items.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Экспозиций пока нет.</p>
      )}

      {main && (
        <section
          className="hero-section"
          style={{
            position: "relative",
            height: "100%",
            backgroundColor: "#020617",
            overflow: "hidden",
          }}
        >
          {/* Видео на фоне */}
          <video
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.02)",
            }}
          >
            <source src="/hero-main.webm" type="video/webm" />
          </video>

          {/* Градиент поверх видео для читаемости текста */}
          <div
            className="hero-layer"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.72) 32%, rgba(15,23,42,0.5) 60%, rgba(15,23,42,0.06) 100%)",
            }}
          />

          {/* Контент слева, как на макете */}
          <div
            className="hero-text"
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              height: "100%",
              padding: "56px 42px 64px",
              maxWidth: 560,
              color: "#e5e7eb",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily:
                  '"Playfair Display", "Times New Roman", "Georgia", system-ui, -apple-system, serif',
                fontSize: 48,
                lineHeight: 1.08,
                fontWeight: 600,
                letterSpacing: "0.03em",
                color: "#f9fafb",
              }}
            >
              Тайны белорусского Хогвартса
            </h1>

            <p
              style={{
                marginTop: 18,
                fontSize: 16,
                lineHeight: 1.6,
                color: "rgba(229,231,235,0.92)",
                maxWidth: 520,
              }}
            >
              Полоцкий коллегиум / ПГУ
            </p>

            <p
              style={{
                marginTop: 10,
                fontSize: 14,
                lineHeight: 1.7,
                color: "rgba(209,213,219,0.9)",
                maxWidth: 520,
              }}
            >
              Прогулка по территории Полоцкого государственного университета в
              зданиях бывшего иезуитского коллегиума — одного из самых узнаваемых
              исторических комплексов Полоцка. За 10 остановок вы увидите
              символические университетские традиции, узнаете о людях, чьи имена
              связаны с Полотчиной, и заглянете в инженерные и музейные
              секреты старинных стен.
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 22,
                flexWrap: "wrap",
              }}
            >
              <Link
                to={`/g/${main.slug}/points`}
                className="hero-main-button"
              >
                Список точек
              </Link>
            </div>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <>
          <div style={{ height: 22 }} />
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Другие экспозиции</div>
          <div style={{ display: "grid", gap: 12 }}>
            {rest.map((e) => (
              <Card key={e.slug}>
                <div style={{ fontSize: 16, fontWeight: 750 }}>{e.title}</div>
                <div style={{ color: "var(--muted)", marginTop: 6 }}>
                  {e.description}
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <ButtonLink to={`/g/${e.slug}`}>Открыть экспозицию</ButtonLink>
                  <ButtonLink to={`/g/${e.slug}/points`}>Список точек</ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
