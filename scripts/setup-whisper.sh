#!/usr/bin/env bash
# Build whisper.cpp locally and stage the CLI binary into ./vendor/whisper.
# No network needed at runtime — this is a one-time build step.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor"
SRC="$VENDOR/whisper.cpp"
OUT="$VENDOR/whisper"

mkdir -p "$VENDOR" "$OUT"

if ! command -v cmake >/dev/null 2>&1; then
  echo "cmake not found. Install with: brew install cmake"; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "WARNING: ffmpeg not found — recording will fail. Install with: brew install ffmpeg"
fi

if [ ! -d "$SRC" ]; then
  echo "Cloning whisper.cpp…"
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$SRC"
fi

echo "Building whisper.cpp (Metal-accelerated on Apple Silicon)…"
cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$SRC/build" -j --config Release

# whisper.cpp installs the CLI as build/bin/whisper-cli (older builds: ./main)
BIN=""
for c in "$SRC/build/bin/whisper-cli" "$SRC/build/bin/main" "$SRC/build/main"; do
  [ -f "$c" ] && BIN="$c" && break
done
[ -z "$BIN" ] && { echo "Could not locate built whisper-cli"; exit 1; }

cp "$BIN" "$OUT/whisper-cli"
# Copy any dynamic libs it needs (Metal shaders / ggml dylibs) next to the binary.
find "$SRC/build" -name '*.dylib' -exec cp {} "$OUT/" \; 2>/dev/null || true
find "$SRC/build" -name '*.metal' -exec cp {} "$OUT/" \; 2>/dev/null || true
find "$SRC/build" -name '*ggml*.bin' -exec cp {} "$OUT/" \; 2>/dev/null || true

chmod +x "$OUT/whisper-cli"
if command -v install_name_tool >/dev/null 2>&1; then
  install_name_tool -add_rpath @executable_path "$OUT/whisper-cli" 2>/dev/null || true
fi
echo "whisper-cli staged at: $OUT/whisper-cli"
