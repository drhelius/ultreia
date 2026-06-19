import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EngagementState } from './useEngagement';

type EngagementPanelProps = {
  state: EngagementState;
  onActivateQuest: (questId: string) => void;
  onCompleteStage: () => void;
  onSaveExpense: (amountEur: number, note: string) => void;
};

export function EngagementPanel({ state, onActivateQuest, onCompleteStage, onSaveExpense }: EngagementPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Quest principal</Text>
        <Text style={styles.cardTitle}>{state.questBoard?.mainQuest.title ?? 'Etapa pendiente'}</Text>
        <Text style={styles.text}>{state.questBoard?.mainQuest.description ?? 'Selecciona una etapa activa para ver la mision principal.'}</Text>
        {state.questBoard?.mainQuest ? <Action label="Completar etapa" onPress={onCompleteStage} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Quests secundarias</Text>
        {state.questBoard?.sideQuests.slice(0, 4).map((quest) => (
          <Pressable key={quest.id} style={styles.listItem} onPress={() => onActivateQuest(quest.id)}>
            <Text style={styles.cardTitle}>{quest.title}</Text>
            <Text style={styles.text}>{quest.description}</Text>
          </Pressable>
        )) ?? <Text style={styles.text}>Sin quests secundarias para esta etapa.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Camino seguro</Text>
        {state.questBoard?.safetyQuests.slice(0, 3).map((quest) => (
          <View key={quest.id} style={styles.listItem}>
            <Text style={styles.cardTitle}>{quest.title}</Text>
            <Text style={styles.text}>{quest.description}</Text>
          </View>
        )) ?? <Text style={styles.text}>SOS disponible. Recursos cercanos dependen del data pack y ubicacion.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Progreso</Text>
        <Text style={styles.cardTitle}>Nivel {state.progression?.level ?? 1}</Text>
        <Text style={styles.text}>{state.progression?.currentXp ?? 0} XP · faltan {state.progression?.xpToNextLevel ?? 500} XP</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Presupuesto</Text>
        <Text style={styles.cardTitle}>{state.budget?.remainingEur ?? '-'} EUR restantes</Text>
        <Text style={styles.text}>Estimado: {state.budget?.estimatedTotalEur ?? '-'} EUR · gastado: {state.budget?.spentTotalEur ?? 0} EUR</Text>
        <View style={styles.actionsRow}>
          <Action label="+ cafe 3 EUR" onPress={() => onSaveExpense(3, 'Cafe o snack')} secondary />
          <Action label="+ albergue 12 EUR" onPress={() => onSaveExpense(12, 'Alojamiento')} secondary />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Diario</Text>
        <Text style={styles.cardTitle}>{state.journalDraft?.title ?? 'Borrador pendiente'}</Text>
        <Text style={styles.text}>{state.journalDraft?.body ?? 'Completa la etapa para generar un borrador editable del diario.'}</Text>
      </View>
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
    alignItems: 'center',
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
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    backgroundColor: '#102A36',
    borderColor: '#25485A',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardTitle: {
    color: '#F4F0E8',
    fontSize: 15,
    fontWeight: '900',
  },
  container: {
    gap: 12,
  },
  listItem: {
    borderTopColor: '#25485A',
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  text: {
    color: '#A9B7B7',
    fontSize: 13,
    lineHeight: 19,
  },
  title: {
    color: '#F4B321',
    fontSize: 18,
    fontWeight: '900',
  },
});
