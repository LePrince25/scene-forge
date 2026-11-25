#!/usr/bin/env python3
"""Image → generative 3D mesh (GLB) through a hosted API.

Providers: Tripo (TRIPO_API_KEY) and Meshy (MESHY_API_KEY). Both have free tiers;
nothing runs locally, so no GPU is required.

  TRIPO_API_KEY=... python3 img2mesh.py --image photo.png --out out/model.glb
  MESHY_API_KEY=... python3 img2mesh.py --image photo.png --out out/model.glb --provider meshy

Only JSON on stdout; progress goes to stderr.
"""
import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

TRIPO_CREATE = "https://api.tripo3d.ai/v2/openapi/task"
TRIPO_TASK = "https://api.tripo3d.ai/v2/openapi/task/{task_id}"
MESHY_CREATE = "https://api.meshy.ai/openapi/v1/image-to-3d"
MESHY_TASK = "https://api.meshy.ai/openapi/v1/image-to-3d/{task_id}"


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def http_json(url, method="GET", headers=None, payload=None, timeout=60):
    data = None
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if payload is not None:
        data = json.dumps(payload).encode()
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"HTTP {e.code} on {url}: {body}") from None


def download(url, out):
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "scene-forge"})
    with urllib.request.urlopen(req, timeout=300) as r, open(out, "wb") as f:
        f.write(r.read())
    return out


def tripo(image, out, wait):
    key = os.environ.get("TRIPO_API_KEY")
    if not key:
        raise RuntimeError("TRIPO_API_KEY is not set. Get a key at tripo3d.ai (free tier available).")
    ext = mimetypes.guess_extension(mimetypes.guess_type(str(image))[0] or "image/png") or ".png"
    ext = ext.lstrip(".")
    if ext == "jpeg":
        ext = "jpg"
    data = base64.b64encode(Path(image).read_bytes()).decode()
    headers = {"Authorization": f"Bearer {key}"}
    res = http_json(TRIPO_CREATE, "POST", headers, {"type": "image_to_model", "file": {"type": ext, "data": data}})
    if res.get("code", 0) != 0:
        raise RuntimeError(f"Tripo rejected the task: {res}")
    task_id = (res.get("data") or {}).get("task_id")
    if not task_id:
        raise RuntimeError(f"Tripo returned no task id: {res}")
    log(f"Tripo task {task_id} created")
    deadline = time.time() + wait
    while time.time() < deadline:
        time.sleep(6)
        res = http_json(TRIPO_TASK.format(task_id=task_id), headers=headers)
        d = res.get("data") or {}
        status = (d.get("status") or "").lower()
        log(f"Tripo status: {status} {d.get('progress', '')}%")
        if status == "success":
            output = d.get("output") or {}
            url = output.get("pbr_model") or output.get("model")
            if not url:
                raise RuntimeError(f"Tripo task succeeded without a model URL: {d}")
            return download(url, out)
        if status in ("failed", "cancelled", "banned", "expired", "unknown"):
            raise RuntimeError(f"Tripo task ended with status '{status}': {d}")
    raise RuntimeError(f"Tripo task timed out after {wait}s")


def meshy(image, out, wait):
    key = os.environ.get("MESHY_API_KEY")
    if not key:
        raise RuntimeError("MESHY_API_KEY is not set. Get a key at meshy.ai (free tier available).")
    mime = mimetypes.guess_type(str(image))[0] or "image/png"
    data = base64.b64encode(Path(image).read_bytes()).decode()
    headers = {"Authorization": f"Bearer {key}"}
    res = http_json(MESHY_CREATE, "POST", headers, {"image_url": f"data:{mime};base64,{data}", "enable_pbr": True})
    task_id = res.get("result") if isinstance(res, dict) else None
    if not task_id:
        raise RuntimeError(f"Meshy returned no task id: {res}")
    log(f"Meshy task {task_id} created")
    deadline = time.time() + wait
    while time.time() < deadline:
        time.sleep(6)
        d = http_json(MESHY_TASK.format(task_id=task_id), headers=headers)
        status = (d.get("status") or "").upper()
        log(f"Meshy status: {status} {d.get('progress', '')}%")
        if status == "SUCCEEDED":
            url = ((d.get("model_urls") or {}).get("glb"))
            if not url:
                raise RuntimeError(f"Meshy task succeeded without a GLB URL: {d}")
            return download(url, out)
        if status in ("FAILED", "CANCELED", "CANCELLED", "EXPIRED"):
            raise RuntimeError(f"Meshy task ended with status '{status}': {d}")
    raise RuntimeError(f"Meshy task timed out after {wait}s")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--image", required=True)
    p.add_argument("--out", default="out/model.glb")
    p.add_argument("--provider", choices=["auto", "tripo", "meshy"], default="auto")
    p.add_argument("--wait", type=int, default=600, help="max seconds to wait (default 600)")
    args = p.parse_args()

    t0 = time.time()
    image = Path(args.image)
    try:
        if not image.exists():
            raise RuntimeError(f"image not found: {image}")
        provider = args.provider
        if provider == "auto":
            if os.environ.get("TRIPO_API_KEY"):
                provider = "tripo"
            elif os.environ.get("MESHY_API_KEY"):
                provider = "meshy"
            else:
                raise RuntimeError(
                    "No provider key found. Set TRIPO_API_KEY or MESHY_API_KEY, "
                    "or use scene-forge mode B (photo → 3D by reconstruction, no key needed)."
                )
        out = tripo(image, args.out, args.wait) if provider == "tripo" else meshy(image, args.out, args.wait)
        print(json.dumps({
            "ok": True,
            "provider": provider,
            "glb": str(out),
            "bytes": out.stat().st_size,
            "seconds": round(time.time() - t0, 1),
            "next": "Open it with viewer.html?glb=model.glb or reference it from a spec with {\"type\":\"asset\",\"file\":\"model.glb\"}",
        }, indent=2))
        return 0
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "hint": "Mode B (vision reconstruction) needs no key: build the scene spec by hand from the photo.",
        }, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
