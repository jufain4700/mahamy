/**
 * واجهة قراءة عامة لبيانات مدرسية غير حساسة.
 * أنشئ ورقتي Tasks وSettings ثم انشر هذا المشروع كـ Web App.
 */
const TASKS_SHEET_NAME = "Tasks";
const SETTINGS_SHEET_NAME = "Settings";
const TIME_ZONE = "Asia/Riyadh";
const TASK_HEADERS = [
  "id", "grade", "section", "track", "subject", "type", "title",
  "description", "dueDate", "teacher", "link", "priority", "status"
];

function doGet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const tasksSheet = spreadsheet.getSheetByName(TASKS_SHEET_NAME);
    if (!tasksSheet) throw new Error('ورقة Tasks غير موجودة.');

    const tasks = readRows_(tasksSheet, TASK_HEADERS).map(normalizeTask_);
    const settingsSheet = spreadsheet.getSheetByName(SETTINGS_SHEET_NAME);
    const settings = settingsSheet ? readSettings_(settingsSheet) : {};
    return jsonOutput_({
      ok: true,
      tasks: tasks.filter(task => task.id && task.title && task.dueDate),
      settings: settings,
      updatedAt: Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
    });
  } catch (error) {
    console.error(error);
    return jsonOutput_({ ok: false, error: "تعذر قراءة بيانات الجدول." });
  }
}

function readRows_(sheet, requiredHeaders) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(value => String(value).trim());
  const missing = requiredHeaders.filter(header => headers.indexOf(header) < 0);
  if (missing.length) throw new Error("أعمدة ناقصة: " + missing.join(", "));
  return values.slice(1).filter(row => row.some(value => value !== "")).map(row => {
    const record = {};
    headers.forEach((header, index) => { record[header] = row[index]; });
    return record;
  });
}

function normalizeTask_(row) {
  const dueDate = row.dueDate instanceof Date
    ? Utilities.formatDate(row.dueDate, TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
    : String(row.dueDate || "").trim();
  return {
    id: String(row.id || "").trim(),
    grade: String(row.grade || "").trim(),
    section: String(row.section || "").trim(),
    track: String(row.track || "").trim(),
    subject: String(row.subject || "").trim(),
    type: String(row.type || "").trim(),
    title: String(row.title || "").trim(),
    description: String(row.description || "").trim(),
    dueDate: dueDate,
    teacher: String(row.teacher || "").trim(),
    link: String(row.link || "").trim(),
    priority: String(row.priority || "medium").trim().toLowerCase(),
    status: String(row.status || "active").trim().toLowerCase()
  };
}

function readSettings_(sheet) {
  const values = sheet.getDataRange().getValues();
  const settings = {};
  values.slice(1).forEach(row => {
    const key = String(row[0] || "").trim();
    if (!key) return;
    const rawValue = row[1];
    try {
      settings[key] = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    } catch (error) {
      settings[key] = String(rawValue);
    }
  });
  return settings;
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
