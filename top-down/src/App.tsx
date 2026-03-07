import { useState, useEffect, useCallback } from 'react'
import { Game, World, Camera2D, useGamepad } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { gpState } from './gamepadState'
import { Player }  from './components/Player'
import { Enemy }   from './components/Enemy'
import { Key }     from './components/Key'
import { Wall }    from './components/Wall'
import { Exit }    from './components/Exit'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W          = 800
const H          = 560
const WORLD_W    = 1200
const WORLD_H    = 900
const TOTAL_KEYS = 8
const MAX_LIVES  = 3

// ─── Key layout ───────────────────────────────────────────────────────────────
const KEY_DEFS = [
  { id: 1, x:  180, y:  200 },
  { id: 2, x:  500, y:  150 },
  { id: 3, x:  800, y:  250 },
  { id: 4, x: 1050, y:  130 },
  { id: 5, x:  260, y:  600 },
  { id: 6, x:  650, y:  700 },
  { id: 7, x:  950, y:  650 },
  { id: 8, x: 1100, y:  750 },
]

// ─── Enemy layout ─────────────────────────────────────────────────────────────
const ENEMY_DEFS = [
  { x:  250, y:  300, radius: 55, speed: 1.0, startAngle: 0    },
  { x:  600, y:  250, radius: 65, speed: 1.3, startAngle: 1.5  },
  { x:  900, y:  180, radius: 50, speed: 1.5, startAngle: 3.0  },
  { x:  350, y:  680, radius: 70, speed: 0.9, startAngle: 0.8  },
  { x:  750, y:  750, radius: 60, speed: 1.2, startAngle: 2.2  },
  { x: 1050, y:  600, radius: 55, speed: 1.4, startAngle: 4.5  },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Heart({ filled }: { filled: boolean }) {
  return (
    <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>
      {'\u2665'}
    </span>
  )
}

// ─── GamepadDriver — syncs useGamepad into shared gpState each frame ──────────
function GamepadDriver() {
  const gp = useGamepad()
  gpState.axes      = gp.axes as number[]
  gpState.connected = gp.connected
  return null
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedKeys,  setCollectedKeys]  = useState<Set<number>>(new Set())

  const keysCollected = collectedKeys.size

  // Wire gameEvents into React state each session
  useEffect(() => {
    gameEvents.onPlayerHit = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameEvents.onEnemyKill = () => {
      setScore(s => s + 50)
    }
    gameEvents.onExitReached = () => {
      setGameState('win')
    }
    return () => {
      gameEvents.onPlayerHit   = null
      gameEvents.onKeyCollect  = null
      gameEvents.onEnemyKill   = null
      gameEvents.onExitReached = null
    }
  }, [gameKey])

  const handleKeyCollect = useCallback((_eid: EntityId, keyId: number) => {
    setCollectedKeys(prev => {
      const next = new Set([...prev, keyId])
      return next
    })
    setScore(s => s + 25)
    gameEvents.onKeyCollect?.()
  }, [])

  function restart() {
    setScore(0)
    setLives(MAX_LIVES)
    setGameState('playing')
    setCollectedKeys(new Set())
    setGameKey(k => k + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ──────────────────────────────────────────────────────────── */}
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
        {/* Lives */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart key={i} filled={i < lives} />
          ))}
        </div>

        {/* Keys + Score */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(5, '0')}
          </span>
          <span style={{ fontSize: 11, color: '#78909c' }}>
            Keys: {keysCollected}/{TOTAL_KEYS}
            {keysCollected >= TOTAL_KEYS ? '  — EXIT UNLOCKED!' : ''}
          </span>
        </div>

        {/* Key pip dots */}
        <div style={{ textAlign: 'right', fontSize: 11, color: '#546e7a', letterSpacing: 1 }}>
          {'['.repeat(1)}
          {'*'.repeat(keysCollected)}
          {'_'.repeat(TOTAL_KEYS - keysCollected)}
          {']'.repeat(1)}
        </div>
      </div>

      {/* ── Canvas + overlays ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>

        <Game key={gameKey} width={W} height={H} gravity={0}>
          <GamepadDriver />
          <World background="#1a1205">
            <Camera2D followEntity="player" smoothing={0.85} background="#1a1205" />

            {/* Player — spawn in top-left room */}
            <Player x={100} y={100} />

            {/* Enemies */}
            {ENEMY_DEFS.map((e, i) => (
              <Enemy
                key={i}
                x={e.x}
                y={e.y}
                patrolRadius={e.radius}
                patrolSpeed={e.speed}
                startAngle={e.startAngle}
              />
            ))}

            {/* Keys */}
            {KEY_DEFS
              .filter(k => !collectedKeys.has(k.id))
              .map(k => (
                <Key
                  key={k.id}
                  x={k.x}
                  y={k.y}
                  onCollect={(eid) => handleKeyCollect(eid, k.id)}
                />
              ))
            }

            {/* Exit door — top-right corner */}
            <Exit
              key="exit"
              x={1130}
              y={60}
              keysCollected={keysCollected}
              totalKeys={TOTAL_KEYS}
            />

            {/* ── Outer border walls ────────────────────────────────────── */}
            <Wall key="border-t" x={WORLD_W / 2} y={0}        width={WORLD_W} height={20}  color="#2c1810" />
            <Wall key="border-b" x={WORLD_W / 2} y={WORLD_H}  width={WORLD_W} height={20}  color="#2c1810" />
            <Wall key="border-l" x={0}           y={WORLD_H / 2} width={20} height={WORLD_H} color="#2c1810" />
            <Wall key="border-r" x={WORLD_W}     y={WORLD_H / 2} width={20} height={WORLD_H} color="#2c1810" />

            {/* ── Internal walls — room dividers ────────────────────────── */}
            <Wall key="h1a" x={220}  y={340} width={420} height={22} color="#3e2723" />
            <Wall key="h1b" x={780}  y={340} width={380} height={22} color="#3e2723" />

            <Wall key="h2a" x={280}  y={560} width={500} height={22} color="#3e2723" />
            <Wall key="h2b" x={870}  y={560} width={320} height={22} color="#3e2723" />

            <Wall key="v1a" x={420}  y={160} width={22} height={280} color="#3e2723" />
            <Wall key="v1b" x={420}  y={480} width={22} height={150} color="#3e2723" />

            <Wall key="v2a" x={680}  y={80}  width={22} height={220} color="#3e2723" />
            <Wall key="v2b" x={680}  y={440} width={22} height={200} color="#3e2723" />

            <Wall key="v3a" x={940}  y={200} width={22} height={300} color="#3e2723" />
            <Wall key="v3b" x={940}  y={640} width={22} height={200} color="#3e2723" />

            {/* ── Interior obstacles / pillars ──────────────────────────── */}
            <Wall key="p1" x={170}  y={480} width={60}  height={60}  color="#4e342e" />
            <Wall key="p2" x={590}  y={200} width={50}  height={50}  color="#4e342e" />
            <Wall key="p3" x={820}  y={460} width={50}  height={50}  color="#4e342e" />
            <Wall key="p4" x={280}  y={750} width={70}  height={50}  color="#4e342e" />
            <Wall key="p5" x={780}  y={700} width={60}  height={60}  color="#4e342e" />
            <Wall key="p6" x={1080} y={350} width={55}  height={55}  color="#4e342e" />
          </World>
        </Game>

        {/* ── Win overlay ──────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                ALL KEYS COLLECTED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU ESCAPED!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ─────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                OUT OF LIVES
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Keys &nbsp;{keysCollected}/{TOTAL_KEYS}
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
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
        <span>WASD / Arrows {'\u2014'} move &nbsp;{'\u00b7'}&nbsp; Space {'\u2014'} attack &nbsp;{'\u00b7'}&nbsp; Collect all keys {'\u2192'} reach the exit &nbsp;{'\u00b7'}&nbsp; Gamepad supported</span>
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
