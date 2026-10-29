import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// NEXUS floor-plan scene inspired by the supplied 330 m² office reference.
const canvas = document.getElementById('office3d');
const container = canvas?.parentElement;
if (!canvas || !container) throw new Error('3D office canvas was not found.');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9eff1');
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 180);
const initialCamera = new THREE.Vector3(24, 23, 27);
camera.position.copy(initialCamera);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 13;
controls.maxDistance = 52;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minPolarAngle = 0.12;

scene.add(new THREE.HemisphereLight('#ffffff', '#b5b9b5', 2.0));
const sun = new THREE.DirectionalLight('#fff4df', 3.0);
sun.position.set(14, 24, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.bias = -0.00025;
scene.add(sun);
const fill = new THREE.DirectionalLight('#d4e9ff', 1.25);
fill.position.set(-14, 13, -10);
scene.add(fill);

const MAT = new Map();
function mat(color, roughness = 0.78, metalness = 0, transparent = false, opacity = 1) {
  const key = `${color}|${roughness}|${metalness}|${transparent}|${opacity}`;
  if (!MAT.has(key)) MAT.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity, depthWrite: !transparent }));
  return MAT.get(key);
}
function box(parent, w, h, d, color, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, opts.roughness ?? 0.78, opts.metalness ?? 0, opts.transparent ?? false, opts.opacity ?? 1) : color);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, top, bottom, h, color, x, y, z, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, segments), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function addPlant(parent, x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); parent.add(g);
  cylinder(g, .22, .28, .38, '#d7dfdc', 0, .19, 0, 14);
  cylinder(g, .035, .045, .72, '#3b8767', 0, .67, 0, 8);
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), mat(i % 2 ? '#67b38b' : '#428d6f'));
    leaf.scale.set(.63, 1.7, .42);
    leaf.position.set(Math.cos(a) * .2, .72 + (i % 3) * .15, Math.sin(a) * .2);
    leaf.rotation.z = Math.cos(a) * .7; leaf.rotation.x = Math.sin(a) * .7; leaf.castShadow = true; g.add(leaf);
  }
  return g;
}
function addLabel(parent, title, subtitle, x, z, accent = '#287f69', width = 2.8) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 120;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,.94)';
  ctx.beginPath(); ctx.roundRect(7, 7, 498, 106, 20); ctx.fill();
  ctx.strokeStyle = '#dce5e4'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = accent; ctx.fillRect(22, 23, 7, 74);
  ctx.fillStyle = '#233746'; ctx.font = 'bold 28px "Noto Sans KR", Arial, sans-serif'; ctx.fillText(title, 46, 53);
  ctx.fillStyle = '#7b8a94'; ctx.font = '21px Arial, sans-serif'; ctx.fillText(subtitle, 46, 83);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(width, width * .235, 1); sprite.position.set(x, 3.1, z); sprite.renderOrder = 10; parent.add(sprite); return sprite;
}
function addGlassWall(parent, orientation, x, z, length, height = 2.35, color = '#b5d1d5') {
  const glass = mat(color, .23, .08, true, .40);
  if (orientation === 'x') {
    box(parent, length, height, .065, glass, x, height / 2 + .05, z, { cast: false, receive: false });
    for (let i = 0; i <= Math.round(length / 1.45); i++) {
      const px = x - length / 2 + (length / Math.round(length / 1.45)) * i;
      box(parent, .055, height, .09, '#a7b7ba', px, height / 2 + .05, z, { cast: false });
    }
    box(parent, length, .065, .09, '#a7b7ba', x, height + .05, z, { cast: false });
  } else {
    box(parent, .065, height, length, glass, x, height / 2 + .05, z, { cast: false, receive: false });
    for (let i = 0; i <= Math.round(length / 1.45); i++) {
      const pz = z - length / 2 + (length / Math.round(length / 1.45)) * i;
      box(parent, .09, height, .055, '#a7b7ba', x, height / 2 + .05, pz, { cast: false });
    }
    box(parent, .09, .065, length, '#a7b7ba', x, height + .05, z, { cast: false });
  }
}
function addChair(parent, x, z, color = '#6c7b81', rotation = 0, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; g.scale.setScalar(scale); parent.add(g);
  box(g, .55, .13, .53, color, 0, .55, 0);
  box(g, .52, .57, .11, color, 0, .84, .2);
  cylinder(g, .06, .08, .34, '#65767d', 0, .29, 0, 10);
  box(g, .6, .05, .6, '#65767d', 0, .08, 0);
  return g;
}
function addDesk(parent, x, z, variant = 0, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); parent.add(g);
  const tops = ['#d9b18a', '#d3c0a2', '#cda982', '#e0c39b'];
  const top = tops[variant % tops.length];
  box(g, 1.72, .13, .88, top, 0, .94, 0);
  box(g, 1.75, .035, .9, '#a98a6b', 0, .865, 0);
  for (const dx of [-.73, .73]) for (const dz of [-.34, .34]) box(g, .055, .82, .055, '#718087', dx, .43, dz);
  // dual-monitor workstation
  for (const dx of [-.32, .28]) {
    box(g, .48, .34, .055, '#273d4a', dx, 1.24, -.26, { roughness: .3, metalness: .08 });
    box(g, .40, .25, .012, variant % 2 ? '#93c9d7' : '#a4d7c5', dx, 1.24, -.226, { cast: false, receive: false });
    box(g, .045, .18, .045, '#73848b', dx, 1.0, -.24);
  }
  box(g, .33, .025, .2, '#eef1ed', -.55, 1.025, .23, { cast: false });
  cylinder(g, .05, .05, .09, '#f6f2e9', .61, 1.03, .22, 10);
  addChair(g, 0, .74, variant % 3 === 1 ? '#8393a4' : '#566874', Math.PI, .8);
  return g;
}
function addAvatar(parent, spec) {
  const root = new THREE.Group(); root.position.set(spec.x, 0, spec.z + .6); root.rotation.y = Math.PI; root.userData.agentId = spec.id; parent.add(root);
  const shirt = mat(spec.color), skin = mat(spec.skin), hair = mat(spec.hair), pants = mat('#40505c');
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .32, 4, 8), shirt); torso.position.y = .75; torso.castShadow = true; root.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .1, 8), skin); neck.position.y = 1.01; root.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), skin); head.position.set(0, 1.18, 0); head.castShadow = true; root.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), hair); cap.position.set(0, 1.22, -.02); root.add(cap);
  const face = mat('#594b47');
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 5), face); eye.position.set(side * .06, 1.18, .15); root.add(eye);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.052, .22, 3, 6), shirt); arm.position.set(side * .23, .76, .02); arm.rotation.z = -side * .27; root.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .2, 3, 6), pants); leg.position.set(side * .09, .28, 0); root.add(leg);
    box(root, .13, .07, .18, '#303e48', side * .09, .07, .02);
  }
  const statusColor = spec.statusKey === 'review' ? '#f1b64f' : spec.statusKey === 'idle' ? '#a3b0bd' : '#45c89b';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .027, 7, 22), mat(statusColor)); ring.rotation.x = Math.PI / 2; ring.position.y = .045; root.add(ring);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 7), mat(statusColor)); pin.position.set(0, 1.52, 0); root.add(pin);
  const label = document.createElement('canvas'); label.width = 400; label.height = 84;
  const ctx = label.getContext('2d'); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.roundRect(6, 6, 388, 72, 17); ctx.fill();
  ctx.fillStyle = statusColor; ctx.beginPath(); ctx.arc(29, 42, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#243645'; ctx.font = 'bold 25px Arial,sans-serif'; ctx.fillText(spec.name, 48, 37);
  ctx.fillStyle = '#81909d'; ctx.font = '19px Arial,sans-serif'; ctx.fillText(spec.role, 48, 61);
  const tex = new THREE.CanvasTexture(label); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); tag.scale.set(1.8, .38, 1); tag.position.y = 1.91; tag.renderOrder = 11; tag.userData.agentId = spec.id; root.add(tag);
  root.traverse(o => { if (o.isMesh) o.userData.agentId = spec.id; });
  return { ...spec, root, ring, pin, torso };
}
function addSofa(parent, x, z, color, rotation = 0, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; g.scale.setScalar(scale); parent.add(g);
  box(g, 2.1, .36, .78, color, 0, .42, 0);
  box(g, 2.12, .59, .16, color, 0, .68, -.32);
  box(g, .16, .45, .78, color, -1.0, .5, 0); box(g, .16, .45, .78, color, 1.0, .5, 0);
  for (const x0 of [-.72, .72]) box(g, .08, .2, .08, '#806f60', x0, .1, .22);
}
function addLounge(parent) {
  box(parent, 4.7, .025, 3.2, '#e5dacf', 1.7, .04, .6, { cast: false });
  addSofa(parent, .55, -.25, '#c5ad91', Math.PI / 2, .9);
  addSofa(parent, 3.35, .05, '#b9cbbd', -Math.PI / 2, .83);
  box(parent, 1.05, .16, .78, '#e3c59f', 1.95, .42, 1.0);
  cylinder(parent, .32, .34, .1, '#b98f6c', 1.95, .25, 1.0, 20);
  addChair(parent, .85, 2.05, '#7c8e96', Math.PI * .76, .76);
  addChair(parent, 3.1, 2.12, '#7c8e96', -Math.PI * .76, .76);
  addPlant(parent, .05, 2.1, 1.05); addPlant(parent, 4.1, -1.0, .82);
  addLabel(parent, '휴게실 · 라운지', 'LOUNGE / BREAK AREA', 2.15, .55, '#b58a63', 2.9);
}
function addPantry(parent) {
  // Back counter and cabinet run, sink, coffee maker, refrigerator and high table.
  box(parent, 4.45, .85, .6, '#c5b8aa', 2.55, .47, -7.45);
  box(parent, 4.5, .12, .68, '#5a6667', 2.55, .95, -7.45);
  for (let i = 0; i < 5; i++) box(parent, .018, .64, .015, '#8b8177', .78 + i * .87, .48, -7.12, { cast: false });
  box(parent, .95, 2.0, .9, '#cbd2d1', .2, 1.0, -6.85); box(parent, .85, 1.84, .08, '#edf1ee', .2, 1.02, -6.37);
  box(parent, 1.02, .12, .72, '#a7ada8', 3.2, 1.02, -7.42);
  box(parent, .65, .06, .45, '#303f47', 4.05, 1.04, -7.42); box(parent, .1, .28, .1, '#c7d5d6', 4.05, 1.2, -7.42);
  for (let i = 0; i < 6; i++) {
    cylinder(parent, .055, .055, .16, i % 2 ? '#dce4df' : '#e5c6a6', .95 + i * .52, 1.08, -7.43, 10);
  }
  box(parent, 2.7, .12, 1.0, '#d9b58f', 3.15, 1.02, -5.45);
  for (const x of [2.15, 4.15]) for (const z of [-5.78, -5.12]) box(parent, .06, .95, .06, '#79878b', x, .48, z);
  for (const x of [2.0, 3.1, 4.2]) addChair(parent, x, -4.88, '#846f5c', Math.PI, .65);
  addLabel(parent, '탕비실', 'PANTRY · COFFEE & WATER', 2.9, -6.05, '#a27e59', 2.8);
}
function addRestrooms(parent) {
  // Restroom room boundaries / cubicles / wash basins.
  box(parent, 3.35, 2.65, .12, '#e0dfd9', 6.85, 1.32, -4.08);
  box(parent, .12, 2.65, 3.5, '#e0dfd9', 5.18, 1.32, -5.85);
  box(parent, .12, 2.65, 3.5, '#e0dfd9', 8.52, 1.32, -5.85);
  box(parent, 3.35, 2.65, .12, '#e0dfd9', 6.85, 1.32, -7.55);
  // partition cubicles
  for (const x of [6.0, 7.0, 8.0]) {
    box(parent, .055, 1.7, 1.9, '#c4cecb', x, .85, -5.85);
    box(parent, .72, .08, .54, '#f3f3ed', x + .12, .27, -6.58);
    box(parent, .6, .28, .48, '#f9f8f1', x + .12, .42, -6.58);
  }
  for (const x of [5.8, 6.8, 7.8]) {
    box(parent, .58, .15, .38, '#f3f6f5', x, .7, -4.55);
    box(parent, .45, .5, .3, '#dfe5e4', x, .4, -4.55);
    cylinder(parent, .06, .06, .14, '#9aa9aa', x, .83, -4.55, 10);
  }
  addLabel(parent, '화장실', 'RESTROOMS', 6.8, -5.75, '#568c9a', 2.1);
}
function addStairsAndElevators(parent) {
  // Emergency stair core is green, matching the reference plan.
  box(parent, 3.0, .08, 4.35, '#e0e8e1', 10.35, .06, -3.2, { cast: false });
  box(parent, .12, 3.05, 4.35, '#267c57', 8.85, 1.52, -3.2);
  box(parent, .12, 3.05, 4.35, '#267c57', 11.83, 1.52, -3.2);
  box(parent, 3.0, 3.05, .12, '#267c57', 10.35, 1.52, -5.36);
  box(parent, 3.0, 3.05, .12, '#267c57', 10.35, 1.52, -1.04);
  for (let i = 0; i < 8; i++) {
    const x = 9.15 + i * .31;
    box(parent, .38, .14 + i * .11, 2.6, i % 2 ? '#9ba4a3' : '#b2bab8', x, .12 + (i * .11) / 2, -3.22, { cast: false });
  }
  box(parent, 1.1, .06, .7, '#f0f0e9', 10.6, 1.08, -1.62);
  box(parent, .72, .38, .035, '#e5f3e9', 10.6, 1.11, -1.58, { cast: false });
  addLabel(parent, '비상구 · 계단', 'EMERGENCY EXIT & STAIRS', 10.2, -3.2, '#1f875d', 2.9);
  const elevator = (x, z, label) => {
    box(parent, 1.45, 2.85, 1.5, '#bdc6c7', x, 1.42, z);
    box(parent, 1.2, 2.6, 1.22, '#dce1df', x, 1.35, z + .08);
    box(parent, .52, 2.2, .045, '#8b999c', x - .27, 1.25, z + .72, { metalness: .25 });
    box(parent, .52, 2.2, .045, '#778a90', x + .27, 1.25, z + .72, { metalness: .25 });
    box(parent, .08, .28, .08, '#e0b65e', x + .82, 1.65, z + .56);
    addLabel(parent, label, 'ELEVATOR', x, z - .9, '#73838b', 1.9);
  };
  elevator(10.15, .35, '엘리베이터 A');
  elevator(10.15, 5.3, '엘리베이터 B');
}
function addMeetingRooms(parent) {
  // Two glazed meeting / department rooms on the front-right wing.
  const wall = mat('#b2cbd0', .25, .05, true, .36);
  // Room 1 boundaries: x 2.1..5.1, z 3.3..8.25
  addGlassWall(parent, 'z', 2.05, 5.85, 4.6, 2.25);
  addGlassWall(parent, 'x', 3.55, 8.15, 3.0, 2.25);
  addGlassWall(parent, 'x', 3.55, 3.45, 3.0, 2.25);
  // Keep a door-sized gap by covering only the side end portions with glass.
  // Room 2: x 5.1..8.6
  addGlassWall(parent, 'x', 6.85, 8.15, 3.4, 2.25);
  addGlassWall(parent, 'z', 6.85, 5.85, 4.6, 2.25);
  addGlassWall(parent, 'x', 6.85, 3.45, 3.4, 2.25);
  // Mullions / transparent doors are deliberately low-profile so the interior stays visible.
  box(parent, 1.35, .9, .08, '#dbe2e0', 3.5, .48, 4.1);
  box(parent, 1.55, .9, .08, '#dbe2e0', 6.8, .48, 4.1);
  // Conference table one
  box(parent, 2.2, .14, 1.0, '#d6b28f', 3.55, .96, 6.0);
  for (const x of [2.65, 4.45]) for (const z of [5.5, 6.5]) box(parent, .07, .83, .07, '#7c898c', x, .42, z);
  for (const x of [2.55, 3.55, 4.55]) { addChair(parent, x, 5.15, '#788992', Math.PI, .64); addChair(parent, x, 6.88, '#788992', 0, .64); }
  // Conference table two
  box(parent, 2.35, .14, 1.0, '#c9d5cf', 6.85, .96, 6.0);
  for (const x of [5.95, 7.75]) for (const z of [5.5, 6.5]) box(parent, .07, .83, .07, '#7c898c', x, .42, z);
  for (const x of [5.85, 6.85, 7.85]) { addChair(parent, x, 5.15, '#7d8ca4', Math.PI, .64); addChair(parent, x, 6.88, '#7d8ca4', 0, .64); }
  // Display panels against inner meeting-room walls.
  box(parent, 1.45, .84, .055, '#314b5a', 3.55, 2.0, 3.62, { cast: false });
  box(parent, 1.45, .84, .055, '#314b5a', 6.85, 2.0, 3.62, { cast: false });
  addLabel(parent, '회의실 · 부서 섹션', 'MEETING & DEPARTMENT ROOMS', 5.25, 7.25, '#4c8794', 3.4);
}
function addOfficeArchitecture(parent, floor) {
  // Main 330 m² (approx. 24 × 18 scene units) slab and cutaway perimeter.
  box(parent, 24.4, .22, 18.4, '#b9c3c2', 0, -.16, 0, { roughness: .9 });
  box(parent, 24.0, .08, 18.0, '#ebe8df', 0, -.015, 0, { cast: false, roughness: .9 });
  // Light floor joints
  for (let x = -11; x <= 11; x += 2) box(parent, .012, .008, 17.8, '#dcded7', x, .03, 0, { cast: false, receive: false });
  for (let z = -8; z <= 8; z += 2) box(parent, 23.8, .008, .012, '#dcded7', 0, .03, z, { cast: false, receive: false });
  // Rear and left exterior walls; front edge is cut away for visibility.
  box(parent, 24.0, 3.5, .24, '#f1f0e9', 0, 1.73, -8.92);
  box(parent, .24, 3.5, 18.0, '#f1f0e9', -11.88, 1.73, 0);
  box(parent, 24.0, .15, .26, '#c9d0cb', 0, .18, 8.9);
  box(parent, .18, 1.25, 18.0, '#d4dbd7', 11.88, .62, 0);
  // Tall windows along the back side of the workspace.
  for (let i = 0; i < 5; i++) {
    const x = -9.8 + i * 2.05;
    box(parent, 1.8, 1.75, .055, '#c5e1e9', x, 2.05, -8.77, { transparent: true, opacity: .78, cast: false, receive: false });
    box(parent, .055, 1.85, .07, '#f8faf8', x - .92, 2.05, -8.73, { cast: false });
    box(parent, .055, 1.85, .07, '#f8faf8', x + .92, 2.05, -8.73, { cast: false });
    box(parent, 1.88, .055, .07, '#f8faf8', x, 1.13, -8.73, { cast: false });
    box(parent, 1.88, .055, .07, '#f8faf8', x, 2.98, -8.73, { cast: false });
  }
  // Workplace zone rug and low partitions.
  box(parent, 10.6, .025, 9.7, '#dce8df', -5.25, .05, -.95, { cast: false });
  const dividers = ['#bfd6ce', '#d4c6e2', '#c3d5e5', '#d9d8b9', '#c8dfd5', '#dfc3ba'];
  const stations = [];
  const xs = [-8.5, -5.5, -2.5], zs = [-4.25, -1.05, 2.15];
  let idx = 0;
  for (const z of zs) for (const x of xs) {
    addDesk(parent, x, z, idx, .96);
    // modest acoustic dividers at the back/side of every other workstation
    if ((idx % 3) !== 2) box(parent, .065, 1.28, 1.05, dividers[idx % dividers.length], x + 1.08, .67, z - .05, { cast: false });
    stations.push({ x, z: z + .12 }); idx++;
  }
  addLabel(parent, '사무 구역 · AI 워크스페이스', 'WORKSPACE · DEPARTMENT PODS', -6.15, -7.0, '#3a8a73', 4.1);
  // Pantry, washrooms, lounge and circulation core.
  addPantry(parent);
  addRestrooms(parent);
  addLounge(parent);
  addStairsAndElevators(parent);
  addMeetingRooms(parent);
  addPlant(parent, -.25, -3.0, .82);
  addPlant(parent, 4.55, 2.65, .8);
  // Main corridor / wayfinding markers.
  box(parent, 1.0, .025, 7.2, '#e5e4db', .15, .05, .0, { cast: false });
  addLabel(parent, `${floor.name} · NEXUS HQ`, 'APPROX. 330 m² FLOOR PLAN', .0, -1.95, '#2d8970', 3.0);
  return stations;
}

const agentSpecs = [
  { id: 'research', name: 'Research AI', role: '리서치 팀', task: '시장 자료 분석', progress: '72%', status: '실행 중', statusKey: 'running', color: '#5b91d7', skin: '#d9ad8d', hair: '#57483f', x: -8.5, z: -4.15, floorId: 1 },
  { id: 'writer', name: 'Writer AI', role: '콘텐츠 팀', task: '콘텐츠 검토 승인 대기', progress: '88%', status: '검토 대기', statusKey: 'review', color: '#a68be5', skin: '#e1b99c', hair: '#4d424e', x: -5.5, z: -1.0, floorId: 1 },
  { id: 'ops', name: 'Ops AI', role: '운영 팀', task: 'CRM 데이터 동기화', progress: '45%', status: '실행 중', statusKey: 'running', color: '#54b99a', skin: '#bd8f6d', hair: '#393d40', x: -2.5, z: 2.15, floorId: 1 },
  { id: 'design', name: 'Design AI', role: '디자인 팀', task: '다음 작업 대기', progress: '—', status: '대기 중', statusKey: 'idle', color: '#e2a26e', skin: '#e7c3a4', hair: '#5b4233', x: -8.5, z: 2.15, floorId: 1 },
  { id: 'data', name: 'Data AI', role: '데이터 팀', task: '데이터셋 정제', progress: '61%', status: '실행 중', statusKey: 'running', color: '#5bb7c0', skin: '#d7a989', hair: '#383d48', x: -5.5, z: -4.25, floorId: 1 }
];
const panels = {
  research: { initial: 'R', bg: '#e2edff', fg: '#5275c8', sub: '리서치 팀 · Agent #001', status: '실행 중', statusClass: 'running', task: '시장 자료 분석', progress: '72%', time: '04:32' },
  writer: { initial: 'W', bg: '#f0e7ff', fg: '#886bc5', sub: '콘텐츠 팀 · Agent #002', status: '검토 대기', statusClass: 'review', task: '콘텐츠 검토 승인 대기', progress: '88%', time: '06:18' },
  ops: { initial: 'O', bg: '#ddf7ed', fg: '#288a69', sub: '운영 팀 · Agent #003', status: '실행 중', statusClass: 'running', task: 'CRM 데이터 동기화', progress: '45%', time: '02:51' },
  design: { initial: 'D', bg: '#ffe9dc', fg: '#bb7950', sub: '디자인 팀 · Agent #004', status: '대기 중', statusClass: 'idle', task: '다음 작업 대기', progress: '—', time: '대기 중' },
  data: { initial: 'D', bg: '#dff6f7', fg: '#308c91', sub: '데이터 팀 · Agent #007', status: '실행 중', statusClass: 'running', task: '데이터셋 정제', progress: '61%', time: '03:14' }
};

const STORAGE_KEY = 'nexus-office-floors-v2';
function loadFloors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length && parsed.every(f => Number.isInteger(f.id) && typeof f.name === 'string')) return parsed;
  } catch (_) { /* first visit or blocked storage */ }
  return [{ id: 1, name: '1층', description: '본사 · 기본 레이아웃' }];
}
let floors = loadFloors();
let activeFloorId = floors[0]?.id ?? 1;
let officeRoot = null;
let activeAgents = [];
let paused = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorSwitcher = document.getElementById('floorSwitcher');
const floorBadge = document.getElementById('activeFloorName');
const floorCount = document.getElementById('floorCount');
const teamList = document.getElementById('teamList');
const selectedAgentPanel = document.getElementById('selectedAgent');

function saveFloors() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(floors)); } catch (_) { /* allow current-session use when storage unavailable */ }
}
function activeFloor() { return floors.find(f => f.id === activeFloorId) || floors[0]; }
function renderFloorSwitcher() {
  if (!floorSwitcher) return;
  floorSwitcher.innerHTML = floors.map(f => `<button class="floor-chip${f.id === activeFloorId ? ' active' : ''}" type="button" data-floor-id="${f.id}" aria-pressed="${f.id === activeFloorId}"><span>F${String(f.id).padStart(2, '0')}</span><strong>${f.name}</strong></button>`).join('') + '<button class="floor-chip add-floor-chip" id="addFloor" type="button">＋ 층 추가</button>';
  floorSwitcher.querySelectorAll('[data-floor-id]').forEach(button => button.addEventListener('click', () => {
    activeFloorId = Number(button.dataset.floorId);
    buildOffice(); renderFloorSwitcher(); renderFloorAgents();
    const note = document.getElementById('floorActionFeedback');
    if (note) note.textContent = `${activeFloor().name}을 선택했습니다. 기본 330m² 레이아웃입니다.`;
    camera.position.copy(initialCamera); controls.target.set(0, .6, 0); controls.update();
  }));
  floorSwitcher.querySelector('#addFloor')?.addEventListener('click', addFloor);
  if (floorBadge) floorBadge.textContent = `${activeFloor().name} / 약 330 m²`;
  if (floorCount) floorCount.textContent = String(floors.length).padStart(2, '0');
  const sub = document.getElementById('floorSummary');
  if (sub) sub.textContent = `${activeFloor().name} · ${activeFloor().description || '기본 레이아웃'}`;
}
function addFloor() {
  const nextId = Math.max(0, ...floors.map(f => f.id)) + 1;
  const floor = { id: nextId, name: `${nextId}층`, description: '신규 층 · 기본 레이아웃' };
  floors.push(floor); activeFloorId = nextId; saveFloors();
  renderFloorSwitcher(); buildOffice(); renderFloorAgents();
  camera.position.copy(initialCamera); controls.target.set(0, .6, 0); controls.update();
  const note = document.getElementById('floorActionFeedback');
  if (note) note.textContent = `${floor.name}이 추가되었습니다. 새 층에 기본 사무실 레이아웃을 생성했습니다. 직원은 별도 배치가 필요합니다.`;
}
function renderFloorAgents() {
  const assigned = agentSpecs.filter(a => a.floorId === activeFloorId);
  const running = assigned.filter(a => a.statusKey === 'running').length;
  const review = assigned.filter(a => a.statusKey === 'review').length;
  const activeCount = document.getElementById('floorActiveCount');
  const reviewCount = document.getElementById('floorReviewCount');
  if (activeCount) activeCount.textContent = String(running).padStart(2, '0');
  if (reviewCount) reviewCount.textContent = String(review).padStart(2, '0');
  if (teamList) {
    if (!assigned.length) {
      teamList.innerHTML = '<div class="floor-empty"><strong>이 층에 배치된 AI 직원이 없습니다.</strong><span>직원 관리에서 직원 배치 기능을 추가할 수 있습니다.</span></div>';
    } else {
      teamList.innerHTML = assigned.map(a => {
        const p = panels[a.id];
        return `<button type="button" class="team-row${a.id === 'research' ? ' selected' : ''}" data-agent="${a.id}"><span class="agent-avatar" style="background:${p.bg};color:${p.fg}">${p.initial}</span><span class="team-row-main"><strong>${a.name}</strong><small>${a.task} · ${a.progress}</small></span><span class="mini-online" style="background:${a.statusKey === 'review' ? '#f4bf60' : a.statusKey === 'idle' ? '#a5b2c2' : '#5ecda9'}"></span></button>`;
      }).join('');
      teamList.querySelectorAll('.team-row').forEach(row => row.addEventListener('click', () => selectAgent(row.dataset.agent, true)));
    }
  }
  if (!assigned.length) {
    if (selectedAgentPanel) selectedAgentPanel.innerHTML = '<div class="floor-empty selected-empty"><strong>직원 배치 대기</strong><span>현재는 샘플 층 생성 기능만 포함되어 있습니다. 직원의 층간 이동/배치 API는 후속 구현 범위입니다.</span></div>';
  } else {
    selectAgent(assigned[0].id, false);
  }
}
function selectAgent(id, moveCamera = false) {
  const info = panels[id];
  const spec = agentSpecs.find(a => a.id === id);
  if (!info || !spec || spec.floorId !== activeFloorId) return;
  teamList?.querySelectorAll('.team-row').forEach(el => el.classList.toggle('selected', el.dataset.agent === id));
  if (selectedAgentPanel) selectedAgentPanel.innerHTML = `<div class="selected-identity"><div class="agent-avatar" style="background:${info.bg};color:${info.fg}">${info.initial}</div><div><strong>${spec.name}</strong><small>${info.sub}</small></div></div><div class="detail-line"><span>상태</span><strong><span class="status ${info.statusClass}">${info.status}</span></strong></div><div class="detail-line"><span>현재 작업</span><strong>${info.task}</strong></div><div class="detail-line"><span>진행률</span><strong>${info.progress}</strong></div><div class="detail-line"><span>실행 시간</span><strong>${info.time}</strong></div><a class="btn small" href="agents.html" style="width:100%;justify-content:center;margin-top:12px">직원 상세 관리 ↗</a>`;
  if (moveCamera) {
    const selected = activeAgents.find(a => a.id === id);
    if (selected) controls.target.set(selected.root.position.x, .8, selected.root.position.z);
  }
}
function buildOffice() {
  if (officeRoot) { scene.remove(officeRoot); disposeGroup(officeRoot); }
  activeAgents = [];
  const floor = activeFloor();
  officeRoot = new THREE.Group(); officeRoot.name = `office-floor-${floor.id}`; scene.add(officeRoot);
  const stations = addOfficeArchitecture(officeRoot, floor);
  // Extra avatars are placed only on the first floor until users assign agents to new floors.
  const assigned = agentSpecs.filter(a => a.floorId === floor.id);
  assigned.forEach(spec => activeAgents.push(addAvatar(officeRoot, spec)));
  const floorName = document.getElementById('officeSceneLabel');
  if (floorName) floorName.textContent = `${floor.name.toUpperCase()} · 330 m²`;
  const floorTitle = document.getElementById('floorSceneCaption');
  if (floorTitle) floorTitle.textContent = `${floor.name} · ${assigned.length ? `${assigned.length}명 배치` : '직원 배치 대기'}`;
}
function disposeGroup(group) {
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
  MAT.clear();
}

// Controls and view handling
document.getElementById('resetView')?.addEventListener('click', () => {
  camera.position.copy(initialCamera); controls.target.set(0, .6, 0); controls.update();
});
document.getElementById('zoomIn')?.addEventListener('click', () => { camera.position.sub(controls.target).multiplyScalar(.88).add(controls.target); controls.update(); });
document.getElementById('zoomOut')?.addEventListener('click', () => { camera.position.sub(controls.target).multiplyScalar(1.12).add(controls.target); controls.update(); });
document.getElementById('topView')?.addEventListener('click', () => { camera.position.set(0, 32, .1); controls.target.set(0, 0, 0); controls.update(); });
const toggleBtn = document.getElementById('toggleMotion');
toggleBtn?.addEventListener('click', () => { paused = !paused; toggleBtn.textContent = paused ? '▶ 애니메이션 재생' : 'Ⅱ 애니메이션 일시정지'; });
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(officeRoot.children, true);
  for (const hit of hits) {
    let object = hit.object;
    while (object && !object.userData.agentId) object = object.parent;
    if (object?.userData.agentId) { selectAgent(object.userData.agentId, true); break; }
  }
});
function resize() {
  const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container); else window.addEventListener('resize', resize);

renderFloorSwitcher(); buildOffice(); renderFloorAgents(); resize();
container.querySelector('.scene-fallback')?.classList.add('is-hidden');
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  if (!paused) activeAgents.forEach((a, i) => { a.torso.position.y = .75 + .009 * Math.sin(t * 1.6 + i); a.pin.position.y = 1.52 + .04 * Math.sin(t * 2.1 + i * 1.3); a.ring.rotation.z = t * .18; });
  controls.update(); renderer.render(scene, camera);
}
animate();
