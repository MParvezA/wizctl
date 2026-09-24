import asyncio
import colorsys
import os
import time
from contextlib import asynccontextmanager
from ipaddress import IPv4Address

from kasa import Credentials, Discover, Module
from kasa.exceptions import KasaException

from .models import BulbInfo, BulbState


class BulbUnreachable(Exception):
    pass


class UnsupportedBulb(Exception):
    pass


class TapoManager:
    """Manual-IP controller for color bulbs, with one serialized session per IP."""

    def __init__(self):
        self._credentials = None
        self._devices = {}
        self._infos = {}
        self._locks = {}
        self._states = {}
        self._updated = {}

    def configure(self):
        username = os.environ.get("KASA_USERNAME")
        password = os.environ.get("KASA_PASSWORD")
        if not username or not password:
            raise RuntimeError("Set KASA_USERNAME and KASA_PASSWORD in the backend terminal.")
        self._credentials = Credentials(username, password)
        for host in os.environ.get("TAPO_HOSTS", "").split(","):
            if host.strip():
                ip = str(IPv4Address(host.strip()))
                self._infos[ip] = BulbInfo(ip=ip, name=ip)

    def contains(self, ip):
        return ip in self._infos

    def list_bulbs(self):
        return list(self._infos.values())

    def _lock(self, ip):
        return self._locks.setdefault(ip, asyncio.Lock())

    async def _drop(self, ip):
        if device := self._devices.pop(ip, None):
            await device.disconnect()

    async def close(self):
        for ip in list(self._devices):
            async with self._lock(ip):
                await self._drop(ip)

    def _offline(self, ip, message):
        previous = self._states.get(ip)
        state = previous.model_copy(update={"reachable": False, "message": message}) if previous else BulbState(
            ip=ip, on=False, brightness=0, mode="unknown", reachable=False, message=message,
        )
        self._remember(ip, state)
        return state

    @asynccontextmanager
    async def _session(self, ip):
        try:
            async with asyncio.timeout(30):
                device = self._devices.get(ip)
                if device is None:
                    device = await Discover.discover_single(
                        ip, credentials=self._credentials, timeout=15, discovery_timeout=5,
                    )
                    if device is None:
                        raise TimeoutError()
                    self._devices[ip] = device
                    await device.update()
                    light = device.modules.get(Module.Light)
                    if light is None or not all(light.has_feature(f) for f in ("hsv", "color_temp", "brightness")):
                        raise UnsupportedBulb("This first version requires a color bulb with adjustable white temperature.")
                    self._infos[ip] = BulbInfo(ip=ip, name=device.alias or ip, mac=device.mac)
                yield device
        except UnsupportedBulb as exc:
            self._offline(ip, str(exc))
            await self._drop(ip)
            raise
        except (KasaException, OSError, TimeoutError) as exc:
            self._offline(ip, "Connection failed. Check power, IP, credentials and Third-Party Compatibility.")
            await self._drop(ip)
            raise BulbUnreachable(f"Bulb {ip} did not respond. Check its connection and try again.") from exc
        except asyncio.CancelledError:
            await self._drop(ip)
            raise

    async def add_bulb_by_ip(self, ip):
        ip = str(IPv4Address(ip))
        async with self._lock(ip):
            async with self._session(ip) as device:
                await device.update()
                self._remember(ip, self._normalize(ip, device))
        return self._infos[ip]

    def _remember(self, ip, state):
        self._states[ip] = state
        self._updated[ip] = time.monotonic()
        return state

    def _normalize(self, ip, device):
        light = device.modules[Module.Light]
        kelvin = light.color_temp
        rgb = None
        if not kelvin:
            hue, saturation, _ = light.hsv
            # The frontend applies brightness separately to the bulb color.
            rgb = tuple(round(v * 255) for v in colorsys.hsv_to_rgb(hue / 360, saturation / 100, 1))
        effect = device.modules.get(Module.LightEffect)
        active_effect = effect is not None and effect.effect != "Off"
        return BulbState(
            ip=ip, on=device.is_on, brightness=light.brightness,
            mode="scene" if active_effect else ("temp" if kelvin else "color"),
            rgb=rgb, kelvin=kelvin or None,
            sceneName=effect.effect if active_effect else None,
            reachable=True,
        )

    async def get_state(self, ip, force=False):
        async with self._lock(ip):
            if not force and time.monotonic() - self._updated.get(ip, 0) < 1:
                return self._states[ip]
            try:
                async with self._session(ip) as device:
                    await device.update()
                    return self._remember(ip, self._normalize(ip, device))
            except (BulbUnreachable, UnsupportedBulb):
                return self._states[ip]

    async def command(self, ip, action, *args):
        async with self._lock(ip):
            async with self._session(ip) as device:
                light = device.modules[Module.Light]
                if action == "power":
                    await (device.turn_on() if args[0] else device.turn_off())
                else:
                    if action == "temp":
                        feature = light.get_feature("color_temp")
                        if not feature.minimum_value <= args[0] <= feature.maximum_value:
                            raise UnsupportedBulb("Temperature is outside this bulb's supported range.")
                    effect = device.modules.get(Module.LightEffect)
                    if effect is not None and effect.effect != "Off":
                        await effect.set_effect("Off")
                    if action == "brightness":
                        await light.set_brightness(args[0])
                    elif action == "color":
                        hue, saturation, _ = colorsys.rgb_to_hsv(*(v / 255 for v in args))
                        await light.set_hsv(round(hue * 360) % 360, round(saturation * 100))
                    elif action == "temp":
                        await light.set_color_temp(args[0])
                    else:
                        raise UnsupportedBulb("Unsupported command.")
                    if not device.is_on:
                        await device.turn_on()
                # Read back under the same lock before reporting success.
                await device.update()
                return self._remember(ip, self._normalize(ip, device))


manager = TapoManager()
