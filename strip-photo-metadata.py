"""Remove all metadata (EXIF incl. GPS location, camera info, XMP, comments) from a JPEG.

Usage: python3 strip-photo-metadata.py photo.jpg
Rewrites the file in place. Image pixels are untouched.
"""
import sys

def strip(data: bytes) -> bytes:
    if data[:2] != b"\xff\xd8":
        sys.exit("Not a JPEG file. Please save the photo as photo.jpg (JPEG).")
    out, i = bytearray(b"\xff\xd8"), 2
    while i < len(data):
        if data[i] != 0xFF:
            sys.exit("Unexpected JPEG structure; file left unchanged.")
        marker = data[i + 1]
        if marker == 0xDA:  # start of image data: copy the rest as is
            out += data[i:]
            break
        length = int.from_bytes(data[i + 2:i + 4], "big")
        segment = data[i:i + 2 + length]
        # Drop APP1-APP15 (EXIF, XMP, ...) and COM (comments). Keep APP0 (JFIF) and image tables.
        # APP2 holding an ICC color profile is kept so colors stay correct.
        is_app = 0xE1 <= marker <= 0xEF
        is_icc = marker == 0xE2 and segment[4:16] == b"ICC_PROFILE\x00"
        if not ((is_app and not is_icc) or marker == 0xFE):
            out += segment
        i += 2 + length
    return bytes(out)

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "photo.jpg"
    with open(path, "rb") as f:
        original = f.read()
    cleaned = strip(original)
    with open(path, "wb") as f:
        f.write(cleaned)
    leftover = [k for k in (b"Exif", b"GPS", b"<x:xmpmeta") if k in cleaned[:65536]]
    print(f"Removed {len(original) - len(cleaned)} bytes of metadata from {path}.")
    print("Check: no metadata found." if not leftover else f"Warning: still contains {leftover}")
