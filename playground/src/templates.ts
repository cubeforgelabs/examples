export interface Template {
  id: string
  label: string
  code: string
}

export const TEMPLATES: Template[] = [
  {
    id: 'platformer',
    label: 'Platformer',
    code: `import { createRoot } from 'react-dom/client'
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider, Camera2D, useEntity, usePlatformerController } from 'cubeforge'

function Player({ x, y }: { x: number; y: number }) {
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

function Platform({ x, y, w = 200, h = 20, color = '#37474f' }: { x: number; y: number; w?: number; h?: number; color?: string }) {
  return (
    <Entity tags={['ground']}>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color={color} />
      <RigidBody isStatic />
      <BoxCollider width={w} height={h} />
    </Entity>
  )
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={980}>
    <World background="#87ceeb">
      <Camera2D followEntity="player" smoothing={0.85} />
      <Player x={100} y={300} />
      <Platform x={400} y={480} w={800} h={40} />
      <Platform x={200} y={380} w={120} />
      <Platform x={420} y={310} w={150} color="#4caf50" />
      <Platform x={640} y={240} w={130} color="#ff9800" />
    </World>
  </Game>
)
`,
  },
  {
    id: 'top-down',
    label: 'Top-Down',
    code: `import { createRoot } from 'react-dom/client'
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider, useEntity, useTopDownMovement } from 'cubeforge'

function Player({ x, y }: { x: number; y: number }) {
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

function Wall({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <Entity tags={['wall']}>
      <Transform x={x} y={y} />
      <Sprite width={w} height={h} color="#455a64" />
      <RigidBody isStatic />
      <BoxCollider width={w} height={h} />
    </Entity>
  )
}

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={0}>
    <World background="#1a1a2e">
      <Player x={400} y={250} />
      <Wall x={400} y={10} w={800} h={20} />
      <Wall x={400} y={490} w={800} h={20} />
      <Wall x={10} y={250} w={20} h={500} />
      <Wall x={790} y={250} w={20} h={500} />
      <Wall x={300} y={200} w={20} h={160} color="#37474f" />
      <Wall x={500} y={300} w={20} h={160} color="#37474f" />
    </World>
  </Game>
)
`,
  },
  {
    id: 'empty',
    label: 'Empty',
    code: `import { createRoot } from 'react-dom/client'
import { Game, World, Entity, Transform, Sprite, RigidBody, BoxCollider } from 'cubeforge'

createRoot(document.getElementById('root')!).render(
  <Game width={800} height={500} gravity={980}>
    <World background="#12131f">
      {/* Add your entities here */}
    </World>
  </Game>
)
`,
  },
]
