import { useSyncExternalStore } from 'react'
import { LEVEL_NAME, LEVEL_THEME } from '../levelGen'
import { hudStore } from '../hudStore'

function Heart({ filled }: { filled: boolean }) {
  return <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>♥</span>
}

interface HUDProps {
  W: number
  totalCoins: number
  level: 1 | 2 | 3
}

export function HUD({ W, totalCoins, level }: HUDProps) {
  const { lives, score, coinsCollected, hasMushroom, hasFireFlower, hasStar } =
    useSyncExternalStore(hudStore.subscribe, hudStore.getSnapshot)

  return (
    <div style={{
      width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      alignItems: 'center', padding: '7px 18px',
      background: '#0d0f1a', borderRadius: '10px 10px 0 0',
      fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
    }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {Array.from({ length: Math.min(lives, 9) }, (_, i) => <Heart key={i} filled={i < lives} />)}
        {hasMushroom   && <span style={{ marginLeft: 4, fontSize: 11, color: '#ef5350' }}>●</span>}
        {hasFireFlower && <span style={{ fontSize: 11, color: '#ff6f00' }}>🔥</span>}
        {hasStar       && <span style={{ fontSize: 11, color: '#ffd600' }}>★</span>}
      </div>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
          {String(score).padStart(6, '0')}
        </span>
        <span style={{ fontSize: 10, color: '#546e7a' }}>
          ●{coinsCollected}/{totalCoins} &nbsp; {LEVEL_NAME[level]}
        </span>
      </div>
      <div style={{ textAlign: 'right', fontSize: 10, color: '#455a64', letterSpacing: 1 }}>
        {LEVEL_THEME[level]}
      </div>
    </div>
  )
}
