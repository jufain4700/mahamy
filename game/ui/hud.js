import { BLOCKS } from "../core/blocks.js";

export class Hud {
  constructor(save, inventory, rewards) {
    this.save = save;
    this.inventory = inventory;
    this.rewards = rewards;
    this.root = document.getElementById("hud");
    this.modalLayer = document.getElementById("modalLayer");
    this.modalCard = document.getElementById("modalCard");
    this.toastStack = document.getElementById("toastStack");
    this.hotbar = document.getElementById("hotbar");
    this.onModalOpen = () => {};
    this.onModalClose = () => {};
    this.modalCloseHandler = null;
  }

  show() { this.root.classList.remove("hidden"); }
  hide() { this.root.classList.add("hidden"); }

  refreshHud() {
    const progress = this.rewards.progress();
    document.getElementById("levelLabel").textContent = progress.current.name;
    document.getElementById("xpLabel").textContent = progress.next
      ? `${this.save.xp} / ${progress.next.xp} XP` : `${this.save.xp} XP • الحد الأعلى`;
    document.getElementById("xpFill").style.width = `${progress.percent}%`;
    document.getElementById("coinsLabel").textContent = new Intl.NumberFormat("ar-SA").format(this.save.coins);
    document.getElementById("starsLabel").textContent = new Intl.NumberFormat("ar-SA").format(this.save.stars);
    this.renderHotbar();
  }

  renderHotbar(onSelect = () => {}) {
    this.inventory.render(this.hotbar, index => {
      this.inventory.select(index);
      this.refreshHud();
      onSelect(index);
    });
  }

  setHint(text) { document.getElementById("interactionHint").textContent = text; }

  setTarget(block) {
    const label = document.getElementById("targetLabel");
    if (!block) { label.classList.add("hidden"); return; }
    label.textContent = `${BLOCKS[block.type]?.name || "مكعب"}${block.protected ? " • منطقة محمية" : ""}`;
    label.classList.remove("hidden");
  }

  setCoordinates(x, z) {
    document.getElementById("coordinates").textContent = `${Math.floor(x)}, ${Math.floor(z)}`;
  }

  modal(title, subtitle, content, actions = [], onClose = null) {
    const head = document.createElement("header");
    head.className = "modal-head";
    const group = document.createElement("div");
    const heading = document.createElement("h2");
    heading.id = "modalTitle";
    heading.textContent = title;
    group.append(heading);
    if (subtitle) {
      const description = document.createElement("p");
      description.textContent = subtitle;
      group.append(description);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close-modal";
    close.setAttribute("aria-label", "إغلاق");
    close.textContent = "×";
    close.addEventListener("click", () => this.closeModal());
    head.append(group, close);
    const footer = document.createElement("div");
    footer.className = "modal-actions";
    actions.forEach(action => footer.append(action));
    this.modalCard.replaceChildren(head, content, ...(actions.length ? [footer] : []));
    this.modalLayer.classList.remove("hidden");
    this.modalCloseHandler = onClose;
    this.onModalOpen();
    close.focus();
  }

  closeModal() {
    const onClose = this.modalCloseHandler;
    this.modalCloseHandler = null;
    this.modalLayer.classList.add("hidden");
    this.modalCard.replaceChildren();
    onClose?.();
    this.onModalClose();
  }

  button(label, action, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = primary ? "primary-button" : "secondary-button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  rewardToast(message, xp = 0) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.toastStack.append(toast);
    window.setTimeout(() => toast.remove(), 3200);
    const pop = document.createElement("div");
    pop.className = "reward-pop";
    pop.textContent = `✦ +${new Intl.NumberFormat("ar-SA").format(xp)} XP`;
    document.getElementById("gameRoot").append(pop);
    window.setTimeout(() => pop.remove(), 1400);
  }

  toast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.toastStack.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }
}
