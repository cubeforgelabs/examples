import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'
import type { EntityId } from '@cubeforge/react'
import { Player, playerConfig }  from './components/Player'
import { Goomba }                from './components/Goomba'
import { KoopaTroopa }           from './components/KoopaTroopa'
import { KoopaParatroopa }       from './components/KoopaParatroopa'
import { BuzzyBeetle }           from './components/BuzzyBeetle'
import { PiranhaPlant }          from './components/PiranhaPlant'
import { BillBlaster }           from './components/BillBlaster'
import { HammerBro }             from './components/HammerBro'
import { Bowser }                from './components/Bowser'
import { Podoboo }               from './components/Podoboo'
import { Ground }                from './components/Ground'
import { Coin }                  from './components/Coin'
import { QuestionBlock }         from './components/QuestionBlock'
import { BrickBlock }            from './components/BrickBlock'
import { WarpPipe }              from './components/WarpPipe'
import { Mushroom }              from './components/Mushroom'
import { FireFlower }            from './components/FireFlower'
import { StarItem }              from './components/StarItem'
import { OneUpMushroom }         from './components/OneUpMushroom'
import { GoalFlag }              from './components/GoalFlag'
import { gameEvents }            from './gameEvents'
import { preloadImage }          from './images'

// ─── Asset preload ────────────────────────────────────────────────────────────
const ASSETS = [
  '/ClassicNES_SMB_Small_Mario_Sprite.png', '/ClassicNES_SMB_Super_Mario_Sprite.png',
  '/SMB_Fire_Mario_Sprite.png', '/Goomba_SMB.png', '/SMB_Goomba_Sprite.gif',
  '/GoombaSMBGrey.gif', '/SMBBlueGoomba.gif', '/SMB_Green_Koopa_Troopa_Sprite.png',
  '/SMB_NES_Blue_Koopa_Troopa_Walking.gif', '/KoopaParatroopaGreenDark.gif',
  '/SMB_Red_Koopa_Troopa.gif', '/Buzzy_Beetle_SMB.png', '/BuzzyBeetleSMBUnderground.gif',
  '/SMB_Buzzy_Beetle_Castle_Sprite.gif', '/SMB_Sprite_Piranha_Plant.png',
  '/SMB_Piranha_Plant_Underground_Sprite.png', '/Podoboo_Sprite_SMB.png',
  '/SMB_Sprite_Coin.png', '/SMB1_Sprite_Coin.gif', '/SMB_CoinUnderground.gif',
  '/SMB_CoinCastle.gif', '/SMB_Qblock.png', '/SMB_Question_Block.gif',
  '/SMB_QuestionBlockUndergroundAnim.gif', '/SMB_QuestionBlockCastleAnim.gif',
  '/SMB1_Empty_Block.png', '/SMB_Brick_Block_Sprite.png', '/SMB_Underground_Brick_Block.png',
  '/SMB_Castle_Brick_Block.png', '/SMB_Supermushroom.png', '/SMB_Sprite_Fire_Flower.png',
  '/Starman.gif', '/SMB_Sprite_Super_Star.png', '/SMB_Sprite_1UP.png',
  '/Warp_Pipe_SMB.png', '/Warp_Pipe_Orange_SMB.png', '/Warp_Pipe_Gray_SMB.png',
  '/Bill_Blaster_Sprite_SMB.png', '/Bullet_Bill_Super_Mario_Bros.png',
  '/SMB_Hammer_Bro_Sprite.png', '/SMB_Sprite_Axe.png', '/SMB_Bowser_Sprite.png',
  '/SMBBowsersFlame.gif', '/SMB_Goal_Pole.png', '/SMBCastle.png',
  '/LargeFortressSMB.png', '/SMB_Princess_Toadstool_Sprite.png', '/SMBFireBall.gif',
  '/SMB_Ground.png', '/SMB_Ground_Underground.png', '/SMB_Ground_Castle.png',
  '/SMBPlatform.png', '/SMB_Hard_Block_Sprite.png', '/SMB_Underground_Hard_Block.png',
  '/SMB_Green_Horsetail_Short.png', '/SMB_Green_Horsetail_Tall.png',
  '/SMB_White_Horsetail_Short.png', '/SMB_White_Horsetail_Tall.png',
  '/SMB_Sprite_Island_(Ground).png', '/SMB_Sprite_Island_(Gray).png',
  '/SMB_Sprite_Lava.png', '/SMB_Bowser_Bridge.png', '/SMB_Sprite_Firework.gif',
]
ASSETS.forEach(preloadImage)

// ─── Constants ────────────────────────────────────────────────────────────────
const W         = 800
const H         = 560
const MAX_LIVES = 3
const TILE      = 32
const FLOOR_Y   = 506   // center of floor strip
const FLOOR_H   = 28
const FLOOR_TOP = FLOOR_Y - Math.floor(FLOOR_H / 2)  // 492 — player stands here
const BLOCK_Y   = 310   // center of standard floating block row
const BLOCK_Y2  = BLOCK_Y - TILE  // 278, upper tier

// ─── RNG ──────────────────────────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = ((seed ^ 0x5f3759df) >>> 0) || 1
  return (): number => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000 }
}
function ri(rng: () => number, lo: number, hi: number) { return Math.floor(rng() * (hi - lo + 1)) + lo }
function rc<T>(rng: () => number, arr: readonly T[]): T { return arr[Math.floor(rng() * arr.length)] }

// ─── Types ────────────────────────────────────────────────────────────────────
type RevealType = 'coin' | 'mushroom' | 'fireFlower' | 'star' | 'oneUp'
type GameState  = 'playing' | 'gameover' | 'win' | 'levelclear'

interface QBlock  { id: number; x: number; y: number; reveals: RevealType }
interface CoinDef { id: number; x: number; y: number }
interface SpawnedReveal { id: number; type: RevealType; x: number; y: number }
interface EnemyDef {
  type: 'goomba' | 'koopa' | 'paratroopa' | 'buzzy' | 'billblaster' | 'hammerbro' | 'podoboo' | 'bowser'
  x: number; y: number; left: number; right: number
  src?: string; dir?: number; interval?: number
}
interface PipeDef { x: number; y: number; h: number; pipeTopY: number; src?: string }
interface LevelData {
  theme: 'overworld' | 'underground' | 'castle'
  bg: string; worldW: number; floorSrc: string; brickSrc: string
  coinSrc: string; qBlockSrc: string
  floorSegs: Array<{ x: number; w: number }>
  pipes: PipeDef[]
  brickBlocks: Array<{ x: number; y: number }>
  qBlocks: QBlock[]
  coins: CoinDef[]
  enemies: EnemyDef[]
  decorations: Array<{ x: number; y: number; src: string; w: number; h: number }>
  piranhaXs: number[]
  stairX: number; goalX: number
}

// ─── Level generators ─────────────────────────────────────────────────────────
const REVEALS: RevealType[] = ['mushroom', 'coin', 'fireFlower', 'coin', 'oneUp', 'star', 'coin', 'coin']

function buildBlocks(
  rng: () => number,
  positions: number[],
  stairX: number,
  pitX: number, pitW: number,
  qBlocks: QBlock[], brickBlocks: Array<{x:number;y:number}>,
  qIdRef: {v:number}, revIdxRef: {v:number}
) {
  for (const cx of positions) {
    if (cx >= stairX - 200) continue
    if (cx > pitX - 60 && cx < pitX + pitW + 60) continue
    const y     = rng() > 0.4 ? BLOCK_Y : BLOCK_Y2
    const count = ri(rng, 2, 5)
    const qPos  = ri(rng, 0, count - 1)
    for (let i = 0; i < count; i++) {
      const bx = cx + i * TILE
      if (i === qPos && rng() > 0.35) {
        qBlocks.push({ id: qIdRef.v++, x: bx, y, reveals: REVEALS[revIdxRef.v++ % REVEALS.length] })
      } else {
        brickBlocks.push({ x: bx, y })
      }
    }
  }
}

function genLevel1(seed: number): LevelData {
  const rng     = makeRng(seed)
  const WORLD_W = 3200 + ri(rng, 0, 600)
  const STAIR_X = WORLD_W - 480
  const GOAL_X  = WORLD_W - 180

  // Pit
  const pitX = 1100 + ri(rng, 0, 500)
  const pitW = 128 + ri(rng, 0, 96)
  const floorSegs = [
    { x: 0,          w: pitX },
    { x: pitX + pitW, w: WORLD_W - (pitX + pitW) },
  ]

  // Pipes
  const pipes: PipeDef[] = []
  const piranhaXs: number[] = []
  const pipeXCandidates = [460, 780, pitX - 220, pitX + pitW + 220, pitX + pitW + 520, WORLD_W - 820]
  for (const px of pipeXCandidates) {
    if (px < 80 || px > WORLD_W - 100) continue
    if (px > pitX - 80 && px < pitX + pitW + 80) continue
    const h = rc(rng, [64, 80, 96] as const)
    pipes.push({ x: px, y: FLOOR_Y - h / 2, h, pipeTopY: FLOOR_Y - h })
    if (rng() > 0.45) piranhaXs.push(px)
  }

  // Floating blocks
  const brickBlocks: Array<{x:number;y:number}> = []
  const qBlocks: QBlock[] = []
  const qIdRef = { v: 1 }; const revIdxRef = { v: 0 }
  const clusterXs = [280, 580, 880, 1500, 1850, 2200, 2550, 2900]
  buildBlocks(rng, clusterXs, STAIR_X, pitX, pitW, qBlocks, brickBlocks, qIdRef, revIdxRef)

  // Coins (floating above blocks / in open spaces)
  const coins: CoinDef[] = []
  let cId = 1
  for (let x = 200; x < STAIR_X - 80; x += ri(rng, 200, 320)) {
    if (pipes.some(p => Math.abs(p.x - x) < 50)) continue
    if (x > pitX - 30 && x < pitX + pitW + 30) continue
    coins.push({ id: cId++, x, y: BLOCK_Y - 48 })
  }

  // Enemies on ground
  const enemies: EnemyDef[] = []
  for (let x = 280; x < STAIR_X - 200; x += ri(rng, 280, 460)) {
    if (pipes.some(p => Math.abs(p.x - x) < 90)) continue
    if (x > pitX - 100 && x < pitX + pitW + 100) continue
    const type   = rc(rng, ['goomba', 'goomba', 'goomba', 'koopa', 'paratroopa'] as const)
    const spread = ri(rng, 80, 160)
    const ey     = type === 'koopa' || type === 'paratroopa' ? FLOOR_Y - 22 : FLOOR_Y - 16
    enemies.push({ type, x, y: ey, left: x - spread, right: x + spread })
  }
  enemies.push({ type: 'billblaster', x: STAIR_X - 300, y: FLOOR_Y - 48, left: 0, right: 0, dir: 1, interval: 3.5 })
  enemies.push({ type: 'billblaster', x: STAIR_X - 80,  y: FLOOR_Y - 48, left: 0, right: 0, dir: 1, interval: 4.8 })

  // Background decorations
  const decorations: LevelData['decorations'] = []
  const bushSrcs = [
    '/SMB_Green_Horsetail_Tall.png', '/SMB_Green_Horsetail_Short.png',
    '/SMB_White_Horsetail_Tall.png', '/SMB_White_Horsetail_Short.png',
  ] as const
  for (let x = 100; x < WORLD_W - 200; x += ri(rng, 220, 380)) {
    const src    = rc(rng, bushSrcs)
    const isTall = src.includes('Tall')
    decorations.push({ x, y: FLOOR_TOP - (isTall ? 24 : 12), src, w: isTall ? 32 : 24, h: isTall ? 48 : 32 })
  }
  for (let x = 300; x < WORLD_W; x += ri(rng, 500, 800)) {
    decorations.push({ x, y: 140 + ri(rng, 0, 80), src: '/SMB_Sprite_Island_(Ground).png', w: 80, h: 40 })
  }

  return {
    theme: 'overworld', bg: '#5c94fc', worldW: WORLD_W,
    floorSrc: '/SMB_Ground.png', brickSrc: '/SMB_Brick_Block_Sprite.png',
    coinSrc: '/SMB1_Sprite_Coin.gif', qBlockSrc: '/SMB_Question_Block.gif',
    floorSegs, pipes, brickBlocks, qBlocks, coins, enemies, decorations,
    piranhaXs, stairX: STAIR_X, goalX: GOAL_X,
  }
}

function genLevel2(seed: number): LevelData {
  const rng     = makeRng(seed + 99991)
  const WORLD_W = 3800
  const STAIR_X = WORLD_W - 480
  const GOAL_X  = WORLD_W - 180
  const floorSegs = [{ x: 0, w: WORLD_W }]

  // Pipes
  const pipes: PipeDef[] = []
  const piranhaXs: number[] = []
  for (let x = 600; x < STAIR_X - 200; x += ri(rng, 450, 650)) {
    const h = 64
    pipes.push({ x, y: FLOOR_Y - h / 2, h, pipeTopY: FLOOR_Y - h })
    if (rng() > 0.4) piranhaXs.push(x)
  }

  // Floating brick rows
  const brickBlocks: Array<{x:number;y:number}> = []
  const qBlocks: QBlock[] = []
  const qIdRef = { v: 1 }; const revIdxRef = { v: 0 }
  for (let cx = 200; cx < STAIR_X - 200; cx += ri(rng, 250, 420)) {
    if (pipes.some(p => Math.abs(p.x - cx) < 80)) continue
    const y     = rc(rng, [BLOCK_Y, BLOCK_Y2, BLOCK_Y + 64] as const)
    const count = ri(rng, 3, 6)
    const qPos  = ri(rng, 1, count - 2)
    for (let i = 0; i < count; i++) {
      const bx = cx + i * TILE
      if (i === qPos && rng() > 0.4) {
        qBlocks.push({ id: qIdRef.v++, x: bx, y, reveals: REVEALS[revIdxRef.v++ % REVEALS.length] })
      } else {
        brickBlocks.push({ x: bx, y })
      }
    }
  }

  // Enemies
  const enemies: EnemyDef[] = []
  for (let x = 300; x < STAIR_X - 200; x += ri(rng, 300, 500)) {
    if (pipes.some(p => Math.abs(p.x - x) < 90)) continue
    const type   = rc(rng, ['goomba', 'goomba', 'buzzy', 'koopa'] as const)
    const spread = ri(rng, 80, 160)
    const ey     = type === 'koopa' ? FLOOR_Y - 22 : FLOOR_Y - 16
    const src    = type === 'goomba' ? '/GoombaSMBGrey.gif'
                 : type === 'koopa'  ? '/SMB_NES_Blue_Koopa_Troopa_Walking.gif'
                 : '/BuzzyBeetleSMBUnderground.gif'
    enemies.push({ type, x, y: ey, left: x - spread, right: x + spread, src })
  }
  for (let x = 2000; x < STAIR_X - 100; x += ri(rng, 400, 600)) {
    enemies.push({ type: 'billblaster', x, y: FLOOR_Y - 48, left: 0, right: 0, dir: rng() > 0.5 ? 1 : -1, interval: 3 + rng() * 2 })
  }

  // Coins
  const coins: CoinDef[] = []
  let cId = 1
  for (let x = 200; x < STAIR_X; x += ri(rng, 200, 350)) {
    coins.push({ id: cId++, x, y: BLOCK_Y - 48 })
  }

  return {
    theme: 'underground', bg: '#1a1a2e', worldW: WORLD_W,
    floorSrc: '/SMB_Ground_Underground.png', brickSrc: '/SMB_Underground_Brick_Block.png',
    coinSrc: '/SMB_CoinUnderground.gif', qBlockSrc: '/SMB_QuestionBlockUndergroundAnim.gif',
    floorSegs, pipes, brickBlocks, qBlocks, coins, enemies, decorations: [],
    piranhaXs, stairX: STAIR_X, goalX: GOAL_X,
  }
}

function genLevel3(seed: number): LevelData {
  const rng     = makeRng(seed + 77777)
  const WORLD_W = 3000
  const STAIR_X = WORLD_W - 450
  const GOAL_X  = WORLD_W - 180
  const floorSegs = [{ x: 0, w: WORLD_W }]

  // Pipes (gray)
  const pipes: PipeDef[] = []
  const piranhaXs: number[] = []
  for (let x = 500; x < STAIR_X - 200; x += ri(rng, 500, 700)) {
    const h = 64
    pipes.push({ x, y: FLOOR_Y - h / 2, h, pipeTopY: FLOOR_Y - h, src: '/Warp_Pipe_Gray_SMB.png' })
    if (rng() > 0.4) piranhaXs.push(x)
  }

  // Hard block platforms
  const brickBlocks: Array<{x:number;y:number}> = []
  const qBlocks: QBlock[] = []
  const qIdRef = { v: 1 }; const revIdxRef = { v: 0 }
  for (let cx = 200; cx < STAIR_X - 200; cx += ri(rng, 300, 450)) {
    if (pipes.some(p => Math.abs(p.x - cx) < 80)) continue
    const y     = rc(rng, [BLOCK_Y, BLOCK_Y2] as const)
    const count = ri(rng, 3, 5)
    const qPos  = ri(rng, 0, count - 1)
    for (let i = 0; i < count; i++) {
      const bx = cx + i * TILE
      if (i === qPos && rng() > 0.4) {
        qBlocks.push({ id: qIdRef.v++, x: bx, y, reveals: REVEALS[revIdxRef.v++ % REVEALS.length] })
      } else {
        brickBlocks.push({ x: bx, y })
      }
    }
  }

  // Enemies
  const enemies: EnemyDef[] = []
  for (let x = 280; x < STAIR_X - 300; x += ri(rng, 250, 420)) {
    if (pipes.some(p => Math.abs(p.x - x) < 90)) continue
    const type   = rc(rng, ['goomba', 'koopa', 'buzzy', 'hammerbro'] as const)
    const spread = ri(rng, 80, 160)
    const ey     = type === 'koopa' || type === 'hammerbro' ? FLOOR_Y - 22 : FLOOR_Y - 16
    const src    = type === 'goomba' ? '/SMBBlueGoomba.gif'
                 : type === 'buzzy'  ? '/SMB_Buzzy_Beetle_Castle_Sprite.gif'
                 : undefined
    enemies.push({ type, x, y: ey, left: x - spread, right: x + spread, src })
  }
  for (let x = 500; x < STAIR_X - 300; x += ri(rng, 400, 600)) {
    enemies.push({ type: 'podoboo', x, y: FLOOR_Y - 10, left: 0, right: 0 })
  }
  enemies.push({ type: 'billblaster', x: STAIR_X - 500, y: FLOOR_Y - 48, left: 0, right: 0, dir:  1, interval: 3.0 })
  enemies.push({ type: 'billblaster', x: STAIR_X - 280, y: FLOOR_Y - 48, left: 0, right: 0, dir: -1, interval: 3.8 })
  enemies.push({ type: 'bowser', x: WORLD_W - 320, y: FLOOR_Y - 40, left: WORLD_W - 420, right: WORLD_W - 240 })

  // Coins
  const coins: CoinDef[] = []
  let cId = 1
  for (let x = 200; x < STAIR_X; x += ri(rng, 200, 320)) {
    coins.push({ id: cId++, x, y: BLOCK_Y - 40 })
  }

  // Castle fortress decorations
  const decorations: LevelData['decorations'] = []
  for (let x = 400; x < WORLD_W - 300; x += ri(rng, 500, 700)) {
    decorations.push({ x, y: 350, src: '/LargeFortressSMB.png', w: 96, h: 120 })
  }

  return {
    theme: 'castle', bg: '#0a0a0f', worldW: WORLD_W,
    floorSrc: '/SMB_Ground_Castle.png', brickSrc: '/SMB_Hard_Block_Sprite.png',
    coinSrc: '/SMB_CoinCastle.gif', qBlockSrc: '/SMB_QuestionBlockCastleAnim.gif',
    floorSegs, pipes, brickBlocks, qBlocks, coins, enemies, decorations,
    piranhaXs, stairX: STAIR_X, goalX: GOAL_X,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_NAME:  Record<1|2|3, string> = { 1: 'WORLD 1-1', 2: 'WORLD 1-2', 3: 'WORLD 1-3' }
const LEVEL_THEME: Record<1|2|3, string> = { 1: 'OVERWORLD', 2: 'UNDERGROUND', 3: 'CASTLE' }
function Heart({ filled }: { filled: boolean }) {
  return <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>♥</span>
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [level,          setLevel]          = useState<1|2|3>(1)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set())
  const [spawnedReveals, setSpawnedReveals] = useState<SpawnedReveal[]>([])
  const [hasMushroom,    setHasMushroom]    = useState(false)
  const [hasFireFlower,  setHasFireFlower]  = useState(false)
  const [hasStar,        setHasStar]        = useState(false)

  const baseSeed = useRef(Date.now())
  const layout = useMemo<LevelData>(() => {
    const seed = baseSeed.current + level * 10000 + gameKey * 1000000
    if (level === 1) return genLevel1(seed)
    if (level === 2) return genLevel2(seed)
    return genLevel3(seed)
  }, [level, gameKey])

  useEffect(() => {
    gameEvents.onPlayerHurt = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameEvents.onEnemyKill   = (pts: number) => setScore(s => s + pts)
    gameEvents.onMushroomGet = () => { playerConfig.maxJumps = 2; playerConfig.isBig = true; setHasMushroom(true); setScore(s => s + 500) }
    gameEvents.onFireFlower  = () => { playerConfig.canFire = true; setHasFireFlower(true); setScore(s => s + 500) }
    gameEvents.onStar = () => {
      playerConfig.isStarActive = true; playerConfig.starTimer = 8.0
      setHasStar(true); setScore(s => s + 1000)
      setTimeout(() => setHasStar(false), 8000)
    }
    gameEvents.onOneUp       = () => { setLives(l => Math.min(l + 1, 9)); setScore(s => s + 200) }
    gameEvents.onGoalReached = () => { setScore(s => s + 2000); setGameState(level < 3 ? 'levelclear' : 'win') }
    return () => {
      gameEvents.onPlayerHurt = null; gameEvents.onEnemyKill = null
      gameEvents.onMushroomGet = null; gameEvents.onFireFlower = null
      gameEvents.onStar = null; gameEvents.onOneUp = null; gameEvents.onGoalReached = null
    }
  }, [gameKey, level])

  const handleCoinCollect = useCallback((_eid: EntityId, coinId: number) => {
    setCollectedCoins(prev => new Set([...prev, coinId])); setScore(s => s + 10)
  }, [])
  const handleRevealCoinCollect = useCallback((_eid: EntityId, revealId: number) => {
    setSpawnedReveals(prev => prev.filter(r => r.id !== revealId)); setScore(s => s + 10)
  }, [])
  const handleReveal = useCallback((blockId: number, type: RevealType, bx: number, by: number) => {
    setRevealedBlocks(prev => new Set([...prev, blockId]))
    const revealId = blockId + 1000
    setSpawnedReveals(prev => [...prev.filter(r => r.id !== revealId), { id: revealId, type, x: bx, y: by - 50 }])
  }, [])

  function startLevel(lv: 1|2|3) {
    playerConfig.maxJumps = 1; playerConfig.isBig = false; playerConfig.canFire = false
    playerConfig.isStarActive = false; playerConfig.starTimer = 0
    playerConfig.spawnX = 80; playerConfig.spawnY = FLOOR_TOP - 60
    setLevel(lv); setCollectedCoins(new Set()); setRevealedBlocks(new Set())
    setSpawnedReveals([]); setHasMushroom(false); setHasFireFlower(false); setHasStar(false)
    setGameState('playing'); setGameKey(k => k + 1)
  }
  const restart   = () => { setScore(0); setLives(MAX_LIVES); startLevel(1) }
  const nextLevel = () => startLevel((level + 1) as 1|2|3)

  const { bg, worldW } = layout

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ─────────────────────────────────────────────────────────────── */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center', padding: '7px 18px',
        background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: Math.min(lives, 9) }, (_, i) => <Heart key={i} filled={i < lives} />)}
          {hasMushroom   && <span style={{ marginLeft: 4, fontSize: 11, color: '#ef5350' }}>●</span>}
          {hasFireFlower && <span style={{ fontSize: 11, color: '#ff6f00' }}>🔥</span>}
          {hasStar       && <span style={{ fontSize: 11, color: '#ffd600' }}>★</span>}
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(6, '0')}
          </span>
          <span style={{ fontSize: 10, color: '#546e7a' }}>
            ●{collectedCoins.size}/{layout.coins.length} &nbsp; {LEVEL_NAME[level]}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#455a64', letterSpacing: 1 }}>
          {LEVEL_THEME[level]}
        </div>
      </div>

      {/* ── Game canvas ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={1000}>
          <World background={bg}>
            <Camera2D
              followEntity="player" smoothing={0.88} background={bg}
              followOffsetY={-150}
              bounds={{ x: 0, y: -H, width: worldW, height: FLOOR_Y + Math.round(H * 1.5) }}
            />
            <Player x={80} y={FLOOR_TOP - 60} />

            {/* Boundary walls */}
            <Ground key="wall-l" x={-10}        y={300} width={20} height={800} color={bg} />
            <Ground key="wall-r" x={worldW + 10} y={300} width={20} height={800} color={bg} />

            {/* ── Floor (one wide entity per section, src image) ────────────── */}
            {layout.floorSegs.map(({ x, w }, i) => (
              <Ground key={`floor-${i}`} x={x + w / 2} y={FLOOR_Y} width={w} height={FLOOR_H} src={layout.floorSrc} tileX />
            ))}

            {/* ── Underground ceiling ──────────────────────────────────────── */}
            {layout.theme === 'underground' && (
              <Ground key="ceiling" x={worldW / 2} y={44} width={worldW} height={TILE} src={layout.brickSrc} tileX />
            )}

            {/* ── Background decorations (no physics) ──────────────────────── */}
            {layout.decorations.map((d, i) => (
              <Entity key={`deco-${i}`}>
                <Transform x={d.x} y={d.y} />
                <Sprite src={d.src} width={d.w} height={d.h} zIndex={0} />
              </Entity>
            ))}

            {/* ── Warp pipes ───────────────────────────────────────────────── */}
            {layout.pipes.map((p, i) => (
              <WarpPipe key={`pipe-${i}`} x={p.x} y={p.y} height={p.h} src={p.src} />
            ))}

            {/* ── Piranha plants ───────────────────────────────────────────── */}
            {layout.piranhaXs.map((px, i) => {
              const pipe = layout.pipes.find(p => p.x === px)
              if (!pipe) return null
              const plantSrc = layout.theme === 'underground' ? '/SMB_Piranha_Plant_Underground_Sprite.png' : undefined
              return <PiranhaPlant key={`piranha-${i}`} x={px} pipeTopY={pipe.pipeTopY} src={plantSrc} />
            })}

            {/* ── Floating brick blocks ────────────────────────────────────── */}
            {layout.brickBlocks.map((b, i) =>
              layout.theme === 'overworld'
                ? <BrickBlock key={`brick-${i}`} x={b.x} y={b.y} />
                : <Ground key={`brick-${i}`} x={b.x} y={b.y} width={TILE} height={TILE} src={layout.brickSrc} />
            )}

            {/* ── Question blocks ──────────────────────────────────────────── */}
            {layout.qBlocks.filter(b => !revealedBlocks.has(b.id)).map(b => (
              <QuestionBlock
                key={b.id} x={b.x} y={b.y} reveals={b.reveals} src={layout.qBlockSrc}
                onReveal={() => handleReveal(b.id, b.reveals, b.x, b.y)}
              />
            ))}

            {/* ── Enemies ──────────────────────────────────────────────────── */}
            {layout.enemies.map((e, i) => {
              switch (e.type) {
                case 'goomba':      return <Goomba         key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} src={e.src} />
                case 'koopa':       return <KoopaTroopa     key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} src={e.src} />
                case 'paratroopa':  return <KoopaParatroopa key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} />
                case 'buzzy':       return <BuzzyBeetle     key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} src={e.src} />
                case 'billblaster': return <BillBlaster     key={i} x={e.x} y={e.y} dir={(e.dir ?? 1) as 1 | -1} fireInterval={e.interval ?? 3.5} />
                case 'hammerbro':   return <HammerBro       key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} />
                case 'podoboo':     return <Podoboo         key={i} x={e.x} baseY={e.y} />
                case 'bowser':      return <Bowser          key={i} x={e.x} y={e.y} patrolLeft={e.left} patrolRight={e.right} />
                default: return null
              }
            })}

            {/* ── Coins ────────────────────────────────────────────────────── */}
            {layout.coins.filter(c => !collectedCoins.has(c.id)).map(c => (
              <Coin key={c.id} x={c.x} y={c.y} src={layout.coinSrc}
                onCollect={eid => handleCoinCollect(eid, c.id)} />
            ))}

            {/* ── Staircase — 8 ascending columns of brick tiles ───────────── */}
            {Array.from({ length: 8 }, (_, col) =>
              Array.from({ length: col + 1 }, (_, row) => (
                <Ground
                  key={`stair-${col}-${row}`}
                  x={layout.stairX + col * TILE + TILE / 2}
                  y={FLOOR_TOP - row * TILE - TILE / 2}
                  width={TILE} height={TILE}
                  src={layout.brickSrc}
                />
              ))
            )}

            {/* ── Castle-specific: lava + Bowser bridge ────────────────────── */}
            {layout.theme === 'castle' && <>
              <Entity>
                <Transform x={worldW / 2} y={FLOOR_TOP + 10} />
                <Sprite src="/SMB_Sprite_Lava.png" width={worldW} height={24} zIndex={2} />
              </Entity>
              <Entity>
                <Transform x={worldW - 260} y={FLOOR_TOP + 10} />
                <Sprite src="/SMB_Bowser_Bridge.png" width={240} height={32} zIndex={3} />
              </Entity>
            </>}

            {/* ── Goal flag ────────────────────────────────────────────────── */}
            <GoalFlag key="goal" x={layout.goalX} y={FLOOR_TOP - 80} />

            {/* ── Spawned reveals (mushrooms, flowers, stars from ? blocks) ── */}
            {spawnedReveals.map(r => {
              if (r.type === 'mushroom')   return <Mushroom      key={r.id} x={r.x} y={r.y} />
              if (r.type === 'fireFlower') return <FireFlower    key={r.id} x={r.x} y={r.y} />
              if (r.type === 'star')       return <StarItem      key={r.id} x={r.x} y={r.y} />
              if (r.type === 'oneUp')      return <OneUpMushroom key={r.id} x={r.x} y={r.y} />
              return <Coin key={r.id} x={r.x} y={r.y} onCollect={eid => handleRevealCoinCollect(eid, r.id)} />
            })}

          </World>
        </Game>

        {/* ── Level Clear overlay ─────────────────────────────────────────── */}
        {gameState === 'levelclear' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4caf50', marginBottom: 8 }}>LEVEL CLEAR</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>{LEVEL_NAME[level]}</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong></p>
              <button onClick={nextLevel} style={btnStyle}>Next Level →</button>
            </div>
          </div>
        )}

        {/* ── Win overlay ─────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            {[{ top: '10%', left: '8%' }, { top: '15%', right: '10%' }, { top: '60%', left: '5%' },
              { top: '55%', right: '8%' }, { bottom: '20%', left: '12%' }, { bottom: '15%', right: '12%' },
            ].map((pos, i) => (
              <img key={i} src="/SMB_Sprite_Firework.gif" width={40} height={40} style={{ position: 'absolute', ...pos, opacity: 0.9 }} />
            ))}
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd700', marginBottom: 8 }}>BOWSER DEFEATED</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>YOU WIN!</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Final Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ───────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>GAME OVER</p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>TRY AGAIN</p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong></p>
              <button onClick={restart} style={btnStyle}>Restart</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>A/D · ←→ move &nbsp;·&nbsp; W/↑/Space jump &nbsp;·&nbsp; X/Z fire (after flower) &nbsp;·&nbsp; stomp enemies &nbsp;·&nbsp; defeat Bowser on World 3</span>
        <span style={{ color: '#263238' }}>Cubeforge</span>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(4px)',
}
const cardStyle: React.CSSProperties = {
  textAlign: 'center', fontFamily: '"Courier New", monospace',
  padding: '36px 48px', background: '#0d0f1a',
  border: '1px solid #1e2535', borderRadius: 12,
}
const btnStyle: React.CSSProperties = {
  marginTop: 24, padding: '10px 32px', background: '#ffd700',
  color: '#0a0a0f', border: 'none', borderRadius: 6,
  fontFamily: '"Courier New", monospace', fontSize: 13,
  fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
}
