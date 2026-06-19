import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme';

type ServiceListItemProps = {
  title: string;
  meta: string;
  type: string;
};

export function ServiceListItem({ title, meta, type }: ServiceListItemProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: type === 'monumento' ? theme.colors.goldDark : theme.colors.purple }]}>
        <Text style={[styles.iconText, { color: theme.colors.text }]}>{type.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{meta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 4,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconText: {
    fontSize: 13,
    fontWeight: '900',
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  meta: {
    fontSize: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
});
