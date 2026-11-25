#!/usr/bin/env python3
"""Recover focal length and camera orientation from two orthogonal vanishing points.

Photograph a room (two horizontal wall families), click/estimate where each family
converges, then feed the pixel coordinates here. Output is ready for a three.js
PerspectiveCamera: rotation Euler (XYZ, degrees) and vertical FOV.

Example:
  python3 camera_from_vps.py --size 4032x3024 --vp1 320,1400 --vp2 3100,1380
  python3 camera_from_vps.py --self-test
"""
import argparse
import json
import math
import sys


def parse_pair(text):
    x, y = text.split(",")
    return float(x), float(y)


def parse_size(text):
    w, h = text.lower().split("x")
    return float(w), float(h)


def normalize(v):
    n = math.sqrt(sum(c * c for c in v))
    if n < 1e-12:
        raise ValueError("degenerate direction")
    return tuple(c / n for c in v)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def solve(size, vp1, vp2, pp=None):
    w, h = size
    cx, cy = pp if pp else (w / 2.0, h / 2.0)
    # image y grows downward, camera y grows upward
    a1 = (vp1[0] - cx, -(vp1[1] - cy))
    a2 = (vp2[0] - cx, -(vp2[1] - cy))
    d = a1[0] * a2[0] + a1[1] * a2[1]
    if d >= 0:
        raise ValueError(
            "The two vanishing points are not orthogonal (focal length would be imaginary). "
            "Pick the two families of parallel walls, not two random edges."
        )
    f = math.sqrt(-d)
    if not math.isfinite(f) or f <= 1:
        raise ValueError("Focal length is degenerate: vanishing points are too close to the principal point or to each other.")

    # world X / Y axes expressed in the three.js camera frame (x right, y up, z backward)
    x_cam = normalize((a1[0], a1[1], -f))
    y_cam = normalize((a2[0], a2[1], -f))
    z_cam = normalize(cross(x_cam, y_cam))
    flipped = False
    if z_cam[1] < 0:
        # the two families were picked in the opposite order; -Y is just as valid
        y_cam = (-y_cam[0], -y_cam[1], -y_cam[2])
        z_cam = normalize(cross(x_cam, y_cam))
        flipped = True
    if abs(z_cam[1]) < 0.05:
        raise ValueError("The two vanishing points are not both on a horizontal plane; the camera is rolled or the points are wrong.")

    # camera-to-world: rows are the world axes in camera space (three.js matrix convention)
    c2w = [[x_cam[0], x_cam[1], x_cam[2]], [y_cam[0], y_cam[1], y_cam[2]], [z_cam[0], z_cam[1], z_cam[2]]]

    # Euler XYZ extraction (same convention as THREE.Euler 'XYZ')
    m11, m12, m13 = c2w[0]
    m21, m22, m23 = c2w[1]
    m31, m32, m33 = c2w[2]
    ry = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        rx = math.atan2(-m23, m33)
        rz = math.atan2(-m12, m11)
    else:
        rx = math.atan2(m32, m22)
        rz = 0.0

    # columns of c2w are the camera axes in world space
    forward = (-c2w[0][2], -c2w[1][2], -c2w[2][2])
    up = (c2w[0][1], c2w[1][1], c2w[2][1])

    sensor = 36.0
    lens = sensor * f / w
    hfov = 2.0 * math.degrees(math.atan(w / (2.0 * f)))
    vfov = 2.0 * math.degrees(math.atan(h / (2.0 * f)))
    # scene-core.js derives the vertical FOV from a 24 mm sensor height:
    # vfov = 2*atan(12/lens)  =>  lens = 24*f/h.  This is the value to put in the spec.
    scene_lens = 24.0 * f / h
    return {
        "principal_point": [round(cx, 1), round(cy, 1)],
        "focal_px": round(f, 1),
        "lens_35mm_mm": round(lens, 1),
        "scene_lens_mm": round(scene_lens, 1),
        "hfov_deg": round(hfov, 1),
        "vfov_deg": round(vfov, 1),
        "three_fov_deg": round(vfov, 1),
        "rotation_euler_deg_xyz": [round(math.degrees(rx), 2), round(math.degrees(ry), 2), round(math.degrees(rz), 2)],
        "forward_world": [round(forward[0], 4), round(forward[1], 4), round(forward[2], 4)],
        "up_world": [round(up[0], 4), round(up[1], 4), round(up[2], 4)],
        "swapped_second_axis": flipped,
        "notes": [
            "Put scene_lens_mm in the spec camera 'lens' (scene-core uses a 24 mm sensor height).",
            "Camera position is NOT recoverable from vanishing points: place it by eye (eye height 1.4-1.6 m).",
            "Aim the camera with target = pos + forward_world * distance (2-6 m).",
            "If the result looks mirrored, swap vp1 and vp2.",
        ],
    }


def self_test():
    # synthetic camera: yaw 30 deg, pitch 3 deg down, known focal, world Z up
    f_true = 1662.8
    w, h = 1920, 1080
    yaw, pitch = math.radians(30), math.radians(3)
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    # camera looks toward +X/+Y (NE), slightly down; both horizontal axes are in front
    f_w = (cp * cy, cp * sy, -sp)
    r_w = (sy, -cy, 0.0)
    u_w = (cy * sp, sy * sp, cp)
    cxp, cyp = w / 2, h / 2
    vps = []
    for axis in ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0)):
        x = dot(axis, r_w)
        y = dot(axis, u_w)
        z = dot(axis, f_w)
        if z <= 1e-6:
            raise AssertionError("self-test camera does not see both horizontal axes")
        vps.append((cxp + f_true * x / z, cyp - f_true * y / z))
    res = solve((w, h), vps[0], vps[1])
    fwd = res["forward_world"]
    focal_ok = abs(res["focal_px"] - f_true) < 1.0
    forward_ok = dot(fwd, f_w) > 0.9999
    return {
        "ok": bool(focal_ok and forward_ok),
        "vps": vps,
        "result": res,
        "expected": {"focal_px": f_true, "forward_world": [round(c, 4) for c in f_w]},
    }


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--size", help="image size WxH in pixels, e.g. 4032x3024")
    p.add_argument("--vp1", help="first vanishing point x,y")
    p.add_argument("--vp2", help="second vanishing point x,y (orthogonal family)")
    p.add_argument("--pp", help="principal point x,y (default: image centre)")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()

    try:
        if args.self_test:
            print(json.dumps(self_test(), indent=2))
            return 0
        if not (args.size and args.vp1 and args.vp2):
            raise ValueError("--size, --vp1 and --vp2 are required (or use --self-test)")
        res = solve(parse_size(args.size), parse_pair(args.vp1), parse_pair(args.vp2), parse_pair(args.pp) if args.pp else None)
        print(json.dumps({"ok": True, **res}, indent=2))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
