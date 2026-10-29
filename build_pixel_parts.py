/**
 * build_pixel_parts.py
 * 정밀 픽셀 치비 바디(43x68)에 100% 1:1 매칭되는 픽셀 파츠 데이터 생성기
 */
import json

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(r, g, b):
    return f"#{max(0, min(255, int(r))):02x}{max(0, min(255, int(g))):02x}{max(0, min(255, int(b))):02x}"

# Let's verify coordinate bounds
def validate_spans(spans, name):
    for col, rects in spans.items():
        for r in rects:
            x, y, w = r
            if x < 0 or x + w > 44 or y < 0 or y > 68:
                print(f"WARNING [{name}]: out of bounds {r}")

print("Pixel parts builder initialized.")
