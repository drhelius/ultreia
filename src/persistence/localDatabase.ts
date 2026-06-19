export type LocalQueryParameter = string | number | boolean | null;

export type LocalRunResult = {
  changes: number;
  lastInsertRowId?: number;
};

export type LocalDatabase = {
  execute(statement: string): Promise<void>;
  run(statement: string, parameters?: readonly LocalQueryParameter[]): Promise<LocalRunResult>;
  getFirst<TRow extends Record<string, unknown>>(statement: string, parameters?: readonly LocalQueryParameter[]): Promise<TRow | undefined>;
  getAll<TRow extends Record<string, unknown>>(statement: string, parameters?: readonly LocalQueryParameter[]): Promise<TRow[]>;
};

export type LocalMigration = {
  version: number;
  name: string;
  up: (database: LocalDatabase) => Promise<void>;
};

export type LocalAppDatabase = LocalDatabase & {
  currentVersion(): Promise<number>;
  migrate(migrations: readonly LocalMigration[]): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
};
