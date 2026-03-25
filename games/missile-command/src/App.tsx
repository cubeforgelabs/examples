import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 560
const H = 500

const CITY_COUNT  = 6
const BASE_COUNT  = 3
const GROUND_Y    = H - 24
const CITY_Y      = GROUND_Y - 16
const BASE_Y      = GROUND_Y - 14

// City positions spread across the screen (avoid base positions)
const CITY_XS = [50, 120, 210, 350, 440, 510]
const BASE_XS = [90, 280, 470]   // 3 missile bases

const MISSILE_AMMO_PER_BASE = 10

// ─── Types ────────────────────────────────────────────────────────────────────
type GamePhase = 'idle' | 'playing' | 'gameover'

interface EnemyMissile {
  id: number
  x: number
  y: number
  tx: number   // target x (a city or random ground)
  ty: number   // target y
  speed: number
  trail: Array<{ x: number; y: number }>
}

interface Interceptor {
  id: number
  x: number
  y: number
  tx: number
  ty: number
  speed: number
}

interface Explosion {
  id: number
  x: number
  y: number
  r: number       // current radius
  maxR: number
  growing: boolean
}

interface City {
  x: number
  alive: boolean
}

interface Base {
  x: number
  ammo: number
}

// ─── ID counters ──────────────────────────────────────────────────────────────
let eid = 0

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [phase,     setPhase]     = useState<GamePhase>('idle')
  const [score,     setScore]     = useState(0)
  const [wave,      setWave]      = useState(1)
  const [, render]                = useReducer(n => n + 1, 0)

  const phaseRef     = useRef<GamePhase>('idle')
  const scoreRef     = useRef(0)
  const waveRef      = useRef(1)
  const citiesRef    = useRef<City[]>([])
  const basesRef     = useRef<Base[]>([])
  const enemiesRef   = useRef<EnemyMissile[]>([])
  const interceptsRef = useRef<Interceptor[]>([])
  const explosionsRef = useRef<Explosion[]>([])
  const rafRef       = useRef(0)
  const lastTimeRef  = useRef(0)
  const waveTimerRef = useRef(0)   // countdown until next enemy spawns
  const missilesLeftRef = useRef(0)  // how many enemies left to spawn this wave
  const gameContainerRef = useRef<HTMLDivElement>(null)

  function initGame() {
    eid = 0
    citiesRef.current    = CITY_XS.map(x => ({ x, alive: true }))
    basesRef.current     = BASE_XS.map(x => ({ x, ammo: MISSILE_AMMO_PER_BASE }))
    enemiesRef.current   = []
    interceptsRef.current = []
    explosionsRef.current = []
    scoreRef.current     = 0
    waveRef.current      = 1
    waveTimerRef.current = 1.5
    missilesLeftRef.current = 8
    setScore(0)
    setWave(1)
  }

  function startGame() {
    initGame()
    phaseRef.current = 'playing'
    setPhase('playing')
    setGameKey(k => k + 1)
  }

  function spawnEnemy(wv: number) {
    const speed = 40 + wv * 12 + Math.random() * 20
    // Pick a random alive city as target, or just a ground position
    const aliveCities = citiesRef.current.filter(c => c.alive)
    let tx: number
    let ty = GROUND_Y - 4
    if (aliveCities.length > 0 && Math.random() < 0.75) {
      const target = aliveCities[Math.floor(Math.random() * aliveCities.length)]
      tx = target.x
    } else {
      tx = 20 + Math.random() * (W - 40)
    }
    const startX = 30 + Math.random() * (W - 60)
    const startY = 0
    enemiesRef.current.push({
      id: ++eid,
      x: startX,
      y: startY,
      tx,
      ty,
      speed,
      trail: [],
    })
  }

  // ── Click to fire interceptor ─────────────────────────────────────────────
  useEffect(() => {
    const el = gameContainerRef.current
    if (!el) return

    const onClick = (e: MouseEvent) => {
      if (phaseRef.current !== 'playing') return
      const rect = el.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Find closest base with ammo
      const bases = basesRef.current
      let bestBase = -1
      let bestDist = Infinity
      for (let i = 0; i < bases.length; i++) {
        if (bases[i].ammo <= 0) continue
        const d = Math.abs(bases[i].x - clickX)
        if (d < bestDist) {
          bestDist = d
          bestBase = i
        }
      }
      if (bestBase < 0) return

      bases[bestBase].ammo--
      const bx = bases[bestBase].x
      const by = BASE_Y
      const dx = clickX - bx
      const dy = clickY - by
      const dist = Math.sqrt(dx * dx + dy * dy)
      const spd = 180
      interceptsRef.current.push({
        id: ++eid,
        x: bx,
        y: by,
        tx: clickX,
        ty: clickY,
        speed: spd * (dist > 0 ? 1 : 0),
      })
    }

    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])

  // ── Keyboard to start ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (phaseRef.current === 'idle' || phaseRef.current === 'gameover') {
          startGame()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return

    lastTimeRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (phaseRef.current !== 'playing') return

      const wv = waveRef.current

      // ── Spawn enemies ────────────────────────────────────────────────────
      waveTimerRef.current -= dt
      if (waveTimerRef.current <= 0 && missilesLeftRef.current > 0) {
        spawnEnemy(wv)
        missilesLeftRef.current--
        waveTimerRef.current = Math.max(0.3, 1.5 - wv * 0.12)
      }

      // Advance to next wave when all enemies are gone and none left to spawn
      if (missilesLeftRef.current === 0 &&
          enemiesRef.current.length === 0 &&
          interceptsRef.current.length === 0 &&
          explosionsRef.current.every(e => !e.growing)) {
        // Short pause then new wave
        waveTimerRef.current += 3.0
        const nextWave = wv + 1
        waveRef.current = nextWave
        setWave(nextWave)
        const count = Math.min(8 + nextWave * 3, 30)
        missilesLeftRef.current = count
        // Reload bases partially
        for (const b of basesRef.current) {
          b.ammo = Math.min(MISSILE_AMMO_PER_BASE, b.ammo + 5)
        }
      }

      // ── Move enemy missiles ───────────────────────────────────────────────
      const aliveEnemies: EnemyMissile[] = []
      for (const m of enemiesRef.current) {
        const dx = m.tx - m.x
        const dy = m.ty - m.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 4) {
          // Hit target — check if city
          for (const city of citiesRef.current) {
            if (city.alive && Math.abs(city.x - m.tx) < 20) {
              city.alive = false
            }
          }
          // Small explosion at impact
          explosionsRef.current.push({ id: ++eid, x: m.tx, y: m.ty, r: 2, maxR: 20, growing: true })
        } else {
          const nx = dx / dist
          const ny = dy / dist
          m.x += nx * m.speed * dt
          m.y += ny * m.speed * dt
          m.trail.push({ x: m.x, y: m.y })
          if (m.trail.length > 20) m.trail.shift()
          aliveEnemies.push(m)
        }
      }
      enemiesRef.current = aliveEnemies

      // ── Move interceptors ─────────────────────────────────────────────────
      const aliveInts: Interceptor[] = []
      for (const p of interceptsRef.current) {
        const dx = p.tx - p.x
        const dy = p.ty - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 6) {
          // Explode
          explosionsRef.current.push({ id: ++eid, x: p.tx, y: p.ty, r: 4, maxR: 55, growing: true })
        } else {
          const nx = dx / dist
          const ny = dy / dist
          p.x += nx * p.speed * dt
          p.y += ny * p.speed * dt
          aliveInts.push(p)
        }
      }
      interceptsRef.current = aliveInts

      // ── Update explosions ─────────────────────────────────────────────────
      const GROW_SPEED = 80
      const SHRINK_SPEED = 50
      const aliveExp: Explosion[] = []
      for (const ex of explosionsRef.current) {
        if (ex.growing) {
          ex.r += GROW_SPEED * dt
          if (ex.r >= ex.maxR) {
            ex.r = ex.maxR
            ex.growing = false
          }
          // Check enemy missiles inside explosion
          for (const m of enemiesRef.current) {
            const dx = m.x - ex.x
            const dy = m.y - ex.y
            if (dx * dx + dy * dy < ex.r * ex.r) {
              m.y = H + 100 // mark for removal (off screen)
              scoreRef.current += 25
              setScore(scoreRef.current)
            }
          }
          enemiesRef.current = enemiesRef.current.filter(m => m.y < H + 50)
          aliveExp.push(ex)
        } else {
          ex.r -= SHRINK_SPEED * dt
          if (ex.r > 0) aliveExp.push(ex)
        }
      }
      explosionsRef.current = aliveExp

      // ── Check game over ───────────────────────────────────────────────────
      if (citiesRef.current.every(c => !c.alive)) {
        phaseRef.current = 'gameover'
        setPhase('gameover')
        render()
        return
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const cities      = citiesRef.current
  const bases       = basesRef.current
  const enemies     = enemiesRef.current
  const intercepts  = interceptsRef.current
  const explosions  = explosionsRef.current
  const totalAmmo   = bases.reduce((s, b) => s + b.ammo, 0)

  // Build trail sprites for enemy missiles
  const trailSprites: Array<{ id: string; x: number; y: number; alpha: number }> = []
  for (const m of enemies) {
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i]
      trailSprites.push({ id: `trail-${m.id}-${i}`, x: t.x, y: t.y, alpha: (i + 1) / m.trail.length })
    }
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
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          WAVE {wave} &nbsp;&middot;&nbsp; AMMO {totalAmmo}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(6, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          {cities.map((c, i) => (
            <span key={i} style={{ color: c.alive ? '#00e5ff' : '#263238', fontSize: 14, marginLeft: 2 }}>&#9608;</span>
          ))}
        </div>
      </div>

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
      <div ref={gameContainerRef} style={{ position: 'relative', width: W, height: H, cursor: 'crosshair' }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Ground */}
            <Entity tags={['ground']}>
              <Transform x={W / 2} y={GROUND_Y + 8} />
              <Sprite width={W} height={16} color="#1a2a1a" zIndex={1} />
            </Entity>

            {/* Cities */}
            {cities.map((c, i) => c.alive && (
              <Entity key={`city-${i}`} tags={['city']}>
                <Transform x={c.x} y={CITY_Y} />
                <Sprite width={28} height={20} color="#00e5ff" zIndex={5} />
              </Entity>
            ))}

            {/* City rooftop accent */}
            {cities.map((c, i) => c.alive && (
              <Entity key={`city-top-${i}`} tags={['city-top']}>
                <Transform x={c.x} y={CITY_Y - 12} />
                <Sprite width={14} height={8} color="#00bcd4" zIndex={6} />
              </Entity>
            ))}

            {/* City ruins */}
            {cities.map((c, i) => !c.alive && (
              <Entity key={`ruin-${i}`} tags={['ruin']}>
                <Transform x={c.x} y={CITY_Y + 2} />
                <Sprite width={28} height={8} color="#2a1a1a" zIndex={5} />
              </Entity>
            ))}

            {/* Missile bases */}
            {bases.map((b, i) => (
              <Entity key={`base-${i}`} tags={['base']}>
                <Transform x={b.x} y={BASE_Y} />
                <Sprite
                  width={20}
                  height={16}
                  color={b.ammo > 0 ? '#81c784' : '#37474f'}
                  zIndex={5}
                />
              </Entity>
            ))}

            {/* Base ammo dots */}
            {bases.map((b, i) =>
              Array.from({ length: b.ammo }, (_, j) => (
                <Entity key={`ammo-${i}-${j}`} tags={['ammo-dot']}>
                  <Transform x={b.x - 8 + (j % 5) * 4} y={BASE_Y - 12 - Math.floor(j / 5) * 4} />
                  <Sprite width={3} height={3} color="#aed581" zIndex={6} />
                </Entity>
              ))
            )}

            {/* Enemy missile trails */}
            {trailSprites.map(t => (
              <Entity key={t.id} tags={['trail']}>
                <Transform x={t.x} y={t.y} />
                <Sprite width={2} height={2} color="#ef5350" zIndex={8} />
              </Entity>
            ))}

            {/* Enemy missiles (head) */}
            {enemies.map(m => (
              <Entity key={`em-${m.id}`} tags={['enemy']}>
                <Transform x={m.x} y={m.y} />
                <Sprite width={5} height={5} color="#ff1744" zIndex={10} />
              </Entity>
            ))}

            {/* Interceptors */}
            {intercepts.map(p => (
              <Entity key={`int-${p.id}`} tags={['interceptor']}>
                <Transform x={p.x} y={p.y} />
                <Sprite width={4} height={4} color="#ffd740" zIndex={10} />
              </Entity>
            ))}

            {/* Explosions — rendered as concentric sprites at different sizes */}
            {explosions.map(ex => (
              <Entity key={`ex-${ex.id}`} tags={['explosion']}>
                <Transform x={ex.x} y={ex.y} />
                <Sprite
                  width={ex.r * 2}
                  height={ex.r * 2}
                  color={ex.growing ? '#ff6d00' : '#ffd740'}
                  zIndex={12}
                />
              </Entity>
            ))}

            {/* Explosion inner glow */}
            {explosions.map(ex => (
              <Entity key={`ex-inner-${ex.id}`} tags={['explosion-inner']}>
                <Transform x={ex.x} y={ex.y} />
                <Sprite
                  width={Math.max(2, ex.r * 0.8)}
                  height={Math.max(2, ex.r * 0.8)}
                  color={ex.growing ? '#ffea00' : '#ff6d00'}
                  zIndex={13}
                />
              </Entity>
            ))}

          </World>
        </Game>

        {/* ── Idle overlay ──────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ff1744', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>MISSILE</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 3, marginTop: -8 }}>COMMAND</p>
              <p style={{ fontSize: 12, color: '#546e7a', margin: '16px 0 4px' }}>
                Click to fire interceptors at enemy missiles
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 8 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ─────────────────────────────────────────── */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>ALL CITIES DESTROYED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Survived &nbsp;<strong style={{ color: '#4fc3f7' }}>{wave - 1}</strong> &nbsp;waves
              </p>
              <button onClick={startGame} style={btnStyle}>Try Again</button>
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
        <span>Click — fire interceptor &nbsp;&middot;&nbsp; protect your cities &nbsp;&middot;&nbsp; waves increase speed</span>
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
  background:    '#ff1744',
  color:         '#fff',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
