# WhisperKey

Offline, hold-to-talk voice dictation for macOS. **Hold `⌘ + ⇧` → speak → release → text appears at your cursor.** All speech-to-text runs locally via [whisper.cpp](https://github.com/ggml-org/whisper.cpp). No cloud, no network, no data leaves the device.

Built with Electron (Node.js). Runs as a menu-bar app with a floating status pill.

---

## 1. Architecture

```
                     ┌──────────────────────────────────────────────┐
   ⌘⇧ held ────────► │ 1. HotkeyListener  (node-global-key-listener) │
                     │    press → 'press'   release → 'release'      │
                     └───────────────┬──────────────────────────────┘
                                     │ press                 │ release
                                     ▼                       ▼
                     ┌───────────────────────┐   ┌───────────────────────────┐
                     │ 2. AudioRecorder      │   │ stop() → 16k mono WAV     │
                     │    ffmpeg avfoundation │   └────────────┬──────────────┘
                     │    16kHz · mono · s16  │                │
                     └───────────────────────┘                ▼
                                              ┌───────────────────────────────┐
                                              │ 3. WhisperEngine (whisper.cpp) │
                                              │    spawn whisper-cli → text    │
                                              └────────────────┬───────────────┘
                                                               ▼
                                              ┌───────────────────────────────┐
                                              │ 4. Post-processor              │
                                              │    strip [BLANK_AUDIO], tidy   │
                                              │    CJK spacing, trim           │
                                              └────────────────┬───────────────┘
                                                               ▼
                                              ┌───────────────────────────────┐
                                              │ 5. Injector                    │
                                              │    clipboard + native ⌘V       │
                                              │    restores prior clipboard    │
                                              └───────────────────────────────┘

   6. StateManager (FSM: idle→recording→transcribing→done/error) drives:
   7. UI Layer  ── menu-bar Tray  +  borderless always-on-top overlay pill
```

| # | Module | File | Responsibility |
|---|--------|------|----------------|
| 1 | Global Hotkey Listener | `src/hotkey.js` | OS-level key DOWN/UP; hold-to-talk detection |
| 2 | Audio Recorder | `src/recorder.js` | ffmpeg avfoundation → 16k mono WAV |
| 3 | Local ASR | `src/asr.js` | spawn `whisper-cli`, low-latency flags |
| 4 | Text Post-Processor | `src/postprocess.js` | clean tags, CJK spacing |
| 5 | Input Injector | `src/injector.js` | clipboard paste + clipboard restore |
| 6 | State Manager | `src/state.js` | single source of truth FSM |
| 7 | UI Layer | `src/main.js`, `renderer/*` | tray + overlay feedback |
|   | Config | `src/config.js` | hotkey/model/language, persisted JSON |
|   | Paths | `src/paths.js` | dev vs packaged resource resolution |

**Why these choices**

- **`node-global-key-listener`, not Electron `globalShortcut`** — `globalShortcut` only fires on chord *press* and cannot watch modifier-only combos. We need both press *and* release for hold-to-talk, so we tap the OS keyboard directly.
- **ffmpeg avfoundation, spawned per take** — instant start/stop with no warmup buffering; the spec explicitly allows ffmpeg. Output is exactly what whisper wants (16 kHz mono s16 WAV) so there's zero resampling downstream.
- **`whisper-cli` binary via spawn, not a native addon** — avoids rebuilding a node-gyp module against every Electron ABI bump. Robust and swappable.
- **Clipboard + ⌘V via AppleScript** — works in every target app (Chrome, Safari, WeChat, Slack, Teams, Notion, Word, Excel). Prior clipboard is restored ~250 ms later.

---

## 2. Prerequisites

```bash
brew install node cmake ffmpeg   # Node 18+, cmake to build whisper.cpp, ffmpeg for capture
```

---

## 3. Install & one-time setup

```bash
cd voice-input
npm install                 # Electron + node-global-key-listener
npm run setup:whisper       # clones + builds whisper.cpp → vendor/whisper/whisper-cli
npm run setup:model         # downloads ggml-small.bin → models/  (~466 MB)
# optional, better zh+en accuracy:
#   bash scripts/download-model.sh medium   then set "model":"medium" in config
```

## 4. Run (dev)

```bash
npm start
```

A pill appears in the menu bar. **Hold `⌘ + ⇧`, speak, release.** The overlay shows
`Recording… → Transcribing… → Done`, and the text is pasted into the focused field.

---

## 5. macOS permissions (required)

macOS gates the two things this app must do. Grant each once, then **restart the app**:

| Capability | Where | Why |
|-----------|-------|-----|
| **Microphone** | System Settings → Privacy & Security → **Microphone** | record audio (prompted on first run) |
| **Accessibility** | Privacy & Security → **Accessibility** | synthesize the ⌘V keystroke to paste |

The default `⌘ + ⇧` hotkey uses WhisperKey's bundled modifier monitor, so it does **not** need Input Monitoring. Input Monitoring is only needed if you configure a non-modifier fallback hotkey. In dev, the app you grant is **Electron** (or your terminal). In a packaged build it's **WhisperKey.app**.

**Startup diagnostics.** On launch WhisperKey checks whisper-cli, the model file, ffmpeg, the mic device, and Microphone/Accessibility permissions, and writes the result to the log. If any hard check fails it pops a dialog with fix hints and buttons to open the relevant panes. Re-run any time via tray → **Run Diagnostics…**.

**Logs.** Everything (recording, transcription, paste, errors) is logged to
`~/Library/Application Support/WhisperKey/whisperkey.log`. Open it from tray → **Open Logs**.

---

## 6. Configuration

Use tray → **Change Hotkey…** to press and save a new hold-to-talk shortcut. The
change takes effect immediately.

For advanced settings, edit the JSON at `~/Library/Application Support/WhisperKey/config.json` (tray → *Open Config File*), then restart.

```jsonc
{
  "hotkey": ["META", "SHIFT"],   // hold-to-talk combo (all must be held)
  "asrEngine": "whisper.cpp",      // pluggable ASR backend
  "model": "small",               // tiny | base | small | medium | large-v3 | large-v3-turbo
  "language": "auto",             // auto = Chinese+English mixed dictation; or fixed "en"/"zh"
  "sampleRate": 16000,
  "minRecordMs": 250,             // ignore accidental taps
  "restoreClipboard": true,
  "audioDevice": ":0",            // avfoundation audio index (see device listing below)
  "threads": 6,
  "pasteMethod": "clipboard"      // or "type" for fields that block paste
}
```

**Hotkey tokens.** Abstract tokens match **either** physical side: `META` (⌘), `SHIFT`, `CTRL`, `ALT` (⌥) — so `["META","SHIFT"]` fires on left *or* right ⌘+⇧. You can still pin a side (`LEFT META`) or use a plain key that never conflicts with system shortcuts (`["F5"]`).

**Model switching.** ASR engines and model filenames are declared in `src/asr-models.js`; runtime creation is isolated behind `src/asr.js#createAsrEngine`. For whisper.cpp models, download the file first, then set `model` in the config:

```bash
npm run setup:model -- medium
npm run setup:model -- large-v3-turbo
```

`small` is the current balance. `medium` is usually more accurate for Chinese+English dictation but slower. `large-v3-turbo` is a better next candidate when accuracy matters and latency is still acceptable.

**List your mic devices** (the number is what goes in `audioDevice`):

```bash
ffmpeg -f avfoundation -list_devices true -i ""
# [AVFoundation indev] AVFoundation audio devices:
# [AVFoundation indev] [0] MacBook Pro Microphone
# [AVFoundation indev] [1] External USB Mic
```

Then set e.g. `"audioDevice": ":1"`. Diagnostics also prints the detected list.

**Clipboard restore limitation.** When pasting, the app snapshots and restores the clipboard's **text, HTML, RTF, and image** flavors. It cannot preserve **file references** (copied Finder files), **promised files**, or **custom app-specific pasteboard types** — those would be lost by the restore. If you rely on such content, set `"restoreClipboard": false`, and the app will simply leave the transcript on the clipboard rather than overwrite it back.

---

## 7. Performance

| Target | How it's met |
|--------|--------------|
| Hotkey response < 100 ms | OS keyboard tap; recording spawns on the same tick as `press` |
| STT latency 1–3 s (small) | model-specific decode flags, multi-thread, Metal on Apple Silicon |
| No blocking UI | ASR runs in a child process; main process only awaits its exit |

For the lowest latency on Apple Silicon, `setup:whisper` builds with Metal. `small` gives the best accuracy/latency balance for dictation. In `auto` language mode WhisperKey uses a mixed Chinese/English prompt and wider decoding search, so code-switching is more reliable but a little slower than fixed `"zh"` or `"en"`. Larger models improve accuracy at the cost of startup/package size and transcription time.

---

## 8. Packaging & distribution

Build a distributable `.dmg` (universal arm64 + x64):

```bash
npm run bundle:ffmpeg       # optional but recommended — see below
npm run dist:local          # builds, ad-hoc signs, and creates a local DMG
```

electron-builder bundles the app and copies `vendor/whisper/`, `vendor/ffmpeg/`, and
`models/*.bin` into `WhisperKey.app/Contents/Resources/` (see the `build` block in
`package.json`). `src/paths.js` resolves those at runtime via `process.resourcesPath`.

The local DMG includes `WhisperKey.app` plus an `Applications` shortcut. Drag
`WhisperKey.app` to `Applications`, eject the DMG, then open the app from
`Applications` before granting Accessibility or Input Monitoring. If you run the app
directly from `/Volumes/WhisperKey`, macOS grants permissions to that temporary copy
and the hotkey may not work after installation.

**ffmpeg in a packaged app (important).** A double-clicked `.app` is launched by launchd,
which does **not** inherit your shell's Homebrew PATH. So a build that relies on bare
`ffmpeg` works under `npm start` but fails when packaged. WhisperKey handles this in two
layers: `src/bin.js` explicitly probes `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`
(not just PATH), and `paths.js` prefers a **bundled** copy at `vendor/ffmpeg/ffmpeg` if
present. Run `npm run bundle:ffmpeg` to bundle ffmpeg so the app is self-contained and
works even on machines without Homebrew. (Homebrew's ffmpeg links many dylibs; if the
bundled copy won't launch, drop in a **static** build such as one from evermeet.cx.)

**Signing & notarization (for distribution outside your own machine):**

1. Set `LSUIElement` (already set) so there's no Dock icon.
2. Sign with a Developer ID cert; entitlements are in `build/entitlements.mac.plist`
   (microphone + hardened-runtime exceptions for the spawned binaries).
3. Notarize:
   ```bash
   export APPLE_ID=... APPLE_APP_SPECIFIC_PASSWORD=... APPLE_TEAM_ID=...
   npm run dist            # electron-builder notarizes when these env vars are set
   ```
4. Because the app spawns `whisper-cli` and `ffmpeg`, keep
   `com.apple.security.cs.disable-library-validation` in the entitlements (already included)
   so their dylibs load under the hardened runtime.

**Model size note:** `ggml-small.bin` (~466 MB) makes the DMG large. Two options:
ship it inside the app (offline on first launch, big download), or ship without models and
run `setup:model` post-install (smaller DMG, one extra step). The build config bundles them
by default — delete the `models` entry from `extraResources` to ship lean.

**Distribution without an Apple Developer account:** unsigned apps run after the user
right-clicks → Open (or `xattr -dr com.apple.quarantine WhisperKey.app`). Fine for internal
Keychron use; sign+notarize for anything public.

---

## 9. Test checklist

Run through this after setup (dev) and again on the packaged `.app`:

**Core pipeline**
- [ ] Launch shows the mic icon in the menu bar (not blank) and no failure dialog.
- [ ] Tray → **Run Diagnostics…** shows ✅ for whisper-cli, model, ffmpeg, mic device, Microphone, Accessibility.
- [ ] **Hold ⌘+⇧** → the overlay pill shows **Recording…** within a blink (test both left and right ⌘/⇧).
- [ ] **Release** → pill switches to **Transcribing…**.
- [ ] Whisper returns text → pill shows **Done** and the transcript is pasted at the cursor.
- [ ] Speak English, then 中文, then a mixed "打开 Chrome 一下" — all transcribe correctly.

**Paste targets** (focus a text field in each, dictate a phrase)
- [ ] **Notes** (native app)
- [ ] **Chrome** (address bar / a textarea)
- [ ] **WeChat** (message box)
- [ ] **Notion** (a page block)
- [ ] Clipboard: copy something first, dictate, confirm your original clipboard is back afterward.

**Error handling**
- [ ] Rename the model file → relaunch → diagnostics dialog appears; tray → **Open Logs** shows the error.
- [ ] Revoke Input Monitoring → hotkey stops firing (confirms it's the gate); re-grant → works again.

**Packaged app (the real test — no terminal PATH)**
- [ ] `npm run bundle:ffmpeg && npm run dist:local`, install the `.dmg`.
- [ ] Drag **WhisperKey.app** to **Applications**, eject the DMG, then launch it from **Applications**.
- [ ] Grant Microphone and Accessibility to *WhisperKey* (not Electron), restart.
- [ ] Full hold→speak→release→paste cycle works — proving ffmpeg/whisper resolve without Homebrew PATH.

---

## 10. Troubleshooting

- **Hotkey does nothing** → make sure you launched `/Applications/WhisperKey.app`; then use tray → **Open Logs** to check whether `hotkey ready: ModifierMonitor` appears.
- **Nothing pastes** → grant **Accessibility** to `/Applications/WhisperKey.app`, then restart.
- **`whisper.cpp binary or model missing`** → run `npm run setup:whisper && npm run setup:model`.
- **Recording fails / silent** → `ffmpeg -f avfoundation -list_devices true -i ""`, then set `audioDevice`.
- **`ffmpeg not found` (esp. in packaged app)** → `brew install ffmpeg`, or run `npm run bundle:ffmpeg` and rebuild so ffmpeg ships inside the app.
- **Wrong language** → set `"language": "zh"` or `"en"`; keep `auto` for mixed input.

---

## 11. Project layout

```
voice-input/
├─ package.json            deps + electron-builder config
├─ build/entitlements.mac.plist
├─ scripts/
│  ├─ setup-whisper.sh     build whisper.cpp → vendor/whisper
│  ├─ download-model.sh    fetch ggml model → models/
│  └─ bundle-ffmpeg.sh     copy ffmpeg → vendor/ffmpeg (for packaging)
├─ src/
│  ├─ main.js              wires modules, tray, overlay, diagnostics
│  ├─ config.js  state.js  hotkey.js  recorder.js
│  ├─ asr.js     asr-models.js  postprocess.js  injector.js
│  ├─ bin.js               external-binary resolver (ffmpeg/whisper)
│  ├─ paths.js  logger.js  diagnostics.js  preload.js
├─ renderer/               overlay.html / .css / .js  (status pill)
├─ assets/                 trayTemplate.png (+@2x) menu-bar icon
├─ vendor/whisper/         (generated) whisper-cli binary
├─ vendor/ffmpeg/          (optional) bundled ffmpeg
└─ models/                 (generated) ggml-*.bin
```

MIT.
