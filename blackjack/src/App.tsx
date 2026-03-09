import { useState, useCallback, useMemo, CSSProperties } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

interface Card {
  suit: Suit
  rank: Rank
}

type Phase = 'betting' | 'playing' | 'dealerTurn' | 'result'
type Result = 'win' | 'lose' | 'push' | 'blackjack'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function makeDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function cardValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(rank)) return 10
  return parseInt(rank, 10)
}

function handScore(hand: Card[]): number {
  let total = 0
  let aces = 0
  for (const c of hand) {
    total += cardValue(c.rank)
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds'
}

/* ------------------------------------------------------------------ */
/*  Card component                                                     */
/* ------------------------------------------------------------------ */

function CardView({ card, faceDown }: { card: Card; faceDown?: boolean }) {
  const w = 70
  const h = 100

  const base: CSSProperties = {
    width: w,
    height: h,
    borderRadius: 8,
    border: '1px solid #555',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 6,
    fontFamily: "'Courier New', monospace",
    userSelect: 'none',
    flexShrink: 0,
  }

  if (faceDown) {
    return (
      <div
        style={{
          ...base,
          background: 'repeating-linear-gradient(45deg, #2a3a6a, #2a3a6a 4px, #1e2d54 4px, #1e2d54 8px)',
          border: '2px solid #4a5a8a',
        }}
      />
    )
  }

  const color = isRedSuit(card.suit) ? '#ef5350' : '#e0e0e0'
  const sym = SUIT_SYMBOLS[card.suit]

  return (
    <div style={{ ...base, background: '#1e2535', color }}>
      <div style={{ fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>
        {card.rank}
        <br />
        {sym}
      </div>
      <div style={{ fontSize: 28, textAlign: 'center', lineHeight: 1 }}>{sym}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 'bold',
          lineHeight: 1,
          alignSelf: 'flex-end',
          transform: 'rotate(180deg)',
        }}
      >
        {card.rank}
        <br />
        {sym}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Button                                                             */
/* ------------------------------------------------------------------ */

function Btn({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 18px',
        fontSize: 14,
        fontFamily: "'Courier New', monospace",
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#333' : accent ? '#c9a032' : '#3a5a3a',
        color: disabled ? '#666' : '#fff',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

const MIN_DECK_SIZE = 15

export function App() {
  const [deck, setDeck] = useState<Card[]>(() => shuffle(makeDeck()))
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [phase, setPhase] = useState<Phase>('betting')
  const [result, setResult] = useState<Result | null>(null)
  const [chips, setChips] = useState(100)
  const [bet, setBet] = useState(0)

  /* draw from deck, reshuffle if needed */
  const draw = useCallback(
    (d: Card[], n: number): [Card[], Card[]] => {
      let currentDeck = d
      if (currentDeck.length < n) {
        currentDeck = shuffle(makeDeck())
      }
      const drawn = currentDeck.slice(0, n)
      const remaining = currentDeck.slice(n)
      return [drawn, remaining]
    },
    [],
  )

  /* place a bet and deal */
  const deal = useCallback(
    (amount: number) => {
      if (chips < amount) return
      setBet(amount)
      setChips((c) => c - amount)
      setResult(null)

      let d = deck.length < MIN_DECK_SIZE ? shuffle(makeDeck()) : deck

      const [pCards, d1] = draw(d, 2) as [Card[], Card[]]
      const [dCards, d2] = draw(d1, 2) as [Card[], Card[]]

      setPlayerHand(pCards)
      setDealerHand(dCards)
      setDeck(d2)

      /* natural blackjack check */
      const pScore = handScore(pCards)
      const dScore = handScore(dCards)
      if (pScore === 21 && dScore === 21) {
        setPhase('result')
        setResult('push')
        setChips((c) => c + amount)
      } else if (pScore === 21) {
        setPhase('result')
        setResult('blackjack')
        setChips((c) => c + amount + Math.floor(amount * 1.5))
      } else {
        setPhase('playing')
      }
    },
    [chips, deck, draw],
  )

  /* player hits */
  const hit = useCallback(() => {
    const [drawn, remaining] = draw(deck, 1)
    setDeck(remaining)
    const newHand = [...playerHand, ...drawn]
    setPlayerHand(newHand)

    if (handScore(newHand) > 21) {
      setPhase('result')
      setResult('lose')
    }
  }, [deck, playerHand, draw])

  /* resolve dealer turn */
  const resolveDealerTurn = useCallback(
    (dHand: Card[], d: Card[]) => {
      let currentDeck = d
      let hand = [...dHand]

      while (handScore(hand) < 17) {
        const [drawn, remaining] = draw(currentDeck, 1)
        hand = [...hand, ...drawn]
        currentDeck = remaining
      }

      setDealerHand(hand)
      setDeck(currentDeck)

      const dScore = handScore(hand)
      const pScore = handScore(playerHand)

      if (dScore > 21 || pScore > dScore) {
        setResult('win')
        setChips((c) => c + bet * 2)
      } else if (pScore < dScore) {
        setResult('lose')
      } else {
        setResult('push')
        setChips((c) => c + bet)
      }
      setPhase('result')
    },
    [playerHand, bet, draw],
  )

  /* player stands */
  const stand = useCallback(() => {
    setPhase('dealerTurn')
    /* small timeout so the UI can flash "dealer turn" before resolving */
    setTimeout(() => {
      resolveDealerTurn(dealerHand, deck)
    }, 400)
  }, [dealerHand, deck, resolveDealerTurn])

  const playerScore = useMemo(() => handScore(playerHand), [playerHand])
  const dealerScore = useMemo(() => handScore(dealerHand), [dealerHand])
  const showDealer = phase === 'result' || phase === 'dealerTurn'

  const resultText: Record<Result, string> = {
    win: 'You Win!',
    lose: 'You Lose',
    push: 'Push',
    blackjack: 'Blackjack!',
  }

  const outOfChips = chips <= 0 && phase === 'betting'

  return (
    <div
      style={{
        width: 600,
        height: 450,
        background: '#1a3a1a',
        borderRadius: 16,
        border: '3px solid #2a5a2a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Chip count */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 16,
          fontSize: 14,
          color: '#c9a032',
          fontWeight: 'bold',
        }}
      >
        Chips: {chips}
      </div>

      {/* Bet display */}
      {bet > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 16,
            fontSize: 14,
            color: '#aaa',
          }}
        >
          Bet: {bet}
        </div>
      )}

      {/* Dealer area */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#8a8', marginBottom: 6 }}>
          Dealer {showDealer ? `(${dealerScore})` : dealerHand.length > 0 ? '(??)' : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', minHeight: 100 }}>
          {dealerHand.map((c, i) => (
            <CardView key={`d${i}`} card={c} faceDown={i === 0 && !showDealer} />
          ))}
        </div>
      </div>

      {/* Result / middle area */}
      <div style={{ textAlign: 'center', minHeight: 36 }}>
        {result && (
          <div
            style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: result === 'lose' ? '#ef5350' : result === 'push' ? '#aaa' : '#c9a032',
            }}
          >
            {resultText[result]}
          </div>
        )}
        {phase === 'dealerTurn' && !result && (
          <div style={{ fontSize: 16, color: '#8a8' }}>Dealer draws...</div>
        )}
      </div>

      {/* Player area */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', minHeight: 100 }}>
          {playerHand.map((c, i) => (
            <CardView key={`p${i}`} card={c} />
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#8a8', marginTop: 6 }}>
          Player {playerHand.length > 0 ? `(${playerScore})` : ''}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {phase === 'betting' && !outOfChips && (
          <>
            <Btn label="Bet 10" onClick={() => deal(10)} disabled={chips < 10} accent />
            <Btn label="Bet 25" onClick={() => deal(25)} disabled={chips < 25} accent />
            <Btn label="Bet 50" onClick={() => deal(50)} disabled={chips < 50} accent />
          </>
        )}

        {outOfChips && (
          <Btn
            label="Reset (100 chips)"
            onClick={() => {
              setChips(100)
              setDeck(shuffle(makeDeck()))
            }}
            accent
          />
        )}

        {phase === 'playing' && (
          <>
            <Btn label="Hit" onClick={hit} />
            <Btn label="Stand" onClick={stand} />
          </>
        )}

        {phase === 'result' && (
          <Btn
            label="New Hand"
            onClick={() => {
              setPlayerHand([])
              setDealerHand([])
              setResult(null)
              setPhase('betting')
            }}
            accent
          />
        )}
      </div>
    </div>
  )
}
