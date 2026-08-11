"""Restore the mascot's orange beak after chroma-key extraction."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops


def channel_mask(channel: Image.Image, lower: int, upper: int) -> Image.Image:
    return channel.point(lambda value: 255 if lower <= value <= upper else 0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--alpha", type=Path, required=True)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    alpha = Image.open(args.alpha).convert("RGBA")
    red, green, blue, _ = source.split()
    orange = ImageChops.multiply(channel_mask(red, 215, 255), channel_mask(green, 70, 210))
    orange = ImageChops.multiply(orange, channel_mask(blue, 0, 100))
    alpha.paste(source, mask=orange)
    alpha.save(args.alpha, optimize=True)
    print(f"Restored orange accent in {args.alpha}")


if __name__ == "__main__":
    main()
