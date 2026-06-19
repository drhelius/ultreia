export const colors = {
  background: '#071923',
  surface: '#102A36',
  surfaceMuted: '#17372F',
  border: '#25485A',
  gold: '#F4B321',
  goldDark: '#C88916',
  text: '#F4F0E8',
  textMuted: '#A9B7B7',
  success: '#39B86A',
  warning: '#F97316',
  danger: '#E05555',
  blue: '#3AA7D8',
  purple: '#8C5EE8',
} as const;

export type AppColorName = keyof typeof colors;
