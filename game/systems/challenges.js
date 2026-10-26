export async function loadQuestions() {
  const response = await fetch(new URL("../data/questions.json", import.meta.url));
  if (!response.ok) throw new Error("تعذر تحميل أسئلة الأكاديمية.");
  const data = await response.json();
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error("ملف الأسئلة فارغ أو غير صالح.");
  return data.questions;
}

export function pickQuestion(questions, subject = "") {
  const selected = questions.filter(question => question.subject === subject);
  const pool = selected.length ? selected : questions;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function checkAnswer(question, answer) {
  if (question.type === "order") {
    return Array.isArray(answer) && Array.isArray(question.answer) &&
      answer.length === question.answer.length && answer.every((value, index) => value === question.answer[index]);
  }
  return answer === question.answer;
}
