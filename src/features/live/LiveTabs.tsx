import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Footprints, Map, Compass, BookOpen, UserRound } from 'lucide-react-native';

import { useAppTheme, type AppTheme } from '../../ui/theme';

export type LiveTabId = 'mi-camino' | 'mapa' | 'descubrir' | 'diario' | 'perfil';

const tabs: Array<{ id: LiveTabId; label: string }> = [
  { id: 'mi-camino', label: 'Mi Camino' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'descubrir', label: 'Descubrir' },
  { id: 'diario', label: 'Diario' },
  { id: 'perfil', label: 'Perfil' },
];
const tabIcons = { 'mi-camino': Footprints, mapa: Map, descubrir: Compass, diario: BookOpen, perfil: UserRound };

type LiveTabsProps = {
  activeTab: LiveTabId;
  onChange: (tab: LiveTabId) => void;
};

export function LiveTabs({ activeTab, onChange }: LiveTabsProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        const Icon = tabIcons[tab.id];
        return (
          <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }} style={styles.tab} onPress={() => onChange(tab.id)}>
            <Icon size={22} color={active ? theme.colors.gold : theme.colors.textMuted} />
            <Text style={[styles.label, { color: active ? theme.colors.gold : theme.colors.textMuted }]} numberOfLines={1}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const useLiveTabState = () => useState<LiveTabId>('mi-camino');

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 8,
  },
  icon: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
});
