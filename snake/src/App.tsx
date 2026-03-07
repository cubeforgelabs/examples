import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS      = 20
const ROWS      = 20
const CELL      = 22
const W         = COLS * CELL   // 440
const H         = ROWS * CELL   // 440
const TICK_MS   = 140
const INIT_LEN  = 3

// ─── Types ────────────────────────────────────────────────────────────────────
type Point     = { x: number; y: number }
type Direction = { x: number; y: number }
type GameState = 'idle' | 'playing' | 'gameover'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomFood(body: Point[]): Point {
  const taken = new Set(body.map(p => `${p.x},${p.y}`))
  let p: Point
  do { p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) } }
  while (taken.has(`${p.x},${p.y}`))
  return p
}

function makeInitialBody(): Point[] {
  return Array.from({ length: INIT_LEN }, (_, i) => ({ x: Math.floor(COLS / 2) - i, y: Math.floor(ROWS / 2) }))
}

// Grid → canvas pixel center
function px(g: number) { return g * CELL + CELL / 2 }

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')

  // All mutable game state in refs — avoids stale closures in setInterval
  const bodyRef    = useRef<Point[]>(makeInitialBody())
  const foodRef    = useRef<Point>(randomFood(bodyRef.current))
  const dirRef     = useRef<Direction>({ x: 1, y: 0 })
  const nextDirRef = useRef<Direction>({ x: 1, y: 0 })

  // Force re-render each tick
  const [, tick] = useReducer(n => n + 1, 0)

  // ── Game tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') return

    const id = setInterval(() => {
      const dir  = nextDirRef.current
      dirRef.current = dir
      const body = bodyRef.current
      const head: Point = {
        x: (body[0].x + dir.x + COLS) % COLS,
        y: (body[0].y + dir.y + ROWS) % ROWS,
      }

      // Self collision
      if (body.some(s => s.x === head.x && s.y === head.y)) {
        setBestScore(b => Math.max(b, score))
        setGameState('gameover')
        return
      }

      // Eat food
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        bodyRef.current = [head, ...body]
        foodRef.current = randomFood(bodyRef.current)
        setScore(s => s + 10)
      } else {
        bodyRef.current = [head, ...body.slice(0, -1)]
      }

      tick()
    }, TICK_MS)

    return () => clearInterval(id)
  }, [gameState, score])

  // ── Keyboard input ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = dirRef.current
      if (gameState === 'idle' || gameState === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          restart()
        }
        return
      }
      if ((e.code === 'ArrowUp'    || e.code === 'KeyW') && cur.y === 0) nextDirRef.current = { x:  0, y: -1 }
      if ((e.code === 'ArrowDown'  || e.code === 'KeyS') && cur.y === 0) nextDirRef.current = { x:  0, y:  1 }
      if ((e.code === 'ArrowLeft'  || e.code === 'KeyA') && cur.x === 0) nextDirRef.current = { x: -1, y:  0 }
      if ((e.code === 'ArrowRight' || e.code === 'KeyD') && cur.x === 0) nextDirRef.current = { x:  1, y:  0 }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  function restart() {
    bodyRef.current    = makeInitialBody()
    foodRef.current    = randomFood(bodyRef.current)
    dirRef.current     = { x: 1, y: 0 }
    nextDirRef.current = { x: 1, y: 0 }
    setScore(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const body = bodyRef.current
  const food = foodRef.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '7px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 13,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          LEN {body.length}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#69f0ae', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(4, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#37474f' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">

            {/* Grid lines (subtle) */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <Entity key={`gv${i}`} tags={['grid']}>
                <Transform x={i * CELL} y={H / 2} />
                <Sprite width={1} height={H} color="#111820" />
              </Entity>
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <Entity key={`gh${i}`} tags={['grid']}>
                <Transform x={W / 2} y={i * CELL} />
                <Sprite width={W} height={1} color="#111820" />
              </Entity>
            ))}

            {/* Food */}
            <Entity key={`food-${food.x}-${food.y}`} tags={['food']}>
              <Transform x={px(food.x)} y={px(food.y)} />
              <Sprite width={CELL - 4} height={CELL - 4} color="#ef5350" zIndex={5} />
            </Entity>

            {/* Snake body */}
            {body.map((seg, i) => (
              <Entity key={`s${i}`} tags={['snake']}>
                <Transform x={px(seg.x)} y={px(seg.y)} />
                <Sprite
                  width={CELL - 2}
                  height={CELL - 2}
                  color={i === 0 ? '#00e676' : i < 3 ? '#4caf50' : '#388e3c'}
                  zIndex={10}
                />
              </Entity>
            ))}

          </World>
        </Game>

        {/* ── Idle overlay ────────────────────────────────────────────────── */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>
                CUBEFORGE
              </p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>
                SNAKE
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ───────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                CRASHED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#69f0ae' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Best &nbsp;<strong style={{ color: '#4fc3f7' }}>{bestScore}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ─────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: '#0d0f1a',
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>WASD / Arrows &mdash; steer &nbsp;&middot;&nbsp; collect food &nbsp;&middot;&nbsp; avoid yourself</span>
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
}

const cardStyle: React.CSSProperties = {
  textAlign:    'center',
  fontFamily:   '"Courier New", monospace',
  padding:      '36px 48px',
  background:   '#0d0f1a',
  border:       '1px solid #1e2535',
  borderRadius: 12,
}

const btnStyle: React.CSSProperties = {
  marginTop:     24,
  padding:       '10px 32px',
  background:    '#69f0ae',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
