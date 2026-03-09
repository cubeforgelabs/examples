import { useState, useEffect } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import { Bird } from './components/Bird'
import { PipeManager } from './components/PipeManager'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 480
const H = 640

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'idle' | 'playing' | 'dead'

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')

  // Wire game callbacks
  useEffect(() => {
    gameEvents.onScore = () => {
      setScore(prev => prev + 1)
    }
    gameEvents.onDeath = () => {
      setScore(prev => {
        setBestScore(best => Math.max(best, prev))
        return prev
      })
      setGameState('dead')
    }
    return () => {
      gameEvents.onScore = null
      gameEvents.onDeath = null
    }
  }, [gameKey])

  // Listen for Space to start from idle
  useEffect(() => {
    if (gameState !== 'idle') return
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setGameState('playing')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState])

  // Click to start from idle
  function handleCanvasClick() {
    if (gameState === 'idle') setGameState('playing')
  }

  function retry() {
    setScore(0)
    setGameState('idle')
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
        <div />

        {/* Score */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 22, letterSpacing: 3 }}>
            {score}
          </span>
        </div>

        {/* Best */}
        <div style={{ textAlign: 'right', fontSize: 12, color: '#607d8b' }}>
          best: {bestScore}
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: 'pointer' }}
        onClick={handleCanvasClick}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#87ceeb">
            <Camera2D x={W / 2} y={H / 2} />
            {gameState !== 'idle' && <Bird />}
            {gameState === 'playing' && <PipeManager />}
          </World>
        </Game>

        {/* ── Idle overlay ──────────────────────────────────────────────────── */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#87ceeb', marginBottom: 8 }}>
                CUBEFORGE
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#ffd54f', letterSpacing: 4 }}>
                FLAPPY BIRD
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 6 }}>
                or click the canvas
              </p>
            </div>
          </div>
        )}

        {/* ── Dead overlay ──────────────────────────────────────────────────── */}
        {gameState === 'dead' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                OOPS
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 14, color: '#90a4ae', margin: '16px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Best &nbsp;<strong style={{ color: '#4fc3f7' }}>{bestScore}</strong>
              </p>
              <button onClick={retry} style={btnStyle}>Retry</button>
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
        <span>SPACE / Click — flap</span>
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
  background:     'rgba(10, 10, 18, 0.72)',
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
  background:    '#ffd54f',
  color:         '#0a0a0f',
  border:        'none',
  borderRadius:  6,
  fontFamily:    '"Courier New", monospace',
  fontSize:      13,
  fontWeight:    700,
  letterSpacing: 2,
  cursor:        'pointer',
}
