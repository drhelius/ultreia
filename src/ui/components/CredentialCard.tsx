import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useAppTheme } from '../theme';
import { Button } from './Button';

type CredentialCardProps = {
  pilgrimName: string;
  caminoTitle: string;
  stamps: number;
  onOpen: () => void;
  totalStamps?: number;
};

export function CredentialCard({ pilgrimName, caminoTitle, stamps, onOpen, totalStamps = 5 }: CredentialCardProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.goldDark }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>{pilgrimName}</Text>
          <Text style={[styles.camino, { color: theme.colors.textMuted }]}>{caminoTitle}</Text>
        </View>
        <View style={[styles.qr, { borderColor: theme.colors.gold }]}>
          <QRCode value={JSON.stringify({ app: 'Ultreia', pilgrim: pilgrimName, camino: caminoTitle, type: 'local-credential' })} size={52} quietZone={3} />
        </View>
      </View>
      <Text style={[styles.stamps, { color: theme.colors.textMuted }]}>Etapas registradas: {stamps} / {totalStamps}</Text>
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
