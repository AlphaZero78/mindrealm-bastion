"""Fetch the public H3 accelerator directly on the cluster; verify its pinned hash."""
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request

NAME = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"
REVISION = "b9591d0cd28b7e64106551ac3843dcfee07d7785"
EXPECTED_BYTES = 1956193000
EXPECTED_SHA256 = "08cfe946033af7d27719b964b6e0a0e50c32138daabbd6ce4137e23df6bf9980"
URL = f"https://modelscope.cn/api/v1/models/lightx2v/Minimax-h3-Turbo/repo?Revision={REVISION}&FilePath={NAME}"
PROJECT = Path.home() / "projects" / "minimax_h3"
TARGET = Path.home() / "models" / "MiniMax-H3" / "loras" / NAME
STATE = PROJECT / "outputs" / "opening-adapter-download.json"


def report(status, **extra):
    data = {"status": status, "pid": os.getpid(), "updatedAt": time.time(), "file": str(TARGET), **extra}
    temporary = STATE.with_suffix(".json.partial")
    temporary.write_text(json.dumps(data, indent=2) + "\n")
    temporary.replace(STATE)
    print(json.dumps(data), flush=True)


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    if TARGET.exists():
        if TARGET.stat().st_size != EXPECTED_BYTES or digest(TARGET) != EXPECTED_SHA256:
            raise ValueError("Existing adapter differs from the pinned public file")
        report("complete", bytes=EXPECTED_BYTES, sha256=EXPECTED_SHA256, reused=True)
        return
    partial = TARGET.with_suffix(TARGET.suffix + ".partial")
    offset = partial.stat().st_size if partial.exists() else 0
    headers = {"User-Agent": "Mindrealm-PV-Production"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
    request = urllib.request.Request(URL, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        if offset and response.status != 206:
            offset = 0
        report("downloading", bytes=offset, totalBytes=EXPECTED_BYTES)
        last_report = time.monotonic()
        with partial.open("ab" if offset else "wb") as target:
            while block := response.read(1024 * 1024):
                target.write(block)
                offset += len(block)
                if time.monotonic() - last_report >= 10:
                    report("downloading", bytes=offset, totalBytes=EXPECTED_BYTES)
                    last_report = time.monotonic()
    report("verifying", bytes=offset)
    if offset != EXPECTED_BYTES or digest(partial) != EXPECTED_SHA256:
        raise ValueError("Downloaded adapter size or SHA-256 differs from its publisher")
    partial.replace(TARGET)
    report("complete", bytes=offset, sha256=EXPECTED_SHA256, source=URL)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        report("failed", error=str(error))
        raise
