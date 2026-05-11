import type { CSSProperties, ReactNode } from "react";

export function Card(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--panel-soft)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        boxShadow: "var(--shadow-soft)",
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}
