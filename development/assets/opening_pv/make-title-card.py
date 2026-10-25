"""Render the film's typographic end card using the existing game's emblem."""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def centered_tracking(draw, text, font, center, color, spacing):
    widths = [draw.textlength(char, font=font) for char in text]
    width = sum(widths) + spacing * max(0, len(text) - 1)
    x = center[0] - width / 2
    for char, advance in zip(text, widths):
        # Share a typographic baseline even when a glyph has shallow ink,
        # as in the horizontal stroke of 一.
        draw.text((x, center[1]), char, font=font, fill=color, anchor="ls")
        x += advance + spacing


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chinese-font", type=Path, default=Path("C:/Windows/Fonts/simsun.ttc"))
    parser.add_argument("--latin-font", type=Path, default=Path("C:/Windows/Fonts/times.ttf"))
    args = parser.parse_args()
    scale = 2
    width, height = 1920 * scale, 1080 * scale
    yy, xx = np.mgrid[0:1080, 0:1920]
    glow = np.exp(-(((xx - 960) / 800) ** 2 + ((yy - 440) / 580) ** 2))
    background = np.zeros((1080, 1920, 3), dtype=np.float32)
    for channel, (base, light) in enumerate([(5, 7), (9, 11), (15, 14)]):
        background[:, :, channel] = base + light * glow
    grain = np.random.default_rng(20261025).normal(0, 0.45, (1080, 1920, 1))
    background = np.uint8(np.clip(background + grain, 0, 255))
    image = Image.fromarray(background).resize((width, height), Image.Resampling.BICUBIC)
    draw = ImageDraw.Draw(image)
    # Geometry comes from game/web/favicon.svg; only the cinematic palette changes.
    def emblem_points(points):
        return [((960 + (x - 32) * 1.35) * scale, (314 + (y - 32) * 1.35) * scale) for x, y in points]
    outer = emblem_points([(32, 7), (54, 21), (54, 45), (32, 57), (10, 45), (10, 21), (32, 7)])
    draw.line(outer, fill="#8d9ca4", width=round(2.2 * scale), joint="curve")
    draw.polygon(emblem_points([(32, 16), (44, 35), (32, 48), (20, 35)]), fill="#c3b590")
    draw.line(emblem_points([(32, 24), (32, 40)]), fill="#101923", width=round(2.8 * scale))
    title = ImageFont.truetype(str(args.chinese_font), 108 * scale)
    latin = ImageFont.truetype(str(args.latin_font), 28 * scale)
    tagline = ImageFont.truetype(str(args.chinese_font), 34 * scale)
    centered_tracking(draw, "心域防线", title, (960 * scale, 528 * scale), "#e2e4e2", 20 * scale)
    centered_tracking(draw, "MINDREALM BASTION", latin, (960 * scale, 598 * scale), "#9daab2", 6 * scale)
    draw.line((820 * scale, 646 * scale, 1100 * scale, 646 * scale), fill="#3c4851", width=scale)
    centered_tracking(draw, "守住最后一簇清醒", tagline, (960 * scale, 731 * scale), "#c0b49b", 4 * scale)
    image = image.resize((1920, 1080), Image.Resampling.LANCZOS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output)
    preview = image.resize((1280, 720), Image.Resampling.LANCZOS)
    preview.save(args.output.with_suffix(".preview.jpg"), quality=88, optimize=True)
    print(args.output)


if __name__ == "__main__":
    main()
