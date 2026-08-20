#!/usr/bin/env python3
"""Generate the Jotara app icon and its appearance variants.

The mark is a square plus a quarter annulus. Because that shape carries
more weight on one side than the other, centring its *bounding box* --
which is what the first icon did -- leaves it visually off. The area
centroid is measured here and the mark is nudged so the centroid, not
the box, lands on the middle of the tile.

Three renderings, because iOS 18 and later asks for all three and
derives ugly ones if you ship only the default:

  default  plum tile, coral mark. The brand icon.
  dark     transparent tile, coral mark. The system paints its own dark
           material behind it, so the ground is removed rather than
           redrawn.
  tinted   flat light-grey mark on transparent. The system maps
           luminance onto the user's tint, so this is designed in
           brightness, not colour.
"""

from PIL import Image, ImageDraw

SIZE = 1024
SS = 8                      # supersample; Pillow shapes have no AA of their own
OUT = "ios/App/App/Assets.xcassets/AppIcon.appiconset"

PLUM = (36, 26, 34)         # #241A22
CORAL = (244, 120, 92)      # #F4785C
TINT_GREY = (235, 235, 235)

MARK_W, MARK_H = 68.02, 102.03
MARK_SCALE = 0.56           # mark height as a fraction of the tile


def mark_mask(size, scale=MARK_SCALE, optical=True):
    """Alpha mask of the mark, optically centred, antialiased."""
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)

    h = big * scale
    unit = h / MARK_H
    w = MARK_W * unit
    x0 = (big - w) / 2
    y0 = (big - h) / 2

    # The square, top-left of the mark's box.
    s = 34.01 * unit
    d.rectangle([x0, y0, x0 + s, y0 + s], fill=255)

    # The quarter annulus, centred on the square's bottom-left corner and
    # sweeping east to south. Pillow has no annulus, so the inner disc is
    # punched back out of the outer pieslice.
    cx, cy = x0, y0 + s
    outer, inner = 68.02 * unit, 34.01 * unit
    d.pieslice([cx - outer, cy - outer, cx + outer, cy + outer], 0, 90, fill=255)
    d.pieslice([cx - inner, cy - inner, cx + inner, cy + inner], 0, 90, fill=0)

    m = m.resize((size, size), Image.LANCZOS)
    if not optical:
        return m

    # Weight-balance the mark: find where its mass actually sits and move
    # it so that point, rather than the bounding box, is centred.
    px = m.load()
    tot = sx = sy = 0.0
    for y in range(size):
        for x in range(size):
            a = px[x, y]
            if a:
                tot += a
                sx += x * a
                sy += y * a
    if not tot:
        return m
    dx = round(size / 2 - sx / tot)
    dy = round(size / 2 - sy / tot)
    shifted = Image.new("L", (size, size), 0)
    shifted.paste(m, (dx, dy))
    return shifted


def main():
    mask = mark_mask(SIZE)

    # Default: coral mark on a solid plum tile.
    light = Image.new("RGB", (SIZE, SIZE), PLUM)
    coral = Image.new("RGB", (SIZE, SIZE), CORAL)
    light.paste(coral, (0, 0), mask)
    light.save(f"{OUT}/AppIcon-512@2x.png")

    # Dark: same mark, no ground -- the system supplies that.
    dark = Image.new("RGBA", (SIZE, SIZE), CORAL + (0,))
    dark.putalpha(mask)
    dark.save(f"{OUT}/AppIcon-dark.png")

    # Tinted: luminance only.
    tinted = Image.new("RGBA", (SIZE, SIZE), TINT_GREY + (0,))
    tinted.putalpha(mask)
    tinted.save(f"{OUT}/AppIcon-tinted.png")

    print("wrote default (plum/coral), dark and tinted")


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------
# The same mark, everywhere else it appears. Kept in this one file so the
# icon can never drift between platforms: one source, one centroid
# correction, three targets.
# ---------------------------------------------------------------------

WEB_OUT = "icons"
AND_RES = "android/app/src/main/res"
# Android draws adaptive icons then crops to a mask, so the foreground
# must live inside the middle ~66% or the mark loses its edges on the
# rounder launcher shapes.
ANDROID_SAFE_SCALE = MARK_SCALE * 0.66
ANDROID_DENSITIES = {
    "mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432,
}


def plum_tile(size, mask):
    im = Image.new("RGB", (size, size), PLUM)
    im.paste(Image.new("RGB", (size, size), CORAL), (0, 0), mask)
    return im


def write_web():
    for px, name in ((192, "icon-192.png"), (512, "icon-512.png"),
                     (180, "apple-touch-icon.png")):
        m = mark_mask(px)
        plum_tile(px, m).save(f"{WEB_OUT}/{name}")
    # Maskable icons get cropped to a circle by some launchers, so the
    # mark is pulled in well clear of the corners.
    m = mark_mask(512, scale=MARK_SCALE * 0.62)
    plum_tile(512, m).save(f"{WEB_OUT}/icon-maskable-512.png")
    print("wrote web icons")


def write_android():
    for d, px in ANDROID_DENSITIES.items():
        m = mark_mask(px, scale=ANDROID_SAFE_SCALE)
        # Foreground layer: coral mark on transparency. The plum ground is
        # supplied by ic_launcher_background so the system can move the
        # two layers independently.
        fg = Image.new("RGBA", (px, px), CORAL + (0,))
        fg.putalpha(m)
        fg.save(f"{AND_RES}/mipmap-{d}/ic_launcher_foreground.png")
        # Legacy square/round icons for launchers predating adaptive.
        legacy = plum_tile(px, mark_mask(px))
        legacy.save(f"{AND_RES}/mipmap-{d}/ic_launcher.png")
        legacy.save(f"{AND_RES}/mipmap-{d}/ic_launcher_round.png")
    print("wrote android icons")
