export interface VFile {
  name: string
  content: string
}

export interface Template {
  id: string
  label: string
  icon: string
  description: string
  files: VFile[]
}

export const TEMPLATES: Template[] = [
  // ── Platformer ──────────────────────────────────────────────────────────────
  {
    id: 'platformer',
    label: 'Platformer',
    icon: '🏃',
    description: 'Double jump, moving platforms, camera follow',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { Game, World, Camera2D, MovingPlatform, Checkpoint } from 'cubeforge'
import { Player } from './Player'
import { Platform } from './Platform'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={980}>
    <World background="#1a1a2e">
      <Camera2D followEntity="player" smoothing={0.85} />
      <Player x={100} y={300} />

      {/* Ground */}
      <Platform x={400} y={480} w={800} h={40} />

      {/* Platforms */}
      <Platform x={200} y={380} w={120} color="#37474f" />
      <Platform x={420} y={310} w={150} color="#4caf50" />
      <Platform x={640} y={240} w={130} color="#ff9800" />

      {/* Moving platform */}
      <MovingPlatform x1={100} y1={200} x2={350} y2={200} duration={3} color="#ab47bc" />

      {/* Checkpoint flag */}
      <Checkpoint x={420} y={286} />
    </World>
  </Game>
)
`,
      },
      {
        name: 'Player.tsx',
        content: `import { Entity, Transform, Sprite, RigidBody, BoxCollider, useEntity, usePlatformerController } from 'cubeforge'

export function Player({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={32} height={48} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={32} height={48} />
      <PlayerController />
    </Entity>
  )
}

function PlayerController() {
  const id = useEntity()
  usePlatformerController(id, { speed: 220, jumpForce: -520, maxJumps: 2 })
  return null
}
`,
      },
      {
        name: 'Platform.tsx',
        content: `import { Entity, Transform, Sprite, RigidBody, BoxCollider } from 'cubeforge'

export function Platform({ x, y, w = 200, h = 20, color = '#37474f' }: {
  x: number; y: number; w?: number; h?: number; color?: string
}) {
  return (
    <Entity tags={['ground']}>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color={color} />
      <RigidBody isStatic />
      <BoxCollider width={w} height={h} />
    </Entity>
  )
}
`,
      },
    ],
  },

  // ── Particles ─────────────────────────────────────────────────────────────
  {
    id: 'particles',
    label: 'Particles',
    icon: '✨',
    description: 'ParticleEmitter presets and custom effects',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { Game, World, Camera2D, Entity, Transform, ParticleEmitter, Text } from 'cubeforge'

// Showcase multiple particle presets side by side
function ParticleShowcase() {
  const presets = [
    { name: 'fire',     x: 100, color: '#ff6b35' },
    { name: 'smoke',    x: 250, color: '#90a4ae' },
    { name: 'sparkles', x: 400, color: '#ffd54f' },
  ] as const

  return (
    <>
      {presets.map(p => (
        <Entity key={p.name}>
          <Transform x={p.x} y={350} />
          <ParticleEmitter
            active
            preset={p.name}
            rate={30}
            particleLife={1.2}
            color={p.color}
          />
        </Entity>
      ))}

      {/* Custom fountain */}
      <Entity>
        <Transform x={550} y={400} />
        <ParticleEmitter
          active
          rate={40}
          speed={180}
          spread={0.6}
          angle={-Math.PI / 2}
          particleLife={1.5}
          particleSize={3}
          color="#4fc3f7"
          gravity={300}
        />
      </Entity>

      {/* Radial burst (click Space to burst) */}
      <Entity>
        <Transform x={700} y={250} />
        <ParticleEmitter
          active
          rate={5}
          speed={120}
          spread={Math.PI * 2}
          particleLife={0.8}
          particleSize={5}
          color="#e040fb"
          gravity={0}
        />
      </Entity>

      {/* Labels */}
      {['fire', 'smoke', 'sparkles', 'fountain', 'radial'].map((label, i) => (
        <Entity key={label}>
          <Transform x={100 + i * 150} y={440} />
          <Text text={label} fontSize={11} color="#546e7a" align="center" baseline="middle" />
        </Entity>
      ))}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#0d1117">
      <Camera2D x={400} y={250} />
      <ParticleShowcase />
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Physics Sandbox ────────────────────────────────────────────────────────
  {
    id: 'physics',
    label: 'Physics Sandbox',
    icon: '⚡',
    description: 'Rigid bodies, colliders, one-way platforms, bouncing',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import {
  Game, World, Camera2D, Entity, Transform, Sprite,
  RigidBody, BoxCollider, CircleCollider, Text
} from 'cubeforge'

function Box({ x, y, w, h, color }: {
  x: number; y: number; w: number; h: number; color: string
}) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color={color} />
      <RigidBody restitution={0.5} />
      <BoxCollider width={w} height={h} />
    </Entity>
  )
}

function Ball({ x, y, r, color }: {
  x: number; y: number; r: number; color: string
}) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={r * 2} height={r * 2} color={color} />
      <RigidBody restitution={0.8} />
      <CircleCollider radius={r} />
    </Entity>
  )
}

function Wall({ x, y, w, h, oneWay }: {
  x: number; y: number; w: number; h: number; oneWay?: boolean
}) {
  return (
    <Entity>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color={oneWay ? '#4caf50' : '#37474f'} />
      <RigidBody isStatic />
      <BoxCollider width={w} height={h} oneWay={oneWay} />
    </Entity>
  )
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={600}>
    <World background="#0d1117">
      <Camera2D x={400} y={250} />

      {/* Falling objects */}
      <Box x={200} y={50}  w={30} h={30} color="#4fc3f7" />
      <Box x={250} y={20}  w={40} h={20} color="#ff7043" />
      <Box x={300} y={80}  w={25} h={25} color="#fdd835" />
      <Ball x={400} y={30}  r={15} color="#e040fb" />
      <Ball x={450} y={60}  r={12} color="#4fc3f7" />
      <Ball x={500} y={10}  r={18} color="#ff7043" />
      <Box x={550} y={40}  w={35} h={35} color="#66bb6a" />

      {/* Angled ramps */}
      <Wall x={200} y={200} w={200} h={12} />
      <Wall x={500} y={300} w={200} h={12} />

      {/* One-way platform (green — can jump through from below) */}
      <Wall x={350} y={350} w={150} h={10} oneWay />

      {/* Ground */}
      <Wall x={400} y={490} w={800} h={20} />

      {/* Walls */}
      <Wall x={5}   y={250} w={10} h={500} />
      <Wall x={795} y={250} w={10} h={500} />

      {/* Label */}
      <Entity>
        <Transform x={350} y={375} />
        <Text text="one-way (green)" fontSize={10} color="#4caf50" align="center" baseline="middle" />
      </Entity>
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Health & Combat ────────────────────────────────────────────────────────
  {
    id: 'combat',
    label: 'Health & Combat',
    icon: '⚔️',
    description: 'useHealth, useDamageZone, trigger events',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { Game, World, Camera2D } from 'cubeforge'
import { Player } from './Player'
import { Enemy } from './Enemy'
import { Arena } from './Arena'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#1a1a2e">
      <Camera2D x={400} y={250} />
      <Arena />
      <Player x={400} y={250} />
      <Enemy x={200} y={150} color="#ef5350" />
      <Enemy x={600} y={150} color="#ff7043" />
      <Enemy x={200} y={350} color="#e040fb" />
      <Enemy x={600} y={350} color="#fdd835" />
    </World>
  </Game>
)
`,
      },
      {
        name: 'Player.tsx',
        content: `import {
  Entity, Transform, Sprite, RigidBody, BoxCollider, Text,
  useEntity, useTopDownMovement, useHealth
} from 'cubeforge'
import { useState } from 'react'

export function Player({ x, y }: { x: number; y: number }) {
  const [hp, setHp] = useState(5)

  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={28} height={28} color="#4fc3f7" zIndex={5} />
      <RigidBody gravityScale={0} />
      <BoxCollider width={28} height={28} />
      <PlayerLogic onHpChange={setHp} />
      <Entity>
        <Transform x={0} y={-24} />
        <Text text={\`HP: \${hp}\`} fontSize={11} color="#4fc3f7" align="center" baseline="middle" zIndex={10} />
      </Entity>
    </Entity>
  )
}

function PlayerLogic({ onHpChange }: { onHpChange: (hp: number) => void }) {
  const id = useEntity()
  useTopDownMovement(id, { speed: 180 })
  useHealth(id, {
    maxHealth: 5,
    invincibilityDuration: 1,
    onDamage: (_amount, remaining) => onHpChange(remaining),
    onDeath: () => onHpChange(0),
  })
  return null
}
`,
      },
      {
        name: 'Enemy.tsx',
        content: `import {
  Entity, Transform, Sprite, RigidBody, BoxCollider,
  useEntity, useDamageZone
} from 'cubeforge'

export function Enemy({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite width={24} height={24} color={color} zIndex={3} />
      <RigidBody isStatic />
      <BoxCollider width={24} height={24} isTrigger />
      <EnemyLogic />
    </Entity>
  )
}

function EnemyLogic() {
  const id = useEntity()
  useDamageZone(id, { damage: 1, targetTag: 'player' })
  return null
}
`,
      },
      {
        name: 'Arena.tsx',
        content: `import { Entity, Transform, Sprite, RigidBody, BoxCollider } from 'cubeforge'

export function Arena() {
  const walls = [
    { x: 400, y: 5,   w: 800, h: 10 },
    { x: 400, y: 495, w: 800, h: 10 },
    { x: 5,   y: 250, w: 10,  h: 500 },
    { x: 795, y: 250, w: 10,  h: 500 },
  ]
  return (
    <>
      {walls.map((w, i) => (
        <Entity key={i} tags={['wall']}>
          <Transform x={w.x} y={w.y} />
          <Sprite width={w.w} height={w.h} color="#263238" />
          <RigidBody isStatic />
          <BoxCollider width={w.w} height={w.h} />
        </Entity>
      ))}
    </>
  )
}
`,
      },
    ],
  },

  // ── Camera Effects ─────────────────────────────────────────────────────────
  {
    id: 'camera',
    label: 'Camera Effects',
    icon: '📷',
    description: 'Shake, zoom, follow offset, screen flash',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { useRef } from 'react'
import {
  Game, World, Camera2D, Entity, Transform, Sprite,
  RigidBody, BoxCollider, ScreenFlash, Text,
  useEntity, useCamera, usePlatformerController, useInput
} from 'cubeforge'
import type { ScreenFlashHandle } from 'cubeforge'

function Player() {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={400} y={300} />
      <Sprite width={32} height={48} color="#4fc3f7" />
      <RigidBody />
      <BoxCollider width={32} height={48} />
      <Controls />
    </Entity>
  )
}

function Controls() {
  const id = useEntity()
  usePlatformerController(id, { speed: 220, jumpForce: -500, maxJumps: 2 })
  return null
}

function CameraDemo() {
  const camera = useCamera()
  const flashRef = useRef<ScreenFlashHandle>(null)

  return (
    <>
      <ScreenFlash ref={flashRef} />

      {/* Shake button */}
      <Entity>
        <Transform x={150} y={100} />
        <Sprite width={100} height={36} color="#ef5350" zIndex={10} />
      </Entity>
      <Entity>
        <Transform x={150} y={100} />
        <Text text="SHAKE" fontSize={12} color="#fff" align="center" baseline="middle" zIndex={11} />
      </Entity>

      {/* Zoom button */}
      <Entity>
        <Transform x={300} y={100} />
        <Sprite width={100} height={36} color="#4caf50" zIndex={10} />
      </Entity>
      <Entity>
        <Transform x={300} y={100} />
        <Text text="ZOOM" fontSize={12} color="#fff" align="center" baseline="middle" zIndex={11} />
      </Entity>

      {/* Flash button */}
      <Entity>
        <Transform x={450} y={100} />
        <Sprite width={100} height={36} color="#fdd835" zIndex={10} />
      </Entity>
      <Entity>
        <Transform x={450} y={100} />
        <Text text="FLASH" fontSize={12} color="#0a0a0f" align="center" baseline="middle" zIndex={11} />
      </Entity>

      {/* Instructions */}
      <Entity>
        <Transform x={400} y={460} />
        <Text
          text="Press Q=shake  E=zoom  F=flash  |  WASD+Space=move"
          fontSize={11} color="#546e7a" align="center" baseline="middle" zIndex={10}
        />
      </Entity>

      {/* Keyboard trigger */}
      <Entity>
        <Transform x={0} y={0} />
        <CameraKeyboard camera={camera} flashRef={flashRef} />
      </Entity>
    </>
  )
}

function CameraKeyboard({ camera, flashRef }: {
  camera: ReturnType<typeof useCamera>
  flashRef: React.RefObject<ScreenFlashHandle | null>
}) {
  const id = useEntity()
  const input = useInput()

  // Using Script would be cleaner, but hooks demo is more instructive
  if (input?.isPressed?.('KeyQ')) camera.shake(8, 0.3)
  if (input?.isPressed?.('KeyE')) camera.setZoom(camera.getZoom?.() === 1 ? 1.5 : 1)
  if (input?.isPressed?.('KeyF')) flashRef.current?.flash('#ffffff', 0.3)

  return null
}

function Ground() {
  return (
    <Entity tags={['ground']}>
      <Transform x={400} y={480} />
      <Sprite width={800} height={40} color="#37474f" />
      <RigidBody isStatic />
      <BoxCollider width={800} height={40} />
    </Entity>
  )
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={980}>
    <World background="#0d1117">
      <Camera2D followEntity="player" smoothing={0.9} />
      <Player />
      <Ground />
      <CameraDemo />
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Script Component ───────────────────────────────────────────────────────
  {
    id: 'script',
    label: 'Script Component',
    icon: '📜',
    description: 'Custom game logic with init/update functions',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import {
  Game, World, Camera2D, Entity, Transform, Sprite, Script, Text
} from 'cubeforge'
import type { EntityId, ECSWorld, InputManager, RigidBodyComponent } from 'cubeforge'

// Direct Script-based game logic — no hooks, pure ECS
// This pattern is best for performance-critical code

const speed = 200
const bulletSpeed = 500
const bullets: { x: number; y: number; vx: number; vy: number; life: number }[] = []
let score = 0

function playerUpdate(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  const t = world.getComponent(id, 'Transform') as any
  if (!t) return

  // WASD movement
  let dx = 0, dy = 0
  if (input.isDown('KeyW') || input.isDown('ArrowUp'))    dy = -1
  if (input.isDown('KeyS') || input.isDown('ArrowDown'))  dy =  1
  if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  dx = -1
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx =  1

  t.x += dx * speed * dt
  t.y += dy * speed * dt

  // Clamp to bounds
  t.x = Math.max(20, Math.min(780, t.x))
  t.y = Math.max(20, Math.min(480, t.y))

  // Shoot on Space
  if (input.isPressed('Space')) {
    bullets.push({ x: t.x, y: t.y - 20, vx: 0, vy: -bulletSpeed, life: 2 })
  }
}

function bulletManager(_id: EntityId, _world: ECSWorld, _input: InputManager, dt: number) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.life -= dt
    if (b.life <= 0 || b.y < -10 || b.y > 510) {
      bullets.splice(i, 1)
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#0a0a12">
      <Camera2D x={400} y={250} />

      {/* Player */}
      <Entity id="player" tags={['player']}>
        <Transform x={400} y={420} />
        <Sprite width={24} height={24} color="#4fc3f7" zIndex={5} />
        <Script update={playerUpdate} />
      </Entity>

      {/* Bullet system */}
      <Entity>
        <Transform x={0} y={0} />
        <Script update={bulletManager} />
      </Entity>

      {/* Instructions */}
      <Entity>
        <Transform x={400} y={480} />
        <Text
          text="WASD — move  |  Space — shoot"
          fontSize={11} color="#37474f" align="center" baseline="middle"
        />
      </Entity>
      <Entity>
        <Transform x={400} y={20} />
        <Text
          text="Script component — raw init/update game logic"
          fontSize={12} color="#546e7a" align="center" baseline="middle"
        />
      </Entity>
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Triggers & Events ─────────────────────────────────────────────────────
  {
    id: 'triggers',
    label: 'Triggers & Events',
    icon: '🔔',
    description: 'Trigger zones, collision events, event bus',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { Game, World, Camera2D, Entity, Transform, Sprite, RigidBody, BoxCollider, Text } from 'cubeforge'
import { Player } from './Player'
import { TriggerZone } from './TriggerZone'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#0d1117">
      <Camera2D x={400} y={250} />

      <Player x={400} y={250} />

      {/* Trigger zones — walk into them */}
      <TriggerZone x={150} y={150} w={80} h={80} color="#4fc3f7" label="BLUE" />
      <TriggerZone x={650} y={150} w={80} h={80} color="#ef5350" label="RED" />
      <TriggerZone x={150} y={350} w={80} h={80} color="#66bb6a" label="GREEN" />
      <TriggerZone x={650} y={350} w={80} h={80} color="#fdd835" label="GOLD" />

      {/* Walls */}
      {[
        { x: 400, y: 5,   w: 800, h: 10 },
        { x: 400, y: 495, w: 800, h: 10 },
        { x: 5,   y: 250, w: 10,  h: 500 },
        { x: 795, y: 250, w: 10,  h: 500 },
      ].map((w, i) => (
        <Entity key={i}>
          <Transform x={w.x} y={w.y} />
          <Sprite width={w.w} height={w.h} color="#1e2535" />
          <RigidBody isStatic />
          <BoxCollider width={w.w} height={w.h} />
        </Entity>
      ))}

      <Entity>
        <Transform x={400} y={480} />
        <Text text="Walk into colored zones — triggers fire on enter/exit" fontSize={11} color="#37474f" align="center" baseline="middle" />
      </Entity>
    </World>
  </Game>
)
`,
      },
      {
        name: 'Player.tsx',
        content: `import { Entity, Transform, Sprite, RigidBody, BoxCollider, useEntity, useTopDownMovement } from 'cubeforge'

export function Player({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={24} height={24} color="#ffffff" zIndex={5} />
      <RigidBody gravityScale={0} />
      <BoxCollider width={24} height={24} />
      <Controls />
    </Entity>
  )
}

function Controls() {
  const id = useEntity()
  useTopDownMovement(id, { speed: 200 })
  return null
}
`,
      },
      {
        name: 'TriggerZone.tsx',
        content: `import { Entity, Transform, Sprite, BoxCollider, Text, useEntity, useTriggerEnter, useTriggerExit } from 'cubeforge'
import { useState } from 'react'

export function TriggerZone({ x, y, w, h, color, label }: {
  x: number; y: number; w: number; h: number; color: string; label: string
}) {
  const [inside, setInside] = useState(false)

  return (
    <Entity tags={['zone']}>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color={color} opacity={inside ? 0.5 : 0.15} zIndex={1} />
      <BoxCollider width={w} height={h} isTrigger />
      <TriggerLogic onEnter={() => setInside(true)} onExit={() => setInside(false)} />
      <Entity>
        <Transform x={0} y={0} />
        <Text
          text={inside ? \`\${label}!\` : label}
          fontSize={inside ? 16 : 12}
          color={color}
          align="center"
          baseline="middle"
          zIndex={2}
        />
      </Entity>
    </Entity>
  )
}

function TriggerLogic({ onEnter, onExit }: { onEnter: () => void; onExit: () => void }) {
  const id = useEntity()
  useTriggerEnter(id, (_other) => onEnter())
  useTriggerExit(id, (_other) => onExit())
  return null
}
`,
      },
    ],
  },

  // ── Shapes & Drawing ──────────────────────────────────────────────────────
  {
    id: 'shapes',
    label: 'Shapes & Drawing',
    icon: '🎨',
    description: 'Circle, Line, Polygon, Gradient primitives',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import {
  Game, World, Camera2D, Entity, Transform,
  Circle, Line, Polygon, Gradient, Sprite, Text
} from 'cubeforge'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#0a0a12">
      <Camera2D x={400} y={250} />

      {/* Circle */}
      <Entity>
        <Transform x={120} y={180} />
        <Circle radius={50} color="#4fc3f7" />
      </Entity>
      <Entity>
        <Transform x={120} y={260} />
        <Text text="Circle" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Line */}
      <Entity>
        <Transform x={280} y={130} />
        <Line x2={80} y2={100} color="#ef5350" lineWidth={3} />
      </Entity>
      <Entity>
        <Transform x={300} y={260} />
        <Text text="Line" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Polygon — triangle */}
      <Entity>
        <Transform x={460} y={180} />
        <Polygon
          points={[
            { x: 0, y: -50 },
            { x: 50, y: 40 },
            { x: -50, y: 40 },
          ]}
          color="#66bb6a"
          filled
        />
      </Entity>
      <Entity>
        <Transform x={460} y={260} />
        <Text text="Polygon" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Polygon — hexagon */}
      <Entity>
        <Transform x={630} y={180} />
        <Polygon
          points={Array.from({ length: 6 }, (_, i) => ({
            x: Math.cos(Math.PI / 3 * i - Math.PI / 6) * 50,
            y: Math.sin(Math.PI / 3 * i - Math.PI / 6) * 50,
          }))}
          color="#fdd835"
          filled
        />
      </Entity>
      <Entity>
        <Transform x={630} y={260} />
        <Text text="Hexagon" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Gradient rectangle */}
      <Entity>
        <Transform x={400} y={380} />
        <Sprite width={600} height={60} color="#000" zIndex={-1} />
        <Gradient
          type="linear"
          stops={[
            { offset: 0, color: '#4fc3f7' },
            { offset: 0.5, color: '#e040fb' },
            { offset: 1, color: '#ff7043' },
          ]}
          width={600}
          height={60}
        />
      </Entity>
      <Entity>
        <Transform x={400} y={430} />
        <Text text="Linear Gradient" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Title */}
      <Entity>
        <Transform x={400} y={40} />
        <Text text="Shape Primitives" fontSize={16} color="#78909c" align="center" baseline="middle" />
      </Entity>
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Top-Down ─────────────────────────────────────────────────────────────────
  {
    id: 'top-down',
    label: 'Top-Down',
    icon: '🎮',
    description: '4-directional movement, wall collisions',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { Game, World } from 'cubeforge'
import { Player } from './Player'
import { Wall } from './Wall'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#1a1a2e">
      <Player x={400} y={250} />
      <Wall x={400} y={10}  w={800} h={20} />
      <Wall x={400} y={490} w={800} h={20} />
      <Wall x={10}  y={250} w={20}  h={500} />
      <Wall x={790} y={250} w={20}  h={500} />
      <Wall x={300} y={200} w={20}  h={160} />
      <Wall x={500} y={300} w={20}  h={160} />
    </World>
  </Game>
)
`,
      },
      {
        name: 'Player.tsx',
        content: `import { Entity, Transform, Sprite, RigidBody, BoxCollider, useEntity, useTopDownMovement } from 'cubeforge'

export function Player({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={32} height={32} color="#4fc3f7" />
      <RigidBody gravityScale={0} />
      <BoxCollider width={30} height={30} />
      <PlayerController />
    </Entity>
  )
}

function PlayerController() {
  const id = useEntity()
  useTopDownMovement(id, { speed: 180 })
  return null
}
`,
      },
      {
        name: 'Wall.tsx',
        content: `import { Entity, Transform, Sprite, RigidBody, BoxCollider } from 'cubeforge'

export function Wall({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <Entity tags={['wall']}>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color="#455a64" />
      <RigidBody isStatic />
      <BoxCollider width={w} height={h} />
    </Entity>
  )
}
`,
      },
    ],
  },

  // ── Input Map ──────────────────────────────────────────────────────────────
  {
    id: 'input-map',
    label: 'Input Mapping',
    icon: '🕹️',
    description: 'Named actions, multi-key bindings',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import {
  Game, World, Camera2D, Entity, Transform, Sprite, Text,
  useEntity, useInputMap, createInputMap
} from 'cubeforge'
import type { EntityId, ECSWorld, InputManager } from 'cubeforge'

// Define named actions with multiple key bindings
const bindings = createInputMap({
  moveUp:    ['KeyW', 'ArrowUp'],
  moveDown:  ['KeyS', 'ArrowDown'],
  moveLeft:  ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  dash:      ['ShiftLeft', 'ShiftRight'],
  action:    ['Space', 'KeyE'],
})

function Player() {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={400} y={250} />
      <Sprite width={28} height={28} color="#4fc3f7" zIndex={5} />
      <PlayerInput />
    </Entity>
  )
}

function PlayerInput() {
  const id = useEntity()
  const input = useInputMap(bindings)
  const speed = 200
  const dashSpeed = 400

  // This runs every frame via React re-render (fine for demos)
  // For production, prefer Script component

  return null
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#0d1117">
      <Camera2D x={400} y={250} />
      <Player />

      {/* Key legend */}
      <Entity>
        <Transform x={400} y={40} />
        <Text text="Input Map — Named Actions" fontSize={14} color="#78909c" align="center" baseline="middle" />
      </Entity>
      <Entity>
        <Transform x={400} y={70} />
        <Text
          text="moveUp: W/Up  |  moveDown: S/Down  |  dash: Shift  |  action: Space/E"
          fontSize={10} color="#37474f" align="center" baseline="middle"
        />
      </Entity>

      {/* Walls */}
      {[
        { x: 400, y: 5,   w: 800, h: 10 },
        { x: 400, y: 495, w: 800, h: 10 },
        { x: 5,   y: 250, w: 10,  h: 500 },
        { x: 795, y: 250, w: 10,  h: 500 },
      ].map((w, i) => (
        <Entity key={i}>
          <Transform x={w.x} y={w.y} />
          <Sprite width={w.w} height={w.h} color="#1e2535" />
        </Entity>
      ))}
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Timer & Coroutine ──────────────────────────────────────────────────────
  {
    id: 'timers',
    label: 'Timers & Tweens',
    icon: '⏱️',
    description: 'useTimer, useTween, easing functions',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import {
  Game, World, Camera2D, Entity, Transform, Sprite, Text,
  Script
} from 'cubeforge'
import type { EntityId, ECSWorld, InputManager } from 'cubeforge'

// Bouncing box using Script + sine wave
function bounceUpdate(id: EntityId, world: ECSWorld, _input: InputManager, _dt: number) {
  const t = world.getComponent(id, 'Transform') as any
  if (!t) return
  const time = performance.now() / 1000
  t.y = 250 + Math.sin(time * 2) * 80
}

// Rotating square (manual rotation via scale trick — using x oscillation)
function orbitUpdate(id: EntityId, world: ECSWorld, _input: InputManager, _dt: number) {
  const t = world.getComponent(id, 'Transform') as any
  if (!t) return
  const time = performance.now() / 1000
  t.x = 400 + Math.cos(time * 1.5) * 150
  t.y = 250 + Math.sin(time * 1.5) * 100
}

// Pulsing size
function pulseUpdate(id: EntityId, world: ECSWorld, _input: InputManager, _dt: number) {
  const sprite = world.getComponent(id, 'Sprite') as any
  if (!sprite) return
  const time = performance.now() / 1000
  const scale = 1 + Math.sin(time * 3) * 0.3
  sprite.width = 40 * scale
  sprite.height = 40 * scale
}

// Color cycling (using multiple entities)
function fadeUpdate(id: EntityId, world: ECSWorld, _input: InputManager, _dt: number) {
  const sprite = world.getComponent(id, 'Sprite') as any
  if (!sprite) return
  const time = performance.now() / 1000
  const alpha = (Math.sin(time * 2) + 1) / 2
  sprite.opacity = 0.2 + alpha * 0.8
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#0a0a12">
      <Camera2D x={400} y={250} />

      {/* Bounce */}
      <Entity>
        <Transform x={150} y={250} />
        <Sprite width={40} height={40} color="#4fc3f7" />
        <Script update={bounceUpdate} />
      </Entity>
      <Entity>
        <Transform x={150} y={400} />
        <Text text="Bounce" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Orbit */}
      <Entity>
        <Transform x={400} y={250} />
        <Sprite width={30} height={30} color="#e040fb" />
        <Script update={orbitUpdate} />
      </Entity>
      <Entity>
        <Transform x={400} y={400} />
        <Text text="Orbit" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Pulse */}
      <Entity>
        <Transform x={550} y={250} />
        <Sprite width={40} height={40} color="#66bb6a" />
        <Script update={pulseUpdate} />
      </Entity>
      <Entity>
        <Transform x={550} y={400} />
        <Text text="Pulse" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      {/* Fade */}
      <Entity>
        <Transform x={700} y={250} />
        <Sprite width={40} height={40} color="#fdd835" />
        <Script update={fadeUpdate} />
      </Entity>
      <Entity>
        <Transform x={700} y={400} />
        <Text text="Fade" fontSize={11} color="#546e7a" align="center" baseline="middle" />
      </Entity>

      <Entity>
        <Transform x={400} y={40} />
        <Text text="Script-driven animations" fontSize={14} color="#78909c" align="center" baseline="middle" />
      </Entity>
    </World>
  </Game>
)
`,
      },
    ],
  },

  // ── Empty ─────────────────────────────────────────────────────────────────
  {
    id: 'empty',
    label: 'Empty',
    icon: '✦',
    description: 'Blank canvas — start from scratch',
    files: [
      {
        name: 'main.tsx',
        content: `import { createRoot } from 'react-dom/client'
import { Game, World, Camera2D, Entity, Transform, Sprite } from 'cubeforge'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={980}>
    <World background="#12131f">
      <Camera2D x={400} y={250} />
      {/* Add your entities here */}
    </World>
  </Game>
)
`,
      },
    ],
  },
]
