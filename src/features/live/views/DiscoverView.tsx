import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { staticCaminoDataRepository } from '../../../data/camino';
import type { CaminoService } from '../../../domain';
import { Chip, ServiceListItem, Surface } from '../../../ui/components';

type DiscoverViewProps = { stageSlug?: string };

export function DiscoverView({ stageSlug }: DiscoverViewProps) {
  const [filter, setFilter] = useState<'todos' | CaminoService['type']>('todos');
  const [services, setServices] = useState<CaminoService[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!stageSlug) return;
      const nextServices = await staticCaminoDataRepository.getServicesByStage(stageSlug);
      if (mounted) setServices(nextServices);
    };
    void load();
    return () => { mounted = false; };
  }, [stageSlug]);

  const visible = filter === 'todos' ? services : services.filter((service) => service.type === filter);

  return (
    <Surface>
      <Text style={styles.title}>Descubrir</Text>
      <View style={styles.filters}>
        <Chip label="Todos" active={filter === 'todos'} onPress={() => setFilter('todos')} />
        <Chip label="Albergues" active={filter === 'albergue'} onPress={() => setFilter('albergue')} />
        <Chip label="Patrimonio" active={filter === 'monumento'} onPress={() => setFilter('monumento')} />
        <Chip label="Salud" active={filter === 'farmacia'} onPress={() => setFilter('farmacia')} />
      </View>
      <View style={styles.list}>
        {visible.length === 0 ? <Text style={styles.empty}>No hay servicios de este tipo para la etapa activa.</Text> : null}
        {visible.slice(0, 20).map((service) => (
          <ServiceListItem key={service.id} title={service.title} type={service.type} meta={`${service.type}${service.coordinateStatus === 'verified' ? ' · coordenada verificada' : ''}`} />
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  empty: { color: '#A9B7B7', fontSize: 14, lineHeight: 20 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  list: { gap: 12 },
  title: { color: '#F4B321', fontSize: 22, fontWeight: '900', marginBottom: 12 },
});
