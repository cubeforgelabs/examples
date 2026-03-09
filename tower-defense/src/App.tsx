import { useState, useEffect, useCallback } from 'react'
import { Game, World, Entity, Transform, Sprite, Camera2D } from '@cubeforge/react'
import {
  W, H, CELL, COLS, ROWS,
  TOWER_DEFS, WAVES,
  getPathCells, gridToPixel,
  PathCell, TowerEntity, GameManagerEntity,
  tdEvents, startWave, clearAllState,
} from './components/TDGame'
import type { TowerType, TowerPlacement } from './components/TDGame'

// ─── Types ────────────────────────────────────────────────────────────────────
type GamePhase = 'prep' | 'wave' | 'gameover' | 'victory'

// ─── Precompute path cells ────────────────────────────────────────────────────
const pathCells = getPathCells()

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,       setGameKey]       = useState(0)
  const [gold,          setGold]          = useState(100)
  const [lives,         setLives]         = useState(10)
  const [wave,          setWave]          = useState(0)
  const [phase,         setPhase]         = useState<GamePhase>('prep')
  const [towers,        setTowers]        = useState<TowerPlacement[]>([])
  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null)
  const [hoveredCell,   setHoveredCell]   = useState<[number, number] | null>(null)

  // ── Wire up game events ─────────────────────────────────────────────────
  useEffect(() => {
    tdEvents.onEnemyKilled = () => {
      setGold(g => g + 10)
    }
    tdEvents.onLifeLost = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setPhase('gameover')
        return Math.max(0, next)
      })
    }
    tdEvents.onWaveCleared = () => {
      setWave(w => {
        const next = w + 1
        if (next >= WAVES.length) {
          setPhase('victory')
        } else {
          setPhase('prep')
        }
        return next
      })
    }
    return () => {
      tdEvents.onEnemyKilled = null
      tdEvents.onLifeLost    = null
      tdEvents.onWaveCleared = null
    }
  }, [gameKey])

  // ── Place tower on grid click ───────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'prep' || !selectedTower) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const col = Math.floor(mx / CELL)
    const row = Math.floor(my / CELL)
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return

    // Can't place on path
    if (pathCells.has(`${col},${row}`)) return

    // Can't place on existing tower
    if (towers.some(t => t.col === col && t.row === row)) return

    const def = TOWER_DEFS[selectedTower]
    if (gold < def.cost) return

    setTowers(prev => [...prev, { col, row, type: selectedTower }])
    setGold(g => g - def.cost)
  }, [phase, selectedTower, towers, gold])

  // ── Track hovered cell for placement preview ────────────────────────────
  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const col = Math.floor(mx / CELL)
    const row = Math.floor(my / CELL)
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      setHoveredCell([col, row])
    } else {
      setHoveredCell(null)
    }
  }, [])

  // ── Start wave ──────────────────────────────────────────────────────────
  function handleStartWave() {
    if (phase !== 'prep' || wave >= WAVES.length) return
    setPhase('wave')
    startWave(wave)
  }

  // ── Restart ─────────────────────────────────────────────────────────────
  function restart() {
    clearAllState()
    setGold(100)
    setLives(10)
    setWave(0)
    setPhase('prep')
    setTowers([])
    setSelectedTower(null)
    setGameKey(k => k + 1)
  }

  // ── Determine if a cell is valid for placement ──────────────────────────
  const canPlace = (col: number, row: number): boolean => {
    if (pathCells.has(`${col},${row}`)) return false
    if (towers.some(t => t.col === col && t.row === row)) return false
    return true
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        padding: '8px 18px',
        background: '#0d0f1a',
        borderRadius: '10px 10px 0 0',
        fontSize: 13,
        color: '#90a4ae',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ color: '#ffd54f', fontWeight: 700 }}>Gold: {gold}</span>
          <span style={{ color: '#ef5350', fontWeight: 700 }}>Lives: {lives}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          TOWER DEFENSE
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#4fc3f7' }}>
          Wave {Math.min(wave + 1, WAVES.length)} / {WAVES.length}
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: selectedTower ? 'crosshair' : 'default' }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMove}
        onMouseLeave={() => setHoveredCell(null)}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0f1a0f">
            <Camera2D x={W / 2} y={H / 2} />
            <GameManagerEntity key="manager" />

            {/* Grass background grid lines (subtle) */}
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <Entity key={`vline-${i}`}>
                <Transform x={i * CELL} y={H / 2} />
                <Sprite width={1} height={H} color="#162016" zIndex={0} />
              </Entity>
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <Entity key={`hline-${i}`}>
                <Transform x={W / 2} y={i * CELL} />
                <Sprite width={W} height={1} color="#162016" zIndex={0} />
              </Entity>
            ))}

            {/* Path cells */}
            {Array.from(pathCells).map(key => {
              const [c, r] = key.split(',').map(Number)
              return <PathCell key={key} col={c} row={r} />
            })}

            {/* Tower entities */}
            {towers.map((t, i) => (
              <TowerEntity key={`tower-${i}`} col={t.col} row={t.row} type={t.type} idx={i} />
            ))}

            {/* Enemies & bullets are spawned dynamically by the manager Script */}
          </World>
        </Game>

        {/* ── Placement preview overlay (HTML, not canvas) ───────────────── */}
        {selectedTower && hoveredCell && phase === 'prep' && (() => {
          const [hc, hr] = hoveredCell
          const valid = canPlace(hc, hr) && gold >= TOWER_DEFS[selectedTower].cost
          const [px, py] = gridToPixel(hc, hr)
          const def = TOWER_DEFS[selectedTower]
          return (
            <>
              {/* Range circle */}
              <div style={{
                position: 'absolute',
                left: px - def.range,
                top: py - def.range,
                width: def.range * 2,
                height: def.range * 2,
                borderRadius: '50%',
                border: `1px solid ${valid ? 'rgba(255,255,255,0.15)' : 'rgba(255,0,0,0.2)'}`,
                background: valid ? 'rgba(255,255,255,0.03)' : 'rgba(255,0,0,0.05)',
                pointerEvents: 'none',
              }} />
              {/* Cell highlight */}
              <div style={{
                position: 'absolute',
                left: hc * CELL,
                top: hr * CELL,
                width: CELL,
                height: CELL,
                background: valid ? 'rgba(79,195,247,0.25)' : 'rgba(239,83,80,0.25)',
                border: `2px solid ${valid ? '#4fc3f7' : '#ef5350'}`,
                pointerEvents: 'none',
              }} />
            </>
          )
        })()}

        {/* ── Game over overlay ───────────────────────────────────────────── */}
        {phase === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#ef5350', letterSpacing: 3 }}>
                DEFEATED
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Survived {wave} wave{wave !== 1 ? 's' : ''}
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Victory overlay ────────────────────────────────────────────── */}
        {phase === 'victory' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                ALL WAVES CLEARED
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#4fc3f7', letterSpacing: 3 }}>
                VICTORY!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Gold remaining: {gold} &mdash; Lives: {lives}
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tower selection bar ─────────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: '#0d0f1a',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        userSelect: 'none',
      }}>
        <span style={{ fontSize: 11, color: '#546e7a', letterSpacing: 2, marginRight: 8 }}>TOWERS:</span>

        {(['basic', 'slow', 'splash'] as TowerType[]).map(type => {
          const def = TOWER_DEFS[type]
          const isSelected = selectedTower === type
          const canAfford = gold >= def.cost
          return (
            <button
              key={type}
              onClick={() => setSelectedTower(isSelected ? null : type)}
              disabled={phase !== 'prep'}
              style={{
                padding: '6px 14px',
                background: isSelected ? def.color : '#161b2e',
                color: isSelected ? '#0a0a0f' : (canAfford ? def.color : '#37474f'),
                border: `2px solid ${isSelected ? def.color : (canAfford ? def.color + '66' : '#1e2535')}`,
                borderRadius: 6,
                fontFamily: '"Courier New", monospace',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: phase === 'prep' ? 'pointer' : 'default',
                opacity: phase !== 'prep' ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              {type.toUpperCase()} ({def.cost}g)
            </button>
          )
        })}

        <div style={{ flex: 1 }} />

        {/* Start wave button */}
        {phase === 'prep' && wave < WAVES.length && (
          <button onClick={handleStartWave} style={{
            padding: '8px 24px',
            background: '#4caf50',
            color: '#0a0a0f',
            border: 'none',
            borderRadius: 6,
            fontFamily: '"Courier New", monospace',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: 'pointer',
          }}>
            START WAVE {wave + 1}
          </button>
        )}

        {phase === 'wave' && (
          <span style={{ fontSize: 12, color: '#ff9800', letterSpacing: 2, animation: 'pulse 1s infinite' }}>
            WAVE IN PROGRESS...
          </span>
        )}
      </div>

      {/* ── Tower info bar ──────────────────────────────────────────────────── */}
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
        <span>
          {selectedTower
            ? `${selectedTower.toUpperCase()}: DMG ${TOWER_DEFS[selectedTower].damage} | RNG ${TOWER_DEFS[selectedTower].range}px | RATE ${TOWER_DEFS[selectedTower].fireRate}/s`
              + (TOWER_DEFS[selectedTower].slow ? ` | SLOW ${Math.round((1 - TOWER_DEFS[selectedTower].slow!) * 100)}%` : '')
              + (TOWER_DEFS[selectedTower].splash ? ` | SPLASH ${TOWER_DEFS[selectedTower].splash}px` : '')
            : 'Click a tower type, then click the grid to place'}
        </span>
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
  zIndex:         100,
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
  background:    '#4fc3f7',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
