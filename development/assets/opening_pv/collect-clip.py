"""Collect one completed cloud clip and its evidence without re-uploading media."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess


def download(bridge, remote, local):
    if local.exists():
        return
    local.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(["pwsh", "-NoProfile", "-File", str(bridge), "-Download", remote, "-Output", str(local), "-Timeout", "120"], capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024*1024):
            value.update(block)
    return value.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bridge", type=Path, required=True)
    parser.add_argument("--request-id", required=True)
    parser.add_argument("--media-dir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--cloud-project", default="/home/scc/pb25331949/projects/minimax_h3")
    args = parser.parse_args()
    match = re.fullmatch(r"mindrealm_pv_r\d+_20261025_([0-9a-c]+)", args.request_id)
    if not match:
        raise ValueError("Expected a production request ID")
    shot = match.group(1)
    evidence = args.media_dir.parent / "source-evidence"
    receipt_path = evidence / f"validation-{args.request_id}.json"
    remote_base = args.cloud_project + "/outputs"
    download(args.bridge, remote_base + "/" + receipt_path.name, receipt_path)
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if receipt.get("passed") is not True or receipt.get("request_id") != args.request_id:
        raise ValueError("Cloud validation has not completed for this request")
    video = args.media_dir / f"{args.request_id}.mp4"
    review = evidence / f"review-{args.request_id}.jpg"
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(download, args.bridge, remote_base + "/videos/" + video.name, video), pool.submit(download, args.bridge, remote_base + "/" + review.name, review)]
        for future in futures:
            future.result()
    checksum = digest(video)
    if checksum != receipt["sha256"] or video.stat().st_size != receipt["bytes"]:
        raise ValueError("The local clip differs from the validated cloud original")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8")) if args.manifest.exists() else {"clips": {}}
    duration = receipt.get("duration", receipt.get("video_duration_seconds"))
    previous = manifest["clips"].get(shot, {})
    entry = {"requestId": args.request_id, "file": video.name, "sha256": checksum, "bytes": video.stat().st_size, "duration": duration, "width": receipt["width"], "height": receipt["height"], "fps": receipt["fps"], "cloudJobId": receipt.get("job_id"), "creativeReviewed": False}
    if previous.get("requestId") == args.request_id and previous.get("sha256") == checksum:
        for key in ("creativeReviewed", "reviewNotes", "editSourceIn"):
            if key in previous:
                entry[key] = previous[key]
    manifest["clips"][shot] = entry
    manifest["status"] = "source_collection_in_progress"
    temporary = args.manifest.with_suffix(".json.partial")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.manifest)
    print(json.dumps({"shot": shot, "video": str(video), "review": str(review), "duration": duration, "sha256Verified": True, "collectedClips": len(manifest["clips"])}), flush=True)


if __name__ == "__main__":
    main()
