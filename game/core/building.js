import * as THREE from "three";

export class Building {
  constructor(camera, world, player, inventory, scene) {
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 6;
    this.center = new THREE.Vector2(0, 0);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color: 0xe8ffad, transparent: true, opacity: 0.85 })
    );
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.target = null;
  }

  update() {
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(this.world.meshes, false);
    this.target = null;
    for (const hit of hits) {
      const block = this.world.resolveHit(hit);
      if (!block) continue;
      this.target = { block, hit };
      this.outline.visible = true;
      this.outline.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
      return block;
    }
    this.outline.visible = false;
    return null;
  }

  breakTarget() {
    if (!this.target) return null;
    const { block } = this.target;
    if (this.world.isProtected(block.x, block.y, block.z)) return null;
    const removed = this.world.removeBlock(block.x, block.y, block.z);
    if (!removed) return null;
    if (removed.type !== "flower") this.inventory.add(removed.type, 1);
    this.target = null;
    return removed;
  }

  placeBlock() {
    if (!this.target) return false;
    const { block, hit } = this.target;
    if (!hit.face) return false;
    const normal = hit.face.normal;
    const x = block.x + Math.round(normal.x);
    const y = block.y + Math.round(normal.y);
    const z = block.z + Math.round(normal.z);
    const insidePlayer = Math.abs(x + 0.5 - this.player.x) < 0.78 &&
      Math.abs(z + 0.5 - this.player.z) < 0.78 &&
      y < this.player.y + 1.7 && y + 1 > this.player.y;
    if (insidePlayer || !this.world.canPlace(x, y, z)) return false;
    const type = this.inventory.selectedBlock();
    if (!this.inventory.consume(type)) return false;
    if (!this.world.addBlock(x, y, z, type)) {
      this.inventory.add(type);
      return false;
    }
    this.target = null;
    return true;
  }
}
