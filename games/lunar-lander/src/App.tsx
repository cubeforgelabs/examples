import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 500
const H = 560

const GRAVITY      = 28        // pixels/sec²
const THRUST_FORCE = 75        // pixels/sec² upward
const ROT_SPEED    = 140       // degrees/sec
const FUEL_MAX     = 600
const FUEL_BURN    = 80        // units/sec while thrusting

// Landing pad
const PAD_X  = 230
const PAD_W  = 70
const PAD_Y  = H - 54

// Safe landing thresholds
const SAFE_VERT_VEL  = 38     // px/s downward max
const SAFE_HORIZ_VEL = 25     // px/s horizontal max
const SAFE_ANGLE     = 20     // degrees from vertical max

// Terrain — list of vertices from left to right
// Includes a flat pad segment at PAD_X..PAD_X+PAD_W
const TERRAIN_PTS: Array<[number, number]> = [
  [0,   H - 60],
  [40,  H - 90],
  [80,  H - 70],
  [110, H - 120],
  [150, H - 80],
  [PAD_X, PAD_Y],
  [PAD_X + PAD_W, PAD_Y],  // flat pad
  [330, H - 95],
  [370, H - 60],
  [410, H - 130],
  [450, H - 85],
  [490, H - 75],
  [W,   H - 90],
]

// ─── Types ────────────────────────────────────────────────────────────────────
type GamePhase = 'idle' | 'playing' | 'landed' | 'crashed'

// ─── Lander physics state ─────────────────────────────────────────────────────
interface LanderState {
  x: number
  y: number
  vx: number
  vy: number
  angle: number   // degrees, 0 = upright
  fuel: number
}

function makeInitialLander(): LanderState {
  return {
    x: 80 + Math.random() * (W - 160),
    y: 60,
    vx: (Math.random() - 0.5) * 20,
    vy: 5,
    angle: (Math.random() - 0.5) * 30,
    fuel: FUEL_MAX,
  }
}

// ─── Terrain collision ────────────────────────────────────────────────────────
// Returns ground Y at a given X by interpolating terrain segments
function groundYAt(x: number): number {
  const pts = TERRAIN_PTS
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return H
}

// Check if lander is on the flat pad
function isOnPad(x: number): boolean {
  return x >= PAD_X && x <= PAD_X + PAD_W
}

// Build terrain sprite segments (each segment is a rectangle)
interface TerrainSeg {
  id: number
  x: number
  y: number
  w: number
  h: number
}

function buildTerrainSegs(): TerrainSeg[] {
  const segs: TerrainSeg[] = []
  const pts = TERRAIN_PTS
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const cx = (x0 + x1) / 2
    const topY = Math.min(y0, y1)
    const h = H - topY
    const w = x1 - x0
    segs.push({ id: i, x: cx, y: topY + h / 2, w, h })
  }
  return segs
}

const TERRAIN_SEGS = buildTerrainSegs()

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [phase,     setPhase]     = useState<GamePhase>('idle')
  const [score,     setScore]     = useState(0)
  const [, render]                = useReducer(n => n + 1, 0)

  const phaseRef   = useRef<GamePhase>('idle')
  const lander     = useRef<LanderState>(makeInitialLander())
  const scoreRef   = useRef(0)
  const keysRef    = useRef<Record<string, boolean>>({})
  const rafRef     = useRef(0)
  const lastTimeRef = useRef(0)
  const thrustingRef = useRef(false)

  // Displayed values (updated each frame)
  const [displayFuel,    setDisplayFuel]    = useState(FUEL_MAX)
  const [displayVx,      setDisplayVx]      = useState(0)
  const [displayVy,      setDisplayVy]      = useState(0)
  const [displayAngle,   setDisplayAngle]   = useState(0)
  const [displayAlt,     setDisplayAlt]     = useState(0)

  function startGame() {
    lander.current = makeInitialLander()
    scoreRef.current = 0
    setScore(0)
    setDisplayFuel(FUEL_MAX)
    phaseRef.current = 'playing'
    setPhase('playing')
    setGameKey(k => k + 1)
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === 'keydown'
      if (e.type === 'keydown') {
        if ((e.code === 'Space' || e.code === 'Enter') &&
            (phaseRef.current === 'idle' || phaseRef.current === 'landed' || phaseRef.current === 'crashed')) {
          startGame()
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

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return

    lastTimeRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      if (phaseRef.current !== 'playing') return

      const keys = keysRef.current
      const ld   = lander.current

      // ── Controls ──────────────────────────────────────────────────────────
      const thrusting = (keys['ArrowUp'] || keys['KeyW']) && ld.fuel > 0
      const rotLeft   = keys['ArrowLeft']  || keys['KeyA']
      const rotRight  = keys['ArrowRight'] || keys['KeyD']

      thrustingRef.current = thrusting

      if (rotLeft)  ld.angle -= ROT_SPEED * dt
      if (rotRight) ld.angle += ROT_SPEED * dt

      // Clamp angle so lander doesn't go fully upside down
      ld.angle = Math.max(-90, Math.min(90, ld.angle))

      // ── Physics ───────────────────────────────────────────────────────────
      const rad = (ld.angle * Math.PI) / 180

      if (thrusting && ld.fuel > 0) {
        // Thrust opposes gravity, in direction of lander nose
        ld.vx += -Math.sin(rad) * THRUST_FORCE * dt
        ld.vy += -Math.cos(rad) * THRUST_FORCE * dt
        ld.fuel -= FUEL_BURN * dt
        if (ld.fuel < 0) ld.fuel = 0
      }

      // Gravity always pulls down
      ld.vy += GRAVITY * dt

      // Integrate position
      ld.x += ld.vx * dt
      ld.y += ld.vy * dt

      // Wrap horizontally
      if (ld.x < -10) ld.x = W + 10
      if (ld.x > W + 10) ld.x = -10

      // ── Ground collision ──────────────────────────────────────────────────
      const gndY = groundYAt(ld.x)
      const LANDER_H = 22

      if (ld.y + LANDER_H / 2 >= gndY) {
        ld.y = gndY - LANDER_H / 2

        const onPad    = isOnPad(ld.x)
        const safeVert = Math.abs(ld.vy) <= SAFE_VERT_VEL
        const safeHorz = Math.abs(ld.vx) <= SAFE_HORIZ_VEL
        const safeAng  = Math.abs(ld.angle) <= SAFE_ANGLE

        if (onPad && safeVert && safeHorz && safeAng) {
          // Successful landing
          const gentleness = Math.max(0, 1 - Math.abs(ld.vy) / SAFE_VERT_VEL)
          const fuelBonus  = Math.floor(ld.fuel / 10)
          const landScore  = Math.floor(1000 * gentleness) + fuelBonus
          scoreRef.current = landScore
          setScore(landScore)
          phaseRef.current = 'landed'
          setPhase('landed')
        } else {
          phaseRef.current = 'crashed'
          setPhase('crashed')
        }
        render()
        return
      }

      // Update displayed HUD values
      const alt = Math.max(0, Math.floor(gndY - ld.y - LANDER_H / 2))
      setDisplayFuel(Math.floor(ld.fuel))
      setDisplayVx(Math.round(ld.vx))
      setDisplayVy(Math.round(ld.vy))
      setDisplayAngle(Math.round(ld.angle))
      setDisplayAlt(alt)

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const ld         = lander.current
  const thrusting  = thrustingRef.current
  const fuelPct    = ld.fuel / FUEL_MAX
  const angleRad   = (ld.angle * Math.PI) / 180

  // Lander body parts — main body + 2 legs + thruster flame
  // All positions relative to lander center (ld.x, ld.y)
  // We'll just position them at the lander center with appropriate offsets
  // Main body
  const BODY_W = 18
  const BODY_H = 22
  // Leg offsets (local coords, rotated)
  const legLen = 12
  const legAngle1 =  40 * Math.PI / 180  // left leg
  const legAngle2 = -40 * Math.PI / 180  // right leg
  const legX1 = Math.sin(angleRad + legAngle1) * legLen
  const legY1 = Math.cos(angleRad + legAngle1) * legLen
  const legX2 = Math.sin(angleRad + legAngle2) * legLen
  const legY2 = Math.cos(angleRad + legAngle2) * legLen
  // Thrust nozzle position (below lander center)
  const nozzleX = -Math.sin(angleRad) * BODY_H * 0.5
  const nozzleY =  Math.cos(angleRad) * BODY_H * 0.5
  // Flame (3 sprites extending downward from nozzle)
  const flameLen = 10 + Math.random() * 8
  const flameX = nozzleX + (-Math.sin(angleRad) * flameLen * 0.5)
  const flameY = nozzleY + ( Math.cos(angleRad) * flameLen * 0.5)

  const velDanger = Math.abs(ld.vy) > SAFE_VERT_VEL * 0.7 || Math.abs(ld.vx) > SAFE_HORIZ_VEL * 0.7
  const angDanger = Math.abs(ld.angle) > SAFE_ANGLE * 0.7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 11,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
        fontFamily: '"Courier New", monospace',
      }}>
        {/* Fuel bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#546e7a' }}>FUEL</span>
          <div style={{ width: 60, height: 8, background: '#1a2535', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${fuelPct * 100}%`,
              height: '100%',
              background: fuelPct > 0.3 ? '#66bb6a' : '#ef5350',
              transition: 'width 0.1s',
            }} />
          </div>
          <span style={{ color: '#607d8b', fontSize: 10 }}>{displayFuel}</span>
        </div>

        {/* Velocity */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: velDanger ? '#ff5252' : '#90a4ae' }}>
            VX {String(displayVx).padStart(4)} &nbsp; VY {String(displayVy).padStart(4)}
          </span>
        </div>

        {/* Angle + Alt */}
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: angDanger ? '#ff5252' : '#90a4ae' }}>
            ANG {String(displayAngle).padStart(3)}° &nbsp;
          </span>
          <span style={{ color: '#607d8b' }}>ALT {displayAlt}</span>
        </div>
      </div>

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Stars (static decorations) */}
            {[...Array(40)].map((_, i) => {
              const sx = ((i * 137) % W)
              const sy = ((i * 73 + 17) % (H * 0.75))
              return (
                <Entity key={`star-${i}`} tags={['star']}>
                  <Transform x={sx} y={sy} />
                  <Sprite width={i % 3 === 0 ? 2 : 1} height={i % 3 === 0 ? 2 : 1} color="#e0e0e0" zIndex={1} />
                </Entity>
              )
            })}

            {/* Terrain segments */}
            {TERRAIN_SEGS.map(seg => (
              <Entity key={`terrain-${seg.id}`} tags={['terrain']}>
                <Transform x={seg.x} y={seg.y} />
                <Sprite width={seg.w} height={seg.h} color="#546e7a" zIndex={3} />
              </Entity>
            ))}

            {/* Landing pad highlight */}
            <Entity tags={['pad']}>
              <Transform x={PAD_X + PAD_W / 2} y={PAD_Y - 3} />
              <Sprite width={PAD_W} height={6} color="#ffd740" zIndex={4} />
            </Entity>

            {/* Pad markers */}
            <Entity tags={['pad-left']}>
              <Transform x={PAD_X} y={PAD_Y - 8} />
              <Sprite width={4} height={10} color="#ff6d00" zIndex={5} />
            </Entity>
            <Entity tags={['pad-right']}>
              <Transform x={PAD_X + PAD_W} y={PAD_Y - 8} />
              <Sprite width={4} height={10} color="#ff6d00" zIndex={5} />
            </Entity>

            {/* Lander legs */}
            <Entity tags={['leg-l']}>
              <Transform x={ld.x + legX1} y={ld.y + legY1} />
              <Sprite width={4} height={10} color="#90a4ae" zIndex={9} />
            </Entity>
            <Entity tags={['leg-r']}>
              <Transform x={ld.x + legX2} y={ld.y + legY2} />
              <Sprite width={4} height={10} color="#90a4ae" zIndex={9} />
            </Entity>

            {/* Lander body */}
            <Entity tags={['lander']}>
              <Transform x={ld.x} y={ld.y} />
              <Sprite width={BODY_W} height={BODY_H} color="#eceff1" zIndex={10} />
            </Entity>

            {/* Lander cockpit window */}
            <Entity tags={['cockpit']}>
              <Transform
                x={ld.x - Math.sin(angleRad) * 4}
                y={ld.y - Math.cos(angleRad) * 4}
              />
              <Sprite width={8} height={7} color="#29b6f6" zIndex={11} />
            </Entity>

            {/* Thruster flame */}
            {thrusting && ld.fuel > 0 && (
              <>
                <Entity tags={['flame-outer']}>
                  <Transform x={ld.x + flameX} y={ld.y + flameY} />
                  <Sprite width={8} height={flameLen} color="#ff6d00" zIndex={8} />
                </Entity>
                <Entity tags={['flame-inner']}>
                  <Transform x={ld.x + flameX * 0.8} y={ld.y + flameY * 0.8} />
                  <Sprite width={4} height={flameLen * 0.6} color="#ffea00" zIndex={9} />
                </Entity>
              </>
            )}

          </World>
        </Game>

        {/* ── Idle overlay ──────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#90a4ae', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>LUNAR</p>
              <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: 4, marginTop: -8 }}>LANDER</p>
              <p style={{ fontSize: 12, color: '#546e7a', margin: '16px 0 4px' }}>
                Land gently on the <span style={{ color: '#ffd740' }}>golden pad</span>
              </p>
              <p style={{ fontSize: 11, color: '#37474f', marginBottom: 8 }}>
                Low velocity &amp; angle &lt; {SAFE_ANGLE}° required
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 8 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
            </div>
          </div>
        )}

        {/* ── Landed overlay ─────────────────────────────────────────────── */}
        {phase === 'landed' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#66bb6a', marginBottom: 8 }}>SUCCESSFUL LANDING</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>LANDED!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 11, color: '#546e7a' }}>
                Fuel remaining: {displayFuel}
              </p>
              <button onClick={startGame} style={btnStyle}>Fly Again</button>
            </div>
          </div>
        )}

        {/* ── Crashed overlay ────────────────────────────────────────────── */}
        {phase === 'crashed' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                {!isOnPad(ld.x) ? 'MISSED LANDING PAD' :
                 Math.abs(ld.angle) > SAFE_ANGLE ? 'TOO MUCH TILT' : 'TOO FAST'}
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>CRASHED</p>
              <p style={{ fontSize: 12, color: '#546e7a', margin: '12px 0 4px' }}>
                VY: {displayVy} px/s &nbsp; Angle: {displayAngle}°
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
        <span>UP — thrust &nbsp;&middot;&nbsp; LEFT / RIGHT — rotate &nbsp;&middot;&nbsp; land gently on the pad</span>
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
  background:    '#ffd740',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
