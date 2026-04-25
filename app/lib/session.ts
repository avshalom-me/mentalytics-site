export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "mnt_session_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
