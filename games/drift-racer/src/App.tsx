import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 560
const H = 560
const CAR_W = 14
const CAR_H = 24
const MAX_SPEED = 280
const ACCEL = 180
const BRAKE = 250
const DRAG = 40
const STEER_SPEED = 3.2    // radians/s
const GRIP = 4.0            // lateral friction factor
const DRIFT_THRESHOLD = 0.6 // rad angle diff to count as drift
const SMOKE_LIFE = 30       // frames

type GamePhase = 'idle' | 'playing' | 'finished'

// ─── Track — a loop of waypoints ─────────────────────────────────────────────
const TRACK_PTS: Array<[number, number]> = [
  [280, 480], [140, 460], [60, 380], [50, 260], [80, 140],
  [160, 60], [280, 40], [400, 60], [480, 140], [500, 260],
  [490, 380], [420, 460], [280, 480],
]

const TRACK_W = 70

interface Smoke { id: number; x: number; y: number; ttl: number }

interface CarState {
  x: number; y: number
  heading: number  // radians, 0 = up
  speed: number
  vx: number; vy: number
  lap: number; nextCP: number
  lapTimes: number[]
  driftScore: number; driftCombo: number; totalDrift: number
  isDrifting: boolean
}

function makeCarState(): CarState {
  return {
    x: 280, y: 470, heading: -Math.PI / 2, speed: 0,
    vx: 0, vy: 0, lap: 0, nextCP: 1,
    lapTimes: [], driftScore: 0, driftCombo: 1, totalDrift: 0,
    isDrifting: false,
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [score, setScore] = useState(0)
  const [lapNum, setLapNum] = useState(0)
  const [bestLap, setBestLap] = useState<number | null>(null)
  const [, render] = useReducer(n => n + 1, 0)

  const phaseRef = useRef<GamePhase>('idle')
  const car = useRef<CarState>(makeCarState())
  const keysRef = useRef<Record<string, boolean>>({})
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const scoreRef = useRef(0)
  const smokeRef = useRef<Smoke[]>([])
  const smokeId = useRef(0)
  const lapStartRef = useRef(0)
  const totalLaps = 3

  function startGame() {
    car.current = makeCarState()
    scoreRef.current = 0
    smokeRef.current = []
    smokeId.current = 0
    setScore(0); setLapNum(0); setBestLap(null)
    lapStartRef.current = performance.now()
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
    if (phase !== 'playing') return
    lastRef.current = performance.now()
    lapStartRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now
      if (phaseRef.current !== 'playing') return

      const keys = keysRef.current
      const c = car.current

      // ── Input ──────────────────────────────────────────────────
      const gas = keys['ArrowUp'] || keys['KeyW']
      const brake = keys['ArrowDown'] || keys['KeyS']
      const steerL = keys['ArrowLeft'] || keys['KeyA']
      const steerR = keys['ArrowRight'] || keys['KeyD']

      // Steering (only effective when moving)
      if (c.speed > 10) {
        const steerAmount = STEER_SPEED * dt * Math.min(1, c.speed / 100)
        if (steerL) c.heading -= steerAmount
        if (steerR) c.heading += steerAmount
      }

      // Acceleration
      if (gas) c.speed = Math.min(MAX_SPEED, c.speed + ACCEL * dt)
      else if (brake) c.speed = Math.max(-40, c.speed - BRAKE * dt)
      else c.speed = Math.max(0, c.speed - DRAG * dt)

      // Forward direction
      const fx = Math.cos(c.heading)
      const fy = Math.sin(c.heading)

      // Desired velocity
      const desVx = fx * c.speed
      const desVy = fy * c.speed

      // Apply grip (lerp actual velocity toward desired)
      c.vx += (desVx - c.vx) * GRIP * dt
      c.vy += (desVy - c.vy) * GRIP * dt

      // Drift detection
      const velAngle = Math.atan2(c.vy, c.vx)
      let angleDiff = Math.abs(c.heading - velAngle)
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
      const wasDrifting = c.isDrifting
      c.isDrifting = c.speed > 60 && angleDiff > DRIFT_THRESHOLD

      if (c.isDrifting) {
        c.driftScore += angleDiff * c.speed * dt * 0.01 * c.driftCombo
        // Smoke particles
        if (smokeRef.current.length < 100) {
          smokeRef.current.push({ id: smokeId.current++, x: c.x - fx * 10 + (Math.random() - 0.5) * 8, y: c.y - fy * 10 + (Math.random() - 0.5) * 8, ttl: SMOKE_LIFE })
        }
      }
      if (wasDrifting && !c.isDrifting && c.driftScore > 5) {
        // Cash in drift
        const pts = Math.floor(c.driftScore)
        scoreRef.current += pts
        setScore(scoreRef.current)
        c.totalDrift += pts
        c.driftCombo = Math.min(c.driftCombo + 0.5, 5)
        c.driftScore = 0
      }
      if (!c.isDrifting) c.driftCombo = Math.max(1, c.driftCombo - dt * 0.5)

      // Move car
      c.x += c.vx * dt
      c.y += c.vy * dt

      // Keep on screen (wrap)
      if (c.x < -20) c.x = W + 20
      if (c.x > W + 20) c.x = -20
      if (c.y < -20) c.y = H + 20
      if (c.y > H + 20) c.y = -20

      // Track boundary push — if too far from nearest track segment, slow down
      let minDist = Infinity
      for (let i = 0; i < TRACK_PTS.length - 1; i++) {
        const [x0, y0] = TRACK_PTS[i]
        const [x1, y1] = TRACK_PTS[i + 1]
        const dx = x1 - x0, dy = y1 - y0
        const len = Math.hypot(dx, dy)
        const t = Math.max(0, Math.min(1, ((c.x - x0) * dx + (c.y - y0) * dy) / (len * len)))
        const px = x0 + t * dx, py = y0 + t * dy
        const d = Math.hypot(c.x - px, c.y - py)
        if (d < minDist) minDist = d
      }
      if (minDist > TRACK_W) {
        c.speed *= 0.95 // off-road slowdown
      }

      // ── Checkpoints ────────────────────────────────────────────
      const cp = TRACK_PTS[c.nextCP]
      if (cp && Math.hypot(c.x - cp[0], c.y - cp[1]) < 60) {
        c.nextCP++
        if (c.nextCP >= TRACK_PTS.length - 1) {
          // Completed a lap
          c.nextCP = 1
          c.lap++
          const lapTime = (now - lapStartRef.current) / 1000
          c.lapTimes.push(lapTime)
          lapStartRef.current = now
          setLapNum(c.lap)
          setBestLap(prev => prev === null ? lapTime : Math.min(prev, lapTime))
          if (c.lap >= totalLaps) {
            phaseRef.current = 'finished'
            setPhase('finished')
            render()
            return
          }
        }
      }

      // Smoke decay
      smokeRef.current = smokeRef.current.filter(s => { s.ttl--; return s.ttl > 0 })

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const c = car.current
  const smokes = smokeRef.current

  // Camera follows car
  const camX = Math.max(W / 2, Math.min(W / 2, c.x))
  const camY = Math.max(H / 2, Math.min(H / 2, c.y))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div>
          <span style={{ color: '#ffd54f', fontWeight: 700 }}>{String(score).padStart(5, '0')}</span>
          {c.isDrifting && <span style={{ color: '#ff7043', marginLeft: 8, fontSize: 11 }}>DRIFT! x{c.driftCombo.toFixed(1)}</span>}
        </div>
        <div style={{ textAlign: 'center' }}>
          LAP <strong style={{ color: '#fff' }}>{Math.min(lapNum + 1, totalLaps)}</strong>/{totalLaps}
        </div>
        <div style={{ textAlign: 'right' }}>
          {bestLap !== null && <span style={{ fontSize: 11 }}>BEST {bestLap.toFixed(1)}s</span>}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#2e7d32">
            <Camera2D x={camX} y={camY} background="#2e7d32" />

            {/* Track segments */}
            {TRACK_PTS.slice(0, -1).map(([x0, y0], i) => {
              const [x1, y1] = TRACK_PTS[i + 1]
              const cx = (x0 + x1) / 2
              const cy = (y0 + y1) / 2
              const len = Math.hypot(x1 - x0, y1 - y0)
              return (
                <Entity key={`track-${i}`} tags={['track']}>
                  <Transform x={cx} y={cy} />
                  <Sprite width={TRACK_W} height={len + TRACK_W} color="#546e7a" zIndex={1} />
                </Entity>
              )
            })}

            {/* Track inner line */}
            {TRACK_PTS.slice(0, -1).map(([x0, y0], i) => {
              const [x1, y1] = TRACK_PTS[i + 1]
              const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
              return (
                <Entity key={`line-${i}`} tags={['line']}>
                  <Transform x={cx} y={cy} />
                  <Sprite width={2} height={Math.hypot(x1 - x0, y1 - y0)} color="#78909c" zIndex={2} />
                </Entity>
              )
            })}

            {/* Start/finish line */}
            <Entity tags={['finish']}>
              <Transform x={280} y={475} />
              <Sprite width={TRACK_W} height={6} color="#fff" zIndex={3} />
            </Entity>

            {/* Smoke particles */}
            {smokes.map(s => (
              <Entity key={`smoke-${s.id}`} tags={['smoke']}>
                <Transform x={s.x} y={s.y} />
                <Sprite width={4 + (SMOKE_LIFE - s.ttl) * 0.3} height={4 + (SMOKE_LIFE - s.ttl) * 0.3} color={`rgba(200,200,200,${s.ttl / SMOKE_LIFE * 0.5})`} zIndex={4} />
              </Entity>
            ))}

            {/* Car body */}
            <Entity tags={['car']}>
              <Transform x={c.x} y={c.y} />
              <Sprite width={CAR_W} height={CAR_H} color={c.isDrifting ? '#ff7043' : '#ffd54f'} zIndex={10} />
            </Entity>
            {/* Car front indicator */}
            <Entity tags={['car-front']}>
              <Transform x={c.x + Math.cos(c.heading) * 8} y={c.y + Math.sin(c.heading) * 8} />
              <Sprite width={CAR_W - 4} height={6} color="#e65100" zIndex={11} />
            </Entity>
          </World>
        </Game>

        {/* Overlays */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ff7043', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>DRIFT RACER</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>Score points by drifting through corners</p>
              <p style={{ fontSize: 11, color: '#607d8b', marginTop: 6 }}>Complete {totalLaps} laps</p>
              <button onClick={startGame} style={btnStyle}>Race</button>
            </div>
          </div>
        )}
        {phase === 'finished' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>RACE COMPLETE</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>FINISHED!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0' }}>
                Drift Score <strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              {bestLap !== null && <p style={{ fontSize: 12, color: '#607d8b' }}>Best Lap: {bestLap.toFixed(2)}s</p>}
              <button onClick={startGame} style={btnStyle}>Race Again</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>UP — gas &middot; DOWN — brake &middot; LEFT/RIGHT — steer &middot; drift for points!</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#ff7043', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
