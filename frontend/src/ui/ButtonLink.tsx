import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function ButtonLink(props: { to: string; children: ReactNode }) {
  return (
    <Link
      to={props.to}
      className="app-button-link"
    >
      {props.children}
    </Link>
  );
}
