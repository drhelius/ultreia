import { StyleSheet, Text, View } from 'react-native';

import type { ActiveJourney, CampaignPlan, CaminoRoute, CaminoStage, UserProfile } from '../../../domain';
import { Badge, Button, CredentialCard, ProgressBar, StatTile, Surface } from '../../../ui/components';
import type { EngagementState } from '../../engagement';
import type { LiveTrackingState } from '../../live-map';

type MyCaminoViewProps = {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  route?: CaminoRoute;
  activeStage?: CaminoStage;
  tracking: LiveTrackingState;
  engagement: EngagementState;
  onMap?: () => void;
  onCredential?: () => void;
  onCompleteQuest?: (id: string) => void;
};

export function MyCaminoView({ profile, journey, campaign, route, activeStage, tracking, engagement, onMap, onCredential, onCompleteQuest }: MyCaminoViewProps) {
  const progression = engagement.progression;
  const classLabel = profile.pilgrimClasses?.length ? profile.pilgrimClasses.join(', ') : profile.pilgrimClass;
  const modeLabel = profile.travelMode === 'bike' ? 'bici' : profile.travelMode === 'car' ? 'coche' : 'a pie';

  return (
    <View style={styles.container}>
      <Surface>
        <Text style={styles.overline}>Peregrino</Text>
        <Text style={styles.title}>{profile.displayName}</Text>
        <Text style={styles.subtitle}>{classLabel} · {modeLabel} · {profile.budgetMode}</Text>
        <View style={styles.progressBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardText}>Nivel {progression?.level ?? 1}</Text>
            <Text style={styles.cardText}>{progression?.currentXp ?? 0} XP</Text>
          </View>
          <ProgressBar progress={progression ? (progression.currentXp / (progression.currentXp + progression.xpToNextLevel)) * 100 : 0} />
        </View>
      </Surface>

      <Surface>
        <Text style={styles.sectionTitle}>{campaign.title}</Text>
        <Text style={styles.cardText}>{route?.title ?? campaign.routeSlug}</Text>
        <Text style={styles.cardText}>Etapa activa: {activeStage?.title ?? 'Pendiente'}</Text>
        <View style={styles.statsRow}>
          <StatTile label="Progreso" value={`${tracking.progressPercent}%`} />
          <StatTile label="Restante" value={`${tracking.remainingKm.toFixed(1)} km`} />
          <StatTile label="Etapas" value={`${engagement.stageProgress?.filter((item) => item.state === 'completada').length ?? 0}/${campaign.stageSlugs.length}`} />
        </View>
        <View style={{ marginTop: 14 }}><Button onPress={() => onMap?.()}>{journey.status === 'completed' ? 'Ver Camino completado' : tracking.session ? 'Continuar mi etapa' : 'Empezar la etapa'}</Button></View>
      </Surface>

      <CredentialCard pilgrimName={profile.displayName} caminoTitle={route?.title ?? campaign.routeSlug} stamps={engagement.stageProgress?.filter((item) => item.state === 'completada').length ?? 0} totalStamps={campaign.stageSlugs.length} onOpen={() => onCredential?.()} />

      <Surface>
        <Text style={styles.sectionTitle}>Logros recientes</Text>
        <View style={styles.badgeRow}>
          <Badge title="Primera etapa" subtitle="Progreso" locked={!progression?.unlockedAchievementIds.includes('achievement:primera-etapa')} />
          <Badge title="Compostelano" subtitle="Llegada" locked={!progression?.unlockedAchievementIds.includes('achievement:compostela')} />
          <Badge title="Buen companero" subtitle="Reportes" locked={!progression?.unlockedAchievementIds.includes('achievement:buen-companero')} />
        </View>
      </Surface>
      {journey.status !== 'completed' ? <View style={{ gap: 12 }}>
        <Text style={styles.sectionTitle}>La mision de hoy</Text><Text style={styles.cardText}>{engagement.questBoard?.mainQuest.description}</Text>
        {engagement.questBoard?.sideQuests.slice(0, 3).map((quest) => {
          const completed = engagement.questStates?.some((item) => item.questTemplateId === quest.id && item.status === 'completed');
          return <View key={quest.id} style={{ gap: 8, borderTopColor: '#2C4B56', borderTopWidth: 1, paddingTop: 12 }}><Text style={styles.cardText}>{quest.title}</Text><Text style={styles.cardText}>{quest.description}</Text><Button variant="secondary" disabled={completed} onPress={() => onCompleteQuest?.(quest.id)}>{completed ? 'Completada · 50 XP' : 'Confirmar visita · 50 XP'}</Button></View>;
        })}
      </View> : <Text style={styles.sectionTitle}>Has completado tu Camino. Tu diario y tus recuerdos ya estan guardados.</Text>}
      <Text style={styles.cardText}>Presupuesto estimado: {engagement.budget?.estimatedTotalEur ?? '--'} EUR · Gastado: {engagement.budget?.spentTotalEur ?? 0} EUR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardText: { color: '#A9B7B7', fontSize: 14, lineHeight: 20 },
  container: { gap: 18, padding: 18 },
  overline: { color: '#F4B321', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  progressBlock: { gap: 8, marginTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: '#F4B321', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  subtitle: { color: '#A9B7B7', fontSize: 14 },
  title: { color: '#F4F0E8', fontSize: 28, fontWeight: '900' },
});
