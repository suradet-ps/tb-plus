#!/usr/bin/env python3
"""
Generate all Tauri icon sizes from the TB Plus logo.
Run from the src-tauri/icons/ directory:
    python3 generate_icons.py
"""

import io
import os
import shutil
import struct
import subprocess
import sys

try:
    import cairosvg
except ImportError:
    sys.exit("cairosvg not found. Run: pip3 install cairosvg")

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow not found. Run: pip3 install Pillow")

# ── SVG source (transparent background, no bg rect) ──────────────────────────

SVG = b"""<svg width="200" height="200" viewBox="5 9 14 11" xmlns="http://www.w3.org/2000/svg">
  <path d="M10.5 9.4h-0.2C7.4 9.4 5 11.8 5 14.8c0 3 2.2 5.3 5.5 5.3 1 0 1-1 1-2v-8c0-1 0-1-1-1z" fill="#f6f5f4"/>
  <path d="M13.5 9.4h0.2c2.9 0 5.3 2.4 5.3 5.4 0 3-2.2 5.3-5.5 5.3-1 0-1-1-1-2v-8c0-1 0-1 1-1z" fill="#f6f5f4"/>
  <path d="M10.5 9h-0.2C7.4 9 5 11.4 5 14.4c0 3.3 2.2 5.6 5.5 5.6 1 0 1-1 1-2v-8c0-1 0-1-1-1z"
        fill="#2a9d99" stroke="#238582" stroke-width="0.1"/>
  <path d="M13.5 9h0.2c2.9 0 5.3 2.4 5.3 5.4 0 3.3-2.2 5.6-5.5 5.6-1 0-1-1-1-2v-8c0-1 0-1 1-1z"
        fill="#0075de" stroke="#005bab" stroke-width="0.1" fill-opacity="0.9"/>
  <text x="8.1" y="15.8"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="800"
        font-size="4"
        fill="#ffffff"
        text-anchor="middle">T</text>
  <text x="15.9" y="15.8"
        font-family="system-ui, -apple-system, sans-serif"
        font-weight="800"
        font-size="4"
        fill="#ffffff"
        text-anchor="middle">B</text>
  <path d="M10.5 9.2h-0.2C7.4 9.2 5.2 11.3 5.2 14.3" stroke="#ffffff" stroke-width="0.15" fill="none" stroke-opacity="0.4"/>
  <path d="M13.5 9.2h0.2c2.9 0 5.1 2.3 5.1 5.3" stroke="#ffffff" stroke-width="0.15" fill="none" stroke-opacity="0.4"/>
</svg>"""

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def svg_to_png(size: int) -> Image.Image:
    """Render SVG at the given pixel size and return a Pillow Image."""
    png_bytes = cairosvg.svg2png(
        bytestring=SVG,
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def save_png(img: Image.Image, filename: str) -> None:
    path = os.path.join(SCRIPT_DIR, filename)
    img.save(path, "PNG")
    print(f"  wrote {filename}  ({img.width}x{img.height})")


def build_flat_pngs() -> dict[int, Image.Image]:
    """Generate and save the flat PNG files required by tauri.conf.json."""
    needed = {32, 128, 256}
    images: dict[int, Image.Image] = {}
    print("\n── PNG files ────────────────────────────────")
    for size in sorted(needed):
        img = svg_to_png(size)
        images[size] = img
    save_png(images[32], "32x32.png")
    save_png(images[128], "128x128.png")
    save_png(images[256], "128x128@2x.png")
    return images


def build_icns(images: dict[int, Image.Image]) -> None:
    """Build icon.icns using macOS iconutil."""
    if shutil.which("iconutil") is None:
        print("\n  [skip] iconutil not found — skipping icon.icns")
        return

    print("\n── icon.icns ─────────────────────────────────")
    iconset_dir = os.path.join(SCRIPT_DIR, "AppIcon.iconset")
    os.makedirs(iconset_dir, exist_ok=True)

    # macOS iconset naming convention
    slots: list[tuple[int, str]] = [
        (16,   "icon_16x16.png"),
        (32,   "icon_16x16@2x.png"),
        (32,   "icon_32x32.png"),
        (64,   "icon_32x32@2x.png"),
        (128,  "icon_128x128.png"),
        (256,  "icon_128x128@2x.png"),
        (256,  "icon_256x256.png"),
        (512,  "icon_256x256@2x.png"),
        (512,  "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    # Build any sizes not already rendered
    all_sizes = {s for s, _ in slots}
    for size in sorted(all_sizes):
        if size not in images:
            images[size] = svg_to_png(size)

    for size, name in slots:
        dest = os.path.join(iconset_dir, name)
        images[size].save(dest, "PNG")
        print(f"  {name}  ({size}x{size})")

    out_icns = os.path.join(SCRIPT_DIR, "icon.icns")
    result = subprocess.run(
        ["iconutil", "-c", "icns", iconset_dir, "-o", out_icns],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"  wrote icon.icns")
    else:
        print(f"  [error] iconutil: {result.stderr.strip()}")

    shutil.rmtree(iconset_dir)


def build_ico(images: dict[int, Image.Image]) -> None:
    """Build icon.ico (Windows) by writing the ICO binary format directly.

    Modern ICO files support embedded PNG chunks (Vista+), so each size is
    stored as a raw PNG blob — compatible with Windows 7+ and all major
    browsers/tools. We bypass Pillow's ICO writer which only saves one size.

    ICO binary layout:
        6-byte ICONDIR header
        count × 16-byte ICONDIRENTRY directory
        PNG payload for every entry (in order)
    """
    print("\n── icon.ico ──────────────────────────────────")
    ico_sizes = [16, 32, 48, 64, 128, 256]

    # Encode every size as a PNG blob.
    png_blobs: list[bytes] = []
    for size in ico_sizes:
        if size not in images:
            images[size] = svg_to_png(size)
        buf = io.BytesIO()
        images[size].convert("RGBA").resize(
            (size, size), Image.LANCZOS
        ).save(buf, format="PNG")
        png_blobs.append(buf.getvalue())

    count = len(ico_sizes)
    # Payload starts right after the fixed-size header + directory.
    data_offset = 6 + count * 16

    # ICONDIR: reserved=0, type=1 (icon), count
    header = struct.pack("<HHH", 0, 1, count)

    directory = b""
    current_offset = data_offset
    for size, blob in zip(ico_sizes, png_blobs):
        # Per ICO spec: width/height byte of 0 encodes 256.
        w = 0 if size == 256 else size
        h = 0 if size == 256 else size
        directory += struct.pack(
            "<BBBBHHII",
            w, h,            # bWidth, bHeight
            0,               # bColorCount  (0 = 256+ colours)
            0,               # bReserved
            1,               # wPlanes
            32,              # wBitCount (RGBA)
            len(blob),       # dwBytesInRes
            current_offset,  # dwImageOffset
        )
        current_offset += len(blob)

    out_ico = os.path.join(SCRIPT_DIR, "icon.ico")
    with open(out_ico, "wb") as f:
        f.write(header)
        f.write(directory)
        for blob in png_blobs:
            f.write(blob)

    total_bytes = 6 + count * 16 + sum(len(b) for b in png_blobs)
    print(
        f"  wrote icon.ico  "
        f"(sizes: {ico_sizes}, "
        f"{count} images, "
        f"{total_bytes:,} bytes)"
    )


def main() -> None:
    print("TB Plus — icon generator")
    print(f"output dir: {SCRIPT_DIR}")

    images = build_flat_pngs()
    build_icns(images)
    build_ico(images)

    print("\n✓ done\n")


if __name__ == "__main__":
    main()