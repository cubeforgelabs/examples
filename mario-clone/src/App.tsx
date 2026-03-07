import { useState, useEffect, useCallback } from 'react'
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

// ─── Preload all assets at module level ───────────────────────────────────────
const ASSETS = [
  '/ClassicNES_SMB_Small_Mario_Sprite.png',
  '/ClassicNES_SMB_Super_Mario_Sprite.png',
  '/SMB_Fire_Mario_Sprite.png',
  '/Goomba_SMB.png',
  '/SMB_Goomba_Sprite.gif',
  '/GoombaSMBGrey.gif',
  '/SMBBlueGoomba.gif',
  '/SMB_Green_Koopa_Troopa_Sprite.png',
  '/SMB_NES_Blue_Koopa_Troopa_Walking.gif',
  '/KoopaParatroopaGreenDark.gif',
  '/SMB_Red_Koopa_Troopa.gif',
  '/Buzzy_Beetle_SMB.png',
  '/BuzzyBeetleSMBUnderground.gif',
  '/SMB_Buzzy_Beetle_Castle_Sprite.gif',
  '/SMB_Sprite_Piranha_Plant.png',
  '/SMB_Piranha_Plant_Underground_Sprite.png',
  '/Podoboo_Sprite_SMB.png',
  '/SMB_Sprite_Coin.png',
  '/SMB1_Sprite_Coin.gif',
  '/SMB_CoinUnderground.gif',
  '/SMB_CoinCastle.gif',
  '/SMB_Qblock.png',
  '/SMB_Question_Block.gif',
  '/SMB_QuestionBlockUndergroundAnim.gif',
  '/SMB_QuestionBlockCastleAnim.gif',
  '/SMB1_Empty_Block.png',
  '/SMB_Brick_Block_Sprite.png',
  '/SMB_Underground_Brick_Block.png',
  '/SMB_Castle_Brick_Block.png',
  '/SMB_Supermushroom.png',
  '/SMB_Sprite_Fire_Flower.png',
  '/Starman.gif',
  '/SMB_Sprite_Super_Star.png',
  '/SMB_Sprite_1UP.png',
  '/Warp_Pipe_SMB.png',
  '/Warp_Pipe_Orange_SMB.png',
  '/Warp_Pipe_Gray_SMB.png',
  '/Bill_Blaster_Sprite_SMB.png',
  '/Bullet_Bill_Super_Mario_Bros.png',
  '/SMB_Hammer_Bro_Sprite.png',
  '/SMB_Sprite_Axe.png',
  '/SMB_Bowser_Sprite.png',
  '/SMBBowsersFlame.gif',
  '/SMB_Goal_Pole.png',
  '/SMBCastle.png',
  '/LargeFortressSMB.png',
  '/SMB_Princess_Toadstool_Sprite.png',
  '/SMBFireBall.gif',
  '/SMB_Ground.png',
  '/SMB_Ground_Underground.png',
  '/SMB_Ground_Castle.png',
  '/SMBPlatform.png',
  '/SMB_Mushroom_Platform.png',
  '/SMB_Hard_Block_Sprite.png',
  '/SMB_Underground_Hard_Block.png',
  '/SMB_Green_Horsetail_Short.png',
  '/SMB_Green_Horsetail_Tall.png',
  '/SMB_White_Horsetail_Short.png',
  '/SMB_White_Horsetail_Tall.png',
  '/SMB_Sprite_Island_(Ground).png',
  '/SMB_Sprite_Island_(Gray).png',
  '/SMB_Sprite_Lava.png',
  '/SMB_Bowser_Bridge.png',
  '/SMB_Sprite_Firework.gif',
]
ASSETS.forEach(preloadImage)

// ─── Constants ────────────────────────────────────────────────────────────────
const W         = 800
const H         = 560
const MAX_LIVES = 3

// ─── Level configs ────────────────────────────────────────────────────────────
const LEVELS = [1, 2, 3] as const
type Level = typeof LEVELS[number]

const LEVEL_BG: Record<Level, string>     = { 1: '#5c94fc', 2: '#1a1a2e', 3: '#0a0a0f' }
const LEVEL_WORLD_W: Record<Level, number> = { 1: 3600, 2: 3800, 3: 3000 }
const LEVEL_FLOOR_Y: Record<Level, number> = { 1: 506,  2: 506,  3: 506  }
const LEVEL_NAME: Record<Level, string>    = { 1: 'WORLD 1-1', 2: 'WORLD 1-2', 3: 'WORLD 1-3' }
const LEVEL_THEME: Record<Level, string>   = { 1: 'OVERWORLD', 2: 'UNDERGROUND', 3: 'CASTLE' }

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'playing' | 'gameover' | 'win' | 'levelclear'

type RevealType = 'coin' | 'mushroom' | 'fireFlower' | 'star' | 'oneUp'
interface BlockDef { id: number; x: number; y: number; reveals: RevealType }
interface SpawnedReveal { id: number; type: RevealType; x: number; y: number }

// ─── Level layouts ────────────────────────────────────────────────────────────

// ── Level 1: Overworld ────────────────────────────────────────────────────────
const L1_COINS = [
  { id:  1, x:  200, y: 420 }, { id:  2, x:  340, y: 340 },
  { id:  3, x:  500, y: 260 }, { id:  4, x:  660, y: 380 },
  { id:  5, x:  840, y: 310 }, { id:  6, x: 1040, y: 240 },
  { id:  7, x: 1220, y: 380 }, { id:  8, x: 1440, y: 290 },
  { id:  9, x: 1680, y: 220 }, { id: 10, x: 1900, y: 360 },
  { id: 11, x: 2140, y: 280 }, { id: 12, x: 2400, y: 410 },
  { id: 13, x: 2640, y: 320 }, { id: 14, x: 2900, y: 240 },
  { id: 15, x: 3100, y: 390 },
]
const L1_BLOCKS: BlockDef[] = [
  { id: 1, x:  400, y: 310, reveals: 'mushroom'   },
  { id: 2, x:  900, y: 260, reveals: 'coin'        },
  { id: 3, x: 1480, y: 250, reveals: 'fireFlower'  },
  { id: 4, x: 2000, y: 300, reveals: 'coin'        },
  { id: 5, x: 2700, y: 280, reveals: 'oneUp'       },
]

// ── Level 2: Underground ──────────────────────────────────────────────────────
const L2_COINS = [
  { id:  1, x:  240, y: 430 }, { id:  2, x:  380, y: 360 },
  { id:  3, x:  520, y: 280 }, { id:  4, x:  700, y: 420 },
  { id:  5, x:  880, y: 340 }, { id:  6, x: 1060, y: 260 },
  { id:  7, x: 1260, y: 400 }, { id:  8, x: 1480, y: 320 },
  { id:  9, x: 1700, y: 240 }, { id: 10, x: 1920, y: 380 },
  { id: 11, x: 2140, y: 300 }, { id: 12, x: 2360, y: 240 },
  { id: 13, x: 2600, y: 360 }, { id: 14, x: 2840, y: 280 },
  { id: 15, x: 3080, y: 420 }, { id: 16, x: 3300, y: 340 },
]
const L2_BLOCKS: BlockDef[] = [
  { id: 1, x:  600, y: 300, reveals: 'star'     },
  { id: 2, x: 1200, y: 260, reveals: 'coin'     },
  { id: 3, x: 1900, y: 280, reveals: 'oneUp'    },
  { id: 4, x: 2600, y: 300, reveals: 'mushroom' },
  { id: 5, x: 3200, y: 260, reveals: 'coin'     },
]

// ── Level 3: Castle ───────────────────────────────────────────────────────────
const L3_COINS = [
  { id:  1, x:  220, y: 420 }, { id:  2, x:  360, y: 350 },
  { id:  3, x:  520, y: 280 }, { id:  4, x:  700, y: 400 },
  { id:  5, x:  880, y: 330 }, { id:  6, x: 1080, y: 260 },
  { id:  7, x: 1280, y: 390 }, { id:  8, x: 1500, y: 300 },
  { id:  9, x: 1720, y: 240 }, { id: 10, x: 1960, y: 370 },
]
const L3_BLOCKS: BlockDef[] = [
  { id: 1, x:  560, y: 310, reveals: 'fireFlower' },
  { id: 2, x: 1300, y: 270, reveals: 'mushroom'   },
  { id: 3, x: 2000, y: 290, reveals: 'star'        },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Heart({ filled }: { filled: boolean }) {
  return <span style={{ color: filled ? '#ef5350' : '#37474f', fontSize: 18, lineHeight: 1 }}>♥</span>
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey,        setGameKey]        = useState(0)
  const [score,          setScore]          = useState(0)
  const [lives,          setLives]          = useState(MAX_LIVES)
  const [level,          setLevel]          = useState<Level>(1)
  const [gameState,      setGameState]      = useState<GameState>('playing')
  const [collectedCoins, setCollectedCoins] = useState<Set<number>>(new Set())
  const [revealedBlocks, setRevealedBlocks] = useState<Set<number>>(new Set())
  const [spawnedReveals, setSpawnedReveals] = useState<SpawnedReveal[]>([])
  const [hasMushroom,    setHasMushroom]    = useState(false)
  const [hasFireFlower,  setHasFireFlower]  = useState(false)
  const [hasStar,        setHasStar]        = useState(false)

  useEffect(() => {
    gameEvents.onPlayerHurt = () => {
      setLives(prev => {
        const next = prev - 1
        if (next <= 0) setGameState('gameover')
        return Math.max(0, next)
      })
    }
    gameEvents.onEnemyKill = (pts: number) => setScore(s => s + pts)
    gameEvents.onMushroomGet = () => {
      playerConfig.maxJumps = 2
      playerConfig.isBig    = true
      setHasMushroom(true)
      setScore(s => s + 500)
    }
    gameEvents.onFireFlower = () => {
      playerConfig.canFire = true
      setHasFireFlower(true)
      setScore(s => s + 500)
    }
    gameEvents.onStar = () => {
      playerConfig.isStarActive = true
      playerConfig.starTimer    = 8.0
      setHasStar(true)
      setScore(s => s + 1000)
      setTimeout(() => setHasStar(false), 8000)
    }
    gameEvents.onOneUp = () => {
      setLives(l => Math.min(l + 1, 9))
      setScore(s => s + 200)
    }
    gameEvents.onGoalReached = () => {
      setScore(s => s + 2000)
      if (level < 3) {
        setGameState('levelclear')
      } else {
        setGameState('win')
      }
    }
    return () => {
      gameEvents.onPlayerHurt  = null
      gameEvents.onEnemyKill   = null
      gameEvents.onMushroomGet = null
      gameEvents.onFireFlower  = null
      gameEvents.onStar        = null
      gameEvents.onOneUp       = null
      gameEvents.onGoalReached = null
    }
  }, [gameKey, level])

  const handleCoinCollect = useCallback((_eid: EntityId, coinId: number) => {
    setCollectedCoins(prev => new Set([...prev, coinId]))
    setScore(s => s + 10)
  }, [])

  const handleRevealCoinCollect = useCallback((_eid: EntityId, revealId: number) => {
    setSpawnedReveals(prev => prev.filter(r => r.id !== revealId))
    setScore(s => s + 10)
  }, [])

  const handleReveal = useCallback((blockId: number, type: RevealType, bx: number, by: number) => {
    setRevealedBlocks(prev => new Set([...prev, blockId]))
    const revealId = blockId + 1000
    setSpawnedReveals(prev => [
      ...prev.filter(r => r.id !== revealId),
      { id: revealId, type, x: bx, y: by - 50 },
    ])
  }, [])

  function startLevel(lv: Level) {
    playerConfig.maxJumps     = 1
    playerConfig.isBig        = false
    playerConfig.canFire      = false
    playerConfig.isStarActive = false
    playerConfig.starTimer    = 0
    playerConfig.spawnX       = 80
    playerConfig.spawnY       = LEVEL_FLOOR_Y[lv] - 60
    setLevel(lv)
    setCollectedCoins(new Set())
    setRevealedBlocks(new Set())
    setSpawnedReveals([])
    setHasMushroom(false)
    setHasFireFlower(false)
    setHasStar(false)
    setGameState('playing')
    setGameKey(k => k + 1)
  }

  function restart() {
    setScore(0)
    setLives(MAX_LIVES)
    startLevel(1)
  }

  function nextLevel() {
    const next = (level + 1) as Level
    startLevel(next)
  }

  const floorY   = LEVEL_FLOOR_Y[level]
  const worldW   = LEVEL_WORLD_W[level]
  const bg       = LEVEL_BG[level]
  const coinDefs   = level === 1 ? L1_COINS  : level === 2 ? L2_COINS  : L3_COINS
  const totalCoins = coinDefs.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

      {/* ── HUD ──────────────────────────────────────────────────────────────── */}
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
        {/* Lives + powerup icons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: Math.min(lives, 9) }, (_, i) => <Heart key={i} filled={i < lives} />)}
          {hasMushroom   && <span style={{ marginLeft: 4, fontSize: 11, color: '#ef5350' }}>●</span>}
          {hasFireFlower && <span style={{ fontSize: 11, color: '#ff6f00' }}>🔥</span>}
          {hasStar       && <span style={{ fontSize: 11, color: '#ffd600' }}>★</span>}
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
            {String(score).padStart(6, '0')}
          </span>
          <span style={{ fontSize: 10, color: '#546e7a' }}>
            ●{collectedCoins.size}/{totalCoins} &nbsp; {LEVEL_NAME[level]}
          </span>
        </div>

        {/* Level theme */}
        <div style={{ textAlign: 'right', fontSize: 10, color: '#455a64', letterSpacing: 1 }}>
          {LEVEL_THEME[level]}
        </div>
      </div>

      {/* ── Game canvas ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <Game key={gameKey} width={W} height={H} gravity={1000}>
          <World background={bg}>
            <Camera2D
              followEntity="player"
              smoothing={0.88}
              background={bg}
              bounds={{ x: 0, y: -H, width: worldW, height: floorY + Math.round(H * 1.5) }}
            />
            <Player x={80} y={floorY - 60} />

            {/* ── Level 1: Overworld ────────────────────────────────────────── */}
            {level === 1 && <>
              {/* Background decorations (zIndex 0, no physics) */}
              <Entity><Transform x={150}  y={480} /><Sprite src="/SMB_Green_Horsetail_Tall.png"   width={32} height={48} zIndex={0} /></Entity>
              <Entity><Transform x={260}  y={490} /><Sprite src="/SMB_Green_Horsetail_Short.png"  width={24} height={32} zIndex={0} /></Entity>
              <Entity><Transform x={580}  y={480} /><Sprite src="/SMB_White_Horsetail_Tall.png"   width={32} height={48} zIndex={0} /></Entity>
              <Entity><Transform x={700}  y={490} /><Sprite src="/SMB_White_Horsetail_Short.png"  width={24} height={32} zIndex={0} /></Entity>
              <Entity><Transform x={950}  y={480} /><Sprite src="/SMB_Green_Horsetail_Tall.png"   width={32} height={48} zIndex={0} /></Entity>
              <Entity><Transform x={1300} y={480} /><Sprite src="/SMB_White_Horsetail_Short.png"  width={24} height={32} zIndex={0} /></Entity>
              <Entity><Transform x={1700} y={480} /><Sprite src="/SMB_Green_Horsetail_Tall.png"   width={32} height={48} zIndex={0} /></Entity>
              <Entity><Transform x={2250} y={480} /><Sprite src="/SMB_White_Horsetail_Tall.png"   width={32} height={48} zIndex={0} /></Entity>
              <Entity><Transform x={2700} y={480} /><Sprite src="/SMB_Green_Horsetail_Short.png"  width={24} height={32} zIndex={0} /></Entity>
              <Entity><Transform x={3050} y={480} /><Sprite src="/SMB_White_Horsetail_Tall.png"   width={32} height={48} zIndex={0} /></Entity>
              {/* Island/cloud platforms (decorative) */}
              <Entity><Transform x={400}  y={200} /><Sprite src="/SMB_Sprite_Island_(Ground).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={900}  y={160} /><Sprite src="/SMB_Sprite_Island_(Ground).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={1600} y={180} /><Sprite src="/SMB_Sprite_Island_(Ground).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={2400} y={150} /><Sprite src="/SMB_Sprite_Island_(Ground).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={3100} y={170} /><Sprite src="/SMB_Sprite_Island_(Ground).png" width={80} height={40} zIndex={0} /></Entity>
              {/* Mushroom platforms (decorative) */}
              <Entity><Transform x={680}  y={400} /><Sprite src="/SMB_Mushroom_Platform.png" width={64} height={28} zIndex={0} /></Entity>
              <Entity><Transform x={1400} y={360} /><Sprite src="/SMB_Mushroom_Platform.png" width={64} height={28} zIndex={0} /></Entity>
              <Entity><Transform x={2600} y={380} /><Sprite src="/SMB_Mushroom_Platform.png" width={64} height={28} zIndex={0} /></Entity>

              {/* Enemies */}
              <Goomba          x={320}  y={floorY - 16} patrolLeft={200}  patrolRight={450}  src="/SMB_Goomba_Sprite.gif" />
              <Goomba          x={700}  y={floorY - 16} patrolLeft={580}  patrolRight={840}  src="/SMB_Goomba_Sprite.gif" />
              <Goomba          x={1100} y={floorY - 16} patrolLeft={960}  patrolRight={1260} src="/SMB_Goomba_Sprite.gif" />
              <KoopaTroopa     x={520}  y={floorY - 22} patrolLeft={420}  patrolRight={650}  />
              <KoopaParatroopa x={860}  y={floorY - 22} patrolLeft={740}  patrolRight={1000} />
              <KoopaTroopa     x={1500} y={floorY - 22} patrolLeft={1380} patrolRight={1660} />
              <Goomba          x={520}  y={300}          patrolLeft={430}  patrolRight={640}  src="/SMB_Goomba_Sprite.gif" />
              <Goomba          x={1900} y={floorY - 16} patrolLeft={1800} patrolRight={2050} src="/SMB_Goomba_Sprite.gif" />
              <KoopaParatroopa x={2200} y={floorY - 22} patrolLeft={2060} patrolRight={2360} />
              <KoopaTroopa     x={2300} y={floorY - 22} patrolLeft={2160} patrolRight={2460} />
              <Goomba          x={2700} y={floorY - 16} patrolLeft={2580} patrolRight={2820} src="/SMB_Goomba_Sprite.gif" />
              <BillBlaster     x={3100} y={floorY - 48} dir={1} fireInterval={3.5} />
              <BillBlaster     x={3280} y={floorY - 48} dir={1} fireInterval={4.5} />

              {/* Piranha plant in pipe */}
              <PiranhaPlant x={760}  pipeTopY={floorY - 64} />
              <PiranhaPlant x={2400} pipeTopY={floorY - 64} />

              {/* Coins (animated) */}
              {L1_COINS.filter(c => !collectedCoins.has(c.id)).map(c => (
                <Coin key={c.id} x={c.x} y={c.y} src="/SMB1_Sprite_Coin.gif" onCollect={eid => handleCoinCollect(eid, c.id)} />
              ))}

              {/* Question blocks (animated) */}
              {L1_BLOCKS.filter(b => !revealedBlocks.has(b.id)).map(b => (
                <QuestionBlock key={b.id} x={b.x} y={b.y} reveals={b.reveals} src="/SMB_Question_Block.gif"
                  onReveal={() => handleReveal(b.id, b.reveals, b.x, b.y)} />
              ))}

              {/* Brick blocks */}
              <BrickBlock x={360}  y={310} />
              <BrickBlock x={440}  y={310} />
              <BrickBlock x={860}  y={260} />
              <BrickBlock x={940}  y={260} />
              <BrickBlock x={1380} y={280} />
              <BrickBlock x={1460} y={280} />
              <BrickBlock x={2080} y={300} />
              <BrickBlock x={2160} y={300} />
              <BrickBlock x={2800} y={260} />
              <BrickBlock x={2880} y={260} />

              {/* Warp pipes */}
              <WarpPipe x={760}  y={floorY - 32} height={64} />
              <WarpPipe x={1240} y={floorY - 48} height={80} />
              <WarpPipe x={2180} y={floorY - 32} height={64} />
              <WarpPipe x={2980} y={floorY - 48} height={80} src="/Warp_Pipe_Orange_SMB.png" />

              {/* Platforms — low */}
              <Ground key="l1a" x={220}  y={floorY - 50} width={120} height={18} color="#7a5c10" />
              <Ground key="l1b" x={460}  y={floorY - 76} width={110} height={18} color="#7a5c10" />
              <Ground key="l1c" x={680}  y={floorY - 50} width={120} height={18} color="#7a5c10" />
              {/* Platforms — mid */}
              <Ground key="l2a" x={320}  y={floorY - 146} width={110} height={18} color="#6b4f0e" />
              <Ground key="l2b" x={560}  y={floorY - 206} width={120} height={18} color="#6b4f0e" />
              {/* Platforms — high */}
              <Ground key="l3a" x={440}  y={floorY - 266} width={100} height={18} color="#5a3e1b" />

              <Ground key="c1a" x={860}  y={floorY - 66} width={130} height={18} color="#7a5c10" />
              <Ground key="c1b" x={1060} y={floorY - 106} width={120} height={18} color="#7a5c10" />
              <Ground key="c2a" x={960}  y={floorY - 176} width={120} height={18} color="#6b4f0e" />
              <Ground key="c2b" x={1160} y={floorY - 236} width={110} height={18} color="#6b4f0e" />
              <Ground key="c3a" x={1060} y={floorY - 296} width={100} height={18} color="#5a3e1b" />

              <Ground key="r1a" x={1420} y={floorY - 66} width={140} height={18} color="#7a5c10" />
              <Ground key="r1b" x={1640} y={floorY - 50} width={140} height={18} color="#7a5c10" />
              <Ground key="r2a" x={1520} y={floorY - 146} width={120} height={18} color="#6b4f0e" />
              <Ground key="r2b" x={1760} y={floorY - 206} width={110} height={18} color="#6b4f0e" />
              <Ground key="r3a" x={1640} y={floorY - 286} width={100} height={18} color="#5a3e1b" />

              <Ground key="rr1" x={2060} y={floorY - 66} width={130} height={18} color="#7a5c10" />
              <Ground key="rr2" x={2280} y={floorY - 116} width={120} height={18} color="#7a5c10" />
              <Ground key="rr3" x={2500} y={floorY - 66} width={120} height={18} color="#7a5c10" />
              <Ground key="rr4" x={2720} y={floorY - 116} width={110} height={18} color="#6b4f0e" />
              <Ground key="rr5" x={2900} y={floorY - 186} width={100} height={18} color="#5a3e1b" />

              {/* Floor — with pit at ~x 1800–2100 */}
              <Ground key="floor-l" x={900}           y={floorY} width={1800} height={28} color="#5a3e1b" />
              <Ground key="floor-r" x={2850}          y={floorY} width={1500} height={28} color="#5a3e1b" />

              {/* Walls */}
              <Ground key="wall-l" x={-10}         y={300} width={20}  height={800} color={bg} />
              <Ground key="wall-r" x={worldW + 10} y={300} width={20}  height={800} color={bg} />

              {/* Goal */}
              <GoalFlag key="goal" x={3440} y={floorY - 80} />
            </>}

            {/* ── Level 2: Underground ─────────────────────────────────────── */}
            {level === 2 && <>
              {/* Ceiling decoration */}
              <Ground key="ceil" x={worldW / 2} y={60} width={worldW} height={40} color="#263238" />

              {/* Background island formations (cave feel) */}
              <Entity><Transform x={500}  y={180} /><Sprite src="/SMB_Sprite_Island_(Gray).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={1200} y={150} /><Sprite src="/SMB_Sprite_Island_(Gray).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={2100} y={170} /><Sprite src="/SMB_Sprite_Island_(Gray).png" width={80} height={40} zIndex={0} /></Entity>
              <Entity><Transform x={3100} y={155} /><Sprite src="/SMB_Sprite_Island_(Gray).png" width={80} height={40} zIndex={0} /></Entity>

              {/* Enemies */}
              <Goomba      x={320}  y={floorY - 16} patrolLeft={200}  patrolRight={480}  src="/GoombaSMBGrey.gif" />
              <Goomba      x={700}  y={floorY - 16} patrolLeft={560}  patrolRight={880}  src="/GoombaSMBGrey.gif" />
              <BuzzyBeetle x={540}  y={floorY - 16} patrolLeft={420}  patrolRight={680}  src="/BuzzyBeetleSMBUnderground.gif" />
              <KoopaTroopa x={900}  y={floorY - 22} patrolLeft={780}  patrolRight={1040} src="/SMB_NES_Blue_Koopa_Troopa_Walking.gif" />
              <Goomba      x={1060} y={floorY - 16} patrolLeft={900}  patrolRight={1200} src="/GoombaSMBGrey.gif" />
              <BuzzyBeetle x={1380} y={floorY - 16} patrolLeft={1240} patrolRight={1560} src="/BuzzyBeetleSMBUnderground.gif" />
              <KoopaTroopa x={1580} y={floorY - 22} patrolLeft={1440} patrolRight={1720} src="/SMB_NES_Blue_Koopa_Troopa_Walking.gif" />
              <Goomba      x={1760} y={floorY - 16} patrolLeft={1600} patrolRight={1940} src="/GoombaSMBGrey.gif" />
              <BuzzyBeetle x={2100} y={floorY - 16} patrolLeft={1960} patrolRight={2240} src="/BuzzyBeetleSMBUnderground.gif" />
              <Goomba      x={2400} y={floorY - 16} patrolLeft={2280} patrolRight={2560} src="/GoombaSMBGrey.gif" />
              <BillBlaster x={2600} y={floorY - 48} dir={1}  fireInterval={3.0} />
              <BillBlaster x={3000} y={floorY - 48} dir={-1} fireInterval={3.5} />
              <BillBlaster x={3400} y={floorY - 48} dir={1}  fireInterval={4.0} />
              <PiranhaPlant x={860}  pipeTopY={floorY - 64} />
              <PiranhaPlant x={1580} pipeTopY={floorY - 64} />
              <PiranhaPlant x={2820} pipeTopY={floorY - 64} src="/SMB_Piranha_Plant_Underground_Sprite.png" />

              {/* Coins (underground animated) */}
              {L2_COINS.filter(c => !collectedCoins.has(c.id)).map(c => (
                <Coin key={c.id} x={c.x} y={c.y} src="/SMB_CoinUnderground.gif" onCollect={eid => handleCoinCollect(eid, c.id)} />
              ))}

              {/* Question blocks (underground animated) */}
              {L2_BLOCKS.filter(b => !revealedBlocks.has(b.id)).map(b => (
                <QuestionBlock key={b.id} x={b.x} y={b.y} reveals={b.reveals} src="/SMB_QuestionBlockUndergroundAnim.gif"
                  onReveal={() => handleReveal(b.id, b.reveals, b.x, b.y)} />
              ))}

              {/* Brick rows */}
              {[200, 240, 280, 320, 360].map(x => <BrickBlock key={`b1-${x}`} x={x} y={floorY - 160} />)}
              {[680, 720, 760, 800].map(x => <BrickBlock key={`b2-${x}`} x={x} y={floorY - 120} />)}
              {[1100, 1140, 1180, 1220, 1260].map(x => <BrickBlock key={`b3-${x}`} x={x} y={floorY - 170} />)}
              {[1560, 1600, 1640].map(x => <BrickBlock key={`b4-${x}`} x={x} y={floorY - 130} />)}
              {[1960, 2000, 2040, 2080].map(x => <BrickBlock key={`b5-${x}`} x={x} y={floorY - 160} />)}
              {[2300, 2340, 2380, 2420, 2460].map(x => <BrickBlock key={`b6-${x}`} x={x} y={floorY - 120} />)}
              {[3100, 3140, 3180, 3220].map(x => <BrickBlock key={`b7-${x}`} x={x} y={floorY - 170} />)}

              {/* Platforms */}
              <Ground key="p1" x={340}  y={floorY - 150} width={180} height={18} color="#37474f" />
              <Ground key="p2" x={740}  y={floorY - 110} width={160} height={18} color="#37474f" />
              <Ground key="p3" x={1160} y={floorY - 160} width={200} height={18} color="#37474f" />
              <Ground key="p4" x={1600} y={floorY - 120} width={160} height={18} color="#37474f" />
              <Ground key="p5" x={2020} y={floorY - 150} width={180} height={18} color="#37474f" />
              <Ground key="p6" x={2380} y={floorY - 110} width={200} height={18} color="#37474f" />
              <Ground key="p7" x={3160} y={floorY - 160} width={180} height={18} color="#37474f" />

              {/* Warp pipes */}
              <WarpPipe x={860}  y={floorY - 32} height={64} />
              <WarpPipe x={1580} y={floorY - 32} height={64} />
              <WarpPipe x={2820} y={floorY - 32} height={64} />

              {/* Floor */}
              <Ground key="floor" x={worldW / 2} y={floorY} width={worldW} height={28} color="#263238" />
              <Ground key="wall-l" x={-10}         y={300} width={20}  height={800} color={bg} />
              <Ground key="wall-r" x={worldW + 10} y={300} width={20}  height={800} color={bg} />

              {/* Goal */}
              <GoalFlag key="goal" x={worldW - 160} y={floorY - 80} />
            </>}

            {/* ── Level 3: Castle ──────────────────────────────────────────── */}
            {level === 3 && <>
              {/* Background fortress decoration */}
              <Entity><Transform x={400}  y={350} /><Sprite src="/LargeFortressSMB.png" width={96} height={120} zIndex={0} /></Entity>
              <Entity><Transform x={1200} y={350} /><Sprite src="/LargeFortressSMB.png" width={96} height={120} zIndex={0} /></Entity>
              <Entity><Transform x={2000} y={350} /><Sprite src="/LargeFortressSMB.png" width={96} height={120} zIndex={0} /></Entity>

              {/* Bowser's bridge near boss */}
              <Entity><Transform x={2640} y={floorY + 10} /><Sprite src="/SMB_Bowser_Bridge.png" width={240} height={32} zIndex={3} /></Entity>

              {/* Lava strip at floor level */}
              <Entity><Transform x={worldW / 2} y={floorY + 20} /><Sprite src="/SMB_Sprite_Lava.png" width={worldW} height={24} zIndex={2} /></Entity>

              {/* Enemies */}
              <Goomba      x={300}  y={floorY - 16} patrolLeft={180}  patrolRight={440}  src="/SMBBlueGoomba.gif" />
              <HammerBro   x={560}  y={floorY - 22} patrolLeft={460}  patrolRight={680} />
              <BuzzyBeetle x={700}  y={floorY - 16} patrolLeft={600}  patrolRight={820}  src="/SMB_Buzzy_Beetle_Castle_Sprite.gif" />
              <KoopaTroopa x={800}  y={floorY - 22} patrolLeft={680}  patrolRight={960} />
              <HammerBro   x={1100} y={floorY - 22} patrolLeft={980}  patrolRight={1220} />
              <BuzzyBeetle x={1240} y={floorY - 16} patrolLeft={1120} patrolRight={1380} src="/SMB_Buzzy_Beetle_Castle_Sprite.gif" />
              <Goomba      x={1340} y={floorY - 16} patrolLeft={1220} patrolRight={1500} src="/SMBBlueGoomba.gif" />
              <KoopaTroopa x={1620} y={floorY - 22} patrolLeft={1480} patrolRight={1780} />
              <HammerBro   x={1880} y={floorY - 22} patrolLeft={1760} patrolRight={2060} />
              <BillBlaster x={2120} y={floorY - 48} dir={1}  fireInterval={3.0} />
              <BillBlaster x={2400} y={floorY - 48} dir={-1} fireInterval={3.5} />
              <PiranhaPlant x={680}  pipeTopY={floorY - 64} />
              <PiranhaPlant x={1460} pipeTopY={floorY - 64} />
              {/* Podoboos rising from lava */}
              <Podoboo x={500}  baseY={floorY - 10} />
              <Podoboo x={900}  baseY={floorY - 10} />
              <Podoboo x={1300} baseY={floorY - 10} />
              <Podoboo x={1800} baseY={floorY - 10} />
              <Podoboo x={2200} baseY={floorY - 10} />
              {/* Bowser at the end */}
              <Bowser x={2720} y={floorY - 40} patrolLeft={2600} patrolRight={2840} />

              {/* Coins (castle animated) */}
              {L3_COINS.filter(c => !collectedCoins.has(c.id)).map(c => (
                <Coin key={c.id} x={c.x} y={c.y} src="/SMB_CoinCastle.gif" onCollect={eid => handleCoinCollect(eid, c.id)} />
              ))}

              {/* Question blocks (castle animated) */}
              {L3_BLOCKS.filter(b => !revealedBlocks.has(b.id)).map(b => (
                <QuestionBlock key={b.id} x={b.x} y={b.y} reveals={b.reveals} src="/SMB_QuestionBlockCastleAnim.gif"
                  onReveal={() => handleReveal(b.id, b.reveals, b.x, b.y)} />
              ))}

              {/* Brick platforms */}
              {[280, 320, 360, 400].map(x => <BrickBlock key={`b1-${x}`} x={x} y={floorY - 150} />)}
              {[700, 740, 780].map(x => <BrickBlock key={`b2-${x}`} x={x} y={floorY - 120} />)}
              {[1100, 1140, 1180, 1220].map(x => <BrickBlock key={`b3-${x}`} x={x} y={floorY - 170} />)}
              {[1500, 1540, 1580].map(x => <BrickBlock key={`b4-${x}`} x={x} y={floorY - 130} />)}
              {[1880, 1920, 1960, 2000].map(x => <BrickBlock key={`b5-${x}`} x={x} y={floorY - 160} />)}

              {/* Hard block platforms */}
              <Ground key="h1" x={440}  y={floorY - 150} width={160} height={18} src="/SMB_Hard_Block_Sprite.png" color="#455a64" />
              <Ground key="h2" x={860}  y={floorY - 110} width={140} height={18} src="/SMB_Hard_Block_Sprite.png" color="#455a64" />
              <Ground key="h3" x={1280} y={floorY - 160} width={180} height={18} src="/SMB_Hard_Block_Sprite.png" color="#455a64" />
              <Ground key="h4" x={1680} y={floorY - 120} width={140} height={18} src="/SMB_Hard_Block_Sprite.png" color="#455a64" />
              <Ground key="h5" x={2060} y={floorY - 150} width={160} height={18} src="/SMB_Hard_Block_Sprite.png" color="#455a64" />

              {/* Warp pipes */}
              <WarpPipe x={680}  y={floorY - 32} height={64} src="/Warp_Pipe_Gray_SMB.png" />
              <WarpPipe x={1460} y={floorY - 32} height={64} src="/Warp_Pipe_Gray_SMB.png" />

              {/* Floor */}
              <Ground key="floor" x={worldW / 2} y={floorY} width={worldW} height={28} color="#37474f" />
              <Ground key="wall-l" x={-10}         y={300} width={20}  height={800} color={bg} />
              <Ground key="wall-r" x={worldW + 10} y={300} width={20}  height={800} color={bg} />

              {/* Decorative castle in background */}
              <Ground key="bg-castle" x={2720} y={floorY - 80} width={200} height={140} color="#1c1c2e" />
            </>}

            {/* ── Spawned reveals (shared across all levels) ────────────────── */}
            {spawnedReveals.map(r => {
              if (r.type === 'mushroom')   return <Mushroom     key={r.id} x={r.x} y={r.y} />
              if (r.type === 'fireFlower') return <FireFlower   key={r.id} x={r.x} y={r.y} />
              if (r.type === 'star')       return <StarItem     key={r.id} x={r.x} y={r.y} />
              if (r.type === 'oneUp')      return <OneUpMushroom key={r.id} x={r.x} y={r.y} />
              return (
                <Coin key={r.id} x={r.x} y={r.y}
                  onCollect={eid => handleRevealCoinCollect(eid, r.id)} />
              )
            })}
          </World>
        </Game>

        {/* ── Level Clear overlay ──────────────────────────────────────────── */}
        {gameState === 'levelclear' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#4caf50', marginBottom: 8 }}>
                LEVEL CLEAR
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                {LEVEL_NAME[level]}
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong>
              </p>
              <button onClick={nextLevel} style={btnStyle}>Next Level →</button>
            </div>
          </div>
        )}

        {/* ── Win overlay ──────────────────────────────────────────────────── */}
        {gameState === 'win' && (
          <div style={overlayStyle}>
            {/* Fireworks scattered around overlay */}
            {[
              { top: '10%', left: '8%' }, { top: '15%', right: '10%' },
              { top: '60%', left: '5%' }, { top: '55%', right: '8%' },
              { bottom: '20%', left: '12%' }, { bottom: '15%', right: '12%' },
            ].map((pos, i) => (
              <img key={i} src="/SMB_Sprite_Firework.gif" width={40} height={40}
                style={{ position: 'absolute', ...pos, opacity: 0.9 }} />
            ))}
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ffd700', marginBottom: 8 }}>
                BOWSER DEFEATED
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                YOU WIN!
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Final Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Play Again</button>
            </div>
          </div>
        )}

        {/* ── Game Over overlay ─────────────────────────────────────────────── */}
        {gameState === 'gameover' && (
          <div style={overlayStyle}>
            <div style={cardStyle}>
              <p style={{ fontSize: 11, letterSpacing: 4, color: '#ef5350', marginBottom: 8 }}>
                GAME OVER
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: 3 }}>
                TRY AGAIN
              </p>
              <p style={{ fontSize: 13, color: '#90a4ae', margin: '12px 0 4px' }}>
                Score &nbsp;<strong style={{ color: '#ffd700' }}>{score}</strong>
              </p>
              <button onClick={restart} style={btnStyle}>Restart</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls hint ────────────────────────────────────────────────────── */}
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
