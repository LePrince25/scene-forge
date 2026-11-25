/* scene-forge · scene-core.js
 * Spec (metres, X east / Y north / Z up) → Three.js world (Y up).
 * Shared by viewer.html (browser) and the headless capture scripts (Chrome).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VERSION = '1.0.0';
const D2R = Math.PI / 180;

export function specToThree(x, y, z = 0) {
  return new THREE.Vector3(x, z, -y);
}

/* ------------------------------------------------------------------ utils */

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasOf(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}

function textureOf(canvas, { repeat = 0.5, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------- textures */

function woodCanvas(size, seed, tone) {
  const r = rng(seed);
  return canvasOf(size, (g, s) => {
    g.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
    g.fillRect(0, 0, s, s);
    const rows = 4;
    for (let i = 0; i < rows; i++) {
      const y = (i * s) / rows;
      const k = 0.86 + r() * 0.26;
      g.fillStyle = `rgb(${Math.min(255, tone[0] * k) | 0},${Math.min(255, tone[1] * k) | 0},${Math.min(255, tone[2] * k) | 0})`;
      g.fillRect(0, y, s, s / rows);
      for (let n = 0; n < 22; n++) {
        g.strokeStyle = `rgba(70,44,20,${0.03 + r() * 0.06})`;
        g.lineWidth = 0.5 + r() * 1.6;
        const gy = y + r() * (s / rows);
        g.beginPath();
        g.moveTo(0, gy);
        for (let x = 0; x <= s; x += s / 6) g.lineTo(x, gy + (r() - 0.5) * 3.2);
        g.stroke();
      }
      g.fillStyle = 'rgba(40,24,10,0.35)';
      g.fillRect(0, y, s, 1.6);
    }
  });
}

function tileCanvas(size, seed) {
  const r = rng(seed);
  return canvasOf(size, (g, s) => {
    g.fillStyle = '#c7c2b9';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const cell = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = 228 + ((r() * 16) | 0);
        g.fillStyle = `rgb(${k},${k - 2},${k - 6})`;
        g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
      }
    }
  });
}

function concreteCanvas(size, seed) {
  const r = rng(seed);
  return canvasOf(size, (g, s) => {
    g.fillStyle = '#8f8d88';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 2 + r() * 26;
      g.fillStyle = `rgba(${r() > 0.5 ? 60 : 190},${r() > 0.5 ? 60 : 188},${r() > 0.5 ? 58 : 182},${0.02 + r() * 0.05})`;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
      g.fillRect(r() * s, r() * s, 1, 1);
    }
  });
}

function grassCanvas(size, seed) {
  const r = rng(seed);
  return canvasOf(size, (g, s) => {
    g.fillStyle = '#5f7444';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14000; i++) {
      const green = 70 + r() * 70;
      g.strokeStyle = `rgba(${green * 0.55 | 0},${green | 0},${green * 0.42 | 0},${0.25 + r() * 0.5})`;
      g.lineWidth = 1;
      const x = r() * s;
      const y = r() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 2, y - 1 - r() * 3);
      g.stroke();
    }
  });
}

function marbleCanvas(size, seed) {
  const r = rng(seed);
  return canvasOf(size, (g, s) => {
    g.fillStyle = '#f1efec';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(120,120,128,${0.05 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 2.4;
      g.beginPath();
      let x = r() * s;
      let y = r() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 12; k++) {
        x += (r() - 0.5) * s * 0.25;
        y += (r() - 0.5) * s * 0.25;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

function fabricCanvas(size, seed, tone) {
  const r = rng(seed);
  return canvasOf(size, (g, s) => {
    g.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 3) {
      g.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`;
      g.fillRect(0, i, s, 1);
      g.fillRect(i, 0, 1, s);
    }
  });
}

function paintCanvas(size) {
  const r = rng(97);
  return canvasOf(size, (g, s) => {
    g.fillStyle = '#bdbab2';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 12000; i++) {
      const v = 150 + ((r() * 60) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.5)`;
      g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
    }
  });
}

/* ------------------------------------------------------------ materials */

export function makeMaterials(renderer) {
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  const hasDOM = typeof document !== 'undefined';
  const T = (canvas, o = {}) => (hasDOM ? textureOf(canvas, { ...o, aniso }) : null);

  const wood = hasDOM ? T(woodCanvas(512, 11, [186, 146, 100]), { repeat: 1 }) : null;
  const woodDark = hasDOM ? T(woodCanvas(512, 23, [116, 84, 56]), { repeat: 1 }) : null;
  const tile = hasDOM ? T(tileCanvas(512, 31), { repeat: 1 }) : null;
  const concrete = hasDOM ? T(concreteCanvas(512, 41), { repeat: 1 }) : null;
  const grass = hasDOM ? T(grassCanvas(512, 53), { repeat: 60 }) : null;
  const marble = hasDOM ? T(marbleCanvas(512, 61), { repeat: 1 }) : null;
  const fabric = hasDOM ? T(fabricCanvas(256, 71, [148, 142, 132]), { repeat: 2 }) : null;
  const linen = hasDOM ? T(fabricCanvas(256, 73, [226, 220, 208]), { repeat: 2 }) : null;
  const paint = hasDOM ? T(paintCanvas(256), { repeat: 3 }) : null;

  const M = {};
  const std = (key, params) => {
    M[key] = new THREE.MeshStandardMaterial(params);
    return M[key];
  };
  const phys = (key, params) => {
    M[key] = new THREE.MeshPhysicalMaterial(params);
    return M[key];
  };

  std('wall', { color: 0xe7e3da, roughness: 0.94, bumpMap: paint, bumpScale: 0.006 });
  std('wall_warm', { color: 0xded5c5, roughness: 0.94, bumpMap: paint, bumpScale: 0.006 });
  std('ceiling', { color: 0xf1efe9, roughness: 0.96, bumpMap: paint, bumpScale: 0.004, side: THREE.DoubleSide });
  std('oak', { color: 0xffffff, map: wood, roughness: 0.62, metalness: 0, bumpMap: wood, bumpScale: 0.015 });
  std('tile', { color: 0xffffff, map: tile, roughness: 0.38, bumpMap: tile, bumpScale: 0.01 });
  std('concrete', { color: 0xffffff, map: concrete, roughness: 0.9, bumpMap: concrete, bumpScale: 0.04 });
  std('stone', { color: 0xffffff, map: marble, roughness: 0.3 });
  std('wood_dark', { color: 0xffffff, map: woodDark, roughness: 0.55 });
  std('door', { color: 0xc9a273, map: wood, roughness: 0.5 });
  std('fabric', { color: 0xffffff, map: fabric, roughness: 0.95, bumpMap: fabric, bumpScale: 0.01 });
  std('fabric_light', { color: 0xd8d0c1, roughness: 0.95 });
  std('linen', { color: 0xffffff, map: linen, roughness: 0.92 });
  std('rug', { color: 0xb6a795, roughness: 1 });
  std('green', { color: 0x3e6b3c, roughness: 0.85 });
  std('black', { color: 0x161616, roughness: 0.45 });
  std('white', { color: 0xf4f4f2, roughness: 0.35 });
  std('metal', { color: 0x9aa0a6, metalness: 1, roughness: 0.32 });
  std('frame', { color: 0x2c3134, metalness: 0.65, roughness: 0.42 });
  std('grass', { color: 0xffffff, map: grass, roughness: 1, side: THREE.DoubleSide });
  std('cap', { color: 0x3c4147, roughness: 0.82 });
  std('emissive', { color: 0xfff0d6, emissive: 0xffd9a0, emissiveIntensity: 1.4, roughness: 0.8 });
  phys('glass', {
    color: 0xdcecf0,
    roughness: 0.04,
    metalness: 0,
    transmission: 1,
    thickness: 0.02,
    ior: 1.45,
    side: THREE.DoubleSide,
  });

  return M;
}

/* ---------------------------------------------------------------- lights */

function buildSky(env) {
  const sky = new Sky();
  sky.scale.setScalar(300);
  const u = sky.material.uniforms;
  u.turbidity.value = env.turbidity ?? 5;
  u.rayleigh.value = env.rayleigh ?? 1.4;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDirection(env.sun_elevation ?? 32, env.sun_rotation ?? 135));
  return sky;
}

function sunDirection(elevDeg, azimDeg) {
  const phi = (90 - elevDeg) * D2R;
  const theta = azimDeg * D2R;
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

/* ---------------------------------------------------------------- world */

export async function createWorld(spec, renderer, opts = {}) {
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  const content = new THREE.Group(); // what gets exported to GLB
  content.name = 'content';
  const site = new THREE.Group();
  site.name = 'site';
  scene.add(content, site);

  const cut = opts.cut ? Number(opts.cut) : null;
  const basePath = opts.basePath || '';
  const M = makeMaterials(renderer);

  const levels = spec.levels && spec.levels.length ? spec.levels : [{ elevation: 0, height: 2.75 }];
  const lv = (i = 0) => levels[Math.min(i, levels.length - 1)] || levels[0];
  const rooms = spec.rooms || [];
  const walls = spec.walls || [];
  const furniture = spec.furniture || [];
  const camerasSpec = spec.cameras || [];

  let meshCount = 0;
  const decoLights = [];
  let groundMesh = null;

  /* ------------------------------------------------------------ helpers */

  function meshBox(name, w, h, d, x, y, z, rotY, material, radius = 0) {
    let geo;
    const min = Math.min(w, h, d);
    if (radius > 0 && min > radius * 3) {
      geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, min * 0.3));
    } else {
      geo = new THREE.BoxGeometry(w, h, d);
    }
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = material !== M.glass;
    m.receiveShadow = true;
    content.add(m);
    meshCount++;
    return m;
  }

  function worldBox(name, size, specCenter, rotY, matKey, radius = 0.01) {
    const p = specToThree(specCenter[0], specCenter[1], specCenter[2]);
    return meshBox(name, size[0], size[1], size[2], p.x, p.y, p.z, rotY, M[matKey] || M.wall, radius);
  }

  /* ------------------------------------------------------------ ground */

  if ((spec.environment || {}).ground !== false) {
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, M.grass);
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    ground.name = 'ground';
    groundMesh = ground;
    site.add(ground);
  }

  /* ------------------------------------------------------------ floors */

  function polygonMesh(name, polygon, y, material) {
    const shape = new THREE.Shape(polygon.map(([px, py]) => new THREE.Vector2(px, py)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    // stable planar UVs: 2 m per texture tile
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) * 0.5;
      uv[i * 2 + 1] = -pos.getZ(i) * 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.position.y = y;
    m.receiveShadow = true;
    content.add(m);
    meshCount++;
    return m;
  }

  for (const r of rooms) {
    const level = lv(r.level || 0);
    const floorMat = (M[r.floor] || M.oak).clone();
    floorMat.side = THREE.DoubleSide;
    polygonMesh(`floor_${r.name || 'room'}`, r.polygon, level.elevation + 0.006, floorMat);
    if (!cut && r.ceiling !== false && (level.ceiling ?? true)) {
      const ceilMat = M.ceiling.clone();
      ceilMat.side = THREE.DoubleSide;
      polygonMesh(`ceiling_${r.name || 'room'}`, r.polygon, level.elevation + level.height - 0.01, ceilMat);
    }
  }

  /* ------------------------------------------------------------- walls */

  function addWallSegments(w, idx) {
    const level = lv(w.level || 0);
    const H = cut ? Math.min(w.height ?? level.height, cut) : w.height ?? level.height;
    const t = w.thickness ?? 0.2;
    const matKey = w.material || 'wall';
    const ax = w.from[0];
    const ay = w.from[1];
    const bx = w.to[0];
    const by = w.to[1];
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy);
    if (L < 1e-4) return;
    const ang = Math.atan2(dy, dx);
    const z0 = level.elevation;
    const cx = dx / L;
    const cy = dy / L;
    const at = (s) => [ax + cx * s, ay + cy * s];

    const openings = [...(w.openings || [])].sort((p, q) => p.offset - q.offset);
    let cursor = 0;
    const solid = [];
    for (const o of openings) {
      const left = Math.max(0, o.offset - (o.width || 0.9) / 2);
      const right = Math.min(L, o.offset + (o.width || 0.9) / 2);
      if (left > cursor + 1e-3) solid.push([cursor, left]);
      cursor = Math.max(cursor, right);
    }
    if (cursor < L - 1e-3) solid.push([cursor, L]);

    for (const [s0, s1] of solid) {
      const segLen = s1 - s0;
      const c = at((s0 + s1) / 2);
      worldBox(`wall_${idx}_${s0.toFixed(2)}`, [segLen, H, t], [c[0], c[1], z0 + H / 2], ang, matKey, 0.006);
      if (cut) {
        const p = specToThree(c[0], c[1], z0 + H + 0.012);
        meshBox(`cap_${idx}_${s0.toFixed(2)}`, segLen, 0.022, t + 0.008, p.x, p.y, p.z, ang, M.cap, 0);
      }
    }

    for (const o of openings) {
      const wdt = o.width ?? 0.9;
      const sill = Math.min(o.sill ?? 0, H);
      const hgt = Math.min(o.height ?? 1.4, Math.max(0.05, H - sill));
      const c = at(o.offset);
      const centerZ = z0 + sill + hgt / 2;

      if (sill > 0.02) {
        worldBox(`sill_${idx}_${o.offset}`, [wdt, sill, t], [c[0], c[1], z0 + sill / 2], ang, matKey, 0.006);
      }
      if (sill + hgt < H - 0.02) {
        const lintel = H - sill - hgt;
        worldBox(`lintel_${idx}_${o.offset}`, [wdt, lintel, t], [c[0], c[1], z0 + H - lintel / 2], ang, matKey, 0.006);
        if (cut) {
          const p = specToThree(c[0], c[1], z0 + H + 0.012);
          meshBox(`capl_${idx}_${o.offset}`, wdt, 0.022, t + 0.008, p.x, p.y, p.z, ang, M.cap, 0);
        }
      }

      if (o.type === 'window' || !o.type) {
        meshBox(`glass_${idx}_${o.offset}`, wdt - 0.03, hgt - 0.03, 0.02, ...(() => {
          const p = specToThree(c[0], c[1], 0);
          return [p.x, p.y + centerZ, p.z];
        })(), ang, M.glass, 0);
        // frame
        const fd = Math.min(t, 0.08);
        const bar = 0.055;
        const fz = z0 + sill + hgt / 2;
        const fp = specToThree(c[0], c[1], 0);
        const frame = (dw, dh, oz) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, fd), M.frame);
          m.position.set(fp.x, fz + oz, fp.z);
          m.rotation.y = ang;
          m.castShadow = true;
          content.add(m);
          meshCount++;
        };
        frame(wdt, bar, hgt / 2 - bar / 2);
        frame(wdt, bar, -(hgt / 2 - bar / 2));
        frame(bar, hgt, -(wdt / 2 - bar / 2));
        frame(bar, hgt, wdt / 2 - bar / 2);
        if (wdt > 1.5) frame(bar, hgt, 0);
      } else if (o.type === 'door') {
        worldBox(`door_${idx}_${o.offset}`, [wdt - 0.06, hgt - 0.03, 0.045], [c[0], c[1], z0 + hgt / 2], ang, 'door', 0.01);
        const hp = specToThree(c[0] + cx * (wdt / 2 - 0.12), c[1] + cy * (wdt / 2 - 0.12), 0);
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12), M.metal);
        knob.rotation.z = Math.PI / 2;
        knob.rotation.y = ang;
        knob.position.set(hp.x, z0 + 1.02, hp.z);
        content.add(knob);
        meshCount++;
      }
    }
  }

  walls.forEach(addWallSegments);

  /* --------------------------------------------------------- furniture */

  class Item {
    constructor(f) {
      this.group = new THREE.Group();
      const level = lv(f.level || 0);
      const p = specToThree(f.pos ? f.pos[0] : 0, f.pos ? f.pos[1] : 0, level.elevation);
      this.group.position.copy(p);
      this.group.rotation.y = (f.rot || 0) * D2R;
      content.add(this.group);
    }
    box(size, local, matKey, radius = 0.015) {
      const [w, d, h] = size;
      const [lx, ly, lz] = local;
      const geo =
        Math.min(w, h, d) > radius * 3
          ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, Math.min(w, h, d) * 0.28))
          : new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(geo, M[matKey] || M.fabric);
      m.position.set(lx, lz, -ly);
      m.castShadow = matKey !== 'glass';
      m.receiveShadow = true;
      this.group.add(m);
      meshCount++;
      return m;
    }
    cyl(radius, height, local, matKey, segments = 24) {
      const [lx, ly, lz] = local;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), M[matKey] || M.metal);
      m.position.set(lx, lz, -ly);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      meshCount++;
      return m;
    }
    sphere(radius, scale, local, matKey) {
      const [lx, ly, lz] = local;
      const geo = new THREE.IcosahedronGeometry(radius, 2);
      geo.scale(scale[0], scale[1], scale[2]);
      const m = new THREE.Mesh(geo, M[matKey] || M.green);
      m.position.set(lx, lz, -ly);
      m.castShadow = true;
      this.group.add(m);
      meshCount++;
      return m;
    }
  }

  // local sizes: [width (x), depth (y), height (z)]; local z measured from floor
  const builders = {
    sofa(it, f) {
      const w = f.w ?? 2.1;
      const d = f.d ?? 0.95;
      it.box([w, d, 0.26], [0, 0, 0.2], 'fabric', 0.05);
      it.box([w - 0.3, d - 0.28, 0.16], [0, 0.02, 0.4], 'fabric_light', 0.06);
      it.box([w, 0.2, 0.52], [0, -d / 2 + 0.1, 0.56], 'fabric', 0.05);
      it.box([0.18, d, 0.46], [-w / 2 + 0.09, 0, 0.44], 'fabric', 0.05);
      it.box([0.18, d, 0.46], [w / 2 - 0.09, 0, 0.44], 'fabric', 0.05);
    },
    bed(it, f) {
      const w = f.w ?? 1.6;
      const d = f.d ?? 2.0;
      it.box([w + 0.1, d + 0.1, 0.26], [0, 0, 0.2], 'wood_dark', 0.02);
      it.box([w, d, 0.24], [0, 0.05, 0.4], 'linen', 0.08);
      it.box([w + 0.06, d * 0.62, 0.1], [0, d * 0.16, 0.52], 'fabric_light', 0.04);
      it.box([w * 0.42, 0.32, 0.12], [-w * 0.24, -d / 2 + 0.35, 0.58], 'linen', 0.05);
      it.box([w * 0.42, 0.32, 0.12], [w * 0.24, -d / 2 + 0.35, 0.58], 'linen', 0.05);
      it.box([w + 0.16, 0.1, 0.9], [0, -d / 2 - 0.03, 0.55], 'wood_dark', 0.02);
    },
    table(it, f) {
      const w = f.w ?? 1.6;
      const d = f.d ?? 0.9;
      const h = f.h ?? 0.75;
      it.box([w, d, 0.05], [0, 0, h - 0.025], f.mat || 'wood_dark', 0.01);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        it.box([0.06, 0.06, h - 0.05], [sx * (w / 2 - 0.08), sy * (d / 2 - 0.08), (h - 0.05) / 2], 'wood_dark', 0.005);
      }
    },
    desk(it, f) {
      builders.table(it, { ...f, w: f.w ?? 1.4, d: f.d ?? 0.7, h: 0.75, mat: f.mat || 'wood_dark' });
    },
    chair(it, f) {
      const w = f.w ?? 0.46;
      const d = f.d ?? 0.48;
      it.box([w, d, 0.05], [0, 0, 0.45], 'wood_dark', 0.01);
      it.box([w, 0.05, 0.5], [0, -d / 2 + 0.03, 0.72], 'wood_dark', 0.01);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        it.box([0.035, 0.035, 0.45], [sx * (w / 2 - 0.04), sy * (d / 2 - 0.04), 0.225], 'wood_dark', 0.004);
      }
    },
    counter(it, f) {
      const w = f.w ?? 3;
      const d = f.d ?? 0.62;
      it.box([w, d, 0.86], [0, 0, 0.43], f.body || 'white', 0.01);
      it.box([w + 0.04, d + 0.03, 0.05], [0, 0.01, 0.885], 'stone', 0.005);
      it.box([w * 0.98, 0.03, 0.55], [0, -d / 2 + 0.02, 1.15], f.body || 'white', 0.005);
      it.box([0.5, 0.36, 0.02], [0, d / 2 - 0.06, 0.92], 'metal', 0);
      it.cyl(0.02, 0.3, [0, -d / 2 + 0.15, 1.0], 'metal', 12);
    },
    wardrobe(it, f) {
      const w = f.w ?? 1.8;
      const d = f.d ?? 0.6;
      const h = f.h ?? 2.2;
      it.box([w, d, h], [0, 0, h / 2], f.mat || 'wall', 0.008);
      it.box([w / 2 - 0.02, 0.02, h - 0.06], [-w / 4, -d / 2 - 0.011, h / 2], 'door', 0.004);
      it.box([w / 2 - 0.02, 0.02, h - 0.06], [w / 4, -d / 2 - 0.011, h / 2], 'door', 0.004);
      it.box([0.02, 0.03, 0.3], [-0.04, -d / 2 - 0.04, h * 0.55], 'metal', 0.005);
      it.box([0.02, 0.03, 0.3], [0.04, -d / 2 - 0.04, h * 0.55], 'metal', 0.005);
    },
    shelf(it, f) {
      const w = f.w ?? 1.0;
      const d = f.d ?? 0.32;
      const h = f.h ?? 1.8;
      it.box([w, d, 0.04], [0, 0, h], f.mat || 'wood_dark', 0.004);
      for (let i = 1; i < 5; i++) it.box([w, d, 0.025], [0, 0, (h / 5) * i], f.mat || 'wood_dark', 0.003);
      it.box([0.03, d, h], [-w / 2 + 0.015, 0, h / 2], f.mat || 'wood_dark', 0.003);
      it.box([0.03, d, h], [w / 2 - 0.015, 0, h / 2], f.mat || 'wood_dark', 0.003);
    },
    tv(it, f) {
      const w = f.w ?? 1.45;
      const h = f.h ?? 0.82;
      it.box([w, 0.05, h], [0, 0, 1.05], 'black', 0.01);
      it.box([0.5, 0.28, 0.03], [0, 0, 0.62], 'metal', 0.005);
      it.box([0.22, 0.2, 0.02], [0, 0, 0.32], 'metal', 0.005);
    },
    rug(it, f) {
      const w = f.w ?? 2.4;
      const d = f.d ?? 1.7;
      it.box([w, d, 0.014], [0, 0, 0.008], f.mat || 'rug', 0.003);
    },
    plant(it, f) {
      it.cyl(0.21, 0.34, [0, 0, 0.17], 'concrete', 20);
      it.cyl(0.19, 0.03, [0, 0, 0.335], 'black', 20);
      it.sphere(0.3, [1, 1, 0.85], [0, 0, 0.62], 'green');
      it.sphere(0.22, [1, 1, 1], [0.14, 0.05, 0.82], 'green');
      it.sphere(0.18, [1, 1, 1], [-0.12, -0.06, 0.78], 'green');
    },
    lamp(it, f) {
      it.cyl(0.16, 0.025, [0, 0, 0.012], 'metal', 24);
      it.cyl(0.012, 1.45, [0, 0, 0.74], 'metal', 10);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 0.3, 24, 1, true), M.emissive);
      shade.position.set(0, 1.52, 0);
      shade.castShadow = false;
      it.group.add(shade);
      const bulb = new THREE.PointLight(0xffd7a0, 6, 6, 2);
      bulb.position.set(0, 1.45, 0);
      it.group.add(bulb);
      decoLights.push(bulb);
      meshCount++;
    },
    stairs(it, f) {
      const w = f.w ?? 1.0;
      const run = f.run ?? 3.0;
      const rise = f.rise ?? 2.7;
      const n = f.steps ?? 14;
      const tread = run / n;
      const riser = rise / n;
      for (let i = 0; i < n; i++) {
        it.box([w, tread, riser], [0, -run / 2 + tread * (i + 0.5), riser * (i + 0.5)], 'concrete', 0.008);
      }
    },
    toilet(it, f) {
      it.box([0.38, 0.5, 0.4], [0, 0.05, 0.2], 'white', 0.06);
      it.box([0.42, 0.2, 0.35], [0, -0.28, 0.72], 'white', 0.04);
      it.cyl(0.19, 0.04, [0, 0.05, 0.42], 'white', 24);
    },
    sink(it, f) {
      const w = f.w ?? 0.8;
      it.box([w, 0.45, 0.8], [0, 0, 0.4], 'wood_dark', 0.01);
      it.box([w, 0.46, 0.06], [0, 0, 0.83], 'stone', 0.008);
      it.cyl(0.02, 0.22, [0, -0.14, 0.95], 'metal', 12);
    },
    shower(it, f) {
      const w = f.w ?? 0.9;
      const d = f.d ?? 0.9;
      it.box([w, d, 0.05], [0, 0, 0.025], 'tile', 0.004);
      it.box([w, 0.02, 2.0], [0, -d / 2 + 0.01, 1.05], 'glass', 0.001);
      it.box([0.02, d, 2.0], [-w / 2 + 0.01, 0, 1.05], 'glass', 0.001);
      it.cyl(0.05, 0.02, [0, -d / 2 + 0.09, 2.1], 'metal', 16);
    },
    box(it, f) {
      const [w, d, h] = f.size || [0.6, 0.6, 0.8];
      it.box([w, d, h], [0, 0, h / 2], f.mat || 'white', f.radius ?? 0.01);
    },
  };

  const assetPromises = [];
  for (const f of furniture) {
    if (f.type === 'asset' && f.file) {
      assetPromises.push(
        (async () => {
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(basePath + f.file);
          const obj = gltf.scene;
          const level = lv(f.level || 0);
          const p = specToThree(f.pos?.[0] ?? 0, f.pos?.[1] ?? 0, level.elevation + (f.z ?? 0));
          obj.position.copy(p);
          obj.rotation.y = (f.rot || 0) * D2R;
          obj.scale.setScalar(f.scale ?? 1);
          obj.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          content.add(obj);
        })()
      );
      continue;
    }
    const builder = builders[f.type] || builders.box;
    const item = new Item(f);
    builder(item, f);
  }

  /* ------------------------------------------------------------- lights */

  const env = spec.environment || {};
  const sky = buildSky(env);
  sky.name = 'sky';
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff1dc, env.sun_strength ?? 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x6b5f4f, env.hemi ?? 0.25);
  scene.add(hemi);

  const roomLights = [];
  if (!cut) {
    for (const r of rooms) {
      if (r.light === false) continue;
      const level = lv(r.level || 0);
      let cx = 0;
      let cy = 0;
      for (const [px, py] of r.polygon) {
        cx += px;
        cy += py;
      }
      cx /= r.polygon.length;
      cy /= r.polygon.length;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [px, py] of r.polygon) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      const area = (maxX - minX) * (maxY - minY);
      const light = new THREE.RectAreaLight(0xffe9cc, Math.min(8, 1.2 + area * 0.06), (maxX - minX) * 0.55, (maxY - minY) * 0.55);
      const p = specToThree(cx, cy, level.elevation + level.height - 0.06);
      light.position.copy(p);
      light.lookAt(p.x, level.elevation, p.z);
      light.userData.base = light.intensity;
      scene.add(light);
      roomLights.push(light);
    }
  }

  for (const l of spec.lights || []) {
    const level = lv(l.level || 0);
    const p = specToThree(l.pos?.[0] ?? 0, l.pos?.[1] ?? 0, (l.pos?.[2] ?? 2) + level.elevation);
    if (l.type === 'area') {
      const light = new THREE.RectAreaLight(new THREE.Color(l.color || 0xfff0dd), l.intensity ?? 10, l.size?.[0] ?? 0.6, l.size?.[1] ?? 0.6);
      light.position.copy(p);
      light.lookAt(p.x, level.elevation, p.z);
      scene.add(light);
    } else {
      const light = new THREE.PointLight(new THREE.Color(l.color || 0xffd9a8), l.intensity ?? 8, l.distance ?? 8, 2);
      light.position.copy(p);
      scene.add(light);
    }
  }

  /* ------------------------------------------------------- environment */

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyEnv = buildSky(env);
  envScene.add(skyEnv);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 10000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = env.env_intensity ?? 0.5;
  pmrem.dispose();

  /* --------------------------------------------------------- bbox/fit */

  const bbox = new THREE.Box3();
  let hasBounds = false;
  if (rooms.length) {
    for (const r of rooms) {
      for (const [px, py] of r.polygon) {
        const v = specToThree(px, py, 0);
        bbox.expandByPoint(v);
        hasBounds = true;
      }
    }
  }
  for (const w of walls) {
    bbox.expandByPoint(specToThree(w.from[0], w.from[1], 0));
    bbox.expandByPoint(specToThree(w.to[0], w.to[1], 0));
    hasBounds = true;
  }
  if (!hasBounds) bbox.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
  bbox.expandByScalar(2);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.z, 6);

  sun.target.position.set(center.x, 0, center.z);
  sun.shadow.camera.left = -maxDim * 0.9;
  sun.shadow.camera.right = maxDim * 0.9;
  sun.shadow.camera.top = maxDim * 0.9;
  sun.shadow.camera.bottom = -maxDim * 0.9;
  sun.shadow.camera.updateProjectionMatrix();

  /* ----------------------------------------------------------- cameras */

  const cameras = {};
  const cameraNames = [];

  function makeCamera(c) {
    let cam;
    const p = specToThree(c.pos?.[0] ?? 0, c.pos?.[1] ?? 0, c.pos?.[2] ?? 1.6);
    const t = specToThree(c.target?.[0] ?? center.x, c.target?.[1] ?? center.z, c.target?.[2] ?? 1.2);
    if (c.type === 'ortho') {
      const s = c.ortho_scale ?? 12;
      cam = new THREE.OrthographicCamera(-s / 2, s / 2, s / 2, -s / 2, 0.05, 600);
      cam.userData.orthoScale = s;
    } else {
      const lens = c.lens ?? 28;
      const fov = (2 * Math.atan(12 / lens)) / D2R;
      cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 600);
      cam.userData.lens = lens;
    }
    cam.name = c.name || 'camera';
    cam.position.copy(p);
    const dir = t.clone().sub(p).normalize();
    if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, -1);
    cam.lookAt(t);
    cam.userData.target = t;
    cam.userData.spec = c;
    cameras[cam.name] = cam;
    cameraNames.push(cam.name);
    return cam;
  }

  if (camerasSpec.length) {
    camerasSpec.forEach(makeCamera);
  } else {
    makeCamera({
      name: 'plan',
      type: 'ortho',
      pos: [center.x, center.z, 60],
      target: [center.x, center.z, 0],
      ortho_scale: maxDim * 1.25,
    });
    makeCamera({
      name: 'axo',
      type: 'ortho',
      pos: [center.x + maxDim * 0.9, center.z - maxDim * 0.9, maxDim * 0.85],
      target: [center.x, center.z, 0.8],
      ortho_scale: maxDim * 1.5,
    });
  }

  function setSize(w, h) {
    const aspect = w / h;
    for (const name of cameraNames) {
      const cam = cameras[name];
      if (cam.isPerspectiveCamera) {
        cam.aspect = aspect;
      } else {
        const s = cam.userData.orthoScale;
        cam.left = -s / 2;
        cam.right = s / 2;
        cam.top = s / (2 * aspect);
        cam.bottom = -s / (2 * aspect);
      }
      cam.updateProjectionMatrix();
    }
  }

  /* ------------------------------------------------------------- looks */

  function setSun(elev, azim) {
    const dir = sunDirection(elev, azim);
    sky.material.uniforms.sunPosition.value.copy(dir);
    sun.position.copy(dir).multiplyScalar(90);
    sun.target.position.set(center.x, 0, center.z);
  }

  function applyLook(name) {
    const look = name || 'hero';
    const baseElev = env.sun_elevation ?? 32;
    const baseAzim = env.sun_rotation ?? 135;
    sky.visible = true;
    scene.background = null;
    if (groundMesh) groundMesh.visible = true;
    sun.color.set(0xfff1dc);
    sun.intensity = env.sun_strength ?? 2.9;
    hemi.intensity = env.hemi ?? 0.25;
    scene.environmentIntensity = env.env_intensity ?? 0.5;
    setSun(baseElev, baseAzim);
    for (const l of roomLights) l.intensity = l.userData.base;
    for (const l of decoLights) l.intensity = 6;
    M.emissive.emissiveIntensity = 1.4;
    renderer.toneMappingExposure = 1.0;

    if (look === 'plan') {
      sky.visible = false;
      scene.background = new THREE.Color(0xf2f1ed);
      if (groundMesh) groundMesh.visible = false;
      setSun(88, 15);
      sun.intensity = 1.5;
      hemi.intensity = 0.8;
      scene.environmentIntensity = 0.85;
      renderer.toneMappingExposure = 0.95;
      M.emissive.emissiveIntensity = 0;
      for (const l of roomLights) l.intensity = 0;
      for (const l of decoLights) l.intensity = 0;
    } else if (look === 'dusk') {
      setSun(6, baseAzim);
      sun.color.set(0xff9a52);
      sun.intensity = 0.85;
      hemi.intensity = 0.12;
      scene.environmentIntensity = 0.15;
      renderer.toneMappingExposure = 1.35;
      for (const l of roomLights) l.intensity = l.userData.base * 2.2;
    }
    sun.shadow.needsUpdate = true;
  }

  await Promise.all(assetPromises);
  setSize(16 / 9 * 1000, 1000);
  applyLook(opts.look || 'hero');

  return {
    scene,
    content,
    site,
    cameras,
    cameraNames,
    materials: M,
    center,
    size,
    applyLook,
    setSize,
    meshCount,
  };
}
