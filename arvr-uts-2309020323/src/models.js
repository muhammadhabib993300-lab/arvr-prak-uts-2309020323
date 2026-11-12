// Model 3D beranimasi yang dibuat langsung dengan Three.js (tanpa file .glb)
// Keuntungan: sangat ringan, tidak perlu download aset, tidak bisa "gagal muat".

import * as THREE from 'three';

const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });

// Ubah lintang/bujur menjadi titik di permukaan bola
function pointOnSphere(r, latDeg, lonDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.cos(lon)
  );
}

/* ---------------- Matahari ---------------- */
function buildSun() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc933 })
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.28, side: THREE.BackSide })
  );
  const rays = new THREE.Group();
  const rayGeo = new THREE.ConeGeometry(0.03, 0.12, 8);
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xffa31a });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.position.set(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0);
    ray.rotation.z = a - Math.PI / 2;
    rays.add(ray);
  }
  group.add(core, glow, rays);
  return {
    group,
    update(t, dt) {
      core.rotation.y += dt * 0.5;
      glow.scale.setScalar(1 + Math.sin(t * 3) * 0.07);
      rays.rotation.z += dt * 0.6;
    },
  };
}

/* ---------------- Bumi ---------------- */
function buildEarth() {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.z = THREE.MathUtils.degToRad(-23.4);

  const spin = new THREE.Group();
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), std(0x2e86de));
  spin.add(ocean);

  // Benua sederhana: [lintang, bujur, ukuran]
  const lands = [[20, 10, 0.07], [-15, 30, 0.06], [45, 100, 0.08], [-25, 135, 0.055], [60, -60, 0.06], [-10, -60, 0.065]];
  const landGeo = new THREE.IcosahedronGeometry(1, 0);
  const landMat = std(0x3fae5a, { flatShading: true });
  lands.forEach(([lat, lon, size]) => {
    const m = new THREE.Mesh(landGeo, landMat);
    m.position.copy(pointOnSphere(0.2, lat, lon));
    m.lookAt(0, 0, 0);
    m.scale.set(size, size, size * 0.35);
    spin.add(m);
  });

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(0.212, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 1 })
  );
  tilt.add(spin, clouds);

  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 16), std(0xbdbdbd));
  moon.position.x = 0.4;
  moonPivot.rotation.x = 0.25;
  moonPivot.add(moon);

  group.add(tilt, moonPivot);
  return {
    group,
    update(t, dt) {
      spin.rotation.y += dt * 0.8;
      clouds.rotation.y += dt * 1.0;
      moonPivot.rotation.y += dt * 1.1;
    },
  };
}

/* ---------------- Mars ---------------- */
function buildMars() {
  const group = new THREE.Group();
  const planet = new THREE.Group();
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), std(0xc1440e)));

  const darkMat = std(0x7a2a0a, { flatShading: true });
  [[15, 20, 0.05], [-20, 80, 0.045], [30, 150, 0.04], [-35, -40, 0.05]].forEach(([lat, lon, s]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), darkMat);
    m.position.copy(pointOnSphere(0.17, lat, lon));
    m.lookAt(0, 0, 0);
    m.scale.set(s, s, s * 0.3);
    planet.add(m);
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), std(0xffffff));
  cap.position.set(0, 0.16, 0);
  cap.scale.y = 0.4;
  planet.add(cap);

  const phobosPivot = new THREE.Group();
  const phobos = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03, 0), std(0x9e8f84, { flatShading: true }));
  phobos.position.x = 0.3;
  phobosPivot.add(phobos);

  const deimosPivot = new THREE.Group();
  deimosPivot.rotation.x = 0.5;
  const deimos = new THREE.Mesh(new THREE.DodecahedronGeometry(0.022, 0), std(0xb8a99c, { flatShading: true }));
  deimos.position.x = 0.4;
  deimosPivot.add(deimos);

  group.add(planet, phobosPivot, deimosPivot);
  return {
    group,
    update(t, dt) {
      planet.rotation.y += dt * 0.7;
      phobosPivot.rotation.y += dt * 2.2;
      deimosPivot.rotation.y += dt * 1.2;
    },
  };
}

/* ---------------- Saturnus ---------------- */
function buildSaturn() {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.z = THREE.MathUtils.degToRad(27);

  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), std(0xe3c98c));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.012, 8, 40), std(0xc8a45f));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.05;
  band.scale.set(0.95, 0.95, 1);

  const ringMat = (color, opacity) =>
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, roughness: 0.9 });
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.36, 64), ringMat(0xd9c28f, 0.9));
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 64), ringMat(0xa8946a, 0.7));
  ring1.rotation.x = ring2.rotation.x = -Math.PI / 2;

  tilt.add(planet, band, ring1, ring2);
  group.add(tilt);
  return {
    group,
    update(t, dt) {
      planet.rotation.y += dt * 0.6;
      ring1.rotation.z += dt * 0.15;
      ring2.rotation.z -= dt * 0.1;
    },
  };
}

/* ---------------- Daftar & pembungkus ---------------- */
const BUILDERS = { sun: buildSun, earth: buildEarth, mars: buildMars, saturn: buildSaturn };
export const MODEL_NAMES = Object.keys(BUILDERS);

const BASE_Z = 0.3; // tinggi melayang di atas kartu

export function createCardModel(name) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Model "${name}" tidak ada. Pilihan: ${MODEL_NAMES.join(', ')}`);

  const inner = build();
  const root = new THREE.Group();
  root.add(inner.group);
  root.position.z = BASE_Z;

  return {
    group: root,
    update(t, dt) {
      root.position.z = BASE_Z + Math.sin(t * 1.6) * 0.02; // efek melayang
      inner.update(t, dt);
    },
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    },
  };
}
