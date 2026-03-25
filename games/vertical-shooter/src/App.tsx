import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 420
const H = 600
const PLAYER_W = 24
const PLAYER_H = 28
const PLAYER_SPEED = 200
const BULLET_SPEED = 420
const BULLET_W = 5
const BULLET_H = 10
const ENEMY_W = 26
const ENEMY_H = 22
const ENEMY_BULLET_SPEED = 200
const ENEMY_BULLET_W = 5
const ENEMY_BULLET_H = 8
const POWERUP_SIZE = 18
const DT = 1 / 60
const SHOOT_COOLDOWN = 0.18
const STAR_COUNT = 60
const MAX_LIVES = 3

type GameState = 'idle' | 'playing' | 'gameover'
type PowerupType = 'spread' | 'shield' | 'speed'
type Formation = 'line' | 'v-shape' | 'diamond'

interface Star { x: number; y: number; speed: number; size: number; layer: number; id: number }
interface Bullet { x: number; y: number; id: number; spread?: boolean }
interface EnemyBullet { x: number; y: number; vx: number; vy: number; id: number }
interface Enemy { x: number; y: number; hp: number; id: number; shootTimer: number; row: number; col: number }
interface Wave { enemies: Enemy[]; spawnY: number; formation: Formation }
interface Powerup { x: number; y: number; type: PowerupType; id: number }

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 30 + Math.random() * 80,
    size: Math.random() < 0.3 ? 2 : 1,
    layer: Math.floor(Math.random() * 3),
  }))
}

const STAR_COLORS = ['#ffffff', '#aaccff', '#667799']

function buildFormation(formation: Formation, wave: number): { row: number; col: number }[] {
  const cols = 5 + Math.min(wave - 1, 3)
  const positions: { row: number; col: number }[] = []
  if (formation === 'line') {
    for (let c = 0; c < cols; c++) positions.push({ row: 0, col: c })
  } else if (formation === 'v-shape') {
    const half = Math.floor(cols / 2)
    for (let i = 0; i <= half; i++) {
      positions.push({ row: i, col: half - i })
      if (i > 0) positions.push({ row: i, col: half + i })
    }
  } else {
    // diamond
    const r = 2
    for (let row = 0; row <= r * 2; row++) {
      const spread = r - Math.abs(row - r)
      for (let c = -spread; c <= spread; c++) {
        positions.push({ row, col: c + r })
      }
    }
  }
  return positions
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [waveNum, setWaveNum] = useState(1)
  const [gameState, setGameState] = useState<GameState>('idle')

  const playerRef = useRef({ x: W / 2, y: H - 60 })
  const keysRef = useRef(new Set<string>())
  const bulletsRef = useRef<Bullet[]>([])
  const enemyBulletsRef = useRef<EnemyBullet[]>([])
  const enemiesRef = useRef<Enemy[]>([])
  const powerupsRef = useRef<Powerup[]>([])
  const starsRef = useRef<Star[]>(makeStars())
  const nextIdRef = useRef(1)
  const shootTimerRef = useRef(0)
  const invulnRef = useRef(0)
  const waveNumRef = useRef(1)
  const spreadRef = useRef(false)
  const spreadTimerRef = useRef(0)
  const shieldRef = useRef(false)
  const shieldTimerRef = useRef(0)
  const speedBoostRef = useRef(false)
  const speedTimerRef = useRef(0)
  const waveActiveRef = useRef(false)
  const waveScrollYRef = useRef(-100)
  const waveFormationRef = useRef<{ row: number; col: number }[]>([])

  const [, forceRender] = useReducer(n => n + 1, 0)

  function spawnWave(num: number) {
    const formations: Formation[] = ['line', 'v-shape', 'diamond']
    const formation = formations[(num - 1) % formations.length]
    const positions = buildFormation(formation, num)
    const startY = -80
    const enemies: Enemy[] = positions.map(pos => ({
      x: W / 2 + (pos.col - Math.max(...positions.map(p => p.col)) / 2) * 44,
      y: startY - pos.row * 36,
      hp: 1 + Math.floor(num / 3),
      id: nextIdRef.current++,
      shootTimer: 2 + Math.random() * 3,
      row: pos.row,
      col: pos.col,
    }))
    enemiesRef.current = enemies
    waveFormationRef.current = positions
    waveScrollYRef.current = 0
    waveActiveRef.current = true
  }

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    // Spawn first wave
    spawnWave(1)
    waveNumRef.current = 1

    const id = setInterval(() => {
      const player = playerRef.current
      const keys = keysRef.current

      // Stars parallax
      starsRef.current.forEach(s => {
        s.y += s.speed * DT
        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W }
      })

      // Player movement
      let dx = 0, dy = 0
      const spd = speedBoostRef.current ? PLAYER_SPEED * 1.6 : PLAYER_SPEED
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dx = -1
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx = 1
      if (keys.has('ArrowUp') || keys.has('KeyW')) dy = -1
      if (keys.has('ArrowDown') || keys.has('KeyS')) dy = 1
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      player.x = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, player.x + (dx / len) * spd * DT))
      player.y = Math.max(PLAYER_H / 2, Math.min(H - PLAYER_H / 2, player.y + (dy / len) * spd * DT))

      // Player shooting
      shootTimerRef.current -= DT
      if (shootTimerRef.current <= 0) {
        shootTimerRef.current = SHOOT_COOLDOWN
        const id0 = nextIdRef.current++
        bulletsRef.current.push({ x: player.x, y: player.y - PLAYER_H / 2, id: id0 })
        if (spreadRef.current) {
          bulletsRef.current.push({ x: player.x, y: player.y - PLAYER_H / 2, id: nextIdRef.current++, spread: true })
          bulletsRef.current.push({ x: player.x, y: player.y - PLAYER_H / 2, id: nextIdRef.current++, spread: false })
        }
      }

      // Update player bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.y -= BULLET_SPEED * DT
        return b.y > -20
      })

      // Powerup timers
      if (spreadTimerRef.current > 0) { spreadTimerRef.current -= DT; if (spreadTimerRef.current <= 0) spreadRef.current = false }
      if (shieldTimerRef.current > 0) { shieldTimerRef.current -= DT; if (shieldTimerRef.current <= 0) shieldRef.current = false }
      if (speedTimerRef.current > 0) { speedTimerRef.current -= DT; if (speedTimerRef.current <= 0) speedBoostRef.current = false }

      // Wave scrolling
      if (waveActiveRef.current) {
        waveScrollYRef.current += 55 * DT
        const scrollY = waveScrollYRef.current
        enemiesRef.current.forEach(e => {
          e.y = -80 - e.row * 36 + scrollY
        })
        // Lock once fully on screen
        const allVisible = enemiesRef.current.every(e => e.y > 0)
        if (allVisible) waveActiveRef.current = false
      }

      // Enemy shooting
      const newEBullets: EnemyBullet[] = []
      enemiesRef.current.forEach(e => {
        e.shootTimer -= DT
        if (e.shootTimer <= 0) {
          e.shootTimer = 2.5 + Math.random() * 2 - waveNumRef.current * 0.1
          const adx = player.x - e.x
          const ady = player.y - e.y
          const alen = Math.sqrt(adx * adx + ady * ady) || 1
          newEBullets.push({
            x: e.x, y: e.y + ENEMY_H / 2,
            vx: (adx / alen) * ENEMY_BULLET_SPEED,
            vy: (ady / alen) * ENEMY_BULLET_SPEED,
            id: nextIdRef.current++,
          })
        }
      })
      enemyBulletsRef.current.push(...newEBullets)

      // Update enemy bullets
      enemyBulletsRef.current = enemyBulletsRef.current.filter(b => {
        b.x += b.vx * DT
        b.y += b.vy * DT
        return b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10
      })

      // Powerup movement
      powerupsRef.current = powerupsRef.current.filter(p => {
        p.y += 60 * DT
        return p.y < H + 20
      })

      // Bullet vs enemy collision
      const bulletsToRemove = new Set<number>()
      const enemiesToRemove = new Set<number>()
      const bullets = bulletsRef.current
      const enemies = enemiesRef.current

      enemies.forEach(e => {
        bullets.forEach(b => {
          const spreadOffX = b.spread === true ? -14 : b.spread === false ? 14 : 0
          const bx = b.x + spreadOffX
          if (Math.abs(bx - e.x) < (BULLET_W + ENEMY_W) / 2 && Math.abs(b.y - e.y) < (BULLET_H + ENEMY_H) / 2) {
            bulletsToRemove.add(b.id)
            e.hp--
            if (e.hp <= 0) {
              enemiesToRemove.add(e.id)
              setScore(s => s + 100 * waveNumRef.current)
              // 15% chance powerup
              if (Math.random() < 0.15) {
                const types: PowerupType[] = ['spread', 'shield', 'speed']
                powerupsRef.current.push({
                  x: e.x, y: e.y, id: nextIdRef.current++,
                  type: types[Math.floor(Math.random() * types.length)],
                })
              }
            }
          }
        })
      })

      bulletsRef.current = bullets.filter(b => !bulletsToRemove.has(b.id))
      enemiesRef.current = enemies.filter(e => !enemiesToRemove.has(e.id))

      // Enemy bullet vs player
      if (invulnRef.current <= 0) {
        const hit = enemyBulletsRef.current.some(b =>
          Math.abs(b.x - player.x) < (ENEMY_BULLET_W + PLAYER_W) / 2 &&
          Math.abs(b.y - player.y) < (ENEMY_BULLET_H + PLAYER_H) / 2
        )
        if (hit) {
          if (shieldRef.current) {
            shieldRef.current = false
            shieldTimerRef.current = 0
          } else {
            invulnRef.current = 1.5
            setLives(l => {
              const nl = l - 1
              if (nl <= 0) setGameState('gameover')
              return Math.max(0, nl)
            })
          }
          // Remove all enemy bullets on hit
          enemyBulletsRef.current = []
        }
      }
      if (invulnRef.current > 0) invulnRef.current -= DT

      // Powerup vs player
      const powerupsToRemove = new Set<number>()
      powerupsRef.current.forEach(p => {
        if (Math.abs(p.x - player.x) < (POWERUP_SIZE + PLAYER_W) / 2 &&
          Math.abs(p.y - player.y) < (POWERUP_SIZE + PLAYER_H) / 2) {
          powerupsToRemove.add(p.id)
          if (p.type === 'spread') { spreadRef.current = true; spreadTimerRef.current = 8 }
          if (p.type === 'shield') { shieldRef.current = true; shieldTimerRef.current = 10 }
          if (p.type === 'speed') { speedBoostRef.current = true; speedTimerRef.current = 7 }
        }
      })
      powerupsRef.current = powerupsRef.current.filter(p => !powerupsToRemove.has(p.id))

      // Wave cleared
      if (enemiesRef.current.length === 0 && !waveActiveRef.current) {
        const next = waveNumRef.current + 1
        waveNumRef.current = next
        setWaveNum(next)
        enemyBulletsRef.current = []
        setTimeout(() => spawnWave(next), 1200)
      }

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
    playerRef.current = { x: W / 2, y: H - 60 }
    bulletsRef.current = []
    enemyBulletsRef.current = []
    enemiesRef.current = []
    powerupsRef.current = []
    starsRef.current = makeStars()
    keysRef.current.clear()
    shootTimerRef.current = 0
    invulnRef.current = 0
    waveNumRef.current = 1
    spreadRef.current = false
    spreadTimerRef.current = 0
    shieldRef.current = false
    shieldTimerRef.current = 0
    speedBoostRef.current = false
    speedTimerRef.current = 0
    waveActiveRef.current = false
    setScore(0)
    setLives(MAX_LIVES)
    setWaveNum(1)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  const player = playerRef.current
  const bullets = bulletsRef.current
  const enemyBullets = enemyBulletsRef.current
  const enemies = enemiesRef.current
  const powerups = powerupsRef.current
  const stars = starsRef.current
  const isFlashing = invulnRef.current > 0 && Math.floor(invulnRef.current * 10) % 2 === 0

  const POWERUP_COLORS: Record<PowerupType, string> = {
    spread: '#69f0ae',
    shield: '#40c4ff',
    speed: '#ffab40',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 16px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 12, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#37474f', fontSize: 17 }}>&#9829;</span>
          ))}
          {shieldRef.current && <span style={{ color: '#40c4ff', fontSize: 14, marginLeft: 4 }}>&#128737;</span>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', color: '#607d8b', fontSize: 11 }}>
          WAVE <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{waveNum}</span>
        </div>
      </div>

      {/* Game canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#02040e">
            <Camera2D x={W / 2} y={H / 2} background="#02040e" />

            {/* Stars */}
            {stars.map(s => (
              <Entity key={`star${s.id}`} tags={['star']}>
                <Transform x={s.x} y={s.y} />
                <Sprite width={s.size} height={s.size} color={STAR_COLORS[s.layer]} zIndex={1} />
              </Entity>
            ))}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={player.x} y={player.y} />
              <Sprite width={PLAYER_W} height={PLAYER_H}
                color={isFlashing ? '#02040e' : shieldRef.current ? '#40c4ff' : '#4fc3f7'}
                zIndex={10} />
            </Entity>
            {/* Player thruster */}
            {!isFlashing && (
              <Entity tags={['thruster']}>
                <Transform x={player.x} y={player.y + PLAYER_H / 2 + 5} />
                <Sprite width={8} height={10} color="#ff6d00" zIndex={9} />
              </Entity>
            )}

            {/* Player bullets */}
            {bullets.map(b => {
              const offX = b.spread === true ? -14 : b.spread === false ? 14 : 0
              return (
                <Entity key={`pb${b.id}`} tags={['bullet']}>
                  <Transform x={b.x + offX} y={b.y} />
                  <Sprite width={BULLET_W} height={BULLET_H} color="#ffd740" zIndex={8} />
                </Entity>
              )
            })}

            {/* Enemy bullets */}
            {enemyBullets.map(b => (
              <Entity key={`eb${b.id}`} tags={['ebullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={ENEMY_BULLET_W} height={ENEMY_BULLET_H} color="#ff1744" zIndex={7} />
              </Entity>
            ))}

            {/* Enemies */}
            {enemies.map(e => (
              <Entity key={`e${e.id}`} tags={['enemy']}>
                <Transform x={e.x} y={e.y} />
                <Sprite width={ENEMY_W} height={ENEMY_H}
                  color={e.hp > 1 ? '#ff7043' : '#ef5350'}
                  zIndex={6} />
              </Entity>
            ))}

            {/* Powerups */}
            {powerups.map(p => (
              <Entity key={`pu${p.id}`} tags={['powerup']}>
                <Transform x={p.x} y={p.y} />
                <Sprite width={POWERUP_SIZE} height={POWERUP_SIZE} color={POWERUP_COLORS[p.type]} zIndex={5} />
              </Entity>
            ))}
          </World>
        </Game>

        {/* Powerup label HUD overlay */}
        <div style={{
          position: 'absolute', bottom: 6, left: 8,
          display: 'flex', gap: 6, pointerEvents: 'none',
        }}>
          {spreadRef.current && (
            <span style={{ fontSize: 10, color: '#69f0ae', background: '#0d1a14', padding: '2px 6px', borderRadius: 4 }}>
              SPREAD
            </span>
          )}
          {speedBoostRef.current && (
            <span style={{ fontSize: 10, color: '#ffab40', background: '#1a140d', padding: '2px 6px', borderRadius: 4 }}>
              SPEED+
            </span>
          )}
        </div>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>VERTICAL</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>SHOOTER</p>
              <p style={{ fontSize: 12, color: '#90a4ae', margin: '16px 0 4px' }}>
                Collect power-ups &nbsp;·&nbsp; Survive the waves
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                <span style={{ color: '#69f0ae' }}>&#9632;</span> Spread &nbsp;
                <span style={{ color: '#40c4ff' }}>&#9632;</span> Shield &nbsp;
                <span style={{ color: '#ffab40' }}>&#9632;</span> Speed
              </p>
              <button onClick={restart} style={btnStyle}>PLAY</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>DESTROYED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Reached wave {waveNum}</p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 16px', fontSize: 10, color: '#37474f', letterSpacing: 1.2,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Arrows / WASD — move &nbsp;·&nbsp; Auto-fires upward</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(2,4,14,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 44px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 22, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
