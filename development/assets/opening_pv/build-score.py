"""Build the temporary cinematic score from the game's retained licensed assets."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def gain_expression(points):
    expression = str(points[-1][1])
    for (start, low), (end, high) in reversed(list(zip(points, points[1:]))):
        if end <= start:
            raise ValueError("Gain points must be strictly ordered")
        segment = f"{low}+({high-low})*(t-{start})/{end-start}"
        expression = f"if(lt(t,{end}),{segment},{expression})"
    return expression


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.ffmpeg:
        raise SystemExit("Supply --ffmpeg with an installed FFmpeg executable")
    source = Path(__file__).resolve().parent
    repo = source.parents[2]
    plan = json.loads((source / "score-plan.json").read_text(encoding="utf-8"))
    duration = plan["durationSeconds"]
    command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    filters, labels, receipts = [], [], []
    inputs = plan["music"] + plan["effects"]
    for index, item in enumerate(inputs):
        path = repo / item["path"]
        if not path.is_file():
            raise FileNotFoundError(path)
        if item.get("sourceOffset"):
            command += ["-ss", str(item["sourceOffset"])]
        command += ["-i", str(path)]
        label = f"a{index}"
        chain = f"[{index}:a]aresample={plan['sampleRate']},aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS"
        if "gainPoints" in item:
            chain += f",atrim=duration={duration},volume='{gain_expression(item['gainPoints'])}':eval=frame"
        else:
            delay = round(item["at"] * 1000)
            chain += f",lowpass=f={item['lowpass']},volume={item['gain']},adelay={delay}|{delay}"
        filters.append(f"{chain}[{label}]")
        labels.append(f"[{label}]")
        receipts.append({"path": item["path"], "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    mix = plan["mix"]
    filters.append("".join(labels) + f"amix=inputs={len(inputs)}:normalize=0:dropout_transition=0,apad,atrim=duration={duration},loudnorm=I={mix['targetLufs']}:TP={mix['truePeakDb']}:LRA={mix['loudnessRange']},aresample={plan['sampleRate']}[mix]")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    codec = ["-c:a", "pcm_s24le"] if args.output.suffix.lower() == ".wav" else ["-c:a", "libmp3lame", "-b:a", "192k"]
    command += ["-filter_complex", ";".join(filters), "-map", "[mix]", "-t", str(duration)] + codec + [str(args.output)]
    subprocess.run(command, check=True)
    receipt = {"status": "rendered_pending_listening", "durationTarget": duration, "output": str(args.output), "outputSha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "sources": receipts, "planRevision": plan["revision"]}
    args.output.with_suffix(".provenance.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "bytes": args.output.stat().st_size, "status": receipt["status"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
