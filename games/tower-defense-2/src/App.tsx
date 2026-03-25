import { useState, useEffect, useCallback, useRef } from 'react'
import { Game, World, Entity, Transform, Sprite, Camera2D, Script } from '@cubeforge/react'
import { createTransform, createSprite, createTag } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W    = 700
const H    = 540
const CELL = 36
const COLS = Math.floor(W / CELL)   // 19
const ROWS = Math.floor(H / CELL)   // 15

// ─── Tower types ──────────────────────────────────────────────────────────────
type TowerType = 'basic' | 'sniper' | 'slow' | 'bomb'

interface TowerDef {
  label:    string
  color:    string
  cost:     number
  damage:   number
  range:    number
  fireRate: number   // shots per second
  slow?:    number   // speed multiplier when hit
  splash?:  number   // splash radius px
  upgradeCost: number
  upgradeDmg:  number
  upgradeRange:number
}

const TOWER_DEFS: Record<TowerType, TowerDef> = {
  basic:  { label: 'BASIC',   color: '#4fc3f7', cost: 25,  damage: 18,  range: 110, fireRate: 1.8, upgradeCost: 30,  upgradeDmg: 30,  upgradeRange: 130 },
  sniper: { label: 'SNIPER',  color: '#ffd54f', cost: 60,  damage: 80,  range: 200, fireRate: 0.5, upgradeCost: 60,  upgradeDmg: 150, upgradeRange: 240 },
  slow:   { label: 'SLOW',    color: '#ce93d8', cost: 45,  damage: 8,   range: 100, fireRate: 1.2, slow: 0.35, upgradeCost: 45,  upgradeDmg: 12,  upgradeRange: 120 },
  bomb:   { label: 'BOMB',    color: '#ff7043', cost: 75,  damage: 40,  range: 120, fireRate: 0.7, splash: 70, upgradeCost: 75,  upgradeDmg: 70,  upgradeRange: 140 },
}

// ─── Enemy types ──────────────────────────────────────────────────────────────
type EnemyType = 'basic' | 'tank' | 'flying'

interface EnemyDef {
  color:   string
  hpMult:  number
  speedMult: number
  goldReward: number
  immuneSlow: boolean // flying ignores slow
}

const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  basic:  { color: '#ef5350', hpMult: 1.0, speedMult: 1.0, goldReward: 10, immuneSlow: false },
  tank:   { color: '#78909c', hpMult: 3.5, speedMult: 0.55, goldReward: 20, immuneSlow: false },
  flying: { color: '#80cbc4', hpMult: 0.8, speedMult: 1.4, goldReward: 15, immuneSlow: true  },
}

// ─── Path waypoints (winding path) ────────────────────────────────────────────
const PATH_WAYPOINTS: [number, number][] = [
  [0,  2],
  [4,  2],
  [4,  6],
  [9,  6],
  [9,  2],
  [13, 2],
  [13, 8],
  [7,  8],
  [7,  12],
  [15, 12],
  [15, 8],
  [19, 8],
]

function gridToPixel(col: number, row: number): [number, number] {
  return [col * CELL + CELL / 2, row * CELL + CELL / 2]
}

function getPathCells(): Set<string> {
  const cells = new Set<string>()
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const [c1, r1] = PATH_WAYPOINTS[i]
    const [c2, r2] = PATH_WAYPOINTS[i + 1]
    if (c1 === c2) {
      const mn = Math.min(r1, r2), mx = Math.max(r1, r2)
      for (let r = mn; r <= mx; r++) cells.add(`${c1},${r}`)
    } else {
      const mn = Math.min(c1, c2), mx = Math.max(c1, c2)
      for (let c = mn; c <= mx; c++) cells.add(`${c},${r1}`)
    }
  }
  return cells
}

const PATH_CELLS = getPathCells()
const PIXEL_WAYPOINTS = PATH_WAYPOINTS.map(([c, r]) => gridToPixel(c, r))

// ─── Wave definitions (20 waves, 3 enemy types) ───────────────────────────────
interface WaveEnemyEntry { type: EnemyType; count: number }
interface WaveDef { enemies: WaveEnemyEntry[]; interval: number; baseHp: number; baseSpeed: number }

function buildWaves(): WaveDef[] {
  const waves: WaveDef[] = []
  for (let w = 0; w < 20; w++) {
    const diff = 1 + w * 0.18
    const baseHp    = Math.round(50 * diff)
    const baseSpeed = Math.round(55 + w * 3)
    const interval  = Math.max(0.35, 1.1 - w * 0.035)
    let enemies: WaveEnemyEntry[]
    if (w < 3) {
      enemies = [{ type: 'basic', count: 6 + w * 2 }]
    } else if (w < 6) {
      enemies = [{ type: 'basic', count: 8 + w }, { type: 'tank', count: 2 + w - 3 }]
    } else if (w < 10) {
      enemies = [
        { type: 'basic',  count: 8 + w },
        { type: 'tank',   count: 3 + w - 6 },
        { type: 'flying', count: 2 + w - 6 },
      ]
    } else if (w < 15) {
      enemies = [
        { type: 'basic',  count: 10 + w },
        { type: 'tank',   count: 4 + (w - 10) },
        { type: 'flying', count: 5 + (w - 10) },
      ]
    } else {
      enemies = [
        { type: 'basic',  count: 12 + w },
        { type: 'tank',   count: 6 + (w - 15) },
        { type: 'flying', count: 8 + (w - 15) },
      ]
    }
    waves.push({ enemies, interval, baseHp, baseSpeed })
  }
  return waves
}

const WAVES = buildWaves()

// ─── Shared runtime state (ECS side) ──────────────────────────────────────────
interface EnemyState {
  hp:          number
  maxHp:       number
  speed:       number
  baseSpeed:   number
  waypointIdx: number
  slowTimer:   number
  tag:         string
  eType:       EnemyType
}

interface BulletState {
  targetTag: string
  damage:    number
  speed:     number
  slow?:     number
  splash?:   number
  immuneSlow: boolean
}

interface TowerRtState {
  type:    TowerType
  level:   number   // 0 = base, 1 = upgraded
  cooldown: number
}

const enemyStates  = new Map<EntityId, EnemyState>()
const bulletStates = new Map<EntityId, BulletState>()
const towerRtStates = new Map<EntityId, TowerRtState>()

// ─── Manager state ────────────────────────────────────────────────────────────
interface SpawnEntry { type: EnemyType; hp: number; speed: number }

interface ManagerState {
  spawnQueue:    SpawnEntry[]
  spawnTimer:    number
  spawnInterval: number
  waveActive:    boolean
  enemyCounter:  number
  bulletCounter: number
}

const managerStates = new Map<EntityId, ManagerState>()

// React event callbacks
const tdEvents = {
  onEnemyKilled:  null as ((gold: number) => void) | null,
  onLifeLost:     null as (() => void) | null,
  onWaveCleared:  null as (() => void) | null,
}

// ─── Script: manager update ───────────────────────────────────────────────────
function managerInit(id: EntityId, _world: ECSWorld) {
  managerStates.set(id, {
    spawnQueue:    [],
    spawnTimer:    0,
    spawnInterval: 1,
    waveActive:    false,
    enemyCounter:  0,
    bulletCounter: 0,
  })
}

function managerUpdate(id: EntityId, world: ECSWorld, _input: InputManager, dt: number) {
  if (!world.hasEntity(id)) return
  const state = managerStates.get(id)
  if (!state) return

  // Spawn from queue
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt
    if (state.spawnTimer <= 0) {
      state.spawnTimer = state.spawnInterval
      const entry = state.spawnQueue.shift()!
      state.enemyCounter++
      const tag = `enemy-${state.enemyCounter}`
      const [sx, sy] = PIXEL_WAYPOINTS[0]
      const def = ENEMY_DEFS[entry.type]
      const eid = world.createEntity()
      world.addComponent(eid, createTag(tag, 'enemy'))
      world.addComponent(eid, createTransform(sx, sy))
      world.addComponent(eid, createSprite({ width: entry.type === 'tank' ? 30 : 22, height: entry.type === 'tank' ? 30 : 22, color: def.color, zIndex: 20 }))
      enemyStates.set(eid, {
        hp:          entry.hp,
        maxHp:       entry.hp,
        speed:       entry.speed,
        baseSpeed:   entry.speed,
        waypointIdx: 1,
        slowTimer:   0,
        tag,
        eType:       entry.type,
      })
    }
  }

  // Check wave cleared
  if (state.waveActive && state.spawnQueue.length === 0) {
    let alive = 0
    for (const [eid] of enemyStates) { if (world.hasEntity(eid)) alive++ }
    if (alive === 0) {
      state.waveActive = false
      tdEvents.onWaveCleared?.()
    }
  }

  // Move enemies
  for (const [eid, es] of enemyStates) {
    if (!world.hasEntity(eid)) { enemyStates.delete(eid); continue }
    const tf = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!tf) continue

    if (es.slowTimer > 0) {
      es.slowTimer -= dt
      if (es.slowTimer <= 0) es.speed = es.baseSpeed
    }

    if (es.waypointIdx >= PIXEL_WAYPOINTS.length) {
      world.destroyEntity(eid)
      enemyStates.delete(eid)
      tdEvents.onLifeLost?.()
      continue
    }

    const [tx, ty] = PIXEL_WAYPOINTS[es.waypointIdx]
    const dx = tx - tf.x, dy = ty - tf.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 2) {
      es.waypointIdx++
    } else {
      const step = es.speed * dt
      tf.x += (dx / dist) * Math.min(step, dist)
      tf.y += (dy / dist) * Math.min(step, dist)
    }
  }

  // Tower shooting
  for (const [tid, ts] of towerRtStates) {
    if (!world.hasEntity(tid)) { towerRtStates.delete(tid); continue }
    const def   = TOWER_DEFS[ts.type]
    const range = ts.level > 0 ? def.upgradeRange : def.range
    const dmg   = ts.level > 0 ? def.upgradeDmg  : def.damage
    const rate  = def.fireRate * (ts.level > 0 ? 1.3 : 1)

    ts.cooldown -= dt
    if (ts.cooldown > 0) continue

    const ttf = world.getComponent<TransformComponent>(tid, 'Transform')
    if (!ttf) continue

    // Find nearest enemy in range (prefer furthest along path)
    let bestWp = -1
    let bestEid: EntityId | null = null
    let bestDist = Infinity
    for (const [eid, es] of enemyStates) {
      if (!world.hasEntity(eid)) continue
      const etf = world.getComponent<TransformComponent>(eid, 'Transform')
      if (!etf) continue
      const dx = etf.x - ttf.x, dy = etf.y - ttf.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= range) {
        if (es.waypointIdx > bestWp || (es.waypointIdx === bestWp && d < bestDist)) {
          bestWp = es.waypointIdx; bestDist = d; bestEid = eid
        }
      }
    }

    if (bestEid != null) {
      ts.cooldown = 1 / rate
      const es = enemyStates.get(bestEid)
      if (!es) continue

      state.bulletCounter++
      const bid = world.createEntity()
      const bColor = ts.type === 'bomb' ? '#ff7043' : ts.type === 'sniper' ? '#ffd54f' : ts.type === 'slow' ? '#ce93d8' : '#ffffff'
      world.addComponent(bid, createTag(`bullet-${state.bulletCounter}`, 'bullet'))
      world.addComponent(bid, createTransform(ttf.x, ttf.y))
      world.addComponent(bid, createSprite({ width: ts.type === 'bomb' ? 9 : 5, height: ts.type === 'bomb' ? 9 : 5, color: bColor, zIndex: 25 }))
      bulletStates.set(bid, {
        targetTag:  es.tag,
        damage:     dmg,
        speed:      ts.type === 'sniper' ? 450 : 280,
        slow:       def.slow,
        splash:     def.splash,
        immuneSlow: false,
      })
    }
  }

  // Move bullets
  for (const [bid, bs] of bulletStates) {
    if (!world.hasEntity(bid)) { bulletStates.delete(bid); continue }
    const btf = world.getComponent<TransformComponent>(bid, 'Transform')
    if (!btf) { bulletStates.delete(bid); continue }

    const targetId = world.findByTag(bs.targetTag)
    if (!targetId || !world.hasEntity(targetId)) {
      world.destroyEntity(bid); bulletStates.delete(bid); continue
    }
    const etf = world.getComponent<TransformComponent>(targetId, 'Transform')
    if (!etf) { world.destroyEntity(bid); bulletStates.delete(bid); continue }

    const dx = etf.x - btf.x, dy = etf.y - btf.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 8) {
      world.destroyEntity(bid); bulletStates.delete(bid)

      if (bs.splash) {
        for (const [eid, es] of enemyStates) {
          if (!world.hasEntity(eid)) continue
          const ef = world.getComponent<TransformComponent>(eid, 'Transform')
          if (!ef) continue
          const sdx = ef.x - etf.x, sdy = ef.y - etf.y
          if (Math.sqrt(sdx * sdx + sdy * sdy) <= bs.splash) {
            applyDamage(eid, es, bs.damage, world)
            if (bs.slow && !es.immuneSlow) { es.speed = es.baseSpeed * bs.slow; es.slowTimer = 2 }
          }
        }
      } else {
        const es = enemyStates.get(targetId)
        if (es) {
          applyDamage(targetId, es, bs.damage, world)
          if (bs.slow && !es.immuneSlow && es.hp > 0) { es.speed = es.baseSpeed * bs.slow; es.slowTimer = 2 }
        }
      }
    } else {
      const step = bs.speed * dt
      btf.x += (dx / dist) * Math.min(step, dist)
      btf.y += (dy / dist) * Math.min(step, dist)
    }
  }
}

function applyDamage(eid: EntityId, es: EnemyState, dmg: number, world: ECSWorld) {
  es.hp -= dmg
  if (es.hp <= 0) {
    world.destroyEntity(eid); enemyStates.delete(eid)
    tdEvents.onEnemyKilled?.(ENEMY_DEFS[es.eType].goldReward)
  } else {
    const ratio = es.hp / es.maxHp
    const base = ENEMY_DEFS[es.eType].color
    const sprite = world.getComponent(eid, 'Sprite') as { color: string } | undefined
    if (sprite) {
      // Darken toward red as HP drops
      const r = parseInt(base.slice(1,3), 16)
      const g = Math.round(parseInt(base.slice(3,5), 16) * ratio)
      const b = Math.round(parseInt(base.slice(5,7), 16) * ratio)
      sprite.color = `rgb(${r},${g},${b})`
    }
  }
}

export function startWave(waveIndex: number) {
  for (const [, state] of managerStates) {
    if (waveIndex >= WAVES.length) return
    const wave   = WAVES[waveIndex]
    const queue: SpawnEntry[] = []
    for (const entry of wave.enemies) {
      const def = ENEMY_DEFS[entry.type]
      for (let i = 0; i < entry.count; i++) {
        queue.push({
          type:  entry.type,
          hp:    Math.round(wave.baseHp * def.hpMult),
          speed: Math.round(wave.baseSpeed * def.speedMult),
        })
      }
    }
    // Shuffle queue for mixed spawning
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]]
    }
    state.spawnQueue    = queue
    state.spawnTimer    = 0.3
    state.spawnInterval = wave.interval
    state.waveActive    = true
  }
}

export function clearAllState() {
  enemyStates.clear(); bulletStates.clear()
  towerRtStates.clear(); managerStates.clear()
}

// Upgrade a tower by EntityId
export function upgradeTower(id: EntityId) {
  const ts = towerRtStates.get(id)
  if (ts && ts.level === 0) { ts.level = 1 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function PathCellComp({ col, row }: { col: number; row: number }) {
  const [x, y] = gridToPixel(col, row)
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={CELL} height={CELL} color="#1a2218" zIndex={1} />
    </Entity>
  )
}

interface TowerEntityProps { col: number; row: number; type: TowerType; entityKey: string; level: number }

function towerScriptInit(id: EntityId, world: ECSWorld) {
  const sprite = world.getComponent<{ color: string }>(id, 'Sprite')
  if (!sprite) return
  let type: TowerType = 'basic'
  if (sprite.color === TOWER_DEFS.sniper.color) type = 'sniper'
  else if (sprite.color === TOWER_DEFS.slow.color)   type = 'slow'
  else if (sprite.color === TOWER_DEFS.bomb.color)   type = 'bomb'
  towerRtStates.set(id, { type, level: 0, cooldown: 0 })
}

function TowerEntityComp({ col, row, type, entityKey, level }: TowerEntityProps) {
  const [x, y] = gridToPixel(col, row)
  const def = TOWER_DEFS[type]
  const color = level > 0 ? lighten(def.color) : def.color
  return (
    <Entity id={entityKey} tags={[entityKey]}>
      <Transform x={x} y={y} />
      <Sprite width={28} height={28} color={color} zIndex={10} />
      <Script init={towerScriptInit} update={() => {}} />
    </Entity>
  )
}

function lighten(hex: string): string {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + 50)
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + 50)
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + 50)
  return `rgb(${r},${g},${b})`
}

function GameManagerComp() {
  return (
    <Entity id="td2-manager">
      <Transform x={0} y={0} />
      <Script init={managerInit} update={managerUpdate} />
    </Entity>
  )
}

// ─── Main app state types ─────────────────────────────────────────────────────
type GamePhase = 'prep' | 'wave' | 'gameover' | 'victory'

interface TowerPlacement {
  col: number; row: number; type: TowerType; key: string; level: number
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,       setGameKey]       = useState(0)
  const [gold,          setGold]          = useState(120)
  const [lives,         setLives]         = useState(20)
  const [wave,          setWave]          = useState(0)
  const [phase,         setPhase]         = useState<GamePhase>('prep')
  const [towers,        setTowers]        = useState<TowerPlacement[]>([])
  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null)
  const [hoveredCell,   setHoveredCell]   = useState<[number,number] | null>(null)
  const [selectedTowerKey, setSelectedTowerKey] = useState<string | null>(null)
  const towerCountRef = useRef(0)

  // Wire game events
  useEffect(() => {
    tdEvents.onEnemyKilled = (reward: number) => setGold(g => g + reward)
    tdEvents.onLifeLost    = () => {
      setLives(prev => {
        const next = Math.max(0, prev - 1)
        if (next <= 0) setPhase('gameover')
        return next
      })
    }
    tdEvents.onWaveCleared = () => {
      setWave(w => {
        const next = w + 1
        if (next >= WAVES.length) setPhase('victory')
        else setPhase('prep')
        return next
      })
    }
    return () => {
      tdEvents.onEnemyKilled = null
      tdEvents.onLifeLost    = null
      tdEvents.onWaveCleared = null
    }
  }, [gameKey])

  const canPlace = (col: number, row: number) =>
    !PATH_CELLS.has(`${col},${row}`) && !towers.some(t => t.col === col && t.row === row)

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col  = Math.floor((e.clientX - rect.left)  / CELL)
    const row  = Math.floor((e.clientY - rect.top)   / CELL)
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return

    // Check if clicking an existing tower (for selection/upgrade)
    const existing = towers.find(t => t.col === col && t.row === row)
    if (existing) {
      setSelectedTowerKey(existing.key === selectedTowerKey ? null : existing.key)
      return
    }

    if (phase !== 'prep' || !selectedTower) {
      setSelectedTowerKey(null)
      return
    }
    if (!canPlace(col, row)) return
    const def = TOWER_DEFS[selectedTower]
    if (gold < def.cost) return

    towerCountRef.current++
    const key = `tower-${towerCountRef.current}`
    setTowers(prev => [...prev, { col, row, type: selectedTower, key, level: 0 }])
    setGold(g => g - def.cost)
    setSelectedTowerKey(null)
  }, [phase, selectedTower, towers, gold, selectedTowerKey])

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col  = Math.floor((e.clientX - rect.left) / CELL)
    const row  = Math.floor((e.clientY - rect.top)  / CELL)
    setHoveredCell(col >= 0 && col < COLS && row >= 0 && row < ROWS ? [col, row] : null)
  }, [])

  const handleUpgrade = () => {
    if (!selectedTowerKey) return
    const tower = towers.find(t => t.key === selectedTowerKey)
    if (!tower || tower.level > 0) return
    const cost = TOWER_DEFS[tower.type].upgradeCost
    if (gold < cost) return
    setGold(g => g - cost)
    setTowers(prev => prev.map(t => t.key === selectedTowerKey ? { ...t, level: 1 } : t))
    // Tell the ECS side
    upgradeTower(selectedTowerKey as unknown as EntityId)
    setSelectedTowerKey(null)
  }

  function handleStartWave() {
    if (phase !== 'prep' || wave >= WAVES.length) return
    setPhase('wave')
    setSelectedTowerKey(null)
    startWave(wave)
  }

  function restart() {
    clearAllState()
    towerCountRef.current = 0
    setGold(120); setLives(20); setWave(0)
    setPhase('prep'); setTowers([]); setSelectedTower(null)
    setSelectedTowerKey(null); setGameKey(k => k + 1)
  }

  const selectedTowerData = selectedTowerKey ? towers.find(t => t.key === selectedTowerKey) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Courier New", monospace', background: '#080c12' }}>

      {/* HUD */}
      <div style={{ width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', padding: '8px 16px', background: '#0a0e18', borderRadius: '10px 10px 0 0', fontSize: 13, userSelect: 'none' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ color: '#ffd54f', fontWeight: 700 }}>Gold: {gold}</span>
          <span style={{ color: '#ef5350', fontWeight: 700 }}>Lives: {lives}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#37474f', letterSpacing: 4 }}>TOWER DEFENSE II</div>
        <div style={{ textAlign: 'right', color: '#4fc3f7', fontSize: 13 }}>
          Wave {Math.min(wave + 1, WAVES.length)}/{WAVES.length}
        </div>
      </div>

      {/* Canvas area */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: selectedTower && phase === 'prep' ? 'crosshair' : 'default' }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMove}
        onMouseLeave={() => setHoveredCell(null)}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0b120a">
            <Camera2D x={W / 2} y={H / 2} background="#0b120a" />
            <GameManagerComp key="manager" />

            {/* Grid lines */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <Entity key={`vl${i}`}><Transform x={i * CELL} y={H / 2} /><Sprite width={1} height={H} color="#111a10" zIndex={0} /></Entity>
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <Entity key={`hl${i}`}><Transform x={W / 2} y={i * CELL} /><Sprite width={W} height={1} color="#111a10" zIndex={0} /></Entity>
            ))}

            {/* Path */}
            {Array.from(PATH_CELLS).map(k => {
              const [c, r] = k.split(',').map(Number)
              return <PathCellComp key={k} col={c} row={r} />
            })}

            {/* Towers */}
            {towers.map(t => (
              <TowerEntityComp key={t.key} col={t.col} row={t.row} type={t.type} entityKey={t.key} level={t.level} />
            ))}
          </World>
        </Game>

        {/* Placement preview */}
        {selectedTower && hoveredCell && phase === 'prep' && (() => {
          const [hc, hr] = hoveredCell
          const valid = canPlace(hc, hr) && gold >= TOWER_DEFS[selectedTower].cost
          const [px, py] = gridToPixel(hc, hr)
          const range = TOWER_DEFS[selectedTower].range
          return (
            <>
              <div style={{ position: 'absolute', left: px - range, top: py - range, width: range * 2, height: range * 2, borderRadius: '50%', border: `1px solid ${valid ? 'rgba(255,255,255,0.12)' : 'rgba(255,80,80,0.2)'}`, background: valid ? 'rgba(255,255,255,0.02)' : 'rgba(255,0,0,0.04)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: hc * CELL, top: hr * CELL, width: CELL, height: CELL, background: valid ? 'rgba(79,195,247,0.22)' : 'rgba(239,83,80,0.22)', border: `2px solid ${valid ? '#4fc3f7' : '#ef5350'}`, pointerEvents: 'none' }} />
            </>
          )
        })()}

        {/* Tower selection / upgrade overlay */}
        {selectedTowerData && (
          <div style={{
            position: 'absolute',
            left: Math.min(selectedTowerData.col * CELL + 4, W - 160),
            top: Math.max(0, selectedTowerData.row * CELL - 90),
            background: '#0d1117',
            border: '1px solid #263238',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 11,
            color: '#90a4ae',
            pointerEvents: 'auto',
            zIndex: 50,
            minWidth: 140,
          }}>
            <div style={{ color: TOWER_DEFS[selectedTowerData.type].color, fontWeight: 700, marginBottom: 4 }}>
              {TOWER_DEFS[selectedTowerData.type].label} {selectedTowerData.level > 0 ? '★ LV2' : 'LV1'}
            </div>
            <div>DMG: {selectedTowerData.level > 0 ? TOWER_DEFS[selectedTowerData.type].upgradeDmg : TOWER_DEFS[selectedTowerData.type].damage}</div>
            <div>RNG: {selectedTowerData.level > 0 ? TOWER_DEFS[selectedTowerData.type].upgradeRange : TOWER_DEFS[selectedTowerData.type].range}px</div>
            {selectedTowerData.level === 0 && (
              <button
                onClick={e => { e.stopPropagation(); handleUpgrade() }}
                disabled={gold < TOWER_DEFS[selectedTowerData.type].upgradeCost}
                style={{ marginTop: 8, padding: '4px 10px', background: gold >= TOWER_DEFS[selectedTowerData.type].upgradeCost ? '#ffd54f' : '#263238', color: '#0a0a0f', border: 'none', borderRadius: 4, fontFamily: '"Courier New", monospace', fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}
              >
                UPGRADE ({TOWER_DEFS[selectedTowerData.type].upgradeCost}g)
              </button>
            )}
          </div>
        )}

        {/* Game over */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>GAME OVER</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#ef5350', letterSpacing: 3 }}>DEFEATED</p>
              <p style={{ fontSize: 12, color: '#90a4ae', margin: '10px 0 4px' }}>Survived {wave} wave{wave !== 1 ? 's' : ''}</p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* Victory */}
        {phase === 'victory' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 10, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>ALL 20 WAVES CLEARED</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: '#4fc3f7', letterSpacing: 3 }}>VICTORY!</p>
              <p style={{ fontSize: 12, color: '#90a4ae', margin: '10px 0 4px' }}>Gold: {gold} — Lives: {lives}</p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* Tower bar */}
      <div style={{ width: W, background: '#0a0e18', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}>
        <span style={{ fontSize: 10, color: '#37474f', letterSpacing: 2 }}>PLACE:</span>
        {(['basic', 'sniper', 'slow', 'bomb'] as TowerType[]).map(type => {
          const def = TOWER_DEFS[type]
          const sel = selectedTower === type
          const afford = gold >= def.cost
          return (
            <button
              key={type}
              onClick={() => { setSelectedTower(sel ? null : type); setSelectedTowerKey(null) }}
              disabled={phase !== 'prep'}
              style={{ padding: '5px 10px', background: sel ? def.color : '#111820', color: sel ? '#0a0a0f' : (afford ? def.color : '#37474f'), border: `1px solid ${sel ? def.color : (afford ? def.color + '55' : '#1e2535')}`, borderRadius: 5, fontFamily: '"Courier New", monospace', fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: phase === 'prep' ? 'pointer' : 'default', opacity: phase !== 'prep' ? 0.4 : 1, transition: 'all 0.12s' }}
            >
              {def.label} ({def.cost}g)
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        {phase === 'prep' && wave < WAVES.length && (
          <button onClick={handleStartWave} style={{ padding: '7px 20px', background: '#4caf50', color: '#0a0a0f', border: 'none', borderRadius: 5, fontFamily: '"Courier New", monospace', fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }}>
            SEND WAVE {wave + 1}
          </button>
        )}
        {phase === 'wave' && (
          <span style={{ fontSize: 11, color: '#ff9800', letterSpacing: 2 }}>WAVE IN PROGRESS...</span>
        )}
      </div>

      {/* Info bar */}
      <div style={{ width: W, background: '#0a0e18', borderRadius: '0 0 10px 10px', padding: '5px 16px', fontSize: 10, color: '#263238', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {selectedTower
            ? `${TOWER_DEFS[selectedTower].label}: DMG ${TOWER_DEFS[selectedTower].damage} | RNG ${TOWER_DEFS[selectedTower].range} | RATE ${TOWER_DEFS[selectedTower].fireRate}/s${TOWER_DEFS[selectedTower].slow ? ` | SLOW ${Math.round((1-TOWER_DEFS[selectedTower].slow!)*100)}%` : ''}${TOWER_DEFS[selectedTower].splash ? ` | SPLASH ${TOWER_DEFS[selectedTower].splash}px` : ''}`
            : 'Select tower type → click grid to place | Click tower to inspect/upgrade'}
        </span>
        <span>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(8,12,18,0.85)', backdropFilter: 'blur(4px)', zIndex: 100,
}

const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace',
  padding: '32px 44px', background: '#0d1117', border: '1px solid #1e2535', borderRadius: 12,
}

const btnStyle: React.CSSProperties = {
  marginTop: 20, padding: '9px 28px', background: '#4fc3f7', color: '#0a0a0f',
  border: 'none', borderRadius: 5, fontFamily: '"Courier New", monospace',
  fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
