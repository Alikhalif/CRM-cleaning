import sys, numpy as np
from PIL import Image
def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)
a = load(sys.argv[1]); b = load(sys.argv[2])
h = min(a.shape[0], b.shape[0]); w = min(a.shape[1], b.shape[1])
a = a[:h,:w]; b = b[:h,:w]
d = np.abs(a-b).max(axis=2)  # per-pixel max channel diff
tot = h*w
print("size", (w,h))
for thr in (8, 24, 64):
    n = int((d>thr).sum()); print(f"  pixels diff > {thr:3d}: {n:8d}  ({100*n/tot:.3f}%)")
print("  mean abs diff:", round(float(d.mean()),4), " max:", int(d.max()))
# heatmap: amplify
hm = np.zeros((h,w,3), np.uint8)
hm[...,0] = np.clip(d*3,0,255)  # red where different
# overlay faint original for context
base = (a.mean(axis=2)*0.25).astype(np.uint8)
hm[...,1] = np.maximum(hm[...,1], base//2)
hm[...,2] = np.maximum(hm[...,2], base//2)
Image.fromarray(hm).save(sys.argv[3])
print("  heatmap ->", sys.argv[3])
