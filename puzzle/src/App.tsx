import { useState, useEffect, useCallback } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import {
  CELL,
  LEVELS,
  canvasSize,
  SokobanManager,
  GridTiles,
  TargetMarkers,
  Boxes,
  PlayerEntity,
  sokobanEvents,
  setLevel,
  restartLevel,
  nextLevel,
} from './components/SokobanGame'
import type { SokobanState } from './components/SokobanGame'

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [levelIdx,  setLevelIdx]  = useState(0)
  const [gameKey,   setGameKey]   = useState(0)
  const [moves,     setMoves]     = useState(0)
  const [complete,  setComplete]  = useState(false)
  const [snapshot,  setSnapshot]  = useState<SokobanState | null>(null)

  const { w: W, h: H } = canvasSize(levelIdx)

  // Sync React state from engine callbacks
  useEffect(() => {
    sokobanEvents.onStateChange = (state: SokobanState) => {
      setMoves(state.moves)
      setComplete(state.complete)
      setSnapshot({
        ...state,
        boxes:  state.boxes.map(b => ({ ...b })),
        player: { ...state.player },
        grid:   [...state.grid],
      })
    }
    return () => { sokobanEvents.onStateChange = null }
  }, [gameKey])

  const handleRestart = useCallback(() => {
    setComplete(false)
    setMoves(0)
    restartLevel()
    setGameKey(k => k + 1)
  }, [])

  const handleNextLevel = useCallback(() => {
    if (levelIdx < LEVELS.length - 1) {
      const next = levelIdx + 1
      setLevelIdx(next)
      setLevel(next)
      setComplete(false)
      setMoves(0)
      nextLevel()
      setGameKey(k => k + 1)
    }
  }, [levelIdx])

  // Initial snapshot for first render
  const displayState = snapshot ?? {
    level:    levelIdx,
    cols:     LEVELS[levelIdx].width,
    rows:     LEVELS[levelIdx].height,
    grid:     [...LEVELS[levelIdx].grid],
    boxes:    LEVELS[levelIdx].boxes.map(b => ({ ...b })),
    player:   { ...LEVELS[levelIdx].player },
    moves:    0,
    complete: false,
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
        <div style={{ fontSize: 14, color: '#546e7a' }}>
          LEVEL <span style={{ fontSize: 22, fontWeight: 900, color: '#4fc3f7', letterSpacing: 2 }}>
            {levelIdx + 1}
          </span>
          <span style={{ fontSize: 11, color: '#37474f' }}> / {LEVELS.length}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          SOKOBAN
        </div>
        <div style={{ textAlign: 'right', fontSize: 14, color: '#546e7a' }}>
          MOVES <span style={{ fontSize: 22, fontWeight: 900, color: '#e6a23c', letterSpacing: 2 }}>
            {moves}
          </span>
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0a0a12">
            <Camera2D x={W / 2} y={H / 2} />
            <SokobanManager />
            <GridTiles state={displayState} />
            <TargetMarkers state={displayState} />
            <Boxes state={displayState} />
            <PlayerEntity state={displayState} />
          </World>
        </Game>

        {/* ── Level complete overlay ───────────────────────────────────────── */}
        {complete && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                LEVEL COMPLETE
              </p>
              <p style={{
                fontSize: 36,
                fontWeight: 900,
                color: '#67c23a',
                letterSpacing: 3,
              }}>
                {levelIdx < LEVELS.length - 1 ? 'NICE!' : 'YOU WIN!'}
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Solved in {moves} move{moves !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                <button onClick={handleRestart} style={{ ...btnStyle, background: '#546e7a' }}>
                  Retry
                </button>
                {levelIdx < LEVELS.length - 1 && (
                  <button onClick={handleNextLevel} style={btnStyle}>
                    Next Level
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ────────────────────────────────────────────────── */}
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
        <span>Arrows &mdash; move &nbsp;&middot;&nbsp; R &mdash; restart</span>
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
