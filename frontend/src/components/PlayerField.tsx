import { CardInstance } from '@engine/types/game'
import { CardWidget } from './CardWidget'

interface PlayerFieldProps {
  cards: CardInstance[]
  isOwn: boolean
  onAction: (action: any) => void
  disabled?: boolean
  selectingTarget?: boolean
  onTargetSelect?: (target: CardInstance | 'SEAL' | 'THRONE') => void
  onAttackClick?: (card: CardInstance) => void
  isAttackingWith?: string
  opponentSeals?: CardInstance[]
  opponentThrone?: CardInstance[]
}

export function PlayerField({
  cards,
  isOwn,
  onAction,
  disabled = false,
  selectingTarget = false,
  onTargetSelect,
  onAttackClick,
  isAttackingWith,
  opponentSeals = [],
  opponentThrone = [],
}: PlayerFieldProps) {
  const handleAttack = (card: CardInstance) => {
    if (!isOwn || disabled) return

    // For own field, trigger target selection
    if (onAttackClick) {
      onAttackClick(card)
    }
  }

  const handleTargetClick = (card: CardInstance) => {
    if (!selectingTarget || !onTargetSelect) return
    onTargetSelect(card)
  }

  const handleSealClick = () => {
    if (!selectingTarget || !onTargetSelect) return
    onTargetSelect('SEAL')
  }

  const handleThroneClick = () => {
    if (!selectingTarget || !onTargetSelect) return
    onTargetSelect('THRONE')
  }

  // Determine valid targets when in target selection mode
  const hasMonsters = cards.length > 0
  const hasSeals = opponentSeals.length > 0
  const canAttackThrone = !hasMonsters && !hasSeals && opponentThrone.length > 0

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((card) => (
        <div
          key={card.instanceId}
          className={`relative cursor-pointer transition-all ${
            selectingTarget ? 'hover:ring-2 hover:ring-green-400' : ''
          } ${isAttackingWith === card.instanceId ? 'ring-2 ring-yellow-400' : ''}`}
          onClick={() => selectingTarget && !isOwn && handleTargetClick(card)}
        >
          <CardWidget card={card} />
          {isOwn && card.zone === 'FIELD' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAttack(card)
              }}
              disabled={disabled || selectingTarget}
              className={`absolute bottom-1 right-1 px-2 py-1 text-xs rounded ${
                disabled || selectingTarget
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Attack
            </button>
          )}
        </div>
      ))}
      {cards.length === 0 && !selectingTarget && (
        <div className="col-span-3 h-20 border border-dashed border-gray-500 rounded flex items-center justify-center text-gray-400">
          Empty
        </div>
      )}
      {cards.length === 0 && selectingTarget && !isOwn && (
        <div className="col-span-3 space-y-2">
          {hasSeals && (
            <div
              onClick={handleSealClick}
              className="h-20 border border-dashed border-green-500 rounded flex items-center justify-center text-green-400 cursor-pointer hover:bg-green-900 hover:bg-opacity-20 transition-colors"
            >
              {opponentSeals.length} Seal{opponentSeals.length !== 1 ? 's' : ''} — Click to Attack
            </div>
          )}
          {canAttackThrone && (
            <div
              onClick={handleThroneClick}
              className="h-20 border border-dashed border-red-500 rounded flex items-center justify-center text-red-400 cursor-pointer hover:bg-red-900 hover:bg-opacity-20 transition-colors font-bold"
            >
              🎭 THRONE — Click to Attack (Win Condition!)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
