import { useEffect, useRef, useReducer, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W          = 640
const H          = 400
const GROUND_Y   = 340          // top of ground surface (player stands here)
const GROUND_H   = 60
const PLAYER_W   = 16
const PLAYER_H   = 24
const PLAYER_X   = 100          // fixed screen X
const GRAVITY    = 1400         // px/s²
const JUMP_VEL   = -540
const SLIDE_H    = 12           // crouched height
const BASE_SPEED = 220          // px/s initial run speed
const MAX_SPEED  = 600
const ACCEL      = 14           // speed increase per second
const MAX_LIVES  = 3

// Parallax layer scroll multipliers (fraction of run speed)
const PARA_LAYERS = [0.2, 0.5, 0.8]

// ─── Types ────────────────────────────────────────────────────────────────────
type ObstacleKind = 'gap' | 'bar' | 'wall'
interface Obstacle {
  id:   number
  kind: ObstacleKind
  x:    number     // world X of left edge
  w:    number
  h:    number
  y:    number     // world Y of top edge
}

interface ParticleStar {
  id:  number
  x:   number      // screen X (0..W) per layer
  y:   number
  layer: number
}

type GameState = 'idle' | 'playing' | 'dead' | 'gameover'

// ─── Obstacle generator ───────────────────────────────────────────────────────
let _oid = 0
function nextId() { return ++_oid }

function genObstacle(worldX: number): Obstacle {
  const r = Math.random()
  const id = nextId()
  if (r < 0.33) {
    // Gap in ground
    const w = 60 + Math.random() * 50
    return { id, kind: 'gap', x: worldX, w, h: GROUND_H, y: GROUND_Y }
  } else if (r < 0.66) {
    // Overhead bar — must slide
    const w = 50 + Math.random() * 40
    const h = 18
    return { id, kind: 'bar', x: worldX, w, h, y: GROUND_Y - PLAYER_H - h + 4 }
  } else {
    // Wall — must jump over
    const w = 16
    const h = 28 + Math.random() * 20
    return { id, kind: 'wall', x: worldX, w, h, y: GROUND_Y - h }
  }
}

function buildInitialStars(): ParticleStar[] {
  const stars: ParticleStar[] = []
  let sid = 0
  for (let layer = 0; layer < PARA_LAYERS.length; layer++) {
    const count = layer === 0 ? 30 : layer === 1 ? 20 : 12
    for (let i = 0; i < count; i++) {
      stars.push({
        id:    ++sid,
        x:     Math.random() * W,
        y:     20 + Math.random() * (GROUND_Y - 40),
        layer,
      })
    }
  }
  return stars
}

// ─── Game logic state (all in refs) ──────────────────────────────────────────
interface RunState {
  // Player
  worldX:   number    // camera = worldX - PLAYER_X
  playerY:  number    // center Y
  vy:       number
  onGround: boolean
  sliding:  boolean
  // Obstacles
  obstacles:  Obstacle[]
  nextSpawnX: number
  // Speed
  speed: number
  // Stars per layer offsets
  starOffsets: number[]
}

function makeRunState(): RunState {
  return {
    worldX:      PLAYER_X,
    playerY:     GROUND_Y - PLAYER_H / 2,
    vy:          0,
    onGround:    true,
    sliding:     false,
    obstacles:   [],
    nextSpawnX:  PLAYER_X + 500,
    speed:       BASE_SPEED,
    starOffsets: PARA_LAYERS.map(() => 0),
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [lives,     setLives]     = useState(MAX_LIVES)
  const [gameState, setGameState] = useState<GameState>('idle')

  // All mutable physics state lives in refs
  const runRef  = useRef<RunState>(makeRunState())
  const keysRef = useRef<Set<string>>(new Set())
  const [, tick] = useReducer(n => n + 1, 0)

  // Stars (initialized once, mutated in rAF)
  const starsRef = useRef<ParticleStar[]>(buildInitialStars())

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault()
      }
      if ((gameState === 'idle' || gameState === 'gameover') &&
          (e.code === 'Space' || e.code === 'Enter')) {
        start()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── rAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') return

    let prev = performance.now()
    let rafId = 0
    let livesLeft = MAX_LIVES

    const loop = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now

      const s     = runRef.current
      const keys  = keysRef.current
      const stars = starsRef.current

      const jumping = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')
      const sliding = (keys.has('ArrowDown') || keys.has('KeyS')) && s.onGround

      // Speed ramp
      s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt)

      // Advance world X
      s.worldX += s.speed * dt

      // Player height based on slide
      const curH = sliding ? SLIDE_H : PLAYER_H
      s.sliding  = sliding

      // Jump
      if (jumping && s.onGround) {
        s.vy = JUMP_VEL
        s.onGround = false
      }

      // Gravity
      s.vy += GRAVITY * dt
      s.playerY += s.vy * dt

      // Ground collision
      const groundTop = GROUND_Y - curH / 2
      if (s.playerY >= groundTop) {
        s.playerY  = groundTop
        s.vy       = 0
        s.onGround = true
      } else {
        s.onGround = false
      }

      // Spawn obstacles
      while (s.nextSpawnX < s.worldX + W + 200) {
        const gap  = 280 + Math.random() * 200
        const obs  = genObstacle(s.nextSpawnX)
        s.obstacles.push(obs)
        s.nextSpawnX += obs.w + gap
      }

      // Cull off-screen obstacles
      const camLeft = s.worldX - PLAYER_X
      s.obstacles = s.obstacles.filter(o => o.x + o.w > camLeft - 50)

      // AABB collision — player box
      const ph  = sliding ? SLIDE_H : PLAYER_H
      const py  = sliding ? GROUND_Y - SLIDE_H / 2 : s.playerY
      const pLeft   = s.worldX - PLAYER_W / 2
      const pRight  = s.worldX + PLAYER_W / 2
      const pTop    = py - ph / 2
      const pBottom = py + ph / 2

      let hit = false
      for (const obs of s.obstacles) {
        if (obs.kind === 'gap') {
          // Fell into gap: player is on ground level but over gap area
          if (s.onGround &&
              pRight > obs.x && pLeft < obs.x + obs.w) {
            hit = true
            break
          }
        } else {
          // Wall or bar
          const oLeft   = obs.x
          const oRight  = obs.x + obs.w
          const oTop    = obs.y
          const oBottom = obs.y + obs.h
          if (pRight > oLeft && pLeft < oRight &&
              pBottom > oTop  && pTop  < oBottom) {
            hit = true
            break
          }
        }
      }

      if (hit) {
        livesLeft -= 1
        setLives(livesLeft)
        if (livesLeft <= 0) {
          setScore(prev => {
            setBestScore(b => Math.max(b, prev))
            return prev
          })
          setGameState('gameover')
          cancelAnimationFrame(rafId)
          return
        }
        // Respawn — reset position but keep speed
        s.playerY    = GROUND_Y - PLAYER_H / 2
        s.vy         = 0
        s.onGround   = true
        s.obstacles  = []
        s.nextSpawnX = s.worldX + 500
        setGameState('dead')
        cancelAnimationFrame(rafId)
        return
      }

      // Scroll parallax stars
      for (let l = 0; l < PARA_LAYERS.length; l++) {
        s.starOffsets[l] = (s.starOffsets[l] + s.speed * PARA_LAYERS[l] * dt) % W
      }
      for (const star of stars) {
        const offset = s.starOffsets[star.layer]
        // Original x minus scroll, wrap around
        const baseX = ((star.id * 137.5 + star.layer * 200) % W)
        star.x = ((baseX - offset) % W + W) % W
      }

      // Score = distance
      setScore(Math.floor((s.worldX - PLAYER_X) / 10))

      tick()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [gameState, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume after death flash ───────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'dead') return
    const t = setTimeout(() => setGameState('playing'), 800)
    return () => clearTimeout(t)
  }, [gameState])

  function start() {
    _oid = 0
    runRef.current  = makeRunState()
    starsRef.current = buildInitialStars()
    keysRef.current.clear()
    setScore(0)
    setLives(MAX_LIVES)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  // ── Derived render data ────────────────────────────────────────────────────
  const s      = runRef.current
  const stars  = starsRef.current
  const camX   = s.worldX - PLAYER_X   // left edge of camera in world coords
  const ph     = s.sliding ? SLIDE_H : PLAYER_H
  const playerScreenY = s.sliding ? GROUND_Y - SLIDE_H / 2 : s.playerY
  const playerColor   = gameState === 'dead' ? '#ff6b6b' : '#4fc3f7'

  // Build ground tiles: just render WORLD_W wide ground, offset by camera
  // We split ground into segments to show gaps
  const groundSegments: { id: string; sx: number; w: number }[] = []
  // Default: full ground band
  // We'll cut out gap obstacles
  const gaps = s.obstacles.filter(o => o.kind === 'gap')
  let cursor = 0
  const rightEdge = W + 100
  for (const gap of gaps) {
    const gsx = gap.x - camX
    if (gsx > rightEdge) break
    if (gsx + gap.w < -50) continue
    if (gsx > cursor) {
      groundSegments.push({ id: `g${gap.id}a`, sx: (cursor + camX) - camX, w: gsx - cursor })
    }
    cursor = gsx + gap.w
  }
  if (cursor < rightEdge) {
    groundSegments.push({ id: 'gend', sx: cursor, w: rightEdge - cursor })
  }

  // Obstacles to render
  const visObs = s.obstacles.filter(o => {
    const sx = o.x - camX
    return sx < W + 50 && sx + o.w > -50
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ──────────────────────────────────────────────────────────────── */}
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
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#263238', fontSize: 16 }}>♥</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 16, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#37474f' }}>
          BEST {String(bestScore).padStart(6, '0')}
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Parallax star layers */}
            {stars.map(star => (
              <Entity key={`star-${star.id}`} tags={['bg']}>
                <Transform x={star.x} y={star.y} />
                <Sprite
                  width={star.layer === 0 ? 1 : star.layer === 1 ? 2 : 3}
                  height={star.layer === 0 ? 1 : star.layer === 1 ? 2 : 3}
                  color={star.layer === 0 ? '#1a2640' : star.layer === 1 ? '#1e3050' : '#243a5e'}
                  zIndex={1}
                />
              </Entity>
            ))}

            {/* Ground segments (gaps shown as holes) */}
            {groundSegments.map(seg => (
              <Entity key={seg.id} tags={['ground']}>
                <Transform x={seg.sx + seg.w / 2} y={GROUND_Y + GROUND_H / 2} />
                <Sprite width={seg.w} height={GROUND_H} color="#1e2d1e" zIndex={3} />
              </Entity>
            ))}
            {/* Ground top edge line */}
            {groundSegments.map(seg => (
              <Entity key={`${seg.id}-line`} tags={['ground']}>
                <Transform x={seg.sx + seg.w / 2} y={GROUND_Y + 1} />
                <Sprite width={seg.w} height={3} color="#4caf50" zIndex={4} />
              </Entity>
            ))}

            {/* Obstacles */}
            {visObs.map(obs => {
              if (obs.kind === 'gap') return null
              const sx = obs.x - camX + obs.w / 2
              const sy = obs.y + obs.h / 2
              const col = obs.kind === 'bar' ? '#ff7043' : '#ef5350'
              return (
                <Entity key={`obs-${obs.id}`} tags={['obstacle']}>
                  <Transform x={sx} y={sy} />
                  <Sprite width={obs.w} height={obs.h} color={col} zIndex={5} />
                </Entity>
              )
            })}

            {/* Bar danger stripes */}
            {visObs.filter(o => o.kind === 'bar').map(obs => {
              const sx = obs.x - camX + obs.w / 2
              return (
                <Entity key={`bar-stripe-${obs.id}`} tags={['obstacle']}>
                  <Transform x={sx} y={obs.y + obs.h + 2} />
                  <Sprite width={obs.w} height={2} color="#ff5722" zIndex={6} />
                </Entity>
              )
            })}

            {/* Player */}
            <Entity key="player" tags={['player']}>
              <Transform x={PLAYER_X} y={playerScreenY} />
              <Sprite width={PLAYER_W} height={ph} color={playerColor} zIndex={10} />
            </Entity>

            {/* Player eyes */}
            <Entity key="player-eye" tags={['player']}>
              <Transform x={PLAYER_X + 4} y={playerScreenY - ph / 2 + 5} />
              <Sprite width={3} height={3} color="#0d1117" zIndex={11} />
            </Entity>

            {/* Speed indicator bar */}
            <Entity key="speed-bar" tags={['hud']}>
              <Transform x={(s.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) * W / 2} y={H - 4} />
              <Sprite width={(s.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) * W} height={3} color="#ffd54f" zIndex={20} />
            </Entity>

          </World>
        </Game>

        {/* ── Idle overlay ────────────────────────────────────────────────── */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>AUTO RUNNER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 8 }}>
                ↑ / SPACE — jump &nbsp;·&nbsp; ↓ — slide
              </p>
            </div>
          </div>
        )}

        {/* ── Dead flash overlay ──────────────────────────────────────────── */}
        {gameState === 'dead' && (
          <div style={{ ...overlayStyle, background: 'rgba(239,83,80,0.25)' }}>
            <div style={{ ...cardStyle, padding: '20px 40px' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#ef5350', letterSpacing: 3 }}>
                {lives} {lives === 1 ? 'LIFE' : 'LIVES'} LEFT
              </p>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ────────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>NO LIVES LEFT</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Distance &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Best &nbsp;<strong style={{ color: '#4fc3f7' }}>{bestScore}</strong>
              </p>
              <button onClick={start} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ───────────────────────────────────────────────────── */}
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
        <span>SPACE / ↑ — jump &nbsp;·&nbsp; ↓ — slide under bars &nbsp;·&nbsp; avoid gaps &amp; walls</span>
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
