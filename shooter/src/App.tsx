import { useState, useEffect } from 'react'
import { Game, World, Camera2D } from '@cubeforge/react'
import { Player }       from './components/Player'
import { EnemyManager } from './components/EnemyManager'
import { StarField }    from './components/StarField'
import { gameEvents }   from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W          = 800
const H          = 560
const MAX_LIVES  = 3
const MAX_WAVES  = 5

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Heart({ filled }: { filled: boolean }) {
  return (
    <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>♥</span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [lives,     setLives]     = useState(MAX_LIVES)
  const [wave,      setWave]      = useState(1)
  const [gameState, setGameState] = useState<GameState>('playing')

  // Wire game-script callbacks into React state
  useEffect(() => {
    gameEvents.onPlayerHit = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }

    gameEvents.onEnemyKill = (pts: number) => {
      setScore(s => s + pts)
    }

    gameEvents.onWaveComplete = () => {
      setWave(prev => {
        const next = prev + 1
        if (next > MAX_WAVES) setGameState('win')
        return next
      })
    }

    return () => {
      gameEvents.onPlayerHit    = null
      gameEvents.onEnemyKill    = null
      gameEvents.onWaveComplete = null
    }
  }, [gameKey])

  function restart() {
    setScore(0)
    setLives(MAX_LIVES)
    setWave(1)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ───────────────────────────────────────────────────────────── */}
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
            {String(score).padStart(6, '0')}
          </span>
        </div>

        {/* Wave */}
        <div style={{ textAlign: 'right', color: '#607d8b' }}>
          WAVE &nbsp;
          <span style={{ color: '#4fc3f7', fontWeight: 700 }}>{Math.min(wave, MAX_WAVES)}</span>
          <span style={{ color: '#37474f' }}> / {MAX_WAVES}</span>
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>

        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#050510">
            <Camera2D x={W / 2} y={H / 2} />
            <StarField />
            <Player />
            <EnemyManager wave={wave} />
          </World>
        </Game>

        {/* ── Win overlay ──────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                ALL WAVES SURVIVED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU WIN
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                {MAX_WAVES} waves cleared
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ─────────────────────────────────────────────── */}
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
                Reached wave {Math.min(wave, MAX_WAVES)} / {MAX_WAVES}
              </p>
              <button onClick={restart} style={btnStyle}>Try Again</button>
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
        <span>WASD / Arrows — move &nbsp;·&nbsp; Space — shoot</span>
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
  background:     'rgba(5, 5, 16, 0.85)',
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
