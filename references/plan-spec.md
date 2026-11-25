# Scene spec reference

One JSON file describes the whole scene. Units are **metres**; axes are **X east, Y north, Z up**. The viewer maps the spec to Three.js with `specToThree(x, y, z) = (x, z, -y)`, so the spec stays in a familiar architectural frame.

The file must live in the render root (usually `out/plan.json`) together with `viewer.html` and `scene-core.js` — `render.mjs` and `export_glb.mjs` copy the runtime assets there for you.

## Top level

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | `"3D scene"` | Title in the viewer and page |
| `units` | `"m"` | `"m"` | Informative; everything is metres |
| `levels` | array | one 2.75 m level | Storeys (see below) |
| `environment` | object | `{}` | Sun, sky, ambient |
| `rooms` | array | `[]` | Floor + ceiling polygons, per-room light |
| `walls` | array | `[]` | Wall segments with openings |
| `furniture` | array | `[]` | Furniture, fixtures, GLB assets |
| `cameras` | array | auto plan + axo | Named cameras |
| `hotspots` | array | `[]` | Viewer markers (optional; `hotspots.json` also works) |

## Levels

```json
"levels": [
  { "name": "RDC", "elevation": 0, "height": 2.7, "ceiling": true },
  { "name": "Étage", "elevation": 2.9, "height": 2.5 }
]
```

`height` is the default wall height for that level. `ceiling: false` disables ceilings on the level. Every room, wall and furniture item takes `level` (index); the default is 0. Stacked levels are independent: draw a slab/floor between them yourself if needed.

## Environment

```json
"environment": {
  "sun_elevation": 26,
  "sun_rotation": 35,
  "sun_strength": 4.4,
  "env_intensity": 0.24,
  "hemi": 0.25,
  "ground": true,
  "turbidity": 5,
  "rayleigh": 1.4
}
```

| Key | Range | Notes |
|---|---|---|
| `sun_elevation` | 5–85° | 15–30 = long warm shadows; 55–70 = flat midday |
| `sun_rotation` | 0–360° | Direction of the sun in the horizontal plane. Point it at a window façade: the sun must come through glass for a lit interior |
| `sun_strength` | 2–6 | 4–5 for bright interiors with `env_intensity` 0.2–0.3 |
| `env_intensity` | 0.1–1 | Sky/IBL fill; above ~0.5 the image gets flat and hazy |
| `hemi` | 0–1 | Sky/ground hemisphere fill; 0.2–0.3 indoors |
| `ground` | bool | 120 × 120 m grass plane at z = 0 |
| `turbidity`, `rayleigh` | — | Sky shader; defaults are fine |

The environment is a `Sky` shader + PMREM environment + one directional sun with 2048² shadows. Glass does **not** cast shadows, so sunlight enters through windows. Tone mapping is AgX (ACES fallback).

## Rooms

```json
{ "name": "Séjour", "level": 0, "polygon": [[0,0],[6,0],[6,4.2],[0,4.2]],
  "floor": "oak", "ceiling": true, "light": true }
```

- `polygon`: closed ring of `[x, y]` in **counter-clockwise** order (a clockwise ring produces a downward-facing floor). Simple polygon only — no holes, no self-intersection. Split L-shapes into two rooms.
- `floor`: material key (default `oak`). Tiles/wood are planar-mapped at 2 m per texture tile.
- `ceiling`: `false` to skip that room's ceiling. Ceilings are always skipped in cut/dollhouse renders.
- `light`: `false` to skip the automatic per-room rect area light (full renders only; intensity grows with room area).

Rooms and walls are independent: a room polygon does not create walls. Draw walls on the room boundaries, with the wall **centreline** on the boundary line.

## Walls

```json
{
  "level": 0,
  "from": [0, 0],
  "to": [9.5, 0],
  "thickness": 0.24,
  "height": 2.7,
  "material": "wall",
  "openings": [
    { "type": "window", "offset": 1.8, "width": 1.6, "sill": 0.9, "height": 1.4 },
    { "type": "door",   "offset": 5.5, "width": 0.9 },
    { "type": "pass",   "offset": 3.0, "width": 2.6, "height": 2.3 }
  ]
}
```

- `from`/`to` is the centreline; the wall body is `thickness` centred on it. Interior clear dimensions therefore lose `thickness/2` on each side.
- `thickness`: 0.24 exterior, 0.12 partition. `height` overrides the level height.
- `offset`: distance in metres from `from` to the opening **centre**. Openings are clamped to the wall length.
- `type`:
  - `window` (default when omitted): glass pane + aluminium frame; needs `sill` (default 0) and `height` (default 1.4). A width > 1.5 m gets a central mullion.
  - `door`: wooden leaf + knob, no frame; `sill` ignored, default `height` 2.1. The leaf fills the opening (it does not swing open).
  - `pass`: open hole, no leaf, no glass — archways, cased openings.
- Walls receive shadows; glass transmits light. In cut mode walls are clamped to the `--cut` height and get a dark cap strip on top for readability.

## Furniture

Every item: `{ "type": "...", "pos": [x, y], "rot": 0, "level": 0 }` plus type-specific keys. `pos` is the footprint centre. `rot` is degrees around Z. `z` (metres) lifts the item off the floor.

### Orientation (front of the object)

| Type | Front at `rot: 0` | Typical placement |
|---|---|---|
| `sofa`, `chair` | +Y (back at −Y) | back against a south wall → `rot: 0`; north wall → `180`; west → `270`; east → `90` |
| `bed` | head at −Y, foot +Y | head against a south wall → `rot: 0`; north → `180`; east → `90`; west → `270` |
| `wardrobe` | **doors at −Y** | against a north wall → `rot: 0`; west wall → `90`; south → `180`; east → `270` |
| `counter`, `sink` | working front +Y, taps/back at −Y | against a north wall → `rot: 180` |
| `shower` | glass at −X and −Y | place in a north-east corner → `rot: 0`; south-west → `180` |
| `table`, `desk`, `rug`, `plant`, `lamp`, `tv`, `stairs`, `box` | symmetric | `rot` only for variety |

### Types

| Type | Keys (defaults) |
|---|---|
| `sofa` | `w` 2.1, `d` 0.95 |
| `bed` | `w` 1.6, `d` 2.0 (frame, mattress, duvet, 2 pillows, headboard) |
| `table` | `w` 1.6, `d` 0.9, `h` 0.75, `mat` `wood_dark` |
| `desk` | `w` 1.4, `d` 0.7, `h` 0.75, `mat` |
| `chair` | `w` 0.46, `d` 0.48 |
| `counter` | `w` 3, `d` 0.62, `body` `white` — body, stone worktop, backsplash shelf, hob, tap |
| `wardrobe` | `w` 1.8, `d` 0.6, `h` 2.2, `mat` `wall` — two doors + handles |
| `shelf` | `w` 1.0, `d` 0.32, `h` 1.8, `mat` `wood_dark` — open bookcase |
| `tv` | `w` 1.45, `h` 0.82 — panel + stand, top at 1.46 m |
| `rug` | `w` 2.4, `d` 1.7, `mat` `rug` |
| `plant` | none — pot + 3 leaf clusters, ~1.1 m tall |
| `lamp` | none — 1.52 m floor lamp with a warm PointLight |
| `stairs` | `w` 1, `run` 3, `rise` 2.7, `steps` 14 — rises along +Y from `pos` |
| `toilet` | none |
| `sink` | `w` 0.8 — vanity + stone top + tap |
| `shower` | `w` 0.9, `d` 0.9 — tray + 2 glass panels + shower head |
| `box` | `size` [w, d, h], `mat` `white`, `radius` 0.01 — fridge, nightstand, plinth |
| `asset` | `file` (GLB path relative to the render root), `scale` 1, `z` 0 |

`asset` loads a GLB with `GLTFLoader`, applies position/rotation/scale and enables shadows. Provider meshes often come in arbitrary units: open the GLB in the viewer, measure roughly, then set `scale`.

## Cameras

```json
{ "name": "hero", "pos": [0.6, 1.2, 1.62], "target": [5.25, 3.35, 1.1], "lens": 22 }
{ "name": "plan", "type": "ortho", "pos": [4.75, 3.5, 30], "target": [4.75, 3.5, 0], "ortho_scale": 12.5 }
```

- `pos`/`target` are `[x, y, z]` with `z` = height. Interior eye height 1.55–1.65; `target.z` 1.0–1.3.
- `lens`: 35 mm-equivalent focal for a 24 mm sensor height. FOV = 2·atan(12/lens). 18–24 mm for interiors, 28–35 mm for exteriors/detail. Lenses below 18 mm distort heavily.
- `type: "ortho"` with `ortho_scale` (visible **width** in metres; height follows the aspect). The plan camera looks straight down; the default axo sits at +X/−Y and looks down at ~35°.
- When `cameras` is omitted, `plan` and `axo` ortho cameras are generated from the scene bounds.
- The aspect ratio comes from `--size`; the camera's vertical FOV is fixed by `lens`, so wider images show more horizontally.

## Hotspots

```json
"hotspots": [
  { "name": "Séjour", "pos": [2.6, 2.2, 1.5], "text": "Canapé face au meuble TV." }
]
```

`pos` is the world anchor (z default 1.4). Clicking a marker opens the name/text panel. If the spec has no `hotspots`, the viewer tries `hotspots.json` — either `{"hotspots": [...]}` or a bare array.

## Materials

`wall` `wall_warm` `ceiling` `oak` `tile` `concrete` `stone` (marble) `wood_dark` `door` `fabric` `fabric_light` `linen` `rug` `green` `black` `white` `metal` `frame` `grass` `cap` `emissive` `glass`.

Walls/rooms/furniture accept a material key (`floor`, `material`, `mat`, `body`). Textures are procedural canvases (wood planks, tiles, concrete, marble, fabric, linen, grass, paint bump), generated at load with a seeded RNG — deterministic and offline.

## Common mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Clockwise room polygon | Floor invisible from above | Reverse the vertex order |
| Room polygon with a hole/self-intersection | Broken triangulation | Split into rooms |
| Furniture `pos` on a wall centreline | Half the object inside the wall | Keep the footprint `thickness/2 + size/2` away from the line |
| Door chair/bed touching the wall | Backrest clipping | Leave 2–5 cm; chairs may tuck under tables |
| Camera `pos` inside a wardrobe | Grey/black frame | Check positions against furniture footprints |
| Sun through a solid wall | No shadow or no light | Aim `sun_rotation` at a façade with windows |
| `ortho_scale` too small | Plan cropped | Set it above the larger plan dimension |
| Same `rot` for every wardrobe | Doors against the wall | Wardrobe doors are at −Y, unlike sofa/bed |
