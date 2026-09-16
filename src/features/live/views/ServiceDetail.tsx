import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import type { CaminoService } from '../../../domain';
import { Button } from '../../../ui/components';
import { liveStyles as styles } from '../liveStyles';

export function ServiceDetail({ service, onClose }: { service: CaminoService; onClose: () => void }) {
  const [error, setError] = useState<string>();
  const open = (url: string) => void Linking.openURL(url).catch(() => setError('No se pudo abrir la aplicacion.'));
  const osm = service.tags.includes('openstreetmap');
  return <View style={styles.section}>
    <Text style={styles.title}>{service.title}</Text>
    <Text style={styles.heading}>{service.type.replaceAll('_', ' ')}</Text>
    <Text style={styles.text}>{service.address || 'Direccion no registrada'}</Text>
    <Text style={styles.text}>{service.openingHoursText || 'Sin horario confirmado'}</Text>
    <Text style={styles.muted}>Disponibilidad no confirmada. {osm ? 'Datos de OpenStreetMap.' : 'Catalogo precargado de Ultreia.'}</Text>
    {service.phone ? <Button onPress={() => open(`tel:${service.phone!.replace(/[^+\d]/g, '')}`)}>Llamar: {service.phone}</Button> : null}
    {service.coordinate ? <Button variant="secondary" onPress={() => open(`https://www.google.com/maps/dir/?api=1&destination=${service.coordinate!.latitude},${service.coordinate!.longitude}&travelmode=walking`)}>Como llegar</Button> : null}
    {osm && service.geocoding?.providerUrl ? <Button variant="secondary" onPress={() => open(service.geocoding!.providerUrl!)}>Ver fuente OpenStreetMap</Button> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button variant="secondary" onPress={onClose}>Cerrar</Button>
  </View>;
}