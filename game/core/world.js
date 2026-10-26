import * as THREE from "three";
import { BLOCKS } from "./blocks.js";

const WORLD_RADIUS = 19;
const coordKey = (x, y, z) => `${x},${y},${z}`;

function seededNoise(x, z, seed = 417) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function terrainHeight(x, z) {
  const hills = Math.sin(x * 0.25) * 1.3 + Math.cos(z * 0.21) * 1.1 + Math.sin((x + z) * 0.16) * 1.2;
  const ridge = Math.max(0, 3 - Math.hypot(x + 7, z + 1) * 0.18);
  return Math.max(1, Math.floor(2 + hills + ridge));
}

export class VoxelWorld {
  constructor(scene, save) {
    this.scene = scene;
    this.save = save;
    this.blocks = new Map();
    this.meshes = [];
    this.meshRecords = new Map();
    this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.materials = Object.fromEntries(Object.entries(BLOCKS).map(([type, def]) => [
      type, new THREE.MeshLambertMaterial({
        color: def.color,
        transparent: Boolean(def.transparent),
        opacity: type === "glass" ? 0.56 : type === "leaves" ? 0.91 : 1,
        depthWrite: type !== "glass",
        side: THREE.FrontSide
      })
    ]));
    this.landmarks = [];
    this.generate();
    this.applyEdits();
    this.rebuildMeshes();
    this.addScenery();
  }

  generate() {
    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
      for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
        if (Math.hypot(x, z) > WORLD_RADIUS + 1) continue;
        let top = terrainHeight(x, z);
        const lake = x >= -12 && x <= -6 && z >= 6 && z <= 12;
        if (lake) top = Math.min(top, 1);
        for (let y = -1; y <= top; y++) {
          const type = y === top ? (lake ? "sand" : "grass") : y >= top - 2 ? "dirt" : "stone";
          this.blocks.set(coordKey(x, y, z), { x, y, z, type, protected: false });
        }
        if (!lake && top >= 2 && seededNoise(x, z) > 0.975 && Math.hypot(x, z) > 10 && !(x > 6 && z < -5)) this.addTree(x, top + 1, z);
        if (!lake && seededNoise(x + 33, z - 7) > 0.988) {
          this.blocks.set(coordKey(x, top + 1, z), { x, y: top + 1, z, type: "flower", protected: false });
        }
      }
    }
    this.buildVillage();
    this.buildAcademy();
    this.buildPortal(-2, 5, -12, "ساحة القرية", "village");
    this.buildPortal(12, 5, 12, "حديقة المغامرة", "garden");
    this.buildTreasure(15, 5, 3);
    this.addNPC(-4, -4, "المرشد", "guide", 0x6aa78c);
    this.addNPC(5, 2, "المهندس", "builder", 0xc47e55);
    this.addNPC(9, -9, "الباحث", "researcher", 0x708bc0);
    this.addNPC(14, -7, "المبرمج", "coder", 0x9b77b5);
  }

  addTree(x, y, z) {
    const height = 3 + Math.floor(seededNoise(x * 2, z * 2) * 2);
    for (let i = 0; i < height; i++) this.blocks.set(coordKey(x, y + i, z), { x, y: y + i, z, type: "wood", protected: false });
    const crownY = y + height - 1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.max(0, dy) > 4 || (dx === 0 && dz === 0 && dy < 1)) continue;
          const key = coordKey(x + dx, crownY + dy, z + dz);
          if (!this.blocks.has(key)) this.blocks.set(key, { x: x + dx, y: crownY + dy, z: z + dz, type: "leaves", protected: false });
        }
      }
    }
  }

  buildStructure(x, z, width, depth, wallHeight, type = "brick", protect = false) {
    const floor = Math.max(terrainHeight(x, z), terrainHeight(x + width, z + depth)) + 1;
    for (let dx = 0; dx <= width; dx++) {
      for (let dz = 0; dz <= depth; dz++) {
        this.putRaw(x + dx, floor, z + dz, type, protect);
        for (let y = 1; y <= wallHeight; y++) {
          const edge = dx === 0 || dx === width || dz === 0 || dz === depth;
          if (!edge) continue;
          const isDoor = dx === Math.floor(width / 2) && dz === 0 && y < 3;
          const isWindow = y === 2 && (dx === 0 || dx === width) && dz === Math.floor(depth / 2);
          if (isDoor) continue;
          this.putRaw(x + dx, floor + y, z + dz, isWindow ? "glass" : type, protect);
        }
      }
    }
    for (let dx = -1; dx <= width + 1; dx++) {
      for (let dz = -1; dz <= depth + 1; dz++) {
        if (dx === -1 || dx === width + 1 || dz === -1 || dz === depth + 1) this.putRaw(x + dx, floor + wallHeight + 1, z + dz, "wood", protect);
      }
    }
  }

  buildVillage() {
    this.buildStructure(-7, -4, 5, 4, 3, "brick", false);
    this.buildStructure(-1, -6, 4, 4, 3, "wood", false);
    this.buildStructure(-7, 2, 4, 4, 3, "wood", false);
    this.buildPath(-7, 0, 13, 0);
    this.buildPath(-3, -8, -3, 10);
  }

  buildPath(x1, z1, x2, z2) {
    const length = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
    for (let step = 0; step <= length; step++) {
      const x = Math.round(x1 + (x2 - x1) * step / Math.max(1, length));
      const z = Math.round(z1 + (z2 - z1) * step / Math.max(1, length));
      const y = terrainHeight(x, z);
      for (let dx = -1; dx <= 1; dx++) this.putRaw(x + dx, y, z, "sand", false);
    }
  }

  buildAcademy() {
    this.buildStructure(8, -14, 8, 5, 4, "stone", true);
    const floor = Math.max(terrainHeight(8, -14), terrainHeight(16, -9)) + 1;
    const stationDefs = [
      ["التقنية الرقمية", "tech", 10, -11, 0x81c9cf],
      ["الرياضيات", "math", 14, -11, 0xeac568],
      ["الفيزياء", "physics", 10, -8, 0x78a7e0],
      ["الكيمياء", "chemistry", 14, -8, 0xe88970]
    ];
    stationDefs.forEach(([name, kind, x, z, color]) => {
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.1, 1.45), new THREE.MeshLambertMaterial({ color }));
      pedestal.position.set(x + 0.5, floor + 0.55, z + 0.5);
      pedestal.userData.interactable = { kind: "challenge", subject: name };
      pedestal.castShadow = true; pedestal.receiveShadow = true; this.scene.add(pedestal);
      this.landmarks.push({ name, kind: "challenge", x: x + 0.5, y: floor + 1, z: z + 0.5, object: pedestal });
      const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.19, roughness: 0.35 }));
      emblem.position.set(x + 0.5, floor + 1.9, z + 0.5);
      pedestal.add(emblem);
    });
    this.addAcademySign();
  }

  addAcademySign() {
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), this.materials.wood);
    post.position.y = 1;
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 0.2), this.materials.brick);
    board.position.y = 2;
    sign.add(post, board);
    sign.position.set(12, Math.max(terrainHeight(12, -15), 2), -15);
    sign.userData.interactable = { kind: "academy", name: "أكاديمية التحديات" };
    this.scene.add(sign);
    this.landmarks.push({ name: "أكاديمية التحديات", kind: "academy", x: 12, y: sign.position.y + 2, z: -15, object: sign });
  }

  buildPortal(x, y, z, name, destination) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.16, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x8de6c1, emissive: 0x38b995, emissiveIntensity: 0.48, roughness: 0.3 })
    );
    ring.position.y = 1.45;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 1), this.materials.stone);
    base.position.y = 0.15;
    group.add(ring, base);
    group.position.set(x, Math.max(y, terrainHeight(x, z) + 1), z);
    group.userData.interactable = { kind: "portal", name, destination };
    this.scene.add(group);
    this.landmarks.push({ name, kind: "portal", x, y: group.position.y + 1, z, destination, object: group });
  }

  buildTreasure(x, y, z) {
    const chest = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.65), new THREE.MeshLambertMaterial({ color: 0xaa7133 }));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.18, 0.7), new THREE.MeshLambertMaterial({ color: 0xe1b653 }));
    lid.position.y = 0.41;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), new THREE.MeshLambertMaterial({ color: 0xf6e197 }));
    latch.position.set(0, 0.28, 0.36);
    chest.add(box, lid, latch);
    chest.position.set(x, Math.max(y, terrainHeight(x, z) + 1), z);
    chest.userData.interactable = { kind: "chest", name: "صندوق كنز" };
    this.scene.add(chest);
    this.landmarks.push({ name: "صندوق كنز", kind: "chest", x, y: chest.position.y + 0.4, z, object: chest });
  }

  addNPC(x, z, name, role, color) {
    const group = new THREE.Group();
    const clothes = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.42), new THREE.MeshLambertMaterial({ color }));
    clothes.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshLambertMaterial({ color: 0xe5bd94 }));
    head.position.y = 1.43;
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.44), new THREE.MeshLambertMaterial({ color: 0x384b45 }));
    scarf.position.y = 1.18;
    group.add(clothes, head, scarf);
    group.position.set(x, terrainHeight(x, z) + 1, z);
    group.userData.baseY = group.position.y;
    group.userData.interactable = { kind: "npc", name, role };
    group.traverse(child => { if (child.isMesh) child.castShadow = true; });
    this.scene.add(group);
    this.landmarks.push({ name, kind: "npc", role, x, y: group.position.y + 1, z, object: group });
  }

  putRaw(x, y, z, type, protectedBlock) {
    this.blocks.set(coordKey(x, y, z), { x, y, z, type, protected: protectedBlock });
  }

  applyEdits() {
    Object.entries(this.save.edits).forEach(([key, type]) => {
      const [x, y, z] = key.split(",").map(Number);
      if (this.isProtected(x, y, z)) return;
      if (type === null) this.blocks.delete(key);
      else if (BLOCKS[type]) this.blocks.set(key, { x, y, z, type, protected: false, placed: true });
    });
  }

  key(x, y, z) { return coordKey(x, y, z); }
  getBlock(x, y, z) { return this.blocks.get(coordKey(x, y, z)) || null; }
  isSolid(x, y, z) { const block = this.getBlock(x, y, z); return Boolean(block && BLOCKS[block.type]?.solid); }

  isProtected(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block?.protected) return true;
    return x >= 7 && x <= 17 && z >= -15 && z <= -7 && y >= 1;
  }

  canPlace(x, y, z) {
    if (x < -WORLD_RADIUS || x > WORLD_RADIUS || z < -WORLD_RADIUS || z > WORLD_RADIUS || y < 0 || y > 18) return false;
    return !this.getBlock(x, y, z) && !this.isProtected(x, y, z);
  }

  addBlock(x, y, z, type) {
    if (!this.canPlace(x, y, z) || !BLOCKS[type]) return false;
    const key = coordKey(x, y, z);
    this.blocks.set(key, { x, y, z, type, placed: true, protected: false });
    this.save.edits[key] = type;
    this.rebuildMeshes();
    return true;
  }

  removeBlock(x, y, z) {
    const key = coordKey(x, y, z);
    const block = this.getBlock(x, y, z);
    if (!block || this.isProtected(x, y, z) || y <= 0) return null;
    this.blocks.delete(key);
    this.save.edits[key] = null;
    this.rebuildMeshes();
    return block;
  }

  rebuildMeshes() {
    this.meshes.forEach(mesh => this.scene.remove(mesh));
    this.meshes = [];
    this.meshRecords.clear();
    const grouped = new Map(Object.keys(BLOCKS).map(type => [type, []]));
    this.blocks.forEach(block => grouped.get(block.type)?.push(block));
    const matrix = new THREE.Object3D();
    grouped.forEach((blocks, type) => {
      if (!blocks.length) return;
      const mesh = new THREE.InstancedMesh(this.blockGeometry, this.materials[type], blocks.length);
      mesh.name = `blocks-${type}`;
      mesh.castShadow = type !== "flower";
      mesh.receiveShadow = true;
      blocks.forEach((block, index) => {
        matrix.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
        matrix.updateMatrix();
        mesh.setMatrixAt(index, matrix.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.blockType = type;
      this.meshRecords.set(mesh, blocks);
      this.meshes.push(mesh);
      this.scene.add(mesh);
    });
  }

  resolveHit(hit) {
    const records = this.meshRecords.get(hit.object);
    return records && Number.isInteger(hit.instanceId) ? records[hit.instanceId] || null : null;
  }

  addScenery() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshStandardMaterial({ color: 0x65c7cf, transparent: true, opacity: 0.72, roughness: 0.3, metalness: 0.08 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-9, 2.05, 9);
    this.scene.add(water);
    const ambient = new THREE.HemisphereLight(0xe8f9ff, 0x65734d, 1.75);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
    sun.position.set(-18, 32, 17);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.sun = sun;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(100, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0x8cc7d0, side: THREE.BackSide })
    );
    this.scene.add(sky);
  }

  update(delta, elapsed) {
    this.scene.traverse(object => {
      if (object.userData.interactable?.kind === "portal") object.rotation.y = Math.sin(elapsed * 0.7) * 0.08;
      if (object.userData.interactable?.kind === "npc") object.position.y = object.userData.baseY + Math.sin(elapsed * 2 + object.position.x) * 0.035;
    });
    if (this.sun) this.sun.position.x = -18 + Math.sin(elapsed * 0.025) * 4;
  }
}
