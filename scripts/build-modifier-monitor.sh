#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/native/ModifierMonitor.swift"
OUT_DIR="$ROOT/vendor/modifier-monitor"
OUT="$OUT_DIR/ModifierMonitor"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "swiftc not found. Install Xcode command line tools first." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
swiftc "$SRC" -O -framework CoreGraphics -o "$OUT"
chmod +x "$OUT"
echo "ModifierMonitor staged at: $OUT"
