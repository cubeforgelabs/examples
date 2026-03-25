import { useEffect, useReducer, useRef, useState } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 560
const H = 520
const COLS = 8
const ROWS = 4
const CELL = 48
const GRID_GAP = 2
const GRID_W = COLS * (CELL + GRID_GAP)
const GRID_H = ROWS * (CELL + GRID_GAP)
const GRID_OFF_X = (W - GRID_W) / 2 + CELL / 2 + GRID_GAP / 2
const GRID_OFF_Y = 100 + CELL / 2

type GamePhase = 'idle' | 'shop' | 'battle' | 'gameover'

interface UnitType {
  name: string
  cost: number
  hp: number
  atk: number
  spd: number     // px/s move speed
  range: number   // attack range in px
  color: string
  atkCooldown: number // seconds between attacks
}

const UNIT_TYPES: UnitType[] = [
  { name: 'Scout',   cost: 2, hp: 30,  atk: 8,  spd: 60, range: 50,  color: '#4fc3f7', atkCooldown: 0.8 },
  { name: 'Knight',  cost: 3, hp: 60,  atk: 14, spd: 35, range: 40,  color: '#42a5f5', atkCooldown: 1.2 },
  { name: 'Ranger',  cost: 4, hp: 35,  atk: 18, spd: 25, range: 120, color: '#26c6da', atkCooldown: 1.5 },
  { name: 'Tank',    cost: 5, hp: 120, atk: 10, spd: 20, range: 40,  color: '#1565c0', atkCooldown: 1.0 },
]

interface Unit {
  id: number
  typeIdx: number
  hp: number
  maxHp: number
  x: number
  y: number
  team: 'player' | 'enemy'
  atkTimer: number
  dead: boolean
}

let unitIdCounter = 0

function cellX(c: number) { return GRID_OFF_X + c * (CELL + GRID_GAP) }
function cellY(r: number) { return GRID_OFF_Y + r * (CELL + GRID_GAP) }

function spawnEnemies(wave: number): Unit[] {
  const enemies: Unit[] = []
  const count = Math.min(3 + wave, 10)
  const hpMul = 1 + wave * 0.2
  const atkMul = 1 + wave * 0.15
  for (let i = 0; i < count; i++) {
    const typeIdx = Math.floor(Math.random() * UNIT_TYPES.length)
    const ut = UNIT_TYPES[typeIdx]
    const c = 4 + Math.floor(Math.random() * 4)
    const r = Math.floor(Math.random() * ROWS)
    const hp = Math.floor(ut.hp * hpMul)
    enemies.push({
      id: ++unitIdCounter,
      typeIdx,
      hp,
      maxHp: hp,
      x: cellX(c),
      y: cellY(r),
      team: 'enemy',
      atkTimer: 0,
      dead: false,
    })
  }
  return enemies
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [wave, setWave] = useState(1)
  const [gold, setGold] = useState(10)
  const [lives, setLives] = useState(5)
  const [, render] = useReducer(n => n + 1, 0)

  const phaseRef = useRef<GamePhase>('idle')
  const unitsRef = useRef<Unit[]>([])
  const goldRef = useRef(10)
  const livesRef = useRef(5)
  const waveRef = useRef(1)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Shop state
  const [placedUnits, setPlacedUnits] = useState<Unit[]>([])
  const [selectedType, setSelectedType] = useState<number | null>(null)

  function startGame() {
    unitIdCounter = 0
    goldRef.current = 10
    livesRef.current = 5
    waveRef.current = 1
    setGold(10)
    setLives(5)
    setWave(1)
    setPlacedUnits([])
    setSelectedType(null)
    phaseRef.current = 'shop'
    setPhase('shop')
    setGameKey(k => k + 1)
  }

  function placeUnit(r: number, c: number) {
    if (selectedType === null || c >= 4) return // only left half
    const ut = UNIT_TYPES[selectedType]
    if (goldRef.current < ut.cost) return
    // Check if cell is occupied
    if (placedUnits.some(u => Math.abs(u.x - cellX(c)) < 10 && Math.abs(u.y - cellY(r)) < 10)) return
    goldRef.current -= ut.cost
    setGold(goldRef.current)
    const unit: Unit = {
      id: ++unitIdCounter,
      typeIdx: selectedType,
      hp: ut.hp,
      maxHp: ut.hp,
      x: cellX(c),
      y: cellY(r),
      team: 'player',
      atkTimer: 0,
      dead: false,
    }
    setPlacedUnits(prev => [...prev, unit])
  }

  function startBattle() {
    if (placedUnits.length === 0) return
    const enemies = spawnEnemies(waveRef.current)
    unitsRef.current = [...placedUnits.map(u => ({ ...u })), ...enemies]
    phaseRef.current = 'battle'
    setPhase('battle')
  }

  // ── Battle loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'battle') return
    lastTimeRef.current = performance.now()

    function loop(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now
      if (phaseRef.current !== 'battle') return

      const units = unitsRef.current
      const alive = units.filter(u => !u.dead)
      const players = alive.filter(u => u.team === 'player')
      const enemies = alive.filter(u => u.team === 'enemy')

      // Check end conditions
      if (enemies.length === 0) {
        // Wave won
        const nextWave = waveRef.current + 1
        const bonus = 5 + waveRef.current * 2
        waveRef.current = nextWave
        goldRef.current += bonus
        setWave(nextWave)
        setGold(goldRef.current)
        // Keep surviving player units for shop phase
        setPlacedUnits(players.map(u => ({ ...u, atkTimer: 0 })))
        phaseRef.current = 'shop'
        setPhase('shop')
        render()
        return
      }
      if (players.length === 0) {
        // Wave lost
        livesRef.current--
        setLives(livesRef.current)
        if (livesRef.current <= 0) {
          phaseRef.current = 'gameover'
          setPhase('gameover')
          render()
          return
        }
        const bonus = 5 + waveRef.current
        goldRef.current += bonus
        setGold(goldRef.current)
        setPlacedUnits([])
        phaseRef.current = 'shop'
        setPhase('shop')
        render()
        return
      }

      // Update each alive unit
      for (const u of alive) {
        const foes = u.team === 'player' ? enemies : players
        if (foes.length === 0) continue

        // Find nearest foe
        let nearest = foes[0], nearDist = Infinity
        for (const f of foes) {
          const d = Math.hypot(f.x - u.x, f.y - u.y)
          if (d < nearDist) { nearDist = d; nearest = f }
        }

        const ut = UNIT_TYPES[u.typeIdx]
        if (nearDist <= ut.range) {
          // Attack
          u.atkTimer += dt
          if (u.atkTimer >= ut.atkCooldown) {
            u.atkTimer = 0
            nearest.hp -= ut.atk
            if (nearest.hp <= 0) nearest.dead = true
          }
        } else {
          // Move toward nearest foe
          const dx = nearest.x - u.x
          const dy = nearest.y - u.y
          const dist = Math.hypot(dx, dy)
          if (dist > 1) {
            u.x += (dx / dist) * ut.spd * dt
            u.y += (dy / dist) * ut.spd * dt
          }
        }
      }

      render()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayUnits = phase === 'battle' ? unitsRef.current.filter(u => !u.dead) : placedUnits
  const enemyColors = ['#ef5350', '#ff7043', '#e53935', '#d84315']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0', fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < lives ? '#ef5350' : '#263238', fontSize: 16 }}>&#9829;</span>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>WAVE {wave}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: '#ffd54f' }}>&#9733; {gold}</span>
        </div>
      </div>

      {/* Shop bar (only in shop phase) */}
      {phase === 'shop' && (
        <div style={{ width: W, background: '#131726', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', boxSizing: 'border-box' }}>
          {UNIT_TYPES.map((ut, i) => (
            <button
              key={i}
              onClick={() => setSelectedType(selectedType === i ? null : i)}
              style={{
                flex: 1,
                padding: '6px 4px',
                background: selectedType === i ? '#1e3a5f' : '#0d0f1a',
                border: `2px solid ${selectedType === i ? ut.color : '#1e2535'}`,
                borderRadius: 6,
                color: goldRef.current >= ut.cost ? '#fff' : '#546e7a',
                fontFamily: '"Courier New",monospace',
                fontSize: 10,
                cursor: goldRef.current >= ut.cost ? 'pointer' : 'not-allowed',
                opacity: goldRef.current >= ut.cost ? 1 : 0.5,
                textAlign: 'center',
              }}
            >
              <div style={{ color: ut.color, fontWeight: 700, fontSize: 12 }}>{ut.name}</div>
              <div style={{ marginTop: 2 }}>HP:{ut.hp} ATK:{ut.atk}</div>
              <div style={{ color: '#ffd54f', marginTop: 2 }}>&#9733;{ut.cost}</div>
            </button>
          ))}
          <button onClick={startBattle} style={{ padding: '10px 16px', background: placedUnits.length > 0 ? '#66bb6a' : '#37474f', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 12, fontWeight: 700, cursor: placedUnits.length > 0 ? 'pointer' : 'not-allowed', letterSpacing: 1 }}>
            FIGHT!
          </button>
        </div>
      )}

      {/* Board */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d1117">
            <Camera2D x={W / 2} y={H / 2} background="#0d1117" />

            {/* Grid cells */}
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => (
                <Entity key={`cell-${r}-${c}`} tags={['cell']}>
                  <Transform x={cellX(c)} y={cellY(r)} />
                  <Sprite
                    width={CELL}
                    height={CELL}
                    color={c < 4 ? '#0d2137' : '#2a0d0d'}
                    zIndex={1}
                  />
                </Entity>
              ))
            )}

            {/* Divider line */}
            <Entity tags={['divider']}>
              <Transform x={W / 2} y={GRID_OFF_Y + (ROWS - 1) * (CELL + GRID_GAP) / 2} />
              <Sprite width={2} height={GRID_H + 10} color="#37474f" zIndex={2} />
            </Entity>

            {/* Units */}
            {displayUnits.map(u => {
              const ut = UNIT_TYPES[u.typeIdx]
              const col = u.team === 'player' ? ut.color : enemyColors[u.typeIdx % enemyColors.length]
              const hpPct = u.hp / u.maxHp
              return (
                <Entity key={u.id} tags={['unit']}>
                  {/* Body */}
                  <Transform x={u.x} y={u.y} />
                  <Sprite width={CELL - 8} height={CELL - 8} color={col} zIndex={5} />
                  {/* HP bar bg */}
                  <Entity tags={['hpbg']}>
                    <Transform x={u.x} y={u.y - CELL / 2 + 2} />
                    <Sprite width={CELL - 10} height={4} color="#263238" zIndex={6} />
                  </Entity>
                  {/* HP bar fill */}
                  <Entity tags={['hp']}>
                    <Transform x={u.x - (CELL - 10) / 2 * (1 - hpPct)} y={u.y - CELL / 2 + 2} />
                    <Sprite width={(CELL - 10) * hpPct} height={4} color={hpPct > 0.5 ? '#66bb6a' : hpPct > 0.25 ? '#ffa726' : '#ef5350'} zIndex={7} />
                  </Entity>
                </Entity>
              )
            })}

            {/* Enemy units in battle */}
            {phase === 'battle' && unitsRef.current.filter(u => !u.dead && u.team === 'enemy').map(u => {
              const ut = UNIT_TYPES[u.typeIdx]
              void ut
              return null // already rendered above
            })}
          </World>
        </Game>

        {/* Click grid for placing units in shop */}
        {phase === 'shop' && selectedType !== null && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: 4 }, (_, c) => ( // only left half
                <div
                  key={`place-${r}-${c}`}
                  onClick={() => placeUnit(r, c)}
                  style={{
                    position: 'absolute',
                    left: cellX(c) - CELL / 2,
                    top: cellY(r) - CELL / 2,
                    width: CELL,
                    height: CELL,
                    cursor: 'pointer',
                    border: '1px dashed rgba(255,255,255,0.15)',
                    borderRadius: 4,
                  }}
                />
              ))
            )}
          </div>
        )}

        {/* Idle overlay */}
        {phase === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#42a5f5', marginBottom: 8 }}>CUBEFORGE</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>AUTO BATTLER</p>
              <p style={{ fontSize: 12, color: '#546e7a', marginTop: 16 }}>Buy units, place them, watch them fight</p>
              <button onClick={startGame} style={btnStyle}>Play</button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>DEFEATED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>GAME OVER</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Reached Wave <strong style={{ color: '#ffd54f' }}>{wave}</strong>
              </p>
              <button onClick={startGame} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px', padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <span>Select unit type &middot; click grid to place &middot; FIGHT to battle</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.88)', backdropFilter: 'blur(4px)' }
const cardStyle: React.CSSProperties = { textAlign: 'center', fontFamily: '"Courier New",monospace', padding: '36px 48px', background: '#0d0f1a', border: '1px solid #1e2535', borderRadius: 12 }
const btnStyle: React.CSSProperties = { marginTop: 24, padding: '10px 32px', background: '#42a5f5', color: '#0a0a0f', border: 'none', borderRadius: 6, fontFamily: '"Courier New",monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
