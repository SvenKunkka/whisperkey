#!/usr/bin/env bash
# Download a ggml Whisper model into ./models. Default: small.
# Usage: bash scripts/download-model.sh [tiny|base|small|medium|large-v3|large-v3-turbo]
set -euo pipefail

MODEL="${1:-small}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/models"
mkdir -p "$DEST"

FILE="ggml-${MODEL}.bin"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${FILE}"

if [ -f "$DEST/$FILE" ]; then
  echo "Model already present: $DEST/$FILE"; exit 0
fi

echo "Downloading $FILE …"
if command -v curl >/dev/null 2>&1; then
  curl -L --fail -o "$DEST/$FILE" "$URL"
else
  wget -O "$DEST/$FILE" "$URL"
fi
echo "Saved to $DEST/$FILE"
echo "Tip: for best Chinese+English accuracy, also try: bash scripts/download-model.sh medium"
