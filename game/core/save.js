import { SAVE_KEY, HOTBAR } from "./blocks.js";

const initialInventory = () => Object.fromEntries(HOTBAR.map(type => [type, ({
  grass: 20, dirt: 16, stone: 12, wood: 3, leaves: 4, sand: 8, brick: 4, glass: 4, flower: 2
}[type] || 0)]));

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return freshSave();
    return {
      ...freshSave(),
      ...data,
      player: { x: 0.5, y: 9, z: 5.5, ...(data.player || {}) },
      inventory: { ...initialInventory(), ...(data.inventory || {}) },
      questStats: {
        collected: { ...(data.questStats?.collected || {}) },
        builtBlocks: Number(data.questStats?.builtBlocks) || 0
      },
      edits: data.edits && typeof data.edits === "object" ? data.edits : {},
      completedQuests: Array.isArray(data.completedQuests) ? data.completedQuests : [],
      completedChallenges: Number(data.completedChallenges) || 0,
      stars: Number(data.stars) || 0,
      unlockedAreas: Array.isArray(data.unlockedAreas) ? data.unlockedAreas : ["village", "academy"],
      settings: { quality: "medium", sound: true, showFps: false, ...(data.settings || {}) }
    };
  } catch (error) {
    console.warn("تعذر استعادة حفظ اللعبة.", error);
    return freshSave();
  }
}

export function freshSave() {
  return {
    version: 1, player: { x: 0.5, y: 9, z: 5.5 }, xp: 0, coins: 0,
    inventory: initialInventory(), edits: {}, completedQuests: [],
    completedChallenges: 0, correctAnswers: 0, foundChest: false,
    stars: 0, unlockedAreas: ["village", "academy"],
    builtHome: false, questStats: { collected: {}, builtBlocks: 0 },
    settings: { quality: "medium", sound: true, showFps: false }
  };
}

export function persistSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, savedAt: new Date().toISOString() }));
    return true;
  } catch (error) {
    console.error("تعذر حفظ عالم اللعبة.", error);
    return false;
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.error("تعذر إعادة تعيين حفظ اللعبة.", error);
    return false;
  }
  return true;
}
