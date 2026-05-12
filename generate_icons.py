import struct, zlib, os

def make_png(size):
    # Google Drive green background with white folder icon
    bg = (52, 168, 83)    # Drive green #34a853
    fg = (255, 255, 255)  # white
    pad = 0.10
    rr  = 0.16

    def in_rounded_rect(nx, ny):
        if nx < pad or nx > 1-pad or ny < pad or ny > 1-pad:
            return False
        corners = [(pad+rr, pad+rr), (1-pad-rr, pad+rr),
                   (pad+rr, 1-pad-rr), (1-pad-rr, 1-pad-rr)]
        for cx, cy in corners:
            if nx < pad+rr and nx <= cx and ny < pad+rr and ny <= cy:
                return (nx-cx)**2+(ny-cy)**2 <= rr**2
            if nx > 1-pad-rr and nx >= cx and ny < pad+rr and ny <= cy:
                return (nx-cx)**2+(ny-cy)**2 <= rr**2
            if nx < pad+rr and nx <= cx and ny > 1-pad-rr and ny >= cy:
                return (nx-cx)**2+(ny-cy)**2 <= rr**2
            if nx > 1-pad-rr and nx >= cx and ny > 1-pad-rr and ny >= cy:
                return (nx-cx)**2+(ny-cy)**2 <= rr**2
        return True

    def in_folder(nx, ny):
        # Folder body: rect from (0.15, 0.42) to (0.85, 0.80)
        body = 0.15 <= nx <= 0.85 and 0.40 <= ny <= 0.80
        # Folder tab: small rect at top-left (0.15, 0.30) to (0.45, 0.42)
        tab  = 0.15 <= nx <= 0.45 and 0.28 <= ny <= 0.41
        # Rounded tab top corners
        tab_rr = 0.06
        if tab:
            # top-right corner of tab
            tcx, tcy = 0.45 - tab_rr, 0.28 + tab_rr
            if nx > 0.45 - tab_rr and ny < 0.28 + tab_rr:
                return (nx - tcx)**2 + (ny - tcy)**2 <= tab_rr**2
            return True
        return body

    data = []
    for y in range(size):
        row = [0]
        ny = y / size
        for x in range(size):
            nx = x / size
            if in_rounded_rect(nx, ny):
                row += list(fg if in_folder(nx, ny) else bg) + [255]
            else:
                row += [0, 0, 0, 0]
        data.append(bytes(row))

    def chunk(n, d):
        c = n + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    p  = b'\x89PNG\r\n\x1a\n'
    p += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    p += chunk(b'IDAT', zlib.compress(b''.join(data), 9))
    p += chunk(b'IEND', b'')
    return p

os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('icons', exist_ok=True)
for s in [16, 48, 128]:
    with open(f'icons/icon{s}.png', 'wb') as f:
        f.write(make_png(s))
    print(f'icons/icon{s}.png ✓')
print('完成！')
