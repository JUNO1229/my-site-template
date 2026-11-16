'use client'
import { use } from 'react'
import ConfirmScreen from '@/components/confirm-screen'
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  return <ConfirmScreen getPath={`/confirm/${token}`} actionBase={`/confirm/${token}`} />
}
