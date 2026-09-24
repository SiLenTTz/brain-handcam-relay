# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/),
Versionierung an [SemVer](https://semver.org).

## [1.0.0] - 2026-09-24

Initialer öffentlicher Release.

- 📷 WebSocket-Kamera-Relay: Phone-Browser streamt JPEG-Frames an
  Desktop-Viewer (Galaxy-Stage), Status-Broadcast für die Galaxy-UI
- ✋ Gesture-Commands über serverseitige Allowlist: Diktat (voxtype),
  Fenster-/Workspace-Navigation (Hyprland-IPC), App-Launches (`execFile`,
  feste argv — kein Shell)
- 🎙 Spracheingabe am Phone (SpeechRecognition, optional) mit
  Live-Transkript und Prüfen-vor-Senden
- 📝 Notiz-Capture (`/capture`): sanitiztes Markdown in die Vault-Inbox
  (`HANDCAM_INBOX`, Default `~/Vault/00_inbox`)
- 🔑 Opt-in Token-Auth (`HANDCAM_TOKEN`): `/capture`-POST und WS verlangen
  `x-handcam-token` bzw. `?token=`, WS-Ablehnung mit Code 4001
- 🩺 `/healthz` Liveness-Endpoint, konfigurierbarer Port
  (`HANDCAM_PORT`, Fallback `PORT`, Default 8787, nur Loopback-Bind)
