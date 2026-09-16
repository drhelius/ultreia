import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Play, Pause, SkipForward, FlaskConical, Sparkles } from 'lucide-react-native';

import type { CaminoStage } from '../../../domain';
import { Button, Chip, ProgressBar } from '../../../ui/components';
import { DecisionPanel, MapLayers, TrackingPanel, type DecisionEngineState, type LiveTrackingState } from '../../live-map';
import type { DecisionRecommendation } from '../../../domain';
import type { CaminoService, CampaignPlan } from '../../../domain';
import { staticCaminoDataRepository } from '../../../data/camino';
import { mapRepository } from '../../../data/camino/mapRepository';
import { completedRoute, positionOnRoute } from '../../../domain/tracking/routeGeometry';
import { MapCanvas } from '../../live-map/MapCanvas';
import type { MapItineraryStage } from '../../live-map/mapDocument';
import { liveStyles as styles, liveColors as colors } from '../liveStyles';

type MapTrackingViewProps = {
  activeStage?: CaminoStage;
  tracking: LiveTrackingState;
  decision: DecisionEngineState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onRecordSample: () => void;
  onRunDecision: () => void;
  onMarkDecisionShown: (recommendation: DecisionRecommendation) => void;
  onStartSimulation: () => void;
  onAdvanceSimulation: (percent: number) => void;
  simulationSpeed: number;
  onSimulationSpeed: (speed: number) => void;
  onSelectService: (service: CaminoService) => void;
  journeyCompleted: boolean;
  campaign: CampaignPlan;
  completedStageSlugs: string[];
};

export function MapTrackingView({ activeStage, tracking, decision, onStart, onPause, onResume, onComplete, onRunDecision, onStartSimulation, onAdvanceSimulation, simulationSpeed, onSimulationSpeed, onSelectService, journeyCompleted, campaign, completedStageSlugs }: MapTrackingViewProps) {
  const [services, setServices] = useState<CaminoService[]>([]);
  const [campaignStages, setCampaignStages] = useState<CaminoStage[]>([]);
  const [layer, setLayer] = useState('todos');
  const [simulator, setSimulator] = useState(false);
  const geometry = activeStage ? mapRepository.getStageGeometry(activeStage.slug) : undefined;
  const itinerary: MapItineraryStage[] = campaign.stageSlugs.flatMap((slug, index) => {
    const stage = campaignStages.find((item) => item.slug === slug);
    const path = mapRepository.getStageGeometry(slug);
    if (!stage || !path) return [];
    return [{ stageSlug: slug, number: index + 1, startTown: stage.startTown, endTown: stage.endTown, distanceKm: path.distanceKm, coordinates: path.coordinates, status: completedStageSlugs.includes(slug) || journeyCompleted ? 'completed' : slug === activeStage?.slug ? 'active' : 'future' }];
  });
  useEffect(() => {
    let disposed = false;
    void Promise.all(campaign.stageSlugs.map((slug) => staticCaminoDataRepository.getStage(slug))).then((stages) => {
      if (!disposed) setCampaignStages(stages.filter((stage): stage is CaminoStage => Boolean(stage)));
    });
    return () => { disposed = true; };
  }, [campaign.stageSlugs]);
  useEffect(() => {
    let disposed = false;
    if (activeStage) void staticCaminoDataRepository.getServicesByStage(activeStage.slug).then((items) => { if (!disposed) setServices(items); });
    return () => { disposed = true; };
  }, [activeStage?.slug]);
  const visible = services.filter((service) => layer === 'todos' || (layer === 'salud' ? ['farmacia', 'centro_salud'].includes(service.type) : service.type === layer));
  const position = journeyCompleted && geometry ? positionOnRoute(geometry.coordinates, geometry.distanceKm) : tracking.currentLocation;
  const simulation = tracking.session?.mode === 'simulation';
  const active = tracking.session?.status === 'active';
  return (
    <View>
      <View style={[styles.section, { paddingVertical: 10 }]}>
        <Text style={styles.heading}>{activeStage?.startTown} a {activeStage?.endTown}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['todos', 'albergue', 'fuente', 'salud', 'monumento'].map((id) => <Chip key={id} label={{ todos: 'Todo', albergue: 'Dormir', fuente: 'Agua', salud: 'Salud', monumento: 'Cultura' }[id]!} active={layer === id} onPress={() => setLayer(id)} />)}
        </ScrollView>
      </View>
      <View style={{ height: 420, minHeight: 300, backgroundColor: '#132923' }}>
        {geometry ? <MapCanvas stageSlug={geometry.stageSlug} coordinates={geometry.coordinates} itinerary={itinerary} completed={completedRoute(geometry.coordinates, journeyCompleted ? geometry.distanceKm : tracking.completedDistanceKm)} position={position} services={visible} onSelectService={(id) => { const service = services.find((item) => item.id === id); if (service) onSelectService(service); }} /> : <View style={styles.section}><Text style={styles.text}>Trazado no disponible para esta etapa.</Text><Text style={styles.muted}>Los servicios y el registro GPS siguen disponibles.</Text></View>}
      </View>
      <View style={styles.section}>
        <View style={styles.between}><Text style={styles.heading}>{journeyCompleted ? 'Camino completado' : `${tracking.progressPercent}% de la etapa`}</Text><Text style={[styles.muted, { color: simulation ? colors.gold : colors.green }]}>{simulation ? 'SIMULACION' : tracking.locationStatus === 'ready' ? 'GPS ACTIVO' : tracking.locationStatus === 'locating' ? 'LOCALIZANDO' : 'SIN GPS'}</Text></View>
        <ProgressBar progress={journeyCompleted ? 100 : tracking.progressPercent} />
        <View style={styles.between}>
          <View><Text style={styles.title}>{tracking.completedDistanceKm.toFixed(1)} <Text style={styles.muted}>km</Text></Text><Text style={styles.muted}>Recorridos</Text></View>
          <View><Text style={styles.title}>{tracking.remainingKm.toFixed(1)} <Text style={styles.muted}>km</Text></Text><Text style={styles.muted}>Hasta la llegada</Text></View>
          <View><Text style={styles.title}>{tracking.etaMinutes !== undefined ? `${Math.floor(tracking.etaMinutes / 60)}h ${tracking.etaMinutes % 60}m` : '--'}</Text><Text style={styles.muted}>Tiempo restante</Text></View>
        </View>
        {tracking.lastError ? <Text style={styles.error}>{tracking.lastError}</Text> : null}
        {tracking.locationError ? <Text style={styles.error}>{tracking.locationError}</Text> : null}
        {!journeyCompleted ? <View style={styles.row}>
          <Button onPress={tracking.session ? active ? onPause : onResume : onStart}>{tracking.session ? active ? 'Pausar' : 'Continuar' : 'Iniciar recorrido'}</Button>
          <Button variant="secondary" onPress={onComplete}>Cerrar etapa</Button>
          <Pressable accessibilityRole="button" accessibilityLabel="Panel de simulacion" onPress={() => setSimulator(!simulator)} style={styles.icon}><FlaskConical color={colors.gold} size={21} /></Pressable>
        </View> : null}
        {(simulator || simulation) && !journeyCompleted ? <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, gap: 12 }}>
          <Text style={styles.heading}>Simulacion del recorrido</Text>
          <View style={styles.row}>
            {!simulation ? <Button onPress={onStartSimulation}>Iniciar simulacion</Button> : <Pressable accessibilityRole="button" accessibilityLabel={active ? 'Pausar simulacion' : 'Continuar simulacion'} style={styles.icon} onPress={active ? onPause : onResume}>{active ? <Pause size={22} color={colors.gold} /> : <Play size={22} color={colors.gold} />}</Pressable>}
            {[1, 5, 20].map((speed) => <Chip key={speed} label={`${speed}x`} active={speed === simulationSpeed} onPress={() => onSimulationSpeed(speed)} />)}
            <Pressable disabled={!simulation} accessibilityRole="button" accessibilityLabel="Siguiente hito" style={[styles.icon, { opacity: simulation ? 1 : .3 }]} onPress={() => onAdvanceSimulation(Math.min(100, (Math.floor(tracking.progressPercent / 25) + 1) * 25))}><SkipForward size={22} color={colors.gold} /></Pressable>
          </View>
        </View> : null}
        {decision.weather ? <Text style={styles.muted}>Clima actual: {decision.weather.temperatureC ?? '--'} C</Text> : null}
        <View style={styles.row}>
          <Sparkles color={colors.gold} size={20} />
          <Text style={[styles.muted, { flex: 1 }]}>{decision.directorRunning ? 'Motor IA consultando...' : decision.lastDirectorAtIso ? `Motor IA conectado · ${new Date(decision.lastDirectorAtIso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Motor IA'}</Text>
          <Button variant="secondary" disabled={!tracking.currentLocation || decision.directorRunning || (decision.directorCooldownSeconds ?? 0) > 0} onPress={onRunDecision}>{decision.directorRunning ? 'Consultando...' : decision.directorCooldownSeconds ? `Disponible en ${decision.directorCooldownSeconds}s` : 'Pedir aviso IA'}</Button>
        </View>
        {decision.directorError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{decision.directorError}</Text> : null}
        {decision.remoteWarning ? <Text style={styles.muted}>{decision.remoteWarning}</Text> : null}
      </View>
    </View>
  );
}
