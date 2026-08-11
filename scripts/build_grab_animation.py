"""Compose and build the transparent two-finger grab tutorial animation."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageChops


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


def find_colored_bounds(frame: Image.Image, kind: str) -> tuple[int, int, int, int]:
    pixels = frame.get_flattened_data()
    if kind == "mint":
        values = [
            255 if alpha > 80 and green > 165 and green > red * 1.12 and green > blue * 1.03 else 0
            for red, green, blue, alpha in pixels
        ]
    else:
        mint_bounds = find_colored_bounds(frame, "mint")
        values = []
        for index, (red, green, blue, alpha) in enumerate(pixels):
            x = index % frame.width
            inside_orb_lane = frame.width * 0.30 < x < mint_bounds[0] - 12
            values.append(
                255
                if inside_orb_lane and alpha > 80 and blue > 115 and blue > red * 1.18 and green > red * 1.08
                else 0
            )
    mask = Image.new("L", frame.size)
    mask.putdata(values)
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError(f"Could not locate {kind} sprite feature")
    return bounds


def without_box(frame: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    result = frame.copy()
    result.paste((0, 0, 0, 0), box)
    return result


def compose_release_frames(frames_dir: Path) -> None:
    """Derive the last two poses from the same hand/orb art to avoid visual jumps."""
    open_pose = Image.open(frames_dir / "grab-frame-01.png").convert("RGBA")
    drag_pose = Image.open(frames_dir / "grab-frame-03.png").convert("RGBA")

    ring_bounds = find_colored_bounds(drag_pose, "mint")
    ring_box = (
        max(0, ring_bounds[0] - 8),
        max(0, ring_bounds[1] - 8),
        min(drag_pose.width, ring_bounds[2] + 8),
        min(drag_pose.height, ring_bounds[3] + 8),
    )
    ring_layer = Image.new("RGBA", drag_pose.size)
    ring_layer.alpha_composite(drag_pose.crop(ring_box), (ring_box[0], ring_box[1]))
    moving_layer = without_box(drag_pose, ring_box)
    orb_bounds = find_colored_bounds(drag_pose, "orb")
    orb_center = ((orb_bounds[0] + orb_bounds[2]) / 2, (orb_bounds[1] + orb_bounds[3]) / 2)
    ring_center = ((ring_bounds[0] + ring_bounds[2]) / 2, (ring_bounds[1] + ring_bounds[3]) / 2)
    shift = (round(ring_center[0] - orb_center[0]), round(ring_center[1] - orb_center[1]))
    placed_pose = Image.new("RGBA", drag_pose.size)
    placed_pose.alpha_composite(ring_layer)
    placed_pose.alpha_composite(moving_layer, shift)
    placed_pose.save(frames_dir / "grab-frame-04.png", optimize=True)

    open_ring_bounds = find_colored_bounds(open_pose, "mint")
    open_ring_box = (
        max(0, open_ring_bounds[0] - 8),
        max(0, open_ring_bounds[1] - 8),
        min(open_pose.width, open_ring_bounds[2] + 8),
        min(open_pose.height, open_ring_bounds[3] + 8),
    )
    released_pose = without_box(open_pose, open_ring_box)
    open_orb_bounds = find_colored_bounds(open_pose, "orb")
    orb_box = (
        open_orb_bounds[0] - 4,
        open_orb_bounds[1] - 4,
        open_orb_bounds[2] + 4,
        open_orb_bounds[3] + 4,
    )
    orb_cutout = open_pose.crop(orb_box)
    ellipse_mask = Image.new("L", orb_cutout.size)
    ImageDraw.Draw(ellipse_mask).ellipse((0, 0, orb_cutout.width - 1, orb_cutout.height - 1), fill=255)
    orb_cutout.putalpha(ImageChops.multiply(orb_cutout.getchannel("A"), ellipse_mask))
    clear_mask = Image.new("L", open_pose.size)
    ImageDraw.Draw(clear_mask).ellipse(orb_box, fill=255)
    released_alpha = ImageChops.subtract(released_pose.getchannel("A"), clear_mask)
    released_pose.putalpha(released_alpha)

    pulse_layer = Image.new("RGBA", open_pose.size)
    pulse_box = tuple(value + offset for value, offset in zip(open_ring_bounds, (-34, -34, 34, 34)))
    ImageDraw.Draw(pulse_layer).ellipse(pulse_box, outline=(145, 255, 198, 215), width=9)
    final_pose = Image.new("RGBA", open_pose.size)
    final_pose.alpha_composite(pulse_layer)
    final_pose.alpha_composite(open_pose.crop(open_ring_box), (open_ring_box[0], open_ring_box[1]))
    final_pose.alpha_composite(released_pose)
    open_ring_center = (
        (open_ring_bounds[0] + open_ring_bounds[2]) / 2,
        (open_ring_bounds[1] + open_ring_bounds[3]) / 2,
    )
    orb_cutout_center = ((orb_box[0] + orb_box[2]) / 2, (orb_box[1] + orb_box[3]) / 2)
    orb_offset = (
        round(open_ring_center[0] - orb_cutout_center[0] + orb_box[0]),
        round(open_ring_center[1] - orb_cutout_center[1] + orb_box[1]),
    )
    final_pose.alpha_composite(orb_cutout, orb_offset)
    final_pose.save(frames_dir / "grab-frame-05.png", optimize=True)


def align_to_drop_zone(frame: Image.Image) -> Image.Image:
    """Place the mint target at a fixed point while preserving authored motion."""
    mask = Image.new("L", frame.size)
    mask.putdata(
        [
            255 if alpha > 80 and green > 165 and green > red * 1.12 and green > blue * 1.03 else 0
            for red, green, blue, alpha in frame.get_flattened_data()
        ]
    )
    target_bounds = mask.getbbox()
    if not target_bounds:
        raise ValueError("Could not locate the mint drop-zone ring")

    target_center_x = (target_bounds[0] + target_bounds[2]) / 2
    target_center_y = (target_bounds[1] + target_bounds[3]) / 2
    scale = 450 / frame.width
    resized = frame.resize(
        (round(frame.width * scale), round(frame.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (480, 480))
    offset = (
        round(360 - target_center_x * scale),
        round(240 - target_center_y * scale),
    )
    canvas.alpha_composite(resized, offset)
    return canvas


def build_animation(frames_dir: Path, output: Path) -> None:
    compose_release_frames(frames_dir)
    source_frames = []
    for index in range(1, 6):
        path = frames_dir / f"grab-frame-{index:02d}.png"
        frame = Image.open(path).convert("RGBA")
        validate_alpha(frame, path.name)
        source_frames.append(frame)

    source_frames = [align_to_drop_zone(frame) for frame in source_frames]

    # Keep the tutorial semantically one-way: open, pinch, drag, place, release.
    # The final success pose pauses before the loop restarts at the open pose.
    sequence = source_frames
    durations = [360, 240, 260, 300, 900]
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
