#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/mac-arm64/WhisperKey.app"
STAGE="$ROOT/dist/local-dmg-stage"
OUT="$ROOT/dist/WhisperKey-1.0.0-arm64-local.dmg"
ZIP_OUT="$ROOT/dist/WhisperKey-1.0.0-arm64-local.zip"

cd "$ROOT"
npm run build:native-paste
npm run build:modifier-monitor
npm run pack

if [ ! -d "$APP" ]; then
  echo "Missing built app: $APP" >&2
  exit 1
fi

codesign --force --deep --sign - --entitlements "$ROOT/build/entitlements.mac.plist" "$APP"
codesign --verify --deep --strict --verbose=1 "$APP"

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/WhisperKey.app"
ln -s /Applications "$STAGE/Applications"

rm -f "$OUT"
if hdiutil create -volname WhisperKey -srcfolder "$STAGE" -ov -format UDZO "$OUT" && hdiutil verify "$OUT"; then
  if [ -d /Users/keychron/Downloads ]; then
    cp "$OUT" /Users/keychron/Downloads/WhisperKey-1.0.0-arm64-local.dmg
  fi
  echo "Created: $OUT"
else
  echo "hdiutil failed; creating ZIP fallback instead." >&2
  rm -f "$ZIP_OUT"
  (cd "$STAGE" && ditto -c -k --sequesterRsrc --keepParent WhisperKey.app "$ZIP_OUT")
  if [ -d /Users/keychron/Downloads ]; then
    rm -f /Users/keychron/Downloads/WhisperKey-1.0.0-arm64-local.dmg
    cp "$ZIP_OUT" /Users/keychron/Downloads/WhisperKey-1.0.0-arm64-local.zip
  fi
  echo "Created: $ZIP_OUT"
fi
