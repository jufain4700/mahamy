import { BLOCKS, HOTBAR } from "./blocks.js";

export class Inventory {
  constructor(save) {
    this.save = save;
    this.selected = 0;
  }

  selectedBlock() { return HOTBAR[this.selected]; }
  count(type) { return Math.max(0, Number(this.save.inventory[type]) || 0); }

  add(type, amount = 1) {
    if (!BLOCKS[type] || amount < 1) return;
    this.save.inventory[type] = this.count(type) + amount;
  }

  consume(type, amount = 1) {
    if (this.count(type) < amount) return false;
    this.save.inventory[type] = this.count(type) - amount;
    return true;
  }

  select(index) {
    if (index >= 0 && index < HOTBAR.length) this.selected = index;
  }

  render(container, onSelect) {
    container.replaceChildren();
    HOTBAR.forEach((type, index) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `hotbar-slot ${this.selected === index ? "active" : ""}`;
      slot.setAttribute("aria-label", `${index + 1}: ${BLOCKS[type].name}, ${this.count(type)} قطعة`);
      slot.innerHTML = `<span class="slot-index">${index + 1}</span><span aria-hidden="true">${BLOCKS[type].icon}</span><small>${this.count(type)}</small>`;
      slot.addEventListener("click", () => onSelect(index));
      container.append(slot);
    });
  }
}
