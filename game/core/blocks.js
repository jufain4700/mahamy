export const BLOCKS = {
  grass: { name: "عشب", icon: "🟩", color: 0x79b957, solid: true, resource: "grass" },
  dirt: { name: "تراب", icon: "🟫", color: 0x9c704d, solid: true, resource: "dirt" },
  stone: { name: "حجر", icon: "⬜", color: 0x89969a, solid: true, resource: "stone" },
  wood: { name: "خشب", icon: "🪵", color: 0x9b673c, solid: true, resource: "wood" },
  leaves: { name: "أوراق", icon: "🌿", color: 0x4b9d58, solid: true, transparent: true, resource: "leaves" },
  sand: { name: "رمل", icon: "🟨", color: 0xd9bd76, solid: true, resource: "sand" },
  brick: { name: "طوب", icon: "🧱", color: 0xb96956, solid: true, resource: "brick" },
  glass: { name: "زجاج", icon: "🔷", color: 0x7ec4ca, solid: true, transparent: true, resource: "glass" },
  flower: { name: "زهرة", icon: "🌼", color: 0xec9fc1, solid: false, resource: "flower" }
};

export const HOTBAR = ["grass", "dirt", "stone", "wood", "leaves", "sand", "brick", "glass", "flower"];
export const SAVE_KEY = "mahamy.game.v1";
export const LEVELS = [
  { name: "مبتدئ", xp: 0 }, { name: "مستكشف", xp: 100 }, { name: "بنّاء", xp: 300 },
  { name: "محترف", xp: 700 }, { name: "أسطورة عالم مهامي", xp: 1500 }
];
