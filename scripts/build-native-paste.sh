#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/native/build/Release/paste_key.node"

NODE_BIN="${NODE_BIN:-}"
if [ -z "$NODE_BIN" ]; then
  if [ -x /opt/homebrew/opt/node@20/bin/node ]; then
    NODE_BIN=/opt/homebrew/opt/node@20/bin/node
  else
    NODE_BIN="$(command -v node)"
  fi
fi

NODE_PREFIX="$("$NODE_BIN" -p 'process.execPath.replace(/\/bin\/node$/, "")')"
NODE_INCLUDE="$NODE_PREFIX/include/node"
if [ ! -f "$NODE_INCLUDE/node_api.h" ] && [ -f /opt/homebrew/opt/node@20/include/node/node_api.h ]; then
  NODE_INCLUDE=/opt/homebrew/opt/node@20/include/node
fi
if [ ! -f "$NODE_INCLUDE/node_api.h" ]; then
  echo "Cannot find node_api.h for $NODE_BIN" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
xcrun clang++ \
  -std=c++17 \
  -arch arm64 \
  -dynamiclib \
  -undefined dynamic_lookup \
  -framework ApplicationServices \
  -I "$NODE_INCLUDE" \
  "$ROOT/native/paste_key.mm" \
  -o "$OUT"

chmod 755 "$OUT"
file "$OUT"
