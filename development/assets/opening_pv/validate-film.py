"""Perform one consolidated check of the actual encoded film and its subtitles."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

import av
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def srt_time(value):
    hours, minutes, seconds = value.replace(",", ".").split(":")
    return int(hours)*3600 + int(minutes)*60 + float(seconds)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--subtitles", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--ffmpeg", required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    plan = json.loads((source / "cloud-shots.json").read_text(encoding="utf-8"))
    narration = json.loads((source / "shotlist.json").read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    picks = {round((clip["timelineStart"] + clip["timelineEnd"])*12): clip["id"] for clip in plan["clips"]}
    picks[round(132.5*24)] = "TITLE"
    frames = []
    motion_samples = []
    previous_sample = None
    with av.open(str(args.video)) as container:
        stream = container.streams.video[0]
        assert (stream.width, stream.height) == (1920, 1080)
        assert float(stream.average_rate) == 24
        assert stream.codec_context.name == "h264"
        duration = float(stream.duration * stream.time_base)
        assert abs(duration-135) < 1/24
        metadata = dict(container.metadata)
        assert "心域防线" in metadata.get("title", "")
        count = 0
        for frame in container.decode(stream):
            if count % 12 == 0:
                sample = frame.reformat(width=64, height=36, format="gray").to_ndarray().astype(np.float32)[:29]
                motion_samples.append({"time": count/24, "meanLuma": float(sample.mean()), "maximumLuma": float(sample.max()), "changeFromPreviousSample": None if previous_sample is None else float(np.abs(sample-previous_sample).mean())})
                previous_sample = sample
            if count in picks:
                im = frame.to_image().convert("RGB")
                im.thumbnail((320, 180))
                frames.append((picks[count], count/24, im))
            count += 1
    assert count == 3240, f"Decoded {count} frames instead of 3240"
    audio_count, energy, peak = 0, 0.0, 0.0
    with av.open(str(args.video)) as container:
        assert len(container.streams.audio) == 1
        stream = container.streams.audio[0]
        assert stream.codec_context.channels == 2
        assert stream.codec_context.sample_rate == 48000
        for frame in container.decode(stream):
            values = frame.to_ndarray()
            if np.issubdtype(values.dtype, np.integer):
                values = values.astype(np.float64) / np.iinfo(values.dtype).max
            else:
                values = values.astype(np.float64)
            peak = max(peak, float(np.max(np.abs(values))))
            energy += float((values*values).sum())
            audio_count += values.size
    audio_duration = audio_count / 2 / 48000
    assert abs(audio_duration-135) < 0.1 and 0 < peak < 1
    captions = []
    previous_end = 0
    for block in re.split(r"\n\s*\n", args.subtitles.read_text(encoding="utf-8").strip()):
        lines = block.splitlines()
        start_text, end_text = lines[1].split(" --> ")
        start, end = srt_time(start_text), srt_time(end_text)
        assert previous_end <= start < end <= 135.001
        assert len(lines[2:]) <= 2 and max(map(len, lines[2:])) <= 30
        previous_end = end
        captions.append("".join(lines[2:]))
    assert "".join(captions) == "".join(shot["voice"] for shot in narration)
    motion_by_shot = []
    for clip in plan["clips"]:
        samples = [row for row in motion_samples if clip["timelineStart"]+0.5 < row["time"] < clip["timelineEnd"]-0.5]
        motion_by_shot.append({"shot": clip["id"], "samples": len(samples), "meanChange": float(np.mean([row["changeFromPreviousSample"] for row in samples])) if samples else None, "fullyDarkSampleTimes": [row["time"] for row in samples if row["maximumLuma"] < 5]})
    (args.output_dir/"film-motion-samples.json").write_text(json.dumps({"sampleIntervalSeconds": 0.5, "samplingArea": "upper picture, excluding subtitle area", "shots": motion_by_shot, "samples": motion_samples}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    sheet = Image.new("RGB", (1280, 816), "#111820")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/times.ttf", 16)
    for index, (label, at, im) in enumerate(frames):
        x, y = index%4*320, index//4*204
        sheet.paste(im, (x, y))
        draw.text((x+8, y+183), f"{label} / {at:.2f}s", fill="white", font=font)
    review = args.output_dir / "film-contact-sheet.jpg"
    sheet.save(review, quality=84, optimize=True)
    speech_reference = args.output_dir / "film-audio-for-transcription.mp3"
    subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(args.video), "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", str(speech_reference)], check=True)
    checksum = hashlib.sha256()
    with args.video.open("rb") as video_file:
        while chunk := video_file.read(1024*1024):
            checksum.update(chunk)
    result = {"technicalChecksPassed": True, "video": str(args.video), "sha256": checksum.hexdigest(), "bytes": args.video.stat().st_size, "duration": duration, "decodedVideoFrames": count, "resolution": [1920,1080], "fps": 24, "audioSampleRate": 48000, "audioChannels": 2, "decodedAudioDuration": audio_duration, "audioPeak": peak, "audioRms": (energy/audio_count)**0.5, "subtitleCues": len(captions), "subtitleTextMatchesApprovedNarration": True, "motionSummary": motion_by_shot, "contactSheet": str(review), "creativeReviewRequired": True, "speechIntelligibilityReviewRequired": True}
    (args.output_dir/"film-validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False),flush=True)


if __name__ == "__main__":
    main()
