import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { reportedState, type LightSnapshots } from "./BulbSubscription";
import { RoomLight, lightAppearance } from "./RoomLight";
import type { BulbInfo, BulbState } from "../lib/api";

export const ROOMS = [
  { id: "living", name: "Living room", short: "LR", x: -1.9, z: -2, w: 4.2, d: 5.6, color: 0x89735b },
  { id: "balcony", name: "Balcony", short: "BAL", x: 2.1, z: -4.15, w: 3.8, d: 1.3, color: 0x657a76 },
  { id: "bedroom", name: "Bedroom", short: "BED", x: 2.1, z: -1.35, w: 3.8, d: 4.3, color: 0x927e68 },
  { id: "kitchen", name: "Kitchen", short: "K", x: -3.125, z: 2.8, w: 1.75, d: 4, color: 0x829692 },
  { id: "hallway", name: "Hallway", short: "H", x: 0, z: 1.9, w: 4.5, d: 2.2, color: 0xa19783 },
  { id: "entrance", name: "Entrance", short: "ENT", x: -.775, z: 3.9, w: 2.95, d: 1.8, color: 0xa19783 },
  { id: "storage", name: "Storage", short: "S", x: 1.475, z: 3.9, w: 1.55, d: 1.8, color: 0xa19783 },
  { id: "bathroom", name: "Bathroom", short: "BATH", x: 3.125, z: 2.8, w: 1.75, d: 4, color: 0x778d99 },
];
export type RoomAssignments = Record<string, string>;
interface Props { bulbs: BulbInfo[]; selectedIp: string | null; snapshots: LightSnapshots; assignments: RoomAssignments; onSelect: (ip: string) => void; night: boolean; view: "orbit" | "plan"; onHome: () => void; resetKey: number }

export function HouseScene({ bulbs, selectedIp, snapshots, assignments, onSelect, night, view, onHome, resetKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const actions = useRef<(action: string) => void>(() => {});
  const roomStates = useRef(new Map<string, { room: string; state: BulbState }>());
  const updateLights = useRef<() => void>(() => {});
  const cameraCommand = useRef<(view: "orbit" | "plan") => void>(() => {});
  const environmentCommand = useRef<(night: boolean) => void>(() => {});
  const latest = useRef({ bulbs, assignments, onSelect });
  latest.current = { bulbs, assignments, onSelect };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.setAttribute("aria-label", "Single-floor apartment based on your sketch");
    element.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = new RoomEnvironment();
    const environmentTarget = generator.fromScene(environment);
    scene.environment = environmentTarget.texture;
    scene.environmentIntensity = .24;
    environment.dispose(); generator.dispose();
    const camera = new THREE.OrthographicCamera(-7, 7, 7, -7, .1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.minZoom = .75; controls.maxZoom = 2;
    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 3;
    const reset = () => { camera.position.set(7.5, 15, 11); camera.zoom = 1; camera.updateProjectionMatrix(); controls.target.set(0, 0, 0); controls.update(); };
    reset();
    const ambient = new THREE.HemisphereLight(0xe1edf1, 0x283d33, .65);
    scene.add(ambient);
    let targetAmbient = .65, targetSun = 1.6, targetEnvironment = .24;
    const sun = new THREE.DirectionalLight(0xe7edff, 1.6);
    sun.position.set(-5, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); sun.shadow.bias = -.001; scene.add(sun);
    const ownedMaterials = new Set<THREE.Material>();
    const material = (color: number) => {
      const value = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .08 });
      ownedMaterials.add(value); return value;
    };
    const roomSurfaces = new Map<string, Map<THREE.Material, { material: THREE.MeshStandardMaterial; base: THREE.Color }>>();
    const roomAt = (x: number, z: number) => ROOMS.find(room => x > room.x - room.w / 2 + .001 && x < room.x + room.w / 2 - .001 && z > room.z - room.d / 2 + .001 && z < room.z + room.d / 2 - .001);
    // Share a tintable material within each room, never across rooms.
    const surfaceInRoom = (source: THREE.Material, x: number, z: number): THREE.Material => {
      const room = roomAt(x, z);
      if (!room || !(source instanceof THREE.MeshStandardMaterial) || source.transparent) return source;
      let surfaces = roomSurfaces.get(room.id);
      if (!surfaces) { surfaces = new Map(); roomSurfaces.set(room.id, surfaces); }
      let surface = surfaces.get(source);
      if (!surface) { const copy = source.clone(); ownedMaterials.add(copy); surface = { material: copy, base: source.color.clone() }; surfaces.set(source, surface); }
      return surface.material;
    };
    const wall = material(0x344441), base = material(0x1c2826), trim = material(0x65867e), joints = material(0x8b9690);
    function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) {
      // Box faces sample their respective side of a shared wall.
      const surfaces = mat === wall || mat === trim ? [
        surfaceInRoom(mat, x + w / 2 + .07, z), surfaceInRoom(mat, x - w / 2 - .07, z),
        mat, mat, surfaceInRoom(mat, x, z + d / 2 + .07), surfaceInRoom(mat, x, z - d / 2 - .07),
      ] : surfaceInRoom(mat, x, z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surfaces);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    }
    // Sketch proportions, not surveyed dimensions. All rooms share one floor.
    const slab = new THREE.Mesh(new RoundedBoxGeometry(8.3, .4, 9.9, 3, .07), base);
    slab.position.y = -.22; slab.castShadow = true; slab.receiveShadow = true; scene.add(slab);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: .32 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.44; ground.receiveShadow = true; scene.add(ground);
    const floorMeshes: THREE.Mesh[] = [];
    ROOMS.forEach(room => {
      const surface = material(["kitchen", "bathroom", "balcony"].includes(room.id) ? 0x93aaa3 : 0xc0c7b8);
      surface.roughness = .36;
      const floorMesh = box(room.x, .015, room.z, room.w, .08, room.d, surface);
      floorMesh.userData.room = room.id; floorMeshes.push(floorMesh);
      const tiled = ["kitchen", "bathroom", "balcony"].includes(room.id);
      for (let z = room.z - room.d / 2 + .5; z < room.z + room.d / 2; z += .5) box(room.x, .059, z, room.w, .003, .008, joints);
      if (tiled) for (let x = room.x - room.w / 2 + .5; x < room.x + room.w / 2; x += .5) box(x, .059, room.z, .008, .003, room.d, joints);
    });
    const horizontal = (x1: number, x2: number, z: number) => {
      box((x1 + x2) / 2, .44, z, x2 - x1, .8, .12, wall);
      box((x1 + x2) / 2, .845, z, x2 - x1, .016, .125, trim);
    };
    const vertical = (x: number, z1: number, z2: number) => {
      box(x, .44, (z1 + z2) / 2, .12, .8, z2 - z1, wall);
      box(x, .845, (z1 + z2) / 2, .125, .016, z2 - z1, trim);
    };
    // Exterior, with entrance opening; balcony edges are rails, not room walls.
    vertical(-4, -4.8, .8); vertical(-4, .8, 4.8); vertical(4, -3.5, .8); vertical(4, .8, 4.8); horizontal(-4, .2, -4.8);
    horizontal(-4, -2.25, 4.8); horizontal(-2.25, -.55, 4.8); horizontal(.35, .7, 4.8); horizontal(.7, 2.25, 4.8); horizontal(2.25, 4, 4.8);
    for (let x = .2; x <= 4; x += .38) box(x, .42, -4.8, .035, .75, .035, trim);
    box(2.1, .81, -4.8, 3.8, .04, .05, trim);
    for (let z = -4.8; z <= -3.5; z += .32) box(4, .42, z, .035, .75, .035, trim);
    box(4, .81, -4.15, .05, .04, 1.3, trim);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xb9e3d6, transparent: true, opacity: .22, roughness: .08, metalness: .15, depthWrite: false, side: THREE.DoubleSide });
    box(2.1, .43, -4.8, 3.8, .7, .025, glass);
    box(4, .43, -4.15, .025, .7, 1.3, glass);
    // Balcony access is from the living room, as drawn.
    vertical(.2, -4.8, -4.5); vertical(.2, -3.6, .8); horizontal(.2, 4, -3.5);
    horizontal(-4, -1.1, .8); horizontal(-.15, .4, .8); horizontal(1.35, 4, .8);
    vertical(-2.25, .8, 1.25); vertical(-2.25, 2.15, 4.8);
    vertical(2.25, .8, 1.25); vertical(2.25, 2.15, 4.8);
    horizontal(-2.25, -.55, 3); horizontal(.35, .7, 3);
    vertical(.7, 3, 4.8);
    // No wall or door between storage and hallway (x .7..2.25, z 3).
    // Stylized furnishings provide visual scale without claiming exact placement.
    const upholstery = material(0x768b83), linen = material(0xced0c2), wood = material(0x70786c), ceramic = material(0xb9cecb), metal = material(0x263b38);
    const rounded = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.09, h / 3)), surfaceInRoom(mat, x, z));
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    box(-2.1, .071, -1.4, 2.55, .018, 2.35, material(0x495c5c));
    rounded(-3.2, .32, -2.15, .85, .5, 2.45, upholstery);
    rounded(-3.55, .62, -2.15, .19, .55, 2.45, upholstery);
    for (const z of [-3.25, -1.05]) rounded(-3.2, .55, z, .85, .4, .2, upholstery);
    for (const z of [-2.8, -2.15, -1.5]) rounded(-3.11, .61, z, .55, .12, .58, linen);
    rounded(-1.85, .31, -1.9, .8, .17, 1.1, wood);
    box(-1.85, .18, -1.9, .5, .25, .65, metal);
    box(-.1, .34, -1.7, .28, .55, 1.6, wood);
    box(-.09, .87, -1.7, .045, .57, 1.45, metal);
    rounded(2.8, .28, -1.9, 1.55, .38, 2.2, wood);
    rounded(2.8, .52, -1.9, 1.53, .23, 2.12, linen);
    rounded(2.8, .67, -3.02, 1.65, .65, .13, upholstery);
    box(2.8, .657, -1.55, 1.55, .04, 1.3, material(0x637885));
    for (const x of [2.4, 3.16]) rounded(x, .7, -2.6, .57, .14, .42, linen);
    box(1.65, .27, -2.65, .45, .45, .45, wood);
    box(-3.62, .45, 3.18, .57, .78, 2.75, upholstery);
    box(-3.6, .87, 3.18, .62, .07, 2.8, ceramic);
    box(-3.6, .916, 2.7, .42, .025, .65, metal);
    box(-3.59, .915, 3.85, .42, .02, .5, metal);
    box(-2.8, .87, 4.43, 1.1, .07, .6, ceramic);
    rounded(3.4, .35, 3.7, .8, .58, 1.55, ceramic);
    rounded(3.4, .65, 3.7, .56, .03, 1.2, material(0x5d8f9a));
    box(3.49, .57, 1.9, .58, .15, .62, ceramic);
    box(1.9, .45, 4.2, .4, .8, .75, wood);
    for (const y of [.25, .52, .8]) box(1.88, y, 4.2, .44, .05, .8, linen);
    box(-1.65, .27, 4.2, .65, .4, .5, wood);
    const plant = (x: number, z: number) => {
      rounded(x, .25, z, .34, .38, .34, ceramic);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 1), surfaceInRoom(material(0x427363), x, z));
      leaves.scale.set(.85, 1.65, .85); leaves.position.set(x, .67, z); leaves.castShadow = true; scene.add(leaves);
    };
    plant(-3.4, -4.25); plant(3.4, -4.18);
    rounded(1.45, .22, -4.1, .65, .27, .52, upholstery);
    rounded(2.25, .24, -4.1, .42, .07, .42, wood);
    const lighting = ROOMS.map(room => {
      const strip = new THREE.MeshStandardMaterial({ color: 0x74887b, emissive: 0x000000, roughness: .6 });
      const stripMesh = box(room.x, .09, room.z - room.d / 2 + .12, Math.max(.3, room.w - .3), .025, .025, strip);
      stripMesh.material = strip;
      return { strip, surfaces: Array.from(roomSurfaces.get(room.id)?.values() ?? []), color: new THREE.Color(), targetColor: new THREE.Color(), strength: 0, targetStrength: 0 };
    });
    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();
    const pointerDown = (event: PointerEvent) => pointerStart.set(event.clientX, event.clientY);
    const pointerUp = (event: PointerEvent) => {
      if (event.button !== 0 || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects(floorMeshes)[0];
      const bulb = hit && latest.current.bulbs.find(item => latest.current.assignments[item.ip] === hit.object.userData.room);
      if (bulb) latest.current.onSelect(bulb.ip);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    let destination: { position: THREE.Vector3; target: THREE.Vector3; zoom: number } | null = null;
    controls.addEventListener("start", () => { destination = null; });
    let frame = 0;
    let lastTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = (time: number) => {
      frame = 0;
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-Math.min(64, time - lastTime || 16) / 100);
      lastTime = time;
      let animating = false;
      if (destination) {
        camera.position.lerp(destination.position, blend);
        controls.target.lerp(destination.target, blend);
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, destination.zoom, blend);
        const settled = camera.position.distanceTo(destination.position) + controls.target.distanceTo(destination.target) + Math.abs(camera.zoom - destination.zoom) < .003;
        if (settled) { camera.position.copy(destination.position); controls.target.copy(destination.target); camera.zoom = destination.zoom; destination = null; }
        camera.updateProjectionMatrix(); controls.update(); animating = !settled;
      }
      ambient.intensity = THREE.MathUtils.lerp(ambient.intensity, targetAmbient, blend);
      sun.intensity = THREE.MathUtils.lerp(sun.intensity, targetSun, blend);
      scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, targetEnvironment, blend);
      animating ||= Math.abs(ambient.intensity - targetAmbient) + Math.abs(sun.intensity - targetSun) > .001;
      lighting.forEach(item => {
        item.strength = THREE.MathUtils.lerp(item.strength, item.targetStrength, blend);
        item.color.lerp(item.targetColor, blend);
        const unsettled = Math.abs(item.strength - item.targetStrength) > .001 || Math.abs(item.color.r - item.targetColor.r) + Math.abs(item.color.g - item.targetColor.g) + Math.abs(item.color.b - item.targetColor.b) > .001;
        if (!unsettled) { item.strength = item.targetStrength; item.color.copy(item.targetColor); }
        animating ||= unsettled;
        item.surfaces.forEach(surface => {
          surface.material.color.copy(surface.base).multiplyScalar(.32 + item.strength * .68);
          const tinted = surface.base.clone().multiply(item.color).multiplyScalar(1.5);
          surface.material.color.lerp(tinted, item.strength * .7);
          surface.material.emissive.copy(item.color);
          surface.material.emissiveIntensity = item.strength * .32;
        });
        item.strip.emissive.copy(item.color); item.strip.emissiveIntensity = item.strength * 2;
      });
      renderer.render(scene, camera);
      ROOMS.forEach((room, index) => {
        const label = labels.current[index]; if (!label) return;
        const projected = new THREE.Vector3(room.x, .15, room.z).project(camera);
        label.style.left = `${(projected.x * .5 + .5) * element.clientWidth}px`;
        label.style.top = `${(-projected.y * .5 + .5) * element.clientHeight}px`;
      });
      if (animating && !frame) frame = requestAnimationFrame(render);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    controls.addEventListener("change", schedule);
    const resize = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = element; if (!w || !h) return;
      const aspect = w / h, half = Math.max(6.25, 6.9 / aspect);
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
      camera.updateProjectionMatrix(); renderer.setSize(w, h); schedule();
    });
    resize.observe(element);
    cameraCommand.current = (viewMode) => {
      const target = new THREE.Vector3();
      destination = { target, position: target.clone().add(viewMode === "plan" ? new THREE.Vector3(.001, 20, .001) : new THREE.Vector3(7.5, 15, 11)), zoom: 1 };
      schedule();
    };
    environmentCommand.current = isNight => {
      targetAmbient = isNight ? .65 : 1.35; targetSun = isNight ? 1.6 : 3; targetEnvironment = isNight ? .24 : .6; schedule();
    };
    actions.current = action => {
      destination = null;
      if (action === "reset") reset();
      else { camera.zoom = THREE.MathUtils.clamp(camera.zoom * (action === "in" ? 1.15 : 1 / 1.15), .75, 2); camera.updateProjectionMatrix(); controls.update(); }
      schedule();
    };
    updateLights.current = () => {
      lighting.forEach((item, index) => {
        const combined = new THREE.Color(0, 0, 0);
        let total = 0;
        roomStates.current.forEach(({ room, state: value }) => {
          if (room !== ROOMS[index].id) return;
          const { color, strength } = lightAppearance(value);
          combined.add(new THREE.Color(color).multiplyScalar(strength)); total += strength;
        });
        if (total > 0) item.targetColor.copy(combined.multiplyScalar(1 / total));
        item.targetStrength = Math.min(1, total);
      });
      schedule();
    };
    updateLights.current();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      environmentTarget.dispose();
      const materials = ownedMaterials;
      scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(mat => materials.add(mat)); } });
      materials.forEach(mat => mat.dispose()); renderer.dispose(); renderer.domElement.remove();
      updateLights.current = () => {}; actions.current = () => {}; cameraCommand.current = () => {}; environmentCommand.current = () => {};
    };
  }, []);


  useEffect(() => {
    roomStates.current.clear();
    bulbs.forEach(bulb => {
      const value = reportedState(snapshots[bulb.ip]);
      if (value && assignments[bulb.ip]) roomStates.current.set(bulb.ip, { room: assignments[bulb.ip], state: value });
    });
    updateLights.current();
  }, [bulbs, snapshots, assignments]);
  useEffect(() => { cameraCommand.current(view); }, [view, resetKey]);
  useEffect(() => { environmentCommand.current(night); }, [night]);

  return <section className="house-scene" aria-label="Apartment floor plan">
    <div className="scene-canvas" ref={host}>
      {failed && <div className="scene-fallback"><span>3D view unavailable</span></div>}
      {!failed && ROOMS.map((room, index) => <div key={room.id} ref={node => { labels.current[index] = node; }} className="apartment-room" data-room={room.id}>
        <div className="room-bulbs">{bulbs.filter(bulb => assignments[bulb.ip] === room.id).map(bulb => <RoomLight key={bulb.ip} bulb={bulb} room={room} selected={bulb.ip === selectedIp} snapshot={snapshots[bulb.ip]} onSelect={onSelect} />)}</div>
        <span className="room-name" title={room.name}><span>{room.name}</span><abbr>{room.short}</abbr></span>
      </div>)}
    </div>
    <div className="scene-bottom"><span>APPROXIMATE LAYOUT <i />61 m<sup>2</sup></span><div className="scene-tools">{[{ key: "out", label: "Zoom out", Icon: ZoomOut }, { key: "in", label: "Zoom in", Icon: ZoomIn }, { key: "reset", label: "Reset home view", Icon: RotateCcw }].map(({ key, label, Icon }) => <button key={key} className="icon-button" title={label} aria-label={label} disabled={failed} onClick={() => { actions.current(key); if (key === "reset") onHome(); }}><Icon size={17} /></button>)}</div></div>
  </section>;
}
