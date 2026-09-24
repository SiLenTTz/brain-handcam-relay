// handcam — private phone-camera relay for barehands
// Phone browser (over Tailscale HTTPS) pushes JPEG frames over WS;
// the barehands stage on this machine pulls them as a virtual camera.
// No cloud, no third party — frames exist only on your tailnet.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { execFile } = require("child_process");

// Hyprland 0.56: `hyprctl dispatch` is broken (Lua parser) — use the raw
// IPC socket. Verified pattern from the hyprland-wayvnc-remote skill.
function hyprSocket() {
  const base = `/run/user/${process.getuid()}/hypr`;
  try {
    const sig = fs.readdirSync(base)
      .filter(d => fs.existsSync(`${base}/${d}/.socket.sock`))
      .sort().pop();
    return sig ? `${base}/${sig}/.socket.sock` : null;
  } catch (e) { return null; }
}
function hypr(cmd) {
  const sock = hyprSocket();
  if (!sock) { console.log("[oma] no hypr socket"); return; }
  const net = require("net");
  const c = net.connect(sock);
  let out = "";
  c.on("error", e => console.log("[oma] socket err:", e.message));
  c.on("data", d => { out += d; });
  c.on("end", () => { if (/unknown|error/i.test(out)) console.log("[oma]", out.trim().slice(0, 120)); });
  c.end(cmd + "\n");
}

const PORT = Number(process.env.HANDCAM_PORT || process.env.PORT || 8787);
// Opt-in token auth: when set, /capture POST and every WS connection must
// present it (x-handcam-token header or ?token= query). Empty = open relay,
// loopback bind only (startup warning below).
const TOKEN = process.env.HANDCAM_TOKEN || "";
const phonePage = fs.readFileSync(path.join(__dirname, "phone.html"));
const capturePage = fs.readFileSync(path.join(__dirname, "capture.html"));

// token from request: header first, ?token= query as fallback; "" if absent
function requestToken(req) {
  if (req.headers["x-handcam-token"]) return String(req.headers["x-handcam-token"]);
  try { return new URL(req.url, "http://x").searchParams.get("token") || ""; }
  catch (e) { return ""; }
}
function authorized(req) {
  return !TOKEN || requestToken(req) === TOKEN;
}

// B3: Phone-Capture — Notizen landen in der Vault-Inbox (Kuratoren-Regel);
// der Galaxy-Watcher (S8) reindiziert und sie erscheinen automatisch im Graph.
// Zielordner für Phone-Captures (per env überschreibbar, Default: Vault-Inbox
// neben dem Heimatverzeichnis — Kuratoren-Regel: erst Inbox, dann kuratieren)
const VAULT_INBOX = process.env.HANDCAM_INBOX
  || path.join(process.env.HOME || ".", "Vault/00_inbox");
const CAPTURE_CATEGORIES = ["idee", "projekt", "thema", "system", "offen"];

function sanitizeCapture(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    // Steuerzeichen raus (außer \n\t), Länge deckeln
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .slice(0, 20000)
    .trim();
}

function writeCapture({ title, text, category }) {
  const clean = sanitizeCapture(text);
  if (!clean) throw new Error("leerer Text");
  const cat = CAPTURE_CATEGORIES.includes(category) ? category : "offen";
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  const name = `capture-${stamp}-${rand}.md`;
  const t = (sanitizeCapture(title) || clean.slice(0, 60)).slice(0, 80).replace(/["\\]/g, "");
  const body = [
    "---",
    `title: "${t}"`,
    "type: capture",
    "source: phone",
    `category: ${cat}`,
    `created: ${now.toISOString()}`,
    "---",
    "",
    clean,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(VAULT_INBOX, name), body, "utf-8");
  return name;
}

// Pure allowlist → execFile mapping for stage/phone commands.
// Returns a fixed {file, args} pair or null for anything unknown —
// no shell, no interpolated arguments, ever.
function buildCommandDispatch(cmd) {
  if (typeof cmd !== "string") return null;
  const VOX = {
    voxstart: { file: "voxtype", args: ["record", "start"] },
    voxstop:  { file: "voxtype", args: ["record", "stop"] },
  };
  if (VOX[cmd]) return VOX[cmd];
  if (cmd.startsWith("launch:")) {
    // Launch favorites (Omarchy default apps — example, per allowlist fix)
    const APPS = {
      terminal: { file: "alacritty", args: [] },
      browser:  { file: "brave", args: [] },
      files:    { file: "thunar", args: [] },
      galaxy:   { file: "alacritty", args: ["-e", "sh", "-c",
        "cd ~/brain-galaxy && npx vite preview --port 4173 & sleep 1; xdg-open http://localhost:4173/?hands=1"] },
      vault:    { file: "alacritty", args: ["-e", "nvim", "~/Vault/00_inbox/"] },
      obsidian: { file: "obsidian", args: [] },
      discord:  { file: "discord", args: [] },
    };
    return APPS[cmd.slice(7)] || null;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  // B3: Capture vom Phone → Vault-Inbox (100 KB Deckel, JSON only)
  if (u === "/capture" && req.method === "POST") {
    if (!authorized(req)) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "token required" }));
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 100000) req.destroy();
    });
    req.on("end", () => {
      try {
        const { title, text, category } = JSON.parse(body || "{}");
        const name = writeCapture({ title, text, category });
        console.log(`[capture] ${name}`);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, file: name }));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  if (u === "/" || u === "/handcam" || u === "/handcam/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(phonePage);
  }
  if (u === "/capture") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(capturePage);
  }
  if (u === "/healthz") {
    res.writeHead(200);
    return res.end("ok");
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

let producer = null;          // the phone (at most one)
const viewers = new Set();     // desktop stages (usually one)
let lastFrame = null;         // latest JPEG (Buffer) — drop frames when slow
let lastFrameTs = 0;
let stats = { framesIn: 0, framesOut: 0, bytesIn: 0, started: Date.now() };

// B2: Phone-Status an alle Viewer broadcasten (Galaxy zeigt 📶-Punkt)
function broadcastPhoneStatus() {
  const m = JSON.stringify({ phone: !!producer });
  for (const v of viewers) {
    if (v.readyState === 1) v.send(m);
  }
}

wss.on("connection", (ws, req) => {
  // token gate: with HANDCAM_TOKEN set, WS without matching ?token= is rejected
  if (TOKEN && requestToken(req) !== TOKEN) {
    ws.close(4001, "invalid token");
    return;
  }
  const role = new URL(req.url, "http://x").searchParams.get("type") || "viewer";
  if (role === "producer") {
    if (producer && producer.readyState === 1) {
      ws.close(4000, "another phone is already connected");
      return;
    }
    producer = ws;
    console.log(`[handcam] phone connected from ${req.socket.remoteAddress}`);
    broadcastPhoneStatus();
    ws.on("message", (data, isBinary) => {
      let buf;
      if (isBinary) buf = Buffer.from(data);
      else {
        const s = data.toString();
        // MIC: JSON-Sprachnachricht → an alle Viewer (Galaxy) weiterleiten
        if (s.startsWith("{") && s.includes('"voice"')) {
          console.log(`[mic] ${s.slice(0, 120)}`);
          for (const v of viewers) {
            if (v.readyState === 1) v.send(s);
          }
          return;
        }
        // phone sends base64 JPEG data URLs' payload as a string
        if (s.length < 100 || s.length > 400000) return; // sanity bound
        buf = Buffer.from(s, "base64");
        if (buf.length < 50) return;
      }
      stats.framesIn++; stats.bytesIn += buf.length;
      lastFrame = buf; lastFrameTs = Date.now();
      // fan out to stages; slow viewers drop frames naturally via bufferedAmount
      for (const v of viewers) {
        if (v.readyState === 1 && v.bufferedAmount < 262144) {
          v.send(buf, { binary: true });
          stats.framesOut++;
        }
      }
    });
    ws.on("close", () => {
      if (producer === ws) { producer = null; broadcastPhoneStatus(); }
    });
  } else {
    viewers.add(ws);
    console.log(`[handcam] stage viewer connected (${viewers.size} total)`);
    if (lastFrame && ws.readyState === 1) ws.send(lastFrame, { binary: true });
    if (ws.readyState === 1) ws.send(JSON.stringify({ phone: !!producer })); // B2
    ws.on("close", () => viewers.delete(ws));
    // ---- OMA GESTURES: allowlisted hyprctl exec for the stage ----
    // The stage sends {"oma":"left"|"right"|"overview"...} after its own
    // arming+swipe confirmation. Only these exact commands ever run.
    // ---- OMA GESTURES: allowlisted Hyprland dispatches (raw IPC) ----
    // The stage sends {"oma":"left"|"right"} after its own arming+swipe
    // confirmation. Hyprland 0.56 Lua IPC, VERIFIED working pattern
    // (2026-09-09): hl.dispatch(hl.dsp.focus({workspace="e±1"})) — same
    // dispatcher Omarchy's own SUPER+TAB binding uses (tiling.lua:30).
    ws.on("message", (data) => {
      let m;
      try { m = JSON.parse(data.toString()); } catch (e) { return; }
      if (!m || typeof m.oma !== "string") return;
      // execFile-based commands (voxtype, app launches) come from the pure
      // allowlist below; Hyprland IPC dispatches after that. Nothing else runs.
      const d = buildCommandDispatch(m.oma);
      if (d) {
        console.log(`[oma] ${m.oma}`);
        if (m.oma.startsWith("launch:")) {
          execFile(d.file, d.args, { timeout: 8000, detached: true,
            stdio: "ignore" }, (err) => {
            if (err) console.log(`[oma] launch ${m.oma.slice(7)} err:`, err.message.slice(0, 100));
          }).unref();
        } else {
          execFile(d.file, d.args, { timeout: 5000 }, (err, so, se) => {
            if (err) console.log(`[oma] voxtype err:`, (se || err.message).slice(0, 120));
          });
        }
        return;
      }
      // Fensternavigation: nächstes/vorheriges Fenster, Workspace-Focus
      const OMA = {
        left:  'hl.dispatch(hl.dsp.focus({workspace="e-1"}))',
        right: 'hl.dispatch(hl.dsp.focus({workspace="e+1"}))',
      };
      const HYP = {
        nextwin: 'hl.dispatch(hl.dsp.focus({direction="r"}))',
        prevwin: 'hl.dispatch(hl.dsp.focus({direction="l"}))',
        upwin:   'hl.dispatch(hl.dsp.focus({direction="u"}))',
        downwin: 'hl.dispatch(hl.dsp.focus({direction="d"}))',
      };
      if (HYP[m.oma]) {
        console.log(`[oma] ${m.oma} -> ${HYP[m.oma]}`);
        hypr("eval " + HYP[m.oma]);
        return;
      }
      const cmd = OMA[m.oma];
      if (!cmd) return;
      console.log(`[oma] ${m.oma} -> ${cmd}`);
      hypr("eval " + cmd);
    });
  }
  ws.on("error", (e) => console.error("[ws] error:", e.message));
});

// health/stats log every 10s (runtime only — not started under test)
if (require.main === module) {
  if (!TOKEN) {
    console.warn("[handcam] no HANDCAM_TOKEN set — running unauthenticated, bind stays on 127.0.0.1");
  }
  setInterval(() => {
    const age = lastFrame ? ((Date.now() - lastFrameTs) / 1000).toFixed(1) : "-";
    console.log(`[handcam] phone:${producer ? "UP" : "--"} viewers:${viewers.size} ` +
      `lastFrame:${age}s in:${stats.framesIn} out:${stats.framesOut} ` +
      `(${(stats.bytesIn / 1048576).toFixed(1)}MB)`);
  }, 10000);

  server.listen(PORT, "127.0.0.1", () => {
    // 127.0.0.1 for the local stage; the phone reaches it via `tailscale serve`.
    // PORT=0 → ephemeral port, read back from the bound address.
    console.log(`[handcam] relay up on 127.0.0.1:${server.address().port} (phone page: /)`);
  });
}

// exports for tests: server (top-level, listen on an ephemeral port yourself)
// plus the pure helpers.
module.exports = { server, sanitizeCapture, writeCapture, buildCommandDispatch };
