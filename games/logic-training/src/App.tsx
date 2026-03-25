import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

type ColorFamily = 'warm' | 'cool' | 'neutral'
type ShapeFamily = 'round' | 'angular' | 'sharp'
type Screen = 'playing' | 'summary' | 'complete' | 'gameover'
type SummaryKind = 'success' | 'failure'

type ColorToken = {
  name: string
  hex: string
  family: ColorFamily
  brightness: 'bright' | 'mid' | 'deep'
}

type ShapeToken = {
  name: string
  glyph: string
  family: ShapeFamily
}

type Candidate = {
  id: number
  name: string
  color: ColorToken
  shape: ShapeToken
  code: number
}

type Clue = {
  tag: string
  text: string
  test: (candidate: Candidate) => boolean
  accent: string
}

type Round = {
  level: number
  candidates: Candidate[]
  targetIndex: number
  clues: Clue[]
  attempts: number
}

type Summary = {
  kind: SummaryKind
  title: string
  body: string
  action: string
}

const TOTAL_ROUNDS = 8
const START_LIVES = 3
const APP_FRAME_HEIGHT = 640

const NAMES = [
  'Atlas', 'Nova', 'Cipher', 'Echo', 'Mira', 'Orion', 'Iris', 'Flux',
  'Kestrel', 'Juno', 'Pulse', 'Lumen', 'Sable', 'Halo', 'Vega', 'Quill',
]

const COLORS: ColorToken[] = [
  { name: 'Crimson', hex: '#ff5c7a', family: 'warm', brightness: 'bright' },
  { name: 'Amber', hex: '#ffb347', family: 'warm', brightness: 'bright' },
  { name: 'Copper', hex: '#dd8452', family: 'warm', brightness: 'mid' },
  { name: 'Cyan', hex: '#49d6ff', family: 'cool', brightness: 'bright' },
  { name: 'Teal', hex: '#4bd7c4', family: 'cool', brightness: 'mid' },
  { name: 'Indigo', hex: '#7d8cff', family: 'cool', brightness: 'deep' },
  { name: 'Slate', hex: '#8ea1b8', family: 'neutral', brightness: 'mid' },
  { name: 'Sand', hex: '#d9c2a4', family: 'neutral', brightness: 'bright' },
  { name: 'Stone', hex: '#a79b92', family: 'neutral', brightness: 'deep' },
]

const SHAPES: ShapeToken[] = [
  { name: 'Circle', glyph: '◯', family: 'round' },
  { name: 'Orbit', glyph: '◔', family: 'round' },
  { name: 'Triangle', glyph: '△', family: 'angular' },
  { name: 'Diamond', glyph: '◇', family: 'angular' },
  { name: 'Bolt', glyph: '⚡', family: 'sharp' },
  { name: 'Star', glyph: '✦', family: 'sharp' },
]

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isPrime(value: number): boolean {
  if (value < 2) return false
  for (let index = 2; index * index <= value; index += 1) {
    if (value % index === 0) return false
  }
  return true
}

function bandForCode(code: number): 'low' | 'mid' | 'high' {
  if (code <= 3) return 'low'
  if (code <= 6) return 'mid'
  return 'high'
}

function labelForFamily(family: ColorFamily): string {
  return family === 'warm' ? 'warm' : family === 'cool' ? 'cool' : 'neutral'
}

function labelForShape(family: ShapeFamily): string {
  return family === 'round' ? 'rounded' : family === 'angular' ? 'angular' : 'sharp-edged'
}

function attemptsForLevel(level: number): number {
  return clamp(2 + Math.floor((level - 1) / 2), 2, 4)
}

function candidateCountForLevel(level: number): number {
  return clamp(4 + Math.floor((level - 1) / 2), 4, 7)
}

function scoreForRound(level: number, attemptsRemaining: number, misses: number): number {
  return 100 + level * 30 + attemptsRemaining * 25 - misses * 8
}

function makeCandidates(level: number): Candidate[] {
  const count = candidateCountForLevel(level)
  const names = shuffle(NAMES).slice(0, count)
  const colors = shuffle(COLORS)
  const shapes = shuffle(SHAPES)
  const codes = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, count)

  return names.map((name, index) => ({
    id: index,
    name,
    color: colors[index % colors.length],
    shape: shapes[index % shapes.length],
    code: codes[index],
  }))
}

function countMatchingCandidates(candidates: Candidate[], clues: Clue[]): number {
  return candidates.filter((candidate) => clues.every((clue) => clue.test(candidate))).length
}

function createRound(level: number): Round {
  const candidates = makeCandidates(level)
  const targetIndex = Math.floor(Math.random() * candidates.length)
  const target = candidates[targetIndex]
  const desiredClues = clamp(2 + Math.floor((level - 1) / 2), 2, 4)
  const clues: Clue[] = []

  const cluePool: Clue[] = [
    {
      tag: 'Color',
      text: `The beacon uses a ${labelForFamily(target.color.family)} color.`,
      test: (candidate) => candidate.color.family === target.color.family,
      accent: target.color.hex,
    },
    {
      tag: 'Shape',
      text: `Its icon is ${labelForShape(target.shape.family)}.`,
      test: (candidate) => candidate.shape.family === target.shape.family,
      accent: '#7dd3fc',
    },
    {
      tag: 'Code',
      text: `The code is ${target.code % 2 === 0 ? 'even' : 'odd'}.`,
      test: (candidate) => candidate.code % 2 === target.code % 2,
      accent: '#c084fc',
    },
    {
      tag: 'Band',
      text: `The code sits in the ${bandForCode(target.code)} band.`,
      test: (candidate) => bandForCode(candidate.code) === bandForCode(target.code),
      accent: '#f59e0b',
    },
    {
      tag: 'Prime',
      text: `The code is ${isPrime(target.code) ? 'prime' : 'not prime'}.`,
      test: (candidate) => isPrime(candidate.code) === isPrime(target.code),
      accent: '#34d399',
    },
    {
      tag: 'Brightness',
      text: `The color is ${target.color.brightness}.`,
      test: (candidate) => candidate.color.brightness === target.color.brightness,
      accent: '#60a5fa',
    },
  ]

  for (const clue of shuffle(cluePool)) {
    clues.push(clue)
    const matching = countMatchingCandidates(candidates, clues)
    if (clues.length >= desiredClues && matching === 1) {
      break
    }
  }

  if (countMatchingCandidates(candidates, clues) !== 1) {
    clues.push({
      tag: 'Fallback',
      text: `The answer is ${target.name}.`,
      test: (candidate) => candidate.name === target.name,
      accent: '#f87171',
    })
  }

  return {
    level,
    candidates,
    targetIndex,
    clues,
    attempts: attemptsForLevel(level),
  }
}

function progressText(round: number): string {
  return `${round}/${TOTAL_ROUNDS}`
}

export function App() {
  const [screen, setScreen] = useState<Screen>('playing')
  const [roundNumber, setRoundNumber] = useState(1)
  const [round, setRound] = useState(() => createRound(1))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [solvedRounds, setSolvedRounds] = useState(0)
  const [failedRounds, setFailedRounds] = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(round.attempts)
  const [misses, setMisses] = useState<number[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)

  const correctCandidate = round.candidates[round.targetIndex]
  const accuracy = useMemo(() => {
    const totalRounds = solvedRounds + failedRounds
    if (totalRounds === 0) return 100
    return Math.round((solvedRounds / totalRounds) * 100)
  }, [failedRounds, solvedRounds])

  const beginRound = useCallback((nextRoundNumber: number) => {
    const nextRound = createRound(nextRoundNumber)
    setRoundNumber(nextRoundNumber)
    setRound(nextRound)
    setAttemptsLeft(nextRound.attempts)
    setMisses([])
    setSelectedIndex(0)
    setSummary(null)
    setScreen('playing')
  }, [])

  const restart = useCallback(() => {
    setScreen('playing')
    setRoundNumber(1)
    const firstRound = createRound(1)
    setRound(firstRound)
    setScore(0)
    setLives(START_LIVES)
    setStreak(0)
    setBestStreak(0)
    setSolvedRounds(0)
    setFailedRounds(0)
    setAttemptsLeft(firstRound.attempts)
    setMisses([])
    setSelectedIndex(0)
    setSummary(null)
  }, [])

  const endRound = useCallback(
    (kind: SummaryKind, title: string, body: string) => {
      setSummary({
        kind,
        title,
        body,
        action: roundNumber >= TOTAL_ROUNDS && kind === 'success' ? 'View results' : 'Continue',
      })
      if (kind === 'success') {
        setSolvedRounds((value) => value + 1)
      } else {
        setFailedRounds((value) => value + 1)
        setStreak(0)
      }

      if (kind === 'failure') {
        setLives((value) => value - 1)
      }

      if (roundNumber >= TOTAL_ROUNDS) {
        setScreen('complete')
        return
      }

      if (kind === 'failure' && lives - 1 <= 0) {
        setScreen('gameover')
        return
      }

      setScreen('summary')
    },
    [lives, roundNumber],
  )

  const chooseCandidate = useCallback(
    (index: number) => {
      if (screen !== 'playing') return
      if (misses.includes(index)) return

      setSelectedIndex(index)

      if (index === round.targetIndex) {
        const gained = scoreForRound(roundNumber, attemptsLeft, misses.length)
        const nextStreak = streak + 1
        setScore((value) => value + gained)
        setStreak(nextStreak)
        setBestStreak((currentBest) => Math.max(currentBest, nextStreak))
        endRound('success', 'Signal confirmed', `${round.candidates[index].name} matched every clue and earned +${gained} points.`)
        return
      }

      const nextAttempts = attemptsLeft - 1
      const nextMisses = [...misses, index]
      setAttemptsLeft(nextAttempts)
      setMisses(nextMisses)
      setScore((value) => Math.max(0, value - 5))

      if (nextAttempts <= 0) {
        endRound(
          'failure',
          'Out of attempts',
          `The target was ${correctCandidate.name}. The round costs one life.`,
        )
      }
    },
    [attemptsLeft, correctCandidate.name, endRound, misses, round.candidates, round.targetIndex, roundNumber, screen],
  )

  const continueFromSummary = useCallback(() => {
    if (!summary) return

    if (screen === 'complete' || screen === 'gameover') {
      return
    }

    if (summary.kind === 'failure' && lives <= 0) {
      setScreen('gameover')
      return
    }

    const nextRound = roundNumber + 1
    if (nextRound > TOTAL_ROUNDS) {
      setScreen('complete')
      return
    }

    beginRound(nextRound)
  }, [beginRound, lives, roundNumber, screen, summary])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== 'playing') return

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((index) => (index - 1 + round.candidates.length) % round.candidates.length)
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((index) => (index + 1) % round.candidates.length)
        return
      }

      if (event.key >= '1' && event.key <= String(round.candidates.length)) {
        event.preventDefault()
        chooseCandidate(Number(event.key) - 1)
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        chooseCandidate(selectedIndex)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chooseCandidate, round.candidates.length, screen, selectedIndex])

  const screenTitle =
    screen === 'complete'
      ? 'Training complete'
      : screen === 'gameover'
        ? 'Training failed'
        : 'Logic Training'

  const screenSubtitle =
    screen === 'complete'
      ? 'You cleared every round.'
      : screen === 'gameover'
        ? 'All lives are spent.'
        : 'Deduce the correct beacon from the clue stack.'

  return (
    <div style={styles.shell}>
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      <div style={styles.frame}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>cubeforge / puzzle example</p>
            <h1 style={styles.title}>{screenTitle}</h1>
            <p style={styles.subtitle}>{screenSubtitle}</p>
          </div>

          <div style={styles.hudRow}>
            <HudPill label="Round" value={progressText(roundNumber)} />
            <HudPill label="Score" value={score.toString()} />
            <HudPill label="Lives" value={lives.toString()} tone={lives === 1 ? 'warn' : 'default'} />
            <HudPill label="Streak" value={streak.toString()} />
          </div>
        </header>

        <main style={styles.mainGrid}>
          <section style={styles.board}>
            <div style={styles.boardTop}>
              <div>
                <p style={styles.sectionLabel}>Case file</p>
                <h2 style={styles.boardTitle}>Find the one beacon that fits every clue.</h2>
              </div>

              <div style={styles.boardMeta}>
                <span>Attempts left: {attemptsLeft}</span>
                <span>Accuracy: {accuracy}%</span>
                <span>Best streak: {bestStreak}</span>
              </div>
            </div>

            <div style={styles.clueGrid}>
              {round.clues.map((clue, index) => (
                <article
                  key={`${clue.tag}-${index}`}
                  style={{
                    ...styles.clueCard,
                    borderColor: `${clue.accent}44`,
                    boxShadow: `0 0 0 1px ${clue.accent}22 inset`,
                  }}
                >
                  <div style={styles.clueTagWrap}>
                    <span
                      style={{
                        ...styles.clueTag,
                        background: `${clue.accent}22`,
                        color: clue.accent,
                      }}
                    >
                      {clue.tag}
                    </span>
                  </div>
                  <p style={styles.clueText}>{clue.text}</p>
                </article>
              ))}
            </div>

            <div style={styles.candidateGrid}>
              {round.candidates.map((candidate, index) => {
                const eliminated = misses.includes(index)
                const active = index === selectedIndex
                const solved = screen !== 'playing' && index === round.targetIndex

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={screen !== 'playing' || eliminated}
                    onClick={() => chooseCandidate(index)}
                    onMouseEnter={() => {
                      if (screen === 'playing') {
                        setSelectedIndex(index)
                      }
                    }}
                    style={{
                      ...styles.card,
                      background: `${candidate.color.hex}1f`,
                      borderColor: solved
                        ? '#34d399'
                        : eliminated
                          ? 'rgba(248, 113, 113, 0.45)'
                          : active
                            ? 'rgba(125, 211, 252, 0.95)'
                            : 'rgba(148, 163, 184, 0.18)',
                      transform: active ? 'translateY(-2px)' : 'translateY(0)',
                      opacity: eliminated ? 0.45 : 1,
                      boxShadow: active
                        ? '0 12px 34px rgba(56, 189, 248, 0.14)'
                        : '0 10px 24px rgba(0, 0, 0, 0.28)',
                    }}
                  >
                    <div style={styles.cardTop}>
                      <div style={{ ...styles.shapeBadge, borderColor: candidate.color.hex }}>
                        <span style={{ ...styles.shapeGlyph, color: candidate.color.hex }}>
                          {candidate.shape.glyph}
                        </span>
                      </div>
                      <div style={styles.cardNameWrap}>
                        <span style={styles.cardName}>{candidate.name}</span>
                        <span style={styles.cardHint}>
                          {index + 1} · {candidate.color.name}
                        </span>
                      </div>
                    </div>

                    <div style={styles.cardMeta}>
                      <span style={styles.metaChip}>code {candidate.code}</span>
                      <span style={styles.metaChip}>{candidate.shape.name}</span>
                    </div>

                    <div style={styles.cardFooter}>
                      <span style={{ ...styles.familyBadge, color: candidate.color.hex }}>
                        {candidate.color.family} color
                      </span>
                      <span style={styles.cardIndex}>#{index + 1}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {screen === 'playing' && (
              <div style={styles.instructions}>
                <span>Click a card or use number keys 1-{round.candidates.length}.</span>
                <span>Arrow keys move the focus. Enter confirms.</span>
              </div>
            )}

            {summary && screen === 'summary' && (
              <div style={styles.overlay}>
                <div style={styles.overlayCard}>
                  <p style={styles.overlayKicker}>{summary.kind === 'success' ? 'Round cleared' : 'Round failed'}</p>
                  <h3 style={styles.overlayTitle}>{summary.title}</h3>
                  <p style={styles.overlayBody}>{summary.body}</p>
                  <div style={styles.overlayActions}>
                    <button type="button" onClick={continueFromSummary} style={styles.primaryButton}>
                      {summary.action}
                    </button>
                    <button type="button" onClick={restart} style={styles.secondaryButton}>
                      Restart run
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(screen === 'complete' || screen === 'gameover') && (
              <div style={styles.overlay}>
                <div style={styles.overlayCard}>
                  <p style={styles.overlayKicker}>
                    {screen === 'complete' ? 'Campaign finished' : 'Campaign over'}
                  </p>
                  <h3 style={styles.overlayTitle}>
                    {screen === 'complete' ? 'Training complete' : 'No lives left'}
                  </h3>
                  <p style={styles.overlayBody}>
                    {screen === 'complete'
                      ? `You cleared all ${TOTAL_ROUNDS} rounds with ${score} points and an accuracy of ${accuracy}%.`
                      : `Final score: ${score}. You solved ${solvedRounds} rounds before the board got away from you.`}
                  </p>
                  <div style={styles.overlayActions}>
                    <button type="button" onClick={restart} style={styles.primaryButton}>
                      Restart run
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside style={styles.sidebar}>
            <div style={styles.sidePanel}>
              <p style={styles.sectionLabel}>Training notes</p>
              <div style={styles.sideStack}>
                <p style={styles.sideTitle}>What to watch for</p>
                <p style={styles.sideBody}>
                  Each round adds more candidates and tighter clue combinations. Wrong picks get ruled out,
                  but they also cost score and attempts.
                </p>
              </div>

              <div style={styles.sideGrid}>
                <Stat label="Solved" value={solvedRounds.toString()} />
                <Stat label="Failed" value={failedRounds.toString()} />
                <Stat label="Attempts" value={attemptsLeft.toString()} />
                <Stat label="Best streak" value={bestStreak.toString()} />
              </div>

              <div style={styles.sideStack}>
                <p style={styles.sideTitle}>Controls</p>
                <ul style={styles.controlList}>
                  <li>Click a beacon to lock in a guess.</li>
                  <li>Number keys choose cards directly.</li>
                  <li>Arrow keys move the active selection.</li>
                  <li>Enter confirms the highlighted beacon.</li>
                </ul>
              </div>

              <div style={styles.sideStack}>
                <p style={styles.sideTitle}>Round status</p>
                <p style={styles.sideBody}>
                  {screen === 'playing'
                    ? `Round ${round.level} is live. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remain.`
                    : summary?.body ?? 'The board is waiting for the next move.'}
                </p>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}

function HudPill({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
  return (
    <div
      style={{
        ...styles.hudPill,
        borderColor: tone === 'warn' ? 'rgba(248, 113, 113, 0.4)' : 'rgba(148, 163, 184, 0.18)',
      }}
    >
      <span style={styles.hudLabel}>{label}</span>
      <strong style={{ ...styles.hudValue, color: tone === 'warn' ? '#fda4af' : '#f8fafc' }}>{value}</strong>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0 24px',
  },
  glowA: {
    display: 'none',
  },
  glowB: {
    display: 'none',
  },
  frame: {
    width: 'min(1180px, 100%)',
    height: APP_FRAME_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: 20,
    borderRadius: 28,
    background: 'rgba(8, 13, 24, 0.96)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.32)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#7dd3fc',
  },
  title: {
    margin: '6px 0 0',
    fontSize: 'clamp(34px, 5vw, 58px)',
    lineHeight: 0.96,
    letterSpacing: -1.5,
    color: '#f8fafc',
  },
  subtitle: {
    margin: '10px 0 0',
    maxWidth: 560,
    color: '#b6c2da',
    fontSize: 15,
    lineHeight: 1.6,
  },
  hudRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(92px, 1fr))',
    gap: 10,
    width: 'min(520px, 100%)',
  },
  hudPill: {
    padding: '12px 14px',
    borderRadius: 16,
    background: 'rgba(8, 17, 31, 0.76)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.24)',
    backdropFilter: 'blur(12px)',
  },
  hudLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  hudValue: {
    fontSize: 24,
    lineHeight: 1,
    letterSpacing: -1,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.72fr)',
    gap: 18,
    flex: 1,
    minHeight: 0,
  },
  board: {
    position: 'relative',
    overflow: 'auto',
    padding: 20,
    borderRadius: 28,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(6, 11, 21, 0.82)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.38)',
    backdropFilter: 'blur(14px)',
    minHeight: 0,
  },
  boardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'flex-end',
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    margin: 0,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#7dd3fc',
  },
  boardTitle: {
    margin: '8px 0 0',
    fontSize: 22,
    color: '#f8fafc',
    lineHeight: 1.2,
  },
  boardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    color: '#a8b3c9',
    fontSize: 13,
  },
  clueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  clueCard: {
    borderRadius: 18,
    padding: 14,
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    minHeight: 92,
  },
  clueTagWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clueTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  clueText: {
    margin: 0,
    color: '#d4def0',
    lineHeight: 1.5,
    fontSize: 14,
  },
  candidateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
  },
  card: {
    position: 'relative',
    padding: 16,
    borderRadius: 22,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    textAlign: 'left',
    color: '#f8fafc',
    minHeight: 178,
    transition: 'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
    overflow: 'hidden',
  },
  cardTop: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  shapeBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  shapeGlyph: {
    fontSize: 26,
    lineHeight: 1,
    textShadow: '0 0 18px rgba(255, 255, 255, 0.1)',
  },
  cardNameWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardName: {
    fontSize: 21,
    fontWeight: 800,
    letterSpacing: -0.6,
  },
  cardHint: {
    color: '#a8b3c9',
    fontSize: 13,
  },
  cardMeta: {
    marginTop: 16,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.07)',
    color: '#dbe5f6',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  cardFooter: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  familyBadge: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  cardIndex: {
    fontSize: 12,
    color: '#8ea1b8',
    letterSpacing: 1.5,
  },
  instructions: {
    marginTop: 14,
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    color: '#93a4c4',
    fontSize: 13,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(6, 11, 21, 0.68)',
    backdropFilter: 'blur(8px)',
    display: 'grid',
    placeItems: 'center',
    borderRadius: 28,
    padding: 18,
  },
  overlayCard: {
    width: 'min(520px, 100%)',
    background: 'rgba(15, 23, 42, 0.98)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 30px 90px rgba(0, 0, 0, 0.42)',
  },
  overlayKicker: {
    margin: 0,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#7dd3fc',
  },
  overlayTitle: {
    margin: '10px 0 0',
    fontSize: 28,
    letterSpacing: -0.8,
    color: '#f8fafc',
  },
  overlayBody: {
    margin: '12px 0 0',
    color: '#c6d3e7',
    lineHeight: 1.6,
    fontSize: 15,
  },
  overlayActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 18,
  },
  primaryButton: {
    border: 'none',
    borderRadius: 14,
    padding: '12px 18px',
    background: '#38bdf8',
    color: '#f8fafc',
    fontWeight: 800,
    boxShadow: '0 14px 32px rgba(56, 189, 248, 0.18)',
  },
  secondaryButton: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 14,
    padding: '12px 18px',
    background: 'rgba(255, 255, 255, 0.03)',
    color: '#e2e8f0',
    fontWeight: 700,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: 0,
    overflow: 'auto',
  },
  sidePanel: {
    borderRadius: 28,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(6, 11, 21, 0.78)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.28)',
    backdropFilter: 'blur(14px)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  sideStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sideTitle: {
    margin: 0,
    fontSize: 18,
    color: '#f8fafc',
  },
  sideBody: {
    margin: 0,
    color: '#b6c2da',
    lineHeight: 1.6,
    fontSize: 14,
  },
  sideGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  statCard: {
    borderRadius: 18,
    padding: '12px 14px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#8ea1b8',
  },
  statValue: {
    fontSize: 20,
    color: '#f8fafc',
  },
  controlList: {
    margin: 0,
    paddingLeft: 18,
    color: '#c6d3e7',
    lineHeight: 1.7,
    fontSize: 14,
  },
}
