import { useState, useEffect, useRef } from 'react'
import { Game, World } from '@cubeforge/react'
import {
  Player1, Player2, Ball, GameManager,
  TopWall, BottomWall, LeftGoal, RightGoal, CenterLine,
  setRooms, W, H,
} from './components/MultiplayerGame'
import { createLocalTransportPair, Room } from './net/localTransport'
import { gameEvents } from './gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const WIN_SCORE = 5

type GameState = 'playing' | 'win'

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,    setGameKey]    = useState(0)
  const [leftScore,  setLeftScore]  = useState(0)
  const [rightScore, setRightScore] = useState(0)
  const [gameState,  setGameState]  = useState<GameState>('playing')
  const [winner,     setWinner]     = useState<'left' | 'right' | null>(null)
  const [connected,  setConnected]  = useState(false)

  const roomsRef = useRef<{ room1: Room; room2: Room } | null>(null)

  // Set up local transport pair + rooms.
  useEffect(() => {
    const [t1, t2] = createLocalTransportPair()
    const r1 = new Room({ transport: t1, peerId: 'player-1' })
    const r2 = new Room({ transport: t2, peerId: 'player-2' })
    roomsRef.current = { room1: r1, room2: r2 }
    setRooms(r1, r2)

    // Wait one microtask for the transports to "connect".
    queueMicrotask(() => setConnected(true))

    return () => {
      r1.disconnect()
      r2.disconnect()
    }
  }, [gameKey])

  // Scoring.
  useEffect(() => {
    gameEvents.onScore = (side) => {
      if (side === 'left') {
        setLeftScore(prev => {
          const next = prev + 1
          if (next >= WIN_SCORE) { setWinner('left'); setGameState('win') }
          return next
        })
      } else {
        setRightScore(prev => {
          const next = prev + 1
          if (next >= WIN_SCORE) { setWinner('right'); setGameState('win') }
          return next
        })
      }
    }
    return () => { gameEvents.onScore = null }
  }, [gameKey])

  function restart() {
    setLeftScore(0)
    setRightScore(0)
    setGameState('playing')
    setWinner(null)
    setConnected(false)
    setGameKey(k => k + 1)
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#4fc3f7', letterSpacing: 2 }}>
            {leftScore}
          </span>
          <span style={{ fontSize: 10, color: '#4fc3f7', opacity: 0.6, letterSpacing: 2 }}>P1</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#546e7a', letterSpacing: 4 }}>MULTIPLAYER</div>
          <div style={{ fontSize: 9, color: connected ? '#4caf50' : '#f44336', letterSpacing: 2, marginTop: 2 }}>
            {connected ? 'CONNECTED' : 'CONNECTING...'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <span style={{ fontSize: 10, color: '#ef5350', opacity: 0.6, letterSpacing: 2 }}>P2</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#ef5350', letterSpacing: 2 }}>
            {rightScore}
          </span>
        </div>
      </div>

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        {connected && (
          <Game key={gameKey} width={W} height={H} gravity={0}>
            <World background="#0a0a12">
              <GameManager />
              <Player1 />
              <Player2 />
              <Ball />
              <TopWall />
              <BottomWall />
              <LeftGoal />
              <RightGoal />
              <CenterLine />
            </World>
          </Game>
        )}

        {/* ── Win overlay ─────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd54f', marginBottom: 8 }}>
                MATCH OVER
              </p>
              <p style={{
                fontSize: 36,
                fontWeight: 900,
                color: winner === 'left' ? '#4fc3f7' : '#ef5350',
                letterSpacing: 3,
              }}>
                {winner === 'left' ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS'}
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                {leftScore} &mdash; {rightScore}
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ───────────────────────────────────────────────────── */}
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
        <span>
          P1: WASD &nbsp;&middot;&nbsp; P2: Arrows &nbsp;&middot;&nbsp;
          Push the ball into the opponent's goal &nbsp;&middot;&nbsp; First to {WIN_SCORE}
        </span>
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
