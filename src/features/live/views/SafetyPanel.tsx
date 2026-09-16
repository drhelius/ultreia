import { useEffect, useState } from 'react';
import { Linking, Share, Text, TextInput, View } from 'react-native';
import type { ActiveJourney, CaminoService, UserProfile } from '../../../domain';
import type { Coordinates } from '../../../core';
import { staticCaminoDataRepository } from '../../../data/camino';
import { distanceKmBetween } from '../../../domain';
import { useLocalPersistence } from '../../../persistence';
import { Button, Chip } from '../../../ui/components';
import { liveStyles as styles, liveColors as colors } from '../liveStyles';

export function SafetyPanel({ journey, profile, position, simulated, onSelectService, onReportSaved }: {
  journey: ActiveJourney; profile: UserProfile; position?: Coordinates; simulated: boolean; onSelectService: (service: CaminoService) => void; onReportSaved: () => void;
}) {
  const persistence = useLocalPersistence();
  const [services, setServices] = useState<CaminoService[]>([]);
  const [confirmCall, setConfirmCall] = useState(false);
  const [category, setCategory] = useState('Estado del camino');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let disposed = false;
    if (journey.activeStageSlug) void staticCaminoDataRepository.getServicesByStage(journey.activeStageSlug, ['farmacia', 'centro_salud']).then((items) => {
      if (!disposed) setServices(items.sort((left, right) => (position && left.coordinate ? distanceKmBetween(position, left.coordinate) : Infinity) - (position && right.coordinate ? distanceKmBetween(position, right.coordinate) : Infinity)));
    });
    return () => { disposed = true; };
  }, [journey.activeStageSlug, position?.latitude, position?.longitude]);
  const saveReport = async () => {
    if (!persistence.repositories || !journey.activeStageSlug || !note.trim() || saving) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      await persistence.repositories.journalRepository.saveEntry({ id: `incident:${Date.now()}`, journeyId: journey.id, stageSlug: journey.activeStageSlug, dateIso: nowIso, status: 'saved', kind: 'incident', incidentType: category, title: `Aviso local: ${category}`, body: `${simulated ? 'Simulacion. ' : ''}${note.trim()}\nReporte local, no enviado a servicios de emergencia.`, coordinates: position, evidence: { sourceType: 'user_input', sourceId: profile.id, confidence: 'baja', generatedAtIso: nowIso, simulated }, updatedAtIso: nowIso });
      await persistence.repositories.progressionRepository.saveAchievementState({ id: `achievement:${profile.id}:buen-companero`, userId: profile.id, achievementId: 'achievement:buen-companero', progress: 1, unlockedAtIso: nowIso });
      setStatus('Reporte guardado en tu diario local. No se ha enviado a emergencias.'); setNote(''); onReportSaved();
    } catch { setStatus('No se pudo guardar el reporte.'); }
    finally { setSaving(false); }
  };
  return <View style={{ gap: 14 }}>
    <Text style={styles.title}>Camino seguro</Text>
    <Text style={styles.text}>{position ? `${simulated ? 'Posicion simulada' : 'Ultima posicion GPS'}: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Ubicacion no disponible'}</Text>
    <Button variant="danger" onPress={() => setConfirmCall(true)}>Emergencias 112</Button>
    {confirmCall ? <View style={{ gap: 10 }}><Text style={styles.error}>Se abrira una llamada real al 112. No llames durante la demostracion.</Text><Button variant="danger" onPress={() => void Linking.openURL('tel:112').catch(() => setStatus('Este dispositivo no puede llamar. Marca 112 desde un telefono.'))}>Confirmar llamada real</Button><Button variant="secondary" onPress={() => setConfirmCall(false)}>Cancelar llamada</Button></View> : null}
    <Button variant="secondary" disabled={!position} onPress={() => { if (position) void Share.share({ message: `${simulated ? 'DEMOSTRACION: posicion simulada, no es una emergencia. ' : 'Mi ultima posicion en el Camino: '}https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}` }).catch(() => setStatus('No se pudo abrir el selector de compartir.')); }}>Compartir posicion con un contacto</Button>
    <Text style={styles.heading}>Salud en esta etapa</Text>
    {services.slice(0, 5).map((service) => <Button key={service.id} variant="secondary" onPress={() => onSelectService(service)}>{service.title}</Button>)}
    {!services.length ? <Text style={styles.muted}>No hay centros de salud o farmacias registrados para esta etapa.</Text> : null}
    <Text style={styles.heading}>Registrar incidencia local</Text>
    <View style={styles.row}>{['Estado del camino', 'Fuente sin agua', 'Cierre', 'Obras'].map((item) => <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />)}</View>
    <TextInput accessibilityLabel="Detalle de incidencia" value={note} onChangeText={setNote} placeholder="Que has observado?" placeholderTextColor={colors.muted} style={styles.input} multiline />
    <Button disabled={!note.trim() || saving} onPress={() => void saveReport()}>Guardar reporte local</Button>
    {status ? <Text accessibilityLiveRegion="polite" style={styles.text}>{status}</Text> : null}
  </View>;
}