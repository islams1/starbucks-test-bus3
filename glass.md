# AGR-01 reverse-engineering note: src/glass (the renderer's glass)

Source: `water-out-of-place/app/src/glass/` (index.js, pass.js, registry.js, dim.js, game.js, lab.js, glass.css, lab.css),
tests `test/glass-{dim,game,registry,timer}.test.js`, QA tools `tools/glass-qa.mjs` and `tools/glass-probe.mjs`.
Paths in cites are relative to `water-out-of-place/app/`. Nothing was run.

## What it does

The glass is a full-screen post-processing pass that is the last pass of the composer. It reads the finished
world frame and, inside each registered DOM element's rounded rectangle, draws a liquid-glass lens: a bent,
frosted, slightly brightened and tinted copy of the world, with a rim and an inner glow. Outside every shape the
frame passes through unchanged. The DOM text and controls stay above the canvas, so nothing on the glass is blurred.
The element's own CSS background is made transparent while the pass runs. A per-shape "dim" darkens the glass
just enough that the text on it reaches 4.5 to 1 contrast, measured on the GPU from the glass itself, not from the
world. Shapes come from a registry of DOM elements (max 16). A CSS fallback panel takes over when the pass is off,
fails to compile, or a shape is left out by the cap.

## Exports and public interface

| Export | Where | Signature and purpose |
| --- | --- | --- |
| `makeGlass` | index.js:21 | `({ on, taps, broken }) → { factory }`. Sets html classes, starts the frame ring, returns the composer factory (null when off). |
| `window.__glass` | index.js:49-60 | Test and QA hooks: `on`, `dims()`, `lastGpuMs()`, `gpuMs()`, `frameMs()`, `force(n)`, `attach(on)`, `pass`, `register`, `slotOf`. `main.js:73` adds `game`. |
| `FROST_PX`, `SATURATE`, `BRIGHTNESS`, `TINT` | pass.js:87-88 | 2.2 CSS px sigma; 1.4; 1.04; 0.07. |
| `DIM_INK`, `PRIMARY`, `RIM`, `GLOW` | pass.js:89-92 | Dim ink rgb; teal primary at alpha 0.8; rim table; two inner-glow layers. |
| `frostTaps(n, sigma)` | pass.js:97 | `→ [x, y, w][]`: n centred Gaussian taps (golden-angle spiral), variance corrected for bilinear taps. |
| `LIT(taps)` | pass.js:119 | GLSL string: uniforms and helpers shared by the glass, the dim's sampler and the lens. |
| `makeTimer(gl)` | pass.js:257 | `→ { begin(), end(), last, count, history() }` or null, from EXT_disjoint_timer_query_webgl2. |
| `class GlassPass extends Pass` | pass.js:283 | The pass. `constructor({ rects, dim, taps, broken })`, `render(...)`, `setTaps(dpr)`, `viewOf()`, `redraw()`, `drawTwin()`, `precheck()`, `check()`, `dispose()`. |
| `KIND` | registry.js:20 | `{ card 0, floating 1, pill 2, primary 3, clock 4 }`, the kind codes in the shape data. |
| `LENS` | registry.js:23-29 | Per kind: bezel and displacement scale in CSS px (card 30/52, floating 22/38, pill, primary, clock 14/26). |
| `MAX_SHAPES`, `PILL` | registry.js:30-31 | 16 shapes; radius 999 means a pill (half the short side). |
| `makeRegistry()` | registry.js:33 | `→ { registerGlass, rects, glassCount, slotOf }`. A private registry; the app uses the shared one. |
| `registerGlass(el, { kind, radius, priority })` | registry.js:40 | Adds an element, sets `data-glass`, returns `unregister()`. Throws on an unknown kind. |
| `rects(dpr, height, styleOf, width)` | registry.js:67 | Once a frame: `→ { data, inner, count, was }`. Reads the DOM (see Gotchas). |
| `slotOf(el)` | registry.js:112 | The slot the element was drawn in at the last `rects()`, or -1. |
| `glassCount()` | registry.js:114 | Number of registered elements. |
| `makeDim(taps)` | dim.js:234 | `→ { update, read, debug, dispose }`. The GPU dim: samples, counts, target, smoothing. |
| `gridOf(hw, hh)` | dim.js:57 | Sample grid over a text box: nx × ny ≤ 1024, cells near square. |
| `dimFor(L)` | dim.js:62 | The page's dim for a field luminance L (reference formula, not used by the pass). |
| `next(prev, target, dt, cut)` | dim.js:69 | One smoothing step of the dim (JS twin of `nextDim`). |
| `dimOfGlass(G)` | dim.js:77 | Dim for a measured glass luminance G, with the 3 % margin. |
| `holdTarget(held, fresh, since, dt)` | dim.js:82 | The held target and the time since the last rise. |
| `smoothStep(prev, fresh, dt, cut)` | dim.js:90 | One step for one shape: `→ [dim, held, since]`. |
| `cutBetween(a, b)` | dim.js:97 | Camera cut test on `[x, y, z, dx, dy, dz]` views. |
| `LEVELS`, `dimFromAbove(F)`, `targetOf(vals)` | dim.js:104-120 | The 32 levels, the 90th-percentile dim from the share above each level. |
| `DIM_GLSL` | dim.js:123 | GLSL twins of `dimFor`, `nextDim`, `holdTarget`. |
| `GAME_GLASS` | game.js:138 | `[selector, kind, priority]` table for the game's own panels. |
| `UNDER` | game.js:152 | Selector for the game elements a card can lie over. |
| `holePath(u, holes)` | game.js:160 | `→ 'path(evenodd, "…")'` clip-path that cuts rounded holes, or ''. |
| `cuts(cards, under, below)` | game.js:174 | `→ Map(element → clip-path)` for the elements under drawn cards. |
| `glassGame({ root, register, Observer, radiusOf, raf })` | game.js:183 | Keeps the game's panels registered and cuts the holes. `→ { stop, elements, clipped, looping }`. |
| `VIEWS` | lab.js:250 | Five camera presets: sectors, maize, channel, aerial, water. |
| `runLab({ world, view })` | lab.js:277 | The glass lab page (`?glasslab=<view>`). Sets `window.__lab` and `window.__agr`. |

## How it works

### 1. Wiring (index.js, main.js)

`main.js:41` calls `makeGlass` with `on` false for `?glass=0` and `?q=low`, `taps` from `?taps=` (default 13),
and `broken` for `?glassbreak=1`. `main.js:63` passes `glass.factory` into `buildWorld`. `world/index.js:69`
runs `composer.addPass(glass(composer))`, so the pass is last and writes the screen.

The factory (index.js:63-71) builds the `GlassPass` with the shared `rects`, `makeDim(taps)`, and the world's
perspective camera (`pass.view`, index.js:66), used for the camera-cut test. Two callbacks set html classes:
`onFail` swaps to `no-glass` (index.js:36-40); `onReady` (after frame 1) adds `glass-on` (index.js:68).
`attach(want)` (index.js:42-47) adds or removes the pass from the composer for QA.

A ring buffer of the last 600 rAF intervals (index.js:19, 27-34) feeds `frameMs()`.

### 2. The pass and the composer (pass.js:283-359)

The pass extends `postprocessing`'s `Pass`. Two full-screen `ShaderMaterial`s share `postprocessing`'s fullscreen geometry
(`Pass.fullscreenGeometry`):
- the glass (`fullscreenMaterial`, pass.js:300-314): uniforms `inputBuffer`, `uDim`, `uShapes` (array of
  `MAX_SHAPES * 2` vec4), `uCount`, `uDpr`, `uRes`, `uTaps` (`taps * 3` floats). `depthWrite` and `depthTest` are off,
  and `toneMapped: false`.
- the copy (`copyMaterial`, pass.js:315, `COPY` at pass.js:247): the plain frame, converted once. It runs when the
  pass is failed.

`render()` (pass.js:329-359) in order:
1. First frame only: `precheck()` compiles the program and reads its status without drawing (pass.js:403-408).
2. If failed, copy the input and return.
3. `rects(dpr, H, undefined, W)` returns the shapes for this frame (pass.js:339). `forced` (QA) can cut the count
   (pass.js:340).
4. `setTaps(dpr)` rebuilds the frost tap table when the pixel ratio changes (pass.js:322-327). The sigma is
   `FROST_PX * dpr`, so the blur is the same size in CSS px at any ratio.
5. `timer.begin()` (pass.js:350). The first call makes the timer once, from the GL context (pass.js:349).
6. `dim.update(...)` (pass.js:351) returns the smoothed dim texture, or null when there are no shapes.
7. Draw the glass to `outputBuffer` (or the screen when `renderToScreen`, pass.js:330). `timer.end()` (pass.js:354).
8. `check()` runs on the first three frames only (pass.js:356, 410-419). It catches a program that links but
   reports `runnable === false`.
9. The QA hooks `twin` and `probe` run only when drawing to the screen (pass.js:357-358).

`uniform` `uDpr` is the renderer pixel ratio. `uRes` is the input size in buffer px. The shape vec4s are in buffer
px with y up, matching `gl_FragCoord`.

### 3. The SDF rounded rectangles (pass.js:129-132, 233-242)

`sdRoundBox(p, b, r)` is the standard rounded-box signed distance: `p` from the box centre, `b` the half size,
`r` the radius. The main fragment loops over the shapes in slot order (pass.js:231-242):
- skip shapes whose bounding box (half size + 1 px) misses the pixel (pass.js:234-235);
- compute `sd`; skip when `sd >= 0.5` (pass.js:236-237);
- `cover = clamp(0.5 - sd, 0, 1) * b.z` gives the anti-aliased edge times the element's opacity (pass.js:239);
- blend the source and the glass in sRGB values with `cover`, then `dec()` back to linear (pass.js:240);
- `break` (pass.js:241). **The first shape that covers the pixel wins.** Overlapping shapes do not blend.

Per shape the data is two vec4s (registry.js:84-91): `a = [cx, cy, halfW, halfH]` and
`b = [radius·dpr, kindCode, opacity, lensK]`. `lensK` is the CSS custom property `--lens` (default 1).

### 4. The lens (pass.js:141-151)

The lens follows the Apple-style page model (the comment at pass.js:144-145 refers to the design page's `dispMap`).
Constants come from `LENS` by kind (pass.js:126-127):
- `bz = BEZEL[kind] * uDpr` (pass.js:146), e.g. 30 px for a card.
- `q = abs(p) - (halfSize - r)`, and `n` is the outward normal: the nearest edge's direction, or the corner
  direction (pass.js:147-148).
- `t = clamp(1 + min(sd, 0) / bz, 0, 1)` (pass.js:149). `t` is 1 on the edge and 0 at one bezel depth in.
- `off = n · t² · SCALE[kind] · uDpr · lensK · (127/255)` (pass.js:150). The factor 127/255 is the
  feDisplacementMap convention of the page (the comment at pass.js:145). For a card at `lensK` 1 the largest
  push is about 26 CSS px.

The frost reads through that offset. The sampler reads each tap from `at + tap + off` (pass.js:157-161).

### 5. The frost (pass.js:87, 97-108, 153-165)

The blur is a Gaussian with `FROST_PX` 2.2 CSS px sigma, which is the page's `blur(2.2px)`. It is not a
separable blur. It is a sum of `FROST_TAPS` (default 13) samples:
- The radii are the Gaussian quantiles, `r_k = sqrt(-2 ln(1 - (k + 0.5)/n))` (pass.js:100). The angles are
  successive golden angles, `turn = π(3 - √5)` (pass.js:98, 101). The weights are equal, `1/n` (pass.js:107).
- The points are centred (pass.js:103-104). Their per-axis variance `v` is then scaled so that
  `k²·v = sigma² − 1/6` (pass.js:105-106). The 1/6 px² is the variance each bilinear tap adds (per the comment at
  pass.js:95-96). So the kernel's total variance is sigma².
- Each tap is read through `enc1()` (sRGB encode), summed, and the result is clamped and decoded later. That
  makes the average happen in sRGB values, as CSS `blur()` does (pass.js:151-152, 164).
- Inside the bezel the three channels take separate offsets: green at 0.97 and blue at 0.94 of red's offset
  (pass.js:159-161). That is the colour fringe, the chromatic dispersion at the rim.
- Outside the bezel (t = 0) the taps are plain (pass.js:164).

`taps` is set by `?taps=` (13, 9 or 5 per main.js:5). The G1 gate measures 13 taps (glass-qa.mjs:337).

### 6. Saturate and brightness (pass.js:166-173)

`SAT` is the Filter Effects saturate matrix with S = 1.4 (pass.js:167-171). The result is clamped, multiplied by
`BRIGHTNESS` 1.04, clamped again (pass.js:172-173). Both clamps mirror CSS filters, which clamp each step.

### 7. Tint, dim and primary (pass.js:213-226)

`glass(i, p, sd, a, b)` (pass.js:213) runs in this order, all in sRGB values:
1. `lit()`: lens, frost, saturate, brightness.
2. If the kind is `primary` (3): mix 0.8 of teal `rgb(127, 209, 199)` (pass.js:90, 219). No dim, no tint.
3. Otherwise: mix 7 % white (`TINT`, pass.js:221), then mix the dim toward `DIM_INK` rgb(6, 12, 9) by
   `texelFetch(uDim, (i, 0)).r` (pass.js:222). The dim is the smoothed texel for shape i.
4. `finish()` (pass.js:186-202): the inner glow and the rim.

`finish()` details:
- Two inset glows (pass.js:188-197), built from `GLOW`: layer 1 (x 1.5, y 2, blur 6, spread -3, a 0.75) is
  applied last, so it is on top; layer 0 (x -1.5, y -2, blur 6, spread -3, a 0.35) first. Each uses a
  `sdRoundBox` offset and `phi(h / sg)`, a logistic CDF with 1.702 (pass.js:177), and mixes white by `a`.
  `sg = blur/2 · dpr` is the blur sigma (pass.js:193).
- The rim (pass.js:198-200): `band` is 1 inside 1.4 px of the edge (`RIM.width`, pass.js:91, 198), `along` is the
  135° position along the perimeter (pass.js:199), and `rimAlpha(along)` is a four-stop ramp (pass.js:178-183):
  0.95 at 0, 0.18 at 0.28, 0.04 at 0.55, 0.55 at 1. The rim is mixed white at opacity 0.85 (`RIM.opacity`).
  The result is bright at the top left and bottom right and dark in the middle, like a bevel.

### 8. sRGB and linear (pass.js:80-82, 133-137, 243)

The frame arrives linear (HalfFloat). `enc1` (pass.js:133) is the sRGB encode (linear slope under 0.0031308, then
`pow(c, 0.41666) · 1.055 − 0.055`). `dec` (pass.js:135-137) is the matching decode, with 0.04045 and 2.4. The
glass is worked in sRGB, so the CSS-like filters match the page. `main()` ends with `#include <colorspace_fragment>`
(pass.js:243), which does the single linear-to-output conversion. `toneMapped: false` keeps three from tone mapping
it again. The same pair of conversions is used for the sample shader in dim.js, but there the luminance is taken
in linear light (dim.js:152, Rec. 709 coefficients).

### 9. The shape data (registry.js:33-115)

`rects(dpr, height, styleOf, width)` builds `data` (16 × 8 floats) and `inner` (16 × 4). The steps, per element
in priority order (`ordered()`, registry.js:35-38):
1. Read the computed style and the bounding rect. The element must be connected, not `display: none` or
   `visibility: hidden`, and pass `checkVisibility({ visibilityProperty, opacityProperty })` when the browser has it
   (registry.js:61-65, 74). It must have a positive size and overlap the viewport (registry.js:75).
2. `opacity` is the element's computed opacity times each ancestor's, up to the root (registry.js:52-60, 76). A
   fading card fades its glass. Zero opacity skips it (registry.js:77).
3. Radius: `e.radius`, or half the short side for radius 999, and clamped to half the short side (registry.js:81).
4. Centre, halves and y flip into buffer px (registry.js:84-87).
5. `inner` is the content box: the rect less border and padding on each side (registry.js:92-99). The dim
   measures under this box, so the text is judged where it is.
6. `was[count]` records the slot the element had last frame, so the dim smoothing follows the element, not the
   slot (registry.js:100).

The cap (registry.js:78): once 16 are drawn, the rest get `data-glass-drop` (`setDropped`, registry.js:105-109)
and their slot is -1. `glass.css` gives a dropped element the CSS fallback.

`registerGlass` (registry.js:40-50) stores `{ el, kind, code, radius, priority, order, slot, dropped }`, sets
`el.dataset.glass`, and returns an `unregister` that removes the mark once the last registration for that element
goes. Lower `priority` draws first, then registration order. The game uses 0 for panels, 1 for floating, 2 for the
clock, 3 for pills (game.js:137-148), so panels get slots before pills when the cap bites.

### 10. The adaptive dim (dim.js)

The dim answers the question: how dark must the glass be so the text on it reaches 4.5 : 1 against the ink
#F6F4EE? It is measured from the glass, on the GPU, every frame, with no readback in normal running (dim.js:1-2).
The chain has four passes. Each has a small render target (dim.js:236-240):

(a) **Samples** (`SAMPLE`, dim.js:146-166). A 256 × 16 HalfFloat target. Row i is shape i. Each texel holds four of
the 1024 luminances `gridOf()` spreads over the shape's content box (dim.js:57-60). A sample is the glass's linear
Rec. 709 luminance with no dim: `lit`, 7 % tint, `finish` (dim.js:146-152). Samples past the grid, and primaries,
are -1 (dim.js:157, 166).

(b) **Counts** (`COUNT`, dim.js:168-179). A 32 × 16 target. Entry (k, i) is the share of shape i's samples at or
above `LEVELS[k]`. `LEVELS[k] = K / (1 − 0.55·k/31) / 1.03` (dim.js:104), so level 0 is where the dim starts and
the last level is the cap.

(c) **Target** (`TARGET`, dim.js:182-202). A 16 × 1 target. It finds where the share falls through 0.1 (`ABOVE`,
dim.js:50). That is the 90th percentile of the glass. It interpolates the dim between the two levels:
`dim = 0.55·(k−1+a)/31`, the cap being 0.55 (`DIM_CAP`, dim.js:49).

The constant `DIM_K = 0.1622` (dim.js:50) is `(0.905 + 0.05)/4.5 − 0.05`: the brightest glass that still gives
4.5 : 1 behind ink #F6F4EE. `G_MARGIN = 1.03` (dim.js:55) makes the measured luminance 3 % brighter, for the
1024-point sampling (dim.js:54). The comments (dim.js:21-23) say the cap is 0.55, not the page's 0.5. A coordinator's
ruling put 4.5 : 1 above the cap.

(d) **Smoothing** (`SMOOTH`, dim.js:206-218). Two 16 × 1 targets ping-pong (dim.js:239, 270-277). Each texel holds
`r` = the dim drawn, `g` = the held target, `b` = the glass's G90, `a` = the time since the target last rose (s,
capped at 1). The step, shared by `nextDim` (dim.js:128-134) and `holdTarget` (dim.js:135-138):
- Rise is fast: exponential, τ = 0.05 s (`TAU_RISE`, dim.js:49). The 95 % settle time is 3τ = 0.15 s.
- Fall is slow: τ = 0.2 s (`TAU_FALL`). The 95 % settle time is 0.6 s.
- The change per frame is capped at `STEP_MAX` = 0.019 (dim.js:49, 133).
- The target is held (`holdTarget`, dim.js:82-86). It rises at once. It falls only when the new target is more
  than `HOLD` = 0.02 below the held one, and `RISE_HOLD` = 0.75 s have passed since the held target last rose. So a
  shaking percentile does not shake the glass, and one glint after another raises it once.
- A camera cut (`CUT_MOVE` 0.5 m or `CUT_TURN` 20°, dim.js:53, 97-102) snaps every dim to its held target that
  frame. A local cut (the target more than `LOCAL_CUT` = 0.1 above the dim, dim.js:53, 71) snaps that one glass.
- A new shape starts at its target (dim.js:92).

The pass takes the result with `texture` and uses `texelFetch(uDim, ivec2(i, 0))` (pass.js:222). `update()`
returns the smoothed texture (dim.js:279). `read()` (dim.js:282-292) copies it to a 16 × 1 float target and reads
it back for QA and `__glass.dims()` only. `debug()` (dim.js:294-304) does the same for the samples and counts.

The JS functions (`next`, `holdTarget`, `smoothStep`, `dimFromAbove`, `targetOf`) are the GLSL's twins, for the
tests (dim.js:41-42, 222-228 in the test file).

### 11. The GPU timer (pass.js:252-281)

`makeTimer(gl)` takes EXT_disjoint_timer_query_webgl2 (pass.js:258-260). It returns null when the extension is
absent, and the pass then runs with `timer` null. `begin()` opens a `TIME_ELAPSED_EXT` query before the dim and the
glass are drawn (pass.js:266). It is skipped while a query is active or more than 6 are pending (pass.js:266).
`end()` closes it, then takes the results in order, as they become available (pass.js:267-276).
- A result is dropped when `GPU_DISJOINT_EXT` is set (pass.js:270-273), so a clock change does not count.
- `last` is the newest time in ms (ns / 1e6). `history()` returns up to 600 values, oldest first (pass.js:279).
- On `webglcontextlost` the extension and the pending queries are dropped (pass.js:263). On
  `webglcontextrestored` the extension is taken again (pass.js:264).

Results arrive a frame or more late, so `lastGpuMs()` is the latest known value, not this frame's.

### 12. The CSS fallback (glass.css)

The attribute `data-glass="<kind>"` (set by registration) and the class `lg` mark a glass element. The CSS has
three states:
- `html.glass-on` (the pass draws): `background`, `backdrop-filter`, `border-color` go transparent, and the
  element gets `--shadow` and `--ink` text with `--ink-shadow` (glass.css:12-20). A hover fill is
  `rgb(from var(--ink) r g b / 0.08)` (glass.css:22-24). A primary's text is dark (glass.css:25-28).
- `html:not(.glass-on)` or `[data-glass-drop]` (fallback): `--glass-fallback` background, `blur(var(--frost))`, a
  hairline `rgb(255 255 255 / 0.14)`, and per-kind radii `--r-card`, `--r-float`, `--r-pill`, `--r-clock`
  (glass.css:31-43). The primary keeps teal with dark ink (glass.css:45-49).
- Game extras: the bottom bar's own panel is cleared when the bar's buttons are glass (glass.css:55-61), and the
  subtitle line's background is cleared (glass.css:62).

The literal values in the fallback are on purpose (glass.css:6-10). The tokens are in `style.css` (not read here).

### 13. The game's panels (game.js)

`glassGame()` (game.js:183-233) keeps the game's own DOM registered with the shared registry:
- `GAME_GLASS` (game.js:138-148) names the elements: `.veil > .panel` (dialogs), `#start .panel`, `#closeup`,
  `#menu` as cards (priority 0); `#subs .line` and `#toasts .toast` as floating (1); `#watch` as clock (2);
  the top bar's and bottom bar's non-primary `.btn` as pills (3).
- `scan()` (game.js:188-199) runs on load and on each DOM change (`MutationObserver`, game.js:220-221, with
  `childList` and `subtree` only). It queries each selector, drops elements that left the set, and registers new
  ones. An element that is already inside a registered element is skipped (`nested()`, game.js:187), so there is no
  glass on glass. An element matched by two selectors is registered once, as the first (game.js:190).
- Each card's corner radius is read once, from `getComputedStyle` (game.js:154, 194).

**Cutting holes under cards (game.js:152-219).** The pass frosts the world, not the page, so a game element under a
drawn card would show through the card sharp. The CSS fallback's backdrop blur hid it. So `cut()` (game.js:205-219)
sets a `clip-path` on each element under a card. It runs every frame while a card is up and the pass draws, and
stops when there are none (game.js:217-218). The clip is a `path(evenodd, …)` with an outer frame of ±99999 px,
so overflow (a marker's label) still shows (game.js:160-169). `cuts()` (game.js:174-181) decides which card is above
which element with `below()` (game.js:202-203): a card in `.veil` or `#start` is above all of `#ui`, and one inside
`#ui` is above what precedes it in document order. The clip is only written when it changes (game.js:212-216).

### 14. The glass lab (lab.js, lab.css)

`?glasslab=<view>` (main.js:67-68) runs `runLab()`. It removes the start screen and HUD (lab.js:279-280), builds a
DOM page of Section 3 components with real text in `ar` or `en` (lab.js:264-275, 285-296), registers them
(lab.js:298), and places them with `lab.css` at fixed px positions that match the design shots (lab.css:67-88).
Views (lab.js:250-262) set the camera position, target and FOV, then `world.follow(true)`.

The loop (lab.js:316-325) has three modes: `live` (world time moves, dt clamped to 0.1 s), `hold` (world time
frozen at 12 s, still re-rendered, so the dim settles), and `manual` (QA ticks). `window.__lab` (lab.js:327-334)
exposes the view list, `setView`, `components()`, `hold(t)` and `live()`. `window.__agr` (lab.js:335-338) exposes
`frame`, `frames`, `manual`, `tick` and `world`.

## Dependencies

Imports in:
- index.js: `./glass.css`, `./dim.js` (makeDim), `./pass.js` (GlassPass), `./registry.js` (rects, registerGlass, slotOf).
- pass.js: `three` (DataTexture, Mesh, OrthographicCamera, Scene, ShaderMaterial, Uniform, Vector2) and
  `postprocessing` (Pass); `./registry.js` (LENS, MAX_SHAPES).
- dim.js: `three` (render targets, geometry, quads); `./registry.js` (MAX_SHAPES); `./pass.js` (LIT, TINT).
- registry.js: none.
- game.js: `./registry.js` (registerGlass).
- lab.js: `./lab.css`; `../ui/dom.js` (h); `../ui/i18n.js` (prefs); `../sim/game.js` (field, newGame);
  `./registry.js`.

Consumers out:
- `src/main.js:31-32` imports `makeGlass` and `glassGame`; `main.js:41, 63, 67-68, 73` use them. `main.js:5-6` documents the URL switches.
- `src/world/index.js:25, 69`: `buildWorld` takes the `glass` factory and adds the pass last.
- `src/intro/index.js:28` imports `glassCount` and `slotOf` from the registry.
- `src/intro/tags.js:15-16` imports `registerGlass` and `GAME_GLASS`. The intro's map tags are glass shapes.
- `src/intro/page.js:7, 31` registers the sound and skip buttons as pills.
- The tests import `src/glass/dim.js`, `game.js`, `registry.js` and `pass.js` directly (test files, line 1-3).
- `tools/glass-qa.mjs:47` imports `./browser.mjs`, and `glass-qa.mjs:498` imports `glass-probe.mjs`.

## Techniques to adopt in our own code

- **One full-screen pass, shapes in uniforms.** Keep the DOM for text and controls. Put each element's rect and
  radius in a fixed array (16 × 2 vec4 here) and draw all glass in one fragment shader with an SDF per shape. Text
  is never processed, so it stays sharp and needs no measurement.
- **Measure the backdrop before choosing the tint.** Sample the glass's luminance over the text box (1024 points
  here, 4 per texel), count how many are at or above 32 fixed levels, and take the level where the share falls
  through 10 %. That is the 90th percentile, all on the GPU, with no readback in play.
- **Asymmetric, held smoothing for any measured value.** Rise fast (τ 0.05 s), fall slow (τ 0.2 s), cap the change
  per frame (0.019), and hold the target against small falls for 0.75 s after a rise. Snap at camera cuts. This
  kills flicker from moving grass and glints (the tests in `test/glass-dim.test.js` prove each rule).
- **Gaussian blur from taps.** Use a golden-angle spiral with radii at the Gaussian's quantiles, and correct the
  variance for the bilinear tap so the kernel's sigma is exact. Average in sRGB values, as CSS does.
- **Registry with priority, a cap and a fallback mark.** Give each element a kind, a radius, a priority and a slot.
  Mark the ones the cap drops (`data-glass-drop`) so CSS draws them as the fallback. Keep a `was[]` map so state
  follows the element across slot changes.
- **Timer queries that survive a GPU reset.** Use EXT_disjoint_timer_query_webgl2, drop disjoint results, cap the
  pending queue, and reacquire the extension on context restore.
- **QA by drawing the same input twice.** Render the frame with the shapes and without them, then compare pixels
  outside the shapes (byte-identical) and the text pixels with the pass on, off and over black (identical). These
  checks prove the text is never processed (`tools/glass-qa.mjs:563-617` and `:231-282`).

## Gotchas and limits

- **First shape wins per pixel.** The loop `break`s at pass.js:241. Overlapping shapes do not blend. The earlier
  slot (higher priority, then earlier registration) is the one drawn.
- **Per-frame DOM reads.** `rects()` calls `getComputedStyle` and `getBoundingClientRect` for every registered
  element, and `opacityOf()` walks each ancestor's style (registry.js:52-60, 67-104). That forces layout each frame
  and grows with depth. The source does not measure this cost on its own.
- **Readbacks are for QA only.** `dim.read()` (dim.js:282), `dim.debug()`, `drawTwin()` (pass.js:384) and the
  probe (pass.js:358) read pixels. `__glass.dims()` (index.js:51) reads back only when called. The comment at
  dim.js:1-2 says normal running has no readback.
- **Three internals.** `precheck()` and `check()` read `renderer.properties` and `currentProgram.diagnostics`
  (pass.js:405-407, 411-412). A three.js upgrade could break the compile check silently. The `?glassbreak=1`
  test is the way to check it.
- **Radius is fixed at registration.** `rects()` uses `e.radius` (registry.js:81), and the game reads the corner
  radius once (game.js:194). A card whose radius changes later is not followed until it is registered again.
- **Attribute writes do not re-run the scan.** The game's `MutationObserver` watches `childList` and `subtree`
  only (game.js:220-221). So the registry's `data-glass-drop` writes and the `clip-path` writes do not trigger
  `scan()`. A change that should re-register an element by its attributes would need another observer.
- **Stale test title.** `test/glass-dim.test.js:90` says "capped at 0.5", but the code and the assertions use
  `DIM_CAP` 0.55 (dim.js:49, test line 63). The title is out of date.
- **QA header lists G2 and G7 that the code does not check.** `tools/glass-qa.mjs:5` says RECORD lines are kept for
  G2, G6 and G7. Only G1, G3, G4, G4b, G5 and G6 exist as code. G2 and G7 have no check or record line.
- **G1 is one scene.** The header (glass-qa.mjs:18-19) describes 8 shapes (5 panels, 3 pills). The G1 line prints
  the shape and tap counts (glass-qa.mjs:337). Other layouts or tap counts change the cost, and the gate does not
  compare them.
- **Relative colour and `:has()`.** `glass.css` uses `rgb(from …)` (glass.css:22 and 46, lab.css:74), and `:has()`
  (glass.css:55). Both need recent browsers, and there is no fallback for them.
- **Constants are compiled into GLSL.** `SATURATE`, `BRIGHTNESS`, `TINT`, `DIM_INK`, `RIM`, `GLOW`, `DIM_K`,
  `DIM_CAP` and the rest are written into the shader source at module load (pass.js:119-250, dim.js:123-218). A
  change needs a reload, and the JS twins in dim.js must be changed with them.
- **The timer is one frame behind.** `lastGpuMs()` is the newest result that has arrived, not this frame's
  (pass.js:267-276). A GPU without the extension has no timing and falls back to frame-time differences in the QA.
- **Cut detection needs the world camera.** `pass.view` is found among the composer's passes (index.js:66). With no
  perspective camera, `viewOf()` returns null and `cutBetween` never fires (dim.js:97-98). Then no dim snaps.
- **The `main.js` gate.** `?q=low` turns the glass off as well as `?glass=0` (main.js:41). A low-quality run
  shows the CSS fallback, not a glass with fewer taps.
- **Colour pipeline is fixed.** The pass expects the frame in linear HalfFloat and ends with
  `colorspace_fragment` (pass.js:243). A later pass that changes the output colour space must keep that include
  last, or the glass will be encoded twice.
