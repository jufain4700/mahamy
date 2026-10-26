export class Controls {
  constructor(canvas, player, onAction) {
    this.canvas = canvas;
    this.player = player;
    this.onAction = onAction;
    this.keys = new Set();
    this.lookPointer = null;
    this.joystickPointer = null;
    this.joystick = { x: 0, z: 0 };
    this.mobileJump = false;
    this.mobileRun = false;
    this.lookTouch = null;
    this.pointerLocked = false;
    this.pointerLook = false;
    this.bind();
  }

  bind() {
    window.addEventListener("keydown", event => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (!this.active && event.code !== "Escape") return;
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === "Space") this.onAction("jump");
      else if (event.code === "KeyE") this.onAction("interact");
      else if (event.code === "KeyI") this.onAction("inventory");
      else if (event.code === "Escape") this.onAction("pause");
      else if (/^Digit[1-9]$/.test(event.code)) this.onAction("slot", Number(event.code.slice(-1)) - 1);
    });
    window.addEventListener("keyup", event => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.keys.clear());
    this.canvas.addEventListener("click", () => {
      if (!this.isMobile() && document.pointerLockElement !== this.canvas && this.active) {
        try {
          const result = this.canvas.requestPointerLock?.();
          result?.catch(() => {});
        } catch (error) {
          this.pointerLook = true;
        }
      }
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener("mousemove", event => {
      if (this.active && (this.pointerLocked || this.pointerLook)) this.rotate(event.movementX, event.movementY);
    });
    this.canvas.addEventListener("pointerdown", event => {
      if (!this.active || event.pointerType === "touch") return;
      const hadLookControl = this.pointerLocked || this.pointerLook;
      this.pointerLook = true;
      if (hadLookControl && event.button === 0) this.onAction("break");
      if (hadLookControl && event.button === 2) this.onAction("place");
    });
    document.addEventListener("pointerup", () => { this.pointerLook = false; });
    document.addEventListener("pointercancel", () => { this.pointerLook = false; });
    this.canvas.addEventListener("contextmenu", event => event.preventDefault());
    this.bindTouchLook();
    this.bindJoystick();
  }

  bindTouchLook() {
    this.canvas.addEventListener("pointerdown", event => {
      if (!this.active || event.pointerType !== "touch") return;
      const leftSide = event.clientX < window.innerWidth * 0.43;
      if (leftSide) return;
      this.lookTouch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", event => {
      if (!this.lookTouch || this.lookTouch.id !== event.pointerId) return;
      const dx = event.clientX - this.lookTouch.x, dy = event.clientY - this.lookTouch.y;
      this.rotate(dx * 1.2, dy * 1.2);
      this.lookTouch.x = event.clientX; this.lookTouch.y = event.clientY;
    });
    const end = event => { if (this.lookTouch?.id === event.pointerId) this.lookTouch = null; };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
  }

  bindJoystick() {
    const base = document.getElementById("joystick");
    const knob = document.getElementById("joystickKnob");
    if (!base || !knob) return;
    const move = event => {
      if (event.pointerId !== this.joystickPointer) return;
      const rect = base.getBoundingClientRect();
      const radius = rect.width * 0.34;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.min(radius, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      const x = Math.cos(angle) * length, y = Math.sin(angle) * length;
      knob.style.transform = `translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;
      this.joystick.x = x / radius;
      this.joystick.z = y / radius;
    };
    const end = event => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null; this.joystick.x = 0; this.joystick.z = 0;
      knob.style.transform = "translate(-50%,-50%)";
    };
    base.addEventListener("pointerdown", event => {
      event.preventDefault(); this.joystickPointer = event.pointerId;
      base.setPointerCapture(event.pointerId); move(event);
    });
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
  }

  isMobile() { return matchMedia("(pointer: coarse)").matches || window.innerWidth < 700; }
  setActive(active) {
    this.active = active;
    if (!active) { this.pointerLook = false; this.keys.clear(); }
  }
  isDown(code) { return this.keys.has(code); }

  rotate(dx, dy) {
    this.player.yaw -= dx * 0.0022;
    this.player.pitch = Math.max(-1.42, Math.min(1.42, this.player.pitch - dy * 0.0022));
  }

  movement() {
    let x = this.joystick.x, z = this.joystick.z;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) z -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) z += 1;
    return { x, z };
  }
}
