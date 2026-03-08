// ─── Tile System Constants ────────────────────────────────────────────────────
export const T          = 32          // tile size in pixels
export const ROWS       = 18         // viewport rows (560 / 32)
export const GROUND_ROW = 15         // first row of ground tiles
export const GROUND_DEPTH = 3        // ground tiles deep (rows 15,16,17)
export const BLOCK_ROW  = 11         // standard block height (4 tiles above ground)

// Backward-compat aliases
export const TILE      = T
export const FLOOR_TOP = GROUND_ROW * T        // 480
export const FLOOR_H   = GROUND_DEPTH * T      // 96
export const FLOOR_Y   = FLOOR_TOP + FLOOR_H / 2 // 528

// ─── Tile Indices ─────────────────────────────────────────────────────────────
export const AIR       = 0
export const GROUND_ID = 1
export const BRICK_ID  = 2
export const QBLOCK_ID = 3
export const USED_ID   = 4
export const COIN_ID   = 5
export const PIPE_TL   = 6
export const PIPE_TR   = 7
export const PIPE_BL   = 8
export const PIPE_BR   = 9

export const SOLID_TILES = new Set([1, 2, 3, 4, 6, 7, 8, 9])

export const LEVEL_NAME:  Record<1|2|3, string> = { 1: 'WORLD 1-1', 2: 'WORLD 1-2', 3: 'WORLD 1-3' }
export const LEVEL_THEME: Record<1|2|3, string> = { 1: 'OVERWORLD', 2: 'UNDERGROUND', 3: 'CASTLE' }

// ─── Types ────────────────────────────────────────────────────────────────────
export type RevealType = 'coin' | 'mushroom' | 'fireFlower' | 'star' | 'oneUp'
export type GameState  = 'playing' | 'gameover' | 'win' | 'levelclear'

export interface QBlock  { id: number; x: number; y: number; reveals: RevealType }
export interface CoinDef { id: number; x: number; y: number }
export interface SpawnedReveal { id: number; type: RevealType; x: number; y: number }
export interface EnemyDef {
  type: 'goomba' | 'koopa' | 'paratroopa' | 'buzzy' | 'billblaster' | 'hammerbro' | 'podoboo' | 'bowser'
  x: number; y: number; left: number; right: number
  src?: string; dir?: number; interval?: number
}
export interface PipeDef { x: number; y: number; h: number; pipeTopY: number; src?: string }

export interface LevelData {
  theme: 'overworld' | 'underground' | 'castle'
  bg: string; worldW: number; cols: number
  tiles: number[][]
  groundSrc: string; brickSrc: string; coinSrc: string; qBlockSrc: string; pipeSrc: string
  floorSegs: Array<{ x: number; w: number }>
  groundTiles: Array<{ x: number; y: number }>
  elevatedGround: Array<{ x: number; y: number }>
  pipes: PipeDef[]
  brickBlocks: Array<{ x: number; y: number }>
  qBlocks: QBlock[]
  coins: CoinDef[]
  enemies: EnemyDef[]
  decorations: Array<{ x: number; y: number; src: string; w: number; h: number }>
  piranhaXs: number[]
  goalX: number
}

// ─── RNG ──────────────────────────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = ((seed ^ 0x5f3759df) >>> 0) || 1
  return (): number => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000 }
}
function ri(rng: () => number, lo: number, hi: number) { return Math.floor(rng() * (hi - lo + 1)) + lo }
function rc<T>(rng: () => number, arr: readonly T[]): T { return arr[Math.floor(rng() * arr.length)] }

// ─── Tilemap Helpers ──────────────────────────────────────────────────────────
function createTilemap(cols: number): number[][] {
  return Array.from({ length: ROWS }, () => new Array(cols).fill(AIR))
}

function fillGround(tiles: number[][], from: number, to: number) {
  const cols = tiles[0].length
  for (let r = GROUND_ROW; r < GROUND_ROW + GROUND_DEPTH && r < ROWS; r++)
    for (let c = Math.max(0, from); c < Math.min(to, cols); c++)
      tiles[r][c] = GROUND_ID
}

function carvePit(tiles: number[][], from: number, width: number) {
  const cols = tiles[0].length
  for (let r = GROUND_ROW; r < GROUND_ROW + GROUND_DEPTH && r < ROWS; r++)
    for (let c = from; c < from + width && c < cols; c++)
      if (c >= 0) tiles[r][c] = AIR
}

function setPipe(tiles: number[][], col: number, heightTiles: number) {
  const topRow = GROUND_ROW - heightTiles
  if (topRow < 0 || col + 1 >= tiles[0].length) return
  tiles[topRow][col]     = PIPE_TL
  tiles[topRow][col + 1] = PIPE_TR
  for (let r = topRow + 1; r < GROUND_ROW; r++) {
    tiles[r][col]     = PIPE_BL
    tiles[r][col + 1] = PIPE_BR
  }
}

function setBlocks(
  tiles: number[][], col: number, len: number, row: number,
  qPositions: number[], reveals: Map<string, RevealType>,
  revealTypes: RevealType[],
) {
  if (row < 0 || row >= ROWS) return
  for (let i = 0; i < len; i++) {
    const c = col + i
    if (c < 0 || c >= tiles[0].length) continue
    const isQ = qPositions.includes(i)
    tiles[row][c] = isQ ? QBLOCK_ID : BRICK_ID
    if (isQ && revealTypes.length > 0)
      reveals.set(`${c},${row}`, revealTypes.shift()!)
  }
}

function setCoins(tiles: number[][], col: number, len: number, row: number) {
  if (row < 0 || row >= ROWS) return
  for (let i = 0; i < len; i++) {
    const c = col + i
    if (c >= 0 && c < tiles[0].length && tiles[row][c] === AIR)
      tiles[row][c] = COIN_ID
  }
}

function setStaircase(tiles: number[][], startCol: number) {
  for (let step = 0; step < 8; step++) {
    const c = startCol + step
    if (c >= tiles[0].length) break
    for (let row = 0; row <= step; row++) {
      const r = GROUND_ROW - 1 - row
      if (r >= 0) tiles[r][c] = GROUND_ID
    }
  }
}

// ─── Extraction Helpers ───────────────────────────────────────────────────────
function tx(col: number): number { return col * T + T / 2 }
function ty(row: number): number { return row * T + T / 2 }

function extractFloorSegs(tiles: number[][]): Array<{ x: number; w: number }> {
  const row = tiles[GROUND_ROW]
  const segs: Array<{ x: number; w: number }> = []
  let start = -1
  for (let c = 0; c <= row.length; c++) {
    const isG = c < row.length && row[c] === GROUND_ID
    if (isG && start === -1) start = c
    if (!isG && start !== -1) {
      segs.push({ x: start * T, w: (c - start) * T })
      start = -1
    }
  }
  return segs
}

function extractElevated(tiles: number[][]): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = []
  for (let r = 0; r < GROUND_ROW; r++)
    for (let c = 0; c < tiles[0].length; c++)
      if (tiles[r][c] === GROUND_ID)
        result.push({ x: tx(c), y: ty(r) })
  return result
}

function extractGroundTiles(tiles: number[][]): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = []
  for (let r = GROUND_ROW; r < ROWS; r++)
    for (let c = 0; c < tiles[0].length; c++)
      if (tiles[r][c] === GROUND_ID)
        result.push({ x: tx(c), y: ty(r) })
  return result
}

function extractBricks(tiles: number[][]): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < tiles[0].length; c++)
      if (tiles[r][c] === BRICK_ID)
        result.push({ x: tx(c), y: ty(r) })
  return result
}

function extractQBlocks(tiles: number[][], reveals: Map<string, RevealType>): QBlock[] {
  const result: QBlock[] = []
  let id = 1
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < tiles[0].length; c++)
      if (tiles[r][c] === QBLOCK_ID)
        result.push({ id: id++, x: tx(c), y: ty(r), reveals: reveals.get(`${c},${r}`) || 'coin' })
  return result
}

function extractCoins(tiles: number[][]): CoinDef[] {
  const result: CoinDef[] = []
  let id = 1
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < tiles[0].length; c++)
      if (tiles[r][c] === COIN_ID)
        result.push({ id: id++, x: tx(c), y: ty(r) })
  return result
}

function extractPipes(tiles: number[][], pipeSrc: string): PipeDef[] {
  const pipes: PipeDef[] = []
  const visited = new Set<string>()
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < tiles[0].length; c++) {
      if (tiles[r][c] === PIPE_TL && !visited.has(`${c},${r}`)) {
        visited.add(`${c},${r}`)
        let h = 1
        while (r + h < ROWS && tiles[r + h][c] === PIPE_BL) h++
        const pixH = h * T
        pipes.push({
          x: c * T + T,         // center of 2-tile-wide pipe
          y: r * T + pixH / 2,  // center vertically
          h: pixH,
          pipeTopY: r * T,
          src: pipeSrc,
        })
      }
    }
  return pipes
}

// ─── Enemy Spawn Helpers ──────────────────────────────────────────────────────
function enemyY(type: EnemyDef['type']): number {
  switch (type) {
    case 'goomba': case 'buzzy': case 'podoboo': return FLOOR_TOP - T / 2     // 464
    case 'koopa': case 'paratroopa': case 'hammerbro': return FLOOR_TOP - 24   // 456
    case 'billblaster': return FLOOR_TOP - T                                    // 448
    case 'bowser': return FLOOR_TOP - T                                         // 448
    default: return FLOOR_TOP - T / 2
  }
}

function makeEnemy(
  type: EnemyDef['type'], col: number, spreadCols: number,
  opts?: { src?: string; dir?: number; interval?: number },
): EnemyDef {
  return {
    type, x: tx(col), y: enemyY(type),
    left: (col - spreadCols) * T, right: (col + spreadCols) * T,
    ...opts,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REVEALS: RevealType[] = ['mushroom', 'coin', 'fireFlower', 'coin', 'oneUp', 'star', 'coin', 'coin']
const CLOUD_SRCS = [
  { src: '/SMB_Cloud_Single.gif', w: 64,  h: 48 },
  { src: '/SMB_Cloud_Double.gif', w: 96,  h: 48 },
  { src: '/SMB_Cloud_Triple.gif', w: 128, h: 48 },
] as const

// ─── Build final LevelData ───────────────────────────────────────────────────
function buildLevelData(
  tiles: number[][], cols: number,
  reveals: Map<string, RevealType>,
  enemies: EnemyDef[], piranhaXs: number[], goalCol: number,
  decorations: LevelData['decorations'],
  theme: LevelData['theme'], bg: string,
  groundSrc: string, brickSrc: string, coinSrc: string,
  qBlockSrc: string, pipeSrc: string,
): LevelData {
  return {
    theme, bg, worldW: cols * T, cols, tiles,
    groundSrc, brickSrc, coinSrc, qBlockSrc, pipeSrc,
    floorSegs: extractFloorSegs(tiles),
    groundTiles: extractGroundTiles(tiles),
    elevatedGround: extractElevated(tiles),
    pipes: extractPipes(tiles, pipeSrc),
    brickBlocks: extractBricks(tiles),
    qBlocks: extractQBlocks(tiles, reveals),
    coins: extractCoins(tiles),
    enemies, decorations, piranhaXs,
    goalX: tx(goalCol),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Level 1 — Overworld
// ═══════════════════════════════════════════════════════════════════════════════
export function genLevel1(seed: number): LevelData {
  const rng  = makeRng(seed)
  const COLS = 110 + ri(rng, 0, 19)
  const STAIR_COL = COLS - 20
  const GOAL_COL  = COLS - 10

  const tiles   = createTilemap(COLS)
  const reveals = new Map<string, RevealType>()
  const enemies: EnemyDef[]   = []
  const piranhaXs: number[]   = []
  const revPool = [...REVEALS, ...REVEALS, ...REVEALS]

  // ── Ground ──────────────────────────────────────────────────────────────────
  fillGround(tiles, 0, COLS)

  // ── Pit ─────────────────────────────────────────────────────────────────────
  const pitCol = 35 + ri(rng, 0, 15)
  const pitW   = ri(rng, 2, 3)
  carvePit(tiles, pitCol, pitW)
  const nearPit = (c: number, m = 3) => c > pitCol - m && c < pitCol + pitW + m

  // ── Pipes (3 candidates, 2 tiles wide, min 6 tiles apart) ──────────────────
  const pipeCols: number[] = []
  const pipeCandidates = [15, pitCol - 7, pitCol + pitW + 10]
  for (const pc of pipeCandidates) {
    if (pc < 5 || pc + 1 >= STAIR_COL || nearPit(pc)) continue
    if (pipeCols.some(prev => Math.abs(prev - pc) < 3)) continue
    const h = rc(rng, [2, 3, 4] as const)
    setPipe(tiles, pc, h)
    pipeCols.push(pc)
    if (rng() > 0.45) piranhaXs.push(pc * T + T)
  }

  // ── Block clusters (brick/question groups, 3-5 tiles) ──────────────────────
  const clusterCols = [9, 18, 28, 40, 50, 60, 70, 80, 90]
  for (const cx of clusterCols) {
    if (cx >= STAIR_COL - 8 || nearPit(cx, 3)) continue
    if (pipeCols.some(pc => Math.abs(cx - pc) < 2)) continue
    const row   = rng() > 0.4 ? BLOCK_ROW : BLOCK_ROW - 2
    const len   = ri(rng, 3, 5)
    const qPos  = ri(rng, 0, len - 1)
    const doQ   = rng() > 0.35
    setBlocks(tiles, cx, len, row, doQ ? [qPos] : [], reveals, doQ ? [revPool.shift()!] : [])
    // Coins 1-2 rows above blocks
    setCoins(tiles, cx, ri(rng, 3, Math.min(6, len)), row - ri(rng, 1, 2))
  }

  // ── Enemies ─────────────────────────────────────────────────────────────────
  // First enemy a few tiles from player spawn (col 3)
  let nextE = 3 + ri(rng, 7, 9)
  while (nextE < STAIR_COL - 13) {
    if (!nearPit(nextE, 3) && !pipeCols.some(pc => Math.abs(pc - nextE) < 3)) {
      const type = rc(rng, ['goomba', 'goomba', 'goomba', 'koopa', 'paratroopa'] as const)
      enemies.push(makeEnemy(type, nextE, ri(rng, 5, 10)))
      // Cluster of 2 (max)
      if (rng() > 0.6) {
        const col2 = nextE + ri(rng, 4, 5)
        if (!nearPit(col2, 3)) enemies.push(makeEnemy('goomba', col2, ri(rng, 4, 8)))
        nextE = col2 + ri(rng, 5, 8) // safe tiles after cluster
      } else {
        nextE += ri(rng, 4, 7)
      }
    } else {
      nextE += ri(rng, 4, 6)
    }
  }

  // Bill blasters near staircase
  enemies.push(makeEnemy('billblaster', STAIR_COL - 10, 0, { dir: 1, interval: 3.5 }))
  enemies.push(makeEnemy('billblaster', STAIR_COL - 3,  0, { dir: 1, interval: 4.8 }))

  // ── Staircase ───────────────────────────────────────────────────────────────
  setStaircase(tiles, STAIR_COL)

  // ── Clouds ──────────────────────────────────────────────────────────────────
  const decorations: LevelData['decorations'] = []
  for (let x = 150; x < COLS * T - 150; x += ri(rng, 280, 560))
    decorations.push({ x, y: ri(rng, 80, 220), ...rc(rng, CLOUD_SRCS) })

  return buildLevelData(
    tiles, COLS, reveals, enemies, piranhaXs, GOAL_COL, decorations,
    'overworld', '#5c94fc',
    '/SMB_Ground.png', '/SMB_Brick_Block_Sprite.png',
    '/SMB1_Sprite_Coin.gif', '/SMB_Question_Block.gif', '/Warp_Pipe_SMB.png',
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Level 2 — Underground
// ═══════════════════════════════════════════════════════════════════════════════
export function genLevel2(seed: number): LevelData {
  const rng  = makeRng(seed + 99991)
  const COLS = 130
  const STAIR_COL = COLS - 20
  const GOAL_COL  = COLS - 10

  const tiles   = createTilemap(COLS)
  const reveals = new Map<string, RevealType>()
  const enemies: EnemyDef[]   = []
  const piranhaXs: number[]   = []
  const revPool = [...REVEALS, ...REVEALS, ...REVEALS]

  fillGround(tiles, 0, COLS)

  // ── Pipes ───────────────────────────────────────────────────────────────────
  const pipeCols: number[] = []
  for (let col = 19; col < STAIR_COL - 13; col += ri(rng, 24, 33)) {
    setPipe(tiles, col, 2)
    pipeCols.push(col)
    if (rng() > 0.4) piranhaXs.push(col * T + T)
  }

  // ── Block clusters (denser) ─────────────────────────────────────────────────
  for (let cx = 12; cx < STAIR_COL - 12; cx += ri(rng, 8, 13)) {
    if (pipeCols.some(pc => Math.abs(pc - cx) < 5)) continue
    const row  = rc(rng, [BLOCK_ROW, BLOCK_ROW - 2, BLOCK_ROW - 4] as const)
    const len  = ri(rng, 3, 6)
    const qPos = ri(rng, 1, Math.max(1, len - 2))
    const doQ  = rng() > 0.4
    setBlocks(tiles, cx, len, row, doQ ? [qPos] : [], reveals, doQ ? [revPool.shift()!] : [])
    setCoins(tiles, cx, ri(rng, 3, len), row - 2)
  }

  // ── Enemies ─────────────────────────────────────────────────────────────────
  let nextE = 10
  while (nextE < STAIR_COL - 13) {
    if (!pipeCols.some(pc => Math.abs(pc - nextE) < 3)) {
      const type = rc(rng, ['goomba', 'goomba', 'buzzy', 'koopa'] as const)
      const src  = type === 'goomba' ? '/GoombaSMBGrey.gif'
                 : type === 'koopa'  ? '/SMB_NES_Blue_Koopa_Troopa_Walking.gif'
                 : type === 'buzzy'  ? '/BuzzyBeetleSMBUnderground.gif'
                 : undefined
      enemies.push(makeEnemy(type, nextE, ri(rng, 5, 10), { src }))
    }
    nextE += ri(rng, 10, 16)
  }

  // Bill blasters (from col 63)
  for (let col = 63; col < STAIR_COL - 6; col += ri(rng, 13, 19))
    enemies.push(makeEnemy('billblaster', col, 0, { dir: rng() > 0.5 ? 1 : -1, interval: 3 + rng() * 2 }))

  setStaircase(tiles, STAIR_COL)

  return buildLevelData(
    tiles, COLS, reveals, enemies, piranhaXs, GOAL_COL, [],
    'underground', '#1a1a2e',
    '/SMB_Ground_Underground.png', '/SMB_Underground_Brick_Block.png',
    '/SMB_CoinUnderground.gif', '/SMB_QuestionBlockUndergroundAnim.gif',
    '/Warp_Pipe_SMB.png',
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Level 3 — Castle
// ═══════════════════════════════════════════════════════════════════════════════
export function genLevel3(seed: number): LevelData {
  const rng  = makeRng(seed + 77777)
  const COLS = 105
  const STAIR_COL = COLS - 20
  const GOAL_COL  = COLS - 10

  const tiles   = createTilemap(COLS)
  const reveals = new Map<string, RevealType>()
  const enemies: EnemyDef[]   = []
  const piranhaXs: number[]   = []
  const revPool = [...REVEALS, ...REVEALS, ...REVEALS]

  fillGround(tiles, 0, COLS)

  // ── Pipes (gray) ────────────────────────────────────────────────────────────
  const pipeCols: number[] = []
  for (let col = 16; col < STAIR_COL - 13; col += ri(rng, 24, 32)) {
    setPipe(tiles, col, 2)
    pipeCols.push(col)
    if (rng() > 0.4) piranhaXs.push(col * T + T)
  }

  // ── Block clusters ──────────────────────────────────────────────────────────
  for (let cx = 12; cx < STAIR_COL - 12; cx += ri(rng, 10, 14)) {
    if (pipeCols.some(pc => Math.abs(pc - cx) < 5)) continue
    const row  = rc(rng, [BLOCK_ROW, BLOCK_ROW - 2] as const)
    const len  = ri(rng, 3, 5)
    const qPos = ri(rng, 0, len - 1)
    const doQ  = rng() > 0.4
    setBlocks(tiles, cx, len, row, doQ ? [qPos] : [], reveals, doQ ? [revPool.shift()!] : [])
    setCoins(tiles, cx, ri(rng, 3, len), row - 1)
  }

  // ── Enemies ─────────────────────────────────────────────────────────────────
  let nextE = 9
  while (nextE < STAIR_COL - 19) {
    if (!pipeCols.some(pc => Math.abs(pc - nextE) < 3)) {
      const type = rc(rng, ['goomba', 'koopa', 'buzzy', 'hammerbro'] as const)
      const src  = type === 'goomba' ? '/SMBBlueGoomba.gif'
                 : type === 'buzzy'  ? '/SMB_Buzzy_Beetle_Castle_Sprite.gif'
                 : undefined
      enemies.push(makeEnemy(type, nextE, ri(rng, 5, 10), { src }))
    }
    nextE += ri(rng, 8, 13)
  }

  // Podoboos
  for (let col = 16; col < STAIR_COL - 19; col += ri(rng, 13, 19))
    enemies.push(makeEnemy('podoboo', col, 0))

  // Bill blasters
  enemies.push(makeEnemy('billblaster', STAIR_COL - 16, 0, { dir: 1,  interval: 3.0 }))
  enemies.push(makeEnemy('billblaster', STAIR_COL - 9, 0, { dir: -1, interval: 3.8 }))

  // Bowser
  const bowserCol = COLS - 10
  enemies.push({
    type: 'bowser', x: tx(bowserCol), y: enemyY('bowser'),
    left: (bowserCol - 6) * T, right: (bowserCol + 6) * T,
  })

  setStaircase(tiles, STAIR_COL)

  // Fortress decorations
  const decorations: LevelData['decorations'] = []
  for (let x = 200; x < COLS * T - 152; x += ri(rng, 248, 352))
    decorations.push({ x, y: 352, src: '/LargeFortressSMB.png', w: 96, h: 128 })

  return buildLevelData(
    tiles, COLS, reveals, enemies, piranhaXs, GOAL_COL, decorations,
    'castle', '#0a0a0f',
    '/SMB_Ground_Castle.png', '/SMB_Hard_Block_Sprite.png',
    '/SMB_CoinCastle.gif', '/SMB_QuestionBlockCastleAnim.gif',
    '/Warp_Pipe_Gray_SMB.png',
  )
}
