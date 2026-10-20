import { useEffect, useState } from 'react'
import { colorizeDiffLines, highlightDiff } from './diffHighlight'

type Props = {
  patch: string
  path?: string
  className?: string
}

export function DiffView({ patch, path, className = '' }: Props) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void highlightDiff(patch, path).then((next) => {
      if (!cancelled) setHtml(next)
    })
    return () => {
      cancelled = true
    }
  }, [patch, path])

  if (html) {
    return (
      <div
        className={`diff-shiki overflow-auto text-[11px] leading-relaxed [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  const lines = colorizeDiffLines(patch)
  return (
    <pre className={`overflow-auto font-mono text-[11px] leading-4 ${className}`}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.type === 'add'
              ? 'bg-emerald-950/40 text-emerald-300'
              : line.type === 'del'
                ? 'bg-red-950/40 text-red-300'
                : line.type === 'meta'
                  ? 'text-zinc-500'
                  : 'text-zinc-400'
          }
        >
          {line.text || ' '}
        </div>
      ))}
    </pre>
  )
}
