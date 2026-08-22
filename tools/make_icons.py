"""Generate the extension PNG icons: a robot head with a red slash.

WXT discovers icons from public/icon/{size}.png and writes them into the
generated manifest, so that is where these land.
"""
import struct, zlib

S = 512  # supersampled canvas, downscaled with a box filter


def blank():
    return [[(0, 0, 0, 0)] * S for _ in range(S)]


def put(px, x, y, color):
    if 0 <= x < S and 0 <= y < S:
        r, g, b, a = color
        if a >= 250:
            px[y][x] = color
        else:  # simple source-over blend
            dr, dg, db, da = px[y][x]
            af = a / 255.0
            px[y][x] = (
                int(r * af + dr * (1 - af)),
                int(g * af + dg * (1 - af)),
                int(b * af + db * (1 - af)),
                max(a, da),
            )


def disc(px, cx, cy, radius, color):
    for y in range(int(cy - radius) - 1, int(cy + radius) + 2):
        for x in range(int(cx - radius) - 1, int(cx + radius) + 2):
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                put(px, x, y, color)


def round_rect(px, x0, y0, x1, y1, radius, color):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            cx = min(max(x, x0 + radius), x1 - radius)
            cy = min(max(y, y0 + radius), y1 - radius)
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
                put(px, x, y, color)


def thick_line(px, x0, y0, x1, y1, width, color):
    dx, dy = x1 - x0, y1 - y0
    length = (dx * dx + dy * dy) ** 0.5
    steps = int(length * 2)
    for i in range(steps + 1):
        t = i / steps
        disc(px, x0 + dx * t, y0 + dy * t, width / 2, color)


def draw():
    px = blank()
    dark = (32, 33, 36, 255)
    white = (232, 234, 237, 255)
    red = (234, 67, 53, 255)

    disc(px, S / 2, S / 2, S * 0.48, dark)

    # antenna
    thick_line(px, S * 0.5, S * 0.30, S * 0.5, S * 0.20, S * 0.035, white)
    disc(px, S * 0.5, S * 0.185, S * 0.045, white)

    # head + eyes
    round_rect(px, S * 0.24, S * 0.30, S * 0.76, S * 0.68, S * 0.11, white)
    round_rect(px, S * 0.35, S * 0.42, S * 0.44, S * 0.51, S * 0.02, dark)
    round_rect(px, S * 0.56, S * 0.42, S * 0.65, S * 0.51, S * 0.02, dark)
    round_rect(px, S * 0.40, S * 0.58, S * 0.60, S * 0.62, S * 0.02, dark)

    # body hint
    round_rect(px, S * 0.30, S * 0.72, S * 0.70, S * 0.80, S * 0.035, white)

    # slash
    thick_line(px, S * 0.17, S * 0.83, S * 0.83, S * 0.17, S * 0.10, dark)
    thick_line(px, S * 0.19, S * 0.81, S * 0.81, S * 0.19, S * 0.062, red)
    return px


def downscale(px, size):
    factor = S // size
    out = []
    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = a = 0
            for sy in range(factor):
                for sx in range(factor):
                    pr, pg, pb, pa = px[y * factor + sy][x * factor + sx]
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            n = factor * factor
            if a:
                row.append((r // a, g // a, b // a, a // n))
            else:
                row.append((0, 0, 0, 0))
        out.append(row)
    return out


def write_png(path, rows):
    size = len(rows)
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBBB", *p) for p in row) for row in rows
    )

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


canvas = draw()
for size in (16, 32, 48, 128):
    write_png("public/icon/%d.png" % size, downscale(canvas, size))
    print("public/icon/%d.png" % size)
