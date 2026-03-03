import { NextResponse } from 'next/server'
import { generateDottiBlocks, type WhisperSegment } from '@/lib/dotti-sync'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY not configured on server.' },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request. Expected multipart/form-data.' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: 'Missing "file" field. Send an audio file via multipart/form-data.' },
      { status: 400 }
    )
  }

  const fileName = file instanceof File ? file.name : 'audio.mp3'

  // Send audio to Groq Whisper API
  const groqFormData = new FormData()
  groqFormData.append('file', file, fileName)
  groqFormData.append('model', 'whisper-large-v3')
  groqFormData.append('language', 'en')
  groqFormData.append('response_format', 'verbose_json')
  groqFormData.append('timestamp_granularities[]', 'segment')

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: groqFormData,
  })

  if (!groqRes.ok) {
    const errText = await groqRes.text()
    return NextResponse.json(
      { error: `Groq API error: ${errText}` },
      { status: 502 }
    )
  }

  const data = await groqRes.json()

  if (!data.segments || !Array.isArray(data.segments)) {
    return NextResponse.json(
      { error: 'Groq API returned no segments.' },
      { status: 502 }
    )
  }

  // Get duration from Groq response, or fallback to last segment end time
  const durationSeconds: number =
    data.duration ??
    (data.segments.length > 0
      ? data.segments[data.segments.length - 1].end
      : 0)

  const segments: WhisperSegment[] = data.segments.map(
    (seg: { start: number; end: number; text: string }) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })
  )

  const result = generateDottiBlocks(segments, durationSeconds, fileName)

  return new Response(result, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
