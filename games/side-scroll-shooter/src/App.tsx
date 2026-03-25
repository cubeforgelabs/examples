import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 640
const H = 400
const GROUND_Y = H - 48          // ground top surface
const PLAYER_W = 22
const PLAYER_H = 28
const SCROLL_SPEED_BASE = 120    // world scroll px/s
const PLAYER_SHOOT_COOLDOWN = 0.25
const BULLET_SPEED = 540
const BULLET_W = 12
const BULLET_H = 6
const JUMP_VY = -420
const GRAVITY = 900
const MAX_HP = 5
const DT = 1 / 60

// Platforms (x, y, w) in world coords — repeat with scroll offset
const PLATFORM_DEFS = [
  { ox: 350, oy: GROUND_Y - 80, w: 90 },
  { ox: 600, oy: GROUND_Y - 110, w: 70 },
  { ox: 850, oy: GROUND_Y - 70, w: 100 },
  { ox: 1100, oy: GROUND_Y - 120, w: 80 },
  { ox: 1350, oy: GROUND_Y - 90, w: 90 },
]

type GameState = 'idle' | 'playing' | 'gameover'
type EnemyKind = 'walker' | 'flyer'

interface Bullet { x: number; y: number; id: number }
interface EnemyBullet { x: number; y: number; id: number }
interface Enemy {
  x: number; y: number; vy: number
  hp: number; id: number; kind: EnemyKind
  shootTimer: number; hurtTimer: number
}
interface BgLayer { x: number; speed: number; color: string; w: number; h: number; y: number }

function makeBgLayers(): BgLayer[] {
  return [
    { x: 0, speed: 0.2, color: '#1a1a2e', w: W, h: H - 48, y: 0 },
    { x: 0, speed: 0.4, color: '#16213e', w: W * 2, h: 60, y: H - 160 },
    { x: W, speed: 0.4, color: '#16213e', w: W * 2, h: 60, y: H - 160 },
  ]
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [hp, setHp] = useState(MAX_HP)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [distanceKm, setDistanceKm] = useState(0)

  const playerRef = useRef({ x: 100, y: GROUND_Y - PLAYER_H / 2, vy: 0, onGround: true })
  const keysRef = useRef(new Set<string>())
  const bulletsRef = useRef<Bullet[]>([])
  const enemyBulletsRef = useRef<EnemyBullet[]>([])
  const enemiesRef = useRef<Enemy[]>([])
  const nextIdRef = useRef(1)
  const shootTimerRef = useRef(0)
  const scrollXRef = useRef(0)
  const spawnTimerRef = useRef(2)
  const diffTimerRef = useRef(0)
  const diffLevelRef = useRef(1)
  const invulnRef = useRef(0)
  const hpRef = useRef(MAX_HP)
  const distRef = useRef(0)

  const [, forceRender] = useReducer(n => n + 1, 0)

  // Main loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const id = setInterval(() => {
      const player = playerRef.current
      const keys = keysRef.current
      const scrollX = scrollXRef.current
      const diff = diffLevelRef.current
      const scrollSpeed = SCROLL_SPEED_BASE + diff * 15

      // World scroll
      scrollXRef.current += scrollSpeed * DT
      distRef.current += scrollSpeed * DT
      if (Math.floor(distRef.current / 200) > distanceKm) {
        setDistanceKm(Math.floor(distRef.current / 200))
      }

      // Difficulty ramp
      diffTimerRef.current += DT
      if (diffTimerRef.current > 12) {
        diffTimerRef.current = 0
        diffLevelRef.current = Math.min(diffLevelRef.current + 1, 10)
      }

      // Jump
      if ((keys.has('ArrowUp') || keys.has('KeyW')) && player.onGround) {
        player.vy = JUMP_VY
        player.onGround = false
      }

      // Apply gravity
      player.vy += GRAVITY * DT
      player.y += player.vy * DT

      // Ground collision
      if (player.y >= GROUND_Y - PLAYER_H / 2) {
        player.y = GROUND_Y - PLAYER_H / 2
        player.vy = 0
        player.onGround = true
      }

      // Platform collisions
      for (const pd of PLATFORM_DEFS) {
        // Tile platforms every 1600px
        for (let tile = 0; tile < 4; tile++) {
          const px = pd.ox + tile * 1600 - (scrollX % 1600)
          const py = pd.oy
          const pw = pd.w
          const ph = 14
          const pleft = px - pw / 2
          const pright = px + pw / 2
          const ptop = py - ph / 2

          const pleft2 = player.x - PLAYER_W / 2
          const pright2 = player.x + PLAYER_W / 2
          const pbottom = player.y + PLAYER_H / 2

          if (pleft2 < pright && pright2 > pleft &&
            pbottom >= ptop && pbottom <= ptop + 20 &&
            player.vy >= 0) {
            player.y = ptop - PLAYER_H / 2
            player.vy = 0
            player.onGround = true
          }
        }
      }

      // Slow if Down held (player slows world scroll)
      // No actual change needed — player x is fixed at ~100

      // Player shooting
      const shooting = keys.has('KeyZ') || keys.has('Space')
      shootTimerRef.current -= DT
      if (shooting && shootTimerRef.current <= 0) {
        shootTimerRef.current = PLAYER_SHOOT_COOLDOWN
        bulletsRef.current.push({ x: player.x + PLAYER_W / 2, y: player.y, id: nextIdRef.current++ })
      }

      // Update player bullets (in screen space)
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += BULLET_SPEED * DT
        return b.x < W + 20
      })

      // Spawn enemies
      spawnTimerRef.current -= DT
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = Math.max(0.5, 2.2 - diff * 0.12)
        const isFlyer = Math.random() < 0.35 + diff * 0.03
        const ey = isFlyer
          ? GROUND_Y - 80 - Math.random() * 120
          : GROUND_Y - PLAYER_H / 2
        enemiesRef.current.push({
          x: W + 30, y: ey, vy: 0,
          hp: 1 + Math.floor(diff / 3),
          id: nextIdRef.current++,
          kind: isFlyer ? 'flyer' : 'walker',
          shootTimer: 1.5 + Math.random() * 2,
          hurtTimer: 0,
        })
      }

      // Update enemies
      const newEBullets: EnemyBullet[] = []
      enemiesRef.current.forEach(e => {
        // Move left with scroll + own speed
        e.x -= (scrollSpeed + 60 + diff * 4) * DT
        if (e.kind === 'flyer') {
          // Flyers bob up and down
          e.vy += Math.sin(Date.now() / 400 + e.id) * 2
          e.y += e.vy * DT * 0.4
          e.vy *= 0.95
        } else {
          // Walkers fall to ground
          e.vy += GRAVITY * DT
          e.y += e.vy * DT
          if (e.y >= GROUND_Y - PLAYER_H / 2) { e.y = GROUND_Y - PLAYER_H / 2; e.vy = 0 }
        }
        // Shoot at player
        if (e.hurtTimer > 0) e.hurtTimer -= DT
        e.shootTimer -= DT
        if (e.shootTimer <= 0 && e.x < W - 30 && e.x > 40) {
          e.shootTimer = 1.8 + Math.random() * 1.5 - diff * 0.08
          newEBullets.push({ x: e.x - 10, y: e.y, id: nextIdRef.current++ })
        }
      })
      enemyBulletsRef.current.push(...newEBullets)

      // Enemy bullets
      enemyBulletsRef.current = enemyBulletsRef.current.filter(b => {
        b.x -= (BULLET_SPEED * 0.55) * DT
        return b.x > -20
      })

      // Bullet vs enemy
      const bulletsToRemove = new Set<number>()
      const enemiesToRemove = new Set<number>()
      bulletsRef.current.forEach(b => {
        enemiesRef.current.forEach(e => {
          const ew = e.kind === 'flyer' ? 24 : 22
          const eh = e.kind === 'flyer' ? 18 : 24
          if (Math.abs(b.x - e.x) < (BULLET_W + ew) / 2 &&
            Math.abs(b.y - e.y) < (BULLET_H + eh) / 2) {
            bulletsToRemove.add(b.id)
            e.hp--
            e.hurtTimer = 0.12
            if (e.hp <= 0) {
              enemiesToRemove.add(e.id)
              setScore(s => s + (e.kind === 'flyer' ? 150 : 100) * diffLevelRef.current)
            }
          }
        })
      })
      bulletsRef.current = bulletsRef.current.filter(b => !bulletsToRemove.has(b.id))
      enemiesRef.current = enemiesRef.current.filter(e => !enemiesToRemove.has(e.id))

      // Remove enemies off screen
      enemiesRef.current = enemiesRef.current.filter(e => e.x > -40)

      // Enemy bullet vs player
      if (invulnRef.current <= 0) {
        const hitByBullet = enemyBulletsRef.current.some(b =>
          Math.abs(b.x - player.x) < (8 + PLAYER_W) / 2 &&
          Math.abs(b.y - player.y) < (8 + PLAYER_H) / 2
        )
        // Direct enemy contact
        const hitByEnemy = enemiesRef.current.some(e => {
          const ew = e.kind === 'flyer' ? 24 : 22
          const eh = e.kind === 'flyer' ? 18 : 24
          return Math.abs(e.x - player.x) < (PLAYER_W + ew) / 2 &&
            Math.abs(e.y - player.y) < (PLAYER_H + eh) / 2
        })

        if (hitByBullet || hitByEnemy) {
          invulnRef.current = 1.2
          hpRef.current = Math.max(0, hpRef.current - 1)
          setHp(hpRef.current)
          if (hpRef.current <= 0) setGameState('gameover')
          if (hitByBullet) enemyBulletsRef.current = []
        }
      }
      if (invulnRef.current > 0) invulnRef.current -= DT

      forceRender()
    }, DT * 1000)

    return () => clearInterval(id)
  }, [gameState])

  // Key handlers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault()
        restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [gameState])

  function restart() {
    playerRef.current = { x: 100, y: GROUND_Y - PLAYER_H / 2, vy: 0, onGround: true }
    bulletsRef.current = []
    enemyBulletsRef.current = []
    enemiesRef.current = []
    keysRef.current.clear()
    nextIdRef.current = 1
    shootTimerRef.current = 0
    scrollXRef.current = 0
    spawnTimerRef.current = 2
    diffTimerRef.current = 0
    diffLevelRef.current = 1
    invulnRef.current = 0
    hpRef.current = MAX_HP
    distRef.current = 0
    setScore(0)
    setHp(MAX_HP)
    setDistanceKm(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const player = playerRef.current
  const bullets = bulletsRef.current
  const ebullets = enemyBulletsRef.current
  const enemies = enemiesRef.current
  const scrollX = scrollXRef.current
  const isFlashing = invulnRef.current > 0 && Math.floor(invulnRef.current * 10) % 2 === 0

  // Build visible platforms
  const visiblePlatforms: { x: number; y: number; w: number; id: string }[] = []
  PLATFORM_DEFS.forEach((pd, pi) => {
    for (let tile = 0; tile < 4; tile++) {
      const px = pd.ox + tile * 1600 - (scrollX % 1600)
      if (px > -pd.w && px < W + pd.w) {
        visiblePlatforms.push({ x: px, y: pd.oy, w: pd.w, id: `plat_${pi}_${tile}` })
      }
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 12, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        {/* HP bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#607d8b' }}>HP</span>
          <div style={{ width: 80, height: 8, background: '#1e2535', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${(hp / MAX_HP) * 100}%`, height: '100%',
              background: hp > 2 ? '#69f0ae' : hp > 1 ? '#ffab40' : '#ef5350',
              transition: 'width 0.1s',
            }} />
          </div>
        </div>
        {/* Score */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        {/* Distance */}
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>
          <span style={{ color: '#4fc3f7' }}>{distanceKm}</span>m
        </div>
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d0d1f">
            <Camera2D x={W / 2} y={H / 2} background="#0d0d1f" />

            {/* Sky BG */}
            <Entity tags={['bg']}>
              <Transform x={W / 2} y={H / 2 - 24} />
              <Sprite width={W} height={H - 48} color="#0d0d1f" zIndex={0} />
            </Entity>

            {/* Distant buildings (parallax) */}
            {[0, 1, 2, 3, 4, 5].map(i => {
              const bx = ((i * 120 - scrollX * 0.25) % (W + 60) + W + 60) % (W + 60) - 30
              const bh = 40 + (i % 3) * 30
              return (
                <Entity key={`bld${i}`} tags={['bg']}>
                  <Transform x={bx} y={GROUND_Y - bh / 2 - 2} />
                  <Sprite width={50} height={bh} color="#1a1a3a" zIndex={1} />
                </Entity>
              )
            })}

            {/* Ground */}
            <Entity tags={['ground']}>
              <Transform x={W / 2} y={GROUND_Y + 12} />
              <Sprite width={W} height={24} color="#1b2838" zIndex={2} />
            </Entity>
            <Entity tags={['ground-line']}>
              <Transform x={W / 2} y={GROUND_Y} />
              <Sprite width={W} height={4} color="#2e3d56" zIndex={3} />
            </Entity>

            {/* Platforms */}
            {visiblePlatforms.map(p => (
              <Entity key={p.id} tags={['platform']}>
                <Transform x={p.x} y={p.y} />
                <Sprite width={p.w} height={14} color="#2e5266" zIndex={3} />
              </Entity>
            ))}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={player.x} y={player.y} />
              <Sprite width={PLAYER_W} height={PLAYER_H}
                color={isFlashing ? '#0d0d1f' : '#4fc3f7'}
                zIndex={10} />
            </Entity>

            {/* Player bullets */}
            {bullets.map(b => (
              <Entity key={`pb${b.id}`} tags={['bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BULLET_W} height={BULLET_H} color="#ffd740" zIndex={8} />
              </Entity>
            ))}

            {/* Enemy bullets */}
            {ebullets.map(b => (
              <Entity key={`eb${b.id}`} tags={['ebullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={8} height={6} color="#ff1744" zIndex={7} />
              </Entity>
            ))}

            {/* Enemies */}
            {enemies.map(e => {
              const ew = e.kind === 'flyer' ? 24 : 22
              const eh = e.kind === 'flyer' ? 18 : 24
              const color = e.hurtTimer > 0 ? '#ffffff' : e.kind === 'flyer' ? '#ce93d8' : '#ef9a9a'
              return (
                <Entity key={`e${e.id}`} tags={['enemy']}>
                  <Transform x={e.x} y={e.y} />
                  <Sprite width={ew} height={eh} color={color} zIndex={6} />
                </Entity>
              )
            })}
          </World>
        </Game>

        {/* Idle */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>SIDE-SCROLL</p>
              <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>SHOOTER</p>
              <div style={{ marginTop: 16, fontSize: 12, color: '#78909c', lineHeight: 1.7 }}>
                <div><span style={{ color: '#ce93d8' }}>&#9632;</span> Flyers &nbsp;·&nbsp; <span style={{ color: '#ef9a9a' }}>&#9632;</span> Walkers</div>
                <div>Up — jump &nbsp;·&nbsp; Z / Space — shoot</div>
              </div>
              <button onClick={restart} style={btnStyle}>PLAY</button>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>WIPED OUT</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Distance: {distanceKm}m</p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Up — jump &nbsp;·&nbsp; Z / Space — shoot</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
