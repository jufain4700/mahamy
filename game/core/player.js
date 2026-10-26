import * as THREE from "three";
import { moveAndCollide } from "./physics.js";

export class Player {
  constructor(camera, save) {
    this.camera = camera;
    this.save = save;
    this.x = Number(save.player.x) || 0;
    this.y = Number(save.player.y) || 9;
    this.z = Number(save.player.z) || 0;
    this.velocityY = 0;
    this.yaw = Math.PI / 4;
    this.pitch = 0;
    this.grounded = false;
    this.moving = false;
    this.moveVector = new THREE.Vector3();
  }

  jump() {
    if (!this.grounded) return false;
    this.velocityY = 8;
    this.grounded = false;
    return true;
  }

  update(world, controls, delta) {
    const input = controls.movement();
    const speed = controls.isDown("ShiftLeft") || controls.isDown("ShiftRight") || controls.mobileRun ? 7.2 : 4.6;
    this.moveVector.set(input.x, 0, input.z);
    if (this.moveVector.lengthSq() > 1) this.moveVector.normalize();
    this.moving = this.moveVector.lengthSq() > 0.01 && this.grounded;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (this.moveVector.x * cos + this.moveVector.z * sin) * speed * delta;
    const dz = (-this.moveVector.x * sin + this.moveVector.z * cos) * speed * delta;
    this.velocityY = Math.max(-24, this.velocityY - 20 * delta);
    const result = moveAndCollide(world, this, dx, this.velocityY * delta, dz);
    this.grounded = result.grounded;
    if (this.y < -8) {
      this.x = 0.5; this.y = 10; this.z = 0.5; this.velocityY = 0;
    }
    this.camera.position.set(this.x, this.y + 1.58, this.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.save.player = { x: this.x, y: this.y, z: this.z };
  }
}
