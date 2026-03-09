import { useState, useCallback, CSSProperties } from 'react'

type CellValue = 'X' | 'O' | null
type Board = CellValue[]

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
]

function getWinner(board: Board): { winner: CellValue; line: number[] } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line }
    }
  }
  return null
}

function isDraw(board: Board): boolean {
  return board.every((cell) => cell !== null) && !getWinner(board)
}

const CELL_SIZE = 120
const GAP = 4
const BOARD_SIZE = CELL_SIZE * 3 + GAP * 2

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    padding: 32,
  } as CSSProperties,

  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#e0e0e0',
  } as CSSProperties,

  status: {
    fontSize: 18,
    height: 24,
    color: '#999',
  } as CSSProperties,

  board: {
    display: 'grid',
    gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(3, ${CELL_SIZE}px)`,
    gap: GAP,
    background: '#2a2a2a',
    borderRadius: 8,
    padding: GAP,
    width: BOARD_SIZE + GAP * 2,
    height: BOARD_SIZE + GAP * 2,
  } as CSSProperties,

  cell: (isWinning: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isWinning ? '#1a2a1a' : '#0d1117',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 48,
    fontWeight: 700,
    fontFamily: "'Courier New', monospace",
    transition: 'background 0.15s',
    userSelect: 'none',
  }),

  button: {
    padding: '10px 28px',
    fontSize: 15,
    fontFamily: "'Courier New', monospace",
    fontWeight: 600,
    color: '#ccc',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: 1,
    transition: 'background 0.15s',
  } as CSSProperties,
}

function Cell({
  value,
  isWinning,
  onClick,
}: {
  value: CellValue
  isWinning: boolean
  onClick: () => void
}) {
  const color = value === 'X' ? '#4fc3f7' : value === 'O' ? '#ef5350' : 'transparent'

  return (
    <button
      style={{ ...styles.cell(isWinning), color, border: 'none', outline: 'none' }}
      onClick={onClick}
    >
      {value}
    </button>
  )
}

export function App() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState(true)

  const result = getWinner(board)
  const draw = isDraw(board)
  const gameOver = !!result || draw

  const handleClick = useCallback(
    (index: number) => {
      if (board[index] || gameOver) return
      const next = [...board]
      next[index] = xIsNext ? 'X' : 'O'
      setBoard(next)
      setXIsNext(!xIsNext)
    },
    [board, xIsNext, gameOver],
  )

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null))
    setXIsNext(true)
  }, [])

  let status: string
  if (result) {
    status = `${result.winner} wins!`
  } else if (draw) {
    status = "It's a draw!"
  } else {
    status = `${xIsNext ? 'X' : 'O'}'s turn`
  }

  const statusColor = result
    ? result.winner === 'X'
      ? '#4fc3f7'
      : '#ef5350'
    : draw
      ? '#888'
      : xIsNext
        ? '#4fc3f7'
        : '#ef5350'

  return (
    <div style={styles.container}>
      <div style={styles.title}>TIC-TAC-TOE</div>
      <div style={{ ...styles.status, color: statusColor }}>{status}</div>
      <div style={styles.board}>
        {board.map((value, i) => (
          <Cell
            key={i}
            value={value}
            isWinning={result?.line.includes(i) ?? false}
            onClick={() => handleClick(i)}
          />
        ))}
      </div>
      <button
        style={styles.button}
        onClick={reset}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a3e')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a2e')}
      >
        RESET
      </button>
    </div>
  )
}
