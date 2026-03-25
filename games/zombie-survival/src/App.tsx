import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 700
const H = 550
const PLAYER_SIZE = 18
const PLAYER_SPEED = 160
const ZOMBIE_BASE_SPEED = 55
const BULLET_SPEED = 420
const BULLET_SIZE = 6
const FIRE_COOLDOWN = 0.8
const CONTACT_DAMAGE = 10
const DT = 1 / 60

type GameState = 'idle' | 'playing' | 'levelup' | 'gameover'

interface Zombie {
  x: number; y: number; hp: number; maxHp: number; id: number; speed: number; size: number
}

interface Bullet {
  x: number; y: number; vx: number; vy: number; id: number; piercing: boolean; damage: number; size: number
}

interface XpGem {
  x: number; y: number; id: number
}

interface Upgrade {
  name: string; desc: string; apply: () => void
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [playerHp, setPlayerHp] = useState(100)
  const [playerLevel, setPlayerLevel] = useState(1)
  const [upgrades, setUpgrades] = useState<Upgrade[]>([])
  const [gameState, setGameState] = useState<GameState>('idle')

  const playerRef = useRef({ x: W / 2, y: H / 2 })
  const zombiesRef = useRef<Zombie[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const xpGemsRef = useRef<XpGem[]>([])
  const keysRef = useRef(new Set<string>())
  const nextIdRef = useRef(1)
  const fireTimerRef = useRef(0)
  const spawnTimerRef = useRef(2)
  const waveTimerRef = useRef(0)
  const killsInWaveRef = useRef(0)
  const xpRef = useRef(0)
  const xpToNextRef = useRef(8)
  const invulnRef = useRef(0)
  const playerHpRef = useRef(100)
  const waveRef = useRef(1)

  const statsRef = useRef({
    fireCooldown: FIRE_COOLDOWN,
    damage: 25,
    bulletSize: BULLET_SIZE,
    piercing: false,
    speed: PLAYER_SPEED,
    pickupRadius: 45,
  })

  const [, forceRender] = useReducer(n => n + 1, 0)

  const generateUpgrades = useCallback((): Upgrade[] => {
    const stats = statsRef.current
    const all: Upgrade[] = [
      { name: 'RAPID FIRE', desc: '-0.15s fire rate', apply: () => { stats.fireCooldown = Math.max(0.18, stats.fireCooldown - 0.15) } },
      { name: 'MORE DMG', desc: '+15 damage', apply: () => { stats.damage += 15 } },
      { name: 'PIERCING', desc: 'Bullets pierce zombies', apply: () => { stats.piercing = true } },
      { name: 'BIG SHOT', desc: '+4 bullet size', apply: () => { stats.bulletSize += 4 } },
      { name: 'SPEED UP', desc: '+25 move speed', apply: () => { stats.speed += 25 } },
      { name: 'MAGNET', desc: '+25 XP pickup range', apply: () => { stats.pickupRadius += 25 } },
    ]
    return all.sort(() => Math.random() - 0.5).slice(0, 3)
  }, [])

  const spawnWave = useCallback((waveNum: number) => {
    const count = 4 + waveNum * 2
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4)
      let x: number, y: number
      if (side === 0) { x = Math.random() * W; y = -20 }
      else if (side === 1) { x = Math.random() * W; y = H + 20 }
      else if (side === 2) { x = -20; y = Math.random() * H }
      else { x = W + 20; y = Math.random() * H }
      const isBig = Math.random() < 0.15
      const hp = isBig ? (10 + waveNum * 5) : (3 + waveNum * 2)
      zombiesRef.current.push({
        x, y, hp, maxHp: hp,
        id: nextIdRef.current++,
        speed: ZOMBIE_BASE_SPEED + waveNum * 4 + (isBig ? -15 : Math.random() * 20),
        size: isBig ? 22 : 14,
      })
    }
  }, [])

  // Main loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => {
      const player = playerRef.current
      const keys = keysRef.current
      const stats = statsRef.current

      // Player movement
      let dx = 0, dy = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy = -1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy = 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx = -1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx = 1
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy)
        player.x = Math.max(PLAYER_SIZE / 2, Math.min(W - PLAYER_SIZE / 2, player.x + (dx / len) * stats.speed * DT))
        player.y = Math.max(PLAYER_SIZE / 2, Math.min(H - PLAYER_SIZE / 2, player.y + (dy / len) * stats.speed * DT))
      }

      // Invuln decay
      if (invulnRef.current > 0) invulnRef.current -= DT

      // Wave timer — spawn more zombies continuously during wave
      waveTimerRef.current += DT
      spawnTimerRef.current -= DT
      if (spawnTimerRef.current <= 0) {
        spawnTimerRef.current = Math.max(0.4, 2.5 - waveRef.current * 0.15)
        const count = 1 + Math.floor(waveRef.current / 2)
        for (let i = 0; i < count; i++) {
          const side = Math.floor(Math.random() * 4)
          let sx: number, sy: number
          if (side === 0) { sx = Math.random() * W; sy = -20 }
          else if (side === 1) { sx = Math.random() * W; sy = H + 20 }
          else if (side === 2) { sx = -20; sy = Math.random() * H }
          else { sx = W + 20; sy = Math.random() * H }
          const isBig = Math.random() < 0.12
          const hp = isBig ? (8 + waveRef.current * 4) : (2 + waveRef.current)
          zombiesRef.current.push({
            x: sx, y: sy, hp, maxHp: hp,
            id: nextIdRef.current++,
            speed: ZOMBIE_BASE_SPEED + waveRef.current * 3 + (isBig ? -10 : Math.random() * 15),
            size: isBig ? 20 : 14,
          })
        }
      }

      // Auto-shoot nearest zombie
      fireTimerRef.current -= DT
      if (fireTimerRef.current <= 0 && zombiesRef.current.length > 0) {
        fireTimerRef.current = stats.fireCooldown
        let nearest: Zombie | null = null
        let nearestDist = Infinity
        for (const z of zombiesRef.current) {
          const ddx = z.x - player.x
          const ddy = z.y - player.y
          const dist = Math.sqrt(ddx * ddx + ddy * ddy)
          if (dist < nearestDist) { nearestDist = dist; nearest = z }
        }
        if (nearest) {
          const ddx = nearest.x - player.x
          const ddy = nearest.y - player.y
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1
          bulletsRef.current.push({
            x: player.x, y: player.y,
            vx: (ddx / dist) * BULLET_SPEED,
            vy: (ddy / dist) * BULLET_SPEED,
            id: nextIdRef.current++,
            piercing: stats.piercing,
            damage: stats.damage,
            size: stats.bulletSize,
          })
        }
      }

      // Move bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += b.vx * DT
        b.y += b.vy * DT
        return b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20
      })

      // Bullet-zombie collisions
      const bulletsToRemove = new Set<number>()
      const zombiesToRemove = new Set<number>()
      for (const z of zombiesRef.current) {
        for (const b of bulletsRef.current) {
          if (bulletsToRemove.has(b.id)) continue
          const bz_dx = b.x - z.x
          const bz_dy = b.y - z.y
          if (Math.abs(bz_dx) < (z.size + b.size) / 2 && Math.abs(bz_dy) < (z.size + b.size) / 2) {
            z.hp -= b.damage
            if (!b.piercing) bulletsToRemove.add(b.id)
            if (z.hp <= 0) {
              zombiesToRemove.add(z.id)
              killsInWaveRef.current++
              setScore(s => s + 10)
              xpGemsRef.current.push({ x: z.x, y: z.y, id: nextIdRef.current++ })
            }
          }
        }
      }
      bulletsRef.current = bulletsRef.current.filter(b => !bulletsToRemove.has(b.id))
      zombiesRef.current = zombiesRef.current.filter(z => !zombiesToRemove.has(z.id))

      // Move zombies, check player contact
      for (const z of zombiesRef.current) {
        const zdx = player.x - z.x
        const zdy = player.y - z.y
        const zlen = Math.sqrt(zdx * zdx + zdy * zdy) || 1
        z.x += (zdx / zlen) * z.speed * DT
        z.y += (zdy / zlen) * z.speed * DT

        if (invulnRef.current <= 0) {
          if (Math.abs(z.x - player.x) < (PLAYER_SIZE + z.size) / 2 &&
              Math.abs(z.y - player.y) < (PLAYER_SIZE + z.size) / 2) {
            invulnRef.current = 0.5
            playerHpRef.current = Math.max(0, playerHpRef.current - CONTACT_DAMAGE)
            setPlayerHp(playerHpRef.current)
            if (playerHpRef.current <= 0) setGameState('gameover')
          }
        }
      }

      // Collect XP gems
      xpGemsRef.current = xpGemsRef.current.filter(gem => {
        const gdx = gem.x - player.x
        const gdy = gem.y - player.y
        if (Math.sqrt(gdx * gdx + gdy * gdy) <= stats.pickupRadius) {
          xpRef.current++
          if (xpRef.current >= xpToNextRef.current) {
            xpRef.current -= xpToNextRef.current
            xpToNextRef.current = Math.ceil(xpToNextRef.current * 1.5)
            setPlayerLevel(l => l + 1)
            setUpgrades(generateUpgrades())
            setGameState('levelup')
          }
          return false
        }
        return true
      })

      // Wave progression
      if (waveTimerRef.current >= 20 + waveRef.current * 5) {
        waveRef.current++
        setWave(waveRef.current)
        waveTimerRef.current = 0
        killsInWaveRef.current = 0
        spawnWave(waveRef.current)
      }

      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [gameState, generateUpgrades, spawnWave])

  // Input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code)
      if ((gameState === 'idle' || gameState === 'gameover') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault(); restart()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [gameState])

  function restart() {
    playerRef.current = { x: W / 2, y: H / 2 }
    zombiesRef.current = []
    bulletsRef.current = []
    xpGemsRef.current = []
    keysRef.current.clear()
    nextIdRef.current = 1
    fireTimerRef.current = 0
    spawnTimerRef.current = 2
    waveTimerRef.current = 0
    killsInWaveRef.current = 0
    xpRef.current = 0
    xpToNextRef.current = 8
    invulnRef.current = 0
    playerHpRef.current = 100
    waveRef.current = 1
    statsRef.current = {
      fireCooldown: FIRE_COOLDOWN, damage: 25, bulletSize: BULLET_SIZE,
      piercing: false, speed: PLAYER_SPEED, pickupRadius: 45,
    }
    setScore(0)
    setWave(1)
    setPlayerHp(100)
    setPlayerLevel(1)
    setUpgrades([])
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  function pickUpgrade(idx: number) {
    upgrades[idx].apply()
    setGameState('playing')
  }

  const player = playerRef.current
  const zombies = zombiesRef.current
  const bullets = bulletsRef.current
  const xpGems = xpGemsRef.current
  const isFlashing = invulnRef.current > 0 && Math.floor(invulnRef.current * 10) % 2 === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#607d8b' }}>HP</span>
          <div style={{ width: 80, height: 6, background: '#1a1f2e', borderRadius: 3 }}>
            <div style={{
              width: `${playerHp}%`, height: '100%', borderRadius: 3,
              background: playerHp > 50 ? '#69f0ae' : playerHp > 25 ? '#fdd835' : '#ef5350',
              transition: 'width 0.1s',
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#607d8b' }}>{playerHp}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>
          LVL {playerLevel} &nbsp;&middot;&nbsp; WAVE {wave}
        </div>
      </div>

      {/* XP bar */}
      <div style={{ width: W, height: 3, background: '#1a1f2e' }}>
        <div style={{
          width: `${Math.min(100, (xpRef.current / xpToNextRef.current) * 100)}%`,
          height: '100%', background: '#69f0ae', transition: 'width 0.1s',
        }} />
      </div>

      {/* Game */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* XP gems */}
            {xpGems.map(gem => (
              <Entity key={`xp${gem.id}`} tags={['xp']}>
                <Transform x={gem.x} y={gem.y} />
                <Sprite width={7} height={7} color="#69f0ae" zIndex={3} />
              </Entity>
            ))}

            {/* Bullets */}
            {bullets.map(b => (
              <Entity key={`b${b.id}`} tags={['bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={b.size} height={b.size} color="#fdd835" zIndex={7} />
              </Entity>
            ))}

            {/* Zombies */}
            {zombies.map(z => (
              <Entity key={`z${z.id}`} tags={['zombie']}>
                <Transform x={z.x} y={z.y} />
                <Sprite
                  width={z.size} height={z.size}
                  color={z.hp / z.maxHp > 0.5 ? '#4caf50' : '#8bc34a'}
                  zIndex={5}
                />
              </Entity>
            ))}

            {/* Player */}
            <Entity tags={['player']}>
              <Transform x={player.x} y={player.y} />
              <Sprite
                width={PLAYER_SIZE} height={PLAYER_SIZE}
                color={isFlashing ? '#0d1117' : '#4fc3f7'}
                zIndex={10}
              />
            </Entity>
          </World>
        </Game>

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#69f0ae', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>ZOMBIE SURVIVAL</p>
              <p style={{ fontSize: 12, color: '#90a4ae', marginTop: 16, lineHeight: 1.8 }}>
                Survive endless waves of zombies<br />
                Collect XP gems &middot; Level up &middot; Choose upgrades
              </p>
              <p style={{ fontSize: 13, color: '#607d8b', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* Level up overlay */}
        {gameState === 'levelup' && (
          <div style={overlayStyle}>
            <div style={{ ...cardStyle, padding: '24px 36px' }}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#fdd835', marginBottom: 12 }}>LEVEL UP!</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 20 }}>Choose an Upgrade</p>
              <div style={{ display: 'flex', gap: 12 }}>
                {upgrades.map((u, i) => (
                  <button key={i} onClick={() => pickUpgrade(i)} style={{
                    padding: '16px 20px', background: '#161d2a', border: '1px solid #1e2535',
                    borderRadius: 8, cursor: 'pointer', fontFamily: '"Courier New", monospace',
                    color: '#fff', textAlign: 'center', minWidth: 120,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4fc3f7', marginBottom: 6 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#90a4ae' }}>{u.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4caf50', marginBottom: 8 }}>INFECTED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#4fc3f7' }}>{score}</strong>
                &nbsp;&middot;&nbsp; Wave &nbsp;<strong style={{ color: '#69f0ae' }}>{wave}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>Level {playerLevel}</p>
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
        <span>WASD move &nbsp;&middot;&nbsp; Auto-shoots nearest zombie &nbsp;&middot;&nbsp; Collect green XP gems to level up</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: 'rgba(10,10,18,0.82)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace', padding: '36px 48px',
  background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#69f0ae', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontFamily: '"Courier New", monospace',
  fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
