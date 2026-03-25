import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

const TOTAL_ROUNDS = 5
const MIN_DELAY_MS = 1400
const MAX_DELAY_MS = 3600

type Phase = 'idle' | 'waiting' | 'ready' | 'result' | 'summary' | 'false-start'

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function formatMs(value: number): string {
  return `${value} ms`
}

function randomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS
}

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(1)
  const [results, setResults] = useState<number[]>([])
  const [lastReaction, setLastReaction] = useState<number | null>(null)
  const [bestSingle, setBestSingle] = useState(() => {
    const stored = localStorage.getItem('speed-reaction-best-single')
    return stored ? Number(stored) : null
  })
  const [bestAverage, setBestAverage] = useState(() => {
    const stored = localStorage.getItem('speed-reaction-best-average')
    return stored ? Number(stored) : null
  })

  const timeoutRef = useRef<number | null>(null)
  const readyAtRef = useRef<number>(0)

  const sessionAverage = useMemo(() => average(results), [results])

  function clearReadyTimeout() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  function beginRound(nextRound: number, nextResults = results) {
    clearReadyTimeout()
    readyAtRef.current = 0
    setRound(nextRound)
    setResults(nextResults)
    setLastReaction(null)
    setPhase('waiting')
    timeoutRef.current = window.setTimeout(() => {
      readyAtRef.current = performance.now()
      setPhase('ready')
    }, randomDelay())
  }

  function startSession() {
    beginRound(1, [])
  }

  function recordFalseStart() {
    clearReadyTimeout()
    setLastReaction(null)
    setPhase('false-start')
  }

  function recordReaction() {
    const reaction = Math.round(performance.now() - readyAtRef.current)
    const nextResults = [...results, reaction]
    const nextRound = round + 1

    setLastReaction(reaction)
    setResults(nextResults)
    setPhase(nextResults.length >= TOTAL_ROUNDS ? 'summary' : 'result')

    setBestSingle((prev) => {
      const next = prev === null ? reaction : Math.min(prev, reaction)
      localStorage.setItem('speed-reaction-best-single', String(next))
      return next
    })

    if (nextResults.length >= TOTAL_ROUNDS) {
      const nextAverage = average(nextResults)
      setBestAverage((prev) => {
        const best = prev === null ? nextAverage : Math.min(prev, nextAverage)
        localStorage.setItem('speed-reaction-best-average', String(best))
        return best
      })
    } else {
      setRound(nextRound)
    }
  }

  function handleAction() {
    if (phase === 'idle' || phase === 'summary') {
      startSession()
      return
    }
    if (phase === 'waiting') {
      recordFalseStart()
      return
    }
    if (phase === 'ready') {
      recordReaction()
      return
    }
    if (phase === 'result') {
      beginRound(round, results)
      return
    }
    if (phase === 'false-start') {
      beginRound(round, results)
    }
  }

  useEffect(() => {
    return () => clearReadyTimeout()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      handleAction()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const headline = (() => {
    switch (phase) {
      case 'waiting':
        return 'Hold steady...'
      case 'ready':
        return 'CLICK NOW'
      case 'result':
        return 'Nice reflexes'
      case 'summary':
        return 'Session complete'
      case 'false-start':
        return 'Too early'
      default:
        return 'Reaction Lab'
    }
  })()

  const subcopy = (() => {
    switch (phase) {
      case 'waiting':
        return 'Wait for the panel to flash green, then hit Space, Enter, or click anywhere.'
      case 'ready':
        return 'React immediately. This round is live.'
      case 'result':
        return 'Lock it in, then move to the next round.'
      case 'summary':
        return 'Five rounds complete. Start another run to chase a better average.'
      case 'false-start':
        return 'False starts happen when you react before the signal. Try the same round again.'
      default:
        return 'Test your reflexes over five rounds and track your best time.'
    }
  })()

  const panelColor =
    phase === 'ready' ? '#1f9d55'
      : phase === 'false-start' ? '#b91c1c'
        : '#111827'

  return (
    <div style={shellStyle}>
      <div style={frameStyle}>
        <div style={hudStyle}>
          <Stat label="Round" value={`${Math.min(round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`} />
          <Stat label="Best Single" value={bestSingle === null ? '--' : formatMs(bestSingle)} />
          <Stat label="Best Avg" value={bestAverage === null ? '--' : formatMs(bestAverage)} />
        </div>

        <button
          onClick={handleAction}
          style={{ ...panelStyle, background: panelColor }}
          type="button"
        >
          <span style={eyebrowStyle}>Speed Reaction</span>
          <span style={headlineStyle}>{headline}</span>
          <span style={subcopyStyle}>{subcopy}</span>

          {lastReaction !== null && (
            <span style={timeStyle}>{formatMs(lastReaction)}</span>
          )}
        </button>

        <div style={footerStyle}>
          <div style={resultsStripStyle}>
            {Array.from({ length: TOTAL_ROUNDS }, (_, index) => {
              const value = results[index]
              return (
                <div key={index} style={chipStyle}>
                  <span style={{ color: '#94a3b8' }}>R{index + 1}</span>
                  <strong style={{ color: value === undefined ? '#f8fafc' : '#fbbf24' }}>
                    {value === undefined ? '--' : `${value}ms`}
                  </strong>
                </div>
              )
            })}
          </div>

          <div style={summaryBarStyle}>
            <span>Average: <strong style={{ color: '#fbbf24' }}>{results.length ? formatMs(sessionAverage) : '--'}</strong></span>
            <span>Controls: <strong style={{ color: '#f8fafc' }}>Click / Space / Enter</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <span style={{ color: '#94a3b8', fontSize: 12, letterSpacing: 2 }}>{label}</span>
      <strong style={{ color: '#f8fafc', fontSize: 18 }}>{value}</strong>
    </div>
  )
}

const shellStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
}

const frameStyle: CSSProperties = {
  width: 'min(720px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  padding: 22,
  borderRadius: 24,
  background: 'rgba(8, 12, 20, 0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 28px 80px rgba(0,0,0,0.4)',
}

const hudStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
}

const statStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '14px 16px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 360,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: '24px 32px',
  textAlign: 'center',
  color: '#f8fafc',
  cursor: 'pointer',
  transition: 'background 140ms ease',
}

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: 4,
  textTransform: 'uppercase',
  color: '#cbd5e1',
  marginBottom: 16,
}

const headlineStyle: CSSProperties = {
  fontSize: 44,
  fontWeight: 700,
  letterSpacing: 2,
  marginBottom: 12,
}

const subcopyStyle: CSSProperties = {
  fontSize: 15,
  color: '#e2e8f0',
  maxWidth: 520,
  lineHeight: 1.6,
}

const timeStyle: CSSProperties = {
  marginTop: 28,
  fontSize: 54,
  fontWeight: 700,
  color: '#fbbf24',
}

const footerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const resultsStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 10,
}

const chipStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.04)',
}

const summaryBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
  color: '#cbd5e1',
  fontSize: 14,
  flexWrap: 'wrap',
}
