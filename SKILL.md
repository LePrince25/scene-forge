---
name: scene-forge
description: Turn a brief, a sketch or a photo into a real 3D scene without Blender — metric floor plans, interiors, dollhouse and axonometric views, 4K renders, GLB assets and an interactive web walkthrough (orbit, first-person, hotspots). Use when the user asks for a 3D plan or house/room model, a 3D visualization, an image-to-3D or photo-to-3D conversion, a 4K render, a GLB/glTF asset, or a 3D tour to embed in a website. Requires only Node.js and Chrome.
---

# scene-forge

A spec-driven 3D pipeline that runs anywhere: a JSON scene spec is built live in a Three.js page, then **headless Chrome** screenshots it and exports GLB. No Blender, no GPU, no GUI — every result is reproducible by editing the spec. On a laptop, a 1280 px preview takes 2–5 s and a 4K still ~5 s.

## First run

```bash
python3 ~/.claude/skills/scene-forge/scripts/doctor.py   # JSON: node, chrome, puppeteer, API keys
```

If `ok` is false, fix what `hints` say (`npm install` inside the skill folder, install Chrome, or set `CHROME_PATH`). Then, once per session:

```bash
S=~/.claude/skills/scene-forge
[ -d "$S/node_modules/puppeteer-core" ] || (cd "$S" && npm install)
mkdir -p out
```

Node.js 18+ and Chrome/Chromium/Edge are the only requirements for modes A, B and D. Mode C is optional (hosted API key).

## Golden rules

- **Metric, Z-up.** 1 unit = 1 m. X = east, Y = north, Z = up (see `specToThree` in `assets/scene-core.js`).
- **Standard sizes:** exterior wall 0.24, partition 0.12, interior door 0.9 × 2.1, window sill 0.9 / height 1.4, ceiling 2.6–2.9, camera eye 1.55–1.65, dining table 1.15 × 0.8 × 0.75.
- **Look at every render.** Open the PNG with the Read tool before showing it or moving on. An unviewed render is not a result.
- **Iterate at 1280×720**, never at 4K. The final 4K pass is one command once framing and light are right.
- **Budget: 3 iterations per camera.** Then present the best version and list what is ambiguous.
- **Place furniture from the walls inward**, leaving 0.9 m circulation; check that nothing intersects a wall (wall centreline ± thickness/2).
- **Deliver the pack**, not one image: `plan.json` + previews + 4K + `model.glb` + the viewer (the scripts copy `viewer.html` and `scene-core.js` into `out/` automatically).
- **Assume out loud:** missing dimensions → standard sizes, stated in the final answer.

## Choose a mode

| User asks | Mode |
|---|---|
| "plan 3D de mon appart", "maison 3 chambres", "aménage cette pièce" | **A** — Brief → plan |
| photo/sketch → 3D, "reconstruis ma cuisine depuis cette photo" | **B** — Photo → 3D reconstruction |
| "transforme cette image en modèle 3D", "génère un mesh" | **C** — Image → generative mesh (API key) |
| "visite 3D", "intègre dans mon site", "viewer" | **D** — Web tour |

A and B build a spec; C gives one object as GLB; D publishes any of them.

## Mode A — Brief → 3D plan

1. Extract the programme: plot size, rooms, levels, openings, style, furniture. Missing → standard values, stated.
2. Write `out/plan.json`. Full schema in `references/plan-spec.md`; copy `examples/apartment.json` as a starting point (complete 9.5 × 7 m flat with 4 rooms, 7 walls, 21 pieces of furniture, 4 cameras, hotspots).
3. Preview each camera at 1280 px. Plan/axo views need `--cut` (dollhouse mode: walls clamped, ceilings skipped, dark caps for readability):
   ```bash
   node "$S/scripts/render.mjs" --root out --spec plan.json --camera hero --look hero --size 1280x720 --out out/preview_hero.png
   node "$S/scripts/render.mjs" --root out --spec plan.json --camera plan --look plan --cut 1.2 --size 1280x720 --out out/preview_plan.png
   node "$S/scripts/render.mjs" --root out --spec plan.json --camera axo  --look plan --cut 1.2 --size 1280x720 --out out/preview_axo.png
   ```
4. **Read the PNGs.** Check: walls meet at corners, no furniture inside walls, door swings clear, no camera inside geometry, hero shows the room's identity (1–2 anchors), sun patch visible, plan readable (furniture distinct from floor). Fix the spec, re-render. Two or three passes is normal.
5. Final stills — 4K by default:
   ```bash
   node "$S/scripts/render.mjs" --root out --spec plan.json --camera hero --look hero --size 3840x2160 --out out/hero_4k.png
   node "$S/scripts/render.mjs" --root out --spec plan.json --camera axo  --look plan --cut 1.2 --size 3840x2160 --out out/axo_4k.png
   node "$S/scripts/render.mjs" --root out --spec plan.json --camera plan --look plan --cut 1.2 --size 3840x2160 --out out/plan_4k.png
   ```
   Ortho cameras: `ortho_scale` is the visible **width** in metres; the height follows the image aspect (at 16:9, 12.5 wide × 7.03 tall). Match the render aspect to the plan's proportions or adjust `ortho_scale`.
6. Export the asset: `node "$S/scripts/export_glb.mjs" --root out --spec plan.json --out out/model.glb` (`--cut 1.2` for the dollhouse GLB).
7. Answer with the image paths, the spec path, the assumptions, and one-line tweak instructions ("change `cameras[0].lens` to 26", …).

## Mode B — Photo → 3D reconstruction

No generative model: you measure the photo and rebuild it. Free, deterministic, honest about accuracy.

1. **Read the image** (Read tool). Note volumes, openings, materials and one known dimension (door 2.1, table 0.75, socket 0.3, brick 0.5). Derive the scale from it.
2. If two orthogonal vanishing points are visible, recover the focal length and orientation:
   ```bash
   python3 "$S/scripts/camera_from_vps.py" --size 4032x3024 --vp1 320,1400 --vp2 3100,1380
   ```
   Output JSON gives `scene_lens_mm` (put it in the camera `lens`), `three_fov_deg` and `forward_world`. The **position is not recoverable** — place the camera at eye height by eye, and aim it with `target = pos + forward_world × distance`.
3. Build spec v1 with the photo's viewpoint as a perspective camera, same aspect ratio as the photo.
4. Render at the photo's aspect (`--size 1600x1200`), Read both images side by side, correct geometry/scale/materials/camera. Expect 2–3 passes.
5. Final 4K + GLB. State what cannot be recovered: hidden areas, true dimensions behind the visible plane, exact materials.

## Mode C — Image → generative mesh (optional, API key)

Local generative 3D needs a GPU; use a hosted API (free tiers exist). Tripo is tried first, then Meshy:

```bash
TRIPO_API_KEY=…  python3 "$S/scripts/img2mesh.py" --image photo.jpg --out out/model.glb
MESHY_API_KEY=…  python3 "$S/scripts/img2mesh.py" --image photo.jpg --out out/model.glb --provider meshy
```

No HTTP layer of your own — the script polls and downloads the GLB. Use it alone (`viewer.html?glb=model.glb`) or inside a scene:

```json
{ "type": "asset", "file": "model.glb", "pos": [2, 1.5], "rot": 90, "scale": 1 }
```

Check the GLB's real size in the viewer and set `scale` (most providers output arbitrary units). No key → use mode B and say so; do not pretend a reconstruction is a generative mesh.

## Mode D — Web tour

```bash
cd out && python3 -m http.server 8000
# http://localhost:8000/viewer.html?spec=plan.json
# http://localhost:8000/viewer.html?glb=model.glb
```

Viewer features: camera select, look select (hero/plan/dusk), orbit, **Walk** (WASD + mouse, Esc), hotspots from `spec.hotspots` or `hotspots.json`, **PNG** (3840×2160), **GLB** download. Embed with `?ui=0&camera=hero&cut=1.2&dpr=1` for clean iframes; details in `references/viewer.md`. Always serve over HTTP — `file://` blocks ES modules and fetches.

## Canonical commands

| Task | Command |
|---|---|
| Environment check | `python3 "$S/scripts/doctor.py"` |
| Preview still | `node "$S/scripts/render.mjs" --root out --spec plan.json --camera hero --look hero --size 1280x720 --out out/preview_hero.png` |
| 4K still | `node "$S/scripts/render.mjs" --root out --spec plan.json --camera hero --look hero --size 3840x2160 --out out/hero_4k.png` |
| Plan / axo | add `--look plan --cut 1.2` |
| Dusk | add `--look dusk` |
| GLB export | `node "$S/scripts/export_glb.mjs" --root out --spec plan.json --out out/model.glb` |
| Interactive check | add `--headed` to `render.mjs` to watch the page build |
| Image → mesh | `python3 "$S/scripts/img2mesh.py" --image photo.jpg --out out/model.glb` |
| Focal from 2 VPs | `python3 "$S/scripts/camera_from_vps.py" --size WxH --vp1 x,y --vp2 x,y` |

`render.mjs` flags: `--root` (folder containing the spec and runtime assets), `--spec`, `--camera NAME`, `--look hero|plan|dusk`, `--cut METRES`, `--size WxH`, `--out`, `--headed`, `--timeout SECONDS`, `--no-assets`. It prints JSON (`ok`, `out`, `width`, `height`, `seconds`) — parse it, don't guess.

## Spec cheat sheet

```json
{
  "name": "apartment-42",
  "levels": [{ "name": "RDC", "elevation": 0, "height": 2.7 }],
  "environment": { "sun_elevation": 26, "sun_rotation": 35, "sun_strength": 4.4, "env_intensity": 0.24, "hemi": 0.25, "ground": true },
  "rooms": [
    { "name": "Séjour", "level": 0, "polygon": [[0,0],[6,0],[6,4.2],[0,4.2]], "floor": "oak" }
  ],
  "walls": [
    { "level": 0, "from": [0,0], "to": [9.5,0], "thickness": 0.24,
      "openings": [{ "type": "window", "offset": 1.8, "width": 1.6, "sill": 0.9, "height": 1.4 }] }
  ],
  "furniture": [{ "type": "sofa", "pos": [4.9,1.5], "rot": 0, "w": 1.9, "d": 0.95 }],
  "cameras": [{ "name": "hero", "pos": [0.6,1.2,1.62], "target": [5.25,3.35,1.1], "lens": 22 }],
  "hotspots": [{ "name": "Séjour", "pos": [2.6,2.2,1.5], "text": "Canapé face au meuble TV." }]
}
```

- `polygon` vertices are counter-clockwise in the X/Y plane, one simple polygon per room (no holes, no self-intersection; split L-shapes into two rooms).
- `walls[].from/to` is the **centreline**; thickness is centred on it. `offset` = metres from `from` to the opening **centre**. `type`: `window` (glass + frame), `door` (leaf + knob), `pass` (open archway). Omit `type` for a window.
- `furniture[].rot` = degrees around Z; front faces +Y at `rot: 0`, counter-clockwise. `pos` is the footprint centre, `z` (optional) is the base elevation offset.
- Furniture types: `sofa bed table desk chair counter wardrobe shelf tv rug plant lamp stairs toilet sink shower box asset`.
- Materials: `wall wall_warm ceiling oak tile concrete stone wood_dark door fabric fabric_light linen rug green black white metal frame grass cap emissive glass`.
- Cameras: perspective with `lens` (35 mm-equivalent from a 24 mm sensor height — 18–24 for interiors, 28–35 for exteriors) or `{ "type": "ortho", "ortho_scale": 12.5 }` (visible width in metres; height follows the image aspect). Auto `plan` + `axo` cameras are generated when `cameras` is absent.
- `look` in `applyLook`: `hero` (sun + sky + room fill), `plan` (flat, vertical sun, no room fill), `dusk` (low warm sun, boost fill). Dusk + `cut` also works.

## Final checklist

- [ ] Every requested camera rendered and **visually inspected**
- [ ] 4K stills rendered (hero + axo, plan square if asked)
- [ ] Plan/axo taken with `--cut` and readable
- [ ] `model.glb` exported, magic checked (`glTF`), viewer tested
- [ ] `plan.json` saved next to the renders
- [ ] Assumptions and limits stated in the answer

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Chrome/Chromium/Edge not found` | install Chrome or `export CHROME_PATH=/path/to/chrome` |
| `viewer.html missing` | the scripts copy it automatically; if you pass `--no-assets`, copy `assets/*` into the root yourself |
| Empty or grey frame | camera inside a wall/ceiling, or `target` = `pos`; check the spec |
| Plan shows only the roof | add `--cut 1.2` (ceilings are skipped in cut mode) |
| Washed-out render | lower `environment.env_intensity` (0.2–0.3) and `sun_strength` (3–5) |
| No visible shadows | glass must not cast shadows (already handled); check the sun azimuth points at a window |
| GLB 4 MB+ | normal — textures are embedded; `--cut` for a lighter dollhouse |
| Viewer blank | serve over HTTP, check `?spec=`/`?glb=` filenames, keep files in the same folder |
| `puppeteer-core` missing | `(cd "$S" && npm install)` |

## Resources

| File | Use |
|---|---|
| `scripts/doctor.py` | environment check (JSON) |
| `scripts/render.mjs` | headless-Chrome stills |
| `scripts/export_glb.mjs` | GLB export from the live scene |
| `scripts/img2mesh.py` | Tripo / Meshy image-to-3D |
| `scripts/camera_from_vps.py` | focal + orientation from two vanishing points |
| `assets/scene-core.js` | spec → Three.js world (materials, furniture, lights, cameras) |
| `assets/viewer.html` | viewer, walk mode, hotspots, 4K/GLB buttons |
| `references/plan-spec.md` | full spec schema |
| `references/lookdev.md` | materials, lighting, composition |
| `references/img-to-3d.md` | photo reconstruction + providers |
| `references/viewer.md` | web tour, hotspots, embedding |
| `examples/apartment.json` | complete example spec |
