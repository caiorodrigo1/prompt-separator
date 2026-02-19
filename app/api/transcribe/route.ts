import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY nao configurada no servidor.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ key: apiKey })
}
