// Animated effects theater: a transparent three.js canvas over the DOM board,
// with cannon-es supplying physics for debris. Loaded dynamically by ui.js so
// the game still works if the CDN is unreachable. All effect math runs in CSS
// pixel coordinates (y down); positions are negated on assignment because the
// orthographic camera maps scene y up.
//
// Effects: deploys arc out of the hand, Reinforce paradrops in, Transport
// ferries cards by boat, Redeploy sends a plane to winch the card home, enemy
// flips explode into shards, and your own flips pop out of (or dive into) a
// foxhole. Air Drop earns a flyover.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { byId } from './cards.js';
import { diffViews } from './fx-events.js';

const reduced = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const THEATER_COLOR = { air: 0xaec4d6, land: 0x77843e, sea: 0x135f80 };
const PAPER = 0xece2c8, INK = 0x262a20, OLIVE = 0x46503e;

const r = (a, b) => a + Math.random() * (b - a);
const clamp01 = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const easeIn = t => t * t * t;
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
const refKey = ref => JSON.stringify({ t: ref.t, p: ref.p, i: ref.i });

// ---------- stage ----------

let stage = null; // { renderer, scene, camera, world } | false once init failed
let active = [];
let running = false;
let last = 0;

function ensureStage() {
  if (stage || stage === false) return stage;
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.domElement.id = 'fx-canvas';
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, innerWidth, 0, -innerHeight, -4000, 4000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(200, 300, 700);
    scene.add(sun);

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 2300, 0) });

    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      camera.right = innerWidth;
      camera.bottom = -innerHeight;
      camera.updateProjectionMatrix();
    });

    stage = { renderer, scene, camera, world };
  } catch (e) {
    console.warn('fx: WebGL unavailable, animations disabled', e);
    stage = false;
  }
  return stage;
}

function spawn(effect) {
  effect.t = 0;
  active.push(effect);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.06);
  last = now;
  stage.world.step(1 / 60, dt, 4);
  for (let i = active.length - 1; i >= 0; i--) {
    const fx = active[i];
    fx.t += dt;
    let alive = false;
    try { alive = fx.update(fx.t, dt); } catch { /* drop a broken effect */ }
    if (!alive) {
      try { fx.dispose?.(); } catch { /* ignore */ }
      active.splice(i, 1);
    }
  }
  stage.renderer.render(stage.scene, stage.camera);
  if (active.length) requestAnimationFrame(frame);
  else running = false; // last render above left a clean transparent frame
}

// place a mesh using screen coordinates
function put(obj, x, y, z) { obj.position.set(x, -y, z); }

// ---------- textures & meshes ----------

const texCache = new Map();

function softTexture() {
  if (texCache.has('soft')) return texCache.get('soft');
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.65, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  texCache.set('soft', tex);
  return tex;
}

function flashTexture() {
  if (texCache.has('flash')) return texCache.get('flash');
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.35, 'rgba(255,190,90,.9)');
  grad.addColorStop(0.7, 'rgba(224,129,63,.4)');
  grad.addColorStop(1, 'rgba(224,129,63,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  texCache.set('flash', tex);
  return tex;
}

function cardFaceTexture(card) {
  const key = `face:${card.id}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = 176; c.height = 240;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 20, 240);
  bg.addColorStop(0, '#ece2c8');
  bg.addColorStop(1, '#e2d6b6');
  g.fillStyle = bg;
  g.fillRect(0, 0, 176, 240);
  g.fillStyle = `#${THEATER_COLOR[card.theater].toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 176, 18);
  g.fillStyle = '#262a20';
  g.font = "86px 'Staatliches','Arial Narrow',sans-serif";
  g.fillText(String(card.str), 16, 108);
  g.font = "bold 21px 'IBM Plex Sans',sans-serif";
  const words = card.name.split(' ');
  let line = '', ty = 150;
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (g.measureText(cand).width > 150 && line) { g.fillText(line, 14, ty); ty += 26; line = w; }
    else line = cand;
  }
  g.fillText(line, 14, ty);
  g.fillStyle = '#262a2088';
  g.font = "17px 'Staatliches','Arial Narrow',sans-serif";
  g.fillText(card.theater.toUpperCase(), 14, 222);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function cardBackTexture() {
  if (texCache.has('back')) return texCache.get('back');
  const c = document.createElement('canvas');
  c.width = 176; c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#46503e';
  g.fillRect(0, 0, 176, 240);
  g.strokeStyle = '#3e4837';
  g.lineWidth = 9;
  for (let x = -240; x < 240; x += 22) {
    g.beginPath(); g.moveTo(x, 240); g.lineTo(x + 240, 0); g.stroke();
  }
  g.fillStyle = '#d9b45b';
  g.font = "84px 'IBM Plex Sans',sans-serif";
  g.textAlign = 'center';
  g.fillText('★', 88, 148);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set('back', tex);
  return tex;
}

// A card mesh; the +z (viewer-facing) side shows the face when faceUp.
function makeCard(card, faceUp, w = 58, h = 80) {
  const face = new THREE.MeshLambertMaterial({
    map: card && faceUp ? cardFaceTexture(card) : cardBackTexture() });
  const rear = new THREE.MeshLambertMaterial({
    map: card && !faceUp ? cardFaceTexture(card) : cardBackTexture() });
  const edge = new THREE.MeshLambertMaterial({ color: 0x8a8265 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3),
    [edge, edge, edge, edge, face, rear]);
  return mesh;
}

function disposeMesh(obj) {
  obj.traverse?.(o => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
    else o.material?.dispose();
  });
  stage.scene.remove(obj);
}

function makeSprite(tex, color, additive = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  stage.scene.add(s);
  return s;
}

// ---------- shared particles ----------

function puff(x, y, { color = 0xbdb7a4, count = 8, size = 30, speed = 70, rise = 40, life = 0.7 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const s = makeSprite(softTexture(), color);
    const a = r(0, Math.PI * 2);
    parts.push({ s, x: x + r(-8, 8), y: y + r(-5, 5),
      vx: Math.cos(a) * r(0.3, 1) * speed, vy: Math.sin(a) * r(0.3, 1) * speed - rise,
      sz: size * r(0.6, 1.3), spin: r(-2, 2) });
  }
  spawn({
    update(t, dt) {
      const k = clamp01(t / life);
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.96; p.vy *= 0.96;
        put(p.s, p.x, p.y, 26);
        const sc = p.sz * (0.5 + k);
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = (1 - k) * 0.85;
        p.s.material.rotation += p.spin * dt;
      }
      return t < life;
    },
    dispose() { for (const p of parts) { stage.scene.remove(p.s); p.s.material.dispose(); } },
  });
}

// Physics-driven chunks (cannon bodies in screen coordinates, gravity +y).
function debris(x, y, { colors = [PAPER, OLIVE], count = 12, size = 12, speed = 320, life = 1.4 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const hx = r(3, size), hy = r(3, size);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 2, hy * 2, 3),
      new THREE.MeshLambertMaterial({ color: colors[i % colors.length], transparent: true }));
    stage.scene.add(mesh);
    const body = new CANNON.Body({
      mass: 0.3,
      shape: new CANNON.Box(new CANNON.Vec3(hx, hy, 1.5)),
      position: new CANNON.Vec3(x + r(-14, 14), y + r(-8, 8), r(10, 30)),
      velocity: new CANNON.Vec3(r(-1, 1) * speed, -r(0.4, 1.4) * speed, r(-40, 40)),
      angularVelocity: new CANNON.Vec3(r(-9, 9), r(-9, 9), r(-9, 9)),
    });
    stage.world.addBody(body);
    parts.push({ mesh, body });
  }
  spawn({
    update(t) {
      for (const p of parts) {
        p.mesh.position.set(p.body.position.x, -p.body.position.y, p.body.position.z);
        p.mesh.quaternion.copy(p.body.quaternion);
        p.mesh.material.opacity = 1 - easeIn(clamp01((t - life * 0.6) / (life * 0.4)));
      }
      return t < life;
    },
    dispose() {
      for (const p of parts) { stage.world.removeBody(p.body); disposeMesh(p.mesh); }
    },
  });
}

function shakeBoard() {
  const el = document.getElementById('board');
  if (!el) return;
  el.classList.remove('fx-shake');
  void el.offsetWidth; // restart the animation if one is mid-flight
  el.classList.add('fx-shake');
  setTimeout(() => el.classList.remove('fx-shake'), 400);
}

// Hides a freshly-rendered DOM node until its animation "delivers" it.
function hold(el) {
  if (!el) return () => {};
  el.classList.add('fx-hold');
  let done = false;
  return () => { if (!done) { done = true; el.classList.remove('fx-hold'); } };
}

// ---------- vehicles ----------

// Little side-view prop plane, nose toward +x. userData.prop spins.
function makePlane(scale = 1) {
  const g = new THREE.Group();
  const olive = new THREE.MeshLambertMaterial({ color: 0x6b7451 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4c5540 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(7, 30, 4, 10), olive);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9db6c4 }));
  canopy.position.set(4, 7, 0);
  canopy.scale.set(1.4, 0.9, 1);
  g.add(canopy);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(15, 3, 44), olive);
  wing.position.set(1, -1, 0);
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 20), dark);
  tail.position.set(-19, 3, 0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(9, 12, 2.5), dark);
  fin.position.set(-20, 8, 0);
  g.add(fin);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 2.5), new THREE.MeshLambertMaterial({ color: 0x2c2c2c }));
  prop.position.set(23.5, 0, 0);
  g.add(prop);
  g.userData.prop = prop;
  g.scale.setScalar(scale);
  stage.scene.add(g);
  return g;
}

function makeBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(72, 15, 20),
    new THREE.MeshLambertMaterial({ color: 0x4f5d68 }));
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(10, 20, 4),
    new THREE.MeshLambertMaterial({ color: 0x4f5d68 }));
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(44, 0, 0);
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(26, 13, 15),
    new THREE.MeshLambertMaterial({ color: 0x8b968f }));
  cabin.position.set(-8, 13, 0);
  g.add(cabin);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0x3a3f3d }));
  funnel.position.set(-24, 15, 0);
  g.add(funnel);
  stage.scene.add(g);
  return g;
}

function makeParachute() {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(30, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xcdc6ad, side: THREE.DoubleSide }));
  g.add(canopy);
  const mat = new THREE.LineBasicMaterial({ color: 0x555242 });
  const pts = [];
  for (const a of [0.4, 1.9, 4.4, 5.9]) {
    pts.push(new THREE.Vector3(Math.cos(a) * 26, -4, Math.sin(a) * 12));
    pts.push(new THREE.Vector3(0, -46, 0));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  g.userData.canopy = canopy;
  stage.scene.add(g);
  return g;
}

// ---------- effects ----------

// Enemy card flipped: it blows up, revealing whatever is underneath the smoke.
function explodeFlip(rect, card) {
  const { x, y } = center(rect);
  const col = card ? THEATER_COLOR[card.theater] : OLIVE;
  debris(x, y, { colors: [col, PAPER, OLIVE, 0x3a3a2c], count: 16, size: 10, speed: 380 });
  puff(x, y, { color: 0x6f6a5c, count: 10, size: 40, speed: 60, rise: 60, life: 0.9 });
  const flash = makeSprite(flashTexture(), 0xffffff, true);
  put(flash, x, y, 50);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc879, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  put(ring, x, y, 48);
  stage.scene.add(ring);
  shakeBoard();
  spawn({
    update(t) {
      const kf = clamp01(t / 0.25);
      const sc = lerp(16, Math.max(rect.width, 90) * 1.7, easeOut(kf));
      flash.scale.set(sc, sc, 1);
      flash.material.opacity = 1 - kf;
      const kr = clamp01(t / 0.5);
      const rs = lerp(8, Math.max(rect.width, 90) * 1.2, easeOut(kr));
      ring.scale.set(rs, rs, 1);
      ring.material.opacity = 0.9 * (1 - kr);
      return t < 0.5;
    },
    dispose() { stage.scene.remove(flash); flash.material.dispose(); disposeMesh(ring); },
  });
}

// Your own card flipped face-up: it pops out of a foxhole like a gopher.
function popFromHole(rect, card, reveal) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({ color: 0x14170f, transparent: true, depthWrite: false }));
  put(hole, cx, cy + 8, 2);
  stage.scene.add(hole);
  const mesh = makeCard(card, true);
  put(mesh, cx, cy + 12, 8);
  mesh.scale.setScalar(0.2);
  mesh.rotation.x = -1.3;
  stage.scene.add(mesh);
  debris(cx, cy + 8, { colors: [0x4a3f2c, 0x5c4f36, 0x35301f], count: 8, size: 5, speed: 200, life: 0.9 });
  spawn({
    update(t) {
      const hk = clamp01(t / 0.16);
      hole.scale.set(lerp(4, rect.height * 1.5, hk), lerp(2, rect.height * 0.55, hk), 1);
      if (t < 0.5) { // spring up
        const k = easeOut(clamp01((t - 0.06) / 0.44));
        put(mesh, cx, lerp(cy + 12, cy - 48, k), 8);
        mesh.scale.setScalar(lerp(0.2, 1, k));
        mesh.rotation.x = lerp(-1.3, 0, k);
        mesh.rotation.z = Math.sin(t * 18) * 0.12 * (1 - k);
      } else if (t < 0.78) { // drop onto the strip
        const k = easeIn((t - 0.5) / 0.28);
        put(mesh, cx, lerp(cy - 48, cy, k), 8);
      } else { // hole closes
        if (mesh.visible) {
          mesh.visible = false;
          reveal();
          puff(cx, cy, { color: 0x8a8265, count: 5, size: 20, speed: 50, rise: 15, life: 0.4 });
        }
        const k = clamp01((t - 0.78) / 0.2);
        hole.scale.x *= 1 - k;
        hole.material.opacity = 1 - k;
      }
      return t < 1;
    },
    dispose() { reveal(); disposeMesh(mesh); disposeMesh(hole); },
  });
}

// Your own card flipped face-down: it dives back into its hole.
function diveIntoHole(rect, card, reveal) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({ color: 0x14170f, transparent: true, depthWrite: false }));
  put(hole, cx, cy + 8, 2);
  stage.scene.add(hole);
  const mesh = makeCard(card, true); // face still showing as it bails out
  put(mesh, cx, cy, 8);
  stage.scene.add(mesh);
  spawn({
    update(t) {
      const hk = clamp01(t / 0.15);
      hole.scale.set(lerp(4, rect.height * 1.5, hk), lerp(2, rect.height * 0.55, hk), 1);
      if (t < 0.3) { // hop up and tip head-first
        const k = easeOut(t / 0.3);
        put(mesh, cx, cy - 34 * Math.sin(k * Math.PI * 0.5), 8);
        mesh.rotation.z = k * Math.PI;
      } else if (t < 0.62) { // plunge
        const k = easeIn((t - 0.3) / 0.32);
        put(mesh, cx, lerp(cy - 34, cy + 14, k), 8);
        mesh.rotation.z = Math.PI;
        mesh.scale.setScalar(lerp(1, 0.15, k));
        if (k > 0.7 && mesh.visible) {
          debris(cx, cy + 8, { colors: [0x4a3f2c, 0x5c4f36], count: 6, size: 4, speed: 170, life: 0.7 });
        }
      } else {
        if (mesh.visible) { mesh.visible = false; reveal(); }
        const k = clamp01((t - 0.62) / 0.22);
        hole.scale.x *= 1 - k;
        hole.material.opacity = 1 - k;
      }
      return t < 0.9;
    },
    dispose() { reveal(); disposeMesh(mesh); disposeMesh(hole); },
  });
}

// A played card arcs from the hand (or the opponent's hand tally) to its lane.
function deployToss(from, toRect, card, faceUp, reveal) {
  const to = center(toRect);
  const mesh = makeCard(card, faceUp, 74, 102);
  put(mesh, from.x, from.y, 30);
  stage.scene.add(mesh);
  const apex = Math.min(from.y, to.y) - lerp(60, 130, clamp01(Math.abs(to.x - from.x) / 600));
  const dur = 0.62;
  spawn({
    update(t) {
      const k = easeIO(clamp01(t / dur));
      const x = lerp(from.x, to.x, k);
      const m = 4 * k * (1 - k); // parabola through the apex
      const y = lerp(from.y, to.y, k) - m * (Math.min(from.y, to.y) - apex);
      put(mesh, x, y, 30);
      mesh.scale.setScalar(lerp(1, 0.62, k));
      mesh.rotation.z = Math.sin(k * Math.PI) * (to.x >= from.x ? -0.5 : 0.5);
      if (t >= dur && mesh.visible) {
        mesh.visible = false;
        reveal();
        puff(to.x, to.y, { color: 0x9a9280, count: 6 });
      }
      return t < dur + 0.05;
    },
    dispose() { reveal(); disposeMesh(mesh); },
  });
}

// Reinforce: the top deck card floats down under a parachute.
function paradrop(toRect, card, reveal) {
  const to = center(toRect);
  const mesh = makeCard(card, false);
  stage.scene.add(mesh);
  const chute = makeParachute();
  const startY = -110;
  const dur = Math.min(1.7, (to.y - startY) / 260);
  spawn({
    update(t) {
      const k = clamp01(t / dur);
      if (k < 1) {
        const sway = Math.sin(t * 2.6) * 22 * (1 - k * 0.5);
        const x = to.x + sway;
        const y = lerp(startY, to.y, lerp(k, easeOut(k), 0.4));
        put(mesh, x, y, 24);
        mesh.rotation.z = Math.sin(t * 2.6) * 0.1;
        put(chute, x, y - 52, 23);
        chute.rotation.z = Math.sin(t * 2.6 + 0.5) * 0.12;
      } else {
        if (mesh.visible) {
          mesh.visible = false;
          reveal();
          puff(to.x, to.y, { color: 0x8a8265, count: 6, size: 22, rise: 10, life: 0.5 });
        }
        const c = clamp01((t - dur) / 0.28);
        put(chute, to.x, to.y - 52 + c * 34, 23);
        chute.scale.y = 1 - c * 0.9;
        chute.userData.canopy.material.opacity = 1 - c;
        chute.userData.canopy.material.transparent = true;
      }
      return t < dur + 0.3;
    },
    dispose() { reveal(); disposeMesh(mesh); disposeMesh(chute); },
  });
}

// Transport / Amphibious Assault: a steamboat ferries the card between lanes.
// `flipped` cards ride showing their back and turn over as they hop ashore.
function boatMove(fromRect, toRect, card, faceUp, flipped, reveal) {
  const from = center(fromRect), to = center(toRect);
  const boat = makeBoat();
  const dir = to.x >= from.x ? 1 : -1;
  boat.scale.x = dir;
  const mesh = makeCard(card, faceUp);
  if (flipped) mesh.rotation.y = Math.PI;
  stage.scene.add(mesh);
  const wave = makeSprite(softTexture(), 0x46a5c4);
  wave.material.opacity = 0.55;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const dur = Math.max(0.9, Math.min(1.8, dist / 380));
  let lastWake = 0;
  spawn({
    update(t) {
      if (t < dur) {
        const k = easeIO(clamp01(t / dur));
        const x = lerp(from.x, to.x, k);
        const y = lerp(from.y, to.y, k) + Math.sin(t * 9) * 2.5;
        put(boat, x, y + 6, 20);
        boat.rotation.z = Math.sin(t * 9 + 1) * 0.05 * dir;
        put(mesh, x - dir * 6, y - 18, 22);
        mesh.rotation.z = boat.rotation.z;
        put(wave, x, y + 16, 19);
        wave.scale.set(95, 26, 1);
        if (t - lastWake > 0.09 && k > 0.02 && k < 0.98) {
          lastWake = t;
          puff(x - dir * 44, y + 12, { color: 0xdfeef5, count: 2, size: 14, speed: 25, rise: 4, life: 0.45 });
        }
      } else if (t < dur + 0.3) { // card hops ashore
        const k = easeOut((t - dur) / 0.3);
        put(mesh, lerp(to.x - dir * 6, to.x, k), lerp(to.y - 18, to.y, k), 22);
        if (flipped) mesh.rotation.y = Math.PI * (1 - k);
        put(boat, to.x + dir * k * 130, to.y + 6 + k * 26, 20);
        boat.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - k; } });
        wave.material.opacity = 0.55 * (1 - k);
      } else {
        if (mesh.visible) {
          mesh.visible = false;
          reveal();
          puff(to.x, to.y, { color: 0xdfeef5, count: 5, size: 18, rise: 8, life: 0.4 });
        }
      }
      return t < dur + 0.42;
    },
    dispose() { reveal(); disposeMesh(mesh); disposeMesh(boat); stage.scene.remove(wave); wave.material.dispose(); },
  });
}

// Redeploy: a plane swoops in, winches the card up and hauls it back to hand.
function planePickup(fromRect, dropAt, card, reveal) {
  const from = center(fromRect);
  const plane = makePlane(1.6);
  const mesh = makeCard(card, false);
  put(mesh, from.x, from.y, 8);
  stage.scene.add(mesh);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3a3f35 });
  const lineGeo = new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, lineMat);
  line.visible = false;
  stage.scene.add(line);

  const entryDir = from.x < innerWidth / 2 ? 1 : -1; // fly in across the board
  const enter = { x: entryDir > 0 ? -160 : innerWidth + 160, y: from.y - 95 };
  const hover = { x: from.x, y: from.y - 64 };
  const dropDir = dropAt.x >= hover.x ? 1 : -1;
  const exit = { x: dropDir > 0 ? innerWidth + 180 : -180, y: dropAt.y - 260 };
  const planeP = { x: enter.x, y: enter.y };
  let cardHome = false;

  function setPlane(x, y, dir, bank) {
    planeP.x = x; planeP.y = y;
    put(plane, x, y, 40);
    plane.scale.x = Math.abs(plane.scale.x) * (dir >= 0 ? 1 : -1);
    plane.rotation.z = bank * (dir >= 0 ? 1 : -1);
  }
  function setLine(cx, cy) {
    const pos = lineGeo.attributes.position;
    pos.setXYZ(0, planeP.x, -(planeP.y + 8), 39);
    pos.setXYZ(1, cx, -(cy - 26), 39);
    pos.needsUpdate = true;
  }

  spawn({
    update(t, dt) {
      plane.userData.prop.rotation.x += dt * 40;
      if (t < 0.75) { // approach
        const k = easeIO(t / 0.75);
        setPlane(lerp(enter.x, hover.x, k), lerp(enter.y, hover.y, k) + Math.sin(t * 7) * 3,
          entryDir, Math.sin(k * Math.PI) * 0.12);
      } else if (t < 1.1) { // winch the card up
        const k = easeIO((t - 0.75) / 0.35);
        setPlane(hover.x, hover.y + Math.sin(t * 7) * 3, entryDir, 0);
        line.visible = true;
        const cy = lerp(from.y, planeP.y + 34, k);
        put(mesh, from.x, cy, 38);
        mesh.scale.setScalar(lerp(1, 0.85, k));
        setLine(from.x, cy);
      } else if (t < 2.1) { // haul it to the hand
        const k = easeIO((t - 1.1) / 1);
        const x = lerp(hover.x, dropAt.x, k);
        const y = lerp(hover.y, dropAt.y - 70, k) - Math.sin(k * Math.PI) * 90;
        setPlane(x, y, dropDir, Math.sin(k * Math.PI) * 0.22);
        const cx = x - dropDir * 10 * Math.sin(k * Math.PI);
        const cy = y + 34;
        put(mesh, cx, cy, 38);
        mesh.rotation.z = Math.sin(t * 5) * 0.06;
        setLine(cx, cy);
      } else { // release + fly off
        line.visible = false;
        const k = clamp01((t - 2.1) / 0.6);
        setPlane(lerp(dropAt.x, exit.x, easeIn(k)), lerp(dropAt.y - 70, exit.y, easeIn(k)),
          dropDir, -0.18);
        if (!cardHome) {
          const c = clamp01((t - 2.1) / 0.3);
          put(mesh, dropAt.x, lerp(dropAt.y - 70 + 34, dropAt.y, easeIn(c)), 38);
          if (c >= 1) {
            cardHome = true;
            mesh.visible = false;
            reveal();
            puff(dropAt.x, dropAt.y, { color: 0x8a8265, count: 5, size: 20, rise: 12, life: 0.4 });
          }
        }
      }
      return t < 2.75;
    },
    dispose() {
      reveal(); disposeMesh(mesh); disposeMesh(plane);
      stage.scene.remove(line); lineGeo.dispose(); lineMat.dispose();
    },
  });
}

// Air Drop: a transport rumbles across the top of the board trailing chutes.
function flyover(boardRect) {
  const plane = makePlane(1.5);
  const y0 = boardRect.top + 46;
  const chutes = [];
  const dur = 1.9;
  spawn({
    update(t, dt) {
      plane.userData.prop.rotation.x += dt * 40;
      const k = clamp01(t / dur);
      const x = lerp(boardRect.left - 180, boardRect.right + 180, k);
      put(plane, x, y0 + Math.sin(t * 5) * 4, 44);
      plane.scale.x = Math.abs(plane.scale.x);
      for (const n of [0.35, 0.55, 0.75]) {
        if (k > n && chutes.length < [0.35, 0.55, 0.75].indexOf(n) + 1) {
          const chute = makeParachute();
          chute.scale.setScalar(0.35);
          const crate = new THREE.Mesh(new THREE.BoxGeometry(13, 13, 13),
            new THREE.MeshLambertMaterial({ color: 0x7a6f4d, transparent: true }));
          stage.scene.add(crate);
          chutes.push({ chute, crate, x, y: y0, t0: t });
        }
      }
      for (const c of chutes) {
        const ct = t - c.t0;
        const cy = c.y + ct * 95;
        const cx = c.x + Math.sin(ct * 3) * 10;
        put(c.chute, cx, cy, 42);
        put(c.crate, cx, cy + 18, 42);
        const fade = 1 - clamp01((ct - 0.9) / 0.5);
        c.crate.material.opacity = fade;
        c.chute.userData.canopy.material.transparent = true;
        c.chute.userData.canopy.material.opacity = fade;
      }
      return t < dur + 0.6;
    },
    dispose() {
      disposeMesh(plane);
      for (const c of chutes) { disposeMesh(c.chute); disposeMesh(c.crate); }
    },
  });
}

// ---------- small building blocks for flourishes ----------

function delay(d, fn) {
  spawn({ update(t) { if (t >= d) { fn(); return false; } return true; } });
}

function ringPulse(x, y, { color = 0xd9b45b, radius = 90, dur = 0.6, after = 0 } = {}) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.visible = false;
  put(ring, x, y, 34);
  stage.scene.add(ring);
  spawn({
    update(t) {
      if (t < after) return true;
      const k = clamp01((t - after) / dur);
      ring.visible = true;
      const s = lerp(6, radius, easeOut(k));
      ring.scale.set(s, s, 1);
      ring.material.opacity = 0.85 * (1 - k);
      return k < 1;
    },
    dispose() { disposeMesh(ring); },
  });
}

// A stretched glowing smear that travels from (x,y) by (dx,dy). Tracer fire,
// wind gusts, strafing runs.
function streak(x, y, { dx = 260, dy = 0, len = 90, thick = 9, color = 0xffffff, dur = 0.4, after = 0 } = {}) {
  const s = makeSprite(softTexture(), color, true);
  s.visible = false;
  s.material.rotation = Math.atan2(-dy, dx);
  spawn({
    update(t) {
      if (t < after) return true;
      const k = clamp01((t - after) / dur);
      s.visible = true;
      put(s, x + dx * k, y + dy * k, 36);
      s.scale.set(len, thick, 1);
      s.material.opacity = 0.75 * (1 - k);
      return k < 1;
    },
    dispose() { stage.scene.remove(s); s.material.dispose(); },
  });
}

// A shell that arcs from a to b, then calls impact().
function shellArc(a, b, { dur = 0.45, after = 0, impact = null } = {}) {
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(2.6, 9, 3, 6),
    new THREE.MeshLambertMaterial({ color: 0x33362e }));
  shell.visible = false;
  stage.scene.add(shell);
  const apex = Math.min(a.y, b.y) - 90;
  spawn({
    update(t) {
      if (t < after) return true;
      const k = clamp01((t - after) / dur);
      shell.visible = true;
      const x = lerp(a.x, b.x, k);
      const m = 4 * k * (1 - k);
      const y = lerp(a.y, b.y, k) - m * (Math.min(a.y, b.y) - apex);
      put(shell, x, y, 42);
      shell.rotation.z = Math.atan2(-(b.y - a.y), b.x - a.x) + (k - 0.5) * 1.6 - Math.PI / 2;
      if (k >= 1 && impact) { impact(); return false; }
      return k < 1;
    },
    dispose() { disposeMesh(shell); },
  });
}

// A searchlight ellipse sweeping across an area (Spotter, Scout Report…).
function sweepLight(area, { color = 0xfff2c0, dur = 0.9 } = {}) {
  const s = makeSprite(softTexture(), color, true);
  spawn({
    update(t) {
      const k = clamp01(t / dur);
      put(s, lerp(area.left + 40, area.right - 40, easeIO(k)), area.top + area.height / 2, 34);
      s.scale.set(150, area.height * 0.95, 1);
      s.material.opacity = 0.35 * Math.sin(Math.PI * k);
      return k < 1;
    },
    dispose() { stage.scene.remove(s); s.material.dispose(); },
  });
}

// ---------- more vehicles ----------

function makeTank() {
  const g = new THREE.Group();
  const olive = new THREE.MeshLambertMaterial({ color: 0x5f6b46 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x363c2c });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(46, 12, 18), olive);
  g.add(hull);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(48, 7, 19), dark);
  skirt.position.y = -8;
  g.add(skirt);
  const turret = new THREE.Mesh(new THREE.BoxGeometry(21, 10, 14), olive);
  turret.position.set(-3, 10, 0);
  g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 26, 8), dark);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(18, 12, 0);
  g.add(barrel);
  stage.scene.add(g);
  return g;
}

function makeZeppelin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(15, 14, 10),
    new THREE.MeshLambertMaterial({ color: 0xa8aba4 }));
  body.scale.set(2.3, 0.78, 0.78);
  g.add(body);
  const finMat = new THREE.MeshLambertMaterial({ color: 0x7c8078 });
  const finV = new THREE.Mesh(new THREE.BoxGeometry(12, 16, 2), finMat);
  finV.position.set(-30, 0, 0);
  g.add(finV);
  const finH = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 16), finMat);
  finH.position.set(-30, 0, 0);
  g.add(finH);
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(13, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x40453c }));
  gondola.position.set(3, -13, 0);
  g.add(gondola);
  stage.scene.add(g);
  return g;
}

function makeTruck() {
  const g = new THREE.Group();
  const olive = new THREE.MeshLambertMaterial({ color: 0x6b7451 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3f35 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 14), olive);
  bed.position.set(-8, 2, 0);
  g.add(bed);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(13, 13, 13), new THREE.MeshLambertMaterial({ color: 0x59634a }));
  cab.position.set(14, 3, 0);
  g.add(cab);
  for (const wx of [-16, -2, 13]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 10), dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, -6, 8);
    g.add(wheel);
  }
  stage.scene.add(g);
  return g;
}

function makeGlider() {
  const g = new THREE.Group();
  const pale = new THREE.MeshLambertMaterial({ color: 0xb8b3a2 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(4.5, 24, 4, 8), pale);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 2.5, 12), pale);
  wing.position.set(2, 4, 0);
  wing.rotation.z = 0.06;
  g.add(wing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 2), pale);
  fin.position.set(-15, 6, 0);
  g.add(fin);
  stage.scene.add(g);
  return g;
}

function makeMine() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2f3430 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), dark));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 6), dark);
    spike.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    spike.rotation.z = a - Math.PI / 2;
    g.add(spike);
  }
  stage.scene.add(g);
  return g;
}

// ---------- alternate move rides ----------

// Glider Drop / moves into the air lane: a silent swoop.
function gliderMove(fromRect, toRect, card, faceUp, flipped, reveal) {
  const from = center(fromRect), to = center(toRect);
  const glider = makeGlider();
  const dir = to.x >= from.x ? 1 : -1;
  const mesh = makeCard(card, faceUp);
  if (flipped) mesh.rotation.y = Math.PI;
  stage.scene.add(mesh);
  const apex = Math.min(from.y, to.y) - 120;
  const dur = 1.25;
  spawn({
    update(t) {
      if (t < dur) {
        const k = easeIO(clamp01(t / dur));
        const x = lerp(from.x, to.x, k);
        const m = 4 * k * (1 - k);
        const y = lerp(from.y, to.y, k) - m * (Math.min(from.y, to.y) - apex);
        put(glider, x, y - 34, 40);
        glider.scale.x = dir;
        glider.rotation.z = Math.sin(k * Math.PI) * 0.2 * dir;
        put(mesh, x, y, 38);
        mesh.rotation.z = glider.rotation.z * 0.6;
        if (flipped) mesh.rotation.y = Math.PI * (1 - clamp01((k - 0.6) / 0.4));
      } else {
        if (mesh.visible) {
          mesh.visible = false;
          reveal();
          puff(to.x, to.y, { color: 0x8a8265, count: 5, size: 20, rise: 10, life: 0.4 });
        }
        const k = clamp01((t - dur) / 0.4);
        put(glider, to.x + dir * k * 200, to.y - 34 + k * 90, 40);
        glider.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - k; } });
      }
      return t < dur + 0.4;
    },
    dispose() { reveal(); disposeMesh(mesh); disposeMesh(glider); },
  });
}

// Land moves: an army truck with the card in the bed.
function truckMove(fromRect, toRect, card, faceUp, flipped, reveal) {
  const from = center(fromRect), to = center(toRect);
  const truck = makeTruck();
  const dir = to.x >= from.x ? 1 : -1;
  truck.scale.x = dir;
  const mesh = makeCard(card, faceUp, 46, 64);
  if (flipped) mesh.rotation.y = Math.PI;
  stage.scene.add(mesh);
  const dur = Math.max(0.8, Math.min(1.5, Math.hypot(to.x - from.x, to.y - from.y) / 420));
  let lastDust = 0;
  spawn({
    update(t) {
      if (t < dur) {
        const k = easeIO(clamp01(t / dur));
        const x = lerp(from.x, to.x, k);
        const y = lerp(from.y, to.y, k) + Math.sin(t * 22) * 1.2;
        put(truck, x, y + 8, 20);
        put(mesh, x - dir * 9, y - 12, 22);
        mesh.rotation.z = -0.12 * dir;
        if (t - lastDust > 0.11 && k > 0.03 && k < 0.97) {
          lastDust = t;
          puff(x - dir * 30, y + 14, { color: 0x6e6450, count: 2, size: 15, speed: 25, rise: 12, life: 0.5 });
        }
      } else if (t < dur + 0.28) {
        const k = easeOut((t - dur) / 0.28);
        put(mesh, lerp(to.x - dir * 9, to.x, k), lerp(to.y - 12, to.y, k), 22);
        mesh.rotation.z = -0.12 * dir * (1 - k);
        if (flipped) mesh.rotation.y = Math.PI * (1 - k);
        put(truck, to.x + dir * k * 140, to.y + 8, 20);
        truck.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - k; } });
      } else if (mesh.visible) {
        mesh.visible = false;
        reveal();
        puff(to.x, to.y, { color: 0x8a8265, count: 4, size: 16, rise: 8, life: 0.4 });
      }
      return t < dur + 0.34;
    },
    dispose() { reveal(); disposeMesh(mesh); disposeMesh(truck); },
  });
}

// Drift Mine: the disguised card drifts over as a naval mine.
function mineMove(fromRect, toRect, reveal) {
  const from = center(fromRect), to = center(toRect);
  const mine = makeMine();
  const dur = 1.35;
  let lastBubble = 0;
  spawn({
    update(t) {
      if (t < dur) {
        const k = easeIO(clamp01(t / dur));
        const x = lerp(from.x, to.x, k);
        const y = lerp(from.y, to.y, k) + Math.sin(t * 5) * 4;
        put(mine, x, y, 22);
        mine.rotation.z = t * 0.8;
        if (t - lastBubble > 0.12) {
          lastBubble = t;
          puff(x, y + 10, { color: 0xdfeef5, count: 1, size: 10, speed: 12, rise: 18, life: 0.5 });
        }
      } else if (mine.visible) {
        mine.visible = false;
        reveal();
        puff(to.x, to.y, { color: 0xdfeef5, count: 6, size: 18, rise: 10, life: 0.45 });
      }
      return t < dur + 0.1;
    },
    dispose() { reveal(); disposeMesh(mine); },
  });
}

// Jet Stream: the card is blown tumbling to the next lane on a gust.
function gustMove(fromRect, toRect, card, faceUp, flipped, reveal) {
  const from = center(fromRect), to = center(toRect);
  const mesh = makeCard(card, faceUp);
  if (flipped) mesh.rotation.y = Math.PI;
  stage.scene.add(mesh);
  const dir = to.x >= from.x ? 1 : -1;
  const dur = 0.75;
  for (let i = 0; i < 4; i++) {
    streak(from.x - dir * 40, from.y + r(-26, 26), {
      dx: (to.x - from.x) * 1.3, dy: (to.y - from.y) * r(0.7, 1.3),
      len: 120, color: 0xdfeef5, dur: 0.5, after: i * 0.09 });
  }
  spawn({
    update(t) {
      const k = easeOut(clamp01(t / dur));
      put(mesh, lerp(from.x, to.x, k), lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * 30, 30);
      mesh.rotation.z = dir * (1 - k) * 6 * Math.sin(t * 14);
      if (flipped) mesh.rotation.y = Math.PI * (1 - k);
      if (t >= dur && mesh.visible) {
        mesh.visible = false;
        reveal();
        puff(to.x, to.y, { color: 0xdfeef5, count: 5, size: 16, rise: 8, life: 0.4 });
      }
      return t < dur + 0.05;
    },
    dispose() { reveal(); disposeMesh(mesh); },
  });
}

// Conscription: a card zips from the deck counter into the hand.
function drawFly(from, to, reveal) {
  const mesh = makeCard(null, false, 44, 60);
  stage.scene.add(mesh);
  const apex = Math.min(from.y, to.y) - 70;
  const dur = 0.55;
  spawn({
    update(t) {
      const k = easeIO(clamp01(t / dur));
      const m = 4 * k * (1 - k);
      put(mesh, lerp(from.x, to.x, k),
        lerp(from.y, to.y, k) - m * (Math.min(from.y, to.y) - apex), 40);
      mesh.rotation.z = k * Math.PI * 2 * (to.x >= from.x ? -0.5 : 0.5);
      mesh.scale.setScalar(lerp(0.7, 1.3, k));
      if (t >= dur && mesh.visible) {
        mesh.visible = false;
        reveal();
        puff(to.x, to.y, { color: 0xd9b45b, count: 4, size: 16, rise: 8, life: 0.35 });
      }
      return t < dur + 0.05;
    },
    dispose() { reveal(); disposeMesh(mesh); },
  });
}

// ---------- per-card deploy flourishes ----------
// Each runs shortly after the card lands (deploy or flip-up reveal).
// o = { rect, lane, ev, next, after, me }

function zoneAcross(o) { // the zone the card's enemy plays into, viewer-adjusted
  const L = o.lane;
  const mine = o.ev.player === o.me;
  return mine
    ? { left: L.left, right: L.right, top: L.top, height: L.height * 0.38 }
    : { left: L.left, right: L.right, top: L.top + L.height * 0.62, height: L.height * 0.38 };
}

function fxSupport(o) {
  const c = center(o.rect);
  for (let i = 0; i < 3; i++) {
    ringPulse(c.x, c.y, { color: 0xd9b45b, radius: 110 + i * 45, dur: 0.7, after: i * 0.16 });
  }
}

function fxBeacon(o) {
  const c = center(o.rect);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(24, 120, 3),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.geometry.translate(0, 60, 0); // pivot at the apex
  const g = new THREE.Group();
  g.add(beam);
  put(g, c.x, c.y, 34);
  stage.scene.add(g);
  spawn({
    update(t) {
      const k = clamp01(t / 1.3);
      g.rotation.z = easeIO(k) * Math.PI * 2.5;
      beam.material.opacity = 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.15));
      return k < 1;
    },
    dispose() { disposeMesh(g); },
  });
}

function fxLockdown(o) {
  const c = { x: o.lane.left + o.lane.width / 2, y: o.lane.top + o.lane.height / 2 };
  const mat = new THREE.MeshBasicMaterial({ color: 0xd23b2f, transparent: true, opacity: 0, depthWrite: false });
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.74, 1, 44), mat);
  ring.scale.set(52, 52, 1);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(84, 13, 2), mat);
  bar.rotation.z = -Math.PI / 4;
  g.add(ring, bar);
  put(g, c.x, c.y, 44);
  stage.scene.add(g);
  let slammed = false;
  spawn({
    update(t) {
      if (t < 0.3) {
        const k = easeIn(t / 0.3);
        const s = lerp(2.6, 1, k);
        g.scale.set(s, s, 1);
        mat.opacity = k;
      } else {
        if (!slammed) { slammed = true; shakeBoard(); puff(c.x, c.y, { color: 0xb0483c, count: 6, size: 24, life: 0.5 }); }
        g.scale.set(1, 1, 1);
        mat.opacity = 0.95 * (1 - easeIn(clamp01((t - 0.85) / 0.35)));
      }
      return t < 1.2;
    },
    dispose() { disposeMesh(g); },
  });
}

function fxBombingRun(o) {
  const L = o.lane;
  const y = o.rect.top - 70;
  const plane = makePlane(1.25);
  plane.traverse(m => { if (m.material) m.material.color?.multiplyScalar(0.55); });
  const dropped = [];
  const dur = 1.5;
  spawn({
    update(t, dt) {
      plane.userData.prop.rotation.x += dt * 40;
      const k = clamp01(t / dur);
      const x = lerp(L.left - 120, L.right + 120, k);
      put(plane, x, y + Math.sin(t * 6) * 3, 44);
      for (const n of [0.3, 0.45, 0.6]) {
        if (k > n && !dropped.includes(n)) {
          dropped.push(n);
          const bx = x, target = { x: bx + 14, y: o.rect.top + r(-6, 18) };
          shellArc({ x: bx, y }, target, {
            dur: 0.4,
            impact: () => {
              const f = makeSprite(flashTexture(), 0xffffff, true);
              put(f, target.x, target.y, 46);
              spawn({ update(tt) { const kk = clamp01(tt / 0.22); f.scale.set(lerp(8, 70, easeOut(kk)), lerp(8, 70, easeOut(kk)), 1); f.material.opacity = 1 - kk; return kk < 1; },
                dispose() { stage.scene.remove(f); f.material.dispose(); } });
              puff(target.x, target.y, { color: 0x6f6a5c, count: 5, size: 22, rise: 30, life: 0.6 });
              if (n === 0.45) shakeBoard();
            } });
        }
      }
      return k < 1;
    },
    dispose() { disposeMesh(plane); },
  });
}

function fxCoverFire(o) {
  const R = o.rect;
  const up = o.ev.player === o.me ? -1 : 1; // toward the enemy's side
  for (let i = 0; i < 6; i++) {
    streak(r(R.left + 12, R.right - 12), R.top + R.height / 2, {
      dx: r(-35, 35), dy: up * r(120, 190), len: 55, thick: 6,
      color: 0xffd98a, dur: 0.3, after: i * 0.07 });
  }
}

function fxLightning(o) {
  const L = o.lane, c = center(o.rect);
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = c.x + (i === 0 || i === n ? 0 : r(-26, 26));
    pts.push(new THREE.Vector3(x, -lerp(L.top - 10, c.y, k), 45));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xfff7b0, transparent: true, blending: THREE.AdditiveBlending }));
  stage.scene.add(line);
  const f = makeSprite(flashTexture(), 0xfff7b0, true);
  put(f, c.x, c.y, 46);
  shakeBoard();
  spawn({
    update(t) {
      line.visible = (t < 0.07) || (t > 0.12 && t < 0.2) || (t > 0.24 && t < 0.38);
      line.material.opacity = 1 - clamp01(t / 0.4);
      const k = clamp01(t / 0.3);
      f.scale.set(lerp(10, 90, easeOut(k)), lerp(10, 90, easeOut(k)), 1);
      f.material.opacity = 0.9 * (1 - k);
      return t < 0.4;
    },
    dispose() { disposeMesh(line); stage.scene.remove(f); f.material.dispose(); },
  });
}

function fxTankRoll(o) {
  const L = o.lane, y = center(o.rect).y;
  const tank = makeTank();
  const dir = Math.random() < 0.5 ? 1 : -1;
  const x0 = dir > 0 ? L.left - 70 : L.right + 70;
  const x1 = dir > 0 ? L.right + 70 : L.left - 70;
  const dur = 1.5;
  let lastDust = 0;
  spawn({
    update(t) {
      const k = clamp01(t / dur);
      const x = lerp(x0, x1, easeIO(k));
      put(tank, x, y + Math.sin(t * 18) * 1.4, 24);
      tank.scale.x = dir;
      tank.rotation.z = Math.sin(t * 9) * 0.02;
      const fade = Math.min(1, Math.min(k, 1 - k) * 8);
      tank.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = fade; } });
      if (t - lastDust > 0.1 && k > 0.05 && k < 0.95) {
        lastDust = t;
        puff(x - dir * 28, y + 10, { color: 0x6e6450, count: 2, size: 16, speed: 20, rise: 10, life: 0.5 });
      }
      return k < 1;
    },
    dispose() { disposeMesh(tank); },
  });
}

function fxChevrons(o) {
  // golden chevrons rise from every one of the player's face-down cards
  for (const t of o.next.order) {
    o.next.board[t][o.ev.player].forEach((e, i) => {
      if (e.faceUp) return;
      const strip = o.after.strips.get(refKey({ t, p: o.ev.player, i }));
      if (!strip) return;
      const c = center(strip.r);
      for (let j = 0; j < 3; j++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 11, 4),
          new THREE.MeshBasicMaterial({ color: 0xd9b45b, transparent: true, depthWrite: false }));
        cone.visible = false;
        stage.scene.add(cone);
        const after = j * 0.14;
        spawn({
          update(tt) {
            if (tt < after) return true;
            const k = clamp01((tt - after) / 0.6);
            cone.visible = true;
            put(cone, c.x + (j - 1) * 16, c.y - k * 34, 36);
            cone.material.opacity = 0.9 * (1 - k);
            return k < 1;
          },
          dispose() { disposeMesh(cone); },
        });
      }
    });
  }
}

function fxChainDrop(o) {
  const idx = o.next.order.indexOf(o.ev.ref.t);
  const adjacent = [o.next.order[idx - 1], o.next.order[idx + 1]].filter(Boolean);
  adjacent.forEach((t, li) => {
    const lane = o.after.lanes.get(t);
    if (!lane) return;
    const c = { x: lane.r.left + lane.r.width / 2, y: lane.r.top + lane.r.height / 2 };
    const chain = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x3a3f3d, transparent: true });
    for (let i = 0; i < 7; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.9, 6, 10), dark);
      link.position.x = (i - 3) * 12;
      link.rotation.y = (i % 2) * Math.PI / 2;
      chain.add(link);
    }
    chain.visible = false;
    stage.scene.add(chain);
    const after = li * 0.12;
    let clanked = false;
    spawn({
      update(t) {
        if (t < after) return true;
        const tt = t - after;
        if (tt < 0.3) {
          chain.visible = true;
          put(chain, c.x, lerp(c.y - 90, c.y, easeIn(tt / 0.3)), 40);
          dark.opacity = 1;
        } else {
          if (!clanked) { clanked = true; puff(c.x, c.y, { color: 0x8a8265, count: 5, size: 18, rise: 6, life: 0.4 }); }
          put(chain, c.x, c.y, 40);
          dark.opacity = 1 - easeIn(clamp01((tt - 0.85) / 0.3));
        }
        return tt < 1.15;
      },
      dispose() { disposeMesh(chain); },
    });
  });
}

function fxSalvo(o) {
  const L = o.lane, c = center(o.rect);
  const ship = makeBoat();
  ship.scale.setScalar(1.2);
  const dir = c.x > L.left + L.width / 2 ? 1 : -1; // enter from the far edge
  const x0 = dir > 0 ? L.left - 90 : L.right + 90;
  const zone = zoneAcross(o);
  spawn({
    update(t) {
      let x;
      if (t < 0.7) x = lerp(x0, c.x, easeIO(t / 0.7));
      else if (t < 1.5) x = c.x + (t > 0.75 && t < 0.85 ? -dir * 5 : 0); // recoil
      else x = lerp(c.x, x0, easeIn((t - 1.5) / 0.7));
      put(ship, x, c.y + 8 + Math.sin(t * 8) * 2, 21);
      ship.scale.x = 1.2 * dir;
      const fade = t > 1.7 ? 1 - clamp01((t - 1.7) / 0.5) : 1;
      ship.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = fade; } });
      return t < 2.2;
    },
    dispose() { disposeMesh(ship); },
  });
  [0.75, 1.05].forEach(when => delay(when, () => {
    const muzzle = makeSprite(flashTexture(), 0xffe9b0, true);
    put(muzzle, c.x + dir * 20, c.y - 6, 43);
    spawn({ update(t) { const k = clamp01(t / 0.18); muzzle.scale.set(lerp(6, 50, easeOut(k)), lerp(6, 50, easeOut(k)), 1); muzzle.material.opacity = 1 - k; return k < 1; },
      dispose() { stage.scene.remove(muzzle); muzzle.material.dispose(); } });
    const target = { x: r(zone.left + 30, zone.right - 30), y: zone.top + r(10, zone.height - 10) };
    shellArc({ x: c.x + dir * 20, y: c.y - 6 }, target, {
      dur: 0.5,
      impact: () => puff(target.x, target.y, { color: 0xdfeef5, count: 6, size: 20, rise: 26, life: 0.55 }),
    });
  }));
}

function fxFlak(o) {
  const zone = zoneAcross(o);
  for (let i = 0; i < 6; i++) {
    delay(i * 0.13, () => {
      const x = r(zone.left + 25, zone.right - 25), y = zone.top + r(5, zone.height - 5);
      const f = makeSprite(flashTexture(), 0xffd9a0, true);
      put(f, x, y, 42);
      spawn({ update(t) { const k = clamp01(t / 0.16); f.scale.set(lerp(4, 34, easeOut(k)), lerp(4, 34, easeOut(k)), 1); f.material.opacity = 1 - k; return k < 1; },
        dispose() { stage.scene.remove(f); f.material.dispose(); } });
      puff(x, y, { color: 0x4a4a44, count: 3, size: 16, speed: 18, rise: 6, life: 0.6 });
    });
  }
}

function fxZeppelinDrift(o) {
  const L = o.lane, y = o.rect.top - 55;
  const zep = makeZeppelin();
  const dur = 2.1;
  spawn({
    update(t) {
      const k = clamp01(t / dur);
      put(zep, lerp(L.left - 110, L.right + 110, k), y + Math.sin(t * 2.4) * 4, 42);
      const fade = Math.min(1, Math.min(k, 1 - k) * 7);
      zep.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = fade; } });
      return k < 1;
    },
    dispose() { disposeMesh(zep); },
  });
}

function fxTrenchDig(o) {
  const R = o.rect;
  for (let i = 0; i < 3; i++) {
    delay(i * 0.16, () => debris(lerp(R.left + 20, R.right - 20, i / 2), R.top + R.height / 2,
      { colors: [0x4a3f2c, 0x5c4f36, 0x35301f], count: 6, size: 5, speed: 190, life: 0.8 }));
  }
}

function fxSandbags(o) {
  const R = o.rect;
  const edge = o.ev.player === o.me ? R.top - 7 : R.top + R.height + 7; // enemy-facing edge
  for (let i = 0; i < 6; i++) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(15, 8, 9),
      new THREE.MeshLambertMaterial({ color: [0xcabb90, 0xbcac80, 0xd2c49c][i % 3], transparent: true }));
    bag.visible = false;
    stage.scene.add(bag);
    const x = lerp(R.left + 16, R.right - 16, i / 5);
    const after = i * 0.07;
    spawn({
      update(t) {
        if (t < after) return true;
        const tt = t - after;
        bag.visible = true;
        if (tt < 0.22) put(bag, x, lerp(edge - 60, edge, easeIn(tt / 0.22)), 28);
        else {
          put(bag, x, edge, 28);
          bag.material.opacity = 1 - easeIn(clamp01((tt - 0.75) / 0.3));
        }
        return tt < 1.05;
      },
      dispose() { disposeMesh(bag); },
    });
  }
}

function fxGusts(o) {
  const L = o.lane, c = center(o.rect);
  for (let i = 0; i < 4; i++) {
    streak(L.left - 40, c.y + r(-30, 30), {
      dx: L.width + 120, dy: r(-14, 14), len: 130, thick: 7,
      color: 0xdfeef5, dur: 0.55, after: i * 0.1 });
  }
}

function fxStrafe(o) {
  const zone = zoneAcross(o);
  for (let i = 0; i < 7; i++) {
    streak(zone.left + 20 + i * (zone.right - zone.left - 40) / 6, zone.top - 30, {
      dx: 24, dy: zone.height + 40, len: 46, thick: 5,
      color: 0xffd98a, dur: 0.22, after: i * 0.05 });
  }
}

function fxSweepLane(o) {
  sweepLight({ left: o.lane.left, right: o.lane.right, top: o.lane.top, height: o.lane.height });
}

function fxSweepEnemy(o) {
  const zone = o.ev.player === o.me && o.after.board
    ? { left: o.after.board.r.left, right: o.after.board.r.right, top: o.after.board.r.top, height: o.after.board.r.height * 0.3 }
    : zoneAcross(o);
  sweepLight(zone);
}

const FLOURISH = {
  'Support': fxSupport,
  'Aerodrome': fxBeacon,
  'Containment': fxLockdown,
  'Heavy Bombers': fxBombingRun,
  'Cover Fire': fxCoverFire,
  'Disrupt': fxLightning,
  'Heavy Tanks': fxTankRoll,
  'Juggernaut': fxTankRoll,
  'Escalation': fxChevrons,
  'Blockade': fxChainDrop,
  'Super Battleship': fxSalvo,
  'Dreadnought': fxSalvo,
  'Flagship': fxSalvo,
  'Spotter': fxSweepLane,
  'Scout Report': fxSweepEnemy,
  'Codebreakers': fxSweepEnemy,
  'No-Fly Zone': fxFlak,
  'Zeppelin Fleet': fxZeppelinDrift,
  'Trench Line': fxTrenchDig,
  'Bunker Network': fxSandbags,
  'Jet Stream': fxGusts,
  'Strafing Run': fxStrafe,
};

// ---------- snapshot & dispatch ----------

// Captures screen rects before/after a render so effects know where things
// were and where they land. Values are { r: DOMRect, el }.
export function snapshot() {
  const strips = new Map();
  for (const el of document.querySelectorAll('#board .strip[data-ref]')) {
    strips.set(el.dataset.ref, { r: el.getBoundingClientRect(), el });
  }
  const hand = new Map();
  for (const el of document.querySelectorAll('#handbar .card[data-card]')) {
    hand.set(el.dataset.card, { r: el.getBoundingClientRect(), el });
  }
  const lanes = new Map();
  for (const el of document.querySelectorAll('#board .lane[data-lane]')) {
    lanes.set(el.dataset.lane, { r: el.getBoundingClientRect(), el });
  }
  const oppEl = document.querySelector('#handbar .opp-hand');
  const boardEl = document.getElementById('board');
  const deckEl = document.querySelector('#topbar .deck-ct');
  return {
    strips, hand, lanes,
    opp: oppEl ? { r: oppEl.getBoundingClientRect(), el: oppEl } : null,
    board: boardEl ? { r: boardEl.getBoundingClientRect(), el: boardEl } : null,
    deck: deckEl ? { r: deckEl.getBoundingClientRect(), el: deckEl } : null,
  };
}

export function play(prev, next, ctx, before) {
  try {
    if (reduced || !prev || !before || !ensureStage()) return;
    const events = diffViews(prev, next);
    if (!events.length) return;
    const after = snapshot();

    // A card's flourish plays after it lands from a deploy or flip-up reveal.
    const flourishFor = (card, ev, ref, rect, wait) => {
      const fl = card && FLOURISH[card.name];
      if (!fl) return;
      const lane = after.lanes.get(ref.t);
      if (!lane) return;
      delay(wait, () => fl({ rect, lane: lane.r, ev, next, after, me: ctx.me }));
    };
    // Strafing Run's flip lands in the same update as its deploy.
    const strafeLanes = new Set(events
      .filter(e => e.type === 'play' && e.id && byId[e.id].effect === 'strafe')
      .map(e => e.ref.t));

    for (const ev of events) {
      if (ev.type === 'play') {
        const dst = after.strips.get(refKey(ev.ref));
        if (!dst) continue;
        const card = ev.id ? byId[ev.id] : null;
        const c = center(dst.r);
        const src = ev.player === ctx.me
          ? (ev.id && before.hand.get(ev.id)
              ? center(before.hand.get(ev.id).r)
              : { x: c.x, y: innerHeight + 80 })
          : { x: c.x + r(-40, 40), y: -70 }; // opponent cards arrive from their side
        deployToss(src, dst.r, card, ev.faceUp, hold(dst.el));
        if (ev.faceUp) flourishFor(card, ev, ev.ref, dst.r, 0.7);

      } else if (ev.type === 'reinforce') {
        const dst = after.strips.get(refKey(ev.ref));
        if (!dst) continue;
        paradrop(dst.r, ev.id ? byId[ev.id] : null, hold(dst.el));

      } else if (ev.type === 'flip') {
        const dst = after.strips.get(refKey(ev.ref));
        if (!dst) continue;
        const card = ev.id ? byId[ev.id] : null;
        if (ev.ref.p !== ev.actor) {
          const boom = () => explodeFlip(dst.r, card);
          if (ev.via === 'Artillery Strike') {
            const cd = center(dst.r);
            shellArc({ x: cd.x + r(-140, 140), y: -60 }, cd, { dur: 0.5, impact: boom });
          } else if (strafeLanes.has(ev.ref.t)) {
            delay(0.35, boom); // the strafing tracers hit first
          } else {
            boom();
          }
        } else if (ev.faceUp) {
          popFromHole(dst.r, card, hold(dst.el));
        } else {
          diveIntoHole(dst.r, card, hold(dst.el));
        }
        if (ev.faceUp) flourishFor(card, ev, ev.ref, dst.r, ev.ref.p === ev.actor ? 1.1 : 0.7);

      } else if (ev.type === 'move') {
        const src = before.strips.get(refKey(ev.from));
        const dst = after.strips.get(refKey(ev.to));
        if (!src || !dst) continue;
        const card = ev.id ? byId[ev.id] : null;
        const reveal = hold(dst.el);
        if (ev.via === 'Drift Mine') {
          mineMove(src.r, dst.r, reveal);
        } else if (ev.via === 'Jet Stream') {
          gustMove(src.r, dst.r, card, ev.faceUp, ev.flipped, reveal);
        } else if (ev.via === 'Glider Drop' || (ev.to.t === 'air' && ev.via !== 'Amphibious Assault')) {
          gliderMove(src.r, dst.r, card, ev.faceUp, ev.flipped, reveal);
        } else if (ev.to.t === 'land' && ev.via !== 'Amphibious Assault') {
          truckMove(src.r, dst.r, card, ev.faceUp, ev.flipped, reveal);
        } else {
          boatMove(src.r, dst.r, card, ev.faceUp, ev.flipped, reveal);
        }
        // A card revealed by Amphibious Assault gets its flourish on arrival.
        if (ev.flipped && ev.faceUp) flourishFor(card, ev, ev.to, dst.r, 1.6);

      } else if (ev.type === 'draw') {
        const from = after.deck ? center(after.deck.r) : { x: innerWidth / 2, y: 20 };
        let to = null, revealEl = null;
        if (ev.player === ctx.me) {
          const id = next.hands[ctx.me][next.hands[ctx.me].length - 1];
          const hc = id && after.hand.get(id);
          if (hc) { to = center(hc.r); revealEl = hc.el; }
        }
        if (!to) to = after.opp ? center(after.opp.r) : { x: innerWidth - 80, y: innerHeight - 60 };
        drawFly(from, to, hold(revealEl));

      } else if (ev.type === 'redeploy') {
        const src = before.strips.get(refKey(ev.from));
        if (!src) continue;
        let dropAt = null, revealEl = null;
        if (ev.player === ctx.me) {
          const backId = next.hands[ctx.me][next.hands[ctx.me].length - 1];
          const handCard = backId && after.hand.get(backId);
          if (handCard) { dropAt = center(handCard.r); revealEl = handCard.el; }
        }
        // opponent redeploys: the plane hauls the card off their edge of the map
        if (!dropAt) dropAt = { x: center(src.r).x, y: -60 };
        planePickup(src.r, dropAt, null, hold(revealEl));

      } else if (ev.type === 'airdrop') {
        if (after.board) flyover(after.board.r);
      }
    }
  } catch (e) {
    console.warn('fx: skipped animations for this update', e);
  }
}
