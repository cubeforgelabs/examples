import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 480
const H = 600

const ENEMY_ROWS = 4
const ENEMY_COLS = 10
const TOTAL_ENEMIES = ENEMY_ROWS * ENEMY_COLS

// Formation positions
const FORM_START_X = 44
const FORM_GAP_X = 42
const FORM_START_Y = 60
const FORM_GAP_Y = 36

const ENEMY_W = 26
const ENEMY_H = 22

const PLAYER_W = 32
const PLAYER_H = 20
const PLAYER_SPEED = 4
const PLAYER_Y = H - 50

const BULLET_W = 4
const BULLET_H = 14
const PLAYER_BULLET_SPEED = 9
const ENEMY_BULLET_SPEED = 4

// Phases
const PHASE_ENTER = 'enter'
const PHASE_FORM = 'formation'
const PHASE_DIVE = 'dive'

type GameState = 'idle' | 'playing' | 'gameover' | 'win'
type EnemyPhase = typeof PHASE_ENTER | typeof PHASE_FORM | typeof PHASE_DIVE

interface Enemy {
  id: number
  row: number
  col: number
  alive: boolean
  phase: EnemyPhase
  // Current position
  x: number
  y: number
  // Formation target
  formX: number
  formY: number
  // Entry path
  enterT: number    // 0..1 progress along entry path
  enterDelay: number
  // Dive
  diveT: number
  diveStartX: number
  diveStartY: number
  diveAngle: number  // direction of dive curve
  diveSpeed: number
  // Formation oscillation
  oscOffset: number
}

interface Bullet {
  id: number
  x: number
  y: number
  fromPlayer: boolean
}

interface Explosion {
  id: number
  x: number
  y: number
  ttl: number
  big: boolean
}

interface GameData {
  enemies: Enemy[]
  playerX: number
  playerBullet: Bullet | null
  enemyBullets: Bullet[]
  explosions: Explosion[]
  bulletIdCtr: number
  tick: number
  formOsc: number       // global formation oscillation tick
  nextDiver: number     // tick when next enemy dives
  diveInterval: number  // ticks between dives
  enemyShootTimer: number
}

function formationX(col: number) { return FORM_START_X + col * FORM_GAP_X }
function formationY(row: number) { return FORM_START_Y + row * FORM_GAP_Y }

function enemyColor(row: number): string {
  if (row === 0) return '#ff6d00'   // boss row: orange
  if (row === 1) return '#e040fb'   // purple
  if (row === 2) return '#40c4ff'   // cyan
  return '#b2ff59'                   // lime
}

function isBoss(row: number) { return row === 0 }

function makeEnemies(): Enemy[] {
  const enemies: Enemy[] = []
  let id = 0
  for (let r = 0; r < ENEMY_ROWS; r++) {
    for (let c = 0; c < ENEMY_COLS; c++) {
      const fx = formationX(c)
      const fy = formationY(r)
      // Entry: come from left or right edge in a sweeping arc
      const fromRight = (r * ENEMY_COLS + c) % 2 === 0
      enemies.push({
        id: id++,
        row: r,
        col: c,
        alive: true,
        phase: PHASE_ENTER,
        x: fromRight ? W + 30 : -30,
        y: -20 - r * 25,
        formX: fx,
        formY: fy,
        enterT: 0,
        enterDelay: (r * ENEMY_COLS + c) * 3,  // stagger
        diveT: 0,
        diveStartX: 0,
        diveStartY: 0,
        diveAngle: fromRight ? Math.PI * 1.1 : Math.PI * 0.9,
        diveSpeed: 2.5 + Math.random() * 0.8,
        oscOffset: c * 0.15,
      })
    }
  }
  return enemies
}

function initGame(): GameData {
  return {
    enemies: makeEnemies(),
    playerX: W / 2,
    playerBullet: null,
    enemyBullets: [],
    explosions: [],
    bulletIdCtr: 5000,
    tick: 0,
    formOsc: 0,
    nextDiver: 180,
    diveInterval: 180,
    enemyShootTimer: 0,
  }
}

// Cubic bezier helper for entry path
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

function entryX(e: Enemy, t: number): number {
  const fromRight = (e.row * ENEMY_COLS + e.col) % 2 === 0
  if (fromRight) {
    return cubicBezier(t, W + 30, W * 0.8, e.formX + 80, e.formX)
  } else {
    return cubicBezier(t, -30, W * 0.2, e.formX - 80, e.formX)
  }
}

function entryY(e: Enemy, t: number): number {
  return cubicBezier(t, e.y, -60, e.formY - 60, e.formY)
}

export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<GameState>('idle')
  const gd = useRef<GameData>(initGame())
  const keysRef = useRef<Set<string>>(new Set())
  const [, tick] = useReducer(n => n + 1, 0)
  const rafRef = useRef<number>(0)
  const gameStateRef = useRef<GameState>('idle')
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const lastShotRef = useRef(false)

  gameStateRef.current = gameState

  function restart() {
    gd.current = initGame()
    scoreRef.current = 0
    livesRef.current = 3
    setScore(0)
    setLives(3)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if (e.code === 'Space') e.preventDefault()
      if ((gameStateRef.current === 'idle' || gameStateRef.current === 'gameover' || gameStateRef.current === 'win') &&
        (e.code === 'Space' || e.code === 'Enter')) {
        restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gameState !== 'playing') return

    function frame() {
      if (gameStateRef.current !== 'playing') return
      const g = gd.current
      const keys = keysRef.current
      g.tick++

      // Player movement
      if (keys.has('ArrowLeft') || keys.has('KeyA')) g.playerX = Math.max(PLAYER_W / 2, g.playerX - PLAYER_SPEED)
      if (keys.has('ArrowRight') || keys.has('KeyD')) g.playerX = Math.min(W - PLAYER_W / 2, g.playerX + PLAYER_SPEED)

      // Player shoot
      const shooting = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')
      if (shooting && !lastShotRef.current && !g.playerBullet) {
        g.playerBullet = { id: g.bulletIdCtr++, x: g.playerX, y: PLAYER_Y - PLAYER_H / 2, fromPlayer: true }
      }
      lastShotRef.current = shooting

      // Move player bullet
      if (g.playerBullet) {
        g.playerBullet.y -= PLAYER_BULLET_SPEED
        if (g.playerBullet.y < -10) g.playerBullet = null
      }

      // Move enemy bullets
      g.enemyBullets = g.enemyBullets.filter(b => b.y < H + 10)
      for (const b of g.enemyBullets) b.y += ENEMY_BULLET_SPEED

      // Update formation oscillation
      g.formOsc++

      // Update enemies
      for (const e of g.enemies) {
        if (!e.alive) continue

        if (e.phase === PHASE_ENTER) {
          if (g.tick < e.enterDelay) continue
          e.enterT += 0.008
          if (e.enterT >= 1) {
            e.enterT = 1
            e.x = e.formX
            e.y = e.formY
            e.phase = PHASE_FORM
          } else {
            e.x = entryX(e, e.enterT)
            e.y = entryY(e, e.enterT)
          }
        } else if (e.phase === PHASE_FORM) {
          // Gentle horizontal oscillation in formation
          const osc = Math.sin((g.formOsc * 0.018) + e.oscOffset) * 18
          e.x = e.formX + osc
          e.y = e.formY
        } else if (e.phase === PHASE_DIVE) {
          e.diveT += e.diveSpeed / 60
          // Parabolic dive toward player area then wrap
          const t = e.diveT
          const cx = e.diveStartX + Math.sin(t * Math.PI * 1.5) * 120 * (e.diveAngle > Math.PI ? 1 : -1)
          const cy = e.diveStartY + t * (H + 60)
          e.x = cx
          e.y = cy
          // If off-screen bottom, return to formation
          if (e.y > H + 40) {
            e.phase = PHASE_FORM
            e.x = e.formX
            e.y = e.formY - 50  // re-enter from above
            e.diveT = 0
          }
        }
      }

      // Trigger dives
      const formEnemies = g.enemies.filter(e => e.alive && e.phase === PHASE_FORM)
      if (g.tick >= g.nextDiver && formEnemies.length > 0) {
        const aliveCount = g.enemies.filter(e => e.alive).length
        const diveCount = Math.min(aliveCount > 10 ? 2 : 1, formEnemies.length)
        for (let i = 0; i < diveCount; i++) {
          const diver = formEnemies[Math.floor(Math.random() * formEnemies.length)]
          diver.phase = PHASE_DIVE
          diver.diveStartX = diver.x
          diver.diveStartY = diver.y
          diver.diveT = 0
          diver.diveSpeed = 2.2 + Math.random() * 1.0
          diver.diveAngle = Math.random() > 0.5 ? Math.PI * 1.1 : Math.PI * 0.9
        }
        const aliveLeft = g.enemies.filter(e => e.alive).length
        g.diveInterval = Math.max(60, 180 - Math.floor((TOTAL_ENEMIES - aliveLeft) / 5) * 15)
        g.nextDiver = g.tick + g.diveInterval + Math.floor(Math.random() * 60)
      }

      // Enemy shooting
      g.enemyShootTimer++
      const shootInterval = Math.max(40, 120 - Math.floor((TOTAL_ENEMIES - g.enemies.filter(e => e.alive).length) / 5) * 10)
      if (g.enemyShootTimer >= shootInterval) {
        g.enemyShootTimer = 0
        // Divers shoot more
        const shooters = [...g.enemies.filter(e => e.alive && e.phase === PHASE_DIVE), ...g.enemies.filter(e => e.alive && e.phase === PHASE_FORM)]
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * Math.min(5, shooters.length))]
          g.enemyBullets.push({ id: g.bulletIdCtr++, x: shooter.x, y: shooter.y + ENEMY_H / 2, fromPlayer: false })
        }
      }

      // Player bullet vs enemies
      if (g.playerBullet) {
        for (const e of g.enemies) {
          if (!e.alive) continue
          const bx = g.playerBullet.x, by = g.playerBullet.y
          if (Math.abs(bx - e.x) < ENEMY_W / 2 + BULLET_W / 2 && Math.abs(by - e.y) < ENEMY_H / 2 + BULLET_H / 2) {
            e.alive = false
            g.playerBullet = null
            const pts = isBoss(e.row) ? 400 : 100
            scoreRef.current += pts
            setScore(scoreRef.current)
            g.explosions.push({ id: g.bulletIdCtr++, x: e.x, y: e.y, ttl: 10, big: isBoss(e.row) })
            break
          }
        }
      }

      // Enemy bullets vs player
      for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
        const b = g.enemyBullets[i]
        if (Math.abs(b.x - g.playerX) < PLAYER_W / 2 + BULLET_W / 2 && Math.abs(b.y - PLAYER_Y) < PLAYER_H / 2 + BULLET_H / 2) {
          g.enemyBullets.splice(i, 1)
          g.explosions.push({ id: g.bulletIdCtr++, x: g.playerX, y: PLAYER_Y, ttl: 14, big: true })
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
        }
      }

      // Diver collision with player
      for (const e of g.enemies) {
        if (!e.alive || e.phase !== PHASE_DIVE) continue
        if (Math.abs(e.x - g.playerX) < PLAYER_W / 2 + ENEMY_W / 2 && Math.abs(e.y - PLAYER_Y) < PLAYER_H / 2 + ENEMY_H / 2) {
          e.alive = false
          g.explosions.push({ id: g.bulletIdCtr++, x: e.x, y: e.y, ttl: 12, big: false })
          g.explosions.push({ id: g.bulletIdCtr++, x: g.playerX, y: PLAYER_Y, ttl: 14, big: true })
          livesRef.current--
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            setBestScore(b => Math.max(b, scoreRef.current))
            setGameState('gameover')
            return
          }
        }
      }

      // Tick explosions
      g.explosions = g.explosions.filter(ex => {
        ex.ttl--
        return ex.ttl > 0
      })

      // Check win
      if (g.enemies.every(e => !e.alive)) {
        setBestScore(b => Math.max(b, scoreRef.current))
        setGameState('win')
        return
      }

      tick()
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gameState, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const g = gd.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#40c4ff' : '#263238', fontSize: 16 }}>♦</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#40c4ff', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>{String(score).padStart(6, '0')}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#37474f' }}>BEST {bestScore}</div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#050510">
            <Camera2D x={W / 2} y={H / 2} background="#050510" />

            {/* Stars */}
            {Array.from({ length: 60 }, (_, i) => {
              const sx = ((i * 137 + 11) % W)
              const sy = ((i * 97 + 17) % H)
              const br = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#7986cb' : '#37474f'
              return (
                <Entity key={`star${i}`} tags={['star']}>
                  <Transform x={sx} y={sy} />
                  <Sprite width={i % 5 === 0 ? 2 : 1} height={i % 5 === 0 ? 2 : 1} color={br} zIndex={0} />
                </Entity>
              )
            })}

            {/* Enemies */}
            {g.enemies.map(e => {
              if (!e.alive) return null
              const col = enemyColor(e.row)
              const isDiving = e.phase === PHASE_DIVE
              return (
                <Entity key={e.id} tags={['enemy']}>
                  <Transform x={e.x} y={e.y} />
                  <Sprite width={isDiving ? ENEMY_W + 4 : ENEMY_W} height={isDiving ? ENEMY_H + 4 : ENEMY_H} color={isDiving ? '#ffffff' : col} zIndex={10} />
                </Entity>
              )
            })}
            {/* Enemy inner detail */}
            {g.enemies.map(e => {
              if (!e.alive || e.phase !== PHASE_FORM) return null
              return (
                <Entity key={`ed${e.id}`} tags={['enemy-inner']}>
                  <Transform x={e.x} y={e.y + 2} />
                  <Sprite width={ENEMY_W - 10} height={ENEMY_H - 10} color="#050510" zIndex={11} />
                </Entity>
              )
            })}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={g.playerX} y={PLAYER_Y} />
              <Sprite width={PLAYER_W} height={PLAYER_H} color="#e0e0e0" zIndex={15} />
            </Entity>
            {/* Player cockpit */}
            <Entity tags={['player-cockpit']}>
              <Transform x={g.playerX} y={PLAYER_Y - PLAYER_H / 2 - 5} />
              <Sprite width={8} height={10} color="#40c4ff" zIndex={16} />
            </Entity>
            {/* Player wings */}
            <Entity tags={['player-wing-l']}>
              <Transform x={g.playerX - PLAYER_W / 2 - 8} y={PLAYER_Y + 2} />
              <Sprite width={16} height={10} color="#90a4ae" zIndex={14} />
            </Entity>
            <Entity tags={['player-wing-r']}>
              <Transform x={g.playerX + PLAYER_W / 2 + 8} y={PLAYER_Y + 2} />
              <Sprite width={16} height={10} color="#90a4ae" zIndex={14} />
            </Entity>

            {/* Player engine glow */}
            <Entity tags={['engine-glow']}>
              <Transform x={g.playerX} y={PLAYER_Y + PLAYER_H / 2 + 5} />
              <Sprite width={8} height={10} color="#ff6d00" zIndex={14} />
            </Entity>

            {/* Player bullet */}
            {g.playerBullet && (
              <Entity key={g.playerBullet.id} tags={['bullet']}>
                <Transform x={g.playerBullet.x} y={g.playerBullet.y} />
                <Sprite width={BULLET_W} height={BULLET_H} color="#69f0ae" zIndex={20} />
              </Entity>
            )}
            {/* Bullet glow */}
            {g.playerBullet && (
              <Entity key={`bg${g.playerBullet.id}`} tags={['bullet-glow']}>
                <Transform x={g.playerBullet.x} y={g.playerBullet.y} />
                <Sprite width={BULLET_W + 4} height={BULLET_H + 4} color="#1b5e20" zIndex={19} />
              </Entity>
            )}

            {/* Enemy bullets */}
            {g.enemyBullets.map(b => (
              <Entity key={b.id} tags={['ebullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BULLET_W} height={BULLET_H} color="#ff6d00" zIndex={20} />
              </Entity>
            ))}

            {/* Explosions */}
            {g.explosions.map(ex => (
              <Entity key={ex.id} tags={['explosion']}>
                <Transform x={ex.x} y={ex.y} />
                <Sprite width={(ex.big ? 36 : 24) + (10 - ex.ttl) * 2} height={(ex.big ? 36 : 24) + (10 - ex.ttl) * 2} color={ex.ttl > 8 ? '#ffd740' : ex.ttl > 5 ? '#ff6d00' : '#ef5350'} zIndex={25} />
              </Entity>
            ))}

          </World>
        </Game>

        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#40c4ff', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>GALAGA</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16 }}>Destroy the alien swarm!</p>
              <p style={{ fontSize: 11, color: '#607d8b', marginTop: 8 }}>Orange bosses worth 400 pts · others 100 pts</p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 12 }}>Press <strong style={{ color: '#fff' }}>SPACE</strong> to start</p>
            </div>
          </div>
        )}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>DESTROYED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score <strong style={{ color: '#40c4ff' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>SECTOR CLEAR!</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score <strong style={{ color: '#40c4ff' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>A/D or Arrows — move &nbsp;·&nbsp; Space — fire</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,5,16,0.9)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#40c4ff', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
