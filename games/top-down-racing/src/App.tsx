import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 560
const H = 560
const CAR_W = 12
const CAR_H = 22
const PLAYER_ACCEL = 200
const PLAYER_BRAKE = 280
const PLAYER_MAX_SPEED = 220
const PLAYER_STEER = 3.0
const AI_MAX_SPEED = [180, 195, 160]
const DRAG = 30
const GRIP = 3.5
const TOTAL_LAPS = 3

type GamePhase = 'idle' | 'playing' | 'finished'

// Track waypoints (loop)
const WAYPOINTS: Array<[number, number]> = [
  [280, 490], [120, 460], [50, 350], [40, 220], [70, 120],
  [150, 50], [280, 30], [410, 50], [490, 120], [510, 220],
  [500, 350], [440, 460], [280, 490],
]

const TRACK_W = 65

interface CarData {
  x: number; y: number; heading: number; speed: number
  vx: number; vy: number
  nextWP: number; lap: number; color: string
  finished: boolean
}

function makeCar(x: number, y: number, heading: number, color: string): CarData {
  return { x, y, heading, speed: 0, vx: 0, vy: 0, nextWP: 1, lap: 0, color, finished: false }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [position, setPosition] = useState(1)
  const [lapDisplay, setLapDisplay] = useState(0)
  const [, render] = useReducer(n => n + 1, 0)

  const phaseRef = useRef<GamePhase>('idle')
  const playerRef = useRef<CarData>(makeCar(280, 490, -Math.PI / 2, '#4fc3f7'))
  const aiRef = useRef<CarData[]>([
    makeCar(260, 500, -Math.PI / 2, '#ef5350'),
    makeCar(300, 500, -Math.PI / 2, '#ffd54f'),
    makeCar(240, 510, -Math.PI / 2, '#66bb6a'),
  ])
  const keysRef = useRef<Record<string, boolean>>({})
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  function startGame() {
    playerRef.current = makeCar(280, 485, -Math.PI / 2, '#4fc3f7')
    aiRef.current = [
      makeCar(255, 498, -Math.PI / 2, '#ef5350'),
      makeCar(305, 498, -Math.PI / 2, '#ffd54f'),
      makeCar(240, 510, -Math.PI / 2, '#66bb6a'),
    ]
    setPosition(1); setLapDisplay(0)
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

  function updateCar(car: CarData, accel: boolean, brake: boolean, steerL: boolean, steerR: boolean, maxSpeed: number, dt: number) {
    if (car.finished) return

    if (car.speed > 10) {
      const steerAmt = PLAYER_STEER * dt * Math.min(1, car.speed / 80)
      if (steerL) car.heading -= steerAmt
      if (steerR) car.heading += steerAmt
    }

    if (accel) car.speed = Math.min(maxSpeed, car.speed + PLAYER_ACCEL * dt)
    else if (brake) car.speed = Math.max(0, car.speed - PLAYER_BRAKE * dt)
    else car.speed = Math.max(0, car.speed - DRAG * dt)

    const fx = Math.cos(car.heading), fy = Math.sin(car.heading)
    const desVx = fx * car.speed, desVy = fy * car.speed
    car.vx += (desVx - car.vx) * GRIP * dt
    car.vy += (desVy - car.vy) * GRIP * dt
    car.x += car.vx * dt
    car.y += car.vy * dt

    // Off-road slowdown
    let minDist = Infinity
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const [x0, y0] = WAYPOINTS[i], [x1, y1] = WAYPOINTS[i + 1]
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy)
      const t = Math.max(0, Math.min(1, ((car.x - x0) * dx + (car.y - y0) * dy) / (len * len)))
      const d = Math.hypot(car.x - (x0 + t * dx), car.y - (y0 + t * dy))
      if (d < minDist) minDist = d
    }
    if (minDist > TRACK_W) car.speed *= 0.92

    // Checkpoint
    const wp = WAYPOINTS[car.nextWP]
    if (wp && Math.hypot(car.x - wp[0], car.y - wp[1]) < 55) {
      car.nextWP++
      if (car.nextWP >= WAYPOINTS.length - 1) {
        car.nextWP = 1
        car.lap++
        if (car.lap >= TOTAL_LAPS) car.finished = true
      }
    }
  }

  useEffect(() => {
    if (phase !== 'playing') return
    lastRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now
      if (phaseRef.current !== 'playing') return

      const keys = keysRef.current
      const p = playerRef.current

      // Player input
      updateCar(p,
        keys['ArrowUp'] || keys['KeyW'],
        keys['ArrowDown'] || keys['KeyS'],
        keys['ArrowLeft'] || keys['KeyA'],
        keys['ArrowRight'] || keys['KeyD'],
        PLAYER_MAX_SPEED, dt
      )
      setLapDisplay(Math.min(p.lap + 1, TOTAL_LAPS))

      // AI
      for (let i = 0; i < aiRef.current.length; i++) {
        const ai = aiRef.current[i]
        if (ai.finished) continue
        const wp = WAYPOINTS[ai.nextWP] || WAYPOINTS[1]
        const targetAngle = Math.atan2(wp[1] - ai.y, wp[0] - ai.x)
        let diff = targetAngle - ai.heading
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        updateCar(ai, true, false, diff < -0.1, diff > 0.1, AI_MAX_SPEED[i], dt)
      }

      // Simple collision push between all cars
      const allCars = [p, ...aiRef.current]
      for (let i = 0; i < allCars.length; i++) {
        for (let j = i + 1; j < allCars.length; j++) {
          const a = allCars[i], b = allCars[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist < CAR_H && dist > 0.1) {
            const nx = (b.x - a.x) / dist, ny = (b.y - a.y) / dist
            const push = (CAR_H - dist) / 2
            a.x -= nx * push; a.y -= ny * push
            b.x += nx * push; b.y += ny * push
            a.speed *= 0.9; b.speed *= 0.9
          }
        }
      }

      // Calculate positions
      const progress = (car: CarData) => car.lap * (WAYPOINTS.length - 1) + car.nextWP
      const sorted = [...allCars].sort((a, b) => progress(b) - progress(a))
      const pos = sorted.indexOf(p) + 1
      setPosition(pos)

      // Check if player finished
      if (p.finished) {
        phaseRef.current = 'finished'
        setPhase('finished')
        render()
        return
      }

      // Check if all AI finished (player loses)
      if (aiRef.current.every(a => a.finished) && !p.finished) {
        phaseRef.current = 'finished'
        setPhase('finished')
        render()
        return
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = playerRef.current
  const ais = aiRef.current
  const posLabel = ['', '1st', '2nd', '3rd', '4th'][position] || `${position}th`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div>
          <span style={{ color: position === 1 ? '#ffd54f' : '#90a4ae', fontWeight: 700, fontSize: 18 }}>{posLabel}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          LAP <strong style={{ color: '#fff' }}>{lapDisplay}</strong>/{TOTAL_LAPS}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <span style={{ color: '#4fc3f7' }}>SPD {Math.floor(p.speed)}</span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#388e3c">
            <Camera2D x={W / 2} y={H / 2} background="#388e3c" />

            {/* Track segments */}
            {WAYPOINTS.slice(0, -1).map(([x0, y0], i) => {
              const [x1, y1] = WAYPOINTS[i + 1]
              const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
              const len = Math.hypot(x1 - x0, y1 - y0)
              return (
                <Entity key={`track-${i}`} tags={['track']}>
                  <Transform x={cx} y={cy} />
                  <Sprite width={TRACK_W + 10} height={len + TRACK_W + 10} color="#616161" zIndex={1} />
                </Entity>
              )
            })}

            {/* Track surface */}
            {WAYPOINTS.slice(0, -1).map(([x0, y0], i) => {
              const [x1, y1] = WAYPOINTS[i + 1]
              const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
              const len = Math.hypot(x1 - x0, y1 - y0)
              return (
                <Entity key={`road-${i}`} tags={['road']}>
                  <Transform x={cx} y={cy} />
                  <Sprite width={TRACK_W} height={len + TRACK_W} color="#757575" zIndex={2} />
                </Entity>
              )
            })}

            {/* Finish line */}
            <Entity tags={['finish']}>
              <Transform x={280} y={487} />
              <Sprite width={TRACK_W} height={6} color="#fff" zIndex={3} />
            </Entity>

            {/* AI cars */}
            {ais.map((ai, i) => (
              <Entity key={`ai-${i}`} tags={['ai']}>
                <Transform x={ai.x} y={ai.y} />
                <Sprite width={CAR_W} height={CAR_H} color={ai.color} zIndex={8} />
              </Entity>
            ))}
            {ais.map((ai, i) => (
              <Entity key={`ai-front-${i}`} tags={['ai-front']}>
                <Transform x={ai.x + Math.cos(ai.heading) * 7} y={ai.y + Math.sin(ai.heading) * 7} />
                <Sprite width={CAR_W - 4} height={5} color="#263238" zIndex={9} />
              </Entity>
            ))}

            {/* Player car */}
            <Entity tags={['player']}>
              <Transform x={p.x} y={p.y} />
              <Sprite width={CAR_W} height={CAR_H} color={p.color} zIndex={10} />
            </Entity>
            <Entity tags={['player-front']}>
              <Transform x={p.x + Math.cos(p.heading) * 7} y={p.y + Math.sin(p.heading) * 7} />
              <Sprite width={CAR_W - 4} height={5} color="#0277bd" zIndex={11} />
            </Entity>
          </World>
        </Game>

        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>TOP-DOWN</p>
              <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: 3, marginTop: -6 }}>RACING</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>Race against 3 opponents — {TOTAL_LAPS} laps</p>
              <button onClick={startGame} style={btnStyle}>Race</button>
            </div>
          </div>
        )}
        {phase === 'finished' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: position === 1 ? '#ffd54f' : '#ef5350', marginBottom: 8 }}>
                {position === 1 ? 'WINNER!' : 'RACE OVER'}
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>{posLabel} PLACE</p>
              <button onClick={startGame} style={btnStyle}>Race Again</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>UP — gas &middot; DOWN — brake &middot; LEFT/RIGHT — steer</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#4fc3f7', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
