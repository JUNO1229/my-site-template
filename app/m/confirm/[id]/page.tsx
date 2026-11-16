'use client'
import { use } from 'react'
import ConfirmScreen from '@/components/confirm-screen'
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ConfirmScreen getPath={`/reports/${id}/confirm`} actionBase={`/reports/${id}`} backHref={`/m/articles/${id}`} />
}
