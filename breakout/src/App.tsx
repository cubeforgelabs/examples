import { useState, useEffect, useCallback } from 'react'
import { Game, World } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { Paddle }      from './components/Paddle'
import { Ball }        from './components/Ball'
import { Brick }       from './components/Brick'
import { gameEvents }  from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W           = 800
const H           = 560
const MAX_LIVES   = 3

// Brick layout constants
const BRICK_W     = 64
const BRICK_H     = 20
const BRICK_GAP   = 4
const COLS        = 10
const ROWS        = 6
const START_Y     = 80

// Total horizontal space occupied by bricks
const TOTAL_BRICK_W = COLS * BRICK_W + (COLS - 1) * BRICK_GAP  // 700
const OFFSET_X      = (W - TOTAL_BRICK_W) / 2 + BRICK_W / 2    // left center of first brick

// Row definitions (top to bottom)
const ROW_DEFS = [
  { color: '#ef5350', score: 5 },
  { color: '#ff7043', score: 4 },
  { color: '#ffa726', score: 3 },
  { color: '#ffee58', score: 2 },
  { color: '#66bb6a', score: 1 },
  { color: '#42a5f5', score: 1 },
]

// ─── Brick data ───────────────────────────────────────────────────────────────
interface BrickData {
  id:    number
  x:     number
  y:     number
  color: string
  score: number
}

function buildBricks(): BrickData[] {
  const bricks: BrickData[] = []
  let idCounter = 1
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        id:    idCounter++,
        x:     OFFSET_X + col * (BRICK_W + BRICK_GAP),
        y:     START_Y  + row * (BRICK_H + BRICK_GAP),
        color: ROW_DEFS[row].color,
        score: ROW_DEFS[row].score,
      })
    }
  }
  return bricks
}

const INITIAL_BRICKS = buildBricks()
const TOTAL_BRICKS   = INITIAL_BRICKS.length

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Heart({ filled }: { filled: boolean }) {
  return (
    <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>&#9829;</span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,      setGameKey]      = useState(0)
  const [score,        setScore]        = useState(0)
  const [lives,        setLives]        = useState(MAX_LIVES)
  const [gameState,    setGameState]    = useState<GameState>('playing')
  const [hitBricks,    setHitBricks]    = useState<Set<number>>(new Set())

  // Wire game-script callbacks into React state
  useEffect(() => {
    gameEvents.onBallLost = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    return () => {
      gameEvents.onBallLost = null
    }
  }, [gameKey])

  // onBrickHit: track hit brick IDs (bricks are ECS entity IDs, not our stable brick IDs)
  // We use a stable brick ID per Brick component via the onHit callback closure
  const handleBrickHit = useCallback((_eid: EntityId, stableBrickId: number, brickScore: number) => {
    setHitBricks(prev => {
      const next = new Set([...prev, stableBrickId])
      if (next.size >= TOTAL_BRICKS) setGameState('win')
      return next
    })
    setScore(s => s + brickScore)
  }, [])

  function restart() {
    setScore(0)
    setLives(MAX_LIVES)
    setGameState('playing')
    setHitBricks(new Set())
    setGameKey(k => k + 1)
  }

  const remaining = TOTAL_BRICKS - hitBricks.size
  const visibleBricks = INITIAL_BRICKS.filter(b => !hitBricks.has(b.id))

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
        {/* Lives */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart key={i} filled={i < lives} />
          ))}
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(5, '0')}
          </span>
        </div>

        {/* Bricks remaining */}
        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#607d8b' }}>
          {remaining} bricks left
        </div>
      </div>

      {/* ── Game canvas + overlays ───────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>

        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0d0f1a">

            {/* Paddle */}
            <Paddle x={400} y={524} />

            {/* Ball */}
            <Ball x={400} y={460} />

            {/* Bricks */}
            {visibleBricks.map(b => (
              <Brick
                key={b.id}
                x={b.x}
                y={b.y}
                width={BRICK_W}
                height={BRICK_H}
                color={b.color}
                score={b.score}
                onHit={(eid) => handleBrickHit(eid, b.id, b.score)}
              />
            ))}

          </World>
        </Game>

        {/* ── Win overlay ─────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                ALL BRICKS CLEARED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU WIN
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ────────────────────────────────────────────── */}
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
                Bricks cleared &nbsp;{hitBricks.size}/{TOTAL_BRICKS}
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ──────────────────────────────────────────────────── */}
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
        <span>A / D or Arrow Keys — move paddle</span>
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
