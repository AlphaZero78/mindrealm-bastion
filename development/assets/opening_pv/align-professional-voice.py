"""Align one professional narration recording to the existing picture timeline."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

import numpy as np
import soundfile as sf

RATE = 24000
OFFSETS = {"01": 2.0, "02": 1.0, "03": 1.0, "04": 1.2, "05": 2.0, "06": 1.5, "07": 1.0, "08": 1.0, "09": 1.2, "10": 0.9, "11": 0.05, "12": 0.0}


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
    positions = [i+1 for i, char in enumerate(text) if char in "，。；！？" and 10 <= i+1 <= len(text)-10]
    split = min(positions, key=lambda value: abs(value-len(text)/2)) if positions else round(len(text)/2)
    return text[:split] + "\n" + text[split:]


def lexical(token):
    return bool(re.search(r"[\u4e00-\u9fffA-Za-z0-9]", token["word"]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--response", type=Path, required=True)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    shots = json.loads((source/"shotlist.json").read_text(encoding="utf-8"))
    response = json.loads(args.response.read_text(encoding="utf-8"))
    tokens = [token for token in response["word_timestamps"] if not token["word"].startswith("<") and token["word"].strip()]
    assert "".join(token["word"] for token in tokens) == "".join(shot["voice"] for shot in shots), "Provider text differs from the approved narration"
    groups, cursor = [], 0
    for shot in shots:
        group, text = [], ""
        while len(text) < len(shot["voice"]):
            token = tokens[cursor]
            cursor += 1
            group.append(token)
            text += token["word"]
        assert text == shot["voice"]
        groups.append(group)
    decoded = subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(args.audio), "-ar", str(RATE), "-ac", "1", "-f", "f32le", "pipe:1"], check=True, capture_output=True)
    audio = np.frombuffer(decoded.stdout, dtype="<f4").copy()
    assert abs(len(audio)/RATE-response["duration"]) < 0.03
    gain = 0.82 / float(np.max(np.abs(audio)))
    audio *= gain
    args.output_dir.mkdir(parents=True, exist_ok=True)
    aligned = np.zeros(round(135*RATE), dtype=np.float32)
    records = []
    for index, (shot, group) in enumerate(zip(shots, groups)):
        words = [token for token in group if lexical(token)]
        first, last = words[0]["start"], words[-1]["end"]
        previous_end = [token for token in groups[index-1] if lexical(token)][-1]["end"] if index else 0
        next_start = [token for token in groups[index+1] if lexical(token)][0]["start"] if index+1 < len(groups) else len(audio)/RATE
        source_in = max(0, first-0.12, (previous_end+first)/2 if index else 0)
        source_out = min(len(audio)/RATE, last+0.18, (last+next_start)/2)
        segment = audio[round(source_in*RATE):round(source_out*RATE)]
        start = shot["start"] + OFFSETS[shot["id"]]
        end = start + len(segment)/RATE
        latest = shot["end"] - (0.5 if shot["id"] != "12" else 0.6)
        if end > latest:
            raise ValueError(f"Narration {shot['id']} needs a longer slot: ends {end:.3f}, allowed {latest:.3f}")
        if records and start < records[-1]["end"]:
            raise ValueError("Narration overlap")
        begin = round(start*RATE)
        aligned[begin:begin+len(segment)] = segment
        filename = f"voice-{shot['id']}.wav"
        sf.write(args.output_dir/filename, segment, RATE, subtype="PCM_24")
        timed = [{"word": token["word"], "start": start+token["start"]-source_in, "end": start+token["end"]-source_in} for token in words]
        captions = [{"text": shot["voice"], "start": max(shot["start"], timed[0]["start"]-0.10), "end": min(135, timed[-1]["end"]+0.20), "burn": True}]
        if shot["id"] == "12":
            first_text, last_text = shot["voice"].split("。", 1)
            first_count = len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", first_text))
            captions = [
                {"text": first_text+"。", "start": timed[0]["start"]-0.10, "end": min(131, timed[first_count-1]["end"]+0.15), "burn": True},
                {"text": last_text, "start": timed[first_count]["start"]-0.10, "end": timed[-1]["end"]+0.20, "burn": False, "titleCardContainsText": True},
            ]
            assert captions[1]["start"] >= 131
        record = {"shot": shot["id"], "text": shot["voice"], "sourceIn": source_in, "sourceOut": source_out, "start": start, "end": end, "file": filename, "tempo": 1.0, "sha256": hashlib.sha256((args.output_dir/filename).read_bytes()).hexdigest(), "captions": captions, "words": timed}
        records.append(record)
        print(json.dumps({"shot": shot["id"], "start": round(start,3), "end": round(end,3)}), flush=True)
    sf.write(args.output_dir/"narration-aligned.wav", aligned, RATE, subtype="PCM_24")
    ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding", "Style: Default,SimSun,42,&H00F5F3EF,&H00FFFFFF,&H001A1713,&H66000000,0,0,0,0,100,100,1,0,1,2,1,2,180,180,88,1", "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    srt = []
    for record in records:
        for caption in record["captions"]:
            text = wrap_caption(caption["text"])
            srt.append(f"{len(srt)+1}\n{timestamp(caption['start'])} --> {timestamp(caption['end'])}\n{text}\n")
            if caption["burn"]:
                escaped = text.replace("\n", r"\N")
                ass.append(f"Dialogue: 0,{timestamp(caption['start'], True)},{timestamp(caption['end'], True)},Default,,0,0,0,,{{\\fad(100,150)}}{escaped}")
    (args.output_dir/"narration.zh-CN.srt").write_text("\n".join(srt),encoding="utf-8")
    (args.output_dir/"narration.zh-CN.ass").write_text("\n".join(ass)+"\n",encoding="utf-8")
    manifest = {"provider": "HeyGen Voice", "engine": response["engine"], "voice": "Guoliang - Warm & Resonant", "voiceId": "1ddd191b2454466e9527983c9dcb4c14", "requestId": response["request_id"], "providerSpeed": 0.82, "sourceAudio": str(args.audio), "sourceSha256": hashlib.sha256(args.audio.read_bytes()).hexdigest(), "sourceDuration": response["duration"], "duration": 135, "sampleRate": RATE, "alignmentMethod": "Provider word timing, sentence-safe cuts and fixed picture slots", "segments": records}
    (args.output_dir/"narration-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


if __name__ == "__main__":
    main()
