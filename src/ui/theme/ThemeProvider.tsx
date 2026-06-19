import { createContext, type PropsWithChildren, useContext } from 'react';

import { appTheme, type AppTheme } from './theme';

const AppThemeContext = createContext<AppTheme>(appTheme);

export function AppThemeProvider({ children }: PropsWithChildren) {
  return <AppThemeContext.Provider value={appTheme}>{children}</AppThemeContext.Provider>;
}

export const useAppTheme = (): AppTheme => useContext(AppThemeContext);
