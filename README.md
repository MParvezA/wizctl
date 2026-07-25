# wizctl

A self-hosted web app for controlling Philips WiZ smart bulbs over your local
network — no cloud, no app, no account. Runs on any machine on the same LAN
as the bulbs (a Mac, a Raspberry Pi, whatever you've got).

```
browser → HTTP / WebSocket → FastAPI backend → UDP :38899 → bulb
```

The backend does all bulb communication via [`pywizlight`](https://github.com/sceniclife/pywizlight),
which wraps the WiZ UDP JSON protocol (discovery, commands, state reads,
retries). The frontend never talks to a bulb directly — browsers can't send
UDP anyway.

Bulb state is treated as external: it can change from the wall switch, the
official WiZ app, or a schedule at any time. The UI polls each bulb's real
state over a WebSocket and mirrors it live — it never just assumes the last
command it sent "stuck". The whole interface is built around that idea: a
large ambient glow renders the bulb's actual live color and brightness, so
the screen is a live mirror of the physical light. Flip the wall switch and
the screen goes dark with it.

## Features

- **Discovery + manual add** — auto-discovers bulbs via UDP broadcast, with
  a fallback to add a bulb directly by IP (useful when broadcast discovery
  doesn't work — see [Troubleshooting](#troubleshooting)).
- **Power, brightness (10–100%)**
- **White** — a continuous 2200K–6500K temperature slider, plus quick presets
  for the bulb's built-in white looks (Warm White, Daylight, Cool White,
  Night Light, Golden White, Dim-to-Warm, etc).
- **Color** — an RGB wheel (debounced to avoid flooding the bulb with UDP
  packets while dragging).
- **Color-changing scenes** — the bulb's built-in dynamic scenes (Ocean,
  Fireplace, Party, Jungle, …) with a live effect-speed control (10–200).
- **Live status** — on/off, active mode, brightness, effect speed, and
  signal quality, all driven by the WebSocket, with a clear "unreachable"
  state if a bulb drops off the network mid-session.
- Multiple bulbs, with a segmented selector and last-used bulb persisted
  per browser.

## Prerequisites

- **Same network as the bulbs.** The host running the backend must be on the
  same LAN as your WiZ bulbs, and normally the same 2.4GHz Wi‑Fi network
  (WiZ bulbs are 2.4GHz-only). UDP broadcast discovery (port 38899) needs to
  reach the bulbs' subnet — a guest network or client-isolated Wi‑Fi will
  not work.
- **Local Control enabled.** In the official WiZ app, each bulb has a
  "Local Control" / "Local API" toggle — make sure it's on.
- **The bulb must already be joined to your WiFi.** A brand-new or
  factory-reset bulb broadcasts its own temporary setup hotspot and needs a
  one-time handoff of your WiFi credentials — that's a different protocol
  than everything else this app does, and the official WiZ app (or any other
  WiZ-compatible onboarding tool) is the easiest way to do it. Once a bulb
  is on your WiFi, you never need that app again.
- Python 3.11+
- Node 18+

## Project layout

```
backend/    FastAPI app, pywizlight bulb manager, REST + WebSocket API
frontend/   React + TypeScript + Vite + Tailwind UI
```

## Running in development (two processes)

Terminal 1 — backend:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 — frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). The Vite dev
server proxies `/api` and `/ws` to `localhost:8000` (see
`frontend/vite.config.ts`), so both processes talk to each other without any
CORS setup.

### Accessing it from your phone or another device on the LAN

By default Vite's dev server only binds to `localhost`. To reach it from a
phone on the same WiFi, start it with `--host`:

```bash
npm run dev -- --host
```

Vite will print a `Network` URL (e.g. `http://192.168.1.5:5173`) — open that
on your phone. Your Mac's firewall (System Settings → Network → Firewall)
must allow incoming connections for Node and Python, or the phone will just
time out. If you'd rather not juggle two processes on mobile, build once
(`npm run build`) and only run the backend — see below — then hit its port
directly from your phone.

## Running in production (one process)

Build the frontend, then let FastAPI serve the compiled static assets:

```bash
cd frontend
npm install
npm run build          # outputs frontend/dist

cd ../backend
python3 -m venv .venv && source .venv/bin/activate   # if not already created
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Visit `http://<host-ip>:8000` from any device on the LAN. `backend/app/main.py`
mounts `frontend/dist` and serves `index.html` for any non-API route, so this
is a single process end to end.

## API summary

REST (JSON):

- `GET /api/bulbs` — cached list of discovered bulbs
- `POST /api/bulbs/rescan` — force a fresh UDP discovery broadcast
- `POST /api/bulbs/add` `{ip}` — add a bulb directly by IP, bypassing
  broadcast discovery entirely
- `GET /api/bulbs/{ip}/state` — normalized current state
- `POST /api/bulbs/{ip}/power` `{on}`
- `POST /api/bulbs/{ip}/brightness` `{brightness: 10-100}`
- `POST /api/bulbs/{ip}/color` `{r,g,b}`
- `POST /api/bulbs/{ip}/temp` `{kelvin: 2200-6500}`
- `POST /api/bulbs/{ip}/scene` `{sceneId, speed?: 10-200}` — `speed` only
  applies to color-changing scenes, ignored for static white looks
- `GET /api/scenes` — built-in WiZ scenes, each tagged `dynamic: true/false`
  (color-changing effect vs. a static white look)

WebSocket:

- `GET /ws/bulbs/{ip}` — pushes the normalized state object whenever it
  changes (polls every ~2s, plus immediately after any command sent through
  the REST API). Pushes `{reachable: false, ...}` if the bulb stops
  responding — e.g. unplugged, or off the wall switch.

Every bulb call is wrapped in try/except with a timeout; a slow or dead bulb
never produces a 500, it produces a `reachable: false` state. A failed call
also evicts its cached connection so the next attempt gets a fresh UDP
socket (pywizlight never recreates a socket that hit an OS-level error).

## Troubleshooting

- **"No bulbs found" even though the bulb is on and working in the WiZ
  app.** UDP broadcast discovery is flaky on some networks — most notably
  Mac WiFi, where broadcast replies can get silently dropped by the OS even
  though direct point-to-point UDP works fine. Use **"+ add by IP"** in the
  header (or on the empty state) with the bulb's IP address — check your
  router's DHCP client list, or the WiZ app's device info screen, to find
  it. You can also try setting `WIZ_BROADCAST_ADDR` to your subnet's
  broadcast address (e.g. `192.168.1.255` instead of the default
  `255.255.255.255`) as an env var before starting the backend.
- **Commands work but then everything to that bulb times out forever
  afterward.** This was a real bug we hit and fixed — see the "evicts its
  cached connection" note above. If you're still seeing it, you're probably
  on an older copy of `wiz_manager.py`.
- **A phone/another device can't reach the app at all.** Almost always the
  macOS Firewall silently blocking the incoming connection. See
  [Accessing it from your phone](#accessing-it-from-your-phone-or-another-device-on-the-lan).
- **macOS "Local Network" privacy permission.** Since macOS Sonoma, apps
  need explicit permission (System Settings → Privacy & Security → Local
  Network) to talk to devices on your LAN subnet. If Python has never been
  granted it, every bulb call will silently time out even on a network
  where a manual `nc`/`curl` test works fine.

## Design notes

The UI is built around one idea: the bulb is the only light in the room. A
radial glow behind the controls renders the bulb's actual live color (RGB in
color mode, the correlated color of its Kelvin in white mode, or a neutral
warm tone for white-look scenes) and its size and intensity track
brightness — driven entirely by the WebSocket, not by echoing the last
command sent. A small bulb glyph mirrors the same color as a more literal
"this is the light" readout. Sliders hold local optimistic state while
dragging (rather than being fully server-controlled) so they stay smooth
even with round-trip latency to the bulb.

## License

MIT — see [LICENSE](LICENSE).
