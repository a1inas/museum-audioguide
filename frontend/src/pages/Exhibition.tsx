import { Navigate } from "react-router-dom";

// Эта страница больше не используется в пользовательском сценарии.
// При обращении к /g/:expoSlug сразу отправляем на главную.
export function Exhibition() {
  return <Navigate to="/" replace />;
}
