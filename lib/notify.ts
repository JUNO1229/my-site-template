import { notifs } from './store'

type Msg = { event: string; toType: 'CUSTOMER' | 'STAFF'; toId: string; text: string; reportId?: string; phone?: string }

/** 알림톡 → 실패 시 문자. 개발·검토 환경(NOTIFY_DRY_RUN != 'false')에서는 실제 발송 없이 로그만 남긴다. */
export async function notify(m: Msg) {
  const dry = process.env.NOTIFY_DRY_RUN !== 'false'
  const channel = m.toType === 'STAFF' ? 'IN_APP' : 'ALIMTALK'
  if (!dry && m.toType === 'CUSTOMER') {
    // TODO: 알림톡 대행사 API 연동 (템플릿 사전 승인 필요). 승인 전에는 문자만.
    console.warn('알림톡/문자 대행사가 아직 연동되지 않았습니다:', m.event)
  }
  await notifs.add({ event: m.event, toType: m.toType, toId: m.toId, channel, result: dry ? 'DRY_RUN' : 'SKIPPED', text: m.text, reportId: m.reportId })
}
export const base = () => process.env.APP_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
