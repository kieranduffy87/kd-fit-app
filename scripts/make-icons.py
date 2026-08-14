#!/usr/bin/env python3
"""Generate the iOS app icon appearance variants from the Jotara mark.

iOS 18 and later ask for three renderings of an icon. If you ship only
one, the system derives the other two from it — and for Jotara that goes
badly: the mesh background flattens to grey in tinted mode, and in dark
mode an opaque light slab sits there while every well-behaved icon
recedes.

  light    the mesh ground, off-white mark. Already shipped; left alone.
  dark     transparent ground, mark carrying the brand gradient. The
           system paints its own dark material behind it, so the colour
           has to move into the mark or the brand disappears entirely.
  tinted   transparent ground, greyscale mark. The system reads
           luminance and maps it to the user's chosen tint, so this one
           is designed in brightness rather than colour.

The mark is drawn rather than traced from the SVG: it is a square plus a
quarter annulus, which is two primitives, and drawing it here keeps the
geometry honest at any size. Everything renders at 4x and downsamples,
because Pillow's shape drawing has no antialiasing of its own.
"""

from PIL import Image, ImageDraw

SIZE = 1024
SS = 4  # supersample factor
OUT = "ios/App/App/Assets.xcassets/AppIcon.appiconset"

# Sampled from the shipped light icon so the variants stay on-brand.
CORAL = (221, 114, 90)
MAUVE = (160, 124, 151)

# On the light icon these colours cover the whole tile and the mark is
# cut out of them in off-white. In the dark variant that inverts: the
# colour has to carry the mark itself, against a dark ground the system
# supplies. At mark scale the sampled values read as dusty and flat, so
# they get lifted toward their own hue at full strength — same colours,
# enough luminance to hold the shape at 60pt on a black wallpaper.
CORAL_LIT = (255, 146, 116)
MAUVE_LIT = (208, 166, 200)

# The mark's own proportions, from the source SVG viewBox.
MARK_W, MARK_H = 68.02, 102.03
# Fraction of the canvas the mark occupies vertically, matched to the
# shipped light icon so all three variants sit identically on screen.
MARK_SCALE = 0.522


def mark_mask(size):
    """Alpha mask of the Jotara mark, centred, antialiased."""
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)

    h = big * MARK_SCALE
    unit = h / MARK_H          # one SVG unit in pixels
    w = MARK_W * unit
    x0 = (big - w) / 2         # left edge of the mark's bounding box
    y0 = (big - h) / 2

    # The square: 34.01 x 34.01 at the top left of the box.
    s = 34.01 * unit
    d.rectangle([x0, y0, x0 + s, y0 + s], fill=255)

    # The quarter annulus: centred on the square's bottom-left corner,
    # sweeping from due east round to due south. Outer radius is the
    # full width, inner radius is the square's side — drawing the outer
    # pieslice and then punching the inner one back out is the only way
    # to get a true annulus segment out of Pillow.
    cx, cy = x0, y0 + s
    outer, inner = 68.02 * unit, 34.01 * unit
    d.pieslice([cx - outer, cy - outer, cx + outer, cy + outer], 0, 90, fill=255)
    d.pieslice([cx - inner, cy - inner, cx + inner, cy + inner], 0, 90, fill=0)

    return m.resize((size, size), Image.LANCZOS)


def gradient(size, a, b):
    """Diagonal two-stop gradient, top-left to bottom-right."""
    g = Image.new("RGB", (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return g


def main():
    mask = mark_mask(SIZE)

    # Dark: the brand gradient moves into the mark, because the ground
    # it used to live on is now the system's.
    dark = gradient(SIZE, CORAL_LIT, MAUVE_LIT)
    dark.putalpha(mask)
    dark.save(f"{OUT}/AppIcon-dark.png")

    # Tinted: flat near-white. The system tints by luminance, so a solid
    # bright mark gives the cleanest read across every tint the user can
    # pick; a gradient here would band under some of them.
    tinted = Image.new("RGBA", (SIZE, SIZE), (235, 235, 235, 0))
    tinted.putalpha(mask)
    tinted.save(f"{OUT}/AppIcon-tinted.png")

    print("wrote AppIcon-dark.png and AppIcon-tinted.png")


if __name__ == "__main__":
    main()
