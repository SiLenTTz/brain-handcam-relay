# brain-handcam-relay 📱🎥

**Your phone as a sensor and remote control for [brain-galaxy](https://github.com/SiLenTTz/brain-galaxy).**
Streams the phone camera over WebSocket, executes allowlisted system commands
from hand gestures, receives voice input, and captures notes — frames never
leave your network.

## What it does

| Feature | How |
| --- | --- |
| 📷 **Camera streaming** | Phone browser captures JPEG frames → WS → desktop viewers (galaxy gesture engine, demo stages) |
| ✋ **Gesture commands** | Allowlisted actions: dictation (voxtype), window/workspace control (Hyprland IPC), app launch |
| 🎙 **Voice input** | Round mic button — hold to talk, phone transcribes live, review then send; commands like „menü X", „schließen" |
| 📝 **Note capture** | Title + category chips → writes sanitized markdown into your vault inbox; appears as a star in the galaxy within ~30 s |
| 📶 **Status broadcast** | Live phone-connected status for the galaxy UI |

## Quick start

```bash
git clone https://github.com/SiLenTTz/brain-handcam-relay.git
# or via SSH: git clone git@github.com:SiLenTTz/brain-handcam-relay.git
cd brain-handcam-relay
npm install          # only dependency: ws
npm start            # → http://127.0.0.1:8787
```

Open `http://127.0.0.1:8787/handcam` on your phone (e.g. via
`tailscale serve --set-path=/handcam` or your LAN). Allow the camera.
For the full gesture + voice experience, pair it with
[brain-galaxy](https://github.com/SiLenTTz/brain-galaxy).

## Endpoints

| Path | Method | Auth | What |
| --- | --- | --- | --- |
| `/` `/handcam` | GET | open | Phone camera page — stream, mic button, note capture link |
| `/capture` | GET | open | Note capture form (title, category, text) |
| `/capture` | POST | 🔑 token | Note capture (JSON body) |
| `/healthz` | GET | open | Liveness probe |
| `/?type=producer` | WS | 🔑 token | Phone frame producer (one at a time) |
| `/?type=viewer` | WS | 🔑 token | Desktop stage / viewer |

🔑 = requires the token **only when `HANDCAM_TOKEN` is set** — send it as
`?token=…` (WS and HTTP) or `x-handcam-token` header (HTTP POST).
Static pages and `/healthz` stay open either way.

## Security model

- **Loopback by default**: the relay binds to `127.0.0.1` only. Nothing is
  reachable from your LAN or the internet unless you expose it yourself.
- **LAN / tailnet exposure only with token + TLS**: if you expose the relay
  beyond loopback (reverse proxy or `tailscale serve`), set `HANDCAM_TOKEN`
  and put TLS in front of it (`tailscale serve` provides HTTPS; on plain
  HTTP the token travels unencrypted). Without a token the relay is
  unauthenticated — keep it on loopback.
- **Frames stay in your tailnet**: camera frames are relayed in memory,
  never stored or uploaded anywhere.
- **Allowlisted commands only**: gesture commands map to a fixed server-side
  table (voxtype start/stop, fixed Hyprland dispatches, fixed app-launch
  table) via `execFile` — no shell, no interpolated arguments.
- **Sanitized capture**: note text is stripped of control characters and
  size-capped; filenames are generated server-side.
- **Voice input honesty**: the mic button uses the browser's
  `SpeechRecognition` API. On Android/Chrome this typically runs on Google's
  speech servers, depending on your device settings — so voice is an
  *optional* convenience, not a "no cloud" guarantee. The note capture form
  (typing) works fully offline.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `HANDCAM_PORT` | `8787` (fallback: `PORT`) | Relay port; `0` = ephemeral |
| `HANDCAM_TOKEN` | *(empty)* | Opt-in token auth for `/capture` POST + WS. Empty = unauthenticated, loopback-only |
| `HANDCAM_INBOX` | `~/Vault/00_inbox` | Where captured notes are written (generic Obsidian-style inbox, override freely) |

## Troubleshooting

- **Camera stays black / permission denied** — the phone page needs a secure
  context: use `https://` (e.g. via `tailscale serve`) or `http://localhost`.
  Check the browser site permissions (camera must be allowed), then reload.
- **Camera granted but preview never starts (loadedmetadata stall)** — some
  Android/Chromium builds grant the stream but never fire `loadedmetadata`.
  The phone page handles this itself: it polls `videoWidth` for 6 s and then
  retries with bare constraints (`{video: true}`) — see `startCamera()` in
  `phone.html`. If it still fails, close other camera apps (e.g. the stock
  camera) and reload the page.
- **WS disconnects with code 4001 / „Token ungültig"** — `HANDCAM_TOKEN` is
  set on the server but your URL lacks it. Append `?token=…` to the phone
  page URL; the token is kept in `sessionStorage` for the session. Check for
  typos and remember: header `x-handcam-token` works for `/capture` POST.
- **401 on /capture POST** — same cause: send the token via
  `x-handcam-token` header or `?token=` query.

## Part of the brain-galaxy ecosystem

| Repo | What |
| --- | --- |
| [brain-galaxy](https://github.com/SiLenTTz/brain-galaxy) | 3D universe visualization (React + three.js) |
| [brain-indexer](https://github.com/SiLenTTz/brain-indexer) | Deterministic markdown indexer (Python stdlib, SQLite) |
| **brain-handcam-relay** | This repo — phone relay for gestures, voice, capture |

## Development

```bash
npm test             # node:test suite (healthz, capture, auth, dispatch)
bash scripts/setup-hooks.sh   # activate .githooks/pre-push (node --check + npm test)
bash scripts/release-gates.sh .   # release gates before publishing
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
