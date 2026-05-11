import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../ui/Layout";

type Block = {
  title: string;
  imageUrlOld: string;
  imageUrlNew: string;
  captionBefore?: string;
  captionAfter?: string;
};

const blocks: Block[] = [
  { title: "Корпус А", imageUrlOld: "/reconstruction/korpus-a-do.jpg", imageUrlNew: "/reconstruction/korpus-a-posle.png", captionBefore: "До реконструкции", captionAfter: "После реконструкции" },
  { title: "Корпус Б", imageUrlOld: "/reconstruction/korpus-b-do.jpg", imageUrlNew: "/reconstruction/korpus-b-posle.jpg", captionBefore: "До реконструкции", captionAfter: "После реконструкции" },
  { title: "Корпус В", imageUrlOld: "/reconstruction/korpus-v-do.jpg", imageUrlNew: "/reconstruction/korpus-v-posle.jpg", captionBefore: "До реконструкции", captionAfter: "После реконструкции" },
  { title: "Корпус Г", imageUrlOld: "/reconstruction/korpus-g-do.jpg", imageUrlNew: "/reconstruction/korpus-g-posle.jpg", captionBefore: "До реконструкции", captionAfter: "После реконструкции" },
  { title: "Корпус Д", imageUrlOld: "/reconstruction/korpus-d-do.jpg", imageUrlNew: "/reconstruction/korpus-d-posle.jpg", captionBefore: "До реконструкции", captionAfter: "После реконструкции" },
  { title: "Корпус Е", imageUrlOld: "/reconstruction/korpus-e-do.jpg", imageUrlNew: "/reconstruction/korpus-e-posle.jpg", captionBefore: "До реконструкции", captionAfter: "После реконструкции" },
];

function AgeSliderBlock({
  title,
  imageUrlOld,
  imageUrlNew,
  captionBefore,
  captionAfter,
}: Block) {
  const [value, setValue] = useState(50);

  return (
    <section
      style={{
        marginBottom: 32,
      }}
    >
      <h2
        style={{
          margin: "0 0 14px 0",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(152,110,60,0.35)",
          boxShadow: "0 10px 24px rgba(120,90,52,0.2)",
          background: "rgba(255,249,238,0.5)",
        }}
      >
        {/* Общая ширина для фото и ползунка — граница совпадает с ползунком */}
        <div style={{ padding: "0 16px" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/10",
              overflow: "hidden",
            }}
          >
            {/* Старое фото — на весь кадр (справа от границы) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url("${imageUrlOld}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Слева — новая фотография; clip-path без изменения размера — фото не прыгает */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url("${imageUrlNew}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                clipPath: `inset(0 ${100 - value}% 0 0)`,
                transition: "clip-path 0.15s ease-out",
              }}
            />
            {/* Вертикальная линия — на одной вертикали с ползунком (value%) */}
            <div
              style={{
                position: "absolute",
                left: `${value}%`,
                top: 0,
                bottom: 0,
                width: 3,
                marginLeft: -1.5,
                background: "rgba(255,255,255,0.95)",
                boxShadow: "0 0 8px rgba(0,0,0,0.4)",
                pointerEvents: "none",
                transition: "left 0.15s ease-out",
              }}
            />
          </div>
          <div style={{ padding: "14px 0 16px 0" }}>
            <div style={{ width: "100%" }}>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) =>
                  setValue(Number((e.target as HTMLInputElement).value))
                }
                className="age-slider age-slider--fullwidth"
                aria-label="До реконструкции — после реконструкции"
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(43,32,21,0.9)",
              }}
            >
              <span>{captionBefore ?? "До реконструкции"}</span>
              <span>{captionAfter ?? "После реконструкции"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReconstructionPage() {
  return (
    <Layout title="Реконструкция" fullBleed>
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
              "radial-gradient(circle at 18% 22%, rgba(244, 230, 201, 0.28) 0%, rgba(244, 230, 201, 0) 36%)," +
              "radial-gradient(circle at 86% 14%, rgba(132, 92, 52, 0.34) 0%, rgba(132, 92, 52, 0) 42%)," +
              "radial-gradient(circle at 80% 82%, rgba(116, 78, 44, 0.3) 0%, rgba(116, 78, 44, 0) 38%)," +
              "radial-gradient(circle at 8% 78%, rgba(152, 108, 66, 0.24) 0%, rgba(152, 108, 66, 0) 34%)," +
              "repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.04) 0 2px, rgba(255, 255, 255, 0) 2px 12px)," +
              "linear-gradient(140deg, #b69364 0%, #9f784d 48%, #855e3b 100%)",
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
                margin: 0,
                fontSize: "clamp(24px, 5vw, 32px)",
                lineHeight: 1.15,
                fontWeight: 750,
                letterSpacing: "0.03em",
              }}
            >
              Реконструкция
            </h1>
            <p
              style={{
                color: "var(--muted)",
                maxWidth: 560,
                marginBottom: 24,
                marginTop: 12,
              }}
            >
              На этой странице можно посмотреть, как менялся облик зданий.
              Двигайте ползунок влево — старое фото (до реконструкции), вправо —
              новое (после реконструкции).
            </p>

            {blocks.map((block, idx) => (
              <AgeSliderBlock
                key={idx}
                title={block.title}
                imageUrlOld={block.imageUrlOld}
                imageUrlNew={block.imageUrlNew}
                captionBefore={block.captionBefore}
                captionAfter={block.captionAfter}
              />
            ))}

            <div style={{ marginTop: 24 }}>
              <Link to="/" className="back-link">
                ← На главную
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
