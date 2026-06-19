import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DecisionRecommendation } from '../../domain';

type DecisionPanelProps = {
  recommendations: DecisionRecommendation[];
  running: boolean;
  error?: string;
  onRun: () => void;
  onMarkShown: (recommendation: DecisionRecommendation) => void;
};

export function DecisionPanel({ recommendations, running, error, onRun, onMarkShown }: DecisionPanelProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Motor de decision</Text>
        <Pressable style={styles.button} onPress={onRun} disabled={running}>
          <Text style={styles.buttonText}>{running ? 'Evaluando...' : 'Reevaluar ahora'}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {recommendations.length === 0 ? <Text style={styles.empty}>El motor se ejecuta en segundo plano con ultreia-director. Registra ubicacion para enriquecer el contexto.</Text> : null}
      {recommendations.map((recommendation) => (
        <Pressable key={recommendation.id} style={styles.recommendation} onPress={() => onMarkShown(recommendation)}>
          <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
          <Text style={styles.recommendationMeta}>{recommendation.type} · prioridad {recommendation.priority}</Text>
          <Text style={styles.recommendationBody}>{recommendation.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#F4B321',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  buttonText: {
    color: '#071923',
    fontWeight: '900',
  },
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
  error: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recommendation: {
    borderTopColor: '#25485A',
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  recommendationBody: {
    color: '#D9E3E6',
    fontSize: 13,
    lineHeight: 19,
  },
  recommendationMeta: {
    color: '#A9B7B7',
    fontSize: 12,
  },
  recommendationTitle: {
    color: '#F4F0E8',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: '#F4B321',
    fontSize: 18,
    fontWeight: '900',
  },
});
