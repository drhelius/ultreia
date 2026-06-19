import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import { createMemoryRepositories, type MemoryRepositories } from './memory/MemoryRepositories';

export type LocalPersistenceContextValue = {
  ready: boolean;
  schemaVersion?: number;
  repositories?: MemoryRepositories;
  error?: string;
  resetLocalState: () => Promise<void>;
};

const LocalPersistenceContext = createContext<LocalPersistenceContextValue | undefined>(undefined);

export function LocalPersistenceProvider({ children }: PropsWithChildren) {
  const [version, setVersion] = useState(1);
  const repositories = useMemo(() => createMemoryRepositories(), [version]);
  const value = useMemo<LocalPersistenceContextValue>(() => ({
    ready: true,
    schemaVersion: 1,
    repositories,
    resetLocalState: async () => setVersion((current) => current + 1),
  }), [repositories]);

  return <LocalPersistenceContext.Provider value={value}>{children}</LocalPersistenceContext.Provider>;
}

export const useLocalPersistence = (): LocalPersistenceContextValue => {
  const value = useContext(LocalPersistenceContext);
  if (!value) throw new Error('useLocalPersistence must be used inside LocalPersistenceProvider');
  return value;
};
