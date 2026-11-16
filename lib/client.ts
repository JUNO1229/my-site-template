'use client'
import { useCallback, useEffect, useState } from 'react'

export async function api<T = any>(path: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const r = await fetch('/api' + path, {
    method: opts.method || (opts.json || opts.form ? 'POST' : 'GET'),
    headers: opts.json ? { 'content-type': 'application/json' } : undefined,
    body: opts.form ?? (opts.json ? JSON.stringify(opts.json) : undefined),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || '요청에 실패했습니다.'), { status: r.status, code: j?.error?.code })
  return j
}
export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<(Error & { status?: number }) | null>(null)
  const reload = useCallback(async () => { if (!path) return; try { setData(await api<T>(path)); setError(null) } catch (e) { setError(e as Error) } }, [path]) // eslint-disable-line
  useEffect(() => { reload() }, [reload, ...deps]) // eslint-disable-line
  return { data, error, reload }
}
export const CHIP: Record<string, [string, string]> = {
  RECEIVED: ['접수', 'chip-gray'], DRAFTING: ['작성중', 'chip-info'], CONFIRM_REQ: ['고객 확인 대기', 'chip-warn'], REVISION: ['수정 요청 도착', 'chip-warn'],
  APPROVED: ['게재 대기', 'chip-navy'], SCHEDULED: ['게재 예약', 'chip-navy'], PUBLISHED: ['게재 완료', 'chip-ok'], CORRECTION: ['정정 처리중', 'chip-warn'], REJECTED: ['반려', 'chip-bad'],
}
export const CUSTOMER_CHIP: Record<string, [string, string]> = {
  RECEIVED: ['접수완료', 'chip-gray'], DRAFTING: ['작성중', 'chip-info'], CONFIRM_REQ: ['확인요청', 'chip-warn'], REVISION: ['수정중', 'chip-warn'],
  APPROVED: ['게재대기', 'chip-navy'], SCHEDULED: ['게재대기', 'chip-navy'], PUBLISHED: ['게재완료', 'chip-ok'], CORRECTION: ['정정중', 'chip-warn'], REJECTED: ['반려', 'chip-bad'],
}
export const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\. /g, '.').replace('.,', '') : ''
export const remain = (iso: string) => { const ms = new Date(iso).getTime() - Date.now(); return ms <= 0 ? '기한 경과' : ms < 3600e3 ? `${Math.ceil(ms / 60e3)}분 남음` : `${Math.floor(ms / 3600e3)}시간 남음` }
export const hoursLeft = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3600e3
export const mediaUrl = (id?: string | null) => id ? `/api/media/${id}` : ''

/** 업로드 전 기기에서 1600px로 줄여 전송(EXIF도 함께 제거됨) */
export async function shrinkImage(file: File, max = 1600): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file); const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s)
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
    const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), 'image/jpeg', 0.82))
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}
