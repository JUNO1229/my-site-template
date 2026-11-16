export type ReportStatus = 'RECEIVED'|'DRAFTING'|'CONFIRM_REQ'|'REVISION'|'APPROVED'|'SCHEDULED'|'PUBLISHED'|'CORRECTION'|'REJECTED'
export type Customer = { id: string; kind: 'ORG'|'PERSON'; name: string; inviteCode?: string|null; memo?: string|null; createdAt: string }
export type CustomerUser = { id: string; customerId: string; name: string; phone: string; role: 'REPORTER'|'ORG_ADMIN'; department?: string|null; createdAt: string }
export type Staff = { id: string; name: string; email: string; passHash: string; role: 'EDITOR'|'DESK'|'ADMIN' }
export type Report = {
  id: string; no: string; customerId: string; reporterId: string
  title?: string|null; category: string; eventAt?: string|null; place?: string|null; memo?: string|null
  desiredDate: string; consent: boolean; consentVersion: string
  status: ReportStatus; ownerId?: string|null; rejectReason?: string|null; section?: string|null
  mediaIds: string[]; attachmentIds: string[]
  createdAt: string; assignedAt?: string|null; approvedAt?: string|null; scheduledAt?: string|null; publishedAt?: string|null; updatedAt: string
  aiState?: 'PENDING'|'DONE'|'FAILED'
}
export type Media = { id: string; ownerId: string; kind: 'PHOTO'|'ATTACHMENT'; mime: string; name: string; dataUrl: string; addedBy: 'CUSTOMER'|'STAFF'; createdAt: string }
export type Draft = {
  reportId: string; titleCandidates: string[]; title: string; subtitle?: string; caption?: string; body: string
  tags: string[]; aiChecks: string[]; checklist: { photo: boolean; fact: boolean; ad: boolean }
  aiGeneratedAt?: string|null; savedAt: string; edited: boolean
}
export type Version = { reportId: string; version: number; title: string; subtitle?: string; caption?: string; paragraphs: string[]; createdBy: string; createdAt: string }
export type Confirm = {
  id: string; reportId: string; version: number; tokenHash: string; requestedAt: string; deadline: string
  remindedAt?: string|null; result?: 'APPROVED'|'REVISION'|'AUTO'|null; respondedAt?: string|null; respondedBy?: string|null
  generalNote?: string|null; comments: { paragraph: number; text: string; resolved: boolean }[]
}
export type History = { id: string; reportId: string; at: string; actorType: 'CUSTOMER'|'STAFF'|'SYSTEM'; actorId?: string|null; text: string }
export type Distribution = { id: string; reportId: string; channel: 'HOMEPAGE'|'FACEBOOK'|'BLOG'|'PORTAL'; status: 'PENDING'|'DONE'|'FAILED'; url?: string|null; views: number }
export type Notif = { id: string; event: string; toType: 'CUSTOMER'|'STAFF'; toId: string; channel: string; result: string; text: string; reportId?: string; createdAt: string }
