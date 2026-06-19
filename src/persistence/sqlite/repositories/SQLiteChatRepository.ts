import type { ChatMessage, ChatThread } from '../../../domain';
import type { ChatRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, toJson } from '../sqliteSerialization';

type PayloadRow = { payload_json: string };

const createId = (scope: string): string => `${scope}:${Date.now()}`;

export class SQLiteChatRepository implements ChatRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getOrCreateThread(userId: string, title: string): Promise<ChatThread> {
    const existing = await this.database.getFirst<PayloadRow>('SELECT payload_json FROM chat_threads WHERE user_id = ? ORDER BY updated_at_iso DESC LIMIT 1;', [userId]);

    if (existing) {
      return fromJson<ChatThread>(existing.payload_json);
    }

    const nowIso = new Date().toISOString();
    const thread: ChatThread = {
      id: createId('chat-thread'),
      userId,
      title,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    await this.database.run(
      `INSERT OR REPLACE INTO chat_threads (id, user_id, title, created_at_iso, updated_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [thread.id, thread.userId, thread.title, thread.createdAtIso, thread.updatedAtIso, toJson(thread)],
    );

    return thread;
  }

  async getThread(threadId: string): Promise<ChatThread | undefined> {
    const row = await this.database.getFirst<PayloadRow>('SELECT payload_json FROM chat_threads WHERE id = ?;', [threadId]);

    return row ? fromJson<ChatThread>(row.payload_json) : undefined;
  }

  async getMessages(threadId: string): Promise<ChatMessage[]> {
    const rows = await this.database.getAll<PayloadRow>('SELECT payload_json FROM chat_messages WHERE thread_id = ? ORDER BY created_at_iso ASC;', [threadId]);

    return rows.map((row) => fromJson<ChatMessage>(row.payload_json));
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO chat_messages (id, thread_id, role, body, created_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [message.id, message.threadId, message.role, message.body, message.createdAtIso, toJson(message)],
    );
    await this.database.run('UPDATE chat_threads SET updated_at_iso = ? WHERE id = ?;', [message.createdAtIso, message.threadId]);
  }

  async clearThread(threadId: string): Promise<void> {
    await this.database.run('DELETE FROM chat_messages WHERE thread_id = ?;', [threadId]);
  }
}
