'use client'
import { createContext, useContext } from 'react'
export type Me = { id: string; name: string; role: string; customer: { kind: string; name: string } }
export const MeCtx = createContext<Me | null>(null)
export const useMe = () => useContext(MeCtx)!
