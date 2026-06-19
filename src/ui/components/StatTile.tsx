import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme';

type StatTileProps = {
  label: string;
  value: string;
};

export function StatTile({ label, value }: StatTileProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
      <Text style={[styles.value, { color: theme.colors.gold }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  tile: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
  },
});
