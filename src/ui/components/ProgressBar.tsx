import { StyleSheet, View, type DimensionValue } from 'react-native';

import { useAppTheme } from '../theme';

type ProgressBarProps = {
  progress: number;
  tone?: 'gold' | 'success';
};

export function ProgressBar({ progress, tone = 'gold' }: ProgressBarProps) {
  const theme = useAppTheme();
  const width = `${Math.max(0, Math.min(100, progress))}%` as DimensionValue;

  return (
    <View style={[styles.track, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.fill, { width, backgroundColor: tone === 'success' ? theme.colors.success : theme.colors.gold }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    borderRadius: 999,
    height: '100%',
  },
  track: {
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
});
