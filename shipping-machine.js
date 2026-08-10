/* ============================================================================
 *  CINEMA OF CODE — THE SHIPPING MACHINE
 *  A miniature, cinematic 3D world that visualizes how software is designed,
 *  built, tested, versioned, deployed, and operated.
 *
 *  Three scenes share one cohesive world at different X positions:
 *    - Git          (x = -6)   "Parallel Universes"
 *    - System Design (x =  0)  "The Request Odyssey"
 *    - CI/CD         (x = +6)  "The Shipping Line"
 *
 *  Hero shows the full triptych. Scroll progress and skill hover/focus
 *  smoothly steer the camera between scenes.
 *  ============================================================================ */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('[shipping-machine] THREE.js missing — falling back to static composition.');
    return;
  }

  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  // ----- device / motion preferences -----
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 720px)').matches;

  // ----- renderer -----
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    console.warn('[shipping-machine] WebGL init failed:', e);
    canvas.style.display = 'none';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x070a14, 0);

  // ----- shared scene + camera -----
  const SCENE = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  // ----- palette -----
  const COLOR = {
    gold: new THREE.Color(0xe8d39e),
    gold2: new THREE.Color(0xc9a76a),
    cyan: new THREE.Color(0x7fc8d8),
    cyan2: new THREE.Color(0x5fa9bb),
    red: new THREE.Color(0xe54d42),
    ink: new THREE.Color(0xf4ecd8),
    line: new THREE.Color(0x1a2238),
  };

  /* ---------- shared primitives / factory ---------- */

  // small glowing node (octahedron + halo sprite)
  const SPRITE_HALO = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.25, 'rgba(232,211,158,0.5)');
    g.addColorStop(0.55, 'rgba(127,200,216,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const spriteHaloCyan = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(220,240,245,0.8)');
    g.addColorStop(0.4, 'rgba(127,200,216,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  function createNode(opts = {}) {
    const {
      radius = 0.22,
      color = 0xe8d39e,
      emissive = 0x7fc8d8,
      wireframe = true,
      shape = 'octa', // 'octa' | 'icosa' | 'tetra'
      halo = true,
      haloColor = 0xe8d39e,
    } = opts;

    let geo;
    if (shape === 'icosa') geo = new THREE.IcosahedronGeometry(radius, 0);
    else if (shape === 'tetra') geo = new THREE.TetrahedronGeometry(radius, 0);
    else geo = new THREE.OctahedronGeometry(radius, 0);

    const mat = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: wireframe,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isNode = true;

    if (halo) {
      const haloMat = new THREE.SpriteMaterial({
        map: haloColor === 0x7fc8d8 ? spriteHaloCyan : SPRITE_HALO,
        color: haloColor,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloSprite = new THREE.Sprite(haloMat);
      haloSprite.scale.set(radius * 6, radius * 6, 1);
      mesh.add(haloSprite);
      mesh.userData.halo = haloSprite;
    }

    return mesh;
  }

  // smooth curve between two 3D points with a slight bow
  function makeArc(a, b, bow = 0.4, sag = 0) {
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mid.x += (b.x - a.x) * bow * 0.2;
    mid.y += sag;
    mid.z += bow;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    return curve;
  }

  // dashed / dotted line via shader-line: we use a thin TubeGeometry so it renders crisply
  function createFlowPath(a, b, color = 0xe8d39e, opts = {}) {
    const {
      bow = 0.4,
      sag = 0,
      thickness = 0.012,
      opacity = 0.35,
      dashed = false,
    } = opts;
    const curve = makeArc(a, b, bow, sag);
    const tube = new THREE.TubeGeometry(curve, 64, thickness, 8, false);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(tube, mat);
    mesh.userData.curve = curve;
    return mesh;
  }

  // moving packet along a curve
  function createPacket(color = 0xe8d39e, size = 0.085) {
    const geo = new THREE.SphereGeometry(size, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(new THREE.PointLight(color, 0.6, 1.6, 2));
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: color === 0x7fc8d8 ? spriteHaloCyan : SPRITE_HALO,
        color: color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.set(size * 12, size * 12, 1);
    mesh.add(halo);
    return mesh;
  }

  // small label sprite using canvas (used sparingly)
  function createLabel(text, color = '#9aa3b8', size = 12) {
    const c = document.createElement('canvas');
    const w = 256, h = 64;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(7,10,20,0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.4, 1);
    return sprite;
  }

  // expanded pulse ring (used for commits, deploys, resolutions)
  function createPulse(color = 0xe8d39e) {
    const geo = new THREE.RingGeometry(0.05, 0.08, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.userData.life = 0;
    ring.userData.color = color;
    return ring;
  }

  // travel a packet along a curve, looping
  function rideCurve(curve, t) {
    const tt = (t % 1 + 1) % 1;
    return curve.getPoint(tt);
  }

  /* ---------- Schematic primitives for the System Design scene ----------
   * The System Design scene is a clean schematic diagram, not a 3D diorama.
   *
   * Strategy:
   *  - A tilted plane (the "schematic surface") with a subtle grid as
   *    the canvas texture. It reads as a circuit board / PCB.
   *  - Each component is a sharp 2D icon drawn on a canvas (crisp at any
   *    zoom) plus a small label. The icon does the visual work; the label
   *    confirms what it is.
   *  - Edges are right-angle PCB traces (L-shaped TubeGeometry) drawn on
   *    the plane. They use right angles, not curves, for an engineering
   *    schematic feel.
   *  - The request packet is a glowing gold orb that traces the path.
   *    As it passes, the edge under it brightens.
   *  - The cache fast lane is a brighter, slightly elevated arc.
   *  - The whole plane is tilted ~25° on the X axis so it has 3D depth.
   *  - Camera slowly translates across the schematic.
   */
  function makeSchematicGridTexture(width = 1024, height = 512) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    // base
    ctx.fillStyle = '#0b1024';
    ctx.fillRect(0, 0, width, height);
    // subtle border vignette
    const g = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
    g.addColorStop(0, 'rgba(14, 20, 36, 0.0)');
    g.addColorStop(1, 'rgba(7, 10, 20, 0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    // grid lines (PCB style — small dots at intersections)
    const step = 32;
    ctx.strokeStyle = 'rgba(232, 211, 158, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(width, y + 0.5); ctx.stroke();
    }
    // dotted intersections (slightly brighter)
    ctx.fillStyle = 'rgba(127, 200, 216, 0.08)';
    for (let x = 0; x <= width; x += step) {
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Build a sharp 2D icon sprite. Each icon is a small monochrome drawing
  // on a rounded square background. Returns a sprite group (sprite + label).
  function makeIconSprite({ icon, label, color = 0xe8d39e, w = 0.55 }) {
    const size = 192;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    // rounded square background
    const cx = size / 2, cy = size / 2;
    const r = 24;
    const pad = 12;
    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.lineTo(size - pad - r, pad);
    ctx.quadraticCurveTo(size - pad, pad, size - pad, pad + r);
    ctx.lineTo(size - pad, size - pad - r);
    ctx.quadraticCurveTo(size - pad, size - pad, size - pad - r, size - pad);
    ctx.lineTo(pad + r, size - pad);
    ctx.quadraticCurveTo(pad, size - pad, pad, size - pad - r);
    ctx.lineTo(pad, pad + r);
    ctx.quadraticCurveTo(pad, pad, pad + r, pad);
    ctx.closePath();
    ctx.fillStyle = color === 0x7fc8d8 ? 'rgba(127, 200, 216, 0.12)' : 'rgba(232, 211, 158, 0.12)';
    ctx.fill();
    ctx.strokeStyle = color === 0x7fc8d8 ? 'rgba(127, 200, 216, 0.8)' : 'rgba(232, 211, 158, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // draw the icon glyph — each icon is a small function that draws
    // into the canvas context. The icon function knows how to draw itself.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color === 0x7fc8d8 ? '#7fc8d8' : '#e8d39e';
    ctx.fillStyle = color === 0x7fc8d8 ? '#7fc8d8' : '#e8d39e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    icon(ctx);
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(w, w, 1);
    return sprite;
  }

  // ---- The actual icon glyphs (each draws centered at 0,0, ~70px wide) ----
  const ICONS = {
    client: (ctx) => {
      // a small monitor / device
      ctx.strokeRect(-32, -22, 64, 40);
      ctx.beginPath(); ctx.moveTo(-12, 22); ctx.lineTo(12, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, 18); ctx.lineTo(20, 18); ctx.stroke();
    },
    edge: (ctx) => {
      // a partial ring / shield perimeter
      ctx.beginPath();
      ctx.arc(0, 0, 30, Math.PI * 0.3, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 30, Math.PI * 1.3, Math.PI * 2.7);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    },
    dns: (ctx) => {
      // a small tree: root + 2 branches + 3 leaves
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 30, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-22, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke();
      ctx.beginPath(); ctx.arc(-22, -22, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(22, -22, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -26, 5, 0, Math.PI * 2); ctx.fill();
    },
    gateway: (ctx) => {
      // a portcullis: a rectangle with 4 vertical bars
      ctx.strokeRect(-28, -26, 56, 52);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 10, -22); ctx.lineTo(i * 10, 22); ctx.stroke();
      }
    },
    lb: (ctx) => {
      // a Y: one input at top, two outputs at bottom-left and bottom-right
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(0, -4);
      ctx.lineTo(-22, 24);
      ctx.moveTo(0, -4);
      ctx.lineTo(22, 24);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -28, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-22, 24, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(22, 24, 5, 0, Math.PI * 2); ctx.fill();
    },
    service: (ctx) => {
      // 3 stacked horizontal bars (microservice icons)
      ctx.strokeRect(-26, -22, 52, 12);
      ctx.strokeRect(-26, -6, 52, 12);
      ctx.strokeRect(-26, 10, 52, 12);
    },
    cache: (ctx) => {
      // 3 stacked discs (L1/L2/L3)
      ctx.beginPath(); ctx.ellipse(0, -14, 26, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(-26, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(26, -14); ctx.lineTo(26, 0); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(26, 14); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 14, 26, 6, 0, 0, Math.PI * 2); ctx.stroke();
    },
    db: (ctx) => {
      // the iconic database drum: a cylinder seen slightly from above
      ctx.beginPath(); ctx.ellipse(0, -22, 22, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -22); ctx.lineTo(-22, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22, -22); ctx.lineTo(22, 22); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 22, 22, 6, 0, 0, Math.PI * 2); ctx.stroke();
      // two horizontal row-lines
      ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(22, 8); ctx.stroke();
    },
    queue: (ctx) => {
      // 4 small boxes in a row (FIFO)
      const boxes = [-2, -0.7, 0.7, 2];
      boxes.forEach((b) => {
        ctx.strokeRect(b * 10 - 6, -12, 18, 24);
      });
      // arrow
      ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(34, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, -3); ctx.lineTo(34, 0); ctx.lineTo(30, 3); ctx.stroke();
    },
    worker: (ctx) => {
      // a gear: a hexagonal hub with 6 teeth
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 22;
        const y = Math.sin(a) * 22;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      // 6 small "teeth" outside
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22);
        ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    },
    auth: (ctx) => {
      // a shield outline
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(22, -16);
      ctx.lineTo(22, 6);
      ctx.quadraticCurveTo(22, 22, 0, 28);
      ctx.quadraticCurveTo(-22, 22, -22, 6);
      ctx.lineTo(-22, -16);
      ctx.closePath();
      ctx.stroke();
      // a small keyhole
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke();
    },
    obs: (ctx) => {
      // an eye outline
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.quadraticCurveTo(0, -18, 28, 0);
      ctx.quadraticCurveTo(0, 18, -28, 0);
      ctx.stroke();
      // pupil
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    },
    origin: (ctx) => {
      // a small globe (just a circle with a meridian)
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke();
    },
    user: (ctx) => {
      // a generic user / API caller
      ctx.beginPath(); ctx.arc(0, -8, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, 22); ctx.quadraticCurveTo(0, 4, 16, 22); ctx.stroke();
    },
  };

  // Build a labeled icon node sprite (icon + small label below)
  function makeIconNode(name, color, x, y, z = 0) {
    const grp = new THREE.Group();
    const sprite = makeIconSprite({ icon: ICONS[name], label: name, color, w: 0.55 });
    grp.add(sprite);
    // label below
    const label = createLabel(name.toUpperCase(), name === 'client' || name === 'edge' || name === 'dns' || name === 'db' || name === 'queue' || name === 'worker' || name === 'auth' || name === 'obs' || name === 'origin' ? '#7fc8d8' : '#e8d39e', 14);
    label.scale.set(1.2, 0.32, 1);
    label.position.set(0, -0.42, 0);
    grp.add(label);
    grp.position.set(x, y, z);
    return grp;
  }

  // Build a right-angle edge between two 3D points on the schematic plane.
  // We do L-shape: from a, go horizontally to b.x, then vertically to b.
  // Returns a mesh (a thin tube along the L path) and userData.curve.
  function makeRightAngleEdge(a, b, color = 0xe8d39e, opts = {}) {
    const { thickness = 0.012, opacity = 0.6, lift = 0 } = opts;
    const mid = new THREE.Vector3(a.x, b.y, a.z + lift);
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    const tube = new THREE.TubeGeometry(curve, 16, thickness, 6, false);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(tube, mat);
    mesh.userData.curve = curve;
    mesh.userData.from = a.clone();
    mesh.userData.to = b.clone();
    return mesh;
  }

  /* ---------- SCENE 01 · Git Scene — "Parallel Universes" ---------- */
  function buildGitScene(group) {
    const ROOT = new THREE.Group();
    ROOT.position.set(-6, 0, 0);
    group.add(ROOT);

    const mainPath = createFlowPath(new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0), COLOR.gold, { thickness: 0.02, opacity: 0.8 });
    ROOT.add(mainPath);

    const featureArc = createFlowPath(new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(1.2, 0, 0), COLOR.cyan, { bow: 0.8, sag: 0.5, thickness: 0.015 });
    ROOT.add(featureArc);

    const commit1 = createNode({ radius: 0.18, color: 0xe8d39e, shape: 'octa' });
    commit1.position.set(-1.5, 0, 0);
    ROOT.add(commit1);

    const commit2 = createNode({ radius: 0.18, color: 0x7fc8d8, shape: 'octa' });
    commit2.position.set(0, 0.6, 0.4);
    ROOT.add(commit2);

    const commit3 = createNode({ radius: 0.2, color: 0xe8d39e, shape: 'octa' });
    commit3.position.set(1.5, 0, 0);
    ROOT.add(commit3);

    return {
      update(dt, time, emphasis = 1) {
        ROOT.rotation.y = time * 0.1 * emphasis;
      },
    };
  }

  /* ---------- SCENE 02 · System Design — "The Request Odyssey" ----------
   * A clean schematic diagram. The plane is tilted ~25° so it has 3D
   * depth. Components are sharp 2D icons with labels. Edges are right-
   * angle traces. The packet is a glowing gold orb that traces the path.
   */
  function buildSystemScene(group) {
    const ROOT = new THREE.Group();
    ROOT.position.x = 0;
    group.add(ROOT);

    // The schematic plane — tilted slightly around X so it has 3D depth
    const planeTex = makeSchematicGridTexture(1024, 512);
    const planeMat = new THREE.MeshBasicMaterial({
      map: planeTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const planeGeo = new THREE.PlaneGeometry(11, 5.5);
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2.4; // tilt ~25° up away from camera
    plane.position.y = 0;
    ROOT.add(plane);

    // The schematic plane sits at y=0. All components are parented to the
    // plane's local frame so they rotate with it. We use a child group.
    const planeGroup = new THREE.Group();
    plane.add(planeGroup);

    // ---- Component layout on the schematic plane ----
    // The plane is 11 wide × 5.5 deep in plane-local coords. We lay out
    // nodes in a clear two-tier grid.
    // Coordinate space: x ∈ [-5, 5], y ∈ [-2, 2] (in plane-local).
    const NODES = [
      // Left edge: client → edge → dns
      { name: 'client',  color: 0x7fc8d8, x: -4.6, y:  0.4 },
      { name: 'edge',    color: 0x7fc8d8, x: -3.6, y:  1.2 },
      { name: 'dns',     color: 0x7fc8d8, x: -2.6, y:  0.0 },
      // Middle: gateway → load balancer
      { name: 'gateway', color: 0xe8d39e, x: -1.4, y: -0.2 },
      { name: 'lb',      color: 0xe8d39e, x: -0.2, y:  0.6 },
      // Service cluster (3 instances, arranged horizontally)
      { name: 'service', color: 0xe8d39e, x:  1.2, y:  0.4 },
      { name: 'service', color: 0xe8d39e, x:  1.2, y: -0.4 },
      { name: 'service', color: 0xe8d39e, x:  1.2, y: -1.2 },
      // Right: cache (top), auth (mid-low), db (right-up), queue (right-low), worker (far low), obs (far up)
      { name: 'cache',   color: 0xe8d39e, x:  2.6, y:  1.5 },
      { name: 'auth',    color: 0x7fc8d8, x:  2.6, y: -0.6 },
      { name: 'db',      color: 0x7fc8d8, x:  4.0, y:  1.0 },
      { name: 'queue',   color: 0x7fc8d8, x:  4.0, y: -1.0 },
      { name: 'worker',  color: 0x7fc8d8, x:  4.8, y: -1.7 },
      { name: 'obs',     color: 0x9aa3b8, x:  4.8, y:  1.7 },
    ];

    // Three service cluster gets a subtle label
    const serviceNodes = [];
    const nodeGroups = {};
    NODES.forEach((n, i) => {
      const g = makeIconNode(n.name, n.color, n.x, n.y, 0.01);
      planeGroup.add(g);
      nodeGroups[n.name + (n.name === 'service' ? '-' + serviceNodes.length : '')] = g;
      if (n.name === 'service') serviceNodes.push(g);
    });

    // ---- Edges (right-angle PCB traces) ----
    const edgeMeshes = [];
    function addEdge(fromKey, toKey, color, opts = {}) {
      const a = findNodeCenter(fromKey);
      const b = findNodeCenter(toKey);
      const m = makeRightAngleEdge(a, b, color, opts);
      planeGroup.add(m);
      edgeMeshes.push(m);
      return m;
    }
    function findNodeCenter(key) {
      // resolve key like "service-0", "service-1", "service-2"
      const parts = key.split('-');
      const idx = parts.length > 1 ? parseInt(parts[1], 10) : null;
      const n = NODES.find((nn, i) => {
        if (idx !== null) {
          let count = 0;
          for (let j = 0; j <= i; j++) {
            if (NODES[j].name === 'service') {
              if (count === idx) {
                return j === i;
              }
              count++;
            }
          }
          return false;
        }
        return nn.name === key && !NODES.slice(0, i).some((p) => p.name === key);
      });
      if (!n) return new THREE.Vector3(0, 0, 0.01);
      return new THREE.Vector3(n.x, n.y, 0.015);
    }

    // Main request path
    addEdge('client', 'edge', 0x7fc8d8);
    addEdge('edge', 'dns', 0x7fc8d8);
    addEdge('dns', 'gateway', 0x7fc8d8);
    addEdge('gateway', 'lb', 0xe8d39e);
    // LB fans out to 3 service instances
    addEdge('lb', 'service-0', 0xe8d39e);
    addEdge('lb', 'service-1', 0xe8d39e);
    addEdge('lb', 'service-2', 0xe8d39e);
    // Service[1] connects to cache, db, queue, auth
    addEdge('service-1', 'cache', 0xe8d39e);
    addEdge('service-1', 'db', 0x7fc8d8);
    addEdge('service-1', 'queue', 0x7fc8d8);
    addEdge('service-1', 'auth', 0x7fc8d8);
    // queue → worker
    addEdge('queue', 'worker', 0x7fc8d8);
    // observability taps
    addEdge('service-0', 'obs', 0x9aa3b8, { opacity: 0.4 });
    addEdge('service-2', 'obs', 0x9aa3b8, { opacity: 0.4 });
    addEdge('db', 'obs', 0x9aa3b8, { opacity: 0.4 });
    addEdge('worker', 'obs', 0x9aa3b8, { opacity: 0.4 });

    // ---- Cache fast-lane: gateway → cache, brighter, slightly lifted ----
    const cacheFast = makeRightAngleEdge(
      findNodeCenter('gateway'),
      findNodeCenter('cache'),
      0xe8d39e,
      { lift: 0.04, thickness: 0.022, opacity: 0.85 }
    );
    planeGroup.add(cacheFast);
    // dashed-look companion
    const cacheFastDash = makeRightAngleEdge(
      findNodeCenter('gateway'),
      findNodeCenter('cache'),
      0xe8d39e,
      { lift: 0.045, thickness: 0.008, opacity: 0.4 }
    );
    planeGroup.add(cacheFastDash);

    // ---- The request packet — a glowing gold orb that traces the path ----
    const requestPath = [
      'client', 'edge', 'dns', 'gateway', 'lb', 'service-1', 'db', 'service-1', 'gateway', 'dns', 'edge', 'client',
    ];
    // Pre-build the path as a 3D polyline
    const path3D = requestPath.map(findNodeCenter);
    // build a continuous Catmull-Rom curve
    const requestCurve = new THREE.CatmullRomCurve3(path3D);
    const requestPacket = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xe8d39e, transparent: true, opacity: 0.95 })
    );
    const packetHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: SPRITE_HALO,
        color: 0xe8d39e,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    packetHalo.scale.set(0.5, 0.5, 1);
    requestPacket.add(packetHalo);
    // add a point light so the packet glows on the plane
    requestPacket.add(new THREE.PointLight(0xe8d39e, 0.8, 1.2, 2));
    // lift the packet slightly above the plane
    requestPacket.position.set(0, 0, 0.05);
    planeGroup.add(requestPacket);

    // ---- Cache hit packet — takes the fast lane ----
    const cachePath3D = [findNodeCenter('gateway'), findNodeCenter('cache'), findNodeCenter('gateway')];
    const cacheCurve = new THREE.CatmullRomCurve3(cachePath3D);
    const cachePacket = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe8d39e, transparent: true, opacity: 0.8 })
    );
    const cachePacketHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: SPRITE_HALO,
        color: 0xe8d39e,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    cachePacketHalo.scale.set(0.4, 0.4, 1);
    cachePacket.add(cachePacketHalo);
    // offset the cache packet slightly along the lifted fast-lane
    cachePacket.position.set(0, 0, 0.08);
    planeGroup.add(cachePacket);

    // ---- Worker packet — async job ----
    const workerPath3D = [findNodeCenter('queue'), findNodeCenter('worker'), findNodeCenter('queue')];
    const workerCurve = new THREE.CatmullRomCurve3(workerPath3D);
    const workerPacket = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x7fc8d8, transparent: true, opacity: 0.85 })
    );
    const workerPacketHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: spriteHaloCyan,
        color: 0x7fc8d8,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    workerPacketHalo.scale.set(0.35, 0.35, 1);
    workerPacket.add(workerPacketHalo);
    workerPacket.position.set(0, 0, 0.05);
    planeGroup.add(workerPacket);

    // ---- Observability particles — small dots streaming from service/db/worker to obs ----
    const obsParticles = [];
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x9aa3b8, transparent: true, opacity: 0.8 })
      );
      p.userData = { t: i / 8, speed: 0.15 };
      planeGroup.add(p);
      obsParticles.push(p);
    }

    // ---- LB dispatch packets: one per service instance, so the LB visibly fans out ----
    const lbDispatchPackets = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xe8d39e, transparent: true, opacity: 0.8 })
      );
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: SPRITE_HALO,
          color: 0xe8d39e,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      halo.scale.set(0.3, 0.3, 1);
      p.add(halo);
      planeGroup.add(p);
      const path = new THREE.CatmullRomCurve3([
        findNodeCenter('lb'),
        findNodeCenter(`service-${i}`),
      ]);
      lbDispatchPackets.push({ mesh: p, curve: path });
    }

    // ---- Auto-scaling: a 4th service instance fades in under load ----
    const scaleNode = makeIconNode('service', 0xe8d39e, 1.2, -2.0, 0.01);
    scaleNode.scale.setScalar(0.85);
    scaleNode.traverse((c) => {
      if (c.material && c.material.opacity !== undefined) c.material.opacity = 0;
    });
    planeGroup.add(scaleNode);

    // ---- "live" indicators — a small bright dot on each service instance ----
    // (the rest of the dashboard)

    // ---- path-light update: track the closest edge to the packet and brighten it ----
    // (we'll do this in the update loop)

    return {
      group: ROOT,
      update(dt, time, emphasis) {
        // request packet traces the full path
        const tReq = (time * 0.07) % 1;
        requestPacket.position.copy(requestCurve.getPoint(tReq));

        // cache hit packet takes the fast lane
        const tCache = ((time + 0.5) * 0.18) % 1;
        cachePacket.position.copy(cacheCurve.getPoint(tCache));

        // worker packet
        const tWorker = (time * 0.11) % 1;
        workerPacket.position.copy(workerCurve.getPoint(tWorker));

        // observability particles — each does a small loop from a service to obs
        obsParticles.forEach((p, i) => {
          p.userData.t += dt * p.userData.speed;
          const t = (p.userData.t % 1 + 1) % 1;
          // alternate sources: service, db, worker
          const source = i % 2 === 0 ? findNodeCenter('service-1') : findNodeCenter('db');
          const obs = findNodeCenter('obs');
          const a = source.clone();
          const b = obs.clone();
          p.position.lerpVectors(a, b, t);
        });

        // LB dispatch packets — each cycles through its lb→service branch
        lbDispatchPackets.forEach((p, idx) => {
          const t = ((time * 0.14 + idx * 0.33) % 1 + 1) % 1;
          p.mesh.position.copy(p.curve.getPoint(t));
        });

        // auto-scaling: fades in around 70% of the 6s cycle
        const scaleCycle = (time / 6) % 1;
        let scaleVis = 0;
        if (scaleCycle > 0.7 && scaleCycle < 0.95) scaleVis = (scaleCycle - 0.7) / 0.1;
        else if (scaleCycle >= 0.95) scaleVis = (1 - scaleCycle) / 0.05;
        scaleVis = Math.min(1, Math.max(0, scaleVis));
        scaleNode.traverse((c) => {
          if (c.material && c.material.opacity !== undefined) {
            const isSprite = c.type === 'Sprite';
            const baseOp = isSprite ? 0.95 : 0.95;
            c.material.opacity = baseOp * scaleVis * 0.8;
          }
        });

        // gentle plane breathe
        const breathe = 1 + Math.sin(time * 0.4) * 0.012 * emphasis;
        planeGroup.scale.setScalar(breathe);
      },
      setVisibility(v) {
        ROOT.visible = v > 0.01;
      },
    };
  }
  /* ---------- SCENE 03 · CI/CD — "The Shipping Line" ---------- */
  function buildCICDScene(group) {
    const ROOT = new THREE.Group();
    ROOT.position.x = 6;
    group.add(ROOT);

    // horizontal pipeline of 7 stages
    const stages = [
      { name: 'INSTALL',  color: 0x7fc8d8, x: -3.6 },
      { name: 'LINT',     color: 0x7fc8d8, x: -2.4 },
      { name: 'TEST',     color: 0xe8d39e, x: -1.2 },
      { name: 'BUILD',    color: 0xe8d39e, x:  0.0 },
      { name: 'SECURITY', color: 0xe8d39e, x:  1.2 },
      { name: 'PACKAGE',  color: 0xe8d39e, x:  2.4 },
      { name: 'DEPLOY',   color: 0xe8d39e, x:  3.6 },
    ];

    const stageNodes = [];
    stages.forEach((s, i) => {
      const node = createNode({
        radius: 0.32,
        color: s.color,
        haloColor: s.color,
        shape: 'icosa',
      });
      node.position.set(s.x, 0, 0);
      node.userData.state = 'idle'; // idle | pass | fail
      node.material.opacity = 0.45;
      ROOT.add(node);

      const label = createLabel(s.name, '#9aa3b8', 12);
      label.position.set(s.x, -0.7, 0);
      ROOT.add(label);

      stageNodes.push(node);
    });

    // connector rails between stages
    const rails = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const a = new THREE.Vector3(stages[i].x + 0.32, 0, 0);
      const b = new THREE.Vector3(stages[i + 1].x - 0.32, 0, 0);
      const r = createFlowPath(a, b, 0xe8d39e, { bow: 0.05, thickness: 0.012, opacity: 0.35 });
      ROOT.add(r);
      rails.push(r);
    }

    // incoming commit packet (enters from the left)
    const entryPos = new THREE.Vector3(-4.6, 0, 0);
    const commit = createNode({
      radius: 0.18, color: 0xe8d39e, haloColor: 0xe8d39e, shape: 'octa',
    });
    commit.position.copy(entryPos);
    ROOT.add(commit);
    const commitLabel = createLabel('commit', '#e8d39e', 13);
    commitLabel.position.set(-4.6, -0.5, 0);
    ROOT.add(commitLabel);

    // the packet that travels the pipeline
    const packet = createPacket(0xe8d39e, 0.09);
    packet.position.copy(entryPos);
    ROOT.add(packet);

    // bug easter egg: a small red tetra traveling with the packet; gets ejected at "LINT"
    const bug = createNode({ radius: 0.06, color: 0xe54d42, halo: true, haloColor: 0xe54d42, shape: 'tetra' });
    bug.visible = false;
    ROOT.add(bug);

    // deploy artifact at the far right
    const deployProd = new THREE.Vector3(4.6, 0, 0);
    const deployNode = createNode({ radius: 0.22, color: 0x7fc8d8, haloColor: 0x7fc8d8, shape: 'icosa' });
    deployNode.position.copy(deployProd);
    ROOT.add(deployNode);
    const deployLabel = createLabel('PROD', '#7fc8d8', 13);
    deployLabel.position.set(4.6, -0.55, 0);
    ROOT.add(deployLabel);

    // final rail from DEPLOY stage to PROD
    const finalRail = createFlowPath(
      new THREE.Vector3(3.92, 0, 0),
      new THREE.Vector3(4.38, 0, 0),
      0xe8d39e,
      { bow: 0.05, thickness: 0.012, opacity: 0.4 }
    );
    ROOT.add(finalRail);

    // release marker (v1.0.0) — appears after deploy
    const release = createLabel('v1.0.0', '#e8d39e', 16);
    release.position.set(4.6, 0.7, 0);
    release.material.opacity = 0;
    ROOT.add(release);

    // 3 production nodes (cluster) — small cyan dots above
    const prodNodes = [];
    for (let i = 0; i < 3; i++) {
      const p = createNode({ radius: 0.08, color: 0x7fc8d8, haloColor: 0x7fc8d8 });
      p.position.set(4.2 + i * 0.3, 0.9, 0);
      ROOT.add(p);
      prodNodes.push(p);
    }

    // graceful rollback: a dashed backwards arrow formed by a small chevron that animates left
    const rollback = createNode({ radius: 0.07, color: 0x9aa3b8, halo: false, shape: 'tetra' });
    rollback.rotation.z = Math.PI;
    rollback.visible = false;
    ROOT.add(rollback);

    // health-check pulse
    const deployPulse = createPulse(0xe8d39e);
    deployPulse.position.copy(deployProd);
    deployPulse.visible = false;
    ROOT.add(deployPulse);

    // cycle: 12s long. Stages: 0..0.6 (advance), 0.6..0.8 (lint error), 0.8..0.95 (recover), 0.95..1.0 (deploy)
    return {
      group: ROOT,
      update(dt, time, emphasis) {
        const cycle = (time % 12) / 12;
        const packetX = (() => {
          // overall packet progress along stages
          if (cycle < 0.6) {
            // 0..0.6 -> travel through 7 stages
            const t = cycle / 0.6;
            // stages occupy ranges 0..1 across 6 intervals
            return -4.6 + t * 8.2;
          }
          if (cycle < 0.8) {
            // held at stage 1 (LINT) during error
            return -4.6 + (1 / 6) * 8.2;
          }
          if (cycle < 0.95) {
            // recover: jump back to start, retry
            const t = (cycle - 0.8) / 0.15;
            return -4.6 + t * 8.2;
          }
          // deploy surge
          return 3.6;
        })();

        packet.position.x = packetX;
        packet.position.y = Math.sin(time * 4) * 0.05;

        // stage states
        for (let i = 0; i < stages.length; i++) {
          const stagePos = -4.6 + (i / 6) * 8.2;
          let state = 'idle';
          if (packetX >= stagePos + 0.05) state = 'pass';
          if (cycle >= 0.6 && cycle < 0.8 && i === 1) state = 'fail';
          if (cycle >= 0.8 && i === 1) state = 'idle';

          stageNodes[i].userData.state = state;
          if (state === 'pass') {
            stageNodes[i].material.opacity = 0.95;
            stageNodes[i].material.color.setHex(0xe8d39e);
          } else if (state === 'fail') {
            stageNodes[i].material.opacity = 1;
            stageNodes[i].material.color.setHex(0xe54d42);
            // small shake
            stageNodes[i].position.y = Math.sin(time * 30) * 0.04;
          } else {
            stageNodes[i].material.opacity = 0.45;
            stageNodes[i].material.color.setHex(stages[i].color);
            stageNodes[i].position.y = 0;
          }
        }

        // bug travels with the packet during 0.05..0.15 of cycle; gets ejected at LINT
        if (cycle > 0.05 && cycle < 0.65) {
          bug.visible = true;
          bug.position.x = packetX + 0.18;
          bug.position.y = 0.18 + Math.sin(time * 6) * 0.03;
          bug.rotation.x = time * 4;
          bug.rotation.y = time * 3;
        } else if (cycle >= 0.65 && cycle < 0.78) {
          // eject trajectory
          const k = (cycle - 0.65) / 0.13;
          bug.position.x = packetX + 0.18 + k * 1.5;
          bug.position.y = 0.18 + k * 0.9;
          bug.material.opacity = 1 - k;
        } else {
          bug.visible = false;
          bug.material.opacity = 1;
        }

        // release marker fade in/out
        if (cycle >= 0.95) {
          const k = Math.min(1, (cycle - 0.95) / 0.04);
          release.material.opacity = k * 0.95;
        } else {
          release.material.opacity = 0;
        }

        // deploy pulse
        if (cycle >= 0.95 && cycle < 0.98) {
          const k = (cycle - 0.95) / 0.03;
          deployPulse.visible = true;
          deployPulse.scale.setScalar(0.5 + k * 5);
          deployPulse.material.opacity = 0.7 * (1 - k);
        } else {
          deployPulse.visible = false;
        }

        // graceful rollback: at very end of cycle, a chevron travels back
        if (cycle > 0.92 && cycle < 0.97) {
          const k = (cycle - 0.92) / 0.05;
          rollback.visible = true;
          rollback.position.x = 4.6 - k * 9.2;
          rollback.position.y = 0.0;
          rollback.material.opacity = 0.5 * (1 - k);
        } else {
          rollback.visible = false;
        }

        // gentle group breathe
        const breathe = 1 + Math.sin(time * 0.5) * 0.02 * emphasis;
        ROOT.scale.setScalar(breathe);
      },
      setVisibility(v) {
        ROOT.visible = v > 0.01;
      },
    };
  }

  /* ---------- Hero (intro) scene group — the universe as a whole ---------- */
  // We add a soft starfield to give the world depth
  function buildStarfield(group) {
    const count = isMobile ? 240 : 480;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 18 + Math.random() * 28;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 8;
      const c = Math.random() > 0.4 ? COLOR.gold : COLOR.cyan;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  /* ============================================================================
   *  4D HYPERCUBE (TESSERACT) ENGINE
   *  Mathematical visualization of an n-dimensional hypercube in 4D space,
   *  projected dynamically down to 3D with double-rotation matrices (XW + YZ planes)
   *  and depth-weighted filament rendering.
   * ============================================================================ */
  function buildHypercubeEngine(parent) {
    const group = new THREE.Group();
    group.position.set(0, 0.8, 1.0); // Prominent hero center positioning
    parent.add(group);

    // 16 4D Vertices: (±1, ±1, ±1, ±1)
    const vertices4D = [];
    const scale4D = 1.6;
    for (let i = 0; i < 16; i++) {
      vertices4D.push([
        (i & 1 ? 1 : -1) * scale4D,
        (i & 2 ? 1 : -1) * scale4D,
        (i & 4 ? 1 : -1) * scale4D,
        (i & 8 ? 1 : -1) * scale4D,
      ]);
    }

    // 32 4D Edges (pairs of vertex indices with Hamming distance == 1)
    const edges = [];
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        const diff = i ^ j;
        if ((diff & (diff - 1)) === 0) {
          edges.push([i, j]);
        }
      }
    }

    const nodeTypes = [
      { name: 'VUE 3', color: 0x7fc8d8, shape: 'tetra' },
      { name: 'LARAVEL 13', color: 0xe8d39e, shape: 'box' },
      { name: 'FILAMENT', color: 0xe8d39e, shape: 'plane' },
      { name: 'FASTAPI', color: 0x7fc8d8, shape: 'cone' },
      { name: 'AI VISION', color: 0x7fc8d8, shape: 'icosa' },
      { name: 'HYPERCUBE', color: 0xe8d39e, shape: 'tesseract_mini' },
      { name: 'POSTGRES', color: 0x7fc8d8, shape: 'cylinder' },
      { name: 'CI / CD', color: 0xe8d39e, shape: 'gear' },
      { name: 'GIT DAG', color: 0xe8d39e, shape: 'octa' },
      { name: 'STATS', color: 0x7fc8d8, shape: 'torus' },
      { name: 'STREAM', color: 0x7fc8d8, shape: 'sphere_ring' },
      { name: 'REDIS', color: 0xe8d39e, shape: 'disc_stack' },
      { name: 'SCIKIT', color: 0x7fc8d8, shape: 'tetra_scatter' },
      { name: 'PLAYWRIGHT', color: 0x7fc8d8, shape: 'frame' },
      { name: 'GATEWAY', color: 0xe8d39e, shape: 'portal' },
      { name: 'SHIPPED', color: 0xe8d39e, shape: 'starburst' },
    ];

    function createDistinctNode(cfg) {
      const nodeGrp = new THREE.Group();
      let geo;
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        wireframe: true,
        transparent: true,
        opacity: 0.95,
      });

      if (cfg.shape === 'box') {
        geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
        nodeGrp.add(new THREE.Mesh(geo, mat));
      } else if (cfg.shape === 'cylinder') {
        geo = new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12);
        nodeGrp.add(new THREE.Mesh(geo, mat));
      } else if (cfg.shape === 'torus') {
        geo = new THREE.TorusGeometry(0.14, 0.05, 8, 16);
        nodeGrp.add(new THREE.Mesh(geo, mat));
      } else if (cfg.shape === 'icosa') {
        geo = new THREE.IcosahedronGeometry(0.18, 0);
        nodeGrp.add(new THREE.Mesh(geo, mat));
      } else if (cfg.shape === 'cone') {
        geo = new THREE.ConeGeometry(0.14, 0.28, 8);
        nodeGrp.add(new THREE.Mesh(geo, mat));
      } else if (cfg.shape === 'tesseract_mini') {
        const outer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), mat);
        const inner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat);
        nodeGrp.add(outer);
        nodeGrp.add(inner);
      } else if (cfg.shape === 'disc_stack') {
        for (let k = -1; k <= 1; k++) {
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), mat);
          disc.position.y = k * 0.08;
          nodeGrp.add(disc);
        }
      } else if (cfg.shape === 'portal') {
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 24), mat);
        nodeGrp.add(ringM);
      } else if (cfg.shape === 'starburst') {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 1), mat);
        nodeGrp.add(core);
      } else if (cfg.shape === 'plane') {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), mat);
        nodeGrp.add(panel);
      } else if (cfg.shape === 'gear') {
        const outerG = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12), mat);
        nodeGrp.add(outerG);
      } else {
        geo = new THREE.OctahedronGeometry(0.18, 0);
        nodeGrp.add(new THREE.Mesh(geo, mat));
      }

      const haloMat = new THREE.SpriteMaterial({
        map: cfg.color === 0x7fc8d8 ? spriteHaloCyan : SPRITE_HALO,
        color: cfg.color,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloSprite = new THREE.Sprite(haloMat);
      haloSprite.scale.set(1.2, 1.2, 1);
      nodeGrp.add(haloSprite);
      nodeGrp.userData.halo = haloSprite;

      const labelSprite = createLabel(cfg.name, cfg.color === 0x7fc8d8 ? '#7fc8d8' : '#e8d39e', 14);
      labelSprite.position.set(0, -0.34, 0);
      labelSprite.scale.set(1.4, 0.35, 1);
      nodeGrp.add(labelSprite);

      return nodeGrp;
    }

    // 16 Vertex Node Meshes with distinct visual representations
    const nodeMeshes = [];
    vertices4D.forEach((v, idx) => {
      const cfg = nodeTypes[idx % nodeTypes.length];
      const mesh = createDistinctNode(cfg);
      group.add(mesh);
      nodeMeshes.push(mesh);
    });

    // 32 Edge Lines using LineSegments
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(edges.length * 2 * 3);
    const lineColors = new Float32Array(edges.length * 2 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      linewidth: 2.0,
    });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lineSegments);

    // Floating 4D Light Pulse Packets traversing edges
    const pulses = [];
    for (let i = 0; i < 8; i++) {
      const packet = createPacket(i % 2 === 0 ? 0xe8d39e : 0x7fc8d8, 0.06);
      group.add(packet);
      pulses.push({
        mesh: packet,
        edgeIdx: Math.floor(Math.random() * edges.length),
        progress: Math.random(),
        speed: 0.25 + Math.random() * 0.35,
      });
    }

    // 4D Rotation Angles
    let angleXW = 0;
    let angleYZ = 0;
    let angleXY = 0;

    return {
      update(dt, time, mouseX = 0, mouseY = 0) {
        // Double rotation in 4D: XW and YZ plane rotations
        angleXW += dt * (0.35 + mouseX * 0.25);
        angleYZ += dt * (0.25 + mouseY * 0.25);
        angleXY += dt * 0.15;

        const cosXW = Math.cos(angleXW), sinXW = Math.sin(angleXW);
        const cosYZ = Math.cos(angleYZ), sinYZ = Math.sin(angleYZ);
        const cosXY = Math.cos(angleXY), sinXY = Math.sin(angleXY);

        const dist4D = 3.5; // 4D perspective distance
        const proj3D = [];

        // Project all 16 vertices from 4D -> 3D
        for (let i = 0; i < 16; i++) {
          let [x, y, z, w] = vertices4D[i];

          // Rotation 1: XW plane
          let x1 = x * cosXW - w * sinXW;
          let w1 = x * sinXW + w * cosXW;

          // Rotation 2: YZ plane
          let y1 = y * cosYZ - z * sinYZ;
          let z1 = y * sinYZ + z * cosYZ;

          // Rotation 3: XY plane (gentle 3D tilt)
          let x2 = x1 * cosXY - y1 * sinXY;
          let y2 = x1 * sinXY + y1 * cosXY;

          // 4D Perspective Projection: k = D / (D - w)
          const k = dist4D / (dist4D - w1);
          const p3x = x2 * k;
          const p3y = y2 * k;
          const p3z = z1 * k;

          proj3D.push({ x: p3x, y: p3y, z: p3z, w: w1, k: k });

          // Update node mesh position and scale
          const node = nodeMeshes[i];
          node.position.set(p3x, p3y, p3z);
          const scale = 0.6 + 0.7 * k;
          node.scale.setScalar(scale);

          if (node.userData.halo) {
            node.userData.halo.material.opacity = Math.max(0.35, Math.min(0.95, (w1 + scale4D) / (2 * scale4D)));
          }
        }

        // Update 32 edge buffer positions & depth colors
        const posAttr = lineGeo.attributes.position;
        const colAttr = lineGeo.attributes.color;

        const colorGold = COLOR.gold;
        const colorCyan = COLOR.cyan;

        for (let e = 0; e < edges.length; e++) {
          const [i, j] = edges[e];
          const pA = proj3D[i];
          const pB = proj3D[j];

          const idxA = e * 6;
          posAttr.array[idxA]     = pA.x;
          posAttr.array[idxA + 1] = pA.y;
          posAttr.array[idxA + 2] = pA.z;

          posAttr.array[idxA + 3] = pB.x;
          posAttr.array[idxA + 4] = pB.y;
          posAttr.array[idxA + 5] = pB.z;

          // Lerp edge vertex colors according to 4D depth w
          const tA = Math.max(0, Math.min(1, (pA.w + scale4D) / (2 * scale4D)));
          const tB = Math.max(0, Math.min(1, (pB.w + scale4D) / (2 * scale4D)));

          colAttr.array[idxA]     = THREE.MathUtils.lerp(colorGold.r, colorCyan.r, tA);
          colAttr.array[idxA + 1] = THREE.MathUtils.lerp(colorGold.g, colorCyan.g, tA);
          colAttr.array[idxA + 2] = THREE.MathUtils.lerp(colorGold.b, colorCyan.b, tA);

          colAttr.array[idxA + 3] = THREE.MathUtils.lerp(colorGold.r, colorCyan.r, tB);
          colAttr.array[idxA + 4] = THREE.MathUtils.lerp(colorGold.g, colorCyan.g, tB);
          colAttr.array[idxA + 5] = THREE.MathUtils.lerp(colorGold.b, colorCyan.b, tB);
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;

        // Update data packets traveling along hypercube edges
        pulses.forEach((p) => {
          p.progress += dt * p.speed;
          if (p.progress >= 1) {
            p.progress = 0;
            p.edgeIdx = Math.floor(Math.random() * edges.length);
          }
          const [i, j] = edges[p.edgeIdx];
          const pA = proj3D[i];
          const pB = proj3D[j];
          const curX = THREE.MathUtils.lerp(pA.x, pB.x, p.progress);
          const curY = THREE.MathUtils.lerp(pA.y, pB.y, p.progress);
          const curZ = THREE.MathUtils.lerp(pA.z, pB.z, p.progress);
          p.mesh.position.set(curX, curY, curZ);
        });

        // Gentle floating breathing tilt
        group.rotation.y = time * 0.1 + mouseX * 0.25;
        group.rotation.x = Math.sin(time * 0.18) * 0.1 + mouseY * 0.2;
      },
    };
  }

  const starfield = buildStarfield();
  SCENE.add(starfield);

  // The "factory" baseplate — a subtle horizontal disc that ties the three scenes together
  const baseplateGeo = new THREE.CircleGeometry(11, 64);
  const baseplate = new THREE.Mesh(
    baseplateGeo,
    new THREE.MeshBasicMaterial({
      color: 0x0e1424,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
  );
  baseplate.rotation.x = -Math.PI / 2;
  baseplate.position.y = -2.5;
  SCENE.add(baseplate);

  // a thin ring around the baseplate
  const ringGeo = new THREE.RingGeometry(10.8, 11.0, 96);
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({ color: 0xe8d39e, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -2.49;
  SCENE.add(ring);

  // build three scenes + hypercube engine, grouped under a single worldGroup
  const worldGroup = new THREE.Group();
  SCENE.add(worldGroup);

  const gitScene = buildGitScene(worldGroup);
  const systemScene = buildSystemScene(worldGroup);
  const cicdScene = buildCICDScene(worldGroup);
  const hypercubeScene = buildHypercubeEngine(worldGroup);

  // ----- camera focus controller -----
  const FOCUS = {
    hero: { pos: new THREE.Vector3(0, 0, 14), look: new THREE.Vector3(0, 0, 0), scene: 'all' },
    git:  { pos: new THREE.Vector3(-6, 1.0, 7.5), look: new THREE.Vector3(-6, 0, 0), scene: 'git' },
    system: { pos: new THREE.Vector3(0, 0.8, 7.8), look: new THREE.Vector3(0, 0, 0), scene: 'system' },
    cicd: { pos: new THREE.Vector3(6, 0.8, 7.5), look: new THREE.Vector3(6, 0, 0), scene: 'cicd' },
  };

  // current camera state (lerped)
  const camPos = new THREE.Vector3().copy(FOCUS.hero.pos);
  const camLook = new THREE.Vector3().copy(FOCUS.hero.look);
  let targetFocus = 'hero';
  let targetBlend = 1; // 0 = hero, 1 = scene-focus

  // update camera focus based on scroll position
  function updateFocusFromScroll() {
    const sections = document.querySelectorAll('section[id], header[id]');
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    let focus = 'hero';
    for (const sec of sections) {
      const top = sec.offsetTop;
      const bottom = top + sec.offsetHeight;
      if (scrollY + vh * 0.5 >= top && scrollY + vh * 0.5 < bottom) {
        const id = sec.id;
        if (id === 'skills') focus = 'skills-area';
        else if (id === 'about') focus = 'about';
        else if (id === 'contact') focus = 'contact';
        else if (id === 'deployed') focus = 'deployed';
        else if (id === 'work') focus = 'work';
        else if (id === 'experience') focus = 'experience';
        else focus = 'mid';
      }
    }
    if (focus === 'top' || focus === 'hero') targetFocus = 'hero';
    else if (focus === 'skills-area') targetFocus = 'skills';
    else targetFocus = 'mid';
  }

  // skill hover/focus: highlight a single scene
  let skillHover = null;
  document.querySelectorAll('[data-scene]').forEach((el) => {
    const handler = () => {
      skillHover = el.getAttribute('data-scene');
      document.body.classList.add('scene-focus');
    };
    const clear = () => {
      skillHover = null;
      document.body.classList.remove('scene-focus');
    };
    el.addEventListener('mouseenter', handler);
    el.addEventListener('focus', handler);
    el.addEventListener('mouseleave', clear);
    el.addEventListener('blur', clear);
  });

  // ----- resize handling -----
  let resizeT = null;
  function onResize() {
    if (resizeT) clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 100);
  }
  window.addEventListener('resize', onResize);

  // ----- visibility (pause when hidden) -----
  let isVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
  });

  // ----- prefers-reduced-motion fallback -----
  // We render a single frame, then pause. The static composition already conveys the topology.
  // Provide a static starfield + baseplate even on reduced-motion.
  if (prefersReducedMotion) {
    // tick once for an initial pose, then stop
    const t0 = performance.now() / 1000;
    gitScene.update(0, t0, 0.6);
    systemScene.update(0, t0, 0.6);
    cicdScene.update(0, t0, 0.6);
    hypercubeScene.update(0, t0, 0, 0);
    camera.position.set(0, 0, 14);
    camera.lookAt(0, 0, 0);
    renderer.render(SCENE, camera);
    // bind no further frames
    return;
  }

  // ----- main render loop -----
  const clock = new THREE.Clock();
  let mouseX = 0, mouseY = 0;
  let targetMouseX = 0, targetMouseY = 0;
  window.addEventListener('mousemove', (e) => {
    targetMouseX = ((e.clientX / window.innerWidth) - 0.5) * 2;
    targetMouseY = -((e.clientY / window.innerHeight) - 0.5) * 2;
  });

  // ----- scroll-driven focus -----
  let scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateFocusFromScroll();
      scrollTicking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // initialize from current scroll
  updateFocusFromScroll();

  function render() {
    if (!isVisible) {
      requestAnimationFrame(render);
      return;
    }
    requestAnimationFrame(render);
    const dt = Math.min(0.05, clock.getDelta());
    const time = clock.getElapsedTime();

    // mouse lerp
    mouseX += (targetMouseX - mouseX) * 0.04;
    mouseY += (targetMouseY - mouseY) * 0.04;

    // determine current focus target
    let target = FOCUS.hero;
    let blendTarget = 0; // 0=hero, 1=scene focus
    if (skillHover) {
      target = FOCUS[skillHover];
      blendTarget = 1;
    } else if (targetFocus === 'skills') {
      // when in skills, pick the centered scene by default
      target = FOCUS.system;
      blendTarget = 0.9;
    } else if (targetFocus === 'mid') {
      // mid-scroll: dolly along the line
      target = FOCUS.hero;
      target.pos.x = mouseX * 3;
      target.look.x = mouseX * 3;
      blendTarget = 0.4;
    }

    // lerp camera
    const ease = 0.05;
    camPos.lerp(target.pos, ease);
    camLook.lerp(target.look, ease);

    // blend determines subtle parallax tweak
    const lookAt = camLook.clone();
    lookAt.x += mouseX * 0.3;
    lookAt.y += mouseY * 0.2;
    camera.position.copy(camPos);
    camera.position.x += mouseX * (blendTarget > 0.5 ? 0.4 : 0.8);
    camera.position.y += mouseY * (blendTarget > 0.5 ? 0.3 : 0.5);
    camera.lookAt(lookAt);

    // emphasis: how strongly the focused scene is highlighted
    let gitEm = 1, sysEm = 1, cicdEm = 1;
    if (skillHover === 'git')           { gitEm = 1.4; sysEm = 0.55; cicdEm = 0.55; }
    else if (skillHover === 'system')   { gitEm = 0.55; sysEm = 1.4; cicdEm = 0.55; }
    else if (skillHover === 'cicd')     { gitEm = 0.55; sysEm = 0.55; cicdEm = 1.4; }
    else if (targetFocus === 'skills')  { gitEm = 0.85; sysEm = 1.25; cicdEm = 0.85; }

    // update scenes
    gitScene.update(dt, time, gitEm);
    systemScene.update(dt, time, sysEm);
    cicdScene.update(dt, time, cicdEm);
    hypercubeScene.update(dt, time, mouseX, mouseY);

    // starfield drift
    starfield.rotation.y = time * 0.02;
    starfield.rotation.x = Math.sin(time * 0.05) * 0.05;

    // baseplate ring pulse
    const ringPulse = 1 + Math.sin(time * 0.6) * 0.02;
    ring.scale.setScalar(ringPulse);

    renderer.render(SCENE, camera);
  }

  render();

  // ----- WebGL failure fallback -----
  window.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[shipping-machine] WebGL context lost. Pausing render.');
    isVisible = false;
  });

  window.addEventListener('webglcontextrestored', () => {
    isVisible = true;
    console.info('[shipping-machine] WebGL context restored.');
  });
})();
