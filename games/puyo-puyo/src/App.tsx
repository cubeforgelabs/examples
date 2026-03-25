import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite, Text } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS    = 6
const ROWS    = 13
const CELL    = 36
const BOARD_W = COLS * CELL   // 216
const BOARD_H = ROWS * CELL   // 468
const SIDE_W  = 140
const W       = BOARD_W + SIDE_W
const H       = BOARD_H + 40  // top HUD space

const BOARD_OFF_Y = 20   // pixels from top where row 0 starts

// ─── Types ────────────────────────────────────────────────────────────────────
type PuyoColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple'
type Board = (PuyoColor | null)[][]
type GameState = 'idle' | 'playing' | 'gameover'
type Phase = 'dropping' | 'settling' | 'popping' | 'falling'

interface Pair {
  pivot: PuyoColor      // center puyo
  satellite: PuyoColor  // orbiting puyo
  // pivot position
  pivotCol: number
  pivotRow: number
  // satellite offset relative to pivot: 0=up, 1=right, 2=down, 3=left
  angle: number
}

const COLORS: PuyoColor[] = ['red', 'green', 'blue', 'yellow', 'purple']
const COLOR_HEX: Record<PuyoColor, string> = {
  red:    '#ef5350',
  green:  '#66bb6a',
  blue:   '#42a5f5',
  yellow: '#fdd835',
  purple: '#ab47bc',
}
const COLOR_DARK: Record<PuyoColor, string> = {
  red:    '#b71c1c',
  green:  '#1b5e20',
  blue:   '#0d47a1',
  yellow: '#f57f17',
  purple: '#4a148c',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rndColor(): PuyoColor { return COLORS[Math.floor(Math.random() * COLORS.length)] }

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function spawnPair(): Pair {
  return {
    pivot: rndColor(),
    satellite: rndColor(),
    pivotCol: Math.floor(COLS / 2),
    pivotRow: 1,
    angle: 0,   // satellite above pivot
  }
}

// Get satellite position from pivot + angle
// angle: 0=up, 1=right, 2=down, 3=left
const ANGLE_OFFSETS: [number, number][] = [
  [0, -1],  // up:    col+0, row-1
  [1, 0],   // right: col+1, row+0
  [0, 1],   // down:  col+0, row+1
  [-1, 0],  // left:  col-1, row+0
]

function satPos(pair: Pair): [number, number] {
  const [dc, dr] = ANGLE_OFFSETS[pair.angle]
  return [pair.pivotCol + dc, pair.pivotRow + dr]
}

function pairFits(board: Board, pair: Pair, pc: number, pr: number, angle: number): boolean {
  const test: Pair = { ...pair, pivotCol: pc, pivotRow: pr, angle }
  const [sc, sr] = satPos(test)
  const cells: [number, number][] = [[pc, pr], [sc, sr]]
  for (const [c, r] of cells) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false
    if (board[r][c] !== null) return false
  }
  return true
}

function lockPair(board: Board, pair: Pair): Board {
  const nb = board.map(r => [...r])
  const [sc, sr] = satPos(pair)
  nb[pair.pivotRow][pair.pivotCol] = pair.pivot
  if (sr >= 0 && sr < ROWS && sc >= 0 && sc < COLS) nb[sr][sc] = pair.satellite
  return nb
}

function applyGravity(board: Board): { board: Board; moved: boolean } {
  let moved = false
  const nb = board.map(r => [...r])
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 2; r >= 0; r--) {
      if (nb[r][c] !== null && nb[r + 1][c] === null) {
        nb[r + 1][c] = nb[r][c]
        nb[r][c] = null
        moved = true
      }
    }
  }
  return { board: nb, moved }
}

function floodFill(board: Board, startR: number, startC: number, color: PuyoColor, visited: Set<string>): [number, number][] {
  const group: [number, number][] = []
  const stack: [number, number][] = [[startR, startC]]
  while (stack.length) {
    const [r, c] = stack.pop()!
    const key = `${r},${c}`
    if (visited.has(key)) continue
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue
    if (board[r][c] !== color) continue
    visited.add(key)
    group.push([r, c])
    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1])
  }
  return group
}

function findGroups(board: Board): [number, number][][] {
  const visited = new Set<string>()
  const groups: [number, number][][] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = board[r][c]
      if (color && !visited.has(`${r},${c}`)) {
        const group = floodFill(board, r, c, color, visited)
        if (group.length >= 4) groups.push(group)
      }
    }
  }
  return groups
}

function removeGroups(board: Board, groups: [number, number][][]): Board {
  const nb = board.map(r => [...r])
  for (const group of groups) {
    for (const [r, c] of group) nb[r][c] = null
  }
  return nb
}

// Chain score: base * chain_multiplier
const CHAIN_MULT = [0, 1, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 512]
function chainScore(cleared: number, chain: number): number {
  const mult = CHAIN_MULT[Math.min(chain, CHAIN_MULT.length - 1)]
  return cleared * 10 * Math.max(1, mult)
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey]     = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore]         = useState(0)
  const [chainDisplay, setChainDisplay] = useState(0)

  const boardRef    = useRef<Board>(emptyBoard())
  const pairRef     = useRef<Pair>(spawnPair())
  const nextPairRef = useRef<Pair>(spawnPair())
  const phaseRef    = useRef<Phase>('dropping')
  const chainRef    = useRef(0)

  const [phase, setPhase] = useState<Phase>('dropping')
  const [, forceRender]   = useReducer(n => n + 1, 0)

  phaseRef.current = phase

  // ── Spawn next pair ───────────────────────────────────────────────────────
  const spawnNext = useCallback(() => {
    const np = nextPairRef.current
    nextPairRef.current = spawnPair()
    // Check if spawn position is blocked
    if (!pairFits(boardRef.current, np, np.pivotCol, np.pivotRow, np.angle)) {
      setGameState('gameover')
      return false
    }
    pairRef.current = { ...np }
    chainRef.current = 0
    return true
  }, [])

  // ── Pop phase: find & remove groups, then gravity again ──────────────────
  const runPopPhase = useCallback(() => {
    const board = boardRef.current
    const groups = findGroups(board)
    if (groups.length === 0) {
      // No more pops — spawn next
      spawnNext()
      setPhase('dropping')
      setChainDisplay(0)
      return
    }
    chainRef.current++
    const cleared = groups.reduce((s, g) => s + g.length, 0)
    setScore(s => s + chainScore(cleared, chainRef.current))
    setChainDisplay(chainRef.current)
    const nb = removeGroups(board, groups)
    boardRef.current = nb
    forceRender()
    // After brief pause, apply gravity again
    setTimeout(() => {
      let b = boardRef.current
      let moved = true
      while (moved) {
        const res = applyGravity(b)
        moved = res.moved
        if (moved) b = res.board
      }
      boardRef.current = b
      forceRender()
      // Check for more pops
      setTimeout(() => {
        if (phaseRef.current === 'popping') runPopPhase()
      }, 200)
    }, 300)
  }, [spawnNext])

  // ── Settling phase: gravity → pop ────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || phase !== 'settling') return
    let b = boardRef.current
    let moved = true
    while (moved) {
      const res = applyGravity(b)
      moved = res.moved
      if (moved) b = res.board
    }
    boardRef.current = b
    forceRender()
    const id = setTimeout(() => {
      setPhase('popping')
    }, 150)
    return () => clearTimeout(id)
  }, [gameState, phase])

  // ── Pop phase trigger ─────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || phase !== 'popping') return
    runPopPhase()
  }, [gameState, phase, runPopPhase])

  // ── Drop tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || phase !== 'dropping') return
    const id = setInterval(() => {
      const pair = pairRef.current
      const board = boardRef.current
      if (pairFits(board, pair, pair.pivotCol, pair.pivotRow + 1, pair.angle)) {
        pairRef.current = { ...pair, pivotRow: pair.pivotRow + 1 }
        forceRender()
      } else {
        boardRef.current = lockPair(board, pair)
        setPhase('settling')
        forceRender()
      }
    }, 550)
    return () => clearInterval(id)
  }, [gameState, phase])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameState === 'idle' || gameState === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startGame() }
        return
      }
      if (gameState !== 'playing' || phaseRef.current !== 'dropping') return
      e.preventDefault()
      const pair = pairRef.current
      const board = boardRef.current

      if (e.code === 'ArrowLeft') {
        if (pairFits(board, pair, pair.pivotCol - 1, pair.pivotRow, pair.angle))
          pairRef.current = { ...pair, pivotCol: pair.pivotCol - 1 }
      } else if (e.code === 'ArrowRight') {
        if (pairFits(board, pair, pair.pivotCol + 1, pair.pivotRow, pair.angle))
          pairRef.current = { ...pair, pivotCol: pair.pivotCol + 1 }
      } else if (e.code === 'ArrowDown') {
        if (pairFits(board, pair, pair.pivotCol, pair.pivotRow + 1, pair.angle)) {
          pairRef.current = { ...pair, pivotRow: pair.pivotRow + 1 }
          setScore(s => s + 1)
        }
      } else if (e.code === 'ArrowUp' || e.code === 'KeyZ') {
        // Rotate clockwise
        const newAngle = (pair.angle + 1) % 4
        // Try with current col, then shifts
        for (const dc of [0, -1, 1]) {
          if (pairFits(board, pair, pair.pivotCol + dc, pair.pivotRow, newAngle)) {
            pairRef.current = { ...pair, pivotCol: pair.pivotCol + dc, angle: newAngle }
            break
          }
        }
      } else if (e.code === 'KeyX') {
        // Rotate counter-clockwise
        const newAngle = (pair.angle + 3) % 4
        for (const dc of [0, -1, 1]) {
          if (pairFits(board, pair, pair.pivotCol + dc, pair.pivotRow, newAngle)) {
            pairRef.current = { ...pair, pivotCol: pair.pivotCol + dc, angle: newAngle }
            break
          }
        }
      }
      forceRender()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  function startGame() {
    boardRef.current   = emptyBoard()
    pairRef.current    = spawnPair()
    nextPairRef.current = spawnPair()
    chainRef.current   = 0
    setScore(0)
    setChainDisplay(0)
    setPhase('dropping')
    setGameState('playing')
    setGameKey(k => k + 1)
    forceRender()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const bx = (col: number) => col * CELL + CELL / 2
  const by = (row: number) => BOARD_OFF_Y + row * CELL + CELL / 2

  const board    = boardRef.current
  const pair     = pairRef.current
  const nextPair = nextPairRef.current

  type RC = { x: number; y: number; color: string; darkColor: string; key: string; zIndex: number }
  const cells: RC[] = []

  // Board cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = board[r][c]
      if (color) {
        cells.push({ x: bx(c), y: by(r), color: COLOR_HEX[color], darkColor: COLOR_DARK[color], key: `b${r}-${c}`, zIndex: 2 })
      }
    }
  }

  // Active pair
  if (gameState === 'playing' && phase === 'dropping') {
    const [sc, sr] = satPos(pair)
    cells.push({ x: bx(pair.pivotCol), y: by(pair.pivotRow), color: COLOR_HEX[pair.pivot], darkColor: COLOR_DARK[pair.pivot], key: 'ap', zIndex: 4 })
    if (sr >= 0 && sr < ROWS) {
      cells.push({ x: bx(sc), y: by(sr), color: COLOR_HEX[pair.satellite], darkColor: COLOR_DARK[pair.satellite], key: 'as', zIndex: 4 })
    }
  }

  // Next pair preview
  const npSideX = BOARD_W + SIDE_W / 2
  const npCells = [
    { x: npSideX, y: 70, color: COLOR_HEX[nextPair.pivot], key: 'np0' },
    { x: npSideX, y: 70 + CELL + 4, color: COLOR_HEX[nextPair.satellite], key: 'np1' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 16px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <span style={{ color: '#607d8b', fontSize: 11 }}>
          {chainDisplay > 1 ? `${chainDisplay}x CHAIN!` : 'PUYO PUYO'}
        </span>
        <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18 }}>{String(score).padStart(6, '0')}</span>
        <span style={{ color: '#607d8b', fontSize: 11 }}>CUBEFORGE</span>
      </div>

      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Board background */}
            <Entity tags={['bg']}>
              <Transform x={BOARD_W / 2} y={BOARD_OFF_Y + BOARD_H / 2} />
              <Sprite width={BOARD_W} height={BOARD_H} color="#0a1020" zIndex={0} />
            </Entity>

            {/* Grid lines */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <Entity key={`gv${i}`} tags={['grid']}>
                <Transform x={i * CELL} y={BOARD_OFF_Y + BOARD_H / 2} />
                <Sprite width={1} height={BOARD_H} color="#111820" />
              </Entity>
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <Entity key={`gh${i}`} tags={['grid']}>
                <Transform x={BOARD_W / 2} y={BOARD_OFF_Y + i * CELL} />
                <Sprite width={BOARD_W} height={1} color="#111820" />
              </Entity>
            ))}

            {/* Board walls */}
            <Entity tags={['wall']}><Transform x={-1} y={BOARD_OFF_Y + BOARD_H / 2} /><Sprite width={3} height={BOARD_H} color="#1e2d40" /></Entity>
            <Entity tags={['wall']}><Transform x={BOARD_W + 1} y={BOARD_OFF_Y + BOARD_H / 2} /><Sprite width={3} height={BOARD_H} color="#1e2d40" /></Entity>
            <Entity tags={['wall']}><Transform x={BOARD_W / 2} y={BOARD_OFF_Y + BOARD_H + 2} /><Sprite width={BOARD_W + 4} height={3} color="#1e2d40" /></Entity>

            {/* Divider */}
            <Entity tags={['div']}><Transform x={BOARD_W + 2} y={H / 2} /><Sprite width={2} height={H} color="#1a2030" /></Entity>

            {/* Puyo cells */}
            {cells.map(c => (
              <Entity key={c.key} tags={['cell']}>
                <Transform x={c.x} y={c.y} />
                <Sprite width={CELL - 4} height={CELL - 4} color={c.color} zIndex={c.zIndex} />
              </Entity>
            ))}

            {/* Puyo inner highlight */}
            {cells.map(c => (
              <Entity key={`h${c.key}`} tags={['highlight']}>
                <Transform x={c.x - 5} y={c.y - 5} />
                <Sprite width={8} height={8} color={c.darkColor} zIndex={c.zIndex + 1} />
              </Entity>
            ))}

            {/* Sidebar */}
            <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={35} /><Text text="NEXT" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} /></Entity>
            {npCells.map(c => (
              <Entity key={c.key} tags={['next']}>
                <Transform x={c.x} y={c.y} />
                <Sprite width={CELL - 4} height={CELL - 4} color={c.color} zIndex={3} />
              </Entity>
            ))}

            <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={200} /><Text text="SCORE" fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={5} /></Entity>
            <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={220} /><Text text={String(score)} fontSize={14} color="#4fc3f7" align="center" baseline="middle" zIndex={5} /></Entity>

            {chainDisplay > 1 && (
              <>
                <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={280} /><Text text="CHAIN" fontSize={11} color="#fdd835" align="center" baseline="middle" zIndex={5} /></Entity>
                <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={300} /><Text text={`x${chainDisplay}`} fontSize={20} color="#ff7043" align="center" baseline="middle" zIndex={5} /></Entity>
              </>
            )}

            <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={380} /><Text text="Z/X" fontSize={10} color="#37474f" align="center" baseline="middle" zIndex={5} /></Entity>
            <Entity tags={['ui']}><Transform x={BOARD_W + SIDE_W / 2} y={395} /><Text text="ROTATE" fontSize={10} color="#37474f" align="center" baseline="middle" zIndex={5} /></Entity>
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>PUYO PUYO</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '16px 0' }}>
                {COLORS.map(c => (
                  <div key={c} style={{ width: 20, height: 20, borderRadius: 4, background: COLOR_HEX[c] }} />
                ))}
              </div>
              <p style={{ fontSize: 13, color: '#90a4ae' }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
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
              <button onClick={startGame} style={btnStyle}>Try Again</button>
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
        <span>&larr;&rarr; move &nbsp;&middot;&nbsp; Z/X rotate &nbsp;&middot;&nbsp; &darr; drop</span>
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
