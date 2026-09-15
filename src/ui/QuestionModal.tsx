import { useEffect, useState } from 'react'
import { useAgentStore, type QuestionPrompt } from '../agent/session/store'

function QuestionBlock({
  prompt,
  index,
  value,
  onChange,
}: {
  prompt: QuestionPrompt
  index: number
  value: string[]
  onChange: (index: number, next: string[]) => void
}) {
  const [custom, setCustom] = useState('')
  const allowCustom = prompt.custom !== false

  function toggle(label: string) {
    if (prompt.multiple) {
      onChange(index, value.includes(label) ? value.filter((v) => v !== label) : [...value, label])
    } else {
      onChange(index, [label])
    }
  }

  function applyCustom() {
    const text = custom.trim()
    if (!text) return
    if (prompt.multiple) {
      onChange(index, [...value.filter((v) => v !== text), text])
    } else {
      onChange(index, [text])
    }
    setCustom('')
  }

  return (
    <div className="space-y-2 rounded border border-zinc-700 bg-zinc-900 p-3">
      {prompt.header && <div className="text-xs uppercase tracking-wide text-zinc-500">{prompt.header}</div>}
      <div className="text-sm text-zinc-100">{prompt.question}</div>
      <div className="flex flex-wrap gap-2">
        {prompt.options.map((opt) => {
          const selected = value.includes(opt.label)
          return (
            <button
              key={opt.label}
              type="button"
              title={opt.description}
              onClick={() => toggle(opt.label)}
              className={`rounded px-2 py-1 text-xs ${
                selected ? 'bg-sky-700 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Type your own answer"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
          >
            Add
          </button>
        </div>
      )}
      {value.length > 0 && <div className="text-[11px] text-zinc-500">Selected: {value.join(', ')}</div>}
    </div>
  )
}

export function QuestionModal() {
  const pending = useAgentStore((s) => s.pendingQuestion)
  const answerQuestion = useAgentStore((s) => s.answerQuestion)
  const cancelQuestion = useAgentStore((s) => s.cancelQuestion)
  const [answers, setAnswers] = useState<string[][]>([])

  useEffect(() => {
    if (!pending) {
      setAnswers([])
      return
    }
    setAnswers(pending.questions.map(() => []))
  }, [pending])

  if (!pending) return null

  function setAnswer(index: number, next: string[]) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? next : a)))
  }

  function submit() {
    answerQuestion(answers)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-zinc-100 shadow-xl">
        <div className="mb-3 text-sm font-medium tracking-wide text-zinc-300">Agent question</div>
        <div className="space-y-3">
          {pending.questions.map((q, i) => (
            <QuestionBlock
              key={i}
              prompt={q}
              index={i}
              value={answers[i] ?? []}
              onChange={setAnswer}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelQuestion}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm hover:bg-sky-600"
          >
            Submit answers
          </button>
        </div>
      </div>
    </div>
  )
}
