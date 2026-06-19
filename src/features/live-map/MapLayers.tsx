import { StyleSheet, Text, View } from 'react-native';

import type { NearbyEntity } from '../../domain';

type MapLayersProps = {
  nearby: NearbyEntity[];
};

export function MapLayers({ nearby }: MapLayersProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>POIs cercanos verificados</Text>
      {nearby.length === 0 ? <Text style={styles.empty}>Registra ubicacion para detectar servicios y patrimonio cercano.</Text> : null}
      {nearby.map((entity) => (
        <View key={entity.id} style={styles.item}>
          <Text style={styles.itemTitle}>{entity.title}</Text>
          <Text style={styles.itemMeta}>{entity.type} · {entity.distanceKm.toFixed(2)} km</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#102A36',
    borderColor: '#25485A',
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  empty: {
    color: '#A9B7B7',
    fontSize: 13,
    lineHeight: 19,
  },
  item: {
    borderTopColor: '#25485A',
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  itemMeta: {
    color: '#A9B7B7',
    fontSize: 12,
  },
  itemTitle: {
    color: '#F4F0E8',
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: '#F4B321',
    fontSize: 18,
    fontWeight: '900',
  },
});
