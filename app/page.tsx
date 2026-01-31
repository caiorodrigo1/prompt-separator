'use client'

import { useState } from 'react'

interface SeparatedPrompts {
  withCharacters: string[]
  withoutCharacters: string[]
}

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<SeparatedPrompts | null>(null)

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
    // Regex para encontrar cada prompt (começa com PROMPT seguido de número)
    const promptRegex = /PROMPT\s+\d+.*?(?=PROMPT\s+\d+|$)/gs
    const prompts = inputText.match(promptRegex) || []

    // Regex para detectar personagens (Char1, Char2, Char3)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">
        Prompt Separator
      </h1>
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
          {/* Lista SEM personagens */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-green-400">
                Sem Personagens ({result.withoutCharacters.length})
              </h2>
              <button
                onClick={() => copyToClipboard(result.withoutCharacters.join('\n\n'))}
                className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Copiar
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

          {/* Lista COM personagens */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-orange-400">
                Com Personagens ({result.withCharacters.length})
              </h2>
              <button
                onClick={() => copyToClipboard(result.withCharacters.join('\n\n'))}
                className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                Copiar
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
    </main>
  )
}
