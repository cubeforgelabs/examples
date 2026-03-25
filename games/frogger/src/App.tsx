import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 480
const H = 560

// Grid: 14 rows of 40px, 12 cols of 40px
const CELL = 40
const COLS = 12
const ROWS = 14

// Row layout (row 0 = top)
// Row 0: home slots (safe zone / lily pads)
// Rows 1–5: river
// Row 6: safe median strip
// Rows 7–11: road
// Rows 12–13: safe start zone

const HOME_Y = CELL / 2                    // row 0 center
const RIVER_START_ROW = 1
const RIVER_END_ROW = 5
const MEDIAN_ROW = 6
const ROAD_START_ROW = 7
const ROAD_END_ROW = 11
const START_ROW = 13

function rowY(row: number) { return row * CELL + CELL / 2 }

type GameState = 'idle' | 'playing' | 'gameover' | 'win'

interface Vehicle {
  id: number
  row: number
  x: number
  w: number
  speed: number   // px/frame, signed
  color: string
}

interface Log {
  id: number
  row: number
  x: number
  w: number
  speed: number
  isTurtle?: boolean
}

interface HomeSlot {
  col: number      // 0..4
  filled: boolean
}

// Lane configs
const ROAD_LANES: { row: number; speed: number; dir: number; color: string; carW: number; count: number; gap: number }[] = [
  { row: 7,  speed: 1.8, dir: -1, color: '#ef5350', carW: 56, count: 3, gap: 180 },
  { row: 8,  speed: 1.4, dir:  1, color: '#ffd54f', carW: 40, count: 4, gap: 140 },
  { row: 9,  speed: 2.2, dir: -1, color: '#ef5350', carW: 72, count: 2, gap: 200 },
  { row: 10, speed: 1.6, dir:  1, color: '#fff9c4', carW: 40, count: 4, gap: 130 },
  { row: 11, speed: 1.0, dir: -1, color: '#ef9a9a', carW: 88, count: 2, gap: 220 },
]

const RIVER_LANES: { row: number; speed: number; dir: number; w: number; count: number; gap: number; isTurtle?: boolean }[] = [
  { row: 1, speed: 1.2, dir:  1, w: 80,  count: 3, gap: 160 },
  { row: 2, speed: 1.8, dir: -1, w: 60,  count: 3, gap: 140, isTurtle: true },
  { row: 3, speed: 1.0, dir:  1, w: 100, count: 2, gap: 200 },
  { row: 4, speed: 2.0, dir: -1, w: 72,  count: 3, gap: 150 },
  { row: 5, speed: 1.4, dir:  1, w: 88,  count: 2, gap: 180 },
]

function makeCars(): Vehicle[] {
  let id = 0
  const cars: Vehicle[] = []
  for (const lane of ROAD_LANES) {
    for (let i = 0; i < lane.count; i++) {
      const startX = lane.dir === 1
        ? -lane.carW / 2 - i * lane.gap
        : W + lane.carW / 2 + i * lane.gap
      cars.push({ id: id++, row: lane.row, x: startX, w: lane.carW, speed: lane.speed * lane.dir, color: lane.color })
    }
  }
  return cars
}

function makeLogs(): Log[] {
  let id = 0
  const logs: Log[] = []
  for (const lane of RIVER_LANES) {
    for (let i = 0; i < lane.count; i++) {
      const startX = lane.dir === 1
        ? -lane.w / 2 - i * lane.gap
        : W + lane.w / 2 + i * lane.gap
      logs.push({ id: id++, row: lane.row, x: startX, w: lane.w, speed: lane.speed * lane.dir, isTurtle: lane.isTurtle })
    }
  }
  return logs
}

function makeHomeSlots(): HomeSlot[] {
  return Array.from({ length: 5 }, (_, i) => ({ col: i, filled: false }))
}

// x-center of home slot col (0..4)
function homeSlotX(col: number) {
  // 5 slots evenly across W=480: spaced at 80px, starting at 48
  return 48 + col * 96
}

interface GameData {
  frogX: number
  frogRow: number
  cars: Vehicle[]
  logs: Log[]
  homes: HomeSlot[]
  onLog: boolean
  dead: boolean
  deathTimer: number
}

function initGame(): GameData {
  return {
    frogX: W / 2,
    frogRow: START_ROW,
    cars: makeCars(),
    logs: makeLogs(),
    homes: makeHomeSlots(),
    onLog: false,
    dead: false,
    deathTimer: 0,
  }
}

export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [lives, setLives] = useState(5)
  const [gameState, setGameState] = useState<GameState>('idle')
  const gd = useRef<GameData>(initGame())
  const keysRef = useRef<Set<string>>(new Set())
  const [, tick] = useReducer(n => n + 1, 0)
  const rafRef = useRef<number>(0)
  const gameStateRef = useRef<GameState>('idle')
  const scoreRef = useRef(0)
  const livesRef = useRef(5)
  const moveRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({ up: false, down: false, left: false, right: false })

  gameStateRef.current = gameState

  function restart() {
    gd.current = initGame()
    scoreRef.current = 0
    livesRef.current = 5
    setScore(0)
    setLives(5)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  // Keyboard: discrete frog jumps
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
      if ((gameStateRef.current === 'idle' || gameStateRef.current === 'gameover' || gameStateRef.current === 'win') &&
        (e.code === 'Space' || e.code === 'Enter')) {
        restart()
        return
      }
      if (gameStateRef.current !== 'playing') return
      const g = gd.current
      if (g.dead) return
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        g.frogRow = Math.max(0, g.frogRow - 1)
        // Score for advancing
        if (g.frogRow < 13) {
          const pts = (13 - g.frogRow) * 10
          // only award if moving forward
        }
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') g.frogRow = Math.min(START_ROW, g.frogRow + 1)
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') g.frogX = Math.max(CELL / 2, g.frogX - CELL)
      if (e.code === 'ArrowRight' || e.code === 'KeyD') g.frogX = Math.min(W - CELL / 2, g.frogX + CELL)
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gameState !== 'playing') return

    function frame() {
      if (gameStateRef.current !== 'playing') return
      const g = gd.current

      // Handle death animation
      if (g.dead) {
        g.deathTimer--
        if (g.deathTimer <= 0) {
          g.dead = false
          g.frogX = W / 2
          g.frogRow = START_ROW
        }
        tick()
        rafRef.current = requestAnimationFrame(frame)
        return
      }

      // Move cars (wrap around)
      for (const car of g.cars) {
        car.x += car.speed
        if (car.speed > 0 && car.x - car.w / 2 > W + 20) car.x = -car.w / 2 - 10
        if (car.speed < 0 && car.x + car.w / 2 < -20) car.x = W + car.w / 2 + 10
      }

      // Move logs (wrap around)
      for (const log of g.logs) {
        log.x += log.speed
        if (log.speed > 0 && log.x - log.w / 2 > W + 20) log.x = -log.w / 2 - 10
        if (log.speed < 0 && log.x + log.w / 2 < -20) log.x = W + log.w / 2 + 10
      }

      const fRow = g.frogRow

      // If in river zone, frog must be on a log/turtle
      if (fRow >= RIVER_START_ROW && fRow <= RIVER_END_ROW) {
        // Find log in same row
        const log = g.logs.find(l => l.row === fRow && Math.abs(g.frogX - l.x) < l.w / 2 + CELL * 0.3)
        if (log) {
          // Carry frog
          g.frogX += log.speed
          g.frogX = Math.max(CELL / 2, Math.min(W - CELL / 2, g.frogX))
          g.onLog = true
        } else {
          // Fell in water
          g.dead = true
          g.deathTimer = 30
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
          tick()
          rafRef.current = requestAnimationFrame(frame)
          return
        }
      } else {
        g.onLog = false
      }

      // If in road zone, check car collision
      if (fRow >= ROAD_START_ROW && fRow <= ROAD_END_ROW) {
        const hit = g.cars.find(c => c.row === fRow && Math.abs(g.frogX - c.x) < c.w / 2 + CELL * 0.3)
        if (hit) {
          g.dead = true
          g.deathTimer = 30
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
          tick()
          rafRef.current = requestAnimationFrame(frame)
          return
        }
      }

      // If frog reached row 0 (home row)
      if (fRow === 0) {
        // Find nearest home slot
        const nearest = g.homes.reduce((best, slot) => {
          const dx = Math.abs(g.frogX - homeSlotX(slot.col))
          const bdx = Math.abs(g.frogX - homeSlotX(best.col))
          return dx < bdx ? slot : best
        })
        const dx = Math.abs(g.frogX - homeSlotX(nearest.col))
        if (dx < CELL * 0.6 && !nearest.filled) {
          nearest.filled = true
          scoreRef.current += 200
          setScore(scoreRef.current)
          // Reset frog
          g.frogX = W / 2
          g.frogRow = START_ROW
          // Check all homes filled = win
          if (g.homes.every(h => h.filled)) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('win')
            return
          }
        } else if (dx >= CELL * 0.6) {
          // missed: fell in water at top edge
          g.dead = true
          g.deathTimer = 30
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
        } else if (nearest.filled) {
          // already filled
          g.dead = true
          g.deathTimer = 30
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
        }
      }

      tick()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameState, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const g = gd.current

  // Background rows
  function rowBg(row: number): string {
    if (row === 0) return '#0d3320'
    if (row >= RIVER_START_ROW && row <= RIVER_END_ROW) return '#1a3a5c'
    if (row === MEDIAN_ROW) return '#2d2d1a'
    if (row >= ROAD_START_ROW && row <= ROAD_END_ROW) return '#1a1a1a'
    return '#1a2a1a'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#69f0ae' : '#263238', fontSize: 14 }}>🐸</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#69f0ae', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>{String(score).padStart(5, '0')}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#37474f' }}>BEST {bestScore}</div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Row backgrounds */}
            {Array.from({ length: ROWS }, (_, row) => (
              <Entity key={`rowbg${row}`} tags={['bg']}>
                <Transform x={W / 2} y={rowY(row)} />
                <Sprite width={W} height={CELL} color={rowBg(row)} zIndex={0} />
              </Entity>
            ))}

            {/* Road lane dividers */}
            {[7.5, 8.5, 9.5, 10.5].map(r => (
              <Entity key={`div${r}`} tags={['div']}>
                <Transform x={W / 2} y={r * CELL} />
                <Sprite width={W} height={2} color="#333" zIndex={1} />
              </Entity>
            ))}

            {/* Dashed road lines */}
            {[7.5, 8.5, 9.5, 10.5].flatMap(r =>
              Array.from({ length: 8 }, (_, i) => (
                <Entity key={`dash${r}-${i}`} tags={['dash']}>
                  <Transform x={30 + i * 60} y={r * CELL} />
                  <Sprite width={30} height={2} color="#444" zIndex={2} />
                </Entity>
              ))
            )}

            {/* River surface shimmer lines */}
            {[1, 2, 3, 4, 5].flatMap(r =>
              Array.from({ length: 3 }, (_, i) => (
                <Entity key={`riv${r}-${i}`} tags={['river']}>
                  <Transform x={W / 2} y={r * CELL + 10 + i * 10} />
                  <Sprite width={W} height={1} color="#1e4a6e" zIndex={1} />
                </Entity>
              ))
            )}

            {/* Home slots */}
            {g.homes.map(slot => (
              <Entity key={`home${slot.col}`} tags={['home']}>
                <Transform x={homeSlotX(slot.col)} y={HOME_Y} />
                <Sprite width={CELL - 6} height={CELL - 6} color={slot.filled ? '#69f0ae' : '#1b5e20'} zIndex={3} />
              </Entity>
            ))}

            {/* Logs & turtles */}
            {g.logs.map(log => (
              <Entity key={log.id} tags={['log']}>
                <Transform x={log.x} y={rowY(log.row)} />
                <Sprite width={log.w} height={CELL - 8} color={log.isTurtle ? '#2e7d32' : '#6d4c41'} zIndex={5} />
              </Entity>
            ))}
            {/* Log detail lines */}
            {g.logs.filter(l => !l.isTurtle).map(log => (
              <Entity key={`ld${log.id}`} tags={['logd']}>
                <Transform x={log.x} y={rowY(log.row)} />
                <Sprite width={log.w - 10} height={CELL - 14} color="#795548" zIndex={6} />
              </Entity>
            ))}

            {/* Cars */}
            {g.cars.map(car => (
              <Entity key={car.id} tags={['car']}>
                <Transform x={car.x} y={rowY(car.row)} />
                <Sprite width={car.w} height={CELL - 10} color={car.color} zIndex={5} />
              </Entity>
            ))}
            {/* Car windshields */}
            {g.cars.map(car => (
              <Entity key={`cw${car.id}`} tags={['cw']}>
                <Transform x={car.x + (car.speed > 0 ? car.w * 0.15 : -car.w * 0.15)} y={rowY(car.row)} />
                <Sprite width={car.w * 0.3} height={CELL - 16} color="rgba(180,220,255,0.6)" zIndex={6} />
              </Entity>
            ))}

            {/* Frog */}
            {!g.dead && (
              <>
                <Entity tags={['frog']}>
                  <Transform x={g.frogX} y={rowY(g.frogRow)} />
                  <Sprite width={CELL - 6} height={CELL - 6} color="#4caf50" zIndex={20} />
                </Entity>
                {/* Frog eyes */}
                <Entity tags={['frog-eye-l']}>
                  <Transform x={g.frogX - 7} y={rowY(g.frogRow) - 8} />
                  <Sprite width={6} height={6} color="#fff" zIndex={21} />
                </Entity>
                <Entity tags={['frog-eye-r']}>
                  <Transform x={g.frogX + 7} y={rowY(g.frogRow) - 8} />
                  <Sprite width={6} height={6} color="#fff" zIndex={21} />
                </Entity>
              </>
            )}
            {/* Death flash */}
            {g.dead && g.deathTimer % 4 < 2 && (
              <Entity tags={['dead-frog']}>
                <Transform x={g.frogX} y={rowY(g.frogRow)} />
                <Sprite width={CELL} height={CELL} color="#ff7043" zIndex={20} />
              </Entity>
            )}

          </World>
        </Game>

        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>FROGGER</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16 }}>Cross the road and river safely!</p>
              <p style={{ fontSize: 12, color: '#607d8b', marginTop: 8 }}>Reach all 5 home slots to win</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 12 }}>Press <strong style={{ color: '#fff' }}>SPACE</strong> to start</p>
            </div>
          </div>
        )}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>GAME OVER</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>SQUASHED!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score <strong style={{ color: '#69f0ae' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>ALL HOMES!</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score <strong style={{ color: '#69f0ae' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>WASD / Arrows — hop</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#69f0ae', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
