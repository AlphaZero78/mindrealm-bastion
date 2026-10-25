"""Materialize the approved shot plan for the existing MiniMax-H3 cloud runner."""
import argparse
import hashlib
import json
import math
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    plan = json.loads((source / "cloud-shots.json").read_text(encoding="utf-8"))
    profile = plan["generationProfile"]
    fields = ("duration_seconds", "width", "height", "fps", "native_frames", "steps", "sampler", "scheduler")
    character_shots = {"02", "06", "07", "09", "10", "12"}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for shot in plan["clips"]:
        request_id = f"mindrealm_pv_r{plan['revision']}_20261025_{shot['id']}"
        directions = [plan["sharedDirection"]]
        if shot["id"] in character_shots:
            directions.append(plan["characterContinuity"])
        directions.append(shot["prompt"])
        prompt = "integrated_multimodal_description: [Shot 1] " + "\n\n".join(directions)
        prompt += "\n\noverall_soundscape: " + plan["soundDirection"]
        prompt += "\n\nnon_diegetic_music: None."
        request = {"request_id": request_id, "prompt": prompt, **{key: profile[key] for key in fields}, "seed": shot["seed"]}
        if profile.get("durationFromEdit"):
            duration = float(max(5, min(15, math.ceil(shot["timelineEnd"] - shot["timelineStart"] + 1))))
            request["duration_seconds"] = duration
            request["native_frames"] = math.ceil((round(duration * request["fps"]) - 5) / 17) * 17 + 5
        for key in ("lora_name", "shift_video", "shift_audio"):
            if key in profile:
                request[key] = profile[key]
        path = args.output_dir / f"{request_id}.json"
        encoded = (json.dumps(request, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if path.exists() and path.read_bytes() != encoded:
            raise ValueError(f"Existing request differs; increase the plan revision: {path}")
        path.write_bytes(encoded)
        entries.append({"shot": shot["id"], "request_id": request_id, "file": path.name, "sha256": hashlib.sha256(encoded).hexdigest(), "timelineStart": shot["timelineStart"], "timelineEnd": shot["timelineEnd"], "sourceIn": shot["sourceIn"]})
    manifest = {"revision": plan["revision"], "status": "prepared_not_submitted", "requests": entries, "endCard": plan["endCard"]}
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"count": len(entries), "outputDirectory": str(args.output_dir), "totalJsonBytes": sum(p.stat().st_size for p in args.output_dir.glob("*.json"))}))


if __name__ == "__main__":
    main()
