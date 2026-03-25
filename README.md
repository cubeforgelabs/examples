# cubeforge-examples

Runnable example games built with [Cubeforge](https://github.com/1homsi/cubeforge) — a React-first 2D browser game engine.

Each example is a self-contained Vite + React app. They all point to the local `cubeforge/` engine source via Vite path aliases, so you can hack on the engine and see changes live.

**[Full roadmap (100+ planned games)](ROADMAP.md)**

---

## Examples

| Game | Genre | Controls |
|---|---|---|
| [Platformer](platformer/) | Platformer | WASD / Space |
| [Mario Clone](mario-clone/) | Platformer | WASD / Space |
| [Endless Runner](endless-runner/) | Platformer | Space / Up |
| [Snake](snake/) | Arcade | WASD / Arrows |
| [Pong](pong/) | Arcade | W/S · Up/Down |
| [Breakout](breakout/) | Arcade | A/D |
| [Flappy Bird](flappy-bird/) | Arcade | Space / Click |
| [Asteroids](asteroids/) | Arcade | WASD / Space |
| [Tetris](tetris/) | Arcade | Arrows / Space |
| [Pac-Man](pac-man/) | Arcade | Arrow Keys |
| [Rhythm](rhythm/) | Arcade | D F J K |
| [2048](2048/) | Puzzle | Arrow Keys |
| [Minesweeper](minesweeper/) | Puzzle | Click / Right-click |
| [Sokoban](sokoban/) | Puzzle | Arrow Keys / R |
| [Lights Out](lights-out/) | Puzzle | Click |
| [Match-3](match-3/) | Puzzle | Click |
| [Solitaire](solitaire/) | Card | Click / Double-click |
| [Tic-Tac-Toe](tic-tac-toe/) | Board | Click |
| [Connect 4](connect-4/) | Board | Click |
| [Checkers](checkers/) | Board | Click |
| [Blackjack](blackjack/) | Card | Click |
| [Sliding Puzzle](sliding-puzzle/) | Puzzle | Click |
| [Memory Card](memory-card/) | Puzzle | Click |
| [Simon](simon/) | Educational | Click |
| [Whack-a-Mole](whack-a-mole/) | Educational | Click |
| [Typing Games](typing-games/) | Educational | Keyboard / Enter |
| [Math Puzzles](math-puzzles/) | Educational | Keyboard / Click |
| [Speed Reaction](speed-reaction/) | Educational | Click / Space / Enter |
| [Quiz Games](quiz-games/) | Educational | Keyboard / Click |
| [Dungeon Explorer](top-down/) | Top-down | WASD / Space |
| [RPG](rpg/) | Top-down | WASD / Space |
| [Roguelike](roguelike/) | Top-down | WASD / Arrows |
| [Vampire Survivors](vampire-survivors/) | Top-down | WASD |
| [Twin-Stick Shooter](twin-stick/) | Shooter | WASD / Mouse |
| [Space Shooter](shooter/) | Shooter | W/S / Space |
| [Tower Defense](tower-defense/) | Strategy | Click |
| [Angry Birds](angry-birds/) | Physics | Click & Drag |
| [Idle Clicker](idle/) | Simulation | Click |
| [Game of Life](game-of-life/) | Simulation | Click / Space |
| [Multiplayer](multiplayer/) | Multiplayer | WASD · Arrows |
| [Playground](playground/) | Tool | Browser IDE |

---

## Running an example

```bash
# Clone both repos as siblings
git clone https://github.com/1homsi/cubeforge
git clone https://github.com/1homsi/cubeforge-examples

# Install deps in examples repo
cd cubeforge-examples
pnpm install

# Run any example
pnpm dev                   # platformer (default)
pnpm dev:playground        # browser IDE
pnpm dev:tetris
pnpm dev:pac-man
pnpm dev:match-3
pnpm dev:twin-stick
pnpm dev:vampire-survivors
pnpm dev:angry-birds
pnpm dev:solitaire
pnpm dev:rhythm
pnpm dev:idle
pnpm dev:game-of-life
```

Or go into any example directory directly:

```bash
cd breakout && pnpm dev
```

---

## Engine repo

[github.com/1homsi/cubeforge](https://github.com/1homsi/cubeforge)
