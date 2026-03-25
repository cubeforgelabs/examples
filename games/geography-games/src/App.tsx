import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Phase = 'idle' | 'playing' | 'finished'
type Feedback = {
  kind: 'correct' | 'wrong'
  title: string
  detail: string
}

type Question = {
  prompt: string
  choices: string[]
  correctIndex: number
  fact: string
}

type SessionStats = {
  score: number
  correct: number
  wrong: number
  streak: number
  bestStreak: number
  answered: number
}

const ROUND_MS = 60_000
const TIMER_BONUS_MS = 3000
const TIMER_PENALTY_MS = 5000
const FEEDBACK_MS = 900
const STORAGE_KEY = 'geography-games-best-score'
const APP_FRAME_HEIGHT = 640

const QUESTION_BANK: Question[] = [
  {
    prompt: 'What is the capital of Japan?',
    choices: ['Tokyo', 'Osaka', 'Kyoto', 'Sapporo'],
    correctIndex: 0,
    fact: 'Tokyo is one of the largest metropolitan areas in the world.',
  },
  {
    prompt: 'What is the capital of Canada?',
    choices: ['Toronto', 'Ottawa', 'Vancouver', 'Montreal'],
    correctIndex: 1,
    fact: 'Ottawa was chosen as a compromise between English-speaking and French-speaking Canada.',
  },
  {
    prompt: 'Which continent is Morocco in?',
    choices: ['Africa', 'Asia', 'Europe', 'South America'],
    correctIndex: 0,
    fact: 'Morocco sits in North Africa along the Atlantic and Mediterranean coasts.',
  },
  {
    prompt: 'Which country has the capital Reykjavik?',
    choices: ['Iceland', 'Ireland', 'Norway', 'Finland'],
    correctIndex: 0,
    fact: 'Reykjavik is the northernmost national capital in the world.',
  },
  {
    prompt: 'What is the capital of Australia?',
    choices: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctIndex: 2,
    fact: 'Canberra was selected as a planned capital between Sydney and Melbourne.',
  },
  {
    prompt: 'Which continent is Argentina in?',
    choices: ['Asia', 'Europe', 'South America', 'Africa'],
    correctIndex: 2,
    fact: 'Argentina stretches from tropical northern regions to Patagonia in the south.',
  },
  {
    prompt: 'What is the capital of Egypt?',
    choices: ['Alexandria', 'Cairo', 'Giza', 'Luxor'],
    correctIndex: 1,
    fact: 'Cairo sits near the Nile Delta and is the largest city in the Arab world.',
  },
  {
    prompt: 'Which country has the capital Lima?',
    choices: ['Chile', 'Colombia', 'Peru', 'Ecuador'],
    correctIndex: 2,
    fact: 'Lima lies on Peru\'s Pacific coast.',
  },
  {
    prompt: 'What is the capital of Brazil?',
    choices: ['Rio de Janeiro', 'Sao Paulo', 'Brasilia', 'Salvador'],
    correctIndex: 2,
    fact: 'Brasilia was built inland to help develop the country\'s interior.',
  },
  {
    prompt: 'Which continent is Thailand in?',
    choices: ['Europe', 'Asia', 'Africa', 'Oceania'],
    correctIndex: 1,
    fact: 'Thailand is part of mainland Southeast Asia.',
  },
  {
    prompt: 'Which country has the capital Nairobi?',
    choices: ['Kenya', 'Nigeria', 'Ghana', 'Ethiopia'],
    correctIndex: 0,
    fact: 'Nairobi is a major East African hub and gateway to many national parks.',
  },
  {
    prompt: 'What is the capital of Mexico?',
    choices: ['Guadalajara', 'Mexico City', 'Puebla', 'Monterrey'],
    correctIndex: 1,
    fact: 'Mexico City is one of the largest cities in the Western Hemisphere.',
  },
  {
    prompt: 'Which continent is New Zealand in?',
    choices: ['Europe', 'Asia', 'Oceania', 'South America'],
    correctIndex: 2,
    fact: 'New Zealand is part of the Oceania region in the southwest Pacific.',
  },
  {
    prompt: 'What is the capital of India?',
    choices: ['Mumbai', 'New Delhi', 'Bengaluru', 'Kolkata'],
    correctIndex: 1,
    fact: 'New Delhi is the capital territory within the larger Delhi metro area.',
  },
  {
    prompt: 'Which country has the capital Oslo?',
    choices: ['Sweden', 'Denmark', 'Norway', 'Finland'],
    correctIndex: 2,
    fact: 'Oslo sits at the head of the Oslofjord on Norway\'s southern coast.',
  },
  {
    prompt: 'Which continent is Peru in?',
    choices: ['Africa', 'North America', 'South America', 'Europe'],
    correctIndex: 2,
    fact: 'Peru spans the Pacific coast, Andes, and Amazon basin.',
  },
  {
    prompt: 'What is the capital of Turkey?',
    choices: ['Istanbul', 'Ankara', 'Izmir', 'Bursa'],
    correctIndex: 1,
    fact: 'Ankara became the capital after the founding of modern Turkey.',
  },
  {
    prompt: 'Which country has the capital Hanoi?',
    choices: ['Vietnam', 'Laos', 'Cambodia', 'Thailand'],
    correctIndex: 0,
    fact: 'Hanoi has been a political center for more than a thousand years.',
  },
]

function loadBestScore(): number {
  if (typeof window === 'undefined') {
    return 0
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored ? Number.parseInt(stored, 10) || 0 : 0
}

function shuffle<T>(values: T[]): T[] {
  const next = [...values]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function buildDeck(): Question[] {
  return shuffle(QUESTION_BANK)
}

function formatTime(value: number): string {
  const safe = Math.max(0, Math.ceil(value / 1000))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatSignedSeconds(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${Math.abs(value / 1000).toFixed(1)}s`
}

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [deck, setDeck] = useState<Question[]>(buildDeck)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(ROUND_MS)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [stats, setStats] = useState<SessionStats>({
    score: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    answered: 0,
  })
  const [bestScore, setBestScore] = useState(loadBestScore)

  const deadlineRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const submissionLockRef = useRef(false)

  const question = deck[questionIndex] ?? deck[0]
  const timeRatio = Math.max(0, Math.min(100, (remainingMs / ROUND_MS) * 100))
  const accuracy = stats.answered === 0 ? 100 : Math.round((stats.correct / stats.answered) * 100)

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function clearFeedbackTimer() {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = null
    }
  }

  function finishGame() {
    clearTimer()
    clearFeedbackTimer()
    submissionLockRef.current = false
    setPhase('finished')
    setFeedback(null)
    setSelectedIndex(0)
    setBestScore(prev => {
      const next = Math.max(prev, stats.score)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      }
      return next
    })
  }

  function tick() {
    const nextRemaining = Math.max(0, Math.round(deadlineRef.current - performance.now()))
    setRemainingMs(nextRemaining)
    if (nextRemaining <= 0) {
      finishGame()
    }
  }

  function startGame() {
    clearTimer()
    clearFeedbackTimer()
    submissionLockRef.current = false

    const nextDeck = buildDeck()
    deadlineRef.current = performance.now() + ROUND_MS

    setPhase('playing')
    setDeck(nextDeck)
    setQuestionIndex(0)
    setSelectedIndex(0)
    setRemainingMs(ROUND_MS)
    setFeedback(null)
    setStats({
      score: 0,
      correct: 0,
      wrong: 0,
      streak: 0,
      bestStreak: 0,
      answered: 0,
    })

    window.requestAnimationFrame(() => {
      tick()
    })

    timerRef.current = window.setInterval(tick, 80)
  }

  function advanceQuestion(nextDeck = deck) {
    clearFeedbackTimer()
    submissionLockRef.current = false

    setQuestionIndex(current => {
      const next = current + 1
      if (next < nextDeck.length) {
        return next
      }
      const reshuffled = buildDeck()
      setDeck(reshuffled)
      return 0
    })
    setSelectedIndex(0)
  }

  function submitAnswer(choiceIndex: number) {
    if (phase !== 'playing' || submissionLockRef.current) {
      return
    }

    submissionLockRef.current = true
    const currentQuestion = question
    const isCorrect = choiceIndex === currentQuestion.correctIndex
    const timeDelta = isCorrect ? TIMER_BONUS_MS : -TIMER_PENALTY_MS

    deadlineRef.current += timeDelta
    setRemainingMs(Math.max(0, Math.round(deadlineRef.current - performance.now())))

    setStats(prev => {
      const nextStreak = isCorrect ? prev.streak + 1 : 0
      const nextScore = prev.score + (isCorrect ? 100 + nextStreak * 10 : 0)

      return {
        score: nextScore,
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1),
        streak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
        answered: prev.answered + 1,
      }
    })

    setFeedback(
      isCorrect
        ? {
            kind: 'correct',
            title: 'Correct!',
            detail: `${currentQuestion.fact} ${formatSignedSeconds(TIMER_BONUS_MS)} bonus time.`,
          }
        : {
            kind: 'wrong',
            title: 'Not quite',
            detail: `The answer was ${currentQuestion.choices[currentQuestion.correctIndex]}. ${currentQuestion.fact} ${formatSignedSeconds(-TIMER_PENALTY_MS)} penalty.`,
          },
    )

    clearFeedbackTimer()
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null)
      advanceQuestion()
    }, FEEDBACK_MS)
  }

  useEffect(() => {
    return () => {
      clearTimer()
      clearFeedbackTimer()
    }
  }, [])

  useEffect(() => {
    if (phase === 'playing') {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'enter' || key === ' ' || key === 'r') {
        event.preventDefault()
        startGame()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, startGame])

  useEffect(() => {
    if (phase !== 'playing') {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (key === 'enter' || key === ' ') {
        event.preventDefault()
        submitAnswer(selectedIndex)
        return
      }

      if (key === 'arrowleft' || key === 'arrowup') {
        event.preventDefault()
        setSelectedIndex(index => (index + 3) % 4)
        return
      }

      if (key === 'arrowright' || key === 'arrowdown') {
        event.preventDefault()
        setSelectedIndex(index => (index + 1) % 4)
        return
      }

      if (key === '1' || key === 'a') {
        event.preventDefault()
        submitAnswer(0)
        return
      }

      if (key === '2' || key === 'b') {
        event.preventDefault()
        submitAnswer(1)
        return
      }

      if (key === '3' || key === 'c') {
        event.preventDefault()
        submitAnswer(2)
        return
      }

      if (key === '4' || key === 'd') {
        event.preventDefault()
        submitAnswer(3)
        return
      }

      if (key === 'r') {
        event.preventDefault()
        startGame()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, selectedIndex, submitAnswer, startGame])

  const headerText =
    phase === 'playing' ? 'Follow the map, beat the clock.' : phase === 'finished' ? 'Round complete.' : 'Geography Games'

  const subtext =
    phase === 'playing'
      ? 'Use 1-4, A-D, arrow keys, click, or tap. Correct answers add time. Wrong answers burn it.'
      : phase === 'finished'
        ? 'Start a new run to chase a higher score and a longer streak.'
        : 'A fast geography quiz that teaches capitals, countries, and continents while the timer shrinks.'

  return (
    <div style={styles.shell}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />
      <div style={styles.mapGrid} />

      <main style={styles.frame}>
        <header style={styles.header}>
          <div style={styles.headerCopy}>
            <p style={styles.kicker}>Cubeforge mini-game</p>
            <h1 style={styles.title}>Geography Games</h1>
            <p style={styles.subtitle}>{headerText}</p>
            <p style={styles.bodyCopy}>{subtext}</p>
          </div>

          <div style={styles.controlPill}>
            <span style={styles.key}>1-4</span>
            <span>pick answer</span>
            <span style={styles.dot}>•</span>
            <span style={styles.key}>Enter</span>
            <span>confirm</span>
            <span style={styles.dot}>•</span>
            <span style={styles.key}>R</span>
            <span>restart</span>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <Stat label="Time" value={formatTime(remainingMs)} accent={remainingMs <= 15_000 ? '#ffb4a2' : '#7ae7ff'} />
          <Stat label="Score" value={String(stats.score)} accent="#f8d66d" />
          <Stat label="Accuracy" value={`${accuracy}%`} accent="#9ef7c7" />
          <Stat label="Streak" value={String(stats.streak)} accent="#cdb8ff" />
        </section>

        <section style={styles.board}>
          <div style={styles.boardTop}>
            <div>
              <p style={styles.sectionLabel}>Question</p>
              <h2 style={styles.prompt}>{question.prompt}</h2>
            </div>
            <div style={styles.boardBadge}>
              <span style={styles.boardBadgeLabel}>Best score</span>
              <strong style={styles.boardBadgeValue}>{bestScore}</strong>
            </div>
          </div>

          <div style={styles.timerWrap} aria-hidden="true">
            <div style={{ ...styles.timerBar, width: `${timeRatio}%` }} />
          </div>

          <div style={styles.answerGrid}>
            {question.choices.map((choice, index) => {
              const active = index === selectedIndex
              const correct = feedback?.kind === 'correct' && index === question.correctIndex
              const wrong = feedback?.kind === 'wrong' && index === selectedIndex && index !== question.correctIndex

              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => submitAnswer(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    ...styles.answerButton,
                    ...(active ? styles.answerButtonActive : {}),
                    ...(correct ? styles.answerButtonCorrect : {}),
                    ...(wrong ? styles.answerButtonWrong : {}),
                  }}
                >
                  <span style={styles.answerHotkey}>{index + 1}</span>
                  <span style={styles.answerText}>{choice}</span>
                </button>
              )
            })}
          </div>

          <div style={styles.bottomRow}>
            <div style={styles.feedbackPanel}>
              {feedback ? (
                <>
                  <p style={{ ...styles.feedbackTitle, color: feedback.kind === 'correct' ? '#9ef7c7' : '#ffb4a2' }}>
                    {feedback.title}
                  </p>
                  <p style={styles.feedbackDetail}>{feedback.detail}</p>
                </>
              ) : (
                <>
                  <p style={styles.feedbackTitle}>Quick tip</p>
                  <p style={styles.feedbackDetail}>Think about where the place sits on the map, then commit fast to keep your streak alive.</p>
                </>
              )}
            </div>

            <div style={styles.sessionStats}>
              <Metric label="Correct" value={String(stats.correct)} />
              <Metric label="Wrong" value={String(stats.wrong)} />
              <Metric label="Best streak" value={String(stats.bestStreak)} />
              <Metric label="Answered" value={String(stats.answered)} />
            </div>
          </div>

          <div style={styles.footer}>
            {phase === 'idle' || phase === 'finished' ? (
              <button type="button" onClick={startGame} style={styles.primaryButton}>
                {phase === 'finished' ? 'Play again' : 'Start game'}
              </button>
            ) : (
              <button type="button" onClick={startGame} style={styles.secondaryButton}>
                Restart run
              </button>
            )}

            <p style={styles.footerCopy}>
              Learning loop: every answer shows the right choice and a fact, so each run doubles as a quick study session.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={{ ...styles.statValue, color: accent }}>{value}</strong>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
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
  glowOne: {
    display: 'none',
  },
  glowTwo: {
    display: 'none',
  },
  mapGrid: {
    display: 'none',
  },
  frame: {
    width: 'min(1080px, 100%)',
    height: APP_FRAME_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    padding: 20,
    borderRadius: 28,
    background: 'rgba(6, 17, 26, 0.96)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 70px rgba(0,0,0,0.32)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 620,
  },
  kicker: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 12,
    color: '#9fd8ea',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2.5rem, 6vw, 4.8rem)',
    lineHeight: 0.95,
    letterSpacing: '-0.05em',
  },
  subtitle: {
    margin: 0,
    color: '#d6f0f7',
    fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
    fontWeight: 700,
  },
  bodyCopy: {
    margin: 0,
    maxWidth: 580,
    color: 'rgba(238, 247, 251, 0.82)',
    lineHeight: 1.6,
  },
  controlPill: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px',
    borderRadius: 999,
    background: 'rgba(8, 22, 32, 0.72)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: '#cfe9f2',
    boxShadow: '0 18px 50px rgba(0,0,0,0.24)',
  },
  key: {
    padding: '4px 8px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
  },
  dot: {
    opacity: 0.5,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px 18px',
    borderRadius: 20,
    background: 'rgba(8, 22, 32, 0.72)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
  },
  statLabel: {
    color: '#9cc8d7',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
  },
  statValue: {
    fontSize: 24,
    letterSpacing: '-0.03em',
  },
  board: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    gap: 16,
    padding: 22,
    borderRadius: 28,
    background: 'rgba(6, 17, 26, 0.96)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 20px 48px rgba(0,0,0,0.24)',
  },
  boardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  sectionLabel: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    fontSize: 12,
    color: '#8cc7da',
  },
  prompt: {
    margin: '8px 0 0',
    fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
  },
  boardBadge: {
    minWidth: 150,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderRadius: 18,
    background: 'rgba(122,231,255,0.10)',
    border: '1px solid rgba(122,231,255,0.18)',
  },
  boardBadgeLabel: {
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    color: '#9cc8d7',
  },
  boardBadgeValue: {
    fontSize: 28,
    lineHeight: 1,
    color: '#f8fafc',
  },
  timerWrap: {
    width: '100%',
    height: 10,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  timerBar: {
    height: '100%',
    borderRadius: 999,
    background: '#7ae7ff',
    transition: 'width 80ms linear',
  },
  answerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  answerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 86,
    padding: '16px 18px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: '#f5fbfd',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
  },
  answerButtonActive: {
    borderColor: 'rgba(122,231,255,0.72)',
    background: 'rgba(122,231,255,0.14)',
    boxShadow: '0 0 0 1px rgba(122,231,255,0.16) inset',
    transform: 'translateY(-1px)',
  },
  answerButtonCorrect: {
    borderColor: 'rgba(158, 247, 199, 0.72)',
    background: 'rgba(158,247,199,0.16)',
  },
  answerButtonWrong: {
    borderColor: 'rgba(255, 180, 162, 0.72)',
    background: 'rgba(255,180,162,0.16)',
  },
  answerHotkey: {
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#bfe7f5',
    fontWeight: 800,
  },
  answerText: {
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 700,
  },
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
    gap: 12,
  },
  feedbackPanel: {
    padding: 18,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    minHeight: 120,
  },
  feedbackTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  feedbackDetail: {
    margin: '8px 0 0',
    lineHeight: 1.6,
    color: '#d4e9f2',
  },
  sessionStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  metric: {
    padding: 16,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  metricLabel: {
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    color: '#9cc8d7',
  },
  metricValue: {
    fontSize: 20,
    color: '#f8fafc',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    padding: '14px 20px',
    background: '#7ae7ff',
    color: '#07141d',
    fontWeight: 900,
    letterSpacing: 0.4,
    cursor: 'pointer',
    boxShadow: '0 14px 36px rgba(122,231,255,0.22)',
  },
  secondaryButton: {
    border: '1px solid rgba(122,231,255,0.22)',
    borderRadius: 999,
    padding: '14px 20px',
    background: 'rgba(255,255,255,0.05)',
    color: '#f4fbfe',
    fontWeight: 800,
    cursor: 'pointer',
  },
  footerCopy: {
    margin: 0,
    color: 'rgba(212, 233, 242, 0.86)',
    lineHeight: 1.5,
    maxWidth: 520,
  },
}
