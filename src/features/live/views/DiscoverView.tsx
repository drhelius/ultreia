import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BedDouble, Droplets, Cross, Utensils, Landmark, MapPin, ChevronRight } from 'lucide-react-native';

import { staticCaminoDataRepository } from '../../../data/camino';
import type { CaminoService } from '../../../domain';
import { Button, Chip } from '../../../ui/components';
import type { Coordinates } from '../../../core';
import { distanceKmBetween } from '../../../domain';
import { liveStyles as styles, liveColors as colors } from '../liveStyles';

type DiscoverViewProps = { stageSlug?: string; position?: Coordinates; onSelectService?: (service: CaminoService) => void };

export function DiscoverView({ stageSlug, position, onSelectService }: DiscoverViewProps) {
  const [filter, setFilter] = useState('todos');
  const [services, setServices] = useState<CaminoService[]>([]);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setServices([]); setLimit(30); setLoading(true); setError(undefined);
      try {
        const nextServices = stageSlug ? await staticCaminoDataRepository.getServicesByStage(stageSlug) : [];
        if (mounted) setServices(nextServices);
      } catch { if (mounted) setError('No se pudieron cargar los servicios.'); }
      finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [stageSlug]);

  const groups: Record<string, string[]> = { dormir: ['albergue'], agua: ['fuente'], salud: ['farmacia', 'centro_salud'], comida: ['restaurante', 'bar', 'supermercado'], cultura: ['monumento'], servicios: ['cajero', 'taller_bici', 'oficina_turismo', 'transporte'] };
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = services.filter((service) => (filter === 'todos' || groups[filter]?.includes(service.type)) && normalize(service.title).includes(normalize(query))).map((service) => ({ service, distance: position && service.coordinate ? distanceKmBetween(position, service.coordinate) : undefined })).sort((left, right) => (left.distance ?? Infinity) - (right.distance ?? Infinity));

  return (
    <View style={styles.section}>
      <TextInput accessibilityLabel="Buscar servicios" placeholder="Buscar en esta etapa" placeholderTextColor={colors.muted} value={query} onChangeText={(value) => { setQuery(value); setLimit(30); }} style={styles.input} />
      <View style={styles.row}>
        {['todos', ...Object.keys(groups)].map((id) => <Chip key={id} label={{ todos: 'Todo', dormir: 'Dormir', agua: 'Agua', salud: 'Salud', comida: 'Comida', cultura: 'Cultura', servicios: 'Servicios' }[id]!} active={filter === id} onPress={() => { setFilter(id); setLimit(30); }} />)}
      </View>
      <Text style={styles.muted}>{loading ? 'Cargando servicios...' : `${visible.length} lugares en esta etapa`}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && visible.length === 0 ? <Text style={styles.text}>No hay lugares que coincidan con esta busqueda.</Text> : null}
      {visible.slice(0, limit).map(({ service, distance }) => {
        const Icon = service.type === 'albergue' ? BedDouble : service.type === 'fuente' ? Droplets : ['farmacia', 'centro_salud'].includes(service.type) ? Cross : service.type === 'monumento' ? Landmark : ['bar', 'restaurante'].includes(service.type) ? Utensils : MapPin;
        const color = service.type === 'fuente' ? '#4BA6E4' : ['farmacia', 'centro_salud'].includes(service.type) ? colors.green : service.type === 'monumento' ? colors.gold : '#C3A0DF';
        return <Pressable key={service.id} accessibilityRole="button" accessibilityLabel={`Ver ${service.title}`} onPress={() => onSelectService?.(service)} style={[styles.item, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <View style={[styles.icon, { borderRadius: 22 }]}><Icon color={color} size={22} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.text}>{service.title}</Text><Text style={styles.muted}>{service.type.replaceAll('_', ' ')}{distance !== undefined ? ` · ${distance.toFixed(1)} km en linea recta` : ''}</Text><Text style={styles.muted}>{service.openingHoursText ? 'Horario registrado' : 'Sin horario confirmado'}</Text></View><ChevronRight size={18} color={colors.muted} />
        </Pressable>;
      })}
      {visible.length > limit ? <Button variant="secondary" onPress={() => setLimit(limit + 30)}>Ver mas lugares</Button> : null}
      <Text style={styles.muted}>Catalogo local y OpenStreetMap. Horarios y disponibilidad sujetos a confirmacion.</Text>
    </View>
  );
}
