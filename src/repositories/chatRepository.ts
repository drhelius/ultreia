import type { ChatMessage, ChatThread } from '../domain';

export type ChatRepository = {
  getOrCreateThread(userId: string, title: string): Promise<ChatThread>;
  getThread(threadId: string): Promise<ChatThread | undefined>;
  getMessages(threadId: string): Promise<ChatMessage[]>;
  saveMessage(message: ChatMessage): Promise<void>;
  clearThread(threadId: string): Promise<void>;
};
