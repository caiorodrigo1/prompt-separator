export interface WhisperSegment {
  start: number
  end: number
  text: string
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function generateDottiBlocks(
  segments: WhisperSegment[],
  durationSeconds: number,
  audioFileName: string
): string {
  if (segments.length === 0) return ''

  const blockDuration = 8
  const totalBlocks = Math.ceil(durationSeconds / blockDuration)
  const blocks: WhisperSegment[][] = []

  for (let i = 0; i < totalBlocks; i++) {
    const windowStart = i * blockDuration
    const windowEnd = (i + 1) * blockDuration

    const blockSegments = segments.filter(
      (seg) => seg.start >= windowStart && seg.start < windowEnd
    )

    blocks.push(blockSegments)
  }

  // Fill empty blocks by moving the last segment from the previous block.
  // Reverse iteration keeps segments closer to their original timestamp.
  for (let i = blocks.length - 1; i >= 1; i--) {
    if (blocks[i].length === 0 && blocks[i - 1].length > 0) {
      blocks[i].push(blocks[i - 1].pop()!)
    }
  }

  // Remove trailing empty blocks
  while (blocks.length > 0 && blocks[blocks.length - 1].length === 0) {
    blocks.pop()
  }

  if (blocks.length === 0) return ''

  const separator = '------------------------------------------------------------'

  const header = [
    '============================================================',
    'SINCRONIZACAO DOTTI SYNC - BLOCOS DE 8 SEGUNDOS',
    '============================================================',
    `Arquivo: ${audioFileName}`,
    `Duracao: ${formatTime(durationSeconds)}`,
    `Total de prompts: ${blocks.length}`,
    '============================================================',
    '',
  ].join('\n')

  const body = blocks
    .map((block, i) => {
      const startTime = Math.min(i * blockDuration, Math.floor(durationSeconds))
      const endTime = Math.min((i + 1) * blockDuration, Math.ceil(durationSeconds))
      const promptNumber = String(i + 1).padStart(3, '0')
      const text = block.map((seg) => seg.text.trim()).join(' ')
      return `PROMPT ${promptNumber} | ${formatTime(startTime)} - ${formatTime(endTime)}\n${text}\n${separator}`
    })
    .join('\n\n')

  return header + '\n' + body
}
