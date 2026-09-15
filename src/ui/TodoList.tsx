import { useAgentStore } from '../agent/session/store'

const statusColor: Record<string, string> = {
  pending: 'text-zinc-400',
  in_progress: 'text-sky-400',
  completed: 'text-emerald-400',
  cancelled: 'text-zinc-600 line-through',
}

export function TodoList() {
  const todos = useAgentStore((s) => s.todos)

  return (
    <div className="flex max-h-44 min-h-0 flex-col border-t border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-3 py-2 text-xs font-medium tracking-wide text-zinc-400">
        Todos {todos.length ? `(${todos.length})` : ''}
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 text-xs">
        {todos.length === 0 && <li className="px-1 text-zinc-600">No todos yet</li>}
        {todos.map((todo) => (
          <li key={todo.id} className="rounded border border-zinc-800/80 px-2 py-1.5">
            <div className={`font-medium ${statusColor[todo.status] ?? 'text-zinc-300'}`}>{todo.content}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
              {todo.status} · {todo.priority}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
