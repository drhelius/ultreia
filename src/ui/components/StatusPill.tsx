import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme';

export type StatusPillProps = {
  label: string;
  tone?: 'gold' | 'success' | 'warning';
};

export function StatusPill({ label, tone = 'gold' }: StatusPillProps) {
  const theme = useAppTheme();
  const backgroundColor = tone === 'success' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : theme.colors.gold;

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#071923',
    fontSize: 12,
    fontWeight: '800',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
