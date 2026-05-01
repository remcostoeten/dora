#!/usr/bin/env python3

import importlib.util
import subprocess
import sys
import venv
from pathlib import Path


PACKAGES = {
    "bs4": "beautifulsoup4",
    "requests": "requests",
}
ROOT = Path(__file__).resolve().parents[2]
ENV = ROOT / ".venv"
PYTHON = ENV / "bin" / "python"
PIP = ENV / "bin" / "pip"


def ensure_env():
    if not PYTHON.exists():
        venv.create(ENV, with_pip=True)


def missing(python):
    script = "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec(sys.argv[1]) else 1)"
    names = []
    for module, name in PACKAGES.items():
        result = subprocess.run([str(python), "-c", script, module], check=False)
        if result.returncode != 0:
            names.append(name)
    return names


def host_missing():
    return [name for module, name in PACKAGES.items() if importlib.util.find_spec(module) is None]


def install(packages):
    subprocess.check_call([str(PIP), "install", *packages])


def main():
    if not host_missing():
        return 0
    ensure_env()
    packages = missing(PYTHON)
    if packages:
        install(packages)
    return 0


if __name__ == "__main__":
    sys.exit(main())
