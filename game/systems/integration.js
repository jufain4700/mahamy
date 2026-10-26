const PREFS_KEY = "mahamy.preferences.v1";
const EXAMS = new Set(["اختبار قصير", "اختبار شهري", "اختبار عملي", "اختبار نهائي"]);

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); }
  catch (error) { return {}; }
}

export async function fetchStudySummary() {
  const config = window.MAHAMI_CONFIG;
  if (!config?.apiUrl) return { available: false, reason: "لم يُضبط رابط بيانات المهام." };
  const prefs = readPrefs();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  let payload;
  try {
    const response = await fetch(config.apiUrl, {
      cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal
    });
    if (!response.ok) throw new Error(`تعذر الوصول إلى بيانات المهام (${response.status}).`);
    payload = await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("انتهت مهلة قراءة المهام. يمكنك اللعب والمحاولة لاحقًا.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  const tasks = Array.isArray(payload) ? payload : payload?.tasks;
  if (!Array.isArray(tasks)) throw new Error("استجابة بيانات المهام غير صالحة.");
  const now = Date.now();
  const selected = tasks.filter(task =>
    String(task.grade) === String(prefs.grade || "2") &&
    String(task.section) === String(prefs.section || "201") &&
    String(task.track) === String(prefs.track || "عام") &&
    !["cancelled", "canceled", "ملغي", "محذوف"].includes(String(task.status || "").toLowerCase())
  ).map(task => ({ ...task, date: parseDate(task.dueDate) }))
    .filter(task => task.date && task.date.getTime() >= now)
    .sort((a, b) => a.date - b.date);
  return {
    available: true,
    count: selected.length,
    exams: selected.filter(task => EXAMS.has(task.type)).length,
    nearest: selected[0] || null,
    grade: prefs.grade || "2",
    section: prefs.section || "201",
    track: prefs.track || "عام",
    updatedAt: payload.updatedAt || ""
  };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatStudyDate(date) {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh"
  }).format(date);
}
