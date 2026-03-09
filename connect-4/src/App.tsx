import { useState, useCallback } from 'react'

const ROWS = 6
const COLS = 7
const CELL_SIZE = 60
const GAP = 6
const BOARD_PAD = 12

type Player = 'red' | 'yellow'
type Cell = Player | null
type Board = Cell[][]

function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))
}

function getLowestEmptyRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) return r
  }
  return -1
}

type WinResult = { winner: Player; cells: [number, number][] } | null

function checkWin(board: Board): WinResult {
  const directions: [number, number][] = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal down-right
    [1, -1], // diagonal down-left
  ]

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c]
      if (!cell) continue

      for (const [dr, dc] of directions) {
        const cells: [number, number][] = [[r, c]]
        let valid = true

        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i
          const nc = c + dc * i
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) {
            valid = false
            break
          }
          cells.push([nr, nc])
        }

        if (valid) return { winner: cell, cells }
      }
    }
  }

  return null
}

function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== null)
}

const playerColor: Record<Player, string> = {
  red: '#ef5350',
  yellow: '#fdd835',
}

const boardWidth = BOARD_PAD * 2 + COLS * CELL_SIZE + (COLS - 1) * GAP
const boardHeight = BOARD_PAD * 2 + ROWS * CELL_SIZE + (ROWS - 1) * GAP

export function App() {
  const [board, setBoard] = useState<Board>(createEmptyBoard)
  const [currentPlayer, setCurrentPlayer] = useState<Player>('red')
  const [winResult, setWinResult] = useState<WinResult>(null)
  const [isDraw, setIsDraw] = useState(false)
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  const gameOver = winResult !== null || isDraw

  const winSet = new Set(
    winResult?.cells.map(([r, c]) => `${r},${c}`) ?? []
  )

  const handleDrop = useCallback(
    (col: number) => {
      if (gameOver) return
      const row = getLowestEmptyRow(board, col)
      if (row < 0) return

      const newBoard = board.map((r) => [...r])
      newBoard[row][col] = currentPlayer

      const win = checkWin(newBoard)
      setBoard(newBoard)

      if (win) {
        setWinResult(win)
      } else if (isBoardFull(newBoard)) {
        setIsDraw(true)
      } else {
        setCurrentPlayer(currentPlayer === 'red' ? 'yellow' : 'red')
      }
    },
    [board, currentPlayer, gameOver],
  )

  const reset = () => {
    setBoard(createEmptyBoard())
    setCurrentPlayer('red')
    setWinResult(null)
    setIsDraw(false)
    setHoverCol(null)
  }

  const ghostRow = hoverCol !== null ? getLowestEmptyRow(board, hoverCol) : -1

  const statusText = winResult
    ? `${winResult.winner === 'red' ? 'Red' : 'Yellow'} wins!`
    : isDraw
      ? 'Draw!'
      : `${currentPlayer === 'red' ? 'Red' : 'Yellow'}'s turn`

  const statusColor = winResult
    ? playerColor[winResult.winner]
    : isDraw
      ? '#ccc'
      : playerColor[currentPlayer]

  return (
    <>
      <h2 style={{ color: '#ccc', marginBottom: 4, fontSize: 22, letterSpacing: 2 }}>
        CONNECT 4
      </h2>

      <div style={{ color: statusColor, fontSize: 16, fontWeight: 'bold', height: 24 }}>
        {statusText}
      </div>

      {/* Board */}
      <div
        style={{
          background: '#1a237e',
          borderRadius: 12,
          padding: BOARD_PAD,
          width: boardWidth,
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
          gap: GAP,
        }}
        onMouseLeave={() => setHoverCol(null)}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isWinCell = winSet.has(`${r},${c}`)
            const isGhost = !gameOver && cell === null && hoverCol === c && r === ghostRow

            let bg = '#0d1117'
            if (cell) {
              bg = playerColor[cell]
            } else if (isGhost) {
              bg = playerColor[currentPlayer]
            }

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleDrop(c)}
                onMouseEnter={() => !gameOver && setHoverCol(c)}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: '50%',
                  background: bg,
                  opacity: isGhost ? 0.3 : 1,
                  cursor: gameOver || getLowestEmptyRow(board, c) < 0 ? 'default' : 'pointer',
                  transition: 'background 0.15s, opacity 0.15s',
                  boxShadow: isWinCell
                    ? '0 0 12px 4px rgba(255,255,255,0.6)'
                    : cell
                      ? 'inset 0 -3px 6px rgba(0,0,0,0.35)'
                      : 'inset 0 2px 6px rgba(0,0,0,0.5)',
                }}
              />
            )
          }),
        )}
      </div>

      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: '8px 28px',
          background: '#1a237e',
          color: '#ccc',
          border: '1px solid #3949ab',
          borderRadius: 6,
          fontFamily: "'Courier New', monospace",
          fontSize: 14,
          cursor: 'pointer',
          letterSpacing: 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#283593')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#1a237e')}
      >
        RESET
      </button>
    </>
  )
}
