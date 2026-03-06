# cubeforge-examples

Runnable example games built with [Cubeforge](https://github.com/1homsi/cubeforge) — a React-first 2D browser game engine.

Each example is a self-contained Vite + React app. They all point to the local `cubeforge/` engine source via Vite path aliases, so you can hack on the engine and see changes live.

---

## Examples

### Platformer
> `platformer/`

A full scrolling platformer demonstrating the engine's core capabilities:

- Double jump with coyote time and jump buffer
- Enemy patrol and stomp mechanic (jump on enemies to kill them)
- Invincibility frames with sprite flash on hurt
- 3 lives, score, coin counter, timer HUD
- Win and game over overlays with restart
- 12 collectible coins with bobbing animation and per-entity callbacks
- 4 patrol enemies on floor and elevated platforms
- 1640px scrollable world with multi-tier platforms and Camera2D follow

**Controls:** `WASD` / Arrow keys — move · `Space` / `W` / `Up` — jump (×2) · Jump on enemies to stomp

---

### Mario Clone
> `mario-clone/`

A Mario-style platformer showcasing gameplay helper components and powerups:

- Question blocks that reveal coins or a mushroom powerup
- Mushroom powerup grants double jump for the session
- Goombas patrol platforms, die on stomp
- Goal flag at the end of a 1800px level triggers win
- 10 coins to collect, 3 lives

**Controls:** `WASD` / Arrows — move · `Space` / `Up` — jump · Jump on enemies to stomp

---

### Breakout
> `breakout/`

Classic brick breaker demonstrating script-driven physics without the engine's RigidBody:

- 6 rows × 10 columns of colored bricks, each worth points
- Paddle moves left/right with keyboard
- Ball angle varies based on where it hits the paddle
- 3 lives — lose one when ball falls off bottom
- Win by clearing all bricks

**Controls:** `A` / `←` — left · `D` / `→` — right

---

### Flappy Bird
> `flappy-bird/`

Tap-to-flap side-scroller demonstrating script-driven gravity and dynamic entity spawning:

- Bird falls with gravity; tap to flap upward
- Pipe pairs scroll from right, randomly placed gap
- Score increments each time you pass a pipe
- Session high score tracked
- Idle → playing → dead → retry flow

**Controls:** `Space` or left click — flap

---

### Shooter
> `shooter/`

Side-scrolling space shoot-em-up demonstrating dynamic entity creation, enemy waves, and the `gravity={0}` top-down mode:

- Player ship moves up/down, shoots right
- Enemies scroll in from the right in 3 patterns: straight, sine wave, zigzag
- Enemies shoot back periodically
- 5 waves — speed and fire rate increase per wave
- Scrolling star field background
- 3 lives; win by surviving all 5 waves

**Controls:** `W`/`S` / `↑`/`↓` — move · `Space` — shoot

---

### Top-Down
> `top-down/`

Top-down dungeon explorer demonstrating `useTopDownMovement`, 4-directional combat, and trigger zones:

- 4-directional movement with wall collision via physics engine
- Sword attack in facing direction (Space)
- 6 slime enemies with circular patrol patterns
- 8 keys to collect scattered around the dungeon
- Exit door unlocks when all 8 keys collected
- 3 HP; enemies and their bullets deal damage

**Controls:** `WASD` / Arrows — move · `Space` — attack

---

## Running an example

All examples share a root `bun` workspace. The Cubeforge engine source lives in the sibling `cubeforge/` directory — no npm install of the engine needed.

```bash
# Clone both repos as siblings
git clone https://github.com/1homsi/cubeforge
git clone https://github.com/1homsi/cubeforge-examples

# Install deps in examples repo
cd cubeforge-examples
bun install

# Run any example
bun run --cwd platformer dev
bun run --cwd mario-clone dev
bun run --cwd breakout dev
bun run --cwd flappy-bird dev
bun run --cwd shooter dev
bun run --cwd top-down dev
```

Or go into an example directory directly:

```bash
cd breakout && bun dev
```

---

## Directory structure

```
cubeforge-examples/
  platformer/
    src/
      components/    Player, Enemy, Coin, Ground
      App.tsx        game layout, HUD, overlays
      gameEvents.ts  callback bridge between game scripts and React
    vite.config.ts   aliases @cubeforge/* → local engine source
  mario-clone/
    src/
      components/    Player, Goomba, Coin, QuestionBlock, Mushroom, GoalFlag, Ground
  breakout/
    src/
      components/    Paddle, Ball, Brick
  flappy-bird/
    src/
      components/    Bird, PipeManager
  shooter/
    src/
      components/    Player, EnemyManager, StarField
  top-down/
    src/
      components/    Player, Enemy, Key, Wall, Exit
```

---

## Engine features shown across examples

| Feature | Where used |
|---|---|
| `Camera2D` with smooth follow + bounds | platformer, mario-clone, top-down |
| Double jump + coyote time | platformer, mario-clone |
| Enemy stomp mechanic | platformer, mario-clone |
| Per-entity ECS component callbacks | platformer (Coin), mario-clone (Coin, QuestionBlock) |
| Script-driven physics (no RigidBody) | breakout, flappy-bird, shooter |
| Dynamic entity create/destroy in scripts | flappy-bird (pipes), shooter (bullets, enemies) |
| `gravity={0}` top-down mode | shooter, top-down |
| RigidBody with `gravityScale={0}` | top-down (player + enemies + wall collision) |
| `gameKey` remount pattern for restart | all examples |
| `gameEvents` callback bridge | all examples |
| Invincibility frames with sprite flash | platformer, mario-clone, top-down |

---

## Engine repo

[github.com/1homsi/cubeforge](https://github.com/1homsi/cubeforge)
