import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { createSQLiteRepositories, localMigrations, SQLiteLocalAppDatabase, type SQLiteRepositories } from './sqlite';

export type LocalPersistenceContextValue = {
  ready: boolean;
  schemaVersion?: number;
  database?: SQLiteLocalAppDatabase;
  repositories?: SQLiteRepositories;
  error?: string;
  resetLocalState: () => Promise<void>;
};

const LocalPersistenceContext = createContext<LocalPersistenceContextValue | undefined>(undefined);

export function LocalPersistenceProvider({ children }: PropsWithChildren) {
  const [database, setDatabase] = useState<SQLiteLocalAppDatabase>();
  const [schemaVersion, setSchemaVersion] = useState<number>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let openedDatabase: SQLiteLocalAppDatabase | undefined;

    const initialize = async () => {
      try {
        openedDatabase = await SQLiteLocalAppDatabase.open();
        await openedDatabase.migrate(localMigrations);
        const version = await openedDatabase.currentVersion();
        if (!disposed) {
          setDatabase(openedDatabase);
          setSchemaVersion(version);
        }
      } catch (currentError) {
        if (!disposed) setError(currentError instanceof Error ? currentError.message : 'Error inicializando la base local');
      }
    };

    void initialize();

    return () => {
      disposed = true;
      void openedDatabase?.close();
    };
  }, []);

  const repositories = useMemo(() => (database ? createSQLiteRepositories(database) : undefined), [database]);

  const value = useMemo<LocalPersistenceContextValue>(() => ({
    ready: Boolean(database && repositories && !error),
    schemaVersion,
    database,
    repositories,
    error,
    resetLocalState: async () => {
      if (!database) return;
      await database.reset();
      await database.migrate(localMigrations);
      setSchemaVersion(await database.currentVersion());
    },
  }), [database, error, repositories, schemaVersion]);

  return <LocalPersistenceContext.Provider value={value}>{children}</LocalPersistenceContext.Provider>;
}

export const useLocalPersistence = (): LocalPersistenceContextValue => {
  const value = useContext(LocalPersistenceContext);
  if (!value) throw new Error('useLocalPersistence must be used inside LocalPersistenceProvider');
  return value;
};
