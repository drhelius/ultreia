import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme';

type BadgeProps = {
  title: string;
  subtitle?: string;
  locked?: boolean;
};

export function Badge({ title, subtitle, locked = false }: BadgeProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.badge, { borderColor: locked ? theme.colors.border : theme.colors.gold, opacity: locked ? 0.55 : 1 }]}>
      <Text style={styles.symbol}>{locked ? '·' : '*'}</Text>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    minWidth: 92,
    padding: 10,
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  symbol: {
    color: '#F4B321',
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
});
