import type { PropsWithChildren } from 'react';

import { LocalPersistenceProvider } from '../persistence';
import { AppThemeProvider } from '../ui/theme';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppThemeProvider>
      <LocalPersistenceProvider>{children}</LocalPersistenceProvider>
    </AppThemeProvider>
  );
}
