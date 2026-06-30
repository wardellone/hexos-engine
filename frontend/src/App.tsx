import { GameManager } from '@engine/engine/GameManager'
import { getDinoDeck, getArchetype } from '@engine/corpus/CardLoaderBrowser'
import { GameBoard } from './components/GameBoard'
import { useState, useEffect } from 'react'
import { GameState } from '@engine/types/game'
import { useGameLoop } from './hooks/useGameLoop'

export function App() {
  const [gameManager, setGameManager] = useState<GameManager | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    // Initialize game on component mount
    const dino = getDinoDeck()
    const rome = getArchetype('ROME')

    const makeDeck = (cards: any[], count = 20) => {
      const deck = []
      while (deck.length < count) deck.push(...cards)
      return deck.slice(0, count)
    }

    const gm = new GameManager(makeDeck(dino), makeDeck(rome))
    gm.startGame()

    setGameManager(gm)
    setGameState(gm.state)
  }, [])

  const { processAction, isCpuThinking } = useGameLoop(
    gameManager,
    setGameState
  )

  const handleNewGame = () => {
    const dino = getDinoDeck()
    const rome = getArchetype('ROME')

    const makeDeck = (cards: any[], count = 20) => {
      const deck = []
      while (deck.length < count) deck.push(...cards)
      return deck.slice(0, count)
    }

    const gm = new GameManager(makeDeck(dino), makeDeck(rome))
    gm.startGame()
    setGameManager(gm)
    setGameState(gm.state)
  }

  if (!gameManager || !gameState) {
    return <div className="p-4">Loading game...</div>
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">HEXOS TCG</h1>
          <button
            onClick={handleNewGame}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
          >
            New Game
          </button>
        </div>
        <GameBoard
          state={gameState}
          onAction={processAction}
          isCpuThinking={isCpuThinking}
        />
      </div>
    </div>
  )
}
