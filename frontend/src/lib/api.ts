const rawApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";
const apiBase = rawApiBase.replace(/\/+$/, "");

export function apiUrl(path: string) {
  if (!path) return apiBase || "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return apiBase ? `${apiBase}${path}` : path;
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return "";
  if (
    /^https?:\/\//i.test(path) ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  return apiUrl(path);
}
