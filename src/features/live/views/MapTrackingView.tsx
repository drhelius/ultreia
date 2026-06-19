import { StyleSheet, Text, View } from 'react-native';

import type { CaminoStage } from '../../../domain';
import { Surface } from '../../../ui/components';
import { DecisionPanel, MapLayers, TrackingPanel, type DecisionEngineState, type LiveTrackingState } from '../../live-map';
import type { DecisionRecommendation } from '../../../domain';

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
};

export function MapTrackingView({ activeStage, tracking, decision, onStart, onPause, onResume, onComplete, onRecordSample, onRunDecision, onMarkDecisionShown }: MapTrackingViewProps) {
  return (
    <View style={styles.container}>
      <Surface style={styles.mapPlaceholder}>
        <Text style={styles.mapTitle}>Mapa</Text>
        <Text style={styles.mapText}>{activeStage ? `${activeStage.title} · ${activeStage.distanceKm} km` : 'Etapa pendiente'}</Text>
        <Text style={styles.mapText}>Mapa conectado con POIs verificados y GPS real.</Text>
      </Surface>
      <TrackingPanel state={tracking} onStart={onStart} onPause={onPause} onResume={onResume} onComplete={onComplete} onRecordSample={onRecordSample} />
      <MapLayers nearby={tracking.nearby} />
      <DecisionPanel recommendations={decision.recommendations} running={decision.running} error={decision.error} onRun={onRunDecision} onMarkShown={onMarkDecisionShown} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  mapPlaceholder: { minHeight: 220, justifyContent: 'center' },
  mapText: { color: '#A9B7B7', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  mapTitle: { color: '#F4B321', fontSize: 24, fontWeight: '900', textAlign: 'center' },
});
