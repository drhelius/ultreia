import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '../theme';

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function Chip({ label, active = false, onPress }: ChipProps) {
  const theme = useAppTheme();

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.chip, { backgroundColor: active ? theme.colors.gold : theme.colors.surfaceMuted, borderColor: active ? theme.colors.gold : theme.colors.border }]}>
      <Text style={[styles.label, { color: active ? theme.colors.background : theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
});
