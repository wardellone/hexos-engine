import { CardInstance } from '@engine/types/game'
import { CardWidget } from './CardWidget'

interface PlayerHandProps {
  cards: CardInstance[]
  onAction: (action: any) => void
  disabled?: boolean
}

export function PlayerHand({ cards, onAction, disabled = false }: PlayerHandProps) {
  const handleSummon = (card: CardInstance) => {
    if (disabled) return
    onAction({
      type: 'SUMMON',
      instanceId: card.instanceId,
      position: 'ATTACK',
    })
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {cards.map((card) => (
        <div key={card.instanceId} className="flex-shrink-0">
          <div className="cursor-pointer hover:opacity-80" onClick={() => handleSummon(card)}>
            <CardWidget card={card} />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSummon(card)
              }}
              disabled={disabled}
              className={`w-full mt-1 px-2 py-1 text-xs rounded ${
                disabled
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Summon
            </button>
          </div>
        </div>
      ))}
      {cards.length === 0 && (
        <div className="text-gray-400">No cards in hand</div>
      )}
    </div>
  )
}
