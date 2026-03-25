import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 480
const H = 560

const PADDLE_W   = 80
const PADDLE_H   = 12
const PADDLE_Y   = 530
const PADDLE_SPEED = 380

const BALL_SIZE  = 10
const BALL_SPEED_BASE = 260

const BRICK_W    = 44
const BRICK_H    = 16
const BRICK_COLS = 9
const BRICK_ROWS = 5
const BRICK_GAP  = 4
const BRICK_START_Y = 70

const TOTAL_BRICK_W = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP
const BRICK_OFFSET_X = (W - TOTAL_BRICK_W) / 2 + BRICK_W / 2

const MAX_LIVES  = 3
const POWERUP_CHANCE = 0.3

const ROW_COLORS = ['#ef5350', '#ff7043', '#ffa726', '#ffee58', '#66bb6a']
const ROW_SCORES = [5, 4, 3, 2, 1]

// ─── Types ────────────────────────────────────────────────────────────────────
type GamePhase = 'idle' | 'playing' | 'gameover' | 'win'
type PowerUpType = 'wide' | 'multi' | 'laser'

interface BrickData {
  id: number
  x: number
  y: number
  color: string
  score: number
  alive: boolean
  powerup: PowerUpType | null
}

interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
}

interface PowerUp {
  id: number
  x: number
  y: number
  vy: number
  type: PowerUpType
}

interface Laser {
  id: number
  x: number
  y: number
}

// ─── Build bricks ─────────────────────────────────────────────────────────────
let brickIdCounter = 0
let ballIdCounter  = 0
let puIdCounter    = 0
let laserIdCounter = 0

function buildBricks(): BrickData[] {
  const bricks: BrickData[] = []
  const powerupTypes: PowerUpType[] = ['wide', 'multi', 'laser']
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      const hasPU = Math.random() < POWERUP_CHANCE
      bricks.push({
        id: ++brickIdCounter,
        x: BRICK_OFFSET_X + col * (BRICK_W + BRICK_GAP),
        y: BRICK_START_Y + row * (BRICK_H + BRICK_GAP),
        color: ROW_COLORS[row],
        score: ROW_SCORES[row],
        alive: true,
        powerup: hasPU ? powerupTypes[Math.floor(Math.random() * 3)] : null,
      })
    }
  }
  return bricks
}

function makeBall(x: number, y: number, level: number): Ball {
  const speed = BALL_SPEED_BASE + (level - 1) * 30
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8
  return {
    id: ++ballIdCounter,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [phase,     setPhase]     = useState<GamePhase>('idle')
  const [score,     setScore]     = useState(0)
  const [lives,     setLives]     = useState(MAX_LIVES)
  const [level,     setLevel]     = useState(1)
  const [, render]                = useReducer(n => n + 1, 0)

  // ── Mutable game state ─────────────────────────────────────────────────────
  const paddleXRef   = useRef(W / 2)
  const paddleWRef   = useRef(PADDLE_W)
  const bricksRef    = useRef<BrickData[]>([])
  const ballsRef     = useRef<Ball[]>([])
  const powerupsRef  = useRef<PowerUp[]>([])
  const lasersRef    = useRef<Laser[]>([])
  const scoreRef     = useRef(0)
  const livesRef     = useRef(MAX_LIVES)
  const levelRef     = useRef(1)
  const phaseRef     = useRef<GamePhase>('idle')
  const laserActive  = useRef(false)
  const laserTimerRef = useRef(0)
  const keysRef      = useRef<Record<string, boolean>>({})
  const mouseXRef    = useRef<number | null>(null)
  const rafRef       = useRef(0)
  const lastTimeRef  = useRef(0)
  const gameContainerRef = useRef<HTMLDivElement>(null)

  function initLevel(lv: number) {
    brickIdCounter = 0
    ballIdCounter  = 0
    puIdCounter    = 0
    laserIdCounter = 0
    bricksRef.current   = buildBricks()
    ballsRef.current    = [makeBall(W / 2, PADDLE_Y - 30, lv)]
    powerupsRef.current = []
    lasersRef.current   = []
    paddleXRef.current  = W / 2
    paddleWRef.current  = PADDLE_W
    laserActive.current = false
    laserTimerRef.current = 0
    levelRef.current    = lv
    setLevel(lv)
  }

  function startGame() {
    scoreRef.current = 0
    livesRef.current = MAX_LIVES
    setScore(0)
    setLives(MAX_LIVES)
    phaseRef.current = 'playing'
    setPhase('playing')
    initLevel(1)
    setGameKey(k => k + 1)
  }

  // ── Keyboard + mouse ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === 'keydown'
      if (e.type === 'keydown') {
        if ((e.code === 'Space' || e.code === 'Enter') &&
            (phaseRef.current === 'idle' || phaseRef.current === 'gameover' || phaseRef.current === 'win')) {
          startGame()
        }
        // Fire lasers
        if (e.code === 'Space' && phaseRef.current === 'playing' && laserActive.current) {
          const px = paddleXRef.current
          lasersRef.current.push(
            { id: ++laserIdCounter, x: px - paddleWRef.current / 2 + 4, y: PADDLE_Y - 10 },
            { id: ++laserIdCounter, x: px + paddleWRef.current / 2 - 4, y: PADDLE_Y - 10 }
          )
        }
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = gameContainerRef.current
    if (!el) return
    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      mouseXRef.current = e.clientX - rect.left
    }
    const onMouseLeave = () => { mouseXRef.current = null }
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)
    return () => {
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return

    lastTimeRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (phaseRef.current !== 'playing') return

      const keys   = keysRef.current
      const halfPW = paddleWRef.current / 2

      // ── Move paddle ──────────────────────────────────────────────────────
      if (mouseXRef.current !== null) {
        paddleXRef.current = Math.max(halfPW, Math.min(W - halfPW, mouseXRef.current))
      } else {
        if (keys['ArrowLeft']  || keys['KeyA']) paddleXRef.current -= PADDLE_SPEED * dt
        if (keys['ArrowRight'] || keys['KeyD']) paddleXRef.current += PADDLE_SPEED * dt
        paddleXRef.current = Math.max(halfPW, Math.min(W - halfPW, paddleXRef.current))
      }

      // ── Laser timer ──────────────────────────────────────────────────────
      if (laserTimerRef.current > 0) {
        laserTimerRef.current -= dt
        if (laserTimerRef.current <= 0) laserActive.current = false
      }

      // ── Move balls ───────────────────────────────────────────────────────
      const aliveBalls: Ball[] = []
      for (const ball of ballsRef.current) {
        ball.x += ball.vx * dt
        ball.y += ball.vy * dt
        const r = BALL_SIZE / 2

        // Wall bounces
        if (ball.x - r < 0)   { ball.x = r;     ball.vx =  Math.abs(ball.vx) }
        if (ball.x + r > W)   { ball.x = W - r; ball.vx = -Math.abs(ball.vx) }
        if (ball.y - r < 0)   { ball.y = r;     ball.vy =  Math.abs(ball.vy) }

        // Paddle collision
        const px  = paddleXRef.current
        const pW  = paddleWRef.current
        const pL  = px - pW / 2
        const pR  = px + pW / 2
        const pT  = PADDLE_Y - PADDLE_H / 2
        const pB  = PADDLE_Y + PADDLE_H / 2
        if (ball.vy > 0 &&
            ball.x + r > pL && ball.x - r < pR &&
            ball.y + r > pT && ball.y - r < pB) {
          ball.y = pT - r
          const rel = (ball.x - px) / (pW / 2)
          const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
          const clamped = Math.max(-0.9, Math.min(0.9, rel))
          ball.vx = clamped * spd * 1.1
          ball.vy = -Math.sqrt(Math.max(0, spd * spd - ball.vx * ball.vx))
        }

        // Brick collision
        let hitBrick = false
        for (const brick of bricksRef.current) {
          if (!brick.alive) continue
          const bL = brick.x - BRICK_W / 2
          const bR = brick.x + BRICK_W / 2
          const bT = brick.y - BRICK_H / 2
          const bB = brick.y + BRICK_H / 2
          const oX = ball.x + r > bL && ball.x - r < bR
          const oY = ball.y + r > bT && ball.y - r < bB
          if (!oX || !oY) continue

          // Resolve penetration
          const penL = (ball.x + r) - bL
          const penR = bR - (ball.x - r)
          const penT = (ball.y + r) - bT
          const penB = bB - (ball.y - r)
          const minX = Math.min(penL, penR)
          const minY = Math.min(penT, penB)
          if (minX < minY) {
            ball.vx = penL < penR ? -Math.abs(ball.vx) : Math.abs(ball.vx)
          } else {
            ball.vy = penT < penB ? -Math.abs(ball.vy) : Math.abs(ball.vy)
          }

          brick.alive = false
          scoreRef.current += brick.score
          setScore(scoreRef.current)

          // Drop powerup
          if (brick.powerup) {
            powerupsRef.current.push({
              id: ++puIdCounter,
              x: brick.x,
              y: brick.y,
              vy: 90,
              type: brick.powerup,
            })
          }
          hitBrick = true
          break
        }
        void hitBrick

        // Ball lost
        if (ball.y - r > H + 20) continue

        aliveBalls.push(ball)
      }
      ballsRef.current = aliveBalls

      // Lost all balls
      if (ballsRef.current.length === 0) {
        livesRef.current--
        setLives(livesRef.current)
        if (livesRef.current <= 0) {
          phaseRef.current = 'gameover'
          setPhase('gameover')
          render()
          return
        }
        // Respawn single ball
        ballsRef.current = [makeBall(W / 2, PADDLE_Y - 30, levelRef.current)]
      }

      // ── Move lasers ──────────────────────────────────────────────────────
      const aliveLasers: Laser[] = []
      for (const laser of lasersRef.current) {
        laser.y -= 400 * dt
        if (laser.y < -10) continue
        // Laser hits brick
        let hit = false
        for (const brick of bricksRef.current) {
          if (!brick.alive) continue
          if (Math.abs(laser.x - brick.x) < BRICK_W / 2 &&
              Math.abs(laser.y - brick.y) < BRICK_H / 2) {
            brick.alive = false
            scoreRef.current += brick.score
            setScore(scoreRef.current)
            if (brick.powerup) {
              powerupsRef.current.push({ id: ++puIdCounter, x: brick.x, y: brick.y, vy: 90, type: brick.powerup })
            }
            hit = true
            break
          }
        }
        if (!hit) aliveLasers.push(laser)
      }
      lasersRef.current = aliveLasers

      // ── Move power-ups ────────────────────────────────────────────────────
      const alivePUs: PowerUp[] = []
      for (const pu of powerupsRef.current) {
        pu.y += pu.vy * dt
        if (pu.y > H + 20) continue
        // Collect
        const px2 = paddleXRef.current
        const pW2 = paddleWRef.current
        if (Math.abs(pu.x - px2) < pW2 / 2 + 8 &&
            Math.abs(pu.y - PADDLE_Y) < PADDLE_H / 2 + 12) {
          applyPowerup(pu.type)
          continue
        }
        alivePUs.push(pu)
      }
      powerupsRef.current = alivePUs

      // ── Check level clear ─────────────────────────────────────────────────
      if (bricksRef.current.every(b => !b.alive)) {
        const nextLevel = levelRef.current + 1
        if (nextLevel > 3) {
          phaseRef.current = 'win'
          setPhase('win')
        } else {
          initLevel(nextLevel)
        }
        render()
        return
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPowerup(type: PowerUpType) {
    if (type === 'wide') {
      paddleWRef.current = Math.min(PADDLE_W * 1.8, paddleWRef.current + 30)
    } else if (type === 'multi') {
      const existing = ballsRef.current[0]
      if (existing) {
        ballsRef.current.push(
          { ...existing, id: ++ballIdCounter, vx: existing.vx * 0.8, vy: -Math.abs(existing.vy) },
          { ...existing, id: ++ballIdCounter, vx: -existing.vx * 0.8, vy: -Math.abs(existing.vy) }
        )
      }
    } else if (type === 'laser') {
      laserActive.current = true
      laserTimerRef.current = 12
    }
  }

  const bricks     = bricksRef.current.filter(b => b.alive)
  const balls      = ballsRef.current
  const powerups   = powerupsRef.current
  const lasers     = lasersRef.current
  const paddleX    = paddleXRef.current
  const paddleW    = paddleWRef.current
  const aliveBricks = bricksRef.current.filter(b => b.alive).length

  const puColors: Record<PowerUpType, string> = {
    wide: '#4fc3f7',
    multi: '#ff7043',
    laser: '#ff4081',
  }
  const puLabels: Record<PowerUpType, string> = {
    wide: 'W',
    multi: 'M',
    laser: 'L',
  }

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
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#2a3040', fontSize: 16 }}>&#9829;</span>
          ))}
          {laserActive.current && (
            <span style={{ color: '#ff4081', fontSize: 11, marginLeft: 4 }}>LASER</span>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(5, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>
          LV {level} &nbsp;&middot;&nbsp; {aliveBricks} left
        </div>
      </div>

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
      <div ref={gameContainerRef} style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Bricks */}
            {bricks.map(b => (
              <Entity key={b.id} tags={['brick']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BRICK_W - 2} height={BRICK_H - 2} color={b.color} zIndex={5} />
              </Entity>
            ))}

            {/* Powerup indicators on bricks */}
            {bricks.filter(b => b.powerup).map(b => (
              <Entity key={`pu-hint-${b.id}`} tags={['pu-hint']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={8} height={8} color="#ffffff" zIndex={6} />
              </Entity>
            ))}

            {/* Falling power-ups */}
            {powerups.map(pu => (
              <Entity key={pu.id} tags={['powerup']}>
                <Transform x={pu.x} y={pu.y} />
                <Sprite width={22} height={14} color={puColors[pu.type]} zIndex={8} />
              </Entity>
            ))}

            {/* Powerup labels */}
            {powerups.map(pu => (
              <Entity key={`lbl-${pu.id}`} tags={['pu-label']}>
                <Transform x={pu.x} y={pu.y} />
                <Sprite width={6} height={6} color="#000000" zIndex={9} />
              </Entity>
            ))}
            {/* Powerup letter overlays using small sprites for letters */}
            {powerups.map(pu => {
              const cols = puColors[pu.type]
              void cols
              void puLabels
              return null
            })}

            {/* Lasers */}
            {lasers.map(l => (
              <Entity key={l.id} tags={['laser']}>
                <Transform x={l.x} y={l.y} />
                <Sprite width={3} height={14} color="#ff4081" zIndex={12} />
              </Entity>
            ))}

            {/* Balls */}
            {balls.map(ball => (
              <Entity key={ball.id} tags={['ball']}>
                <Transform x={ball.x} y={ball.y} />
                <Sprite width={BALL_SIZE} height={BALL_SIZE} color="#ffffff" zIndex={15} />
              </Entity>
            ))}

            {/* Paddle */}
            <Entity key={`paddle-${paddleW}`} tags={['paddle']}>
              <Transform x={paddleX} y={PADDLE_Y} />
              <Sprite
                width={paddleW}
                height={PADDLE_H}
                color={laserActive.current ? '#ff4081' : '#4fc3f7'}
                zIndex={10}
              />
            </Entity>

          </World>
        </Game>

        {/* ── Idle overlay ──────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>ARKANOID</p>
              <p style={{ fontSize: 12, color: '#546e7a', margin: '16px 0 4px' }}>
                Catch power-ups: <span style={{ color: '#4fc3f7' }}>W</span>ide &nbsp;
                <span style={{ color: '#ff7043' }}>M</span>ulti-ball &nbsp;
                <span style={{ color: '#ff4081' }}>L</span>aser
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 12 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ─────────────────────────────────────────── */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>OUT OF LIVES</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}

        {/* ── Win overlay ───────────────────────────────────────────────── */}
        {phase === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>ALL LEVELS CLEAR</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Final Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ────────────────────────────────────────────────────── */}
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
        <span>Mouse / Arrow Keys — move paddle &nbsp;&middot;&nbsp; SPACE — fire lasers (when active)</span>
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
