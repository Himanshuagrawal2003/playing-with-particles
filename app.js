/**
 * MorphOS // Particle Morphing Engine
 * Pure math & code canvas visualization
 */

// ── Device-Adaptive Particle Count ─────────────────────────────────────────
// Fewer particles on weaker devices for smooth 60fps
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 500;
const IS_TABLET = !IS_MOBILE && window.innerWidth < 1024;
const PARTICLE_COUNT = IS_MOBILE ? 1200 : IS_TABLET ? 2000 : 3000;

const FOV = 500;
const BASE_ROTATION_SPEED = 0.005;

// State Variables
let canvas, ctx;
let particles = [];
let shapes = {};
let currentShapeName = 'matrix';
let nextShapeName = ''; // Force first scatter cycle
let colorPreset = 'cyberpunk';
let mouseMode = 'repel';
let autoMorph = true;
let morphSpeed = 0.05;
let particleRadius = 2.4;
let connectionThreshold = 38; // Enable 3D wireframe outline connections
let rotSpeedMultiplier = 1.0;

let centerX = 0;
let centerY = 0;
let zoom = 1.0;
let targetZoom = 1.0;

// Logical canvas size (CSS pixels) — separate from physical canvas.width/height (device pixels)
let logicalW = 0;
let logicalH = 0;

// Camera angles & velocities for drag rotation
let angleX = 0.0; // Pitch
let angleY = 0.0; // Yaw
let targetAngleX = 0.0;
let targetAngleY = 0.0;
let baseYaw = 0.0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let mousePosition = { x: null, y: null };

// Auto cycle management
let lastMorphTime = 0;
const SHAPE_ORDER = ['sphere', 'donut', 'helix', 'cube', 'pipe', 'cylinder', 'cone', 'infinity'];

// Stats tracking
let fps = 60;
let smoothFps = 60;          // exponential moving average for stable FPS reading
let lastFrameTime = performance.now();
let lastFpsUpdateTime = performance.now();
let frameCount = 0;
let renderFrameCount = 0;    // total frames rendered (for skip-every-N tricks)
let globalTime = 0;
let particleSizeMultiplier = 1.0;
let targetParticleSizeMultiplier = 1.0;

// Pre-allocated sorted array (avoid new allocation every frame)
let sortedParticles = [];

// Color Themes configuration
const THEMES = {
  cyberpunk: {
    primary: [0, 240, 255],     // Cyan rgb
    secondary: [255, 0, 127],   // Neon Pink rgb
    accent1: '#00f0ff',
    accent2: '#ff007f',
    bg1: '#030307',
    glow1: 'rgba(0, 240, 255, 0.3)',
    glow2: 'rgba(255, 0, 127, 0.3)'
  },
  nebula: {
    primary: [139, 92, 246],    // Purple
    secondary: [59, 130, 246],  // Blue
    accent1: '#8b5cf6',
    accent2: '#3b82f6',
    bg1: '#02000a',
    glow1: 'rgba(139, 92, 246, 0.3)',
    glow2: 'rgba(59, 130, 246, 0.3)'
  },
  emerald: {
    primary: [251, 191, 36],    // Gold
    secondary: [16, 185, 129],  // Emerald
    accent1: '#fbbf24',
    accent2: '#10b981',
    bg1: '#010502',
    glow1: 'rgba(251, 191, 36, 0.25)',
    glow2: 'rgba(16, 185, 129, 0.25)'
  },
  rainbow: {
    primary: [255, 255, 255],
    secondary: [255, 255, 255],
    accent1: '#ffffff',
    accent2: '#ff00ff',
    bg1: '#030305',
    glow1: 'rgba(255, 0, 255, 0.2)',
    glow2: 'rgba(0, 255, 255, 0.2)'
  },
  monochrome: {
    primary: [229, 231, 235],   // Ice White
    secondary: [107, 114, 128], // Slate Grey
    accent1: '#e5e7eb',
    accent2: '#6b7280',
    bg1: '#050508',
    glow1: 'rgba(229, 231, 235, 0.15)',
    glow2: 'rgba(107, 114, 128, 0.15)'
  },
  matrixGreen: {
    primary: [0, 255, 102],     // Neon green Primary
    secondary: [0, 180, 50],    // Darker green Secondary
    accent1: '#00ff66',
    accent2: '#00b33c',
    bg1: '#010502',             // Dark green hacker room background glow
    glow1: 'rgba(0, 255, 102, 0.4)',
    glow2: 'rgba(0, 180, 50, 0.2)'
  }
};

// --------------------------------------------------
// Matrix Character Rain Constants & Helpers
const MATRIX_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function getRandomMatrixChar() {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

class Particle {
  constructor(index) {
    this.index = index;
    
    // Spawn randomly in 3D space initially
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = Math.random() * 400 + 100;
    this.x = r * Math.sin(phi) * Math.cos(theta);
    this.y = r * Math.sin(phi) * Math.sin(theta);
    this.z = r * Math.cos(phi);
    
    // Interactive mouse offsets (spring-back system)
    this.ox = 0;
    this.oy = 0;
    this.oz = 0;
    
    // Target position
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.z;
    
    // Projected coordinates
    this.px = 0;
    this.py = 0;
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    this.pScale = 1;
    this.pAlpha = 1;
    this.sizeWeight = Math.random() * 0.6 + 0.6;
    this.char = getRandomMatrixChar();
  }
  
  setTarget(x, y, z) {
    this.tx = x;
    this.ty = y;
    this.tz = z;
  }
  
  update(mX, mY, mode, speed) {
    // 1. Interpolation/morphing towards target position
    this.x += (this.tx - this.x) * speed;
    this.y += (this.ty - this.y) * speed;
    this.z += (this.tz - this.z) * speed;
    
    // 2. Mouse physics on projected 2D coordinates
    // We check interaction against the projected coordinates from the previous frame.
    if (mX !== null && mY !== null && mode !== 'none') {
      const dx = this.px - mX;
      const dy = this.py - mY;
      const dist = Math.hypot(dx, dy);
      const radius = 120; // Interaction radius in pixels
      
      if (dist < radius) {
        const force = (radius - dist) / radius; // 0 at edge, 1 at cursor
        
        if (mode === 'repel') {
          // Push away in 3D direction matching screen displacement
          const strength = force * 6.5;
          const angle = Math.atan2(dy, dx);
          this.ox += Math.cos(angle) * strength;
          this.oy += Math.sin(angle) * strength;
          this.oz += (Math.random() - 0.5) * strength * 2; // jitter in depth
        } 
        else if (mode === 'attract') {
          // Pull toward cursor
          const strength = force * 6.5;
          const angle = Math.atan2(dy, dx);
          this.ox -= Math.cos(angle) * strength;
          this.oy -= Math.sin(angle) * strength;
          this.oz += (Math.random() - 0.5) * strength * 2;
        } 
        else if (mode === 'flow') {
          // Whirlpool flow around cursor
          const strength = force * 8.0;
          const angle = Math.atan2(dy, dx) + Math.PI / 2; // perpendicular
          this.ox += Math.cos(angle) * strength;
          this.oy += Math.sin(angle) * strength;
        }
      }
    }
    
    // Spring return: damp interactive offsets back to 0
    this.ox += (0 - this.ox) * 0.08;
    this.oy += (0 - this.oy) * 0.08;
    this.oz += (0 - this.oz) * 0.08;
  }
  
  project(angX, angY, cX, cY, zFactor) {
    const posX = this.x + this.ox;
    const posY = this.y + this.oy;
    const posZ = this.z + this.oz;
    
    if (currentShapeName === 'matrix' && (globalTime - lastMorphTime >= 1000)) {
      // Force perfectly straight, parallel 2D vertical lines with zero perspective distortion
      this.rotX = posX;
      this.rotY = posY;
      this.rotZ = posZ;
      this.pScale = 1.0;
      this.px = posX * zFactor + cX;
      this.py = posY * zFactor + cY;
      this.pAlpha = 1.0;
      return;
    }
    
    // 3D rotation matrix calculation
    // Rotate around Y axis (Yaw)
    const cosY = Math.cos(angY);
    const sinY = Math.sin(angY);
    const rx1 = posX * cosY - posZ * sinY;
    const rz1 = posX * sinY + posZ * cosY;
    
    // Rotate around X axis (Pitch)
    const cosX = Math.cos(angX);
    const sinX = Math.sin(angX);
    const ry2 = posY * cosX - rz1 * sinX;
    const rz2 = posY * sinX + rz1 * cosX;
    
    this.rotX = rx1;
    this.rotY = ry2;
    this.rotZ = rz2;
    
    // Perspective projection formula
    const scale = FOV / (FOV + rz2);
    this.pScale = scale;
    
    this.px = rx1 * scale * zFactor + cX;
    this.py = ry2 * scale * zFactor + cY;
    
    // Depth Cueing (alpha fades as particles rotate to the background)
    //rotZ ranges roughly from -200 to 200.
    const maxDepth = 250;
    const depthRatio = (rz2 + maxDepth) / (maxDepth * 2); // 0 (front) to 1 (back)
    const constrainedDepth = Math.max(0, Math.min(1, depthRatio));
    this.pAlpha = 1.0 - constrainedDepth * 0.75; // ranges from 0.25 to 1.0
  }
  
  getColor(themeName, time) {
    const t = this.index / PARTICLE_COUNT;
    const theme = THEMES[themeName];
    
    if (themeName === 'rainbow') {
      const hue = (t * 360 + time * 0.05) % 360;
      return `hsla(${hue}, 85%, 65%, ${this.pAlpha})`;
    }
    
    // Spatial gradient interpolation based on particle's target coordinates
    // Creates a glowing gradient mapped to the structure of the geometry
    const spatialFactor = Math.sin(t * Math.PI) * 0.5 + 0.5;
    
    const r = Math.round(theme.primary[0] * spatialFactor + theme.secondary[0] * (1 - spatialFactor));
    const g = Math.round(theme.primary[1] * spatialFactor + theme.secondary[1] * (1 - spatialFactor));
    const b = Math.round(theme.primary[2] * spatialFactor + theme.secondary[2] * (1 - spatialFactor));
    
    return `rgba(${r}, ${g}, ${b}, ${this.pAlpha})`;
  }
}

// --------------------------------------------------
// Mathematical Coordinate Generators
// --------------------------------------------------
function generateMatrixGrid(time) {
  const points = [];
  
  // Use logical size (CSS pixels) — consistent with DPR-scaled canvas
  const screenW = logicalW || window.innerWidth;
  const screenH = logicalH || window.innerHeight;

  // Calculate column count dynamically depending on screen size to prevent text overlaps
  let cols = 15;
  if (screenW < 500) {
    cols = 6;   // Mobile: 6 columns
  } else if (screenW < 1024) {
    cols = 10;  // Tablet: 10 columns
  }
  
  // Calculate how many complete sets of 4 characters we can fit in each column
  const setsPerCol = Math.floor(PARTICLE_COUNT / cols / 4);
  const gridCount = cols * setsPerCol * 4;
  
  // Calculate width and height based on screen dimensions divided by current camera zoom to fill full display
  const w = screenW / Math.max(0.1, zoom);
  const h = screenH / Math.max(0.1, zoom);
  
  // Indent columns slightly to prevent text clipping at screen borders
  const colSpacing = (w * 0.9) / (cols - 1);
  
  // Horizontal set layout parameters: sets of 4 stacked vertically with zero spacing gaps
  const innerSpacing = 11;  // Spacing between letters inside a set of 4
  const setSpacing = 18;    // Vertical spacing between consecutive sets (equal to character row height)
  const paddedH = setsPerCol * setSpacing; // scroll loop height
  
  // Speed of vertical flow (scrolling downward rain columns)
  const flowOffset = (time * 0.08) % paddedH;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (i < gridCount) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      
      // Group particles into sets of 4
      const setIndex = Math.floor(r / 4);
      const innerIndex = r % 4;
      
      // Position characters horizontally side-by-side inside the set, centered on the column axis
      const colCenter = c * colSpacing - (w * 0.9) / 2;
      const x = colCenter + innerIndex * innerSpacing - (1.5 * innerSpacing);
      
      // Scroll Y coordinate down and wrap around (off-screen boundaries)
      let y = setIndex * setSpacing + flowOffset;
      y = (y % paddedH) - paddedH / 2;
      
      // Depth-layered columns (narrower depth profile to keep 2D columns readable)
      const z = ((c * 7 + r * 13) % 15) * 5 - 35;
      
      points.push({ x, y, z });
    } else {
      // Hide any leftover particles off-screen to prevent visual glitches/incomplete rows
      points.push({ x: 9999, y: 9999, z: 9999 });
    }
  }
  return points;
}

function generateSphere() {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
  const radius = 175;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2; // 1 to -1
    const r = Math.sqrt(1 - y * y); // radius at y
    const theta = phi * i;
    
    const x = Math.cos(theta) * r * radius;
    const z = Math.sin(theta) * r * radius;
    
    points.push({ x, y: y * radius, z });
  }
  return points;
}

function generateDonut() {
  const points = [];
  const R = 110; // Main ring radius (adjusted to maintain bounds)
  const r = 70;  // Tube radius (extremely thick donut shape!)
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Distribute points spirating along the surface of the torus
    const theta = i * 0.15; // tube angle
    const phi = (i / PARTICLE_COUNT) * Math.PI * 2 * 12; // ring rotation spiral loops
    
    const x = (R + r * Math.cos(theta)) * Math.cos(phi);
    const y = (R + r * Math.cos(theta)) * Math.sin(phi);
    const z = r * Math.sin(theta);
    
    points.push({ x, y, z });
  }
  return points;
}

function generateCylinder() {
  const points = [];
  const radius = 110;
  const height = 240;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const circleIndex = Math.floor(i / 30); // 50 vertical circles
    const angleIndex = i % 30; // 30 points per circle
    
    const angle = (angleIndex / 30) * Math.PI * 2;
    const y = (circleIndex / 49) * height - height / 2;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    points.push({ x, y, z });
  }
  return points;
}

function generateCone() {
  const points = [];
  const baseRadius = 140;
  const height = 240;
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const layerIndex = Math.floor(i / 30); // 50 layers
    const angleIndex = i % 30; // 30 points per circle
    
    const angle = (angleIndex / 30) * Math.PI * 2;
    const hFraction = layerIndex / 49; // 0 (tip) to 1 (base)
    const y = hFraction * height - height / 2;
    
    const r = (1 - hFraction) * baseRadius;
    
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    
    points.push({ x, y, z });
  }
  return points;
}

function generateHelix() {
  const points = [];
  const R = 85; // Helix radius
  const pitch = 250; // Total vertical span
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Double helix strands (even indices on strand 1, odd on strand 2)
    const isStrand1 = (i % 2 === 0);
    const t = (i / PARTICLE_COUNT) * Math.PI * 8; // 4 complete turns
    const theta = isStrand1 ? t : t + Math.PI;
    const y = (t / (Math.PI * 8)) * pitch - pitch / 2;
    
    let x, z;
    // Periodically insert horizontal rung connection particles
    if (i % 6 === 0) {
      const fraction = (i % 30) / 30; // interpolate points across the rung
      const strand1X = R * Math.cos(t);
      const strand1Z = R * Math.sin(t);
      const strand2X = R * Math.cos(t + Math.PI);
      const strand2Z = R * Math.sin(t + Math.PI);
      
      x = strand1X * fraction + strand2X * (1 - fraction);
      z = strand1Z * fraction + strand2Z * (1 - fraction);
    } else {
      x = R * Math.cos(theta);
      z = R * Math.sin(theta);
    }
    
    points.push({ x, y, z });
  }
  return points;
}

function generateCube() {
  const points = [];
  const size = 100; // Half side length (scaled down to fit same visual boundaries)
  const gridWidth = Math.ceil(Math.sqrt(PARTICLE_COUNT / 6));
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const face = i % 6;
    const indexInFace = Math.floor(i / 6);
    
    // Generate precise grid points on a face
    const col = indexInFace % gridWidth;
    const row = Math.floor(indexInFace / gridWidth);
    
    const u = (col / (gridWidth - 1)) * size * 2 - size; // -size to size
    const v = (row / (gridWidth - 1)) * size * 2 - size; // -size to size
    
    let x = 0, y = 0, z = 0;
    
    switch(face) {
      case 0: x = size; y = u; z = v; break;  // +X
      case 1: x = -size; y = u; z = v; break; // -X
      case 2: x = u; y = size; z = v; break;  // +Y
      case 3: x = u; y = -size; z = v; break; // -Y
      case 4: x = u; y = v; z = size; break;  // +Z
      case 5: x = u; y = v; z = -size; break; // -Z
    }
    
    points.push({ x, y, z });
  }
  return points;
}

function generatePipe() {
  const points = [];
  const radius = 65;
  const length = 320; // Long horizontal span pipe
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const circleIndex = Math.floor(i / 30); // 50 vertical circles
    const angleIndex = i % 30; // 30 points per circle
    
    const angle = (angleIndex / 30) * Math.PI * 2;
    const x = (circleIndex / 49) * length - length / 2; // extends horizontally along X
    const y = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    points.push({ x, y, z });
  }
  return points;
}

function generateZero() {
  const points = [];
  const a = 140; // vertical height radius (stretched)
  const b = 85;  // horizontal width radius
  const r = 30;  // tube radius thickness
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Elongated ring/torus profile for digit 0
    const theta = i * 0.15; // tube spiral
    const phi = (i / PARTICLE_COUNT) * Math.PI * 2 * 12; // 12 loops
    
    const x = (b + r * Math.cos(theta)) * Math.cos(phi);
    const y = (a + r * Math.cos(theta)) * Math.sin(phi);
    const z = r * Math.sin(theta);
    
    points.push({ x, y, z });
  }
  return points;
}

function generateInfinity() {
  const points = [];
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = (i / PARTICLE_COUNT) * Math.PI * 2;
    
    // Select layer: even indices are inner loop, odd indices are outer loop (Double Layer Showcase)
    const isInner = (i % 2 === 0);
    const a = isInner ? 145 : 190; // Nested sizes
    
    // Lemniscate of Bernoulli parametric formulas (restored for horizontal infinity ∞)
    const denom = 1 + Math.pow(Math.sin(t), 2);
    const baseX = (a * Math.cos(t)) / denom;
    const baseY = (a * Math.sin(t) * Math.cos(t)) / denom;
    
    // Create a 3D ribbon loop (Mobius-like strip offset)
    const phi = i * 0.1; // spiral offset
    const w = 6 * Math.sin(phi); // thin width spread offset
    
    const x = baseX + w * Math.sin(t);
    const y = baseY + w * Math.cos(t);
    // Beautiful roller-coaster vertical wave with depth separation for the double layers
    const zOffset = isInner ? -15 : 15; // separates layers slightly in depth
    const z = 35 * Math.sin(2 * t) + zOffset + 4 * Math.cos(phi);
    
    points.push({ x, y, z });
  }
  return points;
}

function generateScatter() {
  const points = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Generate particles scattered in a tight, local 3D cloud near the shape boundaries
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    // Compact radial distribution keeping particles close to shape bounds
    const r = Math.random() * 100 + 110; // ranges from 110 to 210 (instead of 240 to 560)
    points.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi)
    });
  }
  return points;
}

// --------------------------------------------------
// Hacking Code Background Rain Effect
// --------------------------------------------------
const CODE_SNIPPETS = [
  "const canvas = document.getElementById('morphCanvas');",
  "ctx = canvas.getContext('2d');",
  "particles.push(new Particle(i));",
  "this.x += (this.tx - this.x) * morphSpeed;",
  "const dist3D = Math.hypot(p1.x - p2.x, p1.y - p2.y);",
  "targetAngleY += BASE_ROTATION_SPEED * 0.8;",
  "const scale = FOV / (FOV + rotZ);",
  "ctx.strokeStyle = pGrad; ctx.stroke();",
  "let progress = (cycleTime - 3400) / (duration - 3400);",
  "Math.sin(progress * Math.PI * 2);",
  "colorPreset = SHAPE_THEMES[currentShapeName];",
  "updateCSSTheme(colorPreset);",
  "const phi = Math.PI * (3 - Math.sqrt(5));",
  "const denom = 1 + Math.pow(Math.sin(t), 2);",
  "x: (b + r * Math.cos(theta)) * Math.cos(phi);",
  "particles[i].project(angleX, angleY, cX, cY);",
  "sortedParticles = [...particles].sort((a,b) => b-a);"
];

let backgroundStreams = [];

function initHackingEffect() {
  const cols = Math.floor(window.innerWidth / 220);
  backgroundStreams = [];
  for (let i = 0; i < cols; i++) {
    backgroundStreams.push({
      x: i * 220 + 20,
      y: Math.random() * -600,
      speed: Math.random() * 1.5 + 0.8,
      snippetIndex: Math.floor(Math.random() * CODE_SNIPPETS.length),
      opacity: Math.random() * 0.05 + 0.03
    });
  }
}

function drawHackingBackground(timestamp) {
  ctx.save();
  ctx.font = "11px 'Courier New', Courier, monospace";
  ctx.textAlign = "left";
  
  let textRgb = "0, 240, 255"; // Cyan default
  if (colorPreset === 'emerald') textRgb = "0, 255, 127";
  if (colorPreset === 'nebula') textRgb = "139, 92, 246";
  
  for (let i = 0; i < backgroundStreams.length; i++) {
    const stream = backgroundStreams[i];
    
    if (colorPreset === 'rainbow') {
      const hue = (stream.x * 0.5 + timestamp * 0.02) % 360;
      ctx.fillStyle = `hsla(${hue}, 85%, 65%, ${stream.opacity})`;
    } else {
      ctx.fillStyle = `rgba(${textRgb}, ${stream.opacity})`;
    }
    
    // Draw code snippet
    ctx.fillText(CODE_SNIPPETS[stream.snippetIndex], stream.x, stream.y);
    
    // Draw trailing binary details
    const binText = (Math.random() > 0.5 ? "1" : "0") + "  0x" + Math.floor(Math.random()*256).toString(16).toUpperCase();
    ctx.fillStyle = colorPreset === 'rainbow' ? `hsla(${((stream.x * 0.5 + timestamp * 0.02) + 60) % 360}, 85%, 65%, ${stream.opacity * 0.7})` : `rgba(${textRgb}, ${stream.opacity * 0.7})`;
    ctx.fillText(binText, stream.x + 10, stream.y + 15);
    
    stream.y += stream.speed;
    if (stream.y > logicalH + 50) {
      stream.y = Math.random() * -200 - 50;
      stream.snippetIndex = Math.floor(Math.random() * CODE_SNIPPETS.length);
      stream.speed = Math.random() * 1.5 + 0.8;
    }
  }
  ctx.restore();
}

// --------------------------------------------------
// Initialization
// --------------------------------------------------
function init() {
  canvas = document.getElementById('morphCanvas');
  ctx = canvas.getContext('2d');
  
  resizeCanvas();
  
  // Initialize particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle(i));
  }
  // Pre-fill sortedParticles so first frame is valid
  sortedParticles = [...particles];
  
  // Pre-generate mathematical shape targets
  shapes = {
    matrix: generateMatrixGrid(0),
    sphere: generateSphere(),
    donut: generateDonut(),
    helix: generateHelix(),
    cube: generateCube(),
    pipe: generatePipe(),
    cylinder: generateCylinder(),
    cone: generateCone(),
    infinity: generateInfinity(),
    scatter: generateScatter()
  };
  
  // ── Unified Pointer Events (mouse + touch + stylus) ──────────────────
  // Using PointerEvents API so one set of handlers works everywhere.

  let dragActive   = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  // Pinch-to-zoom tracking
  let pinchStartDist = 0;
  let pinchStartZoom = 1.0;
  const activePointers = new Map();

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      // Single pointer → start drag rotate
      dragActive   = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    } else if (activePointers.size === 2) {
      // Two fingers → start pinch
      dragActive = false;
      const pts = [...activePointers.values()];
      pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartZoom = targetZoom;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = canvas.getBoundingClientRect();

    if (activePointers.size === 2) {
      // Pinch zoom
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const scale = dist / pinchStartDist;
      targetZoom = Math.max(0.4, Math.min(3.0, pinchStartZoom * scale));
      return;
    }

    if (activePointers.size === 1) {
      // Update mouse-effect position
      mousePosition.x = e.clientX - rect.left;
      mousePosition.y = e.clientY - rect.top;

      if (dragActive) {
        // Drag to rotate
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        targetAngleY += dx * 0.006;
        targetAngleX += dy * 0.006;
        baseYaw = targetAngleY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      }
    }
  });

  const endPointer = (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) {
      dragActive = false;
      mousePosition.x = null;
      mousePosition.y = null;
    } else if (activePointers.size === 1) {
      // One finger left after pinch — restart drag from current position
      const [ptr] = activePointers.values();
      dragActive   = true;
      lastPointerX = ptr.x;
      lastPointerY = ptr.y;
    }
  };

  canvas.addEventListener('pointerup',     endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  // Prevent browser scroll/zoom while interacting with canvas on mobile
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove',  (e) => e.preventDefault(), { passive: false });

  // Resize handler (also listen to visualViewport for mobile browser chrome changes)
  window.addEventListener('resize', resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
  }
  // Initialize Audio Player
  initAudio();
  
  // Start Main Loop
  lastFrameTime = performance.now();
  requestAnimationFrame(loop);
}

function initAudio() {
  const audio = document.getElementById('bgAudio');
  if (!audio) { console.warn('[Audio] #bgAudio element not found'); return; }

  let unlocked = false;

  // Pulsing hint badge
  const hint = document.createElement('div');
  hint.id = 'audioHint';
  hint.innerHTML = '🎵 <span>click anywhere to play music</span>';
  hint.style.cssText = `
    position: fixed;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(0,240,255,0.8);
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
    letter-spacing: 0.08em;
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(0,240,255,0.3);
    border-radius: 20px;
    padding: 6px 16px;
    pointer-events: none;
    z-index: 9999;
    backdrop-filter: blur(6px);
    animation: hintPulse 2s ease-in-out infinite;
  `;
  const style = document.createElement('style');
  style.textContent = `@keyframes hintPulse { 0%,100%{opacity:.8} 50%{opacity:.25} }`;
  document.head.appendChild(style);
  document.body.appendChild(hint);

  function hideHint() {
    hint.style.transition = 'opacity 0.6s ease';
    hint.style.opacity = '0';
    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 700);
  }

  function fadeIn() {
    audio.volume = 0;
    const iv = setInterval(() => {
      audio.volume = Math.min(1.0, audio.volume + 0.02);
      if (audio.volume >= 1.0) clearInterval(iv);
    }, 20);
  }

  function unlock() {
    if (unlocked) return;
    console.log('[Audio] unlock called — paused:', audio.paused, 'muted:', audio.muted);
    unlocked = true;

    // Always force-stop mute first
    audio.muted = false;

    const doPlay = () => {
      audio.play()
        .then(() => {
          console.log('[Audio] playing ✅');
          fadeIn();
          hideHint();
        })
        .catch(err => {
          console.error('[Audio] play() rejected:', err);
          unlocked = false; // allow retry
        });
    };

    if (audio.paused) {
      doPlay();
    } else {
      // Already playing (just muted) — unmuting + fade is enough
      console.log('[Audio] was already playing, unmuted ✅');
      fadeIn();
      hideHint();
    }
  }

  // Register on every trusted gesture — no once:true so retry works on failure
  ['mousedown', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, unlock, { passive: true });
  });

  // Best-effort: try auto-unmute after page load (works in permissive browsers)
  setTimeout(() => {
    if (unlocked) return;
    console.log('[Audio] auto-unmute attempt — paused:', audio.paused);
    audio.muted = false;
    if (audio.paused) {
      audio.play()
        .then(() => { console.log('[Audio] auto-play OK ✅'); unlocked = true; hideHint(); })
        .catch(err => { console.warn('[Audio] auto-play blocked:', err.message); audio.muted = true; });
    }
  }, 400);
}

function resizeCanvas() {
  // Use visualViewport on mobile so canvas fills the real visible area
  const vvp = window.visualViewport;
  const W = vvp ? Math.round(vvp.width)  : window.innerWidth;
  const H = vvp ? Math.round(vvp.height) : window.innerHeight;

  // HiDPI / Retina support — cap at 2× (3× gives huge buffers, negligible visual gain)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Store logical size for coordinate math
  logicalW = W;
  logicalH = H;

  // Physical canvas buffer = logical × DPR
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  // Keep canvas element at CSS size so layout isn't affected
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  // Scale ctx so all drawing commands use logical pixels automatically
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset first
  ctx.scale(dpr, dpr);

  centerX = W / 2;
  centerY = H / 2;

  // Zoom scale: fill screen properly across device sizes
  if (W < 500) {
    targetZoom = 1.0;
    zoom = 1.0;
  } else if (W < 1024) {
    targetZoom = 1.1;
    zoom = 1.1;
  } else {
    targetZoom = 1.55;
    zoom = 1.55;
  }
  initHackingEffect();
}

// --------------------------------------------------
// Logic & State Setters
// --------------------------------------------------

// Shape to theme mapping for different colors per shape
const SHAPE_THEMES = {
  matrix: 'matrixGreen',
  sphere: 'cyberpunk',
  donut: 'nebula',
  helix: 'rainbow',
  cube: 'emerald',
  pipe: 'nebula',
  cylinder: 'cyberpunk',
  cone: 'emerald',
  infinity: 'cyberpunk'
};

// Ideal viewing angles (in radians) for showing shapes facing the display directly (flat-on)
const SHAPE_ANGLES = {
  matrix: { x: 0.0, y: 0.0 },
  sphere: { x: 0.0, y: 0.0 },
  donut: { x: 0.0, y: 0.0 },
  helix: { x: 0.0, y: 0.0 },
  cube: { x: 0.0, y: 0.0 },
  pipe: { x: 0.0, y: 0.0 },
  cylinder: { x: 0.0, y: 0.0 },
  cone: { x: 0.0, y: 0.0 },
  infinity: { x: 0.0, y: 0.0 }
};

// Unique cycle durations (in milliseconds) for each shape to vary showcase times (shortened showcase)
const SHAPE_DURATIONS = {
  matrix: 2000,    // 2.0s (1.0s Morph + 1.0s Flow Showcase)
  sphere: 4500,    // 4.5s (0.25s Scatter + 1.35s Morph + 2.9s Showcase)
  donut: 4800,     // 4.8s (0.25s Scatter + 1.35s Morph + 3.2s Showcase)
  helix: 5000,     // 5.0s (0.25s Scatter + 1.35s Morph + 3.4s Showcase)
  cube: 4200,      // 4.2s (0.25s Scatter + 1.35s Morph + 2.6s Showcase)
  pipe: 4800,      // 4.8s (0.25s Scatter + 1.35s Morph + 3.2s Showcase)
  cylinder: 4800,  // 4.8s (0.25s Scatter + 1.35s Morph + 3.2s Showcase)
  cone: 4800,      // 4.8s (0.25s Scatter + 1.35s Morph + 3.2s Showcase)
  infinity: 5200   // 5.2s (0.25s Scatter + 1.35s Morph + 3.6s Showcase)
};

// Particle size multipliers per shape to customize sizes
const SHAPE_PARTICLE_SIZES = {
  matrix: 1.2,      // bright neon green points
  sphere: 1.0,
  donut: 1.6,       // thick donut ring
  helix: 1.1,
  cube: 0.7,        // tiny particles for sharp grid edges
  pipe: 1.0,
  cylinder: 0.9,
  cone: 0.9,
  infinity: 1.4     // large glowing parallax ribbon loops
};

function setMorphTarget(shapeKey) {
  if (!shapes[shapeKey]) return;
  
  const targetCoordinates = shapes[shapeKey];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const coords = targetCoordinates[i];
    particles[i].setTarget(coords.x, coords.y, coords.z);
  }
  
  currentShapeName = shapeKey;
  nextShapeName = shapeKey;
  
  // Set different color for each shape automatically
  if (SHAPE_THEMES[shapeKey]) {
    colorPreset = SHAPE_THEMES[shapeKey];
    updateCSSTheme(colorPreset);
  }
}

// Live update document stylesheet variable tokens when switching color engines
function updateCSSTheme(themeName) {
  const root = document.documentElement;
  const theme = THEMES[themeName];
  
  root.style.setProperty('--accent-primary', theme.accent1);
  root.style.setProperty('--accent-secondary', theme.accent2);
  root.style.setProperty('--btn-hover-bg', theme.glow2);
  root.style.setProperty('--btn-active-bg', theme.glow1);
  
  // Apply a subtle transition to background ambient glow panels
  const glow1 = document.querySelector('.bg-glow-1');
  const glow2 = document.querySelector('.bg-glow-2');
  if (glow1) glow1.style.background = `radial-gradient(circle, ${theme.accent1} 0%, transparent 70%)`;
  if (glow2) glow2.style.background = `radial-gradient(circle, ${theme.accent2} 0%, transparent 70%)`;
}

// --------------------------------------------------
// Main Frame Loop
// --------------------------------------------------
function loop(timestamp) {
  globalTime = timestamp;
  
  // 1. FPS tracking (exponential moving average for stability)
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  renderFrameCount++;

  frameCount++;
  if (timestamp - lastFpsUpdateTime >= 1000) {
    fps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdateTime));
    smoothFps = smoothFps * 0.7 + fps * 0.3; // smooth to avoid jitter
    frameCount = 0;
    lastFpsUpdateTime = timestamp;
  }

  // Quality tier based on smoothed FPS
  // HIGH: >=50fps | MED: 30-49fps | LOW: <30fps
  const highQuality = smoothFps >= 50;
  const midQuality  = smoothFps >= 30;
  
  // 2. Adaptive particle size based on current shape
  targetParticleSizeMultiplier = SHAPE_PARTICLE_SIZES[currentShapeName] || 1.0;
  particleSizeMultiplier += (targetParticleSizeMultiplier - particleSizeMultiplier) * 0.08;

  // 3. Clear canvas (logical coords — ctx already scaled by DPR)
  ctx.fillStyle = 'rgba(3, 3, 7, 0.4)';
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Draw hacking code background
  drawHackingBackground(timestamp);
  
  // 3. Handle Auto-Morphing phase-based schedule
  const cycleTime = timestamp - lastMorphTime;
  const currentIndex = SHAPE_ORDER.indexOf(currentShapeName);
    if (currentShapeName === 'matrix') {
    // During startup morph (< 1.0s), use RGB/Rainbow color theme. Later flow transitions to neon green.
    if (cycleTime < 1000) {
      if (nextShapeName !== 'matrix_morph') {
        nextShapeName = 'matrix_morph';
        colorPreset = 'rainbow';
        updateCSSTheme('rainbow');
      }
    } else {
      if (nextShapeName !== 'matrix_flow') {
        nextShapeName = 'matrix_flow';
        colorPreset = 'matrixGreen';
        updateCSSTheme('matrixGreen');
      }
    }
    
    // Follow the sliding matrix coordinates (straight vertical rain)
    const targetCoordinates = generateMatrixGrid(timestamp);
    
    if (cycleTime < 1000) {
      // Morph phase: particles glide smoothly from initial coordinates into columns
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const delay = 100 + (i / PARTICLE_COUNT) * 800; // staggered delay window
        if (cycleTime >= delay) {
          particles[i].setTarget(targetCoordinates[i].x, targetCoordinates[i].y, targetCoordinates[i].z);
        }
      }
      morphSpeed = 0.045; // Smooth morph speed
    } else {
      // Flow phase: follow scrolling rain instantly
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles[i].setTarget(targetCoordinates[i].x, targetCoordinates[i].y, targetCoordinates[i].z);
      }
      morphSpeed = 1.0; // Instant track
    }
    
    rotSpeedMultiplier = 0.0;
  }
  else if (cycleTime < 250) {
    // Phase 1: Fast Scatter across screen (0.25s) in RGB/Rainbow
    if (nextShapeName !== 'scatter') {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles[i].setTarget(shapes.scatter[i].x, shapes.scatter[i].y, shapes.scatter[i].z);
      }
      nextShapeName = 'scatter';
      colorPreset = 'rainbow';
      updateCSSTheme('rainbow');
    }
    morphSpeed = 0.22; // Explode out fast
    rotSpeedMultiplier = 2.8; // Spin rapidly during explosion
  } 
  else if (cycleTime >= 250 && cycleTime < 1600) {
    // Phase 2: Snappy Converge morphing to shape (1.35s)
    if (nextShapeName !== currentShapeName) {
      nextShapeName = currentShapeName;
      colorPreset = SHAPE_THEMES[currentShapeName];
      updateCSSTheme(colorPreset);
      
      // Calculate nearest face-on viewing angle in multiple of Math.PI (180 deg)
      baseYaw = Math.round(targetAngleY / Math.PI) * Math.PI;
    }
    
    // Staggered morphing sweep (different particles start morphing at different times)
    const targetCoordinates = shapes[currentShapeName];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const delay = 250 + (i / PARTICLE_COUNT) * 800; // staggered delay window of 0.8s
      if (cycleTime >= delay) {
        particles[i].setTarget(targetCoordinates[i].x, targetCoordinates[i].y, targetCoordinates[i].z);
      }
    }
    morphSpeed = 0.055; // Glide quickly into shape targets
    rotSpeedMultiplier = 1.6;
  } 
  else {
    // Phase 3: Fast Showcase (direct face view with gentle half rotation)
    morphSpeed = 0.025; // Snappy settling
    rotSpeedMultiplier = 0.35; // Graceful float
  }
  
  const currentDuration = SHAPE_DURATIONS[currentShapeName] || 12000;

  if (cycleTime >= currentDuration) {
    // Transition to the next shape cycle
    const nextIndex = (currentIndex + 1) % SHAPE_ORDER.length;
    currentShapeName = SHAPE_ORDER[nextIndex];
    lastMorphTime = timestamp;
    nextShapeName = ''; // Reset to trigger the next scatter phase targets
  }
  
  // 4. Update camera angles and target zoom (zoom close on arrange, standard on showcase)
  let baseZoom = 1.55;
  if (canvas.width < 500) {
    baseZoom = 0.78;
  } else if (canvas.width < 1024) {
    baseZoom = 1.1;
  }
  if (currentShapeName === 'matrix') {
    // Lock camera completely flat, front-facing, and at normal size for Matrix rain
    targetAngleX = 0.0;
    targetAngleY = 0.0;
    baseYaw = 0.0;
    targetZoom = baseZoom;
    angleX = 0.0; // Hard reset to absolute zero rotation instantly
    angleY = 0.0;
  }
  else if (cycleTime < 250) {
    // Phase 1: Fast rotation spin during scatter explosion
    const rotationRate = BASE_ROTATION_SPEED * rotSpeedMultiplier;
    targetAngleY += rotationRate;
    targetAngleX += rotationRate * 0.4;
    targetZoom = baseZoom;
  } else if (cycleTime >= 250 && cycleTime < 1600) {
    // Phase 2: Glide camera smoothly to face the display directly, but keep rotating slowly while arranging
    targetAngleX = SHAPE_ANGLES[currentShapeName].x;
    targetAngleY += BASE_ROTATION_SPEED * 0.8; // Rotate camera during shape morphing
    baseYaw = targetAngleY; // Keep baseYaw locked to the moving Y angle
    targetZoom = baseZoom * 1.22; // Zoom in close so shape appears large during arrangement!
  } else {
    // Phase 3: Ultra slow motion 30% rotation (108 degrees) with subtle vertical wave
    const progress = Math.min(1.0, (cycleTime - 1600) / (currentDuration - 1600));
    targetAngleX = SHAPE_ANGLES[currentShapeName].x + 0.04 * Math.sin(progress * Math.PI * 2);
    targetAngleY = baseYaw + progress * (Math.PI * 2 * 0.3); // smooth 30% slow motion turn
    targetZoom = baseZoom; // Smoothly zoom out to normal full-display size!
  }
  
  // Easing calculations to smooth camera rotations and zoom levels
  angleX += (targetAngleX - angleX) * 0.18;
  angleY += (targetAngleY - angleY) * 0.18;
  zoom += (targetZoom - zoom) * 0.12; // Snappy zoom easing for fast transitions
  
  // 4. Update and project all particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles[i].update(mousePosition.x, mousePosition.y, mouseMode, morphSpeed);
    particles[i].project(angleX, angleY, centerX, centerY, zoom);
  }

  // 5. Depth-sort (Painters Algorithm)
  // Only re-sort every 2 frames at mid quality, every 3 at low — saves ~4ms/frame
  const sortInterval = highQuality ? 1 : midQuality ? 2 : 3;
  if (renderFrameCount % sortInterval === 0) {
    // In-place copy into pre-allocated array, then sort
    for (let i = 0; i < PARTICLE_COUNT; i++) sortedParticles[i] = particles[i];
    sortedParticles.sort((a, b) => b.rotZ - a.rotZ);
  }
  
  // 6. Render Connections (wireframe mesh lines)
  // Skip on low FPS or mobile to save GPU
  if (connectionThreshold > 0 && midQuality && !IS_MOBILE) {
    // Batch all lines into ONE path per color — avoids thousands of individual stroke() calls
    // Use the theme's primary color at low opacity instead of per-line gradients
    const theme = THEMES[colorPreset];
    const [r, g, b] = theme.primary;
    const lineOpacity = highQuality ? 0.22 : 0.15;
    ctx.strokeStyle = `rgba(${r},${g},${b},${lineOpacity})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    const connThreshSq = (connectionThreshold * 1.5) * (connectionThreshold * 1.5);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p1 = particles[i];
      if (currentShapeName === 'matrix') continue;
      if (p1.px < 0 || p1.px > logicalW || p1.py < 0 || p1.py > logicalH) continue;

      if (i < PARTICLE_COUNT - 1) {
        const p2 = particles[i + 1];
        const dx = p1.x - p2.x, dy = p1.y - p2.y, dz = p1.z - p2.z;
        if (dx*dx + dy*dy + dz*dz < connThreshSq) {
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
        }
      }

      if (currentShapeName === 'pipe' || currentShapeName === 'cylinder' || currentShapeName === 'cone') {
        if (i < PARTICLE_COUNT - 30) {
          const p2 = particles[i + 30];
          const dx = p1.x - p2.x, dy = p1.y - p2.y, dz = p1.z - p2.z;
          if (dx*dx + dy*dy + dz*dz < connThreshSq) {
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
          }
        }
      }
    }
    ctx.stroke(); // ONE stroke call for all lines
  }
  
  // 8. Render Particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = sortedParticles[i];
    
    // Skip rendering if particle is off-screen
    if (p.px < -20 || p.px > logicalW + 20 || p.py < -20 || p.py > logicalH + 20) {
      continue;
    }
    
    // Calculate radius size based on depth scale, static random weight, and temporal oscillation
    const sizeOsc = 1.0 + 0.35 * Math.sin(timestamp * 0.0035 + p.index * 0.08);
    const size = p.pScale * particleRadius * p.sizeWeight * sizeOsc * particleSizeMultiplier;
    if (size <= 0.1) continue;
    
    ctx.fillStyle = p.getColor(colorPreset, timestamp);
    
    let drawAsChar = false;
    if (currentShapeName === 'matrix') {
      if (cycleTime >= 1000) {
        // After morph is complete, draw everything as characters (classic code rain)
        drawAsChar = true;
      } else {
        // During startup morph, render a mix of 50% characters and 50% standard circular particles
        drawAsChar = (p.index % 2 === 0);
      }
    }

    if (drawAsChar) {
      ctx.save();
      const fontSize = 18; // Exactly 18px font size
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Flickering matrix letters/numbers
      if (Math.random() < 0.04) {
        p.char = getRandomMatrixChar();
      }
      ctx.fillText(p.char, p.px, p.py);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.px, p.py, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Add an inner core glow for large particle radius styles
      if (particleRadius >= 3.0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(p.px, p.py, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  requestAnimationFrame(loop);
}

// Start visualizer on page load
window.addEventListener('DOMContentLoaded', init);
