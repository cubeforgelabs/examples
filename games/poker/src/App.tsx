import { useState, useCallback, useEffect, useRef } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 700
const H = 520
const BG = '#0d1117'
const HUD_BG = '#0d0f1a'
const TABLE_GREEN = '#1a472a'
const CARD_W = 60
const CARD_H = 84
const SMALL_CARD_W = 46
const SMALL_CARD_H = 64
const STARTING_CHIPS = 1000
const SMALL_BLIND = 10
const BIG_BLIND = 20

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'
type Card = { rank: Rank; suit: Suit }
type Phase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'waiting'
type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin'

interface Player {
  id: number
  name: string
  chips: number
  hand: Card[]
  bet: number
  folded: boolean
  allIn: boolean
  isHuman: boolean
}

interface GameState {
  deck: Card[]
  players: Player[]
  communityCards: Card[]
  phase: Phase
  pot: number
  currentBet: number
  dealerIndex: number
  activePlayerIndex: number
  roundOver: boolean
  winners: number[]
  winnerDesc: string
  gameKey: number
  message: string
  raiseAmount: number
  actedThisRound: Set<number>
}

// ─── Card helpers ─────────────────────────────────────────────────────────────
const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_COLORS: Record<Suit, string> = { S: '#1a1a2e', H: '#c62828', D: '#c62828', C: '#1a1a2e' }

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit })
  return shuffle(deck)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealCards(deck: Card[], n: number): { dealt: Card[]; remaining: Card[] } {
  return { dealt: deck.slice(0, n), remaining: deck.slice(n) }
}

// ─── Hand evaluation ──────────────────────────────────────────────────────────
function rankValue(r: Rank): number {
  return RANKS.indexOf(r)
}

interface HandResult {
  rank: number  // 0-8 (high card to straight flush)
  name: string
  tiebreakers: number[]
}

function evaluateHand(cards: Card[]): HandResult {
  // Get best 5-card hand from 5-7 cards
  if (cards.length < 5) return { rank: 0, name: 'High Card', tiebreakers: [] }
  const best = getBestFive(cards)
  return best
}

function getBestFive(cards: Card[]): HandResult {
  let best: HandResult | null = null
  const combos = combinations(cards, 5)
  for (const combo of combos) {
    const result = evaluateFive(combo)
    if (!best || result.rank > best.rank || (result.rank === best.rank && compareTiebreakers(result.tiebreakers, best.tiebreakers) > 0)) {
      best = result
    }
  }
  return best!
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length === 0) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function compareTiebreakers(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

function evaluateFive(cards: Card[]): HandResult {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])
  const isStraight = checkStraight(values)
  const counts = countValues(values)
  const sortedCounts = Object.entries(counts).map(([v, c]) => ({ v: parseInt(v), c })).sort((a, b) => b.c - a.c || b.v - a.v)

  if (isFlush && isStraight.is) return { rank: 8, name: 'Straight Flush', tiebreakers: [isStraight.high] }
  if (sortedCounts[0].c === 4) return { rank: 7, name: 'Four of a Kind', tiebreakers: [sortedCounts[0].v, sortedCounts[1].v] }
  if (sortedCounts[0].c === 3 && sortedCounts[1].c === 2) return { rank: 6, name: 'Full House', tiebreakers: [sortedCounts[0].v, sortedCounts[1].v] }
  if (isFlush) return { rank: 5, name: 'Flush', tiebreakers: values }
  if (isStraight.is) return { rank: 4, name: 'Straight', tiebreakers: [isStraight.high] }
  if (sortedCounts[0].c === 3) return { rank: 3, name: 'Three of a Kind', tiebreakers: [sortedCounts[0].v, ...sortedCounts.slice(1).map(x => x.v)] }
  if (sortedCounts[0].c === 2 && sortedCounts[1].c === 2) return { rank: 2, name: 'Two Pair', tiebreakers: [Math.max(sortedCounts[0].v, sortedCounts[1].v), Math.min(sortedCounts[0].v, sortedCounts[1].v), sortedCounts[2].v] }
  if (sortedCounts[0].c === 2) return { rank: 1, name: 'Pair', tiebreakers: [sortedCounts[0].v, ...sortedCounts.slice(1).map(x => x.v)] }
  return { rank: 0, name: 'High Card', tiebreakers: values }
}

function countValues(values: number[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1
  return counts
}

function checkStraight(sortedDesc: number[]): { is: boolean; high: number } {
  // Check wheel (A-2-3-4-5)
  const vals = [...sortedDesc]
  if (vals[0] === 12 && vals[1] === 3 && vals[2] === 2 && vals[3] === 1 && vals[4] === 0)
    return { is: true, high: 3 }
  for (let i = 0; i < 4; i++)
    if (vals[i] - vals[i+1] !== 1) return { is: false, high: 0 }
  return { is: true, high: vals[0] }
}

// ─── AI decision ──────────────────────────────────────────────────────────────
function handStrength(hand: Card[], community: Card[]): number {
  const all = [...hand, ...community]
  if (all.length < 2) return 0.3
  const result = evaluateHand(all)
  // Normalize rank 0-8 to 0-1
  const base = result.rank / 8
  // Add tiebreaker bonus
  const tb = result.tiebreakers.length > 0 ? result.tiebreakers[0] / 14 * 0.1 : 0
  return Math.min(base + tb + 0.1, 1)
}

function aiDecide(
  player: Player, community: Card[], currentBet: number, pot: number, phase: Phase
): { action: PlayerAction; amount: number } {
  const strength = handStrength(player.hand, community)
  const toCall = currentBet - player.bet
  const bluffRoll = Math.random()

  // Aggressive bluff ~20% of time
  if (bluffRoll < 0.15 && strength < 0.4) {
    const raiseAmt = Math.min(player.chips, BIG_BLIND * 3)
    return { action: 'raise', amount: raiseAmt }
  }

  if (strength > 0.75) {
    // Strong hand: raise
    const raiseAmt = Math.min(player.chips, Math.max(BIG_BLIND * 2, Math.floor(pot * 0.6)))
    if (raiseAmt > 0 && player.chips > toCall + BIG_BLIND)
      return { action: 'raise', amount: raiseAmt }
    return { action: 'call', amount: toCall }
  } else if (strength > 0.45) {
    if (toCall === 0) return { action: 'check', amount: 0 }
    if (toCall <= player.chips * 0.25) return { action: 'call', amount: toCall }
    return { action: 'fold', amount: 0 }
  } else {
    if (toCall === 0) return { action: 'check', amount: 0 }
    if (toCall <= BIG_BLIND && Math.random() > 0.5) return { action: 'call', amount: toCall }
    return { action: 'fold', amount: 0 }
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────
function createInitialState(): GameState {
  const players: Player[] = [
    { id: 0, name: 'You', chips: STARTING_CHIPS, hand: [], bet: 0, folded: false, allIn: false, isHuman: true },
    { id: 1, name: 'Alice', chips: STARTING_CHIPS, hand: [], bet: 0, folded: false, allIn: false, isHuman: false },
    { id: 2, name: 'Bob', chips: STARTING_CHIPS, hand: [], bet: 0, folded: false, allIn: false, isHuman: false },
    { id: 3, name: 'Carol', chips: STARTING_CHIPS, hand: [], bet: 0, folded: false, allIn: false, isHuman: false },
  ]
  return {
    deck: [],
    players,
    communityCards: [],
    phase: 'waiting',
    pot: 0,
    currentBet: 0,
    dealerIndex: 0,
    activePlayerIndex: 0,
    roundOver: false,
    winners: [],
    winnerDesc: '',
    gameKey: 0,
    message: 'Press "Deal" to start a new hand',
    raiseAmount: BIG_BLIND * 2,
    actedThisRound: new Set(),
  }
}

function dealHand(state: GameState): GameState {
  let deck = createDeck()
  const players = state.players.map(p => ({ ...p, hand: [], bet: 0, folded: false, allIn: false }))
  const dealerIdx = (state.dealerIndex + 1) % 4
  const sbIdx = (dealerIdx + 1) % 4
  const bbIdx = (dealerIdx + 2) % 4
  const startIdx = (dealerIdx + 3) % 4

  // Deal 2 cards each
  for (let i = 0; i < 4; i++) {
    const pIdx = (dealerIdx + 1 + i) % 4
    const { dealt, remaining } = dealCards(deck, 2)
    players[pIdx].hand = dealt
    deck = remaining
  }

  // Post blinds
  const sb = Math.min(SMALL_BLIND, players[sbIdx].chips)
  const bb = Math.min(BIG_BLIND, players[bbIdx].chips)
  players[sbIdx].chips -= sb
  players[sbIdx].bet = sb
  players[bbIdx].chips -= bb
  players[bbIdx].bet = bb

  return {
    ...state,
    deck,
    players,
    communityCards: [],
    phase: 'preflop',
    pot: sb + bb,
    currentBet: bb,
    dealerIndex: dealerIdx,
    activePlayerIndex: startIdx,
    roundOver: false,
    winners: [],
    winnerDesc: '',
    message: '',
    raiseAmount: BIG_BLIND * 2,
    actedThisRound: new Set([sbIdx, bbIdx]),
  }
}

function advancePhase(state: GameState): GameState {
  let deck = [...state.deck]
  let communityCards = [...state.communityCards]
  let phase: Phase = state.phase

  const nextPhaseMap: Record<Phase, Phase> = {
    preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown', showdown: 'waiting', waiting: 'preflop'
  }
  phase = nextPhaseMap[state.phase]

  if (phase === 'flop') {
    const { dealt, remaining } = dealCards(deck, 3)
    communityCards = dealt; deck = remaining
  } else if (phase === 'turn' || phase === 'river') {
    const { dealt, remaining } = dealCards(deck, 1)
    communityCards = [...communityCards, ...dealt]; deck = remaining
  }

  // Reset bets for new phase
  const players = state.players.map(p => ({ ...p, bet: 0 }))
  const firstActive = findNextActive(players, state.dealerIndex, -1)

  if (phase === 'showdown') {
    return resolveShowdown({ ...state, deck, players, communityCards, phase, currentBet: 0, actedThisRound: new Set() })
  }

  return {
    ...state,
    deck,
    players,
    communityCards,
    phase,
    currentBet: 0,
    activePlayerIndex: firstActive,
    actedThisRound: new Set(),
  }
}

function findNextActive(players: Player[], from: number, excludeId: number): number {
  for (let i = 1; i <= 4; i++) {
    const idx = (from + i) % 4
    if (!players[idx].folded && !players[idx].allIn && players[idx].id !== excludeId)
      return idx
  }
  return (from + 1) % 4
}

function countActivePlayers(players: Player[]): number {
  return players.filter(p => !p.folded).length
}

function resolveShowdown(state: GameState): GameState {
  const activePlayers = state.players.filter(p => !p.folded)
  if (activePlayers.length === 0) return state

  const results = activePlayers.map(p => ({
    id: p.id,
    result: evaluateHand([...p.hand, ...state.communityCards])
  }))

  results.sort((a, b) => {
    if (a.result.rank !== b.result.rank) return b.result.rank - a.result.rank
    return compareTiebreakers(b.result.tiebreakers, a.result.tiebreakers)
  })

  const topRank = results[0].result.rank
  const topTB = results[0].result.tiebreakers
  const winners = results.filter(r =>
    r.result.rank === topRank && compareTiebreakers(r.result.tiebreakers, topTB) === 0
  ).map(r => r.id)

  const share = Math.floor(state.pot / winners.length)
  const players = state.players.map(p => ({
    ...p,
    chips: p.chips + (winners.includes(p.id) ? share : 0)
  }))

  const winnerNames = winners.map(id => state.players.find(p => p.id === id)?.name ?? '?')
  const handName = results[0].result.name
  const winnerDesc = `${winnerNames.join(' & ')} wins with ${handName}!`

  return {
    ...state,
    players,
    phase: 'showdown',
    roundOver: true,
    winners,
    winnerDesc,
    message: winnerDesc,
  }
}

function applyAction(state: GameState, playerId: number, action: PlayerAction, raiseBy: number): GameState {
  const players = state.players.map(p => ({ ...p }))
  const player = players[playerId]
  let { pot, currentBet } = state
  const actedThisRound = new Set(state.actedThisRound)
  actedThisRound.add(playerId)

  switch (action) {
    case 'fold':
      player.folded = true
      break
    case 'check':
      break
    case 'call': {
      const toCall = Math.min(currentBet - player.bet, player.chips)
      player.chips -= toCall
      player.bet += toCall
      pot += toCall
      if (player.chips === 0) player.allIn = true
      break
    }
    case 'raise': {
      const totalBet = currentBet + raiseBy
      const toAdd = Math.min(totalBet - player.bet, player.chips)
      player.chips -= toAdd
      player.bet += toAdd
      pot += toAdd
      currentBet = player.bet
      if (player.chips === 0) player.allIn = true
      // Reset actedThisRound for everyone except raiser
      actedThisRound.clear()
      actedThisRound.add(playerId)
      break
    }
    case 'allin': {
      const toAdd = player.chips
      player.chips = 0
      player.bet += toAdd
      pot += toAdd
      player.allIn = true
      if (player.bet > currentBet) {
        currentBet = player.bet
        actedThisRound.clear()
        actedThisRound.add(playerId)
      }
      break
    }
  }

  // Check if only one player left
  const stillIn = players.filter(p => !p.folded)
  if (stillIn.length === 1) {
    const winner = stillIn[0]
    winner.chips += pot
    return {
      ...state,
      players,
      pot,
      currentBet,
      roundOver: true,
      winners: [winner.id],
      winnerDesc: `${winner.name} wins (all others folded)!`,
      message: `${winner.name} wins (all others folded)!`,
      phase: 'showdown',
      actedThisRound,
    }
  }

  // Find next active player
  const nextIdx = findNextActive(players, playerId, -1)

  const newState = { ...state, players, pot, currentBet, activePlayerIndex: nextIdx, actedThisRound }

  // Check if betting round is over
  const activePlayers = players.filter(p => !p.folded && !p.allIn)
  const allActed = activePlayers.every(p => actedThisRound.has(p.id))
  const allEven = activePlayers.every(p => p.bet === currentBet || p.allIn)

  if (allActed && allEven) {
    return advancePhase(newState)
  }

  return newState
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gs, setGs] = useState<GameState>(createInitialState)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // AI turns
  useEffect(() => {
    if (gs.phase === 'waiting' || gs.phase === 'showdown' || gs.roundOver) return
    const active = gs.players[gs.activePlayerIndex]
    if (!active || active.isHuman || active.folded || active.allIn) return

    aiTimerRef.current = setTimeout(() => {
      setGs(prev => {
        if (prev.roundOver || prev.phase === 'showdown' || prev.phase === 'waiting') return prev
        const ap = prev.players[prev.activePlayerIndex]
        if (!ap || ap.isHuman || ap.folded || ap.allIn) return prev
        const { action, amount } = aiDecide(ap, prev.communityCards, prev.currentBet, prev.pot, prev.phase)
        return applyAction(prev, ap.id, action, amount)
      })
    }, 600)

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current) }
  }, [gs.activePlayerIndex, gs.phase, gs.roundOver])

  const handleAction = useCallback((action: PlayerAction) => {
    setGs(prev => {
      if (prev.roundOver || prev.phase === 'waiting') return prev
      const human = prev.players[0]
      if (prev.activePlayerIndex !== 0) return prev
      return applyAction(prev, 0, action, prev.raiseAmount)
    })
  }, [])

  function startNewHand() {
    setGs(prev => dealHand({ ...prev, gameKey: prev.gameKey + 1 }))
  }

  const { players, communityCards, phase, pot, currentBet, winners, roundOver, message, raiseAmount } = gs
  const human = players[0]
  const humanToCall = Math.max(0, currentBet - human.bet)
  const isHumanTurn = gs.activePlayerIndex === 0 && !roundOver && phase !== 'waiting'
  const canCheck = humanToCall === 0
  const canCall = humanToCall > 0 && humanToCall < human.chips

  // Board entities: table + card backs + community card slots
  const tableEntities = []
  // Table felt
  tableEntities.push(
    <Entity key="table">
      <Transform x={W / 2} y={H / 2 - 20} />
      <Sprite width={600} height={340} color={TABLE_GREEN} zIndex={0} />
    </Entity>
  )
  // Table border
  tableEntities.push(
    <Entity key="table-border">
      <Transform x={W / 2} y={H / 2 - 20} />
      <Sprite width={610} height={350} color="#0a2a15" zIndex={-1} />
    </Entity>
  )

  // Community card slots
  const commSlotX = W / 2 - 2 * (CARD_W + 6)
  for (let i = 0; i < 5; i++) {
    const x = commSlotX + i * (CARD_W + 6)
    tableEntities.push(
      <Entity key={`cslot-${i}`}>
        <Transform x={x} y={H / 2 - 20} />
        <Sprite width={CARD_W} height={CARD_H} color="#0d2a18" zIndex={1} />
      </Entity>
    )
  }

  // Player seat backgrounds
  const seatPositions = [
    { x: W / 2, y: H - 60 },        // You (bottom)
    { x: 110, y: H / 2 - 60 },      // Alice (left)
    { x: W / 2, y: 70 },            // Bob (top)
    { x: W - 110, y: H / 2 - 60 },  // Carol (right)
  ]
  seatPositions.forEach((pos, i) => {
    const isDealer = i === gs.dealerIndex
    const isActive = i === gs.activePlayerIndex && !roundOver
    tableEntities.push(
      <Entity key={`seat-${i}`}>
        <Transform x={pos.x} y={pos.y} />
        <Sprite width={130} height={50} color={isActive ? '#1a3a5a' : '#0d1f1a'} zIndex={1} />
      </Entity>
    )
  })

  // Pot display bg
  tableEntities.push(
    <Entity key="pot-bg">
      <Transform x={W / 2} y={H / 2 - 75} />
      <Sprite width={120} height={28} color="#0a1a10" zIndex={2} />
    </Entity>
  )

  function renderCard(card: Card, faceUp: boolean, x: number, y: number, w: number, h: number, key: string, small?: boolean) {
    const fontSize = small ? 14 : 18
    const rankFontSize = small ? 16 : 22
    return (
      <div key={key} style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        background: faceUp ? '#fafafa' : '#1a3a8a',
        borderRadius: 5,
        border: '1px solid rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {faceUp ? (
          <>
            <div style={{ fontSize: rankFontSize, fontWeight: 900, color: SUIT_COLORS[card.suit], lineHeight: 1 }}>{card.rank}</div>
            <div style={{ fontSize, color: SUIT_COLORS[card.suit], lineHeight: 1 }}>{SUIT_SYMBOLS[card.suit]}</div>
          </>
        ) : (
          <div style={{ fontSize: small ? 18 : 24, color: '#4a6fa5' }}>🂠</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Courier New", monospace', background: BG, minHeight: '100vh', padding: 16 }}>
      {/* HUD */}
      <div style={{ width: W, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', background: HUD_BG, borderRadius: '10px 10px 0 0', color: '#90a4ae', fontSize: 11, letterSpacing: 2 }}>
        <span style={{ color: '#4fc3f7', fontWeight: 700 }}>TEXAS HOLD'EM</span>
        <span style={{ color: '#ffd54f' }}>BLINDS: {SMALL_BLIND}/{BIG_BLIND}</span>
        <span>PHASE: {phase.toUpperCase()}</span>
      </div>

      {/* Board */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gs.gameKey} width={W} height={H} gravity={0}>
          <World background={BG}>
            <Camera2D x={W / 2} y={H / 2} background={BG} />
            {tableEntities}
          </World>
        </Game>

        {/* Overlay: players, cards, pot */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
          {/* Pot */}
          <div style={{ position: 'absolute', left: W / 2 - 60, top: H / 2 - 89, width: 120, textAlign: 'center', color: '#ffd54f', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
            POT: ${pot}
          </div>

          {/* Community cards */}
          {communityCards.map((card, i) => {
            const x = W / 2 - 2 * (CARD_W + 6) + i * (CARD_W + 6)
            return renderCard(card, true, x, H / 2 - 20, CARD_W, CARD_H, `comm-${i}`)
          })}

          {/* Players */}
          {players.map((player, idx) => {
            const pos = seatPositions[idx]
            const isDealer = idx === gs.dealerIndex
            const isActive = idx === gs.activePlayerIndex && !roundOver && phase !== 'waiting'
            const isFolded = player.folded
            const isWinner = winners.includes(player.id)

            return (
              <div key={`player-${idx}`}>
                {/* Seat info */}
                <div style={{
                  position: 'absolute',
                  left: pos.x - 65,
                  top: pos.y - 25,
                  width: 130,
                  height: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isFolded ? 0.4 : 1,
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 10, color: isActive ? '#4fc3f7' : isWinner ? '#ffd54f' : '#90a4ae', letterSpacing: 1, fontWeight: isActive ? 700 : 400 }}>
                    {player.name} {isDealer ? '(D)' : ''} {isFolded ? '[FOLD]' : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>${player.chips}</div>
                  {player.bet > 0 && (
                    <div style={{ fontSize: 10, color: '#ffd54f' }}>Bet: ${player.bet}</div>
                  )}
                </div>

                {/* Player cards */}
                {player.hand.length === 2 && (() => {
                  const faceUp = player.isHuman || phase === 'showdown'
                  const cardSpacing = 28
                  const positions = [
                    { x: pos.x - cardSpacing, y: pos.y + (idx === 0 ? 44 : -44) },
                    { x: pos.x + cardSpacing, y: pos.y + (idx === 0 ? 44 : -44) },
                  ]
                  if (idx === 1) { // left seat - horizontal layout
                    positions[0] = { x: pos.x + 50, y: pos.y - 10 }
                    positions[1] = { x: pos.x + 50, y: pos.y + 22 }
                  }
                  if (idx === 3) { // right seat - horizontal layout
                    positions[0] = { x: pos.x - 50, y: pos.y - 10 }
                    positions[1] = { x: pos.x - 50, y: pos.y + 22 }
                  }
                  return (
                    <>
                      {renderCard(player.hand[0], faceUp, positions[0].x, positions[0].y, SMALL_CARD_W, SMALL_CARD_H, `hand-${idx}-0`, true)}
                      {renderCard(player.hand[1], faceUp, positions[1].x, positions[1].y, SMALL_CARD_W, SMALL_CARD_H, `hand-${idx}-1`, true)}
                    </>
                  )
                })()}
              </div>
            )
          })}

          {/* Message */}
          {message && (
            <div style={{ position: 'absolute', left: W / 2 - 200, top: H / 2 - 15, width: 400, textAlign: 'center', color: '#ffd54f', fontSize: 13, fontWeight: 700, background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: 6, letterSpacing: 1 }}>
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ width: W, background: HUD_BG, borderRadius: '0 0 10px 10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        {phase === 'waiting' || roundOver ? (
          <button onClick={startNewHand} style={btnStyle('#4fc3f7')}>
            {phase === 'waiting' ? 'Deal' : 'Next Hand'}
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleAction('fold')}
                disabled={!isHumanTurn}
                style={btnStyle('#ef5350', !isHumanTurn)}
              >Fold</button>
              {canCheck ? (
                <button onClick={() => handleAction('check')} disabled={!isHumanTurn} style={btnStyle('#4fc3f7', !isHumanTurn)}>Check</button>
              ) : (
                <button onClick={() => handleAction('call')} disabled={!isHumanTurn || !canCall} style={btnStyle('#66bb6a', !isHumanTurn || !canCall)}>
                  Call ${humanToCall}
                </button>
              )}
              <button
                onClick={() => handleAction('raise')}
                disabled={!isHumanTurn || human.chips <= humanToCall}
                style={btnStyle('#ffd54f', !isHumanTurn || human.chips <= humanToCall)}
              >Raise ${raiseAmount}</button>
              <button
                onClick={() => handleAction('allin')}
                disabled={!isHumanTurn}
                style={btnStyle('#ff7043', !isHumanTurn)}
              >All In ${human.chips}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#546e7a', fontSize: 11 }}>Raise by:</span>
              <input
                type="range"
                min={BIG_BLIND}
                max={Math.max(BIG_BLIND, human.chips - humanToCall)}
                step={BIG_BLIND}
                value={raiseAmount}
                onChange={e => setGs(prev => ({ ...prev, raiseAmount: parseInt(e.target.value) }))}
                disabled={!isHumanTurn}
                style={{ width: 80 }}
              />
              <span style={{ color: '#ffd54f', fontSize: 12, fontWeight: 700, minWidth: 40 }}>${raiseAmount}</span>
            </div>
          </>
        )}
        <span style={{ color: '#263238', fontSize: 10, letterSpacing: 1.5 }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

function btnStyle(color: string, disabled = false): React.CSSProperties {
  return {
    padding: '8px 16px',
    background: disabled ? '#1a2535' : color,
    color: disabled ? '#37474f' : '#0a0a0f',
    border: 'none',
    borderRadius: 6,
    fontFamily: '"Courier New", monospace',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
