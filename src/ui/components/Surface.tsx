import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '../theme';

export type SurfaceProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Surface({ children, style }: SurfaceProps) {
  const theme = useAppTheme();

  return <View style={[styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
});
