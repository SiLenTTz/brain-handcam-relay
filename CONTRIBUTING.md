# Contributing — brain-handcam-relay

Danke fürs Interesse! Dieses Repo ist bewusst klein und sicherheitskritisch —
bitte halte die Invarianten ein.

## Entwicklung

```bash
npm install        # einzige Abhängigkeit: ws
npm start          # Startet den Relay auf 127.0.0.1:8787 (HANDCAM_PORT/PORT überschreibbar)
npm test           # node:test-Suite (healthz, Capture, Token-Auth, Dispatch-Allowlist)
```

Vor dem ersten Push einmalig:

```bash
bash scripts/setup-hooks.sh   # aktiviert .githooks/pre-push (node --check + npm test)
```

## Sicherheitsregeln (nicht verhandelbar)

1. **Allowlist only**: Gesture-Commands mappen ausschließlich über feste
   Tabellen (`buildCommandDispatch` in `server.js`) auf `execFile` mit
   fixem argv. Nie `exec`/Shell, nie interpolierte Argumente, nie dynamisch
   zusammengesetzte Befehle.
2. **Sanitization**: Nutertexte (`/capture`) werden vor dem Schreiben
   von Steuerzeichen befreit und gedeckelt (`sanitizeCapture`). Dateinamen
   werden serverseitig generiert.
3. **Loopback-Default**: Der Server bindet `127.0.0.1`. Wer ihn darüber
   hinaus exponiert (LAN/Tailnet), muss `HANDCAM_TOKEN` setzen und TLS
   davor schalten (z. B. `tailscale serve` oder Reverse Proxy).
4. **Keine Secrets im Repo**: Keine Tokens, privaten IPs, Hostnames oder
   persönlichen Daten committen. `scripts/audit-patterns.local` (gitignored)
   hält private Audit-Muster außerhalb des öffentlichen Codes.

## Konventionen

- UI-Texte Deutsch, Code-Kommentare Englisch.
- Keine neuen Runtime-Abhängigkeiten ohne Diskussion — `ws` reicht.
- Reines CommonJS, Node >= 18 (`fetch`, `node:test` sind verfügbar).

## Release-Flow

1. `CHANGELOG.md` unter neuem Versionsabschnitt ergänzen.
2. Release-Gates grün laufen lassen (blockiert bei Fehlern):

   ```bash
   bash scripts/release-gates.sh .
   ```

3. Erst wenn alle Gates grün sind: pushen (Hook `pre-push` prüft zusätzlich
   `node --check server.js && npm test`).

## Lizenz

MIT — Beiträge erfolgen unter [LICENSE](LICENSE).
