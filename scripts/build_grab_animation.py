"""Compose and build the transparent two-finger grab tutorial animation."""

from __future__ import annotations

import argparse
from pathlib import Path
import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageChops


SPRITE_SCALE = 0.42
CANVAS_SIZE = (900, 440)
START_CENTER = (450, 100)
TARGET_CENTER = (450, 325)


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


def align_for_transfer(frame: Image.Image) -> Image.Image:
    """Remove the temporary ring and align the orb at the top of the game lane."""
    orb_bounds = find_colored_bounds(frame, "orb")
    orb_center_x = (orb_bounds[0] + orb_bounds[2]) / 2
    orb_center_y = (orb_bounds[1] + orb_bounds[3]) / 2

    rgba = np.array(frame)
    red, green, blue, alpha = (rgba[:, :, index] for index in range(4))
    mint = (
        (alpha > 40)
        & (green > 150)
        & (green > red * 1.08)
        & (green > blue * 1.01)
    ).astype(np.uint8) * 255
    mint = cv2.dilate(mint, np.ones((7, 7), np.uint8), iterations=2)
    rgba[mint > 0] = 0
    frame = Image.fromarray(rgba, "RGBA")

    scale = SPRITE_SCALE
    resized = frame.resize(
        (round(frame.width * scale), round(frame.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", CANVAS_SIZE)
    offset = (
        round(START_CENTER[0] - orb_center_x * scale),
        round(START_CENTER[1] - orb_center_y * scale),
    )
    canvas.alpha_composite(resized, offset)
    return canvas


def translated(frame: Image.Image, offset: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", frame.size)
    canvas.alpha_composite(frame, offset)
    return canvas


def smoothstep(progress: float) -> float:
    return progress * progress * (3 - 2 * progress)


def optical_tween(start: Image.Image, end: Image.Image, count: int) -> list[Image.Image]:
    """Morph two transparent poses with forward/backward optical flow."""
    start_rgba = np.array(start, dtype=np.uint8)
    end_rgba = np.array(end, dtype=np.uint8)
    start_gray = cv2.cvtColor(start_rgba, cv2.COLOR_RGBA2GRAY)
    end_gray = cv2.cvtColor(end_rgba, cv2.COLOR_RGBA2GRAY)
    forward = cv2.calcOpticalFlowFarneback(start_gray, end_gray, None, 0.5, 4, 25, 4, 7, 1.5, 0)
    backward = cv2.calcOpticalFlowFarneback(end_gray, start_gray, None, 0.5, 4, 25, 4, 7, 1.5, 0)
    grid_x, grid_y = np.meshgrid(
        np.arange(start.width, dtype=np.float32),
        np.arange(start.height, dtype=np.float32),
    )
    frames = []
    for index in range(1, count + 1):
        progress = index / (count + 1)
        warped_start = cv2.remap(
            start_rgba,
            grid_x - forward[:, :, 0] * progress,
            grid_y - forward[:, :, 1] * progress,
            cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
        )
        warped_end = cv2.remap(
            end_rgba,
            grid_x - backward[:, :, 0] * (1 - progress),
            grid_y - backward[:, :, 1] * (1 - progress),
            cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
        )
        blended = cv2.addWeighted(warped_start, 1 - progress, warped_end, progress, 0)
        frames.append(Image.fromarray(blended, "RGBA"))
    return frames


def write_transparent_video(sequence: list[Image.Image], durations: list[int], output: Path) -> None:
    """Encode a muted-loop-friendly VP9 video that keeps moving in reduced-motion mode."""
    command = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-pix_fmt", "rgba",
        "-s", f"{sequence[0].width}x{sequence[0].height}",
        "-r", "20",
        "-i", "-",
        "-an",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0",
        "-crf", "30",
        "-b:v", "0",
        str(output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert process.stdin is not None
    for frame, duration in zip(sequence, durations):
        raw_frame = np.asarray(frame.convert("RGBA"), dtype=np.uint8).tobytes()
        for _ in range(max(1, round(duration / 50))):
            process.stdin.write(raw_frame)
    process.stdin.close()
    stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"ffmpeg failed with exit code {return_code}:\n{stderr}")


def build_animation(frames_dir: Path, output: Path) -> None:
    compose_release_frames(frames_dir)
    source_frames = []
    for index in range(1, 6):
        path = frames_dir / f"grab-frame-{index:02d}.png"
        frame = Image.open(path).convert("RGBA")
        validate_alpha(frame, path.name)
        source_frames.append(frame)

    aligned_open = align_for_transfer(source_frames[0])
    aligned_pinch = align_for_transfer(source_frames[1])
    drag_offset = (
        TARGET_CENTER[0] - START_CENTER[0],
        TARGET_CENTER[1] - START_CENTER[1],
    )
    placed_open = translated(aligned_open, drag_offset)
    placed_pinch = translated(aligned_pinch, drag_offset)

    # Slow, one-way instructional rhythm: open -> pinch -> drag -> release -> retract.
    sequence = [aligned_open]
    durations = [600]
    pinch_tweens = optical_tween(aligned_open, aligned_pinch, 9)
    sequence.extend(pinch_tweens)
    durations.extend([60] * len(pinch_tweens))
    sequence.append(aligned_pinch)
    durations.append(300)

    for step in range(1, 25):
        progress = smoothstep(step / 24)
        sequence.append(
            translated(
                aligned_pinch,
                (round(drag_offset[0] * progress), round(drag_offset[1] * progress)),
            )
        )
        durations.append(60)
    durations[-1] = 300

    release_tweens = optical_tween(placed_pinch, placed_open, 9)
    sequence.extend(release_tweens)
    durations.extend([60] * len(release_tweens))
    sequence.append(placed_open)
    durations.append(240)

    target_radius = round(max(
        find_colored_bounds(source_frames[0], "orb")[2] - find_colored_bounds(source_frames[0], "orb")[0],
        find_colored_bounds(source_frames[0], "orb")[3] - find_colored_bounds(source_frames[0], "orb")[1],
    ) * SPRITE_SCALE * .54)
    orb_mask = Image.new("L", placed_open.size)
    ImageDraw.Draw(orb_mask).ellipse(
        (
            TARGET_CENTER[0] - target_radius,
            TARGET_CENTER[1] - target_radius,
            TARGET_CENTER[0] + target_radius,
            TARGET_CENTER[1] + target_radius,
        ),
        fill=255,
    )
    orb_layer = placed_open.copy()
    orb_layer.putalpha(ImageChops.multiply(placed_open.getchannel("A"), orb_mask))
    hand_layer = placed_open.copy()
    hand_layer.putalpha(ImageChops.subtract(placed_open.getchannel("A"), orb_mask))
    for step in range(1, 13):
        progress = smoothstep(step / 12)
        retracted = Image.new("RGBA", placed_open.size)
        retracted.alpha_composite(orb_layer)
        retracted.alpha_composite(hand_layer, (round(-115 * progress), round(-92 * progress)))
        sequence.append(retracted)
        durations.append(60)
    durations[-1] = 1000

    transparent = Image.new("RGBA", aligned_open.size)
    for fade_step in range(1, 6):
        sequence.append(Image.blend(sequence[-1], transparent, fade_step / 5))
        durations.append(60)
    sequence.append(transparent)
    durations.append(120)
    sequence[0].save(
        output,
        save_all=True,
        append_images=sequence[1:],
        duration=durations,
        loop=0,
        lossless=False,
        quality=90,
        method=4,
    )
    write_transparent_video(sequence, durations, output.with_suffix(".webm"))


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
