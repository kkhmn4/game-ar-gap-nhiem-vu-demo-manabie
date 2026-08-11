"""Build stable, smooth popup mascot GIFs from approved single-image masters."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


CANVAS_SIZE = (460, 460)
FRAME_COUNT = 20
FRAME_DURATION_MS = 120


def prepare_subject(master_path: Path, max_width: int, max_height: int) -> Image.Image:
    master = Image.open(master_path).convert("RGBA")
    bounds = master.getchannel("A").getbbox()
    if not bounds:
        raise ValueError(f"No visible mascot in {master_path}")
    subject = master.crop(bounds)
    scale = min(max_width / subject.width, max_height / subject.height)
    return subject.resize(
        (round(subject.width * scale), round(subject.height * scale)),
        Image.Resampling.LANCZOS,
    )


def place_subject(subject: Image.Image, phase: float, *, welcome: bool) -> Image.Image:
    if welcome:
        lift = round(-4 * (0.5 - 0.5 * math.cos(phase)))
        scale = 1 + 0.012 * (0.5 - 0.5 * math.cos(phase))
        angle = 0.45 * math.sin(phase)
    else:
        lift = round(-2.5 * math.sin(phase) ** 2)
        scale = 1 + 0.005 * math.sin(phase) ** 2
        angle = 0.16 * math.sin(phase)

    posed = subject.resize(
        (round(subject.width * scale), round(subject.height * scale)),
        Image.Resampling.LANCZOS,
    ).rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    frame = Image.new("RGBA", CANVAS_SIZE)
    x = round((CANVAS_SIZE[0] - posed.width) / 2)
    y = CANVAS_SIZE[1] - 14 - posed.height + lift
    frame.alpha_composite(posed, (x, y))
    return frame


def diamond(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, alpha: int) -> None:
    x, y = center
    draw.polygon(
        ((x, y - radius), (x + radius // 3, y - radius // 3), (x + radius, y),
         (x + radius // 3, y + radius // 3), (x, y + radius),
         (x - radius // 3, y + radius // 3), (x - radius, y),
         (x - radius // 3, y - radius // 3)),
        fill=(103, 236, 255, alpha),
    )


def add_welcome_accents(frame: Image.Image, phase: float) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    pulse = max(0.0, math.sin(phase))
    pulse_two = max(0.0, math.sin(phase - 0.75))
    if pulse > 0.04:
        diamond(draw, (67, 167), 14, round(225 * pulse))
    if pulse_two > 0.04:
        diamond(draw, (104, 128), 8, round(190 * pulse_two))
    dot_alpha = round(150 * max(0.0, math.sin(phase - 1.25)))
    if dot_alpha:
        draw.ellipse((44, 207, 52, 215), fill=(1, 201, 141, dot_alpha))


def add_lens_scan(frame: Image.Image, phase: float) -> None:
    # The approved master always places the magnifying lens in this region.
    lens_box = (281, 226, 368, 313)
    lens_mask = Image.new("L", CANVAS_SIZE)
    ImageDraw.Draw(lens_mask).ellipse(lens_box, fill=255)

    sweep = Image.new("RGBA", CANVAS_SIZE)
    sweep_draw = ImageDraw.Draw(sweep, "RGBA")
    progress = (phase % (2 * math.pi)) / (2 * math.pi)
    x = round(255 + progress * 155)
    sweep_draw.polygon(
        ((x - 22, 218), (x + 3, 218), (x - 30, 321), (x - 55, 321)),
        fill=(238, 255, 255, 118),
    )
    sweep.putalpha(Image.composite(sweep.getchannel("A"), Image.new("L", CANVAS_SIZE), lens_mask))
    frame.alpha_composite(sweep)

    draw = ImageDraw.Draw(frame, "RGBA")
    pulse = max(0.0, math.sin(phase - 0.45))
    if pulse > 0.12:
        draw.ellipse((278, 223, 371, 316), outline=(93, 229, 255, round(105 * pulse)), width=2)
        diamond(draw, (371, 224), 9, round(220 * pulse))
    orbit = (phase + math.pi / 2) % (2 * math.pi)
    dot_x = round(325 + math.cos(orbit) * 57)
    dot_y = round(269 + math.sin(orbit) * 57)
    draw.ellipse((dot_x - 3, dot_y - 3, dot_x + 3, dot_y + 3), fill=(1, 201, 141, 190))


def make_palette(frames: list[Image.Image]) -> Image.Image:
    montage = Image.new("RGB", (CANVAS_SIZE[0], CANVAS_SIZE[1] * len(frames)))
    for index, frame in enumerate(frames):
        montage.paste(frame.convert("RGB"), (0, index * CANVAS_SIZE[1]))
    palette = montage.quantize(colors=253, method=Image.Quantize.MEDIANCUT)
    colors = palette.getpalette()
    colors[253 * 3:253 * 3 + 3] = [103, 236, 255]
    colors[254 * 3:254 * 3 + 3] = [250, 155, 46]
    colors[255 * 3:255 * 3 + 3] = [255, 0, 255]
    palette.putpalette(colors)
    return palette


def color_mask(frame: Image.Image, ranges: tuple[tuple[int, int], ...]) -> Image.Image:
    channels = frame.convert("RGB").split()
    masks = [channel.point(lambda value, limits=limits: 255 if limits[0] <= value <= limits[1] else 0)
             for channel, limits in zip(channels, ranges)]
    return ImageChops.multiply(ImageChops.multiply(masks[0], masks[1]), masks[2])


def to_gif_frame(frame: Image.Image, palette: Image.Image) -> Image.Image:
    paletted = frame.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)
    paletted.paste(254, mask=color_mask(frame, ((205, 255), (70, 210), (0, 115))))
    paletted.paste(253, mask=color_mask(frame, ((55, 180), (185, 255), (195, 255))))
    transparent = frame.getchannel("A").point(lambda alpha: 255 if alpha < 18 else 0)
    paletted.paste(255, mask=transparent)
    paletted.info["transparency"] = 255
    return paletted


def save_animation(frames: list[Image.Image], frames_dir: Path, output: Path, prefix: str) -> None:
    frames_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(frames_dir / f"{prefix}-{index + 1:02d}.png", optimize=True)

    palette = make_palette(frames)
    sequence = [to_gif_frame(frame, palette) for frame in frames]
    output.parent.mkdir(parents=True, exist_ok=True)
    sequence[0].save(
        output,
        save_all=True,
        append_images=sequence[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )


def build(master_path: Path, kind: str) -> list[Image.Image]:
    subject = prepare_subject(master_path, 350 if kind == "welcome" else 355, 405)
    frames: list[Image.Image] = []
    for index in range(FRAME_COUNT):
        phase = 2 * math.pi * index / FRAME_COUNT
        frame = place_subject(subject, phase, welcome=kind == "welcome")
        if kind == "welcome":
            add_welcome_accents(frame, phase)
        else:
            add_lens_scan(frame, phase)
        frames.append(frame)
    return frames


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("welcome", "inspect"), required=True)
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    frames = build(args.master, args.kind)
    save_animation(frames, args.frames_dir, args.out, f"mana-{args.kind}")
    print(f"Wrote {args.out} with {len(frames)} smooth frames")


if __name__ == "__main__":
    main()
