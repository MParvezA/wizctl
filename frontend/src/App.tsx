import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Box, House, Layers2, Lightbulb, ListFilter, Moon, Plus, RefreshCw, Search, SlidersHorizontal, Sun, Wifi, X } from "lucide-react";
import { PowerToggle } from "./components/PowerToggle";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { ColorPicker } from "./components/ColorPicker";
import { TempSlider } from "./components/TempSlider";
import { AddBulbForm } from "./components/AddBulbForm";
import { ModeTabs, type ModeTab } from "./components/ModeTabs";
import { useAddBulb, useBulbList, useRescan } from "./hooks/useBulbs";
import { BulbSubscription, reportedState, snapshotStatus, type LightSnapshot, type LightSnapshots } from "./components/BulbSubscription";
import { RoomCard } from "./components/RoomCard";
import { api } from "./lib/api";
import { HouseScene, ROOMS, type RoomAssignments } from "./components/HouseScene";
import { lightAppearance } from "./components/RoomLight";

const PRESETS = [{ name: "Relax", kelvin: 2700 }, { name: "Everyday", kelvin: 4000 }, { name: "Focus", kelvin: 6000 }];

export default function App() {
  const { data: bulbs = [], isLoading, isError, error } = useBulbList();
  const rescan = useRescan();
  const addBulb = useAddBulb();
  const addDialog = useRef<HTMLDialogElement>(null);
  const devicesDialog = useRef<HTMLDialogElement>(null);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [night, setNight] = useState(true);
  const [view, setView] = useState<"orbit" | "plan">("orbit");
  const [query, setQuery] = useState("");
  const [assignments, setAssignments] = useState<RoomAssignments>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("tapo-controller:rooms") ?? "{}");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([, room]) => ROOMS.some(item => item.id === room)));
    } catch { return {}; }
  });
  const [commandError, setCommandError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModeTab>("white");
  const [snapshots, setSnapshots] = useState<LightSnapshots>({});
  const updateSnapshot = useCallback((ip: string, snapshot: LightSnapshot | null) => {
    setSnapshots(current => {
      const next = { ...current };
      if (snapshot) next[ip] = snapshot; else delete next[ip];
      return next;
    });
  }, []);
  const snapshot = selectedIp ? snapshots[selectedIp] : undefined;
  const connected = Boolean(snapshot?.connected);
  const state = reportedState(snapshot);
  const selected = bulbs.find(bulb => bulb.ip === selectedIp);
  const room = ROOMS.find(item => item.id === (selectedIp ? assignments[selectedIp] : null));
  const ready = Boolean(selected && state?.reachable && connected);
  const isOn = Boolean(ready && state?.on);
  const status = snapshotStatus(snapshot);
  const rgbValue = useMemo(() => ({ r: state?.rgb?.[0] ?? 255, g: state?.rgb?.[1] ?? 214, b: state?.rgb?.[2] ?? 170 }), [state?.rgb]);
  const filtered = bulbs.filter(bulb => `${bulb.name} ${bulb.ip} ${ROOMS.find(item => item.id === assignments[bulb.ip])?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!isLoading && !bulbs.some(bulb => bulb.ip === selectedIp)) setSelectedIp(bulbs[0]?.ip ?? null);
  }, [bulbs, isLoading, selectedIp]);
  useEffect(() => { setCommandError(null); }, [selectedIp]);
  useEffect(() => {
    if (state?.mode === "color") setActiveTab("color");
    if (state?.mode === "temp") setActiveTab("white");
  }, [state?.mode, selectedIp]);


  const assignRoom = (ip: string, id: string) => {
    const next = { ...assignments, [ip]: id }; setAssignments(next);
    try { localStorage.setItem("tapo-controller:rooms", JSON.stringify(next)); }
    catch { setCommandError("Room assigned for this session. Browser storage is unavailable."); }
  };
  const send = (operation: Promise<unknown>) => {
    const ip = selectedIp;
    setCommandError(null);
    operation.catch((failure: unknown) => {
      if (activeIp.current === ip) setCommandError(failure instanceof Error ? failure.message : "Command failed.");
    });
  };
  const activeIp = useRef(selectedIp); activeIp.current = selectedIp;
  const selectLight = (ip: string) => { setSelectedIp(ip); devicesDialog.current?.close(); };
  const showAdd = () => { devicesDialog.current?.close(); addBulb.reset(); addDialog.current?.showModal(); };
  const add = (ip: string) => addBulb.mutate(ip, { onSuccess: bulb => { selectLight(bulb.ip); addDialog.current?.close(); } });
  const homeView = () => { setView("orbit"); setResetKey(value => value + 1); };

  return <div className={`spatial-app ${selected ? "room-focused" : ""} ${night ? "night" : "studio"}`}>
    {bulbs.map(bulb => <BulbSubscription key={bulb.ip} ip={bulb.ip} onUpdate={updateSnapshot} />)}
    <header className="spatial-header">
      <button className="brand" title="Home view" aria-label="Home view" onClick={homeView}><span className="brand-mark"><House size={21} /></span><span>tapo<span className="brand-suffix">home</span></span></button>
      <span className="header-address">PARVEZ'S APARTMENT <i /> 61 m<sup>2</sup></span>
      <div className="header-actions"><span className={`connection-label ${!isError ? "online" : ""}`}><Wifi size={15} />{isError ? "Controller offline" : isLoading ? "Connecting" : "Local controller"}</span><button className="icon-button" aria-label="Manage lights" title="Manage lights" onClick={() => devicesDialog.current?.showModal()}><ListFilter size={18} /></button><button className="icon-button" aria-label={night ? "Studio lighting" : "Night lighting"} title={night ? "Studio lighting" : "Night lighting"} aria-pressed={night} onClick={() => setNight(value => !value)}>{night ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button" title="Refresh lights" aria-label="Refresh lights" disabled={rescan.isPending} onClick={() => rescan.mutate()}><RefreshCw size={16} className={rescan.isPending ? "spinning" : ""} /></button></div>
    </header>

    <main className="spatial-world">
      <div className="world-heading"><p className="eyebrow">HOME / LIGHTING</p><h1>Apartment</h1><span>Single floor / 61 m<sup>2</sup></span></div>
      <div className="view-switch" role="group" aria-label="Camera view"><button title="3D view" aria-label="3D view" aria-pressed={view === "orbit"} onClick={() => setView("orbit")}><Box size={17} /></button><button title="Floor plan" aria-label="Floor plan" aria-pressed={view === "plan"} onClick={() => setView("plan")}><Layers2 size={17} /></button></div>
      <HouseScene assignments={assignments} bulbs={bulbs} selectedIp={selectedIp} snapshots={snapshots} onSelect={selectLight} resetKey={resetKey} night={night} view={view} onHome={homeView} />
      {(isError || rescan.isError) && <div className="world-alert" role="alert">{(error ?? rescan.error)?.message ?? "Controller unavailable"}<button onClick={() => rescan.mutate()}>Retry</button></div>}

      {selected && <section className="control-panel" aria-labelledby="control-heading" key={selectedIp}>
        <div className="sheet-handle" />
        <div className="panel-heading"><span className="panel-eyebrow"><SlidersHorizontal size={13} />LIGHTING</span><span className="panel-room-name">{room?.name ?? "Unassigned"}</span></div>
        <div className="light-identity"><span className="light-emblem" style={{ color: ready && isOn ? lightAppearance(state).color : undefined }}><Lightbulb size={27} strokeWidth={1.4} /></span><div><h2 id="control-heading">{selected.name}</h2><span className="panel-status"><i className={ready && isOn ? "lit" : ""} />{status}<span>{selected.ip}</span></span></div><PowerToggle on={isOn} disabled={!ready} onToggle={on => send(api.setPower(selected.ip, on))} /></div>
        {commandError && <p role="alert" className="control-error">{commandError}</p>}
        {state?.message && !state.reachable && <p role="status" className="control-error">{state.message}</p>}
        <div className="control-section"><BrightnessSlider value={state?.brightness ?? 50} disabled={!ready} onChange={value => send(api.setBrightness(selected.ip, value))} /></div>
        <div className="control-section"><ModeTabs active={activeTab} disabled={!ready} onSelect={setActiveTab} /><div className="mode-content">{activeTab === "white" ? <><TempSlider value={state?.kelvin || 2700} disabled={!ready} onChange={value => send(api.setTemp(selected.ip, value))} /><div className="preset-list">{PRESETS.map(preset => <button key={preset.name} disabled={!ready} aria-pressed={state?.mode === "temp" && state.kelvin === preset.kelvin} onClick={() => send(api.setTemp(selected.ip, preset.kelvin))}><span className={`temperature-swatch temperature-${preset.name.toLowerCase()}`} /><span>{preset.name}</span><small>{preset.kelvin} K</small></button>)}</div></> : <ColorPicker value={rgbValue} disabled={!ready} onChange={({ r, g, b }) => send(api.setColor(selected.ip, r, g, b))} />}</div></div>
        <div className="room-assignment"><label htmlFor="bulb-room">Room</label><select id="bulb-room" value={assignments[selected.ip] ?? ""} onChange={event => assignRoom(selected.ip, event.target.value)}><option value="">Unassigned</option>{ROOMS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="panel-footer"><Wifi size={12} /><span>{connected ? "Live connection" : "Reconnecting"}</span><span>TAPO / LAN</span></div>
      </section>}
      {!selected && <section className="control-panel empty-panel"><Lightbulb size={30} /><h2>{isError ? "Controller unavailable" : "No lights configured"}</h2><button className="text-button" onClick={showAdd}><Plus size={16} />Add light</button></section>}
    </main>

    <section className="room-strip" aria-label="Room lighting">
      <div className="room-strip-heading"><span>YOUR LIGHTS <small>{bulbs.length.toString().padStart(2, "0")}</small></span><button className="text-button" onClick={showAdd}><Plus size={14} />Add light</button></div>
      <div className="room-cards">{bulbs.map(bulb => <RoomCard key={bulb.ip} bulb={bulb} roomName={ROOMS.find(item => item.id === assignments[bulb.ip])?.name} snapshot={snapshots[bulb.ip]} selected={bulb.ip === selectedIp} onSelect={selectLight} />)}{!bulbs.length && <p className="empty-state">{isLoading ? "Connecting..." : isError ? "Controller unavailable" : "No lights configured"}</p>}</div>
    </section>

    <dialog ref={devicesDialog} className="devices-dialog" onClick={event => { if (event.target === devicesDialog.current) devicesDialog.current.close(); }}><div className="dialog-heading"><div><p className="eyebrow">YOUR DEVICES</p><h2>Lights <span>{bulbs.length}</span></h2></div><button className="icon-button" aria-label="Close devices" title="Close" onClick={() => devicesDialog.current?.close()}><X size={19} /></button></div><label className="search-field"><Search size={16} /><input type="search" aria-label="Search lights and rooms" placeholder="Search lights or rooms" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="device-list">{filtered.map(bulb => <button key={bulb.ip} onClick={() => selectLight(bulb.ip)}><Lightbulb size={18} /><span><strong>{bulb.name}</strong><small>{ROOMS.find(item => item.id === assignments[bulb.ip])?.name ?? "Unassigned"} / {bulb.ip}</small></span><ArrowUpRight size={16} /></button>)}{!filtered.length && <p className="empty-state">{bulbs.length ? "No matching lights" : "No lights configured"}</p>}</div><button className="text-button" onClick={showAdd}><Plus size={16} />Add light</button><footer className="template-credit">Theme foundations: <a href="https://themewagon.com/themes/smart-home/" target="_blank" rel="noreferrer">SmartHome / ThemeWagon</a></footer></dialog>
    <dialog ref={addDialog} className="add-dialog" onClick={event => { if (event.target === addDialog.current) addDialog.current.close(); }}><div className="dialog-heading"><h2>Add a light</h2><button className="icon-button" aria-label="Close add light" title="Close" onClick={() => addDialog.current?.close()}><X size={19} /></button></div><AddBulbForm pending={addBulb.isPending} error={addBulb.isError ? addBulb.error.message : null} onAdd={add} /></dialog>
  </div>;
}
