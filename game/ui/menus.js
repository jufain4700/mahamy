import { BLOCKS } from "../core/blocks.js";
import { checkAnswer } from "../systems/challenges.js";

const makeSection = className => {
  const node = document.createElement("div");
  node.className = className;
  return node;
};

export class Menus {
  constructor(hud, save, callbacks) {
    this.hud = hud;
    this.save = save;
    this.callbacks = callbacks;
  }

  instructions() {
    const list = document.createElement("ul");
    list.className = "info-list";
    [
      "على الكمبيوتر: استخدم WASD للحركة، وحرّك الفأرة للنظر بعد النقر داخل العالم.",
      "اضغط Space للقفز وShift للجري. زر الفأرة الأيسر يكسر المكعب، والأيمن يضع المكعب المختار.",
      "اضغط E للتفاعل مع المرشدين والصناديق والبوابات، وI لفتح حقيبة الموارد.",
      "على الجوال: استخدم العصا الافتراضية للحركة، واسحب يمين الشاشة لتوجيه النظر، والأزرار للقفز والبناء والتفاعل.",
      "الأسئلة والمكافآت للتسلية والتعلم فقط ولا ترتبط بالدرجات الرسمية. تقدم اللعب محفوظ على هذا الجهاز."
    ].forEach(text => {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    });
    this.hud.modal("طريقة اللعب", "اكتشف العالم على راحتك", list, [this.hud.button("حسنًا", () => this.hud.closeModal(), true)]);
  }

  settings() {
    const body = makeSection("settings-list");
    body.append(
      this.selectSetting("جودة الرسوم", this.save.settings.quality, [
        ["low", "منخفضة — أداء أسرع"], ["medium", "متوسطة"], ["high", "عالية"]
      ], value => this.callbacks.setQuality(value)),
      this.toggleSetting("الأصوات الهادئة", this.save.settings.sound, value => this.callbacks.setSound(value)),
      this.toggleSetting("عرض عداد FPS", this.save.settings.showFps, value => {
        this.save.settings.showFps = value;
        this.callbacks.toggleFps(value);
      })
    );
    const reset = this.hud.button("إعادة تعيين العالم", () => this.confirmReset(), false);
    reset.classList.add("danger-button");
    this.hud.modal("إعدادات المغامرة", "تُحفظ الإعدادات والتقدم محليًا على جهازك.", body, [
      reset, this.hud.button("إغلاق", () => this.hud.closeModal())
    ]);
  }

  selectSetting(label, value, options, onChange) {
    const row = makeSection("setting-row");
    const caption = document.createElement("span");
    caption.textContent = label;
    const select = document.createElement("select");
    options.forEach(([optionValue, text]) => {
      const option = document.createElement("option");
      option.value = optionValue; option.textContent = text;
      select.append(option);
    });
    select.value = value;
    select.addEventListener("change", () => onChange(select.value));
    row.append(caption, select);
    return row;
  }

  toggleSetting(label, checked, onChange) {
    const row = makeSection("setting-row");
    const caption = document.createElement("span");
    caption.textContent = label;
    const input = document.createElement("input");
    input.type = "checkbox"; input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    row.append(caption, input);
    return row;
  }

  confirmReset() {
    const body = document.createElement("p");
    body.className = "challenge-question";
    body.textContent = "سيُحذف تقدم اللعبة والبناء والعملات والموارد المحفوظة على هذا الجهاز. لن تتأثر مهامك الدراسية أو إعدادات موقع مهامي. هل تريد المتابعة؟";
    this.hud.modal("إعادة تعيين عالم اللعبة؟", "هذا الإجراء لا يمكن التراجع عنه.", body, [
      this.hud.button("نعم، أعد التعيين", () => this.callbacks.reset(), true),
      this.hud.button("إلغاء", () => this.settings())
    ]);
  }

  inventory() {
    const body = makeSection("inventory-grid");
    Object.entries(BLOCKS).forEach(([type, block]) => {
      const row = makeSection("inventory-row");
      const label = document.createElement("span");
      label.textContent = `${block.icon} ${block.name}`;
      const amount = document.createElement("strong");
      amount.textContent = new Intl.NumberFormat("ar-SA").format(this.callbacks.inventory.count(type));
      row.append(label, amount); body.append(row);
    });
    this.hud.modal("حقيبة الموارد", "المكعب المحدد يظهر بإطار مضيء في شريط الأدوات.", body, [
      this.hud.button("إغلاق", () => this.hud.closeModal(), true)
    ]);
  }

  quests(definitions, questSystem) {
    const list = makeSection("quest-list");
    definitions.forEach(quest => {
      const row = makeSection("quest-row");
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = quest.title;
      const description = document.createElement("small");
      description.textContent = quest.description;
      info.append(title, description);
      const progress = document.createElement("span");
      const done = this.save.completedQuests.includes(quest.id);
      progress.className = "quest-progress";
      progress.textContent = done ? "✓ اكتملت" : `${new Intl.NumberFormat("ar-SA").format(Math.min(questSystem.progress(quest), quest.target))}/${new Intl.NumberFormat("ar-SA").format(quest.target)}`;
      row.append(info, progress); list.append(row);
    });
    this.hud.modal("دليل المغامرات", "أنجز مهام العالم واربح نقاطًا افتراضية.", list, [
      this.hud.button("متابعة اللعب", () => this.hud.closeModal(), true)
    ]);
  }

  study(summary, error) {
    const list = makeSection("study-list");
    const row = (label, value, detail = "") => {
      const item = makeSection("study-row");
      const name = document.createElement("div");
      const strong = document.createElement("strong"); strong.textContent = label;
      name.append(strong);
      if (detail) { const small = document.createElement("small"); small.textContent = detail; name.append(small); }
      const count = document.createElement("b"); count.textContent = value;
      item.append(name, count); list.append(item);
    };
    if (summary?.available) {
      row("المهام القادمة", new Intl.NumberFormat("ar-SA").format(summary.count), `الصف ${summary.grade} • الشعبة ${summary.section}`);
      row("الاختبارات القادمة", new Intl.NumberFormat("ar-SA").format(summary.exams));
      row("أقرب موعد", summary.nearest ? summary.nearest.title : "لا توجد مواعيد قادمة", summary.nearest ? `${summary.nearest.subject} • ${new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(summary.nearest.date)}` : "ستظهر المواعيد عند تحديث Google Sheets");
    } else {
      const note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = error || summary?.reason || "تعذر الوصول إلى المهام. تستمر اللعبة دون اتصال.";
      list.append(note);
    }
    this.hud.modal("مهامي الدراسية", "قراءة فقط من لوحة مهامي — تقدم اللعبة منفصل تمامًا.", list, [
      this.hud.button("تحديث البيانات", () => this.callbacks.openStudy(true), false),
      this.hud.button("العودة إلى لوحة مهامي", () => { location.href = "../"; }, true)
    ]);
  }

  challenge(question, subject, onComplete) {
    const body = makeSection("challenge-body");
    const meta = document.createElement("div");
    meta.className = "challenge-meta";
    const subjectLabel = document.createElement("span"); subjectLabel.textContent = subject || question.subject;
    const timerLabel = document.createElement("strong"); timerLabel.textContent = "٢٠ ث";
    meta.append(subjectLabel, timerLabel);
    const timer = document.createElement("div"); timer.className = "timer-bar";
    const timerFill = document.createElement("i"); timerFill.style.width = "100%"; timer.append(timerFill);
    const title = document.createElement("p"); title.className = "challenge-question"; title.textContent = question.question;
    const options = makeSection("option-grid");
    const feedback = document.createElement("p"); feedback.className = "feedback";
    body.append(meta, timer, title, options, feedback);
    let answer = null;
    let submitted = false;
    let order = [];
    const values = question.type === "order" ? question.items :
      question.type === "truefalse" ? ["صح", "خطأ"] : question.options;
    values.forEach((text, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "option-button"; button.textContent = text;
      button.addEventListener("click", () => {
        if (submitted) return;
        if (question.type === "truefalse") {
          answer = text === "صح";
          options.querySelectorAll("button").forEach(node => node.classList.remove("selected"));
          button.classList.add("selected");
        } else if (question.type === "order") {
          const current = order.indexOf(index);
          if (current >= 0) order.splice(current, 1);
          else order.push(index);
          button.classList.toggle("selected", order.includes(index));
          button.dataset.order = order.includes(index) ? String(order.indexOf(index) + 1) : "";
          button.textContent = order.includes(index) ? `${order.indexOf(index) + 1}. ${text}` : text;
          answer = [...order];
        } else {
          answer = index;
          options.querySelectorAll("button").forEach(node => node.classList.remove("selected"));
          button.classList.add("selected");
        }
      });
      options.append(button);
    });
    const started = Date.now();
    let timerId = 0;
    const finish = (timeout = false) => {
      if (submitted) return;
      submitted = true; window.clearInterval(timerId);
      const correct = !timeout && checkAnswer(question, answer);
      options.querySelectorAll("button").forEach((button, index) => {
        button.disabled = true;
        if (question.type === "multiple" || question.type === "logic" || question.type === "connect") {
          if (index === question.answer) button.classList.add("correct");
          else if (button.classList.contains("selected")) button.classList.add("wrong");
        }
      });
      feedback.textContent = correct ? `إجابة صحيحة! ${question.explanation}` :
        `${timeout ? "انتهى الوقت. " : "ليست هذه الإجابة. "}${question.explanation}`;
      const next = this.hud.button("متابعة", () => {
        this.hud.closeModal(); onComplete(correct, true);
      }, true);
      this.hud.modal(correct ? "أبدعت!" : "جولة جميلة!", "تذكّر المعلومة واستمتع بالمغامرة.", body, [next]);
    };
    const submit = this.hud.button("تحقق من الإجابة", () => finish(false), true);
    const cancel = this.hud.button("انسحاب", () => {
      window.clearInterval(timerId); this.hud.closeModal(); onComplete(false, false);
    });
    timerId = window.setInterval(() => {
      const remaining = Math.max(0, 20 - Math.floor((Date.now() - started) / 1000));
      timerLabel.textContent = `${new Intl.NumberFormat("ar-SA").format(remaining)} ث`;
      timerFill.style.width = `${remaining / 20 * 100}%`;
      if (!remaining) finish(true);
    }, 250);
    this.hud.modal("تحدي أكاديمية التحديات", "أجب قبل انتهاء الوقت لتحصل على مكافأة إضافية.", body, [submit, cancel], () => {
      window.clearInterval(timerId);
      if (!submitted) { submitted = true; onComplete(false, false); }
    });
  }
}
