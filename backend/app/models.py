from typing import Literal, Optional
from ipaddress import IPv4Address
from pydantic import BaseModel, Field, field_validator


class BulbInfo(BaseModel):
    ip: str
    mac: Optional[str] = None
    name: str


class AddBulbRequest(BaseModel):
    ip: str

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, value: str) -> str:
        return str(IPv4Address(value.strip()))


class BulbState(BaseModel):
    ip: str
    on: bool
    brightness: int = Field(ge=0, le=100)
    mode: Literal["color", "temp", "scene", "unknown"]
    rgb: Optional[tuple[int, int, int]] = None
    kelvin: Optional[int] = None
    sceneId: Optional[int] = None
    sceneName: Optional[str] = None
    speed: Optional[int] = None
    reachable: bool
    rssi: Optional[int] = None
    message: Optional[str] = None


class PowerRequest(BaseModel):
    on: bool


class BrightnessRequest(BaseModel):
    brightness: int = Field(ge=10, le=100)


class ColorRequest(BaseModel):
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)


class TempRequest(BaseModel):
    kelvin: int = Field(ge=2500, le=6500)


class SceneRequest(BaseModel):
    sceneId: int
    speed: Optional[int] = Field(default=None, ge=10, le=200)


class SceneInfo(BaseModel):
    id: int
    name: str
    dynamic: bool
