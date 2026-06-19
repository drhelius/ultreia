import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme';
import { Button } from './Button';

type CredentialCardProps = {
  pilgrimName: string;
  caminoTitle: string;
  stamps: number;
  onOpen: () => void;
};

export function CredentialCard({ pilgrimName, caminoTitle, stamps, onOpen }: CredentialCardProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.goldDark }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.name, { color: theme.colors.text }]}>{pilgrimName}</Text>
          <Text style={[styles.camino, { color: theme.colors.textMuted }]}>{caminoTitle}</Text>
        </View>
        <View style={[styles.qr, { borderColor: theme.colors.gold }]}>
          <Text style={[styles.qrText, { color: theme.colors.text }]}>QR</Text>
        </View>
      </View>
      <Text style={[styles.stamps, { color: theme.colors.textMuted }]}>Sellos: {stamps} / 29</Text>
      <Button onPress={onOpen}>Ver credencial</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  camino: {
    fontSize: 13,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 18,
    fontWeight: '900',
  },
  qr: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  qrText: {
    fontWeight: '900',
  },
  stamps: {
    fontSize: 13,
    fontWeight: '700',
  },
});
