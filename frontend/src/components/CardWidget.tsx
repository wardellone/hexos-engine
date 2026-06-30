import { CardInstance } from '@engine/types/game'

interface CardWidgetProps {
  card: CardInstance
}

export function CardWidget({ card }: CardWidgetProps) {
  const bgColor = {
    DINO: 'bg-green-900',
    ZEUS: 'bg-yellow-900',
    ROME: 'bg-red-900',
    VOID: 'bg-purple-900',
    TOMB: 'bg-gray-700',
    NORD: 'bg-blue-900',
    ARTS: 'bg-indigo-900',
    GOLD: 'bg-amber-900',
    AZTEC: 'bg-orange-900',
    MIST: 'bg-cyan-900',
    BABEL: 'bg-pink-900',
    TRENCH: 'bg-slate-900',
  }[card.def.affinity] || 'bg-gray-700'

  return (
    <div className={`${bgColor} rounded p-2 border border-gray-400 text-xs`}>
      <div className="font-bold truncate text-white">{card.def.displayName}</div>
      <div className="text-gray-200 text-xs mb-1">{card.def.type}</div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1 mb-1">
        <div className="bg-red-600 text-white text-center rounded px-1">
          {card.atk ?? '-'}
        </div>
        <div className="bg-yellow-600 text-white text-center rounded px-1">
          {card.core ?? '-'}
        </div>
        <div className="bg-blue-600 text-white text-center rounded px-1">
          {card.shield ?? '-'}
        </div>
      </div>

      {/* Position indicator */}
      {card.zone === 'FIELD' && (
        <div className="text-gray-200 text-xs text-center">
          {card.position}
        </div>
      )}

      {/* Keywords */}
      {card.keywords.size > 0 && (
        <div className="text-xs text-gray-300 mt-1">
          {Array.from(card.keywords).join(', ')}
        </div>
      )}
    </div>
  )
}
