import { useEffect, useMemo, useState } from "react";
import { Glow } from "./components/Glow";
import { BulbIcon } from "./components/BulbIcon";
import { BulbSelector } from "./components/BulbSelector";
import { PowerToggle } from "./components/PowerToggle";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { ColorPicker } from "./components/ColorPicker";
import { TempSlider } from "./components/TempSlider";
import { WhitePresets } from "./components/WhitePresets";
import { SceneGrid } from "./components/SceneGrid";
import { SpeedSlider } from "./components/SpeedSlider";
import { StatusPanel } from "./components/StatusPanel";
import { AddBulbForm } from "./components/AddBulbForm";
import { ModeTabs, type ModeTab } from "./components/ModeTabs";
import { useAddBulb, useBulbList, useRescan, useScenes } from "./hooks/useBulbs";
import { useBulbState } from "./hooks/useBulbState";
import { api } from "./lib/api";

const LAST_IP_KEY = "wiz-controller:last-ip";
const DEFAULT_SPEED = 100;

function noop() {
  /* commands are reflected via websocket state, not their own response */
}

export default function App() {
  const { data: bulbs = [], isLoading: loadingBulbs } = useBulbList();
  const { data: scenes = [] } = useScenes();
  const rescan = useRescan();
  const addBulb = useAddBulb();
  const [showAddForm, setShowAddForm] = useState(false);

  const [selectedIp, setSelectedIp] = useState<string | null>(() =>
    localStorage.getItem(LAST_IP_KEY),
  );

  const handleAddBulb = (ip: string) => {
    addBulb.mutate(ip, {
      onSuccess: (bulb) => {
        setSelectedIp(bulb.ip);
        setShowAddForm(false);
      },
    });
  };

  useEffect(() => {
    if (selectedIp) return;
    if (bulbs.length > 0) setSelectedIp(bulbs[0].ip);
  }, [bulbs, selectedIp]);

  useEffect(() => {
    if (bulbs.length === 0) return;
    if (selectedIp && !bulbs.some((b) => b.ip === selectedIp)) {
      setSelectedIp(bulbs[0].ip);
    }
  }, [bulbs, selectedIp]);

  useEffect(() => {
    if (selectedIp) localStorage.setItem(LAST_IP_KEY, selectedIp);
  }, [selectedIp]);

  const { state, connected } = useBulbState(selectedIp);

  const dynamicScenes = useMemo(() => scenes.filter((s) => s.dynamic), [scenes]);
  const whiteScenes = useMemo(() => scenes.filter((s) => !s.dynamic), [scenes]);

  const [activeTab, setActiveTab] = useState<ModeTab>("white");

  // Mirror the bulb's real mode into the tab whenever it actually changes —
  // e.g. someone picked a scene from the official app — so the UI keeps
  // showing what the bulb is really doing rather than what was last clicked
  // here. A no-op if the tab already matches.
  useEffect(() => {
    if (!state) return;
    if (state.mode === "color") setActiveTab("color");
    else if (state.mode === "temp") setActiveTab("white");
    else if (state.mode === "scene") setActiveTab("scenes");
  }, [state?.mode]);

  const rgbValue = useMemo<{ r: number; g: number; b: number }>(() => {
    if (state?.rgb) return { r: state.rgb[0], g: state.rgb[1], b: state.rgb[2] };
    return { r: 255, g: 214, b: 170 };
  }, [state?.rgb]);

  const kelvinValue = state?.kelvin ?? 2700;
  const brightnessValue = state?.brightness ?? 100;
  const isOn = state?.on ?? false;
  const isReachable = state?.reachable ?? false;
  const controlsDisabled = !selectedIp || !isReachable;

  const activeSceneId = state?.mode === "scene" ? (state.sceneId ?? null) : null;
  const activeSceneIsDynamic =
    activeSceneId != null && dynamicScenes.some((s) => s.id === activeSceneId);
  const speedValue = state?.speed ?? DEFAULT_SPEED;

  const handleSelectScene = (sceneId: number) => {
    if (!selectedIp) return;
    const isDynamic = dynamicScenes.some((s) => s.id === sceneId);
    api.setScene(selectedIp, sceneId, isDynamic ? speedValue : undefined).catch(noop);
  };

  const handleSpeedChange = (speed: number) => {
    if (!selectedIp || activeSceneId == null) return;
    api.setScene(selectedIp, activeSceneId, speed).catch(noop);
  };

  if (!loadingBulbs && bulbs.length === 0) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center px-6 py-12">
        <Glow state={null} />
        <div className="relative max-w-sm text-center">
          <h1 className="text-lg font-medium text-neutral-200">No bulbs found</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Is Local Control enabled in the WiZ app, and is this machine on the same
            2.4GHz network as your bulbs?
          </p>
          <button
            onClick={() => rescan.mutate()}
            disabled={rescan.isPending}
            className="mt-5 rounded-full border border-room-600 bg-room-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-room-700 disabled:opacity-50"
          >
            {rescan.isPending ? "Scanning…" : "Rescan"}
          </button>

          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-xs text-neutral-600">
              Know the bulb's IP already? Broadcast discovery can fail on some
              networks (common on Mac Wi-Fi) even when the bulb is reachable directly.
            </p>
            <AddBulbForm
              pending={addBulb.isPending}
              error={addBulb.isError ? (addBulb.error as Error).message : null}
              onAdd={handleAddBulb}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh">
      <Glow state={state} />

      <div className="relative mx-auto flex w-full max-w-lg flex-col px-5 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-medium tracking-wide text-neutral-400">WiZ</h1>
            <p className="font-mono mono text-[11px] text-neutral-600">local control</p>
          </div>
          <div className="flex items-center gap-3">
            <BulbSelector
              bulbs={bulbs}
              selectedIp={selectedIp ?? ""}
              onSelect={setSelectedIp}
            />
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
            >
              {showAddForm ? "cancel" : "+ add by IP"}
            </button>
          </div>
        </header>

        {showAddForm && (
          <div className="mt-4 flex justify-end">
            <AddBulbForm
              pending={addBulb.isPending}
              error={addBulb.isError ? (addBulb.error as Error).message : null}
              onAdd={handleAddBulb}
            />
          </div>
        )}

        <div className="flex items-center justify-center py-8 sm:py-10">
          <BulbIcon state={state} />
        </div>

        <div className="flex flex-col gap-6 rounded-3xl border border-room-700 bg-room-900/70 p-5 backdrop-blur-md sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Power</span>
            <PowerToggle
              on={isOn}
              disabled={!selectedIp || !isReachable}
              onToggle={(on) => {
                if (!selectedIp) return;
                api.setPower(selectedIp, on).catch(noop);
              }}
            />
          </div>

          <StatusPanel state={state} wsConnected={connected} />

          <div className="h-px bg-room-700" />

          <BrightnessSlider
            value={brightnessValue}
            disabled={controlsDisabled}
            onChange={(brightness) => {
              if (!selectedIp) return;
              api.setBrightness(selectedIp, brightness).catch(noop);
            }}
          />

          <div className="h-px bg-room-700" />

          <ModeTabs active={activeTab} disabled={controlsDisabled} onSelect={setActiveTab} />

          {activeTab === "white" && (
            <div className="flex flex-col gap-6">
              <TempSlider
                value={kelvinValue}
                disabled={controlsDisabled}
                onChange={(kelvin) => {
                  if (!selectedIp) return;
                  api.setTemp(selectedIp, kelvin).catch(noop);
                }}
              />
              <WhitePresets
                presets={whiteScenes}
                activeSceneId={activeSceneId}
                disabled={controlsDisabled}
                onSelect={handleSelectScene}
              />
            </div>
          )}

          {activeTab === "color" && (
            <ColorPicker
              value={rgbValue}
              disabled={controlsDisabled}
              onChange={({ r, g, b }) => {
                if (!selectedIp) return;
                api.setColor(selectedIp, r, g, b).catch(noop);
              }}
            />
          )}

          {activeTab === "scenes" && (
            <div className="flex flex-col gap-6">
              <SceneGrid
                scenes={dynamicScenes}
                activeSceneId={activeSceneId}
                disabled={controlsDisabled}
                onSelect={handleSelectScene}
              />
              <SpeedSlider
                value={speedValue}
                disabled={controlsDisabled || !activeSceneIsDynamic}
                onChange={handleSpeedChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
