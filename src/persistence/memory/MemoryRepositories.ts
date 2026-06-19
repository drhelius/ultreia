import type {
  AchievementState,
  ActiveJourney,
  CampaignPlan,
  ChatMessage,
  ChatThread,
  CollectibleState,
  DecisionCycle,
  DecisionRecommendation,
  ExpenseEntry,
  JournalEntry,
  QuestState,
  StageProgress,
  TrackingSample,
  TrackingSession,
  UserPreferences,
  UserProfile,
} from '../../domain';
import type {
  ChatRepository,
  DecisionStateRepository,
  ExpenseRepository,
  JournalRepository,
  JourneyRepository,
  ProgressionRepository,
  TrackingRepository,
  UserProfileRepository,
} from '../../repositories';

const createId = (scope: string) => `${scope}:${Date.now()}`;

class MemoryUserProfileRepository implements UserProfileRepository {
  private profile?: UserProfile;
  private preferences = new Map<string, UserPreferences>();

  async getProfile() { return this.profile; }
  async saveProfile(profile: UserProfile) { this.profile = profile; }
  async getPreferences(userId: string) { return this.preferences.get(userId); }
  async savePreferences(preferences: UserPreferences) { this.preferences.set(preferences.userId, preferences); }
  async clearUserState() { this.profile = undefined; this.preferences.clear(); }
}

class MemoryJourneyRepository implements JourneyRepository {
  private activeJourney?: ActiveJourney;
  private campaigns = new Map<string, CampaignPlan>();
  private progress = new Map<string, StageProgress>();

  async getActiveJourney() { return this.activeJourney; }
  async saveActiveJourney(journey: ActiveJourney) { this.activeJourney = journey; }
  async saveSelectedCampaign(campaign: CampaignPlan) { this.campaigns.set(campaign.id, campaign); }
  async getSelectedCampaign(campaignId: string) { return this.campaigns.get(campaignId); }
  async getStageProgress(journeyId: string) { return [...this.progress.values()].filter((item) => item.journeyId === journeyId); }
  async saveStageProgress(progress: StageProgress) { this.progress.set(`${progress.journeyId}:${progress.stageSlug}`, progress); }
}

class MemoryTrackingRepository implements TrackingRepository {
  private sessions = new Map<string, TrackingSession>();
  private samples = new Map<string, TrackingSample[]>();

  async saveSession(session: TrackingSession) { this.sessions.set(session.id, session); }
  async getActiveSession(journeyId: string) { return [...this.sessions.values()].find((session) => session.journeyId === journeyId && (session.status === 'active' || session.status === 'paused')); }
  async completeSession(sessionId: string, endedAtIso: string) {
    const session = this.sessions.get(sessionId);
    if (session) this.sessions.set(sessionId, { ...session, status: 'completed', endedAtIso });
  }
  async addSample(sample: TrackingSample) { this.samples.set(sample.sessionId, [...(this.samples.get(sample.sessionId) ?? []), sample]); }
  async getSamples(sessionId: string) { return this.samples.get(sessionId) ?? []; }
}

class MemoryDecisionStateRepository implements DecisionStateRepository {
  private cycles: DecisionCycle[] = [];
  private history: DecisionRecommendation[] = [];

  async getLastCycle() { return this.cycles.at(-1); }
  async saveCycle(cycle: DecisionCycle) { this.cycles.push(cycle); }
  async getNotificationHistory() { return this.history; }
  async markRecommendationShown(recommendation: DecisionRecommendation) { this.history.push(recommendation); }
  async clearDecisionState() { this.cycles = []; this.history = []; }
}

class MemoryJournalRepository implements JournalRepository {
  private entries = new Map<string, JournalEntry>();

  async saveEntry(entry: JournalEntry) { this.entries.set(entry.id, entry); }
  async getEntry(entryId: string) { return this.entries.get(entryId); }
  async getEntriesByJourney(journeyId: string) { return [...this.entries.values()].filter((entry) => entry.journeyId === journeyId); }
}

class MemoryExpenseRepository implements ExpenseRepository {
  private entries = new Map<string, ExpenseEntry>();

  async saveExpense(entry: ExpenseEntry) { this.entries.set(entry.id, entry); }
  async getExpensesByJourney(journeyId: string) { return [...this.entries.values()].filter((entry) => entry.journeyId === journeyId); }
  async deleteExpense(expenseId: string) { this.entries.delete(expenseId); }
}

class MemoryProgressionRepository implements ProgressionRepository {
  private questStates = new Map<string, QuestState>();
  private achievementStates = new Map<string, AchievementState>();
  private collectibleStates = new Map<string, CollectibleState>();

  async saveQuestState(state: QuestState) { this.questStates.set(state.id, state); }
  async getQuestStates(journeyId: string) { return [...this.questStates.values()].filter((state) => state.journeyId === journeyId); }
  async saveAchievementState(state: AchievementState) { this.achievementStates.set(state.id, state); }
  async getAchievementStates(userId: string) { return [...this.achievementStates.values()].filter((state) => state.userId === userId); }
  async saveCollectibleState(state: CollectibleState) { this.collectibleStates.set(state.id, state); }
  async getCollectibleStates(userId: string) { return [...this.collectibleStates.values()].filter((state) => state.userId === userId); }
}

class MemoryChatRepository implements ChatRepository {
  private threads = new Map<string, ChatThread>();
  private messages = new Map<string, ChatMessage[]>();

  async getOrCreateThread(userId: string, title: string) {
    const existing = [...this.threads.values()].find((thread) => thread.userId === userId);
    if (existing) return existing;
    const nowIso = new Date().toISOString();
    const thread = { id: createId('chat-thread'), userId, title, createdAtIso: nowIso, updatedAtIso: nowIso };
    this.threads.set(thread.id, thread);
    return thread;
  }
  async getThread(threadId: string) { return this.threads.get(threadId); }
  async getMessages(threadId: string) { return this.messages.get(threadId) ?? []; }
  async saveMessage(message: ChatMessage) { this.messages.set(message.threadId, [...(this.messages.get(message.threadId) ?? []), message]); }
  async clearThread(threadId: string) { this.messages.set(threadId, []); }
}

export const createMemoryRepositories = () => ({
  userProfileRepository: new MemoryUserProfileRepository(),
  journeyRepository: new MemoryJourneyRepository(),
  trackingRepository: new MemoryTrackingRepository(),
  decisionStateRepository: new MemoryDecisionStateRepository(),
  journalRepository: new MemoryJournalRepository(),
  expenseRepository: new MemoryExpenseRepository(),
  progressionRepository: new MemoryProgressionRepository(),
  chatRepository: new MemoryChatRepository(),
});

export type MemoryRepositories = ReturnType<typeof createMemoryRepositories>;
