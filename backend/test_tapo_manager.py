import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from kasa import Module
from pydantic import ValidationError

from app.models import AddBulbRequest, TempRequest
from app.tapo_manager import BulbUnreachable, TapoManager, UnsupportedBulb

IP = "10.110.162.109"


class FakeBulb:
    def __init__(self):
        self.alias = "Bedroom"
        self.mac = "00:11:22:33:44:55"
        self.is_on = True
        self.active_calls = 0
        self.maximum_calls = 0
        self.fail_update = False
        self.closed = False
        self.light = SimpleNamespace(
            brightness=47, color_temp=0, hsv=(277, 86, 47),
            has_feature=lambda f: True,
            get_feature=lambda f: SimpleNamespace(minimum_value=2500, maximum_value=6500),
            set_brightness=self.set_brightness,
            set_hsv=self.set_hsv,
            set_color_temp=self.set_color_temp,
        )
        self.modules = {Module.Light: self.light}

    async def step(self):
        self.active_calls += 1
        self.maximum_calls = max(self.maximum_calls, self.active_calls)
        await asyncio.sleep(0)
        self.active_calls -= 1

    async def update(self):
        await self.step()
        if self.fail_update:
            raise TimeoutError()

    async def disconnect(self):
        self.closed = True

    async def turn_on(self):
        await self.step()
        self.is_on = True

    async def turn_off(self):
        await self.step()
        self.is_on = False

    async def set_brightness(self, value):
        await self.step()
        self.light.brightness = value

    async def set_hsv(self, hue, saturation):
        await self.step()
        self.light.color_temp = 0
        self.light.hsv = (hue, saturation, self.light.brightness)

    async def set_color_temp(self, kelvin):
        await self.step()
        self.light.color_temp = kelvin


class ManagerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.manager = TapoManager()
        with patch.dict(os.environ, {"KASA_USERNAME": "test", "KASA_PASSWORD": "test", "TAPO_HOSTS": IP}):
            self.manager.configure()
        self.bulb = FakeBulb()
        self.discover = AsyncMock(return_value=self.bulb)
        self.mock = patch("app.tapo_manager.Discover.discover_single", self.discover)
        self.mock.start()

    async def asyncTearDown(self):
        await self.manager.close()
        self.mock.stop()

    async def test_reuses_session_and_serializes_commands_and_polling(self):
        states = await asyncio.gather(
            self.manager.command(IP, "brightness", 50),
            self.manager.command(IP, "brightness", 70),
            self.manager.get_state(IP, force=True),
        )
        self.assertEqual([s.brightness for s in states], [50, 70, 70])
        self.assertEqual(self.discover.await_count, 1)
        self.assertEqual(self.bulb.maximum_calls, 1)

    async def test_power_color_and_white_readback(self):
        self.assertFalse((await self.manager.command(IP, "power", False)).on)
        state = await self.manager.command(IP, "color", 255, 0, 0)
        self.assertTrue(state.on)
        self.assertEqual(state.rgb, (255, 0, 0))
        self.assertEqual(state.brightness, 47)
        state = await self.manager.command(IP, "temp", 3000)
        self.assertEqual(state.mode, "temp")
        self.assertEqual(state.kelvin, 3000)
        self.assertIsNone(state.rgb)

    async def test_timeout_preserves_last_state_closes_and_reconnects(self):
        await self.manager.command(IP, "brightness", 70)
        self.bulb.fail_update = True
        state = await self.manager.get_state(IP, force=True)
        self.assertFalse(state.reachable)
        self.assertEqual(state.brightness, 70)
        self.assertTrue(self.bulb.closed)
        fresh = FakeBulb()
        self.discover.return_value = fresh
        self.assertTrue((await self.manager.get_state(IP, force=True)).reachable)
        self.assertEqual(self.discover.await_count, 2)

    async def test_failed_readback_does_not_report_command_success(self):
        await self.manager.get_state(IP)
        self.bulb.fail_update = True
        with self.assertRaises(BulbUnreachable):
            await self.manager.command(IP, "brightness", 70)
        self.assertFalse((await self.manager.get_state(IP)).reachable)

    async def test_failed_initial_update_closes_session(self):
        self.bulb.fail_update = True
        self.assertFalse((await self.manager.get_state(IP)).reachable)
        self.assertTrue(self.bulb.closed)

    async def test_non_color_bulb_is_explicitly_rejected(self):
        self.bulb.light.has_feature = lambda f: f == "brightness"
        with self.assertRaises(UnsupportedBulb):
            await self.manager.add_bulb_by_ip(IP)
        self.assertTrue(self.bulb.closed)

    async def test_duplicate_add_retains_single_bulb(self):
        await self.manager.add_bulb_by_ip(IP)
        await self.manager.add_bulb_by_ip(IP)
        self.assertEqual(len(self.manager.list_bulbs()), 1)
        self.assertEqual(self.manager.list_bulbs()[0].name, "Bedroom")

    async def test_shutdown_closes_session(self):
        await self.manager.get_state(IP)
        await self.manager.close()
        self.assertTrue(self.bulb.closed)

    def test_input_validation(self):
        with self.assertRaises(ValidationError):
            TempRequest(kelvin=2200)
        with self.assertRaises(ValidationError):
            AddBulbRequest(ip="not-an-ip")


if __name__ == "__main__":
    unittest.main()
