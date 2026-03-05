import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js';

const CLUBS = [
  {
    id: 'driver',
    name: 'Driver',
    key: '1',
    color: '#0ea5e9',
    maxPower: 46,
    loft: 9,
    accuracy: 0.66,
    spin: 0.18,
    range: [55, 360],
  },
  {
    id: 'iron',
    name: 'Iron',
    key: '2',
    color: '#22c55e',
    maxPower: 36,
    loft: 14,
    accuracy: 0.79,
    spin: 0.31,
    range: [40, 220],
  },
  {
    id: 'wedge',
    name: 'Wedge',
    key: '3',
    color: '#f59e0b',
    maxPower: 24,
    loft: 24,
    accuracy: 0.9,
    spin: 0.56,
    range: [18, 125],
  },
  {
    id: 'putter',
    name: 'Putter',
    key: '4',
    color: '#f43f5e',
    maxPower: 12,
    loft: 2,
    accuracy: 0.98,
    spin: 0.04,
    range: [4, 45],
  },
];

const HOLY_STYLES = [
  {
    name: 'Aurora Meadow',
    start: new THREE.Vector3(-100, 0, 70),
    hole: new THREE.Vector3(85, 0, -70),
    par: 4,
    wind: 4.2,
  },
  {
    name: 'Cliffside Fairway',
    start: new THREE.Vector3(-80, 0, -80),
    hole: new THREE.Vector3(75, 0, 80),
    par: 5,
    wind: 5.5,
  },
  {
    name: 'Sunrise Links',
    start: new THREE.Vector3(-70, 0, 80),
    hole: new THREE.Vector3(90, 0, 40),
    par: 3,
    wind: 3.8,
  },
];

const SURFACE = {
  fairway: { friction: 0.86, restitution: 0.16, rollDrag: 0.11 },
  rough: { friction: 0.79, restitution: 0.07, rollDrag: 0.16 },
  green: { friction: 0.93, restitution: 0.07, rollDrag: 0.20 },
  bunker: { friction: 0.35, restitution: 0.03, rollDrag: 0.04 },
  water: { friction: 0.2, restitution: 0.01, rollDrag: 0.03 },
};

class AudioManager {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.started = false;
    this.lastBird = 0;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.12;
    this.ambientGain.connect(this.ctx.destination);

    const windNode = this.ctx.createOscillator();
    const windGain = this.ctx.createGain();
    windNode.type = 'sawtooth';
    windNode.frequency.value = 27;
    windGain.gain.value = 0.05;
    windNode.connect(windGain);
    windGain.connect(this.ambientGain);
    windNode.start();
    windNode.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 8);

    this.windNode = windNode;
    this.windGain = windGain;
    this.started = true;
  }

  playSwing(clubId) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = clubId === 'driver' ? 150 : clubId === 'iron' ? 120 : clubId === 'wedge' ? 95 : 80;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playImpact(type = 'base') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const burst = this.ctx.createBufferSource();
    const sr = this.ctx.sampleRate;
    const length = sr * 0.2;
    const buffer = this.ctx.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / sr) * 18);
    }
    burst.buffer = buffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = type === 'water' ? 190 : type === 'sand' ? 430 : 330;
    const g = this.ctx.createGain();
    g.gain.value = type === 'water' ? 0.17 : 0.12;
    burst.connect(hp);
    hp.connect(g);
    g.connect(this.ctx.destination);
    burst.start(t);
    burst.stop(t + 0.2);
  }

  updateWind(speed) {
    if (!this.ctx || !this.windNode) return;
    const t = this.ctx.currentTime;
    const target = THREE.MathUtils.clamp(28 + speed * 7, 20, 48);
    this.windNode.frequency.setValueAtTime(this.windNode.frequency.value, t);
    this.windNode.frequency.linearRampToValueAtTime(target, t + 1.4);
    this.windGain.gain.setValueAtTime(this.ambientGain.gain.value, t);
    this.windGain.gain.linearRampToValueAtTime(0.04 + Math.min(speed / 14, 0.09), t + 1.4);
  }

  maybeNatureNoise(time) {
    if (!this.ctx || time - this.lastBird < 4.0) return;
    this.lastBird = time;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 860 + Math.random() * 200;
    const g = this.ctx.createGain();
    g.gain.value = 0.08;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.8);
  }
}

class Terrain {
  constructor(size = 240) {
    this.size = size;
    this.half = size * 0.5;
  }

  // Smoothly blended surface layers to produce fairway/green/water/sand/bunkers.
  sample(x, z) {
    const sX = x * 0.015;
    const sZ = z * 0.013;
    const sX2 = x * 0.0045;
    const sZ2 = z * 0.0045;

    const dunes = Math.sin(sX) * 2.2 + Math.cos(sZ * 1.3) * 2.0;
    const ridges = Math.sin(sX2) * Math.cos(sZ2) * 3.4 + Math.sin((x + z) * 0.0022) * 1.4;
    const micro = Math.cos(x * 0.1) * Math.sin(z * 0.087) * 0.18;
    return (dunes + ridges + micro) * 0.55;
  }

  getSurfaceType(x, z, hole, greens = []) {
    if (x < -this.half || x > this.half || z < -this.half || z > this.half) return 'out';

    const distToWater = this._distanceToRect(z, x, -88, -52, 12, 50, -12, 28);
    if (distToWater < 0) return 'water';

    const inBunker1 = this._insideCircle(x, z, 22, 50, 18);
    const inBunker2 = this._insideCircle(x, z, -48, -30, 12);
    if (inBunker1 || inBunker2) return 'bunker';

    for (const g of greens) {
      if (g.distanceToPoint(new THREE.Vector2(x, z)) < 22) return 'green';
    }

    const dH = Math.max(0, new THREE.Vector2(x, z).distanceTo(new THREE.Vector2(hole.x, hole.z)));
    if (dH < 16 && this.sample(x, z) > -1) return 'green';

    const rough = Math.sin((x + 66) * 0.045) * Math.cos((z - 22) * 0.049);
    return rough < -0.15 ? 'rough' : 'fairway';
  }

  _distanceToRect(px, pz, x1, x2, z1, z2, marginX, marginZ) {
    const clampedX = Math.max(x1 - marginX, Math.min(px, x2 + marginX));
    const clampedZ = Math.max(z1 - marginZ, Math.min(pz, z2 + marginZ));
    const dx = px - clampedX;
    const dz = pz - clampedZ;
    const d = Math.sqrt(dx * dx + dz * dz);
    return d;
  }

  _insideCircle(x, z, cx, cz, r) {
    return (x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r;
  }

  heightAt(x, z) {
    return this.sample(x, z);
  }

  normalAt(x, z) {
    const eps = 0.6;
    const hL = this.heightAt(x - eps, z);
    const hR = this.heightAt(x + eps, z);
    const hD = this.heightAt(x, z - eps);
    const hU = this.heightAt(x, z + eps);
    const dx = (hL - hR) / (2 * eps);
    const dz = (hD - hU) / (2 * eps);
    const n = new THREE.Vector3(dx, 1, dz).normalize();
    return n;
  }
}

class PhysicsSystem {
  constructor(terrain, ball, windRef, effects, onWaterPenalty) {
    this.terrain = terrain;
    this.ball = ball;
    this.windRef = windRef;
    this.effects = effects;
    this.onWaterPenalty = onWaterPenalty;
    this.hole = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.surface = 'fairway';
    this.isMoving = false;
    this.onGreenTimer = 0;
  }

  setHolePos(v) {
    this.hole.copy(v);
  }

  kick(power, direction, club) {
    this.ball.velocity.set(direction.x, direction.y, direction.z).multiplyScalar(power);
    // Club-specific top/down spin profile.
    const side = (Math.random() - 0.5) * (1 - club.accuracy) * 0.72;
    this.spin.set(0, club.spin * 0.95 + side, -club.spin * 0.15);
    this.ball.velocity.y += club.maxPower * 0.008;
    this.isMoving = true;
    this.onGreenTimer = 0;
  }

  resetVel() {
    this.ball.velocity.set(0, 0, 0);
    this.spin.set(0, 0, 0);
    this.isMoving = false;
  }

  update(dt) {
    const pos = this.ball.mesh.position;
    const vel = this.ball.velocity;
    const speed = vel.length();

    if (speed < 0.004 && Math.abs(vel.y) < 0.003 && this.ball.isOnGround) {
      this.resetVel();
      return;
    }

    // Wind affects air and short drift in all phases.
    const windForce = this.windRef.value.clone().multiplyScalar(0.004 * dt);
    vel.add(windForce);

    // Magnus-like effect for spin.
    const magnus = new THREE.Vector3();
    magnus.crossVectors(this.spin, vel).multiplyScalar(0.002 * dt);
    vel.add(magnus);

    vel.y -= 9.8 * dt;
    pos.addScaledVector(vel, dt);

    const groundY = this.terrain.heightAt(pos.x, pos.z) + this.ball.radius;
    const hole2d = new THREE.Vector2(pos.x, pos.z);

    const greenCenter = new THREE.Vector2(this.hole.x, this.hole.z);
    const surface = this.terrain.getSurfaceType(pos.x, pos.z, this.hole, [greenCenter]);
    if (surface === 'out') {
      this.ball.mesh.position.set(this.ball.lastSafe.x, this.ball.lastSafe.y, this.ball.lastSafe.z);
      this.resetVel();
      this.ball.outOfBounds = true;
      return;
    }
    this.surface = surface;

    if (pos.y <= groundY) {
      this.ball.isOnGround = true;
      pos.y = groundY;
      const n = this.terrain.normalAt(pos.x, pos.z);

      // Bounce only when falling with enough vertical speed.
      if (vel.y < 0) {
        vel.y *= -SURFACE[surface].restitution;
      }

      const surfaceInfo = SURFACE[surface] ?? SURFACE.fairway;
      const tangential = new THREE.Vector3(vel.x, 0, vel.z);
      if (tangential.lengthSq() > 0) {
        tangential.multiplyScalar(surfaceInfo.rollDrag * 60 * dt);
        vel.x -= tangential.x;
        vel.z -= tangential.z;
      }

      const downhill = new THREE.Vector3(-n.x, 0, -n.z).normalize();
      vel.x += downhill.x * (surfaceInfo.friction * 0.18 * dt);
      vel.z += downhill.z * (surfaceInfo.friction * 0.18 * dt);

      // Friction and slope-specific rolling drag.
      const airDrag = 1 - 0.55 * dt * surfaceInfo.friction * (this.ball.isRolling ? 1 : 0.7);
      vel.x *= Math.max(0, airDrag);
      vel.z *= Math.max(0, airDrag);

      if (velocityLen(vel) > 14) {
        vel.multiplyScalar(0.97);
      }

      if (surface === 'water' && !this.ball.inWater) {
        this.ball.inWater = true;
        this.effects.sandOrWater('water', pos);
        this.onWaterPenalty();
      }
      if (surface !== 'water') {
        this.ball.inWater = false;
      }
    } else {
      this.ball.isOnGround = false;
    }

    this.ball.lastSafe = this.ball.lastSafe || new THREE.Vector3();
    if (!this.ball.inWater && this.ball.isOnGround) this.ball.lastSafe.copy(pos);

    if (this.ball.velocity.lengthSq() > 0.01 || !this.ball.isOnGround) this.isMoving = true;
    else this.isMoving = false;

    if (this.ball.isOnGround && hole2d.distanceTo(greenCenter) < 15 && vel.length() < 0.35) {
      this.onGreenTimer += dt;
    } else {
      this.onGreenTimer = 0;
    }
  }
}

class SwingController {
  constructor(powerUpFn, powerDownFn) {
    this.power = 0;
    this.charging = false;
    this.powerUpCb = powerUpFn;
    this.powerDownCb = powerDownFn;
    this.maxPower = 100;
    this.chargeRate = 65;
  }

  onKeyDown(code) {
    if (code === 'Space') {
      if (!this.charging) {
        this.charging = true;
      }
    }
  }

  onKeyUp(code) {
    if (code === 'Space' && this.charging) {
      this.charging = false;
      const value = this.power;
      this.power = 0;
      this.powerDownCb(value);
    }
  }

  onPointerDown() {
    if (!this.charging) this.charging = true;
  }

  onPointerUp() {
    if (this.charging) {
      this.charging = false;
      const value = this.power;
      this.power = 0;
      this.powerDownCb(value);
    }
  }

  update(dt, canCharge) {
    if (this.charging && canCharge) {
      this.power += this.chargeRate * dt;
      if (this.power > this.maxPower) this.power = this.maxPower;
    }
  }
}

class InputController {
  constructor() {
    this.aim = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.setup();
  }

  setup() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  process(dt) {
    if (this.keys.has('KeyA')) this.aim += dt * 0.95;
    if (this.keys.has('KeyD')) this.aim -= dt * 0.95;
    if (this.keys.has('KeyW')) this.pitch += dt * 0.45;
    if (this.keys.has('KeyS')) this.pitch -= dt * 0.45;

    this.aim = THREE.MathUtils.euclideanModulo(this.aim + Math.PI * 2, Math.PI * 2);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.2, 0.35);
  }

  isDown(code) {
    return this.keys.has(code);
  }
}

class CameraController {
  constructor(camera, target) {
    this.camera = camera;
    this.mode = 'aiming';
    this.target = target;
    this.followDist = 28;
    this.time = 0;
    this.lerp = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
  }

  setMode(mode) {
    this.mode = mode;
    this.time = 0;
  }

  update(dt, state) {
    this.time += dt;
    const ball = state.ballMesh.position;
    const aim = new THREE.Vector3(Math.cos(state.aimAngle), 0, Math.sin(state.aimAngle));

    if (this.mode === 'aiming') {
      const base = aim.clone().multiplyScalar(-this.followDist);
      const desired = ball.clone().add(base).add(new THREE.Vector3(0, 11, 0));
      this.lerp.copy(desired);
      const look = state.holePos.clone().add(new THREE.Vector3(0, 2, 0));
      this.lookAt.lerp(look, 0.1);
    } else if (this.mode === 'swing') {
      const t = Math.min(this.time, 1.2);
      const zoom = THREE.MathUtils.lerp(9, 14, t / 1.2);
      const side = new THREE.Vector3(Math.cos(state.aimAngle + Math.PI / 2), 0, Math.sin(state.aimAngle + Math.PI / 2));
      const desired = ball.clone().add(aim.clone().multiplyScalar(-zoom)).add(side.multiplyScalar(6)).add(new THREE.Vector3(0, 6, 0));
      this.lerp.lerp(desired, 0.5);
      this.lookAt.copy(ball.clone().add(new THREE.Vector3(0, 1, 0)));
    } else if (this.mode === 'follow') {
      const moveDir = state.ballVelocity.lengthSq() > 0.001 ? state.ballVelocity.clone().normalize() : aim.clone().negate();
      const side = new THREE.Vector3(moveDir.z, 0, -moveDir.x);
      const desired = ball.clone().add(moveDir.multiplyScalar(-18)).add(side.multiplyScalar(8)).add(new THREE.Vector3(0, 8, 0));
      this.lerp.lerp(desired, 0.06);
      this.lookAt.lerp(ball.clone().add(new THREE.Vector3(0, 3, 0)), 0.06);
      if (!state.ballMoving) {
        const calm = state.holePos.clone().sub(ball).normalize();
        const near = state.holePos.clone().add(calm.multiplyScalar(-12)).add(new THREE.Vector3(0, 10, 0));
        this.lerp.lerp(near, 0.02);
      }
    } else if (this.mode === 'replay') {
      const t = this.time;
      const orbit = this.time * 1.1;
      const radius = 14;
      const target = ball.clone().add(new THREE.Vector3(Math.cos(orbit) * radius, 4.2, Math.sin(orbit) * radius));
      this.lerp.lerp(target, 0.08);
      this.lookAt.lerp(state.holePos.clone().add(new THREE.Vector3(0, 2, 0)), 0.08);
    }

    this.camera.position.lerp(this.lerp, 0.16);
    this.camera.lookAt(this.lookAt);
  }
}

class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  emit(type, position) {
    const count = type === 'impact' ? 14 : type === 'water' ? 20 : 18;
    const geom = new THREE.SphereGeometry(type === 'water' ? 0.06 : 0.04, 6, 6);
    const color = type === 'water' ? 0x38bdf8 : type === 'sand' ? 0xfacc15 : 0xf9fafb;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: 0x101827, roughness: 0.18, emissiveIntensity: 0.3 });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(position);
      const v = randomUnitSphere();
      mesh.userData = {
        age: 0,
        life: 0.6 + Math.random() * 0.6,
        velocity: v.multiplyScalar(0.5 + Math.random() * 2.8),
      };
      mesh.userData.velocity.y += 1.3;
      this.group.add(mesh);
    }
  }

  sandOrWater(type, position) {
    this.emit(type === 'water' ? 'water' : 'sand', position);
  }

  update(dt) {
    const dead = [];
    for (const c of this.group.children) {
      c.userData.age += dt;
      c.position.addScaledVector(c.userData.velocity, dt);
      c.scale.multiplyScalar(1 - dt * 1.3);
      c.material.opacity = 1 - c.userData.age / c.userData.life;
      if (c.userData.age >= c.userData.life) dead.push(c);
    }
    for (const c of dead) {
      this.group.remove(c);
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }
  }
}

class UIGame {
  constructor() {
    this.el = {
      modeLabel: document.getElementById('modeLabel'),
      strokeCount: document.getElementById('strokeCount'),
      parValue: document.getElementById('parValue'),
      holeIndex: document.getElementById('holeIndex'),
      powerFill: document.getElementById('powerFill'),
      powerValue: document.getElementById('powerValue'),
      windText: document.getElementById('windText'),
      distance: document.getElementById('distanceValue'),
      message: document.getElementById('message'),
      clubButtons: document.getElementById('clubButtons'),
      windNeedle: document.getElementById('windNeedle'),
      modeValue: document.getElementById('cameraModeValue'),
      windIndicator: document.getElementById('windNeedle'),
      clubAccuracy: document.getElementById('clubAccuracy'),
      clubSpin: document.getElementById('clubSpin'),
    };
  }

  mountClubs(clubs, onSelect, currentClub) {
    this.el.clubButtons.innerHTML = '';
    for (const c of clubs) {
      const button = document.createElement('button');
      button.innerHTML = `<b>${c.name}</b>  (${c.key})  <span style="float:right">${c.maxPower}m</span>`;
      if (c.id === currentClub.id) button.classList.add('active');
      button.addEventListener('click', () => onSelect(c));
      this.el.clubButtons.appendChild(button);
    }
  }

  updateMode(mode, holeIndex, par, strokes, cameraMode) {
    this.el.modeLabel.textContent = mode;
    this.el.holeIndex.textContent = String(holeIndex);
    this.el.parValue.textContent = String(par);
    this.el.strokeCount.textContent = String(strokes);
    this.el.modeValue.textContent = cameraMode;
  }

  updatePower(p) {
    this.el.powerFill.style.width = `${p.toFixed(0)}%`;
    this.el.powerValue.textContent = p.toFixed(0);
  }

  updateWind(value, angle) {
    this.el.windText.textContent = value.toFixed(2);
    this.el.windNeedle.style.transform = `translate(-50%, -100%) rotate(${angle}rad)`;
  }

  updateDistance(d) {
    this.el.distance.textContent = `${d.toFixed(1)} m`;
  }

  updateClub(c) {
    this.el.clubAccuracy.textContent = `${(c.accuracy * 100).toFixed(0)}%`;
    this.el.clubSpin.textContent = c.spin.toFixed(2);
  }

  setMessage(text, color = 'white') {
    this.el.message.style.color = color;
    this.el.message.innerHTML = text;
  }
}

class GolfGame {
  constructor() {
    this.debugEnabled = new URLSearchParams(window.location.search).has('debug');
    this.debugEl = document.getElementById('debugPanel');
    this.debugLines = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 900);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.clock = new THREE.Clock();
    this.terrainSystem = new Terrain();
    this.audio = new AudioManager();
    this.raycaster = new THREE.Raycaster();

    this.playerBall = { velocity: new THREE.Vector3(), radius: 0.22, isOnGround: true, inWater: false, outOfBounds: false, mesh: null, lastSafe: new THREE.Vector3() };
    this.cameraController = new CameraController(this.camera);

    this.input = new InputController();
    this.swing = new SwingController();
    this.ui = new UIGame();
    this.particles = new ParticleManager(this.scene);
    this.currentMode = 'practice';
    this.currentClub = CLUBS[0];
    this.holeIndex = 0;
    this.strokeCount = 0;
    this.maxStrokes = Infinity;
    this.wind = new THREE.Vector3(1.5, 0, 0);
    this.timeScale = 1;
    this.replayTimer = 0;

    this.windDirection = 0;
    this.targetHole = HOLY_STYLES[0].hole.clone();

    this.setupScene();
    this.effects = this.particles;
    this.physics = new PhysicsSystem(this.terrainSystem, this.playerBall, { value: this.wind }, this.effects, () => this.onWaterPenalty());

    this.ui.mountClubs(CLUBS, (c) => this.selectClub(c), this.currentClub);
    this.applyEventHooks();
    this.setupModeButtons();
    this.updateModeSettings();

    this.playerBall.mesh.position.copy(HOLY_STYLES[0].start);
    this.playerBall.mesh.position.y = this.terrainSystem.heightAt(this.playerBall.mesh.position.x, this.playerBall.mesh.position.z) + this.playerBall.radius + 0.2;
    this.playerBall.lastSafe.copy(this.playerBall.mesh.position);
    this.physics.setHolePos(this.targetHole);

    this.ui.updateClub(this.currentClub);
    this.physics.resetVel();

    this.debug('game init complete');
    this.animate();
  }

  debug(text) {
    if (!this.debugEnabled || !this.debugEl) return;
    const line = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.debugLines.push(line);
    if (this.debugLines.length > 10) this.debugLines.shift();
    this.debugEl.textContent = this.debugLines.join('\n');
  }

  setupScene() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setClearColor(0x050b14, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);     const c = this.renderer.domElement;     c.style.position = 'fixed';     c.style.inset = '0';     c.style.zIndex = '1';

        c.style.position = 'fixed'; c.style.inset = '0'; c.style.zIndex = '1';
    this.scene.fog = new THREE.Fog(0x0b1320, 100, 460);

    // Ground (animated vertex terrain).
    const terrainGeo = new THREE.PlaneGeometry(240, 240, 210, 210);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    const color = new Float32Array((terrainGeo.getAttribute('position').count) * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.terrainSystem.heightAt(x, z);
      pos.setY(i, h);
      const t = this.terrainSystem.getSurfaceType(x, z, new THREE.Vector3(0, 0, 0), [new THREE.Vector2(85, -70), new THREE.Vector2(75, 80), new THREE.Vector2(90, 40)]);
      if (t === 'water') {
        color[i * 3 + 0] = 0.16;
        color[i * 3 + 1] = 0.33;
        color[i * 3 + 2] = 0.43;
      } else if (t === 'bunker') {
        color[i * 3 + 0] = 0.77;
        color[i * 3 + 1] = 0.70;
        color[i * 3 + 2] = 0.46;
      } else if (t === 'rough') {
        color[i * 3 + 0] = 0.22;
        color[i * 3 + 1] = 0.44;
        color[i * 3 + 2] = 0.19;
      } else {
        color[i * 3 + 0] = 0.17;
        color[i * 3 + 1] = 0.62;
        color[i * 3 + 2] = 0.27;
      }
      if (i % 1300 === 0) {
        // no-op (helps readability for large maps when scanning colors)
      }
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    terrainGeo.attributes.position.needsUpdate = true;
    terrainGeo.computeVertexNormals();

    const grassTexture = this.createSubtleTexture();
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.0,
      map: grassTexture,
      normalScale: new THREE.Vector2(0.4, 0.6),
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Course details: bunkers, pond, cup marker, trees.
    this.addBunkers();
    this.addWater();
    this.addTrees();
    this.addCupAndTee();

    const ambient = new THREE.AmbientLight(0xaed6fb, 0.38);
    this.scene.add(ambient);

    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.28);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.set(2048, 2048);
    this.mainLight.shadow.camera.near = 2;
    this.mainLight.shadow.camera.far = 450;
    this.mainLight.position.set(70, 110, 80);
    this.mainLight.shadow.camera.left = -120;
    this.mainLight.shadow.camera.right = 120;
    this.mainLight.shadow.camera.top = 120;
    this.mainLight.shadow.camera.bottom = -120;
    this.scene.add(this.mainLight);

    const back = new THREE.DirectionalLight(0x8ab4f8, 0.2);
    back.position.set(-90, 70, -50);
    this.scene.add(back);

    const ballGeo = new THREE.SphereGeometry(this.playerBall.radius, 24, 24);
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.24,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.9,
    });
    this.playerBall.mesh = new THREE.Mesh(ballGeo, ballMat);
    this.playerBall.mesh.castShadow = true;
    this.playerBall.mesh.receiveShadow = true;
    this.scene.add(this.playerBall.mesh);

    window.addEventListener('resize', () => this.onResize());
  }

  createSubtleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, '#2f7f3f');
    g.addColorStop(1, '#3f9e52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 3 + 0.5;
      ctx.fillStyle = `rgba(${20 + Math.random() * 40}, ${100 + Math.random() * 40}, ${40 + Math.random() * 18}, ${0.06 + Math.random() * 0.04})`;
      ctx.fillRect(x, y, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(14, 14);
    texture.needsUpdate = true;
    return texture;
  }

  addBunkers() {
    const geo = new THREE.CircleGeometry(18, 50);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4b27a, roughness: 0.96, side: THREE.DoubleSide });
    const b1 = new THREE.Mesh(geo, mat);
    b1.rotation.x = -Math.PI / 2;
    b1.position.set(22, this.terrainSystem.heightAt(22, 50) + 0.02, 50);
    b1.receiveShadow = true;
    this.scene.add(b1);

    const b2 = new THREE.Mesh(geo.clone(), mat);
    b2.scale.set(0.65, 0.65, 0.65);
    b2.rotation.x = -Math.PI / 2;
    b2.position.set(-48, this.terrainSystem.heightAt(-48, -30) + 0.02, -30);
    b2.receiveShadow = true;
    this.scene.add(b2);
  }

  addWater() {
    const geo = new THREE.PlaneGeometry(36, 70);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x1f5f9b,
      roughness: 0.18,
      metalness: 0.4,
      transparent: true,
      opacity: 0.75,
      emissive: 0x0a2e5a,
      emissiveIntensity: 0.25,
    });
    const pond = new THREE.Mesh(geo, mat);
    pond.rotation.x = -Math.PI / 2;
    pond.receiveShadow = true;
    pond.position.set(-70, this.terrainSystem.heightAt(-70, -70) + 0.01, -70);
    pond.rotation.z = 0.18;
    pond.scale.set(1.4, 1.2, 1);
    this.scene.add(pond);
  }

  addTrees() {
    const trunk = new THREE.CylinderGeometry(0.13, 0.22, 2.6, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x69411c, roughness: 1.0, flatShading: true });
    const crown = new THREE.ConeGeometry(1.4, 3.2, 10);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6d3b, roughness: 0.74, flatShading: false });

    const trunkMesh = new THREE.InstancedMesh(trunk, trunkMat, 85);
    const crownMesh = new THREE.InstancedMesh(crown, crownMat, 85);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < 85; i++) {
      const x = (Math.random() - 0.5) * 210;
      const z = (Math.random() - 0.5) * 210;
      const sType = this.terrainSystem.getSurfaceType(x, z, HOLY_STYLES[0].hole.clone(), [new THREE.Vector2(85, -70), new THREE.Vector2(75, 80), new THREE.Vector2(90, 40)]);
      if (sType === 'water' || sType === 'bunker' || this.playerBall.mesh && new THREE.Vector2(x, z).distanceTo(new THREE.Vector2(HOLY_STYLES[0].start.x, HOLY_STYLES[0].start.z)) < 18) {
        i--; continue;
      }
      const y = this.terrainSystem.heightAt(x, z);
      const h = 2.2 + Math.random() * 0.9;
      dummy.position.set(x, y + h / 2, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.6 + Math.random() * 0.8);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.y = y + h + 1.4;
      dummy.scale.set(1, 1, 1);
      dummy.scale.multiplyScalar(1.05);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(trunkMesh);
    this.scene.add(crownMesh);
  }

  addCupAndTee() {
    const tee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
    );
    tee.position.set(HOLY_STYLES[0].start.x, this.terrainSystem.heightAt(HOLY_STYLES[0].start.x, HOLY_STYLES[0].start.z) + 0.06, HOLY_STYLES[0].start.z);
    this.scene.add(tee);

    const cup = new THREE.Group();
    const rim = new THREE.TorusGeometry(1.1, 0.17, 14, 24);
    const ring = new THREE.Mesh(rim, new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    ring.rotation.x = Math.PI / 2;

    const flagpole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 8, 12), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    flagpole.position.set(0.0, 4.0, 0);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    flag.position.set(1.0, 6.95, 0);
    flagpole.rotation.z = 0.2;
    cup.add(ring);
    cup.add(flagpole);
    cup.add(flag);
    cup.position.copy(this.targetHole);
    cup.position.y = this.terrainSystem.heightAt(this.targetHole.x, this.targetHole.z) + 0.05;
    this.scene.add(cup);
    this.cup = cup;
  }

  setupModeButtons() {
    const root = document.querySelectorAll('#modePanel button');
    root.forEach((el) => {
      el.addEventListener('click', () => {
        this.selectMode(el.dataset.mode);
      });
    });
  }

  applyEventHooks() {
    this.swing.powerDownCb = (power) => this.releaseShot(power);

    window.addEventListener('keydown', (e) => {
      if (!this.audio.started) this.audio.ensure();

      if (e.code === 'Space') {
        e.preventDefault();
        this.swing.onKeyDown(e.code);
      }
      if (e.code === 'KeyC') this.cycleCamera();
      if (e.code === 'KeyR') this.resetBall(HOLY_STYLES[this.currentTemplate()].start);
      if (e.code >= 'Digit1' && e.code <= 'Digit4') {
        const n = Number(e.code.replace('Digit', '')) - 1;
        const c = CLUBS[n];
        if (c) this.selectClub(c);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.swing.onKeyUp(e.code);
      }
    });

    const canStartSwingFromTarget = (target) => {
      if (!target) return true;
      const interactive = target.closest?.('button, a, input, select, textarea, #ui');
      return !interactive;
    };

    const onPressStart = (target) => {
      this.audio.ensure();
      if (!canStartSwingFromTarget(target)) {
        this.debug('pressStart ignored on UI element');
        return;
      }
      this.debug('pressStart accepted');
      this.swing.onPointerDown();
    };

    const onPressEnd = () => {
      this.debug(`pressEnd power=${this.swing.power.toFixed(1)}`);
      this.swing.onPointerUp();
    };

    window.addEventListener('mousedown', (e) => onPressStart(e.target));
    window.addEventListener('mouseup', onPressEnd);

    // iOS/Safari: pointer/touch support so taps can start and release swing.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      onPressStart(e.target);
    });
    window.addEventListener('pointerup', onPressEnd);
    window.addEventListener('pointercancel', onPressEnd);

    window.addEventListener('touchstart', (e) => {
      onPressStart(e.target);
    }, { passive: true });
    window.addEventListener('touchend', onPressEnd, { passive: true });
    window.addEventListener('touchcancel', onPressEnd, { passive: true });

    const panelEl = document.querySelector('#ui');
    panelEl.addEventListener('mousedown', (e) => e.preventDefault(), { passive: true });

    const mobileSwingBtn = document.getElementById('mobileSwingBtn');
    if (mobileSwingBtn) {
      const pressStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.ensure();
        this.debug('mobileSwingBtn start');
        this.swing.onPointerDown();
      };
      const pressEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.debug(`mobileSwingBtn end power=${this.swing.power.toFixed(1)}`);
        this.swing.onPointerUp();
      };
      mobileSwingBtn.addEventListener('pointerdown', pressStart);
      mobileSwingBtn.addEventListener('pointerup', pressEnd);
      mobileSwingBtn.addEventListener('pointercancel', pressEnd);
      mobileSwingBtn.addEventListener('touchstart', pressStart, { passive: false });
      mobileSwingBtn.addEventListener('touchend', pressEnd, { passive: false });
      mobileSwingBtn.addEventListener('touchcancel', pressEnd, { passive: false });
      mobileSwingBtn.addEventListener('mousedown', pressStart);
      mobileSwingBtn.addEventListener('mouseup', pressEnd);
      mobileSwingBtn.addEventListener('mouseleave', pressEnd);
    }
  }

  cycleCamera() {
    const order = ['aiming', 'swing', 'follow', 'replay'];
    const idx = order.indexOf(this.cameraController.mode);
    this.cameraController.setMode(order[(idx + 1) % order.length]);
    this.ui.updateMode(this.currentMode, this.holeIndex + 1, this.currentPar(), this.strokeCount, this.cameraController.mode);
  }

  currentTemplate() {
    if (this.currentMode === 'tournament') return this.holeIndex;
    if (this.currentMode === 'challenge') return this.holeIndex;
    return 0;
  }

  currentPar() {
    if (this.currentMode === 'practice') return HOLY_STYLES[0].par;
    return HOLY_STYLES[this.currentTemplate()].par;
  }

  selectClub(c) {
    this.currentClub = c;
    [...document.querySelectorAll('#clubButtons button')].forEach((btn, i) => {
      btn.classList.toggle('active', CLUBS[i]?.id === c.id);
    });
    this.ui.updateClub(this.currentClub);
  }

  selectMode(mode) {
    this.currentMode = mode;
    [...document.querySelectorAll('#modePanel button')].forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    this.holeIndex = 0;
    this.strokeCount = 0;
    if (mode === 'tournament') {
      this.maxStrokes = 9;
      this.ui.setMessage('Tournament Mode: Play 3 scenic holes with scoring.', '#60a5fa');
    } else if (mode === 'challenge') {
      this.maxStrokes = 6;
      this.ui.setMessage('Challenge Mode: Faster wind and strict shots.', '#fca5a5');
    } else {
      this.maxStrokes = Infinity;
      this.ui.setMessage('Practice Mode: Try and perfect your shots at your pace.', '#a7f3d0');
    }

    const hole = HOLY_STYLES[this.currentTemplate()];
    this.targetHole = hole.hole.clone();
    this.applyWindProfile(mode);
    this.resetBall(hole.start);
    this.physics.setHolePos(this.targetHole);
    this.updateModeSettings();
    this.buildCourseForHole(this.currentTemplate());
  }

  applyWindProfile(mode) {
    const hole = HOLY_STYLES[this.currentTemplate()];
    const base = hole.wind * 1;
    const mult = mode === 'challenge' ? 1.65 : mode === 'tournament' ? 1.15 : 1.0;
    const dir = Math.sin(this.holeIndex * 1.3 + Date.now() * 0.0002);
    this.windDirection = dir;
    const magnitude = base * mult * (0.75 + Math.random() * 0.6);
    this.wind.set(Math.cos(this.windDirection), 0, Math.sin(this.windDirection)).multiplyScalar(magnitude);
    this.audio.updateWind(magnitude);
  }

  buildCourseForHole(idx) {
    const hole = HOLY_STYLES[idx];
    if (!hole) return;

    // Move cup mesh and simple restart markers.
    if (this.cup) {
      this.cup.position.x = hole.hole.x;
      this.cup.position.z = hole.hole.z;
      this.cup.position.y = this.terrainSystem.heightAt(hole.hole.x, hole.hole.z) + 0.05;
      this.targetHole = hole.hole.clone();
      this.physics.setHolePos(this.targetHole);
    }

    const marker = this.scene.getObjectByName('teeMarker') || new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.13, 14), new THREE.MeshStandardMaterial({ color: 0x6b7280 }));
    marker.name = 'teeMarker';
    marker.position.set(hole.start.x, this.terrainSystem.heightAt(hole.start.x, hole.start.z) + 0.06, hole.start.z);
    marker.visible = true;
    if (!this.scene.getObjectByName('teeMarker')) this.scene.add(marker);

    this.physics.setHolePos(this.targetHole);
  }

  onWaterPenalty() {
    this.strokeCount += 1;
    this.ui.setMessage('Water hazard hit — penalty stroke!', '#38bdf8');
    this.effects.sandOrWater('water', this.playerBall.mesh.position.clone());
    this.audio.playImpact('water');
    this.ballResetTimer = 0.9;
    this.resetInProgress = true;
  }

  releaseShot(power) {
    if (this.physics.isMoving || this.resetInProgress || this.isAimingLocked()) {
      this.debug(`releaseShot blocked moving=${this.physics.isMoving} reset=${!!this.resetInProgress} lock=${this.isAimingLocked()}`);
      return;
    }

    const aimFactor = THREE.MathUtils.clamp(power / 100, 0.06, 1);
    if (aimFactor < 0.05) {
      this.debug(`releaseShot too weak power=${power.toFixed(1)}`);
      this.ui.setMessage('Build more power before releasing.');
      return;
    }

    this.debug(`releaseShot accepted power=${power.toFixed(1)}`);

    const aimAngle = this.swingAim;

    // Club/accuracy randomization creates believable player imperfection.
    const spread = (1 - this.currentClub.accuracy) * (Math.random() - 0.5);
    const finalAngle = aimAngle + spread * 0.6;
    const elevationBase = THREE.MathUtils.degToRad(this.currentClub.loft) + this.input.pitch;
    const elevation = THREE.MathUtils.clamp(
      elevationBase + (Math.random() - 0.5) * 0.06 * (1 - this.currentClub.accuracy),
      -0.08,
      0.65
    );
    const direction = new THREE.Vector3(
      Math.cos(finalAngle) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(finalAngle) * Math.cos(elevation)
    );

    const shotPower = aimFactor * this.currentClub.maxPower;
    this.physics.kick(shotPower, direction, this.currentClub);
    this.strokeCount += 1;
    this.cameraController.setMode('swing');
    this.audio.playSwing(this.currentClub.id);
    this.audio.playImpact('base');
    this.effects.emit('impact', this.playerBall.mesh.position.clone());

    this.ui.setMessage(`Stroke ${this.strokeCount} with ${this.currentClub.name}.`, '#86efac');
    this.ui.updateMode(this.currentMode, this.holeIndex + 1, this.currentPar(), this.strokeCount, this.cameraController.mode);

    if (this.currentMode === 'challenge' && this.strokeCount >= this.maxStrokes) {
      this.ui.setMessage(`Challenge exceeded ${this.maxStrokes} strokes. Restarting this hole...`, '#fca5a5');
      this.ballResetTimer = 1.2;
      this.resetInProgress = true;
    }

  }

  isAimingLocked() {
    return this.currentClub === null || this.ballResetTimer > 0;
  }

  resetBall(newStart) {
    const start = newStart || HOLY_STYLES[this.currentTemplate()].start;
    const safeY = this.terrainSystem.heightAt(start.x, start.z) + this.playerBall.radius + 0.1;
    this.playerBall.mesh.position.set(start.x, safeY, start.z);
    this.playerBall.lastSafe.set(start.x, safeY, start.z);
    this.playerBall.velocity.set(0, 0, 0);
    this.playerBall.isOnGround = true;
    this.playerBall.outOfBounds = false;
    this.physics.resetVel();
    this.swing.power = 0;
    this.cameraController.setMode('aiming');
  }

  updateModeSettings() {
    this.updateScorePanel();
    const hole = HOLY_STYLES[this.currentTemplate()] || HOLY_STYLES[0];
    this.currentClub = CLUBS[0];
    this.targetHole = hole.hole.clone();
    this.applyWindProfile(this.currentMode);
    this.updateUIHole(hole);
  }

  updateScorePanel() {
    this.ui.updateMode(this.currentMode === 'practice' ? 'Practice' : this.currentMode[0].toUpperCase() + this.currentMode.slice(1), this.holeIndex + 1, this.currentPar(), this.strokeCount, this.cameraController.mode);
  }

  updateUIHole(hole) {
    this.ui.setMessage(`Hole: ${hole.name} · Start: (${hole.start.x.toFixed(0)}, ${hole.start.z.toFixed(0)})`);
  }

  update(dt) {
    this.input.process(dt);
    this.swing.update(dt, !this.physics.isMoving);

    this.ui.updatePower(this.swing.power);

    if (this.ballResetTimer > 0) {
      this.ballResetTimer -= dt;
      if (this.ballResetTimer <= 0) {
        this.resetInProgress = false;
        const start = HOLY_STYLES[this.currentTemplate()].start;
        this.resetBall(start);
        this.ui.setMessage(`Back to fairway. ${this.currentMode === 'challenge' ? `Shot limit ${this.maxStrokes}` : ''}`);
      }
    }

    // Keep aim state synced from input.
    this.swingAim = this.input.aim;

    if (this.physics.isMoving || this.playerBall.velocity.lengthSq() > 0.00001) {
      this.physics.update(dt * this.timeScale);
      const pos = this.playerBall.mesh.position;
      const hole2d = new THREE.Vector2(this.targetHole.x, this.targetHole.z);
      const ball2d = new THREE.Vector2(pos.x, pos.z);
      const dist = hole2d.distanceTo(ball2d);
      this.playerBall.mesh.rotation.x += dt * 5;
      this.playerBall.mesh.rotation.z += dt * 5;

      // Smoothly rotate winded grass effect by material offset.
      const terrainMesh = this.scene.children.find((c) => c instanceof THREE.Mesh && c.geometry.type === 'PlaneGeometry');
      const terrainMat = terrainMesh?.material;
      if (terrainMat?.map) {
        terrainMat.map.offset.x += dt * 0.002;
        terrainMat.map.offset.y += dt * 0.001;
      }

      if (dist < 1.55 && this.playerBall.isOnGround && this.playerBall.velocity.length() < 1.05) {
        this.onBallInHole();
      }

      if (dist < 25 && this.playerBall.velocity.length() < 1.4 && this.physics.onGreenTimer > 0.2) {
        this.timeScale = 0.23;
        this.cameraController.setMode('replay');
        this.replayTimer = 2.8;
      }

      this.updateCamera(dt * this.timeScale);
    } else {
      this.timeScale = 1;
      if (this.cameraController.mode === 'swing' || this.cameraController.mode === 'replay') {
        this.cameraController.setMode('aiming');
      }
      this.updateCamera(dt);
    }

    if (this.replayTimer > 0) {
      this.replayTimer -= dt;
      if (this.replayTimer <= 0) {
        this.timeScale = 1;
        this.cameraController.setMode('follow');
        this.replayTimer = 0;
      }
    }

    this.ui.updateWind(this.wind.length(), this.windDirection + Math.PI / 2);
    this.audio.maybeNatureNoise(performance.now() / 1000);

    const ballToHole = this.playerBall.mesh.position.distanceTo(this.targetHole);
    this.ui.updateDistance(ballToHole);
    this.particles.update(dt);

    this.ballFollowWind(dt);
  }

  ballFollowWind(dt) {
    if (!this.playerBall.mesh) return;
    this.playerBall.mesh.userData.tilt = (this.playerBall.mesh.userData.tilt || 0) + dt * 0.12;
    this.playerBall.mesh.position.x += Math.sin(this.playerBall.mesh.userData.tilt) * dt * 0.001;
  }

  onBallInHole() {
    if (this.resetInProgress) return;
    const par = this.currentPar();
    const delta = this.strokeCount - par;
    this.ui.setMessage(`Ball in the hole! Stroke ${this.strokeCount} (${delta >= 0 ? '+' : ''}${delta})`, '#a3e635');
    this.audio.playImpact('base');

    if (this.currentMode === 'practice') {
      this.resetInProgress = true;
      this.ballResetTimer = 0.9;
      return;
    }

    if (this.holeIndex < HOLY_STYLES.length - 1) {
      this.holeIndex += 1;
      this.strokeCount = 0;
      const next = HOLY_STYLES[this.holeIndex];
      this.targetHole = next.hole.clone();
      this.applyWindProfile(this.currentMode);
      this.buildCourseForHole(this.holeIndex);
      this.resetBall(next.start);
      this.physics.setHolePos(this.targetHole);
      this.updateModeSettings();
      this.ui.updateMode(this.currentMode === 'tournament' ? 'Tournament' : 'Challenge', this.holeIndex + 1, next.par, this.strokeCount, this.cameraController.mode);
      this.ui.setMessage(`Next hole (${next.name}).`);
    } else {
      const msg = this.currentMode === 'tournament'
        ? 'Tournament complete. Great play.'
        : 'Challenge complete. New challenge starts.';
      this.ui.setMessage(msg, '#f0abfc');
      this.currentMode = 'practice';
      this.holeIndex = 0;
      this.maxStrokes = Infinity;
      this.selectMode('practice');
    }
  }

  updateCamera(dt) {
    const state = {
      ballMesh: this.playerBall.mesh,
      aimAngle: this.swingAim,
      holePos: this.targetHole,
      ballVelocity: this.playerBall.velocity,
      ballMoving: this.physics.isMoving,
    };
    this.cameraController.update(dt, state);
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  animate() {
    const dt = this.clock.getDelta();
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}

function velocityLen(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function randomUnitSphere() {
  const u = Math.random() * Math.PI * 2;
  const v = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    Math.sin(v) * Math.cos(u),
    Math.cos(v),
    Math.sin(v) * Math.sin(u)
  );
}

window.__createGolfGame = () => {
  const game = new GolfGame();
  window.__golfGame = game;
  return game;
};
window.__createGolfGame();
