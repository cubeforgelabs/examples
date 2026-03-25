import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type Phase = 'idle' | 'playing' | 'finished'

type RoundStats = {
  submittedWords: number
  correctWords: number
  correctChars: number
  typedChars: number
  streak: number
  bestStreak: number
}

const ROUND_MS = 60_000
const QUEUE_SIZE = 7
const STORAGE_KEY = 'typing-games-best-wpm'

const WORDS = [
  'orbit', 'signal', 'vector', 'canvas', 'spark', 'meteor', 'glimmer', 'prompt',
  'puzzle', 'steady', 'lively', 'swift', 'trace', 'anchor', 'stream', 'pulse',
  'thread', 'fable', 'glow', 'vivid', 'rocket', 'planet', 'cursor', 'syntax',
  'tunnel', 'ripple', 'tactic', 'sample', 'rare', 'skill', 'tempo', 'zenith',
  'binary', 'switch', 'story', 'quiet', 'bright', 'drift', 'motion', 'focus',
  'clutch', 'render', 'timing', 'echo', 'orbiting', 'ladder', 'charge', 'flicker',
  'native', 'harbor', 'sprint', 'carve', 'thrive', 'ember', 'launch', 'scribe',
  'prism', 'bounce', 'logic', 'streak', 'sprint', 'glance', 'drizzle', 'feature',
  'match', 'commit', 'harvest', 'shimmer', 'anchor', 'ember', 'fluent', 'rapid',
  'motive', 'current', 'tangle', 'vector', 'threaded', 'gentle', 'poised', 'signal',
  'draft', 'swerve', 'oracle', 'manual', 'brighten', 'compose', 'search', 'replay',
  'wintry', 'kudos', 'moment', 'brisk', 'focus', 'neon', 'simple', 'precise',
  'whisper', 'turbo', 'legend', 'matrix', 'preview', 'starlight', 'anchor', 'gravity',
]

function shuffleWords(source: string[]): string[] {
  const next = [...source]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function buildQueue(size: number): string[] {
  const bag = shuffleWords(WORDS)
  const queue: string[] = []

  while (queue.length < size) {
    if (bag.length === 0) {
      bag.push(...shuffleWords(WORDS))
    }

    const nextWord = bag.shift()
    if (nextWord) {
      queue.push(nextWord)
    }
  }

  return queue
}

function countMatchingChars(target: string, typed: string): { matches: number; total: number } {
  const total = Math.max(target.length, typed.length)
  let matches = 0

  for (let i = 0; i < total; i += 1) {
    if (target[i] === typed[i]) {
      matches += 1
    }
  }

  return { matches, total }
}

function formatSeconds(ms: number): string {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`
}

function loadBestWpm(): number {
  if (typeof window === 'undefined') {
    return 0
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored ? Number.parseInt(stored, 10) || 0 : 0
}

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [queue, setQueue] = useState<string[]>(() => buildQueue(QUEUE_SIZE))
  const [typed, setTyped] = useState('')
  const [remainingMs, setRemainingMs] = useState(ROUND_MS)
  const [stats, setStats] = useState<RoundStats>({
    submittedWords: 0,
    correctWords: 0,
    correctChars: 0,
    typedChars: 0,
    streak: 0,
    bestStreak: 0,
  })
  const [bestWpm, setBestWpm] = useState(loadBestWpm)
  const inputRef = useRef<HTMLInputElement>(null)
  const startAtRef = useRef(0)
  const endHandledRef = useRef(false)

  const currentWord = queue[0] ?? ''
  const nextWords = queue.slice(1, 5)

  const elapsedMs = useMemo(() => {
    if (phase === 'idle') {
      return 0
    }
    if (phase === 'finished') {
      return ROUND_MS
    }
    return ROUND_MS - remainingMs
  }, [phase, remainingMs])

  const elapsedMinutes = Math.max(elapsedMs / 60_000, 1 / 60)
  const accuracy = stats.typedChars === 0 ? 100 : Math.round((stats.correctChars / stats.typedChars) * 100)
  const wpm = Math.round((stats.correctChars / 5) / elapsedMinutes)

  const progress = Math.max(0, Math.min(100, (remainingMs / ROUND_MS) * 100))
  const timeText = formatSeconds(remainingMs)

  const startGame = useCallback(() => {
    setPhase('playing')
    setQueue(buildQueue(QUEUE_SIZE))
    setTyped('')
    setRemainingMs(ROUND_MS)
    setStats({
      submittedWords: 0,
      correctWords: 0,
      correctChars: 0,
      typedChars: 0,
      streak: 0,
      bestStreak: 0,
    })
    startAtRef.current = Date.now()
    endHandledRef.current = false
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const finishGame = useCallback(() => {
    if (endHandledRef.current) {
      return
    }

    endHandledRef.current = true
    setPhase('finished')
    setTyped('')
    setBestWpm(prev => {
      const next = Math.max(prev, wpm)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      }
      return next
    })
  }, [wpm])

  const submitWord = useCallback(() => {
    if (phase !== 'playing') {
      return
    }

    const guess = typed.trim()
    if (guess.length === 0) {
      return
    }

    const target = currentWord
    const exact = guess.toLowerCase() === target.toLowerCase()
    const { matches, total } = countMatchingChars(target.toLowerCase(), guess.toLowerCase())

    setStats(prev => {
      const streak = exact ? prev.streak + 1 : 0
      const bestStreak = Math.max(prev.bestStreak, streak)
      return {
        submittedWords: prev.submittedWords + 1,
        correctWords: prev.correctWords + (exact ? 1 : 0),
        correctChars: prev.correctChars + matches,
        typedChars: prev.typedChars + total,
        streak,
        bestStreak,
      }
    })

    setQueue(prev => [...prev.slice(1), buildQueue(1)[0] ?? ''])
    setTyped('')
    inputRef.current?.focus()
  }, [currentWord, phase, typed])

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startAtRef.current
      const nextRemaining = Math.max(0, ROUND_MS - elapsed)
      setRemainingMs(nextRemaining)

      if (nextRemaining === 0) {
        finishGame()
      }
    }, 50)

    return () => window.clearInterval(timer)
  }, [finishGame, phase])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((phase === 'idle' || phase === 'finished') && (event.code === 'Enter' || event.code === 'Space')) {
        event.preventDefault()
        startGame()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [phase, startGame])

  const currentWordLetters = currentWord.split('')

  return (
    <div style={styles.shell}>
      <div style={styles.blobOne} />
      <div style={styles.blobTwo} />

      <main style={styles.frame}>
        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>Cubeforge mini-game</p>
            <h1 style={styles.title}>Typing Games</h1>
            <p style={styles.subtitle}>
              Type fast, stay precise, and keep your streak alive until the timer runs out.
            </p>
          </div>
          <div style={styles.hintPill}>
            <span style={styles.hintKey}>Space</span>
            <span>submit word</span>
            <span style={styles.hintDivider}>•</span>
            <span style={styles.hintKey}>Enter</span>
            <span>start</span>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <Metric label="Time left" value={timeText} accent={remainingMs <= 10_000 ? '#ff7a90' : '#8be9fd'} />
          <Metric label="WPM" value={String(wpm)} accent="#9ef7c7" />
          <Metric label="Accuracy" value={`${accuracy}%`} accent="#f8d66d" />
          <Metric label="Streak" value={String(stats.streak)} accent="#cdb8ff" />
        </section>

        <section style={styles.board}>
          <div style={styles.boardTopRow}>
            <div>
              <p style={styles.sectionLabel}>Current word</p>
              <div style={styles.wordRow}>
                {currentWordLetters.map((letter, index) => {
                  const typedLetter = typed[index]
                  const state =
                    typedLetter === undefined ? 'idle' : typedLetter.toLowerCase() === letter.toLowerCase() ? 'match' : 'miss'

                  return (
                    <span
                      key={`${letter}-${index}`}
                      style={{
                        ...styles.letter,
                        ...(state === 'match' ? styles.letterMatch : {}),
                        ...(state === 'miss' ? styles.letterMiss : {}),
                        ...(typed[index] ? styles.letterTyped : {}),
                      }}
                    >
                      {letter}
                    </span>
                  )
                })}
                {typed.slice(currentWord.length).split('').map((letter, index) => (
                  <span key={`${letter}-${index}-overflow`} style={{ ...styles.letter, ...styles.letterMiss }}>
                    {letter}
                  </span>
                ))}
              </div>
            </div>

            <div style={styles.boardStats}>
              <div>
                <p style={styles.smallLabel}>Words</p>
                <p style={styles.smallValue}>{stats.submittedWords}</p>
              </div>
              <div>
                <p style={styles.smallLabel}>Best streak</p>
                <p style={styles.smallValue}>{stats.bestStreak}</p>
              </div>
              <div>
                <p style={styles.smallLabel}>Best WPM</p>
                <p style={styles.smallValue}>{bestWpm}</p>
              </div>
            </div>
          </div>

          <div style={styles.progressShell} aria-hidden="true">
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>

          <div style={styles.queueRow}>
            <p style={styles.sectionLabel}>Upcoming</p>
            <div style={styles.queueChips}>
              {nextWords.map(word => (
                <span key={word} style={styles.queueChip}>
                  {word}
                </span>
              ))}
            </div>
          </div>

          <form
            onSubmit={event => {
              event.preventDefault()
              submitWord()
            }}
            style={styles.form}
          >
            <label style={styles.inputWrap}>
              <span style={styles.inputLabel}>Type the current word</span>
              <input
                ref={inputRef}
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => {
                  if (phase !== 'playing') {
                    return
                  }

                  if (event.code === 'Space' || event.code === 'Enter') {
                    event.preventDefault()
                    submitWord()
                  }
                }}
                placeholder={phase === 'playing' ? 'Keep typing...' : 'Press Enter to start'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={phase !== 'playing'}
                inputMode="text"
                style={{
                  ...styles.input,
                  ...(phase !== 'playing' ? styles.inputDisabled : {}),
                }}
              />
            </label>

            <button
              type="submit"
              disabled={phase !== 'playing'}
              style={{
                ...styles.primaryButton,
                ...(phase !== 'playing' ? styles.primaryButtonDisabled : {}),
              }}
            >
              Submit word
            </button>
          </form>

          <div style={styles.footerRow}>
            <p style={styles.footerCopy}>
              Exact words grow your streak. Clean typing keeps WPM high.
            </p>
            <p style={styles.footerCopy}>
              Backspace to correct mistakes before submitting.
            </p>
          </div>

          {phase !== 'playing' && (
            <div style={styles.overlay}>
              <div style={styles.overlayCard}>
                <p style={styles.overlayKicker}>
                  {phase === 'idle' ? 'Ready to run' : 'Round complete'}
                </p>
                <h2 style={styles.overlayTitle}>
                  {phase === 'idle' ? 'Press Enter to start your first round.' : 'Nice work. Ready for a rematch?'}
                </h2>
                <p style={styles.overlayText}>
                  {phase === 'idle'
                    ? 'Your goal is simple: type the current word, hit Space or Enter, and keep moving.'
                    : `Final score: ${wpm} WPM at ${accuracy}% accuracy with a best streak of ${stats.bestStreak}.`}
                </p>
                <button type="button" onClick={startGame} style={styles.primaryButton}>
                  {phase === 'idle' ? 'Start round' : 'Play again'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={{ ...styles.metricValue, color: accent }}>{value}</p>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: '32px 18px',
    position: 'relative',
    overflow: 'hidden',
  },
  frame: {
    width: 'min(1080px, 100%)',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    position: 'relative',
    zIndex: 1,
  },
  blobOne: {
    position: 'absolute',
    inset: 'auto auto 55% -8%',
    width: 360,
    height: 360,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(123, 92, 255, 0.24), transparent 68%)',
    filter: 'blur(8px)',
  },
  blobTwo: {
    position: 'absolute',
    inset: '10% -6% auto auto',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(46, 196, 182, 0.18), transparent 68%)',
    filter: 'blur(10px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '8px 4px',
  },
  kicker: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    fontSize: 12,
    color: '#8ea2c8',
  },
  title: {
    margin: '8px 0 10px',
    fontSize: 'clamp(42px, 7vw, 74px)',
    lineHeight: 0.95,
    letterSpacing: '-0.06em',
    color: '#f8fbff',
  },
  subtitle: {
    margin: 0,
    maxWidth: 660,
    color: '#b7c3da',
    fontSize: 16,
    lineHeight: 1.55,
  },
  hintPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderRadius: 999,
    border: '1px solid rgba(150, 178, 255, 0.18)',
    background: 'rgba(11, 17, 31, 0.7)',
    backdropFilter: 'blur(18px)',
    color: '#c8d4ea',
    fontSize: 13,
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
    whiteSpace: 'nowrap',
  },
  hintKey: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#f5f7fb',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  hintDivider: {
    color: '#6f7f9f',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
  },
  metricCard: {
    padding: '16px 18px',
    borderRadius: 18,
    background: 'rgba(9, 15, 29, 0.76)',
    border: '1px solid rgba(150, 178, 255, 0.12)',
    backdropFilter: 'blur(18px)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22)',
  },
  metricLabel: {
    margin: 0,
    color: '#93a8c9',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
  metricValue: {
    margin: '8px 0 0',
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: '-0.05em',
  },
  board: {
    position: 'relative',
    padding: 28,
    borderRadius: 28,
    background: 'linear-gradient(180deg, rgba(10, 16, 32, 0.92), rgba(7, 12, 24, 0.9))',
    border: '1px solid rgba(155, 184, 255, 0.12)',
    boxShadow: '0 24px 80px rgba(2, 8, 22, 0.48)',
    overflow: 'hidden',
  },
  boardTopRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(260px, 0.8fr)',
    gap: 20,
    alignItems: 'start',
  },
  sectionLabel: {
    margin: 0,
    color: '#8ea2c8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
  wordRow: {
    marginTop: 14,
    minHeight: 88,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    fontSize: 'clamp(28px, 5vw, 58px)',
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: '-0.05em',
  },
  letter: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    color: '#dfe8f7',
    opacity: 0.48,
    transition: 'color 120ms ease, opacity 120ms ease, transform 120ms ease',
  },
  letterTyped: {
    opacity: 1,
  },
  letterMatch: {
    color: '#9ef7c7',
    opacity: 1,
    transform: 'translateY(-1px)',
  },
  letterMiss: {
    color: '#ff8ba1',
    opacity: 1,
  },
  boardStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(150, 178, 255, 0.08)',
  },
  smallLabel: {
    margin: 0,
    color: '#8ea2c8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  smallValue: {
    margin: '8px 0 0',
    color: '#f7faff',
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.05em',
  },
  progressShell: {
    marginTop: 18,
    height: 12,
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #66f0c8 0%, #72a6ff 54%, #c57dff 100%)',
    transition: 'width 80ms linear',
  },
  queueRow: {
    marginTop: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  queueChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  queueChip: {
    padding: '10px 14px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(150, 178, 255, 0.10)',
    color: '#d4def2',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  form: {
    marginTop: 24,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'end',
  },
  inputWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  inputLabel: {
    color: '#8ea2c8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
  input: {
    minHeight: 64,
    padding: '16px 18px',
    borderRadius: 18,
    border: '1px solid rgba(150, 178, 255, 0.16)',
    background: 'rgba(5, 10, 21, 0.9)',
    color: '#f7fbff',
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 0 rgba(114, 166, 255, 0.0)',
    transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
  },
  inputDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  primaryButton: {
    minHeight: 64,
    padding: '0 20px',
    borderRadius: 18,
    border: 'none',
    background: 'linear-gradient(135deg, #72a6ff 0%, #7b5cff 100%)',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    boxShadow: '0 16px 32px rgba(89, 109, 255, 0.3)',
    transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  footerRow: {
    marginTop: 18,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerCopy: {
    margin: 0,
    color: '#96a8c8',
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'linear-gradient(180deg, rgba(3, 8, 18, 0.28), rgba(3, 8, 18, 0.62))',
    backdropFilter: 'blur(8px)',
  },
  overlayCard: {
    width: 'min(560px, 100%)',
    padding: 28,
    borderRadius: 24,
    background: 'rgba(8, 14, 27, 0.88)',
    border: '1px solid rgba(150, 178, 255, 0.14)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.36)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    textAlign: 'center',
  },
  overlayKicker: {
    margin: 0,
    color: '#8be9fd',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
  },
  overlayTitle: {
    margin: 0,
    fontSize: 'clamp(28px, 4vw, 42px)',
    lineHeight: 1.02,
    letterSpacing: '-0.05em',
    color: '#f8fbff',
  },
  overlayText: {
    margin: 0,
    color: '#b8c5dc',
    fontSize: 16,
    lineHeight: 1.6,
  },
}
