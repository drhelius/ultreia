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
  const [error, setError] = useState<string>();
  const repositories = useMemo(() => {
    try { return createMemoryRepositories(typeof window !== 'undefined' ? window.localStorage : undefined); }
    catch { return undefined; }
  }, [version]);
  const value = useMemo<LocalPersistenceContextValue>(() => ({
    ready: Boolean(repositories),
    error: repositories ? error : 'No se pudo abrir el almacenamiento del navegador. Comprueba que permite guardar datos locales.',
    schemaVersion: 1,
    repositories,
    resetLocalState: async () => { window.localStorage.removeItem('ultreia:local-state:v1'); setError(undefined); setVersion((current) => current + 1); },
  }), [repositories]);

  return <LocalPersistenceContext.Provider value={value}>{children}</LocalPersistenceContext.Provider>;
}

export const useLocalPersistence = (): LocalPersistenceContextValue => {
  const value = useContext(LocalPersistenceContext);
  if (!value) throw new Error('useLocalPersistence must be used inside LocalPersistenceProvider');
  return value;
};
