trayTemplate.png / trayTemplate@2x.png — the menu-bar icon (a mic glyph), already
generated here. Template = black shape on transparent background; macOS auto-inverts it
for dark/light menu bars. If both are missing, main.js falls back to a built-in dot, so
the menu bar is never blank.

Add `icon.icns` for the packaged app bundle (optional; electron-builder uses a default
otherwise).
