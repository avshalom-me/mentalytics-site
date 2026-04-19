export async function getFingerprint(): Promise<string> {
  const parts = [
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? "",
    (navigator as any).deviceMemory ?? "",
    navigator.maxTouchPoints ?? 0,
    navigator.platform,
  ];

  const raw = parts.join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
