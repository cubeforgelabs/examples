import { useEffect, useRef, useState, useReducer, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS   = 10
const ROWS   = 8
const CELL   = 48
const GRID_W = COLS * CELL   // 480
const GRID_H = ROWS * CELL   // 384
const GAME_W = 600
const GAME_H = 520
const TOOLBAR_H = 48
const STAGE_DURATION = 5000  // 5 seconds per growth stage

// ─── Types ────────────────────────────────────────────────────────────────────
type TileState = 'empty' | 'tilled' | 'planted' | 'watered' | 'growing' | 'ready'
type CropType  = 'wheat' | 'tomato' | 'corn'
type Tool      = 'till' | 'plant' | 'water' | 'harvest'

interface Tile {
  state:      TileState
  crop:       CropType | null
  plantedAt:  number   // timestamp when planted
  stage:      number   // 0=seedling, 1=growing, 2=ready
  watered:    boolean
}

// ─── Crop config ──────────────────────────────────────────────────────────────
const CROP_CONFIG: Record<CropType, { color: string; readyColor: string; goldValue: number; seedCost: number; icon: string }> = {
  wheat:  { color: '#a5c41a', readyColor: '#f5c542', goldValue: 15, seedCost: 5,  icon: 'W' },
  tomato: { color: '#c04020', readyColor: '#ff6040', goldValue: 25, seedCost: 8,  icon: 'T' },
  corn:   { color: '#80a020', readyColor: '#ffd700', goldValue: 35, seedCost: 12, icon: 'C' },
}

// ─── Tile colors ─────────────────────────────────────────────────────────────
const TILE_COLORS: Record<TileState, string> = {
  empty:   '#1c1a0f',
  tilled:  '#3d2b0a',
  planted: '#4a3210',
  watered: '#2a4a1a',
  growing: '#3a5a1a',
  ready:   '#2a4a0a',
}

// ─── Initial grid ─────────────────────────────────────────────────────────────
function makeTiles(): Tile[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      state:     'empty' as TileState,
      crop:      null,
      plantedAt: 0,
      stage:     0,
      watered:   false,
    }))
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [tiles,     setTiles]     = useState<Tile[][]>(makeTiles)
  const [tool,      setTool]      = useState<Tool>('till')
  const [cropType,  setCropType]  = useState<CropType>('wheat')
  const [gold,      setGold]      = useState(50)
  const [day,       setDay]       = useState(1)
  const [harvested, setHarvested] = useState(0)
  const [, forceRender]           = useReducer(n => n + 1, 0)

  const tilesRef   = useRef<Tile[][]>(tiles)
  const goldRef    = useRef(50)
  const dayRef     = useRef(1)
  const cropRef    = useRef<CropType>('wheat')

  useEffect(() => { tilesRef.current = tiles }, [tiles])
  useEffect(() => { cropRef.current = cropType }, [cropType])

  // ── Growth tick: check every second ────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      let changed = false

      const newTiles = tilesRef.current.map(row =>
        row.map(tile => {
          if (tile.state !== 'planted' && tile.state !== 'watered' && tile.state !== 'growing') return tile

          const elapsed = now - tile.plantedAt
          const speedMult = tile.watered ? 1.5 : 1   // watered grows faster
          const stageDuration = STAGE_DURATION / speedMult
          const newStage = Math.min(2, Math.floor(elapsed / stageDuration))

          if (newStage !== tile.stage) {
            changed = true
            const newState: TileState = newStage >= 2 ? 'ready' : newStage === 1 ? 'growing' : tile.state
            return { ...tile, stage: newStage, state: newState }
          }
          return tile
        })
      )

      if (changed) {
        tilesRef.current = newTiles
        setTiles(newTiles)
      }

      // Day tick every 30 seconds
      const dayMs = 30000
      // simplified: day from day 1
    }, 500)

    // Day counter
    const dayId = setInterval(() => {
      dayRef.current++
      setDay(dayRef.current)
    }, 30000)

    return () => { clearInterval(id); clearInterval(dayId) }
  }, [])

  // ── Handle tile click ───────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x    = e.clientX - rect.left
    const y    = e.clientY - rect.top

    const col = Math.floor(x / CELL)
    const row = Math.floor(y / CELL)

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return

    const newTiles = tilesRef.current.map(r => r.map(t => ({ ...t })))
    const tile     = newTiles[row][col]
    let goldDelta  = 0
    let harvestDelta = 0

    if (tool === 'till') {
      if (tile.state === 'empty') {
        newTiles[row][col] = { ...tile, state: 'tilled' }
      } else if (tile.state === 'ready' || tile.state === 'growing' || tile.state === 'planted' || tile.state === 'watered' || tile.state === 'tilled') {
        // Can re-till to clear
        newTiles[row][col] = { state: 'tilled', crop: null, plantedAt: 0, stage: 0, watered: false }
      }
    } else if (tool === 'plant') {
      if (tile.state === 'tilled') {
        const cost = CROP_CONFIG[cropRef.current].seedCost
        if (goldRef.current >= cost) {
          goldDelta = -cost
          newTiles[row][col] = { state: 'planted', crop: cropRef.current, plantedAt: Date.now(), stage: 0, watered: false }
        }
      }
    } else if (tool === 'water') {
      if (tile.state === 'planted' || tile.state === 'growing') {
        newTiles[row][col] = { ...tile, state: 'watered', watered: true }
      }
    } else if (tool === 'harvest') {
      if (tile.state === 'ready' && tile.crop) {
        goldDelta    = CROP_CONFIG[tile.crop].goldValue
        harvestDelta = 1
        newTiles[row][col] = { state: 'tilled', crop: null, plantedAt: 0, stage: 0, watered: false }
      }
    }

    if (goldDelta !== 0) {
      goldRef.current += goldDelta
      setGold(goldRef.current)
    }
    if (harvestDelta > 0) setHarvested(h => h + harvestDelta)

    tilesRef.current = newTiles
    setTiles(newTiles)
    forceRender()
  }, [tool])

  // ── Build entities ──────────────────────────────────────────────────────
  const entities: JSX.Element[] = []

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = tiles[r][c]
      const px   = c * CELL + CELL / 2
      const py   = r * CELL + CELL / 2
      const key  = `tile-${r}-${c}`

      // Base tile
      entities.push(
        <Entity key={key} tags={['tile']}>
          <Transform x={px} y={py} />
          <Sprite width={CELL - 2} height={CELL - 2} color={TILE_COLORS[tile.state]} zIndex={1} />
        </Entity>
      )

      // Crop visual
      if (tile.crop && tile.state !== 'tilled') {
        const cfg = CROP_CONFIG[tile.crop]
        const cropColor = tile.state === 'ready' ? cfg.readyColor : cfg.color
        const cropSize  = tile.stage === 0 ? 10 : tile.stage === 1 ? 18 : 26

        entities.push(
          <Entity key={`${key}-crop`} tags={['crop']}>
            <Transform x={px} y={py} />
            <Sprite width={cropSize} height={cropSize} color={cropColor} zIndex={2} />
          </Entity>
        )

        // Watered indicator (blue dot)
        if (tile.watered && tile.state !== 'ready') {
          entities.push(
            <Entity key={`${key}-water`} tags={['water']}>
              <Transform x={px + CELL / 2 - 6} y={py - CELL / 2 + 6} />
              <Sprite width={6} height={6} color="#42a5f5" zIndex={3} />
            </Entity>
          )
        }
      }

      // Ready: glow effect (brighter border)
      if (tile.state === 'ready') {
        entities.push(
          <Entity key={`${key}-ready`} tags={['ready']}>
            <Transform x={px} y={py} />
            <Sprite width={CELL - 4} height={CELL - 4} color="transparent" zIndex={0} />
          </Entity>
        )
      }
    }
  }

  // Grid lines
  for (let i = 0; i <= COLS; i++) {
    entities.push(
      <Entity key={`gv${i}`} tags={['grid']}>
        <Transform x={i * CELL} y={GRID_H / 2} />
        <Sprite width={1} height={GRID_H} color="#0f0e08" zIndex={0} />
      </Entity>
    )
  }
  for (let i = 0; i <= ROWS; i++) {
    entities.push(
      <Entity key={`gh${i}`} tags={['grid']}>
        <Transform x={GRID_W / 2} y={i * CELL} />
        <Sprite width={GRID_W} height={1} color="#0f0e08" zIndex={0} />
      </Entity>
    )
  }

  const TOOL_COLORS: Record<Tool, string> = { till: '#a0724a', plant: '#66bb6a', water: '#42a5f5', harvest: '#ffd54f' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <div style={{
        width: GAME_W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        alignItems: 'center',
        padding: '7px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 12,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div>
          <div style={{ color: '#546e7a', fontSize: 10 }}>DAY</div>
          <div style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 15 }}>{day}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#546e7a', fontSize: 10 }}>GOLD</div>
          <div style={{ color: '#ffd54f', fontWeight: 700, fontSize: 18 }}>{gold}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#546e7a', fontSize: 10 }}>HARVESTED</div>
          <div style={{ color: '#66bb6a', fontWeight: 700, fontSize: 15 }}>{harvested}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#546e7a', fontSize: 10 }}>TOOL</div>
          <div style={{ color: TOOL_COLORS[tool], fontWeight: 700, fontSize: 12 }}>{tool.toUpperCase()}</div>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: GAME_W, height: GAME_H }}>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', background: 'rgba(10,12,22,0.93)',
          borderBottom: '1px solid #1e2535', height: TOOLBAR_H,
          flexWrap: 'nowrap', overflowX: 'auto',
        }}>
          {/* Tools */}
          <span style={{ fontSize: 10, color: '#37474f', letterSpacing: 2, flexShrink: 0 }}>ACTION:</span>
          {(['till', 'plant', 'water', 'harvest'] as Tool[]).map(t => (
            <button key={t} onClick={() => setTool(t)} style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 4, flexShrink: 0,
              border: `1px solid ${tool === t ? TOOL_COLORS[t] : '#1e2535'}`,
              background: tool === t ? `${TOOL_COLORS[t]}22` : '#111620',
              color: tool === t ? TOOL_COLORS[t] : '#546e7a',
              cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: tool === t ? 700 : 400,
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          <div style={{ width: 1, height: 24, background: '#1e2535', flexShrink: 0 }} />

          {/* Crop selection */}
          <span style={{ fontSize: 10, color: '#37474f', letterSpacing: 2, flexShrink: 0 }}>CROP:</span>
          {(['wheat', 'tomato', 'corn'] as CropType[]).map(ct => (
            <button key={ct} onClick={() => setCropType(ct)} style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 4, flexShrink: 0,
              border: `1px solid ${cropType === ct ? CROP_CONFIG[ct].readyColor : '#1e2535'}`,
              background: cropType === ct ? `${CROP_CONFIG[ct].readyColor}22` : '#111620',
              color: cropType === ct ? CROP_CONFIG[ct].readyColor : '#546e7a',
              cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: cropType === ct ? 700 : 400,
            }}>
              {CROP_CONFIG[ct].icon} {ct} (+{CROP_CONFIG[ct].goldValue}g, ${CROP_CONFIG[ct].seedCost})
            </button>
          ))}
        </div>

        {/* ── Game canvas ─────────────────────────────────────────────────── */}
        <div
          style={{ position: 'absolute', top: TOOLBAR_H, left: 0, width: GRID_W, height: GRID_H, cursor: 'pointer' }}
          onClick={handleClick}
        >
          <Game width={GRID_W} height={GRID_H} gravity={0}>
            <World background="#1c1a0f">
              <Camera2D x={GRID_W / 2} y={GRID_H / 2} background="#1c1a0f" />
              {entities}
            </World>
          </Game>
        </div>

        {/* ── Info sidebar ─────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: TOOLBAR_H, left: GRID_W, right: 0,
          height: GRID_H, background: '#0a0c14', padding: '14px 10px',
          fontFamily: '"Courier New", monospace', fontSize: 11, color: '#546e7a',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ color: '#37474f', letterSpacing: 2, fontSize: 10 }}>CROPS</div>

          {(['wheat', 'tomato', 'corn'] as CropType[]).map(ct => {
            const cfg = CROP_CONFIG[ct]
            return (
              <div key={ct}>
                <div style={{ color: cfg.readyColor, fontWeight: 700 }}>{cfg.icon} {ct.charAt(0).toUpperCase() + ct.slice(1)}</div>
                <div style={{ color: '#37474f', fontSize: 10, marginTop: 2 }}>Cost: {cfg.seedCost}g</div>
                <div style={{ color: '#37474f', fontSize: 10 }}>Yield: +{cfg.goldValue}g</div>
              </div>
            )
          })}

          <div style={{ borderTop: '1px solid #1a2130', paddingTop: 10, lineHeight: 1.8, color: '#37474f' }}>
            <div style={{ color: '#263238', letterSpacing: 2, fontSize: 10, marginBottom: 4 }}>HOW TO</div>
            <div>1. Till soil</div>
            <div>2. Plant seed</div>
            <div>3. Water it</div>
            <div>4. Harvest</div>
            <div style={{ marginTop: 6, color: '#1e2a3a', fontSize: 10 }}>
              Watered crops grow 1.5x faster
            </div>
          </div>

          {/* Growth stages legend */}
          <div style={{ borderTop: '1px solid #1a2130', paddingTop: 10, color: '#37474f', lineHeight: 1.8 }}>
            <div style={{ color: '#263238', fontSize: 10, marginBottom: 4 }}>STAGES</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, background: '#3d2b0a', border: '1px solid #a0724a' }} />
              <span>Tilled</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, background: '#a5c41a', borderRadius: '50%' }} />
              <span>Seedling</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, background: '#66bb6a', borderRadius: '50%' }} />
              <span>Growing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, background: '#ffd700', borderRadius: '50%' }} />
              <span style={{ color: '#ffd54f' }}>Ready!</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div style={{
        width: GAME_W,
        background: '#0d0f1a',
        borderRadius: '0 0 10px 10px',
        padding: '6px 18px',
        fontSize: 11,
        color: '#37474f',
        letterSpacing: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Till &rarr; Plant &rarr; Water (faster growth) &rarr; Harvest when golden</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}
