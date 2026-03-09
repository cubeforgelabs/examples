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

### Pong
> `pong/`

Two-player paddle battle on one keyboard:

- First to 7 wins
- Ball speeds up on every paddle hit
- Divider dots and scoreboard HUD

**Controls:** `W`/`S` — left paddle · `↑`/`↓` — right paddle

---

### Snake
> `snake/`

Classic snake — eat food to grow, avoid your own tail:

- Speed increases over time
- Score counter
- Game over on self-collision or wall hit

**Controls:** `WASD` / Arrow keys

---

### Endless Runner
> `endless-runner/`

Dodge incoming obstacles as the world speeds up:

- Procedural obstacle spawning
- Distance-based scoring
- Increasing difficulty over time

**Controls:** `Space` / `↑` — jump

---

### Asteroids
> `asteroids/`

Rotate, thrust, and shoot through waves of splitting asteroids:

- Asteroids split into smaller pieces when shot
- Wrap-around screen edges
- 3 lives

**Controls:** `WASD` / Arrow keys — move/rotate · `Space` — shoot

---

### Puzzle (Sokoban)
> `puzzle/`

Grid-based box-pushing puzzle game:

- 3 hand-crafted levels of increasing difficulty
- Push boxes onto target tiles — no pulling allowed
- Move counter and level tracking
- R to restart current level

**Controls:** Arrow keys — move · `R` — restart

---

### RPG
> `rpg/`

Top-down action RPG with melee combat:

- Smooth 4-directional movement
- Sword attack with cooldown
- 3 enemy slimes that patrol and deal contact damage
- 5 HP with invincibility frames on hit
- Collectible coins

**Controls:** `WASD` / Arrows — move · `Space` — attack

---

### Tower Defense
> `tower-defense/`

Wave-based tower defense on a grid:

- 5 waves of enemies following a zigzag path
- 3 tower types: basic (fast), slow (debuff), splash (AoE)
- Gold economy: 100 starting, +10 per kill
- 10 lives — lose 1 per enemy reaching the end
- Click cells to place towers, range preview on hover

**Controls:** Click to select tower type · Click grid cell to place

---

### Roguelike
> `roguelike/`

Turn-based dungeon crawler with procedural generation:

- Procedurally generated rooms connected by corridors
- Fog of war with 5-tile visibility radius
- Bump-to-attack combat (player 10 HP / 3 ATK, enemies 3 HP / 1 ATK)
- Health potions and stairs to descend deeper
- Floor counter and kill tracker

**Controls:** `WASD` / Arrow keys — move (turn-based)

---

### Multiplayer
> `multiplayer/`

Local multiplayer demo showing the `@cubeforge/net` networking pattern:

- Two players on one screen with a shared ball
- Player positions synced via mock local transport
- Demonstrates Room, message broadcasting, and sync patterns
- Comments explain how to swap in real WebSocket transport

**Controls:** `WASD` — player 1 · Arrow keys — player 2

---

## Running an example

All examples share a root pnpm workspace. The Cubeforge engine source lives in the sibling `cubeforge/` directory — no npm install of the engine needed.

```bash
# Clone both repos as siblings
git clone https://github.com/1homsi/cubeforge
git clone https://github.com/1homsi/cubeforge-examples

# Install deps in examples repo
cd cubeforge-examples
pnpm install

# Run any example
pnpm dev:playground        # browser IDE
pnpm dev                   # platformer (default)
pnpm dev:pong
pnpm dev:snake
pnpm dev:endless-runner
pnpm dev:asteroids
pnpm dev:puzzle
pnpm dev:rpg
pnpm dev:tower-defense
pnpm dev:roguelike
pnpm dev:multiplayer
```

Or go into an example directory directly:

```bash
cd breakout && pnpm dev
```

---

## Directory structure

```
cubeforge-examples/
  platformer/         Scrolling platformer — double jump, enemies, coins
  mario-clone/        Mario-style level — question blocks, powerups, goombas
  breakout/           Classic brick breaker — paddle, ball, bricks
  flappy-bird/        Tap-to-flap — scrolling pipes, high score
  shooter/            Side-scrolling shoot-em-up — waves, enemy patterns
  top-down/           Dungeon explorer — sword combat, keys, exit door
  pong/               Two-player paddle battle
  snake/              Classic snake — eat, grow, avoid tail
  endless-runner/     Dodge obstacles, speed increases
  asteroids/          Rotate, thrust, shoot splitting asteroids
  puzzle/             Sokoban — push boxes onto targets
  rpg/                Top-down action RPG — slimes, sword, coins
  tower-defense/      Wave-based TD — 3 tower types, path enemies
  roguelike/          Turn-based dungeon — procedural gen, fog of war
  multiplayer/        Networked sync demo — local transport, shared ball
  playground/         Browser IDE with Monaco + esbuild-wasm
```

---

## Engine features shown across examples

| Feature | Where used |
|---|---|
| `Camera2D` with smooth follow + bounds | platformer, mario-clone, top-down |
| Double jump + coyote time | platformer, mario-clone |
| Enemy stomp mechanic | platformer, mario-clone |
| Per-entity ECS component callbacks | platformer (Coin), mario-clone (Coin, QuestionBlock) |
| Script-driven physics (no RigidBody) | breakout, flappy-bird, shooter, puzzle, roguelike |
| Dynamic entity create/destroy in scripts | flappy-bird (pipes), shooter (bullets), tower-defense (enemies, bullets) |
| `gravity={0}` top-down mode | shooter, top-down, rpg, tower-defense, roguelike, multiplayer |
| RigidBody with `gravityScale={0}` | top-down (player + enemies + wall collision) |
| `gameKey` remount pattern for restart | all examples |
| `gameEvents` callback bridge | all examples |
| Invincibility frames with sprite flash | platformer, mario-clone, top-down, rpg |
| Grid-based movement | puzzle, roguelike |
| Procedural generation | roguelike (dungeon rooms + corridors) |
| Fog of war | roguelike |
| Turn-based game loop | roguelike |
| Wave/economy system | tower-defense |
| Click-to-place UI + canvas entities | tower-defense |
| Network sync pattern (Room, broadcast) | multiplayer |

---

## Engine repo

[github.com/1homsi/cubeforge](https://github.com/1homsi/cubeforge)
