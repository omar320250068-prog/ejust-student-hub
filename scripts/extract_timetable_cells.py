#!/usr/bin/env python3
"""Extract coordinate-tagged cells from the Fall 2026 timetable PDF.

PyMuPDF exposes the table as filled rectangles plus positioned words. This
script preserves that geometry; the deterministic interpretation lives in
`src/lib/timetable-parser.ts` so it can be unit tested without Python.

Usage:
    python scripts/extract_timetable_cells.py <input.pdf> <output.json>
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf


def extract(pdf_path: Path) -> list[dict]:
    doc = pymupdf.open(pdf_path)
    if len(doc) != 1:
        raise ValueError(f"expected one timetable page, found {len(doc)}")
    page = doc[0]
    words = page.get_text("words")
    cells = []

    for drawing in page.get_drawings():
        if drawing["type"] != "f":
            continue
        rect = drawing["rect"]
        # Header starts near y=486; the five-day grid ends near y=6421.
        if rect.y0 < 600 or rect.y1 > 6430 or rect.width <= 20 or rect.height <= 20:
            continue

        cell_words = [
            {
                "text": word[4],
                "x0": round(word[0], 2),
                "y0": round(word[1], 2),
                "x1": round(word[2], 2),
                "y1": round(word[3], 2),
            }
            for word in words
            if rect.x0 - 2 <= (word[0] + word[2]) / 2 <= rect.x1 + 2
            and rect.y0 - 2 <= (word[1] + word[3]) / 2 <= rect.y1 + 2
        ]

        lines = defaultdict(list)
        for word in sorted(cell_words, key=lambda item: (item["y0"], item["x0"])):
            y_line = round(((word["y0"] + word["y1"]) / 2) / 12) * 12
            lines[y_line].append(word["text"])

        cells.append(
            {
                "rect": {
                    "x0": round(rect.x0, 2),
                    "y0": round(rect.y0, 2),
                    "x1": round(rect.x1, 2),
                    "y1": round(rect.y1, 2),
                },
                "words": cell_words,
                "lines": [" ".join(lines[key]) for key in sorted(lines)],
            }
        )

    return cells


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_timetable_cells.py <input.pdf> <output.json>")
    pdf_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    cells = extract(pdf_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(cells, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(cells)} cells to {output_path}")


if __name__ == "__main__":
    main()
