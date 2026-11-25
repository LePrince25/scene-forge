# Look development: light, materials, composition

The target is **warm minimalist architectural visualization**: clean volumes, believable daylight, natural materials, a readable plan. Not photorealism — clarity first, atmosphere second.

## How the light is built

| Source | What it does | Tuning |
|---|---|---|
| **Sky** (`Sky` shader) | Visible sky through windows + PMREM environment | `turbidity` 4–6, `rayleigh` 1.2–1.6 |
| **Sun** (directional, 2048² shadows) | Direct light and the crisp shadow that sells the space | `sun_strength` 3.5–5.5, elevation 15–35° for long shadows |
| **Hemisphere** | Soft sky/ground fill | `hemi` 0.2–0.3 indoors |
| **Environment** (PMREM) | Image-based ambient, the main "interior fill" | `env_intensity` 0.2–0.35 |
| **Room lights** (RectAreaLight) | Ceiling wash per room, auto-sized | Automatic; set `"light": false` on a room to skip |
| **Lamp** (PointLight) | Warm pool of light, local accent | Automatic with `"type": "lamp"` |

Tone mapping is AgX with exposure 1.0. **If the image is washed out, cut `env_intensity` before touching the sun** — ambient is almost always the culprit. Interior renders live between 0.2 and 0.35; above 0.5 everything turns flat and grey.

Glass does not cast shadows, so sunlight genuinely enters through windows. If a room has no windows, it will be lit only by ambient and room fill — add a window or a lamp.

## Sun direction

`sun_rotation` is the horizontal direction the sun comes **from**. For a room whose windows face south (spec −Y), a sun rotation around 180° (south) sends light across the floor toward the north wall. Rotate the sun until you see:

1. a bright patch on the floor or a wall,
2. a shadow edge that gives the room depth.

If the room looks uniformly lit, the sun is probably hitting a solid façade. Move it to a window side. For plans, the look switches to a near-vertical sun (88°) — no long shadows across the drawing.

## Materials

Procedural canvas textures, 2 m per tile on floors (0.5 m tiles on the `tile` material), seeded so renders are deterministic.

| Key | Use | Notes |
|---|---|---|
| `wall`, `wall_warm` | Plaster | subtle paint bump |
| `ceiling` | Ceilings | slightly brighter than walls |
| `oak` | Wood floors, warm furniture | plank texture; roughness 0.62 |
| `tile` | Kitchen/bath floors | 0.5 m grid, light grey grout |
| `concrete` | Stairs, structural elements | roughness 0.9 |
| `stone` | Worktops | marble |
| `wood_dark` | Tables, frames, shelves | dark walnut |
| `door` | Door leaves | warm oak |
| `fabric`, `fabric_light` | Sofa body / seat | high roughness |
| `linen` | Bedding | white weave |
| `rug` | Rugs | flat warm grey |
| `green` | Plants | desaturated green, not neon |
| `metal`, `frame` | Taps, legs, window frames | dark anodized frame |
| `glass` | Windows, shower | transmission 1, thickness 0.02 |
| `grass` | Ground plane | 60× repeat |

Assign materials with `floor` (rooms), `material` (walls), `mat`/`body` (furniture). Glass is excluded from shadow casting automatically.

## Composition

### Camera

- **Eye height 1.55–1.65 m**, target at 1.0–1.3 m. A target at 1.5 m makes the room look like a dollhouse.
- **Lens 18–24 mm** for interiors. 22 mm is a safe default; below 18 mm distorts.
- Place the camera **0.5–1.0 m from the corner walls**, never grazing a wall plane or a window frame (the near object turns into a giant white slab).
- Aim at the room's **two anchors** (e.g. kitchen pass + sofa/TV), not at the empty centre.
- **Avoid putting large furniture in the near foreground.** A dining set 1.5 m in front of the lens swallows half the frame. Pull the camera back, shift it sideways, or move the set.
- Keep 2–3 depth layers: foreground floor/furniture, mid-ground anchors, background window/light.

### Hero checklist

- [ ] Does the image say what room this is in one second?
- [ ] Is there a visible sun patch or shadow edge?
- [ ] Is anything clipped awkwardly at the frame edge (chair cut in half, lamp shade cropped)?
- [ ] Is the floor visible enough to read the material?
- [ ] No black gaps, no visible wall seam, no object floating (check lamp bases, plants, rugs)?

### Plan checklist

- [ ] `--cut` 1.1–1.3 m: walls cut, ceilings gone, dark caps visible
- [ ] Every room identifiable: furniture silhouettes distinct from floors
- [ ] Doors/passes read as gaps, not white blobs
- [ ] Plan camera framing includes all exterior walls with a small margin
- [ ] Vertical sun, no room fill (the `plan` look handles this)

## Looks

| Look | Use | Behaviour |
|---|---|---|
| `hero` | Interior/exterior stills | sun + sky + environment + room fill + lamp |
| `plan` | Top-down plan and axo | flat background, garden ground hidden, vertical sun, room fill off, lamp off, exposure 0.95 |
| `dusk` | Mood/detail shot | low warm sun, weak environment, room fill boosted |

`cut` is independent: a metre value that clamps walls (and skips ceilings) for the dollhouse/plan view. Typical 1.1–1.3 m; use 0.9 for a pure furniture plan.

## Diagnosis

| Symptom | Cause | Fix |
|---|---|---|
| Washed out, low contrast | ambient too high | `env_intensity` 0.2–0.25, `sun_strength` 4–5 |
| Too dark | no window light on the camera side | rotate the sun toward the visible façade; raise `hemi` slightly |
| Flat, no shadows | sun hitting a blind wall, or glass shadows | move `sun_rotation`; glass already excluded |
| Ceiling glowing | room fill too strong for a small room | `"light": false` on that room |
| Plan unreadable | no cut, or white on white | `--cut`, `plan` look, darker `tile` grout |
| White blob at the frame edge | near wall/window sill | move the camera 0.2–0.4 m inward |
| Lamp shade "floating" | base hidden behind furniture | give the lamp clear floor, or remove it |

## Iteration budget

Three passes per camera at 1280×720. Each pass: change **one** thing (camera, then light, then a material), re-render, Read, compare. Then render 4K once. Do not chase perfection at 4K — every fix costs minutes and hides the real problem.
