import * as THREE from "three";
import { VoxelWorld } from "./core/world.js";
import { Player } from "./core/player.js";
import { Controls } from "./core/controls.js";
import { Building } from "./core/building.js";
import { Inventory } from "./core/inventory.js";
import { freshSave, loadSave, persistSave, resetSave } from "./core/save.js";
import { loadQuestions, pickQuestion } from "./systems/challenges.js";
import { fetchStudySummary } from "./systems/integration.js";
import { GameAudio } from "./systems/audio.js";
import { Quests } from "./systems/quests.js";
import { Rewards } from "./systems/rewards.js";
import { Hud } from "./ui/hud.js";
import { Menus } from "./ui/menus.js";

const $ = id => document.getElementById(id);
let save = loadSave();
let renderer, scene, camera, world, player, controls, building, inventory, hud, rewards, quests, menus, audio;
let questions = [];
let questDefinitions = [];
let running = false;
let gameStarted = false;
let previousTime = 0;
let elapsed = 0;
let frameCount = 0;
let fpsTimer = 0;
let stepTimer = 0;
let fpsLabel = null;
let lastSave = 0;
let currentLandmark = null;
let paused = false;
let resetting = false;
const hadSavedGame = (() => {
  try { return Boolean(localStorage.getItem("mahamy.game.v1")); }
  catch (error) { console.warn("تعذر فحص حفظ اللعبة.", error); return false; }
})();

function showFatal(error) {
  console.error("تعذر تشغيل عالم مهامي.", error);
  const panel = document.createElement("div");
  panel.className = "screen-error";
  const article = document.createElement("article");
  const title = document.createElement("h1"); title.textContent = "تعذر تحميل عالم اللعبة";
  const explanation = document.createElement("p");
  explanation.textContent = "تحقق من اتصال الإنترنت لتحميل محرك Three.js، ثم أعد فتح اللعبة. تأكد من تشغيل الموقع عبر GitHub Pages أو خادم تطوير، لأن وحدات JavaScript لا تعمل من file://.";
  const back = document.createElement("a"); back.className = "secondary-button"; back.href = "../"; back.textContent = "العودة إلى مهامي";
  article.append(title, explanation, back); panel.append(article);
  document.getElementById("gameRoot").append(panel);
}

function makeRenderer() {
  const canvas = $("worldCanvas");
  const context = canvas.getContext("webgl2", { antialias: false, alpha: false }) ||
    canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!context) throw new Error("WebGL غير متاح في هذا المتصفح.");
  renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x91cad4);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(72, 1, 0.1, 90);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8bc7d0);
  scene.fog = new THREE.Fog(0x8bc7d0, 24, 62);
  world = new VoxelWorld(scene, save);
  player = new Player(camera, save);
  inventory = new Inventory(save);
  rewards = new Rewards(save, null);
  hud = new Hud(save, inventory, rewards);
  rewards.ui = hud;
  controls = new Controls(canvas, player, handleAction);
  building = new Building(camera, world, player, inventory, scene);
  audio = new GameAudio(save);
  applyQuality(save.settings.quality);
  resize();
}

function buildMenus() {
  const callbacks = {
    inventory,
    setQuality: value => { save.settings.quality = value; applyQuality(value); saveGame(); },
    setSound: value => { save.settings.sound = value; saveGame(); audio.play("collect"); },
    toggleFps: value => { save.settings.showFps = value; updateFpsElement(); saveGame(); },
    reset: resetWorld,
    openStudy: force => openStudy(force)
  };
  menus = new Menus(hud, save, callbacks);
  hud.onModalOpen = () => {
    controls.setActive(false);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  hud.onModalClose = () => {
    controls.setActive(gameStarted && !paused);
  };
}

function applyQuality(level) {
  const settings = {
    low: { pixelRatio: 0.72, far: 36, shadows: false, size: 512 },
    medium: { pixelRatio: 0.95, far: 55, shadows: true, size: 1024 },
    high: { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.4), far: 75, shadows: true, size: 1536 }
  }[level] || { pixelRatio: 0.95, far: 55, shadows: true, size: 1024 };
  if (!renderer) return;
  renderer.setPixelRatio(settings.pixelRatio);
  renderer.shadowMap.enabled = settings.shadows;
  scene.fog.far = settings.far;
  if (world?.sun) {
    world.sun.castShadow = settings.shadows;
    world.sun.shadow.mapSize.set(settings.size, settings.size);
    world.sun.shadow.needsUpdate = true;
  }
  resize();
  if (hud) hud.toast(`تم ضبط الجودة: ${({ low: "منخفضة", medium: "متوسطة", high: "عالية" })[level] || "متوسطة"}`);
}

function resize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth, height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateFpsElement() {
  if (save.settings.showFps && !fpsLabel) {
    fpsLabel = document.createElement("div");
    fpsLabel.className = "target-label";
    fpsLabel.style.cssText = "top:112px;left:18px;transform:none";
    fpsLabel.id = "fpsCounter";
    $("gameRoot").append(fpsLabel);
  }
  if (!save.settings.showFps && fpsLabel) { fpsLabel.remove(); fpsLabel = null; }
}

function saveGame() {
  if (!persistSave(save)) hud?.toast("تعذر الحفظ. قد تكون مساحة تخزين المتصفح ممتلئة.");
}

function startGame(continueGame) {
  gameStarted = true;
  paused = false;
  $("startScreen").classList.add("hidden");
  hud.show();
  hud.refreshHud();
  controls.setActive(true);
  if (continueGame && save.player) {
    player.x = Number(save.player.x) || 0.5;
    player.y = Number(save.player.y) || 7;
    player.z = Number(save.player.z) || 0.5;
  }
  hud.setHint(controls.isMobile() ? "استخدم العصا للحركة واسحب يمين الشاشة للنظر" : "انقر داخل العالم للتحكم بالنظر • E للتفاعل");
  saveGame();
  running = true;
}

function handleAction(action, value) {
  if (action === "pause" && !hud.modalLayer.classList.contains("hidden")) {
    paused = false;
    hud.closeModal();
    return;
  }
  if (!gameStarted || paused || !hud.modalLayer.classList.contains("hidden")) return;
  if (action === "jump") {
    if (player.jump()) audio.play("jump");
  } else if (action === "slot") {
    inventory.select(value); hud.refreshHud();
  } else if (action === "break") {
    const block = building.breakTarget();
    if (!block) {
      if (building.target && world.isProtected(building.target.block.x, building.target.block.y, building.target.block.z)) hud.toast("هذه المنطقة محمية.");
      return;
    }
    audio.play("break");
    if (block.type === "wood") audio.play("collect");
    hud.toast(`جمعت ${block.type === "wood" ? "خشبًا" : "موردًا جديدًا"}.`);
    showBreakEffect();
    save.questStats.collected[block.type] = (Number(save.questStats.collected[block.type]) || 0) + 1;
    if (quests.completeReady().length) saveGame();
    hud.refreshHud(); saveGame();
  } else if (action === "place") {
    if (building.placeBlock()) {
      save.questStats.builtBlocks++;
      save.builtHome = save.questStats.builtBlocks >= 12;
      audio.play("place");
      quests.completeReady(); hud.refreshHud(); saveGame();
    } else hud.toast(inventory.count(inventory.selectedBlock()) ? "اقترب من مكعب وحدد مكانًا فارغًا للبناء." : "لا تملك من هذا المكعب. اجمع الموارد أولًا.");
  } else if (action === "interact") interact();
  else if (action === "inventory") menus.inventory();
  else if (action === "pause") togglePause();
}

function nearestLandmark() {
  let nearest = null, distance = Infinity;
  for (const landmark of world.landmarks) {
    const d = Math.hypot(landmark.x - player.x, landmark.z - player.z);
    if (d < distance) { nearest = landmark; distance = d; }
  }
  return distance <= 2.7 ? nearest : null;
}

function interact() {
  const landmark = nearestLandmark();
  if (!landmark) {
    hud.toast("اقترب من شخصية أو منصة أو بوابة للتفاعل.");
    return;
  }
  if (landmark.kind === "chest") {
    if (save.foundChest) { hud.toast("وجدت هذا الصندوق من قبل!"); return; }
    save.foundChest = true;
    save.inventory.brick = (Number(save.inventory.brick) || 0) + 5;
    audio.play("chest");
    rewards.add({ xp: 20, coins: 12, message: "عثرت على كنز!" });
    quests.completeReady(); saveGame(); hud.refreshHud();
    return;
  }
  if (landmark.kind === "portal") {
    if (!save.unlockedAreas.includes(landmark.destination)) {
      hud.toast("تُفتح حديقة المغامرة عند الوصول إلى مستوى مستكشف (١٠٠ XP).");
      return;
    }
    const destination = landmark.destination === "garden" ? { x: -9, z: 9 } : { x: -2, z: -12 };
    player.x = destination.x; player.z = destination.z;
    player.y = Math.max(terrainAt(destination.x, destination.z) + 1, 4);
    player.velocityY = 0; hud.toast(`انتقلت إلى ${landmark.name}`); saveGame();
    return;
  }
  if (landmark.kind === "challenge" || landmark.kind === "academy") {
    startChallenge(landmark.kind === "challenge" ? landmark.name : "");
    return;
  }
  if (landmark.kind === "npc") {
    if (landmark.role === "guide") menus.instructions();
    else if (landmark.role === "builder") menus.quests(questDefinitions, quests);
    else if (landmark.role === "researcher") startChallenge("الكيمياء");
    else if (landmark.role === "coder") startChallenge("التقنية الرقمية");
  }
}

function terrainAt(x, z) {
  const block = world.getBlock(Math.floor(x), 18, Math.floor(z));
  if (block) return 18;
  for (let y = 17; y >= -1; y--) if (world.isSolid(Math.floor(x), y, Math.floor(z))) return y + 1;
  return 3;
}

function startChallenge(subject = "") {
  if (!questions.length) {
    hud.modal("أكاديمية التحديات", "الأسئلة غير متاحة حاليًا.", makeNote("تعذر تحميل الأسئلة. يمكنك الاستكشاف والبناء، ثم إعادة فتح اللعبة لاحقًا."), [
      hud.button("إغلاق", () => hud.closeModal(), true)
    ]);
    return;
  }
  const question = pickQuestion(questions, subject);
  menus.challenge(question, subject || question.subject, (correct, answered) => {
    if (answered) {
      save.completedChallenges++;
      if (correct) {
        save.correctAnswers++;
        save.stars++;
        audio.play("correct");
        rewards.add({ xp: 30, coins: 8, message: "إجابة رائعة!" });
      } else rewards.add({ xp: 5, coins: 1, message: "نقطة مشاركة" });
      quests.completeReady();
      saveGame();
      hud.refreshHud();
    }
  });
}

function makeNote(text) {
  const note = document.createElement("p");
  note.className = "empty-note"; note.textContent = text; return note;
}

function showBreakEffect() {
  const root = $("gameRoot");
  for (let i = 0; i < 7; i++) {
    const particle = document.createElement("span");
    particle.className = "break-particle";
    particle.style.left = `${50 + (Math.random() - 0.5) * 4}%`;
    particle.style.top = `${50 + (Math.random() - 0.5) * 4}%`;
    particle.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 80)}px`);
    particle.style.setProperty("--dy", `${Math.round((Math.random() - 0.5) * 80)}px`);
    root.append(particle);
    window.setTimeout(() => particle.remove(), 500);
  }
}

async function openStudy(force = false) {
  if (!force && hud.modalLayer.classList.contains("hidden")) return;
  const loading = document.createElement("p");
  loading.className = "empty-note"; loading.textContent = "جارٍ قراءة لوحة مهامي…";
  hud.modal("مهامي الدراسية", "قراءة فقط من لوحة مهامي.", loading);
  try {
    const summary = await fetchStudySummary();
    menus.study(summary);
  } catch (error) {
    console.warn("تعذر تحميل ملخص المهام داخل اللعبة.", error);
    menus.study(null, "تعذر الاتصال ببيانات مهامي الآن. استمر في اللعب وحاول لاحقًا.");
  }
}

function togglePause() {
  if (!gameStarted) return;
  paused = true;
  controls.setActive(false);
  const body = document.createElement("p");
  body.className = "challenge-question"; body.textContent = "خذ استراحة قصيرة. عالمك محفوظ تلقائيًا على هذا الجهاز.";
  hud.modal("اللعبة متوقفة مؤقتًا", "يمكنك متابعة اللعب أو تعديل الإعدادات.", body, [
    hud.button("متابعة المغامرة", () => { paused = false; hud.closeModal(); }, true),
    hud.button("الإعدادات", () => { paused = false; menus.settings(); }),
    hud.button("العودة إلى مهامي", () => { saveGame(); location.href = "../"; })
  ]);
}

function resetWorld() {
  if (!resetSave()) { hud.toast("تعذر حذف حفظ اللعبة."); return; }
  resetting = true;
  location.reload();
}

function setupUI() {
  $("continueButton").disabled = !hadSavedGame;
  if ($("continueButton").disabled) $("continueButton").textContent = "متابعة اللعب — لا يوجد حفظ بعد";
  $("startButton").addEventListener("click", () => {
    if (!hadSavedGame) { startGame(false); return; }
    const message = makeNote("بدء مغامرة جديدة سيحذف تقدم اللعبة الحالي المحفوظ على هذا الجهاز. لن تتأثر مهامك الدراسية أو بيانات لوحة مهامي.");
    hud.modal("مغامرة جديدة؟", "سيبدأ عالمك من جديد.", message, [
      hud.button("ابدأ من جديد", () => {
        resetWorld();
      }, true),
      hud.button("متابعة الحفظ", () => { hud.closeModal(); startGame(true); })
    ]);
  });
  $("continueButton").addEventListener("click", () => startGame(true));
  $("howButton").addEventListener("click", () => menus.instructions());
  $("settingsButton").addEventListener("click", () => menus.settings());
  $("pauseButton").addEventListener("click", togglePause);
  $("studyButton").addEventListener("click", () => openStudy(true));
  $("coinsButton").addEventListener("click", () => menus.quests(questDefinitions, quests));
  $("mobileControls").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (button) handleAction(button.dataset.action);
  });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      if (gameStarted && !paused) togglePause();
      if (gameStarted && !resetting) saveGame();
    } else {
      previousTime = performance.now();
      running = true;
    }
  });
  window.addEventListener("pagehide", () => { if (gameStarted && !resetting) saveGame(); });
  updateFpsElement();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!running || document.hidden) return;
  if (hud && !hud.modalLayer.classList.contains("hidden")) return;
  const delta = Math.min(0.05, Math.max(0, (now - (previousTime || now)) / 1000));
  previousTime = now;
  elapsed += delta;
  if (gameStarted && !paused && hud.modalLayer.classList.contains("hidden")) {
    player.update(world, controls, delta);
    stepTimer += delta;
    if (player.moving && stepTimer >= 0.55) { audio.play("step"); stepTimer = 0; }
    else if (!player.moving) stepTimer = 0;
    world.update(delta, elapsed);
    const block = building.update();
    hud.setTarget(block);
    currentLandmark = nearestLandmark();
    if (currentLandmark) hud.setHint(`اضغط E للتفاعل • ${currentLandmark.name}`);
    else if (controls.isMobile()) hud.setHint("العصا للحركة • اسحب يمين الشاشة للنظر");
    else if (!controls.pointerLocked) hud.setHint("انقر داخل العالم للتحكم بالنظر • WASD للحركة");
    else if (!block) hud.setHint("استكشف العالم • اقترب من منصة أو شخصية للبدء");
    hud.setCoordinates(player.x, player.z);
    frameCount++;
    fpsTimer += delta;
    if (fpsTimer >= 0.6) {
      if (fpsLabel) fpsLabel.textContent = `${Math.round(frameCount / fpsTimer)} FPS`;
      frameCount = 0; fpsTimer = 0;
    }
    if (now - lastSave > 6000) { saveGame(); lastSave = now; }
  }
  renderer.render(scene, camera);
}

async function loadData() {
  const [questionsResult, questsResult] = await Promise.allSettled([
    loadQuestions(),
    fetch(new URL("./data/quests.json", import.meta.url)).then(response => {
      if (!response.ok) throw new Error("تعذر تحميل مهام المغامرة.");
      return response.json();
    })
  ]);
  if (questionsResult.status === "fulfilled") questions = questionsResult.value;
  else console.warn(questionsResult.reason);
  if (questsResult.status === "fulfilled" && Array.isArray(questsResult.value.quests)) questDefinitions = questsResult.value.quests;
  else console.warn(questsResult.reason || "بيانات مهام المغامرة غير صالحة.");
  quests = new Quests(save, questDefinitions, rewards);
}

async function start() {
  try {
    makeRenderer();
    await loadData();
    buildMenus();
    setupUI();
    hud.refreshHud();
    quests.completeReady();
    running = true;
    renderer.setAnimationLoop(null);
    requestAnimationFrame(frame);
  } catch (error) {
    showFatal(error);
  }
}

start();
