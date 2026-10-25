"""Synthesize the approved Mandarin narration locally and align editable subtitles."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
import soundfile as sf
import torch
from kokoro import KModel, KPipeline

REPO = "hexgrad/Kokoro-82M-v1.1-zh"
RATE = 24000
OFFSETS = {"01": 2.0, "02": 1.0, "03": 1.0, "04": 1.2, "05": 2.0, "06": 1.5, "07": 1.0, "08": 1.0, "09": 1.2, "10": 0.9, "11": 0.05, "12": 0.2}


def timestamp(seconds, ass=False):
    units = 100 if ass else 1000
    total = round(seconds * units)
    hours, total = divmod(total, 3600 * units)
    minutes, total = divmod(total, 60 * units)
    whole, fraction = divmod(total, units)
    return f"{hours}:{minutes:02}:{whole:02}.{fraction:02}" if ass else f"{hours:02}:{minutes:02}:{whole:02},{fraction:03}"


def wrap_caption(text):
    if len(text) <= 24:
        return text
    middle = len(text) / 2
    candidates = [index + 1 for index, char in enumerate(text) if char in "，。；！？" and 10 <= index + 1 <= len(text) - 10]
    split = min(candidates, key=lambda value: abs(value - middle)) if candidates else round(middle)
    return text[:split] + "\n" + text[split:]


def trim_outer_silence(audio):
    audible = np.flatnonzero(np.abs(audio) > 0.001)
    if len(audible) == 0:
        raise ValueError("Narration waveform is silent")
    begin = max(0, int(audible[0]) - round(RATE * 0.08))
    end = min(len(audio), int(audible[-1]) + round(RATE * 0.14))
    return audio[begin:end]


def caption_segments(record, directory):
    if record["shot"] != "12" or "。" not in record["text"]:
        return [{"text": record["text"], "start": record["start"], "end": record["end"] + 0.15, "burn": True}]
    audio, rate = sf.read(directory / record["file"])
    block = round(rate * 0.02)
    rms = np.sqrt(np.mean(audio[:len(audio)//block*block].reshape(-1, block)**2, axis=1))
    times = np.arange(len(rms)) * 0.02
    quiet = (rms < 0.012) & (times > 1.4) & (times < 3.9)
    edges = np.diff(np.r_[False, quiet, False].astype(int))
    pauses = [(float(a*0.02), float(b*0.02)) for a, b in zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)) if b-a >= 8]
    if not pauses:
        return [{"text": record["text"], "start": record["start"], "end": record["end"] + 0.15, "burn": True}]
    begin, end = max(pauses, key=lambda pair: pair[1]-pair[0])
    first, last = record["text"].split("。", 1)
    last_start = record["start"] + end - 0.08
    return [
        {"text": first + "。", "start": record["start"], "end": record["start"] + begin + 0.08, "burn": True},
        {"text": last, "start": last_start, "end": record["end"] + 0.15, "burn": last_start < 131, "titleCardContainsText": True},
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--only", help="Render one existing shot as the production sample")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    shots = json.loads((source / "shotlist.json").read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = args.output_dir / "raw"
    raw_dir.mkdir(exist_ok=True)
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    torch.manual_seed(20261025)
    pipeline = None
    voice = str(args.model_dir / "voices" / "zm_010.pt")
    narration = np.zeros(round(135 * RATE), dtype=np.float32)
    records = []
    for shot in shots:
        if args.only and shot["id"] != args.only:
            continue
        text = shot["voice"]
        cache_key = hashlib.sha256((text + "|zm_010|speed=0.88").encode("utf-8")).hexdigest()[:12]
        raw_path = raw_dir / f"voice-{shot['id']}-{cache_key}.wav"
        if raw_path.exists():
            audio, sample_rate = sf.read(raw_path, dtype="float32")
            if sample_rate != RATE:
                raise ValueError("Cached narration has an unexpected sample rate")
        else:
            if pipeline is None:
                model = KModel(repo_id=REPO, config=str(args.model_dir / "config.json"), model=str(args.model_dir / "kokoro-v1_1-zh.pth")).to("cpu").eval()
                pipeline = KPipeline(lang_code="z", repo_id=REPO, model=model, device="cpu")
            parts = [result.audio.numpy() for result in pipeline(text, voice=voice, speed=0.88)]
            if not parts:
                raise ValueError(f"The narrator returned no audio for shot {shot['id']}")
            audio = trim_outer_silence(np.concatenate(parts))
            sf.write(raw_path, audio, RATE, subtype="PCM_24")
        start = shot["start"] + OFFSETS[shot["id"]]
        latest_end = shot["end"] - (0.6 if shot["id"] == "12" else 0.5)
        available = latest_end - start
        original_duration = len(audio) / RATE
        tempo = max(0.92, original_duration / available)
        if tempo > 1.18:
            raise ValueError(f"Shot {shot['id']} needs a revised narration slot: {original_duration:.2f}s in {available:.2f}s")
        aligned_path = args.output_dir / f"voice-{shot['id']}.wav"
        if abs(tempo - 1) > 0.001:
            subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw_path), "-af", f"atempo={tempo:.8f}", "-ar", str(RATE), "-ac", "1", "-c:a", "pcm_s24le", str(aligned_path)], check=True)
            audio, _ = sf.read(aligned_path, dtype="float32")
        peak = float(np.max(np.abs(audio)))
        if peak <= 0:
            raise ValueError("Empty narration waveform")
        audio = audio * (0.8 / peak)
        sf.write(aligned_path, audio, RATE, subtype="PCM_24")
        begin_sample = round(start * RATE)
        end_sample = begin_sample + len(audio)
        if end_sample > len(narration) or (records and start < records[-1]["end"]):
            raise ValueError("Narration timing overlap or overflow")
        narration[begin_sample:end_sample] += audio
        end = end_sample / RATE
        record = {"shot": shot["id"], "text": text, "start": start, "end": end, "rawDuration": original_duration, "tempo": tempo, "file": aligned_path.name, "sha256": hashlib.sha256(aligned_path.read_bytes()).hexdigest()}
        records.append(record)
        print(json.dumps({"shot": shot["id"], "start": start, "end": round(end, 3), "tempo": round(tempo, 4)}, ensure_ascii=False), flush=True)
    if args.only:
        return
    sf.write(args.output_dir / "narration-aligned.wav", narration, RATE, subtype="PCM_24")
    srt = []
    ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding", "Style: Default,SimSun,42,&H00F5F3EF,&H00FFFFFF,&H001A1713,&H66000000,0,0,0,0,100,100,1,0,1,2,1,2,180,180,88,1", "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for record in records:
        record["captions"] = caption_segments(record, args.output_dir)
        for segment in record["captions"]:
            caption = wrap_caption(segment["text"])
            end = min(135, segment["end"])
            srt.append(f"{len(srt)+1}\n{timestamp(segment['start'])} --> {timestamp(end)}\n{caption}\n")
            escaped = caption.replace("\n", r"\N")
            if segment["burn"]:
                ass.append(f"Dialogue: 0,{timestamp(segment['start'], True)},{timestamp(end, True)},Default,,0,0,0,,{{\\fad(100,150)}}{escaped}")
    (args.output_dir / "narration.zh-CN.srt").write_text("\n".join(srt), encoding="utf-8")
    (args.output_dir / "narration.zh-CN.ass").write_text("\n".join(ass) + "\n", encoding="utf-8")
    manifest = {"model": REPO, "voice": "zm_010", "license": "Apache-2.0", "sampleRate": RATE, "duration": 135, "narrativeRevision": 2, "listeningVerified": False, "segments": records}
    (args.output_dir / "narration-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
