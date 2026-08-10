# Skill Animations — Cinema of Code · The Shipping Machine

This document is the motion-design blueprint for the portfolio's evolving 3D
background. It is meant to be specific enough that another creative developer
could implement any scene from this file alone. The implementation lives in
`shipping-machine.js` and the page hooks (skill data attributes, scroll
positions) live in `portfolio.html` and `index.html` (kept in sync).

---

## 0. Motion-Design Philosophy

The background is **a miniature software-engineering universe**, not a tech
screensaver. It reads like the animated title sequence of a film about
shipping software. The viewer should feel — within the first 5 seconds — that
this person understands how real software moves from an idea to production,
before reading a single line of copy.

The work is **conceptual, slow, weighted, and editorial**. Restraint is a
design tool. The portfolio's typography and content always remain the visual
priority; the background is a *supporting cast*.

### Visual benchmarks

- **Composition**: One minute of wandering the camera should reveal a
  coherent world, not a noise field. Negative space is a feature.
- **Timing**: Camera moves use ease-in-out, ~0.05 lerp factor; cycles are
  6–12 seconds so the brain never catches the loop.
- **Color**: Midnight navy `#070a14` base, gold `#e8d39e` for primary state /
  human-driven action, cyan `#7fc8d8` for system state / data flow, red
  `#e54d42` reserved for failure / conflict (sparingly).
- **Lighting**: No real lights. Everything is `MeshBasicMaterial` with
  additive-blended sprite halos. Mood is built from color and opacity, not
  from photons.
- **Sound**: None. Autoplay audio is forbidden.

### Shared Scene Vocabulary

Every scene reuses the same primitives so the visual language stays unified:

| Primitive      | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `Node`         | Octahedron / icosahedron / tetrahedron mesh + additive halo sprite       |
| `FlowPath`     | Curved `TubeGeometry` between two 3D points (rendered as a soft rail)    |
| `Packet`       | Small glowing sphere w/ halo + tiny `PointLight` (additive blend only)   |
| `Label`        | Canvas-texture sprite (JetBrains Mono, gold or cyan) for node names      |
| `Pulse`        | `RingGeometry` that expands and fades — used for commits, deploys, merges|
| `worldGroup`   | Single `THREE.Group` containing all three scene subtrees                 |
| `Emphasis`     | A 0..1.4 multiplier passed to each scene's `update(dt, time, emphasis)`  |

### Camera Rules

- **FOV**: 42°. Tight enough to feel cinematic, wide enough to avoid
  claustrophobia.
- **Hero pose**: `(0, 0, 14)` looking at the origin — shows the full triptych.
- **Per-scene poses**: `(-6, 1.0, 7.5)`, `(0, 0.8, 7.8)`, `(6, 0.8, 7.5)`,
  each looking at the scene's center.
- **Transitions**: Lerp factor `0.05` per frame. No GSAP camera drives —
  keeps the integration with `prefers-reduced-motion` simple.
- **Mouse parallax**: Up to ±0.4 units of additional tilt on top of the
  current focus target. Dampened at 0.04 to avoid twitch.
- **Dolly rules**: Never below z=6, never above y=+2.4. The camera frames the
  world, never enters it.

### Lighting Rules

- No real lights. All glow is `MeshBasicMaterial` + `SpriteMaterial` with
  `AdditiveBlending` and `depthWrite: false`.
- Halo intensity is 0.55–0.95 per object. The base world is dark; the
  glow is the only "light".
- A single subtle directional fog (set via `scene.background = null` and
  additive halos) gives depth without any post-processing chain.

### Interaction Rules

- **Scroll**: Scroll position only changes the camera focus target, never
  the scene state. The world is always running.
- **Skill hover/focus**: Hovering or keyboard-focusing any list item with
  `data-scene="git|system|cicd"` sets the camera focus to that scene and
  boosts its `emphasis` to 1.4 while dimming the others to 0.55. Body gets
  class `scene-focus` so the 2D projector canvas (cinema-canvas) dims to
  0.32 opacity. Progressive enhancement — the skill list is fully
  accessible without WebGL.
- **Mouse parallax**: Affects camera only, never the scene state.
- **Touch**: Pinch / scroll on touch is treated as a scroll, not a parallax.
- **Custom cursor**: The existing gold dot + ring stays. It hides on
  touch devices.

### Accessibility & Performance Rules

- **prefers-reduced-motion**: The render loop is replaced by a single static
  frame; the 3D canvas is hidden via the existing global stylesheet rule
  `#cinema-canvas, #three-canvas { display: none !important; }` (already in
  place). The static composition (hero-bg radial gradients, marquee, content)
  remains.
- **Pointer events**: `#three-canvas` is `pointer-events: none`. Touch and
  mouse navigation are never blocked.
- **Pixel ratio**: Capped at 2 on desktop, 1.5 on mobile.
- **Antialiasing**: Disabled on mobile.
- **Pause-when-hidden**: `document.visibilitychange` sets `isVisible = false`,
  which short-circuits the render loop without losing state.
- **WebGL failure**: `try/catch` around `WebGLRenderer` ctor; on failure the
  canvas is hidden and the 2D fallback stays. `webglcontextlost` / `restored`
  listeners pause and resume cleanly.
- **Mobile density**: Starfield drops from 480 → 240 particles. The rest of
  the scene is identical (small enough to render at 60fps on a phone).
- **Resize**: Debounced 100ms.
- **No per-frame allocations in the hot path**: All geometries, materials, and
  sprites are created once at scene init. The `update()` methods only mutate
  properties.

---

## 1. The Three Scenes — Detailed Specs

The three scenes live in a single world at fixed x-positions so the camera
can simply dolly-along-x to focus on one or pull back to see all three.

### Scene 01 · Git — "Parallel Universes"

**Visual metaphor**: A miniature spatial railway where time = forward motion,
where = the splitting of branches, and causal distance = the length of a
`TubeGeometry`. The repo is the single source of truth; everything else is a
*parallel universe* that has to merge back in.

**Scene composition** (relative to scene's local origin)

- Central **repo node** (`IcosahedronGeometry(0.55, 0)`, gold wireframe) with
  a halo sprite and a label `repo` below it.
- Inner second-tier **wireframe sphere** (`IcosahedronGeometry(0.32, 1)`,
  cyan) rotates slowly inside the repo — visualises "the repo's history
  grows".
- Two **worktree nodes** to the upper-right and upper-left of the repo
  (golden main, cyan feature), each with a small label.
- Two **branch rails** (curved `TubeGeometry`) splitting from the repo to
  the worktrees.
- A **stream of commits** (3 small packets) travelling each rail at offset
  speeds so they never all arrive at once.
- A **merge node** below the repo. Two curved rails lead back to it from
  each worktree.
- A **merge-conflict shard** (red octahedron) that appears at the merge
  point for ~0.2s of every 6s cycle, with a jiggle.
- A tiny **"wrench" glyph** (small gold node) that travels from the right
  to the conflict shard and "removes" it (shard fades upward).
- A **completion pulse** (gold ring) that expands and fades from the merge
  node right after the conflict resolves.
- A **remote origin** node (cyan tetrahedron) below the merge point, with a
  `push` rail and a packet that loops along it.
- An **easter-egg detached HEAD** (small slate node) that drifts in the
  upper-right for ~5s, then "notices what happened" and drifts back to the
  repo.

**Motion sequence** (one 6s cycle)

1. Three commits travel down main (gold) and feature (cyan) rails in
   parallel.
2. Two commits travel back from the worktrees to the merge node.
3. At `cycle = 0.5`, the conflict shard appears — the merge point rejects
   the change.
4. The wrench glyph approaches the shard from the right.
5. The shard is ejected upward and fades out.
6. At `cycle ≈ 0.72`, the completion pulse fires from the merge node.
7. At `cycle ≈ 0.95`, the next merge commits phase begins.
8. In parallel, the `push` packet keeps looping from merge → origin → back.
9. Every ~7s the detached HEAD wanders, then snaps back.

**Trigger and interaction**

- Always running. Idle cycle.
- When `data-scene="git"` is hovered/focused, the camera focus lerps to
  `(-6, 1.0, 7.5)` looking at `(-6, 0, 0)`, and `gitEm = 1.4` while the
  other scenes receive `0.55`.

**Color and lighting**

- Gold for repo, main branch, commits, merge, pulse.
- Cyan for feature branch, commits, origin, push packet.
- Red `#e54d42` reserved for the conflict shard only.
- Slate `#9aa3b8` for the detached HEAD.
- All nodes use additive-blended halo sprites. No real lights.

**Optional engineer joke / Easter egg**

- The detached HEAD notice-and-return loop. A small slate node drifts away
  from the repo for ~4s, then drifts back toward the merge point — a wink
  to anyone who has ever rebased the wrong branch.

**Reduced-motion fallback**

- Static composition: repo node, two worktrees, merge node, conflict shard
  visible at the merge point, all labels visible. No motion. (Rendered
  once and the loop is short-circuited.)

**Implementation notes**

- Reuses `createNode`, `createFlowPath`, `createPacket`, `createLabel`,
  `createPulse` from the shared primitives.
- The conflict shard is a raw `Mesh` with `MeshBasicMaterial` (not a
  `createNode`) so it can be tinted red and animated independently.
- The merge pulse uses `RingGeometry` with `side: THREE.DoubleSide` and
  `depthWrite: false` so it always renders on top.
- Time-driven via a single `time` variable passed in `update(dt, time, em)`;
  no `setTimeout` / `setInterval` in the render loop.

---

### Scene 02 · System Design — "The Request Odyssey"

**Visual metaphor**: A request lifecycle is a *journey* — packet = the
request, curves = the topology, light speed = cache hit, slow path = the
database hop. Horizontal arrangement of nodes reads like a network diagram
made physical.

**Scene composition**

- 11 topology nodes arranged in a curved horizontal layout spanning roughly
  `[x=-3.4, x=+3.6]`:
  - **client** (cyan, octahedron) on the far left
  - **edge** (gold, octahedron) above and to the right of client
  - **lb** (load balancer, gold icosahedron) at center-left
  - **gateway** (gold icosahedron) at center
  - **auth** (cyan octahedron) below gateway
  - **cache** (gold icosahedron) above-right of gateway
  - **service** (gold octahedron) right of gateway
  - **queue** (cyan icosahedron) below service
  - **worker** (cyan octahedron) far-right below
  - **db** (cyan icosahedron) right of service
  - **obs** (slate small octahedron) far-right above
- All node labels are rendered as canvas-texture sprites in `JetBrains Mono`,
  uppercase, slate `#9aa3b8`.
- A **client pulse** (cyan ring) pulses outward from the client every 1.6s
  to signal "I'm sending traffic".
- 11 **edge arcs** (curved `TubeGeometry`) connecting the topology nodes in
  the actual request path.
- A **cache fast-lane** (gold, brighter) arc from gateway directly to cache
  and back, with a brighter dim outer halo for emphasis.
- A **request packet** (gold) that travels the full path: client → edge →
  lb → gateway → service → db → service → gateway → lb → edge → client.
- A **cache-hit packet** (gold, smaller) that takes the fast lane in
  parallel — slightly offset in time.
- A **worker packet** (cyan) that loops queue → worker → queue.
- 6 **observability particles** (slate, tiny) that peel off from service
  to obs in parallel streams.
- A **secondary service instance** (gold) that fades in below the primary
  service node around 70% of each 6s cycle — visualises horizontal scaling
  under load. The connecting edge also fades in.
- A **circuit breaker** (red ring) that fires briefly at the load balancer
  every ~5s.

**Motion sequence**

1. The request packet travels the full path on a single 12s loop. The client
   pulse fires every 1.6s to mark new requests.
2. The cache packet takes the fast lane in a parallel 5s loop.
3. The worker packet loops queue ↔ worker every ~9s.
4. Each observability particle has a phase offset and walks the obs path
   continuously.
5. Around 70% of each 6s cycle, the secondary service instance fades in
   over 0.6s, then fades out. This conveys "auto-scaling kicks in".
6. Every 5s, the circuit breaker at the LB closes briefly (red ring
   expands and fades over 0.5s) — the system recovers gracefully.

**Trigger and interaction**

- Always running. Idle cycle.
- When `data-scene="system"` is hovered/focused, the camera focus lerps to
  `(0, 0.8, 7.8)` looking at `(0, 0, 0)`, and `sysEm = 1.4`.

**Color and lighting**

- Gold for primary user-facing traffic (request packet, cache fast lane,
  service, gateway).
- Cyan for system data (cache, db, queue, worker, auth).
- Slate `#9aa3b8` for observability particles and labels.
- Red `#e54d42` only for the circuit breaker ring.
- The DB node dims (`opacity 0.4`) when no query is hitting it, then
  brightens (`opacity 0.95`) for 1.2s every 4s — the "slow query wakes
  the database" easter egg.

**Optional engineer joke / Easter egg**

- The cache-hit packet takes the express lane and visibly beats the main
  request packet back to the client. If you watch closely, the cache
  packet returns to the gateway before the main request reaches the DB.
- The DB "sleeps" most of the time and briefly wakes up when queried.
- The circuit breaker physically closes at the load balancer.

**Reduced-motion fallback**

- Static topology: all 11 nodes in their positions, all labels visible,
  one packet frozen mid-route, secondary service instance visible at 50%
  opacity. No motion.

**Implementation notes**

- Topology coordinates are stored in a `NODES` object so positioning logic
  is data-driven.
- `buildNetworkPath(points)` segments a multi-hop path into a flat list of
  `QuadraticBezierCurve3` segments and stitches them via total-arc-length
  parameterisation. Reused by all four packets (request, cache, worker,
  observability).
- The cache fast lane is two stacked `TubeGeometry` meshes (bright + dim
  outer halo) so the lane reads as "important".
- Sprite-based labels are sized 256×64 canvas with text drawn at 12–14px
  JetBrains Mono. Shadow blur is set so the label is legible on any
  background.

---

### Scene 03 · CI/CD — "The Shipping Line"

**Visual metaphor**: The deployment pipeline is a *production line* — a
horizontal sequence of gates that each commit must pass. Failures are
visible. Rollbacks are reversible. The metaphor is industrial but elegant.

**Scene composition**

- 7 **pipeline stages** arranged horizontally from `x=-3.6` to `x=+3.6`:
  `INSTALL`, `LINT`, `TEST`, `BUILD`, `SECURITY`, `PACKAGE`, `DEPLOY`.
  Each stage is an `IcosahedronGeometry(0.32)` with a halo and a label.
- 6 **connector rails** (curved `TubeGeometry`) between stages.
- An **incoming commit** node at the far left (`x=-4.6`) with a `commit`
  label, gold octahedron.
- A **commit packet** that travels the pipeline. Its x position is
  determined by a cycle variable: 0..0.6 of the cycle = advance through
  stages, 0.6..0.8 = held at LINT (failure), 0.8..0.95 = retry from start,
  0.95..1.0 = deploy surge.
- A **bug** (red tetrahedron + halo) that travels with the commit packet
  during 0.05..0.65 of the cycle — then gets **ejected** at LINT (red
  shard flies upward and fades).
- A **deploy node** (cyan icosahedron) at `x=+4.6` with a `PROD` label.
- A short **final rail** from the DEPLOY stage to PROD.
- A **release marker** sprite (`v1.0.0`) that fades in at the top of PROD
  once the deploy completes.
- 3 small **production cluster nodes** (cyan) above PROD.
- A **deploy pulse** (gold ring) that fires from PROD on successful deploy.
- A **rollback chevron** (slate tetrahedron, rotated π) that traces back
  from PROD to the start of the line during the very end of the cycle —
  visualises the *graceful rollback* as a reversible timeline.

**Motion sequence** (one 12s cycle)

1. The commit packet enters from the left at `cycle ≈ 0.05`.
2. The bug piggybacks on the packet, wobbling around it.
3. As the packet reaches LINT (`cycle ≈ 0.6`), the LINT stage turns red
   and shakes briefly. The bug is ejected upward and fades.
4. The packet is held at LINT for ~2.4s (`cycle 0.6..0.8`).
5. The packet is reset to the start and re-runs the pipeline (`cycle
   0.8..0.95`). Stages it has already passed turn gold.
6. At `cycle ≈ 0.95`, the packet reaches DEPLOY. The release marker
   `v1.0.0` fades in. The PROD cluster nodes illuminate.
7. The deploy pulse fires from PROD.
8. The rollback chevron traces back from PROD to the start, demonstrating
   that the pipeline is reversible.

**Trigger and interaction**

- Always running. Idle cycle.
- When `data-scene="cicd"` is hovered/focused, the camera focus lerps to
  `(6, 0.8, 7.5)` looking at `(6, 0, 0)`, and `cicdEm = 1.4`.

**Color and lighting**

- Cyan for early stages (INSTALL, LINT) — system / setup.
- Gold for later stages (TEST, BUILD, SECURITY, PACKAGE, DEPLOY) — work /
  verification.
- Gold for the passing-committed state.
- Red `#e54d42` for the failing LINT stage and the bug.
- Cyan for the PROD node and cluster.
- Gold for the release marker and deploy pulse.

**Optional engineer joke / Easter egg**

- The bug riding on the commit packet is a tiny red tetrahedron that
  shimmies on top of the packet until the LINT gate catches it and "ejects"
  it off-screen. Anyone who has spent hours debugging a CI failure will
  recognise the moment.
- The graceful rollback chevron travelling backwards at the end of the
  cycle is a reassurance: "this isn't an explosion, it's a controlled
  rollback".

**Reduced-motion fallback**

- Static pipeline: all 7 stages in their positions, all labels visible,
  the commit packet frozen mid-pipeline, the bug visible at the LINT
  stage, the release marker faded in at 50%. No motion.

**Implementation notes**

- Stage states are managed by an `idle | pass | fail` enum per stage. The
  pass state colours the stage gold with opacity 0.95; fail colours it red
  with opacity 1 and applies a small shake.
- The packet x-position is a piecewise function of the cycle, so the
  pipeline never desyncs even if the framerate drops.
- The bug is a raw `Mesh` (not a `createNode`) so it can be tinted red and
  animated independently.
- The rollback chevron uses a small tetrahedron with `rotation.z = π`,
  alpha-faded through its life.

---

## 1.5. Skill Coverage — Every Atomic Skill in the Final Stack

The portfolio's Stack section currently lists 21 atomic skills across three
columns. The three top-priority skills (Git, System Design, CI/CD) have
full detailed specs in section 1 above. The remaining 18 are covered here
as **concept briefs** — enough that a creative developer could expand each
into a full scene later without losing the visual language.

Each concept brief follows: **Visual metaphor** · **Scene family** ·
**Reduced-motion placeholder** · **Implementation size**.

### Languages

#### JavaScript ES2022+
- **Visual metaphor**: A stream of asynchronous events flowing through a
  single-threaded event loop. The loop is a closed curve; micro-tasks
  queue at one side, settle on the other.
- **Scene family**: Close cousin of the existing System Design scene —
  a queue/worker topology with timing emphasis.
- **Reduced-motion**: A single closed curve with a few queued packets
  frozen at the input.
- **Implementation size**: Small (reuses System Design topology).

#### TypeScript
- **Visual metaphor**: A JavaScript stream with a type-checker silhouette
  overlaid — types as faint ghost-shapes that snap onto the JS stream.
- **Scene family**: Overlay on the JavaScript scene.
- **Reduced-motion**: JS stream with type annotations visible at compile
  boundaries.
- **Implementation size**: Small.

#### PHP
- **Visual metaphor**: The request–response cycle made literal — a
  request packet enters a server node, gets transformed, returns. A small
  gear icon behind the server hints at the Zend engine.
- **Scene family**: Single-pair request/response.
- **Reduced-motion**: Two packets, one at the input, one at the output.
- **Implementation size**: Small.

#### Python
- **Visual metaphor**: A snake-like curve that coils through a numeric
  workspace — pandas DataFrames and NumPy arrays as floating panels.
- **Scene family**: Data processing corridor.
- **Reduced-motion**: A coiled curve with two table-shaped panels.
- **Implementation size**: Small.

#### SQL
- **Visual metaphor**: A relational join — two table-shaped nodes feed
  into a third via a curved "join" rail; selected rows are tiny cube
  packets that travel the rail.
- **Scene family**: Two-input, one-output data transform.
- **Reduced-motion**: Three table nodes connected by a join curve.
- **Implementation size**: Small.

#### HTML5 · CSS3
- **Visual metaphor**: A layout grid that breathes — row and column
  lines, with one cell highlighted as the focused element.
- **Scene family**: 2D grid in 3D space (tilted slightly).
- **Reduced-motion**: A static grid with one cell highlighted.
- **Implementation size**: Small.

### Frameworks

#### Laravel 13
- **Visual metaphor**: "Eloquent Garden" — a database schema drawn as a
  tree where migrations are leaves that bloom and prune over time.
- **Scene family**: Database scene.
- **Reduced-motion**: A static tree with one bloom and one prune frozen.
- **Implementation size**: Medium.

#### Filament 5.6
- **Visual metaphor**: Admin panel as a control surface — widgets snap
  into a grid like dimensional panels. A wrench glyph slides in when
  "edit" mode is activated.
- **Scene family**: Grid assembly.
- **Reduced-motion**: A 2×2 grid of static panels with one wrench
  resting on the corner.
- **Implementation size**: Small.

#### Vue 3 — Composition · Pinia · Router
- **Visual metaphor**: "Reactive Mesh" — a small lattice of nodes that
  re-renders when a state signal changes. Hovers send a "dependency
  update" packet from the clicked node through the lattice.
- **Scene family**: Reactive topology.
- **Reduced-motion**: A static lattice with one state-update packet
  frozen mid-flight.
- **Implementation size**: Medium.

#### Vite 8 · Tailwind 3/4
- **Visual metaphor**: HMR as a current flowing through a wire — a
  current-pulse races down the wire and the receiving module flashes
  briefly. Tailwind tokens are tiny utility nodes that snap together.
- **Scene family**: Pipeline / chain.
- **Reduced-motion**: A static wire with one update pulse.
- **Implementation size**: Small.

#### Alpine.js · FastAPI
- **Visual metaphor**: "Async Highway" — Alpine handles DOM-side
  directives (small toggle lights), FastAPI handles async I/O (multi-lane
  highway with requests racing). Two parallel scenes bridged by a wire.
- **Scene family**: Two parallel micro-topologies.
- **Reduced-motion**: A static bridge with one packet frozen at the
  midpoint.
- **Implementation size**: Medium.

#### NumPy · pandas · scikit-learn
- **Visual metaphor**: "Data Pipeline" — a 2D array of glowing cells is
  transformed by a curve into a 1D DataFrame, then a clustering algorithm
  separates the points into colour regions.
- **Scene family**: 2D→1D transform + clustering.
- **Reduced-motion**: A static grid with three clusters.
- **Implementation size**: Medium.

#### Three.js · KaTeX
- **Visual metaphor**: "Projection Pipeline" — the same 4D→3D
  stereographic projection from the BSc thesis, but as a live demo on the
  hero. KaTeX equations float beside the 3D nodes.
- **Scene family**: Multi-dimensional projection.
- **Reduced-motion**: A static hypercube with one floating equation.
- **Implementation size**: Large (depends on existing visualizer).

### Tools & Practices

#### REST APIs · JWT auth · CSRF
- **Visual metaphor**: A token-shaped packet (small rectangular slab)
  sits inside a request envelope; the receiving endpoint stamps the token
  to verify authenticity. CSRF is a small secondary token that the
  endpoint checks for parity.
- **Scene family**: Authenticated request envelope.
- **Reduced-motion**: One envelope with a token visible.
- **Implementation size**: Small.

#### Playwright · Nginx
- **Visual metaphor**: A headless browser puppet that walks the page
  topology; Nginx is a small reverse-proxy arrow that sits in front of the
  routing.
- **Scene family**: Browser-puppet + proxy.
- **Reduced-motion**: A static browser puppet pointing at the topology.
- **Implementation size**: Medium.

#### Linux (Ubuntu)
- **Visual metaphor**: A terminal window sprite with a command line
  blinking. A small penguin icon (subtle, monochrome) sits at the corner.
- **Scene family**: Single terminal sprite.
- **Reduced-motion**: A single terminal sprite with one prompt visible.
- **Implementation size**: Small.

#### PostgreSQL · MySQL · SQLite
- **Visual metaphor**: Three database cylinders of different sizes —
  Postgres (largest, with extensions radiating), MySQL (medium, with a
  fork glyph), SQLite (small, with a single-file icon).
- **Scene family**: Database cluster.
- **Reduced-motion**: Three static cylinders.
- **Implementation size**: Small.

#### Eloquent · structured logging
- **Visual metaphor**: A small journal that opens to log entries; each
  entry is a tiny radiating ring. Eloquent is a query builder that turns
  typed method calls into SQL.
- **Scene family**: Logging + query builder.
- **Reduced-motion**: A static journal with one open entry.
- **Implementation size**: Small.

---

## 2. Hero & Camera Choreography

| Scroll position         | Camera focus                  | `emphasis`                |
| ----------------------- | ----------------------------- | ------------------------- |
| Top (`#top`)            | `(0, 0, 14)` → origin         | All 1.0 (hero composition)|
| `#about`                | dolly along x, slight zoom    | All 0.85, follows mouse   |
| `#deployed` / `#work`   | dolly along x                 | All 0.85                  |
| `#experience`           | dolly along x                 | All 0.85                  |
| `#skills`               | `(0, 0.8, 7.8)` → system      | Git 0.85, System 1.25, CI/CD 0.85 |
| `#education` / `#contact`| pull back to hero pose        | All 1.0                   |

When the user hovers or focuses a skill with `data-scene="git|system|cicd"`,
the camera lerps to that scene's pose (see `FOCUS` in `shipping-machine.js`)
and the `emphasis` distribution updates.

---

## 3. Roadmap — Priority Order

### Phase 1 — Shipped Now
- ✅ **Git — Parallel Universes** (Medium)
- ✅ **System Design — Request Odyssey** (Large)
- ✅ **CI/CD — Shipping Line** (Medium)
- ✅ **Hero composition** — three scenes visible together (Medium)
- ✅ **Skill hover/focus → scene emphasis** (Small)
- ✅ **Scroll-driven focus** (Small)
- ✅ **Reduced-motion fallback** (Small)
- ✅ **WebGL failure fallback** (Small)
- ✅ **Mobile density reduction** (Small)

### Phase 2 — Next 5 Most Valuable Skills
1. **Vue 3** — "Reactive Mesh" — a small lattice of nodes that re-renders
   when user clicks, with a packet flowing through bindings. (Medium)
2. **Laravel 13** — "Eloquent Garden" — a database schema as a flowering
   tree, with migrations pruning/growing branches. (Medium)
3. **FastAPI** — "Async Highway" — a request corridor with multiple lanes
   that load balance themselves visually. (Medium)
4. **Three.js** — "Projection Pipeline" — a camera that demos the same
   4D→3D stereographic projection that the BSc thesis uses. (Large)
5. **AI Vision** — "Signal Mirror" — a TradingView chart sprite being
   parsed by a beam of light that returns structured trade signals.
   (Medium)

### Phase 3 — Long Tail
- **PHP, Python, SQL, TypeScript, JavaScript** — too similar to group as
  separate scenes. Could share a "Languages" scene with code particles
  morphing through syntax. (Small)
- **PostgreSQL / MySQL / SQLite** — share a "Database" scene with three
  distinct storage geometries. (Medium)
- **Playwright** — a tiny "headless browser" puppet that walks the
  portfolio. (Medium)
- **Filament** — a "panel assembly" scene where admin widgets snap together
  like Lego. (Small)

---

## 4. Shared Components (Build Once, Reuse Everywhere)

- `createNode({ radius, color, haloColor, shape, wireframe, halo })` —
  used for every node in all three scenes.
- `createFlowPath(a, b, color, { bow, sag, thickness, opacity })` — used
  for every rail / edge.
- `createPacket(color, size)` — used for every moving packet.
- `createLabel(text, color, size)` — used for every label.
- `createPulse(color)` — used for every pulse ring.
- `makeArc(a, b, bow, sag)` — internal helper used by `createFlowPath` and
  `buildNetworkPath`.

If Phase 2 ships, each new scene should not introduce new primitives unless
none of the existing ones work for the new visual story.

---

## 5. Complexity Estimates

| Scene / feature                       | Estimate |
| ------------------------------------- | -------- |
| Git — Parallel Universes              | Medium   |
| System Design — Request Odyssey       | Large    |
| CI/CD — Shipping Line                 | Medium   |
| Hero composition (three scenes + starfield + baseplate) | Medium |
| Skill hover/focus → scene emphasis    | Small    |
| Scroll-driven focus                   | Small    |
| Reduced-motion fallback               | Small    |
| WebGL failure fallback                | Small    |
| Mobile density reduction              | Small    |

Total Phase 1 ≈ 1 Large + 4 Medium + 4 Small.

---

## 6. Maintenance Notes

- **Do not** add a third-party orbit controls, GSAP camera, or post-processing
  pipeline. The current hand-rolled lerp is intentional — it keeps the
  integration with `prefers-reduced-motion` and `webglcontextlost` simple.
- **Do not** introduce a build step. The scene system is a single self-
  contained `shipping-machine.js` file that runs in the browser directly.
- **Do not** add per-frame allocations inside the `update()` methods. All
  three.js objects are created once at init.
- **Do not** add `pointer-events` to the canvas. The whole point is for
  foreground interactions to never be blocked.
- **Always** update `portfolio.html` and `index.html` together. They are
  expected to be byte-identical for the user-facing content.
