import { LogEntry } from '@engine/types/game'

interface GameLogProps {
  logs: LogEntry[]
}

export function GameLog({ logs }: GameLogProps) {
  const recent = logs.slice(-50) // Show last 50 entries

  const colorForType = (type: string) => {
    switch (type) {
      case 'ACTION': return 'text-blue-300'
      case 'EFFECT': return 'text-yellow-300'
      case 'SYSTEM': return 'text-gray-400'
      case 'ERROR': return 'text-red-400'
      default: return 'text-white'
    }
  }

  return (
    <div className="space-y-1">
      {recent.map((log, i) => (
        <div key={i} className={`text-xs ${colorForType(log.type)} font-mono`}>
          <span className="text-gray-500">[{log.type}]</span> {log.message}
        </div>
      ))}
    </div>
  )
}
