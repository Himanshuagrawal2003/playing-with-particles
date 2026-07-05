# MorphOS: Real-Time Particle Morphing Engine Walkthrough

The visualizer runs transition phases inside a **fast, snappy timeline cycle**, starting with a **locked front-facing green Matrix code rain intro flowing instantly on page load in vertical columns, written as horizontal blocks of 4 characters stacked continuously**, and cycling through **8 distinct shape timelapses** (Sphere, Donut, Helix, Cube, Pipe, Cylinder, Cone, Infinity) with wireframe outline connections, camera rotation **during morphing**, a background **hacking code stream overlay**, **shape-dependent particle sizes**, **dynamic camera zoom gliding**, compact local slow-motion scatter transitions, and **background audio/music support**.

---

## Background Audio Support ("Add Song Flying Jatt")

To play background music while keeping the browser responsive:

- **Autoplay Compliance (`initAudio()`)**:
  - The browser's native autoplay block is bypassed by binding a once-only click listener to the `window`.
  - When the user first clicks anywhere on the screen, the looped `<audio>` player triggers playback.
- **Dynamic Equalizer Controls**:
  - A premium floating audio controller box is added in the top-right corner (`#audioControl`).
  - Displays jumping equalizer wave bars that animate dynamically (`animation: equalizerKey`) when music is playing, and freeze flat when paused or muted.
  - Users can click the button to play, pause, or mute at any time.
  - The player colors dynamically sync with the active visualization accents (`--accent-primary` and `--accent-secondary`) as shape themes switch!
- **Workspace Source Files**:
  - The browser is configured to search for local file named **`flying_jatt.mp3`** (or fallback **`song.mp3`**) inside the workspace root directory.
  - Simply place the audio file in the folder, and it will load and play!

---

## Startup Matrix Rain Customizations ("Continuous Horizontal Sets, 15 Columns")

To build a structured hacking terminal aesthetic, characters are grouped into horizontal blocks of 4 and stacked continuously:

- **2.0 Seconds Intro Sequence Duration ("This Part For A 2 Sec Only")**:
  - The total duration for the Matrix sequence on load has been set to exactly **`2.0 seconds`** (`matrix: 2000`).
  - **Phase 1: Arrange Morph (0.0s to 1.0s)**: Particles glide smoothly in RGB/Rainbow colors to align in vertical columns (50% circles, 50% characters).
  - **Phase 2: Code Flow (1.0s to 2.0s)**: Particles turn green and flow down vertically as green monospaced characters.
  - At 2.0 seconds, the engine smoothly transitions to the next shape cycle.
- **Removal of Partial Rows & Scrolling Gaps ("Gap Na Rahe Bilkul")**:
  - The exact number of complete sets of 4 characters that fit perfectly inside each column is calculated dynamically using `setsPerCol = Math.floor(PARTICLE_COUNT / cols / 4)` and `gridCount = cols * setsPerCol * 4`.
  - Particles belonging to the grid are placed inside completed horizontal sets of 4, while any remaining extra particles are placed far off-screen (`x, y, z = 9999`) to prevent incomplete rows from rendering.
- **Continuous Vertical Flow ("In Loop No Spacing")**:
  - Vertical spacing between horizontal sets is set to exactly **`18px`** (`setSpacing = 18`), which matches the row height.
- **Eliminating Empty Top and Bottom Margins**:
  - Increased `PARTICLE_COUNT` from `1500` to **`3000`**.
  - This doubles the vertical height of the scroll grid columns (`paddedH = setsPerCol * 18`) so that under all responsive zoom settings, the columns span far beyond the screen height bounds.
  - As a result, the code rain covers the screen entirely from the top edge to the bottom edge, wrapping around seamlessly outside the viewport.
- **Horizontal Set Layout**:
  - The 4 characters of each set are laid out horizontally side-by-side:
    - $x = \text{colCenter} + \text{innerIndex} \cdot \text{innerSpacing} - 1.5 \cdot \text{innerSpacing}$ with `innerSpacing = 11`.
- **Responsive Viewport Density**:
  - Columns count `cols` is calculated dynamically depending on screen size to prevent text overlapping or overflowing on narrow viewports:
    - **Mobile (`width < 500px`)**: **`6 columns`** of code rain.
    - **Tablet (`500px <= width < 1024px`)**: **`10 columns`** of code rain.
    - **Desktop (`width >= 1024px`)**: **`15 columns`** of code rain.
- **Startup Morph Arrangement ("Back 2 Step")**:
  - On page load, particles spawn in standard randomized positions (a floating cloud) using `new Particle(i)`.
  - Camera pitch/yaw coordinates and zoom remain locked flat-on (`targetAngleX/Y = 0.0`, `angleX/Y = 0.0`, `targetZoom = baseZoom`) for the entire duration of the Matrix opener.
- **18px Character Size**: Matrix letters and numbers render at a constant size of exactly **`18px`** in bold monospace style.
- **Slower Flow Speed**: The vertical scrolling speed has been decreased (changing flow multiplier from `0.15` to **`0.08`**) to scroll blocks down at a clean, cinematic pace.
- **Flat 2D View**:
  - Perspective scaling division and Y-axis rotation are completely bypassed for the Matrix phase once the arrangement completes at 1.0s, drawing columns as perfectly straight parallel lines.

---

## 3D Shape Particle Size Balance & High Density ("Chota Karo Bhai")

To maintain high resolution and sharp geometry details without visual clutter, the particle size parameters have been scaled back to balanced proportions:

- **High-Density Geometries**: With `PARTICLE_COUNT = 3000`, the 3D structures (Sphere, Torus, helix, double ribbon, Cylinder, etc.) render with twice the point density, making the wireframe models look incredibly premium and solid.
- **Balanced Base Particle Size**: The base `particleRadius` has been set to **`2.4`** (slightly larger than original `2.0`, but much sharper and smaller than `3.5`).
- **Normalized Shape Multipliers**: Restored multipliers inside `SHAPE_PARTICLE_SIZES` to ensure 3D structures render with clean details:
  - **Sphere**: **`1.0`**
  - **Donut**: **`1.6`** (thick donut ring outline)
  - **Helix**: **`1.1`**
  - **Cube**: **`0.7`** (using dynamic faces subdivision `gridWidth = Math.ceil(Math.sqrt(PARTICLE_COUNT / 6))` to draw a perfect $23 \times 23$ grid face)
  - **Pipe**: **`1.0`**
  - **Cylinder**: **`0.9`**
  - **Cone**: **`0.9`**
  - **Infinity**: **`1.4`** (parallax ribbon loops)

---

## Mobile and Tablet Responsiveness ("Responsive for Mobile and Tabls")

To maximize 3D shape footprint and prevent graphics clipping:

- **Responsive Camera Zoom**:
  Camera zoom targets adapt dynamically in `resizeCanvas()` and `loop()` based on the device width:
  - **Mobile (`width < 500px`)**: target zoom is set to **`0.78`** to fit all shape bounds inside the narrow screen.
  - **Tablet (`500px <= width < 1024px`)**: target zoom is set to **`1.1`**.
  - **Desktop (`width >= 1024px`)**: target zoom is set to **`1.55`** to maximize the screen footprint.

---

## Alphanumeric Matrix Rain ("1,2,3,4 and Alphabets Green Rain")

- **Alphanumeric Render Logic**:
  When `currentShapeName === 'matrix'`, the renderer bypasses drawing circles and draws text characters instead:
  - Font is styled using monospaced bold text: `bold 18px monospace`.
  - Characters flicker randomly (`0.04` probability per frame) to simulate dynamic, scrolling terminal activity.
  - Standard circular glow particles resume once the visualizer transitions to the next shapes.
- **Disconnected Columns**:
  Wireframe links are disabled for the `matrix` shape to keep characters clean, legible, and clear as they fall.

---

## 8 Shape Timelapses Sequence

The visualization order cycles through **8 geometric shapes** in a continuous loop:

1. **Sphere** (Circle):
   Golden ratio spiral point distribution.
2. **Donut** (Torus):
   An extremely fat and thick donut structure ($R=110, r=70$).
3. **Double Helix** (Coding Algorithm):
   Intertwined double-helix loops connected by horizontal rungs representing code/data.
4. **Cube**:
   A sharp 3D box with side length 200, formed by six $23 \times 23$ grid faces.
5. **Long Pipe**:
   A horizontal cylindrical pipe extending horizontally across the screen (radius $65$, length $320$). Wireframe lines connect adjacent slices to draw a solid cylinder tube.
6. **Cylinder**:
   A vertical cylindrical cage mesh consisting of 50 vertical circles of radius $110$ and height $240$.
7. **Cone**:
   A vertical conical cage mesh tapering from base radius $140$ to a sharp point at the tip.
8. **Infinity Ribbon ($\infty$)**:
   The horizontal double-layer nested Lemniscate of Bernoulli.

---

## Shortened Showcase Durations ("Showcase Time Kam Kar Do")

To prevent long idle times in slow motion and speed up the shape morph cycle, the overall shape durations in `SHAPE_DURATIONS` inside [app.js](file:///c:/Users/himan/OneDrive/Desktop/timepass/app.js) have been reduced:

- **Cube**: **4.2 seconds** (0.25s Scatter + 1.35s Morph + **2.6s Showcase**)
- **Sphere** (Circle): **4.5 seconds** (0.25s Scatter + 1.35s Morph + **2.9s Showcase**)
- **Donut**: **4.8 seconds** (0.25s Scatter + 1.35s Morph + **3.2s Showcase**)
- **Long Pipe**: **4.8 seconds** (0.25s Scatter + 1.35s Morph + **3.2s Showcase**)
- **Cylinder**: **4.8 seconds** (0.25s Scatter + 1.35s Morph + **3.2s Showcase**)
- **Cone**: **4.8 seconds** (0.25s Scatter + 1.35s Morph + **3.2s Showcase**)
- **Double Helix**: **5.0 seconds** (0.25s Scatter + 1.35s Morph + **3.4s Showcase**)
- **Infinity Ribbon**: **5.2 seconds** (0.25s Scatter + 1.35s Morph + **3.6s Showcase**)

---

## Background Hacking Code Streams ("Hacking Time Per Code Run Effect")

To simulate a real hacking compiler/terminal running scripts in the background, we introduced vertical scrolling code streams behind the 3D particles:

- **Source Code Snippets**: The rain is constructed using actual segments of the visualizer's source code, keeping it visually authentic.
- **Glitch Details**: Each code line is followed by trailing binary and hexadecimal addresses (e.g. `1  0x3C`, `0  0xA5`) scrolling downwards.
- **Theme Color Synchronization**: The scrolling code color dynamically shifts to match the theme color of the active shape.
- **Subtle Layering**: Set to low opacity (`0.03 - 0.08`) and drawn at the start of the frame, ensuring it creates an immersive hacking atmosphere.

---

## Camera Rotation During Morphing ("Arrange Time Me Rotate Ho")

During Phase 2 (Morph/Arrangement), as particles are slowly gliding to form the shape ($0.4\text{s} \to 3.4\text{s}$), the camera continues to rotate:

- **Angle calculation**:
  `targetAngleY += BASE_ROTATION_SPEED * 0.8;`
- **Dynamic Lock**:
  The variable `baseYaw` is updated continuously in Phase 2 (`baseYaw = targetAngleY`). When Phase 3 starts, it transitions smoothly into the slow-motion showcase turn:
  $$\text{targetAngleY} = \text{baseYaw} + p \cdot 2\pi \cdot 0.3$$
This ensures the shape rotates gracefully while forming.

---

## 3D Wireframe Outline Connectivity ("Shape Define Ho")

To make shapes appear solid and clearly defined rather than loose point clouds, we enabled structural wireframe connections by setting `connectionThreshold = 38`:

- **Sequential Links**: Adjacent particles along the mathematical path ($i \to i + 1$) are connected by a gradient line if their 3D distance is less than $38 \times 1.5 = 57\text{px}$.
- **Grid Mesh Links**: For the **Long Pipe**, **Cylinder**, and **Cone**, horizontal/vertical column links are added along the tube ($i \to i + 30$). This binds adjacent circular slices, creating perfect mathematical 3D cage outlines.
- **Dynamic Fade-In**: When particles scatter, the lines disappear. As they morph and converge into the shape, the lines automatically fade in, locking the structure together.

---

## Verification

The server is hosted locally at **`http://localhost:8080`**. Open this URL to enjoy the clean, fullscreen, high-speed morphing and slow-motion front-facing particle visualizer.
