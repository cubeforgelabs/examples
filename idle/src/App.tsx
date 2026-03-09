import { useEffect, useReducer, useRef, useState, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 600
const H = 500
const DT = 1 / 10 // 10 ticks per second for idle game

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q'
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Math.floor(n).toString()
}

interface UpgradeDef {
  name: string
  baseCost: number
  baseProduction: number
  costMultiplier: number
  color: string
  desc: string
}

const UPGRADES: UpgradeDef[] = [
  { name: 'Cursor',      baseCost: 15,       baseProduction: 0.1,    costMultiplier: 1.15, color: '#90a4ae', desc: '+0.1/s' },
  { name: 'Worker',      baseCost: 100,      baseProduction: 1,      costMultiplier: 1.15, color: '#4fc3f7', desc: '+1/s' },
  { name: 'Farm',        baseCost: 1100,     baseProduction: 8,      costMultiplier: 1.15, color: '#66bb6a', desc: '+8/s' },
  { name: 'Factory',     baseCost: 12000,    baseProduction: 47,     costMultiplier: 1.15, color: '#fdd835', desc: '+47/s' },
  { name: 'Mine',        baseCost: 130000,   baseProduction: 260,    costMultiplier: 1.15, color: '#ff7043', desc: '+260/s' },
  { name: 'Laboratory',  baseCost: 1400000,  baseProduction: 1400,   costMultiplier: 1.15, color: '#ab47bc', desc: '+1.4K/s' },
  { name: 'Portal',      baseCost: 20000000, baseProduction: 7800,   costMultiplier: 1.15, color: '#ef5350', desc: '+7.8K/s' },
]

interface ClickAnim {
  x: number; y: number; text: string; id: number; timer: number
}

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const currencyRef = useRef(0)
  const totalRef = useRef(0)
  const cpsRef = useRef(0)
  const clickValueRef = useRef(1)
  const countsRef = useRef<number[]>(UPGRADES.map(() => 0))
  const prestigeLevelRef = useRef(0)
  const prestigeMultRef = useRef(1)
  const clickAnimsRef = useRef<ClickAnim[]>([])
  const nextIdRef = useRef(1)

  const [currency, setCurrency] = useState(0)
  const [cps, setCps] = useState(0)
  const [clickValue, setClickValue] = useState(1)
  const [counts, setCounts] = useState<number[]>(UPGRADES.map(() => 0))
  const [prestigeLevel, setPrestigeLevel] = useState(0)
  const [, forceRender] = useReducer(n => n + 1, 0)

  // Production tick
  useEffect(() => {
    const id = setInterval(() => {
      const production = calcCps() * DT
      currencyRef.current += production
      totalRef.current += production
      setCurrency(Math.floor(currencyRef.current))

      // Update click anims
      clickAnimsRef.current = clickAnimsRef.current.filter(a => {
        a.timer -= DT
        a.y -= 20 * DT
        return a.timer > 0
      })
      forceRender()
    }, DT * 1000)
    return () => clearInterval(id)
  }, [])

  function calcCps(): number {
    let total = 0
    countsRef.current.forEach((count, i) => {
      total += count * UPGRADES[i].baseProduction
    })
    total *= prestigeMultRef.current
    cpsRef.current = total
    return total
  }

  function upgradeCost(idx: number): number {
    return Math.floor(UPGRADES[idx].baseCost * Math.pow(UPGRADES[idx].costMultiplier, countsRef.current[idx]))
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const val = clickValueRef.current * prestigeMultRef.current
    currencyRef.current += val
    totalRef.current += val
    setCurrency(Math.floor(currencyRef.current))

    clickAnimsRef.current.push({
      x: mx, y: my - 20, text: `+${fmt(val)}`, id: nextIdRef.current++, timer: 0.8,
    })
    forceRender()
  }, [])

  const buyUpgrade = useCallback((idx: number) => {
    const cost = upgradeCost(idx)
    if (currencyRef.current >= cost) {
      currencyRef.current -= cost
      countsRef.current[idx]++
      setCurrency(Math.floor(currencyRef.current))
      setCounts([...countsRef.current])
      setCps(Math.floor(calcCps()))
    }
  }, [])

  const buyClickUpgrade = useCallback(() => {
    const cost = Math.floor(50 * Math.pow(1.5, clickValueRef.current - 1))
    if (currencyRef.current >= cost) {
      currencyRef.current -= cost
      clickValueRef.current++
      setCurrency(Math.floor(currencyRef.current))
      setClickValue(clickValueRef.current)
    }
  }, [])

  const doPrestige = useCallback(() => {
    if (totalRef.current < 1000000) return
    const bonus = Math.floor(Math.sqrt(totalRef.current / 1000000))
    prestigeLevelRef.current += bonus
    prestigeMultRef.current = 1 + prestigeLevelRef.current * 0.1
    setPrestigeLevel(prestigeLevelRef.current)

    // Reset
    currencyRef.current = 0
    totalRef.current = 0
    clickValueRef.current = 1
    countsRef.current = UPGRADES.map(() => 0)
    setCurrency(0)
    setCps(0)
    setClickValue(1)
    setCounts(UPGRADES.map(() => 0))
  }, [])

  const clickAnims = clickAnimsRef.current
  const clickUpgradeCost = Math.floor(50 * Math.pow(1.5, clickValue - 1))
  const canPrestige = totalRef.current >= 1000000
  const prestigeBonus = canPrestige ? Math.floor(Math.sqrt(totalRef.current / 1000000)) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>{fmt(cps)}/s</div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#fdd835', fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>
            {fmt(currency)}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>
          {prestigeLevel > 0 && <span style={{ color: '#ab47bc' }}>P{prestigeLevel} x{prestigeMultRef.current.toFixed(1)}</span>}
        </div>
      </div>

      {/* Game area: canvas left, shop right */}
      <div style={{ display: 'flex', position: 'relative', width: W }}>
        {/* Canvas click area */}
        <div
          style={{
            position: 'relative',
            width: W - 220,
            height: H,
            background: '#0d1117',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
            userSelect: 'none',
          }}
        >
          {/* Currency display */}
          <div style={{ position: 'absolute', top: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#fdd835', letterSpacing: 2, fontFamily: '"Courier New", monospace' }}>
              {fmt(currency)}
            </div>
            <div style={{ fontSize: 13, color: '#607d8b', fontFamily: '"Courier New", monospace', marginTop: 4 }}>
              {fmt(cps)} per second
            </div>
          </div>

          {/* Click button */}
          <button
            onClick={handleClick as any}
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              border: '3px solid #fdd835',
              background: 'radial-gradient(circle at 40% 35%, #ffe082, #fdd835 60%, #f9a825)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              boxShadow: '0 0 30px rgba(253,216,53,0.15), inset 0 -4px 8px rgba(0,0,0,0.15)',
              transition: 'transform 0.08s, box-shadow 0.08s',
              fontFamily: '"Courier New", monospace',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <span style={{ fontSize: 18, fontWeight: 900, color: '#0a0a0f', letterSpacing: 2 }}>CLICK</span>
            <span style={{ fontSize: 14, color: '#5d4037' }}>+{fmt(clickValue * prestigeMultRef.current)}</span>
          </button>

          {/* Click animations (float up from button) */}
          {clickAnims.map(a => (
            <div
              key={`ca${a.id}`}
              style={{
                position: 'absolute',
                left: a.x,
                top: a.y,
                fontSize: 16,
                fontWeight: 700,
                color: '#fdd835',
                fontFamily: '"Courier New", monospace',
                pointerEvents: 'none',
                transform: 'translateX(-50%)',
              }}
            >
              {a.text}
            </div>
          ))}

          {/* Prestige info */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            fontSize: 11,
            color: canPrestige ? '#ab47bc' : '#37474f',
            fontFamily: '"Courier New", monospace',
            letterSpacing: 1,
          }}>
            {canPrestige ? `Prestige for +${prestigeBonus} levels` : 'Prestige at 1M total earned'}
          </div>
        </div>

        {/* Shop panel */}
        <div style={{
          width: 220, height: H, background: '#0d0f1a', overflowY: 'auto',
          fontFamily: '"Courier New", monospace', padding: '8px',
        }}>
          <div style={{ fontSize: 11, color: '#546e7a', letterSpacing: 2, marginBottom: 8, textAlign: 'center' }}>
            UPGRADES
          </div>

          {/* Click upgrade */}
          <button
            onClick={buyClickUpgrade}
            disabled={currency < clickUpgradeCost}
            style={{
              ...shopBtnStyle,
              opacity: currency >= clickUpgradeCost ? 1 : 0.4,
              borderColor: '#fdd835',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fdd835', fontSize: 12, fontWeight: 700 }}>Click Power</span>
              <span style={{ color: '#fdd835', fontSize: 11 }}>Lv.{clickValue}</span>
            </div>
            <div style={{ fontSize: 10, color: '#90a4ae', marginTop: 2 }}>
              Cost: {fmt(clickUpgradeCost)} &middot; +1 per click
            </div>
          </button>

          {/* Production upgrades */}
          {UPGRADES.map((u, i) => {
            const cost = upgradeCost(i)
            const canBuy = currency >= cost
            return (
              <button
                key={i}
                onClick={() => buyUpgrade(i)}
                disabled={!canBuy}
                style={{
                  ...shopBtnStyle,
                  opacity: canBuy ? 1 : 0.4,
                  borderColor: u.color,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: u.color, fontSize: 12, fontWeight: 700 }}>{u.name}</span>
                  <span style={{ color: u.color, fontSize: 11 }}>{counts[i]}</span>
                </div>
                <div style={{ fontSize: 10, color: '#90a4ae', marginTop: 2 }}>
                  Cost: {fmt(cost)} &middot; {u.desc}
                </div>
              </button>
            )
          })}

          {/* Prestige button */}
          <button
            onClick={doPrestige}
            disabled={!canPrestige}
            style={{
              ...shopBtnStyle,
              opacity: canPrestige ? 1 : 0.3,
              borderColor: '#ab47bc',
              marginTop: 12,
            }}
          >
            <div style={{ color: '#ab47bc', fontSize: 12, fontWeight: 700 }}>PRESTIGE</div>
            <div style={{ fontSize: 10, color: '#90a4ae', marginTop: 2 }}>
              Reset for +{prestigeBonus} prestige levels
            </div>
            <div style={{ fontSize: 10, color: '#546e7a', marginTop: 1 }}>
              x{(1 + (prestigeLevel + prestigeBonus) * 0.1).toFixed(1)} multiplier
            </div>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Click to earn &nbsp;&middot;&nbsp; Buy upgrades for auto-income &nbsp;&middot;&nbsp; Prestige for multipliers</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const shopBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  marginBottom: 4,
  background: '#111620',
  border: '1px solid #1e2535',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: '"Courier New", monospace',
  textAlign: 'left',
  display: 'block',
  color: '#fff',
}
