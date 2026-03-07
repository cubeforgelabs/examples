import { useState, useEffect } from 'react'
import { Game, World, Entity, Transform, Sprite } from '@cubeforge/react'
import { Ball, Paddle, GameManager, W, H } from './components/PongGame'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const WIN_SCORE = 7

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'win'

// ─── Center divider dots ──────────────────────────────────────────────────────
function DividerDot({ y }: { y: number }) {
  return (
    <Entity tags={['divider']}>
      <Transform x={W / 2} y={y} />
      <Sprite width={4} height={14} color="#1a1f33" />
    </Entity>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,    setGameKey]    = useState(0)
  const [leftScore,  setLeftScore]  = useState(0)
  const [rightScore, setRightScore] = useState(0)
  const [gameState,  setGameState]  = useState<GameState>('playing')
  const [winner,     setWinner]     = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    gameEvents.onScore = (side) => {
      if (side === 'left') {
        setLeftScore(prev => {
          const next = prev + 1
          if (next >= WIN_SCORE) { setWinner('left'); setGameState('win') }
          return next
        })
      } else {
        setRightScore(prev => {
          const next = prev + 1
          if (next >= WIN_SCORE) { setWinner('right'); setGameState('win') }
          return next
        })
      }
    }
    return () => { gameEvents.onScore = null }
  }, [gameKey])

  function restart() {
    setLeftScore(0)
    setRightScore(0)
    setGameState('playing')
    setWinner(null)
    setGameKey(k => k + 1)
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
        <div style={{ fontSize: 32, fontWeight: 900, color: '#4fc3f7', letterSpacing: 2 }}>
          {leftScore}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          PONG
        </div>
        <div style={{ textAlign: 'right', fontSize: 32, fontWeight: 900, color: '#ef5350', letterSpacing: 2 }}>
          {rightScore}
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0a0a12">
            <Ball key="ball" />
            <Paddle key="paddle-l" side="left" />
            <Paddle key="paddle-r" side="right" />
            <GameManager key="manager" />
            {Array.from({ length: 13 }, (_, i) => (
              <DividerDot key={`dot-${i}`} y={i * (H / 12)} />
            ))}
          </World>
        </Game>

        {/* ── Win overlay ─────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                MATCH OVER
              </p>
              <p style={{
                fontSize: 36,
                fontWeight: 900,
                color: winner === 'left' ? '#4fc3f7' : '#ef5350',
                letterSpacing: 3,
              }}>
                {winner === 'left' ? 'LEFT WINS' : 'RIGHT WINS'}
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                {leftScore} &mdash; {rightScore}
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ─────────────────────────────────────────────────── */}
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
        <span>W/S &mdash; left &nbsp;&middot;&nbsp; ↑↓ &mdash; right &nbsp;&middot;&nbsp; First to {WIN_SCORE}</span>
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
