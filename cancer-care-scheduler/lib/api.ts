export async function api<T = unknown>(url: string, method = "GET", data?: unknown): Promise<T> {
  const r = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
    headers: data === undefined ? undefined : { "content-type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !location.pathname.startsWith("/login")) {
    let last = 0; try { last = Number(sessionStorage.getItem("ccs-redirect") || 0); } catch { /* ignore */ }
    if (Date.now() - last > 5000) { try { sessionStorage.setItem("ccs-redirect", String(Date.now())); } catch { /* ignore */ } location.href = "/login?expired=1"; }
    throw new Error("로그인이 필요합니다");
  }
  if (!r.ok) { const err = new Error((j as { error?: string }).error || "요청에 실패했습니다") as Error & { code?: string }; err.code = (j as { code?: string }).code; throw err; }
  return j as T;
}
