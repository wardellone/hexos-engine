import { GameState, CardInstance } from '@engine/types/game'
import { useState, useEffect, useRef } from 'react'
import { PlayerField } from './PlayerField'
import { PlayerHand } from './PlayerHand'
import { GameLog } from './GameLog'
import { SealRow } from './SealRow'

interface GameBoardProps {
  state: GameState
  onAction: (action: any) => void
  isCpuThinking?: boolean
}

interface AttackSelection {
  attackerId: string
  attacker: CardInstance
}

export function GameBoard({ state, onAction, isCpuThinking = false }: GameBoardProps) {
  const p1 = state.players['P1']
  const p2 = state.players['P2']
  const isPlayerTurn = state.activePlayer === 'P1'
  const buttonsDisabled = !isPlayerTurn || isCpuThinking

  const [attackSelection, setAttackSelection] = useState<AttackSelection | null>(null)
  const [phaseTransition, setPhaseTransition] = useState(false)
  const prevPhaseRef = useRef(state.phase)

  // Detect phase change and show transition
  useEffect(() => {
    if (prevPhaseRef.current !== state.phase) {
      setPhaseTransition(true)
      const timer = setTimeout(() => setPhaseTransition(false), 600)
      prevPhaseRef.current = state.phase
      return () => clearTimeout(timer)
    }
  }, [state.phase])

  const handleAttackClick = (attacker: CardInstance) => {
    if (buttonsDisabled) return
    setAttackSelection({ attackerId: attacker.instanceId, attacker })
  }

  const handleTargetSelect = (target: CardInstance | 'SEAL' | 'THRONE') => {
    if (!attackSelection) return

    let targetId: string
    if (typeof target === 'string') {
      // 'SEAL' or 'THRONE' — use a special format
      targetId = `${target}:${target === 'SEAL' ? p2.seal[0]?.instanceId : p2.throne[0]?.instanceId || 'THRONE_DECK'}`
    } else {
      targetId = target.instanceId
    }

    onAction({
      type: 'ATTACK',
      attackerId: attackSelection.attackerId,
      targetId,
    })
    setAttackSelection(null)
  }

  const cancelAttack = () => {
    setAttackSelection(null)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main board */}
      <div className="lg:col-span-2 space-y-4">
        {/* P2 (opponent) field */}
        <div className="border border-red-500 rounded p-4 bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">Opponent</h2>
            <div className="text-2xl font-bold">♥ {p2.life}</div>
          </div>
          {attackSelection && (
            <div className="mb-3 p-2 bg-yellow-900 rounded text-sm">
              <div className="font-semibold mb-2">
                ⚔️ {attackSelection.attacker.def.displayName} ({attackSelection.attacker.atk} ATK) — Select target:
              </div>
              <div className="flex gap-2 flex-wrap text-xs">
                {p2.field.length > 0 && (
                  <span className="px-2 py-1 bg-blue-700 rounded">
                    Click a monster below
                  </span>
                )}
                {p2.field.length === 0 && p2.seal.length > 0 && (
                  <span className="px-2 py-1 bg-purple-700 rounded">
                    {p2.seal.length} Seal(s) available below
                  </span>
                )}
                {p2.field.length === 0 && p2.seal.length === 0 && (
                  <span className="px-2 py-1 bg-red-700 rounded font-bold">
                    🎭 THRONE is open!
                  </span>
                )}
                <button
                  onClick={cancelAttack}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded ml-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <PlayerField
            cards={p2.field}
            isOwn={false}
            onAction={onAction}
            disabled={buttonsDisabled}
            selectingTarget={attackSelection !== null}
            onTargetSelect={handleTargetSelect}
            opponentSeals={p2.seal}
            opponentThrone={p2.throne}
          />
          <SealRow
            seals={p2.seal}
            isOpponent={true}
            selectingTarget={attackSelection !== null}
            onTargetSelect={(sealId) => handleTargetSelect(`SEAL:${sealId}` as any)}
          />
        </div>

        {/* Game state info */}
        <div className="border border-gray-500 rounded p-4 bg-gray-800 text-sm">
          <div className="grid grid-cols-4 gap-2">
            <div>Turn: <span className="font-bold">{state.turn}</span></div>
            <div>Phase: <span className="font-bold">{state.phase}</span></div>
            <div>Step: <span className="font-bold">{state.step}</span></div>
            <div>Active: <span className="font-bold">{state.activePlayer}</span></div>
          </div>
        </div>

        {/* P1 (player) field */}
        <div className="border border-blue-500 rounded p-4 bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">You</h2>
            <div className="text-2xl font-bold">♥ {p1.life}</div>
          </div>
          <PlayerField
            cards={p1.field}
            isOwn={true}
            onAction={onAction}
            disabled={buttonsDisabled}
            onAttackClick={handleAttackClick}
            isAttackingWith={attackSelection?.attackerId}
          />
        </div>

        {/* P1 Seals */}
        <div className="border border-yellow-600 rounded p-4 bg-gray-800">
          <SealRow seals={p1.seal} isOpponent={false} />
        </div>

        {/* Hand */}
        <div className="border border-green-500 rounded p-4 bg-gray-800">
          <h3 className="text-lg font-bold mb-2">Hand ({p1.hand.length})</h3>
          <PlayerHand
            cards={p1.hand}
            onAction={onAction}
            disabled={buttonsDisabled}
          />
        </div>

        {/* Phase transition overlay */}
        {phaseTransition && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center pointer-events-none z-50"
            style={{
              animation: 'phaseTransition 0.6s ease-in-out',
            }}
          >
            <div className="text-white text-5xl font-bold drop-shadow-lg">
              ➜ {state.phase}
            </div>
            <style>{`
              @keyframes phaseTransition {
                0% { opacity: 0; }
                50% { opacity: 1; }
                100% { opacity: 0; }
              }
            `}</style>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {isCpuThinking && (
            <div className="px-4 py-2 bg-yellow-600 rounded text-sm font-semibold">
              ⏳ CPU thinking...
            </div>
          )}
          <button
            onClick={() => onAction({ type: 'PASS' })}
            disabled={buttonsDisabled}
            className={`px-6 py-2 rounded font-semibold transition-all ${
              buttonsDisabled
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {state.phase === 'TERMINAL' ? '✓ End Turn' : '▶ End Phase'}
          </button>
        </div>
      </div>

      {/* Log panel */}
      <div className="border border-gray-500 rounded p-4 bg-gray-800 h-96 overflow-y-auto">
        <h3 className="text-lg font-bold mb-2">Log</h3>
        <GameLog logs={state.log} />
      </div>
    </div>
  )
}
