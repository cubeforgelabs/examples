import { useState, useCallback, useEffect } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 560
const H = 520
const GRID_COLS = 8
const GRID_ROWS = 8
const CELL = 56            // pixels per cell
const GRID_OFFSET_X = 28  // left margin in canvas
const GRID_OFFSET_Y = 28  // top margin in canvas

// ─── Types ────────────────────────────────────────────────────────────────────
type UnitType = 'warrior' | 'archer' | 'mage'
type Side = 'player' | 'enemy'
type Phase = 'move' | 'attack' | 'done'
type GamePhase = 'playing' | 'win' | 'lose' | 'levelup'

interface Unit {
  id: string
  type: UnitType
  side: Side
  col: number
  row: number
  hp: number
  maxHp: number
  moveRange: number
  attackRange: number
  damage: number
  movedThisTurn: boolean
  attackedThisTurn: boolean
  color: string
}

interface LevelDef {
  enemies: { type: UnitType; col: number; row: number }[]
  layout?: string  // flavour text
}

// ─── Level definitions ────────────────────────────────────────────────────────
const LEVELS: LevelDef[] = [
  { layout: 'Open Field', enemies: [
    { type: 'warrior', col: 5, row: 1 },
    { type: 'warrior', col: 6, row: 3 },
    { type: 'archer',  col: 7, row: 5 },
  ]},
  { layout: 'Flanked', enemies: [
    { type: 'warrior', col: 4, row: 0 },
    { type: 'archer',  col: 5, row: 2 },
    { type: 'mage',    col: 6, row: 6 },
  ]},
  { layout: 'Heavy Assault', enemies: [
    { type: 'warrior', col: 4, row: 1 },
    { type: 'warrior', col: 5, row: 3 },
    { type: 'mage',    col: 7, row: 2 },
  ]},
  { layout: 'Archer Line', enemies: [
    { type: 'archer',  col: 4, row: 0 },
    { type: 'archer',  col: 5, row: 4 },
    { type: 'warrior', col: 7, row: 2 },
  ]},
  { layout: 'Final Stand', enemies: [
    { type: 'mage',    col: 4, row: 0 },
    { type: 'warrior', col: 5, row: 3 },
    { type: 'mage',    col: 6, row: 6 },
  ]},
]

// ─── Unit stats ───────────────────────────────────────────────────────────────
const UNIT_STATS: Record<UnitType, { hp: number; move: number; range: number; damage: number; color: string; enemyColor: string }> = {
  warrior: { hp: 8, move: 3, range: 1, damage: 3, color: '#42a5f5', enemyColor: '#ef5350' },
  archer:  { hp: 5, move: 4, range: 3, damage: 2, color: '#66bb6a', enemyColor: '#ff7043' },
  mage:    { hp: 4, move: 2, range: 4, damage: 4, color: '#ce93d8', enemyColor: '#ab47bc' },
}

let uid = 0
function makeUnit(type: UnitType, side: Side, col: number, row: number): Unit {
  const s = UNIT_STATS[type]
  return {
    id: `${side}-${type}-${uid++}`,
    type, side, col, row,
    hp: s.hp, maxHp: s.hp,
    moveRange: s.move,
    attackRange: s.range,
    damage: s.damage,
    movedThisTurn: false,
    attackedThisTurn: false,
    color: side === 'player' ? s.color : s.enemyColor,
  }
}

function makePlayerUnits(): Unit[] {
  return [
    makeUnit('warrior', 'player', 1, 3),
    makeUnit('archer',  'player', 2, 1),
    makeUnit('mage',    'player', 0, 5),
  ]
}

function makeEnemyUnits(level: LevelDef): Unit[] {
  return level.enemies.map(e => makeUnit(e.type, 'enemy', e.col, e.row))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function manhattan(a: { col: number; row: number }, b: { col: number; row: number }) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
}

function reachableCells(unit: Unit, allUnits: Unit[]): { col: number; row: number }[] {
  if (unit.movedThisTurn) return []
  const occupied = new Set(allUnits.filter(u => u.id !== unit.id).map(u => `${u.col},${u.row}`))
  const result: { col: number; row: number }[] = []
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (!occupied.has(`${c},${r}`) && manhattan(unit, { col: c, row: r }) <= unit.moveRange && (c !== unit.col || r !== unit.row)) {
        result.push({ col: c, row: r })
      }
    }
  }
  return result
}

function attackableCells(unit: Unit, allUnits: Unit[]): Unit[] {
  if (unit.attackedThisTurn) return []
  return allUnits.filter(u => u.side !== unit.side && manhattan(unit, u) <= unit.attackRange)
}

// ─── Canvas coordinate helpers ───────────────────────────────────────────────
function cellToCanvas(col: number, row: number) {
  return {
    x: GRID_OFFSET_X + col * CELL + CELL / 2,
    y: GRID_OFFSET_Y + row * CELL + CELL / 2,
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────
export function App() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const [units, setUnits] = useState<Unit[]>(() => [...makePlayerUnits(), ...makeEnemyUnits(LEVELS[0])])
  const [selected, setSelected] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('move')
  const [turnSide, setTurnSide] = useState<Side>('player')
  const [turnOrder, setTurnOrder] = useState<string[]>([])
  const [gamePhase, setGamePhase] = useState<GamePhase>('playing')
  const [log, setLog] = useState<string[]>([])

  // Build initial turn order
  useEffect(() => {
    const allIds = units.map(u => u.id)
    setTurnOrder(allIds)
  }, [gameKey])

  function addLog(msg: string) {
    setLog(prev => [...prev.slice(-4), msg])
  }

  const selectedUnit = units.find(u => u.id === selected) ?? null
  const moveable = selectedUnit && selectedUnit.side === 'player' && turnSide === 'player'
    ? reachableCells(selectedUnit, units) : []
  const attackable = selectedUnit && selectedUnit.side === 'player' && turnSide === 'player'
    ? attackableCells(selectedUnit, units) : []

  // Check win/lose
  const checkEndConditions = useCallback((currentUnits: Unit[]) => {
    const playerAlive = currentUnits.filter(u => u.side === 'player' && u.hp > 0)
    const enemyAlive = currentUnits.filter(u => u.side === 'enemy' && u.hp > 0)
    if (playerAlive.length === 0) return 'lose'
    if (enemyAlive.length === 0) return levelIndex >= LEVELS.length - 1 ? 'win' : 'levelup'
    return null
  }, [levelIndex])

  // End player turn → run enemy AI
  const endPlayerTurn = useCallback((currentUnits: Unit[]) => {
    const endState = checkEndConditions(currentUnits)
    if (endState) { setGamePhase(endState as GamePhase); return }

    setTurnSide('enemy')
    setSelected(null)
    setPhase('move')

    // Enemy AI — each enemy moves toward nearest player, then attacks if in range
    let updatedUnits = currentUnits.map(u => ({ ...u, movedThisTurn: false, attackedThisTurn: false }))

    const enemies = updatedUnits.filter(u => u.side === 'enemy')
    for (const enemy of enemies) {
      const players = updatedUnits.filter(u => u.side === 'player' && u.hp > 0)
      if (players.length === 0) break

      // Find nearest player
      const target = players.reduce((best, p) =>
        manhattan(enemy, p) < manhattan(enemy, best) ? p : best, players[0])

      // Move toward target
      const reachable = reachableCells(enemy, updatedUnits)
      if (reachable.length > 0 && !enemy.movedThisTurn) {
        const best = reachable.reduce((b, c) =>
          manhattan(c, target) < manhattan(b, target) ? c : b, reachable[0])
        updatedUnits = updatedUnits.map(u =>
          u.id === enemy.id ? { ...u, col: best.col, row: best.row, movedThisTurn: true } : u
        )
      }

      // Re-fetch moved enemy
      const movedEnemy = updatedUnits.find(u => u.id === enemy.id)!
      const attackTargets = attackableCells(movedEnemy, updatedUnits)
      if (attackTargets.length > 0) {
        const victim = attackTargets[0]
        const dmg = movedEnemy.damage
        addLog(`${movedEnemy.type} hits ${victim.type} for ${dmg}!`)
        updatedUnits = updatedUnits.map(u => {
          if (u.id === victim.id) return { ...u, hp: Math.max(0, u.hp - dmg) }
          if (u.id === movedEnemy.id) return { ...u, attackedThisTurn: true }
          return u
        })
        updatedUnits = updatedUnits.filter(u => u.hp > 0)
      }
    }

    // Reset for player turn
    updatedUnits = updatedUnits.map(u => ({ ...u, movedThisTurn: false, attackedThisTurn: false }))
    setUnits(updatedUnits)
    setTurnSide('player')
    setPhase('move')

    const end2 = checkEndConditions(updatedUnits)
    if (end2) setGamePhase(end2 as GamePhase)
  }, [checkEndConditions])

  const handleCellClick = useCallback((col: number, row: number) => {
    if (gamePhase !== 'playing' || turnSide !== 'player') return

    const clickedUnit = units.find(u => u.col === col && u.row === row)

    // If no unit selected, select a player unit
    if (!selected) {
      if (clickedUnit && clickedUnit.side === 'player') {
        setSelected(clickedUnit.id)
        setPhase('move')
      }
      return
    }

    const sel = units.find(u => u.id === selected)!

    // Click on enemy → attack
    if (clickedUnit && clickedUnit.side === 'enemy') {
      const canAttack = attackableCells(sel, units)
      const canHit = canAttack.find(u => u.col === col && u.row === row)
      if (canHit) {
        const dmg = sel.damage
        addLog(`${sel.type} hits enemy ${clickedUnit.type} for ${dmg}!`)
        let updated = units.map(u => {
          if (u.id === clickedUnit.id) return { ...u, hp: Math.max(0, u.hp - dmg) }
          if (u.id === sel.id) return { ...u, attackedThisTurn: true }
          return u
        })
        updated = updated.filter(u => u.hp > 0)
        setUnits(updated)

        // Auto end turn if all player units done
        const playersDone = updated.filter(u => u.side === 'player').every(u => u.attackedThisTurn)
        if (playersDone) {
          setSelected(null)
          endPlayerTurn(updated)
        } else {
          setSelected(null)
        }
        return
      }
    }

    // Click on empty / reachable cell → move
    const reach = reachableCells(sel, units)
    const dest = reach.find(c => c.col === col && c.row === row)
    if (dest) {
      const updated = units.map(u =>
        u.id === sel.id ? { ...u, col: dest.col, row: dest.row, movedThisTurn: true } : u
      )
      setUnits(updated)
      setPhase('attack')
      return
    }

    // Click on own unit → select it
    if (clickedUnit && clickedUnit.side === 'player') {
      setSelected(clickedUnit.id)
      setPhase('move')
    } else {
      setSelected(null)
    }
  }, [gamePhase, turnSide, units, selected, endPlayerTurn])

  function handleEndTurn() {
    setSelected(null)
    endPlayerTurn(units)
  }

  function nextLevel() {
    const nextIdx = levelIndex + 1
    setLevelIndex(nextIdx)
    const newUnits = [...units.filter(u => u.side === 'player').map(u => ({ ...u, movedThisTurn: false, attackedThisTurn: false })),
                     ...makeEnemyUnits(LEVELS[nextIdx])]
    setUnits(newUnits)
    setGamePhase('playing')
    setTurnSide('player')
    setSelected(null)
    setLog([])
    setGameKey(k => k + 1)
  }

  function restart() {
    uid = 0
    setLevelIndex(0)
    setUnits([...makePlayerUnits(), ...makeEnemyUnits(LEVELS[0])])
    setGamePhase('playing')
    setTurnSide('player')
    setSelected(null)
    setPhase('move')
    setLog([])
    setGameKey(k => k + 1)
  }

  const moveSet = new Set(moveable.map(c => `${c.col},${c.row}`))
  const attackSet = new Set(attackable.map(u => `${u.col},${u.row}`))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, fontFamily: '"Courier New", monospace' }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 12, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div>
          <span style={{ color: turnSide === 'player' ? '#42a5f5' : '#ef5350', fontWeight: 700 }}>
            {turnSide === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          LEVEL {levelIndex + 1}/{LEVELS.length} — {LEVELS[levelIndex].layout}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#42a5f5' }}>♟ {units.filter(u => u.side === 'player').length}</span>
          <span style={{ color: '#ef5350' }}>♟ {units.filter(u => u.side === 'enemy').length}</span>
        </div>
      </div>

      {/* Main layout: canvas + side panel */}
      <div style={{ display: 'flex', background: '#0d1117', width: W }}>
        {/* Canvas area */}
        <div style={{ position: 'relative', width: GRID_OFFSET_X * 2 + GRID_COLS * CELL, height: H, flexShrink: 0 }}>
          <Game key={gameKey} width={GRID_OFFSET_X * 2 + GRID_COLS * CELL} height={H} gravity={0}>
            <World background="#0d1117">
              <Camera2D x={(GRID_OFFSET_X * 2 + GRID_COLS * CELL) / 2} y={H / 2} background="#0d1117" />

              {/* Grid background cells */}
              {Array.from({ length: GRID_ROWS }, (_, row) =>
                Array.from({ length: GRID_COLS }, (_, col) => {
                  const { x, y } = cellToCanvas(col, row)
                  const key = `${col},${row}`
                  const isMoveTarget = moveSet.has(key)
                  const isAttackTarget = attackSet.has(key)
                  const isSelectedCell = selectedUnit?.col === col && selectedUnit?.row === row
                  const cellColor = isAttackTarget ? '#3d1515' : isMoveTarget ? '#152030' : (col + row) % 2 === 0 ? '#141c28' : '#111722'
                  return (
                    <Entity key={`cell-${col}-${row}`} id={`cell-${col}-${row}`}>
                      <Transform x={x} y={y} />
                      <Sprite width={CELL - 2} height={CELL - 2}
                        color={isSelectedCell ? '#1a2a40' : cellColor} zIndex={0} />
                    </Entity>
                  )
                })
              )}

              {/* Move range highlights */}
              {moveable.map(c => {
                const { x, y } = cellToCanvas(c.col, c.row)
                return (
                  <Entity key={`move-${c.col}-${c.row}`} id={`move-${c.col}-${c.row}`}>
                    <Transform x={x} y={y} />
                    <Sprite width={CELL - 4} height={CELL - 4} color="#1565c044" zIndex={1} />
                  </Entity>
                )
              })}

              {/* Attack range highlights */}
              {attackable.map(u => {
                const { x, y } = cellToCanvas(u.col, u.row)
                return (
                  <Entity key={`atk-${u.col}-${u.row}`} id={`atk-${u.col}-${u.row}`}>
                    <Transform x={x} y={y} />
                    <Sprite width={CELL - 4} height={CELL - 4} color="#b71c1c44" zIndex={1} />
                  </Entity>
                )
              })}

              {/* Units */}
              {units.map(u => {
                const { x, y } = cellToCanvas(u.col, u.row)
                const isSelected = u.id === selected
                const size = u.type === 'warrior' ? 28 : u.type === 'archer' ? 24 : 22
                return (
                  <Entity key={u.id} id={u.id}>
                    <Transform x={x} y={y} />
                    <Sprite
                      width={isSelected ? size + 4 : size}
                      height={isSelected ? size + 4 : size}
                      color={u.movedThisTurn && u.attackedThisTurn ? u.color + '88' : u.color}
                      zIndex={2}
                    />
                  </Entity>
                )
              })}
            </World>
          </Game>

          {/* Click overlay */}
          <div
            style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const mx = e.clientX - rect.left - GRID_OFFSET_X
              const my = e.clientY - rect.top - GRID_OFFSET_Y
              const col = Math.floor(mx / CELL)
              const row = Math.floor(my / CELL)
              if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
                handleCellClick(col, row)
              }
            }}
          />

          {/* HP bars above units */}
          {units.map(u => {
            const { x, y } = cellToCanvas(u.col, u.row)
            const barW = 32
            return (
              <div key={`hp-${u.id}`} style={{
                position: 'absolute',
                left: x - barW / 2,
                top: y - 24,
                width: barW, height: 4,
                background: '#1e2535', borderRadius: 2, pointerEvents: 'none',
              }}>
                <div style={{
                  width: `${(u.hp / u.maxHp) * 100}%`,
                  height: '100%',
                  background: u.side === 'player' ? '#42a5f5' : '#ef5350',
                  borderRadius: 2,
                }} />
              </div>
            )
          })}

          {/* Unit type labels */}
          {units.map(u => {
            const { x, y } = cellToCanvas(u.col, u.row)
            const label = u.type === 'warrior' ? 'W' : u.type === 'archer' ? 'A' : 'M'
            return (
              <div key={`lbl-${u.id}`} style={{
                position: 'absolute',
                left: x - 6, top: y - 8,
                fontSize: 11, fontWeight: 700,
                color: '#fff', pointerEvents: 'none',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}>
                {label}
              </div>
            )
          })}

          {/* Overlays */}
          {gamePhase !== 'playing' && (
            <div style={overlayStyle}>
              <div style={cardStyle}>
                {gamePhase === 'win' && <>
                  <p style={{ fontSize: 10, letterSpacing: 4, color: '#ffd54f' }}>ALL LEVELS CLEARED</p>
                  <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 3, margin: '8px 0' }}>VICTORY!</p>
                  <button onClick={restart} style={btnStyle}>Play Again</button>
                </>}
                {gamePhase === 'lose' && <>
                  <p style={{ fontSize: 10, letterSpacing: 4, color: '#ef5350' }}>ALL UNITS FALLEN</p>
                  <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 3, margin: '8px 0' }}>DEFEAT</p>
                  <button onClick={restart} style={btnStyle}>Retry</button>
                </>}
                {gamePhase === 'levelup' && <>
                  <p style={{ fontSize: 10, letterSpacing: 4, color: '#66bb6a' }}>STAGE CLEARED</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 3, margin: '8px 0' }}>
                    LEVEL {levelIndex + 1} DONE
                  </p>
                  <button onClick={nextLevel} style={{ ...btnStyle, background: '#66bb6a' }}>Next Level →</button>
                </>}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={{
          width: W - (GRID_OFFSET_X * 2 + GRID_COLS * CELL),
          background: '#0d0f1a',
          padding: '12px 0 12px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          fontSize: 11, color: '#607d8b',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {/* Selected unit info */}
          <div style={{ borderBottom: '1px solid #1e2535', paddingBottom: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#37474f', marginBottom: 6 }}>SELECTED</div>
            {selectedUnit ? (
              <>
                <div style={{ color: selectedUnit.color, fontWeight: 700, fontSize: 13 }}>
                  {selectedUnit.type.toUpperCase()}
                </div>
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div>HP: <span style={{ color: '#90a4ae' }}>{selectedUnit.hp}/{selectedUnit.maxHp}</span></div>
                  <div>MOV: <span style={{ color: '#42a5f5' }}>{selectedUnit.moveRange}</span></div>
                  <div>ATK: <span style={{ color: '#ef5350' }}>{selectedUnit.attackRange}</span></div>
                  <div>DMG: <span style={{ color: '#ffd54f' }}>{selectedUnit.damage}</span></div>
                </div>
                <div style={{ marginTop: 6, fontSize: 9, color: '#37474f' }}>
                  {selectedUnit.movedThisTurn ? '✓ moved' : '○ can move'}
                </div>
                <div style={{ fontSize: 9, color: '#37474f' }}>
                  {selectedUnit.attackedThisTurn ? '✓ attacked' : '○ can attack'}
                </div>
              </>
            ) : (
              <div style={{ color: '#37474f', fontSize: 10 }}>Click a unit</div>
            )}
          </div>

          {/* Battle log */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#37474f', marginBottom: 4 }}>LOG</div>
            {log.length === 0
              ? <div style={{ fontSize: 9, color: '#263238' }}>—</div>
              : log.slice().reverse().map((l, i) => (
                <div key={i} style={{ fontSize: 9, color: i === 0 ? '#90a4ae' : '#37474f', marginBottom: 2, lineHeight: 1.3 }}>{l}</div>
              ))
            }
          </div>

          {/* Legend */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #1e2535', paddingTop: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#37474f', marginBottom: 4 }}>UNITS</div>
            {(['warrior','archer','mage'] as UnitType[]).map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, background: UNIT_STATS[t].color, borderRadius: 1 }} />
                <span style={{ fontSize: 9, color: '#546e7a', textTransform: 'uppercase' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 16px', fontSize: 10, color: '#37474f', letterSpacing: 1.2,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Click unit to select · Blue=move · Red=attack</span>
        {turnSide === 'player' && gamePhase === 'playing' && (
          <button onClick={handleEndTurn} style={{
            padding: '3px 12px', background: '#1e2535', color: '#90a4ae',
            border: '1px solid #2a3344', borderRadius: 4, cursor: 'pointer',
            fontSize: 10, fontFamily: '"Courier New", monospace', letterSpacing: 1,
          }}>
            End Turn
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace',
  padding: '32px 44px', background: '#0d0f1a',
  border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 20, padding: '10px 28px', background: '#42a5f5',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontFamily: '"Courier New", monospace', fontSize: 12,
  fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
