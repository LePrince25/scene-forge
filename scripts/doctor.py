#!/usr/bin/env python3
"""scene-forge environment check. Prints JSON."""
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def version(cmd):
    try:
        out = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=10)
        return (out.stdout or out.stderr).strip().splitlines()[0]
    except Exception:
        return None


def find_chrome():
    env = os.environ.get("CHROME_PATH")
    if env and Path(env).exists():
        return env
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    for name in ("google-chrome", "chromium", "chromium-browser", "msedge"):
        p = shutil.which(name)
        if p:
            return p
    return None


def main():
    node = shutil.which("node")
    npm = shutil.which("npm")
    chrome = find_chrome()
    puppeteer = (ROOT / "node_modules" / "puppeteer-core" / "package.json").exists()
    keys = {
        "TRIPO_API_KEY": bool(os.environ.get("TRIPO_API_KEY")),
        "MESHY_API_KEY": bool(os.environ.get("MESHY_API_KEY")),
    }

    hints = []
    if not node:
        hints.append("Install Node.js 18+ (nodejs.org) — required for stills and GLB export.")
    if not chrome:
        hints.append("Install Chrome/Chromium/Edge, or set CHROME_PATH to its binary.")
    if not puppeteer:
        hints.append("Run `npm install` in the skill folder (installs puppeteer-core).")
    if not any(keys.values()):
        hints.append("No 3D provider key: image→3D will use vision reconstruction (mode B). Set TRIPO_API_KEY or MESHY_API_KEY for mode C.")

    report = {
        "ok": bool(node and chrome and puppeteer),
        "platform": f"{platform.system()}-{platform.machine()}",
        "python": sys.version.split()[0],
        "node": {"path": node, "version": version(node) if node else None},
        "npm": {"path": npm, "version": version(npm) if npm else None},
        "chrome": chrome,
        "puppeteer_core": puppeteer,
        "provider_keys": keys,
        "skill_md": (ROOT / "SKILL.md").exists(),
        "hints": hints,
    }
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
