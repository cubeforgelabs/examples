import { useSyncExternalStore } from 'react'
import type { GameState } from '../levelGen'
import { LEVEL_NAME } from '../levelGen'
import { hudStore } from '../hudStore'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
function resolve(src: string): string {
  return BASE && src.startsWith('/') ? BASE + src : src
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace',
  padding: '36px 48px', background: '#0d0f1a',
  border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#ffd700',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontFamily: '"Courier New", monospace', fontSize: 13,
  fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}

interface OverlayProps {
  gameState: GameState
  level: 1 | 2 | 3
  onNextLevel: () => void
  onRestart: () => void
}

export function GameOverlays({ gameState, level, onNextLevel, onRestart }: OverlayProps) {
  const { score } = useSyncExternalStore(hudStore.subscribe, hudStore.getSnapshot)

  if (gameState === 'levelclear') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: '#4caf50', marginBottom: 8 }}>LEVEL CLEAR</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>{LEVEL_NAME[level]}</p>
          <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong></p>
          <button onClick={onNextLevel} style={btnStyle}>Next Level →</button>
        </div>
      </div>
    )
  }

  if (gameState === 'win') {
    return (
      <div style={overlayStyle}>
        {[{ top: '10%', left: '8%' }, { top: '15%', right: '10%' }, { top: '60%', left: '5%' },
          { top: '55%', right: '8%' }, { bottom: '20%', left: '12%' }, { bottom: '15%', right: '12%' },
        ].map((pos, i) => (
          <img key={i} src={resolve('/SMB_Sprite_Firework.gif')} width={40} height={40} style={{ position: 'absolute', ...pos, opacity: 0.9 }} />
        ))}
        <div style={cardStyle}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd700', marginBottom: 8 }}>BOWSER DEFEATED</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
          <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Final Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong></p>
          <button onClick={onRestart} style={btnStyle}>Play Again</button>
        </div>
      </div>
    )
  }

  if (gameState === 'gameover') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>GAME OVER</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>TRY AGAIN</p>
          <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong></p>
          <button onClick={onRestart} style={btnStyle}>Restart</button>
        </div>
      </div>
    )
  }

  return null
}
