import { useState, useCallback, useEffect } from 'react'

const GRID = 4
const TILE_SIZE = 90
const GAP = 4
const BOARD_SIZE = GRID * TILE_SIZE + (GRID + 1) * GAP

/** Count inversions in the flat tile array (ignoring the blank / 0). */
function countInversions(tiles: number[]): number {
  let inv = 0
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 0) continue
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[j] === 0) continue
      if (tiles[i] > tiles[j]) inv++
    }
  }
  return inv
}

/**
 * A 4x4 puzzle is solvable when:
 *   - blank on an even row from bottom (0-indexed) => inversions must be odd
 *   - blank on an odd  row from bottom             => inversions must be even
 */
function isSolvable(tiles: number[]): boolean {
  const blankIndex = tiles.indexOf(0)
  const blankRowFromBottom = GRID - 1 - Math.floor(blankIndex / GRID)
  const inversions = countInversions(tiles)
  if (blankRowFromBottom % 2 === 0) return inversions % 2 === 1
  return inversions % 2 === 0
}

/** Fisher-Yates shuffle, retrying until solvable and not already solved. */
function generateBoard(): number[] {
  const solved = [...Array(GRID * GRID - 1)].map((_, i) => i + 1).concat(0)
  const attempt = (): number[] => {
    const arr = [...solved]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  let board = attempt()
  while (!isSolvable(board) || isWon(board)) board = attempt()
  return board
}

function isWon(tiles: number[]): boolean {
  for (let i = 0; i < GRID * GRID - 1; i++) {
    if (tiles[i] !== i + 1) return false
  }
  return tiles[GRID * GRID - 1] === 0
}

/** Interpolate between #4fc3f7 (cyan) and #e040fb (pink) based on t in [0,1]. */
function tileColor(n: number): string {
  const t = (n - 1) / 14
  const r = Math.round(79 + (224 - 79) * t)
  const g = Math.round(195 + (64 - 195) * t)
  const b = Math.round(247 + (251 - 247) * t)
  return `rgb(${r},${g},${b})`
}

export function App() {
  const [tiles, setTiles] = useState(generateBoard)
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)

  const handleNewGame = useCallback(() => {
    setTiles(generateBoard())
    setMoves(0)
    setWon(false)
  }, [])

  const handleClick = useCallback(
    (index: number) => {
      if (won) return
      const blankIdx = tiles.indexOf(0)
      const row = Math.floor(index / GRID)
      const col = index % GRID
      const blankRow = Math.floor(blankIdx / GRID)
      const blankCol = blankIdx % GRID
      const dr = Math.abs(row - blankRow)
      const dc = Math.abs(col - blankCol)
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        const next = [...tiles]
        ;[next[index], next[blankIdx]] = [next[blankIdx], next[index]]
        setTiles(next)
        setMoves((m) => m + 1)
      }
    },
    [tiles, won],
  )

  useEffect(() => {
    if (isWon(tiles)) setWon(true)
  }, [tiles])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e0', letterSpacing: 2 }}>
        SLIDING PUZZLE
      </h1>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 16 }}>
        <span>
          Moves: <strong style={{ color: '#4fc3f7' }}>{moves}</strong>
        </span>
        <button
          onClick={handleNewGame}
          style={{
            background: '#1e1e2e',
            color: '#ccc',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '6px 18px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        >
          New Game
        </button>
      </div>

      {won && (
        <div style={{ fontSize: 20, fontWeight: 700, color: '#66bb6a' }}>
          Solved in {moves} moves!
        </div>
      )}

      <div
        style={{
          position: 'relative',
          width: BOARD_SIZE,
          height: BOARD_SIZE,
          background: '#0d1117',
          borderRadius: 10,
          border: '2px solid #222',
        }}
      >
        {tiles.map((n, i) => {
          if (n === 0) return null
          const row = Math.floor(i / GRID)
          const col = i % GRID
          const x = GAP + col * (TILE_SIZE + GAP)
          const y = GAP + row * (TILE_SIZE + GAP)
          return (
            <div
              key={n}
              onClick={() => handleClick(i)}
              style={{
                position: 'absolute',
                width: TILE_SIZE,
                height: TILE_SIZE,
                left: x,
                top: y,
                background: tileColor(n),
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: 800,
                color: '#0d1117',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'left 0.15s ease, top 0.15s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {n}
            </div>
          )
        })}
      </div>
    </div>
  )
}
