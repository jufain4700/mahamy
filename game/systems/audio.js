export class GameAudio {
  constructor(save) {
    this.save = save;
    this.context = null;
  }

  play(kind = "collect") {
    if (!this.save.settings.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context ||= new AudioContext();
      if (this.context.state === "suspended") this.context.resume();
      const now = this.context.currentTime;
      const frequencies = { jump: 390, break: 180, collect: 640, correct: 780, chest: 920, place: 340, step: 145 };
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = kind === "break" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequencies[kind] || 500, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(90, (frequencies[kind] || 500) * 0.72), now + 0.11);
      gain.gain.setValueAtTime(kind === "step" ? 0.012 : 0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } catch (error) {
      console.warn("تعذر تشغيل المؤثر الصوتي.", error);
    }
  }
}
