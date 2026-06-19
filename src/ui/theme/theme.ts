import { colors } from './colors';

export const appTheme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
  },
  typography: {
    title: 30,
    heading: 22,
    body: 15,
    small: 13,
  },
} as const;

export type AppTheme = typeof appTheme;
