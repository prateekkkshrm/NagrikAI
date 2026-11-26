from pathlib import Path
from PIL import Image, ImageOps
import shutil
from datetime import datetime

ROOT = Path("android/app/src/main/res")
SOURCE = Path(r"C:\Users\prate\Downloads\N.png")
BG = (8, 13, 18, 255)

if not SOURCE.exists():
    raise FileNotFoundError(f"Logo not found: {SOURCE}")

logo = Image.open(SOURCE).convert("RGBA")
bbox = logo.getchannel("A").getbbox()
if bbox:
    logo = logo.crop(bbox)

backup = Path("android") / f"launcher-icon-backup-{datetime.now():%Y%m%d-%H%M%S}"

densities = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}

def save_image(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        backup_path = backup / path.relative_to(Path("android"))
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, backup_path)

    image.save(path, "PNG", optimize=True)
    print("Created:", path)

for density, scale in densities.items():
    # Standard launcher icon
    size = round(48 * scale)
    canvas = Image.new("RGBA", (size, size), BG)
    mark = ImageOps.contain(
        logo,
        (round(size * 0.70), round(size * 0.70)),
        method=Image.Resampling.LANCZOS
    )
    canvas.alpha_composite(
        mark,
        ((size - mark.width) // 2, (size - mark.height) // 2)
    )

    save_image(ROOT / f"mipmap-{density}/ic_launcher.png", canvas)
    save_image(ROOT / f"mipmap-{density}/ic_launcher_round.png", canvas)

    # Transparent adaptive foreground, with Android safe-zone padding
    adaptive_size = round(108 * scale)
    foreground = Image.new("RGBA", (adaptive_size, adaptive_size), (0, 0, 0, 0))

    mark = ImageOps.contain(
        logo,
        (round(adaptive_size * 0.56), round(adaptive_size * 0.56)),
        method=Image.Resampling.LANCZOS
    )

    foreground.alpha_composite(
        mark,
        (
            (adaptive_size - mark.width) // 2,
            (adaptive_size - mark.height) // 2
        )
    )

    save_image(
        ROOT / f"mipmap-{density}/ic_launcher_foreground.png",
        foreground
    )

# Set adaptive icon background to NagrikAI navy
color_file = ROOT / "values/ic_launcher_background.xml"
color_file.parent.mkdir(parents=True, exist_ok=True)

if color_file.exists():
    backup_path = backup / color_file.relative_to(Path("android"))
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(color_file, backup_path)

color_file.write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<resources>\n'
    '    <color name="ic_launcher_background">#080D12</color>\n'
    '</resources>\n',
    encoding="utf-8"
)

print("\nNagrikAI launcher icons generated successfully!")
print("Backup location:", backup)
