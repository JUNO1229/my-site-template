export async function api<T = unknown>(url: string, method = "GET", data?: unknown): Promise<T> {
  const r = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
    headers: data === undefined ? undefined : { "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !location.pathname.startsWith("/login")) { location.href = "/login"; throw new Error("로그인이 필요합니다"); }
  if (!r.ok) throw new Error((j as { error?: string }).error || "요청에 실패했습니다");
  return j as T;
}
