import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '../theme';

type ButtonProps = PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}>;

export function Button({ children, onPress, disabled = false, variant = 'primary' }: ButtonProps) {
  const theme = useAppTheme();
  const backgroundColor = variant === 'primary' ? theme.colors.gold : variant === 'danger' ? theme.colors.warning : theme.colors.surfaceMuted;
  const color = variant === 'primary' || variant === 'danger' ? theme.colors.background : theme.colors.text;

  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.button, { backgroundColor, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.text, { color }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '900',
  },
});
