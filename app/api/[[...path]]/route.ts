import { NextRequest } from 'next/server'
import { handle } from '@/lib/api'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
type P = { params: Promise<{ path?: string[] }> }
const h = async (req: NextRequest, { params }: P) => handle(req, (await params).path ?? [])
export { h as GET, h as POST, h as PUT, h as PATCH, h as DELETE }
