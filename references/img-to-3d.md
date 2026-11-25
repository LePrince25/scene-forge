# Image → 3D

Two different jobs hide behind "transforme cette image en 3D". Pick deliberately.

| Need | Path | Key | Output |
|---|---|---|---|
| A whole room/house, measured, editable, with a plan | **Reconstruction** (mode B) | none | Full scene spec, cameras, plan, GLB |
| One object/furniture/product as a mesh | **Generative** (mode C) | Tripo or Meshy | Single GLB |
| No API key / offline / must be exact | Reconstruction | none | — |

Reconstruction is deterministic and free but only rebuilds what is visible, interpreted. Generative meshes capture shape and texture of one object but have no real-world scale and can invent geometry. Do not present one as the other.

## Reconstruction (mode B)

### 1. Read the photo like a surveyor

Write down: volumes, wall planes, openings (count, relative widths, sill heights), materials, furniture, and **one known dimension** — door 2.1 m, table 0.75 m, socket 0.3 m, floor tile 0.6 m, brick course 0.075 m. Derive px→metre from it, then check a second dimension. If they disagree by more than ~10%, the photo has strong perspective distortion; prefer the dimension closest to the image centre.

### 2. Recover the camera

If two orthogonal horizontal families of lines are visible (e.g. wall/floor edges going left and right), their vanishing points give the focal length:

```bash
python3 scripts/camera_from_vps.py --size 4032x3024 --vp1 320,1400 --vp2 3100,1380
```

- `--size WxH`: use the **original** image pixel size, not the preview.
- `--vp1/--vp2`: pixel coordinates of the two vanishing points. Extrapolate the edges until they cross; points can lie far outside the frame (that is normal, and means a longer lens).
- `--pp x,y`: principal point if the image was cropped off-centre (default is the centre).

Output:

```json
{ "focal_px": 1662.8, "scene_lens_mm": 37.0, "three_fov_deg": 36.0,
  "forward_world": [0.8648, 0.4993, -0.0523], "up_world": [0.0453, 0.0262, 0.9986],
  "rotation_euler_deg_xyz": [84.02, -59.86, -5.18], "swapped_second_axis": false }
```

Use `scene_lens_mm` as the spec camera `lens` (scene-core derives the vertical FOV from a 24 mm sensor height). The Euler triplet is three.js's XYZ decomposition — valid, but unintuitive; prefer `forward_world`: place the camera and set `target = pos + forward_world × distance`. If the render looks mirrored or the room turns the wrong way, rerun with `vp1`/`vp2` swapped.

**Position is not recoverable** from vanishing points. The horizon (line through both vanishing points) gives the camera height relative to the scene: place the camera at 1.4–1.6 m and adjust until the horizon matches the photo's horizon. Then slide the camera along its view direction until near/far object sizes match.

### 3. Build the spec

- Set up rooms/walls from the measured ratios; put the photo's viewpoint as a `persp` camera with the aspect of the photo.
- Start with geometry only (no furniture). Render at the photo's aspect, e.g. `--size 1600x1200`, and compare with the photo.
- Fix the **scale first** (a door must read 2.1 m), then the **camera**, then materials and furniture. Changing camera and geometry at the same time makes it impossible to tell what moved.
- Measure twice on the photo: window widths relative to the wall, tile counts, counter height vs the person.

### 4. Be honest

At the end, state: what is behind the camera is invented; dimensions behind the visible plane are estimated; materials are approximations; colours are affected by the photo's white balance and lens. Two or three comparison passes is the realistic budget.

## Generative mesh (mode C)

Hosted APIs, no GPU. Tripo is tried first if both keys are set.

```bash
export TRIPO_API_KEY=...    # tripo3d.ai — free tier
python3 scripts/img2mesh.py --image photo.jpg --out out/model.glb

export MESHY_API_KEY=...    # meshy.ai — free tier
python3 scripts/img2mesh.py --image photo.jpg --out out/model.glb --provider meshy
```

`--wait 600` (default) is the maximum poll time. The script prints **only JSON** on stdout (`ok`, `provider`, `glb`, `bytes`, `seconds`); progress goes to stderr. Typical time: 1–3 minutes.

Tips:

- One object per image, centred, on a plain background, sharp, evenly lit. Remove clutter first.
- The result is one mesh with PBR textures, **no metric scale** and an arbitrary origin. Measure it in the viewer and set `scale`.
- Uploading a client photo sends it to a third party — say so before doing it.
- Never write keys into the spec, the README or a render script; environment variables only.

### Use the GLB

Standalone, in the viewer:

```
viewer.html?glb=model.glb        # orbit, walk, 4K PNG, re-export
```

Inside a scene, as furniture:

```json
{ "type": "asset", "file": "model.glb", "pos": [2.0, 1.5], "rot": 90, "scale": 0.01, "z": 0 }
```

`file` is relative to the render root (`out/`). `pos` is the footprint centre in metres, `z` lifts it off the floor, `scale` is applied uniformly. The asset receives and casts shadows.

To render the single GLB as a still, put it in a minimal spec with a camera and a ground/room, then use the normal `render.mjs` path — a GLB alone has no camera.
