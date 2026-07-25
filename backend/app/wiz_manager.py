import asyncio
import logging
import os
from typing import Optional

from pywizlight import wizlight, PilotBuilder
from pywizlight.discovery import discover_lights
from pywizlight.exceptions import WizLightError

# pywizlight raises its own exception hierarchy (WizLightError and
# subclasses) for UDP send/recv failures rather than stdlib OSError, so every
# bulb call must catch this alongside asyncio.TimeoutError/OSError.
BULB_ERRORS = (asyncio.TimeoutError, OSError, ConnectionError, WizLightError)

try:
    from pywizlight.scenes import SCENES
except ImportError:
    SCENES = {}

from .models import BulbInfo, BulbState, SceneInfo

logger = logging.getLogger("wiz_manager")

DISCOVERY_TIMEOUT = 5.0
COMMAND_TIMEOUT = 3.0
STATE_TIMEOUT = 3.0

DEFAULT_BROADCAST = os.environ.get("WIZ_BROADCAST_ADDR", "255.255.255.255")

# Built-in WiZ "scenes" that are actually static white looks rather than
# moving/color effects — surfaced as White presets in the UI instead of the
# scene grid, and never take a speed parameter.
WHITE_SCENE_IDS = {11, 12, 13, 14, 30, 34, 40}

# Rhythm (synced-to-music placeholder, id 1000) and the ten unconfigured
# "Custom Mode" slots (256-265) aren't real selectable scenes — pywizlight
# just reports them if the bulb happens to be in that state.
EXCLUDED_SCENE_IDS = {1000, *range(256, 266)}


def brightness_to_255(pct: int) -> int:
    return round(max(10, min(100, pct)) * 255 / 100)


def brightness_to_pct(value: Optional[int]) -> int:
    if value is None:
        return 0
    return round(max(0, min(255, value)) * 100 / 255)


class WizManager:
    """Owns discovery cache and per-bulb wizlight client instances."""

    def __init__(self, broadcast_space: str = DEFAULT_BROADCAST):
        self.broadcast_space = broadcast_space
        self._bulbs_by_ip: dict[str, wizlight] = {}
        self._info_cache: list[BulbInfo] = []
        self._lock = asyncio.Lock()

    async def discover(self, force: bool = False) -> list[BulbInfo]:
        async with self._lock:
            if self._info_cache and not force:
                return self._info_cache

            try:
                found = await asyncio.wait_for(
                    discover_lights(broadcast_space=self.broadcast_space),
                    timeout=DISCOVERY_TIMEOUT,
                )
            except BULB_ERRORS as exc:
                logger.warning("Discovery failed: %s", exc)
                found = []

            infos: list[BulbInfo] = []
            for bulb in found:
                ip = bulb.ip
                self._bulbs_by_ip[ip] = bulb
                mac = None
                name = ip
                try:
                    bulb_type = await asyncio.wait_for(bulb.get_bulbtype(), timeout=STATE_TIMEOUT)
                    if bulb_type is not None:
                        name = getattr(bulb_type, "name", None) or ip
                except Exception:
                    pass
                try:
                    mac = await asyncio.wait_for(bulb.getMac(), timeout=STATE_TIMEOUT)
                except Exception:
                    mac = None
                infos.append(BulbInfo(ip=ip, mac=mac, name=name))

            self._info_cache = infos
            return infos

    async def add_bulb_by_ip(self, ip: str) -> BulbInfo:
        """Add a bulb directly by IP, bypassing UDP broadcast discovery.

        Useful when broadcast discovery doesn't work on the host's network
        (common on macOS Wi-Fi, where broadcast replies get dropped even
        though direct unicast UDP to the bulb works fine) but the bulb's
        IP is already known.
        """
        async with self._lock:
            bulb = self._get_or_create(ip)
            name = ip
            mac = None
            try:
                await asyncio.wait_for(bulb.updateState(), timeout=STATE_TIMEOUT)
            except BULB_ERRORS as exc:
                self._drop(ip)
                raise BulbUnreachable(str(exc)) from exc

            try:
                bulb_type = await asyncio.wait_for(bulb.get_bulbtype(), timeout=STATE_TIMEOUT)
                if bulb_type is not None:
                    name = getattr(bulb_type, "name", None) or ip
            except Exception:
                pass
            try:
                mac = await asyncio.wait_for(bulb.getMac(), timeout=STATE_TIMEOUT)
            except Exception:
                mac = None

            info = BulbInfo(ip=ip, mac=mac, name=name)
            self._info_cache = [b for b in self._info_cache if b.ip != ip] + [info]
            return info

    def _get_or_create(self, ip: str) -> wizlight:
        if ip not in self._bulbs_by_ip:
            self._bulbs_by_ip[ip] = wizlight(ip)
        return self._bulbs_by_ip[ip]

    def _drop(self, ip: str) -> None:
        """Evict a cached wizlight instance after a failed call.

        pywizlight opens one UDP socket per instance and never recreates it
        (_ensure_connection only builds a transport if one doesn't already
        exist). If that socket ever hits an OS-level error, every future send
        on it fails the same way forever — so we must throw the instance away
        and let the next call build a fresh one instead of getting stuck.
        """
        bulb = self._bulbs_by_ip.pop(ip, None)
        if bulb is not None and bulb.transport is not None:
            bulb.transport.close()

    async def get_state(self, ip: str) -> BulbState:
        bulb = self._get_or_create(ip)
        try:
            await asyncio.wait_for(bulb.updateState(), timeout=STATE_TIMEOUT)
        except BULB_ERRORS as exc:
            logger.info("Bulb %s unreachable: %s", ip, exc)
            self._drop(ip)
            return BulbState(
                ip=ip,
                on=False,
                brightness=0,
                mode="unknown",
                reachable=False,
                message="Bulb did not respond — check power and network.",
            )

        state_list = bulb.state
        state = state_list[0] if state_list else None
        if state is None:
            return BulbState(
                ip=ip,
                on=False,
                brightness=0,
                mode="unknown",
                reachable=False,
                message="No state returned by bulb.",
            )

        return self._normalize(ip, state)

    def _normalize(self, ip: str, state) -> BulbState:
        on = bool(state.get_state())
        brightness = brightness_to_pct(state.get_brightness())
        rgb = state.get_rgb()
        kelvin = state.get_colortemp()

        rgb_valid = rgb is not None and all(c is not None for c in rgb)

        scene_id_val = state.get_scene_id()
        scene_name = SCENES.get(scene_id_val) if scene_id_val is not None else None

        mode = "unknown"
        if scene_id_val is not None:
            mode = "scene"
        elif rgb_valid and any(c > 0 for c in rgb):
            mode = "color"
        elif kelvin:
            mode = "temp"
        elif on:
            mode = "temp"

        rssi = None
        try:
            rssi = state.pilotResult.get("rssi")
        except Exception:
            rssi = None

        speed = state.get_speed() if mode == "scene" else None

        return BulbState(
            ip=ip,
            on=on,
            brightness=brightness,
            mode=mode,
            # rgb/kelvin are reported whenever the bulb has them, regardless of
            # active mode — the frontend glow uses whichever is available to
            # render an accurate ambient color even for white-look scenes.
            rgb=tuple(int(c) for c in rgb) if rgb_valid else None,
            kelvin=kelvin,
            sceneId=scene_id_val,
            sceneName=scene_name,
            speed=speed,
            reachable=True,
            rssi=rssi,
        )

    async def set_power(self, ip: str, on: bool) -> None:
        bulb = self._get_or_create(ip)
        try:
            if on:
                await asyncio.wait_for(bulb.turn_on(), timeout=COMMAND_TIMEOUT)
            else:
                await asyncio.wait_for(bulb.turn_off(), timeout=COMMAND_TIMEOUT)
        except BULB_ERRORS as exc:
            self._drop(ip)
            raise BulbUnreachable(str(exc)) from exc

    async def set_brightness(self, ip: str, brightness_pct: int) -> None:
        bulb = self._get_or_create(ip)
        try:
            await asyncio.wait_for(
                bulb.turn_on(PilotBuilder(brightness=brightness_to_255(brightness_pct))),
                timeout=COMMAND_TIMEOUT,
            )
        except BULB_ERRORS as exc:
            self._drop(ip)
            raise BulbUnreachable(str(exc)) from exc

    async def set_color(self, ip: str, r: int, g: int, b: int) -> None:
        bulb = self._get_or_create(ip)
        try:
            await asyncio.wait_for(
                bulb.turn_on(PilotBuilder(rgb=(r, g, b))),
                timeout=COMMAND_TIMEOUT,
            )
        except BULB_ERRORS as exc:
            self._drop(ip)
            raise BulbUnreachable(str(exc)) from exc

    async def set_temp(self, ip: str, kelvin: int) -> None:
        bulb = self._get_or_create(ip)
        try:
            await asyncio.wait_for(
                bulb.turn_on(PilotBuilder(colortemp=kelvin)),
                timeout=COMMAND_TIMEOUT,
            )
        except BULB_ERRORS as exc:
            self._drop(ip)
            raise BulbUnreachable(str(exc)) from exc

    async def set_scene(self, ip: str, scene_id: int, speed: Optional[int] = None) -> None:
        bulb = self._get_or_create(ip)
        builder_kwargs = {"scene": scene_id}
        if speed is not None and scene_id not in WHITE_SCENE_IDS:
            builder_kwargs["speed"] = speed
        try:
            await asyncio.wait_for(
                bulb.turn_on(PilotBuilder(**builder_kwargs)),
                timeout=COMMAND_TIMEOUT,
            )
        except BULB_ERRORS as exc:
            self._drop(ip)
            raise BulbUnreachable(str(exc)) from exc

    def list_scenes(self) -> list[SceneInfo]:
        return [
            SceneInfo(id=i, name=n, dynamic=i not in WHITE_SCENE_IDS)
            for i, n in sorted(SCENES.items())
            if i not in EXCLUDED_SCENE_IDS
        ]


class BulbUnreachable(Exception):
    pass


manager = WizManager()
