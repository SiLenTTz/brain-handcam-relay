# AGENTS.md — brain-handcam-relay

Kurzanleitung für Coding-Agents (und Menschen).

## Zweck

Phone-as-Camera-Relay für [brain-galaxy](https://github.com/SiLenTTz/brain-galaxy):
Kamera-Frames über WebSocket vom Phone zur Desktop-Stage, Allowlist-Commands
aus Gesten, Spracheingabe (optional), Notiz-Capture in die Vault-Inbox.
Bewusst minimal: eine Datei Server, zwei HTML-Seiten, eine Abhängigkeit (`ws`).

## Konventionen

- UI-Texte **Deutsch**, Code-Kommentare **Englisch**.
- CommonJS, Node >= 18, keine neuen Runtime-Deps ohne Not.
- Kommentare an bestehenden Stil angleichen (kurz, warum statt was).

## Befehle

```bash
npm install    # ws installieren
npm start      # Server auf 127.0.0.1:8787 (HANDCAM_PORT/PORT/HANDCAM_TOKEN via env)
npm test       # node:test-Suite (test/server.test.js)
bash scripts/release-gates.sh .   # Release-Gates vor jedem Push
```

## Sicherheits-Invarianten (nie verletzen)

1. **Allowlist only** — `buildCommandDispatch()` mappt Command-Strings auf
   fixe `{file, args}` für `execFile`. Kein Shell, keine Interpolation,
   unbekannte Commands → `null`.
2. **Sanitization** — `sanitizeCapture()` strips Steuerzeichen, deckelt die
   Länge; Dateinamen serverseitig generiert.
3. **Loopback-Default** — Bind auf `127.0.0.1`; Exposition nur mit
   `HANDCAM_TOKEN` + TLS. Ohne Token: Startup-Warnung ins Log.
4. Keine persönlichen Daten (IPs, Hostnames, E-Mails, Tokens) im Repo —
   private Audit-Muster gehören in `scripts/audit-patterns.local` (gitignored).

## Dateikarte

- `server.js` — HTTP + WS Relay, Token-Auth, Allowlist-Dispatch, Capture
- `phone.html` — Phone-Seite: Kamera, Mikrofon, Token aus `?token=`
- `capture.html` — Notiz-Formular (`/capture` POST mit `x-handcam-token`)
- `test/server.test.js` — node:test-Suite (ephemeral Port via `listen(0)`)
- `scripts/release-gates.sh` — deterministische Release-Gates
- `scripts/audit-patterns.local` — private Audit-Muster (gitignored, optional)
- `.githooks/pre-push` + `scripts/setup-hooks.sh` — Git-Hook-Integration
