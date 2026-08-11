"""Split the approved Manabie sprite strip and build a transparent looping GIF."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


FRAME_COUNT = 5
CANVAS_SIZE = (460, 460)
SUBJECT_BOX = (404, 398)
BOUNCE_LIFT = (0, 0, 24, 0, 0)


def remove_edge_specks(cell: Image.Image) -> Image.Image:
    """Keep the mascot and meaningful sparkle while dropping seam fragments."""
    rgba = np.array(cell)
    visible = (rgba[:, :, 3] > 16).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(visible, 8)
    keep = np.zeros_like(visible, dtype=bool)
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= 100:
            keep |= labels == label
    rgba[~keep] = 0
    return Image.fromarray(rgba, "RGBA")


def normalized_frames(sprite_path: Path, frames_dir: Path) -> list[Image.Image]:
    sprite = Image.open(sprite_path).convert("RGBA")
    frames_dir.mkdir(parents=True, exist_ok=True)

    cells: list[Image.Image] = []
    bounds: list[tuple[int, int, int, int]] = []
    for index in range(FRAME_COUNT):
        left = round(index * sprite.width / FRAME_COUNT)
        right = round((index + 1) * sprite.width / FRAME_COUNT)
        # Trim the cell seams so a clicker sparkle cannot leak into its neighbor.
        cell = remove_edge_specks(sprite.crop((left + 8, 0, right - 8, sprite.height)))
        subject_bounds = cell.getchannel("A").getbbox()
        if not subject_bounds:
            raise ValueError(f"Frame {index + 1} has no visible mascot")
        cells.append(cell)
        bounds.append(subject_bounds)

    max_width = max(box[2] - box[0] for box in bounds)
    max_height = max(box[3] - box[1] for box in bounds)
    scale = min(SUBJECT_BOX[0] / max_width, SUBJECT_BOX[1] / max_height)

    results: list[Image.Image] = []
    for index, (cell, box) in enumerate(zip(cells, bounds, strict=True)):
        subject = cell.crop(box)
        subject = subject.resize(
            (round(subject.width * scale), round(subject.height * scale)),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", CANVAS_SIZE)
        x = round((CANVAS_SIZE[0] - subject.width) / 2)
        y = CANVAS_SIZE[1] - 22 - subject.height - BOUNCE_LIFT[index]
        canvas.alpha_composite(subject, (x, y))
        canvas.save(frames_dir / f"popup-mascot-{index + 1:02d}.png", optimize=True)
        results.append(canvas)
    return results


def build_gif(frames: list[Image.Image], output: Path) -> None:
    # Five authored poses play forward, then partially reverse for a soft loop.
    order = (0, 1, 2, 3, 4, 3, 2, 1)
    durations = (520, 150, 190, 420, 260, 170, 180, 170)
    sequence = []
    for index in order:
        rgba = frames[index]
        paletted = rgba.convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
        transparent = rgba.getchannel("A").point(lambda alpha: 255 if alpha < 16 else 0)
        paletted.paste(255, mask=transparent)
        paletted.info["transparency"] = 255
        sequence.append(paletted)
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
    parser.add_argument("--sprite", type=Path, required=True)
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    frames = normalized_frames(args.sprite, args.frames_dir)
    build_gif(frames, args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
