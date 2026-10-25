"""Validate a rendered source clip once and make a small local review image."""
import argparse
import hashlib
import json
import os
from pathlib import Path

import av
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    args = parser.parse_args()
    request = json.loads(args.request.read_text())
    project = Path(os.environ["H3_PROJECT"])
    name = request["request_id"]
    video = project / "outputs" / "videos" / f"{name}.mp4"
    expected = round(request["duration_seconds"] * request["fps"])
    picks = {0, expected // 4, expected // 2, expected * 3 // 4, expected - 1}
    frames = []
    with av.open(str(video)) as container:
        stream = container.streams.video[0]
        assert (stream.width, stream.height) == (request["width"], request["height"])
        assert float(stream.average_rate) == request["fps"]
        duration = float(stream.duration * stream.time_base)
        count = 0
        for frame in container.decode(stream):
            if count in picks:
                im = frame.to_image().convert("RGB")
                im.thumbnail((384, 220))
                frames.append((count, im))
            count += 1
    assert count == expected and abs(duration - request["duration_seconds"]) < 0.05
    samples = [np.asarray(im.resize((192, 110)), dtype=np.float32) for _, im in frames]
    motion = [float(np.abs(a-b).mean()) for a, b in zip(samples, samples[1:])]
    assert min(float(im.std()) for im in samples) > 4, "Blank-looking source footage"
    assert max(motion) > 0.5, "No visible change in the sampled frames"
    with av.open(str(video)) as container:
        stream = container.streams.audio[0]
        assert stream.codec_context.channels == 2
        audio_samples, energy = 0, 0.0
        for frame in container.decode(stream):
            values = frame.to_ndarray().astype(np.float64)
            audio_samples += values.size
            energy += float((values * values).sum())
        assert audio_samples > 0 and energy > 0
    sheet = Image.new("RGB", (1152, 488), "#101820")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(project / "assets" / "LiberationSerif-Regular.ttf"), 17)
    for index, (number, im) in enumerate(frames):
        x, y = index % 3 * 384, index // 3 * 244
        sheet.paste(im, (x, y))
        draw.text((x+8, y+222), f"{number/request['fps']:.2f} s", fill="white", font=font)
    draw.text((778, 284), name, fill="white", font=font)
    draw.text((778, 312), f"{duration:.2f}s / {request['width']}x{request['height']}", fill="white", font=font)
    review = project / "outputs" / f"review-{name}.jpg"
    sheet.save(review, quality=82, optimize=True)
    checksum = hashlib.sha256()
    with video.open("rb") as source:
        while block := source.read(1024*1024):
            checksum.update(block)
    result = {"passed": True, "request_id": name, "job_id": os.environ.get("SLURM_JOB_ID"), "video": str(video), "bytes": video.stat().st_size, "sha256": checksum.hexdigest(), "duration": duration, "frames": count, "width": request["width"], "height": request["height"], "fps": request["fps"], "audioChannels": 2, "motionSampleDeltas": motion, "reviewImage": str(review), "creativeReviewComplete": False}
    (project/"outputs"/f"validation-{name}.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result),flush=True)


if __name__ == "__main__":
    main()
