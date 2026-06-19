import * as SQLite from 'expo-sqlite';

import type { LocalAppDatabase, LocalDatabase, LocalMigration, LocalQueryParameter, LocalRunResult } from '../localDatabase';

type SQLiteRow = Record<string, unknown>;

export class SQLiteLocalAppDatabase implements LocalAppDatabase {
  private constructor(private readonly database: SQLite.SQLiteDatabase) {}

  static async open(databaseName = 'ultreia.db'): Promise<SQLiteLocalAppDatabase> {
    const database = await SQLite.openDatabaseAsync(databaseName);
    await database.execAsync('PRAGMA foreign_keys = ON;');

    return new SQLiteLocalAppDatabase(database);
  }

  async execute(statement: string): Promise<void> {
    await this.database.execAsync(statement);
  }

  async run(statement: string, parameters: readonly LocalQueryParameter[] = []): Promise<LocalRunResult> {
    const result = await this.database.runAsync(statement, [...parameters]);

    return {
      changes: result.changes,
      lastInsertRowId: result.lastInsertRowId,
    };
  }

  async getFirst<TRow extends SQLiteRow>(statement: string, parameters: readonly LocalQueryParameter[] = []): Promise<TRow | undefined> {
    const row = await this.database.getFirstAsync<TRow>(statement, [...parameters]);

    return row ?? undefined;
  }

  async getAll<TRow extends SQLiteRow>(statement: string, parameters: readonly LocalQueryParameter[] = []): Promise<TRow[]> {
    return this.database.getAllAsync<TRow>(statement, [...parameters]);
  }

  async currentVersion(): Promise<number> {
    const row = await this.getFirst<{ user_version: number }>('PRAGMA user_version;');

    return row?.user_version ?? 0;
  }

  async migrate(migrations: readonly LocalMigration[]): Promise<void> {
    const orderedMigrations = [...migrations].sort((left, right) => left.version - right.version);
    let currentVersion = await this.currentVersion();

    for (const migration of orderedMigrations) {
      if (migration.version <= currentVersion) {
        continue;
      }

      await migration.up(this);
      await this.execute(`PRAGMA user_version = ${migration.version};`);
      currentVersion = migration.version;
    }
  }

  async reset(): Promise<void> {
    const tables = await this.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';");

    await this.execute('PRAGMA foreign_keys = OFF;');
    for (const table of tables) {
      await this.execute(`DROP TABLE IF EXISTS ${table.name};`);
    }
    await this.execute('PRAGMA user_version = 0;');
    await this.execute('PRAGMA foreign_keys = ON;');
  }

  async close(): Promise<void> {
    await this.database.closeAsync();
  }
}

export type { LocalDatabase };
