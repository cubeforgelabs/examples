import { useState, useEffect } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import { Ship, CANVAS_W, CANVAS_H } from './components/Ship'
import { AsteroidField } from './components/AsteroidField'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = CANVAS_W
const H = CANVAS_H
const MAX_LIVES = 3

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'idle' | 'playing' | 'gameover'

// ─── Hearts ───────────────────────────────────────────────────────────────────
function Heart({ filled }: { filled: boolean }) {
  return (
    <span style={{ color: filled ? '#ef5350' : '#263238', fontSize: 18, lineHeight: 1 }}>&#x2665;</span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [lives,     setLives]     = useState(MAX_LIVES)
  const [wave,      setWave]      = useState(1)
  const [gameState, setGameState] = useState<GameState>('idle')

  useEffect(() => {
    gameEvents.onScore = (pts) => setScore(s => s + pts)
    gameEvents.onDeath = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) {
          setScore(s => { setBestScore(b => Math.max(b, s)); return s })
          setGameState('gameover')
        }
        return Math.max(0, next)
      })
    }
    gameEvents.onWave = () => setWave(w => w + 1)
    return () => {
      gameEvents.onScore = null
      gameEvents.onDeath = null
      gameEvents.onWave  = null
    }
  }, [gameKey])

  useEffect(() => {
    if (gameState !== 'idle' && gameState !== 'gameover') return
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); start() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    setScore(0)
    setLives(MAX_LIVES)
    setWave(1)
    setGameState('playing')
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
        {/* Lives */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: MAX_LIVES }, (_, i) => <Heart key={i} filled={i < lives} />)}
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score).padStart(6, '0')}
          </div>
          <div style={{ fontSize: 10, color: '#37474f' }}>BEST {String(bestScore).padStart(6, '0')}</div>
        </div>

        {/* Wave */}
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b', letterSpacing: 2 }}>
          WAVE {wave}
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#05060f">
            <Camera2D x={W / 2} y={H / 2} />
            {gameState === 'playing' && (
              <>
                <Ship key="ship" />
                <AsteroidField key="field" />
              </>
            )}
          </World>
        </Game>

        {/* ── Idle overlay ────────────────────────────────────────────────── */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4fc3f7', marginBottom: 8 }}>
                CUBEFORGE
              </p>
              <p style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: 4 }}>
                ASTEROIDS
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to launch
              </p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 4 }}>
                Destroy all asteroids to advance
              </p>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ───────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                SHIP DESTROYED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Wave {wave} &nbsp;&middot;&nbsp; Best {bestScore}
              </p>
              <button onClick={start} style={btnStyle}>Try Again</button>
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
        <span>A/D / ←→ &mdash; rotate &nbsp;&middot;&nbsp; W / ↑ &mdash; thrust &nbsp;&middot;&nbsp; SPACE / Z &mdash; fire</span>
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
  background:     'rgba(5, 6, 15, 0.85)',
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
