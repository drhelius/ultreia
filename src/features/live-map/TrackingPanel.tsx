import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LiveTrackingState } from './useLiveTracking';

type TrackingPanelProps = {
  state: LiveTrackingState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onRecordSample: () => void;
};

export function TrackingPanel({ state, onStart, onPause, onResume, onComplete, onRecordSample }: TrackingPanelProps) {
  const isActive = state.session?.status === 'active';
  const isPaused = state.session?.status === 'paused';

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Metric label="Progreso" value={`${state.progressPercent}%`} />
        <Metric label="Recorrido" value={`${state.completedDistanceKm.toFixed(2)} km`} />
        <Metric label="Restante" value={`${state.remainingKm.toFixed(2)} km`} />
      </View>
      <Text style={styles.detail}>{state.etaMinutes ? `ETA aproximada: ${state.etaMinutes} min` : 'ETA disponible tras registrar movimiento.'}</Text>
      {state.lastError ? <Text style={styles.error}>{state.lastError}</Text> : null}
      <View style={styles.actions}>
        {!state.session ? <Action label="Iniciar" onPress={onStart} /> : null}
        {isActive ? <Action label="Pausar" onPress={onPause} /> : null}
        {isPaused ? <Action label="Reanudar" onPress={onResume} /> : null}
        {state.session ? <Action label="Registrar GPS" onPress={onRecordSample} /> : null}
        {state.session ? <Action label="Completar" onPress={onComplete} secondary /> : null}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable style={[styles.action, secondary && styles.actionSecondary]} onPress={onPress}>
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    backgroundColor: '#F4B321',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionSecondary: {
    backgroundColor: '#17372F',
    borderColor: '#25485A',
    borderWidth: 1,
  },
  actionText: {
    color: '#071923',
    fontWeight: '900',
  },
  actionTextSecondary: {
    color: '#F4F0E8',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detail: {
    color: '#A9B7B7',
    fontSize: 13,
  },
  error: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '800',
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: '#A9B7B7',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: '#F4B321',
    fontSize: 18,
    fontWeight: '900',
  },
  panel: {
    backgroundColor: '#102A36',
    borderColor: '#25485A',
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
