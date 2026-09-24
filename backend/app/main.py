import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .models import (
    AddBulbRequest, BulbState, PowerRequest, BrightnessRequest,
    ColorRequest, TempRequest, SceneRequest, SceneInfo,
)
from .tapo_manager import manager, BulbUnreachable, UnsupportedBulb

POLL_INTERVAL = 2.0
_poll_triggers: dict[str, asyncio.Event] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.configure()
    try:
        yield
    finally:
        await manager.close()


app = FastAPI(title="Tapo Local Control", lifespan=lifespan)


@app.exception_handler(BulbUnreachable)
async def unreachable_handler(request, exc):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(UnsupportedBulb)
async def unsupported_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


def require_bulb(ip: str) -> None:
    if not manager.contains(ip):
        raise HTTPException(status_code=404, detail="Add this bulb by IP first.")


async def command(ip: str, action: str, *args) -> BulbState:
    require_bulb(ip)
    try:
        return await manager.command(ip, action, *args)
    finally:
        if event := _poll_triggers.get(ip):
            event.set()


@app.get("/api/bulbs")
async def get_bulbs():
    return manager.list_bulbs()


@app.post("/api/bulbs/rescan")
async def rescan_bulbs():
    await asyncio.gather(*(manager.get_state(b.ip, force=True) for b in manager.list_bulbs()))
    return manager.list_bulbs()


@app.post("/api/bulbs/add")
async def add_bulb(body: AddBulbRequest):
    return await manager.add_bulb_by_ip(body.ip)


@app.get("/api/bulbs/{ip}/state", response_model=BulbState)
async def get_state(ip: str):
    require_bulb(ip)
    return await manager.get_state(ip)


@app.post("/api/bulbs/{ip}/power", response_model=BulbState)
async def set_power(ip: str, body: PowerRequest):
    return await command(ip, "power", body.on)


@app.post("/api/bulbs/{ip}/brightness", response_model=BulbState)
async def set_brightness(ip: str, body: BrightnessRequest):
    return await command(ip, "brightness", body.brightness)


@app.post("/api/bulbs/{ip}/color", response_model=BulbState)
async def set_color(ip: str, body: ColorRequest):
    return await command(ip, "color", body.r, body.g, body.b)


@app.post("/api/bulbs/{ip}/temp", response_model=BulbState)
async def set_temp(ip: str, body: TempRequest):
    return await command(ip, "temp", body.kelvin)


@app.post("/api/bulbs/{ip}/scene", response_model=BulbState)
async def set_scene(ip: str, body: SceneRequest):
    raise HTTPException(status_code=422, detail="WiZ scenes are not supported by this Tapo adapter.")


@app.get("/api/scenes", response_model=list[SceneInfo])
async def get_scenes():
    return []


@app.websocket("/ws/bulbs/{ip}")
async def ws_bulb_state(websocket: WebSocket, ip: str):
    if not manager.contains(ip):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    event = _poll_triggers.setdefault(ip, asyncio.Event())

    async def publish():
        last_state = None
        while True:
            event.clear()
            state = await manager.get_state(ip)
            if state != last_state:
                await websocket.send_json(state.model_dump())
                last_state = state
            try:
                await asyncio.wait_for(event.wait(), timeout=POLL_INTERVAL)
            except TimeoutError:
                pass

    async def receive():
        while True:
            await websocket.receive_text()

    # Detect disconnects even when the bulb state never changes.
    tasks = [asyncio.create_task(publish()), asyncio.create_task(receive())]
    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    except (WebSocketDisconnect, OSError):
        pass
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        candidate = (_frontend_dist / full_path).resolve()
        if candidate.is_relative_to(_frontend_dist) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_dist / "index.html")
