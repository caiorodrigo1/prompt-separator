import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY nao configurada no servidor.' },
      { status: 500 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('audio') as File | null

  if (!file) {
    return NextResponse.json(
      { error: 'Nenhum arquivo de audio enviado.' },
      { status: 400 }
    )
  }

  // Groq Whisper limit: 25MB
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Arquivo excede o limite de 25MB.' },
      { status: 400 }
    )
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  })

  try {
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      language: 'pt',
      response_format: 'text',
    })

    return NextResponse.json({ text: transcription })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido na transcricao.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
