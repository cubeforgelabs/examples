import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 560
const H = 560
const TANK_SIZE = 24
const TURRET_LEN = 16
const TURRET_W = 6
const PLAYER_SPEED = 120
const BULLET_SPEED = 300
const BULLET_SIZE = 5
const ENEMY_SPEED = 50
const ENEMY_BULLET_SPEED = 180

type GamePhase = 'idle' | 'playing' | 'gameover'

interface Wall { x: number; y: number; w: number; h: number; hp: number; destructible: boolean }
interface Bullet { id: number; x: number; y: number; vx: number; vy: number; fromPlayer: boolean }
interface EnemyTank { id: number; x: number; y: number; hp: number; maxHp: number; color: string; shootTimer: number; moveAngle: number; moveTimer: number }
interface Explosion { id: number; x: number; y: number; ttl: number }
interface Pickup { id: number; x: number; y: number }

interface GameData {
  px: number; py: number; hp: number
  turretAngle: number
  bullets: Bullet[]
  enemies: EnemyTank[]
  walls: Wall[]
  explosions: Explosion[]
  pickups: Pickup[]
  idCounter: number
}

function buildWalls(): Wall[] {
  const walls: Wall[] = []
  // Border
  walls.push({ x: 0, y: 0, w: W, h: 12, hp: 99, destructible: false })
  walls.push({ x: 0, y: H - 12, w: W, h: 12, hp: 99, destructible: false })
  walls.push({ x: 0, y: 0, w: 12, h: H, hp: 99, destructible: false })
  walls.push({ x: W - 12, y: 0, w: 12, h: H, hp: 99, destructible: false })
  // Interior obstacles
  const bricks: Array<[number, number, number, number]> = [
    [100, 100, 60, 16], [100, 100, 16, 60],
    [380, 100, 60, 16], [440, 100, 16, 60],
    [100, 400, 60, 16], [100, 340, 16, 60],
    [380, 400, 60, 16], [440, 340, 16, 60],
    [240, 240, 80, 16], [270, 240, 16, 80],
    [180, 200, 40, 16], [340, 200, 40, 16],
    [180, 340, 40, 16], [340, 340, 40, 16],
  ]
  for (const [x, y, w, h] of bricks) {
    walls.push({ x, y, w, h, hp: 2, destructible: true })
  }
  // Indestructible pillars
  walls.push({ x: 200, y: 140, w: 20, h: 20, hp: 99, destructible: false })
  walls.push({ x: 340, y: 140, w: 20, h: 20, hp: 99, destructible: false })
  walls.push({ x: 200, y: 400, w: 20, h: 20, hp: 99, destructible: false })
  walls.push({ x: 340, y: 400, w: 20, h: 20, hp: 99, destructible: false })
  return walls
}

function spawnEnemies(wave: number, idStart: number): EnemyTank[] {
  const count = Math.min(2 + wave, 8)
  const colors = ['#ef5350', '#ff7043', '#e53935', '#d84315']
  const enemies: EnemyTank[] = []
  for (let i = 0; i < count; i++) {
    const hp = wave <= 2 ? 1 : wave <= 4 ? 2 : 3
    enemies.push({
      id: idStart + i,
      x: 100 + Math.random() * (W - 200),
      y: 60 + Math.random() * 150,
      hp, maxHp: hp,
      color: colors[i % colors.length],
      shootTimer: 1 + Math.random() * 2,
      moveAngle: Math.random() * Math.PI * 2,
      moveTimer: 1 + Math.random() * 2,
    })
  }
  return enemies
}

function rectCollide(ax: number, ay: number, as: number, walls: Wall[]): { x: number; y: number } {
  let rx = ax, ry = ay
  for (const w of walls) {
    if (w.hp <= 0) continue
    if (rx - as / 2 < w.x + w.w && rx + as / 2 > w.x && ry - as / 2 < w.y + w.h && ry + as / 2 > w.y) {
      const overlapLeft = (rx + as / 2) - w.x
      const overlapRight = (w.x + w.w) - (rx - as / 2)
      const overlapTop = (ry + as / 2) - w.y
      const overlapBottom = (w.y + w.h) - (ry - as / 2)
      const minX = Math.min(overlapLeft, overlapRight)
      const minY = Math.min(overlapTop, overlapBottom)
      if (minX < minY) {
        rx += overlapLeft < overlapRight ? -overlapLeft : overlapRight
      } else {
        ry += overlapTop < overlapBottom ? -overlapTop : overlapBottom
      }
    }
  }
  return { x: rx, y: ry }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [score, setScore] = useState(0)
  const [waveNum, setWaveNum] = useState(1)
  const [playerHp, setPlayerHp] = useState(5)
  const [, render] = useReducer(n => n + 1, 0)

  const phaseRef = useRef<GamePhase>('idle')
  const gd = useRef<GameData>({
    px: W / 2, py: H - 80, hp: 5,
    turretAngle: 0,
    bullets: [], enemies: [], walls: buildWalls(), explosions: [], pickups: [],
    idCounter: 100,
  })
  const keysRef = useRef<Record<string, boolean>>({})
  const mouseRef = useRef({ x: W / 2, y: H / 2 })
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const scoreRef = useRef(0)
  const waveRef = useRef(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const shootCooldown = useRef(0)

  function startGame() {
    gd.current = {
      px: W / 2, py: H - 80, hp: 5,
      turretAngle: 0,
      bullets: [], walls: buildWalls(), explosions: [], pickups: [],
      enemies: spawnEnemies(1, 100),
      idCounter: 200,
    }
    scoreRef.current = 0; waveRef.current = 1
    setScore(0); setWaveNum(1); setPlayerHp(5)
    phaseRef.current = 'playing'
    setPhase('playing')
    setGameKey(k => k + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === 'keydown'
      if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter') && phaseRef.current !== 'playing') startGame()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onClick = () => {
      if (phaseRef.current !== 'playing' || shootCooldown.current > 0) return
      const g = gd.current
      const angle = g.turretAngle
      g.bullets.push({
        id: g.idCounter++,
        x: g.px + Math.cos(angle) * TURRET_LEN,
        y: g.py + Math.sin(angle) * TURRET_LEN,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        fromPlayer: true,
      })
      shootCooldown.current = 0.25
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('click', onClick)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('click', onClick) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'playing') return
    lastRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now
      if (phaseRef.current !== 'playing') return

      const g = gd.current
      const keys = keysRef.current

      // Shoot cooldown
      if (shootCooldown.current > 0) shootCooldown.current -= dt

      // Turret angle
      g.turretAngle = Math.atan2(mouseRef.current.y - g.py, mouseRef.current.x - g.px)

      // Player movement
      let dx = 0, dy = 0
      if (keys['KeyW'] || keys['ArrowUp']) dy = -1
      if (keys['KeyS'] || keys['ArrowDown']) dy = 1
      if (keys['KeyA'] || keys['ArrowLeft']) dx = -1
      if (keys['KeyD'] || keys['ArrowRight']) dx = 1
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy)
        const nx = g.px + (dx / len) * PLAYER_SPEED * dt
        const ny = g.py + (dy / len) * PLAYER_SPEED * dt
        const resolved = rectCollide(nx, ny, TANK_SIZE, g.walls)
        g.px = resolved.x; g.py = resolved.y
      }

      // Move bullets
      const aliveBullets: Bullet[] = []
      for (const b of g.bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt
        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) continue

        // Bullet vs walls
        let hitWall = false
        for (const w of g.walls) {
          if (w.hp <= 0) continue
          if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) {
            if (w.destructible) { w.hp--; if (w.hp <= 0) g.explosions.push({ id: g.idCounter++, x: w.x + w.w / 2, y: w.y + w.h / 2, ttl: 6 }) }
            hitWall = true; break
          }
        }
        if (hitWall) continue

        // Player bullet vs enemies
        if (b.fromPlayer) {
          let hitEnemy = false
          for (const e of g.enemies) {
            if (Math.hypot(b.x - e.x, b.y - e.y) < TANK_SIZE / 2 + BULLET_SIZE / 2) {
              e.hp--
              if (e.hp <= 0) {
                g.explosions.push({ id: g.idCounter++, x: e.x, y: e.y, ttl: 10 })
                scoreRef.current += 100
                setScore(scoreRef.current)
                if (Math.random() < 0.3) g.pickups.push({ id: g.idCounter++, x: e.x, y: e.y })
              }
              hitEnemy = true; break
            }
          }
          if (hitEnemy) continue
        }

        // Enemy bullet vs player
        if (!b.fromPlayer) {
          if (Math.hypot(b.x - g.px, b.y - g.py) < TANK_SIZE / 2 + BULLET_SIZE / 2) {
            g.hp--; setPlayerHp(g.hp)
            g.explosions.push({ id: g.idCounter++, x: g.px, y: g.py, ttl: 6 })
            if (g.hp <= 0) { phaseRef.current = 'gameover'; setPhase('gameover'); render(); return }
            continue
          }
        }

        aliveBullets.push(b)
      }
      g.bullets = aliveBullets

      // Remove dead enemies
      g.enemies = g.enemies.filter(e => e.hp > 0)

      // Enemy AI
      for (const e of g.enemies) {
        // Move toward player
        e.moveTimer -= dt
        if (e.moveTimer <= 0) { e.moveAngle = Math.atan2(g.py - e.y, g.px - e.x) + (Math.random() - 0.5) * 0.5; e.moveTimer = 1 + Math.random() * 2 }
        const nx = e.x + Math.cos(e.moveAngle) * ENEMY_SPEED * dt
        const ny = e.y + Math.sin(e.moveAngle) * ENEMY_SPEED * dt
        const resolved = rectCollide(nx, ny, TANK_SIZE, g.walls)
        e.x = resolved.x; e.y = resolved.y

        // Shoot at player
        e.shootTimer -= dt
        if (e.shootTimer <= 0) {
          e.shootTimer = 2 + Math.random() * 2
          const angle = Math.atan2(g.py - e.y, g.px - e.x)
          g.bullets.push({ id: g.idCounter++, x: e.x, y: e.y, vx: Math.cos(angle) * ENEMY_BULLET_SPEED, vy: Math.sin(angle) * ENEMY_BULLET_SPEED, fromPlayer: false })
        }
      }

      // Pickups
      g.pickups = g.pickups.filter(p => {
        if (Math.hypot(p.x - g.px, p.y - g.py) < 20) {
          g.hp = Math.min(5, g.hp + 1); setPlayerHp(g.hp)
          return false
        }
        return true
      })

      // Explosions
      g.explosions = g.explosions.filter(e => { e.ttl--; return e.ttl > 0 })

      // Next wave
      if (g.enemies.length === 0) {
        waveRef.current++
        setWaveNum(waveRef.current)
        g.enemies = spawnEnemies(waveRef.current, g.idCounter)
        g.idCounter += 20
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const g = gd.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < playerHp ? '#ef5350' : '#263238', fontSize: 16 }}>&#9829;</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>{String(score).padStart(5, '0')}</span>
        </div>
        <div style={{ textAlign: 'right', color: '#607d8b' }}>WAVE {waveNum}</div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ position: 'relative', width: W, height: H, cursor: 'crosshair' }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#1a1a2e">
            <Camera2D x={W / 2} y={H / 2} background="#1a1a2e" />

            {/* Walls */}
            {g.walls.filter(w => w.hp > 0).map((w, i) => (
              <Entity key={`wall-${i}`} tags={['wall']}>
                <Transform x={w.x + w.w / 2} y={w.y + w.h / 2} />
                <Sprite width={w.w} height={w.h} color={w.destructible ? (w.hp === 2 ? '#8d6e63' : '#795548') : '#455a64'} zIndex={2} />
              </Entity>
            ))}

            {/* Pickups */}
            {g.pickups.map(p => (
              <Entity key={`pk-${p.id}`} tags={['pickup']}>
                <Transform x={p.x} y={p.y} />
                <Sprite width={10} height={10} color="#66bb6a" zIndex={3} />
              </Entity>
            ))}

            {/* Player tank body */}
            <Entity tags={['player-body']}>
              <Transform x={g.px} y={g.py} />
              <Sprite width={TANK_SIZE} height={TANK_SIZE} color="#4caf50" zIndex={5} />
            </Entity>
            {/* Player turret */}
            <Entity tags={['player-turret']}>
              <Transform x={g.px + Math.cos(g.turretAngle) * TURRET_LEN / 2} y={g.py + Math.sin(g.turretAngle) * TURRET_LEN / 2} />
              <Sprite width={TURRET_LEN} height={TURRET_W} color="#2e7d32" zIndex={6} />
            </Entity>

            {/* Enemy tanks */}
            {g.enemies.map(e => (
              <Entity key={`enemy-${e.id}`} tags={['enemy']}>
                <Transform x={e.x} y={e.y} />
                <Sprite width={TANK_SIZE} height={TANK_SIZE} color={e.color} zIndex={5} />
              </Entity>
            ))}

            {/* Bullets */}
            {g.bullets.map(b => (
              <Entity key={`bullet-${b.id}`} tags={['bullet']}>
                <Transform x={b.x} y={b.y} />
                <Sprite width={BULLET_SIZE} height={BULLET_SIZE} color={b.fromPlayer ? '#ffd54f' : '#ff7043'} zIndex={8} />
              </Entity>
            ))}

            {/* Explosions */}
            {g.explosions.map(e => (
              <Entity key={`exp-${e.id}`} tags={['explosion']}>
                <Transform x={e.x} y={e.y} />
                <Sprite width={e.ttl * 3 + 6} height={e.ttl * 3 + 6} color={e.ttl > 5 ? '#ffd54f' : '#ff7043'} zIndex={9} />
              </Entity>
            ))}
          </World>
        </Game>

        {/* Overlays */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4caf50', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>TANK SHOOTER</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>WASD to move &middot; Mouse to aim &middot; Click to fire</p>
              <button onClick={startGame} style={btnStyle}>Play</button>
            </div>
          </div>
        )}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>DESTROYED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                Score <strong style={{ color: '#ffd54f' }}>{score}</strong> &middot; Wave <strong style={{ color: '#fff' }}>{waveNum}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>WASD — move &middot; Mouse — aim &middot; Click — shoot</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#4caf50', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
