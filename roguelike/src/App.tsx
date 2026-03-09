import { useState, useEffect, useCallback, useRef } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import {
  W, H,
  generateFloor,
  processTurn,
  DungeonTiles,
  EnemyEntities,
  PlayerEntity,
} from './components/RoguelikeGame'
import type { GameState } from './components/RoguelikeGame'
import { gameEvents } from './gameEvents'

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey]   = useState(0)
  const [state, setState]       = useState<GameState>(() => generateFloor(1))
  const [showDeath, setShowDeath] = useState(false)
  const totalKills = useRef(0)

  // Reset cumulative kills on restart
  useEffect(() => {
    totalKills.current = 0
  }, [gameKey])

  // Wire up game events
  useEffect(() => {
    gameEvents.onDescend = () => {
      setState(prev => {
        totalKills.current += prev.kills
        const nextFloor = prev.floor + 1
        const nextState = generateFloor(nextFloor)
        nextState.hp = prev.hp
        nextState.kills = 0
        return nextState
      })
    }

    gameEvents.onDeath = () => {
      setShowDeath(true)
    }

    gameEvents.onMove = (dx: number, dy: number) => {
      setState(prev => processTurn(prev, dx, dy))
    }

    return () => {
      gameEvents.onDescend = null
      gameEvents.onDeath = null
      gameEvents.onMove = null
    }
  }, [gameKey])

  // Keyboard input for turn-based movement (works even without canvas focus)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const keyMap: Record<string, [number, number]> = {
      ArrowUp:    [0, -1],
      ArrowDown:  [0,  1],
      ArrowLeft:  [-1, 0],
      ArrowRight: [1,  0],
      w: [0, -1],
      s: [0,  1],
      a: [-1, 0],
      d: [1,  0],
    }
    const dir = keyMap[e.key]
    if (dir) {
      e.preventDefault()
      gameEvents.onMove?.(dir[0], dir[1])
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function restart() {
    setShowDeath(false)
    setGameKey(k => k + 1)
    setState(generateFloor(1))
  }

  const hpPercent = Math.max(0, (state.hp / state.maxHp) * 100)
  const hpColor = hpPercent > 60 ? '#4fc3f7' : hpPercent > 30 ? '#ffd54f' : '#ef5350'

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#546e7a', fontSize: 11, letterSpacing: 2 }}>HP</span>
          <div style={{
            width: 100,
            height: 10,
            background: '#1a1f2e',
            borderRadius: 5,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${hpPercent}%`,
              height: '100%',
              background: hpColor,
              borderRadius: 5,
              transition: 'width 0.2s, background 0.2s',
            }} />
          </div>
          <span style={{ color: hpColor, fontWeight: 700, fontSize: 14 }}>
            {state.hp}/{state.maxHp}
          </span>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          ROGUELIKE
        </div>

        <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <span>
            <span style={{ color: '#546e7a', fontSize: 11, letterSpacing: 2 }}>FLOOR </span>
            <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 14 }}>{state.floor}</span>
          </span>
          <span>
            <span style={{ color: '#546e7a', fontSize: 11, letterSpacing: 2 }}>KILLS </span>
            <span style={{ color: '#ef5350', fontWeight: 700, fontSize: 14 }}>
              {totalKills.current + state.kills}
            </span>
          </span>
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#000000">
            <Camera2D x={W / 2} y={H / 2} />
            <DungeonTiles state={state} />
            <EnemyEntities state={state} />
            <PlayerEntity state={state} />
          </World>
        </Game>

        {/* ── Death overlay ──────────────────────────────────────────────── */}
        {showDeath && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#ef5350', letterSpacing: 3 }}>
                YOU DIED
              </p>
              <div style={{ margin: '16px 0', fontSize: 13, color: '#90a4ae', lineHeight: 1.8 }}>
                <p>Reached Floor <span style={{ color: '#ffd54f', fontWeight: 700 }}>{state.floor}</span></p>
                <p>Enemies Slain <span style={{ color: '#ef5350', fontWeight: 700 }}>{totalKills.current + state.kills}</span></p>
              </div>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Message bar + controls ─────────────────────────────────────────── */}
      <div style={{
        width: W,
        background: '#0d0f1a',
        borderRadius: '0 0 10px 10px',
        padding: '8px 18px',
        fontSize: 12,
        color: '#546e7a',
        letterSpacing: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: '#90a4ae' }}>{state.message}</span>
        <span style={{ color: '#263238', fontSize: 11 }}>
          WASD/Arrows &middot; Cubeforge Engine
        </span>
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
  background:     'rgba(10, 10, 18, 0.85)',
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
