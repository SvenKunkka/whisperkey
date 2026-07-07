#!/usr/bin/env bash
# Optional: copy your installed ffmpeg into vendor/ffmpeg so the packaged .app does
# NOT depend on the user having Homebrew ffmpeg on PATH. Run before `npm run dist`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/vendor/ffmpeg"
mkdir -p "$OUT"

SRC=""
for c in /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg "$(command -v ffmpeg || true)"; do
  [ -n "$c" ] && [ -f "$c" ] && SRC="$c" && break
done
[ -z "$SRC" ] && { echo "ffmpeg not found. brew install ffmpeg first."; exit 1; }

# Resolve symlinks to the real binary.
REAL="$(readlink -f "$SRC" 2>/dev/null || python3 -c "import os,sys;print(os.path.realpath(sys.argv[1]))" "$SRC")"
cp "$REAL" "$OUT/ffmpeg"
chmod +x "$OUT/ffmpeg"
echo "Bundled ffmpeg: $REAL -> $OUT/ffmpeg"
echo "NOTE: Homebrew ffmpeg links many dylibs. If the bundled copy fails to launch,"
echo "install a static build instead (e.g. from https://evermeet.cx/ffmpeg/) and copy it here."
