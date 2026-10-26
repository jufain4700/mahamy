import { LEVELS } from "../core/blocks.js";

export class Rewards {
  constructor(save, ui) {
    this.save = save;
    this.ui = ui;
  }

  add({ xp = 0, coins = 0, message = "مكافأة جديدة!" } = {}) {
    const oldLevel = this.level().name;
    this.save.xp += xp;
    this.save.coins += coins;
    const currentLevel = this.level().name;
    this.ui.refreshHud();
    this.ui.rewardToast(`${message} +${xp} XP • +${coins} عملة`, xp);
    if (oldLevel !== currentLevel) this.ui.rewardToast(`رائع! وصلت إلى مستوى ${currentLevel}`);
    if (this.save.xp >= 100 && !this.save.unlockedAreas.includes("garden")) {
      this.save.unlockedAreas.push("garden");
      this.ui.rewardToast("فُتحت حديقة المغامرة عبر البوابة الجديدة!");
    }
  }

  level() {
    let current = LEVELS[0];
    for (const level of LEVELS) if (this.save.xp >= level.xp) current = level;
    return current;
  }

  progress() {
    const index = LEVELS.indexOf(this.level());
    const current = LEVELS[index];
    const next = LEVELS[index + 1];
    if (!next) return { current, next: null, percent: 100, needed: 0 };
    const span = next.xp - current.xp;
    return {
      current, next,
      percent: Math.round(Math.max(0, Math.min(100, (this.save.xp - current.xp) / span * 100))),
      needed: next.xp - this.save.xp
    };
  }
}
