export type Rect = { top: number; left: number; width: number; height: number }

type Props = {
  rect: Rect | null
  label?: string
}

export function SelectionOverlay({ rect, label }: Props) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null

  return (
    <div
      className="pointer-events-none absolute z-10 border-2 border-blue-500 bg-blue-500/5"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      {label ? (
        <div className="absolute -top-5 left-0 rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {label}
        </div>
      ) : null}
    </div>
  )
}
