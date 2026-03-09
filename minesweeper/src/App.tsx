import { useState, useCallback, useRef, useEffect } from 'react'
import { Game, World, Entity, Transform, Sprite, Text, Camera2D } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 10
const ROWS = 10
const CELL = 40
const W = COLS * CELL
const H = ROWS * CELL
const MINE_COUNT = 15

// ─── Colors ───────────────────────────────────────────────────────────────────
const COL_UNREVEALED = '#1a2535'
const COL_REVEALED   = '#151825'
const COL_MINE       = '#ef5350'
const COL_FLAG       = '#ffd54f'
const COL_BORDER     = '#0d0f1a'

const NUMBER_COLORS: Record<number, string> = {
  1: '#4fc3f7',
  2: '#67c23a',
  3: '#ef5350',
  4: '#9c27b0',
  5: '#ff9800',
  6: '#00bcd4',
  7: '#333333',
  8: '#666666',
}

// ─── Cell type ────────────────────────────────────────────────────────────────
interface Cell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  neighbors: number
}

type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createEmptyGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      neighbors: 0,
    })),
  )
}

function placeMines(grid: Cell[][], safeRow: number, safeCol: number): void {
  // Collect safe zone (the clicked cell and its neighbors)
  const safeSet = new Set<string>()
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeRow + dr
      const c = safeCol + dc
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        safeSet.add(`${r},${c}`)
      }
    }
  }

  let placed = 0
  while (placed < MINE_COUNT) {
    const r = Math.floor(Math.random() * ROWS)
    const c = Math.floor(Math.random() * COLS)
    if (!grid[r][c].mine && !safeSet.has(`${r},${c}`)) {
      grid[r][c].mine = true
      placed++
    }
  }

  // Calculate neighbor counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].mine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].mine) {
            count++
          }
        }
      }
      grid[r][c].neighbors = count
    }
  }
}

function floodReveal(grid: Cell[][], row: number, col: number): void {
  const stack: [number, number][] = [[row, col]]
  while (stack.length > 0) {
    const [r, c] = stack.pop()!
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue
    if (grid[r][c].revealed || grid[r][c].flagged || grid[r][c].mine) continue
    grid[r][c].revealed = true
    if (grid[r][c].neighbors === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          stack.push([r + dr, c + dc])
        }
      }
    }
  }
}

function checkWin(grid: Cell[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!grid[r][c].mine && !grid[r][c].revealed) return false
    }
  }
  return true
}

function countFlags(grid: Cell[][]): number {
  let count = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].flagged) count++
    }
  }
  return count
}

// ─── Cell entity ──────────────────────────────────────────────────────────────
function CellEntity({ row, col, cell, status }: {
  row: number
  col: number
  cell: Cell
  status: GameStatus
}) {
  const x = col * CELL + CELL / 2
  const y = row * CELL + CELL / 2
  const gap = 2

  let bgColor = COL_UNREVEALED
  let labelText = ''
  let labelColor = '#ffffff'

  if (cell.revealed) {
    if (cell.mine) {
      bgColor = COL_MINE
      labelText = '*'
      labelColor = '#ffffff'
    } else {
      bgColor = COL_REVEALED
      if (cell.neighbors > 0) {
        labelText = String(cell.neighbors)
        labelColor = NUMBER_COLORS[cell.neighbors] ?? '#ffffff'
      }
    }
  } else if (cell.flagged) {
    bgColor = COL_UNREVEALED
    labelText = 'F'
    labelColor = COL_FLAG
  } else if (status === 'lost' && cell.mine) {
    // Show all mines on game over
    bgColor = COL_MINE
    labelText = '*'
    labelColor = '#ffffff'
  }

  return (
    <Entity key={`cell-${row}-${col}`}>
      <Transform x={x} y={y} />
      <Sprite width={CELL - gap} height={CELL - gap} color={bgColor} />
      {labelText !== '' && (
        <Text
          text={labelText}
          fontSize={labelText === '*' ? 22 : 18}
          fontFamily="'Courier New', monospace"
          color={labelColor}
          align="center"
          baseline="middle"
          zIndex={2}
        />
      )}
    </Entity>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [grid, setGrid]     = useState<Cell[][]>(createEmptyGrid)
  const [status, setStatus] = useState<GameStatus>('idle')
  const [time, setTime]     = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timer
  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  const getCellFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / CELL)
    const row = Math.floor((e.clientY - rect.top) / CELL)
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    return { row, col }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const pos = getCellFromEvent(e)
    if (!pos) return
    const { row, col } = pos

    if (status === 'lost' || status === 'won') return

    // In flag mode, left click places/removes flags instead of revealing
    if (flagMode) {
      setGrid(prev => {
        const next = prev.map(r => r.map(c => ({ ...c })))
        if (next[row][col].revealed) return prev
        next[row][col].flagged = !next[row][col].flagged
        return next
      })
      return
    }

    setGrid(prev => {
      const next = prev.map(r => r.map(c => ({ ...c })))
      const cell = next[row][col]
      if (cell.flagged || cell.revealed) return prev

      // First click: place mines, start timer
      if (status === 'idle') {
        placeMines(next, row, col)
        setStatus('playing')
        setTime(0)
      }

      if (next[row][col].mine) {
        // Hit a mine — game over
        next[row][col].revealed = true
        setStatus('lost')
        return next
      }

      floodReveal(next, row, col)

      if (checkWin(next)) {
        setStatus('won')
      }

      return next
    })
  }, [status, flagMode, getCellFromEvent])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (status !== 'idle' && status !== 'playing') return
    const pos = getCellFromEvent(e)
    if (!pos) return
    const { row, col } = pos

    setGrid(prev => {
      const next = prev.map(r => r.map(c => ({ ...c })))
      if (next[row][col].revealed) return prev
      next[row][col].flagged = !next[row][col].flagged
      return next
    })
  }, [status, getCellFromEvent])

  function restart() {
    if (timerRef.current) clearInterval(timerRef.current)
    setGrid(createEmptyGrid())
    setStatus('idle')
    setTime(0)
    setFlagMode(false)
    setGameKey(k => k + 1)
  }

  const flagCount = countFlags(grid)
  const minesRemaining = MINE_COUNT - flagCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '7px 18px',
        background: COL_BORDER,
        borderRadius: '10px 10px 0 0',
        fontSize: 13,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: COL_FLAG, letterSpacing: 2 }}>
          {minesRemaining}
          <span style={{ fontSize: 10, color: '#546e7a', marginLeft: 4 }}>MINES</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          MINESWEEPER
        </div>
        <div style={{ textAlign: 'right', fontSize: 24, fontWeight: 900, color: '#4fc3f7', letterSpacing: 2 }}>
          {String(time).padStart(3, '0')}
          <span style={{ fontSize: 10, color: '#546e7a', marginLeft: 4 }}>SEC</span>
        </div>
      </div>

      {/* ── Flag mode toggle ──────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'flex',
        justifyContent: 'center',
        padding: '6px 0',
        background: COL_BORDER,
      }}>
        <button
          onClick={() => setFlagMode(f => !f)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 20px',
            background: flagMode ? '#2a3a2a' : '#1a2535',
            border: `1px solid ${flagMode ? '#67c23a' : '#1e2535'}`,
            borderRadius: 6,
            color: flagMode ? COL_FLAG : '#546e7a',
            fontFamily: '"Courier New", monospace',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 16 }}>{flagMode ? '\u{1F6A9}' : '\u{1F4A3}'}</span>
          {flagMode ? 'FLAG MODE' : 'REVEAL MODE'}
        </button>
      </div>

      {/* ── Game canvas + overlay ────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background={COL_BORDER}>
            <Camera2D x={W / 2} y={H / 2} />
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <CellEntity
                  key={`${r}-${c}`}
                  row={r}
                  col={c}
                  cell={cell}
                  status={status}
                />
              )),
            )}
          </World>
        </Game>

        {/* Transparent click overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            cursor: status === 'lost' || status === 'won' ? 'default' : 'pointer',
          }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        />

        {/* ── Win overlay ────────────────────────────────────────────────────── */}
        {status === 'won' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: COL_FLAG, marginBottom: 8 }}>
                YOU WIN
              </p>
              <p style={{
                fontSize: 36,
                fontWeight: 900,
                color: '#67c23a',
                letterSpacing: 3,
              }}>
                CLEARED!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Time: {time}s
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Loss overlay ───────────────────────────────────────────────────── */}
        {status === 'lost' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: COL_MINE, marginBottom: 8 }}>
                GAME OVER
              </p>
              <p style={{
                fontSize: 36,
                fontWeight: 900,
                color: COL_MINE,
                letterSpacing: 3,
              }}>
                BOOM!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Time: {time}s
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ─────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: COL_BORDER,
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Click &mdash; reveal/flag &nbsp;&middot;&nbsp; Toggle mode above &nbsp;&middot;&nbsp; Right click &mdash; flag</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position:       'absolute',
  inset:          0,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  background:     'rgba(10, 10, 18, 0.82)',
  backdropFilter: 'blur(4px)',
  zIndex:         10,
}

const cardStyle: React.CSSProperties = {
  textAlign:    'center',
  fontFamily:   '"Courier New", monospace',
  padding:      '36px 48px',
  background:   COL_BORDER,
  border:       '1px solid #1e2535',
  borderRadius: 12,
}

const btnStyle: React.CSSProperties = {
  marginTop:     24,
  padding:       '10px 32px',
  background:    '#4fc3f7',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
