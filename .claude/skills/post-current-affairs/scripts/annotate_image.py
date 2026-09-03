#!/usr/bin/env python3
"""Draws colour-coded, numbered callouts + a legend onto a source image.

Usage:
    python annotate_image.py --source photo.jpg --points points.json --out annotated.png

points.json is a JSON array of {"text": "...", "dimension": "..."} objects,
3-6 entries, written by the calling agent from an article's own major points.
"dimension" is a short free-form label (e.g. "Constitutional angle",
"Economic impact") chosen fresh per article -- there is no fixed taxonomy.
Each unique dimension gets one colour from a fixed palette, in order of first
appearance, and that mapping is drawn as a legend box on the output image.

There is no object detection here: numbered badges are placed at evenly
spaced positions along the image's right edge (matched to their row in the
side panel), not anchored to specific visual content. The goal is that every
major point is legibly present and correctly coloured -- not that a badge
sits on the exact pixel it describes.
"""

import argparse
import json
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PALETTE = [
    (0xE0, 0x43, 0x3A),  # red
    (0x1F, 0x77, 0xB4),  # blue
    (0x2C, 0xA0, 0x2C),  # green
    (0xE0, 0x8E, 0x1E),  # amber
    (0x94, 0x67, 0xBD),  # purple
    (0x17, 0xBE, 0xCF),  # teal
    (0xD6, 0x27, 0x8B),  # magenta
    (0x7F, 0x7F, 0x00),  # olive
]

PANEL_WIDTH = 460
ROW_HEIGHT = 96
BADGE_RADIUS = 15
MARGIN = 24
MAX_IMAGE_WIDTH = 1400
PANEL_BG = (247, 247, 244)
TEXT_COLOR = (30, 30, 30)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        ["arialbd.ttf", "Arial Bold.ttf"] if bold else ["arial.ttf", "Arial.ttf"]
    ) + [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]


def assign_colors(points: list[dict]) -> dict[str, tuple[int, int, int]]:
    colors: dict[str, tuple[int, int, int]] = {}
    for point in points:
        dimension = point.get("dimension", "General")
        if dimension not in colors:
            colors[dimension] = PALETTE[len(colors) % len(PALETTE)]
    return colors


def annotate(source_path: Path, points: list[dict], out_path: Path) -> None:
    if not points:
        raise ValueError("points.json must contain at least one point.")
    if len(points) > 6:
        raise ValueError("Keep it to at most 6 major points -- more than that stops being legible on one image.")

    image = Image.open(source_path).convert("RGB")
    if image.width > MAX_IMAGE_WIDTH:
        ratio = MAX_IMAGE_WIDTH / image.width
        image = image.resize((MAX_IMAGE_WIDTH, int(image.height * ratio)))

    colors = assign_colors(points)
    legend_rows = len(colors)

    points_area_height = len(points) * ROW_HEIGHT
    legend_height = 48 + legend_rows * 34 + 16
    panel_content_height = points_area_height + legend_height + 40
    canvas_height = max(image.height, panel_content_height)
    canvas_width = image.width + PANEL_WIDTH

    canvas = Image.new("RGB", (canvas_width, canvas_height), PANEL_BG)
    canvas.paste(image, (0, 0))
    draw = ImageDraw.Draw(canvas)

    number_font = load_font(16, bold=True)
    text_font = load_font(16)
    legend_font = load_font(15)
    heading_font = load_font(17, bold=True)

    draw.line([(image.width, 0), (image.width, canvas_height)], fill=(210, 210, 205), width=2)

    panel_text_x = image.width + MARGIN + 40

    for index, point in enumerate(points):
        row_y_center = ROW_HEIGHT * index + ROW_HEIGHT / 2 + MARGIN
        color = colors.get(point.get("dimension", "General"), PALETTE[0])
        badge_x = image.width

        # Badge straddling the image/panel boundary, at this row's y.
        draw.ellipse(
            [
                badge_x - BADGE_RADIUS,
                row_y_center - BADGE_RADIUS,
                badge_x + BADGE_RADIUS,
                row_y_center + BADGE_RADIUS,
            ],
            fill=color,
            outline=(255, 255, 255),
            width=2,
        )
        number = str(index + 1)
        num_w = draw.textlength(number, font=number_font)
        draw.text((badge_x - num_w / 2, row_y_center - 10), number, font=number_font, fill=(255, 255, 255))

        # Leader line from badge to the panel text column.
        draw.line(
            [(badge_x + BADGE_RADIUS, row_y_center), (panel_text_x - 12, row_y_center)],
            fill=color,
            width=2,
        )

        dimension_label = point.get("dimension", "General")
        draw.text((panel_text_x, row_y_center - 30), dimension_label.upper(), font=legend_font, fill=color)

        wrapped = wrap_text(draw, point.get("text", ""), text_font, PANEL_WIDTH - MARGIN * 2 - 40)
        for line_index, line in enumerate(wrapped[:3]):
            draw.text((panel_text_x, row_y_center - 8 + line_index * 20), line, font=text_font, fill=TEXT_COLOR)

    # Legend box beneath the points list.
    legend_top = points_area_height + MARGIN + 20
    draw.text((image.width + MARGIN, legend_top), "COLOUR KEY", font=heading_font, fill=TEXT_COLOR)
    for row_index, (dimension, color) in enumerate(colors.items()):
        swatch_y = legend_top + 40 + row_index * 34
        draw.rectangle(
            [image.width + MARGIN, swatch_y, image.width + MARGIN + 22, swatch_y + 22],
            fill=color,
        )
        wrapped_label = textwrap.shorten(dimension, width=48, placeholder="...")
        draw.text((image.width + MARGIN + 32, swatch_y + 2), wrapped_label, font=legend_font, fill=TEXT_COLOR)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--points", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Source image not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    points = json.loads(args.points.read_text(encoding="utf-8"))
    annotate(args.source, points, args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
