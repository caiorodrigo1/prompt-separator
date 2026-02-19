'use client'

import { useState, useRef } from 'react'

interface SeparatedPrompts {
  withCharacters: string[]
  withoutCharacters: string[]
}

type Tab = 'separator' | 'dotti-sync'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function generateDottiBlocks(text: string, durationSeconds: number, audioFileName: string): string {
  const blockDuration = 8
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (sentences.length === 0) return ''

  const totalWords = text.split(/\s+/).filter(w => w.length > 0).length
  const wordsPerSecond = totalWords / durationSeconds
  const wordsPerBlock = Math.max(1, Math.round(wordsPerSecond * blockDuration))

  const blocks: string[][] = []
  let currentBlock: string[] = []
  let currentWordCount = 0

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0).length
    currentBlock.push(sentence)
    currentWordCount += sentenceWords

    if (currentWordCount >= wordsPerBlock) {
      blocks.push([...currentBlock])
      // Overlap: last sentence of this block starts the next block
      // Don't count overlap words toward the new block's budget
      currentBlock = [currentBlock[currentBlock.length - 1]]
      currentWordCount = 0
    }
  }

  // Push remaining sentences as the last block
  if (currentBlock.length > 0 && (blocks.length === 0 || currentBlock.join(' ') !== blocks[blocks.length - 1].join(' '))) {
    blocks.push(currentBlock)
  }

  const totalBlocks = blocks.length
  const separator = '------------------------------------------------------------'

  const header = [
    '============================================================',
    'SINCRONIZACAO DOTTI SYNC - BLOCOS DE 8 SEGUNDOS',
    '============================================================',
    `Arquivo: ${audioFileName}`,
    `Duracao: ${formatTime(durationSeconds)}`,
    `Total de prompts: ${totalBlocks}`,
    '============================================================',
    '',
  ].join('\n')

  const body = blocks
    .map((block, i) => {
      const startTime = Math.min(i * blockDuration, Math.floor(durationSeconds))
      const endTime = Math.min((i + 1) * blockDuration, Math.ceil(durationSeconds))
      const promptNumber = String(i + 1).padStart(3, '0')
      return `PROMPT ${promptNumber} | ${formatTime(startTime)} - ${formatTime(endTime)}\n${block.join(' ')}\n${separator}`
    })
    .join('\n\n')

  return header + '\n' + body
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('separator')

  // Prompt Separator state
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<SeparatedPrompts | null>(null)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  // Dotti Sync state
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [dottiResult, setDottiResult] = useState('')
  const [dottiCopied, setDottiCopied] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const audioUrlRef = useRef<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setInputText(text)
      }
      reader.readAsText(file)
    }
  }

  const separatePrompts = () => {
    const promptRegex = /PROMPT\s+\d+.*?(?=PROMPT\s+\d+|$)/gs
    const prompts = inputText.match(promptRegex) || []
    const characterRegex = /\b(Char1|Char2|Char3)\b/i

    const withCharacters: string[] = []
    const withoutCharacters: string[] = []

    prompts.forEach((prompt) => {
      const trimmedPrompt = prompt.trim()
      if (trimmedPrompt) {
        if (characterRegex.test(trimmedPrompt)) {
          withCharacters.push(trimmedPrompt)
        } else {
          withoutCharacters.push(trimmedPrompt)
        }
      }
    })

    setResult({ withCharacters, withoutCharacters })
  }

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSection(section)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedSection(section)
        setTimeout(() => setCopiedSection(null), 2000)
      } catch (e) {
        console.error('Falha ao copiar:', e)
      }
      document.body.removeChild(textArea)
    }
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAudioError('')
    setAudioFile(file)
    setAudioDuration(null)
    setDottiResult('')

    // Revoke previous URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    audioUrlRef.current = url

    const audio = new Audio()
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration)
      } else {
        setAudioError('Nao foi possivel detectar a duracao do audio.')
      }
    })
    audio.addEventListener('error', () => {
      setAudioError('Erro ao carregar o arquivo de audio. Verifique o formato.')
    })
    audio.src = url
  }

  const handleTranscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setTranscriptText(text)
      }
      reader.readAsText(file)
    }
  }

  const transcribeAudio = async () => {
    if (!audioFile) return
    setIsTranscribing(true)
    setAudioError('')

    try {
      // Get API key from server
      const keyRes = await fetch('/api/transcribe')
      const keyData = await keyRes.json()
      if (!keyRes.ok) {
        setAudioError(keyData.error || 'Erro ao obter chave da API.')
        return
      }

      // Send audio directly to Groq (bypasses Vercel body size limit)
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('model', 'whisper-large-v3-turbo')
      formData.append('language', 'pt')
      formData.append('response_format', 'text')

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${keyData.key}` },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.text()
        setAudioError(`Erro na transcricao: ${err}`)
        return
      }

      const text = await res.text()
      setTranscriptText(text)
    } catch {
      setAudioError('Erro ao conectar com o servico de transcricao.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const generateBlocks = () => {
    if (!audioFile || !audioDuration || !transcriptText.trim()) return
    const output = generateDottiBlocks(transcriptText, audioDuration, audioFile.name)
    setDottiResult(output)
  }

  const copyDottiResult = async () => {
    try {
      await navigator.clipboard.writeText(dottiResult)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = dottiResult
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
    setDottiCopied(true)
    setTimeout(() => setDottiCopied(false), 2000)
  }

  const downloadDottiResult = () => {
    const blob = new Blob([dottiResult], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = audioFile?.name.replace(/\.[^.]+$/, '') || 'dotti-sync'
    a.download = `${baseName}_dotti-sync.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">
        Prompt Separator
      </h1>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-700 mb-8">
        <button
          onClick={() => setActiveTab('separator')}
          className={`py-3 px-6 font-semibold transition-colors ${
            activeTab === 'separator'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Prompt Separator
        </button>
        <button
          onClick={() => setActiveTab('dotti-sync')}
          className={`py-3 px-6 font-semibold transition-colors ${
            activeTab === 'dotti-sync'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Audio Sync
        </button>
      </div>

      {/* Prompt Separator tab */}
      {activeTab === 'separator' && (
        <>
          <p className="text-gray-400 text-center mb-8">
            Separa prompts em duas listas: com personagens (Char1, Char2, Char3) e sem personagens
          </p>

          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium">
              Upload arquivo .txt ou cole o texto abaixo:
            </label>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-400 mb-4
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                cursor-pointer"
            />
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Cole seus prompts aqui..."
              className="w-full h-64 p-4 bg-gray-900 border border-gray-700 rounded-lg
                text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={separatePrompts}
            disabled={!inputText.trim()}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
              disabled:cursor-not-allowed rounded-lg font-semibold transition-colors mb-8"
          >
            Separar Prompts
          </button>

          {result && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-green-400">
                    Sem Personagens ({result.withoutCharacters.length})
                  </h2>
                  <button
                    onClick={() => copyToClipboard(result.withoutCharacters.join('\n\n'), 'without')}
                    className={`text-sm px-3 py-1 rounded transition-colors ${
                      copiedSection === 'without'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {copiedSection === 'without' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {result.withoutCharacters.length === 0 ? (
                    <p className="text-gray-500 italic">Nenhum prompt sem personagens</p>
                  ) : (
                    result.withoutCharacters.map((prompt, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-800 rounded border-l-4 border-green-500 text-sm"
                      >
                        <pre className="whitespace-pre-wrap font-mono">{prompt}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-orange-400">
                    Com Personagens ({result.withCharacters.length})
                  </h2>
                  <button
                    onClick={() => copyToClipboard(result.withCharacters.join('\n\n'), 'with')}
                    className={`text-sm px-3 py-1 rounded transition-colors ${
                      copiedSection === 'with'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {copiedSection === 'with' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {result.withCharacters.length === 0 ? (
                    <p className="text-gray-500 italic">Nenhum prompt com personagens</p>
                  ) : (
                    result.withCharacters.map((prompt, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-800 rounded border-l-4 border-orange-500 text-sm"
                      >
                        <pre className="whitespace-pre-wrap font-mono">{prompt}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Audio Sync tab */}
      {activeTab === 'dotti-sync' && (
        <>
          <p className="text-gray-400 text-center mb-8">
            Gera blocos de 8 segundos sincronizados a partir de um audio e texto transcrito
          </p>

          {/* Audio upload */}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium">
              Upload do arquivo de audio:
            </label>
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.aac,.webm"
              onChange={handleAudioUpload}
              className="block w-full text-sm text-gray-400 mb-2
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                cursor-pointer"
            />
            {audioFile && (
              <div className="text-sm text-gray-400 mt-2 space-y-1">
                <p>Arquivo: <span className="text-gray-200">{audioFile.name}</span></p>
                {audioDuration !== null && (
                  <p>Duracao: <span className="text-gray-200">{formatTime(audioDuration)}</span></p>
                )}
              </div>
            )}
            {audioError && (
              <p className="text-red-400 text-sm mt-2">{audioError}</p>
            )}
          </div>

          {/* Whisper transcription */}
          <div className="mb-6">
            <button
              onClick={transcribeAudio}
              disabled={!audioFile || isTranscribing}
              className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700
                disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {isTranscribing ? 'Transcrevendo com Whisper...' : 'Transcrever com Whisper'}
            </button>
            {isTranscribing && (
              <p className="text-purple-400 text-sm mt-2 text-center animate-pulse">
                Enviando audio para o Whisper API... isso pode levar alguns minutos.
              </p>
            )}
          </div>

          {/* Transcript input (manual fallback) */}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-400">
              Ou upload/cole o texto transcrito manualmente:
            </label>
            <input
              type="file"
              accept=".txt"
              onChange={handleTranscriptUpload}
              className="block w-full text-sm text-gray-400 mb-4
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-gray-700 file:text-gray-300
                hover:file:bg-gray-600
                cursor-pointer"
            />
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="O texto transcrito aparecera aqui apos a transcricao, ou cole manualmente..."
              className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-lg
                text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={generateBlocks}
            disabled={!audioFile || audioDuration === null || !transcriptText.trim()}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
              disabled:cursor-not-allowed rounded-lg font-semibold transition-colors mb-8"
          >
            Gerar Blocos
          </button>

          {dottiResult && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-blue-400">
                  Resultado DOTTI SYNC
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={copyDottiResult}
                    className={`text-sm px-3 py-1 rounded transition-colors ${
                      dottiCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {dottiCopied ? 'Copiado!' : 'Copiar Tudo'}
                  </button>
                  <button
                    onClick={downloadDottiResult}
                    className="text-sm px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    Download .txt
                  </button>
                </div>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200 max-h-[600px] overflow-y-auto">
                {dottiResult}
              </pre>
            </div>
          )}
        </>
      )}
    </main>
  )
}
