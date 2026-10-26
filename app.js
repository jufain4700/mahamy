(() => {
  "use strict";

  const config = window.MAHAMI_CONFIG;
  const TASK_CACHE_KEY = "mahamy.tasks.v1";
  const PREFS_KEY = "mahamy.preferences.v1";
  const DONE_KEY = "mahamy.completed.v1";
  const EXAM_TYPES = new Set(["اختبار قصير", "اختبار شهري", "اختبار عملي", "اختبار نهائي"]);
  const TYPE_COLORS = {
    "واجب": "violet", "اختبار قصير": "red", "اختبار شهري": "red",
    "اختبار عملي": "orange", "اختبار نهائي": "red", "مشروع": "blue",
    "بحث علمي": "teal", "ورقة عمل": "purple", "عرض تقديمي": "blue",
    "نشاط صفي": "green", "مهمة عملية": "orange", "حفظ وتسميع": "pink",
    "تقييم أداء": "teal", "مشروع تخرج": "blue", "أخرى": "gray"
  };
  const $ = id => document.getElementById(id);
  const elements = {
    grade: $("gradeSelect"), section: $("sectionSelect"), track: $("trackSelect"),
    theme: $("themeButton"), refresh: $("refreshButton"), syncState: $("syncState"),
    syncMessage: $("syncMessage"), lastUpdated: $("lastUpdated"), spotlight: $("spotlight"),
    tasks: $("tasksContainer"), week: $("weekList"), weekLabel: $("weekLabel"),
    search: $("searchInput"), subject: $("subjectFilter"), type: $("typeFilter"),
    priority: $("priorityFilter"), due: $("dueFilter"), date: $("dateFilter"),
    clearFilters: $("clearFilters"), cardsView: $("cardsViewButton"), listView: $("listViewButton"),
    toast: $("toast"), notice: $("noticeBanner")
  };

  let tasks = [];
  let settings = {};
  let viewMode = "cards";
  let refreshTimer = null;
  let countdownTimer = null;
  let toastTimer = null;
  let currentSource = "loading";
  let lastGoodUpdatedAt = null;

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`تعذر قراءة التفضيل المحلي ${key}.`, error);
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      showToast("تعذر حفظ التفضيل على هذا الجهاز.");
      console.warn(`تعذر حفظ البيانات المحلية ${key}.`, error);
    }
  }

  function prefs() {
    return readJson(PREFS_KEY, {});
  }

  function initializeSelections() {
    const saved = prefs();
    const grade = config.grades.find(item => item.id === String(saved.grade)) || config.grades[0];
    elements.grade.value = grade.id;
    populateSections(grade, saved.section);
    const tracks = Array.isArray(settings.tracks) && settings.tracks.length ? settings.tracks : config.tracks;
    populateSelect(elements.track, tracks, saved.track || tracks[0], "المسار");
    document.documentElement.dataset.theme = saved.theme === "dark" ? "dark" : "light";
    updateThemeButton();
    updateCalendarDates();
  }

  function populateSections(grade, selected) {
    const sections = Array.isArray(settings.sections?.[grade.id]) && settings.sections[grade.id].length
      ? settings.sections[grade.id]
      : grade.sections;
    const selectedSection = sections.map(String).includes(String(selected)) ? selected : sections[0];
    populateSelect(elements.section, sections, selectedSection, "الشعبة");
  }

  function populateSelect(select, options, selected, placeholder) {
    select.replaceChildren();
    options.forEach(option => {
      const value = typeof option === "object" ? String(option.id ?? option.value ?? "") : String(option);
      const label = typeof option === "object" ? String(option.label ?? value) : String(option);
      const node = document.createElement("option");
      node.value = value;
      node.textContent = label;
      select.append(node);
    });
    if (!options.some(option => String(typeof option === "object" ? option.id ?? option.value : option) === String(selected))) {
      const placeholderOption = document.createElement("option");
      placeholderOption.value = String(selected || "");
      placeholderOption.textContent = String(selected || placeholder);
      select.append(placeholderOption);
    }
    select.value = String(selected || options[0] || "");
  }

  function updateCalendarDates() {
    const now = new Date();
    $("todayGregorian").textContent = new Intl.DateTimeFormat("ar-SA", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: config.timezone
    }).format(now);
    $("todayHijri").textContent = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric", timeZone: config.timezone
    }).format(now);
  }

  function parseDueDate(value) {
    if (typeof value !== "string" && !(value instanceof Date)) return null;
    const raw = value instanceof Date ? value.toISOString() : value.trim();
    if (!raw) return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(raw);
    if (!parts) return null;
    const [, year, month, day, hour = "00", minute = "00", second = "00", , zone] = parts;
    const dateCheck = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (Number(year) < 1000 || dateCheck.getUTCFullYear() !== Number(year) ||
      dateCheck.getUTCMonth() !== Number(month) - 1 || dateCheck.getUTCDate() !== Number(day) ||
      Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
    if (zone && zone !== "Z") {
      const offset = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
      if (!offset || Number(offset[2]) > 14 || Number(offset[3]) > 59 ||
        Number(offset[2]) === 14 && Number(offset[3]) !== 0) return null;
    }
    let normalized = raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) normalized = `${raw}T23:59:59+03:00`;
    else if (raw.includes("T") && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) normalized = `${raw}+03:00`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function validateTask(input) {
    if (!input || typeof input !== "object") return null;
    const task = {};
    ["id", "grade", "section", "track", "subject", "type", "title", "description",
      "dueDate", "teacher", "link", "priority", "status"].forEach(key => {
      task[key] = input[key] == null ? "" : String(input[key]).trim();
    });
    if (!task.id || !task.title || !task.grade || !task.section || !task.subject || !task.type || !parseDueDate(task.dueDate)) return null;
    if (task.link) {
      try {
        const url = new URL(task.link);
        if (url.protocol !== "https:" && url.protocol !== "http:") task.link = "";
        else task.link = url.href;
      } catch (error) {
        task.link = "";
      }
    }
    const priority = task.priority.toLowerCase();
    task.priority = ["high", "medium", "low"].includes(priority) ? priority : "medium";
    task.status = task.status.toLowerCase();
    if (["cancelled", "canceled", "ملغي", "محذوف"].includes(task.status)) return null;
    task.deadline = parseDueDate(task.dueDate);
    return task;
  }

  function normalizePayload(payload) {
    const source = Array.isArray(payload) ? payload : payload?.tasks;
    if (!Array.isArray(source)) throw new Error("استجابة API لا تحتوي على قائمة مهام.");
    if (!Array.isArray(payload) && payload.ok === false) throw new Error("تعذر قراءة بيانات جدول Google Sheets.");
    const normalizedTasks = source.map(validateTask);
    if (normalizedTasks.some(task => !task)) throw new Error("تحتوي استجابة API على مهمة ناقصة أو غير صالحة.");
    const ids = new Set();
    normalizedTasks.forEach(task => {
      if (ids.has(task.id)) throw new Error("يوجد معرف مكرر في المهام.");
      ids.add(task.id);
    });
    return {
      tasks: normalizedTasks,
      settings: !Array.isArray(payload) && payload.settings && typeof payload.settings === "object" ? payload.settings : {},
      updatedAt: !Array.isArray(payload) ? payload.updatedAt : ""
    };
  }

  function loadDemoData() {
    const demoDeadline = hoursFromNow => new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
    const base = [
      { id: "demo-001", grade: "2", section: "201", track: "عام", subject: "الرياضيات", type: "واجب", title: "تدريبات على الدوال", description: "حل الأسئلة المحددة في الدفتر.", dueDate: demoDeadline(17), teacher: "معلم الرياضيات", priority: "medium" },
      { id: "demo-002", grade: "2", section: "201", track: "عام", subject: "اللغة الإنجليزية", type: "اختبار قصير", title: "مراجعة الوحدة الأولى", description: "مراجعة المفردات والقواعد المحددة.", dueDate: demoDeadline(36), teacher: "معلم اللغة الإنجليزية", priority: "high" },
      { id: "demo-003", grade: "2", section: "201", track: "عام", subject: "التقنية الرقمية", type: "مشروع", title: "تصميم عرض توعوي", description: "إعداد عرض قصير حول السلامة الرقمية.", dueDate: demoDeadline(120), priority: "low" },
      { id: "demo-005", grade: "2", section: "201", track: "عام", subject: "الكيمياء", type: "ورقة عمل", title: "مراجعة المفاهيم الأساسية", description: "مثال توضيحي لمهمة تجاوز موعدها.", dueDate: demoDeadline(-20), priority: "medium" },
      { id: "demo-004", grade: "3", section: "301", track: "علوم الحاسب والهندسة", subject: "الفيزياء", type: "ورقة عمل", title: "تطبيقات الحركة", description: "إكمال ورقة العمل وتسليمها في الحصة.", dueDate: demoDeadline(72), priority: "medium" }
    ];
    return base.map(validateTask).filter(Boolean);
  }

  async function refreshTasks(isAutomatic = false) {
    if (!isAutomatic) setSyncState("loading", "جارٍ تحديث المهام…");
    elements.refresh.disabled = true;
    elements.refresh.classList.add("is-spinning");
    try {
      if (!config.apiUrl.trim()) {
        if (!config.demoEnabled) throw new Error("لم يتم إعداد رابط مصدر البيانات.");
        tasks = loadDemoData();
        settings = {};
        currentSource = "demo";
        lastGoodUpdatedAt = new Date().toISOString();
        renderAll();
        setSyncState("demo", "وضع تجريبي — بيانات للعرض فقط");
        elements.lastUpdated.textContent = "ليست بيانات صفك الفعلية";
        return;
      }

      const response = await fetch(config.apiUrl, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = normalizePayload(await response.json());
      const previous = readJson(TASK_CACHE_KEY, null);
      const previousIds = new Set((previous?.tasks || []).map(task => task.id));
      const added = previousIds.size ? payload.tasks.filter(task => !previousIds.has(task.id)).length : 0;
      tasks = payload.tasks;
      settings = payload.settings;
      currentSource = "live";
      lastGoodUpdatedAt = payload.updatedAt || new Date().toISOString();
      saveJson(TASK_CACHE_KEY, { source: "live", tasks: tasks.map(stripDerived), settings, updatedAt: lastGoodUpdatedAt });
      if (added) showNewTasksNotice(added);
      initializeSelections();
      renderAll();
      setSyncState("live", "متصل — البيانات محدّثة");
      elements.lastUpdated.textContent = `آخر تحديث ${formatTime(lastGoodUpdatedAt)}`;
    } catch (error) {
      console.warn("تعذر تحديث المهام من المصدر.", error);
      const cached = readJson(TASK_CACHE_KEY, null);
      if (cached?.source === "live" && Array.isArray(cached.tasks)) {
        const normalized = normalizePayload(cached);
        tasks = normalized.tasks;
        settings = cached.settings || {};
        currentSource = "stale";
        lastGoodUpdatedAt = cached.updatedAt || null;
        initializeSelections();
        renderAll();
        setSyncState("stale", "تعذر الاتصال — تعرض آخر بيانات محفوظة");
        elements.lastUpdated.textContent = lastGoodUpdatedAt ? `آخر تحديث ناجح ${formatTime(lastGoodUpdatedAt)}` : "قد تكون البيانات قديمة";
      } else {
        currentSource = "error";
        tasks = [];
        renderAll();
        setSyncState("error", "تعذر تحميل المهام. تحقق من الاتصال أو إعداد الرابط.");
        elements.lastUpdated.textContent = "";
      }
    } finally {
      elements.refresh.disabled = false;
      elements.refresh.classList.remove("is-spinning");
    }
  }

  function stripDerived(task) {
    const copy = { ...task };
    delete copy.deadline;
    return copy;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "غير متاح";
    return new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit", timeZone: config.timezone }).format(date);
  }

  function setSyncState(type, message) {
    elements.syncState.dataset.state = type;
    elements.syncMessage.textContent = message;
  }

  function showNewTasksNotice(count) {
    elements.notice.textContent = `أُضيفت ${new Intl.NumberFormat("ar-SA").format(count)} ${count === 1 ? "مهمة جديدة" : "مهام جديدة"} منذ آخر تحديث.`;
    elements.notice.classList.remove("hidden");
    window.setTimeout(() => elements.notice.classList.add("hidden"), 9000);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2600);
  }

  function selectedTasks() {
    const grade = elements.grade.value;
    const section = elements.section.value;
    const track = elements.track.value;
    return tasks.filter(task => task.grade === grade && task.section === section && task.track === track);
  }

  function dueState(task, now = Date.now()) {
    const remaining = task.deadline.getTime() - now;
    if (remaining < 0) return "overdue";
    if (remaining <= 48 * 60 * 60 * 1000) return "soon";
    return "upcoming";
  }

  function completedIds() {
    return readJson(DONE_KEY, []);
  }

  function renderAll() {
    const current = selectedTasks().sort((a, b) => a.deadline - b.deadline);
    renderFilterOptions(current);
    renderStats(current);
    renderSpotlight(current);
    renderProgress(current);
    renderWeek(current);
    renderTaskList(filterTasks(current));
  }

  function renderFilterOptions(current) {
    const configuredSubjects = Array.isArray(settings.subjects) && settings.subjects.length ? settings.subjects : config.subjects;
    const subjects = [...new Set([...configuredSubjects, ...current.map(task => task.subject)])].sort((a, b) => String(a).localeCompare(String(b), "ar"));
    const types = [...new Set(current.map(task => task.type))].sort((a, b) => a.localeCompare(b, "ar"));
    const oldSubject = elements.subject.value;
    const oldType = elements.type.value;
    replaceFilterOptions(elements.subject, "كل المواد", subjects, oldSubject);
    replaceFilterOptions(elements.type, "كل الأنواع", types, oldType);
  }

  function replaceFilterOptions(select, label, values, selected) {
    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = label;
    select.append(all);
    values.forEach(value => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      select.append(option);
    });
    select.value = values.includes(selected) ? selected : "";
  }

  function renderStats(current) {
    const active = current.filter(task => !completedIds().includes(task.id));
    const upcoming = active.filter(task => dueState(task) !== "overdue");
    $("upcomingCount").textContent = arabicNumber(upcoming.length);
    $("examCount").textContent = arabicNumber(upcoming.filter(task => EXAM_TYPES.has(task.type)).length);
    $("soonCount").textContent = arabicNumber(active.filter(task => dueState(task) === "soon").length);
    $("overdueCount").textContent = arabicNumber(active.filter(task => dueState(task) === "overdue").length);
  }

  function renderSpotlight(current) {
    const next = current.find(task => dueState(task) !== "overdue" && !completedIds().includes(task.id));
    elements.spotlight.replaceChildren();
    if (!next) {
      const message = document.createElement("div");
      message.className = "spotlight-empty";
      message.innerHTML = `<span class="empty-icon"><i data-lucide="sparkles"></i></span><div><strong>${current.length ? "أحسنت! لا توجد مواعيد قادمة غير منجزة." : "لا توجد مهام لهذا الاختيار بعد."}</strong><p>${current.length ? "يمكنك مراجعة المهام المكتملة أدناه." : "عند إضافة مهام لشعبتك ستظهر هنا تلقائيًا."}</p></div>`;
      elements.spotlight.append(message);
      refreshIcons();
      return;
    }
    const shell = document.createElement("div");
    shell.className = `spotlight-content ${dueState(next) === "soon" ? "is-soon" : ""}`;
    const details = document.createElement("div");
    details.className = "spotlight-details";
    const tag = document.createElement("span");
    tag.className = `type-badge ${typeColor(next.type)}`;
    tag.textContent = next.type;
    const subject = document.createElement("span");
    subject.className = "spotlight-subject";
    subject.textContent = next.subject;
    const title = document.createElement("h3");
    title.textContent = next.title;
    const description = document.createElement("p");
    description.textContent = next.description || "لا توجد تعليمات إضافية.";
    const due = document.createElement("div");
    due.className = "due-line";
    due.innerHTML = '<i data-lucide="calendar-clock"></i>';
    const dueText = document.createElement("span");
    dueText.textContent = formatDue(next.deadline);
    due.append(dueText);
    details.append(tag, subject, title, description, due);
    const side = document.createElement("div");
    side.className = "countdown-box";
    const label = document.createElement("span");
    label.textContent = "الوقت المتبقي";
    const countdown = document.createElement("strong");
    countdown.dataset.countdown = next.id;
    countdown.textContent = countdownText(next.deadline);
    side.append(label, countdown);
    const actions = document.createElement("div");
    actions.className = "spotlight-actions";
    if (next.link) actions.append(makeLinkButton(next.link, "فتح المهمة", "external-link"));
    actions.append(makeCalendarButton(next));
    actions.append(makeCompleteButton(next));
    shell.append(details, side, actions);
    elements.spotlight.append(shell);
    refreshIcons();
  }

  function renderProgress(current) {
    const done = new Set(completedIds());
    const count = current.length;
    const completed = current.filter(task => done.has(task.id)).length;
    const percent = count ? Math.round(completed / count * 100) : 0;
    $("progressPercent").textContent = `${arabicNumber(percent)}٪`;
    $("progressText").textContent = count
      ? `أنجزت ${arabicNumber(completed)} من ${arabicNumber(count)} مهمة — محفوظة على هذا الجهاز فقط`
      : "يتم حفظ إنجازك على هذا الجهاز فقط";
    $("progressFill").style.width = `${percent}%`;
    document.querySelector(".progress-track").setAttribute("aria-valuenow", String(percent));
  }

  function renderWeek(current) {
    elements.week.replaceChildren();
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    elements.weekLabel.textContent = `${formatShortDate(now)} — ${formatShortDate(weekEnd)}`;
    const weekTasks = current.filter(task => task.deadline >= now && task.deadline <= weekEnd).slice(0, 5);
    if (!weekTasks.length) {
      elements.week.className = "week-list empty-week";
      const text = document.createElement("p");
      text.textContent = current.length ? "لا توجد مواعيد خلال الأيام السبعة القادمة." : "ستظهر المواعيد القادمة هنا بعد تحميلها.";
      elements.week.append(text);
      return;
    }
    elements.week.className = "week-list";
    weekTasks.forEach(task => {
      const item = document.createElement("article");
      item.className = "week-item";
      const date = document.createElement("div");
      date.className = "week-date";
      const day = document.createElement("strong");
      day.textContent = new Intl.DateTimeFormat("ar-SA", { day: "numeric", timeZone: config.timezone }).format(task.deadline);
      const month = document.createElement("span");
      month.textContent = new Intl.DateTimeFormat("ar-SA", { month: "short", timeZone: config.timezone }).format(task.deadline);
      date.append(day, month);
      const info = document.createElement("div");
      info.className = "week-info";
      const subject = document.createElement("strong");
      subject.textContent = task.subject;
      const title = document.createElement("span");
      title.textContent = task.title;
      info.append(subject, title);
      const time = document.createElement("small");
      time.textContent = formatTime(task.deadline);
      item.append(date, info, time);
      elements.week.append(item);
    });
  }

  function filterTasks(current) {
    const search = elements.search.value.trim().toLocaleLowerCase("ar");
    return current.filter(task => {
      const state = dueState(task);
      const matchesSearch = !search || [task.title, task.subject, task.description, task.type, task.teacher].join(" ").toLocaleLowerCase("ar").includes(search);
      return matchesSearch &&
        (!elements.subject.value || task.subject === elements.subject.value) &&
        (!elements.type.value || task.type === elements.type.value) &&
        (!elements.priority.value || task.priority === elements.priority.value) &&
        (!elements.due.value || elements.due.value === "upcoming" && state !== "overdue" ||
          elements.due.value === "soon" && state === "soon" ||
          elements.due.value === "overdue" && state === "overdue") &&
        (!elements.date.value || task.deadline >= new Date(`${elements.date.value}T00:00:00+03:00`));
    });
  }

  function renderTaskList(filtered) {
    elements.tasks.replaceChildren();
    elements.tasks.className = `tasks-grid ${viewMode === "list" ? "list-view" : ""}`;
    $("resultCount").textContent = `${arabicNumber(filtered.length)} ${filtered.length === 1 ? "مهمة" : "مهام"}`;
    const anyFilters = elements.search.value || elements.subject.value || elements.type.value ||
      elements.priority.value || elements.due.value || elements.date.value;
    elements.clearFilters.classList.toggle("hidden", !anyFilters);
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.innerHTML = '<i data-lucide="inbox"></i>';
      const title = document.createElement("strong");
      title.textContent = tasks.length ? "لا توجد نتائج مطابقة" : "لا توجد مهام لعرضها";
      const text = document.createElement("p");
      text.textContent = tasks.length ? "جرّب تغيير خيارات البحث والتصفية." : "ستظهر المهام هنا بعد ربط Google Sheets وإضافة البيانات.";
      empty.append(icon, title, text);
      elements.tasks.append(empty);
      refreshIcons();
      return;
    }
    const done = new Set(completedIds());
    filtered.forEach(task => elements.tasks.append(createTaskCard(task, done.has(task.id))));
    refreshIcons();
  }

  function createTaskCard(task, isDone) {
    const state = dueState(task);
    const card = document.createElement("article");
    card.className = `task-card ${isDone ? "is-complete" : ""} ${state === "overdue" && !isDone ? "is-overdue" : state === "soon" && !isDone ? "is-soon" : ""}`;
    card.dataset.taskId = task.id;
    const stripe = document.createElement("span");
    stripe.className = `task-stripe ${typeColor(task.type)}`;
    const body = document.createElement("div");
    body.className = "task-card-body";
    const top = document.createElement("div");
    top.className = "task-topline";
    const badge = document.createElement("span");
    badge.className = `type-badge ${typeColor(task.type)}`;
    badge.textContent = task.type;
    const priority = document.createElement("span");
    priority.className = `priority-label priority-${task.priority}`;
    priority.textContent = { high: "أولوية عالية", medium: "أولوية متوسطة", low: "أولوية منخفضة" }[task.priority];
    top.append(badge, priority);
    const subject = document.createElement("p");
    subject.className = "task-subject";
    subject.textContent = task.subject;
    const title = document.createElement("h3");
    title.textContent = task.title;
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "لا توجد تعليمات إضافية.";
    const footer = document.createElement("div");
    footer.className = "task-footer";
    const date = document.createElement("span");
    date.className = `task-due ${state}`;
    date.innerHTML = `<i data-lucide="${state === "overdue" ? "circle-alert" : "calendar-days"}"></i>`;
    const dueLabel = document.createElement("span");
    dueLabel.textContent = state === "overdue" ? `متأخرة • ${formatDue(task.deadline)}` : state === "soon" ? `خلال ٤٨ ساعة • ${formatDue(task.deadline)}` : formatDue(task.deadline);
    date.append(dueLabel);
    footer.append(date);
    const actions = document.createElement("div");
    actions.className = "task-actions";
    if (task.link) actions.append(makeLinkButton(task.link, "فتح الرابط", "external-link"));
    actions.append(makeCalendarButton(task));
    actions.append(makeCompleteButton(task, isDone));
    body.append(top, subject, title, description, footer, actions);
    card.append(stripe, body);
    return card;
  }

  function makeLinkButton(url, label, icon) {
    const anchor = document.createElement("a");
    anchor.className = "text-action";
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const glyph = document.createElement("i");
    glyph.dataset.lucide = icon;
    anchor.append(glyph, document.createTextNode(label));
    return anchor;
  }

  function makeCalendarButton(task) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-action calendar-action";
    button.dataset.ics = task.id;
    const icon = document.createElement("i");
    icon.dataset.lucide = "calendar-plus";
    button.append(icon, document.createTextNode("إضافة للتقويم"));
    return button;
  }

  function makeCompleteButton(task, isDone = completedIds().includes(task.id)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `complete-button ${isDone ? "completed" : ""}`;
    button.setAttribute("aria-pressed", String(isDone));
    button.textContent = isDone ? "تم الإنجاز" : "تم الإنجاز؟";
    const icon = document.createElement("i");
    icon.dataset.lucide = isDone ? "check-circle-2" : "circle";
    button.prepend(icon);
    button.addEventListener("click", () => toggleComplete(task.id));
    return button;
  }

  function toggleComplete(id) {
    const done = new Set(completedIds());
    if (done.has(id)) {
      done.delete(id);
      showToast("تمت إعادة المهمة إلى قائمة المتابعة.");
    } else {
      done.add(id);
      showToast("أُنجزت المهمة — حفظنا ذلك على جهازك فقط.");
    }
    saveJson(DONE_KEY, [...done]);
    renderAll();
  }

  function typeColor(type) {
    return TYPE_COLORS[type] || "gray";
  }

  function formatDue(date) {
    return new Intl.DateTimeFormat("ar-SA", {
      weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
      timeZone: config.timezone
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", timeZone: config.timezone }).format(date);
  }

  function countdownText(deadline) {
    const milliseconds = deadline.getTime() - Date.now();
    if (milliseconds <= 0) return "انتهى الموعد";
    const days = Math.floor(milliseconds / 86400000);
    const hours = Math.floor(milliseconds % 86400000 / 3600000);
    const minutes = Math.floor(milliseconds % 3600000 / 60000);
    return days ? `${arabicNumber(days)} يوم ${arabicNumber(hours)} ساعة` : `${arabicNumber(hours)} ساعة ${arabicNumber(minutes)} دقيقة`;
  }

  function arabicNumber(value) {
    return new Intl.NumberFormat("ar-SA").format(value);
  }

  function updateCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach(node => {
      const task = tasks.find(item => item.id === node.dataset.countdown);
      if (task) node.textContent = countdownText(task.deadline);
    });
  }

  function downloadIcs(task) {
    const utc = task.deadline.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapeIcs = value => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const content = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mahami//Study Planner//AR",
      "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${escapeIcs(task.id)}@mahamy`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${utc}`, `DTEND:${new Date(task.deadline.getTime() + 30 * 60000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `SUMMARY:${escapeIcs(`${task.subject} - ${task.title}`)}`,
      `DESCRIPTION:${escapeIcs(task.description || task.type)}`, "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${task.id}.ics`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("تم تنزيل موعد المهمة بصيغة التقويم.");
  }

  function updateThemeButton() {
    const isDark = document.documentElement.dataset.theme === "dark";
    elements.theme.setAttribute("aria-label", isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي");
    elements.theme.title = isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي";
    elements.theme.replaceChildren();
    const icon = document.createElement("i");
    icon.dataset.lucide = isDark ? "sun" : "moon";
    elements.theme.append(icon);
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function bindEvents() {
    elements.grade.addEventListener("change", () => {
      const grade = config.grades.find(item => item.id === elements.grade.value) || config.grades[0];
      populateSections(grade);
      storeSelections();
      renderAll();
    });
    [elements.section, elements.track].forEach(select => select.addEventListener("change", () => {
      storeSelections();
      renderAll();
    }));
    elements.refresh.addEventListener("click", () => refreshTasks());
    elements.theme.addEventListener("click", () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      saveJson(PREFS_KEY, { ...prefs(), theme });
      updateThemeButton();
    });
    [elements.search, elements.subject, elements.type, elements.priority, elements.due, elements.date]
      .forEach(control => control.addEventListener(control === elements.search ? "input" : "change", () => renderTaskList(filterTasks(selectedTasks().sort((a, b) => a.deadline - b.deadline)))));
    elements.clearFilters.addEventListener("click", () => {
      elements.search.value = "";
      elements.subject.value = "";
      elements.type.value = "";
      elements.priority.value = "";
      elements.due.value = "";
      elements.date.value = "";
      renderTaskList(selectedTasks().sort((a, b) => a.deadline - b.deadline));
    });
    elements.cardsView.addEventListener("click", () => setView("cards"));
    elements.listView.addEventListener("click", () => setView("list"));
    document.addEventListener("click", event => {
      const calendarButton = event.target.closest("[data-ics]");
      if (calendarButton) {
        const task = tasks.find(item => item.id === calendarButton.dataset.ics);
        if (task) downloadIcs(task);
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.clearInterval(refreshTimer);
        refreshTimer = null;
      } else if (config.apiUrl && !refreshTimer) {
        refreshTasks(true);
        startRefreshTimer();
      }
    });
  }

  function storeSelections() {
    saveJson(PREFS_KEY, { ...prefs(), grade: elements.grade.value, section: elements.section.value, track: elements.track.value });
  }

  function setView(mode) {
    viewMode = mode;
    elements.cardsView.classList.toggle("active", mode === "cards");
    elements.listView.classList.toggle("active", mode === "list");
    elements.cardsView.setAttribute("aria-pressed", String(mode === "cards"));
    elements.listView.setAttribute("aria-pressed", String(mode === "list"));
    renderTaskList(filterTasks(selectedTasks().sort((a, b) => a.deadline - b.deadline)));
  }

  function startRefreshTimer() {
    window.clearInterval(refreshTimer);
    if (config.apiUrl && document.visibilityState !== "hidden") {
      refreshTimer = window.setInterval(() => refreshTasks(true), Math.max(15000, Number(config.refreshIntervalMs) || 60000));
    }
  }

  function start() {
    initializeSelections();
    bindEvents();
    refreshTasks();
    startRefreshTimer();
    countdownTimer = window.setInterval(updateCountdowns, 60000);
    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", start, { once: true });
})();
