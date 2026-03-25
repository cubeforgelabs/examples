import { useEffect, useRef, useState, useReducer, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS    = 16
const ROWS    = 12
const CELL    = 36
const W       = COLS * CELL   // 576 + toolbar area = 700
const GAME_W  = 700
const H       = ROWS * CELL   // 432 + HUD = 560
const GAME_H  = 560
const GRID_W  = COLS * CELL   // 576
const GRID_H  = ROWS * CELL   // 432
const GRID_OFFSET_Y = 44      // HUD bar height

// ─── Types ────────────────────────────────────────────────────────────────────
type ZoneType = 'empty' | 'road' | 'residential' | 'commercial' | 'industrial'
type Speed    = 'paused' | 'normal' | 'fast'
type Tool     = 'residential' | 'commercial' | 'industrial' | 'road' | 'demolish'

interface Cell {
  type:  ZoneType
  value: number   // 0-100 property value
  level: number   // 0-3 development level
}

// ─── Zone config ──────────────────────────────────────────────────────────────
const ZONE_COLORS: Record<ZoneType, string> = {
  empty:       '#1a2130',
  road:        '#3a3a3a',
  residential: '#2d6a2d',
  commercial:  '#1a4d7a',
  industrial:  '#7a5a1a',
}
const ZONE_LABEL_COLORS: Record<ZoneType, string> = {
  empty:       '#2a3140',
  road:        '#555',
  residential: '#4caf50',
  commercial:  '#42a5f5',
  industrial:  '#ffb300',
}
const TOOL_ICONS: Record<Tool, string> = {
  residential: 'R',
  commercial:  'C',
  industrial:  'I',
  road:        '/',
  demolish:    'X',
}
const TOOL_COLORS: Record<Tool, string> = {
  residential: '#4caf50',
  commercial:  '#42a5f5',
  industrial:  '#ffb300',
  road:        '#aaa',
  demolish:    '#ef5350',
}

// ─── Initial grid ─────────────────────────────────────────────────────────────
function makeGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ type: 'empty' as ZoneType, value: 50, level: 0 }))
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isAdjacentTo(grid: Cell[][], row: number, col: number, type: ZoneType): boolean {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  return dirs.some(([dr, dc]) => {
    const r = row + dr, c = col + dc
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c].type === type
  })
}

function countAdjacent(grid: Cell[][], row: number, col: number, type: ZoneType): number {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  return dirs.filter(([dr, dc]) => {
    const r = row + dr, c = col + dc
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c].type === type
  }).length
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [grid,       setGrid]       = useState<Cell[][]>(makeGrid)
  const [tool,       setTool]       = useState<Tool>('residential')
  const [speed,      setSpeed]      = useState<Speed>('normal')
  const [population, setPopulation] = useState(0)
  const [money,      setMoney]      = useState(5000)
  const [happiness,  setHappiness]  = useState(50)
  const [day,        setDay]        = useState(1)
  const [, forceRender]             = useReducer(n => n + 1, 0)

  const gridRef    = useRef<Cell[][]>(grid)
  const moneyRef   = useRef(5000)
  const popRef     = useRef(0)
  const happyRef   = useRef(50)
  const dayRef     = useRef(1)
  const speedRef   = useRef<Speed>('normal')

  // Keep refs in sync
  useEffect(() => { gridRef.current = grid }, [grid])
  useEffect(() => { speedRef.current = speed }, [speed])

  // ── Simulation tick ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (speedRef.current === 'paused') return
      const g = gridRef.current
      let pop = 0
      let income = 0
      let pollution = 0
      let services = 0

      // Count zones
      let resCount = 0
      let comCount = 0
      let indCount = 0

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = g[r][c]
          if (cell.type === 'residential') resCount++
          if (cell.type === 'commercial')  comCount++
          if (cell.type === 'industrial')  indCount++
        }
      }

      // Update each cell
      const newGrid = g.map((row, r) => row.map((cell, c) => {
        if (cell.type === 'empty' || cell.type === 'road') return cell

        const nearRoad = isAdjacentTo(g, r, c, 'road')
        const nearCom  = countAdjacent(g, r, c, 'commercial')
        const nearInd  = countAdjacent(g, r, c, 'industrial')

        if (cell.type === 'residential') {
          // Grows if near commercial and road; hurt by industrial
          const growth = nearRoad ? (nearCom * 5 - nearInd * 8) : -2
          const newVal = Math.max(5, Math.min(100, cell.value + growth * 0.1))
          const newLvl = newVal > 80 ? 3 : newVal > 50 ? 2 : newVal > 20 ? 1 : 0
          const residents = Math.floor(newVal * 0.5 * (newLvl + 1))
          pop += residents
          return { ...cell, value: newVal, level: newLvl }
        }

        if (cell.type === 'commercial') {
          const nearRes = countAdjacent(g, r, c, 'residential')
          const growth  = nearRoad ? nearRes * 3 - nearInd * 2 : -1
          const newVal  = Math.max(5, Math.min(100, cell.value + growth * 0.08))
          const newLvl  = newVal > 75 ? 3 : newVal > 50 ? 2 : newVal > 25 ? 1 : 0
          const rev     = Math.floor(newVal * 0.3 * (newLvl + 1))
          income += rev
          services += newLvl
          return { ...cell, value: newVal, level: newLvl }
        }

        if (cell.type === 'industrial') {
          const newLvl = cell.value > 60 ? 2 : cell.value > 30 ? 1 : 0
          const rev    = Math.floor(cell.value * 0.4 * (newLvl + 1))
          income += rev
          pollution += (newLvl + 1) * 3
          return { ...cell, level: newLvl }
        }

        return cell
      }))

      // Economy: maintenance costs
      const maintenance = resCount * 2 + comCount * 3 + indCount * 2
      const netIncome   = income - maintenance
      moneyRef.current  = Math.max(0, moneyRef.current + netIncome)

      // Population
      popRef.current = pop

      // Happiness: services help, pollution hurts
      const rawHappy = 50 + services * 2 - pollution * 0.5 + (pop > 0 ? 5 : 0)
      happyRef.current = Math.max(0, Math.min(100, rawHappy))

      dayRef.current++

      setGrid(newGrid)
      setMoney(Math.floor(moneyRef.current))
      setPopulation(popRef.current)
      setHappiness(Math.floor(happyRef.current))
      setDay(dayRef.current)
    }

    const interval = speedRef.current === 'fast' ? 500 : 1500
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [speed])

  // ── Click to place zone ─────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x    = e.clientX - rect.left
    const y    = e.clientY - rect.top - GRID_OFFSET_Y

    if (y < 0) return

    const col = Math.floor(x / CELL)
    const row = Math.floor(y / CELL)

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return

    const costs: Record<Tool, number> = {
      residential: 200,
      commercial:  300,
      industrial:  250,
      road:        50,
      demolish:    0,
    }

    const cost = costs[tool]
    if (tool !== 'demolish' && moneyRef.current < cost) return

    const newGrid = gridRef.current.map(r => [...r.map(c => ({ ...c }))])

    if (tool === 'demolish') {
      newGrid[row][col] = { type: 'empty', value: 50, level: 0 }
    } else {
      const zoneType = tool as ZoneType
      if (newGrid[row][col].type === zoneType) return
      newGrid[row][col] = { type: zoneType, value: 50, level: 0 }
      moneyRef.current -= cost
      setMoney(Math.floor(moneyRef.current))
    }

    gridRef.current = newGrid
    setGrid(newGrid)
    forceRender()
  }, [tool])

  // ── Render grid cells as Cubeforge entities ─────────────────────────────
  const entities: JSX.Element[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell  = grid[r][c]
      const px    = c * CELL + CELL / 2
      const py    = r * CELL + CELL / 2
      const color = ZONE_COLORS[cell.type]
      const border = ZONE_LABEL_COLORS[cell.type]
      const key   = `cell-${r}-${c}`

      // Base tile
      entities.push(
        <Entity key={key} tags={['cell']}>
          <Transform x={px} y={py} />
          <Sprite width={CELL - 1} height={CELL - 1} color={color} zIndex={1} />
        </Entity>
      )

      // Level indicator: brighter inner block for developed zones
      if (cell.type !== 'empty' && cell.type !== 'road' && cell.level > 0) {
        const innerSize = 8 + cell.level * 6
        entities.push(
          <Entity key={`${key}-inner`} tags={['level']}>
            <Transform x={px} y={py} />
            <Sprite width={innerSize} height={innerSize} color={border} zIndex={2} />
          </Entity>
        )
      }

      // Road: center stripe
      if (cell.type === 'road') {
        entities.push(
          <Entity key={`${key}-road`} tags={['road']}>
            <Transform x={px} y={py} />
            <Sprite width={CELL - 12} height={CELL - 12} color="#555" zIndex={2} />
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
        <Sprite width={1} height={GRID_H} color="#111820" zIndex={0} />
      </Entity>
    )
  }
  for (let i = 0; i <= ROWS; i++) {
    entities.push(
      <Entity key={`gh${i}`} tags={['grid']}>
        <Transform x={GRID_W / 2} y={i * CELL} />
        <Sprite width={GRID_W} height={1} color="#111820" zIndex={0} />
      </Entity>
    )
  }

  const happinessColor = happiness > 65 ? '#4caf50' : happiness > 35 ? '#ffb300' : '#ef5350'
  const speedLabel: Record<Speed, string> = { paused: '⏸ PAUSED', normal: '▶ NORMAL', fast: '⏩ FAST' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <div style={{
        width: GAME_W,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        padding: '7px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 12,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
        gap: 8,
      }}>
        <div>
          <div style={{ color: '#546e7a', fontSize: 10 }}>DAY</div>
          <div style={{ color: '#4fc3f7', fontWeight: 700, fontSize: 15 }}>{day}</div>
        </div>
        <div>
          <div style={{ color: '#546e7a', fontSize: 10 }}>POP</div>
          <div style={{ color: '#4caf50', fontWeight: 700, fontSize: 15 }}>{population.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#546e7a', fontSize: 10 }}>MONEY</div>
          <div style={{ color: '#ffd54f', fontWeight: 700, fontSize: 16 }}>${money.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: '#546e7a', fontSize: 10 }}>HAPPINESS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, height: 6, background: '#1a2130', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${happiness}%`, height: '100%', background: happinessColor, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <span style={{ color: happinessColor, fontSize: 11 }}>{happiness}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#546e7a', fontSize: 10 }}>SPEED</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
            {(['paused', 'normal', 'fast'] as Speed[]).map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={{
                padding: '2px 6px', fontSize: 10, borderRadius: 3, border: 'none',
                background: speed === s ? '#4fc3f7' : '#1e2535',
                color: speed === s ? '#0a0a0f' : '#546e7a',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {s === 'paused' ? '⏸' : s === 'normal' ? '▶' : '⏩'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main area: toolbar + canvas ──────────────────────────────────── */}
      <div style={{ position: 'relative', width: GAME_W, height: GAME_H }}>

        {/* ── Toolbar overlay ─────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', background: 'rgba(10,12,22,0.92)',
          borderBottom: '1px solid #1e2535',
          height: GRID_OFFSET_Y,
        }}>
          <span style={{ fontSize: 10, color: '#37474f', letterSpacing: 2, marginRight: 4 }}>TOOL:</span>
          {(['residential', 'commercial', 'industrial', 'road', 'demolish'] as Tool[]).map(t => (
            <button key={t} onClick={() => setTool(t)} style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 4,
              border: `1px solid ${tool === t ? TOOL_COLORS[t] : '#1e2535'}`,
              background: tool === t ? `${TOOL_COLORS[t]}22` : '#111620',
              color: tool === t ? TOOL_COLORS[t] : '#546e7a',
              cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1,
              fontWeight: tool === t ? 700 : 400,
            }}>
              {TOOL_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#263238' }}>
            {tool !== 'demolish' ? `Cost: $${tool === 'residential' ? 200 : tool === 'commercial' ? 300 : tool === 'industrial' ? 250 : 50}` : 'Free'}
          </span>
        </div>

        {/* ── Game canvas ─────────────────────────────────────────────────── */}
        <div
          style={{ position: 'absolute', top: GRID_OFFSET_Y, left: 0, width: GRID_W, height: GRID_H, cursor: 'crosshair' }}
          onClick={handleCanvasClick}
        >
          <Game width={GRID_W} height={GRID_H} gravity={0}>
            <World background="#0d1117">
              <Camera2D x={GRID_W / 2} y={GRID_H / 2} background="#0d1117" />
              {entities}
            </World>
          </Game>
        </div>

        {/* ── Legend sidebar ──────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: GRID_OFFSET_Y, left: GRID_W, right: 0,
          height: GRID_H, background: '#0a0c14', padding: '12px 10px',
          fontFamily: '"Courier New", monospace', fontSize: 11, color: '#546e7a',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ color: '#37474f', letterSpacing: 2, fontSize: 10 }}>LEGEND</div>
          {([
            ['residential', '#4caf50', 'Houses'],
            ['commercial',  '#42a5f5', 'Shops'],
            ['industrial',  '#ffb300', 'Factories'],
            ['road',        '#aaa',    'Roads'],
          ] as [ZoneType, string, string][]).map(([type, color, label]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, background: ZONE_COLORS[type], border: `2px solid ${color}`, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ color }}>{label}</span>
            </div>
          ))}

          <div style={{ marginTop: 8, borderTop: '1px solid #1a2130', paddingTop: 10, color: '#37474f', lineHeight: 1.8 }}>
            <div style={{ color: '#263238', letterSpacing: 2, fontSize: 10, marginBottom: 4 }}>TIPS</div>
            <div>Build roads</div>
            <div>near zones</div>
            <div style={{ marginTop: 4 }}>Res. near</div>
            <div>commercial</div>
            <div>= growth</div>
            <div style={{ marginTop: 4 }}>Industry</div>
            <div>pollutes</div>
            <div>nearby res.</div>
          </div>

          <div style={{ marginTop: 'auto', color: '#263238', fontSize: 10 }}>
            {speedLabel[speed]}
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
        <span>Select tool &rarr; click grid to place &nbsp;&middot;&nbsp; Demolish to remove &nbsp;&middot;&nbsp; Roads connect zones</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
