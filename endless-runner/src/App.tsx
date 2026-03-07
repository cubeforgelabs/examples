import { useState, useEffect } from 'react'
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'
import { Player } from './components/Player'
import { ObstacleManager } from './components/ObstacleManager'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const W         = 800
const H         = 400
const GROUND_Y  = 370
const GROUND_H  = 40
const WORLD_W   = 1600   // wide enough; player stays fixed at x=120

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'idle' | 'playing' | 'gameover'

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [score,     setScore]     = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')

  // Score ticker
  useEffect(() => {
    if (gameState !== 'playing') return
    const id = setInterval(() => setScore(s => s + 1), 100)
    return () => clearInterval(id)
  }, [gameState, gameKey])

  useEffect(() => {
    gameEvents.onDeath = () => {
      setBestScore(b => Math.max(b, score))
      setGameState('gameover')
    }
    return () => { gameEvents.onDeath = null }
  }, [gameKey, score])

  useEffect(() => {
    if (gameState !== 'idle' && gameState !== 'gameover') return
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); start() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    setScore(0)
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
        <div style={{ fontSize: 11, color: '#607d8b' }}>RUNNER</div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffd54f', fontWeight: 700, fontSize: 18, letterSpacing: 3 }}>
            {String(score * 10).padStart(5, '0')}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#37474f' }}>
          BEST {bestScore * 10}
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={900}>
          <World background="#1a1d2e">

            {/* Player */}
            {gameState === 'playing' && (
              <>
                <Player key="player" x={120} y={310} />
                <ObstacleManager key="obstacles" />
              </>
            )}

            {/* Ground */}
            <Entity key="ground" tags={['ground']}>
              <Transform x={WORLD_W / 2} y={GROUND_Y} />
              <Sprite width={WORLD_W} height={GROUND_H} color="#2e3a2e" />
              <RigidBody isStatic />
              <BoxCollider width={WORLD_W} height={GROUND_H} />
            </Entity>

            {/* Ground surface line */}
            <Entity key="ground-line" tags={['decoration']}>
              <Transform x={WORLD_W / 2} y={GROUND_Y - GROUND_H / 2 + 2} />
              <Sprite width={WORLD_W} height={3} color="#4caf50" />
            </Entity>

            {/* Stars / background dots */}
            {Array.from({ length: 24 }, (_, i) => (
              <Entity key={`star${i}`} tags={['star']}>
                <Transform
                  x={(i * 137.5) % W}
                  y={(i * 73.1 + 40) % (GROUND_Y - GROUND_H / 2 - 10)}
                />
                <Sprite width={2} height={2} color="#263245" />
              </Entity>
            ))}

          </World>
        </Game>

        {/* ── Idle overlay ────────────────────────────────────────────────── */}
        {gameState === 'idle' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                CUBEFORGE
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                ENDLESS RUN
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', marginTop: 20 }}>
                Press <strong style={{ color: '#fff' }}>SPACE</strong> to start
              </p>
              <p style={{ fontSize: 11, color: '#546e7a', marginTop: 4 }}>Speed increases over time</p>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ───────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                CRASHED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd54f' }}>{score * 10}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#546e7a' }}>
                Best &nbsp;<strong style={{ color: '#4fc3f7' }}>{bestScore * 10}</strong>
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
        <span>SPACE / W / ↑ &mdash; jump &nbsp;&middot;&nbsp; avoid the obstacles</span>
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
