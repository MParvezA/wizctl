export interface BulbInfo {
  ip: string;
  mac: string | null;
  name: string;
}

export type BulbMode = "color" | "temp" | "white" | "scene" | "unknown";

export interface BulbState {
  ip: string;
  on: boolean;
  brightness: number;
  supportsColor: boolean;
  supportsColorTemp: boolean;
  mode: BulbMode;
  rgb: [number, number, number] | null;
  kelvin: number | null;
  sceneId: number | null;
  sceneName: string | null;
  speed: number | null;
  reachable: boolean;
  rssi: number | null;
  message: string | null;
}

export interface SceneInfo {
  id: number;
  name: string;
  dynamic: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch {
      // response body wasn't JSON — fall back to the generic message below
    }
    throw new Error(detail ?? `${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getBulbs: () => request<BulbInfo[]>("/api/bulbs"),
  rescanBulbs: () => request<BulbInfo[]>("/api/bulbs/rescan", { method: "POST" }),
  addBulb: (ip: string) =>
    request<BulbInfo>("/api/bulbs/add", {
      method: "POST",
      body: JSON.stringify({ ip }),
    }),
  getState: (ip: string) => request<BulbState>(`/api/bulbs/${ip}/state`),
  getScenes: () => request<SceneInfo[]>("/api/scenes"),

  setPower: (ip: string, on: boolean) =>
    request<BulbState>(`/api/bulbs/${ip}/power`, {
      method: "POST",
      body: JSON.stringify({ on }),
    }),

  setBrightness: (ip: string, brightness: number) =>
    request<BulbState>(`/api/bulbs/${ip}/brightness`, {
      method: "POST",
      body: JSON.stringify({ brightness }),
    }),

  setColor: (ip: string, r: number, g: number, b: number) =>
    request<BulbState>(`/api/bulbs/${ip}/color`, {
      method: "POST",
      body: JSON.stringify({ r, g, b }),
    }),

  setTemp: (ip: string, kelvin: number) =>
    request<BulbState>(`/api/bulbs/${ip}/temp`, {
      method: "POST",
      body: JSON.stringify({ kelvin }),
    }),

  setScene: (ip: string, sceneId: number, speed?: number) =>
    request<BulbState>(`/api/bulbs/${ip}/scene`, {
      method: "POST",
      body: JSON.stringify(speed !== undefined ? { sceneId, speed } : { sceneId }),
    }),
};
