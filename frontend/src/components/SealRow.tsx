import { CardInstance } from '@engine/types/game'

interface SealRowProps {
  seals: CardInstance[]
  isOpponent?: boolean
  selectingTarget?: boolean
  onTargetSelect?: (sealId: string) => void
}

export function SealRow({ seals, isOpponent = false, selectingTarget = false, onTargetSelect }: SealRowProps) {
  return (
    <div className="flex gap-2 justify-center items-center py-2">
      <div className="text-xs font-semibold text-gray-400">Seals ({seals.length}/3):</div>
      <div className="flex gap-2">
        {seals.map((seal) => {
          const damage = seal.counters.get('SEAL_DAMAGE') || 0
          return (
            <div
              key={seal.instanceId}
              onClick={() => selectingTarget && isOpponent && onTargetSelect?.(seal.instanceId)}
              className={`relative w-16 h-24 border-2 rounded bg-gray-700 flex flex-col items-center justify-center cursor-pointer transition-all ${
                selectingTarget && isOpponent
                  ? 'border-green-400 hover:bg-green-900 hover:bg-opacity-30'
                  : 'border-red-400'
              }`}
            >
              <div className="text-xs font-bold text-red-300">🔒</div>
              <div className="text-xs text-center text-gray-300">Seal</div>
              {damage > 0 && (
                <div className="absolute bottom-1 right-1 bg-red-600 text-white text-xs px-1 rounded">
                  {damage}/3000
                </div>
              )}
            </div>
          )
        })}
        {seals.length < 3 && (
          <>
            {Array.from({ length: 3 - seals.length }).map((_, i) => (
              <div
                key={`empty_${i}`}
                className="w-16 h-24 border-2 border-gray-600 border-dashed rounded bg-gray-800 flex items-center justify-center text-gray-500 text-xs"
              >
                —
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
