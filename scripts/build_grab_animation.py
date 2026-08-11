"""Repair the difficult chroma-key frame and build the grab tutorial animation."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def repair_magenta_key(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGBA")
    repaired = []
    for red, green, blue, _ in image.get_flattened_data():
        # The subject contains warm skin and cyan/blue, while the key is magenta.
        # Using channel gates avoids erasing warm skin as a generic hue-distance
        # matte did on this one intermediate frame.
        key_strength = min(red, blue) - green
        if red > 175 and blue > 145 and green < 145 and key_strength > 55:
            alpha = max(0, min(255, int(255 - (key_strength - 55) * 4.6)))
        else:
            alpha = 255
        repaired.append((red, green, blue, alpha))
    image.putdata(repaired)
    image.save(output, optimize=True)


def validate_alpha(frame: Image.Image, name: str) -> None:
    if frame.mode != "RGBA":
        raise ValueError(f"{name} is not RGBA")
    alpha = frame.getchannel("A")
    width, height = frame.size
    corners = [alpha.getpixel((0, 0)), alpha.getpixel((width - 1, 0)), alpha.getpixel((0, height - 1)), alpha.getpixel((width - 1, height - 1))]
    if max(corners) > 24:
        raise ValueError(f"{name} has opaque corners: {corners}")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError(f"{name} contains no visible subject")


def build_animation(frames_dir: Path, output: Path) -> None:
    source_frames = []
    for index in range(1, 6):
        path = frames_dir / f"grab-frame-{index:02d}.png"
        frame = Image.open(path).convert("RGBA")
        validate_alpha(frame, path.name)
        source_frames.append(frame)

    bounds = [frame.getchannel("A").getbbox() for frame in source_frames]
    left = max(0, min(bound[0] for bound in bounds if bound) - 28)
    top = max(0, min(bound[1] for bound in bounds if bound) - 28)
    right = min(source_frames[0].width, max(bound[2] for bound in bounds if bound) + 28)
    bottom = min(source_frames[0].height, max(bound[3] for bound in bounds if bound) + 28)
    side = max(right - left, bottom - top)
    center_x, center_y = (left + right) // 2, (top + bottom) // 2
    square = (
        max(0, center_x - side // 2),
        max(0, center_y - side // 2),
        min(source_frames[0].width, center_x + (side + 1) // 2),
        min(source_frames[0].height, center_y + (side + 1) // 2),
    )
    source_frames = [frame.crop(square).resize((480, 480), Image.Resampling.LANCZOS) for frame in source_frames]

    # Five authored poses, then a short reverse path for a seamless loop.
    sequence = source_frames + [source_frames[3], source_frames[2], source_frames[1]]
    durations = [280, 180, 180, 300, 620, 180, 170, 240]
    sequence[0].save(
        output,
        save_all=True,
        append_images=sequence[1:],
        duration=durations,
        loop=0,
        lossless=True,
        method=6,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--repair-source", type=Path)
    args = parser.parse_args()

    if args.repair_source:
        repair_magenta_key(args.repair_source, args.frames_dir / "grab-frame-03.png")
    build_animation(args.frames_dir, args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
