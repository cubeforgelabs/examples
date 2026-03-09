import { useState, useEffect, useCallback } from 'react'
import { Game, World } from '@cubeforge/react'
import {
  W, H,
  FloorTiles, WallTiles, Coins,
  Player, Enemy, SwordSlash,
  GameManager, ENEMIES_DEF,
} from './components/RPGGame'
import { rpgEvents } from './rpgEvents'

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover'

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,   setGameKey]   = useState(0)
  const [hp,        setHp]        = useState(5)
  const [coins,     setCoins]     = useState(0)
  const [gameState, setGameState] = useState<GameState>('playing')

  useEffect(() => {
    rpgEvents.onHpChange    = (newHp) => setHp(newHp)
    rpgEvents.onCoinCollect = (newCoins) => setCoins(newCoins)
    rpgEvents.onGameOver    = () => setGameState('gameover')
    return () => {
      rpgEvents.onHpChange    = null
      rpgEvents.onCoinCollect = null
      rpgEvents.onGameOver    = null
    }
  }, [gameKey])

  const restart = useCallback(() => {
    setHp(5)
    setCoins(0)
    setGameState('playing')
    setGameKey(k => k + 1)
  }, [])

  // Listen for R key to restart
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'KeyR' && gameState === 'gameover') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameState, restart])

  // ── Hearts string ──────────────────────────────────────────────────────
  const hearts = Array.from({ length: 5 }, (_, i) => (i < hp ? '\u2665' : '\u2661')).join(' ')

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
        <div style={{ fontSize: 22, color: '#ef5350', letterSpacing: 4 }}>
          {hearts}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>
          RPG
        </div>
        <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#ffd54f', letterSpacing: 2 }}>
          {coins} coins
        </div>
      </div>

      {/* ── Game canvas + overlays ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#111a11">
            <FloorTiles />
            <WallTiles />
            <Coins />
            <Player />
            {ENEMIES_DEF.map(e => (
              <Enemy
                key={`enemy-${e.index}`}
                index={e.index}
                x={e.x}
                y={e.y}
                patrolAxis={e.patrolAxis}
                patrolMin={e.patrolMin}
                patrolMax={e.patrolMax}
              />
            ))}
            <SwordSlash />
            <GameManager />
          </World>
        </Game>

        {/* ── Game Over overlay ─────────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#90a4ae', letterSpacing: 3 }}>
                You collected {coins} coin{coins !== 1 ? 's' : ''}
              </p>
              <button onClick={restart} style={btnStyle}>
                Play Again (R)
              </button>
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
        <span>WASD/Arrows &mdash; move &nbsp;&middot;&nbsp; Space &mdash; attack &nbsp;&middot;&nbsp; R &mdash; restart</span>
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
