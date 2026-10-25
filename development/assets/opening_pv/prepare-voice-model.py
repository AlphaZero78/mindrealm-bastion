"""Download the pinned, permissively licensed Mandarin narrator into a local cache."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

REPO = "hexgrad/Kokoro-82M-v1.1-zh"
REVISION = "01e7505bd6a7a2ac4975463114c3a7650a9f7218"
MODEL_SHA256 = "b1d8410fa44dfb5c15471fd6c4225ea6b4e9ac7fa03c98e8bea47a9928476e2b"
FILES = ("config.json", "kokoro-v1_1-zh.pth", "voices/zm_010.pt", "README.md")


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for name in FILES:
        path = args.output_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://huggingface.co/{REPO}/resolve/{REVISION}/{name}"
        if not path.is_file():
            temporary = path.with_suffix(path.suffix + ".partial")
            request = urllib.request.Request(url, headers={"User-Agent": "Mindrealm-PV-Asset-Preparation"})
            with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as target:
                while block := response.read(1024 * 1024):
                    target.write(block)
            if name == "kokoro-v1_1-zh.pth" and digest(temporary) != MODEL_SHA256:
                raise ValueError("Narrator model hash differs from the publisher's model card")
            temporary.replace(path)
        file_hash = digest(path)
        if name == "kokoro-v1_1-zh.pth" and file_hash != MODEL_SHA256:
            raise ValueError("Existing narrator model hash differs from the pinned model")
        record = {"file": name, "bytes": path.stat().st_size, "sha256": file_hash, "source": url}
        records.append(record)
        print(json.dumps({"ready": name, "bytes": record["bytes"]}), flush=True)
    manifest = {"repo": REPO, "revision": REVISION, "license": "Apache-2.0", "voice": "zm_010", "files": records}
    (args.output_dir / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
