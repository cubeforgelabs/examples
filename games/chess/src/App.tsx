import { useState, useCallback, useEffect, useRef } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const BOARD_SIZE = 8
const CELL = 60
const BOARD_W = BOARD_SIZE * CELL  // 480
const BOARD_H = BOARD_SIZE * CELL  // 480
const SIDEBAR_W = 200
const HUD_H = 40
const W = BOARD_W
const H = BOARD_H

const LIGHT_SQ = '#b58863'
const DARK_SQ  = '#769656'
const HL_SEL   = 'rgba(20,85,30,0.7)'
const HL_MOVE  = 'rgba(20,85,30,0.5)'
const HL_CHECK = 'rgba(220,30,30,0.6)'
const BG       = '#0d1117'
const HUD_BG   = '#0d0f1a'

// ─── Types ────────────────────────────────────────────────────────────────────
type Color = 'w' | 'b'
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
type Piece = { type: PieceType; color: Color }
type Square = Piece | null
type Board = Square[][]
type Pos = { r: number; c: number }

interface GameState {
  board: Board
  turn: Color
  selected: Pos | null
  validMoves: Pos[]
  enPassantTarget: Pos | null
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  status: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw'
  capturedWhite: Piece[]
  capturedBlack: Piece[]
  moveHistory: string[]
  promotionPending: Pos | null
  gameKey: number
}

// ─── Unicode symbols ──────────────────────────────────────────────────────────
const SYMBOLS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

function pieceSymbol(p: Piece): string {
  return SYMBOLS[p.color + p.type] ?? '?'
}

// ─── Board helpers ────────────────────────────────────────────────────────────
function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null))
}

function cloneBoard(b: Board): Board {
  return b.map(row => [...row])
}

function initialBoard(): Board {
  const b = emptyBoard()
  const backRank: PieceType[] = ['R','N','B','Q','K','B','N','R']
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: backRank[c], color: 'b' }
    b[1][c] = { type: 'P', color: 'b' }
    b[6][c] = { type: 'P', color: 'w' }
    b[7][c] = { type: backRank[c], color: 'w' }
  }
  return b
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8
}

function findKing(board: Board, color: Color): Pos | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color)
        return { r, c }
  return null
}

// Raw moves (ignoring check)
function rawMoves(board: Board, r: number, c: number, enPassant: Pos | null): Pos[] {
  const piece = board[r][c]
  if (!piece) return []
  const moves: Pos[] = []
  const { type, color } = piece
  const opp = color === 'w' ? 'b' : 'w'

  function push(nr: number, nc: number) {
    if (!inBounds(nr, nc)) return false
    if (board[nr][nc]?.color === color) return false
    moves.push({ r: nr, c: nc })
    return board[nr][nc] === null // can continue sliding
  }

  function slide(dr: number, dc: number) {
    let nr = r + dr, nc = c + dc
    while (inBounds(nr, nc)) {
      if (!push(nr, nc)) break
      nr += dr; nc += dc
    }
  }

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1
      const start = color === 'w' ? 6 : 1
      if (inBounds(r + dir, c) && !board[r + dir][c]) {
        moves.push({ r: r + dir, c })
        if (r === start && !board[r + 2 * dir][c])
          moves.push({ r: r + 2 * dir, c })
      }
      for (const dc of [-1, 1]) {
        if (inBounds(r + dir, c + dc)) {
          if (board[r + dir][c + dc]?.color === opp)
            moves.push({ r: r + dir, c: c + dc })
          else if (enPassant && enPassant.r === r + dir && enPassant.c === c + dc)
            moves.push({ r: r + dir, c: c + dc })
        }
      }
      break
    }
    case 'N': {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
        if (inBounds(r+dr, c+dc) && board[r+dr][c+dc]?.color !== color)
          moves.push({ r: r+dr, c: c+dc })
      break
    }
    case 'B': { slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break }
    case 'R': { slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break }
    case 'Q': {
      slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1)
      slide(-1,0); slide(1,0); slide(0,-1); slide(0,1)
      break
    }
    case 'K': {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
        if (inBounds(r+dr, c+dc) && board[r+dr][c+dc]?.color !== color)
          moves.push({ r: r+dr, c: c+dc })
      break
    }
  }
  return moves
}

function isAttacked(board: Board, pos: Pos, byColor: Color, enPassant: Pos | null): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === byColor)
        if (rawMoves(board, r, c, enPassant).some(m => m.r === pos.r && m.c === pos.c))
          return true
  return false
}

function isInCheck(board: Board, color: Color, enPassant: Pos | null): boolean {
  const kp = findKing(board, color)
  if (!kp) return false
  return isAttacked(board, kp, color === 'w' ? 'b' : 'w', enPassant)
}

// Legal moves (after filtering for check)
function legalMoves(
  board: Board,
  r: number, c: number,
  enPassant: Pos | null,
  castlingRights: GameState['castlingRights']
): Pos[] {
  const piece = board[r][c]
  if (!piece) return []
  const color = piece.color
  const opp = color === 'w' ? 'b' : 'w'
  const raw = rawMoves(board, r, c, enPassant)

  const legal = raw.filter(to => {
    const nb = cloneBoard(board)
    // Handle en passant capture
    if (piece.type === 'P' && enPassant && to.r === enPassant.r && to.c === enPassant.c) {
      const capturedRow = color === 'w' ? to.r + 1 : to.r - 1
      nb[capturedRow][to.c] = null
    }
    nb[to.r][to.c] = nb[r][c]
    nb[r][c] = null
    return !isInCheck(nb, color, null)
  })

  // Castling
  if (piece.type === 'K') {
    const baseRow = color === 'w' ? 7 : 0
    if (r === baseRow && c === 4) {
      // Kingside
      const kRight = color === 'w' ? castlingRights.wK : castlingRights.bK
      if (kRight &&
        !board[baseRow][5] && !board[baseRow][6] &&
        board[baseRow][7]?.type === 'R' && board[baseRow][7]?.color === color) {
        const nb = cloneBoard(board)
        if (!isInCheck(nb, color, null) &&
          !isAttacked(nb, { r: baseRow, c: 5 }, opp, null) &&
          !isAttacked(nb, { r: baseRow, c: 6 }, opp, null))
          legal.push({ r: baseRow, c: 6 })
      }
      // Queenside
      const qRight = color === 'w' ? castlingRights.wQ : castlingRights.bQ
      if (qRight &&
        !board[baseRow][3] && !board[baseRow][2] && !board[baseRow][1] &&
        board[baseRow][0]?.type === 'R' && board[baseRow][0]?.color === color) {
        const nb = cloneBoard(board)
        if (!isInCheck(nb, color, null) &&
          !isAttacked(nb, { r: baseRow, c: 3 }, opp, null) &&
          !isAttacked(nb, { r: baseRow, c: 2 }, opp, null))
          legal.push({ r: baseRow, c: 2 })
      }
    }
  }

  return legal
}

function applyMove(
  board: Board,
  from: Pos, to: Pos,
  enPassant: Pos | null,
  castlingRights: GameState['castlingRights'],
  promoteTo: PieceType = 'Q'
): { board: Board; captured: Piece | null; newEnPassant: Pos | null; newCastling: GameState['castlingRights']; promotionPending: Pos | null } {
  const nb = cloneBoard(board)
  const piece = nb[from.r][from.c]!
  let captured: Piece | null = nb[to.r][to.c]
  let newEnPassant: Pos | null = null
  let promotionPending: Pos | null = null

  const newCastling = { ...castlingRights }

  // En passant capture
  if (piece.type === 'P' && enPassant && to.r === enPassant.r && to.c === enPassant.c) {
    const capturedRow = piece.color === 'w' ? to.r + 1 : to.r - 1
    captured = nb[capturedRow][to.c]
    nb[capturedRow][to.c] = null
  }

  // Castling move
  if (piece.type === 'K') {
    const baseRow = piece.color === 'w' ? 7 : 0
    if (from.c === 4 && to.c === 6) {
      nb[baseRow][5] = nb[baseRow][7]
      nb[baseRow][7] = null
    } else if (from.c === 4 && to.c === 2) {
      nb[baseRow][3] = nb[baseRow][0]
      nb[baseRow][0] = null
    }
    if (piece.color === 'w') { newCastling.wK = false; newCastling.wQ = false }
    else { newCastling.bK = false; newCastling.bQ = false }
  }

  if (piece.type === 'R') {
    if (from.r === 7 && from.c === 0) newCastling.wQ = false
    if (from.r === 7 && from.c === 7) newCastling.wK = false
    if (from.r === 0 && from.c === 0) newCastling.bQ = false
    if (from.r === 0 && from.c === 7) newCastling.bK = false
  }

  // Double pawn push → en passant target
  if (piece.type === 'P' && Math.abs(to.r - from.r) === 2) {
    newEnPassant = { r: (from.r + to.r) / 2, c: from.c }
  }

  nb[to.r][to.c] = nb[from.r][from.c]
  nb[from.r][from.c] = null

  // Pawn promotion
  if (piece.type === 'P' && (to.r === 0 || to.r === 7)) {
    nb[to.r][to.c] = { type: promoteTo, color: piece.color }
    if (promoteTo === 'Q') {
      // auto-promote for AI, mark pending for human
      if (piece.color === 'w') promotionPending = to
    }
  }

  return { board: nb, captured, newEnPassant, newCastling, promotionPending }
}

function getAllLegalMoves(
  board: Board, color: Color,
  enPassant: Pos | null,
  castlingRights: GameState['castlingRights']
): { from: Pos; to: Pos }[] {
  const moves: { from: Pos; to: Pos }[] = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color) {
        const ms = legalMoves(board, r, c, enPassant, castlingRights)
        for (const to of ms) moves.push({ from: { r, c }, to })
      }
  return moves
}

// ─── AI (minimax + alpha-beta) ────────────────────────────────────────────────
const PIECE_VALUE: Record<PieceType, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 }

const PST: Record<PieceType, number[][]> = {
  P: [
    [0,0,0,0,0,0,0,0],
    [50,50,50,50,50,50,50,50],
    [10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],
    [0,0,0,20,20,0,0,0],
    [5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],
    [0,0,0,0,0,0,0,0]
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,0,0,0,0,-20,-40],
    [-30,0,10,15,15,10,0,-30],
    [-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],
    [-30,5,10,15,15,10,5,-30],
    [-40,-20,0,5,5,0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,0,0,0,0,0,0,-10],
    [-10,0,5,10,10,5,0,-10],
    [-10,5,5,10,10,5,5,-10],
    [-10,0,10,10,10,10,0,-10],
    [-10,10,10,10,10,10,10,-10],
    [-10,5,0,0,0,0,5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  R: [
    [0,0,0,0,0,0,0,0],
    [5,10,10,10,10,10,10,5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [0,0,0,5,5,0,0,0]
  ],
  Q: [
    [-20,-10,-10,-5,-5,-10,-10,-20],
    [-10,0,0,0,0,0,0,-10],
    [-10,0,5,5,5,5,0,-10],
    [-5,0,5,5,5,5,0,-5],
    [0,0,5,5,5,5,0,-5],
    [-10,5,5,5,5,5,0,-10],
    [-10,0,5,0,0,0,0,-10],
    [-20,-10,-10,-5,-5,-10,-10,-20]
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20,20,0,0,0,0,20,20],
    [20,30,10,0,0,10,30,20]
  ]
}

function evaluate(board: Board): number {
  let score = 0
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p) continue
      const pstRow = p.color === 'w' ? r : 7 - r
      const val = PIECE_VALUE[p.type] + PST[p.type][pstRow][c]
      score += p.color === 'b' ? val : -val
    }
  }
  return score
}

function minimax(
  board: Board, depth: number, alpha: number, beta: number,
  maximizing: boolean, color: Color,
  enPassant: Pos | null, castlingRights: GameState['castlingRights']
): number {
  const moves = getAllLegalMoves(board, color, enPassant, castlingRights)
  if (depth === 0 || moves.length === 0) return evaluate(board)

  if (maximizing) {
    let best = -Infinity
    for (const { from, to } of moves) {
      const { board: nb, newEnPassant, newCastling } = applyMove(board, from, to, enPassant, castlingRights)
      best = Math.max(best, minimax(nb, depth - 1, alpha, beta, false, 'w', newEnPassant, newCastling))
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const { from, to } of moves) {
      const { board: nb, newEnPassant, newCastling } = applyMove(board, from, to, enPassant, castlingRights)
      best = Math.min(best, minimax(nb, depth - 1, alpha, beta, true, 'b', newEnPassant, newCastling))
      beta = Math.min(beta, best)
      if (beta <= alpha) break
    }
    return best
  }
}

function getBestMove(
  board: Board, enPassant: Pos | null, castlingRights: GameState['castlingRights']
): { from: Pos; to: Pos } | null {
  const moves = getAllLegalMoves(board, 'b', enPassant, castlingRights)
  if (moves.length === 0) return null
  let bestScore = -Infinity
  let bestMove = moves[0]
  for (const move of moves) {
    const { board: nb, newEnPassant, newCastling } = applyMove(board, move.from, move.to, enPassant, castlingRights)
    const score = minimax(nb, 2, -Infinity, Infinity, false, 'w', newEnPassant, newCastling)
    if (score > bestScore) { bestScore = score; bestMove = move }
  }
  return bestMove
}

// ─── Move notation ────────────────────────────────────────────────────────────
const FILES = 'abcdefgh'
function toAN(pos: Pos): string { return FILES[pos.c] + (8 - pos.r) }
function moveNotation(piece: Piece, from: Pos, to: Pos, captured: Piece | null, isCheck: boolean, isCheckmate: boolean): string {
  const cap = captured ? 'x' : ''
  const suffix = isCheckmate ? '#' : isCheck ? '+' : ''
  if (piece.type === 'K' && Math.abs(to.c - from.c) === 2)
    return (to.c === 6 ? 'O-O' : 'O-O-O') + suffix
  const p = piece.type !== 'P' ? piece.type : ''
  return p + (piece.type === 'P' && captured ? FILES[from.c] : '') + cap + toAN(to) + suffix
}

// ─── Initial game state ───────────────────────────────────────────────────────
function createInitialState(): GameState {
  return {
    board: initialBoard(),
    turn: 'w',
    selected: null,
    validMoves: [],
    enPassantTarget: null,
    castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
    status: 'playing',
    capturedWhite: [],
    capturedBlack: [],
    moveHistory: [],
    promotionPending: null,
    gameKey: 0,
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gs, setGs] = useState<GameState>(createInitialState)
  const [aiThinking, setAiThinking] = useState(false)
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger AI move after human plays
  useEffect(() => {
    if (gs.turn === 'b' && gs.status === 'playing' && !gs.promotionPending) {
      setAiThinking(true)
      aiTimeoutRef.current = setTimeout(() => {
        setGs(prev => {
          if (prev.turn !== 'b' || prev.status !== 'playing') return prev
          const move = getBestMove(prev.board, prev.enPassantTarget, prev.castlingRights)
          if (!move) return prev
          const piece = prev.board[move.from.r][move.from.c]!
          const { board: nb, captured, newEnPassant, newCastling } = applyMove(
            prev.board, move.from, move.to, prev.enPassantTarget, prev.castlingRights
          )
          const inCheck = isInCheck(nb, 'w', newEnPassant)
          const allMoves = getAllLegalMoves(nb, 'w', newEnPassant, newCastling)
          const isCheckmate = inCheck && allMoves.length === 0
          const isStalemate = !inCheck && allMoves.length === 0
          const notation = moveNotation(piece, move.from, move.to, captured, inCheck, isCheckmate)
          const newCapturedWhite = captured?.color === 'w' ? [...prev.capturedWhite, captured] : prev.capturedWhite
          return {
            ...prev,
            board: nb,
            turn: 'w',
            selected: null,
            validMoves: [],
            enPassantTarget: newEnPassant,
            castlingRights: newCastling,
            status: isCheckmate ? 'checkmate' : isStalemate ? 'stalemate' : inCheck ? 'check' : 'playing',
            capturedWhite: newCapturedWhite,
            moveHistory: [...prev.moveHistory, notation],
          }
        })
        setAiThinking(false)
      }, 300)
    }
    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current) }
  }, [gs.turn, gs.status, gs.promotionPending])

  const handleSquareClick = useCallback((r: number, c: number) => {
    setGs(prev => {
      if (prev.turn !== 'w' || prev.status === 'checkmate' || prev.status === 'stalemate') return prev
      if (prev.promotionPending) return prev

      const clicked = prev.board[r][c]

      // If a move is valid, execute it
      if (prev.selected && prev.validMoves.some(m => m.r === r && m.c === c)) {
        const piece = prev.board[prev.selected.r][prev.selected.c]!
        const needsPromotion = piece.type === 'P' && r === 0

        if (needsPromotion) {
          // Apply the move temporarily, mark promotion pending
          const { board: nb, captured, newEnPassant, newCastling } = applyMove(
            prev.board, prev.selected, { r, c }, prev.enPassantTarget, prev.castlingRights, 'Q'
          )
          // We'll handle promotion choice via overlay
          const notation = piece.type + toAN({ r, c })
          const newCapturedBlack = captured?.color === 'b' ? [...prev.capturedBlack, captured] : prev.capturedBlack
          return {
            ...prev,
            board: nb,
            turn: 'b',
            selected: null,
            validMoves: [],
            enPassantTarget: newEnPassant,
            castlingRights: newCastling,
            capturedBlack: newCapturedBlack,
            moveHistory: [...prev.moveHistory, notation + '=Q'],
            promotionPending: null,
            status: 'playing',
          }
        }

        const { board: nb, captured, newEnPassant, newCastling } = applyMove(
          prev.board, prev.selected, { r, c }, prev.enPassantTarget, prev.castlingRights
        )
        const inCheck = isInCheck(nb, 'b', newEnPassant)
        const allMoves = getAllLegalMoves(nb, 'b', newEnPassant, newCastling)
        const isCheckmate = inCheck && allMoves.length === 0
        const isStalemate = !inCheck && allMoves.length === 0
        const notation = moveNotation(piece, prev.selected, { r, c }, captured, inCheck, isCheckmate)
        const newCapturedBlack = captured?.color === 'b' ? [...prev.capturedBlack, captured] : prev.capturedBlack
        return {
          ...prev,
          board: nb,
          turn: 'b',
          selected: null,
          validMoves: [],
          enPassantTarget: newEnPassant,
          castlingRights: newCastling,
          status: isCheckmate ? 'checkmate' : isStalemate ? 'stalemate' : inCheck ? 'check' : 'playing',
          capturedBlack: newCapturedBlack,
          moveHistory: [...prev.moveHistory, notation],
          promotionPending: null,
        }
      }

      // Select a white piece
      if (clicked?.color === 'w') {
        const moves = legalMoves(prev.board, r, c, prev.enPassantTarget, prev.castlingRights)
        return { ...prev, selected: { r, c }, validMoves: moves }
      }

      return { ...prev, selected: null, validMoves: [] }
    })
  }, [])

  function restart() {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    setAiThinking(false)
    setGs(s => ({ ...createInitialState(), gameKey: s.gameKey + 1 }))
  }

  const { board, selected, validMoves, status, capturedWhite, capturedBlack, moveHistory } = gs
  const inCheck = status === 'check' || (status === 'checkmate' && gs.turn === 'w')
  const kingPos = inCheck ? findKing(board, gs.turn) : null

  // Board squares
  const squares = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0
      let color = isLight ? LIGHT_SQ : DARK_SQ
      const isSel = selected?.r === r && selected?.c === c
      const isMov = validMoves.some(m => m.r === r && m.c === c)
      const isKingCheck = kingPos?.r === r && kingPos?.c === c
      if (isSel) color = HL_SEL
      else if (isKingCheck) color = HL_CHECK
      squares.push(
        <Entity key={`sq-${r}-${c}`}>
          <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
          <Sprite width={CELL} height={CELL} color={color} zIndex={0} />
        </Entity>
      )
      if (isMov) {
        const hasCapture = board[r][c] !== null
        squares.push(
          <Entity key={`mv-${r}-${c}`}>
            <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
            <Sprite
              width={hasCapture ? CELL - 2 : 20}
              height={hasCapture ? CELL - 2 : 20}
              color={HL_MOVE}
              zIndex={1}
            />
          </Entity>
        )
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Courier New", monospace', background: BG, minHeight: '100vh', padding: 20 }}>
      {/* Title HUD */}
      <div style={{ width: BOARD_W + SIDEBAR_W, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: HUD_BG, borderRadius: '10px 10px 0 0', color: '#90a4ae', fontSize: 11, letterSpacing: 2 }}>
        <span style={{ color: '#4fc3f7', fontWeight: 700 }}>CHESS</span>
        <span>{gs.turn === 'w' ? 'YOUR TURN' : aiThinking ? 'AI THINKING...' : 'AI TURN'}</span>
        <button onClick={restart} style={{ background: '#1a2535', border: '1px solid #2a3545', color: '#90a4ae', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11, letterSpacing: 1 }}>New Game</button>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Board area */}
        <div style={{ position: 'relative', width: BOARD_W, height: BOARD_H }}>
          {/* Rank/file labels */}
          {Array.from({ length: 8 }, (_, i) => (
            <div key={`rank-${i}`} style={{ position: 'absolute', left: 2, top: i * CELL + CELL / 2 - 8, color: (i + 0) % 2 === 0 ? DARK_SQ : LIGHT_SQ, fontSize: 11, fontWeight: 700, pointerEvents: 'none', zIndex: 5 }}>
              {8 - i}
            </div>
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <div key={`file-${i}`} style={{ position: 'absolute', bottom: 2, left: i * CELL + CELL - 10, color: i % 2 === 0 ? LIGHT_SQ : DARK_SQ, fontSize: 11, fontWeight: 700, pointerEvents: 'none', zIndex: 5 }}>
              {FILES[i]}
            </div>
          ))}

          <Game key={gs.gameKey} width={BOARD_W} height={BOARD_H} gravity={0}>
            <World background={BG}>
              <Camera2D x={BOARD_W / 2} y={BOARD_H / 2} background={BG} />
              {squares}
            </World>
          </Game>

          {/* Piece overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
            {board.map((row, r) => row.map((piece, c) => {
              if (!piece) return null
              return (
                <div key={`p-${r}-${c}`} style={{
                  position: 'absolute',
                  left: c * CELL,
                  top: r * CELL,
                  width: CELL,
                  height: CELL,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 38,
                  lineHeight: 1,
                  userSelect: 'none',
                  textShadow: piece.color === 'w' ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 3px rgba(0,0,0,0.5)',
                  color: piece.color === 'w' ? '#fff' : '#111',
                  filter: piece.color === 'w' ? 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' : 'drop-shadow(0 0 1px rgba(255,255,255,0.3))',
                }}>
                  {pieceSymbol(piece)}
                </div>
              )
            }))}
          </div>

          {/* Click overlay */}
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 4, cursor: gs.turn === 'w' && status !== 'checkmate' && status !== 'stalemate' ? 'pointer' : 'default' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const c = Math.floor((e.clientX - rect.left) / CELL)
              const r = Math.floor((e.clientY - rect.top) / CELL)
              if (r >= 0 && r < 8 && c >= 0 && c < 8) handleSquareClick(r, c)
            }}
          />

          {/* Game over overlay */}
          {(status === 'checkmate' || status === 'stalemate') && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)' }}>
              <div style={{ textAlign: 'center', background: HUD_BG, border: '1px solid #2a3545', borderRadius: 12, padding: '32px 48px' }}>
                <div style={{ fontSize: 11, letterSpacing: 4, color: '#546e7a', marginBottom: 8 }}>
                  {status === 'checkmate' ? 'CHECKMATE' : 'STALEMATE'}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: status === 'checkmate' ? '#ef5350' : '#ffd54f', letterSpacing: 2 }}>
                  {status === 'checkmate' ? (gs.turn === 'b' ? 'YOU WIN!' : 'AI WINS!') : 'DRAW!'}
                </div>
                <button onClick={restart} style={{ marginTop: 20, padding: '10px 28px', background: '#4fc3f7', color: '#0a0a0f', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: '"Courier New", monospace', fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width: SIDEBAR_W, background: HUD_BG, borderLeft: '1px solid #1e2535', display: 'flex', flexDirection: 'column', padding: '10px 8px', gap: 8, overflow: 'hidden' }}>
          {/* Status */}
          <div style={{ fontSize: 11, letterSpacing: 2, color: status === 'check' ? '#ef5350' : '#546e7a', textAlign: 'center', padding: '4px 0', borderBottom: '1px solid #1e2535' }}>
            {status === 'check' ? 'CHECK!' : status === 'playing' ? 'IN PLAY' : status.toUpperCase()}
          </div>

          {/* Captured pieces */}
          <div style={{ fontSize: 10, color: '#546e7a', letterSpacing: 1 }}>CAPTURED BY AI</div>
          <div style={{ minHeight: 24, display: 'flex', flexWrap: 'wrap', gap: 1, fontSize: 18 }}>
            {capturedWhite.map((p, i) => (
              <span key={i} style={{ color: '#fff', textShadow: '0 1px 2px #000' }}>{pieceSymbol(p)}</span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#546e7a', letterSpacing: 1 }}>CAPTURED BY YOU</div>
          <div style={{ minHeight: 24, display: 'flex', flexWrap: 'wrap', gap: 1, fontSize: 18 }}>
            {capturedBlack.map((p, i) => (
              <span key={i} style={{ color: '#111', textShadow: '0 0 2px rgba(255,255,255,0.5)' }}>{pieceSymbol(p)}</span>
            ))}
          </div>

          {/* Move history */}
          <div style={{ fontSize: 10, color: '#546e7a', letterSpacing: 1, marginTop: 4 }}>MOVE HISTORY</div>
          <div style={{ flex: 1, overflowY: 'auto', fontSize: 11, color: '#90a4ae', lineHeight: 1.7 }}>
            {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, color: i === Math.floor((moveHistory.length - 1) / 2) ? '#4fc3f7' : '#90a4ae' }}>
                <span style={{ color: '#37474f', minWidth: 20 }}>{i + 1}.</span>
                <span>{moveHistory[i * 2] ?? ''}</span>
                <span style={{ color: '#607d8b' }}>{moveHistory[i * 2 + 1] ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ width: BOARD_W + SIDEBAR_W, background: HUD_BG, borderRadius: '0 0 10px 10px', padding: '5px 14px', fontSize: 10, color: '#37474f', letterSpacing: 1.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>Click a piece to select &middot; Click to move</span>
        <span>Cubeforge Engine</span>
      </div>
    </div>
  )
}
