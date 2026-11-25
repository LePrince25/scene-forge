# Viewer and web tour

`assets/viewer.html` is a self-contained Three.js page (three r170 via importmap). `render.mjs` and `export_glb.mjs` copy it, plus `scene-core.js`, into the render root, so a rendered folder is immediately viewable.

## Serve it

```bash
cd out
python3 -m http.server 8000
# http://localhost:8000/viewer.html
```

Also fine: `npx serve out`, any static host (GitHub Pages, Netlify, S3, nginx). **Always over HTTP** — opening `viewer.html` from `file://` blocks ES modules and `fetch`.

## URL parameters

| Param | Values | Effect |
|---|---|---|
| `spec` | `plan.json` (default) | Scene spec to build |
| `glb` | `model.glb` | Load a GLB instead of a spec (orbit only: no cameras/looks/walk) |
| `camera` | camera name | Start on that camera |
| `look` | `hero` `plan` `dusk` | Initial lighting look |
| `cut` | metres, e.g. `1.2` | Dollhouse mode: walls clamped, ceilings skipped |
| `ui` | `0` | Hide the whole toolbar (for iframes) |
| `dpr` | number | Force device pixel ratio (default: min(devicePixelRatio, 2)) |

Examples:

```
viewer.html?spec=plan.json&camera=hero
viewer.html?spec=plan.json&look=plan&cut=1.2&camera=plan&ui=0
viewer.html?glb=model.glb
```

## Controls

- **Orbit**: drag to rotate, wheel to zoom, right-drag to pan. The camera cannot go below the floor.
- **Camera select**: named cameras from the spec (auto `plan`/`axo` if none).
- **Look select**: hero/plan/dusk, live.
- **Walk**: pointer-lock first person. WASD or arrows to move, mouse to look, Esc to exit. Eye height is clamped to 0.6–12 m.
- **PNG**: renders a 3840×2160 PNG of the current view and downloads it.
- **GLB**: exports the scene as binary glTF (textures embedded) and downloads it.
- **Hotspots**: click a marker to open its panel; they are hidden while walking and when behind the camera.

## Hotspots

Inline in the spec:

```json
"hotspots": [
  { "name": "Cuisine", "pos": [3.2, 6.2, 1.5], "text": "Plan de travail de 4 m." }
]
```

Or in `hotspots.json` next to the viewer (used only when the spec has no `hotspots`):

```json
{ "hotspots": [
  { "name": "Séjour", "pos": [2.6, 2.2, 1.5], "text": "Canapé face au meuble TV." }
] }
```

`pos` = `[x, y, z]` world anchor, z default 1.4. Optional `icon` replaces the default "i".

## Embedding

```html
<iframe src="/tours/flat/viewer.html?spec=plan.json&camera=hero&ui=0&cut=1.2&dpr=1"
        style="width:100%;aspect-ratio:16/9;border:0"
        allow="fullscreen" loading="lazy" title="Visite 3D"></iframe>
```

- Copy `viewer.html`, `scene-core.js`, the spec and any GLB into one folder; paths are relative.
- `ui=0` removes the toolbar; if you add a `sandbox` attribute, include `allow-pointer-lock` for walk mode.
- `dpr=1` keeps mobile GPUs sane.
- three.js is loaded from jsDelivr. For offline or locked-down deployments, vendor `three` + addons locally and edit the importmap at the top of `viewer.html`.

## Rendering vs viewing

`render.mjs` drives the same page in headless Chrome, sets `?ui=0`, waits for `window.__sceneReady === true` (or `window.__error`), settles 800 ms, then screenshots. That is why a preview takes seconds and matches the viewer pixel for pixel.

Automation hooks exposed by the page:

| Hook | Meaning |
|---|---|
| `window.__sceneReady` | true once the scene is built and a frame rendered |
| `window.__error` | string if loading/building failed |
| `window.__exportGLBBytes()` | Promise<ArrayBuffer> of the GLB |
| `snapshot(w, h)` | renders and returns a PNG blob |

## Performance

- One page = one WebGL context; close tabs to free memory.
- Pixel ratio is capped at 2; 4K snapshots temporarily bump the canvas then restore it.
- A 40 000-mesh scene will crawl — furniture builders are cheap, imported GLBs may not be; decimate large assets first.
- No textures are fetched from the network (all procedural); only the three.js modules.

## Privacy

The viewer makes no telemetry calls. The spec, textures and GLB never leave the folder you serve. The only external request is the three.js CDN import.
