'use client'
import { createContext, useContext } from 'react'
export type Row = { id: string; no: string; title: string; customer: string; category: string; desiredDate: string; status: string; ownerId?: string; ownerName?: string; createdAt: string; assignedAt?: string; publishedAt?: string; scheduledAt?: string; coverId?: string; deadline?: string; lastResult?: string }
export type D = { me: { id: string; name: string }; rows: Row[]; reload: () => Promise<void> }
export const DeskCtx = createContext<D | null>(null)
export const useDesk = () => useContext(DeskCtx)!
