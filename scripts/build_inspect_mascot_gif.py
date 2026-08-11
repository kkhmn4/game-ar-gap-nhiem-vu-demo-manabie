"""Build a stable inspection animation from one approved mascot master."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


CANVAS_SIZE = (460, 460)
POSES = (
    (0.98, -1.2, -3, 0),
    (1.00, 0.8, 3, -4),
    (1.015, -0.5, -2, -8),
    (1.02, 1.0, 3, -10),
    (1.00, 0.0, 0, -3),
)


def add_insight_sparkle(frame: Image.Image) -> None:
    center = (414, 48)
    draw = ImageDraw.Draw(frame)
    x, y = center
    draw.polygon(((x, y - 19), (x + 6, y - 6), (x + 19, y), (x + 6, y + 6), (x, y + 19), (x - 6, y + 6), (x - 19, y), (x - 6, y - 6)), fill=(104, 236, 255, 245))
    draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(236, 255, 255, 255))


def build_frames(master_path: Path, frames_dir: Path) -> list[Image.Image]:
    master = Image.open(master_path).convert("RGBA")
    bounds = master.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Mascot master has no visible subject")
    subject = master.crop(bounds)
    base_scale = min(394 / subject.width, 402 / subject.height)
    frames_dir.mkdir(parents=True, exist_ok=True)
    frames: list[Image.Image] = []

    for index, (scale, angle, offset_x, offset_y) in enumerate(POSES):
        posed = subject.resize(
            (round(subject.width * base_scale * scale), round(subject.height * base_scale * scale)),
            Image.Resampling.LANCZOS,
        )
        posed = posed.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
        frame = Image.new("RGBA", CANVAS_SIZE)
        x = round((CANVAS_SIZE[0] - posed.width) / 2) + offset_x
        y = CANVAS_SIZE[1] - 18 - posed.height + offset_y
        frame.alpha_composite(posed, (x, y))
        if index == 3:
            add_insight_sparkle(frame)
        frame.save(frames_dir / f"inspect-mascot-{index + 1:02d}.png", optimize=True)
        frames.append(frame)
    return frames


def to_gif_frame(frame: Image.Image) -> Image.Image:
    paletted = frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    transparent = frame.getchannel("A").point(lambda alpha: 255 if alpha < 16 else 0)
    paletted.paste(255, mask=transparent)
    paletted.info["transparency"] = 255
    return paletted


def build_gif(frames: list[Image.Image], output: Path) -> None:
    order = (0, 1, 2, 3, 4, 3, 2, 1)
    durations = (480, 180, 180, 440, 280, 180, 180, 180)
    sequence = [to_gif_frame(frames[index]) for index in order]
    output.parent.mkdir(parents=True, exist_ok=True)
    sequence[0].save(
        output,
        save_all=True,
        append_images=sequence[1:],
        duration=durations,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    frames = build_frames(args.master, args.frames_dir)
    build_gif(frames, args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
