export class Quests {
  constructor(save, definitions, rewards) {
    this.save = save;
    this.definitions = definitions;
    this.rewards = rewards;
  }

  progress(quest) {
    if (quest.kind === "collect") return Number(this.save.questStats.collected[quest.resource]) || 0;
    if (quest.kind === "build") return this.save.questStats.builtBlocks;
    if (quest.kind === "answers") return Number(this.save.correctAnswers) || 0;
    if (quest.kind === "chest") return this.save.foundChest ? 1 : 0;
    if (quest.kind === "challenge") return Number(this.save.completedChallenges) || 0;
    return 0;
  }

  completeReady() {
    const justCompleted = [];
    this.definitions.forEach(quest => {
      if (this.save.completedQuests.includes(quest.id) || this.progress(quest) < quest.target) return;
      this.save.completedQuests.push(quest.id);
      justCompleted.push(quest);
      this.rewards.add({ xp: quest.xp, coins: quest.coins, message: `اكتملت مهمة «${quest.title}»` });
    });
    return justCompleted;
  }
}
