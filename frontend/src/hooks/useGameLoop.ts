import { useCallback, useRef } from 'react'
import { GameManager } from '@engine/engine/GameManager'
import { GameState } from '@engine/types/game'

export function useGameLoop(
  gameManager: GameManager | null,
  onStateChange: (state: GameState) => void
) {
  const cpuThinkingRef = useRef(false)

  const cpuThink = useCallback((gm: GameManager, onUpdate: (state: GameState) => void) => {
    if (cpuThinkingRef.current) return
    cpuThinkingRef.current = true

    try {
      // CPU logic: greedy best action
      const state = gm.state
      const p2 = state.players['P2']

      // Phase logic
      if (state.phase === 'AWAKENING') {
        gm.processAction({ type: 'PASS' })
      } else if (state.phase === 'STRATEGIC') {
        // Try to summon cards from hand
        const canSummon = p2.hand.some(c => c.def.type === 'COLOSSUS')
        if (canSummon && state.step === 'PLAYER_ACTION') {
          const toSummon = p2.hand.find(c => c.def.type === 'COLOSSUS')
          if (toSummon) {
            gm.processAction({
              type: 'SUMMON',
              instanceId: toSummon.instanceId,
              position: 'ATTACK',
            })
          }
        } else {
          gm.processAction({ type: 'PASS' })
        }
      } else if (state.phase === 'CONFLICT') {
        // Try to attack
        if (state.step === 'PLAYER_ACTION' && p2.field.length > 0) {
          const attacker = p2.field[0]
          const p1 = state.players['P1']

          // Priority: attack seals if field clear and seals exist
          if (p1.field.length === 0 && p1.seal.length > 0) {
            gm.processAction({
              type: 'ATTACK',
              attackerId: attacker.instanceId,
              targetId: `SEAL:${p1.seal[0].instanceId}`,
            })
          }
          // Second priority: attack throne if no seals left
          else if (p1.field.length === 0 && p1.seal.length === 0) {
            gm.processAction({
              type: 'ATTACK',
              attackerId: attacker.instanceId,
              targetId: `THRONE:${p1.throne[0]?.instanceId || 'THRONE_DECK'}`,
            })
          }
          // Default: attack first opponent monster
          else {
            const target = p1.field.length > 0 ? p1.field[0] : 'DIRECT'
            gm.processAction({
              type: 'ATTACK',
              attackerId: attacker.instanceId,
              targetId: typeof target === 'string' ? target : target.instanceId,
            })
          }
        } else {
          gm.processAction({ type: 'PASS' })
        }
      } else if (state.phase === 'TERMINAL') {
        // End turn (will auto-advance to opponent's AWAKENING)
        gm.processAction({ type: 'PASS' })
      } else {
        // Any other phase, just pass
        gm.processAction({ type: 'PASS' })
      }

      onUpdate({ ...gm.state })

      // Recursively continue if still CPU's turn and game not over
      if (gm.state.activePlayer === 'P2' && gm.state.step !== 'GAME_OVER') {
        setTimeout(() => {
          cpuThink(gm, onUpdate)
        }, 500)
      } else {
        cpuThinkingRef.current = false
      }
    } catch (e) {
      console.error('CPU error:', e)
      cpuThinkingRef.current = false
    }
  }, [])

  const processAction = useCallback((action: any) => {
    if (!gameManager || cpuThinkingRef.current) return

    gameManager.processAction(action)
    onStateChange({ ...gameManager.state })

    // Auto-advance if CPU's turn
    if (gameManager.state.activePlayer === 'P2' && gameManager.state.step !== 'GAME_OVER') {
      setTimeout(() => {
        cpuThink(gameManager, onStateChange)
      }, 500)
    }
  }, [gameManager, onStateChange, cpuThink])

  return { processAction, isCpuThinking: cpuThinkingRef.current }
}
