import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite, Text } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS     = 8
const ROWS     = 16
const CELL     = 28
const BOARD_W  = COLS * CELL    // 224
const BOARD_H  = ROWS * CELL    // 448
const SIDE_W   = 130
const W        = BOARD_W + SIDE_W  // 354
const H        = BOARD_H + 80      // 528 — top gap for bottle neck

const BOTTLE_TOP_Y = 32   // pixel offset from top of canvas where grid row 0 sits
const BOTTLE_OFF_X = 16   // pixel offset from left

// ─── Types ────────────────────────────────────────────────────────────────────
type Color = 'red' | 'blue' | 'yellow'
type Orientation = 'horiz' | 'vert'
type Cell = { color: Color; isVirus: boolean } | null
type Board = Cell[][]
type GameState = 'idle' | 'playing' | 'win' | 'gameover'

interface Capsule {
  // left/top half = color0, right/bottom half = color1
  color0: Color
  color1: Color
  orientation: Orientation
  col: number   // grid col of left/top half
  row: number   // grid row of left/top half
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const COLORS: Color[] = ['red', 'blue', 'yellow']
const COLOR_HEX: Record<Color, string> = {
  red:    '#ef5350',
  blue:   '#42a5f5',
  yellow: '#fdd835',
}
const VIRUS_DARK: Record<Color, string> = {
  red:    '#b71c1c',
  blue:   '#0d47a1',
  yellow: '#f57f17',
}

function rndColor(): Color { return COLORS[Math.floor(Math.random() * 3)] }

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function placeViruses(count: number): Board {
  const board = emptyBoard()
  // Only place in lower 12 rows
  let placed = 0
  let tries = 0
  while (placed < count && tries < 2000) {
    tries++
    const r = 4 + Math.floor(Math.random() * 12)
    const c = Math.floor(Math.random() * COLS)
    if (r < ROWS && !board[r][c]) {
      board[r][c] = { color: rndColor(), isVirus: true }
      placed++
    }
  }
  return board
}

function spawnCapsule(): Capsule {
  return {
    color0: rndColor(),
    color1: rndColor(),
    orientation: 'horiz',
    col: Math.floor(COLS / 2) - 1,
    row: 0,
  }
}

function capsuleCells(c: Capsule): [number, number][] {
  if (c.orientation === 'horiz') {
    return [[c.col, c.row], [c.col + 1, c.row]]
  } else {
    return [[c.col, c.row], [c.col, c.row + 1]]
  }
}

function capsuleColors(c: Capsule): [Color, Color] {
  return [c.color0, c.color1]
}

function fits(board: Board, cap: Capsule, col: number, row: number, ori: Orientation): boolean {
  const test: Capsule = { ...cap, col, row, orientation: ori }
  for (const [tc, tr] of capsuleCells(test)) {
    if (tc < 0 || tc >= COLS || tr < 0 || tr >= ROWS) return false
    if (board[tr][tc]) return false
  }
  return true
}

function lockCapsule(board: Board, cap: Capsule): Board {
  const nb = board.map(r => [...r])
  const cells = capsuleCells(cap)
  const colors = capsuleColors(cap)
  cells.forEach(([c, r], i) => {
    nb[r][c] = { color: colors[i], isVirus: false }
  })
  return nb
}

function findMatches(board: Board): Set<string> {
  const matched = new Set<string>()
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let run = 1
    for (let c = 1; c <= COLS; c++) {
      const prev = board[r][c - 1]
      const curr = c < COLS ? board[r][c] : null
      if (curr && prev && curr.color === prev.color) {
        run++
      } else {
        if (run >= 4) {
          for (let k = c - run; k < c; k++) matched.add(`${r},${k}`)
        }
        run = 1
      }
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    let run = 1
    for (let r = 1; r <= ROWS; r++) {
      const prev = board[r - 1][c]
      const curr = r < ROWS ? board[r][c] : null
      if (curr && prev && curr.color === prev.color) {
        run++
      } else {
        if (run >= 4) {
          for (let k = r - run; k < r; k++) matched.add(`${k},${c}`)
        }
        run = 1
      }
    }
  }
  return matched
}

function applyGravity(board: Board): { board: Board; moved: boolean } {
  let moved = false
  const nb = board.map(r => [...r])
  // For each column, non-virus cells fall
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 2; r >= 0; r--) {
      if (nb[r][c] && !nb[r][c]!.isVirus && !nb[r + 1][c]) {
        nb[r + 1][c] = nb[r][c]
        nb[r][c] = null
        moved = true
      }
    }
  }
  return { board: nb, moved }
}

function countViruses(board: Board): number {
  let count = 0
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]?.isVirus) count++
  return count
}

const DIFFICULTY = { easy: 8, medium: 16, hard: 24 }

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey]     = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [difficulty, setDifficulty] = useState<keyof typeof DIFFICULTY>('medium')
  const [score, setScore]         = useState(0)
  const [virusCount, setVirusCount] = useState(0)
  const [phase, setPhase]         = useState<'dropping' | 'clearing' | 'gravity'>('dropping')

  const boardRef    = useRef<Board>(emptyBoard())
  const capsuleRef  = useRef<Capsule>(spawnCapsule())
  const nextCapRef  = useRef<Capsule>(spawnCapsule())
  const phaseRef    = useRef<'dropping' | 'clearing' | 'gravity'>('dropping')

  const [, forceRender] = useReducer(n => n + 1, 0)

  phaseRef.current = phase

  // ── helpers ──────────────────────────────────────────────────────────────
  const spawnNext = useCallback(() => {
    const nc = nextCapRef.current
    nextCapRef.current = spawnCapsule()
    const board = boardRef.current
    if (!fits(board, nc, nc.col, nc.row, nc.orientation)) {
      setGameState('gameover')
      return false
    }
    capsuleRef.current = { ...nc }
    return true
  }, [])

  const processClearing = useCallback(() => {
    let board = boardRef.current
    let totalCleared = 0
    let anyCleared = true
    while (anyCleared) {
      const matched = findMatches(board)
      if (matched.size === 0) { anyCleared = false; break }
      totalCleared += matched.size
      const nb = board.map(r => [...r])
      for (const key of matched) {
        const [r, c] = key.split(',').map(Number)
        nb[r][c] = null
      }
      // gravity loop
      let moved = true
      while (moved) {
        const res = applyGravity(nb)
        moved = res.moved
        if (moved) nb.splice(0, ROWS, ...res.board)
      }
      board = nb
    }
    boardRef.current = board
    const vc = countViruses(board)
    setVirusCount(vc)
    if (totalCleared > 0) setScore(s => s + totalCleared * 100)
    if (vc === 0) {
      setGameState('win')
    } else {
      spawnNext()
      setPhase('dropping')
    }
    forceRender()
  }, [spawnNext])

  // ── Gravity tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || phase !== 'dropping') return
    const id = setInterval(() => {
      const cap = capsuleRef.current
      const board = boardRef.current
      if (fits(board, cap, cap.col, cap.row + 1, cap.orientation)) {
        capsuleRef.current = { ...cap, row: cap.row + 1 }
        forceRender()
      } else {
        // lock
        boardRef.current = lockCapsule(board, cap)
        setPhase('clearing')
      }
    }, 600)
    return () => clearInterval(id)
  }, [gameState, phase])

  // ── Clearing phase ────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || phase !== 'clearing') return
    const id = setTimeout(() => {
      processClearing()
    }, 150)
    return () => clearTimeout(id)
  }, [gameState, phase, processClearing])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameState === 'idle' || gameState === 'win' || gameState === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startGame() }
        return
      }
      if (gameState !== 'playing' || phaseRef.current !== 'dropping') return
      e.preventDefault()
      const cap = capsuleRef.current
      const board = boardRef.current

      if (e.code === 'ArrowLeft') {
        if (fits(board, cap, cap.col - 1, cap.row, cap.orientation))
          capsuleRef.current = { ...cap, col: cap.col - 1 }
      } else if (e.code === 'ArrowRight') {
        if (fits(board, cap, cap.col + 1, cap.row, cap.orientation))
          capsuleRef.current = { ...cap, col: cap.col + 1 }
      } else if (e.code === 'ArrowDown') {
        if (fits(board, cap, cap.col, cap.row + 1, cap.orientation)) {
          capsuleRef.current = { ...cap, row: cap.row + 1 }
          setScore(s => s + 1)
        }
      } else if (e.code === 'ArrowUp' || e.code === 'KeyZ') {
        // Rotate: horiz->vert (col stays, but vert needs row+1 to exist)
        const newOri: Orientation = cap.orientation === 'horiz' ? 'vert' : 'horiz'
        let newCol = cap.col
        // When going horiz from vert, check if col+1 is free; if off-edge, shift left
        if (newOri === 'horiz' && newCol + 1 >= COLS) newCol = COLS - 2
        if (fits(board, cap, newCol, cap.row, newOri)) {
          // Swap colors: horiz(0=left,1=right) -> vert(0=top,1=bottom) stays same
          capsuleRef.current = { ...cap, col: newCol, orientation: newOri }
        }
      }
      forceRender()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  function startGame() {
    const board = placeViruses(DIFFICULTY[difficulty])
    boardRef.current = board
    capsuleRef.current = spawnCapsule()
    nextCapRef.current = spawnCapsule()
    setScore(0)
    setVirusCount(countViruses(board))
    setPhase('dropping')
    setGameState('playing')
    setGameKey(k => k + 1)
    forceRender()
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const bx = (col: number) => BOTTLE_OFF_X + col * CELL + CELL / 2
  const by = (row: number) => BOTTLE_TOP_Y + row * CELL + CELL / 2

  const board   = boardRef.current
  const cap     = capsuleRef.current
  const nextCap = nextCapRef.current

  // Build render list
  type RenderCell = { x: number; y: number; color: string; key: string; zIndex: number; isVirus?: boolean }
  const cells: RenderCell[] = []

  // Board cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c]
      if (cell) {
        cells.push({
          x: bx(c), y: by(r),
          color: cell.isVirus ? VIRUS_DARK[cell.color] : COLOR_HEX[cell.color],
          key: `b${r}-${c}`, zIndex: 2, isVirus: cell.isVirus,
        })
      }
    }
  }

  // Active capsule
  if (gameState === 'playing' && phase === 'dropping') {
    const capCells = capsuleCells(cap)
    const capColors = capsuleColors(cap)
    capCells.forEach(([cc, cr], i) => {
      cells.push({ x: bx(cc), y: by(cr), color: COLOR_HEX[capColors[i]], key: `cap${i}`, zIndex: 4 })
    })
  }

  // Next capsule preview in sidebar
  const nextColors = capsuleColors(nextCap)
  const nextPreview = [
    { x: BOARD_W + SIDE_W / 2 - 16, y: 90, color: COLOR_HEX[nextColors[0]], key: 'n0' },
    { x: BOARD_W + SIDE_W / 2 + 16, y: 90, color: COLOR_HEX[nextColors[1]], key: 'n1' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 16px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <span style={{ color: '#607d8b', fontSize: 11 }}>VIRUS {virusCount}</span>
        <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18 }}>{String(score).padStart(6, '0')}</span>
        <span style={{ color: '#607d8b', fontSize: 11 }}>{difficulty.toUpperCase()}</span>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Bottle walls */}
            {/* Left wall */}
            <Entity tags={['wall']}><Transform x={BOTTLE_OFF_X - 2} y={BOTTLE_TOP_Y + BOARD_H / 2} /><Sprite width={3} height={BOARD_H} color="#1e2d40" /></Entity>
            {/* Right wall */}
            <Entity tags={['wall']}><Transform x={BOTTLE_OFF_X + BOARD_W + 2} y={BOTTLE_TOP_Y + BOARD_H / 2} /><Sprite width={3} height={BOARD_H} color="#1e2d40" /></Entity>
            {/* Bottom */}
            <Entity tags={['wall']}><Transform x={BOTTLE_OFF_X + BOARD_W / 2} y={BOTTLE_TOP_Y + BOARD_H + 2} /><Sprite width={BOARD_W + 6} height={3} color="#1e2d40" /></Entity>
            {/* Bottle neck top border */}
            <Entity tags={['wall']}><Transform x={BOTTLE_OFF_X + BOARD_W / 2} y={BOTTLE_TOP_Y - 1} /><Sprite width={BOARD_W} height={2} color="#1e2d40" /></Entity>

            {/* Grid lines */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <Entity key={`gv${i}`} tags={['grid']}>
                <Transform x={BOTTLE_OFF_X + i * CELL} y={BOTTLE_TOP_Y + BOARD_H / 2} />
                <Sprite width={1} height={BOARD_H} color="#111820" />
              </Entity>
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <Entity key={`gh${i}`} tags={['grid']}>
                <Transform x={BOTTLE_OFF_X + BOARD_W / 2} y={BOTTLE_TOP_Y + i * CELL} />
                <Sprite width={BOARD_W} height={1} color="#111820" />
              </Entity>
            ))}

            {/* Divider between board and sidebar */}
            <Entity tags={['div']}><Transform x={BOARD_W + BOTTLE_OFF_X + 4} y={H / 2} /><Sprite width={2} height={H} color="#1a2030" /></Entity>

            {/* Board cells */}
            {cells.map(c => (
              <Entity key={c.key} tags={['cell']}>
                <Transform x={c.x} y={c.y} />
                <Sprite width={CELL - 3} height={CELL - 3} color={c.color} zIndex={c.zIndex} />
              </Entity>
            ))}

            {/* Virus indicator dots (eyes) */}
            {cells.filter(c => c.isVirus).map(c => (
              <Entity key={`ve${c.key}`} tags={['virus-eye']}>
                <Transform x={c.x} y={c.y - 3} />
                <Sprite width={6} height={4} color="#fff" zIndex={c.zIndex + 1} />
              </Entity>
            ))}

            {/* Sidebar: NEXT */}
            <Entity tags={['ui']}><Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={55} /><Text text="NEXT" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} /></Entity>
            {nextPreview.map(c => (
              <Entity key={c.key} tags={['next']}>
                <Transform x={c.x} y={c.y} />
                <Sprite width={24} height={24} color={c.color} zIndex={3} />
              </Entity>
            ))}

            {/* Sidebar: stats */}
            <Entity tags={['ui']}><Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={155} /><Text text="SCORE" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} /></Entity>
            <Entity tags={['ui']}><Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={175} /><Text text={String(score)} fontSize={14} color="#4fc3f7" align="center" baseline="middle" zIndex={5} /></Entity>

            <Entity tags={['ui']}><Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={225} /><Text text="VIRUS" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} /></Entity>
            <Entity tags={['ui']}><Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={245} /><Text text={String(virusCount)} fontSize={14} color="#ef5350" align="center" baseline="middle" zIndex={5} /></Entity>

            {/* Difficulty selector in sidebar */}
            <Entity tags={['ui']}><Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={310} /><Text text="LEVEL" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} /></Entity>
            {(['easy', 'medium', 'hard'] as const).map((d, i) => (
              <Entity key={d} tags={['ui']}>
                <Transform x={BOARD_W + BOTTLE_OFF_X + SIDE_W / 2} y={335 + i * 28} />
                <Text text={d.toUpperCase()} fontSize={12}
                  color={difficulty === d ? '#69f0ae' : '#37474f'}
                  align="center" baseline="middle" zIndex={5} />
              </Entity>
            ))}
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>DR. MARIO</p>
              <p style={{ fontSize: 12, color: '#90a4ae', margin: '16px 0 8px' }}>Difficulty:</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    ...btnStyle,
                    background: difficulty === d ? '#69f0ae' : '#1e2535',
                    color: difficulty === d ? '#0a0a0f' : '#90a4ae',
                    padding: '7px 14px', marginTop: 0, fontSize: 11,
                  }}>{d.toUpperCase()}</button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: '#90a4ae' }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>STAGE CLEAR</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 14, color: '#4fc3f7', margin: '12px 0' }}>Score: {score}</p>
              <button onClick={() => setGameState('idle')} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>BLOCKED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 14, color: '#4fc3f7', margin: '12px 0' }}>Score: {score}</p>
              <button onClick={() => setGameState('idle')} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 16px', fontSize: 11, color: '#37474f', letterSpacing: 1.2,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>&larr;&rarr; move &nbsp;&middot;&nbsp; &uarr;/Z rotate &nbsp;&middot;&nbsp; &darr; drop</span>
        <span style={{ color: '#1a2030' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '32px 44px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 20, padding: '10px 28px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
