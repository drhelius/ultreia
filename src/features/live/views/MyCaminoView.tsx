import { StyleSheet, Text, View } from 'react-native';

import type { ActiveJourney, CampaignPlan, CaminoRoute, CaminoStage, UserProfile } from '../../../domain';
import { Badge, CredentialCard, ProgressBar, StatTile, Surface } from '../../../ui/components';
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
};

export function MyCaminoView({ profile, campaign, route, activeStage, tracking, engagement }: MyCaminoViewProps) {
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
          <StatTile label="Etapas" value={`${campaign.stageSlugs.length}`} />
        </View>
      </Surface>

      <CredentialCard pilgrimName={profile.displayName} caminoTitle={route?.title ?? campaign.routeSlug} stamps={progression?.unlockedAchievementIds.length ?? 0} onOpen={() => undefined} />

      <Surface>
        <Text style={styles.sectionTitle}>Logros recientes</Text>
        <View style={styles.badgeRow}>
          <Badge title="Primera etapa" subtitle="Progreso" locked={!progression?.unlockedAchievementIds.includes('achievement:primera-etapa')} />
          <Badge title="Compostelano" subtitle="Llegada" locked />
          <Badge title="Buen companero" subtitle="Reportes" locked />
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', gap: 10 },
  cardText: { color: '#A9B7B7', fontSize: 14, lineHeight: 20 },
  container: { gap: 14 },
  overline: { color: '#F4B321', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  progressBlock: { gap: 8, marginTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: '#F4B321', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  subtitle: { color: '#A9B7B7', fontSize: 14 },
  title: { color: '#F4F0E8', fontSize: 28, fontWeight: '900' },
});
