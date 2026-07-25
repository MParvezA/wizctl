import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .models import (
    AddBulbRequest,
    BulbState,
    PowerRequest,
    BrightnessRequest,
    ColorRequest,
    TempRequest,
    SceneRequest,
    SceneInfo,
)
from .wiz_manager import manager, BulbUnreachable

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wiz_backend")

POLL_INTERVAL = 2.0

# Per-ip event used to wake a WS poll loop immediately after a command.
_poll_triggers: dict[str, asyncio.Event] = {}


def _trigger(ip: str) -> None:
    ev = _poll_triggers.get(ip)
    if ev is not None:
        ev.set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await manager.discover()
    yield


app = FastAPI(title="WiZ Local Control", lifespan=lifespan)


@app.get("/api/bulbs")
async def get_bulbs():
    return await manager.discover()


@app.post("/api/bulbs/rescan")
async def rescan_bulbs():
    return await manager.discover(force=True)


@app.post("/api/bulbs/add")
async def add_bulb(body: AddBulbRequest):
    try:
        return await manager.add_bulb_by_ip(body.ip)
    except BulbUnreachable as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No response from {body.ip} — check the IP and that the bulb is powered on.",
        ) from exc


@app.get("/api/bulbs/{ip}/state", response_model=BulbState)
async def get_state(ip: str):
    return await manager.get_state(ip)


@app.post("/api/bulbs/{ip}/power", response_model=BulbState)
async def set_power(ip: str, body: PowerRequest):
    try:
        await manager.set_power(ip, body.on)
    except BulbUnreachable:
        pass
    _trigger(ip)
    return await manager.get_state(ip)


@app.post("/api/bulbs/{ip}/brightness", response_model=BulbState)
async def set_brightness(ip: str, body: BrightnessRequest):
    try:
        await manager.set_brightness(ip, body.brightness)
    except BulbUnreachable:
        pass
    _trigger(ip)
    return await manager.get_state(ip)


@app.post("/api/bulbs/{ip}/color", response_model=BulbState)
async def set_color(ip: str, body: ColorRequest):
    try:
        await manager.set_color(ip, body.r, body.g, body.b)
    except BulbUnreachable:
        pass
    _trigger(ip)
    return await manager.get_state(ip)


@app.post("/api/bulbs/{ip}/temp", response_model=BulbState)
async def set_temp(ip: str, body: TempRequest):
    try:
        await manager.set_temp(ip, body.kelvin)
    except BulbUnreachable:
        pass
    _trigger(ip)
    return await manager.get_state(ip)


@app.post("/api/bulbs/{ip}/scene", response_model=BulbState)
async def set_scene(ip: str, body: SceneRequest):
    try:
        await manager.set_scene(ip, body.sceneId, body.speed)
    except BulbUnreachable:
        pass
    _trigger(ip)
    return await manager.get_state(ip)


@app.get("/api/scenes", response_model=list[SceneInfo])
async def get_scenes():
    return manager.list_scenes()


@app.websocket("/ws/bulbs/{ip}")
async def ws_bulb_state(websocket: WebSocket, ip: str):
    await websocket.accept()
    event = _poll_triggers.setdefault(ip, asyncio.Event())
    last_state: BulbState | None = None
    try:
        while True:
            state = await manager.get_state(ip)
            if last_state is None or state != last_state:
                await websocket.send_json(state.model_dump())
                last_state = state
            event.clear()
            try:
                await asyncio.wait_for(event.wait(), timeout=POLL_INTERVAL)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        logger.info("WS client disconnected for %s", ip)


# --- Serve built frontend in production ---
_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        candidate = _frontend_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_dist / "index.html")
